import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  changeLogsTable,
  commandOutboxTable,
  projectionSourceEventsTable,
  projectionsTable,
  sessionsTable,
  taskInstancesTable,
  terminalCursorsTable,
  terminalProjectionAccessTable,
  terminalsTable,
  topicsTable,
} from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import { forceCloseOnlineSession, getOnlineSessionById, listOnlineMasterSessionsByTerminalId, listOnlineSessionsByTerminalId } from './wsSessionRegistry.js'
import type { TdpProjectionEnvelope, TdpServerMessage } from './wsProtocol.js'
import {
  readTdpTopicLifecyclePolicy,
  validateAndComputeTdpProjectionLifecycle,
  type TdpProjectionLifecycle,
} from './lifecyclePolicy.js'

export interface TdpServerSubscriptionFilter {
  mode: 'explicit' | 'legacy-all'
  acceptedTopics?: readonly string[]
}

export interface TdpTerminalChangesPage {
  changes: Array<{
    cursor: number
    change: TdpProjectionEnvelope
  }>
  hasMore: boolean
}

const toIsoTime = (timestamp: number) => new Date(timestamp).toISOString()

const toTimestampMs = (value: string | number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ALLOWLIST_CLASSIFICATION_KEYS = [
  'projection_policy',
  'projectionPolicy',
  'sensitivity_level',
  'sensitivityLevel',
  '__projection_policy',
  '__projectionPolicy',
  '__sensitivity_level',
  '__sensitivityLevel',
] as const

const TERMINAL_ALLOWED_POLICIES = new Set(['TERMINAL_DIRECT', 'TERMINAL_DERIVED'])

const shouldFilterBySubscriptionTopics = (subscription?: TdpServerSubscriptionFilter) =>
  subscription?.mode === 'explicit'

const normalizeSubscriptionTopics = (subscription?: TdpServerSubscriptionFilter) =>
  Array.from(new Set(subscription?.acceptedTopics ?? [])).filter(topic => topic.trim().length > 0).sort()

const buildTopicFilterSql = (
  subscription?: TdpServerSubscriptionFilter,
  columnName = 'topic_key',
) => {
  if (!shouldFilterBySubscriptionTopics(subscription)) {
    return {
      clause: '',
      params: [] as string[],
      empty: false,
    }
  }
  const topics = normalizeSubscriptionTopics(subscription)
  if (topics.length === 0) {
    return {
      clause: '',
      params: [] as string[],
      empty: true,
    }
  }
  return {
    clause: ` AND ${columnName} IN (${topics.map(() => '?').join(', ')})`,
    params: topics,
    empty: false,
  }
}

const acceptsTopicForSubscription = (
  subscription: TdpServerSubscriptionFilter | undefined,
  topic: string,
) => {
  if (!shouldFilterBySubscriptionTopics(subscription)) {
    return true
  }
  return normalizeSubscriptionTopics(subscription).includes(topic)
}

const CHANGE_LOG_RETAIN_RECENT_CURSORS = 10_000

const getCurrentCursorForTerminal = (sandboxId: string, terminalId: string) => {
  const row = sqlite.prepare(`
    SELECT high_watermark
    FROM tdp_terminal_cursors
    WHERE sandbox_id = ? AND target_terminal_id = ?
    LIMIT 1
  `).get(sandboxId, terminalId) as { high_watermark: number } | undefined
  if (row) {
    return row.high_watermark
  }
  const legacyRow = sqlite.prepare(`
    SELECT COALESCE(MAX(cursor), 0) as high_watermark
    FROM tdp_change_logs
    WHERE sandbox_id = ? AND target_terminal_id = ?
  `).get(sandboxId, terminalId) as { high_watermark: number } | undefined
  return legacyRow?.high_watermark ?? 0
}

const preallocateCursorsByTerminal = (
  sandboxId: string,
  terminalCounts: Map<string, number>,
  timestamp: number,
) => {
  const allocated = new Map<string, number[]>()
  if (terminalCounts.size === 0) {
    return allocated
  }
  const upsertCursor = sqlite.prepare(`
    INSERT INTO tdp_terminal_cursors (
      cursor_id,
      sandbox_id,
      target_terminal_id,
      high_watermark,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(sandbox_id, target_terminal_id)
    DO UPDATE SET
      high_watermark = excluded.high_watermark,
      updated_at = excluded.updated_at
  `)

  terminalCounts.forEach((count, terminalId) => {
    if (count <= 0) {
      return
    }
    const start = getCurrentCursorForTerminal(sandboxId, terminalId) + 1
    const cursors = Array.from({ length: count }, (_item, index) => start + index)
    allocated.set(terminalId, cursors)
    upsertCursor.run(
      createId('cursor'),
      sandboxId,
      terminalId,
      start + count - 1,
      timestamp,
    )
  })

  return allocated
}

const takePreallocatedCursor = (
  allocated: Map<string, number[]>,
  terminalId: string,
) => {
  const cursors = allocated.get(terminalId)
  const cursor = cursors?.shift()
  if (cursor == null) {
    throw new Error(`TDP_CURSOR_PREALLOCATION_EXHAUSTED:${terminalId}`)
  }
  return cursor
}

const upsertTerminalProjectionAccess = (input: {
  sandboxId: string
  targetTerminalId: string
  topicKey: string
  operation: 'upsert' | 'delete'
  scopeType: string
  scopeKey: string
  itemKey: string
  revision: number
  payloadJson: string
  sourceReleaseId?: string | null
  occurredAt?: number | null
  scopeMetadataJson?: string | null
  lifecycle?: TdpProjectionLifecycle
  expiresAt?: number | null
  expiredAt?: number | null
  expiryReason?: string | null
  cursor: number
  timestamp: number
}) => {
  sqlite.prepare(`
    INSERT INTO tdp_terminal_projection_access (
      access_id,
      sandbox_id,
      target_terminal_id,
      topic_key,
      operation,
      scope_type,
      scope_key,
      item_key,
      revision,
      payload_json,
      source_release_id,
      occurred_at,
      scope_metadata_json,
      lifecycle,
      expires_at,
      expired_at,
      expiry_reason,
      last_cursor,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sandbox_id, target_terminal_id, topic_key, scope_type, scope_key, item_key)
    DO UPDATE SET
      operation = excluded.operation,
      revision = excluded.revision,
      payload_json = excluded.payload_json,
      source_release_id = excluded.source_release_id,
      occurred_at = excluded.occurred_at,
      scope_metadata_json = excluded.scope_metadata_json,
      lifecycle = excluded.lifecycle,
      expires_at = excluded.expires_at,
      expired_at = excluded.expired_at,
      expiry_reason = excluded.expiry_reason,
      last_cursor = excluded.last_cursor,
      updated_at = excluded.updated_at
  `).run(
    createId('access'),
    input.sandboxId,
    input.targetTerminalId,
    input.topicKey,
    input.operation,
    input.scopeType,
    input.scopeKey,
    input.itemKey,
    input.revision,
    input.payloadJson,
    input.sourceReleaseId ?? null,
    input.occurredAt ?? null,
    input.scopeMetadataJson ?? null,
    input.lifecycle ?? 'persistent',
    input.expiresAt ?? null,
    input.expiredAt ?? null,
    input.expiryReason ?? null,
    input.cursor,
    input.timestamp,
  )
}

export const pruneTdpChangeLogs = (
  sandboxId: string,
  retainRecentCursors = CHANGE_LOG_RETAIN_RECENT_CURSORS,
) => {
  assertSandboxUsable(sandboxId)
  const retain = Math.max(1, Math.trunc(retainRecentCursors))
  const result = sqlite.prepare(`
    DELETE FROM tdp_change_logs
    WHERE sandbox_id = ?
      AND change_id IN (
        SELECT change_id
        FROM (
          SELECT
            change_id,
            ROW_NUMBER() OVER (
              PARTITION BY sandbox_id, target_terminal_id
              ORDER BY cursor DESC, created_at DESC, change_id DESC
            ) AS retained_rank
          FROM tdp_change_logs
          WHERE sandbox_id = ?
        )
        WHERE retained_rank > ?
      )
  `).run(sandboxId, sandboxId, retain)
  return {
    sandboxId,
    retainRecentCursors: retain,
    deleted: result.changes,
  }
}

export const getOldestRetainedCursorForTerminal = (
  sandboxId: string,
  terminalId: string,
  subscription?: TdpServerSubscriptionFilter,
) => {
  assertSandboxUsable(sandboxId)
  const topicFilter = buildTopicFilterSql(subscription)
  if (topicFilter.empty) {
    return undefined
  }
  const row = sqlite.prepare(
    `SELECT MIN(cursor) as oldest_cursor FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ?${topicFilter.clause}`
  ).get(sandboxId, terminalId, ...topicFilter.params) as { oldest_cursor: number | null } | undefined
  return row?.oldest_cursor ?? undefined
}

export const isTerminalCursorStale = (
  sandboxId: string,
  terminalId: string,
  cursor: number,
  subscription?: TdpServerSubscriptionFilter,
) => {
  if (cursor <= 0) {
    return true
  }
  const highWatermark = getHighWatermarkForTerminal(sandboxId, terminalId, subscription)
  if (cursor >= highWatermark) {
    return false
  }
  const oldestCursor = getOldestRetainedCursorForTerminal(sandboxId, terminalId, subscription)
  if (oldestCursor == null) {
    return highWatermark > cursor
  }
  return cursor < oldestCursor
}

const assertProjectionPayloadAllowedForTdp = (payload: Record<string, unknown>) => {
  for (const key of ALLOWLIST_CLASSIFICATION_KEYS) {
    if (key in payload) {
      throw new Error(`TDP_PROJECTION_CLASSIFICATION_KEY_NOT_ALLOWED:${key}`)
    }
  }
  const projectionPolicy = typeof payload.projection_policy === 'string'
    ? payload.projection_policy
    : typeof payload.projectionPolicy === 'string'
      ? payload.projectionPolicy
      : undefined
  const sensitivityLevel = typeof payload.sensitivity_level === 'string'
    ? payload.sensitivity_level
    : typeof payload.sensitivityLevel === 'string'
      ? payload.sensitivityLevel
      : undefined

  if (projectionPolicy && !TERMINAL_ALLOWED_POLICIES.has(projectionPolicy)) {
    throw new Error(`TDP_PROJECTION_POLICY_NOT_ALLOWED:${projectionPolicy}`)
  }
  if (sensitivityLevel === 'SECRET') {
    throw new Error('TDP_SENSITIVITY_LEVEL_NOT_ALLOWED:SECRET')
  }
}

const getNextCursorForTerminal = (sandboxId: string, terminalId: string) => {
  const timestamp = now()
  return takePreallocatedCursor(
    preallocateCursorsByTerminal(sandboxId, new Map([[terminalId, 1]]), timestamp),
    terminalId,
  )
}

const recordTerminalChange = (input: {
  sandboxId: string
  terminalId: string
  cursor: number
  topicKey: string
  operation: 'upsert' | 'delete'
  scopeType: string
  scopeKey: string
  itemKey: string
  revision: number
  payloadJson: string
  sourceReleaseId?: string | null
  occurredAt?: number | null
  scopeMetadataJson?: string | null
  lifecycle?: TdpProjectionLifecycle
  expiresAt?: number | null
  changeReason?: string | null
  sourceProjectionId?: string | null
  tombstoneKey?: string | null
  expiredAt?: number | null
  expiryReason?: string | null
  timestamp: number
}) => {
  db.insert(changeLogsTable).values({
    changeId: createId('change'),
    sandboxId: input.sandboxId,
    cursor: input.cursor,
    topicKey: input.topicKey,
    operation: input.operation,
    scopeType: input.scopeType,
    scopeKey: input.scopeKey,
    itemKey: input.itemKey,
    targetTerminalId: input.terminalId,
    revision: input.revision,
    payloadJson: input.payloadJson,
    sourceReleaseId: input.sourceReleaseId ?? null,
    occurredAt: input.occurredAt ?? null,
    scopeMetadataJson: input.scopeMetadataJson ?? null,
    expiresAt: input.expiresAt ?? null,
    changeReason: input.changeReason ?? (input.operation === 'delete' ? 'PUBLISHER_DELETE' : 'PUBLISHER_UPSERT'),
    sourceProjectionId: input.sourceProjectionId ?? null,
    tombstoneKey: input.tombstoneKey ?? null,
    createdAt: input.timestamp,
  }).run()
  upsertTerminalProjectionAccess({
    sandboxId: input.sandboxId,
    targetTerminalId: input.terminalId,
    topicKey: input.topicKey,
    operation: input.operation,
    scopeType: input.scopeType,
    scopeKey: input.scopeKey,
    itemKey: input.itemKey,
    revision: input.revision,
    payloadJson: input.payloadJson,
    sourceReleaseId: input.sourceReleaseId ?? null,
    occurredAt: input.occurredAt ?? null,
    scopeMetadataJson: input.scopeMetadataJson ?? null,
    lifecycle: input.lifecycle,
    expiresAt: input.expiresAt ?? null,
    expiredAt: input.expiredAt ?? null,
    expiryReason: input.expiryReason ?? (input.operation === 'delete' ? input.changeReason ?? 'PUBLISHER_DELETE' : null),
    cursor: input.cursor,
    timestamp: input.timestamp,
  })
}

const buildItemKey = (input: {
  topicKey: string
  scopeKey: string
  payloadJson: string
  sourceReleaseId?: string | null
  itemKey?: string | null
}) => {
  if (input.itemKey?.trim()) {
    return input.itemKey.trim()
  }
  const payload = parseJson<Record<string, unknown>>(input.payloadJson, {})
  if (input.topicKey === 'tcp.task.release' && typeof payload.instanceId === 'string' && payload.instanceId.trim()) {
    return payload.instanceId
  }
  if (typeof payload.itemKey === 'string' && payload.itemKey.trim()) {
    return payload.itemKey.trim()
  }
  return input.sourceReleaseId ?? `${input.topicKey}:${input.scopeKey}`
}

const findAcceptedProjectionSourceEvent = (input: {
  sourceEventId: string
  sandboxId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
}) => sqlite.prepare(`
  SELECT operation, source_revision, tdp_revision, payload_json, source_release_id, occurred_at, scope_metadata_json, lifecycle, expires_at, accepted_at
  FROM tdp_projection_source_events
  WHERE source_event_id = ?
    AND sandbox_id = ?
    AND topic_key = ?
    AND scope_type = ?
    AND scope_key = ?
    AND item_key = ?
  LIMIT 1
`).get(
  input.sourceEventId,
  input.sandboxId,
  input.topicKey,
  input.scopeType,
  input.scopeKey,
  input.itemKey,
) as {
  operation: 'upsert' | 'delete'
  source_revision: number | null
  tdp_revision: number
  payload_json: string
  source_release_id: string | null
  occurred_at: number | null
  scope_metadata_json: string | null
  lifecycle: TdpProjectionLifecycle
  expires_at: number | null
  accepted_at: number
} | undefined

const findAcceptedSourceRevision = (input: {
  sandboxId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
}) => sqlite.prepare(`
  SELECT MAX(source_revision) as source_revision
  FROM tdp_projection_source_events
  WHERE sandbox_id = ?
    AND topic_key = ?
    AND scope_type = ?
    AND scope_key = ?
    AND item_key = ?
    AND source_revision IS NOT NULL
`).get(
  input.sandboxId,
  input.topicKey,
  input.scopeType,
  input.scopeKey,
  input.itemKey,
) as { source_revision: number | null } | undefined

const toProjectionEnvelope = (input: {
  topicKey: string
  operation?: 'upsert' | 'delete'
  scopeKey: string
  itemKey?: string | null
  scopeType: string
  revision: number
  payloadJson: string
  updatedAt?: number
  createdAt?: number
  sourceReleaseId?: string | null
  occurredAt?: number
  scopeMetadata?: Record<string, unknown> | null
  expiresAt?: number | null
  lifecycle?: TdpProjectionLifecycle
  expiryReason?: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null
}): TdpProjectionEnvelope => ({
  topic: input.topicKey,
  itemKey: buildItemKey(input),
  operation: input.operation ?? 'upsert',
  scopeType: input.scopeType,
  scopeId: input.scopeKey,
  revision: input.revision,
  payload: parseJson(input.payloadJson, {}),
  occurredAt: toIsoTime(input.occurredAt ?? input.createdAt ?? input.updatedAt ?? now()),
  sourceReleaseId: input.sourceReleaseId ?? null,
  scopeMetadata: input.scopeMetadata ?? undefined,
  expiresAt: input.expiresAt == null ? null : toIsoTime(input.expiresAt),
  lifecycle: input.lifecycle ?? 'persistent',
  expiryReason: input.expiryReason ?? null,
})

const pushToOnlineTerminal = (sandboxId: string, terminalId: string, message: TdpServerMessage) => {
  const sessions = listOnlineSessionsByTerminalId(sandboxId, terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    session.socket.send(JSON.stringify(message))
  }
}

const BATCH_WINDOW_MS = 120
const MAX_INFLIGHT_BATCHES_PER_SESSION = 3

const queueProjectionChangeToOnlineTerminal = (terminalId: string, input: {
  sandboxId: string
  change: TdpProjectionEnvelope
  cursor: number
}) => {
  const sessions = listOnlineSessionsByTerminalId(input.sandboxId, terminalId)
  const acceptingSessions = sessions.filter(session => acceptsTopicForSubscription({
    mode: session.subscriptionMode,
    acceptedTopics: session.acceptedTopics,
  }, input.change.topic))
  for (const session of acceptingSessions) {
    session.lastDeliveredRevision = input.cursor
    db.update(sessionsTable)
      .set({ lastDeliveredRevision: input.cursor })
      .where(eq(sessionsTable.sessionId, session.sessionId))
      .run()
  }
  for (const session of acceptingSessions) {
    if (session.socket.readyState !== 1) continue
    const queue = session.batchQueue ?? []
    queue.push(input.change)
    session.batchQueue = queue
  }
}

const flushProjectionQueueToOnlineTerminal = (sandboxId: string, terminalId: string) => {
  const sessions = listOnlineSessionsByTerminalId(sandboxId, terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    const batch = session.batchQueue ?? []
    if (batch.length === 0) continue
    if ((session.inflightBatchCount ?? 0) >= MAX_INFLIGHT_BATCHES_PER_SESSION) {
      session.deferredBatchFlush = true
      continue
    }
    session.batchQueue = []
    session.deferredBatchFlush = false
    if (session.batchTimer) {
      clearTimeout(session.batchTimer)
      session.batchTimer = undefined
    }
    if (batch.length === 1) {
      session.socket.send(JSON.stringify({
        type: 'PROJECTION_CHANGED',
        eventId: createId('evt'),
        timestamp: now(),
        data: {
          cursor: session.lastDeliveredRevision ?? 0,
          change: batch[0],
        },
      } satisfies TdpServerMessage))
      continue
    }
    const batchId = createId('batch')
    session.inflightBatchCount = (session.inflightBatchCount ?? 0) + 1
    session.socket.send(JSON.stringify({
      type: 'PROJECTION_BATCH',
      eventId: batchId,
      timestamp: now(),
      data: {
        batchId,
        changes: batch,
        nextCursor: session.lastDeliveredRevision ?? 0,
      },
    } satisfies TdpServerMessage))
  }
}

export const acknowledgeProjectionBatchForSession = (input: {
  sandboxId: string
  sessionId: string
  nextCursor: number
  batchId?: string
  processingLagMs?: number
  subscriptionHash?: string
}) => {
  assertSandboxUsable(input.sandboxId)
  const session = getOnlineSessionById(input.sessionId)
  if (!session) {
    throw new Error('目标 session 当前不在线')
  }
  session.inflightBatchCount = Math.max(0, (session.inflightBatchCount ?? 0) - 1)
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastAckedRevision: input.nextCursor, lastAppliedRevision: input.nextCursor, lastHeartbeatAt: timestamp })
    .where(and(eq(sessionsTable.sessionId, input.sessionId), eq(sessionsTable.sandboxId, input.sandboxId)))
    .run()
  if (session.deferredBatchFlush) {
    session.deferredBatchFlush = false
    flushProjectionQueueToOnlineTerminal(session.sandboxId, session.terminalId)
  }
  return {
    sessionId: input.sessionId,
    nextCursor: input.nextCursor,
    batchId: input.batchId,
    inflightBatchCount: session.inflightBatchCount,
  }
}

