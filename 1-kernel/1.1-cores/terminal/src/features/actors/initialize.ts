import {moduleName} from "../../moduleName";
import {Actor, device, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {terminalActions} from "../slices/terminal";
import {kernelCoreTerminalCommands} from "../commands";
import {TaskSystem} from "@impos2/kernel-core-task";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel Terminal...')
            const deviceInfo = await device.getDeviceInfo()
            TaskSystem.getInstance().setOperatingSystem(
                   deviceInfo.os,
                   deviceInfo.osVersion
            )
            storeEntry.dispatchAction(terminalActions.setDeviceInfo(deviceInfo))

            kernelCoreTerminalCommands.connectKernelWS().executeInternally()
            return {};
        });
}

