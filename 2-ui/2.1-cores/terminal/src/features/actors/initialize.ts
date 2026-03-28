import {moduleName} from "../../moduleName";
import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {getTerminal} from "@impos2/kernel-core-terminal";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {uiCoreTerminalScreenParts} from "../../ui";
import {getInstanceMode, getWorkspace, InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing UI module device-activate...')
            const terminal = getTerminal()
            const instanceMode = getInstanceMode()
            const workspace = getWorkspace()
            if (!terminal) {
                if (instanceMode === InstanceMode.MASTER) {
                    kernelCoreNavigationCommands.navigateTo({target: uiCoreTerminalScreenParts.mpActivateDeviceScreen}).executeInternally()
                    kernelCoreNavigationCommands.navigateTo({target: uiCoreTerminalScreenParts.ssActivateDeviceScreen}).executeInternally()
                }
                if (instanceMode === InstanceMode.SLAVE && workspace === Workspace.BRANCH)
                    kernelCoreNavigationCommands.navigateTo({target: uiCoreTerminalScreenParts.spActivateDeviceScreen}).executeInternally()
            }
            return {};
        });
}

