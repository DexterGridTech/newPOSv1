import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    buildHotUpdateVersionReportPayloadMock,
    createAssemblyFetchTransportMock,
    resolveTransportServersMock,
    selectTransportSelectedServerSpaceMock,
    createNativeStateStorageMock,
} = vi.hoisted(() => ({
    buildHotUpdateVersionReportPayloadMock: vi.fn(),
    createAssemblyFetchTransportMock: vi.fn(),
    resolveTransportServersMock: vi.fn(),
    selectTransportSelectedServerSpaceMock: vi.fn(() => undefined),
    createNativeStateStorageMock: vi.fn(),
}))

vi.mock('@impos2/kernel-base-tdp-sync-runtime-v2', () => ({
    buildHotUpdateVersionReportPayload: buildHotUpdateVersionReportPayloadMock,
}))

vi.mock('../../src/platform-ports', () => ({
    createAssemblyFetchTransport: createAssemblyFetchTransportMock,
}))

vi.mock('@impos2/kernel-base-transport-runtime', () => ({
    resolveTransportServers: resolveTransportServersMock,
    selectTransportSelectedServerSpace: selectTransportSelectedServerSpaceMock,
}))

vi.mock('../../src/turbomodules/stateStorage', () => ({
    createNativeStateStorage: createNativeStateStorageMock,
}))

vi.mock('@impos2/kernel-server-config-v2', () => ({
    SERVER_NAME_MOCK_TERMINAL_PLATFORM: 'mock-terminal-platform',
    kernelBaseDevServerConfig: {
        selectedSpace: 'kernel-base-dev',
        spaces: [
            {
                name: 'kernel-base-dev',
                servers: [],
            },
        ],
    },
}))

