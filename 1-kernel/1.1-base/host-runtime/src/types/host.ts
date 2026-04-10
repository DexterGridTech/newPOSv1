import type {
    ConnectionId,
    NodeHello,
    NodeHelloAck,
    NodeId,
    NodeRuntimeInfo,
    SessionId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {HostFaultRule} from './fault'
import type {HostRelayCounters, HostRelayDelivery, HostRelayEnvelope, HostRelayResult} from './relay'
import type {
    HostConnectionAttachResult,
    HostConnectionDetachResult,
    HostSessionRecord,
    HostTicketRecord,
} from './session'

export interface CreateHostRuntimeInput {
    hostRuntime: NodeRuntimeInfo
    logger: LoggerPort
    requiredCapabilities?: readonly string[]
    heartbeatTimeoutMs?: number
    maxObservationEvents?: number
}

export interface IssueHostTicketInput {
    masterNodeId: NodeId
    transportUrls: string[]
    expiresInMs: number
    issuedAt?: TimestampMs
}

export interface ProcessHostHelloInput {
    hello: NodeHello
    connectionId?: ConnectionId
    receivedAt?: TimestampMs
}

export interface AttachHostConnectionInput {
    sessionId: SessionId
    nodeId: NodeId
    connectionId?: ConnectionId
    connectedAt?: TimestampMs
}

export interface DetachHostConnectionInput {
    connectionId?: ConnectionId
    sessionId?: SessionId
    nodeId?: NodeId
    reason?: string
    disconnectedAt?: TimestampMs
}

export interface RelayHostEnvelopeInput {
    sessionId: SessionId
    sourceNodeId: NodeId
    envelope: HostRelayEnvelope
    relayedAt?: TimestampMs
}

export interface ExpireHostConnectionsInput {
    now?: TimestampMs
    timeoutMs?: number
}

export interface BeginHostResumeInput {
    sessionId: SessionId
    nodeId: NodeId
    startedAt?: TimestampMs
}

export interface CompleteHostResumeInput {
    sessionId: SessionId
    nodeId: NodeId
    completedAt?: TimestampMs
}

export interface HostObservationEvent {
    observationId: string
    timestamp: TimestampMs
    level: 'debug' | 'info' | 'warn' | 'error'
    category: string
    event: string
    message?: string
    sessionId?: SessionId
    nodeId?: NodeId
    connectionId?: ConnectionId
    data?: Record<string, unknown>
}

export interface HostHelloResult {
    ack: NodeHelloAck
    session?: HostSessionRecord
    connection?: HostConnectionAttachResult
    effect: {
        ackDeliverAfterMs?: number
        faultRuleIds: readonly string[]
    }
}

export interface HostRuntimeSnapshot {
    hostRuntime: NodeRuntimeInfo
    tickets: readonly HostTicketRecord[]
    sessions: readonly HostSessionRecord[]
    relayCounters: HostRelayCounters
    activeFaultRules: readonly HostFaultRule[]
    recentEvents: readonly HostObservationEvent[]
}

export interface HostRuntime {
    issueTicket(input: IssueHostTicketInput): HostTicketRecord
    processHello(input: ProcessHostHelloInput): HostHelloResult
    attachConnection(input: AttachHostConnectionInput): HostConnectionAttachResult
    detachConnection(input: DetachHostConnectionInput): HostConnectionDetachResult | undefined
    beginResume(input: BeginHostResumeInput): HostSessionRecord
    completeResume(input: CompleteHostResumeInput): HostSessionRecord
    recordHeartbeat(connectionId: ConnectionId, occurredAt?: TimestampMs): void
    expireIdleConnections(input?: ExpireHostConnectionsInput): readonly HostConnectionDetachResult[]
    relayEnvelope(input: RelayHostEnvelopeInput): HostRelayResult
    drainConnectionOutbox(connectionId: ConnectionId, now?: TimestampMs): readonly HostRelayDelivery[]
    addFaultRule(rule: HostFaultRule): void
    replaceFaultRules(rules: readonly HostFaultRule[]): void
    clearFaultRules(): void
    listFaultRules(): readonly HostFaultRule[]
    getTicket(token: string): HostTicketRecord | undefined
    getSession(sessionId: SessionId): HostSessionRecord | undefined
    getSnapshot(): HostRuntimeSnapshot
}
