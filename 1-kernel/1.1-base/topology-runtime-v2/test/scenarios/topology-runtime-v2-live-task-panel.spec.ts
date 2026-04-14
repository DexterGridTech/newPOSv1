import {describe, expect, it} from 'vitest'
import {
    createTerminalTopologyIntegrationHarnessV2,
} from '../helpers/terminalTopologyIntegrationHarness'
import {
    createTerminalTaskPanelModuleV2,
    selectTerminalTaskPanelState,
} from '../helpers/terminalReadModelModules'
import {waitFor} from '../helpers/liveHarness'

const waitForAsync = async (predicate: () => Promise<boolean>, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for async condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

describe('topology-runtime-v2 live task panel', () => {
    it('builds a business-style task read model from tcp.task.release and syncs it to slave through real topology state sync', async () => {
        const taskPanelModule = createTerminalTaskPanelModuleV2()
        const harness = await createTerminalTopologyIntegrationHarnessV2({
            includeDefaultBridgeModule: false,
            masterModules: [taskPanelModule],
            slaveModules: [taskPanelModule],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000004',
                deviceId: 'device-live-terminal-task-panel-v2-001',
            })

            const terminalId = harness.getTerminalId()
            if (!terminalId) {
                throw new Error('missing terminal id before task panel scene run')
            }

            const sceneResult = await harness.runSceneTemplate('scene-batch-terminal-online', {
                targetTerminalIds: [terminalId],
                batchCount: 1,
            })

            const releaseId = sceneResult.release?.releaseId
            if (!releaseId) {
                throw new Error('missing scene release id for task panel scenario')
            }

            await waitFor(() => {
                const taskPanel = selectTerminalTaskPanelState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    taskPanel
                    && Object.values(taskPanel).some(item =>
                        item.scopeId === terminalId
                        && item.releaseId === releaseId,
                    ),
                )
            }, 5_000)

            await waitFor(() => {
                const taskPanel = selectTerminalTaskPanelState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    taskPanel
                    && Object.values(taskPanel).some(item =>
                        item.scopeId === terminalId
                        && item.releaseId === releaseId,
                    ),
                )
            }, 5_000)

            const masterTaskPanel = selectTerminalTaskPanelState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            ) ?? {}
            const slaveTaskPanel = selectTerminalTaskPanelState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            ) ?? {}

            const masterEntry = Object.values(masterTaskPanel).find(item =>
                item.scopeId === terminalId
                && item.releaseId === releaseId,
            )
            const slaveEntry = masterEntry == null ? undefined : slaveTaskPanel[masterEntry.instanceId]

            if (!masterEntry) {
                throw new Error('missing master task panel entry for scene release')
            }

            expect(masterEntry).toMatchObject({
                releaseId,
                scopeId: terminalId,
                taskType: 'CONFIG_PUBLISH',
                payload: {
                    configVersion: 'config-2026.04.06',
                    strategy: 'immediate',
                },
            })
            expect(slaveEntry).toEqual(masterEntry)

            const reportResult = await harness.reportTaskResult({
                instanceId: masterEntry.instanceId,
                status: 'COMPLETED',
                result: {
                    handledBy: 'topology-runtime-v2-live-task-panel',
                    releaseId,
                },
            })

            expect(reportResult).toMatchObject({
                instanceId: masterEntry.instanceId,
                status: 'COMPLETED',
            })

            await waitForAsync(async () => {
                const response = await fetch(`${harness.terminalBaseUrl}/api/v1/admin/tasks/instances`)
                const payload = await response.json() as {
                    success: boolean
                    data: Array<{instanceId: string; status: string}>
                }
                return payload.data.some(item =>
                    item.instanceId === masterEntry.instanceId
                    && item.status === 'COMPLETED',
                )
            }, 5_000)
        } finally {
            await harness.disconnect()
        }
    })
})