export const pushProjectionChangeToOnlineTerminal = (terminalId: string, input: {
  sandboxId: string
  change: TdpProjectionEnvelope
  cursor: number
}) => {
  queueProjectionChangeToOnlineTerminal(terminalId, input)
  const sessions = listOnlineSessionsByTerminalId(input.sandboxId, terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    if (session.batchTimer) continue
    session.batchTimer = setTimeout(() => {
      flushProjectionQueueToOnlineTerminal(input.sandboxId, terminalId)
    }, BATCH_WINDOW_MS)
  }
}

export const toTdpProjectionEnvelope = toProjectionEnvelope

export const allocateTdpCursorForTerminal = (sandboxId: string, terminalId: string) =>
  getNextCursorForTerminal(sandboxId, terminalId)

export const upsertTdpTerminalProjectionAccessForScheduler = upsertTerminalProjectionAccess

const resolveTargetTerminalIds = (input: {
  sandboxId: string
  scopeType: string
  scopeKey: string
}) => {
  const { sandboxId } = input
  if (input.scopeType === 'TERMINAL') {
    return [input.scopeKey]
  }

  const allTerminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  switch (input.scopeType) {
    case 'STORE':
      return allTerminals.filter(item => item.storeId === input.scopeKey).map(item => item.terminalId)
    case 'TENANT':
      return allTerminals.filter(item => item.tenantId === input.scopeKey).map(item => item.terminalId)
    case 'BRAND':
      return allTerminals.filter(item => item.brandId === input.scopeKey).map(item => item.terminalId)
    case 'PROJECT':
      return allTerminals.filter(item => item.projectId === input.scopeKey).map(item => item.terminalId)
    case 'PLATFORM':
      return allTerminals.filter(item => item.platformId === input.scopeKey).map(item => item.terminalId)
    default:
      return []
  }
}

