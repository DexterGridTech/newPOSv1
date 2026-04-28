import {createCommand, createKernelRuntimeApp} from '@next/kernel-base-runtime-shell-v2'
import {
    selectTcpIsActivated,
    selectTcpTerminalId,
    type TerminalAssemblyCapabilityManifestV1,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTopologyRuntimeModuleV3,
    selectTopologyRuntimeV3Context,
} from '@next/kernel-base-topology-runtime-v3'
import {
    createTdpSyncRuntimeModuleV2,
    tdpSyncV2CommandDefinitions,
    selectTdpHotUpdateCurrent,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import {createTerminalLogUploadRuntimeModuleV2} from '@next/kernel-base-terminal-log-upload-runtime-v2'
import {createTcpControlRuntimeModuleV2} from '@next/kernel-base-tcp-control-runtime-v2'
import {createUiRuntimeModuleV2} from '@next/kernel-base-ui-runtime-v2'
import {createWorkflowRuntimeModuleV2} from '@next/kernel-base-workflow-runtime-v2'
import {
    createHttpRuntime,
    createTransportRuntimeModule,
    resolveTransportServers,
    selectTransportSelectedServerSpace,
} from '@next/kernel-base-transport-runtime'
import {
    kernelBaseDevServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@next/kernel-server-config-v2'
import {createModule as createRuntimeReactModule} from '@next/ui-base-runtime-react'
import type {UiRuntimeProviderProps} from '@next/ui-base-runtime-react'
import {createModule as createInputRuntimeModule} from '@next/ui-base-input-runtime'
import {createModule as createAdminConsoleModule} from '@next/ui-base-admin-console'
import {createModule as createTerminalConsoleModule} from '@next/ui-base-terminal-console'
import {createModule as createTopologyRuntimeBridgeModule} from '@next/ui-base-topology-runtime-bridge'
import type {KernelRuntimeAppV2, KernelRuntimeModuleV2} from '@next/kernel-base-runtime-shell-v2'
import type {StoreEnhancer} from '@reduxjs/toolkit'
import type {AppProps} from '../types'
import {
    createAssemblyFetchTransport,
    createAssemblyPlatformPorts,
    createAssemblyTdpSyncRuntimeAssembly,
    createAssemblyTopologyInput,
} from '../platform-ports'
import {createReactotronEnhancer} from '../platform-ports/reactotronConfig'
import {moduleName} from '../moduleName'
import {createModule as createAssemblyRuntimeModule} from './createModule'
import {createAssemblyAdminConsoleInput} from './adminConsoleConfig'
import {syncHotUpdateStateFromNativeBoot} from './syncHotUpdateStateFromNativeBoot'
import { reportTerminalVersion } from './reportTerminalVersion'
import {
    createAssemblyAutomation,
    getAssemblyAdbSocketDebugConfig,
    getAssemblyAutomationHostConfig,
    resolveAssemblyAdbSocketDebugConfig,
    type AssemblyAutomationRuntime,
} from './automation'
import {
    createAssemblyTopologyBindingSource,
    shouldDisableAssemblyStatePersistence,
    type AssemblyTopologyBindingState,
    type AssemblyTopologyStorageGateSnapshot,
} from './topology'
import {getHostRuntimeReleaseInfo, setHostRuntimeReleaseInfo} from './releaseInfoContext'

export interface AssemblyRuntimeApp {
    readonly app: KernelRuntimeAppV2
    readonly automation?: AssemblyAutomationRuntime
    readonly uiRuntimeProviderProps?: Pick<
        UiRuntimeProviderProps,
        'automationBridge' | 'automationRuntimeId' | 'performAutomationAction'
    >
    start(): Promise<import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2>
}

export interface HostRuntimeActivationCapabilityConfig {
    readonly supportedProfileCodes: readonly string[]
    readonly supportedTemplateCodes?: readonly string[]
    readonly supportedCapabilities?: readonly string[]
}

const normalizeUniqueValues = (values: readonly string[] | undefined) =>
    Array.from(new Set((values ?? []).map(item => item.trim()).filter(Boolean)))

const createTerminalActivationCapability = (
    productReleaseInfo: HostRuntimeReleaseInfo,
    activationCapability: HostRuntimeActivationCapabilityConfig | undefined,
): TerminalAssemblyCapabilityManifestV1 | undefined => {
    const supportedProfileCodes = normalizeUniqueValues(activationCapability?.supportedProfileCodes)
    if (supportedProfileCodes.length === 0) {
        return undefined
    }

    const supportedTemplateCodes = normalizeUniqueValues(activationCapability?.supportedTemplateCodes)
    const supportedCapabilities = normalizeUniqueValues(activationCapability?.supportedCapabilities)

    return {
        protocolVersion: 'terminal-activation-capability-v1',
        assemblyId: productReleaseInfo.appId,
        assemblyVersion: productReleaseInfo.assemblyVersion,
        appId: productReleaseInfo.appId,
        appVersion: productReleaseInfo.runtimeVersion,
        bundleVersion: productReleaseInfo.bundleVersion,
        supportedProfileCodes,
        supportedTemplateCodes: supportedTemplateCodes.length > 0 ? supportedTemplateCodes : undefined,
        supportedCapabilities: supportedCapabilities.length > 0 ? supportedCapabilities : undefined,
    }
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
        getRuntime?: () => import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2 | undefined
        createShellModule: () => KernelRuntimeModuleV2
        extraKernelModules?: readonly KernelRuntimeModuleV2[]
        releaseInfo?: HostRuntimeReleaseInfo
        productId?: string
        activationCapability?: HostRuntimeActivationCapabilityConfig
    },
): KernelRuntimeAppV2 => {
    const httpTransport = createAssemblyFetchTransport()
    const resolveAssemblyTransportServers = (
        context?: Pick<import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2, 'getState'>,
    ) => {
        const selectedSpace = context && typeof context.getState === 'function'
            ? selectTransportSelectedServerSpace(context.getState())
            : undefined
        return resolveTransportServers(kernelBaseDevServerConfig, {
            selectedSpace: selectedSpace ?? kernelBaseDevServerConfig.selectedSpace,
            baseUrlOverrides: options.mockTerminalPlatformBaseUrl
                ? {
                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: options.mockTerminalPlatformBaseUrl,
                }
                : undefined,
        })
    }
    setHostRuntimeReleaseInfo(options.releaseInfo)
    const productReleaseInfo = getHostRuntimeReleaseInfo()
    const terminalActivationCapability = createTerminalActivationCapability(
        productReleaseInfo,
        options.activationCapability,
    )
    const tdpSyncAssembly = createAssemblyTdpSyncRuntimeAssembly({
        logger: platformPorts.logger,
        mockTerminalPlatformBaseUrl: options.mockTerminalPlatformBaseUrl,
        resolveServers: context => resolveAssemblyTransportServers(context ?? options.getRuntime?.()),
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
            createTransportRuntimeModule({serverConfig: kernelBaseDevServerConfig}),
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
                            serverProvider: () => resolveAssemblyTransportServers(context),
                            executionPolicy: {
                                retryRounds: 1,
                                failoverStrategy: 'ordered',
                            },
                        })
                    },
                    resolveClientRuntimeCapability() {
                        return terminalActivationCapability
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
                            appId: productReleaseInfo.appId,
                            platform: 'android',
                            product: options.productId ?? productReleaseInfo.appId,
                            runtimeVersion: productReleaseInfo.runtimeVersion,
                            assemblyVersion: productReleaseInfo.assemblyVersion,
                            buildNumber: productReleaseInfo.buildNumber,
                            channel: productReleaseInfo.channel,
                            capabilities: [],
                        }
                    },
                    createRestartPreparationCommand({context, releaseId, packageId, bundleVersion, mode}) {
                        return createCommand(
                            tdpSyncV2CommandDefinitions.requestHotUpdateRestartPreparation,
                            {
                                displayIndex: context.displayContext.displayIndex ?? 0,
                                releaseId,
                                packageId,
                                bundleVersion,
                                mode,
                            },
                        )
                    },
                },
            }),
            createTerminalLogUploadRuntimeModuleV2(),
            createWorkflowRuntimeModuleV2(),
            createUiRuntimeModuleV2(),
            createRuntimeReactModule(),
            createInputRuntimeModule(),
            createTopologyRuntimeBridgeModule(),
            createAdminConsoleModule(createAssemblyAdminConsoleInput({
                topology: options.topologyAdminInput,
                getRuntime: options.getRuntime,
            })),
            createTerminalConsoleModule(),
            ...(options.extraKernelModules ?? []),
            options.createShellModule(),
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
    runtime: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2,
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

