import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createKernelRuntimeAppMock,
    createTopologyRuntimeModuleV3Mock,
    createCommandMock,
    topologyRuntimeV3CommandDefinitionsMock,
    selectTopologyRuntimeV3ContextMock,
    selectTopologyRuntimeV3ConnectionMock,
    createTcpControlRuntimeModuleV2Mock,
    createTdpSyncRuntimeModuleV2Mock,
    createTransportRuntimeModuleMock,
    createUiRuntimeModuleV2Mock,
    createRuntimeReactModuleMock,
    createInputRuntimeModuleMock,
    createTopologyRuntimeBridgeModuleMock,
    createAdminConsoleModuleMock,
    createTerminalConsoleModuleMock,
    createCateringShellModuleMock,
    createAssemblyRuntimeModuleMock,
    createAssemblyAdminConsoleInputMock,
    createHttpRuntimeMock,
    resolveTransportServersMock,
    selectTransportSelectedServerSpaceMock,
    createAssemblyFetchTransportMock,
    createAssemblyPlatformPortsMock,
    createAssemblyTdpSyncRuntimeAssemblyMock,
    createAssemblyTopologyInputMock,
    createReactotronEnhancerMock,
    createAssemblyAutomationMock,
    getAssemblyAdbSocketDebugConfigMock,
    reportTerminalVersionMock,
    syncHotUpdateStateFromNativeBootMock,
    selectTdpHotUpdateCurrentMock,
    selectTcpIsActivatedMock,
    selectTcpTerminalIdMock,
    startMock,
    runtimeApp,
    topologyModule,
    transportModule,
    tcpControlModule,
    tdpSyncModule,
    uiRuntimeModule,
    runtimeReactModule,
    inputRuntimeModule,
    topologyRuntimeBridgeModule,
    adminConsoleModule,
    terminalConsoleModule,
    cateringShellModule,
} = vi.hoisted(() => {
    const startMock = vi.fn(async () => ({
        runtimeId: 'runtime-id',
    }))
    const runtimeApp = {
        start: startMock,
    }
    return {
        createKernelRuntimeAppMock: vi.fn((..._args: any[]) => runtimeApp),
        createTopologyRuntimeModuleV3Mock: vi.fn((..._args: any[]) => ({kind: 'topology-module'})),
        createCommandMock: vi.fn((definition: any, payload: any) => ({definition, payload})),
        topologyRuntimeV3CommandDefinitionsMock: {
            startTopologyConnection: {commandName: 'kernel.base.topology-runtime-v3.start-topology-connection'},
        },
        selectTopologyRuntimeV3ContextMock: vi.fn(() => null),
        selectTopologyRuntimeV3ConnectionMock: vi.fn(() => ({
            serverConnectionStatus: 'DISCONNECTED',
            reconnectAttempt: 0,
        })),
        createTcpControlRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'tcp-control-module'})),
        createTdpSyncRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'tdp-sync-module'})),
        createTransportRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'transport-module'})),
        createUiRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'ui-runtime-module'})),
        createRuntimeReactModuleMock: vi.fn((..._args: any[]) => ({kind: 'runtime-react-module'})),
        createInputRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'input-runtime-module'})),
        createTopologyRuntimeBridgeModuleMock: vi.fn((..._args: any[]) => ({kind: 'topology-runtime-bridge-module'})),
        createAdminConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'admin-console-module'})),
        createTerminalConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'terminal-console-module'})),
        createCateringShellModuleMock: vi.fn((..._args: any[]) => ({kind: 'catering-shell-module'})),
        createAssemblyRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'assembly-runtime-module'})),
        createAssemblyAdminConsoleInputMock: vi.fn(() => ({kind: 'assembly-admin-console-input'})),
        createHttpRuntimeMock: vi.fn((..._args: any[]) => ({kind: 'http-runtime'})),
        resolveTransportServersMock: vi.fn((config: any, options: any = {}) => {
            const selectedSpace = options.selectedSpace ?? config.selectedSpace
            const space = config.spaces.find((item: any) => item.name === selectedSpace)
            return space.servers.map((server: any) => {
                const baseUrlOverride = options.baseUrlOverrides?.[server.serverName]
                return {
                    ...server,
                    addresses: baseUrlOverride
                        ? [{...server.addresses[0], baseUrl: baseUrlOverride}]
                        : server.addresses,
                }
            })
        }),
        selectTransportSelectedServerSpaceMock: vi.fn((state: any) => state?.selectedServerSpace),
        createAssemblyFetchTransportMock: vi.fn((..._args: any[]) => ({kind: 'fetch-transport'})),
        createAssemblyPlatformPortsMock: vi.fn((..._args: any[]) => ({
            environmentMode: 'DEV',
            logger: {
                scope: vi.fn(() => ({
                    kind: 'scoped-logger',
                    info: vi.fn(),
                    debug: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                })),
                info: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        })),
        createAssemblyTdpSyncRuntimeAssemblyMock: vi.fn((..._args: any[]) => ({kind: 'tdp-sync-assembly'})),
        createAssemblyTopologyInputMock: vi.fn((..._args: any[]) => ({kind: 'topology-input'})),
        createReactotronEnhancerMock: vi.fn(() => ({kind: 'reactotron-enhancer'})),
        createAssemblyAutomationMock: vi.fn(() => ({
            controller: {dispatchMessage: vi.fn()},
            runtimeReactBridge: {
                registerNode: vi.fn(() => () => {}),
                updateNode: vi.fn(),
                clearVisibleContexts: vi.fn(),
                clearTarget: vi.fn(),
                performNodeAction: vi.fn(),
            },
            attachRuntime: vi.fn(() => () => {}),
            dispose: vi.fn(),
        })),
        getAssemblyAdbSocketDebugConfigMock: vi.fn((environmentMode: 'DEV' | 'PROD') => ({
            enabled: true,
            buildProfile: environmentMode === 'DEV' ? 'debug' : 'internal',
            scriptExecutionAvailable: true,
        })),
        reportTerminalVersionMock: vi.fn(async () => undefined),
        syncHotUpdateStateFromNativeBootMock: vi.fn(async () => null),
        selectTdpHotUpdateCurrentMock: vi.fn((): any => ({
            source: 'embedded',
            bundleVersion: '1.0.0+ota.0',
        })),
        selectTcpIsActivatedMock: vi.fn((): boolean => false),
        selectTcpTerminalIdMock: vi.fn((): string | null => null),
        startMock,
        runtimeApp,
        topologyModule: {kind: 'topology-module'},
        transportModule: {kind: 'transport-module'},
        tcpControlModule: {kind: 'tcp-control-module'},
        tdpSyncModule: {kind: 'tdp-sync-module'},
        uiRuntimeModule: {kind: 'ui-runtime-module'},
        runtimeReactModule: {kind: 'runtime-react-module'},
        inputRuntimeModule: {kind: 'input-runtime-module'},
        topologyRuntimeBridgeModule: {kind: 'topology-runtime-bridge-module'},
        adminConsoleModule: {kind: 'admin-console-module'},
        terminalConsoleModule: {kind: 'terminal-console-module'},
        cateringShellModule: {kind: 'catering-shell-module'},
        assemblyRuntimeModule: {kind: 'assembly-runtime-module'},
    }
})