export const listSessions = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  const rows = db.select().from(sessionsTable).where(eq(sessionsTable.sandboxId, sandboxId)).orderBy(desc(sessionsTable.connectedAt)).all()
  return rows.map((item) => {
    const lastAckedRevision = item.lastAckedRevision ?? 0
    const lastAppliedRevision = item.lastAppliedRevision ?? 0
    const subscriptionMode = item.subscriptionMode ?? undefined
    const acceptedTopics = parseJson<string[]>(item.acceptedTopicsJson, [])
    const highWatermark = getHighWatermarkForTerminal(sandboxId, item.terminalId, subscriptionMode === 'explicit'
      ? {
        mode: 'explicit',
        acceptedTopics,
      }
      : undefined)
    return {
      ...item,
      subscription: subscriptionMode
        ? {
          mode: subscriptionMode,
          hash: item.subscriptionHash ?? undefined,
          subscribedTopics: parseJson<string[]>(item.subscribedTopicsJson, []),
          acceptedTopics,
          rejectedTopics: parseJson<string[]>(item.rejectedTopicsJson, []),
          requiredMissingTopics: parseJson<string[]>(item.requiredMissingTopicsJson, []),
        }
        : undefined,
      highWatermark,
      ackLag: Math.max(0, highWatermark - lastAckedRevision),
      applyLag: Math.max(0, highWatermark - lastAppliedRevision),
    }
  })
}

