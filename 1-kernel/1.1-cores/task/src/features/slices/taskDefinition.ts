import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {TaskDefinitionState} from "../../types/state/taskDefinitionState";
import {kernelCoreTaskState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, ModuleSliceConfig, TaskDefinition, ValueWithUpdatedAt} from "@impos2/kernel-core-base";

const initialState: TaskDefinitionState = {}
const slice = createSlice({
    name: kernelCoreTaskState.taskDefinitions,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state: TaskDefinitionState, action: PayloadAction<Record<string, ValueWithUpdatedAt<TaskDefinition> | undefined | null>>) => {
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