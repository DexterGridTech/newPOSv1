import {createSlice} from "@reduxjs/toolkit";
import {kernelCoreBaseState, ModuleSliceConfig, SystemParametersState} from "../../types";
import {batchUpdateState} from "../../foundations";

const initialState: SystemParametersState = {}
const slice = createSlice({
    name: kernelCoreBaseState.systemParameters,
    initialState,
    reducers: {


        batchUpdateState: batchUpdateState
    }
})

export const systemParametersConfig: ModuleSliceConfig<SystemParametersState, typeof slice.actions> = {
    name: slice.name,
    reducer: slice.reducer,
    actions: slice.actions,
    statePersistToStorage: true,
    stateSyncToSlave: true
}