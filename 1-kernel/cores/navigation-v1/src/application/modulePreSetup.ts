import {registerScreenParts} from "../foundations/registerScreenParts";
import {ApplicationConfig, AppModule} from "@impos2/kernel-core-base-v1";


export const kernelCoreNavigationModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    registerScreenParts(allModules)
}

