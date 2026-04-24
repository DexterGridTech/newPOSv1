import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createAssemblyLoggerMock,
    createAssemblyStateStorageMock,
    nativeAppControlRestartAppMock,
    nativeAppControlIsFullScreenMock,
    nativeAppControlIsAppLockedMock,
    nativeAppControlSetFullScreenMock,
    nativeAppControlSetAppLockedMock,
    nativeConnector,
    nativeDevice,
    nativeHotUpdate,
    nativeScriptExecutor,
    nativeTopologyHost,
} = vi.hoisted(() => ({
    createAssemblyLoggerMock: vi.fn((environmentMode: string) => ({
        kind: 'assembly-logger',
        environmentMode,
    })),
    createAssemblyStateStorageMock: vi.fn((layer: 'state' | 'secure-state') => ({
        layer,
        clear: vi.fn(async () => undefined),
    })),
    nativeAppControlRestartAppMock: vi.fn(async () => undefined),
    nativeAppControlIsFullScreenMock: vi.fn(async () => false),
    nativeAppControlIsAppLockedMock: vi.fn(async () => false),
    nativeAppControlSetFullScreenMock: vi.fn(async () => undefined),
    nativeAppControlSetAppLockedMock: vi.fn(async () => undefined),
    nativeConnector: {kind: 'native-connector'},
    nativeDevice: {kind: 'native-device'},
    nativeHotUpdate: {
        downloadPackage: vi.fn(),
        writeBootMarker: vi.fn(),
        readActiveMarker: vi.fn(),
        readBootMarker: vi.fn(),
        clearBootMarker: vi.fn(),
        confirmLoadComplete: vi.fn(),
    },
    nativeScriptExecutor: {kind: 'native-script-executor'},
    nativeTopologyHost: {
        start: vi.fn(async () => ({wsUrl: 'ws://127.0.0.1:8888/ws'})),
        stop: vi.fn(async () => undefined),
        getStatus: vi.fn(async () => ({state: 'STOPPED'})),
        getDiagnosticsSnapshot: vi.fn(async () => null),
    },
}))

vi.mock('../../src/platform-ports/logger', () => ({
    createAssemblyLogger: createAssemblyLoggerMock,
}))

vi.mock('../../src/platform-ports/stateStorage', () => ({
    createAssemblyStateStorage: createAssemblyStateStorageMock,
}))

vi.mock('../../src/turbomodules/logger', () => ({
    nativeLogger: {
        debug: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
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
    nativeConnector,
}))

vi.mock('../../src/turbomodules/device', () => ({
    nativeDevice,
}))

vi.mock('../../src/turbomodules/hotUpdate', () => ({
    nativeHotUpdate,
}))

vi.mock('../../src/turbomodules/scripts', () => ({
    nativeScriptExecutor,
}))

vi.mock('../../src/turbomodules/topologyHost', () => ({
    nativeTopologyHost,
}))

import {createAssemblyPlatformPorts} from '../../src/platform-ports/createPlatformPorts'

describe('assembly platform ports', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses adapter-backed native storages for formal runtime persistence', async () => {
        const ports = createAssemblyPlatformPorts('DEV')

        expect(createAssemblyLoggerMock).toHaveBeenCalledWith('DEV')
        expect(createAssemblyStateStorageMock).toHaveBeenCalledTimes(2)
        expect(createAssemblyStateStorageMock).toHaveBeenNthCalledWith(1, 'state', {
            shouldDisablePersistence: undefined,
        })
        expect(createAssemblyStateStorageMock).toHaveBeenNthCalledWith(2, 'secure-state', {
            shouldDisablePersistence: undefined,
        })
        expect(ports.stateStorage).toMatchObject({layer: 'state'})
        expect(ports.secureStateStorage).toMatchObject({layer: 'secure-state'})
        expect(ports.connector).toBe(nativeConnector)
        expect(ports.device).toBe(nativeDevice)
        expect(ports.scriptExecutor).toBe(nativeScriptExecutor)
        expect(ports.topologyHost).toBeDefined()
        expect(ports.hotUpdate).toBeDefined()
        await ports.hotUpdate?.reportLoadComplete?.({displayIndex: 0})
        expect(nativeHotUpdate.confirmLoadComplete).toHaveBeenCalledTimes(1)
    })

    it('threads the managed-secondary persistence gate into both storage layers', async () => {
        const shouldDisableStatePersistence = vi.fn(() => true)

        createAssemblyPlatformPorts('DEV', {
            shouldDisableStatePersistence,
        })

        expect(createAssemblyStateStorageMock).toHaveBeenNthCalledWith(1, 'state', {
            shouldDisablePersistence: shouldDisableStatePersistence,
        })
        expect(createAssemblyStateStorageMock).toHaveBeenNthCalledWith(2, 'secure-state', {
            shouldDisablePersistence: shouldDisableStatePersistence,
        })
    })

    it('clears both native storage namespaces and keeps restart delegated to native app control', async () => {
        const ports = createAssemblyPlatformPorts('PROD')
        const stateStorage = createAssemblyStateStorageMock.mock.results[0]?.value
        const secureStateStorage = createAssemblyStateStorageMock.mock.results[1]?.value

        await ports.appControl?.clearDataCache?.()
        await ports.appControl?.restartApp()
        await ports.topologyHost?.start?.()
        await ports.topologyHost?.stop?.()

        expect(stateStorage?.clear).toHaveBeenCalledTimes(1)
        expect(secureStateStorage?.clear).toHaveBeenCalledTimes(1)
        expect(nativeAppControlRestartAppMock).toHaveBeenCalledTimes(1)
        expect(nativeTopologyHost.start).toHaveBeenCalledTimes(1)
        expect(nativeTopologyHost.stop).toHaveBeenCalledTimes(1)
    })

    it('leaves server space switching to the assembly admin host input', async () => {
        const ports = createAssemblyPlatformPorts('DEV')

        expect('switchServerSpace' in (ports.appControl ?? {})).toBe(false)
    })
})
