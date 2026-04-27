import type {
    AdapterDiagnosticSummary,
} from '../types'

export interface PersistedAdminConsoleState {
    latestAdapterSummary?: AdapterDiagnosticSummary
}

export const createDefaultAdminConsolePersistence = (): PersistedAdminConsoleState => ({})