export interface HostRuntimeReleaseInfo {
    readonly appId: string
    readonly assemblyVersion: string
    readonly buildNumber: number
    readonly runtimeVersion: string
    readonly bundleVersion: string
    readonly channel: string
}

export interface CreateHostRuntimeAppOptions {
    readonly createShellModule: () => KernelRuntimeModuleV2
    readonly productId?: string
    readonly releaseInfo?: HostRuntimeReleaseInfo
    readonly mockTerminalPlatformBaseUrl?: string
    readonly extraKernelModules?: readonly KernelRuntimeModuleV2[]
    readonly adbSocketDebugEnabled?: boolean
    readonly activationCapability?: HostRuntimeActivationCapabilityConfig
}


export const createApp = (
    props: AppProps,
    options: CreateHostRuntimeAppOptions,
): AssemblyRuntimeApp => {
    const environmentMode = __DEV__ ? 'DEV' : 'PROD'
    const adbSocketDebugConfig = options.adbSocketDebugEnabled === undefined
        ? getAssemblyAdbSocketDebugConfig(environmentMode)
        : resolveAssemblyAdbSocketDebugConfig({
            enabled: options.adbSocketDebugEnabled,
            environmentMode,
        })
    const topologyBindingSource = createAssemblyTopologyBindingSource(createInitialTopologyBindingState(props))
    const latestTopologyContext = createInitialTopologyContextSnapshot(props)
    let latestRuntime: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2 | undefined
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
            getRuntime: () => latestRuntime,
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
                runtime.subscribeState(() => {
                    updateTopologyRuntimeEnvironment(runtime, topologyBindingSource, latestTopologyContext)
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
