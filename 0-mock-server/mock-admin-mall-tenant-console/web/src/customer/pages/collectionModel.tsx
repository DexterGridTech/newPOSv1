import {StatusBadge} from '../components/common'
import type {CollectionState, Column, CustomerEntity, FilterState, PageKey} from '../types'
import {asArray, asNumber, asText, businessHoursLabel, dataOf, enumLabel, formatDate, formatDateTime, money, productMenuUsage, relationName, renderBusinessValue, scopeLabel, scopeSelectorLabel, sectionProductCount, timeSlotLabel, yesNo} from '../domain'

export function applyFilters(items: CustomerEntity[], filter: FilterState, collections: CollectionState, page: PageKey) {
  return items.filter(item => {
    const data = dataOf(item)
    if (filter.status !== 'ALL' && item.status !== filter.status && asText(data.status, '') !== filter.status) return false
    if (filter.platformId !== 'ALL' && itemPlatformId(item, collections) !== filter.platformId) return false
    if (filter.projectId !== 'ALL' && itemProjectId(item, collections) !== filter.projectId) return false
    if (filter.storeId !== 'ALL' && itemStoreId(item, collections) !== filter.storeId) return false
    if (filter.brandId !== 'ALL' && !brandFilterMatches(item, filter.brandId, collections)) return false
    if (filter.tenantId !== 'ALL' && data.tenant_id !== filter.tenantId && !tenantFilterMatches(page, item, filter.tenantId, collections)) return false
    if (filter.roleId !== 'ALL' && !roleFilterMatches(item, filter.roleId, collections)) return false
    if (filter.userId !== 'ALL' && !userFilterMatches(item, filter.userId)) return false
    if (filter.permissionId !== 'ALL' && !permissionFilterMatches(item, filter.permissionId)) return false
    if (filter.category !== 'ALL' && categoryValue(page, data) !== filter.category) return false
    if (filter.floor !== 'ALL' && asText(data.floor, '') !== filter.floor) return false
    if (filter.contractStatus !== 'ALL' && contractStatusValue(page, item, data) !== filter.contractStatus) return false
    if (filter.operatingStatus !== 'ALL' && operatingStatusValue(data) !== filter.operatingStatus) return false
    if (filter.erpStatus !== 'ALL' && String(Boolean(data.erp_integration_enabled)) !== filter.erpStatus) return false
    if (filter.standardMenu !== 'ALL' && String(Boolean(data.standard_menu_enabled)) !== filter.standardMenu) return false
    if (filter.activeContract !== 'ALL' && String(hasActiveContract(page, item, collections)) !== filter.activeContract) return false
    if (filter.storeType !== 'ALL' && asText(data.store_type, '') !== filter.storeType) return false
    if (filter.productType !== 'ALL' && asText(data.product_type, '') !== filter.productType) return false
    if (filter.priceType !== 'ALL' && asText(data.price_type, '') !== filter.priceType) return false
    if (filter.channelType !== 'ALL' && asText(data.channel_type, '') !== filter.channelType) return false
    if (filter.region !== 'ALL' && itemRegionCode(item, collections) !== filter.region) return false
    if (filter.businessMode !== 'ALL' && itemProjectBusinessMode(item, collections) !== filter.businessMode) return false
    if (filter.billingMode !== 'ALL' && asText(data.billing_mode ?? data.commission_type, '') !== filter.billingMode) return false
    if (filter.permissionType !== 'ALL' && asText(data.permission_type, '') !== filter.permissionType) return false
    if (filter.roleType !== 'ALL' && asText(data.role_source ?? data.role_type, '') !== filter.roleType) return false
    if (filter.scopeType !== 'ALL' && scopeTypeValue(item) !== filter.scopeType) return false
    if (filter.policyEffect !== 'ALL' && asText(data.policy_effect, '') !== filter.policyEffect) return false
    if (filter.ownershipScope !== 'ALL' && asText(data.ownership_scope, '') !== filter.ownershipScope) return false
    if (filter.reviewStatus !== 'ALL' && asText(data.review_status, '') !== filter.reviewStatus) return false
    if (filter.tableStatus !== 'ALL' && asText(data.table_status, '') !== filter.tableStatus) return false
    if (filter.capacity !== 'ALL' && asText(data.capacity, '') !== filter.capacity) return false
    if (filter.tableArea !== 'ALL' && asText(data.area, '') !== filter.tableArea) return false
    if (filter.tableType !== 'ALL' && asText(data.table_type, '') !== filter.tableType) return false
    if (filter.reservable !== 'ALL' && String(Boolean(data.reservable)) !== filter.reservable) return false
    if (filter.workstationType !== 'ALL' && asText(data.workstation_type, '') !== filter.workstationType) return false
    if (filter.workstationCategory !== 'ALL' && !asArray(data.category_codes).map(value => asText(value, '')).includes(filter.workstationCategory)) return false
    if (filter.availabilityState !== 'ALL' && String(data.available !== false) !== filter.availabilityState) return false
    if (filter.availabilityRuleType !== 'ALL' && asText(data.rule_type, '') !== filter.availabilityRuleType) return false
    if (filter.businessStatus !== 'ALL' && businessStatusValue(data) !== filter.businessStatus) return false
    if (filter.productId !== 'ALL' && !productFilterMatches(item, filter.productId)) return false
    if (filter.productCategoryId !== 'ALL' && asText(data.category_id, '') !== filter.productCategoryId && item.entityId !== filter.productCategoryId) return false
    if (filter.stockLevel !== 'ALL' && stockLevelValue(data) !== filter.stockLevel) return false
    if (filter.discountType !== 'ALL' && asText(data.discount_type, '') !== filter.discountType) return false
    if (filter.settlementCycle !== 'ALL' && asText(data.settlement_cycle, '') !== filter.settlementCycle) return false
    if (filter.sandboxType !== 'ALL' && asText(data.sandbox_type, '') !== filter.sandboxType) return false
    if (filter.isvStatus !== 'ALL' && isvStatusValue(data) !== filter.isvStatus) return false
    const search = filter.search.trim().toLowerCase()
    if (!search) return true
    return `${item.title} ${item.entityId} ${JSON.stringify(data)}`.toLowerCase().includes(search)
  })
}

