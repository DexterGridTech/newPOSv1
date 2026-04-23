import {createNodeId, nowTimestampMs, type ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    runtimeShellV2CommandDefinitions,
    type KernelRuntimeModuleV2,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import type {TopologyV3FaultRule} from '../../../../../0-mock-server/dual-topology-host-v3/src/types/server'
import {createDualTopologyHostV3Server} from '../../../../../0-mock-server/dual-topology-host-v3/src'
import {fetchJson} from '../../../../../0-mock-server/dual-topology-host-v3/test/helpers/http'
import {createNodeWsTransport} from '../../../transport-runtime/test/helpers/nodeWsTransport'
import {
    createTopologyRuntimeModuleV3,
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    topologyRuntimeV3CommandDefinitions,
    topologyRuntimeV3ParameterDefinitions,
    type CreateTopologyRuntimeModuleV3Input,
} from '../../src'

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
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

export const createTopologyRuntimeV3LiveHarness = async (input: {
    profileName: string
    reconnectIntervalMs?: number
    reconnectAttempts?: number
    slaveDisplayIndex?: number
    slaveDisplayCount?: number
}) => {
    const server = createDualTopologyHostV3Server({
        config: {
            port: 0,
        },
    })
    await server.start()

    const addressInfo = server.getAddressInfo()
    const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
    const masterNodeId = createNodeId()
    const slaveNodeId = createNodeId()

    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: input.profileName,
        serverName: 'dual-topology-host-v3',
        pathTemplate: `${addressInfo.basePath}/ws`,
        handshake: {
            headers: typed<Record<string, string>>(`${input.profileName}.headers`),
        },
        messages: {
            incoming: typed(`${input.profileName}.incoming`),
            outgoing: typed(`${input.profileName}.outgoing`),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: input.reconnectAttempts ?? -1,
            reconnectDelayMs: input.reconnectIntervalMs ?? 3_000,
        },
    })

    const createSocketRuntimeInstance = (role: 'master' | 'slave') => createSocketRuntime({
        logger: createTestLogger(`${input.profileName}.${role}-socket`),
        transport: createNodeWsTransport(),
        servers: [
            {
                serverName: 'dual-topology-host-v3',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: serverBaseUrl,
                    },
                ],
            },
        ],
    })

    const masterSocketRuntime = createSocketRuntimeInstance('master')
    const slaveSocketRuntime = createSocketRuntimeInstance('slave')

    const createAssembly = (runtimeInput: {
        nodeId: string
        role: 'MASTER' | 'SLAVE'
        deviceId: string
    }): CreateTopologyRuntimeModuleV3Input['assembly'] => {
        return {
            resolveSocketBinding(_context: RuntimeModuleContextV2) {
                return {
                    socketRuntime: runtimeInput.role === 'MASTER' ? masterSocketRuntime : slaveSocketRuntime,
                    profileName: input.profileName,
                    profile,
                }
            },
            createHelloRuntime(context: RuntimeModuleContextV2) {
                const topologyContext = selectTopologyRuntimeV3Context(context.getState())
                return {
                    nodeId: runtimeInput.nodeId,
                    deviceId: runtimeInput.deviceId,
                    instanceMode: topologyContext?.instanceMode ?? runtimeInput.role,
                    displayMode: topologyContext?.displayMode ?? (runtimeInput.role === 'MASTER' ? 'PRIMARY' : 'SECONDARY'),
                    standalone: topologyContext?.standalone ?? (runtimeInput.role === 'MASTER'),
                    protocolVersion: '2026.04-v3',
                    capabilities: ['state-sync', 'command-relay', 'request-mirror'],
                }
            },
        }
    }

    const createRuntime = (runtimeInput: {
        nodeId: string
        role: 'MASTER' | 'SLAVE'
        deviceId: string
        displayIndex: number
        displayCount: number
    }, extraModules: readonly KernelRuntimeModuleV2[] = []) => {
        return createKernelRuntimeV2({
            localNodeId: runtimeInput.nodeId as any,
            displayContext: {
                displayIndex: runtimeInput.displayIndex,
                displayCount: runtimeInput.displayCount,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger(`${input.profileName}.${runtimeInput.role.toLowerCase()}-runtime`),
                stateStorage: createMemoryStorage(),
                secureStateStorage: createMemoryStorage(),
            }),
            modules: [
                createTopologyRuntimeModuleV3({
                    assembly: createAssembly(runtimeInput),
                    socket: {
                        reconnectAttempts: input.reconnectAttempts,
                        reconnectDelayMs: input.reconnectIntervalMs,
                    },
                }),
                ...extraModules,
            ],
        })
    }

    const replaceFaultRules = async (rules: TopologyV3FaultRule[]) => {
        return await fetchJson<{
            success: boolean
            ruleCount: number
        }>(`${addressInfo.httpBaseUrl}/fault-rules`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                rules,
            }),
        })
    }

    const clearFaultRules = async () => replaceFaultRules([])

    const getStats = async () => {
        return await fetchJson<{
            sessionCount: number
            activeFaultRuleCount: number
        }>(`${addressInfo.httpBaseUrl}/stats`)
    }

    const seedReconnectParameters = async (runtime: ReturnType<typeof createRuntime>) => {
        if (input.reconnectIntervalMs == null && input.reconnectAttempts == null) {
            return
        }

        const entries: ParameterCatalogEntry[] = []
        if (input.reconnectIntervalMs != null) {
            entries.push({
                key: topologyRuntimeV3ParameterDefinitions.reconnectIntervalMs.key,
                rawValue: input.reconnectIntervalMs,
                updatedAt: nowTimestampMs(),
                source: 'host',
            })
        }

        if (entries.length === 0) {
            return
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
                role: 'MASTER',
                deviceId: 'master-device',
                displayIndex: 0,
                displayCount: 1,
            }, extraModules)
        },
        createSlaveRuntime(extraModules: readonly KernelRuntimeModuleV2[] = []) {
            return createRuntime({
                nodeId: slaveNodeId,
                role: 'SLAVE',
                deviceId: 'slave-device',
                displayIndex: input.slaveDisplayIndex ?? 1,
                displayCount: input.slaveDisplayCount ?? 2,
            }, extraModules)
        },
        async seedReconnectParameters(runtime: ReturnType<typeof createRuntime>) {
            await seedReconnectParameters(runtime)
        },
        async configureDefaultPair(masterRuntime: ReturnType<typeof createRuntime>, slaveRuntime: ReturnType<typeof createRuntime>, inputValue?: {
            slaveDisplayMode?: 'PRIMARY' | 'SECONDARY'
        }) {
            await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setEnableSlave, {
                enableSlave: true,
            }))
            await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, {
                instanceMode: 'MASTER',
            }))
            await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
                displayMode: 'PRIMARY',
            }))

            await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, {
                instanceMode: 'SLAVE',
            }))
            await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
                displayMode: inputValue?.slaveDisplayMode ?? 'SECONDARY',
            }))
            await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setMasterLocator, {
                masterLocator: {
                    masterNodeId,
                    masterDeviceId: 'master-device',
                    serverAddress: [{address: addressInfo.wsUrl}],
                    httpBaseUrl: addressInfo.httpBaseUrl,
                    addedAt: Date.now(),
                },
            }))
        },
        async startTopologyConnectionPair(masterRuntime: ReturnType<typeof createRuntime>, slaveRuntime: ReturnType<typeof createRuntime>, timeoutMs = 5_000) {
            await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.startTopologyConnection, {}))
            await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.startTopologyConnection, {}))
            try {
                await waitFor(() => {
                    return selectTopologyRuntimeV3Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                        && selectTopologyRuntimeV3Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                }, timeoutMs)
            } catch (error) {
                throw new Error([
                    error instanceof Error ? error.message : String(error),
                    `masterConnection=${JSON.stringify(selectTopologyRuntimeV3Connection(masterRuntime.getState()))}`,
                    `slaveConnection=${JSON.stringify(selectTopologyRuntimeV3Connection(slaveRuntime.getState()))}`,
                    `masterContext=${JSON.stringify(selectTopologyRuntimeV3Context(masterRuntime.getState()))}`,
                    `slaveContext=${JSON.stringify(selectTopologyRuntimeV3Context(slaveRuntime.getState()))}`,
                    `hostStats=${JSON.stringify(server.getStats())}`,
                ].join('\n'))
            }
        },
        async close() {
            await server.close()
        },
    }
}
