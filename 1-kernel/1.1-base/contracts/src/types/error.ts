import type {CommandId, NodeId, RequestId, SessionId, TimestampMs} from './ids'

export type ErrorCategory =
    | 'BUSINESS'
    | 'VALIDATION'
    | 'AUTHENTICATION'
    | 'AUTHORIZATION'
    | 'NETWORK'
    | 'DATABASE'
    | 'EXTERNAL_API'
    | 'SYSTEM'
    | 'UNKNOWN'

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorDefinition {
    key: string
    name: string
    defaultTemplate: string
    category: ErrorCategory
    severity: ErrorSeverity
    code?: string
    moduleName?: string
}

export interface AppError {
    name: string
    message: string
    key: string
    code: string
    category: ErrorCategory
    severity: ErrorSeverity
    commandName?: string
    commandId?: CommandId
    requestId?: RequestId
    sessionId?: SessionId
    nodeId?: NodeId
    createdAt: TimestampMs
    args?: Record<string, unknown>
    details?: unknown
    cause?: unknown
    stack?: string
}

export interface ErrorCatalogEntry {
    key: string
    template: string
    updatedAt: TimestampMs
    source: 'default' | 'remote' | 'host'
}

export interface ResolvedErrorView {
    key: string
    code: string
    name: string
    category: ErrorCategory
    severity: ErrorSeverity
    template: string
    message: string
    source: 'catalog' | 'definition-default' | 'app-error'
}

export interface CreateAppErrorContext {
    commandName?: string
    commandId?: CommandId
    requestId?: RequestId
    sessionId?: SessionId
    nodeId?: NodeId
}

export interface CreateAppErrorInput {
    args?: Record<string, unknown>
    context?: CreateAppErrorContext
    details?: unknown
    cause?: unknown
}
