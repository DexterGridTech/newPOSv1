import {sqlite} from '../../database/index.js'
import {
  DEFAULT_SANDBOX_ID,
  DEFAULT_SOURCE_SERVICE,
  TARGET_TDP_ADMIN_TOKEN,
  TARGET_TDP_BASE_URL,
} from '../../shared/constants.js'
import type {PaginationQuery} from '../../shared/pagination.js'
import {paginateItems} from '../../shared/pagination.js'
import {createId, now, parseJson, serializeJson} from '../../shared/utils.js'

export interface ProjectionOutboxItem {
  outboxId: string
  sandboxId: string
  sourceService: string
  sourceEventId: string
  sourceRevision: number
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown>
  targetTerminalIds: string[]
  status: 'PENDING' | 'PUBLISHED' | 'FAILED'
  attemptCount: number
  lastError?: string | null
  publishedAt?: number | null
  createdAt: number
  updatedAt: number
}

const toOutboxItem = (row: {
  outbox_id: string
  sandbox_id: string
  source_service: string
  source_event_id: string
  source_revision: number
  topic_key: string
  scope_type: string
  scope_key: string
  item_key: string
  operation: 'upsert' | 'delete'
  payload_json: string
  target_terminal_ids_json: string
  status: 'PENDING' | 'PUBLISHED' | 'FAILED'
  attempt_count: number
  last_error: string | null
  published_at: number | null
  created_at: number
  updated_at: number
}): ProjectionOutboxItem => ({
  outboxId: row.outbox_id,
  sandboxId: row.sandbox_id,
  sourceService: row.source_service,
  sourceEventId: row.source_event_id,
  sourceRevision: row.source_revision,
  topicKey: row.topic_key,
  scopeType: row.scope_type,
  scopeKey: row.scope_key,
  itemKey: row.item_key,
  operation: row.operation,
  payload: parseJson(row.payload_json, {}),
  targetTerminalIds: parseJson<string[]>(row.target_terminal_ids_json, []),
  status: row.status,
  attemptCount: row.attempt_count,
  lastError: row.last_error,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const listProjectionOutbox = (input: {status?: string} = {}) => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM projection_outbox
    WHERE (? IS NULL OR status = ?)
    ORDER BY created_at ASC
  `).all(input.status ?? null, input.status ?? null) as Parameters<typeof toOutboxItem>[0][]

  return rows.map(toOutboxItem)
}

export const listProjectionOutboxPage = (input: {status?: string; pagination: PaginationQuery}) =>
  paginateItems(listProjectionOutbox({status: input.status}), input.pagination)

export const listProjectionPublishLog = () => {
  const rows = sqlite.prepare(`
    SELECT publish_id, outbox_id, request_json, response_json, created_at
    FROM projection_publish_log
    ORDER BY created_at DESC
  `).all() as Array<{
    publish_id: string
    outbox_id: string
    request_json: string
    response_json: string
    created_at: number
  }>

  return rows.map(row => ({
    publishId: row.publish_id,
    outboxId: row.outbox_id,
    request: parseJson(row.request_json, {}),
    response: parseJson(row.response_json, {}),
    createdAt: row.created_at,
  }))
}

export const listProjectionPublishLogPage = (input: {pagination: PaginationQuery}) =>
  paginateItems(listProjectionPublishLog(), input.pagination)

const toProjectionPayload = (item: ProjectionOutboxItem) => {
  const projection = {
    operation: item.operation,
    topicKey: item.topicKey,
    scopeType: item.scopeType,
    scopeKey: item.scopeKey,
    itemKey: item.itemKey,
    sourceEventId: item.sourceEventId,
    sourceRevision: item.sourceRevision,
    sourceReleaseId: item.sourceEventId,
    occurredAt: item.payload.generated_at ?? new Date(item.createdAt).toISOString(),
    scopeMetadata: {
      source_service: item.sourceService,
      natural_scope_type: item.scopeType,
      natural_scope_key: item.scopeKey,
    },
    payload: item.payload,
  } as Record<string, unknown>

  if (item.targetTerminalIds.length > 0) {
    projection.targetTerminalIds = item.targetTerminalIds
  }

  return projection
}

const groupBySandbox = (items: ProjectionOutboxItem[]) => {
  const groups = new Map<string, ProjectionOutboxItem[]>()
  items.forEach(item => {
    const sandboxRows = groups.get(item.sandboxId) ?? []
    sandboxRows.push(item)
    groups.set(item.sandboxId, sandboxRows)
  })
  return Array.from(groups.entries()).map(([sandboxId, rows]) => ({sandboxId, rows}))
}

const ensureTargetSandbox = async (sandboxId: string) => {
  const response = await fetch(`${TARGET_TDP_BASE_URL}/api/v1/admin/sandboxes`)
  const payload = await response.json() as {
    success?: boolean
    data?: Array<{sandboxId?: string; name?: string}>
    error?: {message?: string}
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? `TDP sandbox lookup failed: ${response.status}`)
  }
  if (payload.data?.some(item => item.sandboxId === sandboxId)) {
    return
  }

  const createResponse = await fetch(`${TARGET_TDP_BASE_URL}/api/v1/admin/sandboxes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TARGET_TDP_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      sandboxId,
      name: sandboxId,
      description: `Created automatically from ${DEFAULT_SOURCE_SERVICE}`,
      purpose: 'CUSTOMER_MASTER_DATA',
      resourceLimits: {},
      creationMode: 'EMPTY',
    }),
  })
  const createPayload = await createResponse.json() as {
    success?: boolean
    error?: {message?: string}
  }
  if (!createResponse.ok || !createPayload.success) {
    throw new Error(createPayload.error?.message ?? `TDP sandbox create failed: ${createResponse.status}`)
  }
}

