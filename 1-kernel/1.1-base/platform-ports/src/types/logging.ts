import type {
    CommandId,
    ConnectionId,
    NodeId,
    RequestId,
    SessionId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogEnvironmentMode = 'DEV' | 'PROD' | 'TEST'
export type LogMaskingMode = 'raw' | 'masked'

export interface LogScope {
    moduleName: string
    layer?: 'kernel' | 'ui' | 'adapter' | 'assembly' | 'mock-server'
    subsystem?: string
    component?: string
}

export interface LogContext {
    requestId?: RequestId
    commandId?: CommandId
    commandName?: string
    sessionId?: SessionId
    connectionId?: ConnectionId
    nodeId?: NodeId
    peerNodeId?: NodeId
}

export interface LogEvent {
    timestamp: TimestampMs
    level: LogLevel
    category: string
    event: string
    message?: string
    scope: LogScope
    context?: LogContext
    data?: Record<string, unknown>
    error?: {
        name?: string
        code?: string
        message: string
        stack?: string
    }
    security: {
        containsSensitiveRaw: boolean
        maskingMode: LogMaskingMode
    }
}

export interface LogWriteInput {
    category: string
    event: string
    message?: string
    context?: LogContext
    data?: Record<string, unknown>
    error?: LogEvent['error']
}

export interface LoggerPort {
    emit(event: LogEvent): void
    debug(input: LogWriteInput): void
    info(input: LogWriteInput): void
    warn(input: LogWriteInput): void
    error(input: LogWriteInput): void
    scope(binding: Partial<LogScope>): LoggerPort
    withContext(context: LogContext): LoggerPort
}

export interface CreateLoggerPortInput {
    environmentMode: LogEnvironmentMode
    write: (event: LogEvent) => void
    scope: LogScope
    context?: LogContext
}
