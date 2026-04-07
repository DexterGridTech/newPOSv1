import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../database/index.js'
import { brandsTable, projectsTable, storesTable, tenantsTable, terminalProfilesTable, terminalTemplatesTable, terminalsTable, activationCodesTable, tenantBrandAuthorizationsTable } from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'

const currentSandboxId = () => getCurrentSandboxId()

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '_')

export const listTenants = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const storeProjectIdsByTenant = new Map<string, Set<string>>()
  for (const store of stores) {
    const ids = storeProjectIdsByTenant.get(store.tenantId) ?? new Set<string>()
    ids.add(store.projectId)
    storeProjectIdsByTenant.set(store.tenantId, ids)
  }

  return db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).orderBy(desc(tenantsTable.updatedAt)).all().map((item) => ({
    ...item,
    brandCount: 0,
    projectCount: storeProjectIdsByTenant.get(item.tenantId)?.size ?? 0,
    storeCount: stores.filter((store) => store.tenantId === item.tenantId).length,
  }))
}

export const createTenant = (input: { tenantCode: string; tenantName: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const tenantId = createId('tenant')
  const timestamp = now()
  db.insert(tenantsTable).values({ tenantId, sandboxId, tenantCode: input.tenantCode, tenantName: input.tenantName, status: input.status ?? 'ACTIVE', description: input.description ?? '', createdAt: timestamp, updatedAt: timestamp }).run()
  return { tenantId }
}

export const updateTenant = (tenantId: string, input: { tenantCode?: string; tenantName?: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(tenantsTable).where(and(eq(tenantsTable.tenantId, tenantId), eq(tenantsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('租户不存在')
  db.update(tenantsTable).set({ tenantCode: input.tenantCode ?? current.tenantCode, tenantName: input.tenantName ?? current.tenantName, description: input.description ?? current.description, status: input.status ?? current.status, updatedAt: now() }).where(eq(tenantsTable.tenantId, tenantId)).run()
  return { tenantId }
}

export const listBrands = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const authorizations = db.select().from(tenantBrandAuthorizationsTable).where(eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId)).all()
  const storeProjectIdsByBrand = new Map<string, Set<string>>()
  for (const store of stores) {
    const ids = storeProjectIdsByBrand.get(store.brandId) ?? new Set<string>()
    ids.add(store.projectId)
    storeProjectIdsByBrand.set(store.brandId, ids)
  }
  return db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).orderBy(desc(brandsTable.updatedAt)).all().map((item) => ({ ...item, projectCount: storeProjectIdsByBrand.get(item.brandId)?.size ?? 0, storeCount: stores.filter((store) => store.brandId === item.brandId).length, authorizedTenantCount: authorizations.filter((auth) => auth.brandId === item.brandId && auth.status === 'ACTIVE').length }))
}

export const createBrand = (input: { brandCode: string; brandName: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const brandId = createId('brand')
  const timestamp = now()
  db.insert(brandsTable).values({ brandId, sandboxId, brandCode: input.brandCode, brandName: input.brandName, status: input.status ?? 'ACTIVE', description: input.description ?? '', createdAt: timestamp, updatedAt: timestamp }).run()
  return { brandId }
}

export const updateBrand = (brandId: string, input: { brandCode?: string; brandName?: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(brandsTable).where(and(eq(brandsTable.brandId, brandId), eq(brandsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('品牌不存在')
  db.update(brandsTable).set({ brandCode: input.brandCode ?? current.brandCode, brandName: input.brandName ?? current.brandName, description: input.description ?? current.description, status: input.status ?? current.status, updatedAt: now() }).where(eq(brandsTable.brandId, brandId)).run()
  return { brandId }
}

export const listProjects = () => {
  const sandboxId = currentSandboxId()
  const stores = db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  return db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).orderBy(desc(projectsTable.updatedAt)).all().map((item) => ({ ...item, storeCount: stores.filter((store) => store.projectId === item.projectId).length, terminalCount: terminals.filter((terminal) => terminal.projectId === item.projectId).length }))
}

export const createProject = (input: { projectCode: string; projectName: string; description?: string; status?: string; region?: string; timezone?: string }) => {
  const sandboxId = currentSandboxId()
  const projectId = createId('project')
  const timestamp = now()
  db.insert(projectsTable).values({ projectId, sandboxId, projectCode: input.projectCode, projectName: input.projectName, status: input.status ?? 'ACTIVE', description: input.description ?? '', region: input.region ?? null, timezone: input.timezone ?? null, createdAt: timestamp, updatedAt: timestamp }).run()
  return { projectId }
}

export const updateProject = (projectId: string, input: { projectCode?: string; projectName?: string; description?: string; status?: string; region?: string; timezone?: string }) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(projectsTable).where(and(eq(projectsTable.projectId, projectId), eq(projectsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('项目不存在')
  db.update(projectsTable).set({ projectCode: input.projectCode ?? current.projectCode, projectName: input.projectName ?? current.projectName, description: input.description ?? current.description, status: input.status ?? current.status, region: input.region ?? current.region, timezone: input.timezone ?? current.timezone, updatedAt: now() }).where(eq(projectsTable.projectId, projectId)).run()
  return { projectId }
}

export const listStores = () => {
  const sandboxId = currentSandboxId()
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).all()
  const projects = db.select().from(projectsTable).where(eq(projectsTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  const activationCodes = db.select().from(activationCodesTable).where(eq(activationCodesTable.sandboxId, sandboxId)).all()
  return db.select().from(storesTable).where(eq(storesTable.sandboxId, sandboxId)).orderBy(desc(storesTable.updatedAt)).all().map((item) => ({ ...item, tenantName: tenants.find((tenant) => tenant.tenantId === item.tenantId)?.tenantName ?? '--', brandName: brands.find((brand) => brand.brandId === item.brandId)?.brandName ?? '--', projectName: projects.find((project) => project.projectId === item.projectId)?.projectName ?? '--', terminalCount: terminals.filter((terminal) => terminal.storeId === item.storeId).length, activationCodeCount: activationCodes.filter((code) => code.storeId === item.storeId).length }))
}

export const listTenantBrandAuthorizations = () => {
  const sandboxId = currentSandboxId()
  const tenants = db.select().from(tenantsTable).where(eq(tenantsTable.sandboxId, sandboxId)).all()
  const brands = db.select().from(brandsTable).where(eq(brandsTable.sandboxId, sandboxId)).all()
  return db.select().from(tenantBrandAuthorizationsTable).where(eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId)).orderBy(desc(tenantBrandAuthorizationsTable.updatedAt)).all().map((item) => ({
    ...item,
    tenantName: tenants.find((tenant) => tenant.tenantId === item.tenantId)?.tenantName ?? '--',
    brandName: brands.find((brand) => brand.brandId === item.brandId)?.brandName ?? '--',
  }))
}

export const createTenantBrandAuthorization = (input: { tenantId: string; brandId: string; description?: string; status?: string }) => {
  const sandboxId = currentSandboxId()
  const existed = db.select().from(tenantBrandAuthorizationsTable).where(and(eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId), eq(tenantBrandAuthorizationsTable.tenantId, input.tenantId), eq(tenantBrandAuthorizationsTable.brandId, input.brandId))).get()
  if (existed) throw new Error('该租户与品牌授权已存在')
  const authorizationId = createId('tenant_brand_auth')
  const timestamp = now()
  db.insert(tenantBrandAuthorizationsTable).values({
    authorizationId,
    sandboxId,
    tenantId: input.tenantId,
    brandId: input.brandId,
    status: input.status ?? 'ACTIVE',
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { authorizationId }
}

export const updateTenantBrandAuthorization = (authorizationId: string, input: { status?: string; description?: string }) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(tenantBrandAuthorizationsTable).where(and(eq(tenantBrandAuthorizationsTable.authorizationId, authorizationId), eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('品牌授权不存在')
  db.update(tenantBrandAuthorizationsTable).set({
    status: input.status ?? current.status,
    description: input.description ?? current.description,
    updatedAt: now(),
  }).where(eq(tenantBrandAuthorizationsTable.authorizationId, authorizationId)).run()
  return { authorizationId }
}

export const createStore = (input: { tenantId: string; brandId: string; projectId: string; storeCode: string; storeName: string; description?: string; status?: string; address?: string; contactName?: string; contactPhone?: string }) => {
  const sandboxId = currentSandboxId()
  const authorization = db.select().from(tenantBrandAuthorizationsTable).where(and(eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId), eq(tenantBrandAuthorizationsTable.tenantId, input.tenantId), eq(tenantBrandAuthorizationsTable.brandId, input.brandId), eq(tenantBrandAuthorizationsTable.status, 'ACTIVE'))).get()
  if (!authorization) throw new Error('该品牌尚未授权给当前租户，不能创建门店')
  const storeId = createId('store')
  const timestamp = now()
  db.insert(storesTable).values({ storeId, sandboxId, tenantId: input.tenantId, brandId: input.brandId, projectId: input.projectId, storeCode: input.storeCode, storeName: input.storeName, status: input.status ?? 'ACTIVE', description: input.description ?? '', address: input.address ?? null, contactName: input.contactName ?? null, contactPhone: input.contactPhone ?? null, createdAt: timestamp, updatedAt: timestamp }).run()
  return { storeId }
}

export const updateStore = (storeId: string, input: { tenantId?: string; brandId?: string; projectId?: string; storeCode?: string; storeName?: string; description?: string; status?: string; address?: string; contactName?: string; contactPhone?: string }) => {
  const sandboxId = currentSandboxId()
  const current = db.select().from(storesTable).where(and(eq(storesTable.storeId, storeId), eq(storesTable.sandboxId, sandboxId))).get()
  if (!current) throw new Error('门店不存在')
  const nextTenantId = input.tenantId ?? current.tenantId
  const nextBrandId = input.brandId ?? current.brandId
  const authorization = db.select().from(tenantBrandAuthorizationsTable).where(and(eq(tenantBrandAuthorizationsTable.sandboxId, sandboxId), eq(tenantBrandAuthorizationsTable.tenantId, nextTenantId), eq(tenantBrandAuthorizationsTable.brandId, nextBrandId), eq(tenantBrandAuthorizationsTable.status, 'ACTIVE'))).get()
  if (!authorization) throw new Error('该品牌尚未授权给当前租户，不能保存门店')
  db.update(storesTable).set({ tenantId: nextTenantId, brandId: nextBrandId, projectId: input.projectId ?? current.projectId, storeCode: input.storeCode ?? current.storeCode, storeName: input.storeName ?? current.storeName, description: input.description ?? current.description, status: input.status ?? current.status, address: input.address ?? current.address, contactName: input.contactName ?? current.contactName, contactPhone: input.contactPhone ?? current.contactPhone, updatedAt: now() }).where(eq(storesTable.storeId, storeId)).run()
  return { storeId }
}

export const listProfiles = () => {
  const sandboxId = currentSandboxId()
  const templates = db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  return db.select().from(terminalProfilesTable).where(eq(terminalProfilesTable.sandboxId, sandboxId)).orderBy(desc(terminalProfilesTable.updatedAt)).all().map((item) => ({ ...item, capabilities: parseJson(item.capabilitiesJson, {}), templateCount: templates.filter((template) => template.profileId === item.profileId).length, terminalCount: terminals.filter((terminal) => terminal.profileId === item.profileId).length }))
}

export const listTemplates = () => {
  const sandboxId = currentSandboxId()
  const activations = db.select().from(activationCodesTable).where(eq(activationCodesTable.sandboxId, sandboxId)).all()
  const terminals = db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
  return db.select().from(terminalTemplatesTable).where(eq(terminalTemplatesTable.sandboxId, sandboxId)).orderBy(desc(terminalTemplatesTable.updatedAt)).all().map((item) => ({ ...item, presetConfig: parseJson(item.presetConfigJson, {}), presetTags: parseJson(item.presetTagsJson, []), activationCodeCount: activations.filter((code) => code.templateId === item.templateId).length, terminalCount: terminals.filter((terminal) => terminal.templateId === item.templateId).length }))
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
