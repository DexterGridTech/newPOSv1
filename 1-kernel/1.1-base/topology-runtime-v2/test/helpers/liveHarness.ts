import {createNodeId, nowTimestampMs, type ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import type {HostFaultRule} from '@impos2/kernel-base-host-runtime'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    runtimeShellV2CommandDefinitions,
    type KernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createTopologyRuntimeModuleV2,
    selectTopologyRuntimeV2Connection,
    topologyRuntimeV2CommandDefinitions,
    topologyRuntimeV2ParameterDefinitions,
    type CreateTopologyRuntimeModuleV2Input,
} from '../../src'
import {
    createDualTopologyHost,
    createDualTopologyHostServer,
} from '../../../../../0-mock-server/dual-topology-host/src'
import {fetchJson} from '../../../../../0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '../../../transport-runtime/test/helpers/nodeWsTransport'

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

export const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
}) => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'node',
        product: 'new-pos-test',
        assemblyAppId: 'assembly.test',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: '1.0.0',
        protocolVersion: '2026.04',
        capabilities: ['projection-mirror', 'dispatch-relay'],
    }
}

export const createHello = (ticketToken: string, runtime: ReturnType<typeof createRuntimeInfo>) => {
    return {
        helloId: `hello_${runtime.nodeId}`,
        ticketToken,
        runtime,
        sentAt: Date.now() as any,
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

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        async getItem(key: string) {
            return saved.get(key) ?? null
        },
        async setItem(key: string, value: string) {
            saved.set(key, value)
        },
        async removeItem(key: string) {
            saved.delete(key)
        },
        async multiGet(keys: readonly string[]) {
            return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
        },
        async multiSet(entries: Readonly<Record<string, string>>) {
            Object.entries(entries).forEach(([key, value]) => {
                saved.set(key, value)
            })
        },
        async multiRemove(keys: readonly string[]) {
            keys.forEach(key => {
                saved.delete(key)
            })
        },
        async getAllKeys() {
            return [...saved.keys()]
        },
        async clear() {
            saved.clear()
        },
    }
}

export const createTopologyRuntimeV2LiveHarness = async (input: {
    profileName: string
    reconnectIntervalMs?: number
    reconnectAttempts?: number
}) => {
    const silentHost = createDualTopologyHost({
        logger: createTestLogger(`${input.profileName}.dual-topology-host`),
    })
    const server = createDualTopologyHostServer({
        host: silentHost,
        config: {
            port: 0,
            heartbeatIntervalMs: 50,
            heartbeatTimeoutMs: 5_000,
        },
    })
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

    const createAssembly = (runtimeInput: {
        nodeId: string
        role: 'master' | 'slave'
        deviceId: string
    }): CreateTopologyRuntimeModuleV2Input['assembly'] => {
        return {
            resolveSocketBinding() {
                return {
                    socketRuntime: runtimeInput.role === 'master' ? masterSocketRuntime : slaveSocketRuntime,
                    profileName: input.profileName,
                    profile,
                }
            },
            createHello() {
                return createHello(ticket.token, createRuntimeInfo({
                    nodeId: runtimeInput.nodeId,
                    deviceId: runtimeInput.deviceId,
                    role: runtimeInput.role,
                }))
            },
        }
    }

    const createRuntime = (runtimeInput: {
        nodeId: string
        role: 'master' | 'slave'
        deviceId: string
    }, extraModules: readonly KernelRuntimeModuleV2[] = []) => {
        return createKernelRuntimeV2({
            localNodeId: runtimeInput.nodeId as any,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger(`${input.profileName}.${runtimeInput.role}-runtime`),
                stateStorage: createMemoryStorage(),
                secureStateStorage: createMemoryStorage(),
            }),
            modules: [
                createTopologyRuntimeModuleV2({
                    assembly: createAssembly(runtimeInput),
                    socket: input.reconnectAttempts == null
                        ? undefined
                        : {
                            reconnectAttempts: input.reconnectAttempts,
                        },
                }),
                ...extraModules,
            ],
        })
    }

    const replaceFaultRules = async (rules: HostFaultRule[]) => {
        return await fetchJson<{
            success: boolean
            ruleCount: number
        }>(`${addressInfo.httpBaseUrl}/fault-rules`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                rules,
            }),
        })
    }

    const clearFaultRules = async () => {
        return await replaceFaultRules([])
    }

    const getStats = async () => {
        return await fetchJson<{
            ticketCount: number
            sessionCount: number
            activeConnectionCount: number
            activeFaultRuleCount: number
            relayCounters: {
                enqueued: number
                delivered: number
                dropped: number
                flushed: number
                disconnected: number
            }
        }>(`${addressInfo.httpBaseUrl}/stats`)
    }

    const seedReconnectParameters = async (runtime: ReturnType<typeof createRuntime>) => {
        if (input.reconnectIntervalMs == null) {
            return
        }

        const entries: ParameterCatalogEntry[] = [
            {
                key: topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs.key,
                rawValue: input.reconnectIntervalMs,
                updatedAt: nowTimestampMs(),
                source: 'host',
            },
        ]

        if (input.reconnectAttempts != null) {
            entries.push({
                key: topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts.key,
                rawValue: input.reconnectAttempts,
                updatedAt: nowTimestampMs(),
                source: 'host',
            })
        }

        await runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries,
            {entries},
        ))
    }

    return {
        server,
        addressInfo,
        masterNodeId,
        slaveNodeId,
        masterSocketRuntime,
        slaveSocketRuntime,
        replaceFaultRules,
        clearFaultRules,
        getStats,
        createMasterRuntime(extraModules: readonly KernelRuntimeModuleV2[] = []) {
            return createRuntime({
                nodeId: masterNodeId,
                role: 'master',
                deviceId: 'master-device',
            }, extraModules)
        },
        createSlaveRuntime(extraModules: readonly KernelRuntimeModuleV2[] = []) {
            return createRuntime({
                nodeId: slaveNodeId,
                role: 'slave',
                deviceId: 'slave-device',
            }, extraModules)
        },
        async seedReconnectParameters(runtime: ReturnType<typeof createRuntime>) {
            await seedReconnectParameters(runtime)
        },
        async close() {
            await server.close()
        },
    }
}

