import {afterEach, describe, expect, it} from 'vitest'
import WebSocket from 'ws'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'
import {computeSubscriptionHash} from '../modules/tdp/subscriptionPolicy.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []
const orgStoreProfileSubscriptionHash = computeSubscriptionHash(['org.store.profile'])

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

const postJson = async <TResponse>(url: string, body: Record<string, unknown>): Promise<{
  status: number
  payload: TResponse
}> => postJsonWithHeaders(url, body)

const postJsonWithHeaders = async <TResponse>(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{
  status: number
  payload: TResponse
}> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {'content-type': 'application/json', ...headers},
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    payload: await response.json() as TResponse,
  }
}

const createTerminal = async (baseUrl: string, sandboxId: string) => {
  const activationResponse = await fetch(`${baseUrl}/api/v1/admin/activation-codes/batch`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId,
      count: 1,
    }),
  })
  const activationPayload = await activationResponse.json() as {
    data: {
      codes: string[]
    }
  }
  const activationCode = activationPayload.data.codes[0]
  if (!activationCode) {
    throw new Error('failed to create activation code')
  }

  const terminalResponse = await fetch(`${baseUrl}/api/v1/terminals/activate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId,
      activationCode,
      deviceFingerprint: `device-${Date.now()}`,
      deviceInfo: {
        id: `device-${Date.now()}`,
        model: 'TEST-DEVICE',
      },
    }),
  })
  const terminalPayload = await terminalResponse.json() as {
    data: {
      terminalId: string
      token: string
    }
  }
  return terminalPayload.data
}

const createActivationCode = async (
  baseUrl: string,
  sandboxId: string,
  options?: {
    profileId?: string
    templateId?: string
  },
) => {
  const activationResponse = await fetch(`${baseUrl}/api/v1/admin/activation-codes/batch`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId,
      count: 1,
      profileId: options?.profileId,
      templateId: options?.templateId,
    }),
  })
  const activationPayload = await activationResponse.json() as {
    data: {
      codes: string[]
    }
  }
  const activationCode = activationPayload.data.codes[0]
  if (!activationCode) {
    throw new Error('failed to create activation code')
  }
  return activationCode
}

const activateTerminalWithRuntime = async (
  baseUrl: string,
  input: {
    sandboxId: string
    activationCode: string
    clientRuntime?: Record<string, unknown>
  },
) => {
  const response = await fetch(`${baseUrl}/api/v1/terminals/activate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId: input.sandboxId,
      activationCode: input.activationCode,
      deviceFingerprint: `device-${Date.now()}-${Math.random()}`,
      deviceInfo: {
        id: `device-${Date.now()}-${Math.random()}`,
        model: 'TEST-DEVICE',
      },
      clientRuntime: input.clientRuntime,
    }),
  })
  return {
    status: response.status,
    payload: await response.json() as {
      success: boolean
      data?: {
        terminalId: string
        token: string
        activationCompatibility?: {
          assemblyId?: string
          acceptedProfileCode: string
          acceptedTemplateCode?: string
          acceptedCapabilities?: string[]
          warnings?: string[]
        }
      }
      error?: {
        message: string
        details?: Record<string, unknown>
      }
    },
  }
}

