import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createKernelRuntimeAppMock,
    createTopologyRuntimeModuleV2Mock,
    createTcpControlRuntimeModuleV2Mock,
    createUiRuntimeModuleV2Mock,
    createRuntimeReactModuleMock,
    createInputRuntimeModuleMock,
    createAdminConsoleModuleMock,
    createTerminalConsoleModuleMock,
    createRetailShellModuleMock,
    createHttpRuntimeMock,
    createAssemblyFetchTransportMock,
    createAssemblyPlatformPortsMock,
    createAssemblyTopologyInputMock,
    startMock,
    runtimeApp,
    topologyModule,
    tcpControlModule,
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
        createTopologyRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'topology-module'})),
        createTcpControlRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'tcp-control-module'})),
        createUiRuntimeModuleV2Mock: vi.fn((..._args: any[]) => ({kind: 'ui-runtime-module'})),
        createRuntimeReactModuleMock: vi.fn((..._args: any[]) => ({kind: 'runtime-react-module'})),
        createInputRuntimeModuleMock: vi.fn((..._args: any[]) => ({kind: 'input-runtime-module'})),
        createAdminConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'admin-console-module'})),
        createTerminalConsoleModuleMock: vi.fn((..._args: any[]) => ({kind: 'terminal-console-module'})),
        createRetailShellModuleMock: vi.fn((..._args: any[]) => ({kind: 'retail-shell-module'})),
        createHttpRuntimeMock: vi.fn((..._args: any[]) => ({kind: 'http-runtime'})),
        createAssemblyFetchTransportMock: vi.fn((..._args: any[]) => ({kind: 'fetch-transport'})),
        createAssemblyPlatformPortsMock: vi.fn((..._args: any[]) => ({
            environmentMode: 'DEV',
            logger: {
                scope: vi.fn(() => ({kind: 'scoped-logger'})),
            },
        })),
        createAssemblyTopologyInputMock: vi.fn((..._args: any[]) => ({kind: 'topology-input'})),
        startMock,
        runtimeApp,
        topologyModule: {kind: 'topology-module'},
        tcpControlModule: {kind: 'tcp-control-module'},
        uiRuntimeModule: {kind: 'ui-runtime-module'},
        runtimeReactModule: {kind: 'runtime-react-module'},
        inputRuntimeModule: {kind: 'input-runtime-module'},
        adminConsoleModule: {kind: 'admin-console-module'},
        terminalConsoleModule: {kind: 'terminal-console-module'},
        retailShellModule: {kind: 'retail-shell-module'},
    }
})

vi.mock('@impos2/kernel-base-runtime-shell-v2', () => ({
    createKernelRuntimeApp: createKernelRuntimeAppMock,
}))

vi.mock('@impos2/kernel-base-topology-runtime-v2', () => ({
    createTopologyRuntimeModuleV2: createTopologyRuntimeModuleV2Mock,
}))

vi.mock('@impos2/kernel-base-tcp-control-runtime-v2', () => ({
    createTcpControlRuntimeModuleV2: createTcpControlRuntimeModuleV2Mock,
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

vi.mock('../../src/platform-ports', () => ({
    createAssemblyFetchTransport: createAssemblyFetchTransportMock,
    createAssemblyPlatformPorts: createAssemblyPlatformPortsMock,
    createAssemblyTopologyInput: createAssemblyTopologyInputMock,
}))

import {createApp} from '../../src/application/createApp'

describe('assembly createApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(globalThis as any).__DEV__ = true
        createKernelRuntimeAppMock.mockReturnValue(runtimeApp)
        createTopologyRuntimeModuleV2Mock.mockReturnValue(topologyModule)
        createTcpControlRuntimeModuleV2Mock.mockReturnValue(tcpControlModule)
        createUiRuntimeModuleV2Mock.mockReturnValue(uiRuntimeModule)
        createRuntimeReactModuleMock.mockReturnValue(runtimeReactModule)
        createInputRuntimeModuleMock.mockReturnValue(inputRuntimeModule)
        createAdminConsoleModuleMock.mockReturnValue(adminConsoleModule)
        createTerminalConsoleModuleMock.mockReturnValue(terminalConsoleModule)
        createRetailShellModuleMock.mockReturnValue(retailShellModule)
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

        expect(createAssemblyPlatformPortsMock).toHaveBeenCalledWith('DEV')
        expect(createAssemblyTopologyInputMock).toHaveBeenCalledTimes(1)
        expect(createKernelRuntimeAppMock).toHaveBeenCalledTimes(1)

        const runtimeCall = createKernelRuntimeAppMock.mock.calls.at(0)
        expect(runtimeCall).toBeDefined()
        const runtimeConfig = runtimeCall![0] as any
        expect(runtimeConfig.runtimeName).toBe('assembly.android.mixc-retail-rn84')
        expect(runtimeConfig.localNodeId).toBe('master-device-1')
        expect(runtimeConfig.displayContext).toEqual({
            displayIndex: 0,
            displayCount: 2,
        })
        expect(runtimeConfig.modules).toEqual([
            topologyModule,
            tcpControlModule,
            uiRuntimeModule,
            runtimeReactModule,
            inputRuntimeModule,
            adminConsoleModule,
            terminalConsoleModule,
            retailShellModule,
        ])

        expect(createRetailShellModuleMock).toHaveBeenCalledTimes(1)

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
            servers: [
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
            ],
        })

        await result.start()
        expect(startMock).toHaveBeenCalledTimes(1)
    })
})
