import {describe, expect, it} from 'vitest'
import {selectTdpSessionState} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {
    createTerminalTopologyIntegrationHarnessV2,
} from '../helpers/terminalTopologyIntegrationHarness'
import {
    createTerminalTaskPanelModuleV2,
    selectTerminalTaskPanelState,
} from '../helpers/terminalReadModelModules'
import {waitFor} from '../helpers/liveHarness'

describe('topology-runtime-v2 live task panel reconnect', () => {
    it('continues deriving and syncing task read model after TDP reconnect', async () => {
        const taskPanelModule = createTerminalTaskPanelModuleV2()
        const harness = await createTerminalTopologyIntegrationHarnessV2({
            tdpReconnectIntervalMs: 50,
            includeDefaultBridgeModule: false,
            masterModules: [taskPanelModule],
            slaveModules: [taskPanelModule],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000007',
                deviceId: 'device-live-terminal-task-panel-v2-reconnect-001',
            })

            const terminalId = harness.getTerminalId()
            if (!terminalId) {
                throw new Error('missing terminal id before task panel reconnect scene')
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

            const previousSessionId = await harness.forceCloseActiveTdpSession({
                code: 1012,
                reason: 'task-panel-reconnect-test-v2',
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
                throw new Error('missing second master task panel entry')
            }

            expect(slaveTaskPanel[secondMasterEntry.instanceId]).toEqual(secondMasterEntry)
        } finally {
            await harness.disconnect()
        }
    })
})
