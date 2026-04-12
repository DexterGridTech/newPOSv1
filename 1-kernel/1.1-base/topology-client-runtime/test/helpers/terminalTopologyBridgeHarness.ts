import {createRequestId, type TimestampMs} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts, type StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime, type KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {createTcpControlRuntimeModule, selectTcpTerminalId, tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    createTdpSyncRuntimeModule,
    selectTdpProjectionState,
    selectTdpSessionState,
    tdpSyncCommandNames,
    tdpSyncParameterDefinitions,
    tdpSyncSocketProfile,
    type TdpProjectionEnvelope,
} from '@impos2/kernel-base-tdp-sync-runtime'
import {
    createHttpRuntime,
    createSocketRuntime,
    type HttpTransport,
} from '@impos2/kernel-base-transport-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createTopologyClientRuntimeModule,
} from '../../src'
import {createMockTerminalPlatformTestServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {waitFor} from './topologyClientHarness'
import {
    configureTopologyPair,
    createTopologyHostLiveHarness,
    startTopologyConnectionPair,
} from './liveHarness'

export const TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME = 'kernel.base.topology-client-runtime.test.terminal-bridge'
export const TERMINAL_TOPOLOGY_BRIDGE_COMMAND_NAME = 'kernel.base.topology-client-runtime.test.terminal-bridge.consume-projection'

export type TerminalBridgeState = Record<string, TerminalBridgeEntry>

export interface TerminalBridgeEntry {
    topic: string
    itemKey: string
    payload: unknown
    revision: number
    updatedAt: number
}

export interface LiveTaskSceneResult {
    sceneTemplateId: string
    release?: {
        releaseId?: string
    }
    dispatch?: {
        releaseId?: string
        totalInstances?: number
    }
    tdp?: {
        mode?: string
        releaseId?: string
        totalInstances?: number
    }
    targetTerminalIds?: string[]
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

const createMemoryStateStorage = (): StateStoragePort => {
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

type ApiEnvelope<T> =
    | {success: true; data: T}
    | {success: false; error: {message: string; details?: unknown}}

const fetchPlatformJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers ?? {}),
        },
    })
    const payload = await response.json() as ApiEnvelope<T>
    if (!response.ok || !payload.success) {
        const message = payload.success ? response.statusText : payload.error.message
        throw new Error(`HTTP ${response.status} ${message}`)
    }
    return payload.data
}

const createFetchTransport = (): HttpTransport => ({
    async execute(request) {
        const response = await fetch(request.url, {
            method: request.endpoint.method,
            headers: {
                'content-type': 'application/json',
                ...(request.input.headers ?? {}),
            },
            body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
        })
        return {
            data: await response.json(),
            status: response.status,
            statusText: response.statusText,
            headers: {},
        }
    },
})

const projectionToBridgeEntry = (projection: TdpProjectionEnvelope): TerminalBridgeEntry => ({
    topic: projection.topic,
    itemKey: projection.itemKey,
    payload: projection.payload,
    revision: projection.revision,
    updatedAt: projection.revision,
})

export const selectTerminalBridgeState = (
    state: Record<string, unknown>,
) => state[TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME] as TerminalBridgeState | undefined

const createTerminalBridgeModule = (): KernelRuntimeModule => {
    const slice = createSlice({
        name: TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME,
        initialState: {} as TerminalBridgeState,
        reducers: {
            putEntry(state, action: PayloadAction<TerminalBridgeEntry>) {
                state[`${action.payload.topic}:${action.payload.itemKey}`] = action.payload
            },
        },
    })

    const descriptor: StateRuntimeSliceDescriptor<TerminalBridgeState> = {
        name: TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME,
        reducer: slice.reducer,
        persistIntent: 'never',
        syncIntent: 'master-to-slave',
        sync: {
            kind: 'record',
            getEntries: state => Object.fromEntries(
                Object.entries(state).map(([entryKey, entryValue]) => [
                    entryKey,
                    {
                        value: entryValue,
                        updatedAt: entryValue.updatedAt,
                    } satisfies SyncValueEnvelope<TerminalBridgeEntry>,
                ]),
            ),
            applyEntries: (_state, entries) => {
                const next: TerminalBridgeState = {}
                Object.entries(entries).forEach(([entryKey, entryValue]) => {
                    if (!entryValue || entryValue.tombstone === true || !entryValue.value || typeof entryValue.value !== 'object') {
                        return
                    }
                    next[entryKey] = entryValue.value as TerminalBridgeEntry
                })
                return next
            },
        },
    }

    return {
        moduleName: 'kernel.base.topology-client-runtime.test.terminal-bridge-module',
        packageVersion: '0.0.1',
        stateSlices: [descriptor],
        install(context) {
            context.registerHandler(TERMINAL_TOPOLOGY_BRIDGE_COMMAND_NAME, async handlerContext => {
                const payload = handlerContext.command.payload as {topic: string; itemKey: string}
                const projection = selectTdpProjectionState(handlerContext.getState())
                    ?.byTopic[payload.topic]?.[payload.itemKey]
                if (!projection) {
                    throw new Error(`Missing TDP projection ${payload.topic}:${payload.itemKey}`)
                }
                context.dispatchAction(slice.actions.putEntry(projectionToBridgeEntry(projection)))
                return {
                    entryKey: `${payload.topic}:${payload.itemKey}`,
                }
            })
        },
    }
}

