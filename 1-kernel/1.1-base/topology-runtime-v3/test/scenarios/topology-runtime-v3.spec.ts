import {describe, expect, it, vi} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createCommand, createKernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {createMemoryStorage} from '../../../../test-support/storageHarness'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    applyTopologyV3HelloAck,
    createTopologyV3InitialPairLinkState,
    createTopologyRuntimeModuleV3,
    deriveTopologyV3RuntimeContext,
    getTopologyV3DisplayModeEligibility,
    getTopologyV3EnableSlaveEligibility,
    getTopologyV3SwitchToSlaveEligibility,
    getTopologyV3TcpActivationEligibility,
    markTopologyV3PairDisconnected,
    selectTopologyRuntimeV3ConfigState,
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    selectTopologyRuntimeV3DisplayModeEligibility,
    selectTopologyRuntimeV3EnableSlaveEligibility,
    selectTopologyRuntimeV3MasterLocator,
    selectTopologyRuntimeV3Peer,
    selectTopologyRuntimeV3RequestMirror,
    selectTopologyRuntimeV3Standalone,
    selectTopologyRuntimeV3SwitchToSlaveEligibility,
    selectTopologyRuntimeV3Sync,
    selectTopologyRuntimeV3TcpActivationEligibility,
    selectTopologyRuntimeV3Workspace,
    topologyRuntimeV3CommandDefinitions,
} from '../../src'
import type {SocketRuntime} from '@impos2/kernel-base-transport-runtime'

const createSocketRuntimeSpy = () => {
    const listeners = new Map<string, Map<string, Set<(event: unknown) => void>>>()
    const states = new Map<string, 'disconnected' | 'connecting' | 'connected'>()
    const socketRuntime: SocketRuntime = {
        registerProfile() {},
        async connect(profileName: string) {
            states.set(profileName, 'connected')
            listeners.get(profileName)?.get('connected')?.forEach(listener => listener({
                type: 'connected',
                connectionId: 'c1',
                url: 'ws://127.0.0.1/ws',
                addressName: 'test',
                occurredAt: Date.now(),
            }))
            return {
                connectionId: 'c1' as any,
                profile: {} as any,
                url: 'ws://127.0.0.1/ws',
                headers: {},
                selectedAddress: {
                    name: 'test',
                    baseUrl: 'http://127.0.0.1',
                } as any,
            }
        },
        send: vi.fn(),
        disconnect(profileName: string, reason?: string) {
            states.set(profileName, 'disconnected')
            listeners.get(profileName)?.get('disconnected')?.forEach(listener => listener({
                type: 'disconnected',
                connectionId: 'c1',
                reason,
                occurredAt: Date.now(),
            }))
        },
        getConnectionState(profileName: string) {
            return states.get(profileName) ?? 'disconnected'
        },
        on(profileName: string, eventType: any, listener: any) {
            if (!listeners.has(profileName)) {
                listeners.set(profileName, new Map())
            }
            const byType = listeners.get(profileName)!
            if (!byType.has(eventType)) {
                byType.set(eventType, new Set())
            }
            byType.get(eventType)!.add(listener)
        },
        off(profileName: string, eventType: any, listener: any) {
            listeners.get(profileName)?.get(eventType)?.delete(listener)
        },
        replaceServers() {},
        getServerCatalog() {
            return {} as any
        },
    }
    return {
        socketRuntime,
        emit(profileName: string, eventType: string, event: unknown) {
            listeners.get(profileName)?.get(eventType)?.forEach(listener => listener(event))
        },
        sendMock: socketRuntime.send as ReturnType<typeof vi.fn>,
    }
}

type SyncValueState = Record<string, SyncValueEnvelope<string>>
const createSyncSliceModule = (input: {
    sliceName: string
    syncIntent: 'master-to-slave' | 'slave-to-master'
}) => {
    const slice = createSlice({
        name: input.sliceName,
        initialState: {} as SyncValueState,
        reducers: {
            replace: (_state, action: PayloadAction<SyncValueState>) => ({...action.payload}),
            put: (state, action: PayloadAction<{entryKey: string; value: string; updatedAt: number}>) => {
                state[action.payload.entryKey] = {
                    value: action.payload.value,
                    updatedAt: action.payload.updatedAt,
                }
            },
        },
    })
    const descriptor: StateRuntimeSliceDescriptor<SyncValueState> = {
        name: input.sliceName,
        reducer: slice.reducer,
        persistIntent: 'never',
        syncIntent: input.syncIntent,
        sync: {
            kind: 'record',
        },
    }
    return {
        module: {
            moduleName: `${input.sliceName}.module`,
            packageVersion: '1.0.0',
            stateSlices: [descriptor],
        },
        actions: slice.actions,
    }
}

