import {describe, expect, it} from 'vitest'
import {selectTopologyClientSync} from '../../src'
import {
    createTopologyStateSyncLiveHarness,
    selectSyncValueState,
} from '../helpers/liveHarness'
import {waitFor} from '../helpers/topologyClientHarness'

describe('topology-client-runtime live state sync slave-to-master', () => {
    it('applies slave-to-master state sync diff through real dual-topology host flow', async () => {
        const harness = await createTopologyStateSyncLiveHarness({
            profileName: 'dual-topology.ws.state-sync.slave-to-master',
            syncSliceName: 'kernel.base.topology-client-runtime.test.sync-state.slave-to-master',
            syncCommandName: 'kernel.base.topology-client-runtime.test.sync-state.slave-to-master.put',
            syncIntent: 'slave-to-master',
        })

        try {
            await harness.configureTopologyPair()

            expect((await harness.slaveRuntime.execute({
                commandName: harness.syncCommandName,
                payload: {
                    entryKey: 'counter',
                    value: 'slave-value',
                    updatedAt: 100,
                },
            })).status).toBe('completed')

            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const masterSlice = selectSyncValueState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return masterSlice?.counter?.value === 'slave-value'
            })

            expect(selectSyncValueState(
                harness.masterRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'slave-value',
                    updatedAt: 100,
                },
            })
            expect(selectTopologyClientSync(harness.masterRuntime.getState())?.continuousSyncActive).toBe(true)
            expect(selectTopologyClientSync(harness.slaveRuntime.getState())?.continuousSyncActive).toBe(true)

            expect((await harness.slaveRuntime.execute({
                commandName: harness.syncCommandName,
                payload: {
                    entryKey: 'counter',
                    value: 'slave-value-2',
                    updatedAt: 200,
                },
            })).status).toBe('completed')

            await waitFor(() => {
                const masterSlice = selectSyncValueState(
                    harness.masterRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return masterSlice?.counter?.value === 'slave-value-2'
            })

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
            harness.disconnect()
        }
    })
})
