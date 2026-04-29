import WebSocket from 'ws'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'
import {computeSubscriptionHash} from '../modules/tdp/subscriptionPolicy.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(servers.splice(0).map(server => server.close()))
})

const postJson = async <TResponse>(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{
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

describe('mock-terminal-platform TDP projection lifecycle / TTL', () => {
  const publishHeaders = (server: ReturnType<typeof createMockTerminalPlatformTestServer>) => ({
    authorization: `Bearer ${server.getAdminToken()}`,
  })

  const prepareSandbox = async (server: ReturnType<typeof createMockTerminalPlatformTestServer>) => {
    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    return prepare.payload.data.sandboxId
  }

  it('rejects ttl fields for persistent projection topics', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)

    const response = await postJson<{success: boolean; error?: {message: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [
          {
            topicKey: 'menu.delta',
            scopeType: 'TERMINAL',
            scopeKey: 'terminal-ttl-policy-001',
            itemKey: 'menu-notification',
            ttlMs: 60_000,
            payload: {
              schema_version: 1,
              projection_kind: 'menu_delta',
              data: {name: 'Should Not Accept TTL'},
            },
            targetTerminalIds: ['terminal-ttl-policy-001'],
          },
        ],
      },
      publishHeaders(server),
    )

    expect(response.status).toBe(400)
    expect(response.payload.error?.message).toContain('TDP_TOPIC_DOES_NOT_ALLOW_TTL')
  })

  it('rejects projection upsert for command-outbox topics', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)

    const response = await postJson<{success: boolean; error?: {message: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [
          {
            topicKey: 'remote.control',
            scopeType: 'TERMINAL',
            scopeKey: 'terminal-command-topic-001',
            itemKey: 'remote-control-command',
            payload: {
              schema_version: 1,
              projection_kind: 'remote_control',
              commandType: 'PING',
            },
            targetTerminalIds: ['terminal-command-topic-001'],
          },
        ],
      },
      publishHeaders(server),
    )

    expect(response.status).toBe(400)
    expect(response.payload.error?.message).toContain('TDP_TOPIC_REQUIRES_COMMAND_OUTBOX')
  })

  it('filters expired expiring projections from snapshot even before scheduler runs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T08:00:00.000Z'))

    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-snapshot-001'

    const publish = await postJson<{
      data: {
        items: Array<{
          status: string
          topicKey: string
          itemKey: string
          expiresAt?: string | null
        }>
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [
          {
            topicKey: 'order.payment.completed',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'payment-notification-001',
            ttlMs: 2_000,
            payload: {
              schema_version: 1,
              projection_kind: 'order_payment_completed',
              data: {orderId: 'order-001', paid: true},
            },
            targetTerminalIds: [terminalId],
          },
        ],
      },
      publishHeaders(server),
    )

    expect(publish.status).toBe(200)
    expect(publish.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      topicKey: 'order.payment.completed',
      itemKey: 'payment-notification-001',
      expiresAt: '2026-04-29T08:00:02.000Z',
    })

    const snapshotBeforeExpiry = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const beforePayload = await snapshotBeforeExpiry.json() as {
      data: Array<{topic: string; itemKey: string; expiresAt?: string | null}>
    }
    expect(beforePayload.data).toEqual([
      expect.objectContaining({
        topic: 'order.payment.completed',
        itemKey: 'payment-notification-001',
        expiresAt: '2026-04-29T08:00:02.000Z',
      }),
    ])

    vi.setSystemTime(new Date('2026-04-29T08:00:03.000Z'))

    const snapshotAfterExpiry = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const afterPayload = await snapshotAfterExpiry.json() as {
      data: Array<{topic: string; itemKey: string}>
    }
    expect(afterPayload.data).toEqual([])
  })

  it('uses occurredAt as ttl base and rejects unsafe publisher clocks or ttl ranges', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T08:00:00.000Z'))

    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-policy-range-001'

    const accepted = await postJson<{
      data: {items: Array<{status: string; expiresAt?: string | null}>}
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-occurred-at-base',
          occurredAt: '2026-04-29T08:01:00.000Z',
          ttlMs: 60_000,
          payload: {data: {orderId: 'order-occurred-at-base'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )
    expect(accepted.status).toBe(200)
    expect(accepted.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      expiresAt: '2026-04-29T08:02:00.000Z',
    })

    const futureClock = await postJson<{error?: {message: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-future-clock',
          occurredAt: '2026-04-29T08:06:01.000Z',
          ttlMs: 60_000,
          payload: {data: {orderId: 'order-future-clock'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )
    expect(futureClock.status).toBe(400)
    expect(futureClock.payload.error?.message).toContain('TDP_OCCURRED_AT_IN_FUTURE')

    const belowMin = await postJson<{error?: {message: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-below-min',
          ttlMs: 500,
          payload: {data: {orderId: 'order-below-min'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )
    expect(belowMin.status).toBe(400)
    expect(belowMin.payload.error?.message).toContain('TDP_EXPIRES_AT_BELOW_MIN')

    const aboveMax = await postJson<{error?: {message: string}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-above-max',
          ttlMs: 2 * 24 * 60 * 60 * 1000 + 1,
          payload: {data: {orderId: 'order-above-max'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )
    expect(aboveMax.status).toBe(400)
    expect(aboveMax.payload.error?.message).toContain('TDP_EXPIRES_AT_OUT_OF_RANGE')
  })

  it('generates idempotent TTL tombstones with terminal cursors', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-tombstone-001'

    const publish = await postJson<{
      data: {
        items: Array<{
          status: string
          revision: number
          expiresAt?: string | null
        }>
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [
          {
            topicKey: 'order.payment.completed',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'payment-notification-ttl-delete',
            ttlMs: 1_000,
            payload: {
              schema_version: 1,
              projection_kind: 'order_payment_completed',
              data: {orderId: 'order-ttl-delete', paid: true},
            },
            targetTerminalIds: [terminalId],
          },
        ],
      },
      publishHeaders(server),
    )
    expect(publish.status).toBe(200)
    expect(publish.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      revision: 1,
    })
    const expiresAt = publish.payload.data.items[0]?.expiresAt
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    await new Promise(resolve => setTimeout(resolve, 1_100))

    const firstRun = await postJson<{
      data: {
        claimedProjectionCount: number
        expiredProjectionCount: number
        generatedTombstoneCount: number
        duplicateTombstoneCount: number
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId},
      publishHeaders(server),
    )
    expect(firstRun.status).toBe(200)
    expect(firstRun.payload.data).toMatchObject({
      claimedProjectionCount: 1,
      expiredProjectionCount: 1,
      generatedTombstoneCount: 1,
      duplicateTombstoneCount: 0,
    })

    const secondRun = await postJson<{
      data: {
        claimedProjectionCount: number
        expiredProjectionCount: number
        generatedTombstoneCount: number
        duplicateTombstoneCount: number
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId},
      publishHeaders(server),
    )
    expect(secondRun.status).toBe(200)
    expect(secondRun.payload.data).toMatchObject({
      claimedProjectionCount: 0,
      expiredProjectionCount: 0,
      generatedTombstoneCount: 0,
    })

    const changesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=10`,
    )
    const changesPayload = await changesResponse.json() as {
      data: {
        changes: Array<{
          topic: string
          itemKey: string
          operation: 'upsert' | 'delete'
          revision: number
          expiresAt?: string | null
          expiryReason?: string | null
        }>
        nextCursor: number
        highWatermark: number
      }
    }
    expect(changesPayload.data.changes).toEqual([
      expect.objectContaining({
        topic: 'order.payment.completed',
        itemKey: 'payment-notification-ttl-delete',
        operation: 'upsert',
        revision: 1,
        expiresAt,
      }),
      expect.objectContaining({
        topic: 'order.payment.completed',
        itemKey: 'payment-notification-ttl-delete',
        operation: 'delete',
        revision: 1,
        expiresAt,
        expiryReason: 'TTL_EXPIRED',
      }),
    ])
    expect(changesPayload.data.nextCursor).toBe(2)
    expect(changesPayload.data.highWatermark).toBe(2)

    const changeLogsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/change-logs?sandboxId=${sandboxId}`,
    )
    const changeLogsPayload = await changeLogsResponse.json() as {
      data: Array<{
        operation: 'upsert' | 'delete'
        changeReason?: string | null
        tombstoneKey?: string | null
      }>
    }
    const ttlDeletes = changeLogsPayload.data.filter(item => item.changeReason === 'TTL_EXPIRED')
    expect(ttlDeletes).toHaveLength(1)
    expect(ttlDeletes[0]?.tombstoneKey).toMatch(/^ttl-expire:/)
  })

  it('replays source_event_id with the original expiresAt instead of refreshing TTL', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-idempotent-001'

    const publish = (ttlMs: number) => postJson<{
      data: {
        items: Array<{
          status: string
          revision: number
          expiresAt?: string | null
        }>
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [
          {
            topicKey: 'order.payment.completed',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'payment-idempotent',
            sourceEventId: 'evt-payment-idempotent-001',
            ttlMs,
            payload: {
              schema_version: 1,
              projection_kind: 'order_payment_completed',
              data: {orderId: 'order-idempotent', paid: true},
            },
            targetTerminalIds: [terminalId],
          },
        ],
      },
      publishHeaders(server),
    )

    const first = await publish(10_000)
    await new Promise(resolve => setTimeout(resolve, 20))
    const replay = await publish(60_000)

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(first.payload.data.items[0]).toMatchObject({status: 'ACCEPTED', revision: 1})
    expect(replay.payload.data.items[0]).toMatchObject({status: 'IDEMPOTENT_REPLAY', revision: 1})
    expect(replay.payload.data.items[0]?.expiresAt).toBe(first.payload.data.items[0]?.expiresAt)
  })

  it('preserves expiring topic lifecycle policy when importing topic templates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T09:00:00.000Z'))

    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const topicKey = 'order.payment.completed.imported'

    const imported = await postJson<{data: {importedTopics: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/import/templates`,
      {
        sandboxId,
        topics: [{
          key: topicKey,
          name: 'Imported Order Payment Completed',
          scopeType: 'TERMINAL',
          payloadMode: 'FLEXIBLE_JSON',
          schema: {type: 'object', additionalProperties: true},
          retentionHours: 48,
          lifecycle: 'expiring',
          deliveryType: 'projection',
          defaultTtlMs: 5_000,
          minTtlMs: 1_000,
          maxTtlMs: 10_000,
        }],
      },
    )
    expect(imported.status).toBe(201)
    expect(imported.payload.data.importedTopics).toBe(1)

    const terminalId = 'terminal-imported-expiring-policy-001'
    const publish = await postJson<{
      data: {
        items: Array<{status: string; topicKey: string; expiresAt?: string | null}>
      }
    }>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey,
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-imported-policy',
          payload: {data: {orderId: 'order-imported-policy'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )

    expect(publish.status).toBe(200)
    expect(publish.payload.data.items[0]).toMatchObject({
      status: 'ACCEPTED',
      topicKey,
      expiresAt: '2026-04-29T09:00:05.000Z',
    })
  })

  it('processes expired projections with max tombstone backpressure across repeated runs', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-backpressure-001'

    const projections = Array.from({length: 6}, (_item, index) => ({
      topicKey: 'order.payment.completed',
      scopeType: 'TERMINAL',
      scopeKey: terminalId,
      itemKey: `payment-backpressure-${index + 1}`,
      ttlMs: 1_000,
      payload: {
        schema_version: 1,
        projection_kind: 'order_payment_completed',
        data: {orderId: `order-backpressure-${index + 1}`, paid: true},
      },
      targetTerminalIds: [terminalId],
    }))
    const publish = await postJson<{data: {total: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {sandboxId, projections},
      publishHeaders(server),
    )
    expect(publish.status).toBe(200)
    expect(publish.payload.data.total).toBe(6)

    await new Promise(resolve => setTimeout(resolve, 1_100))

    const firstRun = await postJson<{data: {generatedTombstoneCount: number; expiredProjectionCount: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId, batchSize: 10, maxTombstonesPerRun: 3},
      publishHeaders(server),
    )
    expect(firstRun.status).toBe(200)
    expect(firstRun.payload.data.generatedTombstoneCount).toBe(3)

    const secondRun = await postJson<{data: {generatedTombstoneCount: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId, batchSize: 10, maxTombstonesPerRun: 10},
      publishHeaders(server),
    )
    expect(secondRun.status).toBe(200)
    expect(secondRun.payload.data.generatedTombstoneCount).toBe(3)

    const changesResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=20`,
    )
    const changesPayload = await changesResponse.json() as {
      data: {
        changes: Array<{operation: 'upsert' | 'delete'}>
        highWatermark: number
      }
    }
    expect(changesPayload.data.changes.filter(item => item.operation === 'delete')).toHaveLength(6)
    expect(changesPayload.data.highWatermark).toBe(12)
  })

  it('pages changes in cursor order across publisher upserts and TTL deletes', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = await prepareSandbox(server)
    const terminalId = 'terminal-expiring-change-pages-001'

    const publish = await postJson<{data: {total: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [1, 2, 3].map(index => ({
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: `payment-change-page-${index}`,
          ttlMs: 1_000,
          payload: {data: {orderId: `order-change-page-${index}`}},
          targetTerminalIds: [terminalId],
        })),
      },
      publishHeaders(server),
    )
    expect(publish.status).toBe(200)
    expect(publish.payload.data.total).toBe(3)

    await new Promise(resolve => setTimeout(resolve, 1_100))
    const runOnce = await postJson<{data: {generatedTombstoneCount: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId},
      publishHeaders(server),
    )
    expect(runOnce.payload.data.generatedTombstoneCount).toBe(3)

    const firstPageResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=0&limit=2`,
    )
    const firstPage = await firstPageResponse.json() as {
      data: {changes: Array<{operation: 'upsert' | 'delete'}>; hasMore: boolean; nextCursor: number}
    }
    expect(firstPage.data.changes.map(item => item.operation)).toEqual(['upsert', 'upsert'])
    expect(firstPage.data.hasMore).toBe(true)
    expect(firstPage.data.nextCursor).toBe(2)

    const secondPageResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${sandboxId}&cursor=${firstPage.data.nextCursor}&limit=4`,
    )
    const secondPage = await secondPageResponse.json() as {
      data: {changes: Array<{operation: 'upsert' | 'delete'}>; hasMore: boolean; nextCursor: number}
    }
    expect(secondPage.data.changes.map(item => item.operation)).toEqual(['upsert', 'delete', 'delete', 'delete'])
    expect(secondPage.data.hasMore).toBe(false)
    expect(secondPage.data.nextCursor).toBe(6)
  })

  it('pushes TTL delete only to online sessions subscribed to the expired topic', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()
    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await (async () => {
      const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/activation-codes/batch`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({sandboxId, count: 1}),
      })
      const activationPayload = await activationResponse.json() as {data: {codes: string[]}}
      const activationCode = activationPayload.data.codes[0]
      const terminalResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          sandboxId,
          activationCode,
          deviceFingerprint: `device-ttl-ws-${Date.now()}`,
          deviceInfo: {id: `device-ttl-ws-${Date.now()}`, model: 'TTL-WS'},
        }),
      })
      const terminalPayload = await terminalResponse.json() as {data: {terminalId: string; token: string}}
      return terminalPayload.data
    })()

    const wsBaseUrl = server.getHttpBaseUrl().replace('http://', 'ws://')
    const subscribedSocket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const unrelatedSocket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
    const subscribedMessages: Array<{type: string; data?: any}> = []
    const unrelatedMessages: Array<{type: string; data?: any}> = []
    subscribedSocket.on('message', raw => subscribedMessages.push(JSON.parse(raw.toString()) as {type: string; data?: any}))
    unrelatedSocket.on('message', raw => unrelatedMessages.push(JSON.parse(raw.toString()) as {type: string; data?: any}))

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        subscribedSocket.once('open', () => {
          subscribedSocket.send(JSON.stringify({
            type: 'HANDSHAKE',
            data: {
              sandboxId,
              terminalId,
              appVersion: 'ttl-ws-test',
              protocolVersion: '1.0',
              lastCursor: 999_999,
              capabilities: ['tdp.topic-subscription.v1'],
              subscribedTopics: ['order.payment.completed'],
              subscriptionHash: computeSubscriptionHash(['order.payment.completed']),
              subscriptionMode: 'explicit',
              subscriptionVersion: 1,
            },
          }))
        })
        subscribedSocket.once('error', reject)
        subscribedSocket.on('message', raw => {
          const message = JSON.parse(raw.toString()) as {type: string}
          if (message.type === 'SESSION_READY' || message.type === 'CHANGESET') {
            resolve()
          }
        })
      }),
      new Promise<void>((resolve, reject) => {
        unrelatedSocket.once('open', () => {
          unrelatedSocket.send(JSON.stringify({
            type: 'HANDSHAKE',
            data: {
              sandboxId,
              terminalId,
              appVersion: 'ttl-ws-test',
              protocolVersion: '1.0',
              lastCursor: 999_999,
              capabilities: ['tdp.topic-subscription.v1'],
              subscribedTopics: ['org.store.profile'],
              subscriptionHash: computeSubscriptionHash(['org.store.profile']),
              subscriptionMode: 'explicit',
              subscriptionVersion: 1,
            },
          }))
        })
        unrelatedSocket.once('error', reject)
        unrelatedSocket.on('message', raw => {
          const message = JSON.parse(raw.toString()) as {type: string}
          if (message.type === 'SESSION_READY' || message.type === 'CHANGESET') {
            resolve()
          }
        })
      }),
    ])

    const publish = await postJson<{data: {items: Array<{status: string}>}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/batch-upsert`,
      {
        sandboxId,
        projections: [{
          topicKey: 'order.payment.completed',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          itemKey: 'payment-ws-delete',
          ttlMs: 1_000,
          payload: {data: {orderId: 'order-ws-delete'}},
          targetTerminalIds: [terminalId],
        }],
      },
      publishHeaders(server),
    )
    expect(publish.status).toBe(200)
    await new Promise(resolve => setTimeout(resolve, 1_100))
    const runOnce = await postJson<{data: {generatedTombstoneCount: number}}>(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/expire/run-once`,
      {sandboxId},
      publishHeaders(server),
    )
    expect(runOnce.payload.data.generatedTombstoneCount).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 180))

    const subscribedDelete = subscribedMessages.find(message =>
      message.type === 'PROJECTION_CHANGED'
      && message.data?.change?.operation === 'delete'
      && message.data?.change?.topic === 'order.payment.completed')
    const unrelatedDelete = unrelatedMessages.find(message =>
      (message.type === 'PROJECTION_CHANGED' || message.type === 'PROJECTION_BATCH')
      && JSON.stringify(message.data).includes('order.payment.completed'))

    subscribedSocket.close()
    unrelatedSocket.close()

    expect(subscribedDelete).toBeTruthy()
    expect(unrelatedDelete).toBeUndefined()
  })
})