describe('mock-terminal-platform TDP projection publisher contract', () => {
  const publishHeaders = (server: ReturnType<typeof createMockTerminalPlatformTestServer>) => ({
    authorization: `Bearer ${server.getAdminToken()}`,
  })

  it('allows legacy terminal activation but reports missing client runtime capability', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId)

    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
    })

    expect(activation.status).toBe(201)
    expect(activation.payload.data?.terminalId).toBeTruthy()
    expect(activation.payload.data?.activationCompatibility).toMatchObject({
      acceptedProfileCode: 'KERNEL_BASE_ANDROID_POS',
      acceptedTemplateCode: 'KERNEL_BASE_ANDROID_POS_STANDARD',
      warnings: ['CLIENT_RUNTIME_MISSING'],
    })
  })

  it('accepts terminal activation when assembly supports the assigned profile and template', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId)

    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'mixc-android-pos-rn84',
        assemblyVersion: '1.0.0',
        supportedProfileCodes: ['KERNEL_BASE_ANDROID_POS'],
        supportedTemplateCodes: ['KERNEL_BASE_ANDROID_POS_STANDARD'],
        supportedCapabilities: ['printer', 'scanner'],
      },
    })

    expect(activation.status).toBe(201)
    expect(activation.payload.data?.activationCompatibility).toMatchObject({
      assemblyId: 'mixc-android-pos-rn84',
      acceptedProfileCode: 'KERNEL_BASE_ANDROID_POS',
      acceptedTemplateCode: 'KERNEL_BASE_ANDROID_POS_STANDARD',
      acceptedCapabilities: ['printer', 'scanner'],
      warnings: [],
    })
  })

  it('rejects terminal activation when assembly does not support the assigned profile', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId)

    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'mixc-kds-rn84',
        supportedProfileCodes: ['KDS'],
        supportedTemplateCodes: ['KDS_STANDARD'],
      },
    })

    expect(activation.status).toBe(400)
    expect(activation.payload.error).toMatchObject({
      message: 'TERMINAL_PROFILE_NOT_SUPPORTED',
      details: {
        assemblyId: 'mixc-kds-rn84',
        requestedProfileCode: 'KERNEL_BASE_ANDROID_POS',
        supportedProfileCodes: ['KDS'],
      },
    })
  })

  it('treats repeated source_event_id publishes as idempotent and does not duplicate terminal changes', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId

    const createProjection = () => postJsonWithHeaders<{
      data: {
        total: number
        items: Array<{
          status: string
          revision: number
          sourceEventId?: string
          targetTerminalIds: string[]
        }>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'menu.catalog',
          scopeType: 'TERMINAL',
          scopeKey: 'terminal-publisher-001',
          itemKey: 'menu-breakfast',
          source_event_id: 'evt-menu-breakfast-001',
          source_revision: 1,
          sourceReleaseId: 'evt-menu-breakfast-001',
          payload: {
            schema_version: 1,
            projection_kind: 'catering_product',
            source_event_id: 'evt-menu-breakfast-001',
            source_revision: 1,
            data: {menu_id: 'menu-breakfast', name: 'Breakfast Menu'},
          },
          targetTerminalIds: ['terminal-publisher-001'],
        },
      ],
    }, publishHeaders(server))

    const first = await createProjection()
    const replay = await createProjection()

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(first.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      revision: 1,
      sourceEventId: 'evt-menu-breakfast-001',
      targetTerminalIds: ['terminal-publisher-001'],
    })
    expect(replay.payload.data.items[0]).toMatchObject({
      status: 'IDEMPOTENT_REPLAY',
      revision: 1,
      sourceEventId: 'evt-menu-breakfast-001',
      targetTerminalIds: [],
    })

    const changesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/terminal-publisher-001/changes?sandboxId=${sandboxId}&cursor=0&limit=20`,
    )
    const changesPayload = await changesResponse.json() as {
      data: {
        changes: Array<{
          topic: string
          itemKey: string
          revision: number
          sourceReleaseId?: string | null
        }>
      }
    }

    expect(changesPayload.data.changes).toHaveLength(1)
    expect(changesPayload.data.changes[0]).toMatchObject({
      topic: 'menu.catalog',
      itemKey: 'menu-breakfast',
      revision: 1,
      sourceReleaseId: 'evt-menu-breakfast-001',
    })
  })

  it('does not let stale source_revision overwrite the retained projection', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const endpoint = `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`

    const publish = (input: {eventId: string; sourceRevision: number; name: string}) =>
      postJsonWithHeaders<{
        data: {
          items: Array<{
            status: string
            revision: number
            acceptedSourceRevision?: number
            sourceRevision?: number
          }>
        }
      }>(endpoint, {
        sandboxId,
        projections: [
          {
            topicKey: 'menu.catalog',
            scopeType: 'TERMINAL',
            scopeKey: 'terminal-publisher-002',
            itemKey: 'menu-lunch',
            sourceEventId: input.eventId,
            sourceRevision: input.sourceRevision,
            sourceReleaseId: input.eventId,
            payload: {
              schema_version: 1,
              projection_kind: 'catering_product',
              source_event_id: input.eventId,
              source_revision: input.sourceRevision,
              data: {menu_id: 'menu-lunch', name: input.name},
            },
            targetTerminalIds: ['terminal-publisher-002'],
          },
        ],
      }, publishHeaders(server))

    const first = await publish({eventId: 'evt-menu-lunch-002', sourceRevision: 2, name: 'Lunch v2'})
    const stale = await publish({eventId: 'evt-menu-lunch-001', sourceRevision: 1, name: 'Lunch stale'})
    const next = await publish({eventId: 'evt-menu-lunch-003', sourceRevision: 3, name: 'Lunch v3'})

    expect(first.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      revision: 1,
      sourceRevision: 2,
    })
    expect(stale.payload.data.items[0]).toMatchObject({
      status: 'STALE_SOURCE_REVISION',
      revision: 1,
      sourceRevision: 1,
      acceptedSourceRevision: 2,
    })
    expect(next.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      revision: 2,
      sourceRevision: 3,
    })

    const snapshotResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/terminal-publisher-002/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotPayload = await snapshotResponse.json() as {
      data: Array<{
        itemKey: string
        revision: number
        payload: {
          data?: {
            name?: string
          }
        }
      }>
    }

    expect(snapshotPayload.data).toHaveLength(1)
    expect(snapshotPayload.data[0]).toMatchObject({
      itemKey: 'menu-lunch',
      revision: 2,
      payload: {
        data: {
          name: 'Lunch v3',
        },
      },
    })
  })

  it('filters terminal snapshot and changes by explicit subscribed topics', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const terminalId = 'terminal-topic-subscription-001'

    const response = await postJsonWithHeaders<{
      data: {
        items: Array<{
          status: string
          topicKey: string
          targetTerminalIds: string[]
        }>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.store.profile',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'store-profile',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            data: {store_name: 'Allowed Store'},
          },
          targetTerminalIds: [terminalId],
        },
        {
          topicKey: 'catering.product',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'sku-coffee',
          payload: {
            schema_version: 1,
            projection_kind: 'catering_product',
            data: {product_name: 'Rejected Coffee'},
          },
          targetTerminalIds: [terminalId],
        },
      ],
    }, publishHeaders(server))

    expect(response.status).toBe(200)
    expect(response.payload.data.items).toEqual([
      expect.objectContaining({status: 'ACCEPTED', topicKey: 'org.store.profile', targetTerminalIds: [terminalId]}),
      expect.objectContaining({status: 'ACCEPTED', topicKey: 'catering.product', targetTerminalIds: [terminalId]}),
    ])

    const legacyChangesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=20`,
    )
    const legacyChangesPayload = await legacyChangesResponse.json() as {
      data: {
        changes: Array<{topic: string}>
        highWatermark: number
      }
    }
    expect(legacyChangesPayload.data.changes.map(item => item.topic).sort()).toEqual([
      'catering.product',
      'org.store.profile',
    ])
    expect(legacyChangesPayload.data.highWatermark).toBe(2)

    const filteredChangesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=20&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const filteredChangesPayload = await filteredChangesResponse.json() as {
      data: {
        changes: Array<{topic: string; itemKey: string}>
        highWatermark: number
      }
    }
    expect(filteredChangesPayload.data.changes).toEqual([
      expect.objectContaining({topic: 'org.store.profile', itemKey: 'store-profile'}),
    ])
    expect(filteredChangesPayload.data.highWatermark).toBe(1)

    const filteredSnapshotResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const filteredSnapshotPayload = await filteredSnapshotResponse.json() as {
      data: Array<{topic: string; itemKey: string}>
    }
    expect(filteredSnapshotPayload.data).toEqual([
      expect.objectContaining({topic: 'org.store.profile', itemKey: 'store-profile'}),
    ])
  })

  it('reports hasMore when visible changes exceed the requested limit', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const terminalId = 'terminal-topic-subscription-pagination'

    const response = await postJsonWithHeaders<{
      data: {
        items: Array<{
          status: string
          topicKey: string
        }>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.store.profile',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'store-page-1',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            data: {store_name: 'Store Page 1'},
          },
          targetTerminalIds: [terminalId],
        },
        {
          topicKey: 'org.store.profile',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'store-page-2',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            data: {store_name: 'Store Page 2'},
          },
          targetTerminalIds: [terminalId],
        },
        {
          topicKey: 'catering.product',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'sku-filtered',
          payload: {
            schema_version: 1,
            projection_kind: 'catering_product',
            data: {product_name: 'Filtered Product'},
          },
          targetTerminalIds: [terminalId],
        },
      ],
    }, publishHeaders(server))

    expect(response.status).toBe(200)

    const firstPageResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=1&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const firstPagePayload = await firstPageResponse.json() as {
      data: {
        changes: Array<{topic: string; itemKey: string}>
        nextCursor: number
        hasMore: boolean
        highWatermark: number
      }
    }

    expect(firstPagePayload.data.changes).toEqual([
      expect.objectContaining({topic: 'org.store.profile', itemKey: 'store-page-1'}),
    ])
    expect(firstPagePayload.data.nextCursor).toBe(1)
    expect(firstPagePayload.data.hasMore).toBe(true)
    expect(firstPagePayload.data.highWatermark).toBe(2)

    const secondPageResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=${firstPagePayload.data.nextCursor}&limit=1&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const secondPagePayload = await secondPageResponse.json() as {
      data: {
        changes: Array<{topic: string; itemKey: string}>
        nextCursor: number
        hasMore: boolean
        highWatermark: number
      }
    }

    expect(secondPagePayload.data.changes).toEqual([
      expect.objectContaining({topic: 'org.store.profile', itemKey: 'store-page-2'}),
    ])
    expect(secondPagePayload.data.nextCursor).toBe(2)
    expect(secondPagePayload.data.hasMore).toBe(false)
  })

  it('sends chunked full snapshots to clients that advertise snapshot chunk capability', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(server.getHttpBaseUrl(), sandboxId)

    const projections = Array.from({length: 51}, (_, index) => ({
      topicKey: 'org.store.profile',
      scopeType: 'TERMINAL',
      scopeKey: terminalId,
      itemKey: `store-chunk-${index + 1}`,
      payload: {
        schema_version: 1,
        projection_kind: 'organization',
        data: {store_name: `Store Chunk ${index + 1}`},
      },
      targetTerminalIds: [terminalId],
    }))
    const response = await postJsonWithHeaders<{
      data: {
        total: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections,
    }, publishHeaders(server))

    expect(response.status).toBe(200)
    expect(response.payload.data.total).toBe(51)

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const messages = await new Promise<Array<{type: string; data?: Record<string, unknown>}>>((resolve, reject) => {
      const collected: Array<{type: string; data?: Record<string, unknown>}> = []
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for chunked snapshot'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            capabilities: [
              'tdp.topic-subscription.v1',
              'tdp.snapshot-chunk.v1',
            ],
            subscribedTopics: ['org.store.profile'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>}
        collected.push(message)
        if (message.type === 'SNAPSHOT_END') {
          clearTimeout(timeout)
          socket.close()
          resolve(collected)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(messages.map(message => message.type)).toEqual([
      'SESSION_READY',
      'SNAPSHOT_BEGIN',
      'SNAPSHOT_CHUNK',
      'SNAPSHOT_CHUNK',
      'SNAPSHOT_END',
    ])
    expect(messages[1].data).toMatchObject({
      totalChunks: 2,
      totalItems: 51,
      highWatermark: 51,
    })
    expect((messages[2].data?.items as unknown[])).toHaveLength(50)
    expect((messages[3].data?.items as unknown[])).toHaveLength(1)
  })

  it('narrows explicit subscriptions with terminal profile/template allowed topics', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const profileResponse = await postJsonWithHeaders<{data: {profileId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/profiles`,
      {
        sandboxId,
        profileCode: 'TOPIC_LIMITED_PROFILE',
        name: 'Topic Limited Profile',
        capabilities: {
          allowedTopics: ['org.store.profile', 'catering.product'],
        },
      },
      publishHeaders(server),
    )
    const templateResponse = await postJsonWithHeaders<{data: {templateId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/templates`,
      {
        sandboxId,
        templateCode: 'TOPIC_LIMITED_TEMPLATE',
        name: 'Topic Limited Template',
        profileId: profileResponse.payload.data.profileId,
        presetConfig: {
          tdp: {
            allowedTopics: ['org.store.profile'],
          },
        },
      },
      publishHeaders(server),
    )
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId, {
      profileId: profileResponse.payload.data.profileId,
      templateId: templateResponse.payload.data.templateId,
    })
    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'topic-limited-assembly',
        supportedProfileCodes: ['TOPIC_LIMITED_PROFILE'],
        supportedTemplateCodes: ['TOPIC_LIMITED_TEMPLATE'],
      },
    })
    expect(activation.status).toBe(201)
    const terminalId = activation.payload.data?.terminalId
    const token = (activation.payload.data as {token?: string} | undefined)?.token
    if (!terminalId || !token) {
      throw new Error('expected terminal id')
    }

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const sessionReady = await new Promise<{type: string; data?: Record<string, unknown>}>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for subscription policy session ready'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            capabilities: ['tdp.topic-subscription.v1'],
            subscribedTopics: ['org.store.profile', 'catering.product', 'invalid*topic'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>}
        if (message.type === 'SESSION_READY') {
          clearTimeout(timeout)
          socket.close()
          resolve(message)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(sessionReady.data?.subscription).toMatchObject({
      mode: 'explicit',
      acceptedTopics: ['org.store.profile'],
      rejectedTopics: ['catering.product', 'invalid*topic'],
      requiredMissingTopics: [],
    })

    const sessionsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/sessions?sandboxId=${sandboxId}`,
      {
        headers: publishHeaders(server),
      },
    )
    expect(sessionsResponse.status).toBe(200)
    const sessionsPayload = await sessionsResponse.json() as {
      data: Array<{
        terminalId: string
        subscription?: {
          mode: string
          hash?: string
          subscribedTopics: string[]
          acceptedTopics: string[]
          rejectedTopics: string[]
        }
      }>
    }
    expect(sessionsPayload.data.find(item => item.terminalId === terminalId)?.subscription).toMatchObject({
      mode: 'explicit',
      hash: orgStoreProfileSubscriptionHash,
      subscribedTopics: ['org.store.profile', 'catering.product', 'invalid*topic'],
      acceptedTopics: ['org.store.profile'],
      rejectedTopics: ['catering.product', 'invalid*topic'],
    })
  })

  it('rejects HTTP TDP fallback when subscription hash does not match server accepted topics', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const profileResponse = await postJsonWithHeaders<{data: {profileId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/profiles`,
      {
        sandboxId,
        profileCode: 'HTTP_TOPIC_LIMITED_PROFILE',
        name: 'HTTP Topic Limited Profile',
        capabilities: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const templateResponse = await postJsonWithHeaders<{data: {templateId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/templates`,
      {
        sandboxId,
        templateCode: 'HTTP_TOPIC_LIMITED_TEMPLATE',
        name: 'HTTP Topic Limited Template',
        profileId: profileResponse.payload.data.profileId,
        presetConfig: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId, {
      profileId: profileResponse.payload.data.profileId,
      templateId: templateResponse.payload.data.templateId,
    })
    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'http-topic-limited-assembly',
        supportedProfileCodes: ['HTTP_TOPIC_LIMITED_PROFILE'],
        supportedTemplateCodes: ['HTTP_TOPIC_LIMITED_TEMPLATE'],
      },
    })
    expect(activation.status).toBe(201)
    const terminalId = activation.payload.data?.terminalId
    if (!terminalId) {
      throw new Error('expected terminal id')
    }

    const response = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&subscribedTopics=org.store.profile,catering.product&subscriptionHash=${computeSubscriptionHash(['org.store.profile', 'catering.product'])}`,
    )
    expect(response.status).toBe(400)
    const payload = await response.json() as {error?: {message?: string}}
    expect(payload.error?.message).toContain('subscriptionHash')
  })

  it('forces full sync when current accepted subscription hash differs from client previous accepted hash', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const profileResponse = await postJsonWithHeaders<{data: {profileId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/profiles`,
      {
        sandboxId,
        profileCode: 'TOPIC_REBASE_PROFILE',
        name: 'Topic Rebase Profile',
        capabilities: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const templateResponse = await postJsonWithHeaders<{data: {templateId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/templates`,
      {
        sandboxId,
        templateCode: 'TOPIC_REBASE_TEMPLATE',
        name: 'Topic Rebase Template',
        profileId: profileResponse.payload.data.profileId,
        presetConfig: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId, {
      profileId: profileResponse.payload.data.profileId,
      templateId: templateResponse.payload.data.templateId,
    })
    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'topic-rebase-assembly',
        supportedProfileCodes: ['TOPIC_REBASE_PROFILE'],
        supportedTemplateCodes: ['TOPIC_REBASE_TEMPLATE'],
      },
    })
    expect(activation.status).toBe(201)
    const terminalId = activation.payload.data?.terminalId
    const token = activation.payload.data?.token
    if (!terminalId || !token) {
      throw new Error('expected terminal credentials')
    }

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const sessionReady = await new Promise<{type: string; data?: Record<string, unknown>}>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for policy rebase session ready'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            capabilities: ['tdp.topic-subscription.v1', 'tdp.snapshot-chunk.v1'],
            subscribedTopics: ['org.store.profile', 'catering.product'],
            previousAcceptedSubscriptionHash: 'fnv1a64:client-old-accepted',
            previousAcceptedTopics: ['org.store.profile', 'catering.product'],
            lastCursor: 10,
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>}
        if (message.type === 'SESSION_READY') {
          clearTimeout(timeout)
          socket.close()
          resolve(message)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(sessionReady.data).toMatchObject({
      syncMode: 'full',
      subscription: {
        acceptedTopics: ['org.store.profile'],
      },
    })
  })

  it('rejects strict handshakes when required topics are not allowed by terminal policy', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const profileResponse = await postJsonWithHeaders<{data: {profileId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/profiles`,
      {
        sandboxId,
        profileCode: 'STRICT_TOPIC_PROFILE',
        name: 'Strict Topic Profile',
        capabilities: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const templateResponse = await postJsonWithHeaders<{data: {templateId: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/master-data/templates`,
      {
        sandboxId,
        templateCode: 'STRICT_TOPIC_TEMPLATE',
        name: 'Strict Topic Template',
        profileId: profileResponse.payload.data.profileId,
        presetConfig: {
          allowedTopics: ['org.store.profile'],
        },
      },
      publishHeaders(server),
    )
    const activationCode = await createActivationCode(server.getHttpBaseUrl(), sandboxId, {
      profileId: profileResponse.payload.data.profileId,
      templateId: templateResponse.payload.data.templateId,
    })
    const activation = await activateTerminalWithRuntime(server.getHttpBaseUrl(), {
      sandboxId,
      activationCode,
      clientRuntime: {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: 'strict-topic-assembly',
        supportedProfileCodes: ['STRICT_TOPIC_PROFILE'],
        supportedTemplateCodes: ['STRICT_TOPIC_TEMPLATE'],
      },
    })
    expect(activation.status).toBe(201)
    const terminalId = activation.payload.data?.terminalId
    const token = activation.payload.data?.token
    if (!terminalId || !token) {
      throw new Error('expected terminal credentials')
    }

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const messages = await new Promise<Array<{type: string; data?: Record<string, unknown>; error?: Record<string, unknown>}>>((resolve, reject) => {
      const collected: Array<{type: string; data?: Record<string, unknown>; error?: Record<string, unknown>}> = []
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for strict required topic rejection'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            capabilities: ['tdp.topic-subscription.v1'],
            subscribedTopics: ['org.store.profile', 'catering.product'],
            requiredTopics: ['catering.product'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>; error?: Record<string, unknown>}
        collected.push(message)
        if (message.type === 'ERROR') {
          clearTimeout(timeout)
          socket.close()
          resolve(collected)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(messages[0]).toMatchObject({
      type: 'SESSION_READY',
      data: {
        subscription: {
          acceptedTopics: ['org.store.profile'],
          rejectedTopics: ['catering.product'],
          requiredMissingTopics: ['catering.product'],
        },
      },
    })
    expect(messages[1]).toMatchObject({
      type: 'ERROR',
      error: {
        code: 'TDP_REQUIRED_TOPICS_REJECTED',
      },
    })
  })

  it('keeps legacy full snapshot behavior for clients without snapshot chunk capability', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(server.getHttpBaseUrl(), sandboxId)

    const response = await postJsonWithHeaders<{
      data: {
        total: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.store.profile',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'store-legacy-full',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            data: {store_name: 'Legacy Full Store'},
          },
          targetTerminalIds: [terminalId],
        },
      ],
    }, publishHeaders(server))

    expect(response.status).toBe(200)
    expect(response.payload.data.total).toBe(1)

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const messages = await new Promise<Array<{type: string; data?: Record<string, unknown>}>>((resolve, reject) => {
      const collected: Array<{type: string; data?: Record<string, unknown>}> = []
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for legacy full snapshot'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            capabilities: [
              'tdp.topic-subscription.v1',
            ],
            subscribedTopics: ['org.store.profile'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>}
        collected.push(message)
        if (message.type === 'FULL_SNAPSHOT') {
          clearTimeout(timeout)
          socket.close()
          resolve(collected)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(messages.map(message => message.type)).toEqual([
      'SESSION_READY',
      'FULL_SNAPSHOT',
    ])
    expect(messages[1].data).toMatchObject({
      terminalId,
      highWatermark: 1,
    })
    expect((messages[1].data?.snapshot as Array<{itemKey: string}>)).toEqual([
      expect.objectContaining({itemKey: 'store-legacy-full'}),
    ])
  })

  it('pauses realtime projection batches per session until BATCH_ACK releases backpressure', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(server.getHttpBaseUrl(), sandboxId)
    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const messages: Array<{type: string; data?: Record<string, unknown>}> = []
    const waitForMessageCount = (count: number) => new Promise<void>((resolve, reject) => {
      const startedAt = Date.now()
      const timer = setInterval(() => {
        if (messages.length >= count) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() - startedAt > 3_000) {
          clearInterval(timer)
          reject(new Error(`timed out waiting for ${count} messages; received ${messages.length}`))
        }
      }, 10)
    })
    socket.on('message', raw => {
      messages.push(JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>})
    })

    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            lastCursor: 999_999,
            capabilities: [
              'tdp.topic-subscription.v1',
            ],
            subscribedTopics: ['org.store.profile'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.once('error', reject)
      const timer = setTimeout(() => reject(new Error('timed out waiting for SESSION_READY')), 3_000)
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string}
        if (message.type === 'SESSION_READY') {
          clearTimeout(timer)
          resolve()
        }
      })
    })

    const publish = async (index: number) => {
      const response = await postJsonWithHeaders<{
        data: {
          total: number
        }
      }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
        sandboxId,
        projections: [
          {
            topicKey: 'org.store.profile',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: `store-backpressure-${index}`,
            payload: {
              schema_version: 1,
              projection_kind: 'organization',
              data: {store_name: `Backpressure Store ${index}`},
            },
            targetTerminalIds: [terminalId],
          },
          {
            topicKey: 'org.store.profile',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: `store-backpressure-extra-${index}`,
            payload: {
              schema_version: 1,
              projection_kind: 'organization',
              data: {store_name: `Backpressure Store Extra ${index}`},
            },
            targetTerminalIds: [terminalId],
          },
        ],
      }, publishHeaders(server))
      expect(response.status).toBe(200)
    }

    await publish(1)
    await publish(2)
    await publish(3)
    await waitForMessageCount(4)
    await publish(4)
    await new Promise(resolve => setTimeout(resolve, 150))

    const projectionBatchesBeforeAck = messages.filter(message => message.type === 'PROJECTION_BATCH')
    expect(projectionBatchesBeforeAck).toHaveLength(3)

    const firstBatch = projectionBatchesBeforeAck[0]
    socket.send(JSON.stringify({
      type: 'BATCH_ACK',
      data: {
        nextCursor: Number(firstBatch.data?.nextCursor ?? 0),
        batchId: firstBatch.data?.batchId,
      },
    }))
    await waitForMessageCount(5)

    const projectionBatchesAfterAck = messages.filter(message => message.type === 'PROJECTION_BATCH')
    expect(projectionBatchesAfterAck).toHaveLength(4)
    expect(projectionBatchesAfterAck[3].data?.changes).toEqual([
      expect.objectContaining({itemKey: 'store-backpressure-4'}),
      expect.objectContaining({itemKey: 'store-backpressure-extra-4'}),
    ])

    socket.close()
  })

  it('keeps snapshots available after change log pruning and forces full sync for stale cursors', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(server.getHttpBaseUrl(), sandboxId)

    const projections = Array.from({length: 3}, (_, index) => ({
      topicKey: 'org.store.profile',
      scopeType: 'TERMINAL',
      scopeKey: terminalId,
      itemKey: `store-prune-${index + 1}`,
      payload: {
        schema_version: 1,
        projection_kind: 'organization',
        data: {store_name: `Prune Store ${index + 1}`},
      },
      targetTerminalIds: [terminalId],
    }))

    const publishResponse = await postJsonWithHeaders<{
      data: {
        total: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections,
    }, publishHeaders(server))

    expect(publishResponse.status).toBe(200)
    expect(publishResponse.payload.data.total).toBe(3)

    const pruneResponse = await postJsonWithHeaders<{
      data: {
        deleted: number
        retainRecentCursors: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/change-logs/prune`, {
      sandboxId,
      retainRecentCursors: 1,
    }, publishHeaders(server))

    expect(pruneResponse.status).toBe(200)
    expect(pruneResponse.payload.data).toMatchObject({
      deleted: expect.any(Number),
      retainRecentCursors: 1,
    })

    const snapshotResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const snapshotPayload = await snapshotResponse.json() as {
      data: Array<{topic: string; itemKey: string}>
    }
    expect(snapshotPayload.data.map(item => item.itemKey).sort()).toEqual([
      'store-prune-1',
      'store-prune-2',
      'store-prune-3',
    ])

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const messages = await new Promise<Array<{type: string; data?: Record<string, unknown>}>>((resolve, reject) => {
      const collected: Array<{type: string; data?: Record<string, unknown>}> = []
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('timed out waiting for stale-cursor full snapshot'))
      }, 3_000)

      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'HANDSHAKE',
          data: {
            sandboxId,
            terminalId,
            appVersion: 'test-app',
            protocolVersion: '1.0',
            lastCursor: 1,
            capabilities: [
              'tdp.topic-subscription.v1',
            ],
            subscribedTopics: ['org.store.profile'],
            subscriptionMode: 'explicit',
            subscriptionVersion: 1,
          },
        }))
      })
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as {type: string; data?: Record<string, unknown>}
        collected.push(message)
        if (message.type === 'FULL_SNAPSHOT') {
          clearTimeout(timeout)
          socket.close()
          resolve(collected)
        }
      })
      socket.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    expect(messages[0]).toMatchObject({
      type: 'SESSION_READY',
      data: {
        syncMode: 'full',
        highWatermark: 3,
      },
    })
    expect(messages[1]).toMatchObject({
      type: 'FULL_SNAPSHOT',
      data: {
        highWatermark: 3,
      },
    })
    expect((messages[1].data?.snapshot as Array<{itemKey: string}>).map(item => item.itemKey).sort()).toEqual([
      'store-prune-1',
      'store-prune-2',
      'store-prune-3',
    ])
  })

  it('retains recent change logs per terminal instead of using a sandbox-wide cursor window', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const terminalA = await createTerminal(server.getHttpBaseUrl(), sandboxId)
    const terminalB = await createTerminal(server.getHttpBaseUrl(), sandboxId)

    const publish = async (
      terminalId: string,
      itemKey: string,
      storeName: string,
    ) => {
      const response = await postJsonWithHeaders<{
        data: {
          total: number
        }
      }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
        sandboxId,
        projections: [
          {
            topicKey: 'org.store.profile',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey,
            payload: {
              schema_version: 1,
              projection_kind: 'organization',
              data: {store_name: storeName},
            },
            targetTerminalIds: [terminalId],
          },
        ],
      }, publishHeaders(server))
      expect(response.status).toBe(200)
    }

    await publish(terminalA.terminalId, 'terminal-a-old', 'Terminal A Old')
    await publish(terminalB.terminalId, 'terminal-b-old', 'Terminal B Old')
    await publish(terminalA.terminalId, 'terminal-a-new', 'Terminal A New')
    await publish(terminalB.terminalId, 'terminal-b-new', 'Terminal B New')

    const pruneResponse = await postJsonWithHeaders<{
      data: {
        deleted: number
        retainRecentCursors: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/change-logs/prune`, {
      sandboxId,
      retainRecentCursors: 1,
    }, publishHeaders(server))

    expect(pruneResponse.status).toBe(200)
    expect(pruneResponse.payload.data).toMatchObject({
      deleted: 2,
      retainRecentCursors: 1,
    })

    const fetchChanges = async (
      terminalId: string,
      cursor: number,
    ) => {
      const response = await fetch(
        `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=${cursor}&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
      )
      expect(response.status).toBe(200)
      return await response.json() as {
        data: {
          changes: Array<{itemKey: string}>
        }
      }
    }

    await expect(fetchChanges(terminalA.terminalId, 0)).resolves.toMatchObject({
      data: {
        changes: [
          expect.objectContaining({itemKey: 'terminal-a-new'}),
        ],
      },
    })
    await expect(fetchChanges(terminalB.terminalId, 0)).resolves.toMatchObject({
      data: {
        changes: [
          expect.objectContaining({itemKey: 'terminal-b-new'}),
        ],
      },
    })
  })

  it('keeps 100 terminal topic fanout and retention within smoke performance budgets', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const sandboxId = 'sandbox-default'
    const createResponse = await postJson<{
      data: {
        terminalIds: string[]
      }
    }>(`${server.getHttpBaseUrl()}/mock-admin/terminals/batch-create`, {
      sandboxId,
      count: 100,
    })
    expect(createResponse.status).toBe(200)
    expect(createResponse.payload.data.terminalIds).toHaveLength(100)

    const fanoutStartedAt = performance.now()
    const publishResponse = await postJsonWithHeaders<{
      data: {
        items: Array<{
          targetTerminalIds: string[]
        }>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.store.profile',
          scopeType: 'PLATFORM',
          scopeKey: 'platform-default',
          itemKey: 'store-performance-fanout',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            data: {store_name: 'Fanout Performance Store'},
          },
        },
        {
          topicKey: 'catering.product',
          scopeType: 'PLATFORM',
          scopeKey: 'platform-default',
          itemKey: 'sku-performance-fanout',
          payload: {
            schema_version: 1,
            projection_kind: 'catering_product',
            data: {product_name: 'Fanout Performance SKU'},
          },
        },
      ],
    }, publishHeaders(server))
    const fanoutElapsedMs = performance.now() - fanoutStartedAt

    expect(publishResponse.status).toBe(200)
    const fanoutTargetCount = publishResponse.payload.data.items[0]?.targetTerminalIds.length ?? 0
    expect(fanoutTargetCount).toBeGreaterThanOrEqual(100)
    expect(publishResponse.payload.data.items[1]?.targetTerminalIds).toHaveLength(fanoutTargetCount)

    const sampleTerminalId = createResponse.payload.data.terminalIds[0]
    const filterStartedAt = performance.now()
    const changesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${sampleTerminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=20&subscribedTopics=org.store.profile&subscriptionHash=${orgStoreProfileSubscriptionHash}`,
    )
    const changesPayload = await changesResponse.json() as {
      data: {
        changes: Array<{topic: string; itemKey: string}>
      }
    }
    const filterElapsedMs = performance.now() - filterStartedAt

    expect(changesResponse.status).toBe(200)
    expect(changesPayload.data.changes).toEqual([
      expect.objectContaining({
        topic: 'org.store.profile',
        itemKey: 'store-performance-fanout',
      }),
    ])

    const pruneStartedAt = performance.now()
    const pruneResponse = await postJsonWithHeaders<{
      data: {
        deleted: number
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/change-logs/prune`, {
      sandboxId,
      retainRecentCursors: 1,
    }, publishHeaders(server))
    const pruneElapsedMs = performance.now() - pruneStartedAt

    expect(pruneResponse.status).toBe(200)
    expect(pruneResponse.payload.data.deleted).toBeGreaterThanOrEqual(fanoutTargetCount)
    expect(fanoutElapsedMs).toBeLessThan(1500)
    expect(filterElapsedMs).toBeLessThan(100)
    expect(pruneElapsedMs).toBeLessThan(500)
  })

  it('requires publisher authorization for batch-upsert', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const response = await postJson<{
      success: false
      error: {message: string}
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId: prepare.payload.data.sandboxId,
      projections: [],
    })

    expect(response.status).toBe(401)
    expect(response.payload.error.message).toBe('TDP_ADMIN_TOKEN_REQUIRED')
  })

  it('preserves source occurrence and scope metadata in changes and snapshots', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId
    const occurredAt = '2026-04-23T08:30:00.000Z'
    const scopeMetadata = {
      platform_id: 'platform-publisher',
      project_id: 'project-publisher',
      store_id: 'store-publisher',
      reason: 'menu-publication',
    }

    const publishResponse = await postJsonWithHeaders<{
      data: {
        items: Array<{
          status: string
          occurredAt?: string
          scopeMetadata?: Record<string, unknown> | null
        }>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'menu.catalog',
          scopeType: 'STORE',
          scopeKey: 'store-publisher',
          itemKey: 'menu-evening',
          sourceEventId: 'evt-menu-evening-001',
          sourceRevision: 1,
          sourceReleaseId: 'release-menu-evening-001',
          occurredAt,
          scopeMetadata,
          payload: {
            schema_version: 1,
            projection_kind: 'catering_product',
            source_event_id: 'evt-menu-evening-001',
            source_revision: 1,
            data: {menu_id: 'menu-evening', name: 'Evening Menu'},
          },
          targetTerminalIds: ['terminal-publisher-metadata'],
        },
      ],
    }, publishHeaders(server))

    expect(publishResponse.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      occurredAt,
      scopeMetadata,
    })

    const changesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/terminal-publisher-metadata/changes?sandboxId=${sandboxId}&cursor=0&limit=20`,
    )
    const changesPayload = await changesResponse.json() as {
      data: {
        changes: Array<{
          topic: string
          scopeType: string
          scopeId: string
          occurredAt: string
          sourceReleaseId?: string | null
          scopeMetadata?: Record<string, unknown>
        }>
      }
    }
    expect(changesPayload.data.changes[0]).toMatchObject({
      topic: 'menu.catalog',
      scopeType: 'STORE',
      scopeId: 'store-publisher',
      occurredAt,
      sourceReleaseId: 'release-menu-evening-001',
      scopeMetadata,
    })

    const snapshotResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/terminal-publisher-metadata/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotPayload = await snapshotResponse.json() as {
      data: Array<{
        topic: string
        scopeType: string
        scopeId: string
        occurredAt: string
        sourceReleaseId?: string | null
        scopeMetadata?: Record<string, unknown>
      }>
    }
    expect(snapshotPayload.data[0]).toMatchObject({
      topic: 'menu.catalog',
      scopeType: 'STORE',
      scopeId: 'store-publisher',
      occurredAt,
      sourceReleaseId: 'release-menu-evening-001',
      scopeMetadata,
    })
  })

  it('treats the same source_event_id as idempotent per projection identity, not globally', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId

    const publish = () => postJsonWithHeaders<{
      data: {
        items: Array<{status: string; itemKey: string; revision: number}>
      }
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.brand.profile',
          scopeType: 'BRAND',
          scopeKey: 'brand-publisher',
          itemKey: 'brand-publisher',
          sourceEventId: 'evt-contract-activation-001',
          sourceRevision: 1,
          sourceReleaseId: 'evt-contract-activation-001',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            source_event_id: 'evt-contract-activation-001',
            source_revision: 1,
            data: {brand_id: 'brand-publisher', brand_name: 'Publisher Brand'},
          },
          targetTerminalIds: ['terminal-publisher-multi'],
        },
        {
          topicKey: 'org.store.profile',
          scopeType: 'STORE',
          scopeKey: 'store-publisher',
          itemKey: 'store-publisher',
          sourceEventId: 'evt-contract-activation-001',
          sourceRevision: 1,
          sourceReleaseId: 'evt-contract-activation-001',
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            source_event_id: 'evt-contract-activation-001',
            source_revision: 1,
            data: {store_id: 'store-publisher', store_name: 'Publisher Store'},
          },
          targetTerminalIds: ['terminal-publisher-multi'],
        },
      ],
    }, publishHeaders(server))

    const first = await publish()
    const replay = await publish()

    expect(first.payload.data.items).toEqual([
      expect.objectContaining({status: 'ACCEPTED', itemKey: 'brand-publisher', revision: 1}),
      expect.objectContaining({status: 'ACCEPTED', itemKey: 'store-publisher', revision: 1}),
    ])
    expect(replay.payload.data.items).toEqual([
      expect.objectContaining({status: 'IDEMPOTENT_REPLAY', itemKey: 'brand-publisher', revision: 1}),
      expect.objectContaining({status: 'IDEMPOTENT_REPLAY', itemKey: 'store-publisher', revision: 1}),
    ])
  })

  it('rejects payloads that expose projection classification or secret sensitivity markers', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId

    const response = await postJsonWithHeaders<{
      success: false
      error: {message: string}
    }>(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`, {
      sandboxId,
      projections: [
        {
          topicKey: 'org.platform.profile',
          scopeType: 'PLATFORM',
          scopeKey: 'platform-secret',
          itemKey: 'platform-secret',
          sourceEventId: 'evt-platform-secret-001',
          sourceRevision: 1,
          payload: {
            schema_version: 1,
            projection_kind: 'organization',
            projection_policy: 'NEVER_DISTRIBUTE',
            sensitivity_level: 'SECRET',
            source_event_id: 'evt-platform-secret-001',
            source_revision: 1,
            data: {platform_id: 'platform-secret', isv_token: 'must-not-leak'},
          },
          targetTerminalIds: ['terminal-publisher-secret'],
        },
      ],
    }, publishHeaders(server))

    expect(response.status).toBe(400)
    expect(response.payload.error.message).toContain('TDP_PROJECTION_CLASSIFICATION_KEY_NOT_ALLOWED')
  })
})
