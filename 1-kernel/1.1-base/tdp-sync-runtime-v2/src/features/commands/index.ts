import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    HotUpdateAppliedVersion,
    HotUpdateEmbeddedReleaseFacts,
    TdpCommandInboxItem,
    TdpProjectionEnvelope,
    TdpSessionSubscriptionStateV1,
    TdpServerMessage,
    TdpTopicDataChangedPayload,
} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const tdpSyncV2CommandDefinitions = {
    bootstrapTdpSync: defineModuleCommand<Record<string, never>>('bootstrap-tdp-sync'),
    bootstrapTdpSyncSucceeded: defineModuleCommand<Record<string, never>>('bootstrap-tdp-sync-succeeded', {
        visibility: 'internal',
    }),
    connectTdpSession: defineModuleCommand<Record<string, never>>('connect-tdp-session'),
    disconnectTdpSession: defineModuleCommand<Record<string, never>>('disconnect-tdp-session'),
    acknowledgeCursor: defineModuleCommand<{
        cursor: number
        topic?: string
        itemKey?: string
        instanceId?: string
    }>('acknowledge-cursor'),
    acknowledgeProjectionBatch: defineModuleCommand<{
        nextCursor: number
        batchId?: string
        processingLagMs?: number
    }>('acknowledge-projection-batch', {
        visibility: 'internal',
    }),
    reportAppliedCursor: defineModuleCommand<{
        cursor: number
    }>('report-applied-cursor'),
    sendPing: defineModuleCommand<Record<string, never>>('send-ping'),
    recordUserOperation: defineModuleCommand<{
        at?: number
    }>('record-user-operation'),
    syncHotUpdateCurrentFromNativeBoot: defineModuleCommand<{
        embeddedRelease: HotUpdateEmbeddedReleaseFacts
        initializeEmbeddedCurrent?: boolean
        previousCurrent?: HotUpdateAppliedVersion
    }>('sync-hot-update-current-from-native-boot'),
    confirmHotUpdateLoadComplete: defineModuleCommand<{
        embeddedRelease: HotUpdateEmbeddedReleaseFacts
        displayIndex?: number
    }>('confirm-hot-update-load-complete'),
    requestHotUpdateRestartPreparation: defineModuleCommand<{
        displayIndex: number
        releaseId: string
        packageId: string
        bundleVersion: string
        mode: 'immediate' | 'idle'
    }>('request-hot-update-restart-preparation', {
        allowNoActor: true,
    }),
    tdpTopicDataChanged: defineModuleCommand<TdpTopicDataChangedPayload>('topic-data-changed', {
        allowNoActor: true,
    }),
    recomputeResolvedTopicChanges: defineModuleCommand<Record<string, never>>(
        'recompute-resolved-topic-changes',
        {
            visibility: 'internal',
        },
    ),
    recomputeChangedTopicChanges: defineModuleCommand<{
        topics: string[]
    }>(
        'recompute-changed-topic-changes',
        {
            visibility: 'internal',
        },
    ),
    cleanupExpiredTdpProjections: defineModuleCommand<{
        now?: number
    }>('cleanup-expired-projections'),
    fetchMoreChanges: defineModuleCommand<{
        cursor: number
        highWatermark: number
        limit?: number
    }>('fetch-more-changes', {
        visibility: 'internal',
        allowReentry: true,
    }),
    snapshotApplyCompleted: defineModuleCommand<{
        highWatermark: number
    }>('snapshot-apply-completed', {
        visibility: 'internal',
    }),
    beginSnapshotApply: defineModuleCommand<{
        snapshotId: string
        highWatermark: number
        totalItems: number
        serverClockOffsetMs?: number
    }>('begin-snapshot-apply', {
        visibility: 'internal',
    }),
    applySnapshotChunk: defineModuleCommand<{
        snapshotId: string
        chunkIndex: number
        items: TdpProjectionEnvelope[]
        serverClockOffsetMs?: number
    }>('apply-snapshot-chunk', {
        visibility: 'internal',
    }),
    commitSnapshotApply: defineModuleCommand<{
        snapshotId: string
        highWatermark: number
    }>('commit-snapshot-apply', {
        visibility: 'internal',
    }),
    changesApplyCompleted: defineModuleCommand<{
        nextCursor: number
        highWatermark: number
        hasMore?: boolean
    }>('changes-apply-completed', {
        visibility: 'internal',
        allowReentry: true,
    }),
    projectionApplyCompleted: defineModuleCommand<{
        cursor: number
    }>('projection-apply-completed', {
        visibility: 'internal',
    }),
    projectionBatchApplyCompleted: defineModuleCommand<{
        nextCursor: number
    }>('projection-batch-apply-completed', {
        visibility: 'internal',
    }),
    tdpSnapshotLoaded: defineModuleCommand<{
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
        serverClockOffsetMs?: number
    }>('snapshot-loaded', {
        visibility: 'internal',
    }),
    tdpChangesLoaded: defineModuleCommand<{
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        highWatermark: number
        hasMore?: boolean
        serverClockOffsetMs?: number
    }>('changes-loaded', {
        visibility: 'internal',
        allowReentry: true,
    }),
    tdpProjectionReceived: defineModuleCommand<{
        cursor: number
        change: TdpProjectionEnvelope
        serverClockOffsetMs?: number
    }>('projection-received', {
        visibility: 'internal',
    }),
    tdpProjectionBatchReceived: defineModuleCommand<{
        batchId?: string
        receivedAt?: number
        nextCursor: number
        changes: TdpProjectionEnvelope[]
        serverClockOffsetMs?: number
    }>('projection-batch-received', {
        visibility: 'internal',
    }),
    tdpCommandDelivered: defineModuleCommand<Omit<TdpCommandInboxItem, 'receivedAt'>>(
        'command-delivered',
        {
            visibility: 'internal',
        },
    ),
    tdpSessionReady: defineModuleCommand<{
        sessionId: string
        nodeId: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        highWatermark: number
        syncMode: 'incremental' | 'full'
        alternativeEndpoints: string[]
        subscription?: TdpSessionSubscriptionStateV1
        serverClockOffsetMs?: number
    }>('session-ready', {
        visibility: 'internal',
    }),
    tdpPongReceived: defineModuleCommand<{
        timestamp: number
    }>('pong-received', {
        visibility: 'internal',
    }),
    tdpEdgeDegraded: defineModuleCommand<{
        reason: string
        issuedAt: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        gracePeriodSeconds: number
        alternativeEndpoints: string[]
    }>('edge-degraded', {
        visibility: 'internal',
    }),
    tdpSessionRehomeRequired: defineModuleCommand<{
        reason: string
        deadline: string
        alternativeEndpoints: string[]
    }>('session-rehome-required', {
        visibility: 'internal',
    }),
    tdpProtocolFailed: defineModuleCommand<{
        code: string
        message: string
        details?: unknown
    }>('protocol-failed', {
        visibility: 'internal',
    }),
    tdpMessageReceived: defineModuleCommand<TdpServerMessage>('message-received', {
        visibility: 'internal',
    }),
} as const

