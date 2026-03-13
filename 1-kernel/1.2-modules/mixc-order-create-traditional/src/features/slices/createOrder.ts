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
import {updateValueStr} from "@impos2/kernel-mixc-order-base";

const initialState: CreateOrderState = {}
const slice = createWorkspaceSlice(
    kernelMixcOrderCreateTraditionalWorkspaceState.createOrder,
    initialState,
    {
        addProductOrder: (state, action: PayloadAction<Product>) => {
            Object.keys(state).forEach(id => {
                if (state[id].value.selected) {
                    state[id].value.selected = false
                    state[id].updatedAt = Date.now()
                }
            })
            const id = shortId()
            state[id] = {
                value: {
                    id,
                    productCode: action.payload.productCode,
                    productName: action.payload.productName,
                    displayName: action.payload.displayName,
                    quantity: 1,
                    price: 0,
                    valueStr: '0',
                    amount: 0,
                    selected: true,
                },
                updatedAt: Date.now()
            }
        },
        selectProductOrder: (state, action: PayloadAction<{ id: string }>) => {
            const targetId = action.payload.id
            const now = Date.now()

            Object.keys(state).forEach(id => {
                const item = state[id]
                const isTarget = id === targetId
                const shouldSelect = isTarget && !item.value.selected

                if (item.value.selected || isTarget) {
                    item.value.selected = shouldSelect
                    item.value.price = shouldSelect ? item.value.price : Number(item.value.valueStr)
                    item.value.valueStr = shouldSelect ? item.value.price!.toString() : item.value.valueStr
                    item.value.amount = shouldSelect ? item.value.amount : item.value.price! * item.value.quantity!
                    item.updatedAt = now
                }
            })
        },
        removeProductOrder: (state, action: PayloadAction<{ id: string }>) => {
            delete state[action.payload.id]
        },
        increaseProductOrderQuantity: (state, action: PayloadAction<{ id: string }>) => {
            const item = state[action.payload.id]
            if (item && item.value.quantity! < 99) {
                item.value.quantity! += 1
                item.value.amount = item.value.price! * item.value.quantity!
                item.updatedAt = Date.now()
            }
        },
        decreaseProductOrderQuantity: (state, action: PayloadAction<{ id: string }>) => {
            const item = state[action.payload.id]
            if (item && item.value.quantity! > 1) {
                item.value.quantity! -= 1
                item.value.amount = item.value.price! * item.value.quantity!
                item.updatedAt = Date.now()
            }
        },
        clear: () => ({}),
        setValueStr: (state, action: PayloadAction<{ id: string, char: string }>) => {
            const item = state[action.payload.id]
            if (!item) return

            item.value.valueStr = updateValueStr(item.value.valueStr || '0', action.payload.char)
            item.updatedAt = Date.now()
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