export type SyncValueState = Record<string, {value: string; updatedAt: number}>

export const selectSyncValueState = (
    state: Record<string, unknown>,
    sliceName: string,
) => state[sliceName] as SyncValueState | undefined

const createSyncValueModule = (input: {
    sliceName: string
    commandName: string
    syncIntent?: 'master-to-slave' | 'slave-to-master'
}): KernelRuntimeModuleV2 => {
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
        actorDefinitions: [
            {
                moduleName: `${input.sliceName}.module`,
                actorName: 'SyncValueActor',
                handlers: [
                    {
                        commandName: input.commandName,
                        handle(context) {
                            const payload = context.command.payload as {
                                entryKey: string
                                value: string
                                updatedAt: number
                            }
                            context.dispatchAction(slice.actions.putEntry(payload))
                            return {
                                entryKey: payload.entryKey,
                            }
                        },
                    },
                ],
            },
        ],
        commandDefinitions: [
            {
                moduleName: `${input.sliceName}.module`,
                commandName: input.commandName,
                visibility: 'public',
                timeoutMs: 60_000,
                allowNoActor: false,
                allowReentry: false,
                defaultTarget: 'local',
            },
        ],
    }
}

export const createTopologyRuntimeV2StateSyncLiveHarness = async (input: {
    profileName: string
    syncSliceName: string
    syncCommandName: string
    syncIntent?: 'master-to-slave' | 'slave-to-master'
    reconnectIntervalMs?: number
    reconnectAttempts?: number
}) => {
    const harness = await createTopologyRuntimeV2LiveHarness({
        profileName: input.profileName,
        reconnectIntervalMs: input.reconnectIntervalMs,
        reconnectAttempts: input.reconnectAttempts,
    })

    const syncModule = createSyncValueModule({
        sliceName: input.syncSliceName,
        commandName: input.syncCommandName,
        syncIntent: input.syncIntent,
    })

    const masterRuntime = harness.createMasterRuntime([syncModule])
    const slaveRuntime = harness.createSlaveRuntime([syncModule])

    await masterRuntime.start()
    await slaveRuntime.start()

    return {
        ...harness,
        masterRuntime,
        slaveRuntime,
        syncSliceName: input.syncSliceName,
        syncCommandName: input.syncCommandName,
        async configureTopologyPair() {
            await masterRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.setEnableSlave,
                payload: {enableSlave: true},
            })
            await slaveRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.setInstanceMode,
                payload: {instanceMode: 'SLAVE'},
            })
            await slaveRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.setDisplayMode,
                payload: {displayMode: 'PRIMARY'},
            })
            await slaveRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.setMasterInfo,
                payload: {
                    masterInfo: {
                        deviceId: 'master-device',
                        serverAddress: [{address: harness.addressInfo.wsUrl}],
                        addedAt: Date.now() as any,
                    },
                },
            })
        },
        async startTopologyConnectionPair() {
            await masterRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.startTopologyConnection,
                payload: {},
            })
            await slaveRuntime.dispatchCommand({
                definition: topologyRuntimeV2CommandDefinitions.startTopologyConnection,
                payload: {},
            })
            await waitFor(() => {
                return selectTopologyRuntimeV2Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                    && selectTopologyRuntimeV2Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
            })
        },
    }
}
