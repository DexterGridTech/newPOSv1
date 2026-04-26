import type {CollectionState, CustomerEntity} from './types'
import {enumLabels, platformMetadataOptions, STATUS_LABELS} from './metadata'

export const dataOf = (item?: CustomerEntity | null) => {
  const payload = item?.payload ?? {}
  const data = payload.data
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? data as Record<string, unknown>
    : payload
}

export const asText = (value: unknown, fallback = '--') => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

export const money = (value: unknown) => `¥ ${asNumber(value).toFixed(2)}`

export const formatDate = (value: unknown) => {
  const raw = asText(value, '')
  if (!raw) return '--'
  return raw.includes('T') ? raw.slice(0, 10) : raw
}

export const formatDateTime = (value: unknown) => {
  const timestamp = typeof value === 'number' ? value : Date.parse(asText(value, ''))
  if (!Number.isFinite(timestamp)) return '--'
  return new Date(timestamp).toLocaleString('zh-CN', {hour12: false})
}

export const badgeTone = (status: string) => {
  if (['ACTIVE', 'APPROVED', 'PUBLISHED', 'OPERATING', 'AVAILABLE', 'ALLOW'].includes(status)) return 'good'
  if (['PENDING', 'PENDING_REVIEW', 'PROCESSING', 'PAUSED', 'EXPIRED'].includes(status)) return 'warn'
  if (['FAILED', 'TERMINATED', 'SUSPENDED', 'INACTIVE', 'INVALID', 'SOLD_OUT', 'REVOKED'].includes(status)) return 'bad'
  return 'neutral'
}

export const statusLabel = (value: string) => {
  return STATUS_LABELS[value] ?? (value || '--')
}

export const enumLabel = (value: unknown) => {
  const raw = asText(value, '')
  if (!raw) return '--'
  const translatedStatus = statusLabel(raw)
  if (translatedStatus !== raw) return translatedStatus
  return enumLabels[raw] ?? raw
}

export const topicLabel = (topic: string) => {
  const labels: Record<string, string> = {
    'org.platform.profile': '平台资料',
    'org.project.profile': '项目资料',
    'org.tenant.profile': '租户资料',
    'org.brand.profile': '品牌资料',
    'org.store.profile': '门店资料',
    'org.contract.active': '经营合同',
    'org.table.profile': '桌台资料',
    'org.workstation.profile': '工作站资料',
    'iam.permission.catalog': '权限目录',
    'iam.role.catalog': '角色目录',
    'iam.user.store-effective': '门店用户',
    'iam.user-role-binding.store-effective': '用户授权',
    'catering.product.profile': '商品资料',
    'menu.catalog': '菜单资料',
    'store.config': '营业配置',
    'catering.saleable-stock.profile': '可售库存',
    'menu.availability': '商品可售状态',
    'catering.price-rule.profile': '价格规则',
  }
  return labels[topic] ?? topic
}

export const relationName = (items: CustomerEntity[], id: unknown, fallback = '--') =>
  items.find(item => item.entityId === id)?.title ?? asText(id, fallback)

export const relationLabel = (collections: CollectionState, key: string, value: unknown) => {
  if (!value) return '--'
  if (key.includes('platform_id')) return relationName(collections.platforms, value)
  if (key.includes('project_id')) return relationName(collections.projects, value)
  if (key.includes('tenant_id')) return relationName(collections.tenants, value, '空置')
  if (key.includes('brand_id')) return relationName(collections.brands, value)
  if (key.includes('store_id')) return relationName(collections.stores, value)
  if (key.includes('role_id')) return relationName(collections.roles, value)
  if (key.includes('permission_id')) return relationName(collections.permissions, value)
  if (key.includes('user_id')) return relationName(collections.users, value)
  if (key.includes('product_id')) return relationName(collections.products, value)
  if (key.includes('contract_id')) return relationName(collections.contracts, value)
  if (key.includes('brand_menu_id')) return relationName(collections.brandMenus, value)
  if (key.includes('menu_id')) return relationName(collections.storeMenus, value)
  if (key === 'entity_id') return relationName(collections.businessEntities, value, relationName(collections.tenants, value))
  return asText(value)
}

