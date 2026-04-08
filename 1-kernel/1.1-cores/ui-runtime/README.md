# @impos2/kernel-core-ui-runtime

`@impos2/kernel-core-ui-runtime` 是当前工程里新的 UI 运行时核心包。

它不是浏览器路由器，也不是传统 Web `navigation` 包，而是一个面向 POS / 多屏终端场景的 UI runtime orchestration 核心。

它负责的不是 URL，而是下面这些运行时能力：

1. `ScreenPart` 注册与查找
2. container 当前 screen 状态
3. overlay / modal 栈状态
4. 通用 UI 临时变量状态
5. 这些状态在主副屏之间的同步
6. 这些状态在本地主屏上的持久化

## 1. 为什么有这个包

旧的 `navigation` 包实际上已经不只是“导航”。

它同时承担了：

1. screen registry
2. 当前 screen 切换
3. modal / overlay 管理
4. UI 临时变量

对于 POS 这类运行时 UI 系统，这个方向本身没有错，但旧包内部把这些能力混在一起，尤其把很多 runtime 状态都堆进了同一个 `uiVariables` bucket。

`ui-runtime` 的目标不是推翻原思路，而是在保留原思路的前提下，把职责重新组织清楚：

1. `screen` 单独成 slice
2. `overlay` 单独成 slice
3. `uiVariables` 单独成 slice
4. 继续保留 `ScreenPart` 驱动 UI 的思想
5. 继续兼容主副屏同步和主屏持久化

设计说明见：

1. [docs/superpowers/specs/2026-04-08-ui-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-08-ui-runtime-design.md)

开发与调试方法论见：

1. [spec/kernel-core-ui-runtime-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md)

## 2. 包定位

目录：

`1-kernel/1.1-cores/ui-runtime`

包名：

`@impos2/kernel-core-ui-runtime`

模块名：

`kernel.core.ui-runtime`

## 3. 核心职责

### 3.1 Screen registry

包内保留全局 `ScreenPart` 注册模型。

它提供：

1. 注册 `ScreenPartRegistration`
2. 根据 `partKey` 查找 `componentType`
3. 根据 `containerKey` 查找可进入 screen
4. 根据当前运行时上下文过滤 screen

过滤上下文包括：

1. `screenMode`
2. `workspace`
3. `instanceMode`

实现位置：

1. [src/foundations/screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/foundations/screen.ts)

### 3.2 Screen runtime

用于维护某个 container 当前正在显示哪个 `ScreenPart`。

它负责：

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`
4. selector 读取当前 screen

实现位置：

1. [src/features/slices/screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/features/slices/screen.ts)

### 3.3 Overlay runtime

用于维护当前 display 上的 overlay 列表。

它负责：

1. `openOverlay`
2. `closeOverlay`
3. `clearOverlays`
4. selector 读取当前 display 的 overlays

实现位置：

1. [src/features/slices/overlay.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/features/slices/overlay.ts)

### 3.4 UI variable runtime

用于存储运行态的通用 UI 临时变量。

它负责：

1. `setUiVariables`
2. `clearUiVariables`
3. selector / hook 读取变量值

实现位置：

1. [src/features/slices/uiVariables.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/features/slices/uiVariables.ts)

## 4. 对外导出

包入口：

1. [src/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/index.ts)

当前主要导出分成 5 类。

### 4.1 模块导出

1. `kernelCoreUiRuntimeModule`
2. `kernelCoreUiRuntimeSlice`
3. `kernelCoreUiRuntimeCommands`
4. `kernelCoreUiRuntimeErrorMessages`
5. `kernelCoreUiRuntimeParameters`
6. `kernelCoreUiRuntimeApis`

### 4.2 foundations

来自 [src/foundations/screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/foundations/screen.ts)：

1. `registerScreenPart`
2. `getScreenPartComponentType`
3. `getScreenPartReadyToEnter`
4. `getFirstReadyScreenPartByContainerKey`
5. `getScreenPartsByContainerKey`
6. `createOverlayScreen`
7. `createModalScreen`
8. `createOverlayEntry`
9. `createAlert`
10. `defaultAlertPartKey`

### 4.3 hooks

来自 [src/hooks/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/hooks/index.ts)：

1. `useEditableUiVariable`
2. `useUiOverlays`
3. `useUiModels`
4. `useChildScreenPart`
5. `UiVariable<T>` 类型

### 4.4 selectors

来自 [src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/selectors/index.ts)：

1. `selectUiVariable`
2. `selectCurrentScreen`
3. `selectCurrentOverlays`

### 4.5 types

类型集中在：

1. [src/types/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/types/index.ts)
2. [src/types/foundations/screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/types/foundations/screen.ts)

当前常用类型包括：

1. `ModalScreen<T>`
2. `OverlayEntry<T>`
3. `ScreenEntry<T>`
4. `AlertInfo`
5. `ScreenRuntimeState`
6. `OverlayRuntimeState`
7. `UiVariablesState`

## 5. 模块接入方式

最基本的接入方式是把 `kernelCoreUiRuntimeModule` 加进应用模块依赖链。

示例：

```ts
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeModule} from "@impos2/kernel-core-ui-runtime";

