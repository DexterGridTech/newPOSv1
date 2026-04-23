import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ErrorCatalogEntry} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

export const RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY = 'kernel.base.runtime-shell-v2.error-catalog'

const slice = createSlice({
    name: RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY,
    initialState: {} as Record<string, ErrorCatalogEntry>,
    reducers: {
        setErrorCatalogEntry(state, action: PayloadAction<ErrorCatalogEntry>) {
            state[action.payload.key] = action.payload
        },
        removeErrorCatalogEntry(state, action: PayloadAction<string>) {
            delete state[action.payload]
        },
    },
})

export const runtimeShellV2ErrorCatalogStateActions = slice.actions

export const runtimeShellV2ErrorCatalogStateSliceDescriptor: StateRuntimeSliceDescriptor<Record<string, ErrorCatalogEntry>> = {
    name: RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY,
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
