import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, ModuleSliceConfig,} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {kernelProductFromContractState} from "../../types/shared/moduleStateKey";
import {ContractState} from "../../types/state/contract";

const initialState: ContractState = {
}
const slice = createSlice({
    name: kernelProductFromContractState.contract,
    initialState,
    reducers: {
        batchUpdateState: (state, action: PayloadAction<any>) => {
            batchUpdateState(state, action)
        }
    }
})
export const contractActions = slice.actions
export const contractConfig: ModuleSliceConfig<ContractState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}