import {
    ApplicationConfig,
    AppModule,
    InitLogger,
    registerDevice,
    registerStateStorage,
    registerScriptsExecution,
    registerExternalConnector,
    registerLogger
} from '@impos2/kernel-core-base'
import { registerLocalWebServer } from '@impos2/kernel-core-interconnection'
import { loggerAdapter, deviceAdapter, stateStorageAdapter, externalConnectorAdapter, scriptExecutionAdapter, localWebServerAdapter } from '../foundations'

export const adapterElectronModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    initLogger.logNames(['register logger adapter', 'register device adapter', 'register state storage adapter', 'register scripts execution adapter', 'register local web server adapter'])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    registerExternalConnector(externalConnectorAdapter)
    registerScriptsExecution(scriptExecutionAdapter)
    registerLocalWebServer(localWebServerAdapter)
}
