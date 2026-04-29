import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createCommandMock,
    topologyCommandDefinitions,
    nativeTopologyHostGetDiagnosticsSnapshotMock,
    nativeTopologyHostGetStatusMock,
    nativeLoggerLogMock,
    nativeAppControlRestartAppMock,
    nativeAppControlIsFullScreenMock,
    nativeAppControlIsAppLockedMock,
    nativeAppControlSetFullScreenMock,
    nativeAppControlSetAppLockedMock,
    createAssemblyStateStorageMock,
    createAssemblyHotUpdatePortMock,
    selectTransportServerSpaceStateMock,
} = vi.hoisted(() => ({
    createCommandMock: vi.fn((definition, payload) => ({
        definition,
        payload,
    })),
    topologyCommandDefinitions: {
        setInstanceMode: {commandName: 'kernel.base.topology-runtime-v3.set-instance-mode'},
        requestPowerDisplayModeSwitchConfirmation: {
            commandName: 'kernel.base.topology-runtime-v3.request-power-display-mode-switch-confirmation',
        },
        confirmPowerDisplayModeSwitch: {
            commandName: 'kernel.base.topology-runtime-v3.confirm-power-display-mode-switch',
        },
        setMasterLocator: {commandName: 'kernel.base.topology-runtime-v3.set-master-locator'},
        clearMasterLocator: {commandName: 'kernel.base.topology-runtime-v3.clear-master-locator'},
        restartTopologyConnection: {commandName: 'kernel.base.topology-runtime-v3.restart-topology-connection'},
        setEnableSlave: {commandName: 'kernel.base.topology-runtime-v3.set-enable-slave'},
    },
    nativeTopologyHostGetDiagnosticsSnapshotMock: vi.fn(async () => null),
    nativeTopologyHostGetStatusMock: vi.fn(async () => ({
        addressInfo: {
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
        },
    })),
    nativeLoggerLogMock: vi.fn(),
    nativeAppControlRestartAppMock: vi.fn(async () => undefined),
    nativeAppControlIsFullScreenMock: vi.fn(async () => false),
    nativeAppControlIsAppLockedMock: vi.fn(async () => false),
    nativeAppControlSetFullScreenMock: vi.fn(async () => undefined),
    nativeAppControlSetAppLockedMock: vi.fn(async () => undefined),
    createAssemblyStateStorageMock: vi.fn(() => ({
        clear: vi.fn(async () => undefined),
    })),
    createAssemblyHotUpdatePortMock: vi.fn(() => ({
        readBootMarker: vi.fn(async () => null),
        readActiveMarker: vi.fn(async () => null),
        readRollbackMarker: vi.fn(async () => null),
        clearBootMarker: vi.fn(async () => undefined),
    })),
    selectTransportServerSpaceStateMock: vi.fn((state: any) => state?.transportServerSpace),
}))

vi.mock('@next/kernel-base-runtime-shell-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@next/kernel-base-runtime-shell-v2')>(),
    createCommand: createCommandMock,
}))

vi.mock('@next/kernel-base-topology-runtime-v3', async importOriginal => ({
    ...await importOriginal<typeof import('@next/kernel-base-topology-runtime-v3')>(),
    topologyRuntimeV3CommandDefinitions: topologyCommandDefinitions,
}))

vi.mock('@next/kernel-base-transport-runtime', async importOriginal => ({
    ...await importOriginal<typeof import('@next/kernel-base-transport-runtime')>(),
    selectTransportServerSpaceState: selectTransportServerSpaceStateMock,
}))

vi.mock('@next/kernel-server-config-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@next/kernel-server-config-v2')>(),
    kernelBaseDevServerConfig: {
        selectedSpace: 'kernel-base-dev',
        spaces: [
            {name: 'kernel-base-dev', servers: []},
            {name: 'kernel-base-uat', servers: []},
        ],
    },
}))

vi.mock('../../src/turbomodules/topologyHost', () => ({
    nativeTopologyHost: {
        getDiagnosticsSnapshot: nativeTopologyHostGetDiagnosticsSnapshotMock,
        getStatus: nativeTopologyHostGetStatusMock,
    },
}))

vi.mock('../../src/turbomodules/logger', () => ({
    nativeLogger: {
        log: nativeLoggerLogMock,
        getLogFiles: vi.fn(async () => []),
        getLogContent: vi.fn(async () => ''),
        deleteLogFile: vi.fn(async () => undefined),
        clearAllLogs: vi.fn(async () => undefined),
        getLogDirPath: vi.fn(async () => '/tmp'),
    },
}))

vi.mock('../../src/turbomodules/appControl', () => ({
    nativeAppControl: {
        restartApp: nativeAppControlRestartAppMock,
        isFullScreen: nativeAppControlIsFullScreenMock,
        isAppLocked: nativeAppControlIsAppLockedMock,
        setFullScreen: nativeAppControlSetFullScreenMock,
        setAppLocked: nativeAppControlSetAppLockedMock,
    },
}))

