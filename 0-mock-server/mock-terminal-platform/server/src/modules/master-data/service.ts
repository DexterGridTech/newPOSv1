import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../database/index.js'
import {
  activationCodesTable,
  brandsTable,
  contractsTable,
  platformsTable,
  projectsTable,
  storesTable,
  tenantsTable,
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
} from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'

const currentSandboxId = () => getCurrentSandboxId()

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '_')

const getPlatform = (sandboxId: string, platformId: string) =>
  db.select().from(platformsTable).where(and(eq(platformsTable.platformId, platformId), eq(platformsTable.sandboxId, sandboxId))).get()

const getTenant = (sandboxId: string, tenantId: string) =>
  db.select().from(tenantsTable).where(and(eq(tenantsTable.tenantId, tenantId), eq(tenantsTable.sandboxId, sandboxId))).get()

const getBrand = (sandboxId: string, brandId: string) =>
  db.select().from(brandsTable).where(and(eq(brandsTable.brandId, brandId), eq(brandsTable.sandboxId, sandboxId))).get()

const getProject = (sandboxId: string, projectId: string) =>
  db.select().from(projectsTable).where(and(eq(projectsTable.projectId, projectId), eq(projectsTable.sandboxId, sandboxId))).get()

const getStore = (sandboxId: string, storeId: string) =>
  db.select().from(storesTable).where(and(eq(storesTable.storeId, storeId), eq(storesTable.sandboxId, sandboxId))).get()

const ensurePlatformScopedEntity = (entityName: string, expectedPlatformId: string, actualPlatformId?: string | null) => {
  if (!actualPlatformId || actualPlatformId !== expectedPlatformId) {
    throw new Error(`${entityName} 不属于当前选择的平台`)
  }
}

const ensureStoreRelations = (input: {
  sandboxId: string
  platformId: string
  tenantId: string
  brandId: string
  projectId: string
}) => {
  const tenant = getTenant(input.sandboxId, input.tenantId)
  if (!tenant) throw new Error('租户不存在')
  ensurePlatformScopedEntity('租户', input.platformId, tenant.platformId)

  const brand = getBrand(input.sandboxId, input.brandId)
  if (!brand) throw new Error('品牌不存在')
  ensurePlatformScopedEntity('品牌', input.platformId, brand.platformId)

  const project = getProject(input.sandboxId, input.projectId)
  if (!project) throw new Error('项目不存在')
  ensurePlatformScopedEntity('项目', input.platformId, project.platformId)

  return { tenant, brand, project }
}

export const listPlatforms = () => {
  const sandboxId = currentSandboxId()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).all()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()

  return db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).orderBy(desc(platformsTable.updatedAt)).all().map((item) => ({
    ...item,
    projectCount: projects.filter((project) => project.platformId === item.platformId).length,
    storeCount: stores.filter((store) => store.platformId === item.platformId).length,
  }))
}

