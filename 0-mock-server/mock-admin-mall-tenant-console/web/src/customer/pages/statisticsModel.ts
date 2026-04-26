import type {CollectionState, CustomerEntity, OutboxItem, PageKey} from '../types'
import {asNumber, asText, dataOf, enumLabel, expiringContracts, formatDate, relationName, sectionProductCount} from '../domain'

export type StatisticKpi = {
  label: string
  value: string
  helper: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}

export type StatisticHealth = {
  label: string
  value: string
  detail: string
  ratio: number
  tone: 'good' | 'warn' | 'bad'
}

export type DistributionBucket = {
  label: string
  count: number
  ratio: number
}

export type DistributionPanel = {
  title: string
  subtitle: string
  buckets: DistributionBucket[]
}

export type RiskItem = {
  level: '高' | '中' | '低'
  title: string
  detail: string
  page: PageKey
}

export type ProjectSnapshot = {
  id: string
  title: string
  region: string
  businessMode: string
  stores: number
  operatingStores: number
  contractCoverage: number
  tenantBrands: number
}

export type BrandSnapshot = {
  id: string
  title: string
  category: string
  stores: number
  products: number
  brandMenus: number
  menuProducts: number
  standardMenuEnabled: boolean
}

export type StatisticsModel = {
  kpis: StatisticKpi[]
  health: StatisticHealth[]
  distributions: DistributionPanel[]
  risks: RiskItem[]
  projectSnapshots: ProjectSnapshot[]
  brandSnapshots: BrandSnapshot[]
  iam: StatisticKpi[]
  commercial: StatisticKpi[]
}

type ScopedCollections = {
  platforms: CustomerEntity[]
  projects: CustomerEntity[]
  tenants: CustomerEntity[]
  brands: CustomerEntity[]
  contracts: CustomerEntity[]
  stores: CustomerEntity[]
  tables: CustomerEntity[]
  workstations: CustomerEntity[]
  permissions: CustomerEntity[]
  roles: CustomerEntity[]
  users: CustomerEntity[]
  roleBindings: CustomerEntity[]
  products: CustomerEntity[]
  brandMenus: CustomerEntity[]
  storeMenus: CustomerEntity[]
  storeConfig: CustomerEntity[]
  stock: CustomerEntity[]
  availability: CustomerEntity[]
  priceRules: CustomerEntity[]
  outbox: OutboxItem[]
}

