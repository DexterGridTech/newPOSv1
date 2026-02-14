import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "../commands";
import {moduleName} from "../../moduleName";


export class SlaveInterconnectionActor extends Actor {
    connectMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.connectMasterServer,
        (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "SlaveInterconnectionActor"], 'Connecting to master server...')
            return Promise.resolve({});
        })
}