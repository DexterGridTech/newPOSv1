import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice} from "@reduxjs/toolkit";
import {InstanceInfoState} from "../../types/state/instanceInfo";
import {DisplayMode, InstanceMode} from "../../types/shared/instance";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";

const initialState: InstanceInfoState = {
    instanceMode: InstanceMode.MASTER,
    displayMode: DisplayMode.PRIMARY,
    standAlone: false,
    enableSlave: false
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInfo,
    initialState,
    reducers: {

    }
})

export const instanceInfoActions = slice.actions

export const instanceInfoConfig: ModuleSliceConfig<InstanceInfoState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: true,
    stateSyncToSlave: false
}