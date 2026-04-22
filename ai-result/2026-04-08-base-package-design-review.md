# `1-kernel/1.1-cores/base` 包设计评审与重建设计

## 1. 结论先行

`base` 不是一个“普通公共工具包”，而是当前整套内核体系的总装配底座。

它同时承担了下面几类职责：

1. 应用启动与模块装配。
2. 命令总线与 actor 执行模型。
3. Redux store / persist / 环境上下文装配。
4. 全局基础能力适配器注册。
5. HTTP 基础设施。
6. 错误消息、系统参数、任务定义、屏幕注册等全局注册中心。
7. 一部分共享类型、状态 key、时间戳同步约定。

这套设计最大的价值，是把整仓库几十个 kernel / ui / assembly 包拉进了同一个统一运行时协议里。  
这套设计最大的问题，是把“协议层”“运行时层”“基础设施层”“平台适配层”“UI 契约层”都塞进了同一个包，长期演进后变成了一个高粘度的超大底座。

如果让我继承它的设计思想从零重做，我不会推翻它的核心哲学，而是会保留其正确的部分，再把它拆成“显式 runtime + 显式 ports + 显式 module contract + 可组合 infra 插件”的结构，让当前的优点继续保留，同时把全局单例、声明合并、隐式注册、隐藏耦合这些成本降下来。

---

## 2. 阅读范围

本次重点阅读了以下几类代码与文档。

### 2.1 `base` 包自身

1. `src/application/*`
2. `src/foundations/*`
3. `src/features/*`
4. `src/types/*`
5. `dev/index.ts`

### 2.2 典型下游使用方

1. `1-kernel/1.1-cores/navigation`
2. `1-kernel/1.1-cores/interconnection`
3. `1-kernel/1.1-cores/tcp-client`
4. `1-kernel/1.1-cores/tdp-client`
5. `1-kernel/1.2-modules/pay-base`
6. `1-kernel/1.2-modules/order-create-traditional`
7. `2-ui/2.2-modules/mixc-trade`

### 2.3 典型上游装配方

1. `4-assembly/electron/mixc-retail-v1/src/store.ts`
2. `4-assembly/electron/mixc-retail-v1/src/application/modulePreSetup.ts`
3. `3-adapter/electron/adapterDevApp/src/modulePreSetup.ts`
4. `3-adapter/electron/adapterV1/src/main/index.ts`

### 2.4 方法论文档

1. `spec/kernel-core-dev-methodology.md`
2. `spec/kernel-core-ui-runtime-dev-methodology.md`
3. `docs/superpowers/specs/2026-04-08-ui-runtime-design.md`

---

## 3. 当前 `base` 的真实定位

## 3.1 它不是“基础工具包”，而是“内核运行时总协议”

从 `AppModule`、`ApplicationManager`、`ActorSystem`、`storeEntry`、`registerXxx`、`ApiManager` 这一整套结构看，`base` 实际上定义的是：

1. 模块应该如何声明自己。
2. 应用应该如何把多个模块装起来。
3. 命令如何在模块之间流动。
4. actor 如何承接命令。
5. slice 如何接入 store 与持久化。
6. 适配器如何把设备、日志、存储、外部连接注入内核。
7. 其他包如何扩展 `RootState` 与 `ModuleSliceConfig`。

所以 `base` 本质上是“kernel runtime contract + runtime implementation”。

## 3.2 当前仓库的真实依赖方向

当前依赖关系大致可以抽象成：

1. `assembly / adapter` 站在最上游，向 `base` 注入平台能力。
2. `base` 提供统一运行时协议。
3. `interconnection / navigation / tcp-client / tdp-client / 各业务 module` 站在下游，基于 `base` 的协议组织状态与命令。
4. 一些下游包反过来又通过声明合并扩展 `base` 的类型边界。

也就是说，`base` 既是所有人依赖的基础，又会被别的包“反向扩展”。  
这正是它既强大又危险的原因。

---

## 4. 当前设计拆解

## 4.1 模块模型：`AppModule` 是核心抽象

`AppModule` 把一个模块描述成一个 manifest：