export const someUiModule: AppModule = {
  name: "some.ui.module",
  version: "1.0.0",
  slices: {},
  middlewares: {},
  epics: {},
  commands: {},
  actors: {},
  errorMessages: {},
  parameters: {},
  dependencies: [
    kernelCoreInterconnectionModule,
    kernelCoreUiRuntimeModule,
  ],
  screenParts: {
    // your screen parts
  },
}
```

## 6. ScreenPart 注册流程

`ui-runtime` 通过模块预初始化把自己的 `registerScreenPart` 注册到 base 的 `screenPartRegisters` 中。

实现位置：

1. [src/application/modulePreSetup.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/application/modulePreSetup.ts)

也就是说：

1. 业务模块只需要把自己的 `screenParts` 挂在 `AppModule.screenParts`
2. `ApplicationManager.generateStore(...)` 时会统一遍历这些 `screenParts`
3. 最终由 `ui-runtime` 的 registry 接管注册

## 7. 状态模型

`ui-runtime` 不是一个单 slice 包，而是 3 个 workspace slices。

### 7.1 `screen`

逻辑 shape：

```ts
type ScreenRuntimeState = Record<string, ValueWithUpdatedAt<ScreenEntry | null>>
```

其中：

1. key 是 `containerKey`
2. value 是当前 screen entry
3. 清空时写入 `null + updatedAt`

screen entry 中额外包含：

1. `source`
2. `operation`

这两个字段便于区分状态来源和意图。

### 7.2 `overlay`

逻辑 shape：

```ts
type OverlayRuntimeState = {
  primaryOverlays: ValueWithUpdatedAt<OverlayEntry[]>
  secondaryOverlays: ValueWithUpdatedAt<OverlayEntry[]>
}
```

这里按 `DisplayMode` 分成两组 overlay 栈：

1. `primaryOverlays`
2. `secondaryOverlays`

### 7.3 `uiVariables`

逻辑 shape：

```ts
type UiVariablesState = Record<string, ValueWithUpdatedAt<any>>
```

它本质上是一个运行时 key-value store。

当前阶段没有额外 schema 管理，也没有生命周期策略。

## 8. 持久化与主副屏同步语义

这个包最重要的点不是 reducer 本身，而是：

1. 需要被持久化
2. 需要被主副屏同步
3. 需要兼容当前 interconnection 的 diff / merge 机制

### 8.1 持久化规则

当前 3 个 slices 都设置了 `persistToStorage: true`。

但实际是否落盘，仍由 `ApplicationManager` 决定：

1. 只有 `persistToStorage: true` 的 slice 才会包 `persistReducer`
2. 只有 `displayIndex === 0` 的实例真正持久化

因此当前语义是：

1. 主屏持久化
2. 副屏不持久化

### 8.2 主副屏同步规则

3 个 slices 都是 workspace slice，并配置了：

1. `Workspace.MAIN -> MASTER_TO_SLAVE`
2. `Workspace.BRANCH -> SLAVE_TO_MASTER`

也就是说：

1. `main` 工作区里的 UI runtime 状态，默认从主屏同步到副屏
2. `branch` 工作区里的 UI runtime 状态，默认从副屏同步回主屏

### 8.3 为什么顶层字段必须带 `updatedAt`

当前同步中间件依赖顶层字段时间戳做 merge。

因此：

1. `screen[containerKey]`
2. `overlay.primaryOverlays`
3. `overlay.secondaryOverlays`
4. `uiVariables[key]`

都必须是 `ValueWithUpdatedAt<T>`。

如果直接存 raw value，会丢失同步比较依据。

### 8.4 为什么 clear 不直接 delete

在这个包里：

1. `resetScreen`
2. `clearUiVariables`

清理时都不是 `delete`，而是：

```ts
{ value: null, updatedAt: Date.now() }
```

原因是：

1. 需要让同步层看到“这是一次新的覆盖写入”
2. `delete` 在跨端 merge 里不稳定

## 9. Commands

定义位置：

1. [src/features/commands/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/features/commands/index.ts)

### 9.1 screen commands

1. `showScreen({ target, source? })`
2. `replaceScreen({ target, source? })`
3. `resetScreen({ containerKey })`

### 9.2 overlay commands

1. `openOverlay({ overlay })`
2. `closeOverlay({ overlayId })`
3. `clearOverlays()`

### 9.3 uiVariables commands

1. `setUiVariables(record)`
2. `clearUiVariables(keys)`

## 10. Actors

actors 入口：

1. [src/features/actors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/features/actors/index.ts)

分成：

1. `InitializeActor`
2. `ScreenActor`
3. `OverlayActor`
4. `UiVariableActor`

### 10.1 InitializeActor

只负责初始化日志和模块启动。

### 10.2 ScreenActor

负责把：

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`

