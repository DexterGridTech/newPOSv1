import {createNodeId, createRequestId} from '@next/kernel-base-contracts'
import type {ParameterCatalogEntry} from '@next/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@next/kernel-base-platform-ports'
import {
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
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
    type SocketTransport,
} from '@next/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpBindingSnapshot,
    selectTcpSandboxId,
    tcpControlV2CommandDefinitions,
    selectTcpTerminalId,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    tdpSyncV2SocketProfile,
    type CreateTdpSyncRuntimeModuleV2Input,
} from '../../src'
import {createMockTerminalPlatformTestServer} from '../../../../../0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'
import {createNodeWsTransport} from '../../../transport-runtime/test/helpers/nodeWsTransport'
import {createFileStoragePair, createMemoryStorage} from '../../../../test-support/storageHarness'
import {resolveTransportServers} from '../../../../test-support/serverConfig'

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

const withAdminAuth = (platform: {baseUrl: string; adminToken: string}, init?: RequestInit): RequestInit => ({
    ...init,
    headers: {
        ...(init?.headers ?? {}),
        authorization: `Bearer ${platform.adminToken}`,
    },
})

export const createFetchTransport = (): HttpTransport => ({
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
        adminToken: server.getAdminToken(),
        prepare,
        async close() {
            await server.close()
        },
        admin: {
            sessions: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/sessions?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            projections: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/projections?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            changeLogs: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/change-logs?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            commandOutbox: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/commands?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            terminals: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/terminals?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            taskReleases: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/releases?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            taskInstances: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/instances?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            upsertProjection: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/projections/upsert`,
                withAdminAuth({baseUrl, adminToken: server.getAdminToken()}, {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                }),
            ),
            upsertProjectionBatch: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/projections/batch-upsert`,
                withAdminAuth({baseUrl, adminToken: server.getAdminToken()}, {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                }),
            ),
            createSelectorGroup: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/groups`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            recomputeGroupsByScope: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/groups/recompute-by-scope`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            recomputeAllGroups: () => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/groups/recompute-all`,
                {
                    method: 'POST',
                    body: JSON.stringify({sandboxId: prepare.sandboxId}),
                },
            ),
            createProjectionPolicy: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/policies`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            terminalGroupMemberships: (terminalId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${encodeURIComponent(prepare.sandboxId)}`,
            ),
            forceCloseSession: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/force-close`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            edgeDegraded: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/edge-degraded`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            rehome: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/rehome`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            protocolError: (sessionId: string, body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tdp/sessions/${sessionId}/protocol-error`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            createTaskRelease: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/releases`,
                {
                    method: 'POST',
                    body: JSON.stringify({...body, sandboxId: prepare.sandboxId}),
                },
            ),
            getTaskTrace: (instanceId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/instances/${instanceId}/trace?sandboxId=${encodeURIComponent(prepare.sandboxId)}`,
            ),
            getSnapshot: (terminalId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${encodeURIComponent(prepare.sandboxId)}`,
            ),
            getChanges: (terminalId: string, cursor = 0, limit?: number) => fetchJson<any>(
                `${baseUrl}/api/v1/tdp/terminals/${terminalId}/changes?sandboxId=${encodeURIComponent(prepare.sandboxId)}&cursor=${cursor}${limit == null ? '' : `&limit=${limit}`}`,
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
        servers: resolveTransportServers(kernelBaseTestServerConfig, {
            baseUrlOverrides: {
                [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: input.baseUrl,
            },
        }),
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
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                                baseUrlOverrides: {
                                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: input.baseUrl,
                                },
                            }),
                        })
                    },
                },
            }),
            createTdpSyncRuntimeModuleV2({
                autoConnectOnActivation: false,
                ...input.tdp,
                assembly: {
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                                baseUrlOverrides: {
                                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: input.baseUrl,
                                },
                            }),
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
    sandboxId: string,
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
                sandboxId,
                activationCode,
            },
        },
        {requestId: createRequestId()},
    )
}

export const readLiveTerminalScope = (
    runtime: ReturnType<typeof createLiveRuntime>['runtime'],
) => {
    const terminalId = selectTcpTerminalId(runtime.getState())
    const sandboxId = selectTcpSandboxId(runtime.getState())
    const binding = selectTcpBindingSnapshot(runtime.getState())
    if (!terminalId || !sandboxId) {
        throw new Error('missing terminal id')
    }
    return {
        sandboxId,
        terminalId,
        binding,
    }
}
