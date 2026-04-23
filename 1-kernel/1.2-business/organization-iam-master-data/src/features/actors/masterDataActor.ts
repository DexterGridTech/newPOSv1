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
import {decodeOrganizationIamChange} from '../../foundations/decoder'
import {isOrganizationIamTopic, organizationIamTopicList} from '../../foundations/topics'
import {organizationIamMasterDataCommandDefinitions} from '../commands'
import {organizationIamMasterDataActions} from '../slices/masterData'
import type {OrganizationIamDiagnosticsEntry, OrganizationIamMasterDataRecord, OrganizationIamMasterDataState} from '../../types'

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
    if (!isOrganizationIamTopic(topic)) {
        return {accepted: false}
    }
    const records: OrganizationIamMasterDataRecord[] = []
    const diagnostics: OrganizationIamDiagnosticsEntry[] = []
    changes.forEach(change => {
        const decoded = decodeOrganizationIamChange(topic, change)
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
        context.dispatchAction(organizationIamMasterDataActions.upsertRecords({records, changedAt}))
        await context.dispatchCommand(createCommand(
            organizationIamMasterDataCommandDefinitions.organizationIamMasterDataChanged,
            {
                topic,
                itemKeys: records.map(record => record.itemKey),
                changedAt,
            },
        ))
    }
    if (diagnostics.length > 0) {
        context.dispatchAction(organizationIamMasterDataActions.addDiagnostics(diagnostics))
    }

    return {
        accepted: true,
        records: records.length,
        diagnostics: diagnostics.length,
    }
}

export const createOrganizationIamMasterDataActorDefinition = (): ActorDefinition =>
    defineActor('OrganizationIamMasterDataActor', [
        onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context =>
            applyDecodedRecords(context as ActorExecutionContext, context.command.payload.topic, context.command.payload.changes),
        ),
        onCommand(organizationIamMasterDataCommandDefinitions.resetOrganizationIamMasterData, context => {
            context.dispatchAction(organizationIamMasterDataActions.reset())
            return {reset: true}
        }),
        onCommand(organizationIamMasterDataCommandDefinitions.rebuildOrganizationIamMasterDataFromTdp, async context => {
            const next: OrganizationIamMasterDataState = {
                byTopic: {},
                diagnostics: [],
                lastChangedAt: Date.now(),
            }
            for (const topic of organizationIamTopicList) {
                const projections = selectTdpProjectionEntriesByTopic(context.getState(), topic)
                    .sort((left, right) => left.revision - right.revision)
                projections.forEach(projection => {
                    const decoded = decodeOrganizationIamChange(topic, toChangeItem(projection))
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
            context.dispatchAction(organizationIamMasterDataActions.replaceAll(next))
            await context.dispatchCommand(createCommand(
                organizationIamMasterDataCommandDefinitions.organizationIamMasterDataChanged,
                {
                    topic: '*',
                    itemKeys: [],
                    changedAt: next.lastChangedAt ?? Date.now(),
                },
            ))
            return {
                topics: organizationIamTopicList.length,
                diagnostics: next.diagnostics.length,
            }
        }),
    ])