export const previewProjectionBatch = (input: {status?: string; outboxIds?: string[]} = {}) => {
  const selected = listProjectionOutbox({status: input.status ?? 'PENDING'})
    .filter(item => !input.outboxIds || input.outboxIds.includes(item.outboxId))
  const batches = groupBySandbox(selected).map(group => ({
    sandboxId: group.sandboxId,
    total: group.rows.length,
    projections: group.rows.map(toProjectionPayload),
  }))

  return {
    sandboxId: batches[0]?.sandboxId ?? DEFAULT_SANDBOX_ID,
    targetPlatformBaseUrl: TARGET_TDP_BASE_URL,
    total: selected.length,
    batches,
    projections: selected.map(toProjectionPayload),
  }
}

export const publishProjectionBatch = async (input: {outboxIds?: string[]} = {}) => {
  const rows = listProjectionOutbox({status: 'PENDING'})
    .filter(item => !input.outboxIds || input.outboxIds.includes(item.outboxId))
  if (rows.length === 0) {
    return {
      total: 0,
      published: 0,
      response: null,
    }
  }

  const endpoint = `${TARGET_TDP_BASE_URL}/api/v1/admin/tdp/projections/batch-upsert`
  const timestamp = now()
  const acceptedStatuses = new Set(['ACCEPTED', 'IDEMPOTENT_REPLAY'])
  const batchResults: unknown[] = []
  const acceptedOutboxIds = new Set<string>()
  const failedItems: Array<{outboxId: string; status: string; sourceEventId: string | null}> = []
  let firstError: string | undefined

  for (const group of groupBySandbox(rows)) {
    const requestBody = {
      sandboxId: group.sandboxId,
      projections: group.rows.map(toProjectionPayload),
    }

    try {
      await ensureTargetSandbox(group.sandboxId)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TARGET_TDP_ADMIN_TOKEN}`,
        },
        body: JSON.stringify(requestBody),
      })
      const payload = await response.json() as unknown
      batchResults.push(payload)
      const responseBody = payload as {
        success?: boolean
        data?: {
          items?: Array<{
            status?: string
            sourceEventId?: string | null
          }>
        }
        error?: {message?: string}
      }
      const responseItems = Array.isArray(responseBody.data?.items) ? responseBody.data.items : []
      sqlite.prepare(`
        INSERT INTO projection_publish_log (publish_id, outbox_id, request_json, response_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        createId('publish'),
        group.rows.map(item => item.outboxId).join(','),
        serializeJson(requestBody),
        serializeJson(payload),
        timestamp,
      )

      if (!response.ok || !responseBody.success) {
        const message = responseBody.error?.message ?? `TDP publish failed: ${response.status}`
        firstError = firstError ?? message
        group.rows.forEach(item => {
          sqlite.prepare(`
            UPDATE projection_outbox
            SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
            WHERE outbox_id = ?
          `).run('FAILED', message, timestamp, item.outboxId)
        })
        continue
      }

      const rowBySourceEventId = new Map(group.rows.map(item => [item.sourceEventId, item]))

      responseItems.forEach(item => {
        const sourceEventId = typeof item?.sourceEventId === 'string' ? item.sourceEventId : null
        const row = sourceEventId ? rowBySourceEventId.get(sourceEventId) : undefined
        if (!row) {
          return
        }
        const status = typeof item?.status === 'string' ? item.status : 'UNKNOWN'
        if (acceptedStatuses.has(status)) {
          acceptedOutboxIds.add(row.outboxId)
          return
        }
        failedItems.push({
          outboxId: row.outboxId,
          status,
          sourceEventId,
        })
      })

      if (responseItems.length === 0) {
        group.rows.forEach(item => {
          acceptedOutboxIds.add(item.outboxId)
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      firstError = firstError ?? message
      group.rows.forEach(item => {
        sqlite.prepare(`
          UPDATE projection_outbox
          SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
          WHERE outbox_id = ?
        `).run('FAILED', message, timestamp, item.outboxId)
      })
    }
  }

  rows.forEach(item => {
    if (!acceptedOutboxIds.has(item.outboxId)) {
      return
    }
    sqlite.prepare(`
      UPDATE projection_outbox
      SET status = ?, attempt_count = attempt_count + 1, last_error = NULL, published_at = ?, updated_at = ?
      WHERE outbox_id = ?
    `).run('PUBLISHED', timestamp, timestamp, item.outboxId)
  })

  failedItems.forEach(item => {
    sqlite.prepare(`
      UPDATE projection_outbox
      SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
      WHERE outbox_id = ?
    `).run(
      'FAILED',
      `TDP batch item rejected: ${item.status}`,
      timestamp,
      item.outboxId,
    )
  })

  const published = acceptedOutboxIds.size
  const failed = failedItems.length

  return {
    total: rows.length,
    published,
    failed,
    response: batchResults.length === 1 ? batchResults[0] : batchResults,
    error: firstError ?? (failed > 0 ? `${failed} projection(s) were rejected by TDP` : undefined),
  }
}

export const retryProjectionOutbox = (input: {outboxIds?: string[]} = {}) => {
  const rows = listProjectionOutbox()
    .filter(item => item.status === 'FAILED')
    .filter(item => !input.outboxIds || input.outboxIds.includes(item.outboxId))
  const timestamp = now()
  rows.forEach(item => {
    sqlite.prepare(`
      UPDATE projection_outbox
      SET status = ?, last_error = NULL, updated_at = ?
      WHERE outbox_id = ?
    `).run('PENDING', timestamp, item.outboxId)
  })
  return {
    total: rows.length,
  }
}

const readAutoPublisherIntervalMs = () => {
  const rawValue = process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_AUTO_PUBLISH_INTERVAL_MS
  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue) || parsedValue < 5000) {
    return 15000
  }
  return parsedValue
}

