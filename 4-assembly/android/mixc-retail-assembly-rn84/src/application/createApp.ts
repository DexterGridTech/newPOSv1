import {createCommand, createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTcpIsActivated,
    selectTcpTerminalId,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTopologyRuntimeModuleV3,
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpHotUpdateCurrent,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {createWorkflowRuntimeModuleV2} from '@impos2/kernel-base-workflow-runtime-v2'
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
import {
    createAssemblyFetchTransport,
    createAssemblyPlatformPorts,
    createAssemblyTdpSyncRuntimeAssembly,
    createAssemblyTopologyInput,
} from '../platform-ports'
import {createReactotronEnhancer} from '../platform-ports/reactotronConfig'
import {resolveAssemblyTransportServers} from '../platform-ports/serverSpaceState'
import {moduleName} from '../moduleName'
import {createModule as createAssemblyRuntimeModule} from './createModule'
import {createAssemblyAdminConsoleInput} from './adminConsoleConfig'
import {syncHotUpdateStateFromNativeBoot} from './syncHotUpdateStateFromNativeBoot'
import { reportTerminalVersion } from './reportTerminalVersion'
import {prepareHotUpdateRestart} from './prepareHotUpdateRestart'
import {
    createAssemblyAutomation,
    getAssemblyAdbSocketDebugConfig,
    getAssemblyAutomationHostConfig,
    type AssemblyAutomationRuntime,
} from './automation'
import {
    createAssemblyTopologyBindingSource,
    decideAssemblyTopologyHostLifecycle,
    shouldDisableAssemblyStatePersistence,
    type AssemblyTopologyBindingState,
    type AssemblyTopologyStorageGateSnapshot,
} from './topology'
import {nativeTopologyHost} from '../turbomodules/topologyHost'
import {releaseInfo} from '../generated/releaseInfo'

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
    localNodeId: string,
    platformPorts: ReturnType<typeof createAssemblyPlatformPorts>,
    topologyInput: ReturnType<typeof createAssemblyTopologyInput>,
    storeEnhancers: readonly StoreEnhancer[],
    options: {
        mockTerminalPlatformBaseUrl?: string
        topologyAdminInput?: NonNullable<Parameters<typeof createAssemblyAdminConsoleInput>[0]>['topology']
    },
): KernelRuntimeAppV2 => {
    const httpTransport = createAssemblyFetchTransport()
    const tdpSyncAssembly = createAssemblyTdpSyncRuntimeAssembly({
        logger: platformPorts.logger,
        mockTerminalPlatformBaseUrl: options.mockTerminalPlatformBaseUrl,
    })

    return createKernelRuntimeApp({
        runtimeName: moduleName,
        localNodeId: localNodeId as any,
        platformPorts,
        storeEnhancers,
        displayContext: {
            displayIndex: props.displayIndex,
            displayCount: props.displayCount,
        },
        modules: [
            createAssemblyRuntimeModule(props),
            createTopologyRuntimeModuleV3(topologyInput),
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
            createTdpSyncRuntimeModuleV2({
                assembly: tdpSyncAssembly,
                hotUpdate: {
                    getPort(context) {
                        return context.platformPorts.hotUpdate
                    },
                    getCurrentFacts() {
                        return {
                            appId: releaseInfo.appId,
                            platform: 'android',
                            product: 'mixc-retail',
                            runtimeVersion: releaseInfo.runtimeVersion,
                            assemblyVersion: releaseInfo.assemblyVersion,
                            buildNumber: releaseInfo.buildNumber,
                            channel: releaseInfo.channel,
                            capabilities: [],
                        }
                    },
                    prepareRestart({context, releaseId, packageId, bundleVersion, mode}) {
                        return prepareHotUpdateRestart({
                            context,
                            releaseId,
                            packageId,
                            bundleVersion,
                            mode,
                        })
                    },
                },
            }),
            createWorkflowRuntimeModuleV2(),
            createUiRuntimeModuleV2(),
            createRuntimeReactModule(),
            createInputRuntimeModule(),
            createAdminConsoleModule(createAssemblyAdminConsoleInput({
                topology: options.topologyAdminInput,
            })),
            createTerminalConsoleModule(),
            createRetailShellModule(),
        ],
    })
}

const createDefaultLocalNodeId = (
    props: AppProps,
): string => {
    const masterNodeId = props.topology?.masterNodeId ?? `master:${props.deviceId}`
    if (props.displayIndex === 0) {
        return masterNodeId
    }
    return `${masterNodeId}:display-${props.displayIndex}`
}

