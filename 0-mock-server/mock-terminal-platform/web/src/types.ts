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
  sandboxId?: string
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
  isSystemDefault: boolean
  isCurrent: boolean
  creationMode: string
  sourceSandboxId?: string | null
  purpose: string
  resourceLimits: Record<string, unknown>
  createdAt?: number
  updatedAt: number
}

export interface RuntimeContext {
  currentSandboxId: string
  currentSandbox: SandboxItem | null
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
  tenantId?: string
  brandId?: string
  projectId?: string
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
  tenantId?: string
  brandId?: string
  projectId?: string
  storeId: string
  profileId: string
  templateId?: string | null
  status: string
  usedBy?: string | null
  expiresAt?: number | null
}

export interface TenantItem {
  tenantId: string
  tenantCode: string
  tenantName: string
  status: string
  description: string
  brandCount?: number
  projectCount?: number
  storeCount?: number
  updatedAt: number
}

export interface BrandItem {
  brandId: string
  brandCode: string
  brandName: string
  status: string
  description: string
  projectCount?: number
  storeCount?: number
  authorizedTenantCount?: number
  updatedAt: number
}

export interface TenantBrandAuthorizationItem {
  authorizationId: string
  tenantId: string
  tenantName?: string
  brandId: string
  brandName?: string
  status: string
  description: string
  updatedAt: number
}

export interface ProjectItem {
  projectId: string
  projectCode: string
  projectName: string
  status: string
  description: string
  region?: string | null
  timezone?: string | null
  storeCount?: number
  terminalCount?: number
  updatedAt: number
}

export interface StoreItem {
  storeId: string
  tenantId: string
  tenantName?: string
  brandId: string
  brandName?: string
  projectId: string
  projectName?: string
  storeCode: string
  storeName: string
  status: string
  description: string
  address?: string | null
  contactName?: string | null
  contactPhone?: string | null
  terminalCount?: number
  activationCodeCount?: number
  updatedAt: number
}

export interface ProfileItem {
  profileId: string
  profileCode: string
  name: string
  description: string
  capabilities: Record<string, unknown>
  templateCount?: number
  terminalCount?: number
  updatedAt: number
}

export interface TerminalTemplateItem {
  templateId: string
  templateCode: string
  name: string
  description: string
  profileId: string
  presetConfig: Record<string, unknown>
  presetTags: string[]
  activationCodeCount?: number
  terminalCount?: number
  updatedAt: number
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