export const createPlatform = (input: { platformCode: string; platformName: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const platformCode = normalizeCode(input.platformCode)
  const duplicated = db.select().from(platformsTable).where(and(eq(platformsTable.sandboxId, sandboxId), eq(platformsTable.platformCode, platformCode))).get()
  if (duplicated) throw new Error('平台编码已存在')
  const platformId = createId('platform')
  const timestamp = now()
  db.insert(platformsTable).values({
    platformId,
    sandboxId,
    platformCode,
    platformName: input.platformName,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { platformId }
}

export const updatePlatform = (platformId: string, input: { platformCode?: string; platformName?: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const current = getPlatform(sandboxId, platformId)
  if (!current) throw new Error('平台不存在')
  const nextPlatformCode = input.platformCode ? normalizeCode(input.platformCode) : current.platformCode
  const duplicated = db.select().from(platformsTable).where(and(eq(platformsTable.sandboxId, sandboxId), eq(platformsTable.platformCode, nextPlatformCode))).get()
  if (duplicated && duplicated.platformId !== platformId) throw new Error('平台编码已存在')
  db.update(platformsTable).set({
    platformCode: nextPlatformCode,
    platformName: input.platformName ?? current.platformName,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    updatedAt: now(),
  }).where(eq(platformsTable.platformId, platformId)).run()
  return { platformId }
}

export const deletePlatform = (platformId: string) => {
  const sandboxId = currentSandboxId()
  const current = getPlatform(sandboxId, platformId)
  if (!current) throw new Error('平台不存在')
  const hasProjects = db.select().from(projectsTable).where(and(eq(projectsTable.sandboxId, sandboxId), eq(projectsTable.platformId, platformId))).get()
  if (hasProjects) throw new Error('平台下仍有关联项目，无法删除')
  const hasTenants = db.select().from(tenantsTable).where(and(eq(tenantsTable.sandboxId, sandboxId), eq(tenantsTable.platformId, platformId))).get()
  if (hasTenants) throw new Error('平台下仍有关联租户，无法删除')
  const hasBrands = db.select().from(brandsTable).where(and(eq(brandsTable.sandboxId, sandboxId), eq(brandsTable.platformId, platformId))).get()
  if (hasBrands) throw new Error('平台下仍有关联品牌，无法删除')
  const hasStores = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.platformId, platformId))).get()
  if (hasStores) throw new Error('平台下仍有关联门店，无法删除')
  const hasContracts = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.platformId, platformId))).get()
  if (hasContracts) throw new Error('平台下仍有关联合同，无法删除')
  db.delete(platformsTable).where(and(eq(platformsTable.platformId, platformId), eq(platformsTable.sandboxId, sandboxId))).run()
  return { platformId }
}

export const listTenants = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).all()
  const storeProjectIdsByTenant = new Map<string, Set<string>>()
  for (const store of stores) {
    const ids = storeProjectIdsByTenant.get(store.tenantId) ?? new Set<string>()
    ids.add(store.projectId)
    storeProjectIdsByTenant.set(store.tenantId, ids)
  }

  return db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).orderBy(desc(tenantsTable.updatedAt)).all().map((item) => ({
    ...item,
    platformName: platforms.find((platform) => platform.platformId === item.platformId)?.platformName ?? '--',
    projectCount: storeProjectIdsByTenant.get(item.tenantId)?.size ?? 0,
    storeCount: stores.filter((store) => store.tenantId === item.tenantId).length,
  }))
}

export const createTenant = (input: { platformId: string; tenantCode: string; tenantName: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const platform = getPlatform(sandboxId, input.platformId)
  if (!platform) throw new Error('平台不存在')
  const tenantCode = normalizeCode(input.tenantCode)
  const duplicated = db.select().from(tenantsTable).where(and(eq(tenantsTable.sandboxId, sandboxId), eq(tenantsTable.platformId, input.platformId), eq(tenantsTable.tenantCode, tenantCode))).get()
  if (duplicated) throw new Error('租户编码已存在')
  const tenantId = createId('tenant')
  const timestamp = now()
  db.insert(tenantsTable).values({
    tenantId,
    sandboxId,
    platformId: input.platformId,
    tenantCode,
    tenantName: input.tenantName,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { tenantId }
}

export const updateTenant = (tenantId: string, input: { platformId?: string; tenantCode?: string; tenantName?: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const current = getTenant(sandboxId, tenantId)
  if (!current) throw new Error('租户不存在')
  const nextPlatformId = input.platformId ?? current.platformId
  const platform = getPlatform(sandboxId, nextPlatformId)
  if (!platform) throw new Error('平台不存在')
  const nextTenantCode = input.tenantCode ? normalizeCode(input.tenantCode) : current.tenantCode
  const duplicated = db.select().from(tenantsTable).where(and(eq(tenantsTable.sandboxId, sandboxId), eq(tenantsTable.platformId, nextPlatformId), eq(tenantsTable.tenantCode, nextTenantCode))).get()
  if (duplicated && duplicated.tenantId !== tenantId) throw new Error('租户编码已存在')
  db.update(tenantsTable).set({
    platformId: nextPlatformId,
    tenantCode: nextTenantCode,
    tenantName: input.tenantName ?? current.tenantName,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    updatedAt: now(),
  }).where(eq(tenantsTable.tenantId, tenantId)).run()
  return { tenantId }
}

export const deleteTenant = (tenantId: string) => {
  const sandboxId = currentSandboxId()
  const current = getTenant(sandboxId, tenantId)
  if (!current) throw new Error('租户不存在')
  const hasStores = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.tenantId, tenantId))).get()
  if (hasStores) throw new Error('租户下仍有关联门店，无法删除')
  const hasContracts = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.tenantId, tenantId))).get()
  if (hasContracts) throw new Error('租户下仍有关联合同，无法删除')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.tenantId, tenantId))).get()
  if (hasActivationCodes) throw new Error('租户下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.tenantId, tenantId))).get()
  if (hasTerminals) throw new Error('租户下仍有关联终端，无法删除')
  db.delete(tenantsTable).where(and(eq(tenantsTable.tenantId, tenantId), eq(tenantsTable.sandboxId, sandboxId))).run()
  return { tenantId }
}

