import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {
    AdapterDiagnosticResult,
    AdapterDiagnosticScenario,
    AdapterDiagnosticSummary,
    AdapterDiagnosticsRegistry,
} from '../types'

const createRunId = () => `admin-adapter-run:${nowTimestampMs()}`

const sortResults = (
    results: readonly AdapterDiagnosticResult[],
): AdapterDiagnosticResult[] =>
    [...results].sort((left, right) => left.startedAt - right.startedAt)

const toResult = async (
    scenario: AdapterDiagnosticScenario,
): Promise<AdapterDiagnosticResult> => {
    const startedAt = nowTimestampMs()
    try {
        const output = await scenario.run()
        const finishedAt = nowTimestampMs()
        return {
            adapterKey: scenario.adapterKey,
            scenarioKey: scenario.scenarioKey,
            title: scenario.title,
            status: output.status,
            message: output.message,
            detail: output.detail,
            startedAt,
            finishedAt,
            durationMs: Math.max(0, finishedAt - startedAt),
        }
    } catch (error) {
        const finishedAt = nowTimestampMs()
        return {
            adapterKey: scenario.adapterKey,
            scenarioKey: scenario.scenarioKey,
            title: scenario.title,
            status: 'failed',
            message: error instanceof Error ? error.message : '适配器测试失败',
            startedAt,
            finishedAt,
            durationMs: Math.max(0, finishedAt - startedAt),
        }
    }
}

const toSummary = (
    runId: string,
    results: readonly AdapterDiagnosticResult[],
): AdapterDiagnosticSummary => {
    const ordered = sortResults(results)
    const startedAt = ordered[0]?.startedAt ?? nowTimestampMs()
    const finishedAt = ordered.at(-1)?.finishedAt ?? startedAt
    const passed = ordered.filter(item => item.status === 'passed').length
    const failed = ordered.filter(item => item.status === 'failed').length
    const skipped = ordered.filter(item => item.status === 'skipped').length
    return {
        runId,
        status: failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'skipped',
        total: ordered.length,
        passed,
        failed,
        skipped,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - startedAt),
        results: [...ordered],
    }
}

export interface AdapterDiagnosticsController {
    runAll(): Promise<AdapterDiagnosticSummary>
    runAdapter(adapterKey: string): Promise<AdapterDiagnosticSummary>
    listAdapters(): readonly string[]
    listScenarios(adapterKey?: string): readonly AdapterDiagnosticScenario[]
}

export const createAdapterDiagnosticsController = (
    input: {
        scenarios?: readonly AdapterDiagnosticScenario[]
        registry?: AdapterDiagnosticsRegistry
    },
): AdapterDiagnosticsController => {
    const listScenarios = () =>
        input.registry?.getScenarios()
        ?? input.scenarios
        ?? []

    return {
        async runAll() {
            const results = await Promise.all(listScenarios().map(toResult))
            return toSummary(createRunId(), results)
        },
        async runAdapter(adapterKey: string) {
            const results = await Promise.all(
                listScenarios()
                    .filter(item => item.adapterKey === adapterKey)
                    .map(toResult),
            )
            return toSummary(createRunId(), results)
        },
        listAdapters() {
            return [...new Set(listScenarios().map(item => item.adapterKey))]
        },
        listScenarios(adapterKey?: string) {
            const scenarios = listScenarios()
            if (!adapterKey) {
                return scenarios
            }
            return scenarios.filter(item => item.adapterKey === adapterKey)
        },
    }
}
