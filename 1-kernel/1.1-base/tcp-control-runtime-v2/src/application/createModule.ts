import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
    type HttpSuccessResponse,
    type HttpTransport,
    type HttpTransportRequest,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {moduleName} from '../moduleName'
import {
    createTcpControlActorDefinitionsV2,
    type TcpControlServiceRefV2,
} from '../features/actors'
import {createTcpControlHttpServiceV2} from '../foundations/httpService'
import type {CreateTcpControlRuntimeModuleV2Input} from '../types'
import {tcpControlRuntimeV2ModuleManifest} from './moduleManifest'

const DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL = 'http://127.0.0.1:5810'
const DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME = 'local-default'

/**
 * 设计意图：
 * tcp-control-runtime-v2 模块只装配控制面 actor、HTTP service 和最小恢复状态。
 * 默认 HTTP runtime 只是开发/测试兜底，真正生产装配应优先由 assembly 注入宿主 transport 和 server-config。
 */
const createFetchHttpTransport = (): HttpTransport => {
    return {
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
                headers: (() => {
                    const headers: Record<string, string> = {}
                    response.headers.forEach((value: string, key: string) => {
                        headers[key] = value
                    })
                    return headers
                })(),
            }
        },
    }
}

export const createDefaultTcpControlHttpRuntimeV2 = (
    context: RuntimeModulePreSetupContextV2 | Parameters<NonNullable<KernelRuntimeModuleV2['install']>>[0],
) => createHttpRuntime({
    logger: context.platformPorts.logger.scope({
        moduleName,
        subsystem: 'transport.http',
        component: 'TcpControlHttpRuntimeV2',
    }),
    transport: createFetchHttpTransport(),
    servers: [
        {
            serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
            addresses: [
                {
                    addressName: DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME,
                    baseUrl: DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL,
                },
            ],
        },
    ],
})

export const tcpControlRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTcpControlRuntimeModuleV2 = (
    input: CreateTcpControlRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const serviceRef: TcpControlServiceRefV2 = {}

    return defineKernelRuntimeModuleV2({
        ...tcpControlRuntimeV2ModuleManifest,
        actorDefinitions: createTcpControlActorDefinitionsV2(serviceRef),
        preSetup: tcpControlRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            const httpRuntime = input.assembly?.createHttpRuntime(context)
                ?? createDefaultTcpControlHttpRuntimeV2(context)
            serviceRef.current = createTcpControlHttpServiceV2(httpRuntime)
            serviceRef.clientRuntime = input.assembly?.resolveClientRuntimeCapability?.(context)

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: tcpControlRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: tcpControlRuntimeV2ModuleManifest.commandNames,
            })
        },
    })
}

export const tcpControlRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTcpControlRuntimeModuleV2)
