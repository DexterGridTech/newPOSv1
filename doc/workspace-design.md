# Workspace Slice 框架设计文档

## 一、设计背景与用意

### 问题
当前系统中 `WorkSpace` 有两个值：`Main` 和 `Branch`，代表两个同时存在、互不干扰的工作区。业务模块（如订单、购物车等）需要在两个工作区中各自维护一份独立的状态数据。

如果为每个工作区手动定义两套 slice/action/reducer，会导致：
- 大量重复代码
- 维护成本翻倍
- 新增业务模块时容易遗漏

### 目标
开发者只定义一次 slice，框架自动为每个 WorkSpace 生成独立的 Redux slice。在 Actor 中 dispatch action 时，框架根据 `command.extra.workspace` 自动路由到对应工作区的 slice，业务代码完全无感知。

### 设计原则：最小侵入

| 现有文件 | 是否修改 | 说明 |
|---|---|---|
| `base/applicationManager.ts` | 不修改 | 展开后的 slice 是标准 `ModuleSliceConfig`，自然兼容 |
| `base/storeEntry.ts` | 不修改 | workspace key 通过 RootState 声明合并获得类型提示 |
| `base/createModuleStateKeys.ts` | 不修改 | 新函数独立共存 |
| `base/moduleSliceConfig.ts` | 不修改 | 新接口通过转换函数适配 |
| `interconnection/modulePreSetup.ts` | 不修改 | `commandWithWorkspaceConverter` 已注册 |
| `interconnection/foundations/index.ts` | 修改 | 新增导出 `workspace.ts` |
| `interconnection/src/index.ts` | 修改 | 新增导出 workspace 工具 |

新建文件：`interconnection/src/foundations/workspace.ts`

---

## 二、数据流全景

```
开发者定义: orderSlice (一份 reducer 定义)
    ↓ createWorkspaceSlice()
框架生成: "xxx.order.main" slice + "xxx.order.branch" slice
    ↓ toModuleSliceConfigs() → 标准 ModuleSliceConfig
注册到 AppModule.slices
    ↓ ApplicationManager.createStore() 步骤8 遍历 slices
两个 slice 各自成为 rootReducer 的一个 key（与现有流程完全一致）
    ↓ Actor 中使用
dispatchWorkspaceAction(actions.addItem(item), command)
    ↓ 读取 command.extra.workspace（由 commandWithWorkspaceConverter 自动注入）
workspace=main  → dispatch { type: "xxx.order.main/addItem" }
workspace=branch → dispatch { type: "xxx.order.branch/addItem" }
```

---

## 三、API 设计详解

### 3.1 `createModuleWorkspaceStateKeys`

与现有 `createModuleStateKeys` 对应，生成逻辑 key。

```typescript
// 签名
function createModuleWorkspaceStateKeys<M extends string, T extends readonly string[]>(
    moduleName: M,
    keys: T
): { [K in T[number]]: `${M}.${K}` }

// 使用
const orderState = createModuleWorkspaceStateKeys('business.order', ['order', 'cart'] as const)
// orderState.order = "business.order.order"
// orderState.cart  = "business.order.cart"
```

生成的是逻辑 key（不带 workspace 后缀），实际的 `"xxx.order.main"` / `"xxx.order.branch"` 由 `createWorkspaceSlice` 在创建 slice 时生成。

### 3.2 `CreateModuleWorkspaceStateType`

类型工具，用于扩展 `RootState`。

```typescript
// 定义
type CreateModuleWorkspaceStateType<T extends Record<string, any>> = {
    [K in keyof T as `${K & string}.${WorkSpaceValues}`]: T[K]
}

// 使用
type OrderModuleStates = CreateModuleWorkspaceStateType<{
    [orderState.order]: OrderState,  // "business.order.order"
    [orderState.cart]: CartState,    // "business.order.cart"
}>

// 展开结果：
// {
//     "business.order.order.main": OrderState,
//     "business.order.order.branch": OrderState,
//     "business.order.cart.main": CartState,
//     "business.order.cart.branch": CartState,
// }

// 声明合并
declare module '@impos2/kernel-core-base' {
    export interface RootState extends OrderModuleStates {}
}
```

