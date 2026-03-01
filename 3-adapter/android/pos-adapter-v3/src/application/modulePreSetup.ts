import {ApplicationConfig, AppModule, InitLogger, registerDevice, registerLogger, registerStateStorage, registerScriptsExecution} from "@impos2/kernel-core-base";
import {deviceAdapter, loggerAdapter, stateStorageAdapter, scriptExecutionAdapter} from "../foundations";
// import {registerLocalWebServer} from "@impos2/kernel-core-interconnection";


export const adapterAndroidModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register logger adapter', 'register device adapter', 'register stateStorage adapter', 'register scriptExecution adapter'])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    registerScriptsExecution(scriptExecutionAdapter)
    // registerExternalConnector(externalConnectorAdapter)
    // registerLocalWebServer(localWebServerAdapter)
}
