import {IActor, logger} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {LOG_TAGS} from "../../types";

export class InitializeActor extends IActor {
    initialize =
        IActor.defineCommandHandler(kernelCoreBaseCommands.initialize,
            (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel core base...')
                return Promise.resolve({});
            });
}

