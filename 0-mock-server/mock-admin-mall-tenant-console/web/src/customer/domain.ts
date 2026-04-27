import type {CollectionState, CustomerEntity} from './types'
import {businessMetadataOptions, enumLabels, platformMetadataOptions, STATUS_LABELS} from './metadata'

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
  if (['PENDING', 'PENDING_REVIEW', 'PROCESSING', 'PAUSED', 'EXPIRED', 'DEPRECATED'].includes(status)) return 'warn'
  if (['FAILED', 'TERMINATED', 'SUSPENDED', 'INACTIVE', 'INVALID', 'SOLD_OUT', 'REVOKED', 'LOCKED', 'DELETED', 'DISABLED'].includes(status)) return 'bad'
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
    'catering.product-inheritance.profile': '商品继承',
    'catering.bundle-price-rule.profile': '组合优惠',
    'catering.channel-product-mapping.profile': '渠道商品映射',
  }
  return labels[topic] ?? topic
}

export const relationName = (items: CustomerEntity[], id: unknown, fallback = '--') =>
  items.find(item => item.entityId === id)?.title ?? asText(id, fallback)

export const permissionCodeFor = (permission: CustomerEntity) =>
  asText(dataOf(permission).permission_code, permission.entityId)

export const isHighRiskPermission = (permission: CustomerEntity, highRiskPolicies: CustomerEntity[] = []) => {
  const data = dataOf(permission)
  const permissionCode = permissionCodeFor(permission)
  return data.high_risk === true
    || data.require_approval === true
    || highRiskPolicies.some(policy => {
      const policyData = dataOf(policy)
      return policy.status === 'ACTIVE'
        && asText(policyData.permission_code, '') === permissionCode
        && asText(policyData.status, 'ACTIVE') !== 'INACTIVE'
    })
}

