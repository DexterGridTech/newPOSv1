import {describe, expect, it} from 'vitest'
import {
    createTerminalTopologyIntegrationHarnessV2,
} from '../helpers/terminalTopologyIntegrationHarness'
import {
    createTerminalRemoteCommandPanelModuleV2,
    selectTerminalRemoteCommandPanelState,
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

describe('topology-runtime-v2 live remote command panel', () => {
    it('builds a business-style remote command read model from TDP command inbox and syncs it to slave through real topology state sync', async () => {
        const remoteCommandPanelModule = createTerminalRemoteCommandPanelModuleV2()
        const harness = await createTerminalTopologyIntegrationHarnessV2({
            includeDefaultBridgeModule: false,
            masterModules: [remoteCommandPanelModule],
            slaveModules: [remoteCommandPanelModule],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000006',
                deviceId: 'device-live-remote-command-panel-v2-001',
            })

            const terminalId = harness.getTerminalId()
            if (!terminalId) {
                throw new Error('missing terminal id before remote command panel scenario')
            }

            const releaseResponse = await fetch(`${harness.terminalBaseUrl}/api/v1/admin/tasks/releases`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'topology-runtime-v2-live-remote-command-panel',
                    taskType: 'REMOTE_CONTROL',
                    sourceType: 'COMMAND',
                    sourceId: 'topology-runtime-v2-live-remote-command-panel',
                    priority: 1,
                    targetTerminalIds: [terminalId],
                    payload: {
                        topicKey: 'remote.control',
                        commandType: 'SYNC_ORDER',
                        action: 'SYNC_ORDER',
                        businessKey: 'order-20260413-remote-panel-v2-001',
                    },
                }),
            })
            const releasePayload = await releaseResponse.json() as {
                success: boolean
                data: {
                    release?: {
                        releaseId?: string
                    }
                }
            }
            const releaseId = releasePayload.data.release?.releaseId
            if (!releaseId) {
                throw new Error('missing release id for remote command panel scenario')
            }

            await waitFor(() => {
                const panel = selectTerminalRemoteCommandPanelState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    panel
                    && Object.values(panel).some(item =>
                        item.terminalId === terminalId
                        && item.sourceReleaseId === releaseId,
                    ),
                )
            }, 5_000)

            await waitFor(() => {
                const panel = selectTerminalRemoteCommandPanelState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                )
                return Boolean(
                    panel
                    && Object.values(panel).some(item =>
                        item.terminalId === terminalId
                        && item.sourceReleaseId === releaseId,
                    ),
                )
            }, 5_000)

            const masterPanel = selectTerminalRemoteCommandPanelState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            ) ?? {}
            const slavePanel = selectTerminalRemoteCommandPanelState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            ) ?? {}

            const masterEntry = Object.values(masterPanel).find(item =>
                item.terminalId === terminalId
                && item.sourceReleaseId === releaseId,
            )
            if (!masterEntry) {
                throw new Error('missing master remote command panel entry')
            }

            const slaveEntry = slavePanel[masterEntry.commandId]

            expect(masterEntry).toMatchObject({
                terminalId,
                topic: 'remote.control',
                commandType: 'SYNC_ORDER',
                action: 'SYNC_ORDER',
                businessKey: 'order-20260413-remote-panel-v2-001',
                sourceReleaseId: releaseId,
            })
            expect(slaveEntry).toEqual(masterEntry)

            const reportResult = await harness.reportTaskResult({
                instanceId: masterEntry.instanceId,
                status: 'COMPLETED',
                result: {
                    handledBy: 'topology-runtime-v2-live-remote-command-panel',
                    commandId: masterEntry.commandId,
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
                    data: Array<{instanceId: string; status: string; deliveryStatus: string}>
                }
                return payload.data.some(item =>
                    item.instanceId === masterEntry.instanceId
                    && item.status === 'COMPLETED'
                    && item.deliveryStatus === 'ACKED',
                )
            }, 5_000)
        } finally {
            await harness.disconnect()
        }
    })
})
