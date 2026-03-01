import {ApplicationConfig, AppModule, InitLogger, registerDevice, registerLogger, registerStateStorage, registerScriptsExecution} from "@impos2/kernel-core-base";
// import {registerLocalWebServer} from "@impos2/kernel-core-interconnection";
import {deviceAdapter, loggerAdapter, stateStorageAdapter, scriptExecution} from "../foundations";


export const adapterAndroidModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register logger adapter', 'register device adapter', 'register stateStorage adapter', 'register scriptExecution adapter'])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    registerScriptsExecution(scriptExecution)
    // registerExternalConnector(externalConnectorAdapter)
    // registerLocalWebServer(localWebServerAdapter)
}
