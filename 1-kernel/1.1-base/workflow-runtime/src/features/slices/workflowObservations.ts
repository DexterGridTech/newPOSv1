import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    WorkflowObservation,
    WorkflowObservationsState,
} from '../../types'

export const WORKFLOW_OBSERVATIONS_STATE_KEY = 'kernel.base.workflow-runtime.observations'

const initialState: WorkflowObservationsState = {
    byRequestId: {},
    updatedAt: 0,
}

const slice = createSlice({
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    initialState,
    reducers: {
        putObservation(state, action: PayloadAction<WorkflowObservation>) {
            return {
                byRequestId: {
                    ...state.byRequestId,
                    [action.payload.requestId]: action.payload,
                },
                updatedAt: action.payload.updatedAt,
            }
        },
        removeObservation(state, action: PayloadAction<{requestId: string; updatedAt: number}>) {
            delete state.byRequestId[action.payload.requestId]
            state.updatedAt = action.payload.updatedAt
        },
    },
})

export const workflowObservationsStateActions = slice.actions

export const workflowObservationsStateSliceDescriptor: StateRuntimeSliceDescriptor<WorkflowObservationsState> = {
    name: WORKFLOW_OBSERVATIONS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