export const connectSession = (input: {
  sandboxId: string
  terminalId: string
  clientVersion: string
  protocolVersion: string
  localNodeId?: string | null
  displayIndex?: number | null
  displayCount?: number | null
  instanceMode?: 'MASTER' | 'SLAVE' | null
  displayMode?: 'PRIMARY' | 'SECONDARY' | null
  subscriptionMode?: 'explicit' | 'legacy-all'
  subscriptionHash?: string
  subscribedTopics?: readonly string[]
  acceptedTopics?: readonly string[]
  rejectedTopics?: readonly string[]
  requiredMissingTopics?: readonly string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const sessionId = createId('session')
  const timestamp = now()
  db.insert(sessionsTable).values({
    sessionId,
    terminalId: input.terminalId,
    sandboxId,
    clientVersion: input.clientVersion,
    protocolVersion: input.protocolVersion,
    localNodeId: input.localNodeId ?? null,
    displayIndex: input.displayIndex ?? null,
    displayCount: input.displayCount ?? null,
    instanceMode: input.instanceMode ?? null,
    displayMode: input.displayMode ?? null,
    status: 'CONNECTED',
    connectedAt: timestamp,
    disconnectedAt: null,
    lastHeartbeatAt: timestamp,
    lastDeliveredRevision: null,
    lastAckedRevision: null,
    lastAppliedRevision: null,
    subscriptionMode: input.subscriptionMode ?? null,
    subscriptionHash: input.subscriptionHash ?? null,
    subscribedTopicsJson: input.subscribedTopics ? JSON.stringify([...input.subscribedTopics]) : null,
    acceptedTopicsJson: input.acceptedTopics ? JSON.stringify([...input.acceptedTopics]) : null,
    rejectedTopicsJson: input.rejectedTopics ? JSON.stringify([...input.rejectedTopics]) : null,
    requiredMissingTopicsJson: input.requiredMissingTopics ? JSON.stringify([...input.requiredMissingTopics]) : null,
  }).run()
  db.update(terminalsTable)
    .set({ presenceStatus: 'ONLINE', healthStatus: 'HEALTHY', lastSeenAt: timestamp, updatedAt: timestamp })
    .where(and(eq(terminalsTable.terminalId, input.terminalId), eq(terminalsTable.sandboxId, sandboxId)))
    .run()
  return { sessionId }
}

export const heartbeatSession = (input: { sandboxId: string; sessionId: string }) => {
  const { sandboxId, sessionId } = input
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastHeartbeatAt: timestamp })
    .where(and(eq(sessionsTable.sessionId, sessionId), eq(sessionsTable.sandboxId, sandboxId)))
    .run()
  const session = db.select().from(sessionsTable).where(and(eq(sessionsTable.sessionId, sessionId), eq(sessionsTable.sandboxId, sandboxId))).get()
  if (session) {
    db.update(terminalsTable)
      .set({ presenceStatus: 'ONLINE', lastSeenAt: timestamp, updatedAt: timestamp })
      .where(and(eq(terminalsTable.terminalId, session.terminalId), eq(terminalsTable.sandboxId, session.sandboxId)))
      .run()
  }
  return { sessionId, lastHeartbeatAt: timestamp }
}

export const updateSessionAppliedRevision = (input: { sandboxId: string; sessionId: string; revision: number }) => {
  const { sandboxId, sessionId, revision } = input
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastAppliedRevision: revision, lastHeartbeatAt: timestamp })
    .where(and(eq(sessionsTable.sessionId, sessionId), eq(sessionsTable.sandboxId, sandboxId)))
    .run()
  return { sessionId, lastAppliedRevision: revision }
}

export const acknowledgeSessionRevision = (input: { sandboxId: string; sessionId: string; cursor: number; topic?: string; itemKey?: string }) => {
  assertSandboxUsable(input.sandboxId)
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastAckedRevision: input.cursor, lastHeartbeatAt: timestamp })
    .where(and(eq(sessionsTable.sessionId, input.sessionId), eq(sessionsTable.sandboxId, input.sandboxId)))
    .run()

  if (input.topic === 'tcp.task.release' && input.itemKey?.trim()) {
    db.update(taskInstancesTable)
      .set({ deliveryStatus: 'ACKED', deliveredAt: timestamp, updatedAt: timestamp })
      .where(eq(taskInstancesTable.instanceId, input.itemKey.trim()))
      .run()
  }
  if ((input.topic === 'remote.control' || input.topic === 'print.command') && input.itemKey?.trim()) {
    db.update(commandOutboxTable)
      .set({ status: 'ACKED', ackedAt: timestamp, updatedAt: timestamp })
      .where(eq(commandOutboxTable.commandId, input.itemKey.trim()))
      .run()
    const command = db.select().from(commandOutboxTable).where(eq(commandOutboxTable.commandId, input.itemKey.trim())).get()
    if (command?.payloadJson) {
      const payload = parseJson<Record<string, unknown>>(command.payloadJson, {})
      if (typeof payload.instanceId === 'string' && payload.instanceId.trim()) {
        db.update(taskInstancesTable)
          .set({ deliveryStatus: 'ACKED', deliveredAt: timestamp, updatedAt: timestamp })
          .where(eq(taskInstancesTable.instanceId, payload.instanceId.trim()))
          .run()
      }
    }
  }

  return { sessionId: input.sessionId, cursor: input.cursor }
}

export const disconnectSession = (input: { sandboxId: string; sessionId: string }) => {
  const { sandboxId, sessionId } = input
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  db.update(sessionsTable)
    .set({ status: 'DISCONNECTED', disconnectedAt: timestamp, lastHeartbeatAt: timestamp })
    .where(and(eq(sessionsTable.sessionId, sessionId), eq(sessionsTable.sandboxId, sandboxId)))
    .run()
  const session = db.select().from(sessionsTable).where(and(eq(sessionsTable.sessionId, sessionId), eq(sessionsTable.sandboxId, sandboxId))).get()
  if (session) {
    db.update(terminalsTable)
      .set({ presenceStatus: 'OFFLINE', lastSeenAt: timestamp, updatedAt: timestamp })
      .where(and(eq(terminalsTable.terminalId, session.terminalId), eq(terminalsTable.sandboxId, session.sandboxId)))
      .run()
  }
  return { sessionId, disconnectedAt: timestamp }
}

export const validateTerminalAccessToken = (input: { sandboxId: string; terminalId: string; token: string }):
  | { valid: true }
  | { valid: false; code: string; message: string } => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const terminal = db.select().from(terminalsTable).where(and(eq(terminalsTable.terminalId, input.terminalId), eq(terminalsTable.sandboxId, sandboxId))).get()
  if (!terminal) {
    return { valid: false, code: 'TERMINAL_NOT_FOUND', message: '终端不存在或不属于当前沙箱' }
  }
  if (terminal.lifecycleStatus !== 'ACTIVE') {
    return { valid: false, code: 'TERMINAL_INACTIVE', message: '终端未处于 ACTIVE 状态' }
  }

  const credential = sqlite.prepare(`
    SELECT credential_id, expires_at, revoked_at
    FROM terminal_credentials
    WHERE terminal_id = ? AND token = ?
    ORDER BY issued_at DESC
    LIMIT 1
  `).get(input.terminalId, input.token) as { credential_id: string; expires_at: number; revoked_at: number | null } | undefined

  if (!credential || credential.revoked_at !== null) {
    return { valid: false, code: 'INVALID_TOKEN', message: '终端 token 无效' }
  }
  if (credential.expires_at <= timestamp) {
    return { valid: false, code: 'TOKEN_EXPIRED', message: '终端 token 已过期' }
  }
  return { valid: true }
}

export const listTopics = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(topicsTable).where(eq(topicsTable.sandboxId, sandboxId)).orderBy(desc(topicsTable.updatedAt)).all().map((item) => ({
    ...item,
    lifecycle: item.lifecycle ?? 'persistent',
    deliveryType: item.deliveryType ?? (item.payloadMode === 'EPHEMERAL_COMMAND' ? 'command-outbox' : 'projection'),
    schema: parseJson(item.schemaJson, {}),
  }))
}

