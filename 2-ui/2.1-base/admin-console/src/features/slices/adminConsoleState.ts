import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import {adminConsoleStateKeys} from '../../foundations/stateKeys'
import type {
    AdapterDiagnosticSummary,
    AdminConsoleState,
} from '../../types'

const initialState: AdminConsoleState = {}

const slice = createSlice({
    name: adminConsoleStateKeys.console,
    initialState,
    reducers: {
        setLatestAdapterSummary(state, action: PayloadAction<AdapterDiagnosticSummary | undefined>) {
            state.latestAdapterSummary = action.payload
        },
    },
})

export const adminConsoleStateActions = slice.actions

export const adminConsoleStateSliceDescriptor: StateRuntimeSliceDescriptor<AdminConsoleState> = {
    name: adminConsoleStateKeys.console,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'field',
            stateKey: 'latestAdapterSummary',
            flushMode: 'immediate',
        },
    ],
}
