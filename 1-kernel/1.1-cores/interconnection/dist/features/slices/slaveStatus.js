import { batchUpdateState } from "@impos2/kernel-core-base";
import { createSlice } from "@reduxjs/toolkit";
import { kernelCoreInterconnectionState } from "../../types/shared/moduleStateKey";
import { SyncType } from "../../types/shared/syncType";
const initialState = {};
const slice = createSlice({
    name: kernelCoreInterconnectionState.slaveStatus,
    initialState,
    reducers: {
        setDisplayMode: (state, action) => {
            state.displayMode = {
                updatedAt: Date.now(),
                value: action.payload
            };
        },
        setWorkspace: (state, action) => {
            state.workspace = {
                updatedAt: Date.now(),
                value: action.payload
            };
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action);
        }
    }
});
export const slaveStatusActions = slice.actions;
export const slaveStatusConfig = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.SLAVE_TO_MASTER,
};
