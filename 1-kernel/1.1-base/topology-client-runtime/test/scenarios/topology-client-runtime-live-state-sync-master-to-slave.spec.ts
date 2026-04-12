import {describe, expect, it} from 'vitest'
import {selectTopologyClientSync} from '../../src'
import {
    createTopologyStateSyncLiveHarness,
    selectSyncValueState,
} from '../helpers/liveHarness'
import {waitFor} from '../helpers/topologyClientHarness'

describe('topology-client-runtime live state sync master-to-slave', () => {
    it('applies master-to-slave state sync diff through real dual-topology host flow', async () => {
        const harness = await createTopologyStateSyncLiveHarness({
            profileName: 'dual-topology.ws.state-sync.master-to-slave',
            syncSliceName: 'kernel.base.topology-client-runtime.test.sync-state',
            syncCommandName: 'kernel.base.topology-client-runtime.test.sync-state.put',
        })

        try {
            await harness.configureTopologyPair()

            expect((await harness.masterRuntime.execute({
                commandName: harness.syncCommandName,
                payload: {
                    entryKey: 'counter',
                    value: 'master-value',
                    updatedAt: 100,
                },
            })).status).toBe('completed')

            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'master-value'
            })

            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'master-value',
                    updatedAt: 100,
                },
            })
            expect(selectTopologyClientSync(harness.masterRuntime.getState())?.continuousSyncActive).toBe(true)
            expect(selectTopologyClientSync(harness.slaveRuntime.getState())?.continuousSyncActive).toBe(true)

            expect((await harness.masterRuntime.execute({
                commandName: harness.syncCommandName,
                payload: {
                    entryKey: 'counter',
                    value: 'master-value-2',
                    updatedAt: 200,
                },
            })).status).toBe('completed')

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'master-value-2'
            })

            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'master-value-2',
                    updatedAt: 200,
                },
            })
        } finally {
            harness.disconnect()
        }
    })
})
