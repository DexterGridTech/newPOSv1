import type {AdapterDiagnosticScenario, AdapterDiagnosticsRegistry} from '../types'
import {
    createAdapterDiagnosticsRegistry,
    createDefaultAdapterScenarioCatalog,
} from './adapterScenarioCatalog'

const sharedAdapterDiagnosticsRegistry = createAdapterDiagnosticsRegistry()

export const getAdminAdapterDiagnosticsRegistry = (): AdapterDiagnosticsRegistry =>
    sharedAdapterDiagnosticsRegistry

export const installAdminAdapterDiagnosticsScenarios = (
    scenarios: readonly AdapterDiagnosticScenario[],
) => {
    sharedAdapterDiagnosticsRegistry.setScenarios(scenarios)
}

export const resetAdminAdapterDiagnosticsScenarios = () => {
    sharedAdapterDiagnosticsRegistry.setScenarios(createDefaultAdapterScenarioCatalog())
}
