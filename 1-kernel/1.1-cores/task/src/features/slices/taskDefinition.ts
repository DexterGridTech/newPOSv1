import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {TaskDefinitionState} from "../../types/state/taskDefinitionState";
import {kernelCoreTaskState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, LOG_TAGS, logger, ModuleSliceConfig, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import { TaskDefinition } from "../../types";

const initialState: TaskDefinitionState = {}
const slice = createSlice({
    name: kernelCoreTaskState.taskDefinitions,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state: TaskDefinitionState, action: PayloadAction<Record<string, ValueWithUpdatedAt<TaskDefinition>| undefined | null>>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "taskDefinitions"], 'batch update state',action.payload)
            batchUpdateState(state, action)

        }
    }
})
export const taskDefinitionsActions = slice.actions
export const taskDefinitionsConfig: ModuleSliceConfig<TaskDefinitionState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
}