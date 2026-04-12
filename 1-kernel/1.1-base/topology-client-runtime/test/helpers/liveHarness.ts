import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createTopologyClientRuntimeModule,
    selectTopologyClientConnection,
    topologyClientCommandNames,
} from '../../src'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {
    createHello,
    createRuntimeInfo,
    topologyClientTestServers,
    waitFor,
} from './topologyClientHarness'

export type SyncValueState = Record<string, {value: string; updatedAt: number}>

type KernelRuntimeInstance = ReturnType<typeof createKernelRuntime>

export const selectSyncValueState = (
    state: Record<string, unknown>,
    sliceName: string,
) => state[sliceName] as SyncValueState | undefined

const createSyncValueModule = (input: {
    sliceName: string
    commandName: string
    syncIntent?: 'master-to-slave' | 'slave-to-master'
}): KernelRuntimeModule => {
    const slice = createSlice({
        name: input.sliceName,
        initialState: {} as SyncValueState,
        reducers: {
            putEntry(state, action: PayloadAction<{entryKey: string; value: string; updatedAt: number}>) {
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
        syncIntent: input.syncIntent ?? 'master-to-slave',
        sync: {
            kind: 'record',
            getEntries: state => {
                return Object.fromEntries(
                    Object.entries(state).map(([entryKey, entryValue]) => [
                        entryKey,
                        {
                            value: entryValue,
                            updatedAt: entryValue.updatedAt,
                        },
                    ]),
                )
            },
            applyEntries: (_state, entries) => {
                const next: SyncValueState = {}
                Object.entries(entries).forEach(([entryKey, entryValue]) => {
                    if (!entryValue || entryValue.tombstone === true || !entryValue.value || typeof entryValue.value !== 'object') {
                        return
                    }
                    const value = entryValue.value as {value?: string; updatedAt?: number}
                    if (typeof value.value !== 'string') {
                        return
                    }
                    next[entryKey] = {
                        value: value.value,
                        updatedAt: value.updatedAt ?? entryValue.updatedAt,
                    }
                })
                return next
            },
        },
    }

    return {
        moduleName: `${input.sliceName}.module`,
        packageVersion: '0.0.1',
        stateSlices: [descriptor],
        install(context) {
            context.registerHandler(input.commandName, async handlerContext => {
                const payload = handlerContext.command.payload as {
                    entryKey: string
                    value: string
                    updatedAt: number
                }
                context.dispatchAction(slice.actions.putEntry(payload))
            })
        },
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

export const createTopologyHostLiveHarness = async (input: {
    profileName: string
}) => {
    const server = createDualTopologyHostServer({
        config: {
            port: 0,
            heartbeatIntervalMs: 50,
            heartbeatTimeoutMs: 5_000,
        },
    })
    topologyClientTestServers.push(server)
    await server.start()

    const addressInfo = server.getAddressInfo()
    const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
    const masterNodeId = createNodeId()
    const slaveNodeId = createNodeId()

    const ticket = await fetchJson<{
        success: boolean
        token: string
    }>(`${addressInfo.httpBaseUrl}/tickets`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            masterNodeId,
        }),
    })

    const masterSocketRuntime = createSocketRuntime({
        logger: createTestLogger(`${input.profileName}.master-socket`),
        transport: createNodeWsTransport(),
        servers: [
            {
                serverName: 'dual-topology-host',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: serverBaseUrl,
                    },
                ],
            },
        ],
    })

    const slaveSocketRuntime = createSocketRuntime({
        logger: createTestLogger(`${input.profileName}.slave-socket`),
        transport: createNodeWsTransport(),
        servers: [
            {
                serverName: 'dual-topology-host',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: serverBaseUrl,
                    },
                ],
            },
        ],
    })

    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: input.profileName,
        serverName: 'dual-topology-host',
        pathTemplate: '/mockMasterServer/ws',
        handshake: {
            headers: typed<Record<string, string>>(`${input.profileName}.headers`),
        },
        messages: {
            incoming: typed(`${input.profileName}.incoming`),
            outgoing: typed(`${input.profileName}.outgoing`),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: 0,
        },
    })

    const createAssembly = (runtime: {
        nodeId: string
        deviceId: string
        role: 'master' | 'slave'
        socketRuntime: ReturnType<typeof createSocketRuntime>
    }) => {
        return {
            resolveSocketBinding() {
                return {
                    socketRuntime: runtime.socketRuntime,
                    profileName: input.profileName,
                    profile,
                }
            },
            createHello() {
                return createHello(ticket.token, createRuntimeInfo({
                    nodeId: runtime.nodeId,
                    deviceId: runtime.deviceId,
                    role: runtime.role,
                }))
            },
        }
    }

    const disconnect = () => {
        masterSocketRuntime.disconnect(input.profileName, 'test-complete')
        slaveSocketRuntime.disconnect(input.profileName, 'test-complete')
    }

    return {
        addressInfo,
        masterNodeId,
        slaveNodeId,
        profile,
        masterSocketRuntime,
        slaveSocketRuntime,
        createMasterAssembly() {
            return createAssembly({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
                socketRuntime: masterSocketRuntime,
            })
        },
        createSlaveAssembly() {
            return createAssembly({
                nodeId: slaveNodeId,
                deviceId: 'slave-device',
                role: 'slave',
                socketRuntime: slaveSocketRuntime,
            })
        },
        async connectMasterHello() {
            masterSocketRuntime.registerProfile(profile)
            await masterSocketRuntime.connect(input.profileName)
            masterSocketRuntime.send(input.profileName, {
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })
        },
        disconnect,
    }
}

