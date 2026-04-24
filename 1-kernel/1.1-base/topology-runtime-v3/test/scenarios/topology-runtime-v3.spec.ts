import {describe, expect, it, vi} from 'vitest'
import {createNodeId} from '@next/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    createModuleActorFactory,
    defineCommand,
    defineKernelRuntimeModuleV2,
    onCommand,
} from '@next/kernel-base-runtime-shell-v2'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
import {createMemoryStorage} from '../../../../test-support/storageHarness'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@next/kernel-base-tcp-control-runtime-v2'
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
    selectTopologyRuntimeV3Host,
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
import type {SocketRuntime} from '@next/kernel-base-transport-runtime'

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

const createPowerDisplaySwitchProbeModule = (events: Array<{
    displayMode: 'PRIMARY' | 'SECONDARY'
    reason: 'power-status-change'
    powerConnected: boolean
}>) => {
    const defineActor = createModuleActorFactory('kernel.base.topology-runtime-v3.test.power-probe')
    return defineKernelRuntimeModuleV2({
        moduleName: 'kernel.base.topology-runtime-v3.test.power-probe',
        packageVersion: '0.0.1',
        actorDefinitions: [
            defineActor('PowerDisplaySwitchProbeActor', [
                onCommand(topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation, context => {
                    events.push(context.command.payload)
                    return {
                        captured: true,
                    }
                }),
            ]),
        ],
    })
}

