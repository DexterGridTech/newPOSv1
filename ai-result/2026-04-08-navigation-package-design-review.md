# `1-kernel/1.1-cores/navigation` 设计评估报告

## 1. 结论摘要

`1-kernel/1.1-cores/navigation` 这个包，从“思想”上看，不是一个传统意义上的 Router，而是一个：

1. 以 `ScreenPart` 为基本单元的界面编排层
2. 以 `container -> current screen` 为核心状态的导航状态管理层
3. 以 `workspace / instanceMode / screenMode` 为维度的多端、多屏、多工作区页面分发层
4. 顺带承载了一部分 UI 临时状态存储能力

这个思想本身有明显优点，尤其适合当前这套业务架构：

1. 不是 Web URL 导航，而是 POS/双屏/主副屏/工作区驱动的“界面编排”
2. 页面切换不是浏览器行为，而是设备运行态的一部分
3. 不同 workspace、不同 instance、不同 screenMode 对应不同 screen 集合

所以，如果只问一句话结论：

这个包的核心设计方向是对的，但当前实现把“导航”、“页面注册”、“容器编排”、“模态管理”、“UI 临时变量存储”揉在一起了，抽象边界不够干净，导致它看起来像导航包，实际上已经演化成了一个轻量 UI runtime。思想是有价值的，实现方式不是最佳。

## 2. 我对这个包实际设计意图的理解

从源码和 `2-ui` 的使用方式看，这个包的真实设计意图是：

### 2.1 用 `ScreenPart` 统一描述“一个可进入的界面单元”

`ScreenPart` 在 [1-kernel/1.1-cores/base/src/foundations/screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/base/src/foundations/screen.ts) 中定义，包含：

1. `partKey`
2. `containerKey`
3. `indexInContainer`
4. `screenMode`
5. `workspace`
6. `instanceMode`
7. `componentType`
8. `readyToEnter`

这说明它不是“页面路由项”，而是“可投放到某个容器里的 screen registration”。

### 2.2 用 `containerKey` 表示“某个区域当前应该显示什么”

核心切换逻辑在 [1-kernel/1.1-cores/navigation/src/features/actors/navigate.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/navigation/src/features/actors/navigate.ts)：

`navigateTo({ target })` 的本质不是 push route，而是：

把 `target` 直接写入一个以 `containerKey` 为 key 的 UI variable。

也就是说，导航状态 = “某个容器当前绑定的 ScreenPart”。

### 2.3 `StackContainer` 根据状态渲染子 screen

[2-ui/2.1-cores/base/src/ui/components/StackContainer.tsx](/Users/dexter/Documents/workspace/idea/newPOSv1/2-ui/2.1-cores/base/src/ui/components/StackContainer.tsx)

这个组件实际上就是运行时容器：

1. 读某个 `UiVariable<ScreenPart>`
2. 找出当前应该渲染的 `componentType`
3. 渲染它

这说明 navigation 包承担的是“screen orchestration runtime”的角色。

### 2.4 模态也是同一套思想的特例

`openModal / closeModal` 本质上就是对 `primaryModals / secondaryModals` 两个栈做增删。

这部分在：

[1-kernel/1.1-cores/navigation/src/features/slices/uiVariables.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/navigation/src/features/slices/uiVariables.ts)
[2-ui/2.1-cores/base/src/ui/components/ModalContainer.tsx](/Users/dexter/Documents/workspace/idea/newPOSv1/2-ui/2.1-cores/base/src/ui/components/ModalContainer.tsx)

### 2.5 `UiVariable` 被当成了“跨 screen 的 UI runtime state”

例如：

1. 登录表单字段
2. 激活码输入框
3. 容器当前 child screen
4. 业务面板当前 active screen

这意味着 navigation 包现在不只是 navigation，它还承载了 UI session state。

## 3. 这个设计的优点

## 3.1 它抓住了你们系统真正的导航本质

你们不是传统 Web 站点，不是“URL -> page”。

你们更像：

1. 主屏 / 副屏
2. 主实例 / 从实例
3. workspace 间联动
4. 某个容器显示哪个 screen

这时 URL router 不是一等公民，screen orchestration 才是。

