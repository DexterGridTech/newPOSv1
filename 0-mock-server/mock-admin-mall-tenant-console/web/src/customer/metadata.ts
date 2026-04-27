import type {CustomerEntity} from './types'

export type MetadataOption = {
  label: string
  value: string
  status?: string
  ownerScope?: MetadataOwnerScope
  ownerId?: string
}

export type MetadataOwnerScope = 'PLATFORM' | 'BRAND' | 'STORE'

export type PlatformMetadataKey =
  | 'regions'
  | 'project_business_modes'
  | 'tenant_types'
  | 'tenant_business_models'
  | 'store_business_formats'
  | 'store_cooperation_modes'
  | 'store_business_scenarios'
  | 'brand_categories'
  | 'table_areas'
  | 'table_types'
  | 'workstation_types'
  | 'production_categories'
  | 'product_categories'
  | 'product_types'
  | 'price_types'
  | 'channel_types'
  | 'discount_types'
  | 'member_tiers'
  | 'availability_rule_types'

export const platformMetadataOwnerScopes: Record<PlatformMetadataKey, MetadataOwnerScope> = {
  regions: 'PLATFORM',
  project_business_modes: 'PLATFORM',
  tenant_types: 'PLATFORM',
  tenant_business_models: 'PLATFORM',
  store_business_formats: 'PLATFORM',
  store_cooperation_modes: 'PLATFORM',
  brand_categories: 'PLATFORM',
  product_types: 'BRAND',
  product_categories: 'BRAND',
  production_categories: 'BRAND',
  store_business_scenarios: 'STORE',
  table_areas: 'STORE',
  table_types: 'STORE',
  workstation_types: 'STORE',
  channel_types: 'STORE',
  price_types: 'STORE',
  discount_types: 'STORE',
  member_tiers: 'STORE',
  availability_rule_types: 'STORE',
}

export const metadataOwnerLabels: Record<MetadataOwnerScope, string> = {
  PLATFORM: '集团全局',
  BRAND: '品牌',
  STORE: '门店',
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '有效',
  APPROVED: '已通过',
  PUBLISHED: '已发布',
  OPERATING: '营业中',
  AVAILABLE: '可用',
  ALLOW: '允许',
  PENDING: '待生效',
  PENDING_REVIEW: '待审核',
  PROCESSING: '处理中',
  PREPARING: '筹备中',
  PAUSED: '暂停营业',
  EXPIRED: '已到期',
  FAILED: '失败',
  TERMINATED: '已终止',
  SUSPENDED: '已停用',
  INACTIVE: '未启用',
  INVALID: '无效',
  SOLD_OUT: '售罄',
  REVOKED: '已撤销',
  LOCKED: '已锁定',
  DELETED: '已删除',
  DEPRECATED: '已废弃',
  ARCHIVED: '已归档',
  CLOSED: '已关闭',
  NO_CONTRACT: '无合同',
  LOW_STOCK: '低库存',
  OCCUPIED: '使用中',
  RESERVED: '已预订',
  CLEANING: '清洁中',
  DISABLED: '停用',
}

