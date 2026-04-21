import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createKernelRuntimeAppMock,
    createTopologyRuntimeModuleV3Mock,
    createCommandMock,
    topologyRuntimeV3CommandDefinitionsMock,
    selectTopologyRuntimeV3ContextMock,
    createTcpControlRuntimeModuleV2Mock,
    createTdpSyncRuntimeModuleV2Mock,
    createUiRuntimeModuleV2Mock,
    createRuntimeReactModuleMock,
    createInputRuntimeModuleMock,
    createAdminConsoleModuleMock,
    createTerminalConsoleModuleMock,
    createRetailShellModuleMock,
    createAssemblyRuntimeModuleMock,
    createAssemblyAdminConsoleInputMock,
    createHttpRuntimeMock,
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
    nativeTopologyHostStartMock,
    nativeTopologyHostStopMock,
    startMock,
    runtimeApp,
    topologyModule,
    tcpControlModule,
    tdpSyncModule,
    uiRuntimeModule,
    runtimeReactModule,
    inputRuntimeModule,
    adminConsoleModule,
    terminalConsoleModule,
    retailShellModule,
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
        createTcpControlRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'tcp-control-module'})),
        createTdpSyncRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'tdp-sync-module'})),
        createUiRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'ui-runtime-module'})),
        createRuntimeReactModuleMock: vi.fn((..._args: any[]) => ({kind: 'runtime-react-module'})),
        createInputRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'input-runtime-module'})),
        createAdminConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'admin-console-module'})),
        createTerminalConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'terminal-console-module'})),
        createRetailShellModuleMock: vi.fn((..._args: any[]) => ({kind: 'retail-shell-module'})),
        createAssemblyRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'assembly-runtime-module'})),
        createAssemblyAdminConsoleInputMock: vi.fn(() => ({kind: 'assembly-admin-console-input'})),
        createHttpRuntimeMock: vi.fn((..._args: any[]) => ({kind: 'http-runtime'})),
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
        nativeTopologyHostStartMock: vi.fn(async () => ({
            httpBaseUrl: 'http://127.0.0.1:9999/mockMasterServer',
            wsUrl: 'ws://127.0.0.1:9999/mockMasterServer/ws',
        })),
        nativeTopologyHostStopMock: vi.fn(async () => undefined),
        startMock,
        runtimeApp,
        topologyModule: {kind: 'topology-module'},
        tcpControlModule: {kind: 'tcp-control-module'},
        tdpSyncModule: {kind: 'tdp-sync-module'},
        uiRuntimeModule: {kind: 'ui-runtime-module'},
        runtimeReactModule: {kind: 'runtime-react-module'},
        inputRuntimeModule: {kind: 'input-runtime-module'},
        adminConsoleModule: {kind: 'admin-console-module'},
        terminalConsoleModule: {kind: 'terminal-console-module'},
        retailShellModule: {kind: 'retail-shell-module'},
        assemblyRuntimeModule: {kind: 'assembly-runtime-module'},
    }
})

vi.mock('@impos2/kernel-base-runtime-shell-v2', async importOriginal => {
    const actual = await importOriginal<typeof import('@impos2/kernel-base-runtime-shell-v2')>()
    return {
        ...actual,
        createKernelRuntimeApp: createKernelRuntimeAppMock,
        createCommand: createCommandMock,
    }
})

vi.mock('@impos2/kernel-base-topology-runtime-v3', () => ({
    createTopologyRuntimeModuleV3: createTopologyRuntimeModuleV3Mock,
    topologyRuntimeV3CommandDefinitions: topologyRuntimeV3CommandDefinitionsMock,
    selectTopologyRuntimeV3Context: selectTopologyRuntimeV3ContextMock,
}))

vi.mock('@impos2/kernel-base-tcp-control-runtime-v2', () => ({
    createTcpControlRuntimeModuleV2: createTcpControlRuntimeModuleV2Mock,
    selectTcpIsActivated: selectTcpIsActivatedMock,
    selectTcpTerminalId: selectTcpTerminalIdMock,
}))

