import type {
    AdapterDiagnosticSummary,
    AdminConsoleTab,
} from '../types'

export interface PersistedAdminConsoleState {
    selectedTab: AdminConsoleTab
    latestAdapterSummary?: AdapterDiagnosticSummary
}

export const createDefaultAdminConsolePersistence = (): PersistedAdminConsoleState => ({
    selectedTab: 'terminal',
})