转成 workspace slice action。

### 10.3 OverlayActor

负责：

1. 读取当前 `DisplayMode`
2. 决定 overlay 写到 `primaryOverlays` 还是 `secondaryOverlays`

### 10.4 UiVariableActor

负责：

1. `setUiVariables`
2. `clearUiVariables`

转成 workspace slice action。

## 11. Selectors

定义位置：

1. [src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/selectors/index.ts)

### 11.1 `selectUiVariable`

```ts
selectUiVariable<T>(state, key, defaultValue)
```

特点：

1. 自动按当前 `workspace` 找对应 slice
2. 读不到值时返回调用方传入的 `defaultValue`

### 11.2 `selectCurrentScreen`

```ts
selectCurrentScreen(state, containerKey, defaultValue?)
```

特点：

1. 自动按当前 `workspace` 读 screen slice
2. 常用于 container 当前 screen 渲染

### 11.3 `selectCurrentOverlays`

```ts
selectCurrentOverlays(state)
```

特点：

1. 自动读取当前 `displayMode`
2. primary 读 `primaryOverlays`
3. secondary 读 `secondaryOverlays`

## 12. Hooks

### 12.1 `useEditableUiVariable`

定义位置：

1. [src/hooks/useUiVariable.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/src/hooks/useUiVariable.ts)

示例：

```ts
const orderNoVariable = {
  key: "order.no",
  defaultValue: "",
}

const {value, setValue} = useEditableUiVariable(orderNoVariable)
```

作用：

1. 读取变量值
2. 内部通过 `setUiVariables` 更新值

### 12.2 `useUiOverlays`

返回当前 display 下的 overlay 列表。

### 12.3 `useUiModels`

当前只是 `useUiOverlays()` 的别名。

保留它的原因是为了平滑迁移旧代码里对 `useUiModels` 的使用。

### 12.4 `useChildScreenPart`

输入：

```ts
UiVariable<ScreenPart<any>>
```

作用：

1. 先读 container 当前 screen
2. 如果当前 container 没有显式写入 screen，则回退到 `getFirstReadyScreenPartByContainerKey(...)`
3. 如果仍没有，则回退到调用方默认值

这是容器类组件最常用的 hook。

## 13. Foundations / Helpers

### 13.1 `getScreenPartComponentType`

根据 `partKey` 取组件类型。

通常用于容器动态渲染：

```ts
const ComponentType = getScreenPartComponentType(child.partKey)
return <ComponentType {...child.props} />
```

### 13.2 `getFirstReadyScreenPartByContainerKey`

根据：

1. `containerKey`
2. 当前 `screenMode`
3. 当前 `instanceMode`
4. 当前 `workspace`
5. `indexInContainer`

找出第一个 `readyToEnter` 的 screen。

### 13.3 `createModalScreen`

这是旧 `navigation` 迁移时很常用的 helper。

它当前是 `createOverlayScreen` 的别名。

用法：

```ts
const overlay = createModalScreen(somePart, 'payment-modal', {
  amount: 88
})
```

### 13.4 `createAlert`

快速构造默认 alert 对应的 `ScreenPart`。

## 14. 最小使用示例

### 14.1 定义 screen variable

```ts
import {UiVariable} from "@impos2/kernel-core-ui-runtime"
import {ScreenPart} from "@impos2/kernel-core-base"

export const uiRuntimeVariables = {
  primaryRootContainer: {
    key: "primary.root.container",
    defaultValue: {
      partKey: "empty",
      name: "empty",
      title: "empty",
      description: "empty",
    } as ScreenPart<any>
  } satisfies UiVariable<ScreenPart<any>>
}
```

### 14.2 container 渲染

```tsx
import React from "react"
import {getScreenPartComponentType, useChildScreenPart} from "@impos2/kernel-core-ui-runtime"

export function ScreenContainer({containerPart}: {containerPart: any}) {
  const child = useChildScreenPart(containerPart)

  if (!child) return null
  const ComponentType = getScreenPartComponentType(child.partKey)
  if (!ComponentType) return null

  return <ComponentType {...child.props} />
}
```

### 14.3 切换 screen

```ts
import {kernelCoreUiRuntimeCommands} from "@impos2/kernel-core-ui-runtime"

kernelCoreUiRuntimeCommands.showScreen({
  target: {
    partKey: "checkout",
    name: "checkout",
    title: "checkout",
    description: "checkout",
    containerKey: "primary.root.container",
  },
  source: "user-click",
}).executeInternally()
```

