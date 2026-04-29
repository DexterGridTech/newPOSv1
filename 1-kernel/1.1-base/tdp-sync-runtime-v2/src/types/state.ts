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
    expiresAt?: string | null
    lifecycle?: 'persistent' | 'expiring'
    expiryReason?: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null
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
    serverClockOffsetMs?: number
    lastExpiredProjectionCleanupAt?: TimestampMs
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

export type TdpTopicActivitySource = 'snapshot' | 'changes' | 'realtime'

export interface TdpTopicActivityWindow {
    bucketStartedAt: TimestampMs
    receivedCount: number
    appliedCount: number
}

export interface TdpTopicActivityStats {
    receivedCount: number
    appliedCount: number
    snapshotReceivedCount: number
    snapshotAppliedCount: number
    changesReceivedCount: number
    changesAppliedCount: number
    realtimeReceivedCount: number
    realtimeAppliedCount: number
    lastReceivedAt?: TimestampMs
    lastAppliedAt?: TimestampMs
    lastSource?: TdpTopicActivitySource
    recentWindows: TdpTopicActivityWindow[]
}

export interface TdpTopicActivityState {
    topics: Record<string, TdpTopicActivityStats>
    windowSizeMs: number
    maxWindows: number
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

export type TdpOperationsHealthTone = 'ok' | 'warn' | 'error' | 'neutral'

export type TdpOperationsTopicStatus =
    | 'accepted'
    | 'rejected'
    | 'required-missing'
    | 'local-residual'
    | 'local-only'
    | 'inactive'

export interface TdpOperationsTopicSnapshot {
    topic: string
    requested: boolean
    accepted: boolean
    rejected: boolean
    requiredMissing: boolean
    localResidual: boolean
    status: TdpOperationsTopicStatus
    localEntryCount: number
    stagedEntryCount: number
    maxRevision?: number
    lastOccurredAt?: string
    scopeCounts: Record<string, number>
    lifecycleCounts: Record<string, number>
    expiredEntryCount: number
    activity: {
        receivedCount: number
        appliedCount: number
        snapshotAppliedCount: number
        changesAppliedCount: number
        realtimeAppliedCount: number
        lastReceivedAt?: TimestampMs
        lastAppliedAt?: TimestampMs
        lastSource?: TdpTopicActivitySource
        recentReceivedPerMinute: number
        recentAppliedPerMinute: number
    }
}

export interface TdpOperationsFinding {
    key: string
    tone: TdpOperationsHealthTone
    title: string
    detail: string
}

export interface TdpOperationsSnapshot {
    session: {
        status: TdpSessionState['status']
        sessionId?: string
        nodeId?: string
        nodeState?: TdpSessionState['nodeState']
        syncMode?: TdpSessionState['syncMode']
        highWatermark?: number
        connectedAt?: TimestampMs
        lastPongAt?: TimestampMs
        reconnectAttempt?: number
        disconnectReason?: string | null
        highWatermarkStale: boolean
    }
    sync: {
        snapshotStatus: TdpSyncState['snapshotStatus']
        changesStatus: TdpSyncState['changesStatus']
        lastCursor?: number
        lastDeliveredCursor?: number
        lastAckedCursor?: number
        lastAppliedCursor?: number
        activeSubscriptionHash?: string
        lastRequestedSubscriptionHash?: string
        lastAcceptedSubscriptionHash?: string
        serverClockOffsetMs?: number
        applyingSnapshotId?: string
        applyingSnapshotTotalItems?: number
        applyingSnapshotAppliedItems?: number
        lastExpiredProjectionCleanupAt?: TimestampMs
    }
    subscription: {
        mode?: TdpSessionSubscriptionStateV1['mode']
        hash?: string
        requestedTopics: string[]
        acceptedTopics: string[]
        rejectedTopics: string[]
        requiredMissingTopics: string[]
        activeTopics: string[]
        requestedHash?: string
        acceptedHash?: string
        localHashMismatch: boolean
    }
    pipeline: {
        deliveredLag: number
        ackLag: number
        applyLag: number
        watermarkLag?: number
        canJudgeWatermarkLag: boolean
        snapshotProgress?: {
            appliedItems: number
            totalItems: number
            percent: number
        }
    }
    projection: {
        activeBufferId: string
        stagedBufferId?: string
        activeEntryCount: number
        stagedEntryCount: number
        expiredEntryCount: number
        topicCount: number
    }
    activity: {
        windowSizeMs: number
        totalReceivedCount: number
        totalAppliedCount: number
        lastReceivedAt?: TimestampMs
        lastAppliedAt?: TimestampMs
        hottestTopics: Array<{
            topic: string
            recentAppliedPerMinute: number
            recentReceivedPerMinute: number
        }>
    }
    commandInbox: {
        count: number
        latestTopic?: string
        latestReceivedAt?: TimestampMs
    }
    controlSignals: TdpControlSignalsState | undefined
    topics: TdpOperationsTopicSnapshot[]
    findings: TdpOperationsFinding[]
}