1. `slices`
2. `epics`
3. `middlewares`
4. `actors`
5. `commands`
6. `errorMessages`
7. `parameters`
8. `screenParts`
9. `taskDefinitions`
10. `dependencies`
11. `modulePreSetup`

这意味着：

1. 模块可以被静态描述。
2. 模块依赖可以被递归拉平。
3. `ApplicationManager` 可以统一装配所有模块。

这是整个体系最成功的设计之一。  
它让很多业务包只需要“提供描述”，不需要自己关心装配细节。

## 4.2 启动模型：`ApplicationManager` 是单例式应用装配器

`ApplicationManager.generateStore(config)` 做了非常多事情：

1. 设置环境。
2. 解析模块依赖。
3. 执行模块 pre-setup。
4. 初始化 server space 与 storage prefix。
5. 注册 actors。
6. 注册 commands。
7. 注册 screen parts。
8. 注册 task definitions。
9. 注册 error messages。
10. 注册 system parameters。
11. 构建 reducers。
12. 构建 middlewares。
13. 创建 store。
14. 启动 epics。
15. 创建 persistor。

这是一种非常典型的“总控式 runtime bootstrap”设计。

它的好处是：

1. 启动路径集中。
2. 初始化顺序清楚。
3. 日志完整。
4. 业务模块只需要声明，不需要重复写样板。

它的问题是：

1. `ApplicationManager` 过重。
2. 绝大多数全局注册都被塞进一个大流程。
3. 启动过程中没有真正的实例隔离。
4. 很多步骤本应属于不同子系统，却硬耦合在一起。

## 4.3 命令模型：`Command -> commandBus -> ActorSystem -> Actor`

当前命令系统的思路很明确：

1. command 是跨模块协作的统一消息对象。
2. actor 是命令处理者。
3. `Actor.defineCommandHandler(...)` 用来声明“某个 actor 处理某个命令”。
4. command 可以带 `requestId / sessionId / extra / ancestors`。
5. command 支持 `execute`、`executeInternally`、`executeFromParent`。

这个设计的核心思想是正确的：

1. 模块之间通过命令解耦，而不是直接调用彼此 service。
2. 一条业务链可以携带 request 级上下文。
3. 父子命令关系可追踪。

但它的实现又非常“环境化”：

1. `commandBus` 是全局单例。
2. `ActorSystem` 是全局单例。
3. actors 是全局广播式执行匹配。
4. handler 结果只通过 lifecycle listener 旁路返回。
5. 没有 runtime 级 dispose / unregister / scope。

所以这套模型更像“全局事件驱动命令总线”，而不是“实例化的 command runtime”。

## 4.4 状态模型：`storeEntry + RootState 声明合并 + ModuleSliceConfig`

当前状态系统的几个关键点：

1. `storeEntry` 是全局 store 入口。
2. `RootState` 初始只有 `base` 自己的 state。
3. 其他包通过 `declare module '@impos2/kernel-core-base'` 继续扩展 `RootState`。
4. slice 通过 `ModuleSliceConfig` 进入装配流程。
5. workspace 类 slice 再由 `interconnection` 对 `ModuleSliceConfig` 进行声明合并扩展。

这说明当前的状态模型，本质是“开放世界型全局状态协议”：

1. 任何包都可以给 `RootState` 增加字段。
2. 任何包都可以给 `ModuleSliceConfig` 增加协议字段。

它的优点是扩展灵活。  
它的问题是边界不显式。

## 4.5 适配器模型：`registerLogger/registerDevice/...`

`base` 提供了多个平台能力端口：

1. `logger`
2. `device`
3. `stateStorage`
4. `externalConnector`
5. `appControl`
6. `scriptsExecution`

其使用模式统一为：

1. 上游 assembly / adapter 在启动前调用 `registerXxx(...)`。
2. 下游模块直接 import 对应 façade 并使用。

这是典型的 service-locator 风格端口适配模式。

## 4.6 HTTP 模型：`Api` + `ApiManager` + `RequestQueue`

`base` 自带了一整套 HTTP 能力：