### 14.4 打开 overlay

```ts
kernelCoreUiRuntimeCommands.openOverlay({
  overlay: {
    id: "alert-1",
    partKey: "alert",
    name: "Alert",
    title: "Alert",
    description: "Alert",
    props: {
      title: "提示",
      message: "支付成功",
      confirmText: "确定",
    }
  }
}).executeInternally()
```

### 14.5 写入 UI variables

```ts
kernelCoreUiRuntimeCommands.setUiVariables({
  "order.no": "A1001",
  "cart.amount": 128,
}).executeInternally()
```

## 15. 与旧 `navigation` 的关系

从设计上说，`ui-runtime` 是 `navigation` 的重组版，而不是完全不同的新能力。

迁移时可以这样理解：

1. `navigation` 的 screen registry -> `ui-runtime` 仍保留
2. `navigation` 的 current screen -> `ui-runtime.screen`
3. `navigation` 的 modal state -> `ui-runtime.overlay`
4. `navigation` 的 uiVariables -> `ui-runtime.uiVariables`

当前包里专门保留了一些迁移友好点：

1. `createModalScreen`
2. `ModalScreen<T>`
3. `useUiModels()`

但整体推荐是：

1. 语义上逐步从 `navigation` 迁到 `runtime`
2. 组件和业务命名也逐步切换到 runtime 语义

## 16. 开发与验证

### 16.1 type-check

```bash
./node_modules/typescript/bin/tsc --noEmit -p 1-kernel/1.1-cores/ui-runtime/tsconfig.json
```

### 16.2 运行 dev 验证

```bash
node $(node -p "require.resolve('tsx/cli')") 1-kernel/1.1-cores/ui-runtime/dev/index.ts
```

或者：

```bash
corepack yarn workspace @impos2/kernel-core-ui-runtime dev
```

注意：

如果你之前在新增 `tsx` 之前做过一次 `yarn install`，可能需要再执行一次安装，确保 workspace script 能找到 `tsx`。

### 16.3 当前 dev 覆盖范围

单进程测试覆盖：

1. `showScreen`
2. `setUiVariables`
3. `openOverlay`
4. `clearUiVariables`
5. `closeOverlay`
6. `resetScreen`

双进程测试覆盖：

1. 主屏连接 dual-ws server
2. 副屏连接 dual-ws server
3. 主屏写入 `main` workspace screen / uiVariables
4. 副屏收到同步后的 state

相关文件：

1. [dev/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/dev/index.ts)
2. [dev/test-state-single.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/dev/test-state-single.ts)
3. [dev/test-state-dual.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/dev/test-state-dual.ts)
4. [dev/worker.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/dev/worker.ts)
5. [dev/shared.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/ui-runtime/dev/shared.ts)

## 17. 常见坑

### 17.1 `ScreenPart` 必须有 `containerKey`

`showScreen` / `replaceScreen` 都要求 `target.containerKey` 存在。

否则 reducer 直接拒绝写入。

### 17.2 overlay 必须有 `id`

`openOverlay` 会检查 `overlay.id`。

如果没有 `id`，不会写入。

### 17.3 overlay id 不能重复

同一个 display 的 overlay list 中，`id` 重复会被拒绝。

### 17.4 当前 selector 都是上下文敏感的

`selectUiVariable`
`selectCurrentScreen`
`selectCurrentOverlays`

都会依赖当前运行实例的：

1. `workspace`
2. `displayMode`

所以看到“为什么同一 key 读出来不是我想的值”时，先检查当前实例上下文。

### 17.5 清理状态不要 `delete`

如果你自己写自定义 reducer 或扩展 slice，不要直接删顶层字段。

应遵守：

```ts
state[key] = { value: null, updatedAt: Date.now() }
```

### 17.6 `ServerConnectionStatus` 是大写

双屏联调时常见误判点：

1. `CONNECTED`
2. `DISCONNECTED`

这些值是大写枚举，不是小写字符串。

## 18. 当前非目标

这个包当前没有做这些事情：

1. 不管理浏览器路由
2. 不提供历史栈 / back-stack
3. 不做复杂路由守卫
4. 不管理业务实体状态
5. 不定义 uiVariables 的 schema 系统

## 19. 适用场景

适合下面这类模块：

1. 终端 UI shell
2. 多屏容器切换
3. POS 主副屏显示状态编排
4. overlay / alert / popup runtime
5. 轻量 UI 临时变量存储

不适合拿来代替：

1. 业务状态模块
2. 领域对象仓储
3. 浏览器路由系统

## 20. 相关文档

1. [docs/superpowers/specs/2026-04-08-ui-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-08-ui-runtime-design.md)
2. [spec/kernel-core-ui-runtime-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md)
3. [spec/kernel-core-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-dev-methodology.md)
