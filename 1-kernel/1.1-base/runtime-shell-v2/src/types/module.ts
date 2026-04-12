import type {AppModule, AppModuleDependency, NodeId} from '@impos2/kernel-base-contracts'
import type {
    RootState,
    StateRuntimeSliceDescriptor,
} from '@impos2/kernel-base-state-runtime'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {ActorDefinition} from './actor'
import type {CommandDefinition, CommandIntent} from './command'
import type {RequestQueryResult} from './request'
import type {CommandAggregateResult, DispatchOptions} from './command'
import type {
    CommandEventEnvelope,
    CommandId,
    CommandRouteContext,
    ParameterDefinition,
    RequestLifecycleSnapshot,
    ResolvedParameter,
    StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'

export interface RuntimeModuleContextV2 {
    readonly moduleName: string
    readonly localNodeId: NodeId
    readonly platformPorts: PlatformPorts
    getState(): RootState
    getStore(): EnhancedStore
    dispatchAction(action: UnknownAction): UnknownAction
    subscribeState(listener: () => void): () => void
    dispatchCommand<TPayload = unknown>(
        command: CommandIntent<TPayload>,
        options?: DispatchOptions,
    ): Promise<CommandAggregateResult>
    installPeerDispatchGateway(gateway: import('./runtime').PeerDispatchGateway | undefined): void
    queryRequest(requestId: string): RequestQueryResult | undefined
    resolveParameter<TValue = unknown>(input: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue>
    registerMirroredCommand(input: {
        requestId: string
        commandId: CommandId
        parentCommandId?: CommandId
        commandName: string
        target?: import('./command').CommandTarget
        routeContext?: CommandRouteContext
    }): void
    applyRemoteCommandEvent(envelope: CommandEventEnvelope): void
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    getSyncSlices(): readonly StateRuntimeSliceDescriptor<any>[]
    applyStateSyncDiff(envelope: StateSyncDiffEnvelope): void
}

export interface KernelRuntimeModuleV2 extends AppModule {
    dependencies?: readonly AppModuleDependency[]
    stateSlices?: readonly StateRuntimeSliceDescriptor<any>[]
    commandDefinitions?: readonly CommandDefinition[]
    actorDefinitions?: readonly ActorDefinition[]
    install?: (context: RuntimeModuleContextV2) => Promise<void> | void
}