1. 服务器地址配置与轮询。
2. axios instance 管理。
3. request/response 拦截器。
4. 限流与并发控制。
5. 重试与 metrics。
6. `Api<T, R>` 请求封装。

单看 HTTP 这部分，其实已经足够成为独立基础设施包。

## 4.7 额外全局注册中心

`base` 还承担了多类注册中心职责：

1. `errorMessages`
2. `systemParameters`
3. `screenPartRegisters`
4. `taskDefinitionRegisters`

这些都进一步抬高了 `base` 的中心化程度。

---

## 5. 设计特点

我认为当前 `base` 的设计特点，可以总结为下面七条。

## 5.1 “模块 manifest 化”

这是最鲜明的特点。  
业务包大多只负责“描述自己有什么”，运行时负责“怎么把它们装起来”。

这是非常好的内核思路。

## 5.2 “命令驱动，而不是 service 直连”

例如 `tcp-client`、`tdp-client`、`navigation` 都大量基于 command + actor 驱动业务流程。  
这使跨包流程可追踪、可插桩、可拆分。

这也是好的思路。

## 5.3 “全局运行时，而不是实例化运行时”

当前几乎所有关键入口都是全局单例：

1. `ApplicationManager`
2. `ActorSystem`
3. `ApiManager`
4. `storeEntry`
5. `commandBus`
6. `screenPartRegisters`
7. 各种 `registerXxx`

这使得系统使用很方便，但测试隔离、重建实例、并行运行、多 app 场景都会变差。

## 5.4 “声明合并扩展，而不是显式 schema 扩展”

`RootState`、`ModuleSliceConfig` 都被下游包通过 TypeScript module augmentation 扩展。  
这是一种很灵活的技巧，但它会让类型边界不再局部可见。

## 5.5 “service locator，而不是显式依赖注入”

模块里经常直接使用：

1. `storeEntry`
2. `device`
3. `logger`
4. `appControl`
5. `externalConnector`

这降低了开发门槛，但也让依赖关系从“构造期显式”退化成“运行时全局可取”。

## 5.6 “把同步/持久化约定放进通用状态 helper”

`ValueWithUpdatedAt`、`batchUpdateState`、workspace slice、state sync middleware 一起构成了当前状态同步方法论的基础。  
这套思路非常重要，也确实已经在 `navigation / interconnection / pay-base / ui-runtime 设计` 中被反复复用。

## 5.7 “base 逐渐吸收了 UI / platform / infra 的边界”

`base` 中已经出现了几类不该长期放在同一个包里的内容：

1. `screen.ts` 引入 React `ComponentType`。
2. `screen.ts` 还引用了 interconnection 的 `Workspace/InstanceMode` 类型。
3. `ApiManager` 是完整 HTTP 子系统。
4. `taskSystem` 已经是一个独立的流程定义协议。

这说明 `base` 已经从“基础层”长成了“总线层 + 共享领域层 + 平台层 + UI 契约层”的混合体。

---

## 6. 优点

## 6.1 统一了整仓库的模块装配协议

这是最大的优点。

一旦一个包符合 `AppModule` 协议，它就能被装进统一 runtime。  
这让仓库里的 core/module/ui/assembly 之间形成了非常稳定的工程共识。

## 6.2 下游包开发门槛低

下游模块通常只需要：

1. 定义 commands。
2. 定义 actors。
3. 定义 slices。
4. 导出 `AppModule`。

不需要重复编写启动、persist、middleware 拼装的模板代码。

## 6.3 跨包业务链天然可编排

`initialize -> bootstrap -> 业务命令 -> 子命令` 这种链路，在当前架构里很自然。  
`tcp-client` 和 `tdp-client` 就是典型例子。

## 6.4 平台适配边界是对的

虽然实现方式偏全局，但“设备能力通过 adapter 注入”这个大方向完全正确。  
这让同一套内核能跑在 electron / android / dev mock 环境里。

## 6.5 状态同步约定具有高度复用性

`ValueWithUpdatedAt + batchUpdateState + workspace slice + sync middleware`  
已经证明这套模式足以支撑：

