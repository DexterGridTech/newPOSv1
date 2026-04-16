import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeModuleV2} from '@impos2/kernel-base-topology-runtime-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {createHttpRuntime} from '@impos2/kernel-base-transport-runtime'
import {kernelBaseDevServerConfig, SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@impos2/kernel-server-config-v2'
import {createModule as createRuntimeReactModule} from '@impos2/ui-base-runtime-react'
import {createModule as createInputRuntimeModule} from '@impos2/ui-base-input-runtime'
import {createModule as createAdminConsoleModule} from '@impos2/ui-base-admin-console'
import {createModule as createTerminalConsoleModule} from '@impos2/ui-base-terminal-console'
import {createModule as createRetailShellModule} from '@impos2/ui-integration-retail-shell'
import type {KernelRuntimeAppV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {TransportServerDefinition} from '@impos2/kernel-base-transport-runtime'
import type {AppProps} from '../types'
import {createAssemblyFetchTransport, createAssemblyPlatformPorts, createAssemblyTopologyInput} from '../platform-ports'

const resolveDevTransportServers = (
    terminalBaseUrl?: string,
): readonly TransportServerDefinition[] => {
    const space = kernelBaseDevServerConfig.spaces.find(item => item.name === kernelBaseDevServerConfig.selectedSpace)
    if (!space) {
        return []
    }
    if (!terminalBaseUrl) {
        return space.servers
    }
    return space.servers.map(server => server.serverName === SERVER_NAME_MOCK_TERMINAL_PLATFORM
        ? {
            ...server,
            addresses: server.addresses.map((address, index) => index === 0
                ? {
                    ...address,
                    baseUrl: terminalBaseUrl,
                }
                : address),
        }
        : server)
}

export interface AssemblyRuntimeApp {
    readonly app: KernelRuntimeAppV2
    start(): Promise<import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2>
}

export const createApp = (
    props: AppProps,
    options: {
        mockTerminalPlatformBaseUrl?: string
    } = {},
): AssemblyRuntimeApp => {
    const environmentMode = __DEV__ ? 'DEV' : 'PROD'
    const platformPorts = createAssemblyPlatformPorts(environmentMode)
    const topologyInput = createAssemblyTopologyInput(props, platformPorts.logger)
    const httpTransport = createAssemblyFetchTransport()
    const servers = resolveDevTransportServers(options.mockTerminalPlatformBaseUrl)
    const app = createKernelRuntimeApp({
        runtimeName: 'assembly.android.mixc-retail-rn84',
        localNodeId: props.topology?.localNodeId as any,
        platformPorts,
        displayContext: {
            displayIndex: props.displayIndex,
            displayCount: props.displayCount,
        },
        modules: [
            createTopologyRuntimeModuleV2(topologyInput),
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'assembly.android.mixc-retail-rn84',
                                layer: 'assembly',
                                subsystem: 'transport.http',
                                component: 'TcpControlHttpRuntime',
                            }),
                            transport: httpTransport,
                            servers,
                            executionPolicy: {
                                retryRounds: 1,
                                failoverStrategy: 'ordered',
                            },
                        })
                    },
                },
            }),
            createUiRuntimeModuleV2(),
            createRuntimeReactModule(),
            createInputRuntimeModule(),
            createAdminConsoleModule(),
            createTerminalConsoleModule(),
            createRetailShellModule(),
        ],
    })

    return {
        app,
        start: () => app.start(),
    }
}