这个包在思想上把这件事抓对了。

## 3.2 `ScreenPart` 作为统一元数据模型是有价值的

`ScreenPartRegistration` 把以下东西统一建模了：

1. 页面身份
2. 所在容器
3. 显示顺序
4. 支持的 screenMode
5. 支持的 workspace
6. 支持的 instanceMode
7. 组件实现
8. 准入条件

这比把这些逻辑散落在 UI 里强很多。

尤其像 `getScreenPartsByContainerKey()` 这类能力，可以直接支持 tab 生成、动态菜单、默认入口选择。

## 3.3 非常适合多屏/主副机/联动场景

比如：

1. 主屏登录成功后，同时切主屏和副屏
2. 不同 workspace 下根容器显示不同 screen
3. 某些页面只允许某个实例模式进入

这些在当前设计下都很自然，因为 `workspace` 和 `instanceMode` 是一等维度，不是后补的条件判断。

## 3.4 `readyToEnter` 提供了“声明式入口过滤”的雏形

这点虽然现在用得不多，但思想是对的。

例如登录页：

只有未登录才允许成为 ready screen。

这比让每个容器自己 if/else 决定默认页更集中。

## 3.5 模块注册式 screen 发现机制适合插件化

在 [1-kernel/1.1-cores/base/src/application/applicationManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/base/src/application/applicationManager.ts) 里，所有模块的 `screenParts` 会统一注册。

这很适合你们这种：

1. `kernel`
2. `ui core`
3. `ui modules`
4. `integrations`

分层式产品结构。

它天然支持模块增量挂 screen。

## 4. 这个设计的主要缺点

## 4.1 最大问题：职责边界混乱

这是当前设计最根本的问题。

现在这个包同时承担了：

1. screen 注册中心
2. screen 选择逻辑
3. 容器导航状态
4. modal 栈
5. UI 临时变量仓库
6. workspace 级别状态同步入口

这几个东西并不等价。

更准确地说：

1. navigation 是“当前显示哪个 screen”
2. modal 是“叠加层管理”
3. ui variables 是“视图状态”

它们有关系，但不应该绑成一个 slice 里的一个大概念。

现在叫 `navigation`，但实际内容已经超过导航边界，导致认知负担很重。

## 4.2 `navigateTo` 的抽象语义其实不准确

现在的 `navigateTo({ target })` 最终等价于：

`setUiVariables({ [containerKey]: target })`

这不是导航命令，而是“覆盖某容器当前 screen”。

问题在于：

1. 没有 push/pop 概念
2. 没有 back stack
3. 没有 replace / reset / redirect 等更明确语义
4. 没有 transition policy
5. 没有 source / from / to 的结构化状态

所以它更像 `showScreenInContainer`，不太像 `navigateTo`。

命名和真实语义不一致，会误导后续设计。

## 4.3 把 screen 状态和普通 UI 表单状态放进同一个 `uiVariables`

这是很危险的耦合。

当前 `uiVariables` 里同时放：

1. `primaryRootContainer`
2. `mixcTradePanelContainer`
3. 用户名
4. 密码
5. 激活码
6. 业务临时值
7. modal 状态

这会带来几个问题：

1. 导航状态和表单状态生命周期不同
2. 导航状态和表单状态持久化策略不同
3. 导航状态和表单状态同步策略不同
4. 调试时很难区分“这是导航问题还是表单状态问题”

本质上这是把“screen runtime state”和“view model state”混在了一起。

## 4.4 `containerKey` 被直接拿来当状态 key，过于隐式

`navigateTo` 通过 `containerKey` 直接写 uiVariable，这种做法很省事，但边界不清：

1. 容器定义是变量
2. 导航目标也靠变量
3. 状态存储 key 也是变量

这会让容器系统和变量系统强耦合。

结果是：

容器不是容器，容器只是某个 magic key。

这在早期灵活，但长期会让系统难以做结构化治理。

## 4.5 全局 registry 是方便，但不够可控

[1-kernel/1.1-cores/navigation/src/foundations/screens.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/navigation/src/foundations/screens.ts)

当前用全局 map 存 screen registry。

问题有几个：

