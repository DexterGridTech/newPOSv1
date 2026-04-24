export interface ApiResponse<T> {
  success?: boolean
  code?: number | string
  message?: string
  traceId?: string
  trace_id?: string
  timestamp?: string
  data: T
  pagination?: {
    page: number
    size: number
    total: number
    totalPages: number
  }
  error?: {
    message?: string
    details?: unknown
  }
}

type PageResult<T> = {
  data: T[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

const headers = (init?: RequestInit) => ({
  'content-type': 'application/json',
  ...(init?.headers ?? {}),
})

const readErrorMessage = <T>(payload: ApiResponse<T> | null, response: Response) =>
  payload?.error?.message
  ?? payload?.message
  ?? `request failed: ${response.status}`

const request = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    headers: headers(init),
    ...init,
  })
  const payload = await response.json() as ApiResponse<T>
  const isExplicitFailure = payload.success === false
    || (typeof payload.code === 'string' && payload.code !== '0' && payload.code !== 'SUCCESS')

  if (!response.ok || isExplicitFailure) {
    throw new Error(readErrorMessage(payload, response))
  }

  return payload.data
}

const requestPage = async <T>(url: string, init?: RequestInit): Promise<PageResult<T>> => {
  const response = await fetch(url, {
    headers: headers(init),
    ...init,
  })
  const payload = await response.json() as ApiResponse<T[]>
  const isExplicitFailure = payload.success === false
    || (typeof payload.code === 'string' && payload.code !== '0' && payload.code !== 'SUCCESS')

  if (!response.ok || isExplicitFailure) {
    throw new Error(readErrorMessage(payload, response))
  }

  return {
    data: payload.data,
    pagination: payload.pagination ?? {
      page: 1,
      size: payload.data.length,
      total: payload.data.length,
      totalPages: 1,
    },
  }
}

