import {storeEntry,TaskDefinition} from "@impos2/kernel-core-base";
import {kernelCoreTaskState} from "../types/shared/moduleStateKey";
import {TaskDefinitionState} from "../types";


export const getTaskDefinitionFromState = (key: string): TaskDefinition | undefined => {
    const taskDefinitions = storeEntry.getStateByKey(kernelCoreTaskState.taskDefinitions) as TaskDefinitionState
    return taskDefinitions[key]?.value
}


