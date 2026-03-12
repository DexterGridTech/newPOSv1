import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {
    batchUpdateState as batchUpdateStateUtil,
    extractSliceActions,
    ModuleSliceConfig,
} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {Contract} from "../../types";
import {kernelMixcProductState} from "../../types/shared/moduleStateKey";
import {ContractState} from "../../types/state/contract";

const initialState: ContractState = {
    ["contract123"]:{
        value:{
            contractCode:"contract123",
            contractName:"测试合同",
            validFrom:0,
            validTo:Date.now()*1.5,
            productsByContract:[
                {
                    productCode:"A001",
                    productName:"测试商品A001",
                    displayName:"农夫山泉"
                },
                {
                    productCode:"A002",
                    productName:"测试商品A002",
                    displayName:"怡宝"
                }
            ]
        },
        updatedAt:0
    }
}
const slice = createSlice({
    name: kernelMixcProductState.contract,
    initialState,
    reducers: {
        addContract: (state, action: PayloadAction<Contract>) => {
            if (!state[action.payload.contractCode]) {
                state[action.payload.contractCode] = {
                    value: action.payload,
                    updatedAt: Date.now(),
                }
            }
        },
        updateContract: (state, action: PayloadAction<Contract>) => {
            if (state[action.payload.contractCode]) {
                state[action.payload.contractCode] = {
                    value: action.payload,
                    updatedAt: Date.now(),
                }
            }
        },
        deleteContract: (state, action: PayloadAction<string>) => {
            if (state[action.payload]) {
                delete state[action.payload]
            }
        },
        batchUpdateState: (state, action: PayloadAction<any>) => {
            batchUpdateStateUtil(state, action)
        }
    }
})

export const contractActions = extractSliceActions(slice.actions)
export const contractConfig: ModuleSliceConfig<ContractState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}