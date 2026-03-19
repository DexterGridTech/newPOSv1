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
import {updateMoneyString, centsToMoneyString, moneyStringToCents} from "@impos2/kernel-order-base";

// 所有 price / amount 均以整数"分"存储，彻底避免浮点精度问题。
// 转换边界：
//   用户输入（元字符串）→ 分：moneyStringToCents(moneyString)
//   分 → 用户可见字符串（元）：centsToMoneyString(cents)

const updateTotal = (state: CreateOrderState, now: number) => {
    // 各行 amount（分）直接整数累加，无精度损失
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
                productOrderCode: id,
                saleTypeCode: action.payload.saleTypeCode,
                productName: action.payload.productName,
                displayName: action.payload.displayName,
                quantity: 1,
                price: 0,           // 单位：分
                moneyString: '0',   // 用户可见的元字符串，用于键盘编辑
                amount: 0,          // 单位：分，= price * quantity
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
                const order = state.draftProductOrders.value.find(o => o.id === targetId)
                if (order) {
                    // price（分）→ moneyString（元字符串），用 centsToMoneyString 保证精度
                    order.moneyString = centsToMoneyString(order.price!)
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
                // price（分）* quantity = amount（分），整数乘法无精度问题
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
                // price（分）* quantity = amount（分），整数乘法无精度问题
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
        setMoneyString: (state, action: PayloadAction<{ char: string }>) => {
            const selectedId = state.selected.value
            if (!selectedId) return

            const now = Date.now()
            const order = state.draftProductOrders.value.find(o => o.id === selectedId)
            if (!order) return

            // moneyString 始终是用户输入的元字符串（如 "76.43"）
            order.moneyString = updateMoneyString(order.moneyString || '0', action.payload.char)
            // 元字符串 → 分（整数），Math.round 消除浮点误差
            order.price = moneyStringToCents(order.moneyString)
            // price（分）* quantity = amount（分），整数乘法
            order.amount = order.price! * order.quantity!
            state.draftProductOrders.updatedAt = now
            updateTotal(state, now)
        },
        batchUpdateState: (state, action) => {
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