export const sectionProductCount = (item: CustomerEntity) =>
  asArray(dataOf(item).sections).reduce<number>((total, section) => total + asArray((section as Record<string, unknown>).products).length, 0)

export const expiringContracts = (contracts: CustomerEntity[]) => {
  const nowTime = Date.now()
  const day = 24 * 60 * 60 * 1000
  return contracts.filter(contract => {
    const data = dataOf(contract)
    const end = Date.parse(`${asText(data.end_date, '')}T23:59:59+08:00`)
    return contract.status === 'ACTIVE' && Number.isFinite(end) && end - nowTime <= 30 * day
  })
}

export const productMenuUsage = (productId: string, menus: CustomerEntity[]) =>
  menus.filter(menu => JSON.stringify(dataOf(menu).sections ?? []).includes(productId)).length

export function compactId(value: unknown) {
  const raw = asText(value)
  return raw.length > 22 ? `${raw.slice(0, 10)}...${raw.slice(-6)}` : raw
}

export function businessEntries(data: Record<string, unknown>) {
  const technicalKeys = new Set([
    'sandbox_id',
    'source_event_id',
    'source_revision',
    'schema_version',
    'projection_kind',
    'source_service',
    'generated_at',
    'timezone',
    'tenant_category',
    'brand_logo_url',
    'image_url',
    'project_phases',
    'entity_id',
    'entity_name',
    'entity_code',
    'attachment_url',
    'lessor_project_id',
    'lessor_project_name',
    'lessor_phase_id',
    'lessor_phase_name',
    'lessor_owner_name',
    'lessor_owner_contact',
    'lessor_owner_phone',
    'lessee_store_id',
    'lessee_store_name',
    'lessee_tenant_id',
    'lessee_tenant_name',
    'lessee_brand_id',
    'lessee_brand_name',
  ])
  return Object.entries(data).filter(([key, value]) => value !== undefined && !technicalKeys.has(key))
}

