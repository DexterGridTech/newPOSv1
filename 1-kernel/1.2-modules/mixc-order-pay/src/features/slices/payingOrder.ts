import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection'
import {kernelMixcOrderPayWorkspaceState} from "../../types/shared/moduleStateKey";
import {batchUpdateState} from "@impos2/kernel-core-base";
import {PayingMainOrder, PayingOrderState} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";


const initialState: PayingOrderState = {}
const slice = createWorkspaceSlice(
    kernelMixcOrderPayWorkspaceState.payingOrder,
    initialState,
    {
        addPayingOrderFromDraft: (state, action:PayloadAction<PayingMainOrder>) => {
            state[action.payload.mainOrderCode!] = {
                value: action.payload,
                updatedAt: Date.now(),
            }
        },
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
            batchUpdateState(state, action)
        }
    }
)

export const payingOrderActions = slice.actions

export const payingOrderSliceConfig: WorkspaceModuleSliceConfig<PayingOrderState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}