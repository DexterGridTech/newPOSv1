import {kernelCoreTaskCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {Actor, getSystemParameterByKey, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {taskDefinitionsActions} from "../slices/taskDefinition";

export class TaskDefinitionsActor extends Actor {
    updateTaskDefinitions =
        Actor.defineCommandHandler(kernelCoreTaskCommands.updateTaskDefinitions,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "TaskDefinitionsActor"], 'updateTaskDefinitions')
                const updatedTaskDefinitions=command.payload
                Object.keys(updatedTaskDefinitions).forEach(key => {
                    const valueWithUpdatedValue = command.payload[key]
                        if (valueWithUpdatedValue && valueWithUpdatedValue.value && typeof valueWithUpdatedValue.value === 'string') {
                            try {
                                valueWithUpdatedValue.value = JSON.parse(valueWithUpdatedValue.value);
                            } catch (e) {
                                logger.error([moduleName, LOG_TAGS.Actor, "TaskDefinitionsActor"], `Failed to parse value for key ${key}`, e);
                            }
                        }
                })
                storeEntry.dispatchAction(taskDefinitionsActions.batchUpdateState(updatedTaskDefinitions))
                return Promise.resolve({});
            });
}

