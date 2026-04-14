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

export interface TopologyV2SyncSliceSummary {
    sliceName: string
    summary: SyncStateSummary
}

export interface TopologyV2SyncSliceDiff {
    sliceName: string
    diff: SyncStateDiff
}

export interface TopologyV2SyncPlanInput {
    direction: Exclude<SyncIntent, 'isolated'>
    slices: readonly StateRuntimeSliceDescriptor<any>[]
    state: Record<string, unknown>
}

export interface TopologyV2SyncDiffInput extends TopologyV2SyncPlanInput {
    remoteSummaryBySlice: Record<string, SyncStateSummary>
}

export type TopologyV2SyncSessionStatus =
    | 'idle'
    | 'awaiting-diff'
    | 'active'
    | 'continuous'

export interface TopologyV2SyncSessionSnapshot {
    sessionId: SessionId
    peerNodeId: NodeId
    direction: Exclude<SyncIntent, 'isolated'>
    status: TopologyV2SyncSessionStatus
    startedAt: TimestampMs
    activatedAt?: TimestampMs
    localSummary: TopologyV2SyncSliceSummary[]
    lastRemoteSummary?: Record<string, SyncStateSummary>
    lastDiff?: TopologyV2SyncSliceDiff[]
    baselineSummaryBySlice?: Record<string, SyncStateSummary>
}

export interface BeginTopologyV2SyncSessionInput extends TopologyV2SyncPlanInput {
    sessionId: SessionId
    peerNodeId: NodeId
    startedAt: TimestampMs
}

export interface AcceptTopologyV2SyncSummaryInput extends TopologyV2SyncDiffInput {
    sessionId: SessionId
    peerNodeId: NodeId
    receivedAt: TimestampMs
}

export interface ActivateTopologyV2ContinuousSyncInput extends TopologyV2SyncPlanInput {
    sessionId: SessionId
    activatedAt: TimestampMs
}

export interface CollectTopologyV2ContinuousSyncDiffInput extends TopologyV2SyncPlanInput {
    sessionId: SessionId
}
