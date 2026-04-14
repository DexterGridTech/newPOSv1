import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {castDraft} from 'immer'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    WorkflowObservation,
    WorkflowObservationsState,
} from '../../types'

export const WORKFLOW_OBSERVATIONS_STATE_KEY = 'kernel.base.workflow-runtime-v2.observations'

const initialState: WorkflowObservationsState = {
    byRequestId: {},
    updatedAt: 0,
}

const toMutableObservation = (observation: WorkflowObservation): WorkflowObservation =>
    JSON.parse(JSON.stringify(observation)) as WorkflowObservation

export interface TrimTerminalObservationsPayload {
    retainRequestIds: readonly string[]
    updatedAt: number
}

const slice = createSlice({
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    initialState,
    reducers: {
        putObservation(state, action: PayloadAction<WorkflowObservation>) {
            state.byRequestId[action.payload.requestId] = castDraft(toMutableObservation(action.payload))
            state.updatedAt = action.payload.updatedAt
        },
        removeObservation(state, action: PayloadAction<string>) {
            delete state.byRequestId[action.payload]
            state.updatedAt = Date.now()
        },
        trimTerminalObservations(state, action: PayloadAction<TrimTerminalObservationsPayload>) {
            const retainedIds = new Set(action.payload.retainRequestIds)
            Object.keys(state.byRequestId).forEach(requestId => {
                if (!retainedIds.has(requestId)) {
                    delete state.byRequestId[requestId]
                }
            })
            state.updatedAt = action.payload.updatedAt
        },
    },
})

export const workflowObservationsV2Actions = {
    putObservation: (payload: WorkflowObservation) =>
        slice.actions.putObservation(payload),
    removeObservation: (payload: string) =>
        slice.actions.removeObservation(payload),
    trimTerminalObservations: (payload: TrimTerminalObservationsPayload) =>
        slice.actions.trimTerminalObservations(payload),
}

export const workflowObservationsV2SliceDescriptor: StateRuntimeSliceDescriptor<WorkflowObservationsState> = {
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
