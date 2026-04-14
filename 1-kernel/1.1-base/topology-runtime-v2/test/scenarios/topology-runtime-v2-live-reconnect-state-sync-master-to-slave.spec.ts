import {describe, expect, it} from 'vitest'
import {createCommand, defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Sync,
} from '../../src'
import {
    createTopologyRuntimeV2StateSyncLiveHarness,
    selectSyncValueState,
    waitFor,
} from '../helpers/liveHarness'

describe('topology-runtime-v2 live reconnect state sync master-to-slave', () => {
    it('reconnects after relay disconnect and resumes continuous authoritative sync without blind flush', async () => {
        const syncCommand = defineCommand<{entryKey: string; value: string; updatedAt: number}>({
            moduleName: 'kernel.base.topology-runtime-v2.test.sync.master-to-slave.reconnect',
            commandName: 'put',
        })

        const harness = await createTopologyRuntimeV2StateSyncLiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.state-sync.master-to-slave.reconnect',
            syncSliceName: 'kernel.base.topology-runtime-v2.test.sync-state.master-to-slave.reconnect',
            syncCommandName: syncCommand.commandName,
            syncIntent: 'master-to-slave',
            reconnectIntervalMs: 50,
            reconnectAttempts: 5,
        })

        try {
            await harness.seedReconnectParameters(harness.masterRuntime)
            await harness.seedReconnectParameters(harness.slaveRuntime)
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const masterSync = selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())
                const slaveSync = selectTopologyRuntimeV2Sync(harness.slaveRuntime.getState())
                return masterSync?.resumeStatus === 'completed'
                    && slaveSync?.resumeStatus === 'completed'
                    && masterSync?.continuousSyncActive === true
                    && slaveSync?.continuousSyncActive === true
            }, 5_000)

            expect((await harness.masterRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'baseline',
                updatedAt: 100,
            }))).status).toBe('COMPLETED')

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'baseline'
            }, 5_000)

            const initialSync = selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())
            expect(initialSync?.continuousSyncActive).toBe(true)
            const initialCommitAckAt = initialSync?.lastCommitAckAt
            expect(initialCommitAckAt).toBeTruthy()

            await harness.replaceFaultRules([
                {
                    ruleId: 'disconnect-slave-on-next-dispatch',
                    kind: 'relay-disconnect-target',
                    channel: 'resume',
                    targetRole: 'slave',
                    remainingHits: 1,
                    createdAt: Date.now() as any,
                },
            ])

            expect((await harness.masterRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'should-arrive-after-reconnect',
                updatedAt: 200,
            }))).status).toBe('COMPLETED')

            await waitFor(() => {
                return selectTopologyRuntimeV2Connection(harness.slaveRuntime.getState())?.reconnectAttempt === 1
                    || selectTopologyRuntimeV2Connection(harness.masterRuntime.getState())?.reconnectAttempt === 1
            }, 5_000)

            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )?.counter?.value).toBe('baseline')

            await harness.clearFaultRules()

            const statsAfterDisconnect = await harness.getStats()
            expect(statsAfterDisconnect.relayCounters.disconnected).toBeGreaterThanOrEqual(1)

            await waitFor(() => {
                return selectTopologyRuntimeV2Connection(harness.masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                    && selectTopologyRuntimeV2Connection(harness.slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
            }, 10_000)

            await waitFor(() => {
                const masterSync = selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())
                const slaveSync = selectTopologyRuntimeV2Sync(harness.slaveRuntime.getState())
                return masterSync?.resumeStatus === 'completed'
                    && slaveSync?.resumeStatus === 'completed'
                    && masterSync?.continuousSyncActive === true
                    && slaveSync?.continuousSyncActive === true
            }, 10_000)

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'should-arrive-after-reconnect'
            }, 10_000)

            const resumedSync = selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())
            // Commit ACK timestamps are millisecond-based, so reconnect recovery can
            // legitimately land in the same tick as the baseline ACK.
            expect((resumedSync?.lastCommitAckAt ?? 0)).toBeGreaterThanOrEqual(initialCommitAckAt ?? 0)
            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'should-arrive-after-reconnect',
                    updatedAt: 200,
                },
            })

            expect((await harness.getStats()).relayCounters.disconnected).toBeGreaterThanOrEqual(1)
        } finally {
            await harness.close()
        }
    })
})