export const listProjections = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(projectionsTable).where(eq(projectionsTable.sandboxId, sandboxId)).orderBy(desc(projectionsTable.updatedAt)).all().map((item) => ({
    ...item,
    lifecycle: item.lifecycle ?? 'persistent',
    expiresAt: item.expiresAt == null ? null : toIsoTime(item.expiresAt),
    expiredAt: item.expiredAt == null ? null : toIsoTime(item.expiredAt),
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const listChangeLogs = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(changeLogsTable).where(eq(changeLogsTable.sandboxId, sandboxId)).orderBy(desc(changeLogsTable.createdAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const listCommandOutbox = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(commandOutboxTable).where(eq(commandOutboxTable.sandboxId, sandboxId)).orderBy(desc(commandOutboxTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const dispatchTaskReleaseToDataPlane = (input: { sandboxId: string; releaseId: string }) => {
  const { sandboxId, releaseId } = input
  assertSandboxUsable(sandboxId)
  const releaseMeta = sqlite.prepare('SELECT task_type, payload_json FROM task_releases WHERE release_id = ? AND sandbox_id = ? LIMIT 1').get(releaseId, sandboxId) as { task_type: string; payload_json: string } | undefined
  if (!releaseMeta) {
    throw new Error('任务发布单不存在')
  }

  if (releaseMeta.task_type === 'REMOTE_CONTROL') {
    const commandDispatch = dispatchRemoteControlRelease(sandboxId, releaseId)
    return {
      dispatchId: createId('dispatch'),
      releaseId,
      totalInstances: commandDispatch.totalInstances,
      mode: 'COMMAND',
    }
  }

  const instances = sqlite.prepare(`
    SELECT ti.instance_id, ti.terminal_id, ti.payload_json,
           COALESCE((SELECT MAX(revision) FROM tdp_projections WHERE sandbox_id = ? AND topic_key = 'tcp.task.release' AND scope_type = 'TERMINAL' AND scope_key = ti.terminal_id AND item_key = ti.instance_id), 0) as current_revision
    FROM task_instances ti
    JOIN task_releases tr ON tr.release_id = ti.release_id
    WHERE ti.release_id = ? AND tr.sandbox_id = ?
  `).all(sandboxId, releaseId, sandboxId) as Array<{ instance_id: string; terminal_id: string; payload_json: string; current_revision: number }>

  const timestamp = now()

  for (const instance of instances) {
    const revision = instance.current_revision + 1
    const cursor = getNextCursorForTerminal(sandboxId, instance.terminal_id)
    const snapshotPayload = JSON.stringify({
      releaseId,
      instanceId: instance.instance_id,
      payload: parseJson(instance.payload_json, {}),
      dispatchedAt: timestamp,
    })

    const existing = sqlite.prepare('SELECT projection_id FROM tdp_projections WHERE sandbox_id = ? AND topic_key = ? AND scope_type = ? AND scope_key = ? AND item_key = ? LIMIT 1').get(sandboxId, 'tcp.task.release', 'TERMINAL', instance.terminal_id, instance.instance_id) as { projection_id: string } | undefined
    if (existing) {
      sqlite.prepare('UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?').run(revision, snapshotPayload, timestamp, existing.projection_id)
    } else {
      db.insert(projectionsTable).values({
        projectionId: createId('projection'),
        sandboxId,
        topicKey: 'tcp.task.release',
        scopeType: 'TERMINAL',
        scopeKey: instance.terminal_id,
        itemKey: instance.instance_id,
        revision,
        payloadJson: snapshotPayload,
        updatedAt: timestamp,
      }).run()
    }

    recordTerminalChange({
      sandboxId,
      cursor,
      topicKey: 'tcp.task.release',
      operation: 'upsert',
      scopeType: 'TERMINAL',
      scopeKey: instance.terminal_id,
      itemKey: instance.instance_id,
      terminalId: instance.terminal_id,
      revision,
      payloadJson: snapshotPayload,
      sourceReleaseId: releaseId,
      timestamp,
    })
    pushProjectionChangeToOnlineTerminal(instance.terminal_id, {
      sandboxId,
      cursor,
      change: toProjectionEnvelope({
        topicKey: 'tcp.task.release',
        scopeType: 'TERMINAL',
        scopeKey: instance.terminal_id,
        itemKey: instance.instance_id,
        revision,
        payloadJson: snapshotPayload,
        createdAt: timestamp,
        sourceReleaseId: releaseId,
      }),
    })

    db.update(taskInstancesTable)
      .set({ deliveryStatus: 'DELIVERED', deliveredAt: timestamp, updatedAt: timestamp })
      .where(eq(taskInstancesTable.instanceId, instance.instance_id))
      .run()
  }

  return {
    dispatchId: createId('dispatch'),
    releaseId,
    totalInstances: instances.length,
    mode: 'PROJECTION',
  }
}

const dispatchRemoteControlRelease = (sandboxId: string, releaseId: string) => {
  const instances = sqlite.prepare(`
    SELECT ti.instance_id, ti.terminal_id, ti.payload_json
    FROM task_instances ti
    JOIN task_releases tr ON tr.release_id = ti.release_id
    WHERE ti.release_id = ? AND tr.sandbox_id = ?
  `).all(releaseId, sandboxId) as Array<{ instance_id: string; terminal_id: string; payload_json: string }>

  const timestamp = now()
  for (const instance of instances) {
    const commandId = createId('cmd')
    const basePayload = parseJson<Record<string, unknown>>(instance.payload_json, {})
    const topicKey = typeof basePayload.topicKey === 'string' && basePayload.topicKey.trim()
      ? basePayload.topicKey.trim()
      : 'remote.control'
    const payload: Record<string, unknown> = {
      ...basePayload,
      instanceId: instance.instance_id,
    }
    const commandType = typeof payload.commandType === 'string' ? payload.commandType : undefined

    db.insert(commandOutboxTable).values({
      commandId,
      sandboxId,
      terminalId: instance.terminal_id,
      topicKey,
      payloadJson: JSON.stringify(payload),
      status: 'DELIVERED',
      sourceReleaseId: releaseId,
      deliveredAt: timestamp,
      ackedAt: null,
      expiresAt: timestamp + 10 * 60_000,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()

    const sessions = commandType === 'UPLOAD_TERMINAL_LOGS'
      ? listOnlineMasterSessionsByTerminalId(sandboxId, instance.terminal_id)
      : listOnlineSessionsByTerminalId(sandboxId, instance.terminal_id)
    const deliverableSessions = sessions.filter(session => acceptsTopicForSubscription({
      mode: session.subscriptionMode,
      acceptedTopics: session.acceptedTopics,
    }, topicKey))
    const delivered = deliverableSessions.length > 0

    for (const session of deliverableSessions) {
      session.socket.send(JSON.stringify({
        type: 'COMMAND_DELIVERED',
        eventId: createId('evt'),
        timestamp,
        data: {
          commandId,
          topic: topicKey,
          terminalId: instance.terminal_id,
          payload,
          sourceReleaseId: releaseId,
          expiresAt: toIsoTime(timestamp + 10 * 60_000),
        },
      } satisfies TdpServerMessage))
      session.lastDeliveredRevision = session.lastDeliveredRevision ?? 0
    }

    db.update(commandOutboxTable)
      .set({
        status: delivered ? 'DELIVERED' : 'PENDING',
        deliveredAt: delivered ? timestamp : null,
        updatedAt: timestamp,
      })
      .where(eq(commandOutboxTable.commandId, commandId))
      .run()

    db.update(taskInstancesTable)
      .set({
        deliveryStatus: delivered ? 'DELIVERED' : 'PENDING',
        deliveredAt: delivered ? timestamp : null,
        updatedAt: timestamp,
      })
      .where(eq(taskInstancesTable.instanceId, instance.instance_id))
      .run()
  }

  return { totalInstances: instances.length }
}

export const getTerminalSnapshot = (
  sandboxId: string,
  terminalId: string,
  subscription?: TdpServerSubscriptionFilter,
) => {
  return getTerminalSnapshotEnvelope(sandboxId, terminalId, subscription)
}

export const getTerminalSnapshotEnvelope = (
  sandboxId: string,
  terminalId: string,
  subscription?: TdpServerSubscriptionFilter,
) => {
  assertSandboxUsable(sandboxId)
  const topicFilter = buildTopicFilterSql(subscription)
  if (topicFilter.empty) {
    return []
  }
  const timestamp = now()
  const rows = sqlite.prepare(
    `SELECT topic_key, scope_key, scope_type, item_key, operation, revision, payload_json, lifecycle, expires_at, expiry_reason, updated_at, source_release_id, occurred_at, scope_metadata_json
     FROM tdp_terminal_projection_access
     WHERE sandbox_id = ?
       AND target_terminal_id = ?
       AND operation != 'delete'
       AND (expires_at IS NULL OR expires_at > ?)
       ${topicFilter.clause}
     ORDER BY updated_at DESC`
  ).all(sandboxId, terminalId, timestamp, ...topicFilter.params) as Array<{ topic_key: string; scope_key: string; scope_type: string; item_key: string; operation: 'upsert' | 'delete'; revision: number; payload_json: string; lifecycle: TdpProjectionLifecycle | null; expires_at: number | null; expiry_reason: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null; updated_at: number; source_release_id: string | null; occurred_at: number | null; scope_metadata_json: string | null }>

  return rows.map((item) => toProjectionEnvelope({
    topicKey: item.topic_key,
    operation: item.operation,
    scopeKey: item.scope_key,
    itemKey: item.item_key,
    scopeType: item.scope_type,
    revision: item.revision,
    payloadJson: item.payload_json,
    updatedAt: item.updated_at,
    sourceReleaseId: item.source_release_id,
    occurredAt: item.occurred_at ?? undefined,
    scopeMetadata: parseJson(item.scope_metadata_json, null),
    lifecycle: item.lifecycle ?? 'persistent',
    expiresAt: item.expires_at,
    expiryReason: item.expiry_reason,
  }))
}

export const getTerminalChanges = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  const rows = sqlite.prepare(
    'SELECT change_id, cursor, topic_key, operation, item_key, revision, payload_json, source_release_id, occurred_at, scope_metadata_json, expires_at, change_reason, source_projection_id, tombstone_key, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(sandboxId, terminalId) as Array<{ change_id: string; cursor: number; topic_key: string; operation: "upsert" | "delete"; item_key: string; revision: number; payload_json: string; source_release_id: string | null; occurred_at: number | null; scope_metadata_json: string | null; expires_at: number | null; change_reason: string | null; source_projection_id: string | null; tombstone_key: string | null; created_at: number }>

  return rows.map((item) => ({
    changeId: item.change_id,
    cursor: item.cursor,
    topicKey: item.topic_key,
    operation: item.operation,
    itemKey: item.item_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    sourceReleaseId: item.source_release_id,
    expiresAt: item.expires_at == null ? null : toIsoTime(item.expires_at),
    changeReason: item.change_reason,
    sourceProjectionId: item.source_projection_id,
    tombstoneKey: item.tombstone_key,
    occurredAt: item.occurred_at ? toIsoTime(item.occurred_at) : undefined,
    scopeMetadata: parseJson(item.scope_metadata_json, null),
    createdAt: item.created_at,
  }))
}

export const getTerminalChangesSince = (
  sandboxId: string,
  terminalId: string,
  cursor: number,
  limit = 100,
  subscription?: TdpServerSubscriptionFilter,
): TdpTerminalChangesPage => {
  assertSandboxUsable(sandboxId)
  const topicFilter = buildTopicFilterSql(subscription)
  if (topicFilter.empty) {
    return {
      changes: [],
      hasMore: false,
    }
  }
  const rows = sqlite.prepare(
    `SELECT change_id, cursor, topic_key, operation, scope_type, scope_key, item_key, revision, payload_json, source_release_id, occurred_at, scope_metadata_json, expires_at, change_reason, created_at
     FROM tdp_change_logs
     WHERE sandbox_id = ? AND target_terminal_id = ? AND cursor > ?${topicFilter.clause}
     ORDER BY cursor ASC LIMIT ?`
  ).all(sandboxId, terminalId, cursor, ...topicFilter.params, limit + 1) as Array<{ change_id: string; cursor: number; topic_key: string; operation: "upsert" | "delete"; scope_type: string; scope_key: string; item_key: string; revision: number; payload_json: string; source_release_id: string | null; occurred_at: number | null; scope_metadata_json: string | null; expires_at: number | null; change_reason: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null; created_at: number }>

  return {
    changes: rows.slice(0, limit).map((item) => ({
      cursor: item.cursor,
      change: toProjectionEnvelope({
        topicKey: item.topic_key,
        operation: item.operation,
        scopeType: item.scope_type,
        scopeKey: item.scope_key,
        itemKey: item.item_key,
        revision: item.revision,
        payloadJson: item.payload_json,
        createdAt: item.created_at,
        occurredAt: item.occurred_at ?? undefined,
        sourceReleaseId: item.source_release_id,
        scopeMetadata: parseJson(item.scope_metadata_json, null),
        lifecycle: item.expires_at == null ? 'persistent' : 'expiring',
        expiresAt: item.expires_at,
        expiryReason: item.operation === 'delete' ? item.change_reason ?? 'PUBLISHER_DELETE' : null,
      }),
    })),
    hasMore: rows.length > limit,
  }
}

export const getHighWatermarkForTerminal = (
  sandboxId: string,
  terminalId: string,
  subscription?: TdpServerSubscriptionFilter,
) => {
  assertSandboxUsable(sandboxId)
  const topicFilter = buildTopicFilterSql(subscription)
  if (topicFilter.empty) {
    return 0
  }
  const row = sqlite.prepare(
    `SELECT COALESCE(MAX(last_cursor), 0) as high_watermark FROM tdp_terminal_projection_access WHERE sandbox_id = ? AND target_terminal_id = ?${topicFilter.clause}`
  ).get(sandboxId, terminalId, ...topicFilter.params) as { high_watermark: number } | undefined
  return row?.high_watermark ?? 0
}

export const createTopic = (input: {
  sandboxId: string
  key: string
  name: string
  payloadMode?: string
  schema?: Record<string, unknown>
  scopeType?: string
  retentionHours?: number
  lifecycle?: TdpProjectionLifecycle
  deliveryType?: 'projection' | 'command-outbox'
  defaultTtlMs?: number
  minTtlMs?: number
  maxTtlMs?: number
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const topicId = createId('topic')
  db.insert(topicsTable).values({
    topicId,
    sandboxId,
    key: input.key,
    name: input.name,
    payloadMode: input.payloadMode ?? 'FLEXIBLE_JSON',
    schemaJson: JSON.stringify(input.schema ?? { type: 'object', additionalProperties: true }),
    scopeType: input.scopeType ?? 'TERMINAL',
    retentionHours: input.retentionHours ?? 72,
    lifecycle: input.lifecycle ?? 'persistent',
    deliveryType: input.deliveryType ?? (input.payloadMode === 'EPHEMERAL_COMMAND' ? 'command-outbox' : 'projection'),
    defaultTtlMs: input.defaultTtlMs ?? null,
    minTtlMs: input.minTtlMs ?? null,
    maxTtlMs: input.maxTtlMs ?? null,
    expiryAction: 'tombstone',
    deliveryGuarantee: input.lifecycle === 'expiring' ? 'retained-until-expired' : 'retained-until-deleted',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { topicId }
}

export const listScopes = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  const topicScopes = sqlite.prepare(
    'SELECT key as topic_key, scope_type, COUNT(*) as topic_count FROM tdp_topics WHERE sandbox_id = ? GROUP BY key, scope_type ORDER BY key ASC'
  ).all(sandboxId) as Array<{ topic_key: string; scope_type: string; topic_count: number }>
  const projectionScopes = sqlite.prepare(
    'SELECT topic_key, scope_type, scope_key, item_key, MAX(revision) as revision, MAX(updated_at) as updated_at FROM tdp_projections WHERE sandbox_id = ? GROUP BY topic_key, scope_type, scope_key, item_key ORDER BY updated_at DESC'
  ).all(sandboxId) as Array<{ topic_key: string; scope_type: string; scope_key: string; item_key: string; revision: number; updated_at: number }>

  return { topicScopes, projectionScopes }
}

export const upsertProjection = (input: {
  sandboxId: string
  topicKey: string
  scopeType?: string
  scopeKey: string
  itemKey?: string
  payload: Record<string, unknown>
  sourceReleaseId?: string
  sourceEventId?: string
  source_event_id?: string
  sourceRevision?: number
  source_revision?: number
  occurredAt?: string | number
  occurred_at?: string | number
  scopeMetadata?: Record<string, unknown>
  scope_metadata?: Record<string, unknown>
}) => {
  const scopeType = input.scopeType ?? 'TERMINAL'
  return upsertProjectionBatch({
    sandboxId: input.sandboxId,
    projections: [
      {
        ...input,
        scopeType,
      },
    ],
  }).items[0]
}

export const upsertProjectionBatch = (input: {
  sandboxId: string
  projections: Array<{
    operation?: 'upsert' | 'delete'
    topicKey: string
    scopeType?: string
    scopeKey: string
    itemKey?: string
    payload: Record<string, unknown>
    sourceReleaseId?: string
    sourceEventId?: string
    source_event_id?: string
    sourceRevision?: number
    source_revision?: number
    occurredAt?: string | number
    occurred_at?: string | number
    ttlMs?: number
    ttl_ms?: number
    expiresAt?: string | number
    expires_at?: string | number
    scopeMetadata?: Record<string, unknown>
    scope_metadata?: Record<string, unknown>
    targetTerminalIds?: string[]
  }>
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const queuedByTerminal = new Map<string, Array<{cursor: number; change: TdpProjectionEnvelope}>>()
  const acceptedItems: Array<{
    item: typeof input.projections[number]
    operation: 'upsert' | 'delete'
    scopeType: string
    scopeKey: string
    itemKey: string
    payloadJson: string
    revision: number
    sourceEventId?: string
    sourceRevision?: number
    occurredAt: number
    scopeMetadata?: Record<string, unknown>
    lifecycle: TdpProjectionLifecycle
    expiresAt: number | null
    expiryStatus: 'pending' | null
    targetTerminalIds: string[]
  }> = []

  const items = input.projections.map(item => {
    const scopeType = item.scopeType ?? 'TERMINAL'
    const payloadJson = JSON.stringify(item.payload)
    const operation = item.operation ?? 'upsert'
    const sourceEventId = item.sourceEventId ?? item.source_event_id
    const sourceRevision = item.sourceRevision ?? item.source_revision
    const occurredAt = toTimestampMs(item.occurredAt ?? item.occurred_at) ?? timestamp
    const scopeMetadata = isRecord(item.scopeMetadata)
      ? item.scopeMetadata
      : isRecord(item.scope_metadata)
        ? item.scope_metadata
        : undefined
    assertProjectionPayloadAllowedForTdp(item.payload)
    const itemKey = buildItemKey({
      topicKey: item.topicKey,
      scopeKey: item.scopeKey,
      payloadJson,
      sourceReleaseId: item.sourceReleaseId ?? null,
      itemKey: item.itemKey ?? null,
    })
    if (sourceEventId?.trim()) {
      const acceptedEvent = findAcceptedProjectionSourceEvent({
        sourceEventId: sourceEventId.trim(),
        sandboxId,
        topicKey: item.topicKey,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
      })
      if (acceptedEvent) {
        return {
          topicKey: item.topicKey,
          operation: acceptedEvent.operation,
          scopeType,
          scopeKey: item.scopeKey,
          itemKey,
          revision: acceptedEvent.tdp_revision,
          sourceRevision: acceptedEvent.source_revision,
          sourceEventId: sourceEventId.trim(),
          sourceReleaseId: acceptedEvent.source_release_id,
          occurredAt: acceptedEvent.occurred_at ? toIsoTime(acceptedEvent.occurred_at) : undefined,
          scopeMetadata: parseJson(acceptedEvent.scope_metadata_json, null),
          lifecycle: acceptedEvent.lifecycle ?? 'persistent',
          expiresAt: acceptedEvent.expires_at == null ? null : toIsoTime(acceptedEvent.expires_at),
          status: 'IDEMPOTENT_REPLAY' as const,
          acceptedAt: acceptedEvent.accepted_at,
          targetTerminalIds: [] as string[],
        }
      }
    }
    const lifecycle = validateAndComputeTdpProjectionLifecycle({
      sandboxId,
      topicKey: item.topicKey,
      operation,
      occurredAt,
      ttlMs: item.ttlMs,
      ttl_ms: item.ttl_ms,
      expiresAt: item.expiresAt,
      expires_at: item.expires_at,
      serverNow: timestamp,
    })
    const existingProjection = sqlite.prepare(
      'SELECT projection_id, revision FROM tdp_projections WHERE sandbox_id = ? AND topic_key = ? AND scope_type = ? AND scope_key = ? AND item_key = ? LIMIT 1'
    ).get(sandboxId, item.topicKey, scopeType, item.scopeKey, itemKey) as { projection_id: string; revision: number } | undefined
    const acceptedRevision = findAcceptedSourceRevision({
      sandboxId,
      topicKey: item.topicKey,
      scopeType,
      scopeKey: item.scopeKey,
      itemKey,
    })?.source_revision
    if (
      sourceRevision !== undefined
      && acceptedRevision !== null
      && acceptedRevision !== undefined
      && sourceRevision < acceptedRevision
    ) {
      return {
        topicKey: item.topicKey,
        operation,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
        revision: existingProjection?.revision ?? 0,
        sourceRevision,
        acceptedSourceRevision: acceptedRevision,
        sourceEventId: sourceEventId?.trim() || null,
        sourceReleaseId: item.sourceReleaseId ?? null,
        status: 'STALE_SOURCE_REVISION' as const,
        targetTerminalIds: [] as string[],
      }
    }
    const revision = (existingProjection?.revision ?? 0) + 1

    if (operation === 'delete') {
      if (existingProjection) {
        sqlite.prepare('DELETE FROM tdp_projections WHERE projection_id = ?')
          .run(existingProjection.projection_id)
      }
    } else if (existingProjection) {
      sqlite.prepare(`
        UPDATE tdp_projections
        SET revision = ?,
            payload_json = ?,
            lifecycle = ?,
            expires_at = ?,
            expired_at = NULL,
            expiry_reason = NULL,
            expiry_status = ?,
            expiry_claimed_by = NULL,
            expiry_claimed_at = NULL,
            updated_at = ?
        WHERE projection_id = ?
      `).run(
        revision,
        payloadJson,
        lifecycle.lifecycle,
        lifecycle.expiresAt,
        lifecycle.expiryStatus,
        timestamp,
        existingProjection.projection_id,
      )
    } else {
      db.insert(projectionsTable).values({
        projectionId: createId('projection'),
        sandboxId,
        topicKey: item.topicKey,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
        revision,
        payloadJson,
        lifecycle: lifecycle.lifecycle,
        expiresAt: lifecycle.expiresAt,
        expiredAt: null,
        expiryReason: null,
        expiryStatus: lifecycle.expiryStatus,
        expiryClaimedBy: null,
        expiryClaimedAt: null,
        updatedAt: timestamp,
      }).run()
    }
    if (sourceEventId?.trim()) {
      db.insert(projectionSourceEventsTable).values({
        acceptanceId: createId('accept'),
        sourceEventId: sourceEventId.trim(),
        sandboxId,
        topicKey: item.topicKey,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
        operation,
        sourceRevision: sourceRevision ?? null,
        tdpRevision: revision,
        payloadJson,
        sourceReleaseId: item.sourceReleaseId ?? null,
        occurredAt,
        scopeMetadataJson: scopeMetadata ? JSON.stringify(scopeMetadata) : null,
        lifecycle: lifecycle.lifecycle,
        expiresAt: lifecycle.expiresAt,
        acceptedAt: timestamp,
      }).run()
    }

    const targetTerminalIds = item.targetTerminalIds ?? resolveTargetTerminalIds({
      sandboxId,
      scopeType,
      scopeKey: item.scopeKey,
    })
    acceptedItems.push({
      item,
      operation,
      scopeType,
      scopeKey: item.scopeKey,
      itemKey,
      payloadJson,
      revision,
      sourceEventId: sourceEventId?.trim() || undefined,
      sourceRevision,
      occurredAt,
      scopeMetadata,
      lifecycle: lifecycle.lifecycle,
      expiresAt: lifecycle.expiresAt,
      expiryStatus: lifecycle.expiryStatus,
      targetTerminalIds,
    })

    return {
      topicKey: item.topicKey,
      operation,
      scopeType,
      scopeKey: item.scopeKey,
      itemKey,
      revision,
      sourceRevision: sourceRevision ?? null,
      sourceEventId: sourceEventId?.trim() || null,
      sourceReleaseId: item.sourceReleaseId ?? null,
      occurredAt: toIsoTime(occurredAt),
      scopeMetadata: scopeMetadata ?? null,
      lifecycle: lifecycle.lifecycle,
      expiresAt: lifecycle.expiresAt == null ? null : toIsoTime(lifecycle.expiresAt),
      status: 'ACCEPTED' as const,
      targetTerminalIds,
    }
  })

  const terminalChangeCounts = new Map<string, number>()
  acceptedItems.forEach(item => {
    item.targetTerminalIds.forEach(terminalId => {
      terminalChangeCounts.set(terminalId, (terminalChangeCounts.get(terminalId) ?? 0) + 1)
    })
  })
  const allocatedCursors = preallocateCursorsByTerminal(sandboxId, terminalChangeCounts, timestamp)

  acceptedItems.forEach(accepted => {
    const scopeMetadataJson = accepted.scopeMetadata ? JSON.stringify(accepted.scopeMetadata) : null
    accepted.targetTerminalIds.forEach(terminalId => {
      const cursor = takePreallocatedCursor(allocatedCursors, terminalId)
      recordTerminalChange({
        sandboxId,
        cursor,
        topicKey: accepted.item.topicKey,
        operation: accepted.operation,
        scopeType: accepted.scopeType,
        scopeKey: accepted.scopeKey,
        itemKey: accepted.itemKey,
        terminalId,
        revision: accepted.revision,
        payloadJson: accepted.payloadJson,
        sourceReleaseId: accepted.item.sourceReleaseId ?? null,
        occurredAt: accepted.occurredAt,
        scopeMetadataJson,
        lifecycle: accepted.lifecycle,
        expiresAt: accepted.expiresAt,
        changeReason: accepted.operation === 'delete' ? 'PUBLISHER_DELETE' : 'PUBLISHER_UPSERT',
        timestamp,
      })
      const change = toProjectionEnvelope({
        topicKey: accepted.item.topicKey,
        operation: accepted.operation,
        scopeType: accepted.scopeType,
        scopeKey: accepted.scopeKey,
        itemKey: accepted.itemKey,
        revision: accepted.revision,
        payloadJson: accepted.payloadJson,
        createdAt: timestamp,
        occurredAt: accepted.occurredAt,
        sourceReleaseId: accepted.item.sourceReleaseId ?? null,
        scopeMetadata: accepted.scopeMetadata,
        lifecycle: accepted.lifecycle,
        expiresAt: accepted.expiresAt,
        expiryReason: accepted.operation === 'delete' ? 'PUBLISHER_DELETE' : null,
      })
      const queue = queuedByTerminal.get(terminalId) ?? []
      queue.push({cursor, change})
      queuedByTerminal.set(terminalId, queue)
      queueProjectionChangeToOnlineTerminal(terminalId, { sandboxId, cursor, change })
    })
  })

  queuedByTerminal.forEach((_changes, terminalId) => {
    flushProjectionQueueToOnlineTerminal(sandboxId, terminalId)
  })

  return {
    total: items.length,
    items,
  }
}

export const fanoutExistingProjectionToTerminalIds = (input: {
  sandboxId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  revision: number
  payload: Record<string, unknown>
  sourceReleaseId?: string | null
  lifecycle?: TdpProjectionLifecycle | null
  expiresAt?: number | null
  expiryReason?: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null
  targetTerminalIds: string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  if (input.expiresAt != null && input.expiresAt <= timestamp) {
    return {
      total: 0,
      targetTerminalIds: [] as string[],
    }
  }
  const payloadJson = JSON.stringify(input.payload)
  const targetTerminalIds = Array.from(new Set(input.targetTerminalIds.filter(terminalId => terminalId.trim().length > 0)))
  const queuedByTerminal = new Map<string, Array<{cursor: number; change: TdpProjectionEnvelope}>>()
  const allocatedCursors = preallocateCursorsByTerminal(
    sandboxId,
    new Map(targetTerminalIds.map(terminalId => [terminalId, 1])),
    timestamp,
  )

  targetTerminalIds.forEach(terminalId => {
    const cursor = takePreallocatedCursor(allocatedCursors, terminalId)
    recordTerminalChange({
      sandboxId,
      cursor,
      topicKey: input.topicKey,
      operation: 'upsert',
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      itemKey: input.itemKey,
      terminalId,
      revision: input.revision,
      payloadJson,
      sourceReleaseId: input.sourceReleaseId ?? null,
      lifecycle: input.lifecycle ?? readTdpTopicLifecyclePolicy(sandboxId, input.topicKey).lifecycle,
      expiresAt: input.expiresAt ?? null,
      expiryReason: input.expiryReason ?? null,
      timestamp,
    })
    const change = toProjectionEnvelope({
      topicKey: input.topicKey,
      operation: 'upsert',
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      itemKey: input.itemKey,
      revision: input.revision,
      payloadJson,
      createdAt: timestamp,
      sourceReleaseId: input.sourceReleaseId ?? null,
      lifecycle: input.lifecycle ?? readTdpTopicLifecyclePolicy(sandboxId, input.topicKey).lifecycle,
      expiresAt: input.expiresAt ?? null,
      expiryReason: input.expiryReason ?? null,
    })
    const queue = queuedByTerminal.get(terminalId) ?? []
    queue.push({cursor, change})
    queuedByTerminal.set(terminalId, queue)
    queueProjectionChangeToOnlineTerminal(terminalId, {sandboxId, cursor, change})
  })

  queuedByTerminal.forEach((_changes, terminalId) => {
    flushProjectionQueueToOnlineTerminal(sandboxId, terminalId)
  })

  return {
    total: targetTerminalIds.length,
    targetTerminalIds,
  }
}

export const sendEdgeDegradedToSession = (input: {
  sessionId: string
  reason?: string
  nodeState?: 'healthy' | 'grace' | 'degraded'
  gracePeriodSeconds?: number
  alternativeEndpoints?: string[]
}) => {
  const session = getOnlineSessionById(input.sessionId)
  if (!session) {
    throw new Error('目标 session 当前不在线')
  }
  if (session.socket.readyState !== 1) {
    throw new Error('目标 session 连接不可用')
  }

  const message: TdpServerMessage = {
    type: 'EDGE_DEGRADED',
    data: {
      reason: input.reason ?? 'maintenance_mode',
      issuedAt: toIsoTime(now()),
      nodeState: input.nodeState ?? 'grace',
      gracePeriodSeconds: input.gracePeriodSeconds ?? 300,
      alternativeEndpoints: input.alternativeEndpoints ?? [],
    },
  }
  session.socket.send(JSON.stringify(message))
  return { sessionId: input.sessionId, messageType: 'EDGE_DEGRADED' }
}

export const sendSessionRehomeRequired = (input: {
  sessionId: string
  reason?: string
  deadline?: string
  alternativeEndpoints?: string[]
}) => {
  const session = getOnlineSessionById(input.sessionId)
  if (!session) {
    throw new Error('目标 session 当前不在线')
  }
  if (session.socket.readyState !== 1) {
    throw new Error('目标 session 连接不可用')
  }

  const message: TdpServerMessage = {
    type: 'SESSION_REHOME_REQUIRED',
    data: {
      reason: input.reason ?? 'node_draining',
      deadline: input.deadline ?? toIsoTime(now() + 60_000),
      alternativeEndpoints: input.alternativeEndpoints ?? [],
    },
  }
  session.socket.send(JSON.stringify(message))
  return { sessionId: input.sessionId, messageType: 'SESSION_REHOME_REQUIRED' }
}

export const sendProtocolErrorToSession = (input: {
  sessionId: string
  code?: string
  message?: string
  details?: unknown
  closeAfterSend?: boolean
}) => {
  const session = getOnlineSessionById(input.sessionId)
  if (!session) {
    throw new Error('目标 session 当前不在线')
  }
  if (session.socket.readyState !== 1) {
    throw new Error('目标 session 连接不可用')
  }

  const message: TdpServerMessage = {
    type: 'ERROR',
    error: {
      code: input.code ?? 'ADMIN_INJECTED_PROTOCOL_ERROR',
      message: input.message ?? 'mock protocol error',
      details: input.details,
    },
  }
  session.socket.send(JSON.stringify(message))
  if (input.closeAfterSend ?? true) {
    session.socket.close(1008, message.error.message)
  }
  return { sessionId: input.sessionId, messageType: 'ERROR' }
}

export const forceCloseSession = (input: {
  sessionId: string
  code?: number
  reason?: string
}) => {
  return forceCloseOnlineSession(input)
}
