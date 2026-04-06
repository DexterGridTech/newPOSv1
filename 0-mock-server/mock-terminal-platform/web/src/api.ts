import type {
  ActivationCodeItem,
  ActivationResult,
  ApiResponse,
  AuditLogItem,
  ChangeLogItem,
  FaultRuleItem,
  ImportValidationResult,
  OverviewStats,
  PaginatedResult,
  ProjectionItem,
  SandboxItem,
  SceneTemplateItem,
  ScopeStats,
  SessionItem,
  TaskInstanceItem,
  TaskReleaseItem,
  TaskTrace,
  TemplateLibraryItem,
  TerminalItem,
  TopicItem,
} from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  const payload = (await response.json()) as ApiResponse<T>
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`)
  }

  return payload.data
}

export const api = {
  getOverview: () => request<OverviewStats>('/api/v1/admin/overview'),
  getSandboxes: () => request<SandboxItem[]>('/api/v1/admin/sandboxes'),
  getAuditLogs: (page = 1, pageSize = 10) => request<PaginatedResult<AuditLogItem>>(`/api/v1/admin/audit-logs?page=${page}&pageSize=${pageSize}`),
  exportAll: () => request<Record<string, unknown>>('/api/v1/admin/export'),
  getTopicLibrary: () => request<TemplateLibraryItem[]>('/api/v1/admin/templates/topic-library'),
  getFaultLibrary: () => request<TemplateLibraryItem[]>('/api/v1/admin/templates/fault-library'),
  validateImportTemplates: (payload: Record<string, unknown>) => request<ImportValidationResult>('/api/v1/admin/import/templates/validate', { method: 'POST', body: JSON.stringify(payload) }),
  importTemplates: (payload: Record<string, unknown>) => request('/api/v1/admin/import/templates', { method: 'POST', body: JSON.stringify(payload) }),
  getTerminals: () => request<TerminalItem[]>('/api/v1/admin/terminals'),
  getActivationCodes: () => request<ActivationCodeItem[]>('/api/v1/admin/activation-codes'),
  getTaskReleases: () => request<TaskReleaseItem[]>('/api/v1/admin/tasks/releases'),
  getTaskInstances: () => request<TaskInstanceItem[]>('/api/v1/admin/tasks/instances'),
  getTaskTrace: (instanceId: string) => request<TaskTrace>(`/api/v1/admin/tasks/instances/${instanceId}/trace`),
  getSessions: () => request<SessionItem[]>('/api/v1/admin/tdp/sessions'),
  connectSession: (payload: Record<string, unknown>) => request('/api/v1/tdp/sessions/connect', { method: 'POST', body: JSON.stringify(payload) }),
  disconnectSession: (sessionId: string) => request(`/api/v1/tdp/sessions/${sessionId}/disconnect`, { method: 'POST' }),
  heartbeatSession: (sessionId: string) => request(`/api/v1/tdp/sessions/${sessionId}/heartbeat`, { method: 'POST' }),
  getTopics: () => request<TopicItem[]>('/api/v1/admin/tdp/topics'),
  getScopeStats: () => request<ScopeStats>('/api/v1/admin/tdp/scopes'),
  getProjections: () => request<ProjectionItem[]>('/api/v1/admin/tdp/projections'),
  getChangeLogs: () => request<ChangeLogItem[]>('/api/v1/admin/tdp/change-logs'),
  getTerminalSnapshot: (terminalId: string) => request(`/api/v1/tdp/terminals/${terminalId}/snapshot`),
  getTerminalChanges: (terminalId: string) => request(`/api/v1/tdp/terminals/${terminalId}/changes`),
  getSceneTemplates: () => request<SceneTemplateItem[]>('/mock-admin/scenes/templates'),
  getFaultRules: () => request<FaultRuleItem[]>('/mock-admin/fault-rules'),
  batchCreateTerminals: (count: number) => request<{ count: number; terminalIds: string[] }>('/mock-admin/terminals/batch-create', { method: 'POST', body: JSON.stringify({ count }) }),
  batchCreateActivationCodes: (count: number) => request<{ count: number; codes: string[] }>('/api/v1/admin/activation-codes/batch', { method: 'POST', body: JSON.stringify({ count }) }),
  activateTerminal: (payload: Record<string, unknown>) => request<ActivationResult>('/api/v1/terminals/activate', { method: 'POST', body: JSON.stringify(payload) }),
  forceTerminalStatus: (terminalId: string, payload: Record<string, unknown>) => request(`/mock-admin/terminals/${terminalId}/force-status`, { method: 'POST', body: JSON.stringify(payload) }),
  createTaskRelease: (payload: Record<string, unknown>) => request('/api/v1/admin/tasks/releases', { method: 'POST', body: JSON.stringify(payload) }),
  createTopic: (payload: Record<string, unknown>) => request('/api/v1/admin/tdp/topics', { method: 'POST', body: JSON.stringify(payload) }),
  upsertProjection: (payload: Record<string, unknown>) => request('/api/v1/admin/tdp/projections/upsert', { method: 'POST', body: JSON.stringify(payload) }),
  runSceneTemplate: (sceneTemplateId: string) => request(`/mock-admin/scenes/${sceneTemplateId}/run`, { method: 'POST' }),
  createFaultRule: (payload: Record<string, unknown>) => request('/mock-admin/fault-rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateFaultRule: (faultRuleId: string, payload: Record<string, unknown>) => request(`/mock-admin/fault-rules/${faultRuleId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  simulateFaultHit: (faultRuleId: string) => request(`/mock-admin/fault-rules/${faultRuleId}/hit`, { method: 'POST' }),
  mockTaskResult: (instanceId: string, payload: Record<string, unknown>) => request(`/mock-debug/tasks/${instanceId}/mock-result`, { method: 'POST', body: JSON.stringify(payload) }),
}
