import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { changeLogsTable, commandOutboxTable, projectionsTable, sessionsTable, taskInstancesTable, terminalsTable, topicsTable } from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import { forceCloseOnlineSession, getOnlineSessionById, listOnlineSessionsByTerminalId } from './wsSessionRegistry.js'
import type { TdpProjectionEnvelope, TdpServerMessage } from './wsProtocol.js'

const toIsoTime = (timestamp: number) => new Date(timestamp).toISOString()

const getNextCursorForTerminal = (sandboxId: string, terminalId: string) => {
  const row = sqlite.prepare(`
    SELECT COALESCE(MAX(cursor), 0) as high_watermark
    FROM tdp_change_logs
    WHERE sandbox_id = ? AND target_terminal_id = ?
  `).get(sandboxId, terminalId) as { high_watermark: number } | undefined
  return (row?.high_watermark ?? 0) + 1
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
}): TdpProjectionEnvelope => ({
  topic: input.topicKey,
  itemKey: buildItemKey(input),
  operation: input.operation ?? 'upsert',
  scopeType: input.scopeType,
  scopeId: input.scopeKey,
  revision: input.revision,
  payload: parseJson(input.payloadJson, {}),
  occurredAt: toIsoTime(input.createdAt ?? input.updatedAt ?? now()),
  sourceReleaseId: input.sourceReleaseId ?? null,
})

const pushToOnlineTerminal = (sandboxId: string, terminalId: string, message: TdpServerMessage) => {
  const sessions = listOnlineSessionsByTerminalId(sandboxId, terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    session.socket.send(JSON.stringify(message))
  }
}

const BATCH_WINDOW_MS = 120

const queueProjectionChangeToOnlineTerminal = (terminalId: string, input: {
  sandboxId: string
  change: TdpProjectionEnvelope
  cursor: number
}) => {
  const sessions = listOnlineSessionsByTerminalId(input.sandboxId, terminalId)
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
  }
}

const flushProjectionQueueToOnlineTerminal = (sandboxId: string, terminalId: string) => {
  const sessions = listOnlineSessionsByTerminalId(sandboxId, terminalId)
  for (const session of sessions) {
    if (session.socket.readyState !== 1) continue
    const batch = session.batchQueue ?? []
    session.batchQueue = []
    if (batch.length === 0) continue
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
    session.socket.send(JSON.stringify({
      type: 'PROJECTION_BATCH',
      eventId: createId('batch'),
      timestamp: now(),
      data: {
        changes: batch,
        nextCursor: session.lastDeliveredRevision ?? 0,
      },
    } satisfies TdpServerMessage))
  }
}

const pushProjectionChangeToOnlineTerminal = (terminalId: string, input: {
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
    const highWatermark = getHighWatermarkForTerminal(sandboxId, item.terminalId)
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

export const connectSession = (input: { sandboxId: string; terminalId: string; clientVersion: string; protocolVersion: string }) => {
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
    schema: parseJson(item.schemaJson, {}),
  }))
}

