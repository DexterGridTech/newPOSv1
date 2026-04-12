import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {WorkflowQueueState} from '../../types'

export const WORKFLOW_QUEUE_STATE_KEY = 'kernel.base.workflow-runtime.queue'

const initialState: WorkflowQueueState = {
    queuedRequestIds: [],
    updatedAt: 0,
}

const slice = createSlice({
    name: WORKFLOW_QUEUE_STATE_KEY,
    initialState,
    reducers: {
        setActiveRequest(state, action: PayloadAction<{requestId?: RequestId; updatedAt: number}>) {
            state.activeRequestId = action.payload.requestId
            state.updatedAt = action.payload.updatedAt
        },
        replaceQueuedRequests(state, action: PayloadAction<{requestIds: readonly RequestId[]; updatedAt: number}>) {
            state.queuedRequestIds = [...action.payload.requestIds]
            state.updatedAt = action.payload.updatedAt
        },
    },
})

export const workflowQueueStateActions = slice.actions

export const workflowQueueStateSliceDescriptor: StateRuntimeSliceDescriptor<WorkflowQueueState> = {
    name: WORKFLOW_QUEUE_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
