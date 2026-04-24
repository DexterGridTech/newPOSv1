import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DEFAULT_SANDBOX_ID} from '../shared/constants.js'
import {createId, now, serializeJson} from '../shared/utils.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataFile = process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE?.trim()
  ? path.resolve(process.cwd(), process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE.trim())
  : path.resolve(currentDir, '../../data/mock-admin-mall-tenant-console.sqlite')
fs.mkdirSync(path.dirname(dataFile), {recursive: true})

export const sqlite = new Database(dataFile)

const DEFAULT_SCOPE_IDS = {
  platformId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PLATFORM_ID?.trim() || 'platform-kernel-base-test',
  projectId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PROJECT_ID?.trim() || 'project-kernel-base-test',
  tenantId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_TENANT_ID?.trim() || 'tenant-kernel-base-test',
  brandId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_BRAND_ID?.trim() || 'brand-kernel-base-test',
  storeId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_STORE_ID?.trim() || 'store-kernel-base-test',
  contractId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_CONTRACT_ID?.trim() || 'contract-kernel-base-test',
  unitCode: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_UNIT_CODE?.trim() || 'KB001',
} as const

const createOrganizationEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'organization',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: DEFAULT_SCOPE_IDS.platformId,
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createIamEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'iam',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: DEFAULT_SCOPE_IDS.platformId,
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createCateringProductEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'catering_product',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: DEFAULT_SCOPE_IDS.platformId,
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createCateringStoreOperationEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'catering_store_operation',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: DEFAULT_SCOPE_IDS.platformId,
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

export interface ProjectionOutboxSeedInput {
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  operation?: 'upsert' | 'delete'
  payload: Record<string, unknown>
  targetTerminalIds?: string[]
}

