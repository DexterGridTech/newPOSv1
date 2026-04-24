import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import {adminConsoleStateKeys} from '../../foundations/stateKeys'
import type {
    AdapterDiagnosticSummary,
    AdminConsoleState,
    AdminConsoleTab,
} from '../../types'

const initialState: AdminConsoleState = {
    selectedTab: 'terminal',
}

const slice = createSlice({
    name: adminConsoleStateKeys.console,
    initialState,
    reducers: {
        setSelectedTab(state, action: PayloadAction<AdminConsoleTab>) {
            state.selectedTab = action.payload
        },
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
            stateKey: 'selectedTab',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'latestAdapterSummary',
            flushMode: 'immediate',
        },
    ],
}