vi.mock('@impos2/kernel-base-tdp-sync-runtime-v2', () => ({
    moduleName: 'kernel.base.tdp-sync-runtime-v2',
    createTdpSyncRuntimeModuleV2: createTdpSyncRuntimeModuleV2Mock,
    selectTdpHotUpdateCurrent: selectTdpHotUpdateCurrentMock,
    tdpSyncV2CommandDefinitions: {
        tdpTopicDataChanged: {commandName: 'kernel.base.tdp-sync-runtime-v2.tdp-topic-data-changed'},
    },
}))

vi.mock('@impos2/kernel-base-ui-runtime-v2', () => ({
    createUiRuntimeModuleV2: createUiRuntimeModuleV2Mock,
}))

vi.mock('@impos2/kernel-base-transport-runtime', () => ({
    createHttpRuntime: createHttpRuntimeMock,
}))

vi.mock('@impos2/kernel-server-config-v2', () => ({
    SERVER_NAME_MOCK_TERMINAL_PLATFORM: 'mock-terminal-platform',
    kernelBaseDevServerConfig: {
        selectedSpace: 'dev',
        spaces: [{
            name: 'dev',
            servers: [
                {
                    serverName: 'mock-terminal-platform',
                    addresses: [
                        {name: 'primary', baseUrl: 'http://mock-terminal-platform:old'},
                        {name: 'secondary', baseUrl: 'http://mock-terminal-platform:secondary'},
                    ],
                },
                {
                    serverName: 'other-server',
                    addresses: [{name: 'primary', baseUrl: 'http://other-server'}],
                },
            ],
        }],
    },
}))

vi.mock('@impos2/ui-base-runtime-react', () => ({
    createModule: createRuntimeReactModuleMock,
}))

vi.mock('@impos2/ui-base-input-runtime', () => ({
    createModule: createInputRuntimeModuleMock,
}))

vi.mock('@impos2/ui-base-admin-console', () => ({
    createModule: createAdminConsoleModuleMock,
}))

vi.mock('@impos2/ui-base-terminal-console', () => ({
    createModule: createTerminalConsoleModuleMock,
}))

