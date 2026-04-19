import type {
  ActivationCodeItem,
  ActivationResult,
  ApiResponse,
  AuditLogItem,
  BrandItem,
  ChangeLogItem,
  CommandOutboxItem,
  ContractItem,
  FaultRuleItem,
  ImportValidationResult,
  OverviewStats,
  PaginatedResult,
  PlatformItem,
  HotUpdateImpactPreview,
  HotUpdatePackageItem,
  HotUpdateReleaseItem,
  ProjectionPolicyValidation,
  PolicyImpactPreview,
  ProfileItem,
  ProjectionItem,
  ProjectItem,
  ProjectionPolicyItem,
  RuntimeContext,
  SandboxItem,
  SceneTemplateItem,
  ScopeStats,
  SelectorGroupPreview,
  SelectorGroupItem,
  SelectorGroupStats,
  SessionItem,
  StoreItem,
  TaskInstanceItem,
  TaskReleaseItem,
  TaskTrace,
  TenantItem,
  TemplateLibraryItem,
  TdpPolicyCenterOverview,
  TerminalItem,
  TopicDecisionItem,
  TerminalDecisionTrace,
  TerminalGroupMembershipItem,
  TerminalVersionReportItem,
  TerminalTemplateItem,
  TopicItem,
} from './types'

let currentSandboxId = ''

const SANDBOX_EXEMPT_PATHS = new Set([
  '/api/v1/admin/overview',
  '/api/v1/admin/runtime-context',
  '/api/v1/admin/runtime-context/current-sandbox',
  '/api/v1/admin/sandboxes',
  '/api/v1/admin/templates/topic-library',
  '/api/v1/admin/templates/fault-library',
  '/api/v1/admin/audit-logs',
  '/mock-debug/kernel-base-test/prepare',
])

const shouldAttachSandboxId = (pathname: string) => {
  if (!currentSandboxId) return false
  if (SANDBOX_EXEMPT_PATHS.has(pathname)) return false
  return true
}

const withSandboxInUrl = (inputUrl: string, method: string) => {
  const url = new URL(inputUrl, window.location.origin)
  if (method === 'GET' || method === 'DELETE') {
    if (shouldAttachSandboxId(url.pathname) && !url.searchParams.has('sandboxId')) {
      url.searchParams.set('sandboxId', currentSandboxId)
    }
  }
  return url
}