export const listBrands = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).all()
  const storeProjectIdsByBrand = new Map<string, Set<string>>()
  for (const store of stores) {
    const ids = storeProjectIdsByBrand.get(store.brandId) ?? new Set<string>()
    ids.add(store.projectId)
    storeProjectIdsByBrand.set(store.brandId, ids)
  }
  return db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).orderBy(desc(brandsTable.updatedAt)).all().map((item) => ({
    ...item,
    platformName: platforms.find((platform) => platform.platformId === item.platformId)?.platformName ?? '--',
    projectCount: storeProjectIdsByBrand.get(item.brandId)?.size ?? 0,
    storeCount: stores.filter((store) => store.brandId === item.brandId).length,
  }))
}

export const createBrand = (input: { platformId: string; brandCode: string; brandName: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const platform = getPlatform(sandboxId, input.platformId)
  if (!platform) throw new Error('平台不存在')
  const brandCode = normalizeCode(input.brandCode)
  const duplicated = db.select().from(brandsTable).where(and(eq(brandsTable.sandboxId, sandboxId), eq(brandsTable.platformId, input.platformId), eq(brandsTable.brandCode, brandCode))).get()
  if (duplicated) throw new Error('品牌编码已存在')
  const brandId = createId('brand')
  const timestamp = now()
  db.insert(brandsTable).values({
    brandId,
    sandboxId,
    platformId: input.platformId,
    brandCode,
    brandName: input.brandName,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { brandId }
}

export const updateBrand = (brandId: string, input: { platformId?: string; brandCode?: string; brandName?: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const current = getBrand(sandboxId, brandId)
  if (!current) throw new Error('品牌不存在')
  const nextPlatformId = input.platformId ?? current.platformId
  const platform = getPlatform(sandboxId, nextPlatformId)
  if (!platform) throw new Error('平台不存在')
  const nextBrandCode = input.brandCode ? normalizeCode(input.brandCode) : current.brandCode
  const duplicated = db.select().from(brandsTable).where(and(eq(brandsTable.sandboxId, sandboxId), eq(brandsTable.platformId, nextPlatformId), eq(brandsTable.brandCode, nextBrandCode))).get()
  if (duplicated && duplicated.brandId !== brandId) throw new Error('品牌编码已存在')
  db.update(brandsTable).set({
    platformId: nextPlatformId,
    brandCode: nextBrandCode,
    brandName: input.brandName ?? current.brandName,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    updatedAt: now(),
  }).where(eq(brandsTable.brandId, brandId)).run()
  return { brandId }
}

export const deleteBrand = (brandId: string) => {
  const sandboxId = currentSandboxId()
  const current = getBrand(sandboxId, brandId)
  if (!current) throw new Error('品牌不存在')
  const hasStores = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.brandId, brandId))).get()
  if (hasStores) throw new Error('品牌下仍有关联门店，无法删除')
  const hasContracts = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.brandId, brandId))).get()
  if (hasContracts) throw new Error('品牌下仍有关联合同，无法删除')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.brandId, brandId))).get()
  if (hasActivationCodes) throw new Error('品牌下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.brandId, brandId))).get()
  if (hasTerminals) throw new Error('品牌下仍有关联终端，无法删除')
  db.delete(brandsTable).where(and(eq(brandsTable.brandId, brandId), eq(brandsTable.sandboxId, sandboxId))).run()
  return { brandId }
}