### 3.3 `createWorkspaceSlice`

核心函数，一次定义生成两个独立 slice。

```typescript
// 签名
function createWorkspaceSlice<State, CR extends SliceCaseReducers<State>, Name extends string>(
    name: Name,           // 逻辑 key，如 "business.order.order"
    initialState: State,
    reducers: CR
): WorkspaceSliceResult<State, CR, Name>

// 返回值
interface WorkspaceSliceResult<State, CR, Name> {
    name: Name                                    // "business.order.order"
    actions: { [K in keyof CR]: ActionCreator }   // 与普通 createSlice 一致
    reducers: { main: Reducer, branch: Reducer }  // 每个 workspace 的 reducer
    sliceNames: { main: string, branch: string }  // 完整 slice name
}
```

内部实现：遍历 `WorkSpace` enum，对每个值调用 RTK 的 `createSlice`，生成独立的 slice。

```typescript
// 使用
const orderSlice = createWorkspaceSlice(
    orderState.order,  // "business.order.order"
    { items: [], total: 0 },
    {
        addItem: (state, action: PayloadAction<Item>) => {
            state.items.push(action.payload)
            state.total += action.payload.price
        },
        clear: (state) => {
            state.items = []
            state.total = 0
        }
    }
)

// orderSlice.actions.addItem / orderSlice.actions.clear
// orderSlice.reducers.main / orderSlice.reducers.branch
// orderSlice.sliceNames.main = "business.order.order.main"
// orderSlice.sliceNames.branch = "business.order.order.branch"
```

### 3.4 `WorkspaceModuleSliceConfig` + `toModuleSliceConfigs`

配置桥接，将 workspace config 转换为标准 `ModuleSliceConfig`。

```typescript
// 接口
interface WorkspaceModuleSliceConfig<State> {
    name: string
    reducers: Record<WorkSpaceValues, Reducer<State>>
    statePersistToStorage: boolean
    stateSyncToSlave: boolean
    persistBlacklist?: string[]
}

// 转换函数
function toModuleSliceConfigs<State>(
    config: WorkspaceModuleSliceConfig<State>
): Record<string, ModuleSliceConfig<State>>

// 使用
const orderSliceConfig: WorkspaceModuleSliceConfig<OrderState> = {
    name: orderSlice.name,
    reducers: orderSlice.reducers,
    statePersistToStorage: true,
    stateSyncToSlave: false
}

// 注册到 AppModule.slices
export const orderModuleSlices = {
    ...toModuleSliceConfigs(orderSliceConfig),
    ...toModuleSliceConfigs(cartSliceConfig),
    // 非 workspace 的 slice 也可以正常混入
    someNormalSlice: someNormalSliceConfig,
}
```

`toModuleSliceConfigs` 输出：
```
{
    "business.order.order.main": { name: "...", reducer: Reducer, ... },
    "business.order.order.branch": { name: "...", reducer: Reducer, ... },
}
```

这些是标准的 `ModuleSliceConfig`，`ApplicationManager.createStore` 的步骤 8 无需任何修改即可处理。

### 3.5 `dispatchWorkspaceAction`

核心路由函数，在 Actor 中使用。

```typescript
// 签名
function dispatchWorkspaceAction(
    action: PayloadAction<any>,
    command: Command<any>
): void
```

内部逻辑：
1. 从 `command.extra.workspace` 读取当前 workspace（不存在则抛异常）
2. 将 action.type 中的 workspace 部分替换为实际值
3. 调用 `storeEntry.dispatchAction` 完成 dispatch

```
输入: action.type = "business.order.order.main/addItem"
      command.extra.workspace = "branch"
输出: dispatch { type: "business.order.order.branch/addItem", payload: ... }
```

```typescript
// 使用
export class OrderActor extends Actor {
    addItem = Actor.defineCommandHandler(orderCommands.addItem,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(orderActions.addItem(command.payload), command)
            return Promise.resolve({});
        })
}
```

