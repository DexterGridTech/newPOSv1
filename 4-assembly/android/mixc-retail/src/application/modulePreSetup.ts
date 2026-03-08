import {ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {registerAppControl} from "@impos2/kernel-core-base";
import {appControlAdapter} from "../foundations";

export const assemblyAndroidMixcRetailModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register app control'])
    registerAppControl(appControlAdapter)
}