export const listProjects = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).all()
  return db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).orderBy(desc(projectsTable.updatedAt)).all().map((item) => ({
    ...item,
    platformName: platforms.find((platform) => platform.platformId === item.platformId)?.platformName ?? '--',
    storeCount: stores.filter((store) => store.projectId === item.projectId).length,
    terminalCount: terminals.filter((terminal) => terminal.projectId === item.projectId).length,
  }))
}

export const createProject = (input: { platformId: string; projectCode: string; projectName: string; description?: string; status?: string; region?: string; timezone?: string }) => {
  const sandboxId = currentSandboxId()
  const platform = getPlatform(sandboxId, input.platformId)
  if (!platform) throw new Error('平台不存在')
  const projectCode = normalizeCode(input.projectCode)
  const duplicated = db.select().from(projectsTable).where(and(eq(projectsTable.sandboxId, sandboxId), eq(projectsTable.platformId, input.platformId), eq(projectsTable.projectCode, projectCode))).get()
  if (duplicated) throw new Error('项目编码已存在')
  const projectId = createId('project')
  const timestamp = now()
  db.insert(projectsTable).values({
    projectId,
    sandboxId,
    platformId: input.platformId,
    projectCode,
    projectName: input.projectName,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    region: input.region ?? null,
    timezone: input.timezone ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { projectId }
}

export const updateProject = (projectId: string, input: { platformId?: string; projectCode?: string; projectName?: string; description?: string; status?: string; region?: string; timezone?: string }) => {
  const sandboxId = currentSandboxId()
  const current = getProject(sandboxId, projectId)
  if (!current) throw new Error('项目不存在')
  const nextPlatformId = input.platformId ?? current.platformId
  const platform = getPlatform(sandboxId, nextPlatformId)
  if (!platform) throw new Error('平台不存在')
  const nextProjectCode = input.projectCode ? normalizeCode(input.projectCode) : current.projectCode
  const duplicated = db.select().from(projectsTable).where(and(eq(projectsTable.sandboxId, sandboxId), eq(projectsTable.platformId, nextPlatformId), eq(projectsTable.projectCode, nextProjectCode))).get()
  if (duplicated && duplicated.projectId !== projectId) throw new Error('项目编码已存在')
  db.update(projectsTable).set({
    platformId: nextPlatformId,
    projectCode: nextProjectCode,
    projectName: input.projectName ?? current.projectName,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    region: input.region ?? current.region,
    timezone: input.timezone ?? current.timezone,
    updatedAt: now(),
  }).where(eq(projectsTable.projectId, projectId)).run()
  return { projectId }
}

export const deleteProject = (projectId: string) => {
  const sandboxId = currentSandboxId()
  const current = getProject(sandboxId, projectId)
  if (!current) throw new Error('项目不存在')
  const hasStores = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.projectId, projectId))).get()
  if (hasStores) throw new Error('项目下仍有关联门店，无法删除')
  const hasContracts = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.projectId, projectId))).get()
  if (hasContracts) throw new Error('项目下仍有关联合同，无法删除')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.projectId, projectId))).get()
  if (hasActivationCodes) throw new Error('项目下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.projectId, projectId))).get()
  if (hasTerminals) throw new Error('项目下仍有关联终端，无法删除')
  db.delete(projectsTable).where(and(eq(projectsTable.projectId, projectId), eq(projectsTable.sandboxId, sandboxId))).run()
  return { projectId }
}

