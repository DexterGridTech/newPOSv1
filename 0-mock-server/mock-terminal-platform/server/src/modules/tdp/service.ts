import { desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { changeLogsTable, projectionsTable, sessionsTable, taskInstancesTable, taskReleasesTable, topicsTable } from '../../database/schema.js'
import { DEFAULT_SANDBOX_ID } from '../../shared/constants.js'
import { createId, now, parseJson } from '../../shared/utils.js'

export const listSessions = () =>
  db.select().from(sessionsTable).orderBy(desc(sessionsTable.connectedAt)).all()

export const connectSession = (input: { terminalId: string; clientVersion: string; protocolVersion: string }) => {
  const sessionId = createId('session')
  const timestamp = now()

  db.insert(sessionsTable).values({
    sessionId,
    terminalId: input.terminalId,
    sandboxId: DEFAULT_SANDBOX_ID,
    clientVersion: input.clientVersion,
    protocolVersion: input.protocolVersion,
    status: 'CONNECTED',
    connectedAt: timestamp,
    disconnectedAt: null,
    lastHeartbeatAt: timestamp,
  }).run()

  sqlite.prepare('UPDATE terminal_instances SET presence_status = ?, last_seen_at = ?, updated_at = ? WHERE terminal_id = ?')
    .run('ONLINE', timestamp, timestamp, input.terminalId)

  return { sessionId }
}

export const heartbeatSession = (sessionId: string) => {
  const timestamp = now()
  sqlite.prepare('UPDATE tdp_sessions SET last_heartbeat_at = ? WHERE session_id = ?').run(timestamp, sessionId)
  return { sessionId, lastHeartbeatAt: timestamp }
}

export const disconnectSession = (sessionId: string) => {
  const timestamp = now()
  const session = sqlite.prepare('SELECT terminal_id FROM tdp_sessions WHERE session_id = ?').get(sessionId) as { terminal_id: string } | undefined
  sqlite.prepare('UPDATE tdp_sessions SET status = ?, disconnected_at = ? WHERE session_id = ?').run('DISCONNECTED', timestamp, sessionId)
  if (session) {
    sqlite.prepare('UPDATE terminal_instances SET presence_status = ?, updated_at = ? WHERE terminal_id = ?').run('OFFLINE', timestamp, session.terminal_id)
  }
  return { sessionId, disconnectedAt: timestamp }
}

export const listTopics = () =>
  db.select().from(topicsTable).orderBy(desc(topicsTable.updatedAt)).all().map((item) => ({
    ...item,
    schema: parseJson(item.schemaJson, {}),
  }))

export const listProjections = () =>
  db.select().from(projectionsTable).orderBy(desc(projectionsTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))

export const listChangeLogs = () =>
  db.select().from(changeLogsTable).orderBy(desc(changeLogsTable.createdAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
  }))

export const dispatchTaskReleaseToDataPlane = (releaseId: string) => {
  const release = db.select().from(taskReleasesTable).where(eq(taskReleasesTable.releaseId, releaseId)).get()
  if (!release) {
    throw new Error('未找到 release')
  }

  const instances = db.select().from(taskInstancesTable).where(eq(taskInstancesTable.releaseId, releaseId)).all()
  const timestamp = now()
  const payload = parseJson<Record<string, unknown>>(release.payloadJson, {})

  for (const instance of instances) {
    const existingProjection = sqlite.prepare(
      'SELECT projection_id, revision FROM tdp_projections WHERE topic_key = ? AND scope_type = ? AND scope_key = ? LIMIT 1'
    ).get('tcp.task.release', 'TERMINAL', instance.terminalId) as { projection_id: string; revision: number } | undefined

    const revision = (existingProjection?.revision ?? 0) + 1
    const snapshotPayload = JSON.stringify({
      releaseId,
      instanceId: instance.instanceId,
      taskType: release.taskType,
      payload,
      deliveryStatus: 'PENDING',
      updatedAt: timestamp,
    })

    if (existingProjection) {
      sqlite.prepare(
        'UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?'
      ).run(revision, snapshotPayload, timestamp, existingProjection.projection_id)
    } else {
      db.insert(projectionsTable).values({
        projectionId: createId('projection'),
        sandboxId: DEFAULT_SANDBOX_ID,
        topicKey: 'tcp.task.release',
        scopeType: 'TERMINAL',
        scopeKey: instance.terminalId,
        revision,
        payloadJson: snapshotPayload,
        updatedAt: timestamp,
      }).run()
    }

    db.insert(changeLogsTable).values({
      changeId: createId('change'),
      sandboxId: DEFAULT_SANDBOX_ID,
      topicKey: 'tcp.task.release',
      scopeType: 'TERMINAL',
      scopeKey: instance.terminalId,
      revision,
      payloadJson: snapshotPayload,
      sourceReleaseId: releaseId,
      createdAt: timestamp,
    }).run()
  }

  return {
    dispatchId: createId('dispatch'),
    releaseId,
    totalInstances: instances.length,
  }
}

