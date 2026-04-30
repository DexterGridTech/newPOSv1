import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { desc, eq } from 'drizzle-orm'
import { db, getDataRoot, sqlite } from '../../database/index.js'
import {
  activationCodesTable,
  auditLogsTable,
  brandsTable,
  changeLogsTable,
  faultRulesTable,
  contractsTable,
  platformsTable,
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
export const KERNEL_BASE_TEST_SANDBOX_ID = 'sandbox-kernel-base-test'
const KERNEL_BASE_TEST_SANDBOX_NAME = 'kernel-base-test'
const KERNEL_BASE_TEST_SEED = 20260411
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultHotUpdateStorageRoot = path.resolve(currentDir, '../../../data/hot-updates')
const getHotUpdateStorageRoot = () => {
  const root = getDataRoot()
  return root ? path.resolve(root, 'hot-updates') : defaultHotUpdateStorageRoot
}

export type SandboxCreationMode = 'EMPTY' | 'CLONE_BASELINE'

type SeedTdpTopic = {
  key: string
  name: string
  payloadMode: string
  schema: Record<string, unknown>
  retentionHours: number
  lifecycle?: 'persistent' | 'expiring'
  deliveryType?: 'projection' | 'command-outbox'
  defaultTtlMs?: number
  minTtlMs?: number
  maxTtlMs?: number
}

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

export const assertSandboxExists = (sandboxId: string) => {
  if (!sandboxId?.trim()) {
    throw new Error('SANDBOX_ID_REQUIRED')
  }
  const sandbox = getSandboxById(sandboxId)
  if (!sandbox) {
    throw new Error('沙箱不存在')
  }
  return sandbox
}

export const assertSandboxUsable = (sandboxId: string) => {
  const sandbox = assertSandboxExists(sandboxId)
  if (sandbox.status !== 'ACTIVE') {
    throw new Error('只能使用启用中的沙箱')
  }
  return sandbox
}

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
  sandboxId?: string
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
  const sandboxId = input.sandboxId?.trim() || createId('sandbox')
  if (getSandboxById(sandboxId)) {
    throw new Error('沙箱 ID 已存在')
  }

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
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sourceSandboxId)).all()
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sourceSandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sourceSandboxId)).all()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sourceSandboxId)).all()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sourceSandboxId)).all()
  const contracts = db.select().from(contractsTable).where(eq(contractsTable.sandboxId, sourceSandboxId)).all()
  const profiles = db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sourceSandboxId)).all()
  const templates = db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sourceSandboxId)).all()
  const topics = db.select().from(topicsTable).where(eq(topicsTable.sandboxId, sourceSandboxId)).all()
  const faultRules = db.select().from(faultRulesTable).where(eq(faultRulesTable.sandboxId, sourceSandboxId)).all()

  const platformIdMap = new Map<string, string>()
  for (const platform of platforms) {
    const platformId = createId('platform')
    platformIdMap.set(platform.platformId, platformId)
    db.insert(platformsTable).values({
      ...platform,
      platformId,
      sandboxId: targetSandboxId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const tenantIdMap = new Map<string, string>()
  for (const tenant of tenants) {
    const tenantId = createId('tenant')
    tenantIdMap.set(tenant.tenantId, tenantId)
    db.insert(tenantsTable).values({
      ...tenant,
      tenantId,
      sandboxId: targetSandboxId,
      platformId: platformIdMap.get(tenant.platformId) ?? tenant.platformId,
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
      platformId: platformIdMap.get(brand.platformId) ?? brand.platformId,
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
      platformId: platformIdMap.get(project.platformId) ?? project.platformId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const storeIdMap = new Map<string, string>()
  for (const store of stores) {
    const storeId = createId('store')
    storeIdMap.set(store.storeId, storeId)
    db.insert(storesTable).values({
      ...store,
      storeId,
      sandboxId: targetSandboxId,
      platformId: platformIdMap.get(store.platformId) ?? store.platformId,
      tenantId: tenantIdMap.get(store.tenantId) ?? store.tenantId,
      brandId: brandIdMap.get(store.brandId) ?? store.brandId,
      projectId: projectIdMap.get(store.projectId) ?? store.projectId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  for (const contract of contracts) {
    db.insert(contractsTable).values({
      ...contract,
      contractId: createId('contract'),
      sandboxId: targetSandboxId,
      platformId: platformIdMap.get(contract.platformId) ?? contract.platformId,
      projectId: projectIdMap.get(contract.projectId) ?? contract.projectId,
      tenantId: tenantIdMap.get(contract.tenantId) ?? contract.tenantId,
      brandId: brandIdMap.get(contract.brandId) ?? contract.brandId,
      storeId: storeIdMap.get(contract.storeId) ?? contract.storeId,
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

const insertKernelBaseTestSandbox = (timestamp: number) => {
  db.insert(sandboxesTable).values({
    sandboxId: KERNEL_BASE_TEST_SANDBOX_ID,
    name: KERNEL_BASE_TEST_SANDBOX_NAME,
    description: '用于 kernel-base tcp-client / tdp-client 真实链路测试的专用沙箱',
    status: 'ACTIVE',
    isSystemDefault: 0,
    creationMode: 'EMPTY',
    sourceSandboxId: null,
    seed: KERNEL_BASE_TEST_SEED,
    ownerUserId: 'system',
    ownerTeamId: 'mock-platform',
    purpose: 'kernel-base-test',
    resourceLimitsJson: serializeJson({
      maxTerminals: 100,
      maxTasks: 500,
      maxFaultRules: 50,
      maxStorageSize: '1GB',
    }),
    createdBy: 'kernel-base-test',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
}

const deleteSandboxRows = (sandboxId: string) => {
  const terminalIds = sqlite
    .prepare('SELECT terminal_id FROM terminal_instances WHERE sandbox_id = ?')
    .all(sandboxId) as Array<{ terminal_id: string }>
  const releaseIds = sqlite
    .prepare('SELECT release_id FROM task_releases WHERE sandbox_id = ?')
    .all(sandboxId) as Array<{ release_id: string }>

  const tableNames = [
    'audit_logs',
    'fault_rules',
    'tdp_command_outbox',
    'tdp_change_logs',
    'tdp_terminal_projection_access',
    'tdp_terminal_cursors',
    'tdp_projection_source_events',
    'tdp_projections',
    'projection_policies',
    'selector_group_memberships',
    'selector_groups',
    'tdp_topics',
    'tdp_sessions',
    'task_releases',
    'hot_update_releases',
    'hot_update_packages',
    'activation_codes',
    'terminal_instances',
    'terminal_templates',
    'terminal_profiles',
    'contracts',
    'stores',
    'projects',
    'brands',
    'tenants',
    'platforms',
  ] as const

  tableNames.forEach(tableName => {
    sqlite.prepare(`DELETE FROM ${tableName} WHERE sandbox_id = ?`).run(sandboxId)
  })

  if (terminalIds.length > 0) {
    const deleteCredential = sqlite.prepare('DELETE FROM terminal_credentials WHERE terminal_id = ?')
    for (const terminal of terminalIds) {
      deleteCredential.run(terminal.terminal_id)
    }
  }

  if (releaseIds.length > 0) {
    const deleteTaskInstance = sqlite.prepare('DELETE FROM task_instances WHERE release_id = ?')
    for (const release of releaseIds) {
      deleteTaskInstance.run(release.release_id)
    }
  }

  fs.rmSync(path.join(getHotUpdateStorageRoot(), sandboxId), { recursive: true, force: true })
}

const seedKernelBaseTestSandboxData = (timestamp: number) => {
  sqlite.prepare(`
    INSERT INTO platforms (platform_id, sandbox_id, platform_code, platform_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'platform-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'PLATFORM_KERNEL_BASE_TEST',
    'Kernel Base Test Platform',
    'ACTIVE',
    'kernel-base 联调测试平台',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tenants (tenant_id, sandbox_id, platform_id, tenant_code, tenant_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'tenant-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'platform-kernel-base-test',
    'TENANT_KERNEL_BASE_TEST',
    'Kernel Base Test Tenant',
    'ACTIVE',
    'kernel-base 联调测试租户',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO brands (brand_id, sandbox_id, platform_id, brand_code, brand_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'brand-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'platform-kernel-base-test',
    'BRAND_KERNEL_BASE_TEST',
    'Kernel Base Test Brand',
    'ACTIVE',
    'kernel-base 联调测试品牌',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO projects (project_id, sandbox_id, platform_id, project_code, project_name, status, description, region, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'project-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'platform-kernel-base-test',
    'PROJECT_KERNEL_BASE_TEST',
    'Kernel Base Test Project',
    'ACTIVE',
    'kernel-base 联调测试项目',
    'SZ',
    'Asia/Shanghai',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO stores (store_id, sandbox_id, platform_id, tenant_id, brand_id, project_id, unit_code, store_code, store_name, status, description, address, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'platform-kernel-base-test',
    'tenant-kernel-base-test',
    'brand-kernel-base-test',
    'project-kernel-base-test',
    'KB001',
    'STORE_KERNEL_BASE_TEST',
    'Kernel Base Test Store',
    'ACTIVE',
    'kernel-base 联调测试门店',
    '深圳市南山区科苑南路',
    'Kernel Tester',
    '13800138000',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO contracts (
      contract_id, sandbox_id, platform_id, project_id, tenant_id, brand_id, store_id,
      contract_code, unit_code, start_date, end_date, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'contract-kernel-base-test',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'platform-kernel-base-test',
    'project-kernel-base-test',
    'tenant-kernel-base-test',
    'brand-kernel-base-test',
    'store-kernel-base-test',
    'CONTRACT_KERNEL_BASE_TEST',
    'KB001',
    '2026-01-01',
    '2026-12-31',
    'ACTIVE',
    'kernel-base 联调测试合同',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_profiles (profile_id, sandbox_id, profile_code, name, description, capabilities_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'profile-kernel-base-android-pos',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'KERNEL_BASE_ANDROID_POS',
    'Kernel Base Android POS',
    'kernel-base 联调测试终端机型',
    serializeJson({
      supportsDualScreen: true,
      supportsCamera: true,
      supportsPrinter: true,
      supportsScanner: true,
    }),
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_templates (template_id, sandbox_id, template_code, name, description, profile_id, preset_config_json, preset_tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'template-kernel-base-android-pos-standard',
    KERNEL_BASE_TEST_SANDBOX_ID,
    'KERNEL_BASE_ANDROID_POS_STANDARD',
    'Kernel Base Android POS Standard',
    'kernel-base 联调测试终端模板',
    'profile-kernel-base-android-pos',
    serializeJson({
      app: {theme: 'light', locale: 'zh-CN'},
      hardware: {printer: true, scanner: true},
    }),
    serializeJson(['kernel-base-test', 'android-pos']),
    timestamp,
    timestamp,
  )

  for (let index = 1; index <= 12; index += 1) {
    sqlite.prepare(`
      INSERT INTO activation_codes (code, sandbox_id, platform_id, tenant_id, brand_id, project_id, store_id, profile_id, template_id, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `2000000000${String(index).padStart(2, '0')}`,
      KERNEL_BASE_TEST_SANDBOX_ID,
      'platform-kernel-base-test',
      'tenant-kernel-base-test',
      'brand-kernel-base-test',
      'project-kernel-base-test',
      'store-kernel-base-test',
      'profile-kernel-base-android-pos',
      'template-kernel-base-android-pos-standard',
      'AVAILABLE',
      timestamp + 30 * 24 * 3600_000,
      timestamp,
    )
  }

  const topics: SeedTdpTopic[] = [
    {
      key: 'tcp.task.release',
      name: 'TCP Task Release',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', required: ['taskType', 'releaseId', 'payload']},
      retentionHours: 72,
    },
    {
      key: 'terminal.config.state',
      name: 'Terminal Config State',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', required: ['configVersion']},
      retentionHours: 168,
    },
    {
      key: 'config.delta',
      name: 'Config Delta',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', additionalProperties: true},
      retentionHours: 72,
    },
    {
      key: 'menu.delta',
      name: 'Menu Delta',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', additionalProperties: true},
      retentionHours: 72,
    },
    {
      key: 'printer.delta',
      name: 'Printer Delta',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', additionalProperties: true},
      retentionHours: 72,
    },
    {
      key: 'remote.control',
      name: 'Remote Control',
      payloadMode: 'EPHEMERAL_COMMAND',
      schema: {type: 'object', required: ['commandType']},
      retentionHours: 1,
    },
    {
      key: 'print.command',
      name: 'Print Command',
      payloadMode: 'EPHEMERAL_COMMAND',
      schema: {type: 'object', required: ['commandType']},
      retentionHours: 1,
    },
    {
      key: 'order.payment.completed',
      name: 'Order Payment Completed',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', additionalProperties: true},
      retentionHours: 48,
      lifecycle: 'expiring',
      deliveryType: 'projection',
      defaultTtlMs: 2 * 24 * 60 * 60 * 1000,
      minTtlMs: 1_000,
      maxTtlMs: 2 * 24 * 60 * 60 * 1000,
    },
    {
      key: 'commercial.benefit-template.profile',
      name: 'Commercial Benefit Template Profile',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', required: ['templateKey', 'templateCode', 'version']},
      retentionHours: 168,
      lifecycle: 'persistent',
      deliveryType: 'projection',
    },
    {
      key: 'commercial.benefit-activity.profile',
      name: 'Commercial Benefit Activity Profile',
      payloadMode: 'FLEXIBLE_JSON',
      schema: {type: 'object', additionalProperties: true},
      retentionHours: 168,
      lifecycle: 'persistent',
      deliveryType: 'projection',
    },
  ]

  topics.forEach(topic => {
    db.insert(topicsTable).values({
      topicId: createId('topic'),
      sandboxId: KERNEL_BASE_TEST_SANDBOX_ID,
      key: topic.key,
      name: topic.name,
      payloadMode: topic.payloadMode,
      schemaJson: serializeJson(topic.schema),
      scopeType: 'TERMINAL',
      retentionHours: topic.retentionHours,
      lifecycle: topic.lifecycle ?? 'persistent',
      deliveryType: topic.deliveryType ?? (topic.payloadMode === 'EPHEMERAL_COMMAND' ? 'command-outbox' : 'projection'),
      defaultTtlMs: topic.defaultTtlMs ?? null,
      minTtlMs: topic.minTtlMs ?? null,
      maxTtlMs: topic.maxTtlMs ?? null,
      expiryAction: 'tombstone',
      deliveryGuarantee: topic.lifecycle === 'expiring' ? 'retained-until-expired' : 'retained-until-deleted',
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  })

  db.insert(topicsTable).values({
    topicId: createId('topic'),
    sandboxId: KERNEL_BASE_TEST_SANDBOX_ID,
    key: 'terminal.group.membership',
    name: 'Terminal Group Membership',
    payloadMode: 'FLEXIBLE_JSON',
    schemaJson: serializeJson({ type: 'object', required: ['membershipVersion', 'groups'] }),
    scopeType: 'TERMINAL',
    retentionHours: 168,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  appendAuditLog({
    sandboxId: KERNEL_BASE_TEST_SANDBOX_ID,
    domain: 'SANDBOX',
    action: 'SEED_KERNEL_BASE_TEST_SANDBOX',
    operator: 'kernel-base-test',
    targetId: KERNEL_BASE_TEST_SANDBOX_ID,
    detail: {
      sandboxName: KERNEL_BASE_TEST_SANDBOX_NAME,
      activationCodeCount: 12,
      topicKeys: topics.map(topic => topic.key),
    },
  })
}

export const prepareKernelBaseTestSandbox = () => {
  const timestamp = now()
  const existing = getSandboxById(KERNEL_BASE_TEST_SANDBOX_ID)

  if (!existing) {
    insertKernelBaseTestSandbox(timestamp)
  }

  deleteSandboxRows(KERNEL_BASE_TEST_SANDBOX_ID)
  seedKernelBaseTestSandboxData(timestamp)
  const runtimeContext = switchCurrentSandbox(KERNEL_BASE_TEST_SANDBOX_ID)

  return {
    sandboxId: KERNEL_BASE_TEST_SANDBOX_ID,
    sandboxName: KERNEL_BASE_TEST_SANDBOX_NAME,
    seed: KERNEL_BASE_TEST_SEED,
    runtimeContext,
    preparedAt: timestamp,
  }
}