export const relationLabel = (collections: CollectionState, key: string, value: unknown) => {
  if (!value) return '--'
  if (key.includes('platform_id')) return relationName(collections.platforms, value)
  if (key.includes('project_id')) return relationName(collections.projects, value)
  if (key.includes('tenant_id')) return relationName(collections.tenants, value, '空置')
  if (key.includes('brand_id')) return relationName(collections.brands, value)
  if (key.includes('store_id')) return relationName(collections.stores, value)
  if (key.includes('role_id')) return relationName(collections.roles, value)
  if (key.includes('group_id')) return relationName(collections.principalGroups, value)
  if (key.includes('permission_group_id')) return relationName(collections.permissionGroups, value)
  if (key.includes('template_id')) return relationName(collections.roleTemplates, value)
  if (key.includes('source_template_id')) return relationName(collections.roleTemplates, value)
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
    metadata_catalog: '业务字典',
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
    bank_account_no: '银行账号',
    bank_account_no_masked: '银行账号',
    bank_account_name: '银行户名',
    bank_branch: '开户支行',
    taxpayer_type: '纳税人类型',
    tax_rate: '税率',
    settlement_day: '结算日',
    auto_settlement_enabled: '自动结算',
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
    business_scenarios: '经营场景',
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
    parent_permission_id: '上级权限',
    permission_name: '权限名称',
    permission_code: '权限编码',
    permission_id: '权限',
    permission_type: '权限类型',
    permission_source: '权限来源',
    permission_group_id: '权限分组',
    resource_type: '资源类型',
    resource: '资源标识',
    action: '动作',
    feature_flag: '关联功能点',
    high_risk: '高风险权限',
    require_approval: '需要审批',
    permission_description: '权限说明',
    is_system: '系统内置',
    role_name: '角色名称',
    role_code: '角色编码',
    role_id: '角色',
    role_type: '角色来源',
    role_source: '角色来源',
    source_template_id: '来源模板',
    template_sync_status: '模板同步状态',
    role_description: '角色说明',
    applicable_user_types: '适用用户类型',
    scope_type: '授权范围',
    permission_ids: '权限集合',
    binding_id: '授权记录',
    user_id: '用户',
    username: '登录名',
    email: '邮箱',
    phone: '联系电话',
    identity_source: '身份来源',
    external_user_id: '外部用户 ID',
    failed_login_count: '失败登录次数',
    locked_until: '锁定至',
    last_login_at: '最后登录时间',
    last_login_ip: '最后登录 IP',
    created_by: '创建人',
    version: '版本',
    scope_selector: '授权范围',
    policy_effect: '授权结果',
    policy_conditions: '策略条件',
    effective_from: '生效时间',
    effective_to: '失效时间',
    grant_reason: '授权原因',
    revoke_reason: '撤销原因',
    display_name: '姓名',
    user_code: '用户编码',
    mobile: '手机号',
    idp_name: '身份源名称',
    idp_type: '身份源类型',
    sync_enabled: '启用同步',
    sync_cron: '同步 Cron',
    ldap_url: 'LDAP 地址',
    base_dn: 'Base DN',
    issuer_url: 'OIDC Issuer',
    client_id: 'Client ID',
    scopes: 'OIDC Scopes',
    group_name: '分组名称',
    group_code: '分组编码',
    group_icon: '图标',
    parent_group_id: '上级分组',
    sort_order: '排序',
    template_name: '模板名称',
    template_code: '模板编码',
    template_description: '模板说明',
    base_permission_ids: '基础权限',
    recommended_scope_type: '推荐范围',
    industry_tags: '行业标签',
    is_active: '启用',
    feature_name: '功能点名称',
    feature_code: '功能点编码',
    feature_description: '功能说明',
    is_enabled: '启用',
    is_enabled_globally: '全局启用',
    default_enabled: '平台默认启用',
    enabled_by: '操作人',
    enabled_at: '启用时间',
    tag_key: '标签键',
    tag_value: '标签值',
    tag_label: '标签名称',
    resource_id: '资源 ID',
    group_type: '用户组类型',
    ldap_group_dn: 'LDAP Group DN',
    oidc_claim_key: 'OIDC Claim Key',
    oidc_claim_value: 'OIDC Claim Value',
    member_id: '成员记录',
    group_id: '用户组',
    source: '来源',
    joined_by: '加入人',
    joined_at: '加入时间',
    group_binding_id: '组授权记录',
    approval_id: '审批单号',
    granted_by: '授权人',
    session_id: '会话编号',
    working_scope: '工作范围',
    activated_binding_ids: '激活授权',
    session_token_masked: '会话 Token',
    last_active_at: '最后活跃时间',
    mfa_verified_at: 'MFA 验证时间',
    mfa_expires_at: 'MFA 过期时间',
    mfa_method: 'MFA 方式',
    rule_description: '规则说明',
    conflicting_role_codes: '冲突角色编码',
    conflicting_perm_codes: '冲突权限编码',
    approver_role_code: '审批角色',
    max_duration_days: '最长授权天数',
    require_mfa: '需要 MFA',
    mfa_validity_minutes: 'MFA 有效分钟',
    result: '鉴权结果',
    deny_reason: '拒绝原因',
    is_cross_sandbox: '跨沙箱',
    occurred_at: '发生时间',
    request_id: '请求 ID',
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
    inheritance_id: '继承关系',
    brand_product_id: '品牌商品',
    store_product_id: '门店商品',
    override_fields: '覆盖字段',
    locked_fields: '锁定字段',
    sync_status: '同步状态',
    last_sync_at: '最后同步时间',
    menu_name: '菜单名称',
    brand_menu_id: '品牌菜单',
    menu_id: '门店菜单',
    review_status: '审核状态',
    sections: '分区与商品',
    version_hash: '版本',
    rule_name: '规则名称',
    rule_code: '规则编码',
    rule_id: '组合优惠规则',
    channel_type: '渠道',
    price_type: '价格类型',
    price_delta: '调价金额',
    time_slot: '时段',
    member_tier: '会员等级',
    priority: '优先级',
    discount_type: '优惠类型',
    discount_value: '优惠值',
    trigger_products: '触发商品',
    max_applications: '最大触发次数',
    applicable_product_ids: '适用商品',
    mapping_id: '渠道商品映射',
    external_product_id: '外部商品 ID',
    external_sku_id: '外部 SKU ID',
    mapping_status: '映射状态',
    sync_error_message: '同步失败原因',
    field_mapping_config: '字段映射配置',
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

export function renderBusinessValue(key: string, value: unknown, collections: CollectionState, owner?: CustomerEntity) {
  if (key === 'scope_selector') return scopeSelectorLabel(value, collections)
  if (key === 'brand_category') {
    const selectedPlatform = collections.platforms.find(platform => dataOf(platform).metadata_catalog)
    return platformMetadataOptions(selectedPlatform, 'brand_categories').find(option => option.value === value)?.label ?? enumLabel(value)
  }
  if (key === 'store_formats') {
    const selectedPlatform = collections.platforms.find(platform => dataOf(platform).metadata_catalog)
    const selectedStore = owner?.entityType === 'store' ? owner : undefined
    const options = businessMetadataOptions({platform: selectedPlatform, store: selectedStore, key: 'store_business_scenarios'})
    const values = asArray(value).map(item => asText(item, '')).filter(Boolean)
    return values.length === 0
      ? '暂无'
      : values.map(item => options.find(option => option.value === item)?.label ?? enumLabel(item)).join('、')
  }
  if (key === 'business_scenarios') {
    const selectedPlatform = collections.platforms.find(platform => dataOf(platform).metadata_catalog)
    const selectedStore = owner?.entityType === 'store' ? owner : undefined
    const options = businessMetadataOptions({platform: selectedPlatform, store: selectedStore, key: 'store_business_scenarios'})
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
  if (raw === 'TAG') return '资源标签'
  if (raw === 'ORG_NODE') return '组织范围'
  if (raw === 'RESOURCE_IDS') return '资源清单'
  if (raw === 'COMPOSITE') return '组合范围'
  return raw
}

export function scopeSelectorLabel(value: unknown, collections?: CollectionState) {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const scopeType = asText(record.scope_type, '')
  const scopeKey = record.scope_key
  const tags = asArray(record.tags).map(item => asText(item, '')).filter(Boolean)
  const orgNodeType = asText(record.org_node_type, '')
  const orgNodeIds = asArray(record.org_node_ids ?? record.org_node_id).map(item => asText(item, '')).filter(Boolean)
  const resourceType = asText(record.resource_type, '')
  const tagKey = asText(record.tag_key, '')
  const tagValue = asText(record.tag_value, '')
  const resourceIds = asArray(record.resource_ids).map(item => asText(item, '')).filter(Boolean)
  const selectors = asArray(record.selectors ?? record.children)
  if (scopeType === 'TAG') return `标签：${tags.length ? tags.join('、') : tagKey !== '--' ? `${tagKey}:${tagValue}` : asText(scopeKey)}`
  if (scopeType === 'ORG_NODE') return `组织范围：${orgNodeType !== '--' ? `${enumLabel(orgNodeType.toUpperCase())} · ` : ''}${orgNodeIds.length || asText(scopeKey) !== '--' ? orgNodeIds.join('、') || asText(scopeKey) : '--'}`
  if (scopeType === 'RESOURCE_IDS') return `资源清单：${resourceType !== '--' ? `${enumLabel(resourceType.toUpperCase())} · ` : ''}${resourceIds.length || 0} 个`
  if (scopeType === 'COMPOSITE') return `组合范围：${selectors.length || 0} 条`
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
