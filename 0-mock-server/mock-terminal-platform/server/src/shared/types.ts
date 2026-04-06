export type SandboxStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type SandboxPurpose = 'dev' | 'integration' | 'regression' | 'bug-replay' | 'demo'
export type LifecycleStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED'
export type PresenceStatus = 'ONLINE' | 'OFFLINE'
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'ERROR'
export type SourceMode = 'STANDARD' | 'MOCK_OVERRIDE' | 'FAULT_INJECTED'
export type TaskType = 'CONFIG_PUBLISH' | 'APP_UPGRADE' | 'REMOTE_CONTROL'
export type ReleaseStatus = 'DRAFT' | 'APPROVED' | 'DISPATCHING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'ACKED' | 'TIMEOUT' | 'FAILED'
export type SessionStatus = 'CONNECTED' | 'DISCONNECTED'
export type ProjectionScopeType = 'TERMINAL' | 'STORE' | 'TENANT' | 'GLOBAL'

export interface JsonRecord {
  [key: string]: unknown
}
