import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type ActorExecutionContext,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTdpProjectionEntriesByTopic,
    tdpSyncV2CommandDefinitions,
    type TdpProjectionEnvelope,
    type TdpTopicDataChangeItem,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {moduleName} from '../../moduleName'
import {decodeCateringStoreOperatingChange} from '../../foundations/decoder'
import {cateringStoreOperatingTopicList, isCateringStoreOperatingTopic} from '../../foundations/topics'
import {cateringStoreOperatingMasterDataCommandDefinitions} from '../commands'
import {cateringStoreOperatingMasterDataActions} from '../slices/masterData'
import type {
    CateringStoreOperatingDiagnosticsEntry,
    CateringStoreOperatingMasterDataState,
    CateringStoreOperatingRecord,
} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

const toChangeItem = (projection: TdpProjectionEnvelope): TdpTopicDataChangeItem => ({
    operation: projection.operation,
    itemKey: projection.itemKey,
    payload: projection.payload,
    revision: projection.revision,
    scopeType: projection.scopeType,
    scopeId: projection.scopeId,
    sourceReleaseId: projection.sourceReleaseId,
    occurredAt: projection.occurredAt,
})

const applyDecodedRecords = async (
    context: ActorExecutionContext,
    topic: string,
    changes: readonly TdpTopicDataChangeItem[],
) => {
    if (!isCateringStoreOperatingTopic(topic)) {
        return {accepted: false}
    }
    const records: CateringStoreOperatingRecord[] = []
    const diagnostics: CateringStoreOperatingDiagnosticsEntry[] = []
    changes.forEach(change => {
        const decoded = decodeCateringStoreOperatingChange(topic, change)
        if (decoded.record) {
            records.push(decoded.record)
            return
        }
        diagnostics.push({
            topic,
            itemKey: change.itemKey,
            scopeType: change.scopeType,
            scopeId: change.scopeId,
            revision: change.revision,
            reason: decoded.error ?? 'Unknown decode failure',
            occurredAt: Date.now(),
        })
    })
    const changedAt = Date.now()
    if (records.length > 0) {
        context.dispatchAction(cateringStoreOperatingMasterDataActions.upsertRecords({records, changedAt}))
        await context.dispatchCommand(createCommand(
            cateringStoreOperatingMasterDataCommandDefinitions.cateringStoreOperatingMasterDataChanged,
            {
                topic,
                itemKeys: records.map(record => record.itemKey),
                changedAt,
            },
        ))
    }
    if (diagnostics.length > 0) {
        context.dispatchAction(cateringStoreOperatingMasterDataActions.addDiagnostics(diagnostics))
    }
    return {
        accepted: true,
        records: records.length,
        diagnostics: diagnostics.length,
    }
}

export const createCateringStoreOperatingMasterDataActorDefinition = (): ActorDefinition =>
    defineActor('CateringStoreOperatingMasterDataActor', [
        onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context =>
            applyDecodedRecords(context as ActorExecutionContext, context.command.payload.topic, context.command.payload.changes),
        ),
        onCommand(cateringStoreOperatingMasterDataCommandDefinitions.resetCateringStoreOperatingMasterData, context => {
            context.dispatchAction(cateringStoreOperatingMasterDataActions.reset())
            return {reset: true}
        }),
        onCommand(cateringStoreOperatingMasterDataCommandDefinitions.rebuildCateringStoreOperatingMasterDataFromTdp, async context => {
            const next: CateringStoreOperatingMasterDataState = {
                byTopic: {},
                diagnostics: [],
                lastChangedAt: Date.now(),
            }
            for (const topic of cateringStoreOperatingTopicList) {
                const projections = selectTdpProjectionEntriesByTopic(context.getState(), topic)
                    .sort((left, right) => left.revision - right.revision)
                projections.forEach(projection => {
                    const decoded = decodeCateringStoreOperatingChange(topic, toChangeItem(projection))
                    if (decoded.record) {
                        const byItemKey = next.byTopic[topic] ?? {}
                        byItemKey[decoded.record.itemKey] = decoded.record
                        next.byTopic[topic] = byItemKey
                        return
                    }
                    next.diagnostics.unshift({
                        topic,
                        itemKey: projection.itemKey,
                        scopeType: projection.scopeType,
                        scopeId: projection.scopeId,
                        revision: projection.revision,
                        reason: decoded.error ?? 'Unknown decode failure',
                        occurredAt: Date.now(),
                    })
                })
            }
            context.dispatchAction(cateringStoreOperatingMasterDataActions.replaceAll(next))
            await context.dispatchCommand(createCommand(
                cateringStoreOperatingMasterDataCommandDefinitions.cateringStoreOperatingMasterDataChanged,
                {
                    topic: '*',
                    itemKeys: [],
                    changedAt: next.lastChangedAt ?? Date.now(),
                },
            ))
            return {
                topics: cateringStoreOperatingTopicList.length,
                diagnostics: next.diagnostics.length,
            }
        }),
    ])
