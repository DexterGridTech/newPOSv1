import {describe, expect, it} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import {
    createTopologyClientRuntimeModule,
    selectTopologyClientContext,
    selectTopologyDisplayMode,
    selectTopologyEnableSlave,
    selectTopologyInstanceMode,
    selectTopologyMasterInfo,
    selectTopologyScopedStateKey,
    selectTopologyStandalone,
    selectTopologyWorkspace,
    topologyClientCommandNames,
} from '../../src'

describe('topology-client-runtime context', () => {
    it('projects topology recovery state into unified runtime root state', async () => {
        const localNodeId = createNodeId()
        const runtime = createKernelRuntime({
            localNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createTopologyClientRuntimeModule()],
        })

        runtime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-a',
                serverAddress: [{address: 'ws://127.0.0.1:7788'}],
                addedAt: 123 as any,
            },
        })

        await runtime.start()

        const state = runtime.getState()
        const context = selectTopologyClientContext(state)

        expect(context).toBeDefined()
        expect(context?.localNodeId).toBe(localNodeId)
        expect(context?.instanceMode).toBe('SLAVE')
        expect(context?.displayMode).toBe('PRIMARY')
        expect(context?.workspace).toBe('BRANCH')
        expect(context?.masterInfo?.deviceId).toBe('master-a')
        expect(selectTopologyInstanceMode(state)).toBe('SLAVE')
        expect(selectTopologyDisplayMode(state)).toBe('PRIMARY')
        expect(selectTopologyWorkspace(state)).toBe('BRANCH')
        expect(selectTopologyStandalone(state)).toBe(false)
        expect(selectTopologyEnableSlave(state)).toBe(false)
        expect(selectTopologyMasterInfo(state)?.deviceId).toBe('master-a')
        expect(selectTopologyScopedStateKey(state, 'kernel.user.state.order')).toBe('kernel.user.state.order.BRANCH')
    })

    it('keeps projected topology context in sync after runtime start', async () => {
        const localNodeId = createNodeId()
        const runtime = createKernelRuntime({
            localNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.sync',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createTopologyClientRuntimeModule()],
        })

        await runtime.start()

        runtime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: true,
            masterInfo: {
                deviceId: 'master-b',
                serverAddress: [{address: 'ws://127.0.0.1:8899'}],
                addedAt: 999 as any,
            },
        })

        const state = runtime.getState()
        const context = selectTopologyClientContext(state)

        expect(context?.instanceMode).toBe('SLAVE')
        expect(context?.displayMode).toBe('PRIMARY')
        expect(context?.workspace).toBe('BRANCH')
        expect(context?.enableSlave).toBe(true)
        expect(context?.masterInfo?.deviceId).toBe('master-b')
        expect(selectTopologyStandalone(state)).toBe(false)
        expect(selectTopologyEnableSlave(state)).toBe(true)
        expect(selectTopologyMasterInfo(state)?.deviceId).toBe('master-b')
    })

    it('updates topology recovery state through public context commands', async () => {
        const localNodeId = createNodeId()
        const runtime = createKernelRuntime({
            localNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.context-commands',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createTopologyClientRuntimeModule()],
        })

        await runtime.start()

        const masterInfo = {
            deviceId: 'master-command',
            serverAddress: [{address: 'ws://127.0.0.1:9911'}],
            addedAt: Date.now() as any,
        }

        expect((await runtime.execute({
            commandName: topologyClientCommandNames.setInstanceMode,
            payload: {instanceMode: 'SLAVE'},
        })).status).toBe('completed')
        expect((await runtime.execute({
            commandName: topologyClientCommandNames.setDisplayMode,
            payload: {displayMode: 'PRIMARY'},
        })).status).toBe('completed')
        expect((await runtime.execute({
            commandName: topologyClientCommandNames.setEnableSlave,
            payload: {enableSlave: true},
        })).status).toBe('completed')
        expect((await runtime.execute({
            commandName: topologyClientCommandNames.setMasterInfo,
            payload: {masterInfo},
        })).status).toBe('completed')

        const refreshResult = await runtime.execute({
            commandName: topologyClientCommandNames.refreshTopologyContext,
            payload: {},
        })

        expect(refreshResult.status).toBe('completed')
        if (refreshResult.status !== 'completed') {
            throw new Error('Expected refreshTopologyContext to complete')
        }
        expect(runtime.getSubsystems().topology.getRecoveryState()).toMatchObject({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: true,
            masterInfo,
        })

        const context = selectTopologyClientContext(runtime.getState())
        expect(context).toMatchObject({
            localNodeId,
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            workspace: 'BRANCH',
            enableSlave: true,
            masterInfo,
        })
        expect(selectTopologyEnableSlave(runtime.getState())).toBe(true)
        expect(selectTopologyMasterInfo(runtime.getState())).toEqual(masterInfo)
        expect(selectTopologyStandalone(runtime.getState())).toBe(false)
        expect(refreshResult.result).toMatchObject({
            context: {
                localNodeId,
                instanceMode: 'SLAVE',
                displayMode: 'PRIMARY',
                workspace: 'BRANCH',
                enableSlave: true,
                masterInfo,
            },
        })

        expect((await runtime.execute({
            commandName: topologyClientCommandNames.clearMasterInfo,
            payload: {},
        })).status).toBe('completed')

        expect(runtime.getSubsystems().topology.getRecoveryState().masterInfo).toBeNull()
        expect(selectTopologyClientContext(runtime.getState())?.masterInfo).toBeNull()
    })
})
