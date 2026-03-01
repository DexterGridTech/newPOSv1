import {ApplicationConfig, AppModule, InitLogger, registerDevice, registerLogger, registerStateStorage} from "@impos2/kernel-core-base";
import {deviceAdapter, loggerAdapter, stateStorageAdapter} from "../foundations";
// import {registerLocalWebServer} from "@impos2/kernel-core-interconnection";
// scriptExecution temporarily disabled for testing
// import {scriptExecution} from "../foundations";


export const adapterAndroidModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register logger adapter', 'register device adapter', 'register stateStorage adapter'])
    registerLogger(loggerAdapter)
    registerDevice(deviceAdapter)
    registerStateStorage(stateStorageAdapter)
    // registerScriptsExecution(scriptExecution) // temporarily disabled
    // registerExternalConnector(externalConnectorAdapter)
    // registerLocalWebServer(localWebServerAdapter)
}