vi.mock('@next/kernel-base-runtime-shell-v2', async importOriginal => {
    const actual = await importOriginal<typeof import('@next/kernel-base-runtime-shell-v2')>()
    return {
        ...actual,
        createKernelRuntimeApp: createKernelRuntimeAppMock,
        createCommand: createCommandMock,
    }
})

vi.mock('@next/kernel-base-topology-runtime-v3', () => ({
    createTopologyRuntimeModuleV3: createTopologyRuntimeModuleV3Mock,
    topologyRuntimeV3CommandDefinitions: topologyRuntimeV3CommandDefinitionsMock,
    selectTopologyRuntimeV3Context: selectTopologyRuntimeV3ContextMock,
    selectTopologyRuntimeV3Connection: selectTopologyRuntimeV3ConnectionMock,
}))

vi.mock('@next/kernel-base-tcp-control-runtime-v2', () => ({
    createTcpControlRuntimeModuleV2: createTcpControlRuntimeModuleV2Mock,
    selectTcpIsActivated: selectTcpIsActivatedMock,
    selectTcpTerminalId: selectTcpTerminalIdMock,
}))

vi.mock('@next/kernel-base-tdp-sync-runtime-v2', () => ({
    moduleName: 'kernel.base.tdp-sync-runtime-v2',
    createTdpSyncRuntimeModuleV2: createTdpSyncRuntimeModuleV2Mock,
    selectTdpHotUpdateCurrent: selectTdpHotUpdateCurrentMock,
    tdpSyncV2CommandDefinitions: {
        tdpTopicDataChanged: {commandName: 'kernel.base.tdp-sync-runtime-v2.tdp-topic-data-changed'},
    },
}))

