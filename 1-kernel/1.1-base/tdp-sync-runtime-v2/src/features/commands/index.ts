import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    TdpCommandInboxItem,
    TdpProjectionEnvelope,
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
    reportAppliedCursor: defineModuleCommand<{
        cursor: number
    }>('report-applied-cursor'),
    sendPing: defineModuleCommand<Record<string, never>>('send-ping'),
    tdpTopicDataChanged: defineModuleCommand<TdpTopicDataChangedPayload>('topic-data-changed', {
        allowNoActor: true,
    }),
    recomputeResolvedTopicChanges: defineModuleCommand<Record<string, never>>(
        'recompute-resolved-topic-changes',
        {
            visibility: 'internal',
        },
    ),
    tdpSnapshotLoaded: defineModuleCommand<{
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
    }>('snapshot-loaded', {
        visibility: 'internal',
    }),
    tdpChangesLoaded: defineModuleCommand<{
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        highWatermark: number
    }>('changes-loaded', {
        visibility: 'internal',
    }),
    tdpProjectionReceived: defineModuleCommand<{
        cursor: number
        change: TdpProjectionEnvelope
    }>('projection-received', {
        visibility: 'internal',
    }),
    tdpProjectionBatchReceived: defineModuleCommand<{
        nextCursor: number
        changes: TdpProjectionEnvelope[]
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
    reportAppliedCursor: tdpSyncV2CommandDefinitions.reportAppliedCursor.commandName,
    sendPing: tdpSyncV2CommandDefinitions.sendPing.commandName,
    tdpTopicDataChanged: tdpSyncV2CommandDefinitions.tdpTopicDataChanged.commandName,
    recomputeResolvedTopicChanges: tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges.commandName,
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