1. 主副屏同步。
2. workspace 维度状态分层。
3. timestamp 比较式冲突合并。

这套思想应该保留。

## 6.6 HTTP 基础设施质量其实不差

`ApiManager` 不是玩具封装，而是已经包含：

1. 多地址轮询。
2. retry。
3. queue。
4. metrics。
5. interceptors。

它的问题不在“能力不够”，而在“放错地方”。

## 6.7 初始化日志做得很工程化

`InitLogger` 虽然偏展示层，但对调试真实启动链路很有帮助。  
它让 runtime 的启动步骤变得可观察。

---

## 7. 缺点与设计债

## 7.1 职责严重过载

当前 `base` 同时承担：

1. runtime kernel
2. state contract
3. adapter ports
4. HTTP infra
5. task protocol
6. UI screen contract
7. system parameter / error message registry

这已经不是单一职责包，而是“内核大总管”。

这会带来两个后果：

1. 任何改动都容易扩散。
2. 很难判断某个概念应该属于哪里。

## 7.2 全局单例导致实例隔离差

当前很多对象没有 runtime scope：

1. `ApplicationManager`
2. `ActorSystem`
3. `commandBus`
4. `ApiManager`
5. `storeEntry`
6. 各类 registry

其问题包括：

1. 测试难以彻底 reset。
2. 同进程多应用实例几乎不可行。
3. dev 验证往往只能依赖新进程隔离，而不是 runtime 对象隔离。
4. 注册内容容易跨测试/跨初始化残留。

## 7.3 类型边界依赖声明合并，隐式耦合太重

`RootState` 与 `ModuleSliceConfig` 的扩展依赖 module augmentation。  
这会造成：

1. 包内读代码时看不到完整类型边界。
2. 类型正确性依赖编译上下文，而不是局部定义。
3. 新人很难快速理解 state 是怎么拼起来的。
4. 跨包协议会出现“看起来是 base 的类型，实际由其他包偷偷扩展”的情况。

## 7.4 `storeEntry` 让“拿全局 store 直接做事”变成默认路径

`storeEntry` 很方便，但它也会诱导：

1. actor 直接 dispatch。
2. foundation 直接读 state。
3. helper 直接依赖全局环境。

这种模式短期快，长期会让业务和 runtime 深度缠绕。

## 7.5 adapter 注册是“最后写入者生效”的全局可变状态

`registerLogger`、`registerDevice` 等都没有：

1. 生命周期管理。
2. 重复注册约束。
3. runtime 作用域。
4. 必填能力检查。

这意味着它更像“全局 mutable slot”，而不是严谨的 port container。

## 7.6 命令系统的执行模型过于宽松

当前 actor 对命令的处理方式是：

1. 所有 actor 广播式匹配。
2. 匹配到就异步执行。
3. 没有统一结果聚合协议。
4. 没有命令级并发策略。
5. 没有 handler 级取消或超时机制。

这对于简单场景够用，但当命令越来越多时，会出现下面的问题：

1. 很难保证“一个命令应该由谁处理”是显式的。
2. 很难对执行顺序做强约束。
3. 生命周期 listener 更像旁路观测，而不是一等公民的执行结果通道。

## 7.7 `batchUpdateState` 语义过于粗糙

当前 `batchUpdateState` 遇到 `null/undefined` 会直接删除顶层 key。  
这个设计在早期简单同步里够用，但它会限制更成熟的同步语义：

1. tombstone 语义不清。
2. “显式清空”与“物理删除”容易混淆。
3. 与后续 `ui-runtime` 方法论里强调的 `value: null + updatedAt` 语义存在张力。

也就是说，当前 helper 过于偏“字典合并”，不够偏“状态同步协议”。

## 7.8 `base` 里存在隐藏的跨包/跨技术栈依赖

最明显的例子：

1. `screen.ts` 依赖 React `ComponentType`。
2. `screen.ts` 还依赖 interconnection 的 `Workspace/InstanceMode` 类型。
3. 但 `base` 又并没有把这些边界清晰声明成独立层。

