import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {RequestId, RequestProjection} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

export const RUNTIME_REQUEST_PROJECTION_STATE_KEY = 'kernel.base.runtime-shell.request-projections'

const slice = createSlice({
    name: RUNTIME_REQUEST_PROJECTION_STATE_KEY,
    initialState: {} as Record<string, RequestProjection>,
    reducers: {
        replaceRequestProjections: (_state, action: PayloadAction<Record<string, RequestProjection>>) => {
            return {...action.payload}
        },
        setRequestProjection: (state, action: PayloadAction<{requestId: RequestId; projection: RequestProjection}>) => {
            state[action.payload.requestId] = action.payload.projection
        },
    },
})

export const requestProjectionStateActions = slice.actions

export const requestProjectionStateSliceDescriptor: StateRuntimeSliceDescriptor<Record<string, RequestProjection>> = {
    name: RUNTIME_REQUEST_PROJECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