const createTestLogger = (moduleName: string) => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write() {},
        scope: {
            moduleName,
            layer: 'kernel',
        },
    })
}

describe('topology-runtime-v3 context derivation', () => {
    it('derives standalone slave from displayIndex instead of instanceMode fallback', () => {
        const context = deriveTopologyV3RuntimeContext({
            displayIndex: 0,
            displayCount: 1,
            configState: {
                instanceMode: 'SLAVE',
                enableSlave: false,
                masterLocator: {
                    serverAddress: [{address: 'ws://127.0.0.1:18888/ws'}],
                    addedAt: Date.now(),
                },
            },
        })

        expect(context.standalone).toBe(true)
        expect(context.displayMode).toBe('PRIMARY')
        expect(context.workspace).toBe('BRANCH')
    })

    it('throws when display context is missing', () => {
        expect(() => deriveTopologyV3RuntimeContext({
            configState: {},
        })).toThrow(/displayIndex\/displayCount/)
    })

    it('installs context state into runtime-shell-v2 from display context', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.context'),
            }),
            modules: [createTopologyRuntimeModuleV3()],
        })

        await runtime.start()

        const state = runtime.getState()
        expect(selectTopologyRuntimeV3Context(state)).toMatchObject({
            instanceMode: 'SLAVE',
            displayMode: 'SECONDARY',
            workspace: 'MAIN',
            standalone: false,
            enableSlave: false,
        })
        expect(selectTopologyRuntimeV3Standalone(state)).toBe(false)
        expect(selectTopologyRuntimeV3Workspace(state)).toBe('MAIN')
    })

    it('updates config and recomputes context through public commands', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.commands'),
            }),
            modules: [createTopologyRuntimeModuleV3()],
        })

        await runtime.start()

        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'PRIMARY'},
        ))
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setMasterLocator,
            {
                masterLocator: {
                    serverAddress: [{address: 'ws://127.0.0.1:18888/ws'}],
                    addedAt: Date.now(),
                },
            },
        ))

        const state = runtime.getState()
        expect(selectTopologyRuntimeV3ConfigState(state)).toMatchObject({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
        })
        expect(selectTopologyRuntimeV3Context(state)).toMatchObject({
            displayIndex: 0,
            displayCount: 1,
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            workspace: 'BRANCH',
            standalone: true,
        })
        expect(selectTopologyRuntimeV3MasterLocator(state)).toEqual({
            serverAddress: [{address: 'ws://127.0.0.1:18888/ws'}],
            addedAt: expect.any(Number),
        })
    })

    it('computes shared eligibility reasons for activation and topology actions', () => {
        const managedSecondaryContext = {
            displayIndex: 1,
            displayCount: 2,
            instanceMode: 'SLAVE',
            displayMode: 'SECONDARY',
            standalone: false,
        } as const
        const standaloneSlaveContext = {
            displayIndex: 0,
            displayCount: 1,
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            standalone: true,
        } as const
        const masterContext = {
            displayIndex: 0,
            displayCount: 1,
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            standalone: true,
        } as const

        expect(getTopologyV3TcpActivationEligibility({
            context: managedSecondaryContext,
            activationStatus: 'UNACTIVATED',
        })).toEqual({allowed: false, reasonCode: 'managed-secondary'})
        expect(getTopologyV3TcpActivationEligibility({
            context: standaloneSlaveContext,
            activationStatus: 'UNACTIVATED',
        })).toEqual({allowed: false, reasonCode: 'slave-instance'})
        expect(getTopologyV3TcpActivationEligibility({
            context: masterContext,
            activationStatus: 'ACTIVATED',
        })).toEqual({allowed: false, reasonCode: 'already-activated'})
        expect(getTopologyV3TcpActivationEligibility({
            context: masterContext,
            activationStatus: 'UNACTIVATED',
        })).toEqual({allowed: true, reasonCode: 'master-unactivated'})

        expect(getTopologyV3SwitchToSlaveEligibility({
            context: masterContext,
            activationStatus: 'ACTIVATED',
        })).toEqual({allowed: false, reasonCode: 'activated-master-cannot-switch-to-slave'})
        expect(getTopologyV3SwitchToSlaveEligibility({
            context: masterContext,
            activationStatus: 'UNACTIVATED',
        })).toEqual({allowed: true, reasonCode: 'master-unactivated'})
        expect(getTopologyV3EnableSlaveEligibility({
            context: standaloneSlaveContext,
        })).toEqual({allowed: false, reasonCode: 'slave-instance'})
        expect(getTopologyV3DisplayModeEligibility({
            context: managedSecondaryContext,
        })).toEqual({allowed: false, reasonCode: 'managed-secondary'})
        expect(getTopologyV3DisplayModeEligibility({
            context: standaloneSlaveContext,
        })).toEqual({allowed: true, reasonCode: 'standalone-slave-only-display-mode'})
    })

    it('exposes shared eligibility selectors from runtime state', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.eligibility-selectors'),
            }),
            modules: [createTopologyRuntimeModuleV3()],
        })

        await runtime.start()

        expect(selectTopologyRuntimeV3TcpActivationEligibility(runtime.getState(), 'UNACTIVATED')).toEqual({
            allowed: false,
            reasonCode: 'managed-secondary',
        })
        expect(selectTopologyRuntimeV3EnableSlaveEligibility(runtime.getState())).toEqual({
            allowed: false,
            reasonCode: 'managed-secondary',
        })
        expect(selectTopologyRuntimeV3DisplayModeEligibility(runtime.getState())).toEqual({
            allowed: false,
            reasonCode: 'managed-secondary',
        })
        expect(selectTopologyRuntimeV3SwitchToSlaveEligibility(runtime.getState(), 'UNACTIVATED')).toEqual({
            allowed: false,
            reasonCode: 'managed-secondary',
        })
    })

    it('rejects invalid topology context commands through shared runtime guards', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.command-guards'),
                stateStorage: createMemoryStorage().storage,
                secureStateStorage: createMemoryStorage().storage,
            }),
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTopologyRuntimeModuleV3(),
            ],
        })

        await runtime.start()
        runtime.getStore().dispatch(tcpControlV2StateActions.setActivationStatus('ACTIVATED'))

        const switchToSlaveResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        const displayModeResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
        const enableSlaveResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))

        expect(switchToSlaveResult.status).toBe('FAILED')
        expect(switchToSlaveResult.actorResults[0]?.error?.message).toMatch(/activated-master-cannot-switch-to-slave/)
        expect(displayModeResult.status).toBe('FAILED')
        expect(displayModeResult.actorResults[0]?.error?.message).toMatch(/standalone-slave-only-display-mode/)
        expect(enableSlaveResult.status).toBe('COMPLETED')
    })

    it('projects hello ack into peer and sync state without resume artifacts', () => {
        const initial = createTopologyV3InitialPairLinkState()
        const connected = applyTopologyV3HelloAck(initial, {
            type: 'hello-ack',
            helloId: 'hello-1',
            accepted: true,
            sessionId: 'session-1',
            peerRuntime: {
                nodeId: 'peer-node',
                deviceId: 'peer-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
                protocolVersion: '2026.04-v3',
                capabilities: ['state-sync'],
            },
            hostTime: 1_000,
        }, 2_000)

        expect(connected.connectionStatus).toBe('CONNECTED')
        expect(connected.sync).toMatchObject({
            activeSessionId: 'session-1',
            status: 'active',
        })
        expect(connected.peer).toMatchObject({
            peerNodeId: 'peer-node',
            peerDeviceId: 'peer-device',
            connectedAt: 2_000,
        })

        const disconnected = markTopologyV3PairDisconnected(connected, 3_000)
        expect(disconnected.connectionStatus).toBe('DISCONNECTED')
        expect(disconnected.sync.activeSessionId).toBeUndefined()
        expect(disconnected.peer.disconnectedAt).toBe(3_000)
    })

    it('routes connection lifecycle commands through injected orchestrator', async () => {
        const calls: string[] = []
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.connection-commands'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                orchestrator: {
                    async startConnection() {
                        calls.push('start')
                    },
                    stopConnection(reason?: string) {
                        calls.push(`stop:${reason ?? ''}`)
                    },
                    async restartConnection(reason?: string) {
                        calls.push(`restart:${reason ?? ''}`)
                    },
                },
            })],
        })

        await runtime.start()

        const startResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))
        const stopResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
            {},
        ))
        const restartResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.restartTopologyConnection,
            {},
        ))

        expect(startResult.status).toBe('COMPLETED')
        expect(stopResult.status).toBe('COMPLETED')
        expect(restartResult.status).toBe('COMPLETED')
        expect(calls).toEqual([
            'start',
            'stop:command-stop',
            'restart:command-restart',
        ])
    })

    it('creates built-in orchestrator from assembly and sends hello on start', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.assembly-orchestrator'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                assembly: {
                    resolveSocketBinding() {
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'dual-topology.ws.topology-runtime-v3',
                        }
                    },
                    createHelloRuntime() {
                        return {
                            nodeId: 'node-1',
                            deviceId: 'device-1',
                            instanceMode: 'MASTER',
                            displayMode: 'PRIMARY',
                            standalone: true,
                            protocolVersion: '2026.04-v3',
                            capabilities: ['state-sync'],
                        }
                    },
                },
            })],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))

        expect(socketRuntimeSpy.sendMock).toHaveBeenCalledWith(
            'dual-topology.ws.topology-runtime-v3',
            expect.objectContaining({
                type: 'hello',
            }),
        )
        expect(selectTopologyRuntimeV3Connection(runtime.getState())).toMatchObject({
            serverConnectionStatus: 'CONNECTING',
        })
    })

    it('resends hello when socket remains connected but runtime sync session was reset', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.hello-resume'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                assembly: {
                    resolveSocketBinding() {
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'dual-topology.ws.topology-runtime-v3',
                        }
                    },
                    createHelloRuntime() {
                        return {
                            nodeId: 'node-1',
                            deviceId: 'device-1',
                            instanceMode: 'MASTER',
                            displayMode: 'PRIMARY',
                            standalone: true,
                            protocolVersion: '2026.04-v3',
                            capabilities: ['state-sync'],
                        }
                    },
                },
            })],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))
        socketRuntimeSpy.sendMock.mockClear()

        await runtime.resetApplicationState({reason: 'test-reset-with-open-socket'})
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))

        expect(socketRuntimeSpy.sendMock).toHaveBeenCalledWith(
            'dual-topology.ws.topology-runtime-v3',
            expect.objectContaining({
                type: 'hello',
            }),
        )
        expect(selectTopologyRuntimeV3Connection(runtime.getState())).toMatchObject({
            serverConnectionStatus: 'CONNECTING',
        })
        expect(selectTopologyRuntimeV3Sync(runtime.getState())).toMatchObject({
            status: 'connecting',
        })
    })

    it('projects hello-ack from built-in orchestrator into runtime state', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.hello-ack'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                assembly: {
                    resolveSocketBinding() {
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'dual-topology.ws.topology-runtime-v3',
                        }
                    },
                    createHelloRuntime() {
                        return {
                            nodeId: 'master-node',
                            deviceId: 'master-device',
                            instanceMode: 'MASTER',
                            displayMode: 'PRIMARY',
                            standalone: true,
                            protocolVersion: '2026.04-v3',
                            capabilities: ['state-sync'],
                        }
                    },
                },
            })],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))

        socketRuntimeSpy.emit('dual-topology.ws.topology-runtime-v3', 'message', {
            type: 'message',
            connectionId: 'c1',
            message: {
                type: 'hello-ack',
                helloId: 'h1',
                accepted: true,
                sessionId: 's1',
                peerRuntime: {
                    nodeId: 'slave-node',
                    deviceId: 'slave-device',
                    instanceMode: 'SLAVE',
                    displayMode: 'SECONDARY',
                    standalone: false,
                    protocolVersion: '2026.04-v3',
                    capabilities: ['state-sync'],
                },
                hostTime: Date.now(),
            },
            occurredAt: Date.now(),
        })

        expect(selectTopologyRuntimeV3Connection(runtime.getState())).toMatchObject({
            serverConnectionStatus: 'CONNECTED',
            reconnectAttempt: 0,
        })
        expect(runtime.getState()).toBeDefined()
        expect(selectTopologyRuntimeV3Sync(runtime.getState())).toMatchObject({
            activeSessionId: 's1',
            status: 'active',
        })
        expect(selectTopologyRuntimeV3Peer(runtime.getState())).toMatchObject({
            peerNodeId: 'slave-node',
        })
    })

    it('applies incoming state-snapshot to authoritative sync slice', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const syncSlice = createSyncSliceModule({
            sliceName: 'topology.runtime.v3.test.sync.master',
            syncIntent: 'master-to-slave',
        })
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.snapshot-apply'),
            }),
            modules: [
                syncSlice.module as any,
                createTopologyRuntimeModuleV3({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: socketRuntimeSpy.socketRuntime,
                                profileName: 'dual-topology.ws.topology-runtime-v3',
                            }
                        },
                        createHelloRuntime() {
                            return {
                                nodeId: 'slave-node',
                                deviceId: 'slave-device',
                                instanceMode: 'SLAVE',
                                displayMode: 'SECONDARY',
                                standalone: false,
                                protocolVersion: '2026.04-v3',
                                capabilities: ['state-sync'],
                            }
                        },
                    },
                }),
            ],
        })

        await runtime.start()
        socketRuntimeSpy.emit('dual-topology.ws.topology-runtime-v3', 'message', {
            type: 'message',
            connectionId: 'c1',
            message: {
                type: 'state-snapshot',
                sessionId: 's1',
                sourceNodeId: 'master-node',
                entries: [
                    {
                        sliceName: 'topology.runtime.v3.test.sync.master',
                        revision: 1,
                        payload: [{
                            key: 'counter',
                            value: {
                                value: 'master-value',
                                updatedAt: 100,
                            },
                        }],
                    },
                ],
                sentAt: Date.now(),
            },
            occurredAt: Date.now(),
        })

        expect((runtime.getState() as Record<string, any>)['topology.runtime.v3.test.sync.master']).toEqual({
            counter: {
                value: 'master-value',
                updatedAt: 100,
            },
        })
    })

    it('applies incoming request-snapshot into request mirror state', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.request-mirror'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                assembly: {
                    resolveSocketBinding() {
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'dual-topology.ws.topology-runtime-v3',
                        }
                    },
                    createHelloRuntime() {
                        return {
                            nodeId: 'master-node',
                            deviceId: 'master-device',
                            instanceMode: 'MASTER',
                            displayMode: 'PRIMARY',
                            standalone: true,
                            protocolVersion: '2026.04-v3',
                            capabilities: ['state-sync'],
                        }
                    },
                },
            })],
        })

        await runtime.start()
        socketRuntimeSpy.emit('dual-topology.ws.topology-runtime-v3', 'message', {
            type: 'message',
            connectionId: 'c1',
            message: {
                type: 'request-snapshot',
                envelope: {
                    envelopeId: 'e1',
                    sessionId: 's1',
                    requestId: 'r1',
                    ownerNodeId: 'master-node',
                    sourceNodeId: 'slave-node',
                    targetNodeId: 'master-node',
                    snapshot: {
                        requestId: 'r1',
                        ownerNodeId: 'master-node',
                        rootCommandId: 'root1',
                        sessionId: 's1',
                        status: 'completed',
                        startedAt: 1,
                        updatedAt: 2,
                        commands: [],
                        commandResults: [],
                    },
                    sentAt: 3,
                },
            },
            occurredAt: Date.now(),
        })

        expect(selectTopologyRuntimeV3RequestMirror(runtime.getState())).toMatchObject({
            requests: {
                r1: {
                    requestId: 'r1',
                    status: 'completed',
                },
            },
        })
    })
})