这说明 `base` 已经不是纯 kernel。

## 7.9 `ApplicationManager` 内部步骤过多，缺乏子系统边界

当前启动链是线性的，但不是分层的。  
例如下面几个概念其实应该分开：

1. runtime build
2. registry build
3. port install
4. store hydration
5. network bootstrap
6. app lifecycle start

现在它们被塞进一个类的一个主方法里，维护成本会持续上升。

## 7.10 `base/dev/index.ts` 几乎没有验证价值

按照当前仓库已经沉淀的方法论，一个 core 包的 dev 应该验证：

1. 真实 `ApplicationManager`。
2. selector / state 语义。
3. 必要时持久化与真实重启恢复。

而 `base/dev/index.ts` 目前只是最小启动脚本，不足以证明：

1. `systemParameters` / `errorMessages` 持久化行为是否符合预期。
2. server space 切换与 data version 是否正确落盘。
3. 多次初始化时 registry 是否安全。

---

## 8. 上下游真实使用方式

## 8.1 上游如何使用 `base`

上游 assembly / adapter 的典型动作是：

1. 构造 `ApplicationConfig`。
2. 注册平台适配器。
3. 调用 `ApplicationManager.generateStore(...)`。
4. 再调用 `ApplicationManager.init()`。

这说明对上游而言，`base` 是“应用启动内核”。

## 8.2 下游 core/module 如何使用 `base`

下游模块主要依赖下面几类能力：

1. `AppModule`
2. `createModuleCommands / defineCommand`
3. `Actor / createActors`
4. `ModuleSliceConfig`
5. `batchUpdateState`
6. `ValueWithUpdatedAt`
7. `storeEntry`
8. `logger / device / appControl / externalConnector`

这说明对下游而言，`base` 是“模块开发 SDK”。

## 8.3 `interconnection` 如何反向扩展 `base`

`interconnection` 不只是依赖 `base`，还会：

1. 给 `RootState` 增量扩展 instance/interconnection state。
2. 给 `ModuleSliceConfig` 增量扩展 `syncType`。
3. 在 `base` 之上再包装出 `createWorkspaceSlice / dispatchWorkspaceAction / toModuleSliceConfigs`。

这说明当前仓库已经出现一个非常关键的信号：

`base` 太薄的地方，只能靠下游包继续“反向打补丁”。

这不是局部问题，而是架构边界问题。

## 8.4 `navigation` 如何暴露 `base` 的边界问题

`navigation` 使用 `base` 提供的：

1. screen 注册。
2. command/actor。
3. workspace sync 约定。

但它又不得不把：

1. screen runtime
2. overlay runtime
3. uiVariables runtime

混进同一个 slice，后来又推动了 `ui-runtime` 的专项重构。  
这说明 `base` 提供的是“低层骨架”，但对 UI runtime 没有给出足够清晰的中层建模能力。

## 8.5 `tcp-client / tdp-client` 如何暴露 `base` 的优势

这两个包是当前设计的成功案例。

它们利用 `base` 做到了：

1. 统一 command 面。
2. actor 驱动流程编排。
3. 持久化 slice 与 runtime-only slice 分层。
4. dev 中真实接 store / persist / ApplicationManager。

这说明 `base` 的核心思想是对的。  
问题不在于思想错误，而在于抽象太粗、边界太混。

---

## 9. 我会保留哪些设计思想

如果从零开始重做，我会明确保留下面这些思想。

## 9.1 保留“模块 manifest 化”

模块以声明形式输出能力，这是整个仓库最值钱的设计资产之一。

## 9.2 保留“命令驱动的跨模块协作”

跨模块不要互相 new service 直接调用，仍然以 command 作为流程驱动单元。

## 9.3 保留“平台能力经由 port/adapter 注入”

设备、日志、外设连接、存储、应用控制等仍然应该是 ports，不应该回到平台代码直接侵入业务模块。

## 9.4 保留“持久化最小真相源 + runtime-only 分层”

这已经被 TCP/TDP/UI runtime 的新方法论反复验证，应当正式上升为基础协议，而不是只停留在经验。

