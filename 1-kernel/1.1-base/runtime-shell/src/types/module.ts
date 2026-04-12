import type {
    AppModule,
    AppModuleDependency,
    AppModuleActorDescriptor,
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    CommandRouteContext,
    ErrorCatalogEntry,
    NodeId,
    ParameterDefinition,
    ParameterCatalogEntry,
    ProjectionMirrorEnvelope,
    RequestId,
    RequestLifecycleSnapshot,
    RequestProjection,
    RuntimeInstanceId,
    SessionId,
    StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import type {ExecutionCommand, ExecutionResult} from '@impos2/kernel-base-execution-runtime'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {DefinitionRegistryBundle} from '@impos2/kernel-base-definition-registry'
import type {TopologyRuntime} from '@impos2/kernel-base-topology-runtime'
import type {
    RootState,
    StateRuntimeSliceDescriptor,
} from '@impos2/kernel-base-state-runtime'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import type {
    CreateRemoteDispatchEnvelopeInput,
    HandleRemoteDispatchOptions,
} from './runtime'

export interface StartupSeed {
    requestProjections?: Record<string, RequestProjection>
    errorCatalog?: Record<string, ErrorCatalogEntry>
    parameterCatalog?: Record<string, ParameterCatalogEntry>
}

export interface DispatchRuntimeCommandInput<TPayload = unknown> {
    commandName: string
    payload: TPayload
    requestId?: RequestId
    sessionId?: SessionId
    context?: CommandRouteContext
    internal?: boolean
}

export interface RuntimeModuleContext {
    readonly runtimeId: RuntimeInstanceId
    readonly localNodeId: string
    readonly moduleName: string
    readonly platformPorts: PlatformPorts
    readonly registries: DefinitionRegistryBundle
    readonly topology: TopologyRuntime
    getState(): RootState
    getStore(): EnhancedStore
    dispatchAction(action: UnknownAction): UnknownAction
    subscribeState(listener: () => void): () => void
    createRemoteDispatchEnvelope<TPayload = unknown>(
        input: CreateRemoteDispatchEnvelopeInput<TPayload>,
    ): CommandDispatchEnvelope
    handleRemoteDispatch(
        envelope: CommandDispatchEnvelope,
        options?: HandleRemoteDispatchOptions,
    ): Promise<{events: readonly CommandEventEnvelope[]}>
    applyRemoteCommandEvent(envelope: CommandEventEnvelope): void
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    applyProjectionMirror(envelope: ProjectionMirrorEnvelope): void
    getRequestProjection(requestId: RequestId): RequestProjection | undefined
    listTrackedRequestIds(input?: {
        peerNodeId?: NodeId
    }): readonly RequestId[]
    resolveParameter<TValue = unknown>(input: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): {
        key: string
        value: TValue
        source: 'default' | 'catalog-fallback' | 'catalog'
        valid: boolean
    }
    getSyncSlices(): readonly StateRuntimeSliceDescriptor<any>[]
    applyStateSyncDiff(envelope: StateSyncDiffEnvelope): void
    publishActor<TPayload = unknown>(input: {
        actorName: string
        payload: TPayload
    }): Promise<void>
}

export interface RuntimeModuleHostBootstrapContext extends RuntimeModuleContext {}

export interface KernelRuntimeHandlerContext<TPayload = unknown> extends RuntimeModuleContext {
    readonly command: ExecutionCommand<TPayload>
    dispatchChild<TChildPayload = unknown>(input: DispatchRuntimeCommandInput<TChildPayload>): Promise<ExecutionResult>
}

export type KernelRuntimeHandler<TPayload = unknown> = (
    context: KernelRuntimeHandlerContext<TPayload>,
) => Promise<Record<string, unknown> | void>

export interface KernelRuntimeActorContext<TPayload = unknown> extends RuntimeModuleContext {
    readonly actorName: string
    readonly payload: TPayload
}

export type KernelRuntimeActorHandler<TPayload = unknown> = (
    context: KernelRuntimeActorContext<TPayload>,
) => Promise<void> | void

export interface RuntimeModuleInstallContext extends RuntimeModuleContext {
    registerHandler(commandName: string, handler: KernelRuntimeHandler): void
    registerActor(actorName: string, handler: KernelRuntimeActorHandler): void
}

export interface RuntimeModuleInitializeCommand {
    commandName: string
    payload?: unknown
    requestId?: RequestId
    sessionId?: SessionId
    context?: CommandRouteContext
}

export interface KernelRuntimeModule extends AppModule {
    dependencies?: readonly AppModuleDependency[]
    actors?: readonly AppModuleActorDescriptor[]
    stateSlices?: readonly StateRuntimeSliceDescriptor<any>[]
    hostBootstrap?: (context: RuntimeModuleHostBootstrapContext) => Promise<void> | void
    install?: (context: RuntimeModuleInstallContext) => Promise<void> | void
    initializeCommands?: readonly RuntimeModuleInitializeCommand[]
}
