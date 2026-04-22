import { createSlice } from "@reduxjs/toolkit";
import { kernelCoreBaseState } from "../../types";
import { batchUpdateState } from "../../foundations";
const initialState = {};
const slice = createSlice({
    name: kernelCoreBaseState.errorMessages,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "errorMessages"], 'batch update state',action.payload)
            batchUpdateState(state, action);
        }
    }
});
export const errorMessagesActions = slice.actions;
export const errorMessagesConfig = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
};
