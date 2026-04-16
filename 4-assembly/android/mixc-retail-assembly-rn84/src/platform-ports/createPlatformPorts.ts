import type {LogEnvironmentMode, PlatformPorts} from '@impos2/kernel-base-platform-ports'
import {nativeAppControl, nativeConnector, nativeDevice, nativeScriptExecutor, createNativeStateStorage} from '../turbomodules'
import {createAssemblyLogger} from './logger'

export const createAssemblyPlatformPorts = (
    environmentMode: LogEnvironmentMode,
): PlatformPorts => ({
    environmentMode,
    logger: createAssemblyLogger(environmentMode),
    scriptExecutor: nativeScriptExecutor,
    stateStorage: createNativeStateStorage('state'),
    secureStateStorage: createNativeStateStorage('secure-state'),
    device: nativeDevice,
    connector: nativeConnector,
    appControl: {
        async restartApp() {
            await nativeAppControl.restartApp()
        },
        async clearDataCache() {
            await createNativeStateStorage('state').clear?.()
            await createNativeStateStorage('secure-state').clear?.()
        },
    },
})
