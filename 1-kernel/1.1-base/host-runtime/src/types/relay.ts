import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    ConnectionId,
    EnvelopeId,
    NodeId,
    ProjectionMirrorEnvelope,
    RequestLifecycleSnapshotEnvelope,
    SessionId,
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
    TimestampMs,
} from '@next/kernel-base-contracts'

export type HostRelayChannel = 'dispatch' | 'event' | 'projection' | 'resume'

export interface HostResumeBeginEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    timestamp: TimestampMs
}

export type HostRelayEnvelope =
    | CommandDispatchEnvelope
    | CommandEventEnvelope
    | ProjectionMirrorEnvelope
    | HostResumeBeginEnvelope
    | RequestLifecycleSnapshotEnvelope
    | StateSyncSummaryEnvelope
    | StateSyncDiffEnvelope
    | StateSyncCommitAckEnvelope

export interface HostRelayDelivery {
    relayId: EnvelopeId
    sessionId: SessionId
    channel: HostRelayChannel
    sourceNodeId: NodeId
    targetNodeId: NodeId
    connectionId: ConnectionId
    sequence: number
    availableAt: TimestampMs
    envelope: HostRelayEnvelope
}

export interface HostRelayCounters {
    enqueued: number
    delivered: number
    dropped: number
    flushed: number
    disconnected: number
}

export interface HostRelayResult {
    channel: HostRelayChannel
    deliveries: readonly HostRelayDelivery[]
    queuedForOfflinePeer: boolean
    dropped: boolean
    disconnectedConnectionIds: readonly ConnectionId[]
    effect: {
        delayMs?: number
        faultRuleIds: readonly string[]
    }
}