export const enumLabels: Record<string, string> = {
  PRODUCTION: '生产环境',
  DEMO: '演示环境',
  DEBUG: '调试环境',
  INTEGRATION: '联调环境',
  CUSTOMER_UAT: '客户验收环境',
  NORTH_CHINA: '华北大区',
  EAST_CHINA: '华东大区',
  SOUTH_CHINA: '华南大区',
  CENTRAL_CHINA: '华中大区',
  WEST_CHINA: '西南大区',
  PLATFORM: '全平台',
  PROJECT: '指定项目',
  STORE: '指定门店',
  BRAND: '品牌级',
  TAG: '资源标签',
  ORG_NODE: '组织范围',
  RESOURCE_IDS: '资源清单',
  COMPOSITE: '组合范围',
  SYSTEM: '系统内置',
  CUSTOM: '自定义',
  IMPORTED: '外部导入',
  LOCAL: '本地账号',
  LDAP: 'LDAP',
  OIDC: 'OIDC',
  SAML: 'SAML',
  WECHAT_WORK: '企业微信',
  DINGTALK: '钉钉',
  PLATFORM_OPS: '平台运营',
  TENANT_STAFF: '租户人员',
  BRAND_OPS: '品牌运营',
  STORE_STAFF: '门店员工',
  API_CLIENT: '接口客户端',
  LDAP_SYNC: 'LDAP 同步',
  OIDC_CLAIM: 'OIDC 声明',
  DENY: '拒绝',
  ALLOW: '允许',
  ALLOWED: '允许',
  DENIED: '拒绝',
  READ: '读取',
  WRITE: '写入',
  EXECUTE: '执行',
  ADMIN: '管理',
  APPROVAL: '审批',
  AUTHORIZATION_CHECK: '鉴权检查',
  SHOPPING_MALL: '购物中心',
  OUTLET_MALL: '奥莱',
  DEPARTMENT_STORE: '百货',
  MIXED_USE: '商业综合体',
  SINGLE: '单品',
  COMBO: '套餐',
  MODIFIER: '加料/配料',
  STANDARD: '标准商品',
  FIXED: '固定价',
  DISCOUNT_RATE: '折扣率',
  DISCOUNT_AMOUNT: '立减金额',
  OVERRIDE_PRICE: '覆盖价',
  MEMBER_PRICE: '会员价',
  ALL: '全部',
  DINE_IN: '堂食',
  TAKEAWAY: '外卖',
  DELIVERY: '配送',
  PICKUP: '自提',
  RESERVATION: '预约',
  PERCENTAGE: '按比例',
  AMOUNT: '固定金额',
  FIXED_PRICE: '固定价',
  AMOUNT_OFF: '立减',
  FIXED_RENT: '固定租金',
  FIXED_RATE: '固定扣点',
  REVENUE_SHARE: '流水分成',
  LOCAL_MOCK_ISV: '本地模拟接入',
  DIRECT_OPERATION: '自营',
  JOINT_OPERATION: '联营',
  LEASE: '租赁',
  POPUP: '快闪',
  BAKERY: '烘焙',
  CHINESE_CUISINE: '中餐',
  WESTERN_CUISINE: '西餐',
  COFFEE: '咖啡',
  TEA_DRINK: '茶饮',
  LIGHT_MEAL: '轻食',
  RETAIL: '零售',
  RESTAURANT: '餐饮',
  EXPERIENCE: '体验业态',
  SINGLE_STORE: '单店租户',
  CHAIN_BRAND: '连锁品牌租户',
  SELF_OPERATED: '自营',
  FRANCHISED: '加盟',
  MIXED: '混合经营',
  HALL: '大厅',
  PRIVATE_ROOM: '包房',
  TERRACE: '露台',
  BAR: '吧台',
  BOOTH: '卡座',
  HOT_DISH: '热厨',
  COLD_DISH: '冷厨',
  DRINK: '饮品',
  PACKING: '打包',
  DELIVERY_HANDOFF: '配送交接',
  SIGNATURE: '招牌',
  MAIN_DISH: '主餐',
  DESSERT: '甜品',
  RETAIL_PACK: '零售包装',
  SILVER: '银卡会员',
  GOLD: '金卡会员',
  BLACK: '黑卡会员',
  TIME_SLOT: '时段规则',
  CHANNEL: '渠道规则',
  STOCK: '库存规则',
  QUOTA: '限量规则',
  MANUAL: '手动控制',
  GENERAL_TAXPAYER: '一般纳税人',
  SMALL_SCALE_TAXPAYER: '小规模纳税人',
  COMPANY: '公司主体',
  INDIVIDUAL: '个体工商户',
  FULL_DAY: '全日菜单',
  PARTIAL: '部分继承',
  DIRECT_INHERIT: '直接继承',
  NONE_INHERIT: '不继承',
  TRACKED: '有限库存',
  UNLIMITED: '不限量',
  DAILY: '按日',
  PERIOD: '按时段',
  SKU: '按规格',
  AUTO_RESET_DAILY: '每日自动重置',
  MANUAL_RESET: '手动重置',
  NONE: '无需审核',
  DRAFT: '草稿',
  REJECTED: '已拒绝',
  SYNCED: '已同步',
  OUT_OF_SYNC: '待同步',
  NOT_SYNCED: '未同步',
  SYNCING: '同步中',
  SYNC_FAILED: '同步失败',
  MAPPED: '已映射',
  UNMAPPED: '未映射',
  TOTAL_DISCOUNT: '整单优惠',
}

