import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Sync,
} from '@impos2/kernel-base-topology-runtime-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {uiRuntimeV2VariableWorkspaceKeys} from '../../src/features/slices'
import {createUiRuntimeV2LiveHarness} from '../helpers/liveHarness'

describe('ui-runtime-v2 live reconnect master-to-slave', () => {
    it('resumes authoritative ui-variable sync after relay disconnect and reconnect', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.reconnect.master-to-slave',
            reconnectIntervalMs: 50,
            reconnectAttempts: 5,
        })

        try {
            await harness.seedReconnectParameters(harness.masterRuntime)
            await harness.seedReconnectParameters(harness.slaveRuntime)
            await harness.configureTopologyPair()
            await harness.waitForSlaveSecondaryMainContext()
            await harness.startTopologyConnectionPair()

            await harness.waitForSlaveVariable('bootstrap', () => true, 50).catch(() => undefined)

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    syncToken: 'baseline',
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveVariable('syncToken', value => value === 'baseline')

            await harness.replaceFaultRules([
                {
                    ruleId: 'disconnect-slave-on-next-ui-sync',
                    kind: 'relay-disconnect-target',
                    channel: 'resume',
                    targetRole: 'slave',
                    remainingHits: 1,
                    createdAt: Date.now() as any,
                },
            ])

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    syncToken: 'after-reconnect',
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveVariable('syncToken', value => value === 'baseline')

            await harness.clearFaultRules()

            await harness.waitForSlaveVariable('syncToken', value => value === 'after-reconnect', 10_000)

            await harness.waitForSlaveVariable('syncToken', value => value === 'after-reconnect', 10_000)

            const masterConnection = selectTopologyRuntimeV2Connection(harness.masterRuntime.getState())
            const slaveConnection = selectTopologyRuntimeV2Connection(harness.slaveRuntime.getState())
            const masterSync = selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())
            const slaveSync = selectTopologyRuntimeV2Sync(harness.slaveRuntime.getState())
            const slaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const variableState = slaveState[uiRuntimeV2VariableWorkspaceKeys.main] as Record<string, {value?: unknown | null}> | undefined

            expect(masterConnection?.serverConnectionStatus).toBe('CONNECTED')
            expect(slaveConnection?.serverConnectionStatus).toBe('CONNECTED')
            expect(masterSync?.resumeStatus).toBe('completed')
            expect(slaveSync?.resumeStatus).toBe('completed')
            expect(masterSync?.continuousSyncActive).toBe(true)
            expect(slaveSync?.continuousSyncActive).toBe(true)
            expect(variableState?.syncToken?.value).toBe('after-reconnect')
            expect((await harness.getStats()).relayCounters.disconnected).toBeGreaterThanOrEqual(1)
        } finally {
            await harness.close()
        }
    })
})