export const createTerminalTopologyBridgeLiveHarness = async (input?: {
    tdpReconnectIntervalMs?: number
    includeDefaultBridgeModule?: boolean
    masterModules?: readonly KernelRuntimeModule[]
    slaveModules?: readonly KernelRuntimeModule[]
}) => {
    const terminalPlatform = createMockTerminalPlatformTestServer()
    await terminalPlatform.start()
    const terminalBaseUrl = terminalPlatform.getHttpBaseUrl()
    await fetchPlatformJson<{
        sandboxId: string
        preparedAt: number
    }>(`${terminalBaseUrl}/mock-debug/kernel-base-test/prepare`, {
        method: 'POST',
    })

    const topologyHost = await createTopologyHostLiveHarness({
        profileName: 'dual-topology.ws.terminal-bridge',
    })

    const terminalSocketRuntime = createSocketRuntime({
        logger: createTestLogger('dual-topology.ws.terminal-bridge.terminal-socket'),
        transport: createNodeWsTransport(),
        servers: [
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {
                        addressName: 'live',
                        baseUrl: terminalBaseUrl,
                    },
                ],
            },
        ],
    })

    const createHttpRuntimeForTerminal = (moduleName: string) => {
        return createHttpRuntime({
            logger: createTestLogger(moduleName),
            transport: createFetchTransport(),
            servers: [
                {
                    serverName: 'mock-terminal-platform',
                    addresses: [
                        {
                            addressName: 'live',
                            baseUrl: terminalBaseUrl,
                        },
                    ],
                },
            ],
        })
    }

    const masterRuntime = createKernelRuntime({
        localNodeId: topologyHost.masterNodeId,
        localRuntimeVersion: 'kernel-base-terminal-topology-bridge-live-test',
        startupSeed: input?.tdpReconnectIntervalMs == null
            ? undefined
            : {
                parameterCatalog: {
                    [tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key]: {
                        key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                        rawValue: input.tdpReconnectIntervalMs,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                },
            },
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createTestLogger('dual-topology.ws.terminal-bridge.master-runtime'),
            stateStorage: createMemoryStateStorage(),
            secureStateStorage: createMemoryStateStorage(),
        }),
        modules: [
            ...((input?.includeDefaultBridgeModule ?? true) ? [createTerminalBridgeModule()] : []),
            ...(input?.masterModules ?? []),
            createTcpControlRuntimeModule({
                assembly: {
                    createHttpRuntime() {
                        return createHttpRuntimeForTerminal('dual-topology.ws.terminal-bridge.tcp-http')
                    },
                },
            }),
            createTdpSyncRuntimeModule({
                assembly: {
                    createHttpRuntime() {
                        return createHttpRuntimeForTerminal('dual-topology.ws.terminal-bridge.tdp-http')
                    },
                    resolveSocketBinding() {
                        return {
                            socketRuntime: terminalSocketRuntime,
                            profileName: tdpSyncSocketProfile.name,
                            profile: tdpSyncSocketProfile,
                        }
                    },
                },
                socket: {
                    reconnectAttempts: 3,
                },
            }),
            createTopologyClientRuntimeModule({
                assembly: topologyHost.createMasterAssembly(),
            }),
        ],
    })

    const slaveRuntime = createKernelRuntime({
        localNodeId: topologyHost.slaveNodeId,
        localRuntimeVersion: 'kernel-base-terminal-topology-bridge-live-test',
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createTestLogger('dual-topology.ws.terminal-bridge.slave-runtime'),
            stateStorage: createMemoryStateStorage(),
            secureStateStorage: createMemoryStateStorage(),
        }),
        modules: [
            ...((input?.includeDefaultBridgeModule ?? true) ? [createTerminalBridgeModule()] : []),
            ...(input?.slaveModules ?? []),
            createTopologyClientRuntimeModule({
                assembly: topologyHost.createSlaveAssembly(),
            }),
        ],
    })

    await masterRuntime.start()
    await slaveRuntime.start()

    const disconnect = async () => {
        await masterRuntime.execute({
            commandName: tdpSyncCommandNames.disconnectTdpSession,
            payload: {},
            requestId: createRequestId(),
        }).catch(() => undefined)
        terminalSocketRuntime.disconnect(tdpSyncSocketProfile.name, 'test-complete')
        topologyHost.disconnect()
        await terminalPlatform.close()
    }

    return {
        masterRuntime,
        slaveRuntime,
        terminalBaseUrl,
        terminalPlatform,
        async configureTopologyPair() {
            await configureTopologyPair({
                masterRuntime,
                slaveRuntime,
                masterWsUrl: topologyHost.addressInfo.wsUrl,
            })
        },
        async startTopologyConnectionPair() {
            await startTopologyConnectionPair({
                masterRuntime,
                slaveRuntime,
            })
        },
        async activateAndConnectTerminal(input: {
            activationCode: string
            deviceId: string
        }) {
            await masterRuntime.execute({
                commandName: tcpControlCommandNames.bootstrapTcpControl,
                payload: {
                    deviceInfo: {
                        id: input.deviceId,
                        model: 'Live Mock POS',
                    },
                },
                requestId: createRequestId(),
            })
            await masterRuntime.execute({
                commandName: tcpControlCommandNames.activateTerminal,
                payload: {
                    activationCode: input.activationCode,
                },
                requestId: createRequestId(),
            })
            await masterRuntime.execute({
                commandName: tdpSyncCommandNames.connectTdpSession,
                payload: {},
                requestId: createRequestId(),
            })
            await waitFor(() => selectTdpSessionState(masterRuntime.getState())?.status === 'READY')
        },
        getTerminalId() {
            return selectTcpTerminalId(masterRuntime.getState())
        },
        async runSceneTemplate(sceneTemplateId: string, body?: Record<string, unknown>) {
            return fetchPlatformJson<LiveTaskSceneResult>(
                `${terminalBaseUrl}/mock-admin/scenes/${sceneTemplateId}/run`,
                {
                    method: 'POST',
                    body: body == null ? undefined : JSON.stringify(body),
                },
            )
        },
        async upsertProjection(input: {
            topicKey: string
            payload: Record<string, unknown>
        }) {
            const terminalId = selectTcpTerminalId(masterRuntime.getState())
            if (!terminalId) {
                throw new Error('missing terminal id before upsert projection')
            }
            return fetchPlatformJson<any>(`${terminalBaseUrl}/api/v1/admin/tdp/projections/upsert`, {
                method: 'POST',
                body: JSON.stringify({
                    topicKey: input.topicKey,
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    payload: input.payload,
                }),
            })
        },
        async mirrorProjectionToTopologyBridge(input: {
            topic: string
            itemKey: string
        }) {
            await masterRuntime.execute({
                commandName: TERMINAL_TOPOLOGY_BRIDGE_COMMAND_NAME,
                payload: input,
                requestId: createRequestId(),
            })
        },
        async forceCloseActiveTdpSession(input?: {
            code?: number
            reason?: string
        }) {
            const sessionId = selectTdpSessionState(masterRuntime.getState())?.sessionId
            if (!sessionId) {
                throw new Error('missing active TDP session before force close')
            }
            await fetchPlatformJson<any>(
                `${terminalBaseUrl}/api/v1/admin/tdp/sessions/${sessionId}/force-close`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        code: input?.code ?? 1012,
                        reason: input?.reason ?? 'terminal-topology-bridge-force-close',
                    }),
                },
            )
            return sessionId
        },
        async waitForReconnectedTdpSession(previousSessionId: string, timeoutMs = 5_000) {
            await waitFor(() => {
                const session = selectTdpSessionState(masterRuntime.getState())
                return session?.status === 'READY' && session.sessionId !== previousSessionId
            }, timeoutMs)
            return selectTdpSessionState(masterRuntime.getState())
        },
        async reportTaskResult(input: {
            instanceId: string
            status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
            result?: Record<string, unknown>
            error?: Record<string, unknown>
        }) {
            const terminalId = selectTcpTerminalId(masterRuntime.getState())
            if (!terminalId) {
                throw new Error('missing terminal id before report task result')
            }
            return fetchPlatformJson<{instanceId: string; status: string; finishedAt?: TimestampMs}>(
                `${terminalBaseUrl}/api/v1/terminals/${terminalId}/tasks/${input.instanceId}/result`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        status: input.status,
                        result: input.result,
                        error: input.error,
                    }),
                },
            )
        },
        disconnect,
    }
}