const categoryValue = (page: PageKey, data: Record<string, unknown>) => {
  if (page === 'brands') return asText(data.brand_category, '')
  if (page === 'products') return asText(data.category_id ?? data.product_type, '')
  if (page === 'productCategories') return asText(data.category_id, '')
  return ''
}

const contractStatusValue = (page: PageKey, item: CustomerEntity, data: Record<string, unknown>) => {
  if (page === 'stores') return asText(data.contract_status, data.active_contract_id ? 'ACTIVE' : 'NO_CONTRACT')
  if (page === 'contracts') return item.status
  return asText(data.contract_status, '')
}

const operatingStatusValue = (data: Record<string, unknown>) =>
  asText(data.operating_status ?? data.business_status, '')

const businessStatusValue = (data: Record<string, unknown>) =>
  asText(data.business_status ?? data.operating_status, '')

const scopeTypeValue = (item: CustomerEntity) => {
  const data = dataOf(item)
  const scopeSelector = data.scope_selector
  if (typeof scopeSelector === 'object' && scopeSelector !== null && !Array.isArray(scopeSelector)) {
    const selectorScopeType = asText((scopeSelector as Record<string, unknown>).scope_type, '')
    if (selectorScopeType) return selectorScopeType
  }
  return asText(data.scope_type, item.naturalScopeType ?? '')
}

const stockLevelValue = (data: Record<string, unknown>) =>
  asNumber(data.saleable_quantity) <= asNumber(data.safety_stock) ? 'LOW' : 'NORMAL'

const isvStatusValue = (data: Record<string, unknown>) => {
  const isvConfig = data.isv_config
  if (typeof isvConfig !== 'object' || isvConfig === null || Array.isArray(isvConfig)) return ''
  return asText((isvConfig as Record<string, unknown>).channel_status, '')
}

const tenantFilterMatches = (page: PageKey, item: CustomerEntity, tenantId: string, collections: CollectionState) => {
  if (page === 'stores') {
    return asText(dataOf(item).tenant_id, '') === tenantId
  }
  return false
}

const brandFilterMatches = (item: CustomerEntity, brandId: string, collections: CollectionState) => {
  const data = dataOf(item)
  if (asText(data.brand_id, '') === brandId || item.naturalScopeKey === brandId) return true
  const storeId = itemStoreId(item, collections)
  if (!storeId) return false
  return asText(dataOf(collections.stores.find(store => store.entityId === storeId)).brand_id, '') === brandId
}

