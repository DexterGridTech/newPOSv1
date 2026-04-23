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
import {decodeCateringProductChange} from '../../foundations/decoder'
import {cateringProductTopicList, isCateringProductTopic} from '../../foundations/topics'
import {cateringProductMasterDataCommandDefinitions} from '../commands'
import {cateringProductMasterDataActions} from '../slices/masterData'
import type {
    CateringProductDiagnosticsEntry,
    CateringProductMasterDataState,
    CateringProductRecord,
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
    if (!isCateringProductTopic(topic)) {
        return {accepted: false}
    }
    const records: CateringProductRecord[] = []
    const diagnostics: CateringProductDiagnosticsEntry[] = []
    changes.forEach(change => {
        const decoded = decodeCateringProductChange(topic, change)
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
        context.dispatchAction(cateringProductMasterDataActions.upsertRecords({records, changedAt}))
        await context.dispatchCommand(createCommand(
            cateringProductMasterDataCommandDefinitions.cateringProductMasterDataChanged,
            {
                topic,
                itemKeys: records.map(record => record.itemKey),
                changedAt,
            },
        ))
    }
    if (diagnostics.length > 0) {
        context.dispatchAction(cateringProductMasterDataActions.addDiagnostics(diagnostics))
    }
    return {
        accepted: true,
        records: records.length,
        diagnostics: diagnostics.length,
    }
}

export const createCateringProductMasterDataActorDefinition = (): ActorDefinition =>
    defineActor('CateringProductMasterDataActor', [
        onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context =>
            applyDecodedRecords(context as ActorExecutionContext, context.command.payload.topic, context.command.payload.changes),
        ),
        onCommand(cateringProductMasterDataCommandDefinitions.resetCateringProductMasterData, context => {
            context.dispatchAction(cateringProductMasterDataActions.reset())
            return {reset: true}
        }),
        onCommand(cateringProductMasterDataCommandDefinitions.rebuildCateringProductMasterDataFromTdp, async context => {
            const next: CateringProductMasterDataState = {
                byTopic: {},
                diagnostics: [],
                lastChangedAt: Date.now(),
            }
            for (const topic of cateringProductTopicList) {
                const projections = selectTdpProjectionEntriesByTopic(context.getState(), topic)
                    .sort((left, right) => left.revision - right.revision)
                projections.forEach(projection => {
                    const decoded = decodeCateringProductChange(topic, toChangeItem(projection))
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
            context.dispatchAction(cateringProductMasterDataActions.replaceAll(next))
            await context.dispatchCommand(createCommand(
                cateringProductMasterDataCommandDefinitions.cateringProductMasterDataChanged,
                {
                    topic: '*',
                    itemKeys: [],
                    changedAt: next.lastChangedAt ?? Date.now(),
                },
            ))
            return {
                topics: cateringProductTopicList.length,
                diagnostics: next.diagnostics.length,
            }
        }),
    ])
