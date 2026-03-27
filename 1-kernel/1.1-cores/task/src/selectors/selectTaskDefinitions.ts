import {createSelector} from "@reduxjs/toolkit";
import {TaskDefinition} from "@impos2/kernel-core-base";
import {kernelCoreTaskState} from "../types/shared/moduleStateKey";
import {TaskDefinitionState} from "../types/state/taskDefinitionState";

const selectTaskDefinitionState = (state: any): TaskDefinitionState => {
    return state[kernelCoreTaskState.taskDefinitions] || {};
};

export const selectTaskDefinitions = createSelector(
    [selectTaskDefinitionState],
    (taskDefinitionState: TaskDefinitionState): TaskDefinition[] => {
        return Object.values(taskDefinitionState)
            .map(item => item?.value)
            .filter((task): task is TaskDefinition => !!task);
    }
);
