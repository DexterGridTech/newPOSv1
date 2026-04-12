import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

export const RUNTIME_PARAMETER_CATALOG_STATE_KEY = 'kernel.base.runtime-shell.parameter-catalog'

const slice = createSlice({
    name: RUNTIME_PARAMETER_CATALOG_STATE_KEY,
    initialState: {} as Record<string, ParameterCatalogEntry>,
    reducers: {
        replaceParameterCatalog: (_state, action: PayloadAction<Record<string, ParameterCatalogEntry>>) => {
            return {...action.payload}
        },
        setParameterCatalogEntry: (state, action: PayloadAction<ParameterCatalogEntry>) => {
            state[action.payload.key] = action.payload
        },
        removeParameterCatalogEntry: (state, action: PayloadAction<string>) => {
            delete state[action.payload]
        },
    },
})

export const parameterCatalogStateActions = slice.actions

export const parameterCatalogStateSliceDescriptor: StateRuntimeSliceDescriptor<Record<string, ParameterCatalogEntry>> = {
    name: RUNTIME_PARAMETER_CATALOG_STATE_KEY,
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
