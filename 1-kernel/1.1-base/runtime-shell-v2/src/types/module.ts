import type {AppModule, AppModuleDependency, NodeId} from '@next/kernel-base-contracts'
import type {
    RootState,
    StateRuntimeSliceDescriptor,
} from '@next/kernel-base-state-runtime'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import type {PlatformPorts} from '@next/kernel-base-platform-ports'
import type {ActorDefinition} from './actor'
import type {CommandDefinition, CommandIntent} from './command'
import type {RequestQueryResult} from './request'
import type {CommandAggregateResult, DispatchOptions} from './command'
import type {
    CommandEventEnvelope,
    CommandId,
    CommandRouteContext,
    ErrorDefinition,
    ParameterDefinition,
    RequestLifecycleSnapshot,
    ResolvedParameter,
    StateSyncDiffEnvelope,
} from '@next/kernel-base-contracts'
import type {RuntimeDisplayContextV2} from './runtime'

export interface RuntimeModuleContextV2 {
    readonly moduleName: string
    readonly localNodeId: NodeId
    readonly platformPorts: PlatformPorts
    readonly displayContext: RuntimeDisplayContextV2
    readonly descriptors: readonly KernelRuntimeModuleDescriptorV2[]
    getState(): RootState
    getStore(): EnhancedStore
    dispatchAction(action: UnknownAction): UnknownAction
    flushPersistence(): Promise<void>
    subscribeState(listener: () => void): () => void
    dispatchCommand<TPayload = unknown>(
        command: CommandIntent<TPayload>,
        options?: DispatchOptions,
    ): Promise<CommandAggregateResult>
    installPeerDispatchGateway(gateway: {
        dispatchCommand<TPayload = unknown>(
            command: CommandIntent<TPayload>,
            options: DispatchOptions,
        ): Promise<CommandAggregateResult>
    } | undefined): void
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

export interface TdpTopicInterestDeclarationV1 {
    topicKey: string
    category?: 'projection' | 'command' | 'system'
    required?: boolean
    reason?: string
}

export interface KernelRuntimeModuleV2 extends AppModule {
    dependencies?: readonly AppModuleDependency[]
    stateSlices?: readonly StateRuntimeSliceDescriptor<any>[]
    commandDefinitions?: readonly CommandDefinition[]
    actorDefinitions?: readonly ActorDefinition[]
    errorDefinitions?: readonly ErrorDefinition[]
    parameterDefinitions?: readonly ParameterDefinition<any>[]
    tdpTopicInterests?: readonly TdpTopicInterestDeclarationV1[]
    install?: (context: RuntimeModuleContextV2) => Promise<void> | void
    onApplicationReset?: (
        context: RuntimeModuleContextV2,
        input?: {
            reason?: string
            previousState?: RootState
        },
    ) => Promise<void> | void
    preSetup?: (context: RuntimeModulePreSetupContextV2) => Promise<void> | void
}

export interface KernelRuntimeModuleDescriptorV2 {
    moduleName: string
    packageVersion: string
    protocolVersion?: string
    dependencies: readonly AppModuleDependency[]
    stateSliceNames: readonly string[]
    commandNames: readonly string[]
    actorKeys: readonly string[]
    errorKeys: readonly string[]
    parameterKeys: readonly string[]
    tdpTopicInterests: readonly TdpTopicInterestDeclarationV1[]
    hasInstall: boolean
    hasPreSetup: boolean
}

export interface RuntimeModulePreSetupContextV2 {
    readonly moduleName: string
    readonly localNodeId: NodeId
    readonly platformPorts: PlatformPorts
    readonly displayContext: RuntimeDisplayContextV2
    readonly descriptors: readonly KernelRuntimeModuleDescriptorV2[]
}