const isAutoPublisherEnabled = () =>
  process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_AUTO_PUBLISH?.trim().toLowerCase() !== 'false'

let autoPublisherRunning = false
let autoPublisherStarted = false

export const publishProjectionBacklog = async () => {
  const failedCount = listProjectionOutbox({status: 'FAILED'}).length
  if (failedCount > 0) {
    retryProjectionOutbox()
  }
  return publishProjectionBatch()
}

export const startProjectionOutboxAutoPublisher = () => {
  if (!isAutoPublisherEnabled()) {
    return {
      started: false,
      stop: () => {},
    }
  }

  if (autoPublisherStarted) {
    return {
      started: true,
      stop: () => {},
    }
  }

  autoPublisherStarted = true
  const intervalMs = readAutoPublisherIntervalMs()
  const tick = async () => {
    if (autoPublisherRunning) {
      return
    }

    const backlogCount = listProjectionOutbox()
      .filter(item => item.status === 'PENDING' || item.status === 'FAILED')
      .length
    if (backlogCount === 0) {
      return
    }

    autoPublisherRunning = true
    try {
      const result = await publishProjectionBacklog()
      if (result.total > 0 && result.error) {
        console.warn(`[projection-auto-publish] ${result.error}`)
      }
    } catch (error) {
      console.warn('[projection-auto-publish] unexpected failure', error)
    } finally {
      autoPublisherRunning = false
    }
  }

  const timer = setInterval(() => {
    void tick()
  }, intervalMs)
  void tick()

  return {
    started: true,
    stop: () => {
      clearInterval(timer)
      autoPublisherStarted = false
    },
  }
}
