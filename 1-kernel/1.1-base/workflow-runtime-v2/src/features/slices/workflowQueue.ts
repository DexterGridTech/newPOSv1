import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {RequestId} from '@next/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {WorkflowQueueState} from '../../types'

export const WORKFLOW_QUEUE_STATE_KEY = 'kernel.base.workflow-runtime-v2.queue'

const initialState: WorkflowQueueState = {
    queuedRequestIds: [],
    updatedAt: 0,
}

const slice = createSlice({
    name: WORKFLOW_QUEUE_STATE_KEY,
    initialState,
    reducers: {
        setActiveRequest(state, action: PayloadAction<{
            requestId?: RequestId
            updatedAt: number
        }>) {
            state.activeRequestId = action.payload.requestId
            state.updatedAt = action.payload.updatedAt
        },
        replaceQueuedRequests(state, action: PayloadAction<{
            requestIds: readonly RequestId[]
            updatedAt: number
        }>) {
            state.queuedRequestIds = [...action.payload.requestIds]
            state.updatedAt = action.payload.updatedAt
        },
    },
})

export const workflowQueueV2Actions = {
    setActiveRequest: (payload: {requestId?: RequestId; updatedAt: number}) =>
        slice.actions.setActiveRequest(payload),
    replaceQueuedRequests: (payload: {requestIds: readonly RequestId[]; updatedAt: number}) =>
        slice.actions.replaceQueuedRequests(payload),
}

export const workflowQueueV2SliceDescriptor: StateRuntimeSliceDescriptor<WorkflowQueueState> = {
    name: WORKFLOW_QUEUE_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