export function businessLabel(key: string) {
  const labels: Record<string, string> = {
    sandbox_type: '环境类型',
    sandbox_name: '沙箱名称',
    sandbox_code: '沙箱编码',
    owner: '负责人',
    platform_name: '平台名称',
    platform_code: '平台编码',
    platform_id: '所属平台',
    description: '说明',
    activated_at: '启用时间',
    activation_remark: '启用备注',
    disabled_at: '停用时间',
    disabled_reason: '停用原因',
    terminated_at: '终止时间',
    termination_reason: '终止原因',
    invalidated_at: '失效时间',
    invalid_reason: '失效原因',
    contact_name: '联系人',
    contact_phone: '联系电话',
    isv_config: 'ISV 配置',
    metadata_catalog: '平台业务字典',
    project_name: '项目名称',
    project_code: '项目编码',
    project_id: '所属项目',
    region: '区域',
    address: '地址',
    timezone: '系统时区',
    business_mode: '经营类型',
    project_phases: '分期与业主方',
    tenant_name: '租户名称',
    tenant_code: '租户编码',
    tenant_id: '租户',
    company_name: '公司名称',
    social_credit_code: '统一社会信用代码',
    credit_code: '统一社会信用代码',
    legal_representative: '法定代表人',
    invoice_title: '发票抬头',
    settlement_cycle: '结算周期',
    billing_email: '账单邮箱',
    bank_name: '开户银行',
    bank_account: '银行账号',
    brand_name: '品牌名称',
    brand_code: '品牌编码',
    brand_id: '品牌',
    brand_name_en: '英文名称',
    brand_category: '品牌品类',
    brand_logo_url: '品牌图标',
    brand_description: '品牌说明',
    standard_menu_enabled: '启用品牌标准菜单',
    standard_pricing_locked: '锁定标准价格',
    erp_integration_enabled: 'ERP 对接',
    erp_api_endpoint: 'ERP 接口',
    store_name: '门店名称',
    store_code: '门店编码',
    store_id: '门店',
    unit_code: '铺位编码',
    floor: '楼层',
    area_sqm: '面积',
    area_square_meter: '面积',
    store_type: '门店类型',
    store_formats: '经营场景',
    business_formats: '经营场景',
    opening_status: '开业状态',
    active_contract_id: '当前合同',
    entity_id: '乙方签约主体',
    entity_name: '乙方主体名称',
    entity_code: '乙方主体编码',
    contract_status: '合同状态',
    contract_code: '合同编号',
    contract_id: '合同',
    attachment_url: '合同附件',
    lessor_project_id: '甲方项目',
    lessor_project_name: '甲方项目',
    lessor_phase_id: '甲方分期',
    lessor_phase_name: '甲方分期',
    lessor_owner_name: '甲方业主方',
    lessor_owner_contact: '甲方联系人',
    lessor_owner_phone: '甲方联系电话',
    lessee_store_id: '乙方门店',
    lessee_store_name: '乙方门店',
    lessee_tenant_id: '乙方租户',
    lessee_tenant_name: '乙方租户',
    lessee_brand_id: '乙方品牌',
    lessee_brand_name: '乙方品牌',
    start_date: '开始日期',
    end_date: '结束日期',
    commission_type: '计费模式',
    commission_rate: '费率',
    deposit_amount: '保证金',
    billing_mode: '计费模式',
    operating_status: '营业状态',
    business_hours: '营业时间',
    business_status: '营业状态',
    accept_order: '渠道入口策略',
    auto_accept_enabled: '入口自动确认策略',
    accept_timeout_seconds: '入口确认等待参数',
    preparation_buffer_minutes: '备餐缓冲配置',
    max_concurrent_orders: '渠道入口容量上限',
    auto_open_close_enabled: '自动营业状态策略',
    operating_hours: '营业时间',
    operating_status_updated_at: '营业状态更新时间',
    extra_charge_rules: '附加费用规则',
    config_id: '配置编号',
    table_id: '桌台编号',
    table_no: '桌台号',
    table_status: '桌台状态',
    capacity: '座位数',
    workstation_id: '工作站编号',
    workstation_code: '工作站编码',
    workstation_name: '工作站名称',
    category_codes: '可处理品类',
    permission_name: '权限名称',
    permission_code: '权限编码',
    permission_id: '权限',
    permission_type: '权限类型',
    role_name: '角色名称',
    role_code: '角色编码',
    role_id: '角色',
    role_type: '角色来源',
    scope_type: '授权范围',
    permission_ids: '权限集合',
    binding_id: '授权记录',
    user_id: '用户',
    scope_selector: '授权范围',
    policy_effect: '授权结果',
    effective_from: '生效时间',
    effective_to: '失效时间',
    grant_reason: '授权原因',
    revoke_reason: '撤销原因',
    display_name: '姓名',
    user_code: '用户编码',
    mobile: '手机号',
    product_name: '商品名称',
    product_id: '商品',
    product_type: '商品类型',
    image_url: '商品图片',
    ownership_scope: '归属范围',
    base_price: '基础价格',
    production_steps: '出品步骤配置',
    modifier_groups: '加料组',
    variants: '规格',
    combo_item_groups: '套餐组成',
    menu_name: '菜单名称',
    brand_menu_id: '品牌菜单',
    menu_id: '门店菜单',
    review_status: '审核状态',
    sections: '分区与商品',
    version_hash: '版本',
    rule_name: '规则名称',
    rule_code: '规则编码',
    rule_id: '规则编号',
    channel_type: '渠道',
    price_type: '价格类型',
    price_delta: '调价金额',
    time_slot: '时段',
    member_tier: '会员等级',
    priority: '优先级',
    discount_type: '优惠类型',
    discount_value: '优惠值',
    applicable_product_ids: '适用商品',
    available: '是否可售',
    sold_out_reason: '不可售原因',
    stock_id: '库存编号',
    saleable_quantity: '可售数量',
    safety_stock: '安全库存',
    reserved_quantity: '下游占用汇总',
    reservation_ttl_seconds: '占用汇总保留口径',
    expires_at: '过期时间',
    event_label: '投影内容',
    business_object: '业务对象',
    business_scope: '业务范围',
    publish_status: '发布状态',
    retry_count: '重试次数',
    last_error: '失败原因',
    publish_id: '日志编号',
    outbox_batch: '发布批次',
    projection_count: '投影数量',
    target_terminal: '目标终端',
    published_at: '发布时间',
    status: '状态',
  }
  return labels[key] ?? key.replace(/_/g, ' ')
}

