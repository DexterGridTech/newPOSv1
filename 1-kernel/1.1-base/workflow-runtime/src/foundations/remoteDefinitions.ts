import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import {workflowDefinitionsStateActions} from '../features/slices'
import type {WorkflowDefinition} from '../types'
import type {WorkflowDefinitionId} from '../types'
import type {TdpTopicDataChangedPayload} from '@impos2/kernel-base-tdp-sync-runtime'
import type {WorkflowDefinitionsBySource} from '../types'

export const DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC = 'kernel.workflow.definition'

const isWorkflowDefinition = (value: unknown): value is WorkflowDefinition => {
    if (typeof value !== 'object' || value == null) {
        return false
    }

    const candidate = value as Partial<WorkflowDefinition>
    return typeof candidate.workflowKey === 'string'
        && typeof candidate.moduleName === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.enabled === 'boolean'
        && typeof candidate.rootStep === 'object'
        && candidate.rootStep != null
}

const toRemoteWorkflowDefinition = (input: {
    payload: Record<string, unknown>
    itemKey: string
    revision?: number
}): WorkflowDefinition | undefined => {
    const payload = input.payload
    if (!isWorkflowDefinition(payload)) {
        return undefined
    }

    return {
        ...payload,
        definitionId: (payload.definitionId ?? input.itemKey) as WorkflowDefinitionId,
        updatedAt: payload.updatedAt ?? input.revision,
    }
}

export const applyRemoteWorkflowDefinitionChanges = (
    payload: TdpTopicDataChangedPayload,
    currentDefinitionsState: {bySource: WorkflowDefinitionsBySource} | undefined,
    dispatchAction: (action: ReturnType<typeof workflowDefinitionsStateActions.upsertDefinitions>) => void,
    dispatchRemoveAction: (action: ReturnType<typeof workflowDefinitionsStateActions.removeDefinition>) => void,
) => {
    const updatedAt = nowTimestampMs()
    const definitions = payload.changes
        .filter(item => item.operation === 'upsert' && item.payload)
        .map(item => toRemoteWorkflowDefinition({
            payload: item.payload!,
            itemKey: item.itemKey,
            revision: item.revision,
        }))
        .filter((item): item is WorkflowDefinition => Boolean(item))

    if (definitions.length > 0) {
        dispatchAction(
            workflowDefinitionsStateActions.upsertDefinitions({
                definitions,
                source: 'remote',
                updatedAt,
            }),
        )
    }

    payload.changes
        .filter(item => item.operation === 'delete')
        .forEach(item => {
            const matchedEntry = Object.entries(currentDefinitionsState?.bySource.remote ?? {})
                .find(([, definitions]) => definitions.some(definition => definition.definitionId === item.itemKey))
            const workflowKey = matchedEntry?.[0]
            if (!workflowKey) {
                return
            }
            dispatchRemoveAction(
                workflowDefinitionsStateActions.removeDefinition({
                    workflowKey,
                    definitionId: item.itemKey,
                    source: 'remote',
                    updatedAt,
                }),
            )
        })
}
