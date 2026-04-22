import { createSlice } from "@reduxjs/toolkit";
import { DisplayMode, InstanceMode, Workspace } from "../../types/shared/instance";
import { kernelCoreInterconnectionState } from "../../types/shared/moduleStateKey";
import { SyncType } from "../../types/shared/syncType";
const initialState = {
    instanceMode: InstanceMode.MASTER,
    displayMode: DisplayMode.PRIMARY,
    workspace: Workspace.MAIN,
    standalone: false,
    enableSlave: false
};
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInfo,
    initialState,
    reducers: {
        setInstanceMode: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setInstanceMode',action.payload)
            state.instanceMode = action.payload;
            if (state.instanceMode === InstanceMode.SLAVE && state.displayMode === DisplayMode.PRIMARY) {
                state.workspace = Workspace.BRANCH;
            }
            else {
                state.workspace = Workspace.MAIN;
            }
        },
        setDisplayMode: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setDisplayMode',action.payload)
            state.displayMode = action.payload;
            if (state.instanceMode === InstanceMode.SLAVE && state.displayMode === DisplayMode.PRIMARY) {
                state.workspace = Workspace.BRANCH;
            }
            else {
                state.workspace = Workspace.MAIN;
            }
        },
        enableSlave: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'enableSlave',action.payload)
            state.enableSlave = action.payload;
        },
        setMasterInfo: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInfo"], 'setMasterInfo',action.payload)
            state.masterInfo = action.payload;
        }
    }
});
export const instanceInfoActions = slice.actions;
export const instanceInfoConfig = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.ISOLATED,
};
