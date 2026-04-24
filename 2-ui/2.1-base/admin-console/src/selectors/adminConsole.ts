import type {RootState} from '@next/kernel-base-state-runtime'
import {createSelector} from '@reduxjs/toolkit'
import {adminConsoleStateKeys} from '../foundations/stateKeys'
import type {
    AdapterDiagnosticSummary,
    AdminConsoleState,
    AdminConsoleTab,
} from '../types'

const selectAdminConsoleState = (state: RootState): AdminConsoleState | undefined =>
    state[adminConsoleStateKeys.console as keyof RootState] as AdminConsoleState | undefined

export const selectAdminConsoleSelectedTab = createSelector(
    [selectAdminConsoleState],
    (state): AdminConsoleTab => state?.selectedTab ?? 'terminal',
)

export const selectLatestAdapterSummary = createSelector(
    [selectAdminConsoleState],
    (state): AdapterDiagnosticSummary | undefined => state?.latestAdapterSummary,
)
