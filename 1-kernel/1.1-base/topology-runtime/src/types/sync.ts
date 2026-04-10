import type {
    NodeId,
    SessionId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'
import type {
    StateRuntimeSliceDescriptor,
    SyncIntent,
    SyncStateDiff,
    SyncStateSummary,
} from '@impos2/kernel-base-state-runtime'

export interface TopologySyncSliceSummary {
    sliceName: string
    summary: SyncStateSummary
}

export interface TopologySyncSliceDiff {
    sliceName: string
    diff: SyncStateDiff
}

export interface TopologySyncPlanInput {
    direction: Exclude<SyncIntent, 'isolated'>
    slices: readonly StateRuntimeSliceDescriptor<any>[]
    state: Record<string, unknown>
}

export interface TopologySyncDiffInput extends TopologySyncPlanInput {
    remoteSummaryBySlice: Record<string, SyncStateSummary>
}

export type TopologySyncSessionStatus =
    | 'idle'
    | 'awaiting-diff'
    | 'active'
    | 'continuous'

export interface TopologySyncSessionSnapshot {
    sessionId: SessionId
    peerNodeId: NodeId
    direction: Exclude<SyncIntent, 'isolated'>
    status: TopologySyncSessionStatus
    startedAt: TimestampMs
    activatedAt?: TimestampMs
    localSummary: TopologySyncSliceSummary[]
    lastRemoteSummary?: Record<string, SyncStateSummary>
    lastDiff?: TopologySyncSliceDiff[]
    baselineSummaryBySlice?: Record<string, SyncStateSummary>
}

export interface BeginTopologySyncSessionInput extends TopologySyncPlanInput {
    sessionId: SessionId
    peerNodeId: NodeId
    startedAt: TimestampMs
}

export interface AcceptTopologySyncSummaryInput extends TopologySyncDiffInput {
    sessionId: SessionId
    peerNodeId: NodeId
    receivedAt: TimestampMs
}

export interface ActivateTopologyContinuousSyncInput extends TopologySyncPlanInput {
    sessionId: SessionId
    activatedAt: TimestampMs
}

export interface CollectTopologyContinuousSyncDiffInput extends TopologySyncPlanInput {
    sessionId: SessionId
}
