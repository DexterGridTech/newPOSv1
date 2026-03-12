import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {
    batchUpdateState as batchUpdateStateUtil,
    extractSliceActions,
    ModuleSliceConfig,
} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {MainOrderBase, OrderState} from "../../types";
import {kernelMixcOrderBaseState} from "../../types/shared/moduleStateKey";

const initialState: OrderState = {}
const slice = createSlice({
    name: kernelMixcOrderBaseState.order,
    initialState,
    reducers: {
        addOrder: (state, action: PayloadAction<MainOrderBase>) => {
            if (!state[action.payload.mainOrderCode]){
                state[action.payload.mainOrderCode] = {
                    value: action.payload,
                    updatedAt: Date.now(),
                }
            }
        },
        updateOrder: (state, action: PayloadAction<MainOrderBase>) => {
            if (state[action.payload.mainOrderCode]){
                state[action.payload.mainOrderCode] ={
                    value: action.payload,
                    updatedAt: Date.now(),
                }
            }
        },
        batchUpdateState: (state, action: PayloadAction<any>) => {
            batchUpdateStateUtil(state, action)
        }
    }
})

export const orderActions = extractSliceActions(slice.actions)
export const orderConfig: ModuleSliceConfig<OrderState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}