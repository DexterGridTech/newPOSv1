import {createNodeId, createRequestId} from '@impos2/kernel-base-contracts'
import type {ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
    createSocketRuntime,
    type HttpTransport,
    type SocketTransport,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    tdpSyncV2SocketProfile,
    type CreateTdpSyncRuntimeModuleV2Input,
} from '../../src'
import {createMockTerminalPlatformTestServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {createFileStoragePair, createMemoryStorage} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/tdp-sync-runtime/test/helpers/runtimeHarness'

type ApiEnvelope<T> =
    | {success: true; data: T}
    | {success: false; error: {message: string; details?: unknown}}

export const waitFor = async (predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

export const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
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

export const createFetchTransport = (): HttpTransport => ({
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

export const createLivePlatform = async () => {
    const server = createMockTerminalPlatformTestServer()
    await server.start()
    const baseUrl = server.getHttpBaseUrl()
    const prepare = await fetchJson<{
        sandboxId: string
        preparedAt: number
    }>(`${baseUrl}/mock-debug/kernel-base-test/prepare`, {
        method: 'POST',
    })

    return {
        baseUrl,
        prepare,
        async close() {
            await server.close()
        },
        admin: {
            sessions: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/sessions`),
            projections: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/projections`),
            changeLogs: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/change-logs`),
            upsertProjection: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/projections/upsert`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            upsertProjectionBatch: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/projections/batch-upsert`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            forceCloseSession: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/force-close`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            getSnapshot: (terminalId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/tdp/terminals/${terminalId}/snapshot`,
            ),
            getChanges: (terminalId: string, cursor = 0, limit?: number) => fetchJson<any>(
                `${baseUrl}/api/v1/tdp/terminals/${terminalId}/changes?cursor=${cursor}${limit == null ? '' : `&limit=${limit}`}`,
            ),
        },
    }
}

export const createLiveRuntime = (input: {
    baseUrl: string
    localNodeId?: string
    stateStorage?: {storage: any}
    secureStateStorage?: {storage: any}
    startupSeed?: {
        parameterCatalog?: Record<string, ParameterCatalogEntry>
    }
    tdp?: Pick<CreateTdpSyncRuntimeModuleV2Input, 'socket'>
}) => {
    const stateStorage = input.stateStorage ?? createMemoryStorage()
    const secureStateStorage = input.secureStateStorage ?? createMemoryStorage()
    const socketRuntime = createSocketRuntime({
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write() {},
            scope: {
                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test.socket',
                layer: 'kernel',
            },
        }),
        transport: createNodeWsTransport() as SocketTransport,
        servers: [
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {
                        addressName: 'live',
                        baseUrl: input.baseUrl,
                    },
                ],
            },
        ],
    })

    const runtime = createKernelRuntimeV2({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test',
                    layer: 'kernel',
                },
            }),
            stateStorage: stateStorage.storage,
            secureStateStorage: secureStateStorage.storage,
        }),
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: [
                                {
                                    serverName: 'mock-terminal-platform',
                                    addresses: [
                                        {
                                            addressName: 'live',
                                            baseUrl: input.baseUrl,
                                        },
                                    ],
                                },
                            ],
                        })
                    },
                },
            }),
            createTdpSyncRuntimeModuleV2({
                ...input.tdp,
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: [
                                {
                                    serverName: 'mock-terminal-platform',
                                    addresses: [
                                        {
                                            addressName: 'live',
                                            baseUrl: input.baseUrl,
                                        },
                                    ],
                                },
                            ],
                        })
                    },
                    resolveSocketBinding() {
                        return {
                            socketRuntime,
                            profileName: tdpSyncV2SocketProfile.name,
                            profile: tdpSyncV2SocketProfile,
                        }
                    },
                },
            }),
        ],
    })

    return {
        runtime,
        socketRuntime,
        stateStorage,
        secureStateStorage,
    }
}

export const createLiveFileStoragePair = (prefix?: string) => {
    return createFileStoragePair(prefix ?? 'tdp-sync-runtime-v2-live')
}

export const activateLiveTerminal = async (
    runtime: ReturnType<typeof createLiveRuntime>['runtime'],
    activationCode: string,
    deviceId: string,
) => {
    await runtime.dispatchCommand(
        {
            definition: tcpControlV2CommandDefinitions.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: deviceId,
                    model: 'Live Mock POS',
                },
            },
        },
        {requestId: createRequestId()},
    )
    await runtime.dispatchCommand(
        {
            definition: tcpControlV2CommandDefinitions.activateTerminal,
            payload: {
                activationCode,
            },
        },
        {requestId: createRequestId()},
    )
}