const roleFilterMatches = (item: CustomerEntity, roleId: string, collections: CollectionState) => {
  const data = dataOf(item)
  if (item.entityType === 'role' && item.entityId === roleId) return true
  if (asText(data.role_id, '') === roleId) return true
  if (item.entityType === 'user') {
    return collections.roleBindings.some(binding => dataOf(binding).user_id === item.entityId && dataOf(binding).role_id === roleId && binding.status === 'ACTIVE')
  }
  return false
}

const userFilterMatches = (item: CustomerEntity, userId: string) => {
  const data = dataOf(item)
  return item.entityId === userId || asText(data.user_id, '') === userId
}

const permissionFilterMatches = (item: CustomerEntity, permissionId: string) => {
  const data = dataOf(item)
  return item.entityId === permissionId || asArray(data.permission_ids).map(value => asText(value, '')).includes(permissionId)
}

const productFilterMatches = (item: CustomerEntity, productId: string) => {
  const data = dataOf(item)
  if (item.entityType === 'product' && item.entityId === productId) return true
  if (asText(data.product_id, '') === productId) return true
  if (asArray(data.applicable_product_ids).map(value => asText(value, '')).includes(productId)) return true
  return menuContainsProduct(data, productId)
}

const menuContainsProduct = (data: Record<string, unknown>, productId: string) =>
  asArray(data.sections).some(section => {
    if (typeof section !== 'object' || section === null || Array.isArray(section)) return false
    const products = asArray((section as Record<string, unknown>).products)
    return products.some(product => {
      if (typeof product === 'string') return product === productId
      if (typeof product !== 'object' || product === null || Array.isArray(product)) return false
      const record = product as Record<string, unknown>
      return asText(record.product_id ?? record.productId ?? record.id, '') === productId
    })
  })

const itemRegionCode = (item: CustomerEntity, collections: CollectionState) => {
  const project = item.entityType === 'project'
    ? item
    : collections.projects.find(projectEntry => projectEntry.entityId === itemProjectId(item, collections))
  const region = dataOf(project).region
  if (typeof region !== 'object' || region === null || Array.isArray(region)) return ''
  return asText((region as Record<string, unknown>).region_code, '')
}

const itemProjectBusinessMode = (item: CustomerEntity, collections: CollectionState) => {
  const project = item.entityType === 'project'
    ? item
    : collections.projects.find(projectEntry => projectEntry.entityId === itemProjectId(item, collections))
  return asText(dataOf(project).business_mode, '')
}

const hasActiveContract = (page: PageKey, item: CustomerEntity, collections: CollectionState) => {
  if (page === 'tenants') {
    return collections.contracts.some(contract => dataOf(contract).tenant_id === item.entityId && contract.status === 'ACTIVE')
  }
  if (page === 'brands') {
    return collections.contracts.some(contract => dataOf(contract).brand_id === item.entityId && contract.status === 'ACTIVE')
  }
  if (page === 'stores') {
    const data = dataOf(item)
    return Boolean(data.active_contract_id) || asText(data.contract_status, '') === 'ACTIVE'
  }
  return item.status === 'ACTIVE'
}

export function applyContextScope(
  items: CustomerEntity[],
  page: PageKey,
  collections: CollectionState,
  context: {platformId: string; projectId: string; brandId: string; storeId: string},
) {
  return items.filter(item => {
    const data = dataOf(item)
    const platformScopedPages: PageKey[] = ['platforms', 'projects', 'tenants', 'brands', 'businessEntities', 'contracts', 'stores', 'tables', 'workstations', 'permissions', 'roles', 'users', 'roleBindings', 'productCategories', 'products', 'brandMenus', 'storeMenus', 'storeConfig', 'stock', 'availabilityRules', 'availability', 'priceRules']
    const projectScopedPages: PageKey[] = ['contracts', 'stores']
    const brandScopedPages: PageKey[] = ['productCategories', 'products', 'brandMenus']
    const storeScopedPages: PageKey[] = ['tables', 'workstations', 'productCategories', 'storeConfig', 'stock', 'availabilityRules', 'availability', 'priceRules', 'storeMenus']
    if (context.platformId && platformScopedPages.includes(page) && itemPlatformId(item, collections) !== context.platformId) return false
    if (context.projectId && projectScopedPages.includes(page) && itemProjectId(item, collections) !== context.projectId) return false
    if (context.brandId && brandScopedPages.includes(page) && data.brand_id !== context.brandId && item.naturalScopeKey !== context.brandId) return false
    if (context.storeId && storeScopedPages.includes(page) && itemStoreId(item, collections) !== context.storeId) return false
    return true
  })
}

