import {LOG_TAGS, logger, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {InstanceInfoState} from "../../types/state/instanceInfo";
import {DisplayMode, InstanceMode, Workspace} from "../../types/shared/instance";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInfo} from "../../types";
import {SyncType} from "../../types/shared/syncType";
import {moduleName} from "../../moduleName";

const initialState: InstanceInfoState = {
    instanceMode: InstanceMode.MASTER,
    displayMode: DisplayMode.PRIMARY,
    workspace: Workspace.MAIN,
    standalone: false,
    enableSlave: false
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInfo,
    initialState,
    reducers: {
        setInstanceMode: (state, action: PayloadAction<InstanceMode>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setInstanceMode',action.payload)

            state.instanceMode = action.payload
            if(state.instanceMode===InstanceMode.SLAVE&&state.displayMode===DisplayMode.PRIMARY){
                state.workspace=Workspace.BRANCH
            }else{
                state.workspace=Workspace.MAIN
            }
        },
        setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setDisplayMode',action.payload)
            state.displayMode = action.payload
            if(state.instanceMode===InstanceMode.SLAVE&&state.displayMode===DisplayMode.PRIMARY){
                state.workspace=Workspace.BRANCH
            }else{
                state.workspace=Workspace.MAIN
            }
        },
        enableSlave: (state, action: PayloadAction<boolean>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'enableSlave',action.payload)
            state.enableSlave = action.payload
        },
        setMasterInfo: (state, action: PayloadAction<MasterInfo | null>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setMasterInfo',action.payload)
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