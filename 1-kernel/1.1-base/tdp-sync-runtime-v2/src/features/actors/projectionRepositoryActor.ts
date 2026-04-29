import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'
import {estimateTdpServerNow, isTdpProjectionExpiredForLocalDefense} from '../../foundations/projectionExpiry'
import {selectTdpProjectionState, selectTdpSyncState} from '../../selectors'
import type {TdpProjectionEnvelope, TdpTopicDataChangeItem} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

const uniqueTopics = (changes: readonly {topic: string}[]) =>
    Array.from(new Set(changes.map(item => item.topic)))

const toExpiredProjectionDeleteChange = (entry: TdpProjectionEnvelope): TdpTopicDataChangeItem => ({
    operation: 'delete',
    itemKey: entry.itemKey,
    revision: entry.revision,
    scopeType: entry.scopeType,
    scopeId: entry.scopeId,
    sourceReleaseId: entry.sourceReleaseId ?? null,
    occurredAt: entry.occurredAt,
    scopeMetadata: entry.scopeMetadata,
})

const shouldRecomputeAllForChangedTopics = (topics: readonly string[]) =>
    topics.includes('terminal.group.membership')

const DEFAULT_SNAPSHOT_APPLY_CHUNK_SIZE = 100

const createSnapshotApplyId = (() => {
    let nextId = 0
    return () => `snapshot-apply-${Date.now()}-${++nextId}`
})()

const dispatchChangedTopicRecompute = async (
    context: {
        dispatchCommand<TPayload = unknown>(command: ReturnType<typeof createCommand<TPayload>>): Promise<unknown>
    },
    changedTopics: string[],
) => {
    if (shouldRecomputeAllForChangedTopics(changedTopics)) {
        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
        return
    }
    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeChangedTopicChanges, {
        topics: changedTopics,
    }))
}

export const createTdpProjectionRepositoryActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpProjectionRepositoryActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, async context => {
            const payload = context.command.payload
            const snapshotId = createSnapshotApplyId()
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.beginSnapshotApply, {
                snapshotId,
                highWatermark: payload.highWatermark,
                totalItems: payload.snapshot.length,
                serverClockOffsetMs: payload.serverClockOffsetMs,
            }))
            for (let index = 0; index < payload.snapshot.length; index += DEFAULT_SNAPSHOT_APPLY_CHUNK_SIZE) {
                await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.applySnapshotChunk, {
                    snapshotId,
                    chunkIndex: Math.floor(index / DEFAULT_SNAPSHOT_APPLY_CHUNK_SIZE),
                    items: payload.snapshot.slice(index, index + DEFAULT_SNAPSHOT_APPLY_CHUNK_SIZE),
                    serverClockOffsetMs: payload.serverClockOffsetMs,
                }))
            }
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.commitSnapshotApply, {
                snapshotId,
                highWatermark: payload.highWatermark,
            }))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            await context.flushPersistence()
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.snapshotApplyCompleted, {
                highWatermark: payload.highWatermark,
            }))
            return {
                count: payload.snapshot.length,
                highWatermark: payload.highWatermark,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.beginSnapshotApply, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.beginSnapshotApply(payload))
            return {
                snapshotId: payload.snapshotId,
                totalItems: payload.totalItems,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.applySnapshotChunk, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applySnapshotChunk(payload))
            return {
                snapshotId: payload.snapshotId,
                chunkIndex: payload.chunkIndex,
                count: payload.items.length,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.commitSnapshotApply, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.commitSnapshotApply(payload))
            return {
                snapshotId: payload.snapshotId,
                highWatermark: payload.highWatermark,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyChangesLoaded(payload))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            await context.flushPersistence()
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.changesApplyCompleted, {
                nextCursor: payload.nextCursor,
                highWatermark: payload.highWatermark,
                hasMore: payload.hasMore,
            }))
            return {
                count: payload.changes.length,
                nextCursor: payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyProjectionReceived(payload))
            const changedTopics = uniqueTopics([payload.change])
            await dispatchChangedTopicRecompute(context, changedTopics)
            await context.flushPersistence()
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.projectionApplyCompleted, {
                cursor: payload.cursor,
            }))
            return {
                cursor: payload.cursor,
                topic: payload.change.topic,
                itemKey: payload.change.itemKey,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyProjectionBatchReceived(payload))
            const changedTopics = uniqueTopics(payload.changes)
            await dispatchChangedTopicRecompute(context, changedTopics)
            await context.flushPersistence()
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.acknowledgeProjectionBatch, {
                nextCursor: payload.nextCursor,
                batchId: payload.batchId,
                processingLagMs: payload.receivedAt == null
                    ? undefined
                    : Math.max(0, Date.now() - payload.receivedAt),
            }))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.projectionBatchApplyCompleted, {
                nextCursor: payload.nextCursor,
            }))
            return {
                count: payload.changes.length,
                nextCursor: payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.cleanupExpiredTdpProjections, async context => {
            const state = context.getState() as any
            const cleanedAt = context.command.payload.now
                ?? estimateTdpServerNow(Date.now(), selectTdpSyncState(state)?.serverClockOffsetMs)
            const expiredEntries = Object.values(selectTdpProjectionState(state)?.activeEntries ?? {})
                .filter(entry => isTdpProjectionExpiredForLocalDefense(entry.expiresAt, cleanedAt))
            const removedTopics = Array.from(new Set(expiredEntries.map(entry => entry.topic)))
            context.dispatchAction(tdpSyncV2DomainActions.cleanupExpiredProjectionsCompleted({
                removedTopics,
                removedCount: expiredEntries.length,
                cleanedAt,
            }))
            if (removedTopics.length > 0) {
                const recomputeResult = await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeChangedTopicChanges, {
                    topics: removedTopics,
                }))
                const changedTopics = new Set<string>()
                recomputeResult.actorResults.forEach(result => {
                    const topics = result.result?.changedTopics
                    if (Array.isArray(topics)) {
                        topics.forEach(topic => {
                            if (typeof topic === 'string') {
                                changedTopics.add(topic)
                            }
                        })
                    }
                })
                for (const topic of removedTopics.filter(item => !changedTopics.has(item))) {
                    const changes = expiredEntries
                        .filter(entry => entry.topic === topic)
                        .map(toExpiredProjectionDeleteChange)
                    if (changes.length > 0) {
                        await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
                            topic,
                            changes,
                        }))
                    }
                }
                await context.flushPersistence()
            }
            return {
                removedTopicCount: removedTopics.length,
                removedTopics,
                cleanedAt,
            }
        }),
    ],
)
