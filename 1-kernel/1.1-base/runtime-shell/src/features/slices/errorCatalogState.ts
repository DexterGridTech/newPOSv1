import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ErrorCatalogEntry} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

export const RUNTIME_ERROR_CATALOG_STATE_KEY = 'kernel.base.runtime-shell.error-catalog'

const slice = createSlice({
    name: RUNTIME_ERROR_CATALOG_STATE_KEY,
    initialState: {} as Record<string, ErrorCatalogEntry>,
    reducers: {
        replaceErrorCatalog: (_state, action: PayloadAction<Record<string, ErrorCatalogEntry>>) => {
            return {...action.payload}
        },
        setErrorCatalogEntry: (state, action: PayloadAction<ErrorCatalogEntry>) => {
            state[action.payload.key] = action.payload
        },
        removeErrorCatalogEntry: (state, action: PayloadAction<string>) => {
            delete state[action.payload]
        },
    },
})

export const errorCatalogStateActions = slice.actions

export const errorCatalogStateSliceDescriptor: StateRuntimeSliceDescriptor<Record<string, ErrorCatalogEntry>> = {
    name: RUNTIME_ERROR_CATALOG_STATE_KEY,
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