export const configureTopologyPair = async (input: {
    masterRuntime: KernelRuntimeInstance
    slaveRuntime: KernelRuntimeInstance
    masterWsUrl: string
}) => {
    expectCompleted(await input.masterRuntime.execute({
        commandName: topologyClientCommandNames.setEnableSlave,
        payload: {enableSlave: true},
    }))
    expectCompleted(await input.slaveRuntime.execute({
        commandName: topologyClientCommandNames.setInstanceMode,
        payload: {instanceMode: 'SLAVE'},
    }))
    expectCompleted(await input.slaveRuntime.execute({
        commandName: topologyClientCommandNames.setDisplayMode,
        payload: {displayMode: 'PRIMARY'},
    }))
    expectCompleted(await input.slaveRuntime.execute({
        commandName: topologyClientCommandNames.setMasterInfo,
        payload: {
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: input.masterWsUrl}],
                addedAt: Date.now() as any,
            },
        },
    }))
}

export const waitForTopologyPairConnected = async (input: {
    masterRuntime: KernelRuntimeInstance
    slaveRuntime: KernelRuntimeInstance
}) => {
    await waitFor(() => {
        return selectTopologyClientConnection(input.masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
            && selectTopologyClientConnection(input.slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
    })
}

export const startTopologyConnectionPair = async (input: {
    masterRuntime: KernelRuntimeInstance
    slaveRuntime: KernelRuntimeInstance
}) => {
    expectCompleted(await input.masterRuntime.execute({
        commandName: topologyClientCommandNames.startTopologyConnection,
        payload: {},
    }))
    expectCompleted(await input.slaveRuntime.execute({
        commandName: topologyClientCommandNames.startTopologyConnection,
        payload: {},
    }))
    await waitForTopologyPairConnected(input)
}

export const createTopologyStateSyncLiveHarness = async (input: {
    profileName: string
    syncSliceName: string
    syncCommandName: string
    syncIntent?: 'master-to-slave' | 'slave-to-master'
}) => {
    const hostHarness = await createTopologyHostLiveHarness({
        profileName: input.profileName,
    })

    const masterRuntime = createKernelRuntime({
        localNodeId: hostHarness.masterNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createTestLogger(`${input.profileName}.master-runtime`),
        }),
        modules: [
            createSyncValueModule({
                sliceName: input.syncSliceName,
                commandName: input.syncCommandName,
                syncIntent: input.syncIntent,
            }),
            createTopologyClientRuntimeModule({
                assembly: hostHarness.createMasterAssembly(),
            }),
        ],
    })

    const slaveRuntime = createKernelRuntime({
        localNodeId: hostHarness.slaveNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createTestLogger(`${input.profileName}.slave-runtime`),
        }),
        modules: [
            createSyncValueModule({
                sliceName: input.syncSliceName,
                commandName: input.syncCommandName,
                syncIntent: input.syncIntent,
            }),
            createTopologyClientRuntimeModule({
                assembly: hostHarness.createSlaveAssembly(),
            }),
        ],
    })

    await masterRuntime.start()
    await slaveRuntime.start()

    return {
        addressInfo: hostHarness.addressInfo,
        masterNodeId: hostHarness.masterNodeId,
        slaveNodeId: hostHarness.slaveNodeId,
        masterRuntime,
        slaveRuntime,
        syncSliceName: input.syncSliceName,
        syncCommandName: input.syncCommandName,
        async configureTopologyPair() {
            await configureTopologyPair({
                masterRuntime,
                slaveRuntime,
                masterWsUrl: hostHarness.addressInfo.wsUrl,
            })
        },
        async waitForConnected() {
            await waitForTopologyPairConnected({
                masterRuntime,
                slaveRuntime,
            })
        },
        async startTopologyConnectionPair() {
            await startTopologyConnectionPair({
                masterRuntime,
                slaveRuntime,
            })
        },
        disconnect: hostHarness.disconnect,
    }
}

const expectCompleted = (result: {status: string}) => {
    if (result.status !== 'completed') {
        throw new Error(`Expected command completed, received ${result.status}`)
    }
}