const withSandboxInBody = (pathname: string, body: BodyInit | null | undefined, headers: HeadersInit | undefined) => {
  if (!shouldAttachSandboxId(pathname) || !body) {
    return body
  }
  const contentType = new Headers(headers).get('Content-Type') ?? 'application/json'
  if (!contentType.includes('application/json') || typeof body !== 'string') {
    return body
  }
  const parsed = JSON.parse(body) as Record<string, unknown>
  if (typeof parsed.sandboxId !== 'string' || !parsed.sandboxId.trim()) {
    parsed.sandboxId = currentSandboxId
  }
  return JSON.stringify(parsed)
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase()
  const nextUrl = withSandboxInUrl(url, method)
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers ?? {}),
  }
  const nextBody = withSandboxInBody(nextUrl.pathname, options?.body, headers)

  const response = await fetch(nextUrl.toString(), {
    ...options,
    method,
    headers,
    body: nextBody,
  })

  const payload = (await response.json()) as ApiResponse<T>
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`)
  }

  return payload.data
}

const requestWithoutSandbox = <T>(url: string, options?: RequestInit) => request<T>(url, options)

export const api = {
  setCurrentSandboxId: (sandboxId: string) => {
    currentSandboxId = sandboxId.trim()
  },
  getCurrentSandboxId: () => currentSandboxId,
  buildExportDownloadUrl: () => withSandboxInUrl('/api/v1/admin/export/download', 'GET').toString(),

  getOverview: () => requestWithoutSandbox<OverviewStats>('/api/v1/admin/overview'),
  getRuntimeContext: () => requestWithoutSandbox<RuntimeContext>('/api/v1/admin/runtime-context'),
  switchCurrentSandbox: (sandboxId: string) => requestWithoutSandbox<RuntimeContext>('/api/v1/admin/runtime-context/current-sandbox', { method: 'PUT', body: JSON.stringify({ sandboxId }) }),
  getSandboxes: () => requestWithoutSandbox<SandboxItem[]>('/api/v1/admin/sandboxes'),
  createSandbox: (payload: Record<string, unknown>) => requestWithoutSandbox<SandboxItem>('/api/v1/admin/sandboxes', { method: 'POST', body: JSON.stringify(payload) }),
  updateSandbox: (sandboxId: string, payload: Record<string, unknown>) => requestWithoutSandbox<SandboxItem>(`/api/v1/admin/sandboxes/${sandboxId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getAuditLogs: (page = 1, pageSize = 10) => requestWithoutSandbox<PaginatedResult<AuditLogItem>>(`/api/v1/admin/audit-logs?page=${page}&pageSize=${pageSize}`),

  exportAll: () => request<Record<string, unknown>>('/api/v1/admin/export'),
  getTopicLibrary: () => requestWithoutSandbox<TemplateLibraryItem[]>('/api/v1/admin/templates/topic-library'),
  getFaultLibrary: () => requestWithoutSandbox<TemplateLibraryItem[]>('/api/v1/admin/templates/fault-library'),
  validateImportTemplates: (payload: Record<string, unknown>) => request<ImportValidationResult>('/api/v1/admin/import/templates/validate', { method: 'POST', body: JSON.stringify(payload) }),
  importTemplates: (payload: Record<string, unknown>) => request('/api/v1/admin/import/templates', { method: 'POST', body: JSON.stringify(payload) }),

  getPlatforms: () => request<PlatformItem[]>('/api/v1/admin/master-data/platforms'),
  createPlatform: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/platforms', { method: 'POST', body: JSON.stringify(payload) }),
  updatePlatform: (platformId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/platforms/${platformId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePlatform: (platformId: string) => request(`/api/v1/admin/master-data/platforms/${platformId}`, { method: 'DELETE' }),
  getTenants: () => request<TenantItem[]>('/api/v1/admin/master-data/tenants'),
  createTenant: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/tenants', { method: 'POST', body: JSON.stringify(payload) }),
  updateTenant: (tenantId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/tenants/${tenantId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTenant: (tenantId: string) => request(`/api/v1/admin/master-data/tenants/${tenantId}`, { method: 'DELETE' }),
  getBrands: () => request<BrandItem[]>('/api/v1/admin/master-data/brands'),
  createBrand: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/brands', { method: 'POST', body: JSON.stringify(payload) }),
  updateBrand: (brandId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/brands/${brandId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBrand: (brandId: string) => request(`/api/v1/admin/master-data/brands/${brandId}`, { method: 'DELETE' }),
  getProjects: () => request<ProjectItem[]>('/api/v1/admin/master-data/projects'),
  createProject: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/projects', { method: 'POST', body: JSON.stringify(payload) }),
  updateProject: (projectId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProject: (projectId: string) => request(`/api/v1/admin/master-data/projects/${projectId}`, { method: 'DELETE' }),
  getStores: () => request<StoreItem[]>('/api/v1/admin/master-data/stores'),
  createStore: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/stores', { method: 'POST', body: JSON.stringify(payload) }),
  updateStore: (storeId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/stores/${storeId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteStore: (storeId: string) => request(`/api/v1/admin/master-data/stores/${storeId}`, { method: 'DELETE' }),
  getContracts: () => request<ContractItem[]>('/api/v1/admin/master-data/contracts'),
  createContract: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/contracts', { method: 'POST', body: JSON.stringify(payload) }),
  updateContract: (contractId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/contracts/${contractId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteContract: (contractId: string) => request(`/api/v1/admin/master-data/contracts/${contractId}`, { method: 'DELETE' }),
  getMasterProfiles: () => request<ProfileItem[]>('/api/v1/admin/master-data/profiles'),
  createProfile: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/profiles', { method: 'POST', body: JSON.stringify(payload) }),
  updateProfile: (profileId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/profiles/${profileId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProfile: (profileId: string) => request(`/api/v1/admin/master-data/profiles/${profileId}`, { method: 'DELETE' }),
  getMasterTemplates: () => request<TerminalTemplateItem[]>('/api/v1/admin/master-data/templates'),
  createTemplate: (payload: Record<string, unknown>) => request('/api/v1/admin/master-data/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (templateId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/master-data/templates/${templateId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTemplate: (templateId: string) => request(`/api/v1/admin/master-data/templates/${templateId}`, { method: 'DELETE' }),

  getTerminals: () => request<TerminalItem[]>('/api/v1/admin/terminals'),
  getActivationCodes: () => request<ActivationCodeItem[]>('/api/v1/admin/activation-codes'),
  getTaskReleases: () => request<TaskReleaseItem[]>('/api/v1/admin/tasks/releases'),
  getTaskInstances: () => request<TaskInstanceItem[]>('/api/v1/admin/tasks/instances'),
  getTaskTrace: (instanceId: string) => request<TaskTrace>(`/api/v1/admin/tasks/instances/${instanceId}/trace`),
  getSessions: () => request<SessionItem[]>('/api/v1/admin/tdp/sessions'),
  sendEdgeDegraded: (sessionId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/tdp/sessions/${sessionId}/edge-degraded`, { method: 'POST', body: JSON.stringify(payload) }),
  sendSessionRehome: (sessionId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/tdp/sessions/${sessionId}/rehome`, { method: 'POST', body: JSON.stringify(payload) }),
  connectSession: (payload: Record<string, unknown>) => request('/api/v1/tdp/sessions/connect', { method: 'POST', body: JSON.stringify(payload) }),
  disconnectSession: (sessionId: string) => request(`/api/v1/tdp/sessions/${sessionId}/disconnect`, { method: 'POST', body: JSON.stringify({}) }),
  heartbeatSession: (sessionId: string) => request(`/api/v1/tdp/sessions/${sessionId}/heartbeat`, { method: 'POST', body: JSON.stringify({}) }),
  getTopics: () => request<TopicItem[]>('/api/v1/admin/tdp/topics'),
  getScopeStats: () => request<ScopeStats>('/api/v1/admin/tdp/scopes'),
  getTdpPolicyCenterOverview: () => request<TdpPolicyCenterOverview>('/api/v1/admin/tdp/policy-center/overview'),
  getTdpGroups: () => request<SelectorGroupItem[]>('/api/v1/admin/tdp/groups'),
  previewTdpGroup: (payload: Record<string, unknown>) => request<SelectorGroupPreview>('/api/v1/admin/tdp/groups/preview', { method: 'POST', body: JSON.stringify(payload) }),
  createTdpGroup: (payload: Record<string, unknown>) => request<SelectorGroupItem>('/api/v1/admin/tdp/groups', { method: 'POST', body: JSON.stringify(payload) }),
  updateTdpGroup: (groupId: string, payload: Record<string, unknown>) => request(`/api/v1/admin/tdp/groups/${groupId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTdpGroup: (groupId: string) => request(`/api/v1/admin/tdp/groups/${groupId}`, { method: 'DELETE' }),
  recomputeTdpGroupsByScope: (payload: Record<string, unknown>) => request<{ total: number; items: TerminalGroupMembershipItem[] }>('/api/v1/admin/tdp/groups/recompute-by-scope', { method: 'POST', body: JSON.stringify(payload) }),
  recomputeAllTdpGroups: () => request<{ total: number; items: TerminalGroupMembershipItem[] }>('/api/v1/admin/tdp/groups/recompute-all', { method: 'POST', body: JSON.stringify({}) }),
  getTdpGroupStats: (groupId: string) => request<SelectorGroupStats>(`/api/v1/admin/tdp/groups/${groupId}/stats`),
  getTdpGroupMemberships: (groupId: string) => request<{ groupId: string; memberCount: number; members: Array<Record<string, unknown>> }>(`/api/v1/admin/tdp/groups/${groupId}/memberships`),
  getTdpGroupPolicies: (groupId: string) => request<ProjectionPolicyItem[]>(`/api/v1/admin/tdp/groups/${groupId}/policies`),
  getTdpPolicies: () => request<ProjectionPolicyItem[]>('/api/v1/admin/tdp/policies'),
  validateTdpPolicy: (payload: Record<string, unknown>) => request<ProjectionPolicyValidation>('/api/v1/admin/tdp/policies/validate', { method: 'POST', body: JSON.stringify(payload) }),
  createTdpPolicy: (payload: Record<string, unknown>) => request<ProjectionPolicyItem>('/api/v1/admin/tdp/policies', { method: 'POST', body: JSON.stringify(payload) }),
  updateTdpPolicy: (policyId: string, payload: Record<string, unknown>) => request<ProjectionPolicyItem>(`/api/v1/admin/tdp/policies/${policyId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTdpPolicy: (policyId: string) => request(`/api/v1/admin/tdp/policies/${policyId}`, { method: 'DELETE' }),
  previewTdpPolicyImpact: (payload: Record<string, unknown>) => request<PolicyImpactPreview>('/api/v1/admin/tdp/policies/preview-impact', { method: 'POST', body: JSON.stringify(payload) }),
  getHotUpdatePackages: () => request<HotUpdatePackageItem[]>('/api/v1/admin/hot-updates/packages'),
  getHotUpdatePackage: (packageId: string) => request<HotUpdatePackageItem>(`/api/v1/admin/hot-updates/packages/${packageId}`),
  uploadHotUpdatePackage: (payload: { fileName: string; contentBase64: string }) =>
    request<HotUpdatePackageItem>('/api/v1/admin/hot-updates/packages/upload', { method: 'POST', body: JSON.stringify(payload) }),
  updateHotUpdatePackageStatus: (packageId: string, status: string) =>
    request<HotUpdatePackageItem>(`/api/v1/admin/hot-updates/packages/${packageId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getHotUpdateReleases: () => request<HotUpdateReleaseItem[]>('/api/v1/admin/hot-updates/releases'),
  getHotUpdateRelease: (releaseId: string) => request<HotUpdateReleaseItem>(`/api/v1/admin/hot-updates/releases/${releaseId}`),
  createHotUpdateRelease: (payload: Record<string, unknown>) =>
    request<HotUpdateReleaseItem>('/api/v1/admin/hot-updates/releases', { method: 'POST', body: JSON.stringify(payload) }),
  activateHotUpdateRelease: (releaseId: string) =>
    request<HotUpdateReleaseItem>(`/api/v1/admin/hot-updates/releases/${releaseId}/activate`, { method: 'POST', body: JSON.stringify({}) }),
  pauseHotUpdateRelease: (releaseId: string) =>
    request<HotUpdateReleaseItem>(`/api/v1/admin/hot-updates/releases/${releaseId}/pause`, { method: 'POST', body: JSON.stringify({}) }),
  cancelHotUpdateRelease: (releaseId: string) =>
    request<HotUpdateReleaseItem>(`/api/v1/admin/hot-updates/releases/${releaseId}/cancel`, { method: 'POST', body: JSON.stringify({}) }),
  previewHotUpdateReleaseImpact: (releaseId: string) =>
    request<HotUpdateImpactPreview>(`/api/v1/admin/hot-updates/releases/${releaseId}/preview-impact`, { method: 'POST', body: JSON.stringify({}) }),
  getTerminalVersionHistory: (terminalId: string) => request<TerminalVersionReportItem[]>(`/api/v1/admin/terminals/${terminalId}/version-history`),
  getHotUpdateVersionDrift: () => request<TerminalVersionReportItem[]>('/api/v1/admin/hot-updates/version-drift'),
  getTerminalGroupMemberships: (terminalId: string) => request<TerminalGroupMembershipItem>(`/api/v1/admin/tdp/terminals/${terminalId}/memberships`),
  getTerminalDecisionTrace: (terminalId: string) => request<TerminalDecisionTrace>(`/api/v1/admin/tdp/terminals/${terminalId}/decision-trace`),
  getTerminalTopicDecision: (terminalId: string, topicKey: string) => request<TopicDecisionItem>(`/api/v1/admin/tdp/terminals/${terminalId}/topics/${encodeURIComponent(topicKey)}/decision`),
  getProjections: () => request<ProjectionItem[]>('/api/v1/admin/tdp/projections'),
  getChangeLogs: () => request<ChangeLogItem[]>('/api/v1/admin/tdp/change-logs'),
  getCommandOutbox: () => request<CommandOutboxItem[]>('/api/v1/admin/tdp/commands'),
  getTerminalSnapshot: (terminalId: string) => request(`/api/v1/tdp/terminals/${terminalId}/snapshot`),
  getTerminalChanges: (terminalId: string) => request(`/api/v1/tdp/terminals/${terminalId}/changes`),
  getSceneTemplates: () => request<SceneTemplateItem[]>('/mock-admin/scenes/templates'),
  getFaultRules: () => request<FaultRuleItem[]>('/mock-admin/fault-rules'),
  batchCreateTerminals: (count: number) => request<{ count: number; terminalIds: string[] }>('/mock-admin/terminals/batch-create', { method: 'POST', body: JSON.stringify({ count }) }),
  batchCreateActivationCodes: (payload: number | Record<string, unknown>) =>
    request<{ count: number; codes: string[] }>('/api/v1/admin/activation-codes/batch', {
      method: 'POST',
      body: JSON.stringify(typeof payload === 'number' ? { count: payload } : payload),
    }),
  activateTerminal: (payload: Record<string, unknown>) => request<ActivationResult>('/api/v1/terminals/activate', { method: 'POST', body: JSON.stringify(payload) }),
  forceTerminalStatus: (terminalId: string, payload: Record<string, unknown>) => request(`/mock-admin/terminals/${terminalId}/force-status`, { method: 'POST', body: JSON.stringify(payload) }),
  createTaskRelease: (payload: Record<string, unknown>) => request('/api/v1/admin/tasks/releases', { method: 'POST', body: JSON.stringify(payload) }),
  createTopic: (payload: Record<string, unknown>) => request('/api/v1/admin/tdp/topics', { method: 'POST', body: JSON.stringify(payload) }),
  upsertProjection: (payload: Record<string, unknown>) => request('/api/v1/admin/tdp/projections/upsert', { method: 'POST', body: JSON.stringify(payload) }),
  runSceneTemplate: (sceneTemplateId: string) => request(`/mock-admin/scenes/${sceneTemplateId}/run`, { method: 'POST', body: JSON.stringify({}) }),
  createFaultRule: (payload: Record<string, unknown>) => request('/mock-admin/fault-rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateFaultRule: (faultRuleId: string, payload: Record<string, unknown>) => request(`/mock-admin/fault-rules/${faultRuleId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  simulateFaultHit: (faultRuleId: string) => request(`/mock-admin/fault-rules/${faultRuleId}/hit`, { method: 'POST', body: JSON.stringify({}) }),
  mockTaskResult: (instanceId: string, payload: Record<string, unknown>) => request(`/mock-debug/tasks/${instanceId}/mock-result`, { method: 'POST', body: JSON.stringify(payload) }),
}