## 9.5 保留“ValueWithUpdatedAt 驱动的同步冲突解决”

timestamp-based top-level merge 是当前主副屏同步体系里的关键思想，值得保留，但要从 helper 提升为正式 state policy。

## 9.6 保留“启动过程可观测”

初始化步骤、模块依赖、注册结果、持久化与 server space 选择，都应该保持高可观察性。

---

## 10. 如果从零到一重做，我会怎样设计

下面这套方案不是“完全推翻当前仓库”，而是“继承核心思想后重做一版结构更稳的底座”。

## 10.1 重设计目标

目标只有六个：

1. 保留当前统一模块协议。
2. 去掉全局单例带来的隐式耦合。
3. 让 runtime 成为显式实例，而不是环境全局。
4. 让状态、同步、持久化策略成为显式协议。
5. 把 HTTP / UI contract / task protocol 从 `base` 主体剥离。
6. 给当前仓库留出兼容迁移路径。

## 10.2 新的分层方式

我会把今天的 `base` 拆成五层。

### 第一层：`kernel-core-runtime`

只负责：

1. `KernelApp`
2. `KernelRuntime`
3. module 依赖解析
4. registry 构建
5. store 构建
6. 生命周期启动/停止

它不直接包含：

1. React 类型
2. HTTP
3. screen 注册
4. task system

### 第二层：`kernel-core-command`

只负责：

1. command descriptor
2. command envelope
3. actor handler registration
4. command execution pipeline
5. lifecycle hooks
6. tracing / result / error

### 第三层：`kernel-core-state`

只负责：

1. state schema descriptor
2. persist policy
3. sync policy
4. conflict resolver
5. rehydrate policy
6. runtime-only reset policy

### 第四层：`kernel-core-ports`

只负责平台端口定义：

1. logger
2. device
3. storage
4. appControl
5. externalConnector
6. scriptExecution

### 第五层：独立 infra / contract 包

把以下内容从 `base` 拆出去：

1. `kernel-core-http`
2. `kernel-core-ui-contracts`
3. `kernel-core-task`

然后 `kernel-core-base` 只作为 façade 聚合层存在，用于兼容旧调用方。

## 10.3 新的核心对象

### 10.3.1 `KernelModule`

新的模块定义我仍然保留 manifest 形式，但拆得更清楚：

```ts
type KernelModule = {
  name: string
  version: string
  dependencies?: KernelModule[]
  install(ctx: ModuleInstallContext): void | Promise<void>
}
```

`install(ctx)` 内通过显式 API 注册自己拥有的：

1. state
2. commands
3. actors
4. parameters
5. errors
6. tasks
7. screen parts

这样做的好处是：

1. 模块协议仍然统一。
2. 安装过程更显式。
3. 以后可以做更强的校验和插件化。

### 10.3.2 `KernelRuntime`

不再使用 `ApplicationManager` 全局单例，而是：

```ts
const runtime = await createKernelRuntime({
  environment,
  serverSpace,
  modules: [appModule],
  ports,
}).start()
```

这个 runtime 自己持有：

1. store
2. persistor
3. registries
4. commandBus
5. actorRegistry
6. services
7. lifecycle state

这意味着：

1. 同进程可以创建多个 runtime。
2. 测试可以显式创建/销毁 runtime。
3. 不再依赖跨进程才能获得隔离。

### 10.3.3 `RuntimeContext`

当前 `storeEntry` 的职责，改为 runtime-scoped context：

```ts
type RuntimeContext = {
  runtimeId: string
  env: Environment
  store: Store
  ports: PortRegistry
  registries: RegistrySet
  services: ServiceRegistry
}
```

actor / selector helper / services 都通过 context 工作，而不是摸全局单例。

## 10.4 命令系统重做方式

我会保留 command 思想，但重做执行模型。

### 10.4.1 command descriptor 显式化

```ts
const activateTerminal = defineCommand({
  name: 'kernel.core.tcpClient.activateTerminal',
  payload: payload<{ activationCode: string }>(),
  result: result<{ terminalId: string }>(),
})
```

