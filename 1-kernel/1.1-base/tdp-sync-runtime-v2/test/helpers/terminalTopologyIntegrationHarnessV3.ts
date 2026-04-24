import {
    createRequestId,
    nowTimestampMs,
    type ParameterCatalogEntry,
    type TimestampMs,
} from '@next/kernel-base-contracts'
import {createLoggerPort} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
    type KernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@next/kernel-server-config-v2'
import {
    createHttpRuntime,
    createSocketRuntime,
    type HttpSuccessResponse,
    type HttpTransport,
    type HttpTransportRequest,
} from '@next/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpSessionState,
    tdpSyncV2CommandDefinitions,
    tdpSyncV2ParameterDefinitions,
    tdpSyncV2SocketProfile,
} from '../../src'
import {
    selectTopologyRuntimeV3Connection,
    topologyRuntimeV3CommandDefinitions,
} from '@next/kernel-base-topology-runtime-v3'
import {createMockTerminalPlatformTestServer} from '../../../../../0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'
import {createNodeWsTransport} from '../../../transport-runtime/test/helpers/nodeWsTransport'
import {resolveTransportServers} from '../../../../test-support/serverConfig'
import {
    createTopologyRuntimeV3LiveHarness,
    waitFor,
} from '../../../topology-runtime-v3/test/helpers/runtimeLiveHarness'
import {
    createTerminalBridgeModuleV3,
    TERMINAL_TOPOLOGY_BRIDGE_COMMAND,
} from './terminalReadModelModules'

type ApiEnvelope<T> =
    | {success: true; data: T}
    | {success: false; error: {message: string; details?: unknown}}

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
    async execute<TPath, TQuery, TBody, TResponse>(
        request: HttpTransportRequest<TPath, TQuery, TBody>,
    ): Promise<HttpSuccessResponse<TResponse>> {
        const response = await fetch(request.url, {
            method: request.endpoint.method,
            headers: {
                'content-type': 'application/json',
                ...(request.input.headers ?? {}),
            },
            body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
        })
        return {
            data: await response.json() as TResponse,
            status: response.status,
            statusText: response.statusText,
            headers: {},
        }
    },
})

