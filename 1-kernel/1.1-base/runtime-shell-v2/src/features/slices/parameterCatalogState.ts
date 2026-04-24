import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ParameterCatalogEntry} from '@next/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'

export const RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY = 'kernel.base.runtime-shell-v2.parameter-catalog'

const slice = createSlice({
    name: RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY,
    initialState: {} as Record<string, ParameterCatalogEntry>,
    reducers: {
        setParameterCatalogEntry(state, action: PayloadAction<ParameterCatalogEntry>) {
            state[action.payload.key] = action.payload
        },
        removeParameterCatalogEntry(state, action: PayloadAction<string>) {
            delete state[action.payload]
        },
    },
})

export const runtimeShellV2ParameterCatalogStateActions = slice.actions

export const runtimeShellV2ParameterCatalogStateSliceDescriptor: StateRuntimeSliceDescriptor<Record<string, ParameterCatalogEntry>> = {
    name: RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'record',
            storageKeyPrefix: 'entries',
            flushMode: 'immediate',
        },
    ],
}