export const tdpSyncV2CommandNames = {
    bootstrapTdpSync: tdpSyncV2CommandDefinitions.bootstrapTdpSync.commandName,
    bootstrapTdpSyncSucceeded: tdpSyncV2CommandDefinitions.bootstrapTdpSyncSucceeded.commandName,
    connectTdpSession: tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
    disconnectTdpSession: tdpSyncV2CommandDefinitions.disconnectTdpSession.commandName,
    acknowledgeCursor: tdpSyncV2CommandDefinitions.acknowledgeCursor.commandName,
    acknowledgeProjectionBatch: tdpSyncV2CommandDefinitions.acknowledgeProjectionBatch.commandName,
    reportAppliedCursor: tdpSyncV2CommandDefinitions.reportAppliedCursor.commandName,
    sendPing: tdpSyncV2CommandDefinitions.sendPing.commandName,
    recordUserOperation: tdpSyncV2CommandDefinitions.recordUserOperation.commandName,
    syncHotUpdateCurrentFromNativeBoot: tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot.commandName,
    confirmHotUpdateLoadComplete: tdpSyncV2CommandDefinitions.confirmHotUpdateLoadComplete.commandName,
    requestHotUpdateRestartPreparation: tdpSyncV2CommandDefinitions.requestHotUpdateRestartPreparation.commandName,
    tdpTopicDataChanged: tdpSyncV2CommandDefinitions.tdpTopicDataChanged.commandName,
    recomputeResolvedTopicChanges: tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges.commandName,
    recomputeChangedTopicChanges: tdpSyncV2CommandDefinitions.recomputeChangedTopicChanges.commandName,
    cleanupExpiredTdpProjections: tdpSyncV2CommandDefinitions.cleanupExpiredTdpProjections.commandName,
    fetchMoreChanges: tdpSyncV2CommandDefinitions.fetchMoreChanges.commandName,
    snapshotApplyCompleted: tdpSyncV2CommandDefinitions.snapshotApplyCompleted.commandName,
    beginSnapshotApply: tdpSyncV2CommandDefinitions.beginSnapshotApply.commandName,
    applySnapshotChunk: tdpSyncV2CommandDefinitions.applySnapshotChunk.commandName,
    commitSnapshotApply: tdpSyncV2CommandDefinitions.commitSnapshotApply.commandName,
    changesApplyCompleted: tdpSyncV2CommandDefinitions.changesApplyCompleted.commandName,
    projectionApplyCompleted: tdpSyncV2CommandDefinitions.projectionApplyCompleted.commandName,
    projectionBatchApplyCompleted: tdpSyncV2CommandDefinitions.projectionBatchApplyCompleted.commandName,
    tdpSnapshotLoaded: tdpSyncV2CommandDefinitions.tdpSnapshotLoaded.commandName,
    tdpChangesLoaded: tdpSyncV2CommandDefinitions.tdpChangesLoaded.commandName,
    tdpProjectionReceived: tdpSyncV2CommandDefinitions.tdpProjectionReceived.commandName,
    tdpProjectionBatchReceived: tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived.commandName,
    tdpCommandDelivered: tdpSyncV2CommandDefinitions.tdpCommandDelivered.commandName,
    tdpSessionReady: tdpSyncV2CommandDefinitions.tdpSessionReady.commandName,
    tdpPongReceived: tdpSyncV2CommandDefinitions.tdpPongReceived.commandName,
    tdpEdgeDegraded: tdpSyncV2CommandDefinitions.tdpEdgeDegraded.commandName,
    tdpSessionRehomeRequired: tdpSyncV2CommandDefinitions.tdpSessionRehomeRequired.commandName,
    tdpProtocolFailed: tdpSyncV2CommandDefinitions.tdpProtocolFailed.commandName,
    tdpMessageReceived: tdpSyncV2CommandDefinitions.tdpMessageReceived.commandName,
} as const
