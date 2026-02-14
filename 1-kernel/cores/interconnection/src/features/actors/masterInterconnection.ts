import {Actor, LOG_TAGS} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "../commands";
import {logger} from "@impos2/kernel-base";
import {moduleName} from "../../moduleName";


export class MasterInterconnectionActor extends Actor {
    startMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.startMasterServer,
        (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "MasterInterconnectionActor"], 'Starting master server...')
            return Promise.resolve({});
        })
}