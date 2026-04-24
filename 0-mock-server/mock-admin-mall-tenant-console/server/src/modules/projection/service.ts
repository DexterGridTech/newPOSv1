import {sqlite} from '../../database/index.js'
import {
  DEFAULT_SANDBOX_ID,
  TARGET_TDP_ADMIN_TOKEN,
  TARGET_TDP_BASE_URL,
} from '../../shared/constants.js'
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

export const previewProjectionBatch = (input: {status?: string; outboxIds?: string[]} = {}) => {
  const selected = listProjectionOutbox({status: input.status ?? 'PENDING'})
    .filter(item => !input.outboxIds || input.outboxIds.includes(item.outboxId))

  return {
    sandboxId: DEFAULT_SANDBOX_ID,
    targetPlatformBaseUrl: TARGET_TDP_BASE_URL,
    total: selected.length,
    projections: selected.map(item => {
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
    }),
  }
}

export const publishProjectionBatch = async (input: {outboxIds?: string[]} = {}) => {
  const preview = previewProjectionBatch({outboxIds: input.outboxIds})
  if (preview.projections.length === 0) {
    return {
      total: 0,
      published: 0,
      response: null,
    }
  }

  const requestBody = {
    sandboxId: DEFAULT_SANDBOX_ID,
    projections: preview.projections,
  }
  const endpoint = `${TARGET_TDP_BASE_URL}/api/v1/admin/tdp/projections/batch-upsert`
  const timestamp = now()
  const rows = listProjectionOutbox({status: 'PENDING'})
    .filter(item => !input.outboxIds || input.outboxIds.includes(item.outboxId))

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TARGET_TDP_ADMIN_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    })
    const payload = await response.json() as unknown
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
      rows.map(item => item.outboxId).join(','),
      serializeJson(requestBody),
      serializeJson(payload),
      timestamp,
    )

    if (!response.ok || !responseBody.success) {
      const message = responseBody.error?.message ?? `TDP publish failed: ${response.status}`
      rows.forEach(item => {
        sqlite.prepare(`
          UPDATE projection_outbox
          SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
          WHERE outbox_id = ?
        `).run('FAILED', message, timestamp, item.outboxId)
      })
      return {
        total: rows.length,
        published: 0,
        response: payload,
        error: message,
      }
    }

    const acceptedStatuses = new Set(['ACCEPTED', 'IDEMPOTENT_REPLAY'])
    const rowBySourceEventId = new Map(rows.map(item => [item.sourceEventId, item]))
    const acceptedOutboxIds = new Set<string>()
    const failedItems: Array<{outboxId: string; status: string; sourceEventId: string | null}> = []

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
      rows.forEach(item => {
        acceptedOutboxIds.add(item.outboxId)
      })
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
      response: payload,
      error: failed > 0 ? `${failed} projection(s) were rejected by TDP` : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    rows.forEach(item => {
      sqlite.prepare(`
        UPDATE projection_outbox
        SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
        WHERE outbox_id = ?
      `).run('FAILED', message, timestamp, item.outboxId)
    })
    return {
      total: rows.length,
      published: 0,
      response: null,
      error: message,
    }
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
