import type {
    CompatibilityDecision,
    ConnectionId,
    NodeId,
    NodeRuntimeInfo,
    PairingTicket,
    SessionId,
    TimestampMs,
} from '@next/kernel-base-contracts'

export interface HostTicketOccupancy {
    role: 'master' | 'slave'
    nodeId: NodeId
    sessionId: SessionId
    connected: boolean
    updatedAt: TimestampMs
}

export interface HostTicketRecord {
    ticket: PairingTicket
    sessionId?: SessionId
    occupiedRoles: Partial<Record<'master' | 'slave', HostTicketOccupancy>>
    updatedAt: TimestampMs
}

export interface HostSessionNodeRecord {
    nodeId: NodeId
    role: 'master' | 'slave'
    runtime: NodeRuntimeInfo
    lastHelloAt: TimestampMs
    connected: boolean
    connectionId?: ConnectionId
    connectedAt?: TimestampMs
    disconnectedAt?: TimestampMs
    lastHeartbeatAt?: TimestampMs
}

export interface HostSessionResumeState {
    phase: 'idle' | 'required' | 'resyncing'
    pendingNodeIds: NodeId[]
    requiredAt?: TimestampMs
    startedAt?: TimestampMs
    completedAt?: TimestampMs
    reason?: string
}

export interface HostSessionRecord {
    sessionId: SessionId
    token: string
    ticket: PairingTicket
    status: 'awaiting-peer' | 'resume-required' | 'resyncing' | 'active' | 'degraded' | 'closed'
    compatibility: CompatibilityDecision
    createdAt: TimestampMs
    updatedAt: TimestampMs
    nodes: Record<string, HostSessionNodeRecord>
    relayPendingCount: number
    resume: HostSessionResumeState
}

export interface HostConnectionRecord {
    sessionId: SessionId
    nodeId: NodeId
    connectionId: ConnectionId
    connectedAt: TimestampMs
    lastHeartbeatAt: TimestampMs
}

export interface HostConnectionAttachResult {
    sessionId: SessionId
    nodeId: NodeId
    connectionId: ConnectionId
    replacedConnectionId?: ConnectionId
}

export interface HostConnectionDetachResult {
    sessionId: SessionId
    nodeId: NodeId
    connectionId: ConnectionId
    reason?: string
    disconnectedAt: TimestampMs
}
