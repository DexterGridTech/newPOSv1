import type {
    AppError,
    CommandId,
    CommandRouteContext,
    RequestId,
    RuntimeInstanceId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'

export type CommandVisibility = 'public' | 'internal'
export type CommandTarget = 'local' | 'peer'
export type ActorExecutionStatus = 'COMPLETED' | 'FAILED' | 'TIMEOUT'
export type CommandAggregateStatus = 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED' | 'TIMEOUT'
export type CommandQueryStatus = CommandAggregateStatus | 'RUNNING'

export interface CommandDefinition<TPayload = unknown> {
    moduleName: string
    commandName: string
    visibility: CommandVisibility
    timeoutMs: number
    allowNoActor: boolean
    allowReentry: boolean
    defaultTarget: CommandTarget
}

export interface DefineCommandInput {
    moduleName: string
    commandName: string
    visibility?: CommandVisibility
    timeoutMs?: number
    allowNoActor?: boolean
    allowReentry?: boolean
    defaultTarget?: CommandTarget
}

export interface CommandIntent<TPayload = unknown> {
    definition: CommandDefinition<TPayload>
    payload: TPayload
}

export interface DispatchOptions {
    requestId?: RequestId
    commandId?: CommandId
    parentCommandId?: CommandId
    target?: CommandTarget
    routeContext?: CommandRouteContext
}

export interface ActorDispatchOptions {
    target?: CommandTarget
    routeContext?: CommandRouteContext
}

export interface DispatchedCommand<TPayload = unknown> {
    runtimeId: RuntimeInstanceId
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    commandName: string
    payload: TPayload
    target: CommandTarget
    routeContext?: CommandRouteContext
    dispatchedAt: TimestampMs
}

export interface ActorExecutionResult {
    actorKey: string
    status: ActorExecutionStatus
    startedAt?: TimestampMs
    completedAt?: TimestampMs
    result?: Record<string, unknown>
    error?: AppError
}

export interface CommandAggregateResult {
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    commandName: string
    target: CommandTarget
    status: CommandAggregateStatus
    startedAt: TimestampMs
    completedAt?: TimestampMs
    actorResults: readonly ActorExecutionResult[]
}

export interface CommandQueryResult {
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    commandName: string
    target: CommandTarget
    status: CommandQueryStatus
    startedAt: TimestampMs
    completedAt?: TimestampMs
    actorResults: readonly ActorExecutionResult[]
}