const peerProbeCommand = defineCommand<{value: number}>({
    moduleName: 'kernel.base.topology-runtime-v3.test.peer-probe',
    commandName: 'run',
})

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

    it('owns topology host lifecycle in lower layer instead of assembly subscribers', async () => {
        const topologyHost = {
            start: vi.fn(async () => ({
                localWsUrl: 'ws://127.0.0.1:18888/mockMasterServer/ws',
                localHttpBaseUrl: 'http://127.0.0.1:18888/mockMasterServer',
            })),
            stop: vi.fn(async () => undefined),
            getStatus: vi.fn(async () => ({state: 'RUNNING'})),
            getDiagnosticsSnapshot: vi.fn(async () => null),
        }
        const orchestrator = {
            startConnection: vi.fn(async () => undefined),
            stopConnection: vi.fn(),
            restartConnection: vi.fn(async () => undefined),
        }

        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.host-lifecycle'),
                topologyHost,
            }),
            modules: [createTopologyRuntimeModuleV3({orchestrator})],
        })

        await runtime.start()
        expect(topologyHost.start).not.toHaveBeenCalled()

        const enableSlaveResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))
        expect(enableSlaveResult.status).toBe('COMPLETED')
        expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
            desiredRunning: true,
        })

        await vi.waitFor(() => {
            expect(topologyHost.start).toHaveBeenCalledTimes(1)
            expect(orchestrator.startConnection).toHaveBeenCalledTimes(1)
            expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
                desiredRunning: true,
                actualRunning: true,
            })
        })
        expect(selectTopologyRuntimeV3MasterLocator(runtime.getState())).toMatchObject({
            masterNodeId: String(runtime.localNodeId),
            httpBaseUrl: 'http://127.0.0.1:18888/mockMasterServer',
            serverAddress: [{address: 'ws://127.0.0.1:18888/mockMasterServer/ws'}],
        })

        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await vi.waitFor(() => {
            expect(topologyHost.stop).toHaveBeenCalledTimes(1)
            expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
                desiredRunning: false,
                actualRunning: false,
            })
        })
    })

    it('auto-starts standalone slave topology recovery inside topology runtime', async () => {
        const orchestrator = {
            startConnection: vi.fn(async () => undefined),
            stopConnection: vi.fn(),
            restartConnection: vi.fn(async () => undefined),
        }
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.slave-autostart'),
            }),
            modules: [createTopologyRuntimeModuleV3({orchestrator})],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setMasterLocator,
            {
                masterLocator: {
                    masterNodeId: 'master-node-001',
                    masterDeviceId: 'master-device-001',
                    httpBaseUrl: 'http://127.0.0.1:18889/mockMasterServer',
                    serverAddress: [{address: 'ws://127.0.0.1:18889/mockMasterServer/ws'}],
                    addedAt: Date.now(),
                },
            },
        ))

        await vi.waitFor(() => {
            expect(orchestrator.startConnection).toHaveBeenCalledTimes(1)
            expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
                lastAutoStartKey: expect.any(String),
            })
        })

        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.syncTopologyHostLifecycle,
            {},
        ))
        expect(orchestrator.startConnection).toHaveBeenCalledTimes(1)
    })

    it('does not stop topology host when tcp control clears activation-bound state', async () => {
        const topologyHost = {
            start: vi.fn(async () => ({
                localWsUrl: 'ws://127.0.0.1:18888/mockMasterServer/ws',
                localHttpBaseUrl: 'http://127.0.0.1:18888/mockMasterServer',
            })),
            stop: vi.fn(async () => undefined),
            getStatus: vi.fn(async () => ({state: 'RUNNING'})),
            getDiagnosticsSnapshot: vi.fn(async () => null),
        }
        const orchestrator = {
            startConnection: vi.fn(async () => undefined),
            stopConnection: vi.fn(),
            restartConnection: vi.fn(async () => undefined),
        }
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.host-lifecycle-reset'),
                topologyHost,
                stateStorage: createMemoryStorage().storage,
                secureStateStorage: createMemoryStorage().storage,
            }),
            modules: [
                createTopologyRuntimeModuleV3({orchestrator}),
                createTcpControlRuntimeModuleV2(),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))

        await vi.waitFor(() => {
            expect(topologyHost.start).toHaveBeenCalledTimes(1)
            expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
                desiredRunning: true,
                actualRunning: true,
            })
        })

        expect((await runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.resetTcpControl,
            {},
        ))).status).toBe('COMPLETED')

        expect(selectTopologyRuntimeV3ConfigState(runtime.getState())).toMatchObject({
            enableSlave: true,
        })
        expect(selectTopologyRuntimeV3Host(runtime.getState())).toMatchObject({
            desiredRunning: true,
            actualRunning: true,
        })
        expect(topologyHost.stop).not.toHaveBeenCalled()
    })

    it('seeds initial power status without requesting a display switch, then requests switch for standalone slave changes', async () => {
        let powerListener: ((event: Record<string, unknown>) => void) | undefined
        const powerEvents: Array<{
            displayMode: 'PRIMARY' | 'SECONDARY'
            reason: 'power-status-change'
            powerConnected: boolean
        }> = []

        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.power-seed'),
                device: {
                    async getDeviceId() {
                        return 'device-001'
                    },
                    async getPlatform() {
                        return 'android'
                    },
                    addPowerStatusChangeListener(listener) {
                        powerListener = listener
                        return () => undefined
                    },
                },
            }),
            modules: [
                createTopologyRuntimeModuleV3(),
                createPowerDisplaySwitchProbeModule(powerEvents),
            ],
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

        expect(powerListener).toBeTypeOf('function')

        await powerListener?.({powerConnected: false})
        expect(powerEvents).toEqual([])

        await powerListener?.({powerConnected: true})
        expect(powerEvents).toEqual([{
            displayMode: 'SECONDARY',
            powerConnected: true,
            reason: 'power-status-change',
        }])
    })

    it('ignores power-triggered display switching for managed secondary and masters', async () => {
        const createRuntimeForContext = async (input: {
            displayIndex: number
            displayCount: number
            instanceMode?: 'MASTER' | 'SLAVE'
            displayMode?: 'PRIMARY' | 'SECONDARY'
        }) => {
            let powerListener: ((event: Record<string, unknown>) => void) | undefined
            const powerEvents: Array<{
                displayMode: 'PRIMARY' | 'SECONDARY'
                reason: 'power-status-change'
                powerConnected: boolean
            }> = []

            const runtime = createKernelRuntimeV2({
                localNodeId: createNodeId(),
                displayContext: {
                    displayIndex: input.displayIndex,
                    displayCount: input.displayCount,
                },
                platformPorts: createPlatformPorts({
                    environmentMode: 'DEV',
                    logger: createTestLogger('kernel.base.topology-runtime-v3.test.power-guards'),
                    device: {
                        async getDeviceId() {
                            return 'device-guard'
                        },
                        async getPlatform() {
                            return 'android'
                        },
                        addPowerStatusChangeListener(listener) {
                            powerListener = listener
                            return () => undefined
                        },
                    },
                }),
                modules: [
                    createTopologyRuntimeModuleV3(),
                    createPowerDisplaySwitchProbeModule(powerEvents),
                ],
            })

            await runtime.start()
            if (input.instanceMode) {
                await runtime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.setInstanceMode,
                    {instanceMode: input.instanceMode},
                ))
            }
            if (input.displayMode) {
                await runtime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.setDisplayMode,
                    {displayMode: input.displayMode},
                ))
            }
            return {powerListener, powerEvents}
        }

        const managedSecondary = await createRuntimeForContext({
            displayIndex: 1,
            displayCount: 2,
        })
        await managedSecondary.powerListener?.({powerConnected: false})
        await managedSecondary.powerListener?.({powerConnected: true})
        expect(managedSecondary.powerEvents).toEqual([])

        const standaloneMaster = await createRuntimeForContext({
            displayIndex: 0,
            displayCount: 1,
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
        })
        await standaloneMaster.powerListener?.({powerConnected: false})
        await standaloneMaster.powerListener?.({powerConnected: true})
        expect(standaloneMaster.powerEvents).toEqual([])
    })

    it('confirms power display switch through the public command instead of direct mutation from assembly', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.power-confirm'),
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

        const confirmResult = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.confirmPowerDisplayModeSwitch,
            {displayMode: 'SECONDARY'},
        ))

        expect(confirmResult.status).toBe('COMPLETED')
        expect(selectTopologyRuntimeV3Context(runtime.getState())).toMatchObject({
            standalone: true,
            instanceMode: 'SLAVE',
            displayMode: 'SECONDARY',
        })
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

    it('refreshes socket binding on start so late master locator updates can connect', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        let resolveCount = 0
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.dynamic-binding-refresh'),
            }),
            modules: [createTopologyRuntimeModuleV3({
                assembly: {
                    resolveSocketBinding() {
                        resolveCount += 1
                        if (resolveCount === 1) {
                            return {
                                socketRuntime: socketRuntimeSpy.socketRuntime,
                                profileName: 'dual-topology.ws.topology-runtime-v3',
                                profile: {
                                    protocol: 'ws',
                                    name: 'dual-topology.ws.topology-runtime-v3',
                                    serverName: 'dual-topology-host-v3',
                                    pathTemplate: '/missing',
                                    handshake: {},
                                    messages: {},
                                    codec: {
                                        serialize: JSON.stringify,
                                        deserialize: JSON.parse,
                                    },
                                    meta: {},
                                } as any,
                            }
                        }
                        socketRuntimeSpy.socketRuntime.replaceServers([{
                            serverName: 'dual-topology-host-v3',
                            addresses: [{addressName: 'dynamic', baseUrl: 'http://127.0.0.1:18889/mockMasterServer'}],
                        }])
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'dual-topology.ws.topology-runtime-v3',
                            profile: {
                                protocol: 'ws',
                                name: 'dual-topology.ws.topology-runtime-v3',
                                serverName: 'dual-topology-host-v3',
                                pathTemplate: '/ws',
                                handshake: {},
                                messages: {},
                                codec: {
                                    serialize: JSON.stringify,
                                    deserialize: JSON.parse,
                                },
                                meta: {},
                            } as any,
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

        expect(resolveCount).toBeGreaterThanOrEqual(2)
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

    it('clears stale authoritative sync state when incoming snapshot entry is empty', async () => {
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
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.snapshot-clear'),
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
        runtime.getStore().dispatch(syncSlice.actions.put({
            entryKey: 'counter',
            value: 'stale-secondary-value',
            updatedAt: 90,
        }))

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
                        revision: 2,
                        payload: [],
                    },
                ],
                sentAt: Date.now(),
            },
            occurredAt: Date.now(),
        })

        expect((runtime.getState() as Record<string, any>)['topology.runtime.v3.test.sync.master']).toEqual({})
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

    it('dispatches peer commands over the topology socket and resolves command events', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 0,
                displayCount: 2,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.peer-command-outbound'),
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
                            standalone: false,
                            protocolVersion: '2026.04-v3',
                            capabilities: ['state-sync', 'command-relay'],
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
                    capabilities: ['state-sync', 'command-relay'],
                },
                hostTime: Date.now(),
            },
            occurredAt: Date.now(),
        })
        socketRuntimeSpy.sendMock.mockClear()

        const peerDispatchPromise = runtime.dispatchCommand(
            createCommand(peerProbeCommand, {value: 7}),
            {target: 'peer'},
        )

        await vi.waitFor(() => {
            expect(socketRuntimeSpy.sendMock).toHaveBeenCalledWith(
                'dual-topology.ws.topology-runtime-v3',
                expect.objectContaining({
                    type: 'command-dispatch',
                }),
            )
        })

        const dispatchMessage = socketRuntimeSpy.sendMock.mock.calls
            .map((call: unknown[]) => call[1])
            .find((message: any) => message?.type === 'command-dispatch') as any
        expect(dispatchMessage.envelope).toMatchObject({
            sessionId: 's1',
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: runtime.localNodeId,
            targetNodeId: 'slave-node',
            commandName: peerProbeCommand.commandName,
            payload: {value: 7},
        })

        socketRuntimeSpy.emit('dual-topology.ws.topology-runtime-v3', 'message', {
            type: 'message',
            connectionId: 'c1',
            message: {
                type: 'command-event',
                envelope: {
                    envelopeId: 'e-command-completed',
                    sessionId: 's1',
                    requestId: dispatchMessage.envelope.requestId,
                    commandId: dispatchMessage.envelope.commandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: 'slave-node',
                    eventType: 'completed',
                    result: {
                        requestId: dispatchMessage.envelope.requestId,
                        commandId: dispatchMessage.envelope.commandId,
                        commandName: peerProbeCommand.commandName,
                        target: 'local',
                        status: 'COMPLETED',
                        startedAt: 1,
                        completedAt: 2,
                        actorResults: [{
                            actorKey: 'kernel.base.topology-runtime-v3.test.peer-probe.RemoteActor',
                            status: 'COMPLETED',
                            result: {value: 7},
                        }],
                    },
                    occurredAt: 2,
                },
            },
            occurredAt: Date.now(),
        })

        const peerDispatchResult = await peerDispatchPromise

        expect(peerDispatchResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(dispatchMessage.envelope.requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                {
                    commandId: dispatchMessage.envelope.commandId,
                    status: 'COMPLETED',
                },
            ],
        })
    })

    it('executes incoming command-dispatch locally and returns command-event results', async () => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const defineActor = createModuleActorFactory('kernel.base.topology-runtime-v3.test.peer-probe')
        const peerProbeModule = defineKernelRuntimeModuleV2({
            moduleName: 'kernel.base.topology-runtime-v3.test.peer-probe',
            packageVersion: '0.0.1',
            commandDefinitions: [peerProbeCommand],
            actorDefinitions: [
                defineActor('RemoteActor', [
                    onCommand(peerProbeCommand, context => ({
                        value: context.command.payload.value,
                        nodeId: String(context.localNodeId),
                    })),
                ]),
            ],
        })
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v3.test.peer-command-inbound'),
            }),
            modules: [
                peerProbeModule,
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
                                capabilities: ['state-sync', 'command-relay'],
                            }
                        },
                    },
                }),
            ],
        })

        await runtime.start()
        socketRuntimeSpy.sendMock.mockClear()
        socketRuntimeSpy.emit('dual-topology.ws.topology-runtime-v3', 'message', {
            type: 'message',
            connectionId: 'c1',
            message: {
                type: 'command-dispatch',
                envelope: {
                    envelopeId: 'e-command-dispatch',
                    sessionId: 's1',
                    requestId: 'r-peer-command',
                    commandId: 'c-peer-command',
                    ownerNodeId: 'master-node',
                    sourceNodeId: 'master-node',
                    targetNodeId: runtime.localNodeId,
                    commandName: peerProbeCommand.commandName,
                    payload: {value: 9},
                    context: {},
                    sentAt: 1,
                },
            },
            occurredAt: Date.now(),
        })

        await vi.waitFor(() => {
            const commandEvents = socketRuntimeSpy.sendMock.mock.calls
                .map((call: unknown[]) => call[1])
                .filter((message: any) => message?.type === 'command-event')
            expect(commandEvents.map((message: any) => message.envelope.eventType)).toEqual([
                'accepted',
                'started',
                'completed',
            ])
            expect(commandEvents.at(-1)?.envelope.result).toMatchObject({
                commandName: peerProbeCommand.commandName,
                status: 'COMPLETED',
                actorResults: [
                    expect.objectContaining({
                        actorKey: 'kernel.base.topology-runtime-v3.test.peer-probe.RemoteActor',
                        status: 'COMPLETED',
                    }),
                ],
            })
        })
    })
})
