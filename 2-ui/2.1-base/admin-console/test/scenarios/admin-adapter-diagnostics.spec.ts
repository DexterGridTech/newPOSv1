import {describe, expect, it} from 'vitest'
import {
    createAdapterDiagnosticsController,
    adminConsoleStateActions,
    selectAdminConsoleSelectedTab,
    selectLatestAdapterSummary,
} from '../../src'
import {createAdminConsoleHarness} from '../support/adminConsoleHarness'

describe('adapter diagnostics', () => {
    it('aggregates adapter runs into a stable summary model', async () => {
        const controller = createAdapterDiagnosticsController({
            scenarios: [
                {
                    adapterKey: 'scanner',
                    scenarioKey: 'connect',
                    title: '扫码通道连接',
                    async run() {
                        return {
                            status: 'passed',
                            message: '连接成功',
                        }
                    },
                },
                {
                    adapterKey: 'storage',
                    scenarioKey: 'read-write',
                    title: '存储读写',
                    async run() {
                        return {
                            status: 'failed',
                            message: '未检测到读写结果',
                        }
                    },
                },
            ],
        })

        const summary = await controller.runAll()

        expect(summary.total).toBe(2)
        expect(summary.passed).toBe(1)
        expect(summary.failed).toBe(1)
        expect(summary.status).toBe('failed')
        expect(summary.results.map(item => item.adapterKey)).toEqual(['scanner', 'storage'])
    })

    it('stores selected tab and latest summary inside admin console state', async () => {
        const harness = await createAdminConsoleHarness()
        const summary = {
            runId: 'run-1',
            status: 'passed' as const,
            total: 1,
            passed: 1,
            failed: 0,
            skipped: 0,
            startedAt: 1,
            finishedAt: 2,
            durationMs: 1,
            results: [],
        }

        harness.store.dispatch(adminConsoleStateActions.setSelectedTab('adapter'))
        harness.store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))

        expect(selectAdminConsoleSelectedTab(harness.store.getState())).toBe('adapter')
        expect(selectLatestAdapterSummary(harness.store.getState())).toEqual(summary)
    })

    it('defaults to no placeholder adapter scenarios', async () => {
        const controller = createAdapterDiagnosticsController({
            scenarios: [],
        })

        const summary = await controller.runAll()

        expect(controller.listAdapters()).toEqual([])
        expect(summary.total).toBe(0)
        expect(summary.passed).toBe(0)
        expect(summary.failed).toBe(0)
        expect(summary.skipped).toBe(0)
        expect(summary.status).toBe('skipped')
    })

    it('marks all-skipped runs as skipped instead of passed', async () => {
        const controller = createAdapterDiagnosticsController({
            scenarios: [
                {
                    adapterKey: 'printer',
                    scenarioKey: 'skip',
                    title: '打印机跳过',
                    async run() {
                        return {
                            status: 'skipped',
                            message: '未连接打印机',
                        }
                    },
                },
            ],
        })

        const summary = await controller.runAll()

        expect(summary.total).toBe(1)
        expect(summary.passed).toBe(0)
        expect(summary.failed).toBe(0)
        expect(summary.skipped).toBe(1)
        expect(summary.status).toBe('skipped')
    })
})