### 10.4.2 handler 注册显式化

```ts
ctx.commands.handle(activateTerminal, async ({payload, context, meta}) => {
  ...
  return { terminalId }
})
```

### 10.4.3 执行结果成为一等公民

当前 listener 旁路等待结果的模式，我会改成：

```ts
const result = await runtime.commands.dispatch(activateTerminal({ activationCode }), {
  requestId,
  sessionId,
})
```

同时保留：

1. lifecycle tracing
2. parent-child command chain
3. internal execution
4. fan-out / event 型命令

但要把“请求型命令”和“广播型事件”区分开，而不是全都塞进同一个执行语义里。

### 10.4.4 并发策略显式化

每个 command 或 handler 可以声明：

1. `serial`
2. `parallel`
3. `dedupe`
4. `drop-if-running`
5. `latest-only`

这样 `tcp-client`、`tdp-client` 这类连接/刷新命令会更稳。

## 10.5 状态系统重做方式

这是重做中的重点。

### 10.5.1 去掉 `RootState` 声明合并

新的状态推导应该来自 runtime/module descriptor，而不是 ambient augmentation。

例如：

```ts
const app = defineApp({
  modules: [kernelCoreBaseModule, kernelCoreTdpClientModule],
})

type AppState = InferAppState<typeof app>
```

这样：

1. 类型边界由 app 组合结果决定。
2. 不再依赖“某个 augment 文件有没有被编译进来”。

### 10.5.2 把 persist/sync/restart policy 正式化

每个 slice 都应声明：

1. `persist: none | durable`
2. `rehydrate: full | partial | custom`
3. `restart: keep | reset | custom`
4. `sync: isolated | master-to-slave | slave-to-master`
5. `conflictResolver: updatedAt | replace | custom`

这样 TCP/TDP/UI runtime 的方法论可以直接落成协议，而不是散落在实现经验里。

### 10.5.3 `ValueWithUpdatedAt` 继续保留，但提升到正式协议

我会保留它，但不再让所有状态都机械套用。  
而是由 slice policy 决定：

1. 哪些字段需要 top-level timestamp compare。
2. 哪些字段需要 tombstone。
3. 哪些字段只在本地使用。

### 10.5.4 `batchUpdateState` 升级为 sync merge engine

新的 merge helper 要支持三类语义：

1. `set`
2. `clear-to-null`
3. `delete-with-tombstone`

不能再简单把 `null/undefined` 都当删除。

## 10.6 适配器与平台能力重做方式

### 10.6.1 port registry 改成 runtime-scoped

```ts
const runtime = await createKernelRuntime({
  ports: {
    logger: loggerAdapter,
    device: deviceAdapter,
    storage: stateStorageAdapter,
    appControl: appControlAdapter,
  }
})
```

这样：

1. 没有全局污染。
2. 能校验 required port。
3. 能在测试里替换端口。

### 10.6.2 required/optional capability 显式化

模块可以声明：

1. requires `storage`
2. requires `logger`
3. optional `externalConnector`

runtime 在启动时做校验，而不是运行到一半才发现没注册。

## 10.7 HTTP 体系重做方式

我不会删掉 `ApiManager` 的能力，而是把它移到 `kernel-core-http`。

原因：

1. 它已经是完整子系统。
2. 不该绑死在 base runtime 里。
3. 这样 TCP/TDP/terminal 之类网络模块可以显式依赖 HTTP，而不是所有包都被动携带 HTTP 认知。

`serverSpace` 也应该从 `ApplicationManager` 里拆出，变成一个独立 bootstrap service/plugin。

## 10.8 UI screen contract 重做方式

我会把 `ScreenPart` 从 `base` 拆走。

原因：

1. `base` 不应该依赖 React 类型。
2. `screen/workspace/instanceMode` 本质上已经是 UI runtime 范畴。
3. `navigation/ui-runtime` 才应该拥有 screen contract。

建议移动到：

1. `kernel-core-ui-contracts`
2. 或直接归入 `kernel-core-ui-runtime`

## 10.9 启动流程重做方式

