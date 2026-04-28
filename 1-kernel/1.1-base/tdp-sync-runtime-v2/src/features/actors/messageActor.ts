import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {selectTdpSessionState} from '../../selectors'
import type {TdpProjectionEnvelope} from '../../types'
import {
    filterTdpProjectionChangesBySubscription,
    shouldAcceptTdpProjectionTopic,
    type TdpMessageSubscriptionGuardV1,
} from '../../foundations/reduceServerMessage'

const defineActor = createModuleActorFactory(moduleName)

interface PendingChunkedSnapshot {
    snapshotId: string
    totalChunks: number
    totalItems: number
    highWatermark: number
    chunksByIndex: Map<number, TdpProjectionEnvelope[]>
    receivedItemCount: number
}

const createSnapshotProtocolErrorPayload = (
    code: string,
    message: string,
    details: Record<string, unknown>,
) => ({
    code,
    message,
    details: {
        code,
        ...details,
    },
})

export const createTdpMessageActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpMessageActor',
    (() => {
        let pendingSnapshot: PendingChunkedSnapshot | undefined

        return [
            onCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, async context => {
            const message = context.command.payload
            const sessionSubscription = selectTdpSessionState(context.getState())?.subscription
            const subscriptionGuard: TdpMessageSubscriptionGuardV1 = {
                mode: sessionSubscription?.mode,
                acceptedTopics: sessionSubscription?.acceptedTopics,
                acceptedTopicSet: sessionSubscription == null
                    ? undefined
                    : new Set(sessionSubscription.acceptedTopics),
                reportRejectedTopic({topic, messageType}) {
                    context.platformPorts.logger.warn({
                        category: 'tdp.subscription',
                        event: 'tdp-unsubscribed-topic-rejected',
                        message: 'Reject TDP projection for unsubscribed topic',
                        data: {
                            topic,
                            messageType,
                        },
                    })
                },
            }
            switch (message.type) {
                case 'SESSION_READY':
                    if ((message.data.subscription?.requiredMissingTopics.length ?? 0) > 0) {
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, message.data))
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, {
                            code: 'TDP_REQUIRED_TOPICS_REJECTED',
                            message: 'Required TDP topics were rejected by server subscription policy',
                            details: {
                                requiredMissingTopics: message.data.subscription?.requiredMissingTopics ?? [],
                                rejectedTopics: message.data.subscription?.rejectedTopics ?? [],
                            },
                        }))
                        return {type: message.type, requiredMissingTopics: true}
                    }
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, message.data))
                    return {type: message.type}
                case 'FULL_SNAPSHOT':
                    pendingSnapshot = undefined
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
                        snapshot: filterTdpProjectionChangesBySubscription(
                            message.data.snapshot,
                            message.type,
                            subscriptionGuard,
                        ),
                        highWatermark: message.data.highWatermark,
                    }))
                    return {type: message.type}
                case 'SNAPSHOT_BEGIN':
                    pendingSnapshot = {
                        snapshotId: message.data.snapshotId,
                        totalChunks: Math.max(0, message.data.totalChunks),
                        totalItems: Math.max(0, message.data.totalItems),
                        highWatermark: message.data.highWatermark,
                        chunksByIndex: new Map(),
                        receivedItemCount: 0,
                    }
                    return {
                        type: message.type,
                        snapshotId: message.data.snapshotId,
                        totalChunks: message.data.totalChunks,
                    }
                case 'SNAPSHOT_CHUNK':
                    if (!pendingSnapshot || pendingSnapshot.snapshotId !== message.data.snapshotId) {
                        context.platformPorts.logger.warn({
                            category: 'tdp.snapshot',
                            event: 'snapshot-chunk-rejected',
                            message: 'Reject TDP snapshot chunk without matching SNAPSHOT_BEGIN',
                            data: {
                                snapshotId: message.data.snapshotId,
                                chunkIndex: message.data.chunkIndex,
                            },
                        })
                        return {
                            type: message.type,
                            rejected: true,
                        }
                    }
                    if (
                        message.data.chunkIndex < 0
                        || message.data.chunkIndex >= pendingSnapshot.totalChunks
                    ) {
                        const error = createSnapshotProtocolErrorPayload(
                            'TDP_SNAPSHOT_CHUNK_INDEX_OUT_OF_RANGE',
                            'TDP snapshot chunk index is out of range',
                            {
                                snapshotId: message.data.snapshotId,
                                chunkIndex: message.data.chunkIndex,
                                totalChunks: pendingSnapshot.totalChunks,
                            },
                        )
                        pendingSnapshot = undefined
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, error))
                        return {
                            type: message.type,
                            rejected: true,
                            code: error.code,
                        }
                    }
                    if (pendingSnapshot.chunksByIndex.has(message.data.chunkIndex)) {
                        const error = createSnapshotProtocolErrorPayload(
                            'TDP_SNAPSHOT_CHUNK_DUPLICATED',
                            'TDP snapshot chunk is duplicated',
                            {
                                snapshotId: message.data.snapshotId,
                                chunkIndex: message.data.chunkIndex,
                            },
                        )
                        pendingSnapshot = undefined
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, error))
                        return {
                            type: message.type,
                            rejected: true,
                            code: error.code,
                        }
                    }
                    pendingSnapshot.receivedItemCount += message.data.items.length
                    pendingSnapshot.chunksByIndex.set(
                        message.data.chunkIndex,
                        filterTdpProjectionChangesBySubscription(
                            message.data.items,
                            message.type,
                            subscriptionGuard,
                        ),
                    )
                    return {
                        type: message.type,
                        snapshotId: message.data.snapshotId,
                        chunkIndex: message.data.chunkIndex,
                    }
                case 'SNAPSHOT_END':
                    if (!pendingSnapshot || pendingSnapshot.snapshotId !== message.data.snapshotId) {
                        context.platformPorts.logger.warn({
                            category: 'tdp.snapshot',
                            event: 'snapshot-end-rejected',
                            message: 'Reject TDP snapshot end without matching SNAPSHOT_BEGIN',
                            data: {
                                snapshotId: message.data.snapshotId,
                            },
                        })
                        return {
                            type: message.type,
                            rejected: true,
                        }
                    }
                    {
                        const missingChunkIndexes = Array.from({length: pendingSnapshot.totalChunks})
                            .flatMap((_, index) => pendingSnapshot?.chunksByIndex.has(index) ? [] : [index])
                        if (
                            pendingSnapshot.chunksByIndex.size !== pendingSnapshot.totalChunks
                            || missingChunkIndexes.length > 0
                            || pendingSnapshot.receivedItemCount < pendingSnapshot.totalItems
                        ) {
                            const error = createSnapshotProtocolErrorPayload(
                                'TDP_SNAPSHOT_CHUNKS_INCOMPLETE',
                                'TDP snapshot chunks are incomplete',
                                {
                                    snapshotId: pendingSnapshot.snapshotId,
                                    totalChunks: pendingSnapshot.totalChunks,
                                    receivedChunks: pendingSnapshot.chunksByIndex.size,
                                    missingChunkIndexes,
                                    totalItems: pendingSnapshot.totalItems,
                                    receivedItems: pendingSnapshot.receivedItemCount,
                                },
                            )
                            pendingSnapshot = undefined
                            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, error))
                            return {
                                type: message.type,
                                rejected: true,
                                code: error.code,
                            }
                        }
                        const snapshot = Array.from({length: pendingSnapshot.totalChunks})
                            .flatMap((_, index) => pendingSnapshot?.chunksByIndex.get(index) ?? [])
                        const highWatermark = pendingSnapshot.highWatermark
                        const snapshotId = pendingSnapshot.snapshotId
                        pendingSnapshot = undefined
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
                            snapshot,
                            highWatermark,
                        }))
                        return {
                            type: message.type,
                            snapshotId,
                            count: snapshot.length,
                        }
                    }
                case 'CHANGESET':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
                        changes: filterTdpProjectionChangesBySubscription(
                            message.data.changes,
                            message.type,
                            subscriptionGuard,
                        ),
                        nextCursor: message.data.nextCursor,
                        highWatermark: message.data.highWatermark,
                        hasMore: message.data.hasMore,
                    }))
                    return {type: message.type}
                case 'PROJECTION_CHANGED':
                    if (!shouldAcceptTdpProjectionTopic(subscriptionGuard, message.data.change.topic, message.type)) {
                        return {type: message.type, filtered: true}
                    }
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
                        cursor: message.data.cursor,
                        change: message.data.change,
                    }))
                    return {type: message.type}
                case 'PROJECTION_BATCH':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, {
                        batchId: message.data.batchId,
                        receivedAt: message.timestamp,
                        changes: filterTdpProjectionChangesBySubscription(
                            message.data.changes,
                            message.type,
                            subscriptionGuard,
                        ),
                        nextCursor: message.data.nextCursor,
                    }))
                    return {type: message.type}
                case 'COMMAND_DELIVERED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, message.data))
                    return {type: message.type}
                case 'PONG':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpPongReceived, message.data))
                    return {type: message.type}
                case 'EDGE_DEGRADED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpEdgeDegraded, message.data))
                    return {type: message.type}
                case 'SESSION_REHOME_REQUIRED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionRehomeRequired, message.data))
                    return {type: message.type}
                case 'ERROR':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, message.error))
                    return {type: message.type}
                default:
                    return {type: 'UNKNOWN'}
            }
            }),
        ]
    })(),
)
