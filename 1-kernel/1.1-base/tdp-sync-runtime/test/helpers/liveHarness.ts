import {createNodeId, createRequestId} from '@impos2/kernel-base-contracts'
import type {ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {
    createHttpRuntime,
    createSocketRuntime,
    type HttpTransport,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModule,
    tcpControlCommandNames,
} from '@impos2/kernel-base-tcp-control-runtime'
import {
    createTdpSyncRuntimeModule,
    tdpSyncCommandNames,
    tdpSyncSocketProfile,
    type CreateTdpSyncRuntimeModuleInput,
} from '../../src'
import {createFileStoragePair, createMemoryStorage} from './runtimeHarness'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {createMockTerminalPlatformTestServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'

type StorageHarness = {
    storage: StateStoragePort
}

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
            commandOutbox: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/commands`),
            terminals: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/terminals`),
            taskReleases: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/releases`),
            taskInstances: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/instances`),
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
            edgeDegraded: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/edge-degraded`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            rehome: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/rehome`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            protocolError: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/protocol-error`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            createTaskRelease: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/releases`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),
            runSceneTemplate: (sceneTemplateId: string, body?: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/mock-admin/scenes/${sceneTemplateId}/run`,
                {
                    method: 'POST',
                    body: body == null ? undefined : JSON.stringify(body),
                },
            ),
            getTaskTrace: (instanceId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/instances/${instanceId}/trace`,
            ),
        },
    }
}

export const createLiveRuntime = (input: {
    baseUrl: string
    localNodeId?: string
    stateStorage?: StorageHarness
    secureStateStorage?: StorageHarness
    startupSeed?: {
        parameterCatalog?: Record<string, ParameterCatalogEntry>
    }
    tdpModuleInput?: CreateTdpSyncRuntimeModuleInput
    extraModules?: readonly KernelRuntimeModule[]
}) => {
    const stateStorage = input.stateStorage ?? createMemoryStorage()
    const secureStateStorage = input.secureStateStorage ?? createMemoryStorage()
    const socketRuntime = createSocketRuntime({
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write() {},
            scope: {
                moduleName: 'kernel.base.tdp-sync-runtime.live-test.socket',
                layer: 'kernel',
            },
        }),
        transport: createNodeWsTransport(),
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

    const runtime = createKernelRuntime({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        localRuntimeVersion: 'kernel-base-live-test-runtime',
        startupSeed: input.startupSeed,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.tdp-sync-runtime.live-test',
                    layer: 'kernel',
                },
            }),
            stateStorage: stateStorage.storage,
            secureStateStorage: secureStateStorage.storage,
        }),
        modules: [
            createTcpControlRuntimeModule({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tcp-control-runtime.live-test',
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
            createTdpSyncRuntimeModule({
                ...input.tdpModuleInput,
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime.live-test',
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
                            profileName: tdpSyncSocketProfile.name,
                            profile: tdpSyncSocketProfile,
                        }
                    },
                },
            }),
            ...(input.extraModules ?? []),
        ],
    })

    return {
        runtime,
        stateStorage,
        secureStateStorage,
        socketRuntime,
    }
}

export const createLiveFileStoragePair = (prefix?: string) => {
    return createFileStoragePair(prefix)
}

export const activateAndConnectLiveRuntime = async (
    runtime: ReturnType<typeof createLiveRuntime>['runtime'],
    input: {
        activationCode: string
        deviceId: string
        model?: string
    },
) => {
    await runtime.execute({
        commandName: tcpControlCommandNames.bootstrapTcpControl,
        payload: {
            deviceInfo: {
                id: input.deviceId,
                model: input.model ?? 'Live Mock POS',
            },
        },
        requestId: createRequestId(),
    })
    await runtime.execute({
        commandName: tcpControlCommandNames.activateTerminal,
        payload: {
            activationCode: input.activationCode,
        },
        requestId: createRequestId(),
    })
    await runtime.execute({
        commandName: tdpSyncCommandNames.connectTdpSession,
        payload: {},
        requestId: createRequestId(),
    })
}
