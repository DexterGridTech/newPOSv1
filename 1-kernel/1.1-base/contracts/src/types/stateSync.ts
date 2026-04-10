import type {EnvelopeId, NodeId, SessionId, TimestampMs} from './ids'

export interface StateSyncSummaryEntry {
    updatedAt: TimestampMs
    tombstone?: boolean
}

export type StateSyncSummaryPayload = Record<string, Record<string, StateSyncSummaryEntry>>

export interface StateSyncValueEnvelope {
    value?: unknown
    updatedAt: TimestampMs
    tombstone?: boolean
}

export interface StateSyncDiffEntry {
    key: string
    value: StateSyncValueEnvelope
}

export type StateSyncDiffPayload = Record<string, StateSyncDiffEntry[]>

export interface StateSyncSummaryEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    direction: 'master-to-slave' | 'slave-to-master'
    summaryBySlice: StateSyncSummaryPayload
    sentAt: TimestampMs
}

export interface StateSyncDiffEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    direction: 'master-to-slave' | 'slave-to-master'
    diffBySlice: StateSyncDiffPayload
    sentAt: TimestampMs
}

export interface StateSyncCommitAckEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    committedAt: TimestampMs
}
