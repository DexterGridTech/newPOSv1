import { and, desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { changeLogsTable, projectionsTable, sessionsTable, taskInstancesTable, topicsTable } from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'

export const listSessions = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(sessionsTable).where(eq(sessionsTable.sandboxId, sandboxId)).orderBy(desc(sessionsTable.connectedAt)).all()
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
  }).run()
  return { sessionId }
}

export const heartbeatSession = (sessionId: string) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, sessionId))
    .run()
  return { sessionId, lastHeartbeatAt: timestamp }
}

export const disconnectSession = (sessionId: string) => {
  const timestamp = now()
  db.update(sessionsTable)
    .set({ status: 'DISCONNECTED', disconnectedAt: timestamp, lastHeartbeatAt: timestamp })
    .where(eq(sessionsTable.sessionId, sessionId))
    .run()
  return { sessionId, disconnectedAt: timestamp }
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

export const dispatchTaskReleaseToDataPlane = (releaseId: string) => {
  const sandboxId = getCurrentSandboxId()
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
      topicKey: 'tcp.task.release',
      scopeType: 'TERMINAL',
      scopeKey: instance.terminal_id,
      revision,
      payloadJson: snapshotPayload,
      sourceReleaseId: releaseId,
      createdAt: timestamp,
    }).run()

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

export const getTerminalSnapshot = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare(
    'SELECT topic_key, scope_key, revision, payload_json, updated_at FROM tdp_projections WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ? ORDER BY updated_at DESC'
  ).all(sandboxId, 'TERMINAL', terminalId) as Array<{ topic_key: string; scope_key: string; revision: number; payload_json: string; updated_at: number }>

  return rows.map((item) => ({
    topicKey: item.topic_key,
    scopeKey: item.scope_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    updatedAt: item.updated_at,
  }))
}

export const getTerminalChanges = (terminalId: string) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare(
    'SELECT change_id, topic_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE sandbox_id = ? AND scope_type = ? AND scope_key = ? ORDER BY created_at DESC LIMIT 50'
  ).all(sandboxId, 'TERMINAL', terminalId) as Array<{ change_id: string; topic_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

  return rows.map((item) => ({
    changeId: item.change_id,
    topicKey: item.topic_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    sourceReleaseId: item.source_release_id,
    createdAt: item.created_at,
  }))
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
    topicKey: input.topicKey,
    scopeType,
    scopeKey: input.scopeKey,
    revision,
    payloadJson,
    sourceReleaseId: input.sourceReleaseId ?? null,
    createdAt: timestamp,
  }).run()

  return { topicKey: input.topicKey, scopeType, scopeKey: input.scopeKey, revision }
}