function itemStoreId(item: CustomerEntity, _collections: CollectionState) {
  const data = dataOf(item)
  if (item.entityType === 'store') return item.entityId
  if (data.store_id) return asText(data.store_id, '')
  if (item.naturalScopeType === 'STORE') return item.naturalScopeKey ?? ''
  return ''
}

function itemProjectId(item: CustomerEntity, collections: CollectionState) {
  const data = dataOf(item)
  if (item.entityType === 'project') return item.entityId
  if (data.project_id) return asText(data.project_id, '')
  const storeId = itemStoreId(item, collections)
  if (storeId) {
    return asText(dataOf(collections.stores.find(store => store.entityId === storeId)).project_id, '')
  }
  return ''
}

function itemPlatformId(item: CustomerEntity, collections: CollectionState) {
  const data = dataOf(item)
  if (item.entityType === 'platform') return item.entityId
  if (data.platform_id) return asText(data.platform_id, '')
  if (item.naturalScopeType === 'PLATFORM') return item.naturalScopeKey ?? ''
  const brandId = asText(data.brand_id, '')
  if (brandId) {
    const brand = collections.brands.find(entry => entry.entityId === brandId)
    if (brand) return itemPlatformId(brand, collections)
  }
  const projectId = itemProjectId(item, collections)
  if (projectId) {
    return asText(dataOf(collections.projects.find(project => project.entityId === projectId)).platform_id, '')
  }
  const roleId = asText(data.role_id, '')
  if (roleId) {
    return itemPlatformId(collections.roles.find(role => role.entityId === roleId) ?? ({} as CustomerEntity), collections)
  }
  return ''
}

function tenantIdsForBrand(brandId: string, collections: CollectionState) {
  const tenantIds = new Set<string>()
  collections.contracts.forEach(contract => {
    const data = dataOf(contract)
    if (asText(data.brand_id, '') === brandId) {
      const tenantId = asText(data.tenant_id, '')
      if (tenantId) tenantIds.add(tenantId)
    }
  })
  collections.stores.forEach(store => {
    const data = dataOf(store)
    if (asText(data.brand_id, '') === brandId) {
      const tenantId = asText(data.tenant_id, '')
      if (tenantId) tenantIds.add(tenantId)
    }
  })
  return [...tenantIds]
}

function tenantCountForBrand(brandId: string, collections: CollectionState) {
  return tenantIdsForBrand(brandId, collections).length
}

function brandCountForTenant(tenantId: string, collections: CollectionState) {
  const brandIds = new Set<string>()
  collections.contracts.forEach(contract => {
    const data = dataOf(contract)
    if (asText(data.tenant_id, '') === tenantId && asText(data.brand_id, '')) {
      brandIds.add(asText(data.brand_id, ''))
    }
  })
  collections.stores.forEach(store => {
    const data = dataOf(store)
    if (asText(data.tenant_id, '') === tenantId && asText(data.brand_id, '')) {
      brandIds.add(asText(data.brand_id, ''))
    }
  })
  return brandIds.size
}

function contractCountForTenant(tenantId: string, collections: CollectionState) {
  return collections.contracts.filter(contract => dataOf(contract).tenant_id === tenantId).length
}

function storeCountForBrand(brandId: string, collections: CollectionState) {
  return collections.stores.filter(store => dataOf(store).brand_id === brandId).length
}

function menuCountForBrand(brandId: string, collections: CollectionState) {
  return collections.brandMenus.filter(menu => dataOf(menu).brand_id === brandId).length
}

function contractEndDateForStore(storeId: string, collections: CollectionState) {
  const activeContract = collections.contracts.find(contract => dataOf(contract).store_id === storeId && contract.status === 'ACTIVE')
  return activeContract ? formatDate(dataOf(activeContract).end_date) : '--'
}

function projectPhaseSummary(item: CustomerEntity) {
  const phases = asArray(dataOf(item).project_phases)
  if (phases.length === 0) return '一期'
  return phases.map((phase, index) => {
    const record = typeof phase === 'object' && phase !== null && !Array.isArray(phase) ? phase as Record<string, unknown> : {}
    return `${asText(record.phase_name, index === 0 ? '一期' : `第${index + 1}期`)} / ${asText(record.owner_name, '项目业主方')}`
  }).join('；')
}

function storeProjectName(storeId: unknown, collections: CollectionState) {
  const store = collections.stores.find(item => item.entityId === storeId)
  return relationName(collections.projects, dataOf(store).project_id)
}

