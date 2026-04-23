import {createSelector} from '@reduxjs/toolkit'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {
    WorkflowDefinition,
    WorkflowDefinitionsBySource,
    WorkflowObservation,
} from '../types'
import {
    WORKFLOW_DEFINITIONS_STATE_KEY,
    WORKFLOW_OBSERVATIONS_STATE_KEY,
    WORKFLOW_QUEUE_STATE_KEY,
} from '../features/slices'

export const selectWorkflowDefinitionsState = (state: RootState) =>
    state[WORKFLOW_DEFINITIONS_STATE_KEY as keyof RootState] as {
        bySource: WorkflowDefinitionsBySource
    } | undefined

const selectWorkflowObservationsState = (state: RootState) =>
    state[WORKFLOW_OBSERVATIONS_STATE_KEY as keyof RootState] as {
        byRequestId: Record<string, WorkflowObservation>
    } | undefined

export const selectWorkflowQueueState = (state: RootState) =>
    state[WORKFLOW_QUEUE_STATE_KEY as keyof RootState] as {
        activeRequestId?: RequestId
        queuedRequestIds: readonly RequestId[]
    } | undefined

export const selectWorkflowDefinition = (
    state: RootState,
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
    state: RootState,
): WorkflowDefinitionsBySource | undefined => {
    return selectWorkflowDefinitionsState(state)?.bySource
}

export const selectWorkflowObservationByRequestId = (
    state: RootState,
    requestId: RequestId,
): WorkflowObservation | undefined => {
    return selectWorkflowObservationsState(state)?.byRequestId[requestId]
}

export const selectWorkflowObservationStatusByRequestId = createSelector(
    [
        (state: RootState, requestId: RequestId) => selectWorkflowObservationByRequestId(state, requestId),
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