describe('assembly reportTerminalVersion', () => {
    const storageState = new Map<string, string>()

    beforeEach(() => {
        vi.clearAllMocks()
        storageState.clear()
        vi.resetModules()
        createNativeStateStorageMock.mockReturnValue({
            async getItem(key: string) {
                return storageState.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                storageState.set(key, value)
            },
            async removeItem(key: string) {
                storageState.delete(key)
            },
        })
    })

    it('uses mock-terminal-platform base url instead of topology httpBaseUrl', async () => {
        const execute = vi.fn(async () => ({
            data: {success: true},
            status: 200,
            statusText: 'OK',
            headers: {},
        }))
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveTransportServersMock.mockReturnValue([
            {
                serverName: 'mock-terminal-platform',
                addresses: [{addressName: 'local', baseUrl: 'http://127.0.0.1:5810'}],
            },
            {
                serverName: 'dual-topology-host-v3',
                addresses: [{addressName: 'local', baseUrl: 'http://127.0.0.1:8888/mockMasterServer'}],
            },
        ])
        buildHotUpdateVersionReportPayloadMock.mockReturnValue({
            terminalId: 'terminal-001',
            sandboxId: 'sandbox-001',
            payload: {
                displayIndex: 0,
                displayRole: 'primary',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.0',
                source: 'embedded',
                state: 'RUNNING',
            },
        })

        const {reportTerminalVersion} = await import('../../src/application/reportTerminalVersion')

        await reportTerminalVersion(
            {getState: () => ({})} as any,
            {
                displayIndex: 0,
                displayCount: 2,
                deviceId: 'J9RZPWR3HK',
                isEmulator: true,
                screenMode: 'desktop',
                topology: {
                    localNodeId: 'master:J9RZPWR3HK',
                    role: 'master',
                    httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
                },
            } as any,
            'RUNNING',
        )

        expect(execute).toHaveBeenCalledTimes(1)
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://127.0.0.1:5810/api/v1/terminals/terminal-001/version-reports',
            selectedAddress: expect.objectContaining({
                baseUrl: 'http://127.0.0.1:5810',
            }),
        }))
    })

    it('prefers loopback mock-terminal-platform address on emulator even when lan is listed first', async () => {
        const execute = vi.fn(async () => ({
            data: {success: true},
            status: 200,
            statusText: 'OK',
            headers: {},
        }))
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveTransportServersMock.mockReturnValue([
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {addressName: 'lan', baseUrl: 'http://192.168.0.172:5810'},
                    {addressName: 'local', baseUrl: 'http://127.0.0.1:5810'},
                    {addressName: 'localhost', baseUrl: 'http://localhost:5810'},
                ],
            },
        ])
        buildHotUpdateVersionReportPayloadMock.mockReturnValue({
            terminalId: 'terminal-001',
            sandboxId: 'sandbox-001',
            payload: {
                displayIndex: 0,
                displayRole: 'primary',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.2',
                source: 'hot-update',
                state: 'RUNNING',
            },
        })

        const {reportTerminalVersion} = await import('../../src/application/reportTerminalVersion')

        await reportTerminalVersion(
            {getState: () => ({})} as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'device-1',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'RUNNING',
        )

        expect(execute).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://127.0.0.1:5810/api/v1/terminals/terminal-001/version-reports',
            selectedAddress: expect.objectContaining({
                baseUrl: 'http://127.0.0.1:5810',
            }),
            input: expect.objectContaining({
                body: expect.not.objectContaining({
                    isEmulator: true,
                }),
            }),
        }))
    })

    it('fails over to emulator host loopback when adb reverse address is unavailable', async () => {
        const execute = vi.fn()
            .mockRejectedValueOnce(new Error('Network request failed'))
            .mockResolvedValueOnce({
                data: {success: true},
                status: 201,
                statusText: 'Created',
                headers: {},
            })
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveTransportServersMock.mockReturnValue([
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {addressName: 'local', baseUrl: 'http://127.0.0.1:5810'},
                ],
            },
        ])
        buildHotUpdateVersionReportPayloadMock.mockReturnValue({
            terminalId: 'terminal-001',
            sandboxId: 'sandbox-001',
            payload: {
                displayIndex: 0,
                displayRole: 'primary',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.3',
                source: 'hot-update',
                state: 'RUNNING',
            },
        })

        const {reportTerminalVersion} = await import('../../src/application/reportTerminalVersion')

        await reportTerminalVersion(
            {getState: () => ({})} as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'device-1',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'RUNNING',
        )

        expect(execute).toHaveBeenCalledTimes(2)
        expect(execute.mock.calls[0]?.[0]?.url).toBe(
            'http://127.0.0.1:5810/api/v1/terminals/terminal-001/version-reports',
        )
        expect(execute.mock.calls[1]?.[0]?.url).toBe(
            'http://10.0.2.2:5810/api/v1/terminals/terminal-001/version-reports',
        )
    })

    it('persists failed reports in outbox and flushes them before newer reports', async () => {
        const execute = vi.fn()
            .mockRejectedValueOnce(new Error('network down'))
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValue({
                data: {success: true},
                status: 200,
                statusText: 'OK',
                headers: {},
            })
            .mockResolvedValue({
                data: {success: true},
                status: 200,
                statusText: 'OK',
                headers: {},
            })
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveTransportServersMock.mockReturnValue([
            {
                serverName: 'mock-terminal-platform',
                addresses: [{addressName: 'local', baseUrl: 'http://127.0.0.1:5810'}],
            },
        ])
        buildHotUpdateVersionReportPayloadMock
            .mockReturnValueOnce({
                terminalId: 'terminal-001',
                sandboxId: 'sandbox-001',
                payload: {
                    displayIndex: 0,
                    displayRole: 'primary',
                    appId: 'assembly-android-mixc-retail-rn84',
                    assemblyVersion: '1.0.0',
                    buildNumber: 1,
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    bundleVersion: '1.0.0+ota.0',
                    source: 'embedded',
                    state: 'BOOTING',
                },
            })
            .mockReturnValueOnce({
                terminalId: 'terminal-001',
                sandboxId: 'sandbox-001',
                payload: {
                    displayIndex: 0,
                    displayRole: 'primary',
                    appId: 'assembly-android-mixc-retail-rn84',
                    assemblyVersion: '1.0.0',
                    buildNumber: 1,
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    bundleVersion: '1.0.0+ota.1',
                    source: 'hot-update',
                    packageId: 'pkg-1',
                    releaseId: 'rel-1',
                    state: 'RUNNING',
                },
            })

        const {reportTerminalVersion} = await import('../../src/application/reportTerminalVersion')

        await expect(reportTerminalVersion(
            {getState: () => ({})} as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'device-1',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'BOOTING',
        )).rejects.toThrow('network down')

        expect(storageState.get('hot-update:version-report-outbox')).toContain('"state":"BOOTING"')

        await reportTerminalVersion(
            {getState: () => ({})} as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'device-1',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'RUNNING',
        )

        expect(execute).toHaveBeenCalledTimes(4)
        expect(execute.mock.calls[2]?.[0]?.input?.body?.state).toBe('BOOTING')
        expect(execute.mock.calls[3]?.[0]?.input?.body?.state).toBe('RUNNING')
        expect(storageState.has('hot-update:version-report-outbox')).toBe(false)
    })

    it('reports topology-derived display roles for paired master and standalone slave', async () => {
        const execute = vi.fn(async () => ({
            data: {success: true},
            status: 200,
            statusText: 'OK',
            headers: {},
        }))
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveTransportServersMock.mockReturnValue([
            {
                serverName: 'mock-terminal-platform',
                addresses: [{addressName: 'local', baseUrl: 'http://127.0.0.1:5810'}],
            },
        ])
        buildHotUpdateVersionReportPayloadMock.mockImplementation((state: any) => ({
            terminalId: state['kernel.base.topology-runtime-v3.context']?.displayMode === 'SECONDARY'
                ? 'terminal-standalone-slave'
                : 'terminal-paired-master',
            sandboxId: 'sandbox-topology',
            payload: {
                displayIndex: state['kernel.base.topology-runtime-v3.context']?.displayIndex ?? 0,
                displayRole: state['kernel.base.topology-runtime-v3.context']?.displayMode === 'SECONDARY'
                    ? 'secondary'
                    : (
                        state['kernel.base.topology-runtime-v3.context']?.enableSlave === true
                            ? 'primary'
                            : 'single'
                    ),
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 8,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.6',
                source: 'hot-update',
                packageId: 'pkg-standalone-slave',
                releaseId: 'release-standalone-slave',
                state: 'RUNNING',
            },
        }))

        const {reportTerminalVersion} = await import('../../src/application/reportTerminalVersion')

        await reportTerminalVersion(
            {
                getState: () => ({
                    'kernel.base.topology-runtime-v3.context': {
                        displayIndex: 0,
                        displayCount: 1,
                        instanceMode: 'MASTER',
                        displayMode: 'PRIMARY',
                        workspace: 'MAIN',
                        standalone: true,
                        enableSlave: true,
                        localNodeId: 'master:primary-node',
                    },
                }),
            } as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'paired-master-device',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'RUNNING',
        )

        await reportTerminalVersion(
            {
                getState: () => ({
                    'kernel.base.topology-runtime-v3.context': {
                        displayIndex: 0,
                        displayCount: 1,
                        instanceMode: 'SLAVE',
                        displayMode: 'SECONDARY',
                        workspace: 'MAIN',
                        standalone: true,
                        enableSlave: false,
                        localNodeId: 'master:slave-node',
                    },
                }),
            } as any,
            {
                displayIndex: 0,
                displayCount: 1,
                deviceId: 'standalone-slave-device',
                isEmulator: true,
                screenMode: 'desktop',
            } as any,
            'RUNNING',
        )

        expect(execute).toHaveBeenCalledTimes(2)
        const masterRequest = (execute as any).mock.calls[0]?.[0] as any
        const slaveRequest = (execute as any).mock.calls[1]?.[0] as any
        expect(masterRequest.input.body).toMatchObject({
            displayIndex: 0,
            displayRole: 'primary',
            sandboxId: 'sandbox-topology',
            bundleVersion: '1.0.0+ota.6',
            source: 'hot-update',
        })
        expect(slaveRequest.input.body).toMatchObject({
            displayIndex: 0,
            displayRole: 'secondary',
            sandboxId: 'sandbox-topology',
            bundleVersion: '1.0.0+ota.6',
            source: 'hot-update',
        })
    })
})
