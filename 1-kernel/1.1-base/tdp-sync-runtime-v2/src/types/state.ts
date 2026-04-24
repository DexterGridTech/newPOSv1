import type {AppError, TimestampMs} from '@impos2/kernel-base-contracts'

export type TdpSessionStatus =
    | 'IDLE'
    | 'CONNECTING'
    | 'RECONNECTING'
    | 'HANDSHAKING'
    | 'READY'
    | 'DEGRADED'
    | 'REHOME_REQUIRED'
    | 'DISCONNECTED'
    | 'ERROR'

export interface TdpProjectionEnvelope {
    topic: string
    itemKey: string
    operation: 'upsert' | 'delete'
    scopeType: string
    scopeId: string
    revision: number
    payload: Record<string, unknown>
    occurredAt: string
    sourceReleaseId?: string | null
    scopeMetadata?: Record<string, unknown>
}

export type TdpProjectionId = string
export type TdpProjectionState = Record<TdpProjectionId, TdpProjectionEnvelope>

export interface TdpCommandInboxItem {
    commandId: string
    topic: string
    terminalId: string
    payload: Record<string, unknown>
    sourceReleaseId?: string | null
    expiresAt?: string | null
    receivedAt: TimestampMs
}

export interface TdpSessionState {
    status: TdpSessionStatus
    reconnectAttempt?: number
    sessionId?: string
    nodeId?: string
    nodeState?: 'healthy' | 'grace' | 'degraded'
    syncMode?: 'incremental' | 'full'
    highWatermark?: number
    connectedAt?: TimestampMs
    lastPongAt?: TimestampMs
    alternativeEndpoints?: string[]
    disconnectReason?: string | null
}

export interface TdpSyncState {
    snapshotStatus: 'idle' | 'loading' | 'ready' | 'error'
    changesStatus: 'idle' | 'catching-up' | 'ready' | 'error'
    lastCursor?: number
    lastDeliveredCursor?: number
    lastAckedCursor?: number
    lastAppliedCursor?: number
}

export interface TdpCommandInboxState {
    itemsById: Record<string, TdpCommandInboxItem>
    orderedIds: string[]
}

export interface TdpControlSignalsState {
    lastProtocolError?: AppError | null
    lastEdgeDegraded?: {
        reason: string
        issuedAt: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        gracePeriodSeconds: number
        alternativeEndpoints: string[]
    } | null
    lastRehomeRequired?: {
        reason: string
        deadline: string
        alternativeEndpoints: string[]
    } | null
    lastDisconnectReason?: string | null
}

export interface TdpTerminalGroupMembershipPayload {
    membershipVersion: number
    groups: Array<{
        groupId: string
        rank: number
        priority: number
        matchedBy: Record<string, string | undefined>
    }>
}
