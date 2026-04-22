# 2026-04-14 ui-runtime-v2 重构设计

## 1. 目标

`_old_/1-kernel/1.1-cores/ui-runtime` 是对旧 `navigation` 的替代，但它仍依赖旧 `base / interconnection` 基础设施。

本轮目标是在 `1-kernel/1.1-base` 中新建 `ui-runtime-v2`，让 UI 运行时能力基于新基础设施重构：

1. `runtime-shell-v2`：command / actor / request 观测。
2. `state-runtime`：Redux state、持久化、同步描述。
3. `topology-runtime-v2`：instanceMode / displayMode / workspace 上下文与主副屏 state sync。
4. `contracts`：时间、ID、错误、参数、通用类型约束。

`ui-runtime-v2` 仍然是基础能力。后续 `2-ui` 和业务 UI 都应该基于它组织 screen、overlay 与 UI runtime state。

## 2. 旧 navigation 的设计亮点

旧 `navigation` 真正有价值的点不是“导航”这个名字，而是 POS 多屏 UI 的运行时抽象：

1. `ScreenPart` 是 UI 运行时的最小业务单元，不是 URL route。
2. screen 注册可以按 `screenMode / workspace / instanceMode` 过滤。
3. `getFirstReadyScreenPartByContainerKey(containerKey, fromIndex)` 支持按容器和顺序找到下一个可进入 screen。
4. `readyToEnter` 允许 screen 自己声明是否可进入。
5. modal / overlay 使用 screen part 思路复用同一套 UI 描述。
6. UI 变量可以作为跨组件、跨屏幕的临时运行态存储。
7. workspace slice + 主副屏同步让 UI 状态不需要每个 UI 包自己写同步逻辑。

这些设计亮点需要继承。

## 3. 现有 ui-runtime 的增强

现有 `_old_/1-kernel/1.1-cores/ui-runtime` 已经比旧 `navigation` 更清晰：

1. 把 `screen`、`overlay`、`uiVariables` 拆成三个独立 slice。
2. `showScreen / replaceScreen / resetScreen` 明确 container 当前 screen 语义。
3. `openOverlay / closeOverlay / clearOverlays` 明确 overlay stack 语义。
4. `setUiVariables / clearUiVariables` 保留通用 UI 变量能力。
5. 所有同步顶层字段使用 `ValueWithUpdatedAt`，清理用 `null + updatedAt`。
6. 增加单进程状态验证与双进程主副屏同步验证。

这些增强也需要继承。

## 4. 必须修正的问题

### 4.1 kernel 不依赖 React

旧 `navigation` 和现有 `ui-runtime` 的 `ScreenPartRegistration` 携带 `componentType: ComponentType<any>`，导致 kernel 包依赖 React。

`ui-runtime-v2` 不再保存 React 组件类型。

新模型：

1. kernel 只保存 `UiScreenDefinition`。
2. `UiScreenDefinition` 用 `rendererKey` 表示视图渲染句柄。
3. `2-ui` 层自己维护 `rendererKey -> React component` 映射。
4. kernel selector 返回 screen definition 或 runtime entry，不返回 React 组件。

这样可以继承 `ScreenPart` 驱动 UI 的业务特点，同时满足 `1-kernel` 不依赖 React 的架构约束。

### 4.2 不再依赖旧 workspace helper

旧实现依赖 `createWorkspaceSlice / dispatchWorkspaceAction / SyncType`。

`ui-runtime-v2` 应改用 `state-runtime` 的 scoped slice / sync descriptor，并从 `topology-runtime-v2` 读取当前 `workspace / displayMode / instanceMode`。

### 4.3 action 不对外作为跨包写入口

继续继承约束：

1. state 全局可读。
2. selector 公开。
3. command 公开。
4. slice action 只作为包内实现细节，跨包写入必须走 command。

## 5. 包定位

路径：

`1-kernel/1.1-base/ui-runtime-v2`

包名：

`@impos2/kernel-base-ui-runtime-v2`

模块名：

`kernel.base.ui-runtime-v2`

职责：

1. screen definition registry。
2. container 当前 screen runtime state。
3. overlay stack runtime state。
4. UI variable runtime state。
5. workspace 维度持久化与主副屏同步。
6. selector 查询。
7. command / actor 写入。

不做：

1. 不保存 React component。
2. 不实现 React hooks。
3. 不做浏览器路由。
4. 不做业务 screen 生命周期、guard、resolver。
5. 不迁移 `2-ui` 包。

## 6. 类型模型

### 6.1 `UiScreenDefinition`

