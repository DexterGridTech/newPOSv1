import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection'
import {kernelMixcOrderCreateTraditionalWorkspaceState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, shortId} from "@impos2/kernel-core-base";
import {CreateOrderState} from "../../types/state/createOrderState";
import {PayloadAction} from "@reduxjs/toolkit";
import {Product} from "@impos2/kernel-mixc-product";

const initialState: CreateOrderState = {
    draftProductOrders: {
        value: [],
        updatedAt: 0
    },
    draftOrderAmount: {
        value: 0,
        updatedAt: 0
    },
}
const slice = createWorkspaceSlice(
    kernelMixcOrderCreateTraditionalWorkspaceState.createOrder,
    initialState,
    {
        addProductOrder: (state, action:PayloadAction<Product>) => {
            state.draftProductOrders.value.forEach(item => {
                if(item.selected){
                    item.selected = false
                }
            })
            state.draftProductOrders.value.push({
                id:shortId(),
                productCode: action.payload.productCode,
                productName: action.payload.productName,
                displayName: action.payload.displayName,
                quantity: 1,
                price:0,
                amount:0,
                selected: true,
            })
            state.draftProductOrders.updatedAt = Date.now()
        },
        selectProductOrder: (state, action:PayloadAction<{id:string}>) => {
            state.draftProductOrders.value.forEach(item => {
                if(item.id === action.payload.id){
                    item.selected = !item.selected
                }else {
                    item.selected = false
                }
            })
            state.draftProductOrders.updatedAt = Date.now()
        },
        removeProductOrder: (state, action:PayloadAction<{id:string}>) => {
            state.draftProductOrders.value = state.draftProductOrders.value.filter(item => item.id !== action.payload.id)
            state.draftProductOrders.updatedAt = Date.now()
        },
        increaseProductOrderQuantity: (state, action:PayloadAction<{id:string}>) => {
            state.draftProductOrders.value.forEach(item => {
                if(item.id === action.payload.id){
                    item.quantity! += 1
                }
            })
            state.draftProductOrders.updatedAt = Date.now()
        },
        decreaseProductOrderQuantity: (state, action:PayloadAction<{id:string}>) => {
            state.draftProductOrders.value.forEach(item => {
                if(item.id === action.payload.id){
                    item.quantity! -= 1
                }
            })
            state.draftProductOrders.updatedAt = Date.now()
        },
        clear:(state,action) => {
            state.draftProductOrders = {value: [], updatedAt: Date.now()}
            state.draftOrderAmount = {value: 0, updatedAt: Date.now()}
        },
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
            batchUpdateState(state, action)
        }
    }
)

export const createOrderActions = slice.actions

export const createOrderSliceConfig: WorkspaceModuleSliceConfig<CreateOrderState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}