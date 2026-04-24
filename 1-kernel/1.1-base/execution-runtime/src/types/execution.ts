import type {
    AppError,
    CommandId,
    CommandRouteContext,
    RequestId,
    SessionId,
    TimestampMs,
} from '@next/kernel-base-contracts'

export interface ExecutionCommand<TPayload = unknown> {
    commandId: CommandId
    requestId: RequestId
    sessionId?: SessionId
    commandName: string
    payload: TPayload
    context?: CommandRouteContext
    parentCommandId?: CommandId
    internal?: boolean
}

export interface ExecutionContext<TPayload = unknown> {
    command: ExecutionCommand<TPayload>
    dispatchChild: (command: ExecutionCommand) => Promise<ExecutionResult>
}

export interface ExecutionSuccessResult {
    status: 'completed'
    result?: Record<string, unknown>
}

export interface ExecutionFailureResult {
    status: 'failed'
    error: AppError
}

export type ExecutionResult = ExecutionSuccessResult | ExecutionFailureResult

export interface ExecutionLifecycleEvent {
    eventType: 'started' | 'completed' | 'failed'
    commandId: CommandId
    requestId: RequestId
    commandName: string
    internal: boolean
    occurredAt: TimestampMs
}

export type ExecutionHandler<TPayload = unknown> = (
    context: ExecutionContext<TPayload>,
) => Promise<Record<string, unknown> | void>

export interface ExecutionMiddleware {
    name: string
    handle(
        context: ExecutionContext,
        next: () => Promise<ExecutionResult>,
    ): Promise<ExecutionResult>
}
