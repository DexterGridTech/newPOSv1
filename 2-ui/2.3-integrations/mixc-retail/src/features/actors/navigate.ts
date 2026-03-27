import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelCoreTerminalCommands} from "@impos2/kernel-core-terminal";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {uiMixcUserScreenParts} from "@impos2/ui-mixc-user";
import {kernelUserBaseCommands} from "@impos2/kernel-user-base";
import {uiMixcWorkbenchScreenParts} from "@impos2/ui-mixc-workbench";
import {uiCoreBaseScreenParts} from "@impos2/ui-core-base";

export class NavigateActor extends Actor {
    activateDeviceSuccess = Actor.defineCommandHandler(kernelCoreTerminalCommands.activateDeviceSuccess,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "NavigateActor"], 'activateDeviceSuccess')
            kernelCoreNavigationCommands.navigateTo({target:uiMixcUserScreenParts.mpLoginScreen}).executeInternally()
            kernelCoreNavigationCommands.navigateTo({target:uiCoreBaseScreenParts.ssWelComeScreen}).executeInternally()
            return {};
        });
    loginSuccess = Actor.defineCommandHandler(kernelUserBaseCommands.loginSuccess,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "NavigateActor"], 'loginSuccess')
            kernelCoreNavigationCommands.navigateTo({target:uiMixcWorkbenchScreenParts.mpWorkbenchDesktopScreen}).executeInternally()
            kernelCoreNavigationCommands.navigateTo({target:uiCoreBaseScreenParts.ssWelComeScreen}).executeInternally()
            return {};
        });
}

