import type {UnknownAction} from '@reduxjs/toolkit'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {
    NodeId,
    ParameterDefinition,
    ResolvedParameter,
    RuntimeInstanceId,
} from '@impos2/kernel-base-contracts'
import type {
    ActorDispatchOptions,
    CommandAggregateResult,
    CommandDefinition,
    CommandIntent,
    DispatchedCommand,
} from './command'
import type {RequestQueryResult} from './request'

export interface ActorInfo {
    actorKey: string
    moduleName: string
    actorName: string
}

export interface ActorExecutionContext<TPayload = unknown> {
    readonly runtimeId: RuntimeInstanceId
    readonly localNodeId: NodeId
    readonly command: DispatchedCommand<TPayload>
    readonly actor: ActorInfo
    getState(): RootState
    dispatchAction(action: UnknownAction): UnknownAction
    subscribeState(listener: () => void): () => void
    dispatchCommand<TChildPayload = unknown>(
        command: CommandIntent<TChildPayload>,
        options?: ActorDispatchOptions,
    ): Promise<CommandAggregateResult>
    queryRequest(requestId: string): RequestQueryResult | undefined
    resolveParameter<TValue = unknown>(input: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue>
}

export type ActorCommandHandler<TPayload = unknown> = (
    context: ActorExecutionContext<TPayload>,
) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void

export interface ActorCommandHandlerDefinition<TPayload = unknown> {
    commandName: string
    handle: ActorCommandHandler<TPayload>
}

export type ActorCommandHandlerDefinitionFor<TCommand extends CommandDefinition<any>> =
    ActorCommandHandlerDefinition<
        TCommand extends CommandDefinition<infer TPayload>
            ? TPayload
            : never
    >

export type AnyActorCommandHandlerDefinition = ActorCommandHandlerDefinition<any>

export interface ActorDefinition {
    moduleName: string
    actorName: string
    actorKey?: string
    handlers: readonly AnyActorCommandHandlerDefinition[]
}

export interface RegisteredActorHandler {
    actor: ActorInfo
    commandName: string
    handle: ActorCommandHandler<any>
    order: number
}
