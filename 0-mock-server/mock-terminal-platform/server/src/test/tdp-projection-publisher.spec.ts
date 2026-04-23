import {afterEach, describe, expect, it} from 'vitest'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

const postJson = async <TResponse>(url: string, body: Record<string, unknown>): Promise<{
  status: number
  payload: TResponse
}> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    payload: await response.json() as TResponse,
  }
}

describe('mock-terminal-platform TDP projection publisher contract', () => {
  it('treats repeated source_event_id publishes as idempotent and does not duplicate terminal changes', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{data: {sandboxId: string}}>(
      `${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`,
      {},
    )
    const sandboxId = prepare.payload.data.sandboxId

    const createProjection = () => postJson<{
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
    })

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
      postJson<{
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
      })

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
})
