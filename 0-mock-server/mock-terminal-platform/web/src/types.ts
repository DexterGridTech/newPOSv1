export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    message: string
    details?: unknown
  }
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface OverviewStats {
  terminalStats: { total: number; online: number; warning: number; error: number }
  taskStats: { total: number; running: number; completed: number; failed: number }
  sessionStats: { total: number; connected: number }
  topicStats: { total: number }
  faultStats: { total: number; hits: number }
}

export interface SandboxItem {
  sandboxId: string
  name: string
  description: string
  status: string
  purpose: string
  resourceLimits: Record<string, unknown>
  updatedAt: number
}

export interface AuditLogItem {
  auditId?: string
  audit_id?: string
  domain: string
  action: string
  operator: string
  targetId?: string
  target_id?: string
  detail: Record<string, unknown>
  createdAt?: number
  created_at?: number
}

export interface TemplateLibraryItem {
  templateId: string
  category: string
  key?: string
  name: string
  scopeType?: string
  targetType?: string
  matcher?: Record<string, unknown>
  action?: Record<string, unknown>
  schema?: Record<string, unknown>
}

export interface ImportValidationResult {
  valid: boolean
  checks: string[]
  topicCount: number
  faultRuleCount: number
}

export interface TerminalItem {
  terminalId: string
  storeId: string
  profileId: string
  templateId: string
  lifecycleStatus: string
  presenceStatus: string
  healthStatus: string
  currentAppVersion?: string | null
  currentBundleVersion?: string | null
  currentConfigVersion?: string | null
  deviceInfo: Record<string, unknown>
  updatedAt: number
}

export interface ActivationCodeItem {
  code: string
  storeId: string
  profileId: string
  status: string
  usedBy?: string | null
  expiresAt?: number | null
}

export interface TaskReleaseItem {
  releaseId: string
  title: string
  taskType: string
  sourceType: string
  sourceId: string
  priority: number
  status: string
  approvalStatus: string
  targetSelector: Record<string, unknown>
  payload: Record<string, unknown>
  updatedAt: number
}

export interface TaskInstanceItem {
  instanceId: string
  releaseId: string
  terminalId: string
  taskType: string
  status: string
  deliveryStatus: string
  payload: Record<string, unknown>
  result?: unknown
  error?: unknown
  updatedAt: number
}

export interface TaskTrace {
  instance: Record<string, unknown>
  release: Record<string, unknown> | null
  dataPlane: {
    projections: Array<Record<string, unknown>>
    changes: Array<Record<string, unknown>>
  }
}

export interface SessionItem {
  sessionId: string
  terminalId: string
  clientVersion: string
  protocolVersion: string
  status: string
  connectedAt: number
  lastHeartbeatAt?: number | null
}

export interface TopicItem {
  topicId: string
  key: string
  name: string
  payloadMode: string
  scopeType: string
  retentionHours: number
  schema: Record<string, unknown>
}

export interface ScopeStats {
  topicScopes: Array<{ topic_key: string; scope_type: string; topic_count: number }>
  projectionScopes: Array<{ topic_key: string; scope_type: string; scope_key: string; revision: number; updated_at: number }>
}

export interface ProjectionItem {
  projectionId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  revision: number
  payload: Record<string, unknown>
  updatedAt: number
}

export interface ChangeLogItem {
  changeId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  revision: number
  payload: Record<string, unknown>
  sourceReleaseId?: string | null
  createdAt: number
}

export interface SceneTemplateItem {
  sceneTemplateId: string
  name: string
  description: string
  category?: string
  steps: string[]
}

export interface FaultRuleItem {
  faultRuleId: string
  name: string
  targetType: string
  matcher: Record<string, unknown>
  action: Record<string, unknown>
  enabled: boolean
  hitCount: number
  updatedAt: number
}

export interface ActivationResult {
  terminalId: string
  token: string
  refreshToken: string
  expiresIn: number
}