const option = (value: string, label = enumLabels[value] ?? STATUS_LABELS[value] ?? value): MetadataOption => ({label, value})

export const metadataOptions = {
  filterStatuses: ['ALL', 'ACTIVE', 'PENDING', 'APPROVED', 'OPERATING', 'PAUSED', 'EXPIRED', 'TERMINATED', 'INVALID', 'FAILED', 'INACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED', 'DEPRECATED', 'DISABLED', 'REVOKED', 'SYNCED', 'OUT_OF_SYNC', 'NOT_SYNCED', 'SYNCING', 'SYNC_FAILED', 'MAPPED', 'UNMAPPED'].map(value => option(value, value === 'ALL' ? '全部状态' : undefined)),
  commonStatuses: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'APPROVED'].map(value => option(value)),
  userStatuses: ['ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED'].map(value => option(value)),
  roleStatuses: ['ACTIVE', 'DEPRECATED'].map(value => option(value)),
  idpStatuses: [option('ACTIVE'), option('DISABLED', '已禁用')],
  isvStatuses: ['ACTIVE', 'INACTIVE', 'SUSPENDED'].map(value => option(value)),
  sandboxTypes: ['DEMO', 'DEBUG', 'INTEGRATION', 'CUSTOMER_UAT'].map(value => option(value)),
  projectBusinessModes: [
    option('SHOPPING_MALL'),
    option('OUTLET_MALL'),
    option('DEPARTMENT_STORE'),
    option('MIXED_USE'),
  ],
  regions: [
    option('NORTH_CHINA'),
    option('EAST_CHINA'),
    option('SOUTH_CHINA'),
    option('CENTRAL_CHINA'),
    option('WEST_CHINA'),
  ],
  tenantTypes: ['SINGLE_STORE', 'CHAIN_BRAND'].map(value => option(value)),
  tenantBusinessModels: ['SELF_OPERATED', 'FRANCHISED', 'MIXED'].map(value => option(value)),
  storeBusinessFormats: ['RESTAURANT', 'RETAIL', 'SERVICE', 'EXPERIENCE'].map(value => option(value)),
  storeCooperationModes: [
    option('DIRECT_OPERATION'),
    option('JOINT_OPERATION'),
    option('LEASE'),
    option('POPUP'),
  ],
  storeBusinessScenarios: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PICKUP', 'RESERVATION'].map(value => option(value)),
  brandCategories: ['BAKERY', 'CHINESE_CUISINE', 'WESTERN_CUISINE', 'COFFEE', 'TEA_DRINK', 'LIGHT_MEAL', 'RETAIL'].map(value => option(value)),
  tableAreas: ['HALL', 'PRIVATE_ROOM', 'TERRACE', 'BAR'].map(value => option(value)),
  tableTypes: [option('HALL', '大厅桌'), option('PRIVATE_ROOM', '包房桌'), option('BOOTH'), option('BAR', '吧台位')],
  workstationTypes: [option('PRODUCTION', '制作站'), option('PACKING', '打包站'), option('DELIVERY_HANDOFF', '配送交接站')],
  productionCategories: ['HOT_DISH', 'COLD_DISH', 'BAKERY', 'DRINK', 'PACKING'].map(value => option(value)),
  productCategories: ['SIGNATURE', 'MAIN_DISH', 'DRINK', 'DESSERT', 'RETAIL_PACK'].map(value => option(value)),
  productTypes: ['SINGLE', 'COMBO', 'MODIFIER'].map(value => option(value)),
  priceTypes: ['FIXED', 'DISCOUNT_RATE', 'DISCOUNT_AMOUNT', 'OVERRIDE_PRICE', 'MEMBER_PRICE'].map(value => option(value)),
  channelTypes: ['ALL', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'].map(value => option(value, value === 'ALL' ? '全部渠道' : undefined)),
  discountTypes: ['PERCENTAGE', 'AMOUNT', 'FIXED_PRICE', 'AMOUNT_OFF', 'TOTAL_DISCOUNT'].map(value => option(value)),
  syncStatuses: ['SYNCED', 'OUT_OF_SYNC', 'NOT_SYNCED', 'SYNCING', 'SYNC_FAILED'].map(value => option(value)),
  mappingStatuses: ['PENDING', 'MAPPED', 'UNMAPPED', 'FAILED'].map(value => option(value)),
  memberTiers: [option('NONE', '不限定会员'), option('SILVER'), option('GOLD'), option('BLACK')],
  availabilityRuleTypes: ['TIME_SLOT', 'CHANNEL', 'STOCK', 'QUOTA', 'MANUAL'].map(value => option(value)),
  taxpayerTypes: ['GENERAL_TAXPAYER', 'SMALL_SCALE_TAXPAYER'].map(value => option(value)),
  entityTypes: ['COMPANY', 'INDIVIDUAL'].map(value => option(value)),
  menuTypes: [option('FULL_DAY'), option('TIME_SLOT'), option('CHANNEL')],
  inheritModes: [option('PARTIAL'), option('DIRECT_INHERIT'), option('NONE_INHERIT', '不继承')],
  stockTypes: ['TRACKED', 'UNLIMITED'].map(value => option(value)),
  stockGranularities: ['DAILY', 'PERIOD', 'SKU'].map(value => option(value)),
  resetPolicies: ['AUTO_RESET_DAILY', 'MANUAL_RESET'].map(value => option(value)),
  yesNo: [{label: '是', value: 'true'}, {label: '否', value: 'false'}],
  scopeTypes: ['PLATFORM', 'PROJECT', 'STORE', 'TAG', 'ORG_NODE', 'RESOURCE_IDS', 'COMPOSITE'].map(value => option(value)),
  reviewStatuses: ['NONE', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].map(value => option(value)),
  permissionTypes: ['SYSTEM', 'CUSTOM'].map(value => option(value, value === 'SYSTEM' ? '系统权限' : '自定义权限')),
  roleTypes: ['CUSTOM', 'SYSTEM'].map(value => option(value, value === 'CUSTOM' ? '自定义角色' : '系统角色')),
  permissionSources: ['SYSTEM', 'CUSTOM', 'IMPORTED'].map(value => option(value)),
  policyEffects: ['ALLOW', 'DENY'].map(value => option(value)),
  userTypes: ['PLATFORM_OPS', 'TENANT_STAFF', 'BRAND_OPS', 'STORE_STAFF', 'API_CLIENT'].map(value => option(value)),
  identitySources: ['LOCAL', 'LDAP', 'OIDC', 'WECHAT_WORK', 'DINGTALK'].map(value => option(value)),
  idpTypes: ['LOCAL', 'LDAP', 'OIDC', 'SAML', 'WECHAT_WORK', 'DINGTALK'].map(value => option(value)),
  principalGroupTypes: ['MANUAL', 'LDAP_SYNC', 'OIDC_CLAIM'].map(value => option(value)),
  groupMemberSources: ['MANUAL', 'LDAP_SYNC', 'OIDC_CLAIM'].map(value => option(value)),
  resourceTypes: ['PLATFORM', 'PROJECT', 'STORE', 'BRAND', 'PRODUCT', 'MENU', 'ORDER', 'WORKSTATION', 'TABLE'].map(value => option(value)),
  permissionActions: ['READ', 'WRITE', 'EXECUTE', 'ADMIN', 'APPROVAL'].map(value => option(value)),
  ownershipScopes: ['BRAND', 'STORE'].map(value => option(value, value === 'BRAND' ? '品牌级' : '门店级')),
  storeOperatingStatuses: ['PREPARING', 'OPERATING', 'PAUSED', 'CLOSED'].map(value => option(value)),
  storeBusinessStatuses: ['PREPARING', 'OPERATING', 'PAUSED', 'CLOSED', 'OPEN'].map(value => option(value)),
  tableStatuses: ['AVAILABLE', 'DISABLED'].map(value => option(value)),
  availability: [{label: '可售', value: 'true'}, {label: '不可售', value: 'false'}],
}

