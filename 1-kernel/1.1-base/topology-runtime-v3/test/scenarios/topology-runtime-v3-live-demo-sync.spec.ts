import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV3DemoMasterState,
    selectTopologyRuntimeV3DemoSlaveState,
    topologyRuntimeV3CommandDefinitions,
} from '../../src'
import {createTopologyRuntimeV3LiveHarness, waitFor} from '../helpers/runtimeLiveHarness'

describe('topology-runtime-v3 live demo sync', () => {
    it('syncs demo master state to slave in non-activated and activated phases', async () => {
        const harness = await createTopologyRuntimeV3LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v3.demo.master',
        })

        try {
            const masterRuntime = harness.createMasterRuntime()
            const slaveRuntime = harness.createSlaveRuntime()

            await masterRuntime.start()
            await slaveRuntime.start()
            await harness.configureDefaultPair(masterRuntime, slaveRuntime)

            expect((await masterRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.upsertDemoMasterEntry,
                {
                    entryKey: 'activation-flow',
                    label: 'pending-sync',
                    phase: 'UNACTIVATED',
                    note: 'before activation',
                    updatedAt: 100,
                },
            ))).status).toBe('COMPLETED')

            await harness.startTopologyConnectionPair(masterRuntime, slaveRuntime)

            await waitFor(() => {
                return selectTopologyRuntimeV3DemoMasterState(slaveRuntime.getState())
                    ?.['activation-flow']?.value?.label === 'pending-sync'
            }, 5_000)

            expect(selectTopologyRuntimeV3DemoMasterState(slaveRuntime.getState()))
                .toMatchObject({
                    'activation-flow': {
                        value: {
                            label: 'pending-sync',
                            phase: 'UNACTIVATED',
                            note: 'before activation',
                            updatedBy: 'MASTER',
                        },
                        updatedAt: 100,
                    },
                })

            expect((await masterRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.upsertDemoMasterEntry,
                {
                    entryKey: 'activation-flow',
                    label: 'activated-sync',
                    phase: 'ACTIVATED',
                    note: 'after activation',
                    updatedAt: 200,
                },
            ))).status).toBe('COMPLETED')

            await waitFor(() => {
                return selectTopologyRuntimeV3DemoMasterState(slaveRuntime.getState())
                    ?.['activation-flow']?.value?.label === 'activated-sync'
            }, 5_000)

            expect(selectTopologyRuntimeV3DemoMasterState(slaveRuntime.getState()))
                .toMatchObject({
                    'activation-flow': {
                        value: {
                            label: 'activated-sync',
                            phase: 'ACTIVATED',
                            note: 'after activation',
                            updatedBy: 'MASTER',
                        },
                        updatedAt: 200,
                    },
                })

            expect((await masterRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.removeDemoMasterEntry,
                {
                    entryKey: 'activation-flow',
                },
            ))).status).toBe('COMPLETED')

            await waitFor(() => {
                return !selectTopologyRuntimeV3DemoMasterState(slaveRuntime.getState())
                    ?.['activation-flow']
            }, 5_000)

            await Promise.allSettled([
                masterRuntime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                    {},
                )),
                slaveRuntime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                    {},
                )),
            ])
        } finally {
            await harness.close()
        }
    }, 15_000)

    it('syncs demo slave state back to master through the same topology session', async () => {
        const harness = await createTopologyRuntimeV3LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v3.demo.slave',
        })

        try {
            const masterRuntime = harness.createMasterRuntime()
            const slaveRuntime = harness.createSlaveRuntime()

            await masterRuntime.start()
            await slaveRuntime.start()
            await harness.configureDefaultPair(masterRuntime, slaveRuntime)
            await harness.startTopologyConnectionPair(masterRuntime, slaveRuntime)

            expect((await slaveRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.upsertDemoSlaveEntry,
                {
                    entryKey: 'secondary-observation',
                    label: 'secondary-ready',
                    phase: 'DEBUG',
                    note: 'secondary observed dialog',
                    updatedAt: 300,
                },
            ))).status).toBe('COMPLETED')

            await waitFor(() => {
                return selectTopologyRuntimeV3DemoSlaveState(masterRuntime.getState())
                    ?.['secondary-observation']?.value?.label === 'secondary-ready'
            }, 5_000)

            expect(selectTopologyRuntimeV3DemoSlaveState(masterRuntime.getState()))
                .toMatchObject({
                    'secondary-observation': {
                        value: {
                            label: 'secondary-ready',
                            phase: 'DEBUG',
                            note: 'secondary observed dialog',
                            updatedBy: 'SLAVE',
                        },
                        updatedAt: 300,
                    },
                })

            expect((await slaveRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.resetDemoSlaveState,
                {},
            ))).status).toBe('COMPLETED')

            await waitFor(() => {
                const state = selectTopologyRuntimeV3DemoSlaveState(masterRuntime.getState())
                return !state || Object.keys(state).length === 0
            }, 5_000)

            await Promise.allSettled([
                masterRuntime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                    {},
                )),
                slaveRuntime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                    {},
                )),
            ])
        } finally {
            await harness.close()
        }
    }, 15_000)
})