export function renderBusinessValue(key: string, value: unknown, collections: CollectionState) {
  if (key === 'scope_selector') return scopeSelectorLabel(value, collections)
  if (key === 'brand_category') {
    const selectedPlatform = collections.platforms.find(platform => dataOf(platform).metadata_catalog)
    return platformMetadataOptions(selectedPlatform, 'brand_categories').find(option => option.value === value)?.label ?? enumLabel(value)
  }
  if (key === 'store_formats') {
    const selectedPlatform = collections.platforms.find(platform => dataOf(platform).metadata_catalog)
    const options = platformMetadataOptions(selectedPlatform, 'store_business_scenarios')
    const values = asArray(value).map(item => asText(item, '')).filter(Boolean)
    return values.length === 0
      ? '暂无'
      : values.map(item => options.find(option => option.value === item)?.label ?? enumLabel(item)).join('、')
  }
  if (key === 'project_phases') {
    return `${asArray(value).length || 1} 个分期`
  }
  if (key.endsWith('_id') || key.endsWith('_ids')) {
    if (Array.isArray(value)) {
      const names = value.map(item => relationLabel(collections, key.replace(/_ids$/, '_id'), item)).filter(Boolean)
      return names.length === 0 ? '暂无' : names.join('、')
    }
    return relationLabel(collections, key, value)
  }
  if (key === 'region' && typeof value === 'object' && value !== null) {
    return asText((value as Record<string, unknown>).region_name)
  }
  return renderValue(value)
}

export function renderValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0 ? '暂无' : `${value.length} 项`
  if (typeof value === 'object' && value !== null) return `${Object.keys(value as Record<string, unknown>).length} 项配置`
  if (typeof value === 'boolean') return yesNo(value)
  if (typeof value === 'number') return String(value)
  return enumLabel(value)
}

export function yesNo(value: unknown) {
  return value === true ? '是' : value === false ? '否' : '--'
}

export function scopeLabel(value: unknown) {
  const raw = asText(value)
  if (raw === 'PLATFORM') return '全平台'
  if (raw === 'PROJECT') return '指定项目'
  if (raw === 'STORE') return '指定门店'
  if (raw === 'ORG_NODE') return '组织范围'
  return raw
}

export function scopeSelectorLabel(value: unknown, collections?: CollectionState) {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const scopeType = asText(record.scope_type, '')
  const scopeKey = record.scope_key
  if (!scopeKey) return scopeLabel(scopeType)
  if (scopeType === 'PLATFORM') return `全平台：${collections ? relationName(collections.platforms, scopeKey) : asText(scopeKey)}`
  if (scopeType === 'PROJECT') return `项目：${collections ? relationName(collections.projects, scopeKey) : asText(scopeKey)}`
  if (scopeType === 'STORE') return `门店：${collections ? relationName(collections.stores, scopeKey) : asText(scopeKey)}`
  return `${scopeLabel(scopeType)}：${asText(scopeKey)}`
}

export function businessHoursLabel(data: Record<string, unknown>) {
  if (typeof data.business_hours === 'string') return data.business_hours
  if (Array.isArray(data.operating_hours)) {
    const first = data.operating_hours[0] as Record<string, unknown> | undefined
    return first ? `${asText(first.start)}-${asText(first.end)}` : '--'
  }
  return '--'
}

export function timeSlotLabel(value: unknown) {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
  return record ? `${asText(record.start, '00:00')}-${asText(record.end, '24:00')}` : '全天'
}