export const defaultPlatformMetadataCatalog: Record<PlatformMetadataKey, MetadataOption[]> = {
  regions: metadataOptions.regions,
  project_business_modes: metadataOptions.projectBusinessModes,
  tenant_types: metadataOptions.tenantTypes,
  tenant_business_models: metadataOptions.tenantBusinessModels,
  store_business_formats: metadataOptions.storeBusinessFormats,
  store_cooperation_modes: metadataOptions.storeCooperationModes,
  store_business_scenarios: metadataOptions.storeBusinessScenarios,
  brand_categories: metadataOptions.brandCategories,
  table_areas: metadataOptions.tableAreas,
  table_types: metadataOptions.tableTypes,
  workstation_types: metadataOptions.workstationTypes,
  production_categories: metadataOptions.productionCategories,
  product_categories: metadataOptions.productCategories,
  product_types: metadataOptions.productTypes,
  price_types: metadataOptions.priceTypes,
  channel_types: metadataOptions.channelTypes,
  discount_types: metadataOptions.discountTypes,
  member_tiers: metadataOptions.memberTiers,
  availability_rule_types: metadataOptions.availabilityRuleTypes,
}

const valueToCode = (value: string) => value
  .trim()
  .replace(/([a-z])([A-Z])/g, '$1_$2')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase()

