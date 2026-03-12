import {batchUpdateState, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {DisplayMode, Workspace} from "../../types/shared/instance";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {SyncType} from "../../types/shared/syncType";
import {SlaveStatusState} from "../../types/state/slaveStatus";

const initialState: SlaveStatusState = {}
const slice = createSlice({
    name: kernelCoreInterconnectionState.slaveStatus,
    initialState,
    reducers: {

        setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
            state.displayMode = {
                updatedAt: Date.now(),
                value: action.payload
            }
        },
        setWorkspace: (state, action: PayloadAction<Workspace>) => {
            state.workspace = {
                updatedAt: Date.now(),
                value: action.payload
            }
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
        }
    }
})

export const slaveStatusActions = slice.actions

export const slaveStatusConfig: ModuleSliceConfig<SlaveStatusState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.SLAVE_TO_MASTER,
}