export const getTerminalSnapshot = (terminalId: string) => {
  const rows = sqlite.prepare(
    'SELECT topic_key, scope_key, revision, payload_json, updated_at FROM tdp_projections WHERE scope_type = ? AND scope_key = ? ORDER BY updated_at DESC'
  ).all('TERMINAL', terminalId) as Array<{ topic_key: string; scope_key: string; revision: number; payload_json: string; updated_at: number }>

  return rows.map((item) => ({
    topicKey: item.topic_key,
    scopeKey: item.scope_key,
    revision: item.revision,
    payload: parseJson(item.payload_json, {}),
    updatedAt: item.updated_at,
  }))
}

export const getTerminalChanges = (terminalId: string) => {
  const rows = sqlite.prepare(
    'SELECT change_id, topic_key, revision, payload_json, source_release_id, created_at FROM tdp_change_logs WHERE scope_type = ? AND scope_key = ? ORDER BY created_at DESC LIMIT 50'
  ).all('TERMINAL', terminalId) as Array<{ change_id: string; topic_key: string; revision: number; payload_json: string; source_release_id: string | null; created_at: number }>

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
  const timestamp = now()
  const topicId = createId('topic')
  db.insert(topicsTable).values({
    topicId,
    sandboxId: DEFAULT_SANDBOX_ID,
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
  const topicScopes = sqlite.prepare(
    'SELECT key as topic_key, scope_type, COUNT(*) as topic_count FROM tdp_topics GROUP BY key, scope_type ORDER BY key ASC'
  ).all() as Array<{ topic_key: string; scope_type: string; topic_count: number }>
  const projectionScopes = sqlite.prepare(
    'SELECT topic_key, scope_type, scope_key, MAX(revision) as revision, MAX(updated_at) as updated_at FROM tdp_projections GROUP BY topic_key, scope_type, scope_key ORDER BY updated_at DESC'
  ).all() as Array<{ topic_key: string; scope_type: string; scope_key: string; revision: number; updated_at: number }>

  return { topicScopes, projectionScopes }
}

export const upsertProjection = (input: {
  topicKey: string
  scopeType?: string
  scopeKey: string
  payload: Record<string, unknown>
  sourceReleaseId?: string
}) => {
  const timestamp = now()
  const scopeType = input.scopeType ?? 'TERMINAL'
  const existingProjection = sqlite.prepare(
    'SELECT projection_id, revision FROM tdp_projections WHERE topic_key = ? AND scope_type = ? AND scope_key = ? LIMIT 1'
  ).get(input.topicKey, scopeType, input.scopeKey) as { projection_id: string; revision: number } | undefined
  const revision = (existingProjection?.revision ?? 0) + 1
  const payloadJson = JSON.stringify(input.payload)

  if (existingProjection) {
    sqlite.prepare('UPDATE tdp_projections SET revision = ?, payload_json = ?, updated_at = ? WHERE projection_id = ?')
      .run(revision, payloadJson, timestamp, existingProjection.projection_id)
  } else {
    db.insert(projectionsTable).values({
      projectionId: createId('projection'),
      sandboxId: DEFAULT_SANDBOX_ID,
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
    sandboxId: DEFAULT_SANDBOX_ID,
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
