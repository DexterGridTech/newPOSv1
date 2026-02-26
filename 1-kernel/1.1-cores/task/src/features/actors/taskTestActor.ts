import {moduleName} from "../../moduleName";
import {Actor, AppError, getDeviceId, kernelCoreBaseCommands, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelCoreTaskCommands} from "../commands";
import {kernelCoreTaskErrorMessages} from "../../supports";

export class TaskTestActor extends Actor {
    open = Actor.defineCommandHandler(kernelCoreTaskCommands.open,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TaskTestActor"], `open Command execute with payload ${command.payload}...`)
            await new Promise(resolve => setTimeout(resolve, 1000));
            if(command.payload.key === "secret key"){
                return { deviceId: getDeviceId()};
            }else
                throw new AppError(kernelCoreTaskErrorMessages.keyIsNotRight)
        });

    take = Actor.defineCommandHandler(kernelCoreTaskCommands.take,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TaskTestActor"], `take Command execute with payload ${command.payload}...`)
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { [command.payload.bagId]: `full}`};
        });

    close = Actor.defineCommandHandler(kernelCoreTaskCommands.close,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TaskTestActor"], `close Command execute with payload ${command.payload}...`)
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { door: `closed`};
        });
}