vi.mock('../../src/turbomodules/connector', () => ({
    nativeConnector: {
        isAvailable: vi.fn(async () => false),
        getAvailableTargets: vi.fn(async () => []),
    },
}))

vi.mock('../../src/turbomodules/device', () => ({
    nativeDevice: {
        getModel: vi.fn(async () => 'Mixc Catering Android RN84'),
        getDeviceInfo: vi.fn(async () => ({id: 'DEVICE-001'})),
        getSystemStatus: vi.fn(async () => ({ok: true})),
    },
}))

vi.mock('../../src/turbomodules/scripts', () => ({
    nativeScriptExecutor: {
        execute: vi.fn(async () => 5),
    },
}))

vi.mock('../../src/platform-ports/stateStorage', () => ({
    createAssemblyStateStorage: createAssemblyStateStorageMock,
}))

vi.mock('../../src/platform-ports/hotUpdate', () => ({
    createAssemblyHotUpdatePort: createAssemblyHotUpdatePortMock,
}))

import {createAssemblyAdminConsoleInput} from '../../src/application/adminConsoleConfig'

describe('assembly admin console config', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllGlobals()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('imports topology share payload by switching to slave before writing master locator', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))
        const bindingSource = {
            get: vi.fn(() => ({
                role: 'master' as const,
                localNodeId: 'local:device',
            })),
            set: vi.fn(),
            clear: vi.fn(),
            resolveServer: vi.fn(() => undefined),
        }
        const input = createAssemblyAdminConsoleInput({
            topology: {
                bindingSource,
                getRuntime: () => ({
                    dispatchCommand,
                } as any),
            },
        })

        await input.hostToolSources?.topology?.importSharePayload?.({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'master:MASTER-001',
            wsUrl: 'ws://127.0.0.1:18889/mockMasterServer/ws',
        })

        expect(bindingSource.set).toHaveBeenCalledWith(expect.objectContaining({
            role: 'slave',
            masterDeviceId: 'MASTER-001',
            masterNodeId: 'master:MASTER-001',
            wsUrl: 'ws://127.0.0.1:18889/mockMasterServer/ws',
        }))
        expect((dispatchCommand.mock.calls as any[]).map(call => call[0])).toEqual([
            {
                definition: topologyCommandDefinitions.setInstanceMode,
                payload: {
                    instanceMode: 'SLAVE',
                },
            },
            {
                definition: topologyCommandDefinitions.setMasterLocator,
                payload: {
                    masterLocator: {
                        masterDeviceId: 'MASTER-001',
                        masterNodeId: 'master:MASTER-001',
                        serverAddress: [{address: 'ws://127.0.0.1:18889/mockMasterServer/ws'}],
                        httpBaseUrl: 'http://127.0.0.1:18889/mockMasterServer',
                        addedAt: expect.any(Number),
                    },
                },
            },
        ])
    })

    it('exposes server space snapshot without owning the switch orchestration', async () => {
        const input = createAssemblyAdminConsoleInput({
            getRuntime: () => ({
                getState: () => ({
                    transportServerSpace: {
                        selectedSpace: 'kernel-base-uat',
                        availableSpaces: ['kernel-base-dev', 'kernel-base-uat'],
                    },
                }),
            } as any),
        })

        const snapshot = await input.hostToolSources?.control?.getServerSpaceSnapshot?.()

        expect(input.hostToolSources?.control).not.toHaveProperty('switchServerSpace')
        expect(nativeAppControlRestartAppMock).not.toHaveBeenCalled()
        expect(snapshot).toEqual({
            selectedSpace: 'kernel-base-uat',
            availableSpaces: ['kernel-base-dev', 'kernel-base-uat'],
        })
    })

    it('falls back to static server space config before runtime is available', async () => {
        const input = createAssemblyAdminConsoleInput()

        await expect(input.hostToolSources?.control?.getServerSpaceSnapshot?.()).resolves.toEqual({
            selectedSpace: 'kernel-base-dev',
            availableSpaces: ['kernel-base-dev', 'kernel-base-uat'],
        })
    })

    it('exposes a TDP operations host backed by the mock terminal platform base url', async () => {
        const fetchMock = vi.fn(async (url: string) => ({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                success: true,
                data: {
                    mode: 'server-enhanced',
                    terminal: {
                        terminalId: 'terminal-001',
                        sandboxId: 'sandbox-001',
                    },
                },
            }),
        }))
        vi.stubGlobal('fetch', fetchMock)
        const input = createAssemblyAdminConsoleInput({
            mockTerminalPlatformBaseUrl: 'http://127.0.0.1:5810',
        })

        await expect(input.hostToolSources?.tdp?.getOperationsSnapshot({
            sandboxId: 'sandbox-001',
            terminalId: 'terminal-001',
        })).resolves.toMatchObject({
            mode: 'server-enhanced',
            terminal: {
                terminalId: 'terminal-001',
                sandboxId: 'sandbox-001',
            },
        })

        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:5810/api/v1/admin/tdp/terminals/terminal-001/operations-snapshot?sandboxId=sandbox-001',
            {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                },
            },
        )
    })
})