const createInitialTopologyBindingState = (
    props: AppProps,
): AssemblyTopologyBindingState => ({
    role: props.topology?.role ?? (props.displayIndex === 0 ? 'master' : 'slave'),
    localNodeId: props.topology?.localNodeId ?? createDefaultLocalNodeId(props),
    masterNodeId: props.topology?.masterNodeId,
    wsUrl: props.topology?.wsUrl,
    httpBaseUrl: props.topology?.httpBaseUrl,
})

const createInitialTopologyContextSnapshot = (
    props: AppProps,
): AssemblyTopologyStorageGateSnapshot => ({
    displayMode: props.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY',
    standalone: props.displayIndex === 0,
})

const updateTopologyRuntimeEnvironment = (
    runtime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2,
    bindingSource: ReturnType<typeof createAssemblyTopologyBindingSource>,
    latestTopologyContext: AssemblyTopologyStorageGateSnapshot,
) => {
    const context = selectTopologyRuntimeV3Context(runtime.getState())
    if (!context) {
        return
    }

    latestTopologyContext.displayMode = context.displayMode
    latestTopologyContext.standalone = context.standalone

    const masterLocator = context.masterLocator as Record<string, unknown> | null | undefined
    const serverAddress = Array.isArray(masterLocator?.serverAddress)
        ? masterLocator.serverAddress[0] as Record<string, unknown> | undefined
        : undefined
    const current = bindingSource.get()
    bindingSource.set({
        role: context.instanceMode === 'SLAVE' ? 'slave' : 'master',
        localNodeId: String(context.localNodeId || current.localNodeId),
        masterNodeId: typeof masterLocator?.masterNodeId === 'string'
            ? masterLocator.masterNodeId
            : current.masterNodeId,
        masterDeviceId: typeof masterLocator?.masterDeviceId === 'string'
            ? masterLocator.masterDeviceId
            : current.masterDeviceId,
        httpBaseUrl: typeof masterLocator?.httpBaseUrl === 'string'
            ? masterLocator.httpBaseUrl
            : current.httpBaseUrl,
        wsUrl: typeof serverAddress?.address === 'string'
            ? serverAddress.address
            : current.wsUrl,
    })
}

const syncMasterTopologyBindingFromHost = (
    bindingSource: ReturnType<typeof createAssemblyTopologyBindingSource>,
    addressInfo: Record<string, unknown> | undefined,
) => {
    if (!addressInfo) {
        return
    }
    const nestedAddressInfo = typeof addressInfo.addressInfo === 'object' && addressInfo.addressInfo != null
        ? addressInfo.addressInfo as Record<string, unknown>
        : undefined
    const resolvedAddressInfo = nestedAddressInfo ?? addressInfo
    const localWsUrl = typeof resolvedAddressInfo.localWsUrl === 'string'
        ? resolvedAddressInfo.localWsUrl
        : typeof resolvedAddressInfo.wsUrl === 'string'
            ? resolvedAddressInfo.wsUrl
            : undefined
    const localHttpBaseUrl = typeof resolvedAddressInfo.localHttpBaseUrl === 'string'
        ? resolvedAddressInfo.localHttpBaseUrl
        : typeof resolvedAddressInfo.httpBaseUrl === 'string'
            ? resolvedAddressInfo.httpBaseUrl
            : undefined
    if (!localWsUrl && !localHttpBaseUrl) {
        return
    }
    bindingSource.set({
        wsUrl: localWsUrl,
        httpBaseUrl: localHttpBaseUrl,
    })
}

const createStandaloneSlaveTopologyAutoStartKey = (
    context: ReturnType<typeof selectTopologyRuntimeV3Context>,
): string | null => {
    if (!context || context.standalone !== true || context.instanceMode !== 'SLAVE') {
        return null
    }

    const masterLocator = context.masterLocator as Record<string, unknown> | null | undefined
    const serverAddress = Array.isArray(masterLocator?.serverAddress)
        ? masterLocator.serverAddress
            .map(entry => typeof (entry as Record<string, unknown>)?.address === 'string'
                ? (entry as Record<string, unknown>).address as string
                : null)
            .filter((address): address is string => Boolean(address))
        : []
    const httpBaseUrl = typeof masterLocator?.httpBaseUrl === 'string'
        ? masterLocator.httpBaseUrl
        : ''

    if (serverAddress.length === 0 && !httpBaseUrl) {
        return null
    }

    return JSON.stringify({
        localNodeId: context.localNodeId,
        displayMode: context.displayMode,
        masterNodeId: typeof masterLocator?.masterNodeId === 'string' ? masterLocator.masterNodeId : '',
        masterDeviceId: typeof masterLocator?.masterDeviceId === 'string' ? masterLocator.masterDeviceId : '',
        serverAddress,
        httpBaseUrl,
    })
}

