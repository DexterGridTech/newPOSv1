import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection'
import {kernelPayBaseWorkspaceState} from "../../types/shared/moduleStateKey";
import {batchUpdateState} from "@impos2/kernel-core-base";
import {PaymentRequestState} from "../../types/state/paymentRequest";
import {PayloadAction} from "@reduxjs/toolkit";
import {PaymentRequest} from "../../types";


const initialState: PaymentRequestState = {}
const slice = createWorkspaceSlice(
    kernelPayBaseWorkspaceState.paymentRequest,
    initialState,
    {
        addPaymentRequest: (state, action: PayloadAction<PaymentRequest>) => {
            state[action.payload.paymentRequestCode] = {
                value: action.payload,
                updatedAt: Date.now(),
            }
        },
        removePaymentRequest: (state, action: PayloadAction<string>) => {
            delete state[action.payload]
        },
        updatePaymentRequest: (state, action: PayloadAction<PaymentRequest>) => {
            state[action.payload.paymentRequestCode].value = action.payload
            state[action.payload.paymentRequestCode].updatedAt = Date.now()
        },
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
            batchUpdateState(state, action)
        }
    }
)

export const paymentRequestActions = slice.actions

export const paymentRequestSliceConfig: WorkspaceModuleSliceConfig<PaymentRequestState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}