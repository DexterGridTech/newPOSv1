import type {
    EnvelopeId,
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    CommandId,
    CompatibilityDecision,
    NodeId,
    RequestId,
    RequestLifecycleSnapshot,
    RequestProjection,
    SessionId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'
import type {LoggerPort, StateStoragePort} from '@impos2/kernel-base-platform-ports'
import type {TopologyRecoveryState} from './state'
import type {
    ActivateTopologyContinuousSyncInput,
    AcceptTopologySyncSummaryInput,
    BeginTopologySyncSessionInput,
    CollectTopologyContinuousSyncDiffInput,
    TopologySyncSessionSnapshot,
} from './sync'
import type {SyncStateSummary} from '@impos2/kernel-base-state-runtime'
import type {
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'

export interface RegisterRootRequestInput {
    requestId: RequestId
    rootCommandId: CommandId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    commandName: string
    startedAt?: TimestampMs
}

export interface CompatibilityEvaluationInput {
    peerProtocolVersion: string
    peerCapabilities: readonly string[]
    requiredCapabilities?: readonly string[]
    peerRuntimeVersion?: string
    localProtocolVersion?: string
    localCapabilities?: readonly string[]
    localRuntimeVersion?: string
}

export interface CreateTopologyRuntimeInput {
    localNodeId: string
    localProtocolVersion?: string
    localCapabilities?: readonly string[]
    localRuntimeVersion?: string
    logger?: LoggerPort
    stateStorage?: StateStoragePort
    secureStateStorage?: StateStoragePort
    persistenceKey?: string
    allowPersistence?: boolean
}

export interface TopologyRuntime {
    hydrate(): Promise<void>
    flushPersistence(): Promise<void>
    subscribeRecoveryState(listener: (state: TopologyRecoveryState) => void): () => void
    beginSyncSession(input: BeginTopologySyncSessionInput): TopologySyncSessionSnapshot
    acceptRemoteSyncSummary(input: AcceptTopologySyncSummaryInput): TopologySyncSessionSnapshot
    activateContinuousSync(input: ActivateTopologyContinuousSyncInput): TopologySyncSessionSnapshot
    collectContinuousSyncDiff(input: CollectTopologyContinuousSyncDiffInput): TopologySyncSessionSnapshot
    commitContinuousSync(sessionId: SessionId, currentSummary: Record<string, SyncStateSummary>): TopologySyncSessionSnapshot | undefined
    createSyncSummaryEnvelope(input: {
        envelopeId: EnvelopeId
        sessionId: SessionId
        sourceNodeId: NodeId
        targetNodeId: NodeId
    }): StateSyncSummaryEnvelope | undefined
    handleSyncSummaryEnvelope(input: {
        envelope: StateSyncSummaryEnvelope
        slices: BeginTopologySyncSessionInput['slices']
        state: BeginTopologySyncSessionInput['state']
        receivedAt: number
    }): StateSyncDiffEnvelope | undefined
    handleSyncCommitAckEnvelope(input: {
        envelope: StateSyncCommitAckEnvelope
        currentSummary: Record<string, SyncStateSummary>
    }): TopologySyncSessionSnapshot | undefined
    getSyncSession(sessionId: SessionId): TopologySyncSessionSnapshot | undefined
    clearSyncSession(sessionId: SessionId): void
    registerRootRequest(input: RegisterRootRequestInput): void
    registerChildDispatch(envelope: CommandDispatchEnvelope): void
    applyCommandEvent(envelope: CommandEventEnvelope): void
    exportRequestLifecycleSnapshot(requestId: RequestId, sessionId?: SessionId): RequestLifecycleSnapshot | undefined
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    listTrackedRequestIds(input?: {
        peerNodeId?: NodeId
    }): readonly RequestId[]
    hasTrackedCommand(requestId: RequestId, commandId: CommandId): boolean
    getRequestProjection(requestId: RequestId): RequestProjection | undefined
    evaluateCompatibility(input: CompatibilityEvaluationInput): CompatibilityDecision
    getRecoveryState(): TopologyRecoveryState
    updateRecoveryState(patch: TopologyRecoveryState): void
    exportRecoveryState(): TopologyRecoveryState
    applyRecoveryState(state: TopologyRecoveryState): void
}
