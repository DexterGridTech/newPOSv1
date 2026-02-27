import { kernelCoreTaskCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger, storeEntry, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {taskDefinitionsActions} from "../slices/taskDefinition";

export class TaskDefinitionsActor extends Actor {
    updateTaskDefinitions =
        Actor.defineCommandHandler(kernelCoreTaskCommands.updateTaskDefinitions,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "TaskDefinitionsActor"], 'updateTaskDefinitions')
                storeEntry.dispatchAction(taskDefinitionsActions.batchUpdateState(command.payload))
                return Promise.resolve({});
            });
}

