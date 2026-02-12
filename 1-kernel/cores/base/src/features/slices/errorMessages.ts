import {createSlice} from "@reduxjs/toolkit";
import {ErrorMessagesState, kernelCoreBaseState, ModuleSliceConfig} from "../../types";
import {batchUpdateState} from "../../foundations";

const initialState: ErrorMessagesState = {}
const slice = createSlice({
    name: kernelCoreBaseState.errorMessages,
    initialState,
    reducers: {
        batchUpdateState: batchUpdateState
    }
})

export const errorMessagesConfig: ModuleSliceConfig<ErrorMessagesState, typeof slice.actions> = {
    name: slice.name,
    reducer: slice.reducer,
    actions: slice.actions,
    statePersistToStorage: true,
    stateSyncToSlave: true
}