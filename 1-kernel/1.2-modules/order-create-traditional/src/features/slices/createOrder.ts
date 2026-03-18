import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection'
import {kernelOrderCreateTraditionalWorkspaceState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, shortId} from "@impos2/kernel-core-base";
import {CreateOrderState} from "../../types/state/createOrder";
import {PayloadAction} from "@reduxjs/toolkit";
import {ProductBase} from "@impos2/kernel-product-base";
import {updateValueStr} from "@impos2/kernel-order-base";

const updateTotal = (state: CreateOrderState, now: number) => {
    state.total.value = state.draftProductOrders.value.reduce((sum, o) => sum + (o.amount || 0), 0)
    state.total.updatedAt = now
}

const initialState: CreateOrderState = {
    draftProductOrders: { value: [], updatedAt: 0 },
    selected: { value: null, updatedAt: 0 },
    total: { value: 0, updatedAt: 0 },
    sessionId: { value: shortId(), updatedAt: 0 }
}
const slice = createWorkspaceSlice(
    kernelOrderCreateTraditionalWorkspaceState.createOrder,
    initialState,
    {
        addProductOrder: (state, action: PayloadAction<ProductBase>) => {
            const now = Date.now()
            const id = shortId()
            state.draftProductOrders.value.push({
                id,
                productOrderCode:id,
                saleTypeCode: action.payload.saleTypeCode,
                productName: action.payload.productName,
                displayName: action.payload.displayName,
                quantity: 1,
                price: 0,
                valueStr: '0',
                amount: 0,
            })
            state.draftProductOrders.updatedAt = now
            state.selected.value = id
            state.selected.updatedAt = now
            updateTotal(state, now)
        },
        selectProductOrder: (state, action: PayloadAction<{ id: string }>) => {
            const now = Date.now()
            const targetId = action.payload.id
            const isCurrentlySelected = state.selected.value === targetId

            if (isCurrentlySelected) {
                state.selected.value = null
            } else {
                // 选中：将 price 转为 valueStr 用于编辑
                const order = state.draftProductOrders.value.find(o => o.id === targetId)
                if (order) {
                    order.valueStr = order.price!.toString()
                    state.draftProductOrders.updatedAt = now
                }
                state.selected.value = targetId
            }
            state.selected.updatedAt = now
        },
        removeProductOrder: (state, action: PayloadAction<{ id: string }>) => {
            const now = Date.now()
            state.draftProductOrders.value = state.draftProductOrders.value.filter(order => order.id !== action.payload.id)
            state.draftProductOrders.updatedAt = now
            if (state.selected.value === action.payload.id) {
                state.selected.value = null
                state.selected.updatedAt = now
            }
            updateTotal(state, now)
        },
        increaseProductOrderQuantity: (state, action: PayloadAction<{ id: string }>) => {
            const now = Date.now()
            const order = state.draftProductOrders.value.find(o => o.id === action.payload.id)
            if (order && order.quantity! < 99) {
                order.quantity! += 1
                order.amount = order.price! * order.quantity!
                state.draftProductOrders.updatedAt = now
                updateTotal(state, now)
            }
        },
        decreaseProductOrderQuantity: (state, action: PayloadAction<{ id: string }>) => {
            const now = Date.now()
            const order = state.draftProductOrders.value.find(o => o.id === action.payload.id)
            if (order && order.quantity! > 1) {
                order.quantity! -= 1
                order.amount = order.price! * order.quantity!
                state.draftProductOrders.updatedAt = now
                updateTotal(state, now)
            }
        },
        clear: (state) => {
            const now = Date.now()
            state.draftProductOrders = { value: [], updatedAt: now }
            state.selected = { value: null, updatedAt: now }
            state.total = { value: 0, updatedAt: now }
            state.sessionId = { value: shortId(), updatedAt: now }
        },
        setValueStr: (state, action: PayloadAction<{ char: string }>) => {
            const selectedId = state.selected.value
            if (!selectedId) return

            const now = Date.now()
            const order = state.draftProductOrders.value.find(o => o.id === selectedId)
            if (!order) return

            order.valueStr = updateValueStr(order.valueStr || '0', action.payload.char)
            order.price = Number(order.valueStr)
            order.amount = order.price! * order.quantity!
            state.draftProductOrders.updatedAt = now
            updateTotal(state, now)
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