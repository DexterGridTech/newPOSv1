import {defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    TdpCommandInboxItem,
    TdpProjectionEnvelope,
    TdpServerMessage,
    TdpTopicDataChangedPayload,
} from '../../types'

export const tdpSyncV2CommandDefinitions = {
    bootstrapTdpSync: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'bootstrap-tdp-sync',
    }),
    bootstrapTdpSyncSucceeded: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'bootstrap-tdp-sync-succeeded',
        visibility: 'internal',
    }),
    connectTdpSession: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'connect-tdp-session',
    }),
    disconnectTdpSession: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'disconnect-tdp-session',
    }),
    acknowledgeCursor: defineCommand<{
        cursor: number
        topic?: string
        itemKey?: string
        instanceId?: string
    }>({
        moduleName,
        commandName: 'acknowledge-cursor',
    }),
    reportAppliedCursor: defineCommand<{
        cursor: number
    }>({
        moduleName,
        commandName: 'report-applied-cursor',
    }),
    sendPing: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'send-ping',
    }),
    tdpTopicDataChanged: defineCommand<TdpTopicDataChangedPayload>({
        moduleName,
        commandName: 'topic-data-changed',
        allowNoActor: true,
    }),
    recomputeResolvedTopicChanges: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'recompute-resolved-topic-changes',
        visibility: 'internal',
    }),
    tdpSnapshotLoaded: defineCommand<{
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
    }>({
        moduleName,
        commandName: 'snapshot-loaded',
        visibility: 'internal',
    }),
    tdpChangesLoaded: defineCommand<{
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        highWatermark: number
    }>({
        moduleName,
        commandName: 'changes-loaded',
        visibility: 'internal',
    }),
    tdpProjectionReceived: defineCommand<{
        cursor: number
        change: TdpProjectionEnvelope
    }>({
        moduleName,
        commandName: 'projection-received',
        visibility: 'internal',
    }),
    tdpProjectionBatchReceived: defineCommand<{
        nextCursor: number
        changes: TdpProjectionEnvelope[]
    }>({
        moduleName,
        commandName: 'projection-batch-received',
        visibility: 'internal',
    }),
    tdpCommandDelivered: defineCommand<Omit<TdpCommandInboxItem, 'receivedAt'>>({
        moduleName,
        commandName: 'command-delivered',
        visibility: 'internal',
    }),
    tdpSessionReady: defineCommand<{
        sessionId: string
        nodeId: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        highWatermark: number
        syncMode: 'incremental' | 'full'
        alternativeEndpoints: string[]
    }>({
        moduleName,
        commandName: 'session-ready',
        visibility: 'internal',
    }),
    tdpPongReceived: defineCommand<{
        timestamp: number
    }>({
        moduleName,
        commandName: 'pong-received',
        visibility: 'internal',
    }),
    tdpEdgeDegraded: defineCommand<{
        reason: string
        issuedAt: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        gracePeriodSeconds: number
        alternativeEndpoints: string[]
    }>({
        moduleName,
        commandName: 'edge-degraded',
        visibility: 'internal',
    }),
    tdpSessionRehomeRequired: defineCommand<{
        reason: string
        deadline: string
        alternativeEndpoints: string[]
    }>({
        moduleName,
        commandName: 'session-rehome-required',
        visibility: 'internal',
    }),
    tdpProtocolFailed: defineCommand<{
        code: string
        message: string
        details?: unknown
    }>({
        moduleName,
        commandName: 'protocol-failed',
        visibility: 'internal',
    }),
    tdpMessageReceived: defineCommand<TdpServerMessage>({
        moduleName,
        commandName: 'message-received',
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
