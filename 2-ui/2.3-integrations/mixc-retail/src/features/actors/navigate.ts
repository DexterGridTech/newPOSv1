import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {getTerminal, kernelCoreTerminalCommands} from "@impos2/kernel-core-terminal";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {uiMixcUserScreenParts} from "@impos2/ui-mixc-user";
import {kernelUserBaseCommands} from "@impos2/kernel-user-base";
import {uiMixcWorkbenchScreenParts} from "@impos2/ui-mixc-workbench";
import {uiCoreBaseScreenParts} from "@impos2/ui-core-base";
import {getInstanceMode, getWorkspace, InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export class NavigateActor extends Actor {
    activateDeviceSuccess = Actor.defineCommandHandler(kernelCoreTerminalCommands.activateDeviceSuccess,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "NavigateActor"], 'activateDeviceSuccess')

            const terminal = getTerminal()
            const instanceMode = getInstanceMode()
            const workspace = getWorkspace()
            if (!terminal) {
                if (instanceMode === InstanceMode.MASTER) {
                    kernelCoreNavigationCommands.navigateTo({target: uiMixcUserScreenParts.mpLoginScreen}).executeInternally()
                    kernelCoreNavigationCommands.navigateTo({target: uiMixcUserScreenParts.ssLoginScreen}).executeInternally()
                }
                if (instanceMode === InstanceMode.SLAVE && workspace === Workspace.BRANCH)
                    kernelCoreNavigationCommands.navigateTo({target: uiMixcUserScreenParts.spLoginScreen}).executeInternally()
            }
            return {};
        });
    loginSuccess = Actor.defineCommandHandler(kernelUserBaseCommands.loginSuccess,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "NavigateActor"], 'loginSuccess')

            const terminal = getTerminal()
            const instanceMode = getInstanceMode()
            const workspace = getWorkspace()
            if (!terminal) {
                if (instanceMode === InstanceMode.MASTER) {
                    kernelCoreNavigationCommands.navigateTo({target: uiMixcWorkbenchScreenParts.mpWorkbenchDesktopScreen}).executeInternally()
                    kernelCoreNavigationCommands.navigateTo({target: uiCoreBaseScreenParts.ssWelComeScreen}).executeInternally()
                }
                if (instanceMode === InstanceMode.SLAVE && workspace === Workspace.BRANCH)
                    kernelCoreNavigationCommands.navigateTo({target: uiMixcWorkbenchScreenParts.spWorkbenchDesktopScreen}).executeInternally()
            }
            return {};
        });
}

