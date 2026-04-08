import { and, desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { changeLogsTable, commandOutboxTable, projectionsTable, sessionsTable, taskInstancesTable, terminalsTable, topicsTable } from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'
import { forceCloseOnlineSession, getOnlineSessionById, listOnlineSessionsByTerminalId } from './wsSessionRegistry.js'
import type { TdpProjectionEnvelope, TdpServerMessage } from './wsProtocol.js'

const toIsoTime = (timestamp: number) => new Date(timestamp).toISOString()

const getNextCursorForTerminal = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const row = sqlite.prepare(`
    SELECT COALESCE(MAX(cursor), 0) as high_watermark
    FROM tdp_change_logs
    WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ?
  `).get(sandboxId, 'TERMINAL', terminalId) as { high_watermark: number } | undefined
  return (row?.high_watermark ?? 0) + 1
}

const buildItemKey = (input: { topicKey: string; scopeKey: string; payloadJson: string; sourceReleaseId?: string | null }) => {
  const payload = parseJson<Record<string, unknown>>(input.payloadJson, {})
  if (input.topicKey === 'tcp.task.release' && typeof payload.instanceId === 'string' && payload.instanceId.trim()) {
    return payload.instanceId
  }
  return input.sourceReleaseId ?? `${input.topicKey}:${input.scopeKey}`
}

const toProjectionEnvelope = (input: {
  topicKey: string
  scopeKey: string
  scopeType: string
  revision: number
  payloadJson: string
  updatedAt?: number
  createdAt?: number
  sourceReleaseId?: string | null
}): TdpProjectionEnvelope => ({
  topic: input.topicKey,
  itemKey: buildItemKey(input),
  operation: 'upsert',
  scopeType: input.scopeType,
  scopeId: input.scopeKey,
  revision: input.revision,
  payload: parseJson(input.payloadJson, {}),
  occurredAt: toIsoTime(input.createdAt ?? input.updatedAt ?? now()),
  sourceReleaseId: input.sourceReleaseId ?? null,
})

const pushToOnlineTerminal = (terminalId: string, message: TdpServerMessage) => {
  const sessions = listOnlineSessionsByTerminalId(terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    session.socket.send(JSON.stringify(message))
  }
}

const BATCH_WINDOW_MS = 120

const pushProjectionChangeToOnlineTerminal = (terminalId: string, input: {
  change: TdpProjectionEnvelope
  cursor: number
}) => {
  const sessions = listOnlineSessionsByTerminalId(terminalId)
  for (const session of sessions) {
    session.lastDeliveredRevision = input.cursor
    db.update(sessionsTable)
      .set({ lastDeliveredRevision: input.cursor })
      .where(eq(sessionsTable.sessionId, session.sessionId))
      .run()
  }
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    const queue = session.batchQueue ?? []
    queue.push(input.change)
    session.batchQueue = queue
    if (session.batchTimer) continue
    session.batchTimer = setTimeout(() => {
      const batch = session.batchQueue ?? []
      session.batchQueue = []
      session.batchTimer = undefined
      if (session.socket.readyState !== 1 || batch.length === 0) return
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
        return
      }
      session.socket.send(JSON.stringify({
        type: 'PROJECTION_BATCH',
        eventId: createId('batch'),
        timestamp: now(),
        data: {
          changes: batch,
          nextCursor: session.lastDeliveredRevision ?? 0,
        },
      } satisfies TdpServerMessage))
    }, BATCH_WINDOW_MS)
  }
}

export const listSessions = () => {
  const sandboxId = getCurrentSandboxId()
  const rows = db.select().from(sessionsTable).where(eq(sessionsTable.sandboxId, sandboxId)).orderBy(desc(sessionsTable.connectedAt)).all()
  return rows.map((item) => {
    const highWatermark = getHighWatermarkForTerminal(item.terminalId)
    const lastAckedRevision = item.lastAckedRevision ?? 0
    const lastAppliedRevision = item.lastAppliedRevision ?? 0
    return {
      ...item,
      highWatermark,
      ackLag: Math.max(0, highWatermark - lastAckedRevision),
      applyLag: Math.max(0, highWatermark - lastAppliedRevision),
    }
  })
}

