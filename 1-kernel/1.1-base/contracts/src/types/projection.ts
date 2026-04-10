import type {NodeId, ProjectionId, RequestId, SessionId, TimestampMs, EnvelopeId} from './ids'

export interface RequestProjection {
    projectionId?: ProjectionId
    requestId: RequestId
    ownerNodeId: NodeId
    status: 'started' | 'complete' | 'error'
    startedAt: TimestampMs
    updatedAt: TimestampMs
    resultsByCommand: Record<string, Record<string, unknown>>
    mergedResults: Record<string, unknown>
    errorsByCommand: Record<string, {key: string; code: string; message: string}>
    pendingCommandCount: number
}

export interface ProjectionMirrorEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    ownerNodeId: NodeId
    projection: RequestProjection
    mirroredAt: TimestampMs
}
