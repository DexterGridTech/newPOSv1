import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {InstanceInfoState} from "../../types/state/instanceInfo";
import {DisplayMode, InstanceMode} from "../../types/shared/instance";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInfo, SlaveInfo} from "../../types";

const initialState: InstanceInfoState = {
    instanceMode: InstanceMode.MASTER,
    displayMode: DisplayMode.PRIMARY,
    standalone: false,
    enableSlave: false
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInfo,
    initialState,
    reducers: {
        setInstanceMode: (state, action: PayloadAction<InstanceMode>) => {
            state.instanceMode = action.payload
        },
        setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
            state.displayMode = action.payload
        },
        enableSlave: (state, action: PayloadAction<boolean>) => {
            state.enableSlave = action.payload
        },
        setMasterInfo: (state,action:PayloadAction<MasterInfo>) => {
            state.masterInfo = action.payload
        },
        setSlaveInfo: (state,action:PayloadAction<SlaveInfo>) => {
            state.slaveInfo = action.payload
        }
    }
})

export const instanceInfoActions = slice.actions

export const instanceInfoConfig: ModuleSliceConfig<InstanceInfoState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: true,
    stateSyncToSlave: false
}