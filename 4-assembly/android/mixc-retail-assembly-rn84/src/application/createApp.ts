import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeModuleV2} from '@impos2/kernel-base-topology-runtime-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {createHttpRuntime} from '@impos2/kernel-base-transport-runtime'
import {createModule as createRuntimeReactModule} from '@impos2/ui-base-runtime-react'
import type {UiRuntimeProviderProps} from '@impos2/ui-base-runtime-react'
import {createModule as createInputRuntimeModule} from '@impos2/ui-base-input-runtime'
import {createModule as createAdminConsoleModule} from '@impos2/ui-base-admin-console'
import {createModule as createTerminalConsoleModule} from '@impos2/ui-base-terminal-console'
import {createModule as createRetailShellModule} from '@impos2/ui-integration-retail-shell'
import type {KernelRuntimeAppV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {StoreEnhancer} from '@reduxjs/toolkit'
import type {AppProps} from '../types'
import {createAssemblyFetchTransport, createAssemblyPlatformPorts, createAssemblyTopologyInput} from '../platform-ports'
import {createReactotronEnhancer} from '../platform-ports/reactotronConfig'
import {resolveAssemblyTransportServers} from '../platform-ports/serverSpaceState'
import {moduleName} from '../moduleName'
import {createModule as createAssemblyRuntimeModule} from './createModule'
import {createAssemblyAdminConsoleInput} from './adminConsoleConfig'
import {createAssemblyAutomation, type AssemblyAutomationRuntime} from './automation'

export interface AssemblyRuntimeApp {
    readonly app: KernelRuntimeAppV2
    readonly automation?: AssemblyAutomationRuntime
    readonly uiRuntimeProviderProps?: Pick<
        UiRuntimeProviderProps,
        'automationBridge' | 'automationRuntimeId' | 'performAutomationAction'
    >
    start(): Promise<import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2>
}

const createStoreEnhancers = (
    props: AppProps,
): readonly StoreEnhancer[] => {
    if (!__DEV__) {
        return []
    }

    const reactotronEnhancer = createReactotronEnhancer({
        isEmulator: props.isEmulator,
        displayIndex: props.displayIndex,
        deviceId: props.deviceId,
    })
    return reactotronEnhancer ? [reactotronEnhancer] : []
}

const createKernelRuntimeAppForAssembly = (
    props: AppProps,
    platformPorts: ReturnType<typeof createAssemblyPlatformPorts>,
    topologyInput: ReturnType<typeof createAssemblyTopologyInput>,
    storeEnhancers: readonly StoreEnhancer[],
    options: {
        mockTerminalPlatformBaseUrl?: string
    },
): KernelRuntimeAppV2 => {
    const httpTransport = createAssemblyFetchTransport()

    return createKernelRuntimeApp({
        runtimeName: moduleName,
        localNodeId: props.topology?.localNodeId as any,
        platformPorts,
        storeEnhancers,
        displayContext: {
            displayIndex: props.displayIndex,
            displayCount: props.displayCount,
        },
        modules: [
            createAssemblyRuntimeModule(props),
            createTopologyRuntimeModuleV2(topologyInput),
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName,
                                layer: 'assembly',
                                subsystem: 'transport.http',
                                component: 'TcpControlHttpRuntime',
                            }),
                            transport: httpTransport,
                            serverProvider: () => resolveAssemblyTransportServers({
                                mockTerminalPlatformBaseUrl: options.mockTerminalPlatformBaseUrl,
                            }),
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
            createAdminConsoleModule(createAssemblyAdminConsoleInput()),
            createTerminalConsoleModule(),
            createRetailShellModule(),
        ],
    })
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
    const storeEnhancers = createStoreEnhancers(props)
    const app = createKernelRuntimeAppForAssembly(
        props,
        platformPorts,
        topologyInput,
        storeEnhancers,
        options,
    )
    const automationEnabled = environmentMode !== 'PROD'
    const automation = automationEnabled
        ? createAssemblyAutomation({
            app,
            buildProfile: environmentMode === 'DEV' ? 'debug' : 'product',
            automationEnabled,
            scriptExecutionAvailable: true,
        })
        : undefined

    return {
        app,
        automation,
        uiRuntimeProviderProps: automation
            ? {
                automationBridge: automation.runtimeReactBridge,
                automationRuntimeId: props.displayIndex > 0 ? 'secondary-runtime' : 'primary-runtime',
                performAutomationAction: async input => automation.runtimeReactBridge.performNodeAction({
                    target: props.displayIndex > 0 ? 'secondary' : 'primary',
                    ...input,
                }),
            }
            : undefined,
        async start() {
            const runtime = await app.start()
            if (automation) {
                automation.attachRuntime(
                    props.displayIndex > 0 ? 'secondary' : 'primary',
                    runtime,
                )
            }
            return runtime
        },
    }
}
