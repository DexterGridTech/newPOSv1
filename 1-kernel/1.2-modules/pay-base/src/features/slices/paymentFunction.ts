import {createSlice} from "@reduxjs/toolkit";
import {PaymentFunctionState} from "../../types/state/paymentFunctionState";
import {InstanceMode} from "@impos2/kernel-core-interconnection";
import {kernelPayBaseState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {PaymentActionType, PaymentAmountType} from "../../types";

const initialState: PaymentFunctionState = {
    test1: {
        value: {
            key: 'test1',
            displayName: '扫码支付',
            displayIndex: 1,
            instanceMode: [InstanceMode.SLAVE, InstanceMode.MASTER],
            definition: {
                key: 'test1',
                name: 'test1',
                paymentAmountType:PaymentAmountType.FIXED,
                paymentActionType:PaymentActionType.SCAN_B2C,
                taskDefinitionKey:'test1',
                backstageSupported:false
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
                name: 'test2',
                paymentAmountType:PaymentAmountType.FIXED,
                paymentActionType:PaymentActionType.SWIPE_CARD,
                taskInstanceMode:InstanceMode.MASTER,
                taskDefinitionKey:'test2',
                backstageSupported:false
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
                name: 'test3',
                paymentAmountType:PaymentAmountType.DYNAMIC,
                paymentActionType:PaymentActionType.SCAN_B2C,
                taskDefinitionKey:'test3',
                backstageSupported:false
            }
        },
        updatedAt: 0
    },
    test4: {
        value: {
            key: 'test4',
            displayName: '记账',
            displayIndex: 4,
            instanceMode: [InstanceMode.SLAVE, InstanceMode.MASTER],
            definition: {
                key: 'test4',
                name: 'test4',
                paymentAmountType:PaymentAmountType.FIXED,
                paymentActionType:PaymentActionType.NONE,
                taskDefinitionKey:'test4',
                backstageSupported:false
            }
        },
        updatedAt: 0
    },
}
const slice = createSlice({
    name: kernelPayBaseState.paymentFunction,
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