export const createApp = (
    props: AppProps,
    options: {
        mockTerminalPlatformBaseUrl?: string
    } = {},
): AssemblyRuntimeApp => {
    const environmentMode = __DEV__ ? 'DEV' : 'PROD'
    const adbSocketDebugConfig = getAssemblyAdbSocketDebugConfig(environmentMode)
    const topologyBindingSource = createAssemblyTopologyBindingSource(createInitialTopologyBindingState(props))
    const latestTopologyContext = createInitialTopologyContextSnapshot(props)
    let latestRuntime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2 | undefined
    const platformPorts = createAssemblyPlatformPorts(environmentMode, {
        shouldDisableStatePersistence: () => shouldDisableAssemblyStatePersistence(latestTopologyContext),
    })
    const topologyInput = createAssemblyTopologyInput(props, platformPorts.logger, {
        bindingSource: topologyBindingSource,
    })
    const storeEnhancers = createStoreEnhancers(props)
    const app = createKernelRuntimeAppForAssembly(
        props,
        topologyBindingSource.get().localNodeId,
        platformPorts,
        topologyInput,
        storeEnhancers,
        {
            ...options,
            topologyAdminInput: {
                bindingSource: topologyBindingSource,
                getTopologyContextSnapshot: () => ({...latestTopologyContext}),
                getRuntime: () => latestRuntime,
            },
        },
    )
    const automation = adbSocketDebugConfig.enabled
        ? createAssemblyAutomation({
            app,
            buildProfile: adbSocketDebugConfig.buildProfile,
            automationEnabled: adbSocketDebugConfig.enabled,
            scriptExecutionAvailable: adbSocketDebugConfig.scriptExecutionAvailable,
        })
        : undefined
    const automationTarget = getAssemblyAutomationHostConfig(props.displayIndex).target
    let topologyHostRunning = false
    let topologyHostTransition: Promise<void> | null = null
    let standaloneSlaveTopologyAutoStartKey: string | null = null

    const syncNativeTopologyHostLifecycle = async (
        runtime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2,
    ): Promise<void> => {
        const context = selectTopologyRuntimeV3Context(runtime.getState())
        const decision = decideAssemblyTopologyHostLifecycle({
            displayCount: props.displayCount,
            displayIndex: props.displayIndex,
            instanceMode: context?.instanceMode,
            enableSlave: context?.enableSlave,
        })

        if (decision.shouldRun === topologyHostRunning) {
            platformPorts.logger.info({
                category: 'assembly.topology',
                event: 'topology-host-lifecycle-skip',
                message: 'Native topology host already matches desired lifecycle state',
                data: {
                    displayCount: props.displayCount,
                    displayIndex: props.displayIndex,
                    deviceId: props.deviceId,
                    instanceMode: context?.instanceMode,
                    enableSlave: context?.enableSlave,
                    running: topologyHostRunning,
                    reason: decision.reason,
                },
            })
            return
        }

        try {
            if (decision.shouldRun) {
                platformPorts.logger.info({
                    category: 'assembly.topology',
                    event: 'topology-host-start',
                    message: 'Starting native topology host from assembly lifecycle',
                    data: {
                        displayCount: props.displayCount,
                        displayIndex: props.displayIndex,
                        deviceId: props.deviceId,
                        instanceMode: context?.instanceMode,
                        enableSlave: context?.enableSlave,
                        reason: decision.reason,
                    },
                })
                const hostAddressInfo = await nativeTopologyHost.start({
                    displayCount: props.displayCount,
                    displayIndex: props.displayIndex,
                    deviceId: props.deviceId,
                })
                syncMasterTopologyBindingFromHost(
                    topologyBindingSource,
                    hostAddressInfo as unknown as Record<string, unknown>,
                )
                topologyHostRunning = true
                await runtime.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                    {},
                ))
                return
            }

            platformPorts.logger.info({
                category: 'assembly.topology',
                event: 'topology-host-stop',
                message: 'Stopping native topology host from assembly lifecycle',
                data: {
                    displayCount: props.displayCount,
                    displayIndex: props.displayIndex,
                    deviceId: props.deviceId,
                    instanceMode: context?.instanceMode,
                    enableSlave: context?.enableSlave,
                    reason: decision.reason,
                },
            })
            await nativeTopologyHost.stop()
            topologyHostRunning = false
        } catch (error) {
            platformPorts.logger.error({
                category: 'assembly.topology',
                event: 'topology-host-lifecycle-error',
                message: 'Native topology host lifecycle transition failed',
                data: {
                    displayCount: props.displayCount,
                    displayIndex: props.displayIndex,
                    deviceId: props.deviceId,
                    instanceMode: context?.instanceMode,
                    enableSlave: context?.enableSlave,
                    running: topologyHostRunning,
                    desiredRunning: decision.shouldRun,
                    reason: decision.reason,
                },
                error: {
                    name: error instanceof Error ? error.name : undefined,
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
            throw error
        }
    }

    const maybeAutoStartStandaloneSlaveTopologyConnection = async (
        runtime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2,
    ): Promise<void> => {
        const state = runtime.getState()
        const context = selectTopologyRuntimeV3Context(state)
        const connection = selectTopologyRuntimeV3Connection(state)
        const autoStartKey = createStandaloneSlaveTopologyAutoStartKey(context)

        if (!autoStartKey) {
            standaloneSlaveTopologyAutoStartKey = null
            return
        }
        if (connection?.serverConnectionStatus && connection.serverConnectionStatus !== 'DISCONNECTED') {
            return
        }
        if (standaloneSlaveTopologyAutoStartKey === autoStartKey) {
            return
        }

        standaloneSlaveTopologyAutoStartKey = autoStartKey
        platformPorts.logger.info({
            category: 'assembly.topology',
            event: 'topology-slave-autostart',
            message: 'Auto-starting topology connection for standalone slave recovery',
            data: {
                displayCount: props.displayCount,
                displayIndex: props.displayIndex,
                deviceId: props.deviceId,
                displayMode: context?.displayMode,
                localNodeId: context?.localNodeId,
                masterNodeId: context?.masterLocator?.masterNodeId,
                masterDeviceId: context?.masterLocator?.masterDeviceId,
            },
        })
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))
    }

    const scheduleTopologyHostLifecycleSync = (
        runtime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2,
    ) => {
        const next = (topologyHostTransition ?? Promise.resolve())
            .catch(() => undefined)
            .then(async () => {
                await syncNativeTopologyHostLifecycle(runtime)
                await maybeAutoStartStandaloneSlaveTopologyConnection(runtime)
            })
        topologyHostTransition = next.finally(() => {
            if (topologyHostTransition === next) {
                topologyHostTransition = null
            }
        })
    }

    return {
        app,
        automation,
        uiRuntimeProviderProps: automation
            ? {
                automationBridge: automation.runtimeReactBridge,
                automationRuntimeId: `${automationTarget}-runtime`,
                performAutomationAction: async input => automation.runtimeReactBridge.performNodeAction({
                    target: automationTarget,
                    ...input,
                }),
            }
            : undefined,
        async start() {
            const runtime = await app.start()
            latestRuntime = runtime
            let bootState: Awaited<ReturnType<typeof syncHotUpdateStateFromNativeBoot>>
            try {
                bootState = await syncHotUpdateStateFromNativeBoot(runtime)
            } catch (error) {
                void reportTerminalVersion(
                    runtime,
                    props,
                    'FAILED',
                    error instanceof Error ? error.message : String(error),
                ).catch(() => {})
                throw error
            }
            void reportTerminalVersion(runtime, props, 'BOOTING').catch(() => {})
            if (bootState?.terminalState === 'ROLLED_BACK') {
                void reportTerminalVersion(runtime, props, 'ROLLED_BACK', bootState.reason).catch(() => {})
            }
            if (typeof runtime.getState === 'function' && typeof runtime.subscribeState === 'function') {
                let lastRunningReportKey: string | null = null
                const maybeReportActivatedVersion = () => {
                    const state = runtime.getState()
                    const activated = selectTcpIsActivated(state)
                    const terminalId = selectTcpTerminalId(state) ?? null
                    if (!activated || !terminalId) {
                        lastRunningReportKey = null
                        return
                    }
                    const currentVersion = selectTdpHotUpdateCurrent(state) ?? {
                        source: 'embedded',
                        bundleVersion: 'unknown',
                        packageId: undefined,
                        releaseId: undefined,
                    }
                    const reportKey = [
                        terminalId,
                        currentVersion.source,
                        currentVersion.bundleVersion,
                        currentVersion.packageId ?? '',
                        currentVersion.releaseId ?? '',
                    ].join('|')
                    if (lastRunningReportKey === reportKey) {
                        return
                    }
                    lastRunningReportKey = reportKey
                    void reportTerminalVersion(runtime, props, 'RUNNING').catch(() => {})
                }

                updateTopologyRuntimeEnvironment(runtime, topologyBindingSource, latestTopologyContext)
                scheduleTopologyHostLifecycleSync(runtime)
                runtime.subscribeState(() => {
                    updateTopologyRuntimeEnvironment(runtime, topologyBindingSource, latestTopologyContext)
                    scheduleTopologyHostLifecycleSync(runtime)
                    maybeReportActivatedVersion()
                })
                maybeReportActivatedVersion()
            }
            if (automation) {
                automation.attachRuntime(
                    automationTarget,
                    runtime,
                )
            }
            return runtime
        },
    }
}
