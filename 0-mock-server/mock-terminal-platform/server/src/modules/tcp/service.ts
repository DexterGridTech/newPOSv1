import { eq, desc } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  activationCodesTable,
  credentialsTable,
  taskInstancesTable,
  taskReleasesTable,
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
} from '../../database/schema.js'
import { DEFAULT_SANDBOX_ID } from '../../shared/constants.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import type { DeliveryStatus, ReleaseStatus, TaskType } from '../../shared/types.js'

export const listTerminals = () =>
  db.select().from(terminalsTable).orderBy(desc(terminalsTable.updatedAt)).all().map((item) => ({
    ...item,
    deviceInfo: parseJson(item.deviceInfoJson, {}),
  }))

export const listProfiles = () =>
  db.select().from(terminalProfilesTable).orderBy(desc(terminalProfilesTable.updatedAt)).all().map((item) => ({
    ...item,
    capabilities: parseJson(item.capabilitiesJson, {}),
  }))

export const listTemplates = () =>
  db.select().from(terminalTemplatesTable).orderBy(desc(terminalTemplatesTable.updatedAt)).all().map((item) => ({
    ...item,
    presetConfig: parseJson(item.presetConfigJson, {}),
    presetTags: parseJson(item.presetTagsJson, []),
  }))

export const listActivationCodes = () =>
  db.select().from(activationCodesTable).orderBy(desc(activationCodesTable.createdAt)).all()

