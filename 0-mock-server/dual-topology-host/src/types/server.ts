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
    type:
        | 'command-dispatch'
        | 'command-event'
        | 'projection-mirror'
        | 'request-lifecycle-snapshot'
        | 'state-sync-summary'
        | 'state-sync-diff'
        | 'state-sync-commit-ack'
    envelope:
        | CommandDispatchEnvelope
        | CommandEventEnvelope
        | ProjectionMirrorEnvelope
        | RequestLifecycleSnapshotEnvelope
        | StateSyncSummaryEnvelope
        | StateSyncDiffEnvelope
        | StateSyncCommitAckEnvelope
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

export type DualTopologyOutgoingMessage =
    | HeartbeatEnvelope
    | HelloAckEnvelopeMessage
    | ResumeBeginEnvelopeMessage
    | RelayEnvelopeMessage

export interface HostConnectionContext {
    connectionId: string
    sessionId?: string
    nodeId?: string
}

export interface RoutedOutgoingMessage {
    connectionId: string
    message: DualTopologyOutgoingMessage
}
