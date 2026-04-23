import type {
    AdapterDiagnosticScenario,
    AdapterDiagnosticsRegistry,
} from '../types'

export const createDefaultAdapterScenarioCatalog = (): readonly AdapterDiagnosticScenario[] => []

export const createAdapterDiagnosticsRegistry = (
    initialScenarios: readonly AdapterDiagnosticScenario[] = createDefaultAdapterScenarioCatalog(),
): AdapterDiagnosticsRegistry => {
    let scenarios = [...initialScenarios]

    return {
        getScenarios() {
            return scenarios
        },
        setScenarios(nextScenarios) {
            scenarios = [...nextScenarios]
        },
    }
}