export const listStores = () => {
  const sandboxId = currentSandboxId()
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).all()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).all()
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  const activationCodes = db.select().from(activationCodesTable).where(eq(activationCodesTable.sandboxId, sandboxId)).all()
  const contracts = db.select().from(contractsTable).where(eq(contractsTable.sandboxId, sandboxId)).all()
  return db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).orderBy(desc(storesTable.updatedAt)).all().map((item) => ({
    ...item,
    platformName: platforms.find((platform) => platform.platformId === item.platformId)?.platformName ?? '--',
    tenantName: tenants.find((tenant) => tenant.tenantId === item.tenantId)?.tenantName ?? '--',
    brandName: brands.find((brand) => brand.brandId === item.brandId)?.brandName ?? '--',
    projectName: projects.find((project) => project.projectId === item.projectId)?.projectName ?? '--',
    terminalCount: terminals.filter((terminal) => terminal.storeId === item.storeId).length,
    activationCodeCount: activationCodes.filter((code) => code.storeId === item.storeId).length,
    contractCount: contracts.filter((contract) => contract.storeId === item.storeId).length,
  }))
}

export const createStore = (input: { platformId: string; tenantId: string; brandId: string; projectId: string; unitCode: string; storeCode: string; storeName: string; description?: string; status?: string; address?: string; contactName?: string; contactPhone?: string }) => {
  const sandboxId = currentSandboxId()
  const platform = getPlatform(sandboxId, input.platformId)
  if (!platform) throw new Error('平台不存在')
  ensureStoreRelations({ sandboxId, platformId: input.platformId, tenantId: input.tenantId, brandId: input.brandId, projectId: input.projectId })
  const storeCode = normalizeCode(input.storeCode)
  const duplicated = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.platformId, input.platformId), eq(storesTable.storeCode, storeCode))).get()
  if (duplicated) throw new Error('门店编码已存在')
  const storeId = createId('store')
  const timestamp = now()
  db.insert(storesTable).values({
    storeId,
    sandboxId,
    platformId: input.platformId,
    tenantId: input.tenantId,
    brandId: input.brandId,
    projectId: input.projectId,
    unitCode: input.unitCode.trim(),
    storeCode,
    storeName: input.storeName,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    address: input.address ?? null,
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { storeId }
}

export const updateStore = (storeId: string, input: { platformId?: string; tenantId?: string; brandId?: string; projectId?: string; unitCode?: string; storeCode?: string; storeName?: string; description?: string; status?: string; address?: string; contactName?: string; contactPhone?: string }) => {
  const sandboxId = currentSandboxId()
  const current = getStore(sandboxId, storeId)
  if (!current) throw new Error('门店不存在')
  const nextPlatformId = input.platformId ?? current.platformId
  const platform = getPlatform(sandboxId, nextPlatformId)
  if (!platform) throw new Error('平台不存在')
  const nextTenantId = input.tenantId ?? current.tenantId
  const nextBrandId = input.brandId ?? current.brandId
  const nextProjectId = input.projectId ?? current.projectId
  ensureStoreRelations({ sandboxId, platformId: nextPlatformId, tenantId: nextTenantId, brandId: nextBrandId, projectId: nextProjectId })
  const nextStoreCode = input.storeCode ? normalizeCode(input.storeCode) : current.storeCode
  const duplicated = db.select().from(storesTable).where(and(eq(storesTable.sandboxId, sandboxId), eq(storesTable.platformId, nextPlatformId), eq(storesTable.storeCode, nextStoreCode))).get()
  if (duplicated && duplicated.storeId !== storeId) throw new Error('门店编码已存在')
  db.update(storesTable).set({
    platformId: nextPlatformId,
    tenantId: nextTenantId,
    brandId: nextBrandId,
    projectId: nextProjectId,
    unitCode: input.unitCode?.trim() ?? current.unitCode,
    storeCode: nextStoreCode,
    storeName: input.storeName ?? current.storeName,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    address: input.address ?? current.address,
    contactName: input.contactName ?? current.contactName,
    contactPhone: input.contactPhone ?? current.contactPhone,
    updatedAt: now(),
  }).where(eq(storesTable.storeId, storeId)).run()
  return { storeId }
}

export const deleteStore = (storeId: string) => {
  const sandboxId = currentSandboxId()
  const current = getStore(sandboxId, storeId)
  if (!current) throw new Error('门店不存在')
  const hasContracts = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.storeId, storeId))).get()
  if (hasContracts) throw new Error('门店下仍有关联合同，无法删除')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.storeId, storeId))).get()
  if (hasActivationCodes) throw new Error('门店下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.storeId, storeId))).get()
  if (hasTerminals) throw new Error('门店下仍有关联终端，无法删除')
  db.delete(storesTable).where(and(eq(storesTable.storeId, storeId), eq(storesTable.sandboxId, sandboxId))).run()
  return { storeId }
}

