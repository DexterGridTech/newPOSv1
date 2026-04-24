import {afterEach, describe, expect, it} from 'vitest'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

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

describe('mock-terminal-platform TDP projection publisher contract', () => {
  const publishHeaders = (server: ReturnType<typeof createMockTerminalPlatformTestServer>) => ({
    authorization: `Bearer ${server.getAdminToken()}`,
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
