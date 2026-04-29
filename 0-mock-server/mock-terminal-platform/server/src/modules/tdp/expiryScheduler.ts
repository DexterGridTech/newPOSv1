import { sqlite } from '../../database/index.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable, listSandboxes } from '../sandbox/service.js'
import { appendAuditLog } from '../admin/audit.js'
import {
  allocateTdpCursorForTerminal,
  pushProjectionChangeToOnlineTerminal,
  toTdpProjectionEnvelope,
  upsertTdpTerminalProjectionAccessForScheduler,
} from './service.js'

const DEFAULT_INTERVAL_MS = 30_000
const DEFAULT_BATCH_SIZE = 500
const DEFAULT_MAX_TOMBSTONES_PER_RUN = 5_000
const DEFAULT_CLAIM_TIMEOUT_MS = 5 * 60_000

export interface TdpProjectionExpiryRunResult {
  sandboxId: string
  claimedProjectionCount: number
  expiredProjectionCount: number
  generatedTombstoneCount: number
  duplicateTombstoneCount: number
  skippedChangedRevisionCount: number
  oldestExpiredLagMs: number
  durationMs: number
}

export interface TdpProjectionExpiryRunOptions {
  sandboxId: string
  schedulerId?: string
  batchSize?: number
  maxTombstonesPerRun?: number
  claimTimeoutMs?: number
}

interface ClaimedProjection {
  projection_id: string
  topic_key: string
  scope_type: string
  scope_key: string
  item_key: string
  revision: number
  payload_json: string
  expires_at: number
  updated_at: number
}

interface ProjectionAccessRow {
  target_terminal_id: string
  topic_key: string
  scope_type: string
  scope_key: string
  item_key: string
  revision: number
  payload_json: string
  source_release_id: string | null
  occurred_at: number | null
  scope_metadata_json: string | null
}

const toPositiveInt = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && value != null && value > 0 ? Math.trunc(value) : fallback

const resolveIntervalMs = () => toPositiveInt(
  Number(process.env.TDP_PROJECTION_EXPIRY_INTERVAL_MS),
  DEFAULT_INTERVAL_MS,
)

const claimExpiredProjections = (input: {
  sandboxId: string
  schedulerId: string
  timestamp: number
  batchSize: number
  claimTimeoutMs: number
}) => {
  const timeoutBefore = input.timestamp - input.claimTimeoutMs
  const candidates = sqlite.prepare(`
    SELECT projection_id, topic_key, scope_type, scope_key, item_key, revision, payload_json, expires_at, updated_at
    FROM tdp_projections
    WHERE sandbox_id = ?
      AND expires_at IS NOT NULL
      AND expires_at <= ?
      AND (
        expiry_status IS NULL
        OR expiry_status = 'pending'
        OR (expiry_status = 'processing' AND COALESCE(expiry_claimed_at, 0) < ?)
      )
    ORDER BY expires_at ASC, updated_at ASC, projection_id ASC
    LIMIT ?
  `).all(input.sandboxId, input.timestamp, timeoutBefore, input.batchSize) as ClaimedProjection[]

  const updateClaim = sqlite.prepare(`
    UPDATE tdp_projections
    SET expiry_status = 'processing',
        expiry_claimed_by = ?,
        expiry_claimed_at = ?
    WHERE projection_id = ?
      AND sandbox_id = ?
      AND revision = ?
      AND expires_at = ?
      AND (
        expiry_status IS NULL
        OR expiry_status = 'pending'
        OR (expiry_status = 'processing' AND COALESCE(expiry_claimed_at, 0) < ?)
      )
  `)

  return candidates.filter(candidate => {
    const result = updateClaim.run(
      input.schedulerId,
      input.timestamp,
      candidate.projection_id,
      input.sandboxId,
      candidate.revision,
      candidate.expires_at,
      timeoutBefore,
    )
    return result.changes > 0
  })
}

const listProjectionAccessRows = (input: {
  sandboxId: string
  projection: ClaimedProjection
}) => sqlite.prepare(`
  SELECT target_terminal_id, topic_key, scope_type, scope_key, item_key, revision, payload_json,
         source_release_id, occurred_at, scope_metadata_json
  FROM tdp_terminal_projection_access
  WHERE sandbox_id = ?
    AND topic_key = ?
    AND scope_type = ?
    AND scope_key = ?
    AND item_key = ?
    AND operation != 'delete'
  ORDER BY target_terminal_id ASC
`).all(
  input.sandboxId,
  input.projection.topic_key,
  input.projection.scope_type,
  input.projection.scope_key,
  input.projection.item_key,
) as ProjectionAccessRow[]

