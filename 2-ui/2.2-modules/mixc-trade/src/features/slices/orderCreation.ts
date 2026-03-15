import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection'
import {uiMixcTradeWorkspaceState} from "../../types/shared/moduleStateKey";
import {batchUpdateState} from "@impos2/kernel-core-base";
import {PayloadAction} from "@reduxjs/toolkit";
import {OrderCreationState} from "../../types/state/orderCreation";
import {OrderCreationType} from "../../types/shared/orderCreationType";

const initialState: OrderCreationState = {
    orderCreationType: {value: OrderCreationType.Active, updatedAt: 0},
}
const slice = createWorkspaceSlice(
    uiMixcTradeWorkspaceState.orderCreation,
    initialState,
    {
        setOrderCreationType: (state, action: PayloadAction<OrderCreationType>) => {
            state.orderCreationType.value = action.payload;
            state.orderCreationType.updatedAt = Date.now();
        },
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
            batchUpdateState(state, action)
        }
    }
)
export const orderCreationActions = slice.actions

export const orderCreationSliceConfig: WorkspaceModuleSliceConfig<OrderCreationState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}