export const listContracts = () => {
  const sandboxId = currentSandboxId()
  const platforms = db.select().from(platformsTable).where(eq(platformsTable.sandboxId, sandboxId)).all()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).all()
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).all()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  return db.select().from(contractsTable).where(eq(contractsTable.sandboxId, sandboxId)).orderBy(desc(contractsTable.updatedAt)).all().map((item) => ({
    ...item,
    platformName: platforms.find((platform) => platform.platformId === item.platformId)?.platformName ?? '--',
    projectName: projects.find((project) => project.projectId === item.projectId)?.projectName ?? '--',
    tenantName: tenants.find((tenant) => tenant.tenantId === item.tenantId)?.tenantName ?? '--',
    brandName: brands.find((brand) => brand.brandId === item.brandId)?.brandName ?? '--',
    storeName: stores.find((store) => store.storeId === item.storeId)?.storeName ?? '--',
  }))
}

export const createContract = (input: {
  platformId: string
  projectId: string
  tenantId: string
  brandId: string
  storeId: string
  contractCode: string
  unitCode: string
  startDate?: string
  endDate?: string
  description?: string
  status?: string
}) => {
  const sandboxId = currentSandboxId()
  const platform = getPlatform(sandboxId, input.platformId)
  if (!platform) throw new Error('平台不存在')
  ensureStoreRelations({ sandboxId, platformId: input.platformId, tenantId: input.tenantId, brandId: input.brandId, projectId: input.projectId })
  const store = getStore(sandboxId, input.storeId)
  if (!store) throw new Error('门店不存在')
  ensurePlatformScopedEntity('门店', input.platformId, store.platformId)
  if (store.projectId !== input.projectId || store.tenantId !== input.tenantId || store.brandId !== input.brandId) {
    throw new Error('合同关联的门店、项目、租户、品牌不一致')
  }
  const contractCode = normalizeCode(input.contractCode)
  const duplicated = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.platformId, input.platformId), eq(contractsTable.contractCode, contractCode))).get()
  if (duplicated) throw new Error('合同编码已存在')
  const contractId = createId('contract')
  const timestamp = now()
  db.insert(contractsTable).values({
    contractId,
    sandboxId,
    platformId: input.platformId,
    projectId: input.projectId,
    tenantId: input.tenantId,
    brandId: input.brandId,
    storeId: input.storeId,
    contractCode,
    unitCode: input.unitCode.trim(),
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { contractId }
}

export const updateContract = (contractId: string, input: {
  platformId?: string
  projectId?: string
  tenantId?: string
  brandId?: string
  storeId?: string
  contractCode?: string
  unitCode?: string
  startDate?: string
  endDate?: string
  description?: string
  status?: string
}) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(contractsTable).where(and(eq(contractsTable.contractId, contractId), eq(contractsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('合同不存在')
  const nextPlatformId = input.platformId ?? current.platformId
  const nextProjectId = input.projectId ?? current.projectId
  const nextTenantId = input.tenantId ?? current.tenantId
  const nextBrandId = input.brandId ?? current.brandId
  const nextStoreId = input.storeId ?? current.storeId
  const platform = getPlatform(sandboxId, nextPlatformId)
  if (!platform) throw new Error('平台不存在')
  ensureStoreRelations({ sandboxId, platformId: nextPlatformId, tenantId: nextTenantId, brandId: nextBrandId, projectId: nextProjectId })
  const store = getStore(sandboxId, nextStoreId)
  if (!store) throw new Error('门店不存在')
  ensurePlatformScopedEntity('门店', nextPlatformId, store.platformId)
  if (store.projectId !== nextProjectId || store.tenantId !== nextTenantId || store.brandId !== nextBrandId) {
    throw new Error('合同关联的门店、项目、租户、品牌不一致')
  }
  const nextContractCode = input.contractCode ? normalizeCode(input.contractCode) : current.contractCode
  const duplicated = db.select().from(contractsTable).where(and(eq(contractsTable.sandboxId, sandboxId), eq(contractsTable.platformId, nextPlatformId), eq(contractsTable.contractCode, nextContractCode))).get()
  if (duplicated && duplicated.contractId !== contractId) throw new Error('合同编码已存在')
  db.update(contractsTable).set({
    platformId: nextPlatformId,
    projectId: nextProjectId,
    tenantId: nextTenantId,
    brandId: nextBrandId,
    storeId: nextStoreId,
    contractCode: nextContractCode,
    unitCode: input.unitCode?.trim() ?? current.unitCode,
    startDate: input.startDate ?? current.startDate,
    endDate: input.endDate ?? current.endDate,
    status: input.status ?? current.status,
    description: input.description ?? current.description,
    updatedAt: now(),
  }).where(eq(contractsTable.contractId, contractId)).run()
  return { contractId }
}

export const deleteContract = (contractId: string) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(contractsTable).where(and(eq(contractsTable.contractId, contractId), eq(contractsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('合同不存在')
  db.delete(contractsTable).where(and(eq(contractsTable.contractId, contractId), eq(contractsTable.sandboxId, sandboxId))).run()
  return { contractId }
}

export const listProfiles = () => {
  const sandboxId = currentSandboxId()
  const templates = db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  return db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sandboxId)).orderBy(desc(terminalProfilesTable.updatedAt)).all().map((item) => ({
    ...item,
    capabilities: parseJson(item.capabilitiesJson, {}),
    templateCount: templates.filter((template) => template.profileId === item.profileId).length,
    terminalCount: terminals.filter((terminal) => terminal.profileId === item.profileId).length,
  }))
}

export const listTemplates = () => {
  const sandboxId = currentSandboxId()
  const activations = db.select().from(activationCodesTable).where(eq(activationCodesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  return db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).orderBy(desc(terminalTemplatesTable.updatedAt)).all().map((item) => ({
    ...item,
    presetConfig: parseJson(item.presetConfigJson, {}),
    presetTags: parseJson(item.presetTagsJson, []),
    activationCodeCount: activations.filter((code) => code.templateId === item.templateId).length,
    terminalCount: terminals.filter((terminal) => terminal.templateId === item.templateId).length,
  }))
}

export const createProfile = (input: {
  profileCode: string
  name: string
  description?: string
  capabilities?: Record<string, unknown>
}) => {
  const sandboxId = currentSandboxId()
  const profileCode = normalizeCode(input.profileCode)
  const duplicated = db.select().from(terminalProfilesTable).where(and(eq(terminalProfilesTable.sandboxId, sandboxId), eq(terminalProfilesTable.profileCode, profileCode))).get()
  if (duplicated) throw new Error('终端机型编码已存在')
  const profileId = createId('profile')
  const timestamp = now()

  db.insert(terminalProfilesTable).values({
    profileId,
    sandboxId,
    profileCode,
    name: input.name,
    description: input.description ?? '',
    capabilitiesJson: JSON.stringify(input.capabilities ?? {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return { profileId }
}

export const updateProfile = (profileId: string, input: {
  profileCode?: string
  name?: string
  description?: string
  capabilities?: Record<string, unknown>
}) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(terminalProfilesTable).where(and(eq(terminalProfilesTable.profileId, profileId), eq(terminalProfilesTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('终端机型不存在')
  const nextProfileCode = input.profileCode ? normalizeCode(input.profileCode) : current.profileCode
  const duplicated = db.select().from(terminalProfilesTable).where(and(eq(terminalProfilesTable.sandboxId, sandboxId), eq(terminalProfilesTable.profileCode, nextProfileCode))).get()
  if (duplicated && duplicated.profileId !== profileId) throw new Error('终端机型编码已存在')

  db.update(terminalProfilesTable).set({
    profileCode: nextProfileCode,
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    capabilitiesJson: input.capabilities ? JSON.stringify(input.capabilities) : current.capabilitiesJson,
    updatedAt: now(),
  }).where(eq(terminalProfilesTable.profileId, profileId)).run()

  return { profileId }
}

export const deleteProfile = (profileId: string) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(terminalProfilesTable).where(and(eq(terminalProfilesTable.profileId, profileId), eq(terminalProfilesTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('终端机型不存在')
  const hasTemplates = db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.sandboxId, sandboxId), eq(terminalTemplatesTable.profileId, profileId))).get()
  if (hasTemplates) throw new Error('终端机型下仍有关联模板，无法删除')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.profileId, profileId))).get()
  if (hasActivationCodes) throw new Error('终端机型下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.profileId, profileId))).get()
  if (hasTerminals) throw new Error('终端机型下仍有关联终端，无法删除')
  db.delete(terminalProfilesTable).where(and(eq(terminalProfilesTable.profileId, profileId), eq(terminalProfilesTable.sandboxId, sandboxId))).run()
  return { profileId }
}

export const createTemplate = (input: {
  templateCode: string
  name: string
  description?: string
  profileId: string
  presetConfig?: Record<string, unknown>
  presetTags?: string[]
}) => {
  const sandboxId = currentSandboxId()
  const templateCode = normalizeCode(input.templateCode)
  const duplicated = db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.sandboxId, sandboxId), eq(terminalTemplatesTable.templateCode, templateCode))).get()
  if (duplicated) throw new Error('终端模板编码已存在')
  const templateId = createId('template')
  const timestamp = now()

  db.insert(terminalTemplatesTable).values({
    templateId,
    sandboxId,
    templateCode,
    name: input.name,
    description: input.description ?? '',
    profileId: input.profileId,
    presetConfigJson: JSON.stringify(input.presetConfig ?? {}),
    presetTagsJson: JSON.stringify(input.presetTags ?? []),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return { templateId }
}

export const updateTemplate = (templateId: string, input: {
  templateCode?: string
  name?: string
  description?: string
  profileId?: string
  presetConfig?: Record<string, unknown>
  presetTags?: string[]
}) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.templateId, templateId), eq(terminalTemplatesTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('终端模板不存在')
  const nextTemplateCode = input.templateCode ? normalizeCode(input.templateCode) : current.templateCode
  const duplicated = db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.sandboxId, sandboxId), eq(terminalTemplatesTable.templateCode, nextTemplateCode))).get()
  if (duplicated && duplicated.templateId !== templateId) throw new Error('终端模板编码已存在')

  db.update(terminalTemplatesTable).set({
    templateCode: nextTemplateCode,
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    profileId: input.profileId ?? current.profileId,
    presetConfigJson: input.presetConfig ? JSON.stringify(input.presetConfig) : current.presetConfigJson,
    presetTagsJson: input.presetTags ? JSON.stringify(input.presetTags) : current.presetTagsJson,
    updatedAt: now(),
  }).where(eq(terminalTemplatesTable.templateId, templateId)).run()

  return { templateId }
}

export const deleteTemplate = (templateId: string) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.templateId, templateId), eq(terminalTemplatesTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('终端模板不存在')
  const hasActivationCodes = db.select().from(activationCodesTable).where(and(eq(activationCodesTable.sandboxId, sandboxId), eq(activationCodesTable.templateId, templateId))).get()
  if (hasActivationCodes) throw new Error('终端模板下仍有关联激活码，无法删除')
  const hasTerminals = db.select().from(terminalsTable).where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.templateId, templateId))).get()
  if (hasTerminals) throw new Error('终端模板下仍有关联终端，无法删除')
  db.delete(terminalTemplatesTable).where(and(eq(terminalTemplatesTable.templateId, templateId), eq(terminalTemplatesTable.sandboxId, sandboxId))).run()
  return { templateId }
}