vi.mock('@next/kernel-base-ui-runtime-v2', () => ({
    createUiRuntimeModuleV2: createUiRuntimeModuleV2Mock,
}))

vi.mock('@next/kernel-base-transport-runtime', () => ({
    createHttpRuntime: createHttpRuntimeMock,
    createTransportRuntimeModule: createTransportRuntimeModuleMock,
    resolveTransportServers: resolveTransportServersMock,
    selectTransportSelectedServerSpace: selectTransportSelectedServerSpaceMock,
}))

vi.mock('@next/kernel-server-config-v2', () => ({
    SERVER_NAME_MOCK_TERMINAL_PLATFORM: 'mock-terminal-platform',
    kernelBaseDevServerConfig: {
        selectedSpace: 'dev',
        spaces: [{
            name: 'dev',
            servers: [
                {
                    serverName: 'mock-terminal-platform',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://mock-terminal-platform:old'},
                        {addressName: 'secondary', baseUrl: 'http://mock-terminal-platform:secondary'},
                    ],
                },
                {
                    serverName: 'other-server',
                    addresses: [{addressName: 'primary', baseUrl: 'http://other-server'}],
                },
            ],
        }],
    },
}))

vi.mock('@next/ui-base-runtime-react', () => ({
    createModule: createRuntimeReactModuleMock,
}))

vi.mock('@next/ui-base-input-runtime', () => ({
    createModule: createInputRuntimeModuleMock,
}))

vi.mock('@next/ui-base-topology-runtime-bridge', () => ({
    createModule: createTopologyRuntimeBridgeModuleMock,
}))

vi.mock('@next/ui-base-admin-console', () => ({
    createModule: createAdminConsoleModuleMock,
}))

vi.mock('@next/ui-base-terminal-console', () => ({
    createModule: createTerminalConsoleModuleMock,
}))

vi.mock('@next/ui-integration-catering-shell', () => ({
    createModule: createCateringShellModuleMock,
}))

vi.mock('../../src/application/createModule', () => ({
    createModule: createAssemblyRuntimeModuleMock,
}))

vi.mock('../../src/application/adminConsoleConfig', () => ({
    createAssemblyAdminConsoleInput: createAssemblyAdminConsoleInputMock,
}))

vi.mock('../../src/platform-ports', () => ({
    createAssemblyFetchTransport: createAssemblyFetchTransportMock,
    createAssemblyPlatformPorts: createAssemblyPlatformPortsMock,
    createAssemblyTdpSyncRuntimeAssembly: createAssemblyTdpSyncRuntimeAssemblyMock,
    createAssemblyTopologyInput: createAssemblyTopologyInputMock,
}))

vi.mock('../../src/platform-ports/reactotronConfig', () => ({
    createReactotronEnhancer: createReactotronEnhancerMock,
}))