export const enqueueProjectionOutbox = (input: ProjectionOutboxSeedInput) => {
  const timestamp = now()
  const sourceEventId = typeof input.payload.source_event_id === 'string' && input.payload.source_event_id.trim()
    ? input.payload.source_event_id.trim()
    : createId('evt')
  const sourceRevision = typeof input.payload.source_revision === 'number'
    ? input.payload.source_revision
    : 1
  sqlite.prepare(`
    INSERT INTO projection_outbox (
      outbox_id, sandbox_id, source_service, source_event_id, source_revision, topic_key, scope_type, scope_key,
      item_key, operation, payload_json, target_terminal_ids_json, status, attempt_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('outbox'),
    DEFAULT_SANDBOX_ID,
    'mock-admin-mall-tenant-console',
    sourceEventId,
    sourceRevision,
    input.topicKey,
    input.scopeType,
    input.scopeKey,
    input.itemKey,
    input.operation ?? 'upsert',
    serializeJson(input.payload),
    serializeJson(input.targetTerminalIds ?? []),
    'PENDING',
    0,
    timestamp,
    timestamp,
  )
}

const seedOutboxForRows = (input: ProjectionOutboxSeedInput) => {
  enqueueProjectionOutbox(input)
}

type SeedDoc = {
  docId: string
  domain: string
  entityType: string
  entityId: string
  naturalScopeType: string
  naturalScopeKey: string
  title: string
  status: string
  sourceRevision: number
  payload: Record<string, unknown>
}

type SeedOutboxSpec = {
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  payload: Record<string, unknown>
}

const createSeedDoc = (input: Omit<SeedDoc, 'docId'>): SeedDoc => ({
  docId: createId('doc'),
  ...input,
})

const seedProjectionTopics: Record<string, {topicKey: string; scopeType: string; itemKeyField: string} | undefined> = {
  platform: {topicKey: 'org.platform.profile', scopeType: 'PLATFORM', itemKeyField: 'platform_id'},
  project: {topicKey: 'org.project.profile', scopeType: 'PROJECT', itemKeyField: 'project_id'},
  tenant: {topicKey: 'org.tenant.profile', scopeType: 'TENANT', itemKeyField: 'tenant_id'},
  brand: {topicKey: 'org.brand.profile', scopeType: 'BRAND', itemKeyField: 'brand_id'},
  store: {topicKey: 'org.store.profile', scopeType: 'STORE', itemKeyField: 'store_id'},
  contract: {topicKey: 'org.contract.active', scopeType: 'STORE', itemKeyField: 'contract_id'},
  business_entity: {topicKey: 'org.business-entity.profile', scopeType: 'TENANT', itemKeyField: 'entity_id'},
  table: {topicKey: 'org.table.profile', scopeType: 'STORE', itemKeyField: 'table_id'},
  workstation: {topicKey: 'org.workstation.profile', scopeType: 'STORE', itemKeyField: 'workstation_id'},
  permission: {topicKey: 'iam.permission.catalog', scopeType: 'PLATFORM', itemKeyField: 'permission_id'},
  role: {topicKey: 'iam.role.catalog', scopeType: 'PLATFORM', itemKeyField: 'role_id'},
  user: {topicKey: 'iam.user.store-effective', scopeType: 'STORE', itemKeyField: 'user_id'},
  user_role_binding: {topicKey: 'iam.user-role-binding.store-effective', scopeType: 'STORE', itemKeyField: 'binding_id'},
  product: {topicKey: 'catering.product.profile', scopeType: 'BRAND', itemKeyField: 'product_id'},
  brand_menu: {topicKey: 'catering.brand-menu.profile', scopeType: 'BRAND', itemKeyField: 'brand_menu_id'},
  menu_catalog: {topicKey: 'menu.catalog', scopeType: 'STORE', itemKeyField: 'menu_id'},
  menu_availability: {topicKey: 'menu.availability', scopeType: 'STORE', itemKeyField: 'product_id'},
  availability_rule: {topicKey: 'catering.availability-rule.profile', scopeType: 'STORE', itemKeyField: 'rule_id'},
  saleable_stock: {topicKey: 'catering.saleable-stock.profile', scopeType: 'STORE', itemKeyField: 'stock_id'},
  stock_reservation: {topicKey: 'catering.stock-reservation.active', scopeType: 'STORE', itemKeyField: 'reservation_id'},
  store_config: {topicKey: 'catering.store-config.profile', scopeType: 'STORE', itemKeyField: 'config_id'},
  price_rule: {topicKey: 'catering.price-rule.profile', scopeType: 'STORE', itemKeyField: 'rule_id'},
}

const toSeedOutboxSpec = (doc: SeedDoc): SeedOutboxSpec | undefined => {
  const topic = seedProjectionTopics[doc.entityType]
  const data = doc.payload.data as Record<string, unknown> | undefined
  const itemKey = data?.[topic?.itemKeyField ?? '']
  if (!topic || typeof itemKey !== 'string') {
    return undefined
  }
  return {
    topicKey: topic.topicKey,
    scopeType: topic.scopeType,
    scopeKey: doc.naturalScopeKey,
    itemKey,
    payload: doc.payload,
  }
}

const createChineseScenarioSeedDocs = (): SeedDoc[] => {
  const docs: SeedDoc[] = []
  const addOrganization = (input: Omit<SeedDoc, 'docId' | 'domain' | 'payload'> & {eventId: string; data: Record<string, unknown>}) => docs.push(createSeedDoc({
    domain: 'organization',
    entityType: input.entityType,
    entityId: input.entityId,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    title: input.title,
    status: input.status,
    sourceRevision: input.sourceRevision,
    payload: createOrganizationEnvelope({sourceEventId: input.eventId, sourceRevision: input.sourceRevision, data: input.data}),
  }))
  const addIam = (input: Omit<SeedDoc, 'docId' | 'domain' | 'payload'> & {eventId: string; data: Record<string, unknown>}) => docs.push(createSeedDoc({
    domain: 'iam',
    entityType: input.entityType,
    entityId: input.entityId,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    title: input.title,
    status: input.status,
    sourceRevision: input.sourceRevision,
    payload: createIamEnvelope({sourceEventId: input.eventId, sourceRevision: input.sourceRevision, data: input.data}),
  }))
  const addProduct = (input: Omit<SeedDoc, 'docId' | 'domain' | 'payload'> & {eventId: string; data: Record<string, unknown>}) => docs.push(createSeedDoc({
    domain: 'catering-product',
    entityType: input.entityType,
    entityId: input.entityId,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    title: input.title,
    status: input.status,
    sourceRevision: input.sourceRevision,
    payload: createCateringProductEnvelope({sourceEventId: input.eventId, sourceRevision: input.sourceRevision, data: input.data}),
  }))
  const addOperation = (input: Omit<SeedDoc, 'docId' | 'domain' | 'payload'> & {eventId: string; data: Record<string, unknown>}) => docs.push(createSeedDoc({
    domain: 'catering-store-operating',
    entityType: input.entityType,
    entityId: input.entityId,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    title: input.title,
    status: input.status,
    sourceRevision: input.sourceRevision,
    payload: createCateringStoreOperationEnvelope({sourceEventId: input.eventId, sourceRevision: input.sourceRevision, data: input.data}),
  }))

  addOrganization({
    entityType: 'platform',
    entityId: DEFAULT_SCOPE_IDS.platformId,
    naturalScopeType: 'PLATFORM',
    naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
    title: '中国商业综合体中台',
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: 'evt-cn-platform-001',
    data: {
      platform_id: DEFAULT_SCOPE_IDS.platformId,
      platform_code: 'CN_MALL_RETAIL_PLATFORM',
      platform_name: '中国商业综合体中台',
      status: 'ACTIVE',
      description: '覆盖万达集团与华润万象生活多购物中心、多品牌、多店铺的中文半真实主数据场景',
    },
  })

  const projects = [
    {projectId: DEFAULT_SCOPE_IDS.projectId, code: 'SH_WUJIAOCHANG_WANDA', name: '上海五角场万达广场', group: '万达集团', city: '上海', regionCode: 'CN-SH', unitPrefix: 'SHWD'},
    {projectId: 'project-nanjing-jianye-wanda', code: 'NJ_JIANYE_WANDA', name: '南京建邺万达广场', group: '万达集团', city: '南京', regionCode: 'CN-JS', unitPrefix: 'NJWD'},
    {projectId: 'project-shenzhen-mixc', code: 'SZ_MIXC', name: '深圳万象城', group: '华润万象生活', city: '深圳', regionCode: 'CN-GD', unitPrefix: 'SZMX'},
    {projectId: 'project-hangzhou-mixc', code: 'HZ_MIXC', name: '杭州万象城', group: '华润万象生活', city: '杭州', regionCode: 'CN-ZJ', unitPrefix: 'HZMX'},
  ]

  projects.forEach((project, index) => addOrganization({
    entityType: 'project',
    entityId: project.projectId,
    naturalScopeType: 'PROJECT',
    naturalScopeKey: project.projectId,
    title: project.name,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-project-${index + 1}`,
    data: {
      project_id: project.projectId,
      project_code: project.code,
      project_name: project.name,
      platform_id: DEFAULT_SCOPE_IDS.platformId,
      operator_group: project.group,
      region: {region_code: project.regionCode, region_name: project.city, parent_region_code: 'CN', region_level: 2},
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
    },
  }))

  const tenants = [
    {tenantId: DEFAULT_SCOPE_IDS.tenantId, code: 'TENANT_XIBEI', name: '西贝餐饮集团', category: '中餐'},
    {tenantId: 'tenant-nanjing-dapaidang', code: 'TENANT_NJDPD', name: '南京大牌档', category: '中餐'},
    {tenantId: 'tenant-nayuki', code: 'TENANT_NAYUKI', name: '奈雪的茶', category: '茶饮'},
    {tenantId: 'tenant-chagee', code: 'TENANT_CHAGEE', name: '霸王茶姬', category: '茶饮'},
  ]
  tenants.forEach((tenant, index) => addOrganization({
    entityType: 'tenant',
    entityId: tenant.tenantId,
    naturalScopeType: 'TENANT',
    naturalScopeKey: tenant.tenantId,
    title: tenant.name,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-tenant-${index + 1}`,
    data: {
      tenant_id: tenant.tenantId,
      tenant_code: tenant.code,
      tenant_name: tenant.name,
      tenant_category: tenant.category,
      platform_id: DEFAULT_SCOPE_IDS.platformId,
      status: 'ACTIVE',
    },
  }))

  const brands = [
    {brandId: DEFAULT_SCOPE_IDS.brandId, tenantId: DEFAULT_SCOPE_IDS.tenantId, code: 'BRAND_XIBEI', name: '西贝莜面村', category: '西北中餐'},
    {brandId: 'brand-nanjing-dapaidang', tenantId: 'tenant-nanjing-dapaidang', code: 'BRAND_NJDPD', name: '南京大牌档', category: '江南中餐'},
    {brandId: 'brand-nayuki', tenantId: 'tenant-nayuki', code: 'BRAND_NAYUKI', name: '奈雪的茶', category: '新式茶饮'},
    {brandId: 'brand-chagee', tenantId: 'tenant-chagee', code: 'BRAND_CHAGEE', name: '霸王茶姬', category: '原叶鲜奶茶'},
  ]
  brands.forEach((brand, index) => addOrganization({
    entityType: 'brand',
    entityId: brand.brandId,
    naturalScopeType: 'BRAND',
    naturalScopeKey: brand.brandId,
    title: brand.name,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-brand-${index + 1}`,
    data: {
      brand_id: brand.brandId,
      brand_code: brand.code,
      brand_name: brand.name,
      brand_category: brand.category,
      tenant_id: brand.tenantId,
      platform_id: DEFAULT_SCOPE_IDS.platformId,
      status: 'ACTIVE',
    },
  }))

  const stores = [
    {storeId: DEFAULT_SCOPE_IDS.storeId, code: 'STORE_XIBEI_SH_WANDA', name: '西贝莜面村 上海五角场万达店', tenantId: DEFAULT_SCOPE_IDS.tenantId, brandId: DEFAULT_SCOPE_IDS.brandId, projectId: DEFAULT_SCOPE_IDS.projectId, unitCode: DEFAULT_SCOPE_IDS.unitCode, floor: '5F', business: '正餐'},
    {storeId: 'store-njdpd-nj-wanda', code: 'STORE_NJDPD_NJ_WANDA', name: '南京大牌档 南京建邺万达店', tenantId: 'tenant-nanjing-dapaidang', brandId: 'brand-nanjing-dapaidang', projectId: 'project-nanjing-jianye-wanda', unitCode: 'NJWD-403', floor: '4F', business: '正餐'},
    {storeId: 'store-nayuki-sz-mixc', code: 'STORE_NAYUKI_SZ_MIXC', name: '奈雪的茶 深圳万象城店', tenantId: 'tenant-nayuki', brandId: 'brand-nayuki', projectId: 'project-shenzhen-mixc', unitCode: 'SZMX-B128', floor: 'B1', business: '茶饮'},
    {storeId: 'store-chagee-hz-mixc', code: 'STORE_CHAGEE_HZ_MIXC', name: '霸王茶姬 杭州万象城店', tenantId: 'tenant-chagee', brandId: 'brand-chagee', projectId: 'project-hangzhou-mixc', unitCode: 'HZMX-L215', floor: '2F', business: '茶饮'},
  ]
  stores.forEach((store, index) => {
    addOrganization({
      entityType: 'store',
      entityId: store.storeId,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: store.name,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-store-${index + 1}`,
      data: {
        store_id: store.storeId,
        store_code: store.code,
        store_name: store.name,
        business_type: store.business,
        unit_code: store.unitCode,
        floor: store.floor,
        platform_id: DEFAULT_SCOPE_IDS.platformId,
        project_id: store.projectId,
        tenant_id: store.tenantId,
        brand_id: store.brandId,
        status: 'ACTIVE',
      },
    })
    addOrganization({
      entityType: 'contract',
      entityId: index === 0 ? DEFAULT_SCOPE_IDS.contractId : `contract-${store.storeId}`,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${store.name} 2026 年租约`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-contract-${index + 1}`,
      data: {
        contract_id: index === 0 ? DEFAULT_SCOPE_IDS.contractId : `contract-${store.storeId}`,
        contract_code: `CONTRACT_${store.code}`,
        platform_id: DEFAULT_SCOPE_IDS.platformId,
        project_id: store.projectId,
        tenant_id: store.tenantId,
        brand_id: store.brandId,
        store_id: store.storeId,
        unit_code: store.unitCode,
        billing_mode: store.business === '茶饮' ? '保底租金+流水扣点' : '固定租金+物业费',
        start_date: '2026-01-01',
        end_date: '2028-12-31',
        status: 'ACTIVE',
      },
    })
  })

  const permissions = [
    ['perm-product-manage', 'PRODUCT_MANAGE', '商品与菜单维护'],
    ['perm-shift-open', 'SHIFT_OPEN', '开班收银'],
    ['perm-stock-adjust', 'STOCK_ADJUST', '库存调整'],
    ['perm-price-manage', 'PRICE_MANAGE', '门店价格管理'],
  ]
  permissions.forEach(([permissionId, permissionCode, permissionName], index) => addIam({
    entityType: 'permission',
    entityId: permissionId,
    naturalScopeType: 'PLATFORM',
    naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
    title: permissionName,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-permission-${index + 1}`,
    data: {permission_id: permissionId, permission_code: permissionCode, permission_name: permissionName, permission_type: 'SYSTEM', status: 'ACTIVE'},
  }))
  const roles = [
    {roleId: 'role-store-manager', code: 'STORE_MANAGER', name: '店长', permissionIds: ['perm-product-manage', 'perm-shift-open', 'perm-stock-adjust', 'perm-price-manage']},
    {roleId: 'role-shift-leader', code: 'SHIFT_LEADER', name: '值班主管', permissionIds: ['perm-shift-open', 'perm-stock-adjust']},
    {roleId: 'role-menu-operator', code: 'MENU_OPERATOR', name: '菜单运营', permissionIds: ['perm-product-manage', 'perm-price-manage']},
  ]
  roles.forEach((role, index) => addIam({
    entityType: 'role',
    entityId: role.roleId,
    naturalScopeType: 'PLATFORM',
    naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
    title: role.name,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-role-${index + 1}`,
    data: {role_id: role.roleId, role_code: role.code, role_name: role.name, role_source: 'CUSTOM', scope_type: 'ORG_NODE', permission_ids: role.permissionIds, status: 'ACTIVE'},
  }))
  const userNames = ['李梅', '周亮', '陈雨桐', '王梓涵']
  stores.forEach((store, index) => {
    const userId = index === 0 ? 'user-linmei' : `user-manager-${store.storeId}`
    addIam({
      entityType: 'user',
      entityId: userId,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${userNames[index]} · ${store.name}`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-user-${index + 1}`,
      data: {user_id: userId, user_code: `manager.${store.code.toLowerCase()}`, display_name: userNames[index], mobile: `1380000000${index + 1}`, store_id: store.storeId, status: 'ACTIVE'},
    })
    addIam({
      entityType: 'user_role_binding',
      entityId: index === 0 ? 'binding-linmei-manager' : `binding-manager-${store.storeId}`,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${userNames[index]} 店长授权`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-binding-${index + 1}`,
      data: {
        binding_id: index === 0 ? 'binding-linmei-manager' : `binding-manager-${store.storeId}`,
        user_id: userId,
        role_id: 'role-store-manager',
        store_id: store.storeId,
        scope_selector: {scope_type: 'ORG_NODE', scope_key: store.storeId, org_node_id: store.storeId},
        policy_effect: 'ALLOW',
        status: 'ACTIVE',
      },
    })
  })

  const brandProducts = [
    {brandId: DEFAULT_SCOPE_IDS.brandId, prefix: 'xibei', products: [['手把肉夹馍套餐', 68], ['黄米凉糕', 28], ['草原羊肉串', 39]]},
    {brandId: 'brand-nanjing-dapaidang', prefix: 'njdpd', products: [['金陵盐水鸭', 88], ['美龄粥', 22], ['鸭血粉丝汤', 32]]},
    {brandId: 'brand-nayuki', prefix: 'nayuki', products: [['霸气芝士草莓', 32], ['葡萄乌龙宝藏茶', 29], ['软欧包·芋泥麻薯', 26]]},
    {brandId: 'brand-chagee', prefix: 'chagee', products: [['伯牙绝弦', 19], ['桂馥兰香', 18], ['万里木兰', 20]]},
  ]
  brandProducts.forEach((brand, brandIndex) => {
    brand.products.forEach(([name, price], productIndex) => addProduct({
      entityType: 'product',
      entityId: productIndex === 0 && brand.brandId === DEFAULT_SCOPE_IDS.brandId ? 'product-salmon-bowl' : `product-${brand.prefix}-${productIndex + 1}`,
      naturalScopeType: 'BRAND',
      naturalScopeKey: brand.brandId,
      title: name as string,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-product-${brandIndex + 1}-${productIndex + 1}`,
      data: {
        product_id: productIndex === 0 && brand.brandId === DEFAULT_SCOPE_IDS.brandId ? 'product-salmon-bowl' : `product-${brand.prefix}-${productIndex + 1}`,
        brand_id: brand.brandId,
        product_name: name,
        ownership_scope: 'BRAND',
        product_type: productIndex === 2 ? 'ADD_ON' : 'STANDARD',
        base_price: price,
        production_steps: [{step_code: brand.prefix.includes('nayuki') || brand.prefix.includes('chagee') ? 'TEA_BAR' : 'HOT_KITCHEN', step_name: brand.prefix.includes('nayuki') || brand.prefix.includes('chagee') ? '茶饮制作' : '后厨制作', workstation_code: brand.prefix.includes('nayuki') || brand.prefix.includes('chagee') ? 'TEA_BAR' : 'HOT_KITCHEN'}],
        modifier_groups: [{modifier_group_id: `modifier-${brand.prefix}-taste`, group_name: '口味偏好', selection_type: 'MULTIPLE'}],
        status: 'ACTIVE',
      },
    }))
  })
  brands.forEach((brand, index) => addProduct({
    entityType: 'brand_menu',
    entityId: index === 0 ? 'brand-menu-seaflame-main' : `brand-menu-${brand.brandId}`,
    naturalScopeType: 'BRAND',
    naturalScopeKey: brand.brandId,
    title: `${brand.name} 全国标准菜单`,
    status: 'ACTIVE',
    sourceRevision: 1,
    eventId: `evt-cn-brand-menu-${index + 1}`,
    data: {
      brand_menu_id: index === 0 ? 'brand-menu-seaflame-main' : `brand-menu-${brand.brandId}`,
      brand_id: brand.brandId,
      menu_name: `${brand.name} 全国标准菜单`,
      status: 'APPROVED',
      sections: [
        {section_id: 'section-signature', section_name: brand.category.includes('茶') ? '招牌茶饮' : '招牌菜品', display_order: 10},
        {section_id: 'section-combo', section_name: brand.category.includes('茶') ? '下午茶套餐' : '门店套餐', display_order: 20},
      ],
    },
  }))
  stores.forEach((store, index) => {
    const productGroup = brandProducts.find(item => item.brandId === store.brandId) ?? brandProducts[0]
    const productIds = productGroup.products.map((_, productIndex) => productIndex === 0 && store.brandId === DEFAULT_SCOPE_IDS.brandId ? 'product-salmon-bowl' : `product-${productGroup.prefix}-${productIndex + 1}`)
    addProduct({
      entityType: 'menu_catalog',
      entityId: index === 0 ? 'menu-seaflame-store-001' : `menu-${store.storeId}-all-day`,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${store.name} 门店全天菜单`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-menu-catalog-${index + 1}`,
      data: {
        menu_id: index === 0 ? 'menu-seaflame-store-001' : `menu-${store.storeId}-all-day`,
        store_id: store.storeId,
        menu_name: `${store.name} 门店全天菜单`,
        sections: [{section_id: 'section-signature', section_name: store.business === '茶饮' ? '热销茶饮' : '热销菜品', display_order: 10, products: productIds.map((productId, productIndex) => ({product_id: productId, display_order: (productIndex + 1) * 10}))}],
        version_hash: `menu-hash-${store.code.toLowerCase()}`,
      },
    })
    productIds.forEach((productId, productIndex) => {
      addOperation({
        entityType: 'menu_availability',
        entityId: `${store.storeId}-${productId}`,
        naturalScopeType: 'STORE',
        naturalScopeKey: store.storeId,
        title: `${store.name} ${productId} 可售状态`,
        status: 'ACTIVE',
        sourceRevision: 1,
        eventId: `evt-cn-availability-${index + 1}-${productIndex + 1}`,
        data: {product_id: productId, store_id: store.storeId, available: !(store.business === '茶饮' && productIndex === 2), sold_out_reason: store.business === '茶饮' && productIndex === 2 ? '晚高峰备货中' : null, effective_from: '2026-04-24T00:00:00.000Z'},
      })
      addOperation({
        entityType: 'saleable_stock',
        entityId: `stock-${store.storeId}-${productId}`,
        naturalScopeType: 'STORE',
        naturalScopeKey: store.storeId,
        title: `${store.name} ${productId} 可售库存`,
        status: 'ACTIVE',
        sourceRevision: 1,
        eventId: `evt-cn-stock-${index + 1}-${productIndex + 1}`,
        data: {stock_id: `stock-${store.storeId}-${productId}`, store_id: store.storeId, product_id: productId, saleable_quantity: 30 - productIndex * 6, safety_stock: store.business === '茶饮' ? 8 : 4, status: 'ACTIVE'},
      })
    })
    addOperation({
      entityType: 'store_config',
      entityId: `config-${store.storeId}-pos`,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${store.name} POS 配置`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-store-config-${index + 1}`,
      data: {config_id: `config-${store.storeId}-pos`, store_id: store.storeId, dine_in_enabled: store.business !== '茶饮', takeaway_enabled: true, invoice_enabled: true, business_hours: store.business === '茶饮' ? '10:00-22:00' : '11:00-21:30', status: 'ACTIVE'},
    })
    addOperation({
      entityType: 'stock_reservation',
      entityId: index === 0 ? 'reservation-salmon-bowl-001' : `reservation-${store.storeId}-rush-hour`,
      naturalScopeType: 'STORE',
      naturalScopeKey: store.storeId,
      title: `${store.name} 晚高峰锁定库存`,
      status: 'ACTIVE',
      sourceRevision: 1,
      eventId: `evt-cn-reservation-${index + 1}`,
      data: {reservation_id: index === 0 ? 'reservation-salmon-bowl-001' : `reservation-${store.storeId}-rush-hour`, store_id: store.storeId, product_id: productIds[0], reserved_quantity: store.business === '茶饮' ? 12 : 4, reservation_status: 'ACTIVE', expires_at: '2026-04-24T20:30:00.000Z'},
    })
  })

  return docs
}

