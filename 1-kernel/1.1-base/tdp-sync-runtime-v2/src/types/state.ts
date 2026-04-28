import type {AppError, TimestampMs} from '@next/kernel-base-contracts'

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
export type TdpProjectionEntryMap = Record<TdpProjectionId, TdpProjectionEnvelope>

export interface TdpProjectionState {
    activeBufferId: string
    stagedBufferId?: string
    activeEntries: TdpProjectionEntryMap
    stagedEntries?: TdpProjectionEntryMap
}

export interface TdpSessionSubscriptionStateV1 {
    version: 1
    mode: 'explicit' | 'legacy-all'
    hash?: string
    acceptedTopics: string[]
    rejectedTopics: string[]
    requiredMissingTopics: string[]
}

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
    subscription?: TdpSessionSubscriptionStateV1
}

export interface TdpSyncState {
    snapshotStatus: 'idle' | 'loading' | 'applying' | 'ready' | 'error'
    changesStatus: 'idle' | 'catching-up' | 'ready' | 'error'
    lastCursor?: number
    lastDeliveredCursor?: number
    lastAckedCursor?: number
    lastAppliedCursor?: number
    activeSubscriptionHash?: string
    activeSubscribedTopics?: readonly string[]
    lastRequestedSubscriptionHash?: string
    lastRequestedSubscribedTopics?: readonly string[]
    lastAcceptedSubscriptionHash?: string
    lastAcceptedSubscribedTopics?: readonly string[]
    applyingSnapshotId?: string
    applyingSnapshotTotalItems?: number
    applyingSnapshotAppliedItems?: number
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
