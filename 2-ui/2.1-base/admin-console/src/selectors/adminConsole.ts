import type {RootState} from '@next/kernel-base-state-runtime'
import {createSelector} from '@reduxjs/toolkit'
import {
    selectUiScreen,
} from '@next/kernel-base-ui-runtime-v2'
import {adminConsoleStateKeys} from '../foundations/stateKeys'
import {
    adminConsoleScreenContainers,
    getAdminConsoleTabScreenPartKey,
    isAdminConsoleTab,
} from '../foundations/adminScreenMetadata'
import {adminConsoleTabs} from '../foundations/adminTabs'
import type {
    AdapterDiagnosticSummary,
    AdminConsoleState,
    AdminConsoleTab,
} from '../types'

const readAdminConsoleTabFromScreenEntry = (entry: {
    partKey?: string
    props?: unknown
} | null | undefined): AdminConsoleTab | undefined => {
    const propsTab = (entry?.props as {tab?: unknown} | undefined)?.tab
    if (isAdminConsoleTab(propsTab)) {
        return propsTab
    }
    return adminConsoleTabs.find(tab => getAdminConsoleTabScreenPartKey(tab.key) === entry?.partKey)?.key
}

const selectAdminConsoleState = (state: RootState): AdminConsoleState | undefined =>
    state[adminConsoleStateKeys.console as keyof RootState] as AdminConsoleState | undefined

export const selectAdminConsoleRuntimeTab = createSelector(
    [(state: RootState) => selectUiScreen(state, adminConsoleScreenContainers.tabContent)],
    (entry): AdminConsoleTab | undefined => {
        const entryWithProps = entry && 'props' in entry
            ? {
                partKey: entry.partKey,
                props: entry.props,
            }
            : {
                partKey: entry?.partKey,
            }
        return readAdminConsoleTabFromScreenEntry(entryWithProps)
    },
)

export const selectAdminConsoleSelectedTab = createSelector(
    [selectAdminConsoleRuntimeTab],
    (tab): AdminConsoleTab => tab ?? adminConsoleTabs[0]?.key ?? 'terminal',
)

export const selectLatestAdapterSummary = createSelector(
    [selectAdminConsoleState],
    (state): AdapterDiagnosticSummary | undefined => state?.latestAdapterSummary,
)
