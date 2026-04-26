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

export type PageResult<T> = {
  data: T[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export type PageQuery = {
  page?: number
  size?: number
  search?: string
  status?: string
  filters?: Record<string, string | number | boolean | null | undefined>
}

type ApiRequestInit = RequestInit & {
  skipSandboxHeader?: boolean
}

const CUSTOMER_PAGE_SIZE = 500
const LOCAL_API_BASE_URL = 'http://127.0.0.1:5830'
const configuredApiBaseUrl = (import.meta as ImportMeta & {
  env?: {VITE_ADMIN_CONSOLE_API_BASE_URL?: string}
}).env?.VITE_ADMIN_CONSOLE_API_BASE_URL?.trim()
const isLocalDevConsole = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  && window.location.port === '5840'
const API_BASE_URL = configuredApiBaseUrl || (isLocalDevConsole ? LOCAL_API_BASE_URL : '')

let activeSandboxId = ''

const headers = (init?: ApiRequestInit) => ({
  'content-type': 'application/json',
  ...(activeSandboxId && !init?.skipSandboxHeader ? {'x-sandbox-id': activeSandboxId} : {}),
  ...(init?.headers ?? {}),
})

const readErrorMessage = <T>(payload: ApiResponse<T> | null, response: Response) =>
  payload?.error?.message
  ?? payload?.message
  ?? `request failed: ${response.status}`

const buildRequestUrl = (url: string) => {
  if (!API_BASE_URL || /^https?:\/\//.test(url)) {
    return url
  }
  return `${API_BASE_URL}${url}`
}

const resolveAssetUrl = (url: string) => {
  if (!url || /^https?:\/\//.test(url) || !API_BASE_URL) {
    return url
  }
  return `${API_BASE_URL}${url}`
}

const buildPageUrl = (path: string, query: PageQuery = {}) => {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('size', String(query.size ?? 20))
  if (query.search?.trim()) {
    params.set('search', query.search.trim())
  }
  if (query.status?.trim()) {
    params.set('status', query.status.trim())
  }
  Object.entries(query.filters ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === 'ALL') {
      return
    }
    params.set(key, String(value))
  })
  return `${path}?${params.toString()}`
}

const request = async <T>(url: string, init?: ApiRequestInit) => {
  const {skipSandboxHeader: _skipSandboxHeader, ...fetchInit} = init ?? {}
  const response = await fetch(buildRequestUrl(url), {
    ...fetchInit,
    headers: headers(init),
  })
  const payload = await response.json() as ApiResponse<T>
  const isExplicitFailure = payload.success === false
    || (typeof payload.code === 'string' && payload.code !== '0' && payload.code !== 'SUCCESS')

  if (!response.ok || isExplicitFailure) {
    throw new Error(readErrorMessage(payload, response))
  }

  return payload.data
}