vi.mock('@impos2/ui-integration-retail-shell', () => ({
    createModule: createRetailShellModuleMock,
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

vi.mock('../../src/turbomodules/topologyHost', () => ({
    nativeTopologyHost: {
        start: nativeTopologyHostStartMock,
        stop: nativeTopologyHostStopMock,
    },
}))

import {createApp} from '../../src/application/createApp'
import {releaseInfo} from '../../src/generated/releaseInfo'

describe('assembly createApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(globalThis as any).__DEV__ = true
        createKernelRuntimeAppMock.mockReturnValue(runtimeApp)
        createTopologyRuntimeModuleV3Mock.mockReturnValue(topologyModule)
        selectTopologyRuntimeV3ContextMock.mockReturnValue(null)
        createTcpControlRuntimeModuleV2Mock.mockReturnValue(tcpControlModule)
        createTdpSyncRuntimeModuleV2Mock.mockReturnValue(tdpSyncModule)
        createUiRuntimeModuleV2Mock.mockReturnValue(uiRuntimeModule)
        createRuntimeReactModuleMock.mockReturnValue(runtimeReactModule)
        createInputRuntimeModuleMock.mockReturnValue(inputRuntimeModule)
        createAdminConsoleModuleMock.mockReturnValue(adminConsoleModule)
        createTerminalConsoleModuleMock.mockReturnValue(terminalConsoleModule)
        createRetailShellModuleMock.mockReturnValue(retailShellModule)
        createAssemblyRuntimeModuleMock.mockReturnValue({kind: 'assembly-runtime-module'})
        createAssemblyAutomationMock.mockClear()
        getAssemblyAdbSocketDebugConfigMock.mockImplementation((environmentMode: 'DEV' | 'PROD') => ({
            enabled: true,
            buildProfile: environmentMode === 'DEV' ? 'debug' : 'internal',
            scriptExecutionAvailable: true,
        }))
        selectTcpIsActivatedMock.mockReturnValue(false)
        selectTcpTerminalIdMock.mockReturnValue(null)
        nativeTopologyHostStartMock.mockClear()
        nativeTopologyHostStopMock.mockClear()
        selectTdpHotUpdateCurrentMock.mockReturnValue({
            source: 'embedded',
            bundleVersion: '1.0.0+ota.0',
        })
    })

    it('assembles the retail shell into the runtime module graph', async () => {
        const result = createApp({
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
        expect(runtimeConfig.runtimeName).toBe('assembly.android.mixc-retail-rn84')
        expect(runtimeConfig.localNodeId).toBe('master-device-1')
        expect(runtimeConfig.storeEnhancers).toEqual([{kind: 'reactotron-enhancer'}])
        expect(runtimeConfig.displayContext).toEqual({
            displayIndex: 0,
            displayCount: 2,
        })
        expect(runtimeConfig.modules).toEqual([
            {kind: 'assembly-runtime-module'},
            topologyModule,
            tcpControlModule,
            tdpSyncModule,
            expect.objectContaining({
                moduleName: 'kernel.base.workflow-runtime-v2',
            }),
            uiRuntimeModule,
            runtimeReactModule,
            inputRuntimeModule,
            adminConsoleModule,
            terminalConsoleModule,
            retailShellModule,
        ])

        expect(createRetailShellModuleMock).toHaveBeenCalledTimes(1)
        expect(createAssemblyTdpSyncRuntimeAssemblyMock).toHaveBeenCalledWith({
            logger: expect.any(Object),
            mockTerminalPlatformBaseUrl: 'http://127.0.0.1:9100',
        })
        expect(createTdpSyncRuntimeModuleV2Mock).toHaveBeenCalledWith({
            assembly: {kind: 'tdp-sync-assembly'},
            hotUpdate: {
                getPort: expect.any(Function),
                getCurrentFacts: expect.any(Function),
                prepareRestart: expect.any(Function),
            },
        })
        const tdpSyncInput = createTdpSyncRuntimeModuleV2Mock.mock.calls.at(0)?.[0] as any
        expect(tdpSyncInput.hotUpdate.getCurrentFacts()).toEqual({
            appId: releaseInfo.appId,
            platform: 'android',
            product: 'mixc-retail',
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
        expect(releaseInfo.appId).toBe('assembly-android-mixc-retail-rn84')

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
                    {name: 'primary', baseUrl: 'http://127.0.0.1:9100'},
                    {name: 'secondary', baseUrl: 'http://mock-terminal-platform:secondary'},
                ],
            },
            {
                serverName: 'other-server',
                addresses: [{name: 'primary', baseUrl: 'http://other-server'}],
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

        const result = createApp({
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

        const result = createApp({
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
        createApp({
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

        const result = createApp({
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

    it('starts and stops native topology host from topology context subscription', async () => {
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

        const result = createApp({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        })

        await result.start()
        expect(nativeTopologyHostStartMock).not.toHaveBeenCalled()
        expect(nativeTopologyHostStopMock).not.toHaveBeenCalled()

        currentContext = {
            instanceMode: 'MASTER',
            enableSlave: true,
        }
        listeners.forEach(listener => listener())
        await vi.waitFor(() => {
            expect(nativeTopologyHostStartMock).toHaveBeenCalledWith({
                displayCount: 1,
                displayIndex: 0,
                deviceId: 'device-1',
            })
        })
        expect(runtime.dispatchCommand).toHaveBeenCalledWith({
            definition: topologyRuntimeV3CommandDefinitionsMock.startTopologyConnection,
            payload: {},
        })

        currentContext = {
            instanceMode: 'SLAVE',
            enableSlave: true,
        }
        listeners.forEach(listener => listener())
        await vi.waitFor(() => {
            expect(nativeTopologyHostStopMock).toHaveBeenCalledTimes(1)
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

        const result = createApp({
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
