import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    buildHotUpdateVersionReportPayloadMock,
    createAssemblyFetchTransportMock,
    resolveAssemblyTransportServersMock,
} = vi.hoisted(() => ({
    buildHotUpdateVersionReportPayloadMock: vi.fn(),
    createAssemblyFetchTransportMock: vi.fn(),
    resolveAssemblyTransportServersMock: vi.fn(),
}))

vi.mock('@impos2/kernel-base-tdp-sync-runtime-v2', () => ({
    buildHotUpdateVersionReportPayload: buildHotUpdateVersionReportPayloadMock,
}))

vi.mock('../../src/platform-ports', () => ({
    createAssemblyFetchTransport: createAssemblyFetchTransportMock,
    resolveAssemblyTransportServers: resolveAssemblyTransportServersMock,
}))

vi.mock('@impos2/kernel-server-config-v2', () => ({
    SERVER_NAME_MOCK_TERMINAL_PLATFORM: 'mock-terminal-platform',
}))

describe('assembly reportTerminalVersion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses mock-terminal-platform base url instead of topology httpBaseUrl', async () => {
        const execute = vi.fn(async () => ({
            data: {success: true},
            status: 200,
            statusText: 'OK',
            headers: {},
        }))
        createAssemblyFetchTransportMock.mockReturnValue({execute})
        resolveAssemblyTransportServersMock.mockReturnValue([
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
})