function storeNameWithProject(storeId: unknown, collections: CollectionState) {
  return `${relationName(collections.stores, storeId)} / ${storeProjectName(storeId, collections)}`
}

function productCategoryName(categoryId: unknown, collections: CollectionState) {
  return relationName(collections.productCategories, categoryId, asText(categoryId))
}

function productScopeName(item: CustomerEntity, collections: CollectionState) {
  const data = dataOf(item)
  if (asText(data.ownership_scope, 'BRAND') === 'STORE') {
    return `门店：${relationName(collections.stores, data.store_id)}`
  }
  return `品牌：${relationName(collections.brands, data.brand_id)}`
}

function productProductionSummary(item: CustomerEntity) {
  const profile = dataOf(item).production_profile
  const record = typeof profile === 'object' && profile !== null && !Array.isArray(profile) ? profile as Record<string, unknown> : {}
  const duration = asNumber(record.total_estimated_duration)
  const complexity = asText(record.complexity_level, '--')
  return duration > 0 ? `${complexity} / ${Math.round(duration / 60)} 分钟` : complexity
}

export function columnsFor(page: PageKey, collections: CollectionState): Column[] {
  const relation = {
    platform: (id: unknown) => relationName(collections.platforms, id),
    project: (id: unknown) => relationName(collections.projects, id),
    tenant: (id: unknown) => relationName(collections.tenants, id, '空置'),
    brand: (id: unknown) => relationName(collections.brands, id),
    store: (id: unknown) => relationName(collections.stores, id),
    role: (id: unknown) => relationName(collections.roles, id),
  }
  const baseName = (label = '名称'): Column => ({label, render: item => <strong>{item.title}</strong>})
  const status: Column = {label: '状态', render: item => <StatusBadge value={asText(dataOf(item).status, item.status)} />}
  const updated: Column = {label: '最后更新', render: item => formatDateTime(item.updatedAt)}
  const imageThumb = (key: string, fallbackLabel: string): Column => ({
    label: '图片',
    render: item => {
      const value = dataOf(item)[key]
      const url = typeof value === 'string' && value.trim() ? value.trim() : ''
      return url ? <img className="customer-v3-table-thumb" src={url} alt={item.title} /> : <span className="customer-v3-thumb-placeholder">{fallbackLabel}</span>
    },
  })
  const config: Partial<Record<PageKey, Column[]>> = {
    environment: [
      baseName('沙箱名称'),
      {label: '类型', render: item => enumLabel(dataOf(item).sandbox_type)},
      status,
      {label: '平台数', render: item => collections.platforms.filter(platform => platform.sandboxId === item.entityId || platform.payload.sandbox_id === item.entityId).length},
      updated,
    ],
    platforms: [baseName('平台名称'), {label: '平台编码', render: item => asText(dataOf(item).platform_code)}, status, {label: 'ISV Token', render: item => enumLabel((dataOf(item).isv_config as Record<string, unknown> | undefined)?.channel_status ?? 'ACTIVE')}, updated],
    projects: [baseName('项目名称'), {label: '项目编码', render: item => asText(dataOf(item).project_code)}, {label: '大区', render: item => asText((dataOf(item).region as Record<string, unknown> | undefined)?.region_name)}, {label: '项目业态', render: item => enumLabel(dataOf(item).business_mode)}, {label: '分期 / 业主方', render: item => projectPhaseSummary(item)}, {label: '门店数', render: item => collections.stores.filter(store => dataOf(store).project_id === item.entityId).length}, status, updated],
    tenants: [baseName('租户名称'), {label: '租户编码', render: item => asText(dataOf(item).tenant_code)}, {label: '公司名称', render: item => asText(dataOf(item).company_name, item.title)}, {label: '统一社会信用代码', render: item => asText(dataOf(item).social_credit_code ?? dataOf(item).unified_social_credit_code, '--')}, {label: '法人代表', render: item => asText(dataOf(item).legal_representative, '--')}, {label: '租户类型', render: item => enumLabel(dataOf(item).tenant_type)}, {label: '经营模式', render: item => enumLabel(dataOf(item).business_model)}, {label: '联系人', render: item => asText(dataOf(item).contact_name, '--')}, {label: '联系电话', render: item => asText(dataOf(item).contact_phone, '--')}, {label: '签约/结算主体', render: item => collections.businessEntities.filter(entity => dataOf(entity).tenant_id === item.entityId).length}, {label: '合同数', render: item => contractCountForTenant(item.entityId, collections)}, {label: '签约品牌数', render: item => brandCountForTenant(item.entityId, collections)}, {label: '签约门店', render: item => collections.stores.filter(store => dataOf(store).tenant_id === item.entityId).length}, {label: '结算周期', render: item => asText(dataOf(item).settlement_cycle, '--')}, status],
    brands: [imageThumb('brand_logo_url', '无图'), baseName('品牌名称'), {label: '品牌编码', render: item => asText(dataOf(item).brand_code)}, {label: '品类', render: item => renderBusinessValue('brand_category', dataOf(item).brand_category, collections)}, {label: '关联租户数', render: item => tenantCountForBrand(item.entityId, collections)}, {label: '门店数', render: item => storeCountForBrand(item.entityId, collections)}, {label: '商品数', render: item => collections.products.filter(product => dataOf(product).brand_id === item.entityId).length}, {label: '菜单数', render: item => menuCountForBrand(item.entityId, collections)}, {label: 'ERP', render: item => yesNo(dataOf(item).erp_integration_enabled)}, {label: '标准菜单', render: item => yesNo(dataOf(item).standard_menu_enabled)}, status],
    businessEntities: [baseName('签约/结算主体'), {label: '主体编码', render: item => asText(dataOf(item).entity_code)}, {label: '所属租户', render: item => relation.tenant(dataOf(item).tenant_id)}, {label: '公司名称', render: item => asText(dataOf(item).company_name, item.title)}, {label: '统一社会信用代码', render: item => asText(dataOf(item).unified_social_credit_code, '--')}, {label: '纳税人类型', render: item => enumLabel(dataOf(item).taxpayer_type)}, {label: '开户银行', render: item => asText(dataOf(item).bank_name, '--')}, {label: '结算周期', render: item => asText(dataOf(item).settlement_cycle, '--')}, status],
    contracts: [baseName('合同编号'), {label: '甲方项目', render: item => relation.project(dataOf(item).lessor_project_id ?? dataOf(item).project_id)}, {label: '甲方分期', render: item => asText(dataOf(item).lessor_phase_name)}, {label: '业主方', render: item => asText(dataOf(item).lessor_owner_name)}, {label: '乙方门店', render: item => relation.store(dataOf(item).store_id)}, {label: '乙方租户', render: item => relation.tenant(dataOf(item).tenant_id)}, {label: '乙方品牌', render: item => relation.brand(dataOf(item).brand_id)}, status, {label: '开始日期', render: item => formatDate(dataOf(item).start_date)}, {label: '结束日期', render: item => formatDate(dataOf(item).end_date)}, {label: '计费模式', render: item => asText(dataOf(item).billing_mode ?? dataOf(item).commission_type)}],
    stores: [baseName('门店'), {label: '铺位编码', render: item => asText(dataOf(item).unit_code)}, {label: '楼层', render: item => asText(dataOf(item).floor)}, {label: '面积', render: item => asText(dataOf(item).area_sqm, '--')}, {label: '合作模式', render: item => enumLabel(dataOf(item).store_type)}, {label: '当前租户', render: item => relation.tenant(dataOf(item).tenant_id)}, {label: '当前品牌', render: item => relation.brand(dataOf(item).brand_id)}, {label: '合同状态', render: item => <StatusBadge value={asText(dataOf(item).contract_status, dataOf(item).active_contract_id ? 'ACTIVE' : 'NO_CONTRACT')} />}, {label: '合同到期', render: item => contractEndDateForStore(item.entityId, collections)}, {label: '营业状态', render: item => <StatusBadge value={asText(dataOf(item).operating_status, 'PREPARING')} />}],
    tables: [baseName('桌台'), {label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '桌台号', render: item => asText(dataOf(item).table_no)}, {label: '区域', render: item => enumLabel(dataOf(item).area)}, {label: '桌台类型', render: item => enumLabel(dataOf(item).table_type)}, {label: '容量', render: item => asText(dataOf(item).capacity)}, {label: '可预订配置', render: item => yesNo(dataOf(item).reservable)}, {label: '最低消费', render: item => dataOf(item).minimum_spend ? money(dataOf(item).minimum_spend) : '--'}, {label: '消费者说明', render: item => asText(dataOf(item).consumer_description, '--')}, {label: '排序', render: item => asText(dataOf(item).sort_order)}, status],
    workstations: [baseName('工作站'), {label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '编码', render: item => asText(dataOf(item).workstation_code)}, {label: '类型', render: item => enumLabel(dataOf(item).workstation_type)}, {label: '负责出品品类', render: item => asArray(dataOf(item).responsible_categories ?? dataOf(item).category_codes).map(enumLabel).join('、') || '--'}, {label: '说明', render: item => asText(dataOf(item).description, '--')}, status],
    permissions: [baseName('权限名称'), {label: '权限编码', render: item => asText(dataOf(item).permission_code)}, {label: '类型', render: item => enumLabel(dataOf(item).permission_type)}, {label: '被角色使用', render: item => collections.roles.filter(role => asArray(dataOf(role).permission_ids).includes(item.entityId)).length}, status],
    roles: [baseName('角色名称'), {label: '角色编码', render: item => asText(dataOf(item).role_code)}, {label: '角色来源', render: item => enumLabel(dataOf(item).role_source ?? dataOf(item).role_type)}, {label: '授权范围', render: item => scopeLabel(dataOf(item).scope_type)}, {label: '权限数', render: item => asArray(dataOf(item).permission_ids).length}, {label: '用户数', render: item => collections.roleBindings.filter(binding => dataOf(binding).role_id === item.entityId && binding.status === 'ACTIVE').length}, status],
    users: [baseName('姓名'), {label: '用户编码', render: item => asText(dataOf(item).user_code)}, {label: '手机号', render: item => asText(dataOf(item).mobile)}, {label: '所属门店', render: item => relation.store(dataOf(item).store_id)}, {label: '角色数', render: item => collections.roleBindings.filter(binding => dataOf(binding).user_id === item.entityId && binding.status === 'ACTIVE').length}, status],
    roleBindings: [{label: '用户', render: item => relationName(collections.users, dataOf(item).user_id)}, {label: '角色', render: item => relation.role(dataOf(item).role_id)}, {label: '授权范围', render: item => scopeSelectorLabel(dataOf(item).scope_selector, collections)}, {label: '门店', render: item => relation.store(dataOf(item).store_id)}, {label: '策略效果', render: item => enumLabel(dataOf(item).policy_effect)}, status],
    productCategories: [baseName('分类名称'), {label: '分类编码', render: item => asText(dataOf(item).category_code)}, {label: '归属范围', render: item => enumLabel(dataOf(item).ownership_scope)}, {label: '归属对象', render: item => asText(dataOf(item).ownership_scope) === 'STORE' ? relation.store(dataOf(item).store_id ?? dataOf(item).owner_id) : relation.brand(dataOf(item).brand_id ?? dataOf(item).owner_id)}, {label: '父级分类', render: item => relationName(collections.productCategories, dataOf(item).parent_category_id)}, {label: '商品数', render: item => collections.products.filter(product => dataOf(product).category_id === item.entityId).length}, {label: '排序', render: item => asText(dataOf(item).sort_order)}, status],
    products: [imageThumb('image_url', '无图'), baseName('商品名称'), {label: '商品编码', render: item => asText(dataOf(item).product_code)}, {label: '商品类型', render: item => enumLabel(dataOf(item).product_type)}, {label: '商品分类', render: item => productCategoryName(dataOf(item).category_id, collections)}, {label: '归属', render: item => productScopeName(item, collections)}, {label: '基础价格', render: item => money(dataOf(item).base_price)}, {label: '规格', render: item => asArray(dataOf(item).variants).length}, {label: '加料组', render: item => asArray(dataOf(item).modifier_groups).length}, {label: '套餐项', render: item => asArray(dataOf(item).combo_items).length + asArray(dataOf(item).combo_item_groups).length}, {label: '制作画像', render: item => productProductionSummary(item)}, {label: '在用菜单数', render: item => productMenuUsage(item.entityId, [...collections.brandMenus, ...collections.storeMenus])}, status],
    brandMenus: [baseName('菜单名称'), {label: '所属品牌', render: item => relation.brand(dataOf(item).brand_id)}, {label: '渠道', render: item => enumLabel(dataOf(item).channel_type)}, {label: '审核状态', render: item => enumLabel(dataOf(item).review_status)}, {label: '生效日期', render: item => formatDate(dataOf(item).effective_from)}, {label: '分区数', render: item => asArray(dataOf(item).sections).length}, {label: '商品数', render: item => sectionProductCount(item)}, {label: '版本', render: item => asText(dataOf(item).version)}, status],
    storeMenus: [baseName('菜单名称'), {label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '来源品牌菜单', render: item => relationName(collections.brandMenus, dataOf(item).brand_menu_id)}, {label: '渠道', render: item => enumLabel(dataOf(item).channel_type)}, {label: '菜单类型', render: item => enumLabel(dataOf(item).menu_type)}, {label: '继承模式', render: item => enumLabel(dataOf(item).inherit_mode)}, {label: '分区数', render: item => asArray(dataOf(item).sections).length}, {label: '商品数', render: item => sectionProductCount(item)}, {label: '版本哈希', render: item => asText(dataOf(item).version_hash)}, status],
    storeConfig: [{label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '营业状态', render: item => <StatusBadge value={asText(dataOf(item).business_status ?? dataOf(item).operating_status, item.status)} />}, {label: '营业时间', render: item => businessHoursLabel(dataOf(item))}, {label: '渠道入口', render: item => yesNo(dataOf(item).accept_order)}, {label: '自动确认', render: item => yesNo(dataOf(item).auto_accept_enabled)}, {label: '确认等待', render: item => `${asText(dataOf(item).accept_timeout_seconds, '--')} 秒`}, {label: '备餐缓冲', render: item => `${asText(dataOf(item).preparation_buffer_minutes, '--')} 分钟`}, {label: '入口容量', render: item => asText(dataOf(item).max_concurrent_orders, '不限制')}, updated],
    stock: [{label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '商品', render: item => relationName(collections.products, dataOf(item).product_id, item.title)}, {label: '库存口径', render: item => enumLabel(dataOf(item).stock_granularity)}, {label: '总量', render: item => asText(dataOf(item).total_quantity, '不限量')}, {label: '已售汇总', render: item => asText(dataOf(item).sold_quantity)}, {label: '下游占用汇总', render: item => asText(dataOf(item).reserved_quantity)}, {label: '可售数量', render: item => asText(dataOf(item).saleable_quantity ?? dataOf(item).available_quantity)}, {label: '安全库存', render: item => asText(dataOf(item).safety_stock)}, {label: '预警', render: item => asNumber(dataOf(item).saleable_quantity ?? dataOf(item).available_quantity) <= asNumber(dataOf(item).safety_stock) ? <StatusBadge value="LOW_STOCK" /> : <StatusBadge value="正常" />}, status],
    availabilityRules: [baseName('规则编码'), {label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '商品', render: item => relationName(collections.products, dataOf(item).product_id, '全部商品')}, {label: '规则类型', render: item => enumLabel(dataOf(item).rule_type)}, {label: '渠道', render: item => enumLabel(dataOf(item).channel_type)}, {label: '时段', render: item => timeSlotLabel(dataOf(item).time_slot)}, {label: '每日限量', render: item => asText(dataOf(item).daily_quota, '--')}, {label: '优先级', render: item => asText(dataOf(item).priority)}, {label: '可售', render: item => yesNo(dataOf(item).available)}, {label: '启用', render: item => yesNo(dataOf(item).enabled)}, status],
    availability: [{label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '商品', render: item => relationName(collections.products, dataOf(item).product_id, item.title)}, {label: '可售状态', render: item => <StatusBadge value={dataOf(item).available === false ? '不可售' : '可售'} />}, {label: '不可售原因', render: item => asText(dataOf(item).sold_out_reason)}, {label: '生效时间', render: item => formatDateTime(dataOf(item).effective_from)}],
    priceRules: [baseName('规则名称'), {label: '所属项目 / 门店', render: item => storeNameWithProject(dataOf(item).store_id, collections)}, {label: '适用商品', render: item => asArray(dataOf(item).applicable_product_ids).length ? asArray(dataOf(item).applicable_product_ids).map(id => relationName(collections.products, id)).join('、') : relationName(collections.products, dataOf(item).product_id, '全部商品')}, {label: '价格类型', render: item => enumLabel(dataOf(item).price_type)}, {label: '渠道类型', render: item => enumLabel(dataOf(item).channel_type)}, {label: '时间段', render: item => timeSlotLabel(dataOf(item).time_slot)}, {label: '会员等级', render: item => enumLabel(dataOf(item).member_tier ?? 'NONE')}, {label: '优先级', render: item => asText(dataOf(item).priority)}, {label: '价格/优惠值', render: item => asText(dataOf(item).price_value ?? dataOf(item).discount_value ?? dataOf(item).price_delta)}, status],
  }
  return config[page] ?? [baseName(), status, updated]
}
