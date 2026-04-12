import {describe, expect, it} from 'vitest'
import {selectTdpSessionState} from '@impos2/kernel-base-tdp-sync-runtime'
import {
    createTerminalTopologyBridgeLiveHarness,
} from '../helpers/terminalTopologyBridgeHarness'
import {
    createTerminalTaskPanelModule,
    selectTerminalTaskPanelState,
} from '../helpers/taskReadModelModule'
import {installTopologyClientServerCleanup, waitFor} from '../helpers/topologyClientHarness'

installTopologyClientServerCleanup()

describe('topology-client-runtime live task panel reconnect', () => {
    it('continues growing task panel read model on master and slave after TDP forced close and reconnect', async () => {
        const taskPanelModule = createTerminalTaskPanelModule()
        const harness = await createTerminalTopologyBridgeLiveHarness({
            includeDefaultBridgeModule: false,
            tdpReconnectIntervalMs: 50,
            masterModules: [taskPanelModule],
            slaveModules: [taskPanelModule],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000005',
                deviceId: 'device-live-terminal-task-panel-reconnect-001',
            })

            const terminalId = harness.getTerminalId()
            if (!terminalId) {
                throw new Error('missing terminal id before task panel reconnect scenario')
            }

            const firstScene = await harness.runSceneTemplate('scene-batch-terminal-online', {
                targetTerminalIds: [terminalId],
                batchCount: 1,
            })
            const firstReleaseId = firstScene.release?.releaseId
            if (!firstReleaseId) {
                throw new Error('missing first release id for task panel reconnect scenario')
            }

            await waitFor(() => {
                const taskPanel = selectTerminalTaskPanelState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    taskPanel
                    && Object.values(taskPanel).some(item =>
                        item.scopeId === terminalId
                        && item.releaseId === firstReleaseId,
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
                        && item.releaseId === firstReleaseId,
                    ),
                )
            }, 5_000)

            const firstMasterTaskPanel = selectTerminalTaskPanelState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            ) ?? {}
            const firstSlaveTaskPanel = selectTerminalTaskPanelState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            ) ?? {}
            const firstMasterEntry = Object.values(firstMasterTaskPanel).find(item =>
                item.scopeId === terminalId
                && item.releaseId === firstReleaseId,
            )
            if (!firstMasterEntry) {
                throw new Error('missing first master task panel entry before reconnect')
            }
            const firstSlaveEntry = firstSlaveTaskPanel[firstMasterEntry.instanceId]
            if (!firstSlaveEntry) {
                throw new Error('missing first slave task panel entry before reconnect')
            }

            const previousSessionId = await harness.forceCloseActiveTdpSession({
                code: 1012,
                reason: 'task-panel-reconnect-test',
            })

            const reconnectedSession = await harness.waitForReconnectedTdpSession(previousSessionId, 5_000)
            expect(reconnectedSession?.syncMode).toBe('incremental')
            expect(selectTdpSessionState(harness.masterRuntime.getState())?.status).toBe('READY')

            const secondScene = await harness.runSceneTemplate('scene-batch-terminal-online', {
                targetTerminalIds: [terminalId],
                batchCount: 1,
            })
            const secondReleaseId = secondScene.release?.releaseId
            if (!secondReleaseId) {
                throw new Error('missing second release id for task panel reconnect scenario')
            }

            await waitFor(() => {
                const taskPanel = selectTerminalTaskPanelState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    taskPanel
                    && Object.values(taskPanel).some(item =>
                        item.scopeId === terminalId
                        && item.releaseId === secondReleaseId,
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
                        && item.releaseId === secondReleaseId,
                    ),
                )
            }, 5_000)

            const masterTaskPanel = selectTerminalTaskPanelState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            ) ?? {}
            const slaveTaskPanel = selectTerminalTaskPanelState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            ) ?? {}

            const secondMasterEntry = Object.values(masterTaskPanel).find(item =>
                item.scopeId === terminalId
                && item.releaseId === secondReleaseId,
            )
            if (!secondMasterEntry) {
                throw new Error('missing second master task panel entry after reconnect')
            }

            const secondSlaveEntry = slaveTaskPanel[secondMasterEntry.instanceId]

            expect(secondMasterEntry).toMatchObject({
                releaseId: secondReleaseId,
                scopeId: terminalId,
                taskType: 'CONFIG_PUBLISH',
                payload: {
                    configVersion: 'config-2026.04.06',
                    strategy: 'immediate',
                },
            })
            expect(secondSlaveEntry).toEqual(secondMasterEntry)

            expect(masterTaskPanel[firstMasterEntry.instanceId]).toEqual(firstMasterEntry)
            expect(secondMasterEntry.instanceId).not.toBe(firstMasterEntry.instanceId)
        } finally {
            await harness.disconnect()
        }
    })
})
