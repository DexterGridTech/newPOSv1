import {ApplicationConfig, AppModule} from "@impos2/kernel-core-base";
import {uiCoreBaseScreenParts} from "@impos2/ui-core-base";
import {ssWelComeScreenPart} from "../ui";


export const uiIntegrationMixcRetailModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    //替换默认welcome screen
    uiCoreBaseScreenParts.ssWelComeScreen=ssWelComeScreenPart
}