新的启动流程我会拆成下面几个明确阶段：

1. `resolveModules`
2. `buildPorts`
3. `buildRegistries`
4. `buildStateSchema`
5. `buildStore`
6. `rehydrate`
7. `startServices`
8. `emitInitialize`
9. `ready`

每个阶段都可观测、可测试、可失败退出。

## 10.10 兼容迁移策略

我不会要求一次性重写全仓库，而是会走四阶段兼容迁移。

### 阶段一：做新 runtime，但保留旧 API façade

让：

1. `ApplicationManager`
2. `storeEntry`
3. `registerXxx`

都变成对新 runtime 的兼容包装。

### 阶段二：拆出 HTTP / UI contract / task

先把明显不该留在 `base` 的内容拆出去。

### 阶段三：新模块停止使用声明合并

新增包开始使用新 descriptor-based state typing。  
旧包继续兼容。

### 阶段四：逐步淘汰全局单例

最终把：

1. 全局 commandBus
2. 全局 ActorSystem
3. 全局 storeEntry
4. 全局 adapter slots

都替换为 runtime-scoped 实例。

---

## 11. 一个我会采用的“新 base”轮廓

如果只给一个最简洁的重建设计轮廓，我会这样定：

## 11.1 `base` 最终只保留三件事

1. runtime 核心装配能力。
2. module/plugin 协议。
3. 最小共识类型与 port 协议。

## 11.2 从 `base` 拆出去的内容

1. HTTP。
2. UI screen contract。
3. task system。
4. 任何带 React 类型的定义。
5. 任何依赖 interconnection 领域语义的定义。

## 11.3 继续保留但重做实现的内容

1. command/actor
2. module dependency resolver
3. initialization logger
4. system parameters / error messages registry
5. persist / sync state policy

## 11.4 完全替换的内容

1. `ApplicationManager` 全局单例
2. `storeEntry`
3. `registerXxx` 全局槽位
4. `RootState` 声明合并扩展

---

## 12. 我对当前 `base` 的最终评价

如果从架构成熟度看，我会这样评价它：

## 12.1 它的核心思想是成熟的

特别是下面几条：

1. 模块 manifest 化。
2. command 驱动。
3. adapter 注入。
4. 统一 runtime 装配。
5. timestamp-based sync 思路。

这些都不是“临时凑出来”的，而是真正能支撑大仓库演进的好思想。

## 12.2 它的问题主要发生在“收口不足”

不是思想错，而是边界没收住：

1. 好的抽象不断往 `base` 里堆。
2. 缺失的抽象又靠下游包反向补丁。
3. 最终形成一个功能很强、但边界越来越糊的超大底座。

## 12.3 它值得重构，但不值得推翻

最合理的方向不是：

1. 把 command/actor/store 这套哲学全推倒。

而是：

1. 保留它已经验证有效的运行时思想。
2. 拆分职责。
3. 消灭全局单例与隐藏耦合。
4. 把“经验方法论”升级成“正式协议”。

这才是对当前系统最稳、也最现实的演进方向。

---

## 13. 给后续重构的具体建议

如果后面真的要动 `base`，我建议顺序固定如下：

1. 先写一份“新 runtime contract”设计稿，不急着改代码。
2. 先把 `screen.ts` 和 `ApiManager` 从边界上剥离出来。
3. 再把 `storeEntry` 替换成 runtime-scoped context。
4. 再把 `registerXxx` 改成 runtime ports。
5. 最后才逐步替换 `ApplicationManager` 与 `RootState` augment 体系。

原因很简单：

1. 先拆明显越界的东西，收益最大。
2. 再处理最危险的全局状态入口。
3. 最后再碰影响面最大的类型与 runtime 主体。

---

## 14. 一句话总结

`base` 的本质不是“基础包”，而是“当前 monorepo 的内核运行时宪法”。  
它最成功的是统一协议，最危险的是全局化和过度中心化。  
正确的下一步不是抛弃它的思想，而是把它从“超大一体化底座”演进成“显式 runtime + 显式协议 + 可组合基础设施”的新内核。