export const initializeDatabase = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS master_data_documents (
      doc_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      natural_scope_type TEXT NOT NULL,
      natural_scope_key TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_master_data_documents_unique
      ON master_data_documents (sandbox_id, domain, entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS projection_outbox (
      outbox_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      source_service TEXT NOT NULL,
      source_event_id TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      topic_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      target_terminal_ids_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      last_error TEXT,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projection_publish_log (
      publish_id TEXT PRIMARY KEY,
      outbox_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  const row = sqlite.prepare('SELECT COUNT(*) as count FROM master_data_documents').get() as {count: number}
  if (row.count > 0) {
    return
  }

  const timestamp = now()
  const docs = createChineseScenarioSeedDocs()

  const insertDoc = sqlite.prepare(`
    INSERT INTO master_data_documents (
      doc_id, sandbox_id, domain, entity_type, entity_id, natural_scope_type, natural_scope_key, title, status,
      source_revision, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = sqlite.transaction(() => {
    docs.forEach(doc => {
      insertDoc.run(
        doc.docId,
        DEFAULT_SANDBOX_ID,
        doc.domain,
        doc.entityType,
        doc.entityId,
        doc.naturalScopeType,
        doc.naturalScopeKey,
        doc.title,
        doc.status,
        doc.sourceRevision,
        serializeJson(doc.payload),
        timestamp,
        timestamp,
      )
    })

    docs
      .map(toSeedOutboxSpec)
      .filter((spec): spec is SeedOutboxSpec => Boolean(spec))
      .forEach(spec => seedOutboxForRows(spec))
  })

  transaction()
}