```ts
interface UiScreenDefinition<TProps = unknown> {
  partKey: string
  rendererKey: string
  name: string
  title: string
  description: string
  containerKey?: string
  indexInContainer?: number | null
  screenModes: readonly string[]
  workspaces: readonly string[]
  instanceModes: readonly string[]
  readyToEnter?: () => boolean
  metadata?: Record<string, unknown>
}
```

### 6.2 `UiScreenRuntimeEntry`

```ts
interface UiScreenRuntimeEntry<TProps = unknown> {
  partKey: string
  rendererKey: string
  name: string
  title: string
  description: string
  containerKey: string
  id?: string | null
  props?: TProps
  source?: string
  operation: 'show' | 'replace'
}
```

### 6.3 `UiOverlayEntry`

```ts
interface UiOverlayEntry<TProps = unknown> {
  id: string
  screenPartKey: string
  rendererKey: string
  props?: TProps
  openedAt: number
}
```

### 6.4 `UiRuntimeValue`

state-runtime 同步值使用 `SyncValueEnvelope<T>`，即：

```ts
{
  value?: T
  updatedAt: number
  tombstone?: boolean
}
```

删除或清理继续使用 tombstone / null 语义，不做直接 delete。

## 7. State 设计

`ui-runtime-v2` 使用 workspace 维度拆 slice：

1. `kernel.base.ui-runtime-v2.screen.workspace.main`
2. `kernel.base.ui-runtime-v2.screen.workspace.branch`
3. `kernel.base.ui-runtime-v2.overlay.workspace.main`
4. `kernel.base.ui-runtime-v2.overlay.workspace.branch`
5. `kernel.base.ui-runtime-v2.ui-variable.workspace.main`
6. `kernel.base.ui-runtime-v2.ui-variable.workspace.branch`

逻辑状态：

```ts
type UiScreenRuntimeState = Record<string, SyncValueEnvelope<UiScreenRuntimeEntry | null>>

type UiOverlayRuntimeState = {
  primaryOverlays: SyncValueEnvelope<UiOverlayEntry[]>
  secondaryOverlays: SyncValueEnvelope<UiOverlayEntry[]>
}

type UiVariableRuntimeState = Record<string, SyncValueEnvelope<unknown>>
```

持久化：

1. 三类 slice 都是 owner-only 持久化。
2. screen 和 ui variable 用 record persistence，避免整包对象过大。
3. overlay 当前先按字段持久化，因为只有 `primaryOverlays / secondaryOverlays` 两个字段。

同步：

1. 三类 slice 都声明 record sync。
2. 主副同步由 `topology-runtime-v2` 根据 state-runtime sync descriptor 处理。
3. 清理使用 tombstone 或 `value: null`，保证远端可以收到覆盖事件。

## 8. Command / Actor 设计

公开 command：

1. `registerScreenDefinitions`
2. `showScreen`
3. `replaceScreen`
4. `resetScreen`
5. `openOverlay`
6. `closeOverlay`
7. `clearOverlays`
8. `setUiVariables`
9. `clearUiVariables`

actor 按职责拆分：

1. `ScreenRegistryActor`：处理 screen definition 注册。
2. `ScreenRuntimeActor`：处理 container current screen。
3. `OverlayRuntimeActor`：处理 overlay stack。
4. `UiVariableRuntimeActor`：处理 UI variable。

跨包调用只使用 command。

## 9. Selector 设计

公开 selector：

1. `selectUiRuntimeCurrentWorkspace(state)`
2. `selectUiRuntimeCurrentDisplayMode(state)`
3. `selectUiScreen(state, containerKey, defaultValue?)`
4. `selectUiOverlays(state, displayMode?)`
5. `selectUiVariable(state, key, defaultValue?)`
6. `selectUiScreenDefinition(partKey, context?)`
7. `selectUiScreenDefinitionsByContainer(containerKey, context?)`
8. `selectFirstReadyUiScreenDefinition(containerKey, fromIndex, context?)`

screen registry 是运行时 registry，不进 Redux state。原因：

1. `readyToEnter` 是函数，不能持久化。
2. definition 是模块声明/安装期能力，不是业务运行值。
3. 重启后由模块重新安装注册即可。

## 10. 与旧设计相比的提升

1. 保留 `ScreenPart` 驱动 UI 的业务语言，但移除 React 依赖。
2. 保留 workspace 同步语义，但改由 `state-runtime/topology-runtime-v2` 承接。
3. 保留 command / actor 写入模式，但升级到 `runtime-shell-v2` 的广播执行与聚合 result。
4. 保留 UI runtime 三大状态，但持久化粒度更细。
5. `hooks/index.ts` 只保留规则注释，不在 kernel 实现 React hooks。

