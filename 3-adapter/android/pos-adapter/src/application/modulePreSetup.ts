import {ApplicationConfig, AppModule, InitLogger, registerLogger, registerDevice, registerStateStorage, registerExternalCall, registerScriptsExecution, registerExternalConnector} from "@impos2/kernel-core-base";
import {registerLocalWebServer} from "@impos2/kernel-core-interconnection";
import {loggerAdapter, deviceAdapter, stateStorageAdapter, externalCallAdapter, externalConnectorAdapter, scriptExecutionAdapter, localWebServerAdapter} from "../foundations";


export const adapterAndroidModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register logger adapter', 'register device adapter', 'register state storage adapter', 'register external call adapter', 'register scripts execution adapter', 'register local web server adapter'])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    registerExternalCall(externalCallAdapter)
    registerExternalConnector(externalConnectorAdapter)
    registerScriptsExecution(scriptExecutionAdapter)
    registerLocalWebServer(localWebServerAdapter)
}
