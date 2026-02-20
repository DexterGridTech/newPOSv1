import {addScreenPartRegister, ApplicationConfig, AppModule} from "@impos2/kernel-core-base-v1";
import {registerScreenPart} from "../foundations/screens";


export const kernelCoreNavigationModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    addScreenPartRegister({
        registerScreenPart
    })
}