export const connectSession = (input: { terminalId: string; clientVersion: string; protocolVersion: string }) => {
  const sandboxId = getCurrentSandboxId()
  const sessionId = createId('session')
  const timestamp = now()
  db.insert(sessionsTable).values({
    sessionId,
    terminalId: input.terminalId,
    sandboxId,
    clientVersion: input.clientVersion,
    protocolVersion: input.protocolVersion,
    status: 'CONNECTED',
    connectedAt: timestamp,
    disconnectedAt: null,
    lastHeartbeatAt: timestamp,
    lastDeliveredRevision: null,
    lastAckedRevision: null,
    lastAppliedRevision: null,
  }).run()
  db.update(terminalsTable)
    .set({ presenceStatus: 'ONLINE', healthStatus: 'HEALTHY', lastSeenAt: timestamp, updatedAt: timestamp })
    .where(and(eq(terminalsTable.terminalId, input.terminalId), eq(terminalsTable.sandboxId, sandboxId)))
    .run()
  return { sessionId }
}

export const heartbeatSession = (sessionId: string) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, sessionId))
    .run()
  const session = db.select().from(sessionsTable).where(eq(sessionsTable.sessionId, sessionId)).get()
  if (session) {
    db.update(terminalsTable)
      .set({ presenceStatus: 'ONLINE', lastSeenAt: timestamp, updatedAt: timestamp })
      .where(and(eq(terminalsTable.terminalId, session.terminalId), eq(terminalsTable.sandboxId, session.sandboxId)))
      .run()
  }
  return { sessionId, lastHeartbeatAt: timestamp }
}

export const updateSessionAppliedRevision = (sessionId: string, revision: number) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastAppliedRevision: revision, lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, sessionId))
    .run()
  return { sessionId, lastAppliedRevision: revision }
}

export const acknowledgeSessionRevision = (input: { sessionId: string; cursor: number; topic?: string; itemKey?: string }) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastAckedRevision: input.cursor, lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, input.sessionId))
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

export const disconnectSession = (sessionId: string) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ status: 'DISCONNECTED', disconnectedAt: timestamp, lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, sessionId))
    .run()
  const session = db.select().from(sessionsTable).where(eq(sessionsTable.sessionId, sessionId)).get()
  if (session) {
    db.update(terminalsTable)
      .set({ presenceStatus: 'OFFLINE', lastSeenAt: timestamp, updatedAt: timestamp })
      .where(and(eq(terminalsTable.terminalId, session.terminalId), eq(terminalsTable.sandboxId, session.sandboxId)))
      .run()
  }
  return { sessionId, disconnectedAt: timestamp }
}

export const validateTerminalAccessToken = (input: { terminalId: string; token: string }):
  | { valid: true }
  | { valid: false; code: string; message: string } => {
  const sandboxId = getCurrentSandboxId()
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

export const listTopics = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(topicsTable).where(eq(topicsTable.sandboxId, sandboxId)).orderBy(desc(topicsTable.updatedAt)).all().map((item) => ({
    ...item,
    schema: parseJson(item.schemaJson, {}),
  }))
}

