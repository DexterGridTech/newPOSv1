import type {LogEnvironmentMode, PlatformPorts} from '@impos2/kernel-base-platform-ports'
import {nativeAppControl} from '../turbomodules/appControl'
import {nativeConnector} from '../turbomodules/connector'
import {nativeDevice} from '../turbomodules/device'
import {nativeScriptExecutor} from '../turbomodules/scripts'
import {createAssemblyLogger} from './logger'
import {createAssemblyStateStorage} from './stateStorage'

export const createAssemblyPlatformPorts = (
    environmentMode: LogEnvironmentMode,
): PlatformPorts => {
    const stateStorage = createAssemblyStateStorage('state')
    const secureStateStorage = createAssemblyStateStorage('secure-state')

    return {
        environmentMode,
        logger: createAssemblyLogger(environmentMode),
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
    }
}