export function buildStatistics(collections: CollectionState, outbox: OutboxItem[], platformId: string): StatisticsModel {
  const scoped = scopeCollections(collections, outbox, platformId)
  const activeContracts = scoped.contracts.filter(item => item.status === 'ACTIVE')
  const expiring = expiringContracts(scoped.contracts)
  const failedOutbox = scoped.outbox.filter(item => item.status === 'FAILED')
  const processingOutbox = scoped.outbox.filter(item => item.status === 'PROCESSING')
  const lowStock = scoped.stock.filter(item => isLowStock(item))
  const storesWithoutContract = scoped.stores.filter(store => !hasActiveContract(store, scoped.contracts))
  const invalidMenus = scoped.storeMenus.filter(menu => menu.status === 'INVALID')
  const operatingStores = scoped.stores.filter(store => ['OPERATING', 'OPEN'].includes(asText(dataOf(store).operating_status, store.status)))
  const distinctProjectRegions = new Set(scoped.projects.map(projectRegionLabel).filter(label => label !== '未设置')).size
  const activeBindings = scoped.roleBindings.filter(binding => binding.status === 'ACTIVE')

  const kpis: StatisticKpi[] = [
    {label: '项目', value: String(scoped.projects.length), helper: `${distinctProjectRegions || 0} 个大区，${countDistinct(scoped.projects, projectBusinessModeLabel)} 类业态`},
    {label: '门店', value: String(scoped.stores.length), helper: `${operatingStores.length} 家营业中，${storesWithoutContract.length} 家需看合同`, tone: storesWithoutContract.length ? 'warn' : 'good'},
    {label: '有效合同', value: String(activeContracts.length), helper: `${expiring.length} 份 30 天内到期`, tone: expiring.length ? 'warn' : 'good'},
    {label: '租户 / 品牌', value: `${scoped.tenants.length} / ${scoped.brands.length}`, helper: '按当前平台归属与合同关系统计'},
    {label: '商品 / 菜单', value: `${scoped.products.length} / ${scoped.brandMenus.length + scoped.storeMenus.length}`, helper: `${scoped.priceRules.length} 条价格规则`},
    {label: '投影风险', value: String(failedOutbox.length), helper: `${processingOutbox.length} 条处理中`, tone: failedOutbox.length ? 'bad' : 'good'},
  ]

  const health: StatisticHealth[] = [
    healthMetric('门店合同覆盖率', scoped.stores.length - storesWithoutContract.length, scoped.stores.length, '有生效合同的门店占比'),
    healthMetric('品牌标准菜单率', scoped.brands.filter(brand => Boolean(dataOf(brand).standard_menu_enabled)).length, scoped.brands.length, '已启用标准菜单的品牌占比'),
    healthMetric('门店菜单有效率', scoped.storeMenus.length - invalidMenus.length, scoped.storeMenus.length, '可直接投射到门店终端的菜单占比'),
    healthMetric('库存健康度', scoped.stock.length - lowStock.length, scoped.stock.length, '高于安全库存的商品库存占比'),
    healthMetric('投影成功率', scoped.outbox.length - failedOutbox.length, scoped.outbox.length, '当前平台主数据投影无失败的比例'),
  ]

  const risks: RiskItem[] = [
    ...failedOutbox.slice(0, 3).map(item => ({level: '高' as const, title: `投影失败：${topicTitle(item.topicKey)}`, detail: item.lastError ?? item.itemKey, page: 'projectionOutbox' as PageKey})),
    ...expiring.slice(0, 3).map(item => ({level: '中' as const, title: `合同即将到期：${item.title}`, detail: `到期日 ${formatDate(dataOf(item).end_date)}，请提前续签或终止`, page: 'contracts' as PageKey})),
    ...storesWithoutContract.slice(0, 3).map(item => ({level: '中' as const, title: `门店缺少生效合同：${item.title}`, detail: `铺位 ${asText(dataOf(item).unit_code)}，当前租户 ${relationName(scoped.tenants, dataOf(item).tenant_id, '空置')}`, page: 'stores' as PageKey})),
    ...lowStock.slice(0, 3).map(item => ({level: '低' as const, title: `库存低于安全线：${relationName(scoped.products, dataOf(item).product_id, item.title)}`, detail: `可售 ${asText(dataOf(item).saleable_quantity)}，安全库存 ${asText(dataOf(item).safety_stock)}`, page: 'stock' as PageKey})),
  ].slice(0, 8)

  return {
    kpis,
    health,
    distributions: [
      distributionPanel('项目大区分布', '快速判断集团项目是否集中在某些大区', scoped.projects, projectRegionLabel),
      distributionPanel('项目业态分布', '奥莱、百货、购物中心等业态占比', scoped.projects, projectBusinessModeLabel),
      distributionPanel('门店营业状态', '门店当前经营状态结构', scoped.stores, item => enumLabel(dataOf(item).operating_status ?? item.status)),
      distributionPanel('合同状态分布', '合同生命周期健康度', scoped.contracts, item => enumLabel(item.status)),
    ],
    risks,
    projectSnapshots: scoped.projects
      .map(project => projectSnapshot(project, scoped))
      .sort((a, b) => b.stores - a.stores || a.title.localeCompare(b.title, 'zh-CN'))
      .slice(0, 8),
    brandSnapshots: scoped.brands
      .map(brand => brandSnapshot(brand, scoped))
      .sort((a, b) => b.stores - a.stores || b.products - a.products || a.title.localeCompare(b.title, 'zh-CN'))
      .slice(0, 8),
    iam: [
      {label: '用户', value: String(scoped.users.length), helper: `${activeBindings.length} 条有效授权`},
      {label: '角色', value: String(scoped.roles.length), helper: `${scoped.roles.filter(role => asText(dataOf(role).role_source ?? dataOf(role).role_type) === 'CUSTOM').length} 个自定义角色`},
      {label: '权限', value: String(scoped.permissions.length), helper: '系统权限与自定义权限总数'},
      {label: '授权记录', value: String(scoped.roleBindings.length), helper: `${scoped.roleBindings.length - activeBindings.length} 条非生效记录`},
    ],
    commercial: [
      {label: '桌台', value: String(scoped.tables.length), helper: `${countDistinct(scoped.tables, item => asText(dataOf(item).store_id, ''))} 家门店已配置`},
      {label: '工作站', value: String(scoped.workstations.length), helper: '门店出品能力配置'},
      {label: '可售商品', value: String(scoped.availability.filter(item => dataOf(item).available !== false).length), helper: `${scoped.availability.length} 条可售状态记录`},
      {label: '异常菜单', value: String(invalidMenus.length), helper: `${scoped.storeMenus.length} 份门店菜单`, tone: invalidMenus.length ? 'bad' : 'good'},
    ],
  }
}

