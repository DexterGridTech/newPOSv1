import { desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  activationCodesTable,
  auditLogsTable,
  brandsTable,
  changeLogsTable,
  faultRulesTable,
  projectsTable,
  projectionsTable,
  runtimeContextTable,
  sandboxesTable,
  sessionsTable,
  taskInstancesTable,
  taskReleasesTable,
  tenantsTable,
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
  storesTable,
  topicsTable,
} from '../../database/schema.js'
import { DEFAULT_SANDBOX_ID } from '../../shared/constants.js'
import { paginateItems, type PaginationQuery } from '../../shared/pagination.js'
import { createId, now, parseJson, serializeJson } from '../../shared/utils.js'

const GLOBAL_CONTEXT_KEY = 'global'

export type SandboxCreationMode = 'EMPTY' | 'CLONE_BASELINE'

interface SandboxRecord {
  sandboxId: string
  name: string
  description: string
  status: string
  isSystemDefault: number
  creationMode: string
  sourceSandboxId: string | null
  seed: number | null
  ownerUserId: string
  ownerTeamId: string
  purpose: string
  resourceLimitsJson: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

const mapSandbox = (item: SandboxRecord, currentSandboxId?: string) => ({
  sandboxId: item.sandboxId,
  name: item.name,
  description: item.description,
  status: item.status,
  isSystemDefault: Boolean(item.isSystemDefault),
  creationMode: item.creationMode,
  sourceSandboxId: item.sourceSandboxId,
  purpose: item.purpose,
  resourceLimits: parseJson(item.resourceLimitsJson, {}),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  isCurrent: currentSandboxId === item.sandboxId,
})

export const getRuntimeContext = () => {
  const current = db.select().from(runtimeContextTable).where(eq(runtimeContextTable.contextKey, GLOBAL_CONTEXT_KEY)).get()
  const currentSandboxId = current?.currentSandboxId ?? DEFAULT_SANDBOX_ID
  const sandbox = getSandboxById(currentSandboxId)

  return {
    currentSandboxId,
    currentSandbox: sandbox ? mapSandbox(sandbox, currentSandboxId) : null,
    updatedAt: current?.updatedAt ?? now(),
  }
}

export const getCurrentSandboxId = (): string => getRuntimeContext().currentSandboxId

export const getSandboxById = (sandboxId: string): SandboxRecord | undefined =>
  db.select().from(sandboxesTable).where(eq(sandboxesTable.sandboxId, sandboxId)).get() as SandboxRecord | undefined

export const listSandboxes = () => {
  const currentSandboxId = getCurrentSandboxId()
  return db
    .select()
    .from(sandboxesTable)
    .orderBy(desc(sandboxesTable.isSystemDefault), desc(sandboxesTable.updatedAt))
    .all()
    .map((item) => mapSandbox(item as SandboxRecord, currentSandboxId))
}

export const switchCurrentSandbox = (sandboxId: string) => {
  const sandbox = getSandboxById(sandboxId)
  if (!sandbox) {
    throw new Error('沙箱不存在')
  }
  if (sandbox.status !== 'ACTIVE') {
    throw new Error('只能切换到启用中的沙箱')
  }

  const timestamp = now()
  db.update(runtimeContextTable)
    .set({ currentSandboxId: sandboxId, updatedAt: timestamp })
    .where(eq(runtimeContextTable.contextKey, GLOBAL_CONTEXT_KEY))
    .run()

  return getRuntimeContext()
}

export const createSandbox = (input: {
  name: string
  description: string
  purpose: string
  resourceLimits: Record<string, unknown>
  creationMode: SandboxCreationMode
  sourceSandboxId?: string
}) => {
  const name = input.name.trim()
  if (!name) {
    throw new Error('沙箱名称不能为空')
  }

  const exists = sqlite.prepare('SELECT sandbox_id FROM sandboxes WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name) as { sandbox_id: string } | undefined
  if (exists) {
    throw new Error('沙箱名称已存在')
  }

  if (input.creationMode === 'CLONE_BASELINE' && !input.sourceSandboxId) {
    throw new Error('复制模式必须指定来源沙箱')
  }

  const sourceSandbox = input.sourceSandboxId ? getSandboxById(input.sourceSandboxId) : undefined
  if (input.creationMode === 'CLONE_BASELINE' && !sourceSandbox) {
    throw new Error('来源沙箱不存在')
  }
  if (sourceSandbox && sourceSandbox.status !== 'ACTIVE') {
    throw new Error('只能从启用中的沙箱复制')
  }

  const timestamp = now()
  const sandboxId = createId('sandbox')

  db.insert(sandboxesTable).values({
    sandboxId,
    name,
    description: input.description.trim(),
    status: 'ACTIVE',
    isSystemDefault: 0,
    creationMode: input.creationMode,
    sourceSandboxId: input.sourceSandboxId ?? null,
    seed: timestamp,
    ownerUserId: 'system',
    ownerTeamId: 'mock-platform',
    purpose: input.purpose,
    resourceLimitsJson: serializeJson(input.resourceLimits),
    createdBy: 'admin-console',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  if (input.creationMode === 'CLONE_BASELINE' && input.sourceSandboxId) {
    cloneBaselineData(input.sourceSandboxId, sandboxId, timestamp)
  }

  return mapSandbox(getSandboxById(sandboxId) as SandboxRecord, getCurrentSandboxId())
}

export const updateSandbox = (sandboxId: string, input: {
  name?: string
  description?: string
  purpose?: string
  resourceLimits?: Record<string, unknown>
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
}) => {
  const sandbox = getSandboxById(sandboxId)
  if (!sandbox) {
    throw new Error('沙箱不存在')
  }

  if (sandbox.isSystemDefault) {
    if (input.name !== undefined && input.name.trim() !== sandbox.name) {
      throw new Error('默认沙箱不可重命名')
    }
    if (input.status !== undefined && input.status !== sandbox.status) {
      throw new Error('默认沙箱不可停用')
    }
  }

  const nextStatus = input.status ?? sandbox.status
  if (nextStatus !== 'ACTIVE' && getCurrentSandboxId() === sandboxId) {
    throw new Error('当前使用中的沙箱不能直接停用，请先切换到其他沙箱')
  }

  const nextName = input.name?.trim() ?? sandbox.name
  if (!nextName) {
    throw new Error('沙箱名称不能为空')
  }

  const duplicated = sqlite
    .prepare('SELECT sandbox_id FROM sandboxes WHERE LOWER(name) = LOWER(?) AND sandbox_id != ? LIMIT 1')
    .get(nextName, sandboxId) as { sandbox_id: string } | undefined
  if (duplicated) {
    throw new Error('沙箱名称已存在')
  }

  const timestamp = now()
  db.update(sandboxesTable)
    .set({
      name: nextName,
      description: input.description?.trim() ?? sandbox.description,
      purpose: input.purpose ?? sandbox.purpose,
      resourceLimitsJson: input.resourceLimits ? serializeJson(input.resourceLimits) : sandbox.resourceLimitsJson,
      status: nextStatus,
      updatedAt: timestamp,
    })
    .where(eq(sandboxesTable.sandboxId, sandboxId))
    .run()

  return mapSandbox(getSandboxById(sandboxId) as SandboxRecord, getCurrentSandboxId())
}

export const getPlatformOverview = () => {
  const sandboxId = getCurrentSandboxId()
  const terminalStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN presence_status = 'ONLINE' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN health_status = 'WARNING' THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN health_status = 'ERROR' THEN 1 ELSE 0 END) as error
    FROM terminal_instances
    WHERE sandbox_id = ?
  `).get(sandboxId) as Record<string, number>

  const taskStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('DISPATCHING', 'IN_PROGRESS') THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM task_releases
    WHERE sandbox_id = ?
  `).get(sandboxId) as Record<string, number>

  const sessionStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'CONNECTED' THEN 1 ELSE 0 END) as connected
    FROM tdp_sessions
    WHERE sandbox_id = ?
  `).get(sandboxId) as Record<string, number>

  const topicStats = sqlite.prepare('SELECT COUNT(*) as total FROM tdp_topics WHERE sandbox_id = ?').get(sandboxId) as Record<string, number>
  const faultStats = sqlite.prepare('SELECT COUNT(*) as total, SUM(hit_count) as hits FROM fault_rules WHERE sandbox_id = ?').get(sandboxId) as Record<string, number>

  return {
    sandboxId,
    terminalStats,
    taskStats,
    sessionStats,
    topicStats,
    faultStats,
  }
}

export const listAuditLogs = (pagination?: PaginationQuery) => {
  const sandboxId = getCurrentSandboxId()
  const rows = sqlite.prepare('SELECT * FROM audit_logs WHERE sandbox_id = ? ORDER BY created_at DESC LIMIT 500').all(sandboxId) as Array<Record<string, unknown>>
  const mapped = rows.map((item) => ({
    ...item,
    detail: parseJson(String(item.detail_json ?? ''), {}),
  }))

  return pagination ? paginateItems(mapped, pagination) : mapped
}

const cloneBaselineData = (sourceSandboxId: string, targetSandboxId: string, timestamp: number) => {
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sourceSandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sourceSandboxId)).all()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sourceSandboxId)).all()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sourceSandboxId)).all()
  const profiles = db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sourceSandboxId)).all()
  const templates = db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sourceSandboxId)).all()
  const topics = db.select().from(topicsTable).where(eq(topicsTable.sandboxId, sourceSandboxId)).all()
  const faultRules = db.select().from(faultRulesTable).where(eq(faultRulesTable.sandboxId, sourceSandboxId)).all()

  const tenantIdMap = new Map<string, string>()
  for (const tenant of tenants) {
    const tenantId = createId('tenant')
    tenantIdMap.set(tenant.tenantId, tenantId)
    db.insert(tenantsTable).values({
      ...tenant,
      tenantId,
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const brandIdMap = new Map<string, string>()
  for (const brand of brands) {
    const brandId = createId('brand')
    brandIdMap.set(brand.brandId, brandId)
    db.insert(brandsTable).values({
      ...brand,
      brandId,
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const projectIdMap = new Map<string, string>()
  for (const project of projects) {
    const projectId = createId('project')
    projectIdMap.set(project.projectId, projectId)
    db.insert(projectsTable).values({
      ...project,
      projectId,
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  for (const store of stores) {
    db.insert(storesTable).values({
      ...store,
      storeId: createId('store'),
      sandboxId: targetSandboxId,
      tenantId: tenantIdMap.get(store.tenantId) ?? store.tenantId,
      brandId: brandIdMap.get(store.brandId) ?? store.brandId,
      projectId: projectIdMap.get(store.projectId) ?? store.projectId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  for (const profile of profiles) {
    db.insert(terminalProfilesTable).values({
      ...profile,
      profileId: createId('profile'),
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const profileIdMap = new Map<string, string>()
  const targetProfiles = db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, targetSandboxId)).all()
  profiles.forEach((profile, index) => {
    const targetProfile = targetProfiles[index]
    if (targetProfile) {
      profileIdMap.set(profile.profileId, targetProfile.profileId)
    }
  })

  for (const template of templates) {
    db.insert(terminalTemplatesTable).values({
      ...template,
      templateId: createId('template'),
      sandboxId: targetSandboxId,
      profileId: profileIdMap.get(template.profileId) ?? template.profileId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  for (const topic of topics) {
    db.insert(topicsTable).values({
      ...topic,
      topicId: createId('topic'),
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  for (const faultRule of faultRules) {
    db.insert(faultRulesTable).values({
      ...faultRule,
      faultRuleId: createId('fault'),
      sandboxId: targetSandboxId,
      hitCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }
}

export const appendAuditLog = (input: {
  domain: string
  action: string
  operator?: string
  targetId: string
  detail: unknown
  sandboxId?: string
}) => {
  db.insert(auditLogsTable).values({
    auditId: createId('audit'),
    sandboxId: input.sandboxId ?? getCurrentSandboxId(),
    domain: input.domain,
    action: input.action,
    operator: input.operator ?? 'admin-console',
    targetId: input.targetId,
    detailJson: serializeJson(input.detail),
    createdAt: now(),
  }).run()
}