### 3.6 `getWorkspaceStateByKey`

辅助函数，在 Actor 中读取对应 workspace 的 state。

```typescript
// 签名
function getWorkspaceStateByKey<State>(baseKey: string, command: Command<any>): State

// 使用
const order = getWorkspaceStateByKey<OrderState>(orderState.order, command)
// command.extra.workspace = "main"
// → storeEntry.getStateByKey("business.order.order.main")
```

---

## 四、完整使用流程示例

### 步骤 1：定义 state keys

```typescript
// src/types/shared/moduleStateKey.ts
import { createModuleWorkspaceStateKeys } from '@impos2/kernel-core-interconnection'

export const orderState = createModuleWorkspaceStateKeys(
    'business.order',
    ['order', 'cart'] as const
)
```

### 步骤 2：定义 state 类型并扩展 RootState

```typescript
// src/types/state/order.ts
export interface OrderState {
    items: Array<{ id: string; name: string; price: number }>
    total: number
}

// src/types/kernel-core-base-augment.ts
import { CreateModuleWorkspaceStateType } from '@impos2/kernel-core-interconnection'

type OrderModuleStates = CreateModuleWorkspaceStateType<{
    [orderState.order]: OrderState,
}>

declare module '@impos2/kernel-core-base' {
    export interface RootState extends OrderModuleStates {}
}
```

### 步骤 3：创建 workspace slice

```typescript
// src/features/slices/order.ts
import { createWorkspaceSlice, WorkspaceModuleSliceConfig, toModuleSliceConfigs } from '@impos2/kernel-core-interconnection'

const orderSlice = createWorkspaceSlice(
    orderState.order,
    { items: [], total: 0 } as OrderState,
    {
        addItem: (state, action: PayloadAction<Item>) => {
            state.items.push(action.payload)
            state.total += action.payload.price
        },
        clear: (state) => {
            state.items = []
            state.total = 0
        }
    }
)

export const orderActions = orderSlice.actions

const orderSliceConfig: WorkspaceModuleSliceConfig<OrderState> = {
    name: orderSlice.name,
    reducers: orderSlice.reducers,
    statePersistToStorage: true,
    stateSyncToSlave: false
}
```

### 步骤 4：注册到 AppModule

```typescript
// src/features/slices/index.ts
export const orderModuleSlices = {
    ...toModuleSliceConfigs(orderSliceConfig),
}

// src/index.ts
export const orderModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: orderModuleSlices,
    // ...
}
```

### 步骤 5：在 Actor 中使用

```typescript
// src/features/actors/order.ts
import { dispatchWorkspaceAction, getWorkspaceStateByKey } from '@impos2/kernel-core-interconnection'

export class OrderActor extends Actor {
    addItem = Actor.defineCommandHandler(orderCommands.addItem,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(orderActions.addItem(command.payload), command)

            const order = getWorkspaceStateByKey<OrderState>(orderState.order, command)
            logger.log(["order"], `当前订单总额: ${order.total}`)

            return Promise.resolve({});
        })
}
```

---

## 五、文件变更清单

### 新建

| 文件 | 说明 |
|---|---|
| `interconnection/src/foundations/workspace.ts` | 所有 workspace 工具函数和类型 |

### 修改

| 文件 | 变更内容 |
|---|---|
| `interconnection/src/foundations/index.ts` | 新增 `export * from './workspace'` |
| `interconnection/src/index.ts` | 确保 workspace 工具从包入口导出 |

### 不修改

| 文件 | 原因 |
|---|---|
| `base/applicationManager.ts` | 展开后的 slice 是标准 ModuleSliceConfig，步骤 8 自然兼容 |
| `base/storeEntry.ts` | workspace key 通过 RootState 声明合并获得类型提示 |
| `base/createModuleStateKeys.ts` | 新函数独立共存 |
| `base/moduleSliceConfig.ts` | 新接口通过 toModuleSliceConfigs 转换适配 |
| `interconnection/modulePreSetup.ts` | commandWithWorkspaceConverter 已注册 |
