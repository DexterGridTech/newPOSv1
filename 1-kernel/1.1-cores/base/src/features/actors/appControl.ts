import {Actor, logger} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {LOG_TAGS, storeEntry} from "../../types";
import {appControl} from "@impos2/kernel-core-navigation";

export class AppControlActor extends Actor {
    clearDataCache = Actor.defineCommandHandler(kernelCoreBaseCommands.clearDataCache,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "AppControlActor"], 'clearDataCache')
            const currentDataVersion = await storeEntry.getDataVersion()
            await storeEntry.setDataVersion(currentDataVersion + 1)
            await appControl.restartApp()
            return {};
        });
    switchServerSpace = Actor.defineCommandHandler(kernelCoreBaseCommands.switchServerSpace,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "AppControlActor"], `switchServerSpace ${command.payload}`)
            await storeEntry.setSelectServerSpace(command.payload)
            await appControl.restartApp()
            return {};
        });
}

