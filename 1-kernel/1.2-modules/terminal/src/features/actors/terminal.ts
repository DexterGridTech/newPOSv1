import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";

export class TerminalActor extends Actor {
    activateDevice = Actor.defineCommandHandler(kernelTerminalCommands.activateDevice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'activateDevice', command.payload)


            return {};
        });
}

