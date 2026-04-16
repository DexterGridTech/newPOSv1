import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  activationCodesTable,
  credentialsTable,
  taskInstancesTable,
  taskReleasesTable,
  storesTable,
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
} from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import type { DeliveryStatus, ReleaseStatus, TaskType } from '../../shared/types.js'
import { getCurrentSandboxId } from '../sandbox/service.js'

export const listTerminals = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).orderBy(desc(terminalsTable.updatedAt)).all().map((item) => ({
    ...item,
    deviceInfo: parseJson(item.deviceInfoJson, {}),
  }))
}

export const listProfiles = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sandboxId)).orderBy(desc(terminalProfilesTable.updatedAt)).all().map((item) => ({
    ...item,
    capabilities: parseJson(item.capabilitiesJson, {}),
  }))
}

export const listTemplates = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).orderBy(desc(terminalTemplatesTable.updatedAt)).all().map((item) => ({
    ...item,
    presetConfig: parseJson(item.presetConfigJson, {}),
    presetTags: parseJson(item.presetTagsJson, []),
  }))
}

export const listActivationCodes = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(activationCodesTable).where(eq(activationCodesTable.sandboxId, sandboxId)).orderBy(desc(activationCodesTable.createdAt)).all()
}

export const activateTerminal = (input: {
  activationCode: string
  deviceFingerprint: string
  deviceInfo: Record<string, unknown>
}) => {
  const sandboxId = getCurrentSandboxId()
  const activation = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.code, input.activationCode), eq(activationCodesTable.sandboxId, sandboxId))).get()
  if (!activation || activation.status !== 'AVAILABLE') {
    throw new Error('激活码不可用')
  }

  const store = db.select().from(storesTable).where(and(eq(storesTable.storeId, activation.storeId), eq(storesTable.sandboxId, sandboxId))).get()
  if (!store) {
    throw new Error('激活码关联门店不存在')
  }

  const terminalId = createId('terminal')
  const timestamp = now()

  db.insert(terminalsTable).values({
    terminalId,
    sandboxId: activation.sandboxId,
    platformId: activation.platformId,
    tenantId: activation.tenantId,
    brandId: activation.brandId,
    projectId: activation.projectId,
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
    .where(and(eq(activationCodesTable.code, input.activationCode), eq(activationCodesTable.sandboxId, sandboxId)))
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
    refreshExpiresIn: 30 * 24 * 3600,
    binding: {
      platformId: activation.platformId,
      tenantId: activation.tenantId,
      brandId: activation.brandId,
      projectId: activation.projectId,
      storeId: activation.storeId,
      profileId: activation.profileId,
      templateId: activation.templateId ?? 'terminal-template-retail-default',
    },
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

export const deactivateTerminal = (input: {
  terminalId: string
  reason?: string
}) => {
  const sandboxId = getCurrentSandboxId()
  const terminal = db.select().from(terminalsTable).where(and(eq(terminalsTable.terminalId, input.terminalId), eq(terminalsTable.sandboxId, sandboxId))).get()
  if (!terminal) {
    throw new Error('终端不存在')
  }

  const timestamp = now()

  db.update(terminalsTable)
    .set({
      lifecycleStatus: 'DEACTIVATED',
      presenceStatus: 'OFFLINE',
      healthStatus: 'UNKNOWN',
      updatedAt: timestamp,
    })
    .where(and(eq(terminalsTable.terminalId, input.terminalId), eq(terminalsTable.sandboxId, sandboxId)))
    .run()

  db.update(credentialsTable)
    .set({ revokedAt: timestamp })
    .where(eq(credentialsTable.terminalId, input.terminalId))
    .run()

  return {
    terminalId: input.terminalId,
    status: 'DEACTIVATED',
    deactivatedAt: timestamp,
    reason: input.reason,
  }
}

export const listTaskReleases = () => {
  const sandboxId = getCurrentSandboxId()
  return db.select().from(taskReleasesTable).where(eq(taskReleasesTable.sandboxId, sandboxId)).orderBy(desc(taskReleasesTable.updatedAt)).all().map((item) => ({
    ...item,
    targetSelector: parseJson(item.targetSelectorJson, {}),
    payload: parseJson(item.payloadJson, {}),
  }))
}

export const listTaskInstances = () => {
  const sandboxId = getCurrentSandboxId()
  const releases = db.select({ releaseId: taskReleasesTable.releaseId }).from(taskReleasesTable).where(eq(taskReleasesTable.sandboxId, sandboxId)).all()
  const releaseIds = releases.map((item) => item.releaseId)
  if (releaseIds.length === 0) return []
  return db.select().from(taskInstancesTable).where(inArray(taskInstancesTable.releaseId, releaseIds)).orderBy(desc(taskInstancesTable.updatedAt)).all().map((item) => ({
    ...item,
    payload: parseJson(item.payloadJson, {}),
    result: parseJson(item.resultJson, null),
    error: parseJson(item.errorJson, null),
  }))
}

export const createTaskRelease = (input: {
  title: string
  taskType: TaskType
  sourceType: string
  sourceId: string
  priority: number
  targetTerminalIds: string[]
  payload: Record<string, unknown>
}) => {
  const sandboxId = getCurrentSandboxId()
  const timestamp = now()
  const releaseId = createId('release')

  db.insert(taskReleasesTable).values({
    releaseId,
    sandboxId,
    taskType: input.taskType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    targetSelectorJson: JSON.stringify({ type: 'TERMINALS', terminalIds: input.targetTerminalIds }),
    payloadJson: JSON.stringify(input.payload),
    priority: input.priority,
    status: 'APPROVED',
    approvalStatus: 'APPROVED',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return { releaseId }
}

export const createTaskInstancesForRelease = (releaseId: string) => {
  const sandboxId = getCurrentSandboxId()
  const release = db.select().from(taskReleasesTable).where(and(eq(taskReleasesTable.releaseId, releaseId), eq(taskReleasesTable.sandboxId, sandboxId))).get()
  if (!release) {
    throw new Error('任务发布单不存在')
  }

  const targetSelector = parseJson<{ terminalIds?: string[] }>(release.targetSelectorJson, {})
  const targetTerminalIds = targetSelector.terminalIds ?? []
  const terminals = targetTerminalIds.length
    ? db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), inArray(terminalsTable.terminalId, targetTerminalIds))).all()
    : []

  const timestamp = now()
  for (const terminal of terminals) {
    db.insert(taskInstancesTable).values({
      instanceId: createId('instance'),
      releaseId,
      terminalId: terminal.terminalId,
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

  db.update(taskReleasesTable).set({ status: 'DISPATCHING', updatedAt: timestamp }).where(eq(taskReleasesTable.releaseId, releaseId)).run()

  return {
    releaseId,
    totalInstances: terminals.length,
  }
}

export const updateDeliveryStatus = (instanceId: string, deliveryStatus: DeliveryStatus, error?: unknown) => {
  const timestamp = now()
  db.update(taskInstancesTable)
    .set({
      deliveryStatus,
      errorJson: error ? JSON.stringify(error) : null,
      deliveredAt: deliveryStatus === 'DELIVERED' || deliveryStatus === 'ACKED' ? timestamp : null,
      updatedAt: timestamp,
    })
    .where(eq(taskInstancesTable.instanceId, instanceId))
    .run()

  return { instanceId, deliveryStatus }
}

export const reportTaskResult = (instanceId: string, input: { status: ReleaseStatus; result?: unknown; error?: unknown }) => {
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

  return { instanceId, status: input.status }
}

export const getTaskTrace = (instanceId: string) => {
  const instance = sqlite.prepare('SELECT * FROM task_instances WHERE instance_id = ?').get(instanceId) as Record<string, unknown> | undefined
  if (!instance) {
    throw new Error('任务实例不存在')
  }

  const release = sqlite.prepare('SELECT * FROM task_releases WHERE release_id = ?').get(instance.release_id) as Record<string, unknown> | undefined
  const projections = sqlite.prepare('SELECT * FROM tdp_projections WHERE topic_key = ? AND item_key = ? ORDER BY updated_at DESC').all('tcp.task.release', instance.instance_id) as Array<Record<string, unknown>>
  const changes = sqlite.prepare('SELECT * FROM tdp_change_logs WHERE topic_key = ? AND item_key = ? ORDER BY created_at DESC LIMIT 20').all('tcp.task.release', instance.instance_id) as Array<Record<string, unknown>>

  return {
    instance: {
      ...instance,
      instanceId: instance.instance_id,
      releaseId: instance.release_id,
      terminalId: instance.terminal_id,
      taskType: instance.task_type,
      deliveryStatus: instance.delivery_status,
      createdAt: instance.created_at,
      updatedAt: instance.updated_at,
      deliveredAt: instance.delivered_at,
      finishedAt: instance.finished_at,
      payload: parseJson(String(instance.payload_json ?? ''), {}),
      result: parseJson(String(instance.result_json ?? ''), null),
      error: parseJson(String(instance.error_json ?? ''), null),
    },
    release: release
      ? {
          ...release,
          releaseId: release.release_id,
          taskType: release.task_type,
          sourceType: release.source_type,
          sourceId: release.source_id,
          targetSelector: parseJson(String(release.target_selector_json ?? ''), {}),
          createdAt: release.created_at,
          updatedAt: release.updated_at,
          payload: parseJson(String(release.payload_json ?? ''), {}),
        }
      : null,
    dataPlane: {
      projections: projections.map((item) => ({
        ...item,
        projectionId: item.projection_id,
        topicKey: item.topic_key,
        scopeType: item.scope_type,
        scopeKey: item.scope_key,
        itemKey: item.item_key,
        updatedAt: item.updated_at,
        payload: parseJson(String(item.payload_json ?? ''), {}),
      })),
      changes: changes.map((item) => ({
        ...item,
        changeId: item.change_id,
        topicKey: item.topic_key,
        scopeType: item.scope_type,
        scopeKey: item.scope_key,
        itemKey: item.item_key,
        targetTerminalId: item.target_terminal_id,
        sourceReleaseId: item.source_release_id,
        createdAt: item.created_at,
        payload: parseJson(String(item.payload_json ?? ''), {}),
      })),
    },
  }
}

export const batchCreateTerminals = (count: number) => {
  const sandboxId = getCurrentSandboxId()
  const timestamp = now()
  const terminalIds: string[] = []

  const profile = db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sandboxId)).orderBy(desc(terminalProfilesTable.updatedAt)).get()
  const template = db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).orderBy(desc(terminalTemplatesTable.updatedAt)).get()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).orderBy(desc(storesTable.updatedAt)).all()
  if (!profile || !template) {
    throw new Error('当前沙箱缺少终端机型或终端模板，无法批量造终端')
  }
  if (stores.length === 0) {
    throw new Error('当前沙箱缺少门店数据，无法批量造终端')
  }

  for (let index = 0; index < count; index += 1) {
    const terminalId = createId('terminal')
    const store = stores[index % stores.length]
    terminalIds.push(terminalId)
    db.insert(terminalsTable).values({
      terminalId,
      sandboxId,
      platformId: store.platformId,
      tenantId: store.tenantId,
      brandId: store.brandId,
      projectId: store.projectId,
      storeId: store.storeId,
      profileId: profile.profileId,
      templateId: template.templateId,
      lifecycleStatus: 'ACTIVE',
      presenceStatus: 'ONLINE',
      healthStatus: 'HEALTHY',
      currentAppVersion: '2.3.18',
      currentBundleVersion: 'bundle-2026.04.06',
      currentConfigVersion: 'config-2026.04.06',
      deviceFingerprint: `fp-${terminalId}`,
      deviceInfoJson: JSON.stringify({ model: 'Mock-POS-X1', manufacturer: 'IMPOS2', osVersion: 'Android 14' }),
      sourceMode: 'STANDARD',
      activatedAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  return { count, terminalIds }
}

export const createActivationCodes = (input: {
  count: number
  storeId?: string
  profileId?: string
  templateId?: string
  expiresInDays?: number
}) => {
  const sandboxId = getCurrentSandboxId()
  const timestamp = now()
  const profile = input.profileId
    ? db.select().from(terminalProfilesTable).where(and(eq(terminalProfilesTable.profileId, input.profileId), eq(terminalProfilesTable.sandboxId, sandboxId))).get()
    : db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sandboxId)).orderBy(desc(terminalProfilesTable.updatedAt)).get()
  const template = input.templateId
    ? db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.templateId, input.templateId), eq(terminalTemplatesTable.sandboxId, sandboxId))).get()
    : db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).orderBy(desc(terminalTemplatesTable.updatedAt)).get()
  const store = input.storeId
    ? db.select().from(storesTable).where(and(eq(storesTable.storeId, input.storeId), eq(storesTable.sandboxId, sandboxId))).get()
    : db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).orderBy(desc(storesTable.updatedAt)).get()
  if (!profile) {
    throw new Error('当前沙箱缺少可用 Profile')
  }
  if (!store) {
    throw new Error('门店不存在')
  }

  const codes: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    let code = ''
    do {
      code = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    } while (db.select().from(activationCodesTable).where(and(eq(activationCodesTable.code, code), eq(activationCodesTable.sandboxId, sandboxId))).get())
    codes.push(code)
    db.insert(activationCodesTable).values({
      code,
      sandboxId,
      platformId: store.platformId,
      tenantId: store.tenantId,
      brandId: store.brandId,
      projectId: store.projectId,
      storeId: store.storeId,
      profileId: profile.profileId,
      templateId: template?.templateId ?? null,
      status: 'AVAILABLE',
      usedBy: null,
      usedAt: null,
      expiresAt: timestamp + (input.expiresInDays ?? 7) * 24 * 3600_000,
      createdAt: timestamp,
    }).run()
  }

  return { count: input.count, codes }
}

export const forceTerminalStatus = (terminalId: string, input: { healthStatus?: string; presenceStatus?: string; lifecycleStatus?: string }) => {
  const sandboxId = getCurrentSandboxId()
  const terminal = db.select().from(terminalsTable).where(and(eq(terminalsTable.terminalId, terminalId), eq(terminalsTable.sandboxId, sandboxId))).get()
  if (!terminal) {
    throw new Error('终端不存在')
  }

  const timestamp = now()
  db.update(terminalsTable)
    .set({
      healthStatus: input.healthStatus ?? terminal.healthStatus,
      presenceStatus: input.presenceStatus ?? terminal.presenceStatus,
      lifecycleStatus: input.lifecycleStatus ?? terminal.lifecycleStatus,
      updatedAt: timestamp,
    })
    .where(eq(terminalsTable.terminalId, terminalId))
    .run()

  return { terminalId, updatedAt: timestamp }
}
