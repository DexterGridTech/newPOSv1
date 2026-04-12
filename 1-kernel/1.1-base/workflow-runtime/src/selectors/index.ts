import {createSelector} from '@reduxjs/toolkit'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {WorkflowDefinition, WorkflowObservation} from '../types'
import {
    WORKFLOW_DEFINITIONS_STATE_KEY,
    WORKFLOW_OBSERVATIONS_STATE_KEY,
    WORKFLOW_QUEUE_STATE_KEY,
} from '../features/slices'
import type {WorkflowDefinitionsBySource} from '../types'

export const selectWorkflowDefinitionsState = (state: Record<string, unknown>) =>
    state[WORKFLOW_DEFINITIONS_STATE_KEY] as {
        bySource: WorkflowDefinitionsBySource
    } | undefined

const selectWorkflowObservationsState = (state: Record<string, unknown>) =>
    state[WORKFLOW_OBSERVATIONS_STATE_KEY] as {
        byRequestId: Record<string, WorkflowObservation>
    } | undefined

export const selectWorkflowQueueState = (state: Record<string, unknown>) =>
    state[WORKFLOW_QUEUE_STATE_KEY] as {
        activeRequestId?: RequestId
        queuedRequestIds: readonly RequestId[]
    } | undefined

export const selectWorkflowDefinition = (
    state: Record<string, unknown>,
    workflowKey: string,
): readonly WorkflowDefinition[] => {
    const bySource = selectWorkflowDefinitionsState(state)?.bySource
    if (!bySource) {
        return []
    }

    return [
        ...(bySource.host[workflowKey] ?? []),
        ...(bySource.remote[workflowKey] ?? []),
        ...(bySource.module[workflowKey] ?? []),
        ...(bySource.test[workflowKey] ?? []),
    ]
}

export const selectWorkflowDefinitionsBySource = (
    state: Record<string, unknown>,
): WorkflowDefinitionsBySource | undefined => {
    return selectWorkflowDefinitionsState(state)?.bySource
}

export const selectWorkflowDefinitionsBySourceForKey = (
    state: Record<string, unknown>,
    workflowKey: string,
): WorkflowDefinitionsBySource => {
    const bySource = selectWorkflowDefinitionsState(state)?.bySource
    return {
        host: {
            [workflowKey]: bySource?.host[workflowKey] ?? [],
        },
        remote: {
            [workflowKey]: bySource?.remote[workflowKey] ?? [],
        },
        module: {
            [workflowKey]: bySource?.module[workflowKey] ?? [],
        },
        test: {
            [workflowKey]: bySource?.test[workflowKey] ?? [],
        },
    }
}

export const selectWorkflowObservationByRequestId = (
    state: Record<string, unknown>,
    requestId: RequestId,
): WorkflowObservation | undefined => {
    return selectWorkflowObservationsState(state)?.byRequestId[requestId]
}

export const selectWorkflowObservationStatusByRequestId = createSelector(
    [
        (state: Record<string, unknown>, requestId: RequestId) => selectWorkflowObservationByRequestId(state, requestId),
    ],
    observation => observation?.status,
)

export const selectActiveWorkflowObservation = createSelector(
    [
        selectWorkflowObservationsState,
        selectWorkflowQueueState,
    ],
    (observationsState, queueState) => {
        const requestId = queueState?.activeRequestId
        if (!requestId) {
            return undefined
        }
        return observationsState?.byRequestId[requestId]
    },
)
