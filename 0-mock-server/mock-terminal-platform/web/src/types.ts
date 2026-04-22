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

export interface PlatformItem {
  platformId: string
  platformCode: string
  platformName: string
  status: string
  description: string
  projectCount?: number
  storeCount?: number
  updatedAt: number
}

export interface TerminalItem {
  terminalId: string
  platformId?: string
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
  platformId?: string
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
  platformId: string
  platformName?: string
  tenantCode: string
  tenantName: string
  status: string
  description: string
  projectCount?: number
  storeCount?: number
  updatedAt: number
}

export interface BrandItem {
  brandId: string
  platformId: string
  platformName?: string
  brandCode: string
  brandName: string
  status: string
  description: string
  projectCount?: number
  storeCount?: number
  updatedAt: number
}

export interface ProjectItem {
  projectId: string
  platformId: string
  platformName?: string
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
  platformId: string
  platformName?: string
  tenantId: string
  tenantName?: string
  brandId: string
  brandName?: string
  projectId: string
  projectName?: string
  unitCode: string
  storeCode: string
  storeName: string
  status: string
  description: string
  address?: string | null
  contactName?: string | null
  contactPhone?: string | null
  terminalCount?: number
  activationCodeCount?: number
  contractCount?: number
  updatedAt: number
}

export interface ContractItem {
  contractId: string
  platformId: string
  platformName?: string
  projectId: string
  projectName?: string
  tenantId: string
  tenantName?: string
  brandId: string
  brandName?: string
  storeId: string
  storeName?: string
  contractCode: string
  unitCode: string
  startDate?: string | null
  endDate?: string | null
  status: string
  description: string
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

export interface TerminalLogFileItem {
  logFileId: string
  terminalId: string
  logDate: string
  displayIndex: number
  displayRole: string
  fileName: string
  contentType: string
  fileSize: number
  sha256: string
  storagePath: string
  commandId?: string | null
  instanceId?: string | null
  releaseId?: string | null
  uploadedAt: number
  updatedAt: number
  metadata: Record<string, unknown>
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
  localNodeId?: string | null
  displayIndex?: number | null
  displayCount?: number | null
  instanceMode?: string | null
  displayMode?: string | null
  status: string
  connectedAt: number
  lastHeartbeatAt?: number | null
  lastDeliveredRevision?: number | null
  lastAckedRevision?: number | null
  lastAppliedRevision?: number | null
  highWatermark?: number
  ackLag?: number
  applyLag?: number
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

export interface CommandOutboxItem {
  commandId: string
  terminalId: string
  topicKey: string
  status: string
  payload: Record<string, unknown>
  sourceReleaseId?: string | null
  deliveredAt?: number | null
  ackedAt?: number | null
  expiresAt?: number | null
  updatedAt: number
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

export interface SelectorGroupItem {
  groupId: string
  sandboxId: string
  groupCode: string
  name: string
  description: string
  enabled: boolean
  priority: number
  selectorDslJson: Record<string, unknown>
  membershipVersion: number
  createdAt: number
  updatedAt: number
}

export interface ProjectionPolicyItem {
  policyId: string
  sandboxId: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  enabled: boolean
  payloadJson: Record<string, unknown>
  description: string
  createdAt: number
  updatedAt: number
  currentMatchedTerminalCount?: number
}

export interface HotUpdateManifestItem {
  manifestVersion: 1
  packageId?: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  channel: string
  bundleVersion: string
  runtimeVersion: string
  assemblyVersion: string
  buildNumber: number
  builtAt: string
  compatibility: Record<string, unknown>
  package: {
    type: string
    entry: string
    size: number
    sha256: string
    files?: Array<{
      path: string
      size: number
      sha256: string
    }>
  }
  restart: Record<string, unknown>
  releaseNotes?: string[]
  artifacts?: Array<{
    name: string
    path: string
    size?: number
    sha256?: string
    modifiedAt?: string
  }>
}

export interface HotUpdatePackageItem {
  packageId: string
  sandboxId: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  channel: string
  bundleVersion: string
  runtimeVersion: string
  assemblyVersion: string
  buildNumber: number
  manifest: HotUpdateManifestItem
  manifestSha256: string
  fileName: string
  fileSize: number
  sha256: string
  status: string
  downloadUrl: string
  createdAt: number
  updatedAt: number
}

export interface HotUpdateReleaseItem {
  releaseId: string
  sandboxId: string
  packageId: string
  topicKey: string
  itemKey: string
  scopeType: 'GROUP' | 'TERMINAL'
  scopeKey: string
  enabled: boolean
  desiredPayload: Record<string, unknown>
  policyId?: string | null
  status: string
  createdBy: string
  createdAt: number
  updatedAt: number
  materializedTerminalCount?: number
  packageSummary?: HotUpdatePackageItem | null
}

export interface HotUpdateImpactPreview {
  total: number
  terminalIds: string[]
  scopeType?: string
  scopeKey?: string
  reason?: string
  warnings?: string[]
}

export interface TerminalVersionReportItem {
  reportId: string
  terminalId: string
  displayIndex: number
  displayRole: string
  appId: string
  assemblyVersion: string
  buildNumber: number
  runtimeVersion: string
  bundleVersion: string
  source: string
  packageId?: string | null
  releaseId?: string | null
  state: string
  reason?: string | null
  reportedAt: number
}

export interface TerminalGroupMembershipGroupItem {
  groupId: string
  groupCode: string
  name: string
  priority: number
  rank: number
  matchedBy: Record<string, unknown>
}

export interface TerminalGroupMembershipItem {
  terminalId: string
  membershipVersion: number
  groups: TerminalGroupMembershipGroupItem[]
}

export interface PolicyImpactPreview {
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  targetTerminalCount: number
  changedTerminalCount: number
  warnings: string[]
  impacts: Array<{
    terminalId: string
    changed: boolean
    reason: string
    currentWinner: Record<string, unknown> | null
    nextWinner: Record<string, unknown> | null
  }>
}

export interface SelectorGroupPreview {
  selectorDslJson: Record<string, unknown>
  selectorExplain?: string
  matchedTerminalCount: number
  sampleTerminals: Array<{
    terminalId: string
    projectId: string
    storeId: string
    profileId: string
    templateId: string
    runtimeVersion: string
    assemblyAppId: string
    matchedBy: Record<string, unknown>
    explain?: {
      matched: boolean
      summary: string
      items: Array<{
        field: string
        operator: string
        expected: string[]
        actual: string[]
        matched: boolean
      }>
    }
  }>
  distributions: Record<string, Array<{ key: string; count: number }>>
  warnings: string[]
}

export interface SelectorGroupStats {
  group: SelectorGroupItem & {
    selectorExplain?: string
  }
  memberCount: number
  members: Array<{
    terminalId: string
    projectId: string
    storeId: string
    profileId: string
    templateId: string
    runtimeVersion: string
    assemblyAppId: string
    rank: number
    membershipVersion: number
    matchedBy: Record<string, unknown>
    computedAt: number
    updatedAt: number
  }>
  distributions: Record<string, Array<{ key: string; count: number }>>
  policies: ProjectionPolicyItem[]
}

export interface ProjectionPolicyValidation {
  valid: boolean
  conflictCount: number
  conflicts: Array<{
    policyId: string
    topicKey: string
    itemKey: string
    scopeType: string
    scopeKey: string
    description: string
    updatedAt: number
  }>
  warnings: string[]
}

export interface TdpPolicyCenterOverview {
  sandboxId: string
  stats: {
    groups: { total: number; enabled: number; disabled: number; withoutMembers: number }
    policies: { total: number; enabled: number; disabled: number }
    terminals: { total: number; missingRuntimeFacts: number }
  }
  recentGroups: Array<SelectorGroupItem & { memberCount: number }>
  recentPolicies: ProjectionPolicyItem[]
  risks: {
    groupsWithoutMembers: Array<{ groupId: string; groupCode: string; name: string }>
    missingRuntimeFactsTerminalCount: number
    conflicts: unknown[]
  }
  recentAudit: Array<Record<string, unknown>>
}

export interface TerminalDecisionTrace {
  terminalId: string
  runtimeFacts: Record<string, unknown>
  membershipSnapshot: TerminalGroupMembershipItem
  perTopicCandidates: Array<{
    topicKey: string
    itemKey: string
    candidates: Array<Record<string, unknown>>
    winner: Record<string, unknown> | null
  }>
  resolvedResults: Record<string, Record<string, Record<string, unknown>>>
}

export interface TopicDecisionItem {
  terminalId: string
  topicKey: string
  items: Array<{
    topicKey: string
    itemKey: string
    candidates: Array<Record<string, unknown>>
    winner: Record<string, unknown> | null
  }>
}
