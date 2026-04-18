import {describe, expect, it} from 'vitest'
import {createCommand, defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyRuntimeV2Sync} from '../../src'
import {
    createTopologyRuntimeV2StateSyncLiveHarness,
    selectSyncValueState,
    waitFor,
} from '../helpers/liveHarness'

describe('topology-runtime-v2 live state sync master-to-slave', () => {
    it('applies master-to-slave state sync diff through real dual-topology host flow', async () => {
        const syncCommand = defineCommand<{entryKey: string; value: string; updatedAt: number}>({
            moduleName: 'kernel.base.topology-runtime-v2.test.sync.master-to-slave',
            commandName: 'put',
        })

        const harness = await createTopologyRuntimeV2StateSyncLiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.state-sync.master-to-slave',
            syncSliceName: 'kernel.base.topology-runtime-v2.test.sync-state.master-to-slave',
            syncCommandName: syncCommand.commandName,
            syncIntent: 'master-to-slave',
        })

        try {
            await harness.configureTopologyPair()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'master-value',
                updatedAt: 100,
            }))).status).toBe('COMPLETED')

            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'master-value'
            }, 5_000)

            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                counter: {
                    value: 'master-value',
                    updatedAt: 100,
                },
            })
            expect(selectTopologyRuntimeV2Sync(harness.masterRuntime.getState())?.continuousSyncActive).toBe(true)
            expect(selectTopologyRuntimeV2Sync(harness.slaveRuntime.getState())?.continuousSyncActive).toBe(true)

            expect((await harness.masterRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'counter',
                value: 'master-value-2',
                updatedAt: 200,
            }))).status).toBe('COMPLETED')

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.counter?.value === 'master-value-2'
            }, 5_000)

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
            await harness.close()
        }
    })

    it('overrides newer slave local state with authoritative master state', async () => {
        const syncCommand = defineCommand<{entryKey: string; value: string; updatedAt: number}>({
            moduleName: 'kernel.base.topology-runtime-v2.test.sync.master-to-slave.override',
            commandName: 'put',
        })

        const harness = await createTopologyRuntimeV2StateSyncLiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.state-sync.master-to-slave.override',
            syncSliceName: 'kernel.base.topology-runtime-v2.test.sync-state.master-to-slave.override',
            syncCommandName: syncCommand.commandName,
            syncIntent: 'master-to-slave',
        })

        try {
            await harness.configureTopologyPair()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'root-screen',
                value: 'welcome',
                updatedAt: 100,
            }))).status).toBe('COMPLETED')

            expect((await harness.slaveRuntime.dispatchCommand(createCommand(syncCommand, {
                entryKey: 'root-screen',
                value: 'activation-secondary',
                updatedAt: 999,
            }))).status).toBe('COMPLETED')

            await harness.startTopologyConnectionPair()

            await waitFor(() => {
                const slaveSlice = selectSyncValueState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                    harness.syncSliceName,
                )
                return slaveSlice?.['root-screen']?.value === 'welcome'
            }, 5_000)

            expect(selectSyncValueState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
                harness.syncSliceName,
            )).toEqual({
                'root-screen': {
                    value: 'welcome',
                    updatedAt: 100,
                },
            })
        } finally {
            await harness.close()
        }
    })
})
