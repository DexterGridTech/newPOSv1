import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
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

const slice = createSlice({
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    initialState,
    reducers: {
        putObservation(state, action: PayloadAction<WorkflowObservation>) {
            state.byRequestId[action.payload.requestId] = toMutableObservation(action.payload) as any
            state.updatedAt = action.payload.updatedAt
        },
        removeObservation(state, action: PayloadAction<string>) {
            delete state.byRequestId[action.payload]
            state.updatedAt = Date.now()
        },
    },
})

export const workflowObservationsV2Actions = {
    putObservation: (payload: WorkflowObservation) =>
        slice.actions.putObservation(payload),
    removeObservation: (payload: string) =>
        slice.actions.removeObservation(payload),
}

export const workflowObservationsV2SliceDescriptor: StateRuntimeSliceDescriptor<WorkflowObservationsState> = {
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
