import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {RuntimeInstanceId} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

export const RUNTIME_META_STATE_KEY = 'kernel.base.runtime-shell.meta'

const slice = createSlice({
    name: RUNTIME_META_STATE_KEY,
    initialState: {
        runtimeId: '' as RuntimeInstanceId,
    },
    reducers: {
        setRuntimeId(state, action: PayloadAction<RuntimeInstanceId>) {
            state.runtimeId = action.payload
        },
    },
})

export const runtimeMetaStateActions = slice.actions

export const runtimeMetaStateSliceDescriptor: StateRuntimeSliceDescriptor<{
    runtimeId: RuntimeInstanceId
}> = {
    name: RUNTIME_META_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
