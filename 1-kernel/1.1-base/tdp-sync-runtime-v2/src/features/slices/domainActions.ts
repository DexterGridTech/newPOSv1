import {createAction} from '@reduxjs/toolkit'
import type {AppError} from '@impos2/kernel-base-contracts'
import {moduleName} from '../../moduleName'
import type {
    TdpCommandInboxItem,
    TdpControlSignalsState,
    TdpProjectionEnvelope,
} from '../../types'

export const tdpSyncV2DomainActions = {
    bootstrapResetRuntime: createAction(
        `${moduleName}/bootstrap-reset-runtime`,
    ),
    applySnapshotLoaded: createAction<{
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
    }>(
        `${moduleName}/apply-snapshot-loaded`,
    ),
    applyChangesLoaded: createAction<{
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        highWatermark: number
    }>(
        `${moduleName}/apply-changes-loaded`,
    ),
    applyProjectionReceived: createAction<{
        cursor: number
        change: TdpProjectionEnvelope
    }>(
        `${moduleName}/apply-projection-received`,
    ),
    applyProjectionBatchReceived: createAction<{
        nextCursor: number
        changes: TdpProjectionEnvelope[]
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
        connectedAt: number
    }>(
        `${moduleName}/apply-session-ready`,
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