const requestPage = async <T>(url: string, init?: ApiRequestInit): Promise<PageResult<T>> => {
  const {skipSandboxHeader: _skipSandboxHeader, ...fetchInit} = init ?? {}
  const response = await fetch(buildRequestUrl(url), {
    ...fetchInit,
    headers: headers(init),
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

const uploadAsset = async (input: {
  kind: 'brand-logo' | 'product-image' | 'menu-product-image'
  file: File
}) => {
  const contentBase64 = await fileToBase64(input.file)
  const asset = await request<{
    url: string
    assetId: string
    fileName: string
    mimeType: string
    size: number
  }>('/api/v1/customer/assets', {
    method: 'POST',
    body: JSON.stringify({
      kind: input.kind,
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      contentBase64,
    }),
  })
  return {
    ...asset,
    url: resolveAssetUrl(asset.url),
  }
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : ''
    resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
  }
  reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
  reader.readAsDataURL(file)
})

export const api = {
  setActiveSandboxId: (sandboxId: string) => {
    activeSandboxId = sandboxId
  },
  uploadCustomerAsset: uploadAsset,
  getSandboxes: () => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>('/api/v1/org/sandboxes?page=1&size=100', {skipSandboxHeader: true}),
  createSandbox: (input: {
    sandboxId?: string
    sandboxCode: string
    sandboxName: string
    sandboxType?: string
    description?: string
    owner?: string
  }) => request<EntityItemLike>('/api/v1/org/sandboxes', {
    method: 'POST',
    skipSandboxHeader: true,
    body: JSON.stringify(input),
  }),
  activateSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/activate`, {
    method: 'POST',
    skipSandboxHeader: true,
    body: JSON.stringify({}),
  }),
  suspendSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/suspend`, {
    method: 'POST',
    skipSandboxHeader: true,
    body: JSON.stringify({}),
  }),
  closeSandbox: (sandboxId: string) => request<EntityItemLike>(`/api/v1/org/sandboxes/${sandboxId}/close`, {
    method: 'POST',
    skipSandboxHeader: true,
    body: JSON.stringify({}),
  }),
  updateCustomerEntity: (entityType: string, entityId: string, input: {
    title?: string
    status?: string
    data?: Record<string, unknown>
    expectedRevision?: number
  }) => request<EntityItemLike>(`/api/v1/customer/entities/${entityType}/${entityId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
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
    metadataCatalog?: Record<string, unknown>
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
    projectPhases?: Array<Record<string, unknown>>
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
    companyName?: string
    socialCreditCode?: string
    contactName?: string
    contactPhone?: string
    invoiceTitle?: string
    settlementCycle?: string
    billingEmail?: string
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
    platformId?: string
    brandCategory?: string
    brandDescription?: string
    brandLogoUrl?: string
    brandNameEn?: string
    standardMenuEnabled?: boolean
    standardPricingLocked?: boolean
    erpIntegrationEnabled?: boolean
    erpApiEndpoint?: string
  }) => request<EntityItemLike>('/api/v1/org/brands', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getBrandMetadata: (brandId: string, query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl(`/api/v1/org/brands/${brandId}/metadata`, query ?? {size: CUSTOMER_PAGE_SIZE})),
  createBrandMetadata: (brandId: string, input: {
    metadataId?: string
    metadataType: string
    metadataName: string
    options?: Array<Record<string, unknown> | string>
    selectionType?: string
    required?: boolean
    minSelections?: number
    maxSelections?: number
  }) => request<EntityItemLike>(`/api/v1/org/brands/${brandId}/metadata`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createStore: (input: {
    storeId?: string
    storeCode: string
    storeName: string
    unitCode: string
    storeType?: string
    storeFormats?: string[]
    floor?: string
    areaSqm?: number
    businessHours?: string
    projectId: string
  }) => request<EntityItemLike>('/api/v1/org/stores', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createContract: (input: {
    contractId?: string
    contractNo?: string
    contractCode?: string
    storeId: string
    lessorProjectId?: string
    lessorPhaseId?: string
    tenantId: string
    brandId: string
    entityId?: string
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
  getProjectionOutbox: (query?: {status?: string; page?: number; size?: number}) => requestPage<{
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
  }>(buildPageUrl('/api/v1/diagnostics/projections/outbox', {
    page: query?.page ?? 1,
    size: query?.size ?? CUSTOMER_PAGE_SIZE,
    status: query?.status,
  })),
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
  getProjectionPublishLog: (query?: {page?: number; size?: number}) => requestPage<{
    publishId: string
    outboxId: string
    request: Record<string, unknown>
    response: Record<string, unknown>
    createdAt: number
  }>(buildPageUrl('/api/v1/diagnostics/projections/publish-log', {
    page: query?.page ?? 1,
    size: query?.size ?? CUSTOMER_PAGE_SIZE,
  })),
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
  }>(`/api/v1/diagnostics/events?page=1&size=${CUSTOMER_PAGE_SIZE}`),
  getProjectionDiagnostics: () => requestPage<{
    diagnosticId: string
    topicKey: string
    scopeType: string
    scopeKey: string
    itemKey: string
    status: string
    detail: Record<string, unknown>
    createdAt: number
  }>(`/api/v1/diagnostics/projections/delivery?page=1&size=${CUSTOMER_PAGE_SIZE}`),
  getPlatforms: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/platforms', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getProjects: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/projects', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getTenants: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/tenants', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getTenantStores: (tenantId: string, query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl(`/api/v1/org/tenants/${tenantId}/stores`, query ?? {size: 100})),
  getBrands: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/brands', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getStores: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/stores', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getContracts: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/contracts', query ?? {size: CUSTOMER_PAGE_SIZE})),
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
  getBusinessEntities: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/legal-entities', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createBusinessEntity: (input: {
    entityId?: string
    entityCode: string
    entityName: string
    tenantId: string
    companyName?: string
    unifiedSocialCreditCode?: string
    legalRepresentative?: string
    entityType?: string
    bankName?: string
    bankAccountName?: string
    bankAccountNo?: string
    bankBranch?: string
    taxRegistrationNo?: string
    taxpayerType?: string
    taxRate?: number
    settlementCycle?: string
    settlementDay?: number | null
    autoSettlementEnabled?: boolean
  }) => request<EntityItemLike>('/api/v1/org/legal-entities', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getTables: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/tables', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createTable: (storeId: string, input: {
    tableId?: string
    tableNo: string
    tableName?: string
    area?: string
    capacity?: number
    tableType?: string
    qrCodeUrl?: string | null
    qrCodeContent?: string | null
    currentBookingId?: string | null
    currentCustomerCount?: number | null
    occupiedAt?: string | null
    estimatedDuration?: number | null
    sortOrder?: number
    reservable?: boolean
    consumerDescription?: string | null
    minimumSpend?: number | null
  }) => request<EntityItemLike>(`/api/v1/org/stores/${storeId}/tables`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getWorkstations: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/org/workstations', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createWorkstation: (storeId: string, input: {
    workstationId?: string
    workstationCode: string
    workstationName: string
    categoryCodes?: string[]
    workstationType?: string
    responsibleCategories?: string[]
    description?: string | null
  }) => request<EntityItemLike>(`/api/v1/org/stores/${storeId}/workstations`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getUsers: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/users', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getPermissions: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/permissions', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createPermission: (input: {
    permissionId?: string
    permissionCode: string
    permissionName: string
    permissionType?: string
    platformId?: string
  }) => request<EntityItemLike>('/api/v1/permissions', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getRoles: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/roles', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createRole: (input: {
    roleCode: string
    roleName: string
    scopeType: string
    permissionIds: string[]
    platformId?: string
    roleType?: string
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
  updateRolePermissions: (roleId: string, input: {
    permissionIds: string[]
    expectedRevision?: number
  }) => request<EntityItemLike>(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  getUserRoleBindings: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/user-role-bindings', query ?? {size: CUSTOMER_PAGE_SIZE})),
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
    storeId?: string
    scopeType?: string
    scopeId?: string
    effectiveFrom?: string
    effectiveTo?: string | null
    reason?: string | null
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
  getProducts: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/products', query ?? {size: CUSTOMER_PAGE_SIZE})),
  getProductCategories: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/product-categories', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createProductCategory: (input: {
    categoryId?: string
    categoryCode: string
    categoryName: string
    parentCategoryId?: string | null
    ownershipScope?: 'BRAND' | 'STORE'
    brandId?: string | null
    storeId?: string | null
    sortOrder?: number
  }) => request<EntityItemLike>('/api/v1/product-categories', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createProduct: (input: {
    productId?: string
    productCode?: string
    productName: string
    ownershipScope: 'BRAND' | 'STORE'
    brandId?: string
    storeId?: string
    productType?: string
    categoryId?: string | null
    imageUrl?: string
    productDescription?: string | null
    basePrice?: number
    comboPricingStrategy?: Record<string, unknown> | string | null
    comboItems?: Array<Record<string, unknown>>
    productionProfile?: Record<string, unknown>
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
  getMenus: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/menus', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createBrandMenu: (input: {
    brandMenuId?: string
    brandId: string
    menuName: string
    channelType?: string
    effectiveFrom?: string | null
    effectiveTo?: string | null
    parentMenuId?: string | null
    version?: number
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
  getStoreMenus: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/store-menus', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createStoreMenu: (input: {
    menuId?: string
    storeId: string
    menuName: string
    brandMenuId?: string | null
    channelType?: string
    menuType?: string
    inheritMode?: string
    effectiveFrom?: string | null
    effectiveTo?: string | null
    parentMenuId?: string | null
    version?: number
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
  getStoreConfigs: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/store-configs', query ?? {size: CUSTOMER_PAGE_SIZE})),
  updateStoreConfig: (storeId: string, input: {
    businessStatus?: string
    acceptOrder?: boolean
    operatingStatus?: string
    autoAcceptEnabled?: boolean
    acceptTimeoutSeconds?: number
    preparationBufferMinutes?: number
    maxConcurrentOrders?: number
    operatingHours?: Array<Record<string, unknown>>
    specialOperatingDays?: Array<Record<string, unknown>>
    channelOperatingHours?: Array<Record<string, unknown>>
    autoOpenCloseEnabled?: boolean
    extraChargeRules?: Array<Record<string, unknown>>
    refundStockPolicy?: string
    version?: number
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/config`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  getInventories: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/inventories', query ?? {size: CUSTOMER_PAGE_SIZE})),
  updateInventory: (storeId: string, productId: string, input: {
    stockId?: string
    saleableQuantity: number
    skuId?: string
    stockGranularity?: string
    stockType?: string
    stockDate?: string
    periodId?: string
    totalQuantity?: number | null
    soldQuantity?: number
    reservedQuantity?: number
    safetyStock?: number
    soldOutThreshold?: number
    reservationTtlSeconds?: number
    resetPolicy?: string
    ingredientConsumption?: Array<Record<string, unknown>>
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/inventories/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  getPriceRules: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/price-rules', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createPriceRule: (input: {
    ruleCode: string
    ruleName?: string
    productId?: string
    storeId: string
    priceType?: string
    channelType?: string
    priceDelta?: number
    priceValue?: number
    timeSlot?: {start?: string; end?: string} | null
    memberTier?: string | null
    priority?: number
    discountType?: string
    discountValue?: number
    applicableProductIds?: string[]
    effectiveFrom?: string | null
    effectiveTo?: string | null
  }) => request<EntityItemLike>('/api/v1/product-price-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updatePriceRule: (ruleId: string, input: {
    ruleName?: string
    channelType?: string
    timeSlot?: {start?: string; end?: string} | null
    memberTier?: string | null
    priority?: number
    discountType?: string
    discountValue?: number
    applicableProductIds?: string[]
    effectiveFrom?: string | null
    effectiveTo?: string | null
    expectedRevision?: number
  }) => request<EntityItemLike>(`/api/v1/price-rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  disablePriceRule: (ruleId: string, input: {reason?: string} = {}) => request<EntityItemLike>(`/api/v1/price-rules/${ruleId}/disable`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getAvailabilityRules: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/availability-rules', query ?? {size: CUSTOMER_PAGE_SIZE})),
  createAvailabilityRule: (storeId: string, input: {
    ruleCode: string
    productId?: string
    ruleType?: string
    ruleConfig?: Record<string, unknown>
    channelType?: string
    timeSlot?: Record<string, unknown> | null
    dailyQuota?: number | null
    priority?: number
    enabled?: boolean
    available?: boolean
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/availability-rules`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getMenuAvailability: (query?: PageQuery) => requestPage<{
    aggregateId: string
    entityId: string
    title: string
    status: string
    payload: Record<string, unknown>
  }>(buildPageUrl('/api/v1/menu-availability', query ?? {size: CUSTOMER_PAGE_SIZE})),
  updateMenuAvailability: (storeId: string, productId: string, input: {
    available: boolean
    soldOutReason?: string | null
    effectiveFrom?: string
  }) => request<EntityItemLike>(`/api/v1/stores/${storeId}/menu-availability/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  getTerminalAuthCapabilities: () => request<{
    status: string
    implemented: boolean
    routes: string[]
    tdpPublishPath: string
  }>('/api/v1/auth/capabilities'),
}

export type EntityItemLike = {
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