const normalizeOption = (entry: unknown, index: number): MetadataOption | null => {
  if (typeof entry === 'string') {
    const label = entry.trim()
    return label ? {label, value: valueToCode(label) || `OPTION_${index + 1}`} : null
  }
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  const label = String(record.label ?? record.option_name ?? record.name ?? '').trim()
  const rawValue = String(record.value ?? record.option_code ?? record.code ?? '').trim()
  const value = rawValue || valueToCode(label) || `OPTION_${index + 1}`
  const rawOwnerScope = String(record.ownerScope ?? record.owner_scope ?? '').trim().toUpperCase()
  const ownerScope = rawOwnerScope === 'BRAND' || rawOwnerScope === 'STORE' || rawOwnerScope === 'PLATFORM'
    ? rawOwnerScope as MetadataOwnerScope
    : undefined
  const ownerId = String(record.ownerId ?? record.owner_id ?? '').trim()
  return label ? {
    label,
    value,
    status: typeof record.status === 'string' ? record.status : undefined,
    ownerScope,
    ownerId: ownerId || undefined,
  } : null
}

const uniqueOptions = (items: MetadataOption[]) => {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.value)) return false
    seen.add(item.value)
    return item.status !== 'INACTIVE'
  })
}

export function platformMetadataOptions(platform: CustomerEntity | undefined, key: PlatformMetadataKey) {
  const payload = platform?.payload ?? {}
  const data = typeof payload.data === 'object' && payload.data !== null && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload
  const catalog = typeof data.metadata_catalog === 'object' && data.metadata_catalog !== null && !Array.isArray(data.metadata_catalog)
    ? data.metadata_catalog as Record<string, unknown>
    : {}
  if (Array.isArray(catalog[key])) {
    return uniqueOptions(catalog[key].map(normalizeOption).filter(Boolean) as MetadataOption[])
  }
  return uniqueOptions(defaultPlatformMetadataCatalog[key])
}

export function businessMetadataOptions(input: {
  platform?: CustomerEntity
  brand?: CustomerEntity
  store?: CustomerEntity
  key: PlatformMetadataKey
}) {
  const ownerScope = platformMetadataOwnerScopes[input.key]
  if (ownerScope === 'BRAND') {
    return scopedMetadataOptions({
      owner: input.brand,
      fallback: platformMetadataOptions(input.platform, input.key),
      key: input.key,
      ownerScope,
    })
  }
  if (ownerScope === 'STORE') {
    return scopedMetadataOptions({
      owner: input.store,
      fallback: platformMetadataOptions(input.platform, input.key),
      key: input.key,
      ownerScope,
    })
  }
  return platformMetadataOptions(input.platform, input.key)
}

