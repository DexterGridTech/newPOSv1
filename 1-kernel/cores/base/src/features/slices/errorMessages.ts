import {createSlice} from "@reduxjs/toolkit";
import {ErrorMessagesState, kernelCoreBaseState, LOG_TAGS, ModuleSliceConfig} from "../../types";
import {batchUpdateState, logger} from "../../foundations";
import {moduleName} from "../../moduleName";

const initialState: ErrorMessagesState = {}
const slice = createSlice({
    name: kernelCoreBaseState.errorMessages,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreBaseState.errorMessages], 'batch update state', action.payload)
        }
    }
})

export const errorMessagesActions = slice.actions

export const errorMessagesConfig: ModuleSliceConfig<ErrorMessagesState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: true,
    //如果stateSyncToSlave=true,state的属性需集成{updateAt:number}才能被同步
    stateSyncToSlave: true
}