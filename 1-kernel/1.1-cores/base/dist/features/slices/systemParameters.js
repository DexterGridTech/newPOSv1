import { createSlice } from "@reduxjs/toolkit";
import { kernelCoreBaseState } from "../../types";
import { batchUpdateState } from "../../foundations";
const initialState = {};
const slice = createSlice({
    name: kernelCoreBaseState.systemParameters,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "systemParameters"], 'batch update state',action.payload)
            batchUpdateState(state, action);
        }
    }
});
export const systemParametersActions = slice.actions;
export const systemParametersConfig = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
};
