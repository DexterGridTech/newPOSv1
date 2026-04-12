import {describe, expect, it} from 'vitest'
import {selectTdpProjectionState} from '@impos2/kernel-base-tdp-sync-runtime'
import {
    createTerminalTopologyBridgeLiveHarness,
} from '../helpers/terminalTopologyBridgeHarness'
import {
    createTerminalTaskPanelModule,
    selectTerminalTaskPanelState,
} from '../helpers/taskReadModelModule'
import {installTopologyClientServerCleanup, waitFor} from '../helpers/topologyClientHarness'

installTopologyClientServerCleanup()

const waitForAsync = async (predicate: () => Promise<boolean>, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for async condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

describe('topology-client-runtime live task panel', () => {
    it('builds a business-style task read model from tcp.task.release and syncs it to slave through real topology state sync', async () => {
        const taskPanelModule = createTerminalTaskPanelModule()
        const harness = await createTerminalTopologyBridgeLiveHarness({
            includeDefaultBridgeModule: false,
            masterModules: [taskPanelModule],
            slaveModules: [taskPanelModule],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000004',
                deviceId: 'device-live-terminal-task-panel-001',
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
                const projectionTopic = selectTdpProjectionState(harness.masterRuntime.getState())
                    ?.byTopic['tcp.task.release']
                return Boolean(
                    projectionTopic
                    && Object.values(projectionTopic).some(item =>
                        item.scopeId === terminalId
                        && item.sourceReleaseId === releaseId,
                    ),
                )
            }, 5_000)

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
                    handledBy: 'topology-client-runtime-live-task-panel',
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
                const taskInstances = payload.data
                return taskInstances.some(item =>
                    item.instanceId === masterEntry.instanceId
                    && item.status === 'COMPLETED',
                )
            }, 5_000)

            const traceResponse = await fetch(
                `${harness.terminalBaseUrl}/api/v1/admin/tasks/instances/${masterEntry.instanceId}/trace`,
            )
            const tracePayload = await traceResponse.json() as {
                success: boolean
                data: {
                    instance?: Record<string, unknown>
                }
            }
            const trace = tracePayload.data
            expect(trace.instance).toMatchObject({
                instanceId: masterEntry.instanceId,
                terminalId,
                releaseId,
                status: 'COMPLETED',
                result: {
                    handledBy: 'topology-client-runtime-live-task-panel',
                    releaseId,
                },
            })
        } finally {
            await harness.disconnect()
        }
    })
})
