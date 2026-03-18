import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, ModuleSliceConfig,} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {kernelProductBaseState} from "../../types/shared/moduleStateKey";
import { ProductState} from "../../types/state/productState";

const initialState: ProductState = {
}
const slice = createSlice({
    name: kernelProductBaseState.product,
    initialState,
    reducers: {
        batchUpdateState: (state, action: PayloadAction<any>) => {
            batchUpdateState(state, action)
        }
    }
})
export const productActions = slice.actions
export const productConfig: ModuleSliceConfig<ProductState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}