export const activateTerminal = (input: {
  activationCode: string
  deviceFingerprint: string
  deviceInfo: Record<string, unknown>
}) => {
  const activation = db.select().from(activationCodesTable).where(eq(activationCodesTable.code, input.activationCode)).get()
  if (!activation || activation.status !== 'AVAILABLE') {
    throw new Error('激活码不可用')
  }

  const terminalId = createId('terminal')
  const timestamp = now()

  db.insert(terminalsTable).values({
    terminalId,
    sandboxId: activation.sandboxId,
    projectId: 'mixc-retail',
    tenantId: activation.tenantId,
    brandId: activation.brandId,
    storeId: activation.storeId,
    profileId: activation.profileId,
    templateId: activation.templateId ?? 'terminal-template-retail-default',
    lifecycleStatus: 'ACTIVE',
    presenceStatus: 'ONLINE',
    healthStatus: 'HEALTHY',
    currentAppVersion: '2.3.18',
    currentBundleVersion: 'bundle-2026.04.06',
    currentConfigVersion: 'config-2026.04.01',
    deviceFingerprint: input.deviceFingerprint,
    deviceInfoJson: JSON.stringify(input.deviceInfo),
    sourceMode: 'STANDARD',
    activatedAt: timestamp,
    lastSeenAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  db.update(activationCodesTable)
    .set({ status: 'USED', usedBy: terminalId, usedAt: timestamp })
    .where(eq(activationCodesTable.code, input.activationCode))
    .run()

  const token = createId('token')
  const refreshToken = createId('refresh')

  db.insert(credentialsTable).values({
    credentialId: createId('cred'),
    terminalId,
    token,
    refreshToken,
    issuedAt: timestamp,
    expiresAt: timestamp + 2 * 3600_000,
    refreshExpiresAt: timestamp + 30 * 24 * 3600_000,
    revokedAt: null,
  }).run()

  return {
    terminalId,
    token,
    refreshToken,
    expiresIn: 7200,
  }
}

export const refreshTerminalToken = (refreshToken: string) => {
  const credential = sqlite
    .prepare('SELECT * FROM terminal_credentials WHERE refresh_token = ? AND revoked_at IS NULL ORDER BY issued_at DESC LIMIT 1')
    .get(refreshToken) as
    | { terminal_id: string; refresh_token: string }
    | undefined

  if (!credential) {
    throw new Error('refreshToken 无效')
  }

  const token = createId('token')
  const timestamp = now()

  sqlite
    .prepare('UPDATE terminal_credentials SET token = ?, issued_at = ?, expires_at = ? WHERE refresh_token = ?')
    .run(token, timestamp, timestamp + 2 * 3600_000, refreshToken)

  return {
    token,
    expiresIn: 7200,
  }
}

export const listTaskReleases = () =>
  db.select().from(taskReleasesTable).orderBy(desc(taskReleasesTable.updatedAt)).all().map((item) => ({
    ...item,
    targetSelector: parseJson(item.targetSelectorJson, {}),
    payload: parseJson(item.payloadJson, {}),
  }))

export const listTaskInstances = () =>
  db.select().from(taskInstancesTable).orderBy(desc(taskInstancesTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
    result: parseJson(item.resultJson, null),
    error: parseJson(item.errorJson, null),
  }))

export const createTaskRelease = (input: {
  title: string
  taskType: TaskType
  sourceType: string
  sourceId: string
  priority: number
  targetTerminalIds: string[]
  payload: Record<string, unknown>
}) => {
  const timestamp = now()
  const releaseId = createId('release')

  db.insert(taskReleasesTable).values({
    releaseId,
    sandboxId: DEFAULT_SANDBOX_ID,
    taskType: input.taskType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    targetSelectorJson: JSON.stringify({ type: 'TERMINALS', value: input.targetTerminalIds }),
    payloadJson: JSON.stringify(input.payload),
    priority: input.priority,
    status: 'DISPATCHING',
    approvalStatus: 'APPROVED',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return { releaseId }
}

export const createTaskInstancesForRelease = (releaseId: string) => {
  const release = db.select().from(taskReleasesTable).where(eq(taskReleasesTable.releaseId, releaseId)).get()
  if (!release) {
    throw new Error('任务发布单不存在')
  }

  const selector = parseJson<{ value?: string[] }>(release.targetSelectorJson, {})
  const terminalIds = selector.value ?? []
  const timestamp = now()

  for (const terminalId of terminalIds) {
    db.insert(taskInstancesTable).values({
      instanceId: createId('instance'),
      releaseId,
      terminalId,
      taskType: release.taskType,
      status: 'PENDING',
      deliveryStatus: 'PENDING',
      payloadJson: release.payloadJson,
      resultJson: null,
      errorJson: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deliveredAt: null,
      finishedAt: null,
    }).run()
  }

  db.update(taskReleasesTable).set({ status: 'IN_PROGRESS', updatedAt: timestamp }).where(eq(taskReleasesTable.releaseId, releaseId)).run()

  return {
    releaseId,
    acceptedTerminals: terminalIds,
    rejectedTerminals: [],
  }
}

export const updateDeliveryStatus = (instanceId: string, deliveryStatus: DeliveryStatus, error?: Record<string, unknown>) => {
  const timestamp = now()
  const nextStatus: ReleaseStatus | undefined = undefined

  db.update(taskInstancesTable)
    .set({
      deliveryStatus,
      status: deliveryStatus === 'DELIVERED' ? 'DELIVERED' : deliveryStatus,
      errorJson: error ? JSON.stringify(error) : null,
      deliveredAt: deliveryStatus === 'DELIVERED' ? timestamp : null,
      updatedAt: timestamp,
    })
    .where(eq(taskInstancesTable.instanceId, instanceId))
    .run()

  return { instanceId, deliveryStatus, updatedAt: timestamp, nextStatus }
}

export const reportTaskResult = (instanceId: string, input: { status: string; result?: unknown; error?: unknown }) => {
  const timestamp = now()

  db.update(taskInstancesTable)
    .set({
      status: input.status,
      resultJson: input.result ? JSON.stringify(input.result) : null,
      errorJson: input.error ? JSON.stringify(input.error) : null,
      finishedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(taskInstancesTable.instanceId, instanceId))
    .run()

  const row = sqlite
    .prepare('SELECT release_id FROM task_instances WHERE instance_id = ?')
    .get(instanceId) as { release_id: string } | undefined

  if (row) {
    const stats = sqlite
      .prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('SUCCESS', 'FAILED') THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed FROM task_instances WHERE release_id = ?")
      .get(row.release_id) as { total: number; done: number; failed: number }

    const status = stats.done === stats.total ? (stats.failed > 0 ? 'FAILED' : 'COMPLETED') : 'IN_PROGRESS'
    db.update(taskReleasesTable).set({ status, updatedAt: timestamp }).where(eq(taskReleasesTable.releaseId, row.release_id)).run()
  }

  return { instanceId, status: input.status }
}

export const batchCreateTerminals = (count: number) => {
  const timestamp = now()
  const createdIds: string[] = []

  for (let index = 0; index < count; index += 1) {
    const terminalId = createId('mockTerminal')
    createdIds.push(terminalId)
    db.insert(terminalsTable).values({
      terminalId,
      sandboxId: DEFAULT_SANDBOX_ID,
      projectId: 'mixc-retail',
      tenantId: 'tenant-mixc',
      brandId: 'brand-mixc',
      storeId: `store-mock-${(index % 3) + 1}`,
      profileId: 'profile-rn84-retail',
      templateId: 'terminal-template-retail-default',
      lifecycleStatus: 'ACTIVE',
      presenceStatus: index % 2 === 0 ? 'ONLINE' : 'OFFLINE',
      healthStatus: 'HEALTHY',
      currentAppVersion: '2.3.18',
      currentBundleVersion: 'bundle-2026.04.06',
      currentConfigVersion: 'config-2026.04.01',
      deviceFingerprint: `fp-${terminalId}`,
      deviceInfoJson: JSON.stringify({ model: 'Mock-POS', osVersion: 'Android 14', manufacturer: 'IMPOS2' }),
      sourceMode: 'MOCK_OVERRIDE',
      activatedAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  return { count, terminalIds: createdIds }
}

export const forceTerminalStatus = (terminalId: string, input: { lifecycleStatus?: string; presenceStatus?: string; healthStatus?: string }) => {
  const timestamp = now()
  sqlite.prepare(`
    UPDATE terminal_instances
    SET lifecycle_status = COALESCE(?, lifecycle_status),
        presence_status = COALESCE(?, presence_status),
        health_status = COALESCE(?, health_status),
        source_mode = 'MOCK_OVERRIDE',
        updated_at = ?
    WHERE terminal_id = ?
  `).run(input.lifecycleStatus ?? null, input.presenceStatus ?? null, input.healthStatus ?? null, timestamp, terminalId)

  return { terminalId, updatedAt: timestamp }
}


export const createActivationCodes = (input: {
  count?: number
  tenantId?: string
  brandId?: string
  storeId?: string
  profileId?: string
  templateId?: string
  expiresInDays?: number
}) => {
  const timestamp = now()
  const count = Math.max(1, Math.min(Number(input.count ?? 5), 100))
  const codes: string[] = []

  for (let index = 0; index < count; index += 1) {
    const code = `ACT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}-${index}`
    codes.push(code)
    db.insert(activationCodesTable).values({
      code,
      sandboxId: DEFAULT_SANDBOX_ID,
      tenantId: input.tenantId ?? 'tenant-mixc',
      brandId: input.brandId ?? 'brand-mixc',
      storeId: input.storeId ?? 'store-dev-lab',
      profileId: input.profileId ?? 'profile-rn84-retail',
      templateId: input.templateId ?? 'terminal-template-retail-default',
      status: 'AVAILABLE',
      usedBy: null,
      usedAt: null,
      expiresAt: timestamp + (input.expiresInDays ?? 7) * 24 * 3600_000,
      createdAt: timestamp,
    }).run()
  }

  return { count, codes }
}

export const getTaskTrace = (instanceId: string) => {
  const instance = sqlite.prepare('SELECT * FROM task_instances WHERE instance_id = ?').get(instanceId) as Record<string, unknown> | undefined
  if (!instance) {
    throw new Error('任务实例不存在')
  }

  const release = sqlite.prepare('SELECT * FROM task_releases WHERE release_id = ?').get(instance.release_id) as Record<string, unknown> | undefined
  const projections = sqlite.prepare(
    'SELECT * FROM tdp_projections WHERE topic_key = ? AND scope_type = ? AND scope_key = ? ORDER BY updated_at DESC'
  ).all('tcp.task.release', 'TERMINAL', instance.terminal_id) as Record<string, unknown>[]
  const changes = sqlite.prepare(
    'SELECT * FROM tdp_change_logs WHERE source_release_id = ? AND scope_key = ? ORDER BY created_at DESC'
  ).all(instance.release_id, instance.terminal_id) as Record<string, unknown>[]

  return {
    instance: {
      ...instance,
      payload: parseJson(String(instance.payload_json ?? ''), {}),
      result: parseJson(String(instance.result_json ?? ''), null),
      error: parseJson(String(instance.error_json ?? ''), null),
    },
    release: release
      ? {
          ...release,
          targetSelector: parseJson(String(release.target_selector_json ?? ''), {}),
          payload: parseJson(String(release.payload_json ?? ''), {}),
        }
      : null,
    dataPlane: {
      projections: projections.map((item) => ({ ...item, payload: parseJson(String(item.payload_json ?? ''), {}) })),
      changes: changes.map((item) => ({ ...item, payload: parseJson(String(item.payload_json ?? ''), {}) })),
    },
  }
}
