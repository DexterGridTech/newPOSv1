import type {
    CommandEventEnvelope,
    CommandRouteContext,
    NodeId,
    ParameterDefinition,
    RequestLifecycleSnapshot,
    RequestId,
    ResolvedParameter,
    RuntimeInstanceId,
    StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {RootState, StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {EnhancedStore, StoreEnhancer} from '@reduxjs/toolkit'
import type {
    CommandAggregateResult,
    CommandIntent,
    DispatchOptions,
} from './command'
import type {
    KernelRuntimeModuleDescriptorV2,
    KernelRuntimeModuleV2,
} from './module'
import type {RequestListener, RequestQueryResult} from './request'

export interface PeerDispatchGateway {
    dispatchCommand<TPayload = unknown>(
        command: CommandIntent<TPayload>,
        options: DispatchOptions,
    ): Promise<CommandAggregateResult>
}

export interface RuntimeDisplayContextV2 {
    displayIndex?: number
    displayCount?: number
}

export interface CreateKernelRuntimeV2Input {
    runtimeId?: RuntimeInstanceId
    localNodeId?: NodeId
    platformPorts?: Partial<PlatformPorts>
    storeEnhancers?: readonly StoreEnhancer[]
    modules?: readonly KernelRuntimeModuleV2[]
    peerDispatchGateway?: PeerDispatchGateway
    displayContext?: RuntimeDisplayContextV2
}

export interface KernelRuntimeV2 {
    readonly runtimeId: RuntimeInstanceId
    readonly localNodeId: NodeId
    readonly environmentMode: PlatformPorts['environmentMode']
    readonly displayContext: RuntimeDisplayContextV2
    start(): Promise<void>
    dispatchCommand<TPayload = unknown>(
        command: CommandIntent<TPayload>,
        options?: DispatchOptions,
    ): Promise<CommandAggregateResult>
    queryRequest(requestId: RequestId): RequestQueryResult | undefined
    subscribeRequest(requestId: RequestId, listener: RequestListener): () => void
    subscribeRequests(listener: RequestListener): () => void
    subscribeState(listener: () => void): () => void
    getState(): RootState
    getStore(): EnhancedStore
    resolveParameter<TValue = unknown>(input: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue>
    registerMirroredCommand(input: {
        requestId: RequestId
        commandId: import('@impos2/kernel-base-contracts').CommandId
        parentCommandId?: import('@impos2/kernel-base-contracts').CommandId
        commandName: string
        target?: import('./command').CommandTarget
        routeContext?: CommandRouteContext
    }): void
    applyRemoteCommandEvent(envelope: CommandEventEnvelope): void
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    getSyncSlices(): readonly StateRuntimeSliceDescriptor<any>[]
    applyStateSyncDiff(envelope: StateSyncDiffEnvelope): void
    installPeerDispatchGateway(gateway: PeerDispatchGateway | undefined): void
    flushPersistence(): Promise<void>
    resetApplicationState(input?: {reason?: string}): Promise<void>
}

export interface KernelRuntimeAppConfigV2 {
    runtimeName?: string
    runtimeId?: RuntimeInstanceId
    localNodeId?: NodeId
    platformPorts?: Partial<PlatformPorts>
    storeEnhancers?: readonly StoreEnhancer[]
    modules?: readonly KernelRuntimeModuleV2[]
    peerDispatchGateway?: PeerDispatchGateway
    displayContext?: RuntimeDisplayContextV2
    autoStart?: boolean
}

export interface KernelRuntimeAppDescriptorV2 {
    runtimeName: string
    runtimeId: RuntimeInstanceId
    localNodeId: NodeId
    moduleDescriptors: readonly KernelRuntimeModuleDescriptorV2[]
}

export interface KernelRuntimeAppV2 {
    readonly runtimeName: string
    readonly runtime: KernelRuntimeV2
    readonly descriptor: KernelRuntimeAppDescriptorV2
    start(): Promise<KernelRuntimeV2>
    flushPersistence(): Promise<void>
}