1. 全局单例，天然不利于测试隔离
2. 生命周期和 app manager 强耦合
3. 不容易做多应用实例并存
4. 不容易做运行时卸载/热替换

它对“应用启动期一次注册”很友好，但对更复杂的 runtime control 不友好。

## 4.6 `readyToEnter` 是同步函数，能力太弱

现实里页面准入判断经常依赖：

1. 登录状态
2. 权限
3. 数据加载
4. 远端能力
5. 终端绑定状态

当前 `readyToEnter?: () => boolean` 只能表达同步布尔判断。

这意味着一旦准入逻辑复杂一点，就会把逻辑退回外部 actor/hook，导致声明式价值下降。

## 4.7 类型设计不够收敛，`any` 太多

现在的 `ScreenPart<any>`、`Record<string, any>`、`UiVariablesState extends Record<string, ValueWithUpdatedAt<any>>` 很宽松。

结果是：

1. props 类型不能沿路严格传播
2. container 上能放什么没有约束
3. modal props 和普通 screen props 都比较松
4. UI variable key/value 没有 schema

这对于快速开发是友好的，但对规模化维护不友好。

## 4.8 `selectors / apis / epics / middlewares` 基本为空，说明模块边界还没稳定

这不是功能 bug，但说明设计还在摇摆。

一个成熟模块不会长期导出这么多“空的预留接口”。

这通常意味着：

1. 设计曾经想做得更大
2. 但最终职责没有收敛
3. 外部看到的是一个看起来很完整、其实内核还未定型的包

## 5. 从 `2-ui` 的使用来看，它最成功和最危险的地方分别是什么

## 5.1 最成功的地方

`2-ui` 用它做“容器内 screen 切换”是顺手的。

典型例子：

1. workbench 根容器切不同模块 screen
2. trade 模块 panel 容器切创建订单页/支付页
3. modal 用统一方式打开和关闭

这些都说明：

“页面是可注册单元，容器当前渲染哪个单元由状态决定”

这个核心思想是成立的。

## 5.2 最危险的地方

`useEditableUiVariable` 被大量用于表单字段和普通 UI 状态。

这意味着 navigation 包正慢慢变成：

一个无 schema 的 UI 全局状态包。

这是最容易失控的方向。

因为一旦所有 UI 小状态都往这里堆，最终会出现：

1. key 命名失控
2. 清理时机混乱
3. 持久化边界混乱
4. 同步策略误伤
5. 导航问题和表单状态问题相互污染

## 6. 基于这个思想，我认为“最好的设计实现方式”应该是什么

这里我强调的是“思想”，不是让你照搬某个开源 router。

我认为最优方案应该是：

## 6.1 保留 `ScreenPart` 思想，但重新拆包

建议拆成三个明确层次：

### A. `screen-registry`

职责：

1. 注册 screen
2. 按 `container / screenMode / workspace / instanceMode` 查询可用 screen
3. 提供 default/fallback/ready 计算

它只做元数据注册和查询，不持有 UI 运行态。

### B. `navigation-runtime`

职责：

1. 维护“每个容器当前显示哪个 screen”
2. 支持明确的导航语义：
   - `show`
   - `replace`
   - `reset`
   - `back`（如果容器需要）
3. 维护 modal stack
4. 支持导航事件与可观测性

它只做 navigation state，不承载普通表单状态。

### C. `ui-view-state`

职责：

1. 表单字段
2. 过滤条件
3. 临时选中项
4. 纯 UI view model 状态

这部分可以保留 `UiVariable` 思想，但不要继续放在 navigation 包里。

## 6.2 把“容器”建成显式概念，不再只是 string key

当前 `containerKey` 只是字符串。

更好的方式是：

定义显式容器模型：

1. `RootPrimaryContainer`
2. `RootSecondaryContainer`
3. `WorkbenchMainContainer`
4. `TradePanelContainer`

容器应有自己的元数据：

1. id
2. 类型
3. 是否支持 stack
4. 是否支持 history
5. 默认 screen 选择策略
6. fallback screen 策略

这样导航运行时才是结构化的，而不是“往某个变量 key 塞一个 screenPart”。

## 6.3 导航状态要结构化，不要只存一个 `ScreenPart`