function scopeCollections(collections: CollectionState, outbox: OutboxItem[], platformId: string): ScopedCollections {
  const platforms = platformId ? collections.platforms.filter(item => item.entityId === platformId) : collections.platforms
  const projects = collections.projects.filter(item => !platformId || itemPlatformId(item, collections) === platformId)
  const projectIds = idsOf(projects)
  const stores = collections.stores.filter(item => !platformId || projectIds.has(asText(dataOf(item).project_id, '')) || itemPlatformId(item, collections) === platformId)
  const storeIds = idsOf(stores)
  const contracts = collections.contracts.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || projectIds.has(asText(dataOf(item).project_id, '')) || itemPlatformId(item, collections) === platformId)
  const tenantIds = idsFromRelations(contracts, stores, 'tenant_id')
  const brandIds = idsFromRelations(contracts, stores, 'brand_id')
  const tenants = collections.tenants.filter(item => !platformId || itemPlatformId(item, collections) === platformId || tenantIds.has(item.entityId))
  const brands = collections.brands.filter(item => !platformId || itemPlatformId(item, collections) === platformId || brandIds.has(item.entityId))
  brands.forEach(item => brandIds.add(item.entityId))
  tenants.forEach(item => tenantIds.add(item.entityId))
  const products = collections.products.filter(item => !platformId || brandIds.has(asText(dataOf(item).brand_id, '')) || itemPlatformId(item, collections) === platformId)
  const productIds = idsOf(products)
  const brandMenus = collections.brandMenus.filter(item => !platformId || brandIds.has(asText(dataOf(item).brand_id, '')) || itemPlatformId(item, collections) === platformId)
  const storeMenus = collections.storeMenus.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const tables = collections.tables.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const workstations = collections.workstations.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const storeConfig = collections.storeConfig.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const stock = collections.stock.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || productIds.has(asText(dataOf(item).product_id, '')) || itemPlatformId(item, collections) === platformId)
  const availability = collections.availability.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || productIds.has(asText(dataOf(item).product_id, '')) || itemPlatformId(item, collections) === platformId)
  const priceRules = collections.priceRules.filter(item => !platformId || storeIds.has(asText(dataOf(item).store_id, '')) || productIds.has(asText(dataOf(item).product_id, '')) || itemPlatformId(item, collections) === platformId)
  const permissions = collections.permissions.filter(item => !platformId || itemPlatformId(item, collections) === platformId)
  const roles = collections.roles.filter(item => !platformId || itemPlatformId(item, collections) === platformId)
  const roleIds = idsOf(roles)
  const roleBindings = collections.roleBindings.filter(item => !platformId || roleIds.has(asText(dataOf(item).role_id, '')) || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const userIds = idsFromRelations(roleBindings, [], 'user_id')
  const users = collections.users.filter(item => !platformId || userIds.has(item.entityId) || storeIds.has(asText(dataOf(item).store_id, '')) || itemPlatformId(item, collections) === platformId)
  const scopedIds = new Set([
    ...platforms.map(item => item.entityId),
    ...projects.map(item => item.entityId),
    ...stores.map(item => item.entityId),
    ...contracts.map(item => item.entityId),
    ...tenants.map(item => item.entityId),
    ...brands.map(item => item.entityId),
    ...products.map(item => item.entityId),
    ...brandMenus.map(item => item.entityId),
    ...storeMenus.map(item => item.entityId),
  ])
  const scopedOutbox = outbox.filter(item => !platformId || scopedIds.has(item.scopeKey) || scopedIds.has(item.itemKey) || item.scopeKey === platformId || JSON.stringify(item.payload).includes(platformId))
  return {platforms, projects, tenants, brands, contracts, stores, tables, workstations, permissions, roles, users, roleBindings, products, brandMenus, storeMenus, storeConfig, stock, availability, priceRules, outbox: scopedOutbox}
}

function idsOf(items: CustomerEntity[]) {
  return new Set(items.map(item => item.entityId))
}

function idsFromRelations(primary: CustomerEntity[], secondary: CustomerEntity[], key: string) {
  const values = new Set<string>()
  ;[...primary, ...secondary].forEach(item => {
    const value = asText(dataOf(item)[key], '')
    if (value) values.add(value)
  })
  return values
}

