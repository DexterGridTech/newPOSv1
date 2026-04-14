import {describe, expect, it} from 'vitest'
import {createCommand, defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyRuntimeV2Sync} from '../../src'
import {
    createTopologyRuntimeV2StateSyncLiveHarness,
    selectSyncValueState,
    waitFor,
} from '../helpers/liveHarness'

describe('topology-runtime-v2 live state sync slave-to-master', () => {
    it('applies slave-to-master state sync diff through real dual-topology host flow', async () => {
        const syncCommand = defineCommand<{entryKey: string; value: string; updatedAt: number}>({
            moduleName: 'kernel.base.topology-runtime-v2.test.sync.slave-to-master',
            commandName: 'put',
        })

        const harness = await createTopologyRuntimeV2StateSyncLiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.state-sync.slave-to-master',
            syncSliceName: 'kernel.base.topology-runtime-v2.test.sync-state.slave-to-master',
            syncCommandName: syncCommand.commandName,
            syncIntent: 'slave-to-master',
        })

        try {
            await harness.configureTopologyPair()

            expect((await harness.slaveRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'slave-value',
                updatedAt: 100,
            }))).status).toBe('COMPLETED')

            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const masterSlice = selectSyncValueState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return masterSlice?.counter?.value === 'slave-value'
            }, 5_000)

            expect(selectSyncValueState(
                harness.masterRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'slave-value',
                    updatedAt: 100,
                },
            })
            expect(selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())?.continuousSyncActive).toBe(true)
            expect(selectTopologyRuntimeV2Sync(harness.slaveRuntime.getState())?.continuousSyncActive).toBe(true)

            expect((await harness.slaveRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'slave-value-2',
                updatedAt: 200,
            }))).status).toBe('COMPLETED')

            await waitFor(() => {
                const masterSlice = selectSyncValueState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return masterSlice?.counter?.value === 'slave-value-2'
            }, 5_000)

            expect(selectSyncValueState(
                harness.masterRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'slave-value-2',
                    updatedAt: 200,
                },
            })
        } finally {
            await harness.close()
        }
    })
})
