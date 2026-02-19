import {ModuleSliceConfig} from "@impos2/kernel-core-base-v1";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {InstanceInfoState} from "../../types/state/instanceInfo";
import {DisplayMode, InstanceMode, WorkSpace} from "../../types/shared/instance";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInfo} from "../../types";
import {SyncType} from "../../types/shared/syncType";

const initialState: InstanceInfoState = {
    instanceMode: InstanceMode.MASTER,
    displayMode: DisplayMode.PRIMARY,
    workspace: WorkSpace.MAIN,
    standalone: false,
    enableSlave: false
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInfo,
    initialState,
    reducers: {
        setInstanceMode: (state, action: PayloadAction<InstanceMode>) => {
            state.instanceMode = action.payload
            if(state.instanceMode===InstanceMode.SLAVE&&state.displayMode===DisplayMode.PRIMARY){
                state.workspace=WorkSpace.BRANCH
            }else{
                state.workspace=WorkSpace.MAIN
            }
        },
        setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
            state.displayMode = action.payload
            if(state.instanceMode===InstanceMode.SLAVE&&state.displayMode===DisplayMode.PRIMARY){
                state.workspace=WorkSpace.BRANCH
            }else{
                state.workspace=WorkSpace.MAIN
            }
        },
        enableSlave: (state, action: PayloadAction<boolean>) => {
            state.enableSlave = action.payload
        },
        setMasterInfo: (state, action: PayloadAction<MasterInfo | null>) => {
            state.masterInfo = action.payload
        }
    }
})

export const instanceInfoActions = slice.actions

export const instanceInfoConfig: ModuleSliceConfig<InstanceInfoState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.ISOLATED,
}