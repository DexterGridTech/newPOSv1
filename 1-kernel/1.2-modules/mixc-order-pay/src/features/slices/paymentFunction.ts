import {createSlice} from "@reduxjs/toolkit";
import {PaymentFunctionState} from "../../types/state/paymentFunctionState";
import {InstanceMode} from "@impos2/kernel-core-interconnection";
import {kernelMixcOrderPayState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, ModuleSliceConfig} from "@impos2/kernel-core-base";

const initialState: PaymentFunctionState = {
    test1: {
        value: {
            key: 'test1',
            displayName: '扫码支付',
            displayIndex: 1,
            instanceMode: [InstanceMode.SLAVE, InstanceMode.MASTER],
            definition: {
                key: 'test1',
                name: 'test1'
            }
        },
        updatedAt: 0
    },
    test2: {
        value: {
            key: 'test2',
            displayName: '刷卡支付',
            displayIndex: 3,
            instanceMode: [InstanceMode.SLAVE, InstanceMode.MASTER],
            definition: {
                key: 'test2',
                name: 'test2'
            }
        },
        updatedAt: 0
    },
    test3: {
        value: {
            key: 'test3',
            displayName: '团购券',
            displayIndex: 2,
            instanceMode: [InstanceMode.SLAVE, InstanceMode.MASTER],
            definition: {
                key: 'test3',
                name: 'test3'
            }
        },
        updatedAt: 0
    },
}
const slice = createSlice({
    name: kernelMixcOrderPayState.paymentFunction,
    initialState,
    reducers: {
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "errorMessages"], 'batch update state',action.payload)
            batchUpdateState(state, action)
        }
    }
})

export const paymentFunctionActions = slice.actions

export const paymentFunctionConfig: ModuleSliceConfig<PaymentFunctionState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
}