我建议每个容器存的是：

1. current route entry
2. optional history stack
3. last transition
4. params / props
5. source

比如思想上类似：

```ts
type ContainerNavigationState = {
  current: {
    partKey: string
    props?: unknown
    enteredAt: number
    source?: string
  } | null
  history: Array<...>
}
```

这样你就能支持：

1. 返回
2. replace
3. 调试导航轨迹
4. 分析来源

## 6.4 `readyToEnter` 升级为 route guard / resolver 机制

不要只保留同步布尔函数。

更好的设计应支持：

1. synchronous guard
2. async guard
3. redirect target
4. preload / resolver

例如思想上：

```ts
canEnter(ctx) => true | false | { redirectTo: ... }
resolve(ctx) => Promise<props>
```

这样登录态、权限态、设备态、数据预取才能纳入统一导航体系。

## 6.5 modal 要从“特殊变量”升级为“overlay manager”

模态并不是普通 UI variable。

它应该是一个独立 overlay runtime：

1. stack
2. z-order
3. singleton / dedupe policy
4. close reason
5. backdrop behavior
6. animation policy

现在这部分思想是对的，但实现层级偏低。

## 6.6 `UiVariable` 思想可以保留，但要变成 typed view-state store

我不反对 `UiVariable` 这个思想。

它的优点是：

1. 简单
2. 模块化
3. 好上手
4. 适合表单和跨 screen 的小状态

但最佳实现应该是：

1. 从 navigation 中分离
2. 按 domain 定义 schema
3. 明确生命周期
4. 明确持久化策略
5. 明确同步策略

否则它迟早演变成无结构的 key-value 垃圾场。

## 6.7 屏幕注册表建议改成“应用实例级 registry”

不要再用进程级全局 registry map。

更好的做法是：

1. app 启动时创建 `ScreenRegistry`
2. 模块向当前 app registry 注册 screen
3. runtime 从 registry 查询

这样更利于：

1. 测试
2. 多实例
3. 注入 mock registry
4. 动态替换

## 6.8 最优思想模型

如果用一句更准确的话描述我建议的最终形态：

不是 `navigation package`

而是：

`screen orchestration runtime`

它由四部分组成：

1. `screen registry`
2. `container runtime`
3. `overlay runtime`
4. `view state runtime`

而不是把这四者都塞进 `navigation`。

## 7. 推荐重构方向

如果未来要演进，我建议不是“重写”，而是按下面顺序重构。

### 第一阶段：只做概念收敛

1. 保留现有行为
2. 把 `uiVariables` 里与导航无关的状态逐步迁出
3. 在命名上把 `navigateTo` 语义改清楚
4. 文档上明确 navigation 包真实职责

### 第二阶段：拆分运行时

1. 拆出 `screen registry`
2. 拆出 `overlay runtime`
3. navigation 包只保留 container navigation

### 第三阶段：增强导航能力

1. 增加 route guard / redirect
2. 增加 history / reset / replace
3. 增加导航事件与调试追踪

### 第四阶段：收紧类型系统

1. 降低 `any`
2. 给 screen props 建立更明确的类型约束
3. 给 UI variable 建 schema

## 8. 最终判断

### 我认可的部分

1. 用 `ScreenPart` 统一描述页面单元
2. 用容器驱动 screen 渲染
3. 用 workspace / instance / screenMode 作为一等约束
4. 用模块注册方式组织 screen

这些都非常适合你们这套 POS 多屏多工作区架构。

### 我不认可的部分

1. 把 navigation、modal、ui variable 混成一个包
2. 用 `navigateTo = setUiVariables(containerKey -> screenPart)` 这种过于隐式的语义
3. 用无 schema 的 UI variable 承载越来越多视图状态
4. 全局 registry 与运行时强耦合

### 我的总体评价

这个包是一个“方向正确、抽象不干净”的设计。

它的核心思想值得保留，尤其是：

`ScreenPart + Container + Workspace-aware orchestration`

但最优实现不应该继续沿着“导航包 + 万能 UI 变量仓库”的路线长下去。

更好的未来形态应该是：

一个显式的、分层的 `screen orchestration runtime`。
