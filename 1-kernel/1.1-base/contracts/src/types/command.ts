import type {
    CommandId,
    EnvelopeId,
    NodeId,
    RequestId,
    SessionId,
    TimestampMs,
} from './ids'

export interface CommandRouteContext {
    sessionId?: SessionId
    workspace?: string
    instanceMode?: string
    routeTags?: string[]
    metadata?: Record<string, unknown>
}

export interface CommandDispatchEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    commandName: string
    payload: unknown
    context: CommandRouteContext
    sentAt: TimestampMs
}

export interface CommandEventEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    requestId: RequestId
    commandId: CommandId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    eventType: 'accepted' | 'started' | 'resultPatch' | 'completed' | 'failed'
    resultPatch?: Record<string, unknown>
    result?: Record<string, unknown>
    error?: {
        key: string
        code: string
        message: string
        details?: unknown
    }
    occurredAt: TimestampMs
}