const expireProjectionForTerminal = (input: {
  sandboxId: string
  schedulerId: string
  timestamp: number
  projection: ClaimedProjection
  access: ProjectionAccessRow
}) => sqlite.transaction((transactionInput: typeof input) => {
  const current = sqlite.prepare(`
    SELECT projection_id
    FROM tdp_projections
    WHERE projection_id = ?
      AND sandbox_id = ?
      AND revision = ?
      AND expires_at = ?
      AND expiry_claimed_by = ?
    LIMIT 1
  `).get(
    transactionInput.projection.projection_id,
    transactionInput.sandboxId,
    transactionInput.projection.revision,
    transactionInput.projection.expires_at,
    transactionInput.schedulerId,
  ) as { projection_id: string } | undefined

  if (!current) {
    return {
      status: 'skipped-changed-revision' as const,
      cursor: undefined,
      tombstoneKey: undefined,
    }
  }

  const tombstoneKey = [
    'ttl-expire',
    transactionInput.projection.projection_id,
    transactionInput.access.target_terminal_id,
    transactionInput.projection.revision,
    transactionInput.projection.expires_at,
  ].join(':')
  const cursor = allocateTdpCursorForTerminal(transactionInput.sandboxId, transactionInput.access.target_terminal_id)
  const payloadJson = transactionInput.access.payload_json || transactionInput.projection.payload_json || '{}'
  const insertResult = sqlite.prepare(`
    INSERT OR IGNORE INTO tdp_change_logs (
      change_id,
      sandbox_id,
      cursor,
      topic_key,
      operation,
      scope_type,
      scope_key,
      item_key,
      target_terminal_id,
      revision,
      payload_json,
      source_release_id,
      occurred_at,
      scope_metadata_json,
      expires_at,
      change_reason,
      source_projection_id,
      tombstone_key,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('change'),
    transactionInput.sandboxId,
    cursor,
    transactionInput.projection.topic_key,
    'delete',
    transactionInput.projection.scope_type,
    transactionInput.projection.scope_key,
    transactionInput.projection.item_key,
    transactionInput.access.target_terminal_id,
    transactionInput.projection.revision,
    payloadJson,
    transactionInput.access.source_release_id,
    transactionInput.access.occurred_at,
    transactionInput.access.scope_metadata_json,
    transactionInput.projection.expires_at,
    'TTL_EXPIRED',
    transactionInput.projection.projection_id,
    tombstoneKey,
    transactionInput.timestamp,
  )

  upsertTdpTerminalProjectionAccessForScheduler({
    sandboxId: transactionInput.sandboxId,
    targetTerminalId: transactionInput.access.target_terminal_id,
    topicKey: transactionInput.projection.topic_key,
    operation: 'delete',
    scopeType: transactionInput.projection.scope_type,
    scopeKey: transactionInput.projection.scope_key,
    itemKey: transactionInput.projection.item_key,
    revision: transactionInput.projection.revision,
    payloadJson,
    sourceReleaseId: transactionInput.access.source_release_id,
    occurredAt: transactionInput.access.occurred_at,
    scopeMetadataJson: transactionInput.access.scope_metadata_json,
    lifecycle: 'expiring',
    expiresAt: transactionInput.projection.expires_at,
    expiredAt: transactionInput.timestamp,
    expiryReason: 'TTL_EXPIRED',
    cursor,
    timestamp: transactionInput.timestamp,
  })

  return {
    status: insertResult.changes > 0 ? 'generated' as const : 'duplicate' as const,
    cursor,
    tombstoneKey,
    payloadJson,
  }
})(input)

export const runTdpProjectionExpiryOnce = (
  options: TdpProjectionExpiryRunOptions,
): TdpProjectionExpiryRunResult => {
  const startedAt = now()
  const sandboxId = options.sandboxId
  assertSandboxUsable(sandboxId)
  const schedulerId = options.schedulerId?.trim() || createId('tdp-expiry-scheduler')
  const batchSize = toPositiveInt(options.batchSize, DEFAULT_BATCH_SIZE)
  const maxTombstonesPerRun = toPositiveInt(options.maxTombstonesPerRun, DEFAULT_MAX_TOMBSTONES_PER_RUN)
  const claimTimeoutMs = toPositiveInt(options.claimTimeoutMs, DEFAULT_CLAIM_TIMEOUT_MS)

  const claimed = claimExpiredProjections({
    sandboxId,
    schedulerId,
    timestamp: startedAt,
    batchSize,
    claimTimeoutMs,
  })

  let generatedTombstoneCount = 0
  let duplicateTombstoneCount = 0
  let skippedChangedRevisionCount = 0
  let expiredProjectionCount = 0
  const pushes: Array<{
    terminalId: string
    cursor: number
    projection: ClaimedProjection
    access: ProjectionAccessRow
  }> = []

  for (const projection of claimed) {
    const accessRows = listProjectionAccessRows({sandboxId, projection})
    let projectedTombstones = 0
    for (const access of accessRows) {
      if (generatedTombstoneCount + duplicateTombstoneCount >= maxTombstonesPerRun) {
        break
      }
      const result = expireProjectionForTerminal({
        sandboxId,
        schedulerId,
        timestamp: startedAt,
        projection,
        access,
      })
      if (result.status === 'skipped-changed-revision') {
        skippedChangedRevisionCount += 1
        continue
      }
      if (result.status === 'generated') {
        generatedTombstoneCount += 1
        pushes.push({
          terminalId: access.target_terminal_id,
          cursor: result.cursor,
          projection,
          access,
        })
      } else {
        duplicateTombstoneCount += 1
      }
      projectedTombstones += 1
    }

    if (projectedTombstones === accessRows.length) {
      sqlite.prepare(`
        UPDATE tdp_projections
        SET expiry_status = 'done',
            expired_at = ?,
            expiry_reason = 'TTL_EXPIRED',
            updated_at = ?
        WHERE projection_id = ?
          AND sandbox_id = ?
          AND revision = ?
          AND expires_at = ?
          AND expiry_claimed_by = ?
      `).run(
        startedAt,
        startedAt,
        projection.projection_id,
        sandboxId,
        projection.revision,
        projection.expires_at,
        schedulerId,
      )
      expiredProjectionCount += 1
    } else {
      sqlite.prepare(`
        UPDATE tdp_projections
        SET expiry_status = 'pending',
            expiry_claimed_by = NULL,
            expiry_claimed_at = NULL
        WHERE projection_id = ?
          AND sandbox_id = ?
          AND revision = ?
          AND expires_at = ?
          AND expiry_claimed_by = ?
      `).run(
        projection.projection_id,
        sandboxId,
        projection.revision,
        projection.expires_at,
        schedulerId,
      )
    }
  }

  for (const push of pushes) {
    pushProjectionChangeToOnlineTerminal(push.terminalId, {
      sandboxId,
      cursor: push.cursor,
      change: toTdpProjectionEnvelope({
        topicKey: push.projection.topic_key,
        operation: 'delete',
        scopeType: push.projection.scope_type,
        scopeKey: push.projection.scope_key,
        itemKey: push.projection.item_key,
        revision: push.projection.revision,
        payloadJson: push.access.payload_json || push.projection.payload_json || '{}',
        createdAt: startedAt,
        occurredAt: push.access.occurred_at ?? undefined,
        sourceReleaseId: push.access.source_release_id,
        scopeMetadata: parseJson(push.access.scope_metadata_json, null),
        lifecycle: 'expiring',
        expiresAt: push.projection.expires_at,
        expiryReason: 'TTL_EXPIRED',
      }),
    })
  }

  const oldest = claimed.length > 0
    ? Math.max(0, startedAt - Math.min(...claimed.map(item => item.expires_at)))
    : 0

  return {
    sandboxId,
    claimedProjectionCount: claimed.length,
    expiredProjectionCount,
    generatedTombstoneCount,
    duplicateTombstoneCount,
    skippedChangedRevisionCount,
    oldestExpiredLagMs: oldest,
    durationMs: now() - startedAt,
  }
}

export const getTdpProjectionExpiryStats = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const row = sqlite.prepare(`
    SELECT
      COUNT(*) as pending_count,
      MIN(expires_at) as oldest_expires_at
    FROM tdp_projections
    WHERE sandbox_id = ?
      AND expires_at IS NOT NULL
      AND expires_at <= ?
      AND (expiry_status IS NULL OR expiry_status = 'pending' OR expiry_status = 'processing')
  `).get(sandboxId, timestamp) as { pending_count: number; oldest_expires_at: number | null }
  return {
    sandboxId,
    expiredPendingProjectionCount: row.pending_count,
    oldestExpiredLagMs: row.oldest_expires_at == null ? 0 : Math.max(0, timestamp - row.oldest_expires_at),
  }
}

export const startTdpProjectionExpiryScheduler = () => {
  const timer = setInterval(() => {
    try {
      const sandboxes = listSandboxes().filter(item => item.status === 'ACTIVE')
      sandboxes.forEach(sandbox => {
        const result = runTdpProjectionExpiryOnce({sandboxId: sandbox.sandboxId})
        if (result.claimedProjectionCount > 0 || result.generatedTombstoneCount > 0) {
          appendAuditLog({
            domain: 'TDP',
            action: 'EXPIRE_PROJECTIONS_SCHEDULED',
            targetId: sandbox.sandboxId,
            detail: result,
            operator: 'system',
          })
        }
      })
    } catch (error) {
      console.error('[tdp-projection-expiry-failed]', error)
    }
  }, resolveIntervalMs())

  timer.unref?.()

  return () => clearInterval(timer)
}