function itemPlatformId(item: CustomerEntity | undefined, collections: CollectionState): string {
  if (!item) return ''
  const data = dataOf(item)
  if (item.entityType === 'platform') return item.entityId
  if (data.platform_id) return asText(data.platform_id, '')
  if (item.naturalScopeType === 'PLATFORM') return item.naturalScopeKey ?? ''
  const brandId = asText(data.brand_id, '')
  if (brandId) return itemPlatformId(collections.brands.find(brand => brand.entityId === brandId), collections)
  const projectId = asText(data.project_id, '')
  if (projectId) return asText(dataOf(collections.projects.find(project => project.entityId === projectId)).platform_id, '')
  const storeId = asText(data.store_id, '')
  if (storeId) {
    const store = collections.stores.find(entry => entry.entityId === storeId)
    const storeProjectId = asText(dataOf(store).project_id, '')
    return asText(dataOf(collections.projects.find(project => project.entityId === storeProjectId)).platform_id, '')
  }
  const roleId = asText(data.role_id, '')
  if (roleId) return itemPlatformId(collections.roles.find(role => role.entityId === roleId), collections)
  return ''
}

function healthMetric(label: string, goodCount: number, total: number, detail: string): StatisticHealth {
  const ratio = total > 0 ? Math.round((goodCount / total) * 100) : 100
  const tone = ratio >= 90 ? 'good' : ratio >= 70 ? 'warn' : 'bad'
  return {label, value: `${ratio}%`, detail: `${goodCount}/${total}，${detail}`, ratio, tone}
}

function distributionPanel(title: string, subtitle: string, items: CustomerEntity[], labelFor: (item: CustomerEntity) => string): DistributionPanel {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const label = labelFor(item) || '未设置'
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})
  const total = Math.max(1, items.length)
  const buckets = Object.entries(counts)
    .map(([label, count]) => ({label, count, ratio: Math.round((count / total) * 100)}))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
  return {title, subtitle, buckets}
}

function projectRegionLabel(project: CustomerEntity) {
  const region = dataOf(project).region
  if (typeof region === 'object' && region !== null && !Array.isArray(region)) {
    const record = region as Record<string, unknown>
    return asText(record.region_name, enumLabel(record.region_code))
  }
  return enumLabel(region)
}

function projectBusinessModeLabel(project: CustomerEntity) {
  return enumLabel(dataOf(project).business_mode || '未设置')
}

function projectSnapshot(project: CustomerEntity, scoped: ScopedCollections): ProjectSnapshot {
  const stores = scoped.stores.filter(store => asText(dataOf(store).project_id, '') === project.entityId)
  const activeStores = stores.filter(store => ['OPERATING', 'OPEN'].includes(asText(dataOf(store).operating_status, store.status))).length
  const storesWithContract = stores.filter(store => hasActiveContract(store, scoped.contracts)).length
  const tenantBrandPairs = new Set(stores.map(store => `${asText(dataOf(store).tenant_id)}:${asText(dataOf(store).brand_id)}`))
  return {
    id: project.entityId,
    title: project.title,
    region: projectRegionLabel(project),
    businessMode: projectBusinessModeLabel(project),
    stores: stores.length,
    operatingStores: activeStores,
    contractCoverage: stores.length > 0 ? Math.round((storesWithContract / stores.length) * 100) : 100,
    tenantBrands: tenantBrandPairs.size,
  }
}

function brandSnapshot(brand: CustomerEntity, scoped: ScopedCollections): BrandSnapshot {
  const products = scoped.products.filter(product => asText(dataOf(product).brand_id, '') === brand.entityId)
  const brandMenus = scoped.brandMenus.filter(menu => asText(dataOf(menu).brand_id, '') === brand.entityId)
  const stores = scoped.stores.filter(store => asText(dataOf(store).brand_id, '') === brand.entityId)
  return {
    id: brand.entityId,
    title: brand.title,
    category: asText(dataOf(brand).brand_category, '--'),
    stores: stores.length,
    products: products.length,
    brandMenus: brandMenus.length,
    menuProducts: brandMenus.reduce((total, menu) => total + sectionProductCount(menu), 0),
    standardMenuEnabled: Boolean(dataOf(brand).standard_menu_enabled),
  }
}

function hasActiveContract(store: CustomerEntity, contracts: CustomerEntity[]) {
  const data = dataOf(store)
  if (data.active_contract_id || asText(data.contract_status, '') === 'ACTIVE') return true
  return contracts.some(contract => asText(dataOf(contract).store_id, '') === store.entityId && contract.status === 'ACTIVE')
}

function isLowStock(item: CustomerEntity) {
  return asNumber(dataOf(item).saleable_quantity) <= asNumber(dataOf(item).safety_stock)
}

function countDistinct(items: CustomerEntity[], labelFor: (item: CustomerEntity) => string) {
  return new Set(items.map(labelFor).filter(Boolean)).size
}

function topicTitle(topicKey: string) {
  return topicKey.split('.').slice(-2).join(' / ')
}
