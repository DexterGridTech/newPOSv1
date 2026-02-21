import {ApplicationConfig, AppModule, InitLogger, registerLogger} from "@impos2/kernel-core-base";
import {loggerAdapter} from "../foundations";


export const adapterAndroidModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register logger adapter'])
    registerLogger(loggerAdapter)
}