function scopedMetadataOptions(input: {
  owner: CustomerEntity | undefined
  fallback: MetadataOption[]
  key: PlatformMetadataKey
  ownerScope: MetadataOwnerScope
}) {
  const ownerData = entityData(input.owner)
  const catalog = typeof ownerData.metadata_catalog === 'object' && ownerData.metadata_catalog !== null && !Array.isArray(ownerData.metadata_catalog)
    ? ownerData.metadata_catalog as Record<string, unknown>
    : {}
  const value = catalog[input.key]
  if (!Array.isArray(value)) return input.fallback
  const ownerId = input.owner?.entityId
  return uniqueOptions(value.map((entry, index) => {
    const option = normalizeOption(entry, index)
    if (!option) return null
    return {
      ...option,
      ownerScope: option.ownerScope ?? input.ownerScope,
      ownerId: option.ownerId ?? ownerId,
    }
  }).filter(Boolean) as MetadataOption[])
}

function entityData(entity: CustomerEntity | undefined) {
  const payload = entity?.payload ?? {}
  return typeof payload.data === 'object' && payload.data !== null && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload
}

export function optionLabel(options: MetadataOption[], value: unknown, fallback = '') {
  const raw = typeof value === 'string' ? value : ''
  return options.find(option => option.value === raw)?.label ?? fallback
}

export const platformMetadataLabels: Record<PlatformMetadataKey, {title: string; helper: string}> = {
  regions: {title: '大区', helper: '集团全局：项目选择所属大区，项目本身不再维护大区定义'},
  project_business_modes: {title: '项目业态', helper: '集团全局：用于项目的业态分类'},
  tenant_types: {title: '租户类型', helper: '集团全局：用于区分单店租户、连锁租户等法律主体类型'},
  tenant_business_models: {title: '租户经营模式', helper: '集团全局：用于租户的自营、加盟或混合经营分类'},
  store_business_formats: {title: '门店业态', helper: '集团全局：用于描述门店所在铺位经营业态'},
  store_cooperation_modes: {title: '门店合作模式', helper: '集团全局：用于门店的经营合作关系'},
  store_business_scenarios: {title: '门店经营场景', helper: '门店域：用于当前门店支持的堂食、外卖、配送、自提等业务场景'},
  brand_categories: {title: '品牌品类', helper: '集团全局：用于品牌分类与搜索筛选，品牌创建时只能从这里选择'},
  table_areas: {title: '桌台区域', helper: '门店域：用于当前门店大厅、包房、露台等区域维护'},
  table_types: {title: '桌台类型', helper: '门店域：用于当前门店大厅桌、包房桌、卡座等类型维护'},
  workstation_types: {title: '工作站类型', helper: '门店域：用于当前门店制作站、打包站、配送交接站等工作站分类'},
  production_categories: {title: '出品品类', helper: '品牌域：用于品牌商品制作配置，也可被门店工作站引用'},
  product_categories: {title: '商品分类模板', helper: '品牌域：用于当前品牌新建商品分类时的默认业务分类模板'},
  product_types: {title: '商品类型', helper: '品牌域：用于当前品牌的单品、套餐、加料/配料分类'},
  price_types: {title: '价格类型', helper: '门店域：用于当前门店固定价、折扣率和立减金额等价格口径'},
  channel_types: {title: '售卖渠道', helper: '门店域：用于当前门店菜单、价格和可售规则'},
  discount_types: {title: '优惠方式', helper: '门店域：用于当前门店价格规则的优惠计算'},
  member_tiers: {title: '会员等级', helper: '门店域：用于当前门店价格规则按会员等级生效'},
  availability_rule_types: {title: '可售规则类型', helper: '门店域：用于当前门店维护时段、渠道、库存、限量和手动控制规则'},
}

export const platformMetadataKeys = Object.keys(platformMetadataLabels) as PlatformMetadataKey[]

export function formatOptionLines(value: unknown, fallback: MetadataOption[] = []) {
  const source = Array.isArray(value) ? value : fallback
  const normalized = source.map(normalizeOption).filter(Boolean) as MetadataOption[]
  return normalized.map(item => `${item.value}=${item.label}`).join('\n')
}

export function parseOptionLines(value: string) {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawValue, ...labelParts] = line.split('=')
      const hasExplicitValue = labelParts.length > 0
      const label = (hasExplicitValue ? labelParts.join('=') : rawValue).trim()
      const value = (hasExplicitValue ? rawValue : valueToCode(label)).trim() || `OPTION_${index + 1}`
      return {value, label, status: 'ACTIVE'}
    })
}
