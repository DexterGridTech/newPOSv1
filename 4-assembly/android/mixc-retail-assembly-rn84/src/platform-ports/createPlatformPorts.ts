import type {LogEnvironmentMode, PlatformPorts} from '@impos2/kernel-base-platform-ports'
import {nativeAppControl} from '../turbomodules/appControl'
import {nativeConnector} from '../turbomodules/connector'
import {nativeDevice} from '../turbomodules/device'
import {nativeScriptExecutor} from '../turbomodules/scripts'
import {nativeTopologyHost} from '../turbomodules/topologyHost'
import {createAssemblyLogger} from './logger'
import {createAssemblyHotUpdatePort} from './hotUpdate'
import {createAssemblyStateStorage} from './stateStorage'
import {createAssemblyTerminalLogUploadPort} from './terminalLogs'

export const createAssemblyPlatformPorts = (
    environmentMode: LogEnvironmentMode,
    options: {
        shouldDisableStatePersistence?: () => boolean
    } = {},
): PlatformPorts => {
    const stateStorage = createAssemblyStateStorage('state', {
        shouldDisablePersistence: options.shouldDisableStatePersistence,
    })
    const secureStateStorage = createAssemblyStateStorage('secure-state', {
        shouldDisablePersistence: options.shouldDisableStatePersistence,
    })

    return {
        environmentMode,
        logger: createAssemblyLogger(environmentMode),
        terminalLogs: createAssemblyTerminalLogUploadPort(),
        scriptExecutor: nativeScriptExecutor,
        stateStorage,
        secureStateStorage,
        device: nativeDevice,
        connector: nativeConnector,
        appControl: {
            async restartApp() {
                await nativeAppControl.restartApp()
            },
            async clearDataCache() {
                await stateStorage.clear?.()
                await secureStateStorage.clear?.()
            },
        },
        topologyHost: {
            async start(config) {
                return await nativeTopologyHost.start(config)
            },
            async stop() {
                await nativeTopologyHost.stop()
            },
            async getStatus() {
                return await nativeTopologyHost.getStatus()
            },
            async getDiagnosticsSnapshot() {
                return await nativeTopologyHost.getDiagnosticsSnapshot()
            },
        },
        hotUpdate: createAssemblyHotUpdatePort(),
    }
}
