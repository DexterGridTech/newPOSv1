import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInterconnectionState} from "../../types/state/masterInterconnection";

const initialState: MasterInterconnectionState = {}
const slice = createSlice({
    name: kernelCoreInterconnectionState.masterInterconnection,
    initialState,
    reducers: {}
})

export const masterInterconnectionActions = slice.actions

export const masterInterconnectionConfig: ModuleSliceConfig<MasterInterconnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    stateSyncToSlave: false
}