export const createTerminalTopologyIntegrationHarnessV3 = async (input?: {
    tdpReconnectIntervalMs?: number
    includeDefaultBridgeModule?: boolean
    masterModules?: readonly KernelRuntimeModuleV2[]
    slaveModules?: readonly KernelRuntimeModuleV2[]
}) => {
    const terminalPlatform = createMockTerminalPlatformTestServer()
    await terminalPlatform.start()
    const terminalBaseUrl = terminalPlatform.getHttpBaseUrl()
    const preparedSandbox = await fetchPlatformJson<{
        sandboxId: string
        preparedAt: number
    }>(`${terminalBaseUrl}/mock-debug/kernel-base-test/prepare`, {
        method: 'POST',
    })

    const topologyHost = await createTopologyRuntimeV3LiveHarness({
        profileName: 'dual-topology.ws.topology-runtime-v3.terminal-integration',
    })

    const terminalSocketRuntime = createSocketRuntime({
        logger: createTestLogger('dual-topology.ws.topology-runtime-v3.terminal-socket'),
        transport: createNodeWsTransport(),
        servers: resolveTransportServers(kernelBaseTestServerConfig, {
            baseUrlOverrides: {
                [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: terminalBaseUrl,
            },
        }),
    })

    const createHttpRuntimeForTerminal = (moduleName: string) => {
        return createHttpRuntime({
            logger: createTestLogger(moduleName),
            transport: createFetchTransport(),
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                baseUrlOverrides: {
                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: terminalBaseUrl,
                },
            }),
        })
    }

    const masterRuntime = topologyHost.createMasterRuntime([
        ...((input?.includeDefaultBridgeModule ?? true) ? [createTerminalBridgeModuleV3()] : []),
        ...(input?.masterModules ?? []),
        createTcpControlRuntimeModuleV2({
            assembly: {
                createHttpRuntime() {
                    return createHttpRuntimeForTerminal('dual-topology.ws.topology-runtime-v3.tcp-http')
                },
            },
        }),
        createTdpSyncRuntimeModuleV2({
            socket: {
                reconnectAttempts: 3,
                reconnectIntervalMs: input?.tdpReconnectIntervalMs,
            },
            assembly: {
                createHttpRuntime() {
                    return createHttpRuntimeForTerminal('dual-topology.ws.topology-runtime-v3.tdp-http')
                },
                resolveSocketBinding() {
                    return {
                        socketRuntime: terminalSocketRuntime,
                        profileName: tdpSyncV2SocketProfile.name,
                        profile: tdpSyncV2SocketProfile,
                    }
                },
            },
        }),
    ])

    const slaveRuntime = topologyHost.createSlaveRuntime([
        ...((input?.includeDefaultBridgeModule ?? true) ? [createTerminalBridgeModuleV3()] : []),
        ...(input?.slaveModules ?? []),
    ])

    await masterRuntime.start()
    await slaveRuntime.start()

    return {
        masterRuntime,
        slaveRuntime,
        terminalBaseUrl,
        terminalPlatform,
        async configureTopologyPair() {
            await topologyHost.configureDefaultPair(masterRuntime, slaveRuntime, {
                slaveDisplayMode: 'PRIMARY',
            })
        },
        async startTopologyConnectionPair() {
            await topologyHost.startTopologyConnectionPair(masterRuntime, slaveRuntime, 5_000)
            await waitFor(() => {
                return selectTopologyRuntimeV3Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                    && selectTopologyRuntimeV3Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
            }, 5_000)
        },
        async seedTdpReconnectIntervalMs(intervalMs: number) {
            const entries: ParameterCatalogEntry[] = [
                {
                    key: tdpSyncV2ParameterDefinitions.tdpReconnectIntervalMs.key,
                    rawValue: intervalMs,
                    updatedAt: nowTimestampMs(),
                    source: 'host',
                },
            ]
            await masterRuntime.dispatchCommand(createCommand(
                runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries,
                {entries},
            ))
        },
        async activateAndConnectTerminal(runtimeInput: {
            activationCode: string
            deviceId: string
        }) {
            await masterRuntime.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.bootstrapTcpControl,
                {
                    deviceInfo: {
                        id: runtimeInput.deviceId,
                        model: 'Live Mock POS',
                    },
                },
            ), {requestId: createRequestId()})
            await masterRuntime.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.activateTerminal,
                {
                    sandboxId: preparedSandbox.sandboxId,
                    activationCode: runtimeInput.activationCode,
                },
            ), {requestId: createRequestId()})
            if (input?.tdpReconnectIntervalMs != null) {
                await this.seedTdpReconnectIntervalMs(input.tdpReconnectIntervalMs)
            }
            await masterRuntime.dispatchCommand(createCommand(
                tdpSyncV2CommandDefinitions.connectTdpSession,
                {},
            ), {requestId: createRequestId()})
            await waitFor(() => selectTdpSessionState(masterRuntime.getState())?.status === 'READY', 5_000)
        },
        getTerminalId() {
            return selectTcpTerminalId(masterRuntime.getState())
        },
        async runSceneTemplate(sceneTemplateId: string, body?: Record<string, unknown>) {
            return await fetchPlatformJson<LiveTaskSceneResult>(
                `${terminalBaseUrl}/mock-admin/scenes/${sceneTemplateId}/run`,
                {
                    method: 'POST',
                    body: body == null ? undefined : JSON.stringify(body),
                },
            )
        },
        async upsertProjection(inputValue: {
            topicKey: string
            itemKey?: string
            payload: Record<string, unknown>
        }) {
            const terminalId = selectTcpTerminalId(masterRuntime.getState())
            if (!terminalId) {
                throw new Error('missing terminal id before upsert projection')
            }
            return await fetchPlatformJson<any>(`${terminalBaseUrl}/api/v1/admin/tdp/projections/upsert`, {
                method: 'POST',
                body: JSON.stringify({
                    sandboxId: preparedSandbox.sandboxId,
                    topicKey: inputValue.topicKey,
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: inputValue.itemKey,
                    payload: inputValue.payload,
                }),
            })
        },
        async mirrorProjectionToTopologyBridge(inputValue: {
            topic: string
            itemKey: string
        }) {
            await masterRuntime.dispatchCommand(createCommand(
                TERMINAL_TOPOLOGY_BRIDGE_COMMAND,
                inputValue,
            ), {requestId: createRequestId()})
        },
        async forceCloseActiveTdpSession(inputValue?: {
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
                        code: inputValue?.code ?? 1012,
                        reason: inputValue?.reason ?? 'terminal-topology-bridge-force-close',
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
        async reportTaskResult(inputValue: {
            instanceId: string
            status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
            result?: Record<string, unknown>
            error?: Record<string, unknown>
        }) {
            const terminalId = selectTcpTerminalId(masterRuntime.getState())
            if (!terminalId) {
                throw new Error('missing terminal id before report task result')
            }
            return await fetchPlatformJson<{instanceId: string; status: string; finishedAt?: TimestampMs}>(
                `${terminalBaseUrl}/api/v1/terminals/${terminalId}/tasks/${inputValue.instanceId}/result`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        status: inputValue.status,
                        result: inputValue.result,
                        error: inputValue.error,
                    }),
                },
            )
        },
        async disconnect() {
            await masterRuntime.dispatchCommand(createCommand(
                tdpSyncV2CommandDefinitions.disconnectTdpSession,
                {},
            ), {requestId: createRequestId()}).catch(() => undefined)
            terminalSocketRuntime.disconnect(tdpSyncV2SocketProfile.name, 'test-complete')
            await masterRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                {},
            )).catch(() => undefined)
            await slaveRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                {},
            )).catch(() => undefined)
            await topologyHost.close()
            await terminalPlatform.close()
        },
    }
}
