import {moduleName} from "../../moduleName";
import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel Terminal...')
            return {};
        });
}