export const api = {
  getSandboxes: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/sandboxes?page=1&size=20'),
  createSandbox: (input: {
    sandboxId?: string
    sandboxCode: string
    sandboxName: string
    sandboxType?: string
    description?: string
    owner?: string
  }) => request<EntityItemLike>('/api/v1/org/sandboxes', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  closeSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  createPlatform: (input: {
    platformCode: string
    platformName: string
    description?: string
    contactName?: string
    contactPhone?: string
    isvConfig?: {
      providerType?: string
      appKey?: string | null
      appSecret?: string | null
      isvToken?: string | null
      tokenExpireAt?: string | null
      channelStatus?: string | null
    }
  }) => request<EntityItemLike>('/api/v1/org/platforms', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activatePlatform: (platformId: string) => request<EntityItemLike>(`/api/v1/org/platforms/${platformId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendPlatform: (platformId: string) => request<EntityItemLike>(`/api/v1/org/platforms/${platformId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  updatePlatformIsvCredential: (platformId: string, input: {
    providerType?: string
    appKey?: string | null
    appSecret?: string | null
    isvToken?: string | null
    tokenExpireAt?: string | null
    channelStatus?: string | null
  }) => request<EntityItemLike>(`/api/v1/org/platforms/${platformId}/isv-credential`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  createProject: (input: {
    projectCode: string
    projectName: string
    platformId?: string
    timezone?: string
    region?: Record<string, unknown>
    address?: string
    businessMode?: string
  }) => request<EntityItemLike>('/api/v1/org/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateProject: (projectId: string) => request<EntityItemLike>(`/api/v1/org/projects/${projectId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendProject: (projectId: string) => request<EntityItemLike>(`/api/v1/org/projects/${projectId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  createTenant: (input: {
    tenantId?: string
    tenantCode: string
    tenantName: string
    platformId?: string
  }) => request<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  suspendTenant: (tenantId: string, input: {reason?: string} = {}) => request<{
    tenant: EntityItemLike
    affectedStoreIds: string[]
    reason: string | null
  }>(`/api/v1/org/tenants/${tenantId}/suspend`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createBrand: (input: {
    brandId?: string
    brandCode: string
    brandName: string
    tenantId: string
  }) => request<EntityItemLike>('/api/v1/org/brands', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createBusinessEntity: (input: {
    entityId?: string
    entityCode: string
    entityName: string
    tenantId: string
  }) => request<EntityItemLike>('/api/v1/org/legal-entities', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createStore: (input: {
    storeId?: string
    storeCode: string
    storeName: string
    unitCode: string
    projectId: string
  }) => request<EntityItemLike>('/api/v1/org/stores', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createContract: (input: {
    contractId?: string
    contractNo: string
    storeId: string
    tenantId: string
    brandId: string
    entityId: string
    startDate: string
    endDate: string
    commissionType?: string
    commissionRate?: number
    depositAmount?: number
    attachmentUrl?: string | null
  }) => request<EntityItemLike>('/api/v1/org/contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateContract: (contractId: string, input: {remark?: string} = {}) => request<EntityItemLike>(
    `/api/v1/org/contracts/${contractId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ),
  terminateContract: (contractId: string, input: {reason?: string} = {}) => request<EntityItemLike>(
    `/api/v1/org/contracts/${contractId}/terminate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ),
  renewContract: (contractId: string, input: {
    newEndDate: string
    commissionRate?: number
    remark?: string
  }) => request<{
    newContractId: string
    originalContractId: string
    newEndDate: string
    status: string
  }>(`/api/v1/org/contracts/${contractId}/renew`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  amendContract: (contractId: string, input: {
    endDate?: string
    commissionRate?: number
    remark?: string
  }) => request<EntityItemLike>(`/api/v1/org/contracts/${contractId}/amend`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getOverview: () => request<{
    alignedEntities: Array<{domain: string; entity_type: string; count: number}>
    legacyDocuments: Array<{domain: string; entity_type: string; count: number}>
    outbox: Array<{status: string; count: number}>
  }>('/api/v1/overview'),
  getOrgTree: () => request<Array<{
    id: string
    type: string
    title: string
    status: string
    children: Array<unknown>
  }>>('/api/v1/org/tree'),
  getDocuments: () => request<Array<{
    docId: string
    sandboxId: string
    domain: string
    entityType: string
    entityId: string
    naturalScopeType: string
    naturalScopeKey: string
    title: string
    status: string
    sourceRevision: number
    payload: Record<string, unknown>
    updatedAt: number
  }>>('/api/v1/diagnostics/legacy/master-data/documents'),
  applyDemoChange: () => request<{
    aggregateId: string
    sandboxId: string
    domain: string
    entityType: string
    entityId: string
    naturalScopeType: string
    naturalScopeKey: string
    title: string
    status: string
    sourceRevision: number
    payload: Record<string, unknown>
    createdAt: number
    updatedAt: number
  }>('/api/v1/diagnostics/master-data/demo-change', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  rebuildProjectionOutbox: () => request<{
    total: number
    rebuiltAt: number
    items: Array<{
      entityType: string
      entityId: string
      topicKey: string
    }>
  }>('/api/v1/diagnostics/projections/rebuild', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getProjectionOutbox: () => request<Array<{
    outboxId: string
    topicKey: string
    scopeType: string
    scopeKey: string
    itemKey: string
    sourceEventId: string
    sourceRevision: number
    status: string
    attemptCount: number
    lastError?: string | null
    payload: Record<string, unknown>
    targetTerminalIds: string[]
    updatedAt: number
  }>>('/api/v1/diagnostics/projections/outbox'),
  previewProjectionOutbox: () => request<{
    sandboxId: string
    targetPlatformBaseUrl: string
    total: number
    projections: Array<Record<string, unknown>>
  }>('/api/v1/diagnostics/projections/outbox/preview', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  publishProjectionOutbox: () => request<{
    total: number
    published: number
    failed?: number
    response: unknown
    error?: string
  }>('/api/v1/diagnostics/projections/outbox/publish', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  retryProjectionOutbox: () => request<{total: number}>('/api/v1/diagnostics/projections/outbox/retry', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getAlignedAuditEvents: () => requestPage<{
    eventId: string
    aggregateType: string
    aggregateId: string
    eventType: string
    occurredAt: number
    actorType: string
    actorId: string
    sourceRevision: number
    payload: Record<string, unknown>
  }>('/api/v1/diagnostics/events?page=1&size=20'),
  getProjectionDiagnostics: () => requestPage<{
    diagnosticId: string
    topicKey: string
    scopeType: string
    scopeKey: string
    itemKey: string
    status: string
    detail: Record<string, unknown>
    createdAt: number
  }>('/api/v1/diagnostics/projections/delivery?page=1&size=20'),
  getPlatforms: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/platforms?page=1&size=20'),
  getProjects: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/projects?page=1&size=20'),
  getTenants: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/tenants?page=1&size=20'),
  getTenantStores: (tenantId: string) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/org/tenants/${tenantId}/stores?page=1&size=100`),
  getBrands: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/brands?page=1&size=20'),
  getStores: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/stores?page=1&size=20'),
  getContracts: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/contracts?page=1&size=20'),
  getStoreContractMonitor: (storeId: string) => request<{
    store: EntityItemLike
    snapshot: {
      activeContractId: string | null
      tenantId: string | null
      brandId: string | null
      entityId: string | null
      projectId: string | null
      unitCode: string | null
      storeStatus: string
    }
    project: EntityItemLike | null
    tenant: EntityItemLike | null
    brand: EntityItemLike | null
    businessEntity: EntityItemLike | null
    activeContract: EntityItemLike | null
    contracts: EntityItemLike[]
    timeline: Array<{
      eventId: string
      aggregateType: string
      aggregateId: string
      eventType: string
      occurredAt: number
      actorType: string
      actorId: string
      sourceRevision: number
      storeId: string | null
      contractId: string | null
      tenantId: string | null
      brandId: string | null
      entityId: string | null
      status: string | null
      summary: string | null
    }>
  }>(`/api/v1/org/stores/${storeId}/contract-monitor`),
  getBusinessEntities: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/legal-entities?page=1&size=20'),
  getTables: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/org/stores/${storeId}/tables?page=1&size=20`),
  getWorkstations: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/org/stores/${storeId}/workstations?page=1&size=20`),
  getUsers: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/users?page=1&size=20'),
  getPermissions: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/permissions?page=1&size=20'),
  getRoles: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/roles?page=1&size=20'),
  createRole: (input: {
    roleCode: string
    roleName: string
    scopeType: string
    permissionIds: string[]
  }) => request<EntityItemLike>('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateRole: (roleId: string) => request<EntityItemLike>(`/api/v1/roles/${roleId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendRole: (roleId: string) => request<EntityItemLike>(`/api/v1/roles/${roleId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getUserRoleBindings: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/user-role-bindings?page=1&size=20'),
  getStoreEffectiveIam: (storeId: string) => request<StoreEffectiveIam>(`/api/v1/stores/${storeId}/effective-iam`),
  getUserEffectivePermissions: (userId: string, storeId: string) => request<UserEffectivePermissions>(
    `/api/v1/users/${userId}/effective-permissions?storeId=${encodeURIComponent(storeId)}`,
  ),
  createUser: (input: {
    userCode: string
    displayName: string
    mobile?: string
    storeId: string
  }) => request<EntityItemLike>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateUser: (userId: string) => request<EntityItemLike>(`/api/v1/users/${userId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendUser: (userId: string) => request<EntityItemLike>(`/api/v1/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  createUserRoleBinding: (input: {
    userId: string
    roleId: string
    storeId: string
  }) => request<EntityItemLike>('/api/v1/user-role-bindings', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  revokeUserRoleBinding: (bindingId: string, input: {reason?: string} = {}) => request<EntityItemLike>(`/api/v1/user-role-bindings/${bindingId}/revoke`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  checkPermission: (input: {
    userId: string
    storeId: string
    permissionId?: string
    permissionCode?: string
  }) => request<{
    allowed: boolean
    userId: string | null
    storeId: string | null
    permissionId: string | null
    permissionCode: string | null
    permissionName: string | null
    matchedBindingIds: string[]
    matchedRoleIds: string[]
    bindingIdsConsidered: string[]
    roleIdsConsidered: string[]
    reason: string
    decisionSource: string
  }>('/internal/auth/check-permission', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getProducts: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/products?page=1&size=20'),
  createProduct: (input: {
    productId?: string
    productName: string
    ownershipScope: 'BRAND' | 'STORE'
    brandId?: string
    storeId?: string
    productType?: string
    basePrice?: number
    productionSteps?: Array<Record<string, unknown>>
    modifierGroups?: Array<Record<string, unknown>>
    variants?: Array<Record<string, unknown>>
    comboItemGroups?: Array<Record<string, unknown>>
  }) => request<EntityItemLike>('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  activateProduct: (productId: string) => request<EntityItemLike>(`/api/v1/products/${productId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  suspendProduct: (productId: string) => request<EntityItemLike>(`/api/v1/products/${productId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  soldOutProduct: (productId: string, input: {
    storeId: string
    reason?: string
  }) => request<EntityItemLike>(`/api/v1/products/${productId}/sold-out`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  restoreProduct: (productId: string, input: {
    storeId: string
  }) => request<EntityItemLike>(`/api/v1/products/${productId}/restore`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getMenus: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/menus?page=1&size=20'),
  createBrandMenu: (input: {
    brandMenuId?: string
    brandId: string
    menuName: string
    sections?: Array<Record<string, unknown>>
    reviewStatus?: string
  }) => request<EntityItemLike>('/api/v1/menus', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  submitMenuReview: (menuId: string) => request<EntityItemLike>(`/api/v1/menus/${menuId}/submit-review`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  approveMenu: (menuId: string) => request<EntityItemLike>(`/api/v1/menus/${menuId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  rejectMenu: (menuId: string) => request<EntityItemLike>(`/api/v1/menus/${menuId}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getStoreMenus: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/store-menus?page=1&size=20'),
  createStoreMenu: (input: {
    menuId?: string
    storeId: string
    menuName: string
    sections?: Array<Record<string, unknown>>
    versionHash?: string
  }) => request<EntityItemLike>('/api/v1/store-menus', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  rollbackStoreMenu: (menuId: string) => request<EntityItemLike>(`/api/v1/store-menus/${menuId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getStoreConfigs: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/config?page=1&size=20`),
  updateStoreConfig: (storeId: string, input: {
    businessStatus?: string
    acceptOrder?: boolean
    operatingHours?: Array<Record<string, unknown>>
    extraChargeRules?: Array<Record<string, unknown>>
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/config`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  openStore: (storeId: string, input: {
    operatingHours?: Array<Record<string, unknown>>
    extraChargeRules?: Array<Record<string, unknown>>
  } = {}) => request<EntityItemLike>(`/api/v1/stores/${storeId}/open`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  closeStore: (storeId: string, input: {
    operatingHours?: Array<Record<string, unknown>>
    extraChargeRules?: Array<Record<string, unknown>>
  } = {}) => request<EntityItemLike>(`/api/v1/stores/${storeId}/close`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getInventories: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/inventories?page=1&size=20`),
  updateInventory: (storeId: string, productId: string, input: {
    stockId?: string
    saleableQuantity: number
    safetyStock?: number
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/inventories/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  getPriceRules: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/price-rules?page=1&size=20`),
  createPriceRule: (input: {
    ruleCode: string
    productId: string
    storeId: string
    priceType?: string
    channelType?: string
    priceDelta?: number
  }) => request<EntityItemLike>('/api/v1/product-price-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getAvailabilityRules: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/availability-rules?page=1&size=20`),
  createAvailabilityRule: (storeId: string, input: {
    ruleCode: string
    productId?: string
    channelType?: string
    available?: boolean
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/availability-rules`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getMenuAvailability: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/menu-availability?page=1&size=20`),
  getStockReservations: (storeId = 'store-kernel-base-test') => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(`/api/v1/stores/${storeId}/stock-reservations?page=1&size=20`),
  createStockReservation: (storeId: string, input: {
    reservationId?: string
    productId: string
    reservedQuantity: number
    reservationStatus?: string
    expiresAt?: string
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/stock-reservations`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getTerminalAuthCapabilities: () => request<{
    status: string
    implemented: boolean
    routes: string[]
    tdpPublishPath: string
  }>('/api/v1/auth/capabilities'),
}

type EntityItemLike = {
  aggregateId: string
  entityId: string
  title: string
  status: string
  payload: Record<string, unknown>
}

export type PermissionDecision = {
  allowed: boolean
  userId: string | null
  storeId: string | null
  permissionId: string | null
  permissionCode: string | null
  permissionName: string | null
  matchedBindingIds: string[]
  matchedRoleIds: string[]
  bindingIdsConsidered: string[]
  roleIdsConsidered: string[]
  reason: string
  decisionSource: string
}

export type UserEffectivePermissions = {
  user: {
    userId: string
    userCode: string
    displayName: string
    mobile: string | null
    storeId: string
    status: string
    sourceRevision: number
    naturalScopeType: string
    naturalScopeKey: string
  }
  storeId: string
  roles: Array<{
    roleId: string
    roleCode: string
    roleName: string
    roleSource: string
    scopeType: string
    permissionIds: string[]
    status: string
  }>
  bindings: Array<{
    bindingId: string
    userId: string
    roleId: string | null
    storeId: string
    scopeSelector: Record<string, unknown>
    policyEffect: string
    effectiveFrom: string | null
    effectiveTo: string | null
    status: string
    role: UserEffectivePermissions['roles'][number] | null
  }>
  permissions: Array<{
    permissionId: string
    permissionCode: string
    permissionName: string
    permissionType: string
    status: string
  }>
  projection: {
    userTopic: string
    bindingTopic: string
    scopeType: string
    scopeKey: string
    userItemKey: string
    bindingItemKeys: string[]
  }
  security: {
    secretsIncluded: boolean
    redactedFields: string[]
  }
}

export type StoreEffectiveIam = {
  storeId: string
  users: UserEffectivePermissions[]
  bindingIds: string[]
  projection: {
    userTopic: string
    bindingTopic: string
    scopeType: string
    scopeKey: string
  }
}