vi.mock('../../src/application/automation', () => ({
    createAssemblyAutomation: createAssemblyAutomationMock,
    getAssemblyAdbSocketDebugConfig: getAssemblyAdbSocketDebugConfigMock,
    getAssemblyAutomationHostConfig: (displayIndex: number) => ({
        host: '127.0.0.1',
        port: displayIndex > 0 ? 18585 : 18584,
        target: displayIndex > 0 ? 'secondary' : 'primary',
    }),
}))

vi.mock('../../src/application/reportTerminalVersion', () => ({
    reportTerminalVersion: reportTerminalVersionMock,
}))

vi.mock('../../src/application/syncHotUpdateStateFromNativeBoot', () => ({
    syncHotUpdateStateFromNativeBoot: syncHotUpdateStateFromNativeBootMock,
}))

import {createApp, type CreateHostRuntimeAppOptions} from '../../src/application/createApp'
import {releaseInfo} from '../../src/generated/releaseInfo'

const createProductApp = (props: Parameters<typeof createApp>[0], options: Partial<CreateHostRuntimeAppOptions> = {}) => createApp(props, {
    createShellModule: createCateringShellModuleMock,
    productId: 'mixc-catering',
    releaseInfo,
    ...options,
})

describe('assembly createApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(globalThis as any).__DEV__ = true
        createKernelRuntimeAppMock.mockReturnValue(runtimeApp)
        createTopologyRuntimeModuleV3Mock.mockReturnValue(topologyModule)
        createTransportRuntimeModuleMock.mockReturnValue(transportModule)
        selectTopologyRuntimeV3ContextMock.mockReturnValue(null)
        selectTopologyRuntimeV3ConnectionMock.mockReturnValue({
            serverConnectionStatus: 'DISCONNECTED',
            reconnectAttempt: 0,
        })
        createTcpControlRuntimeModuleV2Mock.mockReturnValue(tcpControlModule)
        createTdpSyncRuntimeModuleV2Mock.mockReturnValue(tdpSyncModule)
        createUiRuntimeModuleV2Mock.mockReturnValue(uiRuntimeModule)
        createRuntimeReactModuleMock.mockReturnValue(runtimeReactModule)
        createInputRuntimeModuleMock.mockReturnValue(inputRuntimeModule)
        createTopologyRuntimeBridgeModuleMock.mockReturnValue(topologyRuntimeBridgeModule)
        createAdminConsoleModuleMock.mockReturnValue(adminConsoleModule)
        createTerminalConsoleModuleMock.mockReturnValue(terminalConsoleModule)
        createCateringShellModuleMock.mockReturnValue(cateringShellModule)
        createAssemblyRuntimeModuleMock.mockReturnValue({kind: 'assembly-runtime-module'})
        createAssemblyAutomationMock.mockClear()
        getAssemblyAdbSocketDebugConfigMock.mockImplementation((environmentMode: 'DEV' | 'PROD') => ({
            enabled: true,
            buildProfile: environmentMode === 'DEV' ? 'debug' : 'internal',
            scriptExecutionAvailable: true,
        }))
        selectTcpIsActivatedMock.mockReturnValue(false)
        selectTcpTerminalIdMock.mockReturnValue(null)
        selectTdpHotUpdateCurrentMock.mockReturnValue({
            source: 'embedded',
            bundleVersion: '1.0.0+ota.0',
        })
    })

    it('assembles the retail shell into the runtime module graph', async () => {
        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                localNodeId: 'master-device-1',
                role: 'master',
            },
        }, {
            mockTerminalPlatformBaseUrl: 'http://127.0.0.1:9100',
        })

        expect(createAssemblyPlatformPortsMock).toHaveBeenCalledWith(
            'DEV',
            expect.objectContaining({
                shouldDisableStatePersistence: expect.any(Function),
            }),
        )
        expect(createAssemblyTopologyInputMock).toHaveBeenCalledTimes(1)
        expect(createKernelRuntimeAppMock).toHaveBeenCalledTimes(1)

        const runtimeCall = createKernelRuntimeAppMock.mock.calls.at(0)
        expect(runtimeCall).toBeDefined()
        const runtimeConfig = runtimeCall![0] as any
        expect(runtimeConfig.runtimeName).toBe('adapter.android.host-runtime-rn84')
        expect(runtimeConfig.localNodeId).toBe('master-device-1')
        expect(runtimeConfig.storeEnhancers).toEqual([{kind: 'reactotron-enhancer'}])
        expect(runtimeConfig.displayContext).toEqual({
            displayIndex: 0,
            displayCount: 2,
        })
        expect(runtimeConfig.modules).toEqual([
            {kind: 'assembly-runtime-module'},
            transportModule,
            topologyModule,
            tcpControlModule,
            tdpSyncModule,
            expect.objectContaining({
                moduleName: 'kernel.base.terminal-log-upload-runtime-v2',
            }),
            expect.objectContaining({
                moduleName: 'kernel.base.workflow-runtime-v2',
            }),
            uiRuntimeModule,
            runtimeReactModule,
            inputRuntimeModule,
            topologyRuntimeBridgeModule,
            adminConsoleModule,
            terminalConsoleModule,
            cateringShellModule,
        ])

        expect(createCateringShellModuleMock).toHaveBeenCalledTimes(1)
        expect(createAssemblyTdpSyncRuntimeAssemblyMock).toHaveBeenCalledWith({
            logger: expect.any(Object),
            mockTerminalPlatformBaseUrl: 'http://127.0.0.1:9100',
            resolveServers: expect.any(Function),
        })
        expect(createTdpSyncRuntimeModuleV2Mock).toHaveBeenCalledWith({
            assembly: {kind: 'tdp-sync-assembly'},
            hotUpdate: {
                getPort: expect.any(Function),
                getCurrentFacts: expect.any(Function),
                createRestartPreparationCommand: expect.any(Function),
            },
        })
        const tdpSyncInput = createTdpSyncRuntimeModuleV2Mock.mock.calls.at(0)?.[0] as any
        expect(tdpSyncInput.hotUpdate.getCurrentFacts()).toEqual({
            appId: releaseInfo.appId,
            platform: 'android',
            product: 'mixc-catering',
            runtimeVersion: releaseInfo.runtimeVersion,
            assemblyVersion: releaseInfo.assemblyVersion,
            buildNumber: releaseInfo.buildNumber,
            channel: releaseInfo.channel,
            capabilities: [],
        })
        expect(createAssemblyAdminConsoleInputMock).toHaveBeenCalledWith(
            expect.objectContaining({
                topology: expect.any(Object),
            }),
        )
        expect(createAdminConsoleModuleMock).toHaveBeenCalledWith({kind: 'assembly-admin-console-input'})
        expect(createReactotronEnhancerMock).toHaveBeenCalledWith({
            isEmulator: true,
            displayIndex: 0,
            deviceId: 'device-1',
        })
        expect(releaseInfo.appId).toBe('assembly-android-mixc-catering-rn84')

        const tcpControlCall = createTcpControlRuntimeModuleV2Mock.mock.calls.at(0)
        expect(tcpControlCall).toBeDefined()
        const tcpControlInput = tcpControlCall![0] as any
        expect(typeof tcpControlInput?.assembly?.createHttpRuntime).toBe('function')

        const scopedLogger = {kind: 'scoped-logger'}
        const scope = vi.fn(() => scopedLogger)
        tcpControlInput.assembly.createHttpRuntime({
            platformPorts: {
                logger: {scope},
            },
        })

        expect(createHttpRuntimeMock).toHaveBeenCalledTimes(1)
        const httpRuntimeCall = createHttpRuntimeMock.mock.calls.at(0)
        expect(httpRuntimeCall).toBeDefined()
        expect(httpRuntimeCall![0]).toMatchObject({
            transport: {kind: 'fetch-transport'},
            executionPolicy: {
                retryRounds: 1,
                failoverStrategy: 'ordered',
            },
        })
        expect(typeof httpRuntimeCall![0].serverProvider).toBe('function')
        expect(httpRuntimeCall![0].serverProvider()).toEqual([
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {addressName: 'primary', baseUrl: 'http://127.0.0.1:9100'},
                ],
            },
            {
                serverName: 'other-server',
                addresses: [{addressName: 'primary', baseUrl: 'http://other-server'}],
            },
        ])

        await result.start()
        expect(startMock).toHaveBeenCalledTimes(1)
        expect(getAssemblyAdbSocketDebugConfigMock).toHaveBeenCalledWith('DEV')
        expect(createAssemblyAutomationMock).toHaveBeenCalledWith(expect.objectContaining({
            buildProfile: 'debug',
            automationEnabled: true,
            scriptExecutionAvailable: true,
        }))
        expect(result.uiRuntimeProviderProps).toMatchObject({
            automationRuntimeId: 'primary-runtime',
        })
    })

    it('enables automation in production when the package switch is on', () => {
        ;(globalThis as any).__DEV__ = false

        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        expect(createAssemblyPlatformPortsMock).toHaveBeenCalledWith(
            'PROD',
            expect.objectContaining({
                shouldDisableStatePersistence: expect.any(Function),
            }),
        )
        expect(createReactotronEnhancerMock).not.toHaveBeenCalled()
        expect(getAssemblyAdbSocketDebugConfigMock).toHaveBeenCalledWith('PROD')
        expect(createAssemblyAutomationMock).toHaveBeenCalledWith(expect.objectContaining({
            buildProfile: 'internal',
            automationEnabled: true,
            scriptExecutionAvailable: true,
        }))
        expect(result.automation).toBeDefined()
        expect(result.uiRuntimeProviderProps).toMatchObject({
            automationRuntimeId: 'primary-runtime',
        })
    })

    it('does not create automation in any build when the package switch is off', () => {
        getAssemblyAdbSocketDebugConfigMock.mockReturnValue({
            enabled: false,
            buildProfile: 'product',
            scriptExecutionAvailable: false,
        })

        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        expect(createAssemblyAutomationMock).not.toHaveBeenCalled()
        expect(result.automation).toBeUndefined()
        expect(result.uiRuntimeProviderProps).toBeUndefined()
    })

    it('passes topology-aware storage gate and dynamic binding source through assembly app setup', () => {
        createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        expect(createAssemblyPlatformPortsMock).toHaveBeenCalledWith(
            'DEV',
            expect.objectContaining({
                shouldDisableStatePersistence: expect.any(Function),
            }),
        )
        expect(createAssemblyTopologyInputMock).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({
                bindingSource: expect.any(Object),
            }),
        )
        expect(createAssemblyAdminConsoleInputMock).toHaveBeenCalledWith(
            expect.objectContaining({
                topology: expect.any(Object),
            }),
        )
    })

    it('deduplicates RUNNING version reports for the same terminal/version snapshot', async () => {
        const listeners: Array<() => void> = []
        const runtime = {
            runtimeId: 'runtime-id',
            getState: vi.fn(() => ({state: true})),
            subscribeState: vi.fn((listener: () => void) => {
                listeners.push(listener)
                return () => {}
            }),
        }
        startMock.mockResolvedValueOnce(runtime as any)
        selectTcpIsActivatedMock.mockReturnValue(true)
        selectTcpTerminalIdMock.mockReturnValue('terminal-1')
        selectTdpHotUpdateCurrentMock.mockReturnValue({
            source: 'hot-update',
            bundleVersion: '1.0.0+ota.9',
            packageId: 'pkg-1',
            releaseId: 'rel-1',
        })

        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        await result.start()
        listeners.forEach(listener => listener())
        listeners.forEach(listener => listener())

        expect(reportTerminalVersionMock).toHaveBeenCalledTimes(2)
        expect((reportTerminalVersionMock.mock.calls[0] as unknown[] | undefined)?.[2]).toBe('BOOTING')
        expect((reportTerminalVersionMock.mock.calls[1] as unknown[] | undefined)?.[2]).toBe('RUNNING')
    })

    it('does not own topology host lifecycle decisions in assembly createApp', async () => {
        const listeners: Array<() => void> = []
        let currentContext: any = {
            instanceMode: 'MASTER',
            enableSlave: false,
        }
        const runtime = {
            runtimeId: 'runtime-id',
            getState: vi.fn(() => ({state: true})),
            dispatchCommand: vi.fn(async () => ({status: 'COMPLETED'})),
            subscribeState: vi.fn((listener: () => void) => {
                listeners.push(listener)
                return () => {}
            }),
        }
        startMock.mockResolvedValueOnce(runtime as any)
        selectTopologyRuntimeV3ContextMock.mockImplementation(() => currentContext)

        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        await result.start()

        currentContext = {
            instanceMode: 'MASTER',
            enableSlave: true,
        }
        listeners.forEach(listener => listener())
        expect(runtime.dispatchCommand).not.toHaveBeenCalledWith({
            definition: topologyRuntimeV3CommandDefinitionsMock.startTopologyConnection,
            payload: {},
        })
    })

    it('does not auto-start standalone slave topology connection from assembly createApp', async () => {
        const listeners: Array<() => void> = []
        const runtime = {
            runtimeId: 'runtime-id',
            getState: vi.fn(() => ({state: true})),
            dispatchCommand: vi.fn(async () => ({status: 'COMPLETED'})),
            subscribeState: vi.fn((listener: () => void) => {
                listeners.push(listener)
                return () => {}
            }),
        }
        startMock.mockResolvedValueOnce(runtime as any)
        selectTopologyRuntimeV3ContextMock.mockImplementation(() => ({
            displayIndex: 0,
            displayCount: 1,
            instanceMode: 'SLAVE',
            displayMode: 'SECONDARY',
            workspace: 'BRANCH',
            standalone: true,
            enableSlave: false,
            localNodeId: 'slave-local-node',
            masterLocator: {
                masterNodeId: 'master-node-001',
                masterDeviceId: 'master-device-001',
                httpBaseUrl: 'http://127.0.0.1:18889/mockMasterServer',
                serverAddress: [{address: 'ws://127.0.0.1:18889/mockMasterServer/ws'}],
                addedAt: 1776811534054,
            },
        } as any))
        selectTopologyRuntimeV3ConnectionMock.mockReturnValue({
            serverConnectionStatus: 'DISCONNECTED',
            reconnectAttempt: 0,
        })

        const result = createProductApp({
            deviceId: 'device-slave-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        await result.start()
        expect(runtime.dispatchCommand).not.toHaveBeenCalledWith({
            definition: topologyRuntimeV3CommandDefinitionsMock.startTopologyConnection,
            payload: {},
        })

        const dispatchCallsAfterStart = runtime.dispatchCommand.mock.calls.length
        listeners.forEach(listener => listener())
        listeners.forEach(listener => listener())
        await vi.waitFor(() => {
            expect(runtime.dispatchCommand.mock.calls.length).toBe(dispatchCallsAfterStart)
        })
    })

    it('reports FAILED when native hot-update boot sync fails after runtime start', async () => {
        const runtime = {
            runtimeId: 'runtime-id',
            getState: vi.fn(() => ({state: true})),
            subscribeState: vi.fn(() => () => {}),
        }
        startMock.mockResolvedValueOnce(runtime as any)
        syncHotUpdateStateFromNativeBootMock.mockRejectedValueOnce(new Error('native boot sync failed'))

        const result = createProductApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        await expect(result.start()).rejects.toThrow('native boot sync failed')

        expect(reportTerminalVersionMock).toHaveBeenCalledTimes(1)
        expect((reportTerminalVersionMock.mock.calls[0] as unknown[] | undefined)?.[2]).toBe('FAILED')
        expect((reportTerminalVersionMock.mock.calls[0] as unknown[] | undefined)?.[3]).toBe('native boot sync failed')
    })
})