export const listProjections = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(projectionsTable).where(eq(projectionsTable.sandboxId, sandboxId)).orderBy(desc(projectionsTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const listChangeLogs = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(changeLogsTable).where(eq(changeLogsTable.sandboxId, sandboxId)).orderBy(desc(changeLogsTable.createdAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const listCommandOutbox = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(commandOutboxTable).where(eq(commandOutboxTable.sandboxId, sandboxId)).orderBy(desc(commandOutboxTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const dispatchTaskReleaseToDataPlane = (releaseId: string) => {
  const sandboxId = getCurrentSandboxId()
  const releaseMeta = sqlite.prepare('SELECT task_type, payload_json FROM task_releases WHERE release_id = ? AND sandbox_id = ? LIMIT 1').get(releaseId, sandboxId) as { task_type: string; payload_json: string } | undefined
  if (!releaseMeta) {
    throw new Error('任务发布单不存在')
  }

  if (releaseMeta.task_type === 'REMOTE_CONTROL') {
    const commandDispatch = dispatchRemoteControlRelease(releaseId)
    return {
      dispatchId: createId('dispatch'),
      releaseId,
      totalInstances: commandDispatch.totalInstances,
      mode: 'COMMAND',
    }
  }

  const instances = sqlite.prepare(`
    SELECT ti.instance_id, ti.terminal_id, ti.payload_json,
           COALESCE((SELECT MAX(revision) FROM tdp_projections WHERE sandbox_id = ? AND topic_key = 'tcp.task.release' AND scope_type = 'TERMINAL' AND scope_key = ti.terminal_id), 0) as current_revision
    FROM task_instances ti
    JOIN task_releases tr ON tr.release_id = ti.release_id
    WHERE ti.release_id = ? AND tr.sandbox_id = ?
  `).all(sandboxId, releaseId, sandboxId) as Array<{ instance_id: string; terminal_id: string; payload_json: string; current_revision: number }>

  const timestamp = now()

  for (const instance of instances) {
    const revision = instance.current_revision + 1
    const cursor = getNextCursorForTerminal(instance.terminal_id)
    const snapshotPayload = JSON.stringify({
      releaseId,
      instanceId: instance.instance_id,
      payload: parseJson(instance.payload_json, {}),
      dispatchedAt: timestamp,
    })

    const existing = sqlite.prepare('SELECT projection_id FROM tdp_projections WHERE sandbox_id = ? AND topic_key = ? AND scope_type = ? AND scope_key = ? LIMIT 1').get(sandboxId, 'tcp.task.release', 'TERMINAL', instance.terminal_id) as { projection_id: string } | undefined
    if (existing) {
      sqlite.prepare('UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?').run(revision, snapshotPayload, timestamp, existing.projection_id)
    } else {
      db.insert(projectionsTable).values({
        projectionId: createId('projection'),
        sandboxId,
        topicKey: 'tcp.task.release',
        scopeType: 'TERMINAL',
        scopeKey: instance.terminal_id,
        revision,
        payloadJson: snapshotPayload,
        updatedAt: timestamp,
      }).run()
    }

    db.insert(changeLogsTable).values({
      changeId: createId('change'),
      sandboxId,
      cursor,
      topicKey: 'tcp.task.release',
      scopeType: 'TERMINAL',
      scopeKey: instance.terminal_id,
      revision,
      payloadJson: snapshotPayload,
      sourceReleaseId: releaseId,
      createdAt: timestamp,
    }).run()
    pushProjectionChangeToOnlineTerminal(instance.terminal_id, {
      cursor,
      change: toProjectionEnvelope({
        topicKey: 'tcp.task.release',
        scopeType: 'TERMINAL',
        scopeKey: instance.terminal_id,
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
  }
}

const dispatchRemoteControlRelease = (releaseId: string) => {
  const sandboxId = getCurrentSandboxId()
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
    const payload = {
      instanceId: instance.instance_id,
      ...basePayload,
    }

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

    const sessions = listOnlineSessionsByTerminalId(instance.terminal_id)
    for (const session of sessions) {
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

    db.update(taskInstancesTable)
      .set({ deliveryStatus: 'DELIVERED', deliveredAt: timestamp, updatedAt: timestamp })
      .where(eq(taskInstancesTable.instanceId, instance.instance_id))
      .run()
  }

  return { totalInstances: instances.length }
}

export const getTerminalSnapshot = (terminalId: string) => {
  return getTerminalSnapshotEnvelope(terminalId)
}

export const getTerminalSnapshotEnvelope = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare(
    'SELECT topic_key, scope_key, scope_type, revision, payload_json, updated_at FROM tdp_projections WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ? ORDER BY updated_at DESC'
  ).all(sandboxId, 'TERMINAL', terminalId) as Array<{ topic_key: string; scope_key: string; scope_type: string; revision: number; payload_json: string; updated_at: number }>

  return rows.map((item) => toProjectionEnvelope({
    topicKey: item.topic_key,
    scopeKey: item.scope_key,
    scopeType: item.scope_type,
    revision: item.revision,
    payloadJson: item.payload_json,
    updatedAt: item.updated_at,
  }))
}

export const getTerminalChanges = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare(
    'SELECT change_id, cursor, topic_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ? ORDER BY created_at DESC LIMIT 50'
  ).all(sandboxId, 'TERMINAL', terminalId) as Array<{ change_id: string; cursor: number; topic_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

  return rows.map((item) => ({
    changeId: item.change_id,
    cursor: item.cursor,
    topicKey: item.topic_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    sourceReleaseId: item.source_release_id,
    createdAt: item.created_at,
  }))
}

export const getTerminalChangesSince = (terminalId: string, cursor: number, limit = 100) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare(
    'SELECT change_id, cursor, topic_key, scope_type, scope_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ? AND cursor > ? ORDER BY cursor ASC LIMIT ?'
  ).all(sandboxId, 'TERMINAL', terminalId, cursor, limit) as Array<{ change_id: string; cursor: number; topic_key: string; scope_type: string; scope_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

  return rows.map((item) => ({
    cursor: item.cursor,
    change: toProjectionEnvelope({
      topicKey: item.topic_key,
      scopeType: item.scope_type,
      scopeKey: item.scope_key,
      revision: item.revision,
      payloadJson: item.payload_json,
      createdAt: item.created_at,
      sourceReleaseId: item.source_release_id,
    }),
  }))
}

export const getHighWatermarkForTerminal = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const row = sqlite.prepare(
    'SELECT COALESCE(MAX(cursor), 0) as high_watermark FROM tdp_change_logs WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ?'
  ).get(sandboxId, 'TERMINAL', terminalId) as { high_watermark: number } | undefined
  return row?.high_watermark ?? 0
}

export const createTopic = (input: {
  key: string
  name: string
  payloadMode?: string
  schema?: Record<string, unknown>
  scopeType?: string
  retentionHours?: number
}) => {
  const sandboxId = getCurrentSandboxId()
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
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { topicId }
}

export const listScopes = () => {
  const sandboxId = getCurrentSandboxId()
  const topicScopes = sqlite.prepare(
    'SELECT key as topic_key, scope_type, COUNT(*) as topic_count FROM tdp_topics WHERE sandbox_id = ? GROUP BY key, scope_type ORDER BY key ASC'
  ).all(sandboxId) as Array<{ topic_key: string; scope_type: string; topic_count: number }>
  const projectionScopes = sqlite.prepare(
    'SELECT topic_key, scope_type, scope_key, MAX(revision) as revision, MAX(updated_at) as updated_at FROM tdp_projections WHERE sandbox_id = ? GROUP BY topic_key, scope_type, scope_key ORDER BY updated_at DESC'
  ).all(sandboxId) as Array<{ topic_key: string; scope_type: string; scope_key: string; revision: number; updated_at: number }>

  return { topicScopes, projectionScopes }
}

export const upsertProjection = (input: {
  topicKey: string
  scopeType?: string
  scopeKey: string
  payload: Record<string, unknown>
  sourceReleaseId?: string
}) => {
  const sandboxId = getCurrentSandboxId()
  const timestamp = now()
  const scopeType = input.scopeType ?? 'TERMINAL'
  const existingProjection = sqlite.prepare(
    'SELECT projection_id, revision FROM tdp_projections WHERE sandbox_id = ? AND topic_key = ? AND scope_type = ? AND scope_key = ? LIMIT 1'
  ).get(sandboxId, input.topicKey, scopeType, input.scopeKey) as { projection_id: string; revision: number } | undefined
  const revision = (existingProjection?.revision ?? 0) + 1
  const cursor = scopeType === 'TERMINAL' ? getNextCursorForTerminal(input.scopeKey) : 0
  const payloadJson = JSON.stringify(input.payload)

  if (existingProjection) {
    sqlite.prepare('UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?')
      .run(revision, payloadJson, timestamp, existingProjection.projection_id)
  } else {
    db.insert(projectionsTable).values({
      projectionId: createId('projection'),
      sandboxId,
      topicKey: input.topicKey,
      scopeType,
      scopeKey: input.scopeKey,
      revision,
      payloadJson,
      updatedAt: timestamp,
    }).run()
  }

  db.insert(changeLogsTable).values({
    changeId: createId('change'),
    sandboxId,
    cursor,
    topicKey: input.topicKey,
    scopeType,
    scopeKey: input.scopeKey,
    revision,
    payloadJson,
    sourceReleaseId: input.sourceReleaseId ?? null,
    createdAt: timestamp,
  }).run()
  if (scopeType === 'TERMINAL') {
    pushProjectionChangeToOnlineTerminal(input.scopeKey, {
      cursor,
      change: toProjectionEnvelope({
        topicKey: input.topicKey,
        scopeType,
        scopeKey: input.scopeKey,
        revision,
        payloadJson,
        createdAt: timestamp,
        sourceReleaseId: input.sourceReleaseId ?? null,
      }),
    })
  }

  return { topicKey: input.topicKey, scopeType, scopeKey: input.scopeKey, revision }
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