export const listProjections = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(projectionsTable).where(eq(projectionsTable.sandboxId, sandboxId)).orderBy(desc(projectionsTable.updatedAt)).all().map((item) => ({
    ...item,
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

    db.insert(changeLogsTable).values({
      changeId: createId('change'),
      sandboxId,
      cursor,
      topicKey: 'tcp.task.release',
      operation: 'upsert',
      scopeType: 'TERMINAL',
      scopeKey: instance.terminal_id,
      itemKey: instance.instance_id,
      targetTerminalId: instance.terminal_id,
      revision,
      payloadJson: snapshotPayload,
      sourceReleaseId: releaseId,
      createdAt: timestamp,
    }).run()
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
    const payload = {
      ...basePayload,
      instanceId: instance.instance_id,
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

    const sessions = listOnlineSessionsByTerminalId(sandboxId, instance.terminal_id)
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

export const getTerminalSnapshot = (sandboxId: string, terminalId: string) => {
  return getTerminalSnapshotEnvelope(sandboxId, terminalId)
}

export const getTerminalSnapshotEnvelope = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  const rows = sqlite.prepare(
    'SELECT DISTINCT p.topic_key, p.scope_key, p.scope_type, p.item_key, p.revision, p.payload_json, p.updated_at FROM tdp_projections p JOIN tdp_change_logs c ON c.sandbox_id = p.sandbox_id AND c.topic_key = p.topic_key AND c.scope_type = p.scope_type AND c.scope_key = p.scope_key AND c.item_key = p.item_key AND c.revision = p.revision WHERE p.sandbox_id = ? AND c.target_terminal_id = ? ORDER BY p.updated_at DESC'
  ).all(sandboxId, terminalId) as Array<{ topic_key: string; scope_key: string; scope_type: string; item_key: string; revision: number; payload_json: string; updated_at: number }>

  return rows.map((item) => toProjectionEnvelope({
    topicKey: item.topic_key,
    scopeKey: item.scope_key,
    itemKey: item.item_key,
    scopeType: item.scope_type,
    revision: item.revision,
    payloadJson: item.payload_json,
    updatedAt: item.updated_at,
  }))
}

export const getTerminalChanges = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  const rows = sqlite.prepare(
    'SELECT change_id, cursor, topic_key, operation, item_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(sandboxId, terminalId) as Array<{ change_id: string; cursor: number; topic_key: string; operation: "upsert" | "delete"; item_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

  return rows.map((item) => ({
    changeId: item.change_id,
    cursor: item.cursor,
    topicKey: item.topic_key,
    operation: item.operation,
    itemKey: item.item_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    sourceReleaseId: item.source_release_id,
    createdAt: item.created_at,
  }))
}

export const getTerminalChangesSince = (sandboxId: string, terminalId: string, cursor: number, limit = 100) => {
  assertSandboxUsable(sandboxId)
  const rows = sqlite.prepare(
    'SELECT change_id, cursor, topic_key, operation, scope_type, scope_key, item_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ? AND cursor > ? ORDER BY cursor ASC LIMIT ?'
  ).all(sandboxId, terminalId, cursor, limit) as Array<{ change_id: string; cursor: number; topic_key: string; operation: "upsert" | "delete"; scope_type: string; scope_key: string; item_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

  return rows.map((item) => ({
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
      sourceReleaseId: item.source_release_id,
    }),
  }))
}

export const getHighWatermarkForTerminal = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  const row = sqlite.prepare(
    'SELECT COALESCE(MAX(cursor), 0) as high_watermark FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ?'
  ).get(sandboxId, terminalId) as { high_watermark: number } | undefined
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
    targetTerminalIds?: string[]
  }>
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const queuedByTerminal = new Map<string, Array<{cursor: number; change: TdpProjectionEnvelope}>>()

  const items = input.projections.map(item => {
    const scopeType = item.scopeType ?? 'TERMINAL'
    const payloadJson = JSON.stringify(item.payload)
    const operation = item.operation ?? 'upsert'
    const itemKey = buildItemKey({
      topicKey: item.topicKey,
      scopeKey: item.scopeKey,
      payloadJson,
      sourceReleaseId: item.sourceReleaseId ?? null,
      itemKey: item.itemKey ?? null,
    })
    const existingProjection = sqlite.prepare(
      'SELECT projection_id, revision FROM tdp_projections WHERE sandbox_id = ? AND topic_key = ? AND scope_type = ? AND scope_key = ? AND item_key = ? LIMIT 1'
    ).get(sandboxId, item.topicKey, scopeType, item.scopeKey, itemKey) as { projection_id: string; revision: number } | undefined
    const revision = (existingProjection?.revision ?? 0) + 1

    if (operation === 'delete') {
      if (existingProjection) {
        sqlite.prepare('DELETE FROM tdp_projections WHERE projection_id = ?')
          .run(existingProjection.projection_id)
      }
    } else if (existingProjection) {
      sqlite.prepare('UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?')
        .run(revision, payloadJson, timestamp, existingProjection.projection_id)
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
        updatedAt: timestamp,
      }).run()
    }

    const targetTerminalIds = item.targetTerminalIds ?? resolveTargetTerminalIds({
      sandboxId,
      scopeType,
      scopeKey: item.scopeKey,
    })

    targetTerminalIds.forEach(terminalId => {
      const cursor = getNextCursorForTerminal(sandboxId, terminalId)
      db.insert(changeLogsTable).values({
        changeId: createId('change'),
        sandboxId,
        cursor,
        topicKey: item.topicKey,
        operation,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
        targetTerminalId: terminalId,
        revision,
        payloadJson,
        sourceReleaseId: item.sourceReleaseId ?? null,
        createdAt: timestamp,
      }).run()
      const change = toProjectionEnvelope({
        topicKey: item.topicKey,
        operation,
        scopeType,
        scopeKey: item.scopeKey,
        itemKey,
        revision,
        payloadJson,
        createdAt: timestamp,
        sourceReleaseId: item.sourceReleaseId ?? null,
      })
      const queue = queuedByTerminal.get(terminalId) ?? []
      queue.push({cursor, change})
      queuedByTerminal.set(terminalId, queue)
      queueProjectionChangeToOnlineTerminal(terminalId, { sandboxId, cursor, change })
    })

    return {
      topicKey: item.topicKey,
      operation,
      scopeType,
      scopeKey: item.scopeKey,
      itemKey,
      revision,
      targetTerminalIds,
    }
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
  targetTerminalIds: string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const payloadJson = JSON.stringify(input.payload)
  const targetTerminalIds = Array.from(new Set(input.targetTerminalIds.filter(terminalId => terminalId.trim().length > 0)))
  const queuedByTerminal = new Map<string, Array<{cursor: number; change: TdpProjectionEnvelope}>>()

  targetTerminalIds.forEach(terminalId => {
    const cursor = getNextCursorForTerminal(sandboxId, terminalId)
    db.insert(changeLogsTable).values({
      changeId: createId('change'),
      sandboxId,
      cursor,
      topicKey: input.topicKey,
      operation: 'upsert',
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      itemKey: input.itemKey,
      targetTerminalId: terminalId,
      revision: input.revision,
      payloadJson,
      sourceReleaseId: input.sourceReleaseId ?? null,
      createdAt: timestamp,
    }).run()
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
