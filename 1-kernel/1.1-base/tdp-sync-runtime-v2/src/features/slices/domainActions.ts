import {createAction} from '@reduxjs/toolkit'
import type {AppError} from '@next/kernel-base-contracts'
import {moduleName} from '../../moduleName'
import type {
    TdpCommandInboxItem,
    TdpControlSignalsState,
    TdpProjectionEnvelope,
    TdpSessionSubscriptionStateV1,
} from '../../types'

export const tdpSyncV2DomainActions = {
    bootstrapResetRuntime: createAction(
        `${moduleName}/bootstrap-reset-runtime`,
    ),
    applySnapshotLoaded: createAction<{
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-snapshot-loaded`,
    ),
    beginSnapshotApply: createAction<{
        snapshotId: string
        highWatermark: number
        totalItems: number
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/begin-snapshot-apply`,
    ),
    applySnapshotChunk: createAction<{
        snapshotId: string
        chunkIndex: number
        items: TdpProjectionEnvelope[]
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-snapshot-chunk`,
    ),
    commitSnapshotApply: createAction<{
        snapshotId: string
        highWatermark: number
    }>(
        `${moduleName}/commit-snapshot-apply`,
    ),
    applyChangesLoaded: createAction<{
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        highWatermark: number
        hasMore?: boolean
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-changes-loaded`,
    ),
    applyProjectionReceived: createAction<{
        cursor: number
        change: TdpProjectionEnvelope
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-projection-received`,
    ),
    applyProjectionBatchReceived: createAction<{
        nextCursor: number
        changes: TdpProjectionEnvelope[]
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-projection-batch-received`,
    ),
    recordCommandDelivered: createAction<TdpCommandInboxItem>(
        `${moduleName}/record-command-delivered`,
    ),
    applySessionReady: createAction<{
        sessionId: string
        nodeId: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        highWatermark: number
        syncMode: 'incremental' | 'full'
        alternativeEndpoints: string[]
        subscription?: TdpSessionSubscriptionStateV1
        connectedAt: number
        serverClockOffsetMs?: number
    }>(
        `${moduleName}/apply-session-ready`,
    ),
    cleanupExpiredProjectionsCompleted: createAction<{
        removedTopics: string[]
        removedCount: number
        cleanedAt: number
    }>(
        `${moduleName}/cleanup-expired-projections-completed`,
    ),
    applyPongReceived: createAction<{
        timestamp: number
    }>(
        `${moduleName}/apply-pong-received`,
    ),
    applyEdgeDegraded: createAction<NonNullable<TdpControlSignalsState['lastEdgeDegraded']>>(
        `${moduleName}/apply-edge-degraded`,
    ),
    applySessionRehomeRequired: createAction<NonNullable<TdpControlSignalsState['lastRehomeRequired']>>(
        `${moduleName}/apply-session-rehome-required`,
    ),
    applyProtocolFailed: createAction<AppError>(
        `${moduleName}/apply-protocol-failed`,
    ),
} as const
