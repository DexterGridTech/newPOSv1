import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {AdapterDiagnosticScenario} from '@impos2/ui-base-admin-console/types'

const {
    nativeLoggerLogMock,
    nativeLoggerGetLogFilesMock,
    nativeLoggerGetLogContentMock,
    nativeLoggerDeleteLogFileMock,
    nativeLoggerClearAllLogsMock,
    nativeLoggerGetLogDirPathMock,
    nativeAppControlRestartAppMock,
    nativeAppControlIsFullScreenMock,
    nativeAppControlIsAppLockedMock,
    nativeAppControlSetFullScreenMock,
    nativeAppControlSetAppLockedMock,
    nativeConnectorIsAvailableMock,
    nativeConnectorGetAvailableTargetsMock,
    nativeDeviceGetDeviceInfoMock,
    nativeDeviceGetSystemStatusMock,
    nativeTopologyHostGetStatusMock,
    nativeScriptExecuteMock,
    createAssemblyStateStorageMock,
    setAssemblySelectedServerSpaceMock,
    getAssemblyServerSpaceSnapshotMock,
} = vi.hoisted(() => ({
    nativeLoggerLogMock: vi.fn(),
    nativeLoggerGetLogFilesMock: vi.fn(async () => [{fileName: 'assembly.log'}]),
    nativeLoggerGetLogContentMock: vi.fn(async () => 'log-content'),
    nativeLoggerDeleteLogFileMock: vi.fn(async () => true),
    nativeLoggerClearAllLogsMock: vi.fn(async () => true),
    nativeLoggerGetLogDirPathMock: vi.fn(async () => '/tmp/logs'),
    nativeAppControlRestartAppMock: vi.fn(async () => undefined),
    nativeAppControlIsFullScreenMock: vi.fn(async () => false),
    nativeAppControlIsAppLockedMock: vi.fn(async () => false),
    nativeAppControlSetFullScreenMock: vi.fn(async () => undefined),
    nativeAppControlSetAppLockedMock: vi.fn(async () => undefined),
    nativeConnectorIsAvailableMock: vi.fn(async () => true),
    nativeConnectorGetAvailableTargetsMock: vi.fn(async () => ['camera', 'keyboard']),
    nativeDeviceGetDeviceInfoMock: vi.fn(async () => ({id: 'device-001', manufacturer: 'SUNMI'})),
    nativeDeviceGetSystemStatusMock: vi.fn(async () => ({power: {batteryLevel: 88}})),
    nativeTopologyHostGetStatusMock: vi.fn(async () => ({state: 'RUNNING'})),
    nativeScriptExecuteMock: vi.fn(async () => 5),
    createAssemblyStateStorageMock: vi.fn(() => ({
        clear: vi.fn(async () => undefined),
        setItem: vi.fn(async () => undefined),
        getItem: vi.fn(async (_key: string) => JSON.stringify({ok: true})),
        removeItem: vi.fn(async () => undefined),
    })),
    setAssemblySelectedServerSpaceMock: vi.fn(),
    getAssemblyServerSpaceSnapshotMock: vi.fn(() => ({
        selectedSpace: 'kernel-base-dev',
        availableSpaces: ['kernel-base-dev'],
    })),
}))

vi.mock('../../src/turbomodules/logger', () => ({
    nativeLogger: {
        log: nativeLoggerLogMock,
        getLogFiles: nativeLoggerGetLogFilesMock,
        getLogContent: nativeLoggerGetLogContentMock,
        deleteLogFile: nativeLoggerDeleteLogFileMock,
        clearAllLogs: nativeLoggerClearAllLogsMock,
        getLogDirPath: nativeLoggerGetLogDirPathMock,
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
        isAvailable: nativeConnectorIsAvailableMock,
        getAvailableTargets: nativeConnectorGetAvailableTargetsMock,
    },
}))

vi.mock('../../src/turbomodules/device', () => ({
    nativeDevice: {
        getModel: vi.fn(async () => 'SUNMI'),
        getPlatform: vi.fn(async () => 'android'),
        getDeviceId: vi.fn(async () => 'device-001'),
        getDeviceInfo: nativeDeviceGetDeviceInfoMock,
        getSystemStatus: nativeDeviceGetSystemStatusMock,
    },
}))

vi.mock('../../src/turbomodules/topologyHost', () => ({
    nativeTopologyHost: {
        getStatus: nativeTopologyHostGetStatusMock,
    },
}))

vi.mock('../../src/turbomodules/scripts', () => ({
    nativeScriptExecutor: {
        execute: nativeScriptExecuteMock,
    },
}))

vi.mock('../../src/platform-ports/stateStorage', () => ({
    createAssemblyStateStorage: createAssemblyStateStorageMock,
}))

vi.mock('../../src/platform-ports/serverSpaceState', () => ({
    setAssemblySelectedServerSpace: setAssemblySelectedServerSpaceMock,
    getAssemblyServerSpaceSnapshot: getAssemblyServerSpaceSnapshotMock,
}))

import {createAssemblyAdminConsoleInput} from '../../src/application/adminConsoleConfig'

describe('assembly admin console config', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('injects host tools and real adapter diagnostics into admin-console', async () => {
        const input = createAssemblyAdminConsoleInput()

        expect(input.hostToolSources?.control).toBeDefined()
        expect(input.hostToolSources?.logs).toBeDefined()
        expect(input.hostToolSources?.device).toBeDefined()
        expect(input.hostToolSources?.connector).toBeDefined()
        expect(input.adapterDiagnosticScenarios?.length).toBeGreaterThanOrEqual(8)

        const storageScenario = input.adapterDiagnosticScenarios?.find(
            (item: AdapterDiagnosticScenario) => item.scenarioKey === 'read-write',
        )
        const scriptScenario = input.adapterDiagnosticScenarios?.find(
            (item: AdapterDiagnosticScenario) => item.scenarioKey === 'execute',
        )
        const control = input.hostToolSources?.control
        const logs = input.hostToolSources?.logs

        expect(storageScenario).toBeDefined()
        expect(scriptScenario).toBeDefined()

        const storageResult = await storageScenario!.run()
        const scriptResult = await scriptScenario!.run()
        const snapshot = await control?.getServerSpaceSnapshot?.()
        await control?.switchServerSpace?.('kernel-base-dev')
        await control?.clearCache?.()
        await logs?.getLogFiles()

        expect(storageResult.status).toBe('passed')
        expect(scriptResult.status).toBe('passed')
        expect(snapshot).toEqual({
            selectedSpace: 'kernel-base-dev',
            availableSpaces: ['kernel-base-dev'],
        })
        expect(setAssemblySelectedServerSpaceMock).toHaveBeenCalledWith('kernel-base-dev')
        expect(nativeAppControlRestartAppMock).toHaveBeenCalledTimes(1)
        expect(nativeLoggerGetLogFilesMock).toHaveBeenCalledTimes(1)
    })
})
