import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    CommandId,
    CommandRouteContext,
    ErrorCatalogEntry,
    NodeId,
    ParameterCatalogEntry,
    ParameterDefinition,
    ProjectionMirrorEnvelope,
    RequestId,
    RequestLifecycleSnapshot,
    RequestProjection,
    ResolvedErrorView,
    ResolvedParameter,
    RuntimeInstanceId,
    SessionId,
} from '@impos2/kernel-base-contracts'
import type {DefinitionRegistryBundle} from '@impos2/kernel-base-definition-registry'
import type {ExecutionResult, ExecutionRuntime} from '@impos2/kernel-base-execution-runtime'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {TopologyRuntime} from '@impos2/kernel-base-topology-runtime'
import type {DispatchRuntimeCommandInput, KernelRuntimeModule, StartupSeed} from './module'
import type {RuntimeShellStateSnapshot} from './state'

export interface CreateKernelRuntimeInput {
    runtimeId?: RuntimeInstanceId
    localNodeId: NodeId
    platformPorts: PlatformPorts
    modules: readonly KernelRuntimeModule[]
    startupSeed?: StartupSeed
    localProtocolVersion?: string
    localCapabilities?: readonly string[]
    localRuntimeVersion?: string
}

export interface CreateRemoteDispatchEnvelopeInput<TPayload = unknown> {
    requestId: RequestId
    sessionId: SessionId
    parentCommandId: CommandId
    targetNodeId: NodeId
    commandName: string
    payload: TPayload
    context?: CommandRouteContext
}

export interface HandleRemoteDispatchResult {
    events: readonly CommandEventEnvelope[]
}

export interface HandleRemoteDispatchOptions {
    onEvent?: (event: CommandEventEnvelope) => void
}

export interface KernelRuntimeSubsystems {
    readonly registries: DefinitionRegistryBundle
    readonly execution: ExecutionRuntime
    readonly topology: TopologyRuntime
}

export interface KernelRuntime {
    readonly runtimeId: RuntimeInstanceId
    readonly modules: readonly KernelRuntimeModule[]
    start(): Promise<void>
    flushPersistence(): Promise<void>
    execute<TPayload = unknown>(input: DispatchRuntimeCommandInput<TPayload>): Promise<ExecutionResult>
    createRemoteDispatchEnvelope<TPayload = unknown>(input: CreateRemoteDispatchEnvelopeInput<TPayload>): CommandDispatchEnvelope
    handleRemoteDispatch(
        envelope: CommandDispatchEnvelope,
        options?: HandleRemoteDispatchOptions,
    ): Promise<HandleRemoteDispatchResult>
    applyRemoteCommandEvent(envelope: CommandEventEnvelope): void
    exportRequestLifecycleSnapshot(requestId: RequestId, sessionId?: SessionId): RequestLifecycleSnapshot | undefined
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    applyProjectionMirror(envelope: ProjectionMirrorEnvelope): void
    listTrackedRequestIds(input?: {
        peerNodeId?: NodeId
    }): readonly RequestId[]
    getState(): RuntimeShellStateSnapshot
    getRequestProjection(requestId: RequestId): RequestProjection | undefined
    getErrorCatalogEntry(key: string): ErrorCatalogEntry | undefined
    getParameterCatalogEntry(key: string): ParameterCatalogEntry | undefined
    resolveError(key: string): ResolvedErrorView
    resolveAppError(input: {
        key: string
        code?: string
        message?: string
        details?: unknown
        args?: Record<string, unknown>
    }): ResolvedErrorView
    resolveParameter<TValue = unknown>(input: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue>
    getSubsystems(): KernelRuntimeSubsystems
}
