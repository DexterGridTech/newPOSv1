import {ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {registerAppControl} from "@impos2/kernel-core-navigation";
import {appControlAdapter} from "../foundations";

export const assemblyAndroidDesktopModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register app control'])
    registerAppControl(appControlAdapter)
}