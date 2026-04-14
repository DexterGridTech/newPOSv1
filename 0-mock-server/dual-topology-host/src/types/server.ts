import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    NodeHello,
    NodeHelloAck,
    ProjectionMirrorEnvelope,
    RequestLifecycleSnapshotEnvelope,
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {HostFaultRule} from '@impos2/kernel-base-host-runtime'

export interface DualTopologyHostServerConfig {
    port: number
    basePath: string
    heartbeatIntervalMs: number
    heartbeatTimeoutMs: number
}

export interface DualTopologyHostAddressInfo {
    host: string
    port: number
    basePath: string
    httpBaseUrl: string
    wsUrl: string
}

export interface CreatePairingTicketRequest {
    masterNodeId: string
    transportUrls?: string[]
    expiresInMs?: number
}

export interface CreatePairingTicketResponse {
    success: boolean
    token?: string
    sessionId?: string
    expiresAt?: number
    transportUrls?: string[]
    error?: string
}

export interface DualTopologyStats {
    ticketCount: number
    sessionCount: number
    relayCounters: {
        enqueued: number
        delivered: number
        dropped: number
        flushed: number
        disconnected: number
    }
    activeFaultRuleCount: number
    activeConnectionCount: number
}

export interface HeartbeatEnvelope {
    type: '__host_heartbeat'
    timestamp: number
}

export interface HeartbeatAckEnvelope {
    type: '__host_heartbeat_ack'
    timestamp: number
}

export interface RelayEnvelopeMessage {
    type: 'command-dispatch'
    envelope: CommandDispatchEnvelope
}

export interface CommandEventMessage {
    type: 'command-event'
    envelope: CommandEventEnvelope
}

export interface ProjectionMirrorMessage {
    type: 'projection-mirror'
    envelope: ProjectionMirrorEnvelope
}

export interface RequestLifecycleSnapshotMessage {
    type: 'request-lifecycle-snapshot'
    envelope: RequestLifecycleSnapshotEnvelope
}

export interface StateSyncSummaryMessage {
    type: 'state-sync-summary'
    envelope: StateSyncSummaryEnvelope
}

export interface StateSyncDiffMessage {
    type: 'state-sync-diff'
    envelope: StateSyncDiffEnvelope
}

export interface StateSyncCommitAckMessage {
    type: 'state-sync-commit-ack'
    envelope: StateSyncCommitAckEnvelope
}

export interface HelloEnvelopeMessage {
    type: 'node-hello'
    hello: NodeHello
}

export interface HelloAckEnvelopeMessage {
    type: 'node-hello-ack'
    ack: NodeHelloAck
}

export interface ResumeBeginEnvelopeMessage {
    type: 'resume-begin'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface ResumeCompleteEnvelopeMessage {
    type: 'resume-complete'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface FaultRuleReplaceRequest {
    rules: HostFaultRule[]
}

export interface FaultRuleReplaceResponse {
    success: boolean
    ruleCount: number
}

export type DualTopologyIncomingMessage =
    | HeartbeatAckEnvelope
    | HelloEnvelopeMessage
    | ResumeBeginEnvelopeMessage
    | ResumeCompleteEnvelopeMessage
    | RelayEnvelopeMessage
    | CommandEventMessage
    | ProjectionMirrorMessage
    | RequestLifecycleSnapshotMessage
    | StateSyncSummaryMessage
    | StateSyncDiffMessage
    | StateSyncCommitAckMessage

export type DualTopologyOutgoingMessage =
    | HeartbeatEnvelope
    | HelloAckEnvelopeMessage
    | ResumeBeginEnvelopeMessage
    | RelayEnvelopeMessage
    | CommandEventMessage
    | ProjectionMirrorMessage
    | RequestLifecycleSnapshotMessage
    | StateSyncSummaryMessage
    | StateSyncDiffMessage
    | StateSyncCommitAckMessage

export interface HostConnectionContext {
    connectionId: string
    sessionId?: string
    nodeId?: string
}

export interface RoutedOutgoingMessage {
    connectionId: string
    message: DualTopologyOutgoingMessage
}
