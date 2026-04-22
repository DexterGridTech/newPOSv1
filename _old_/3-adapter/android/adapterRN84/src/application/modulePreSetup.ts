import {
    ApplicationConfig,
    AppModule,
    InitLogger,
    registerLogger,
    registerDevice,
    registerStateStorage,
    registerScriptsExecution,
    registerExternalConnector,
    registerAppControl,
} from '@impos2/kernel-core-base'
import {registerLocalWebServer} from '@impos2/kernel-core-interconnection'
import {
    loggerAdapter,
    deviceAdapter,
    stateStorageAdapter,
    externalConnectorAdapter,
    scriptExecutionAdapter,
    localWebServerAdapter,
    appControlAdapter,
} from '../foundations'

export const adapterAndroidModulePreSetup = async (
    _config: ApplicationConfig,
    _allModules: AppModule[],
) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames([
        'register logger adapter',
        'register device adapter',
        'register state storage adapter',
        'register scripts execution adapter',
        'register local web server adapter',
        'register app control adapter',
    ])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    registerExternalConnector(externalConnectorAdapter)
    registerScriptsExecution(scriptExecutionAdapter)
    registerLocalWebServer(localWebServerAdapter)
    registerAppControl(appControlAdapter)
}
