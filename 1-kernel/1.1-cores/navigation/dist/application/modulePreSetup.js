import { addScreenPartRegister, InitLogger } from "@impos2/kernel-core-base";
import { registerScreenPart } from "../foundations/screens";
export const kernelCoreNavigationModulePreSetup = async (config, allModules) => {
    const initLogger = InitLogger.getInstance();
    initLogger.logNames(['add ScreenPart Register']);
    addScreenPartRegister({
        registerScreenPart
    });
};
