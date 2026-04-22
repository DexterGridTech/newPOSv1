# 核心基础架构老工程隐式有效规则补充清单

## 1. 文档目标

本文档用于补充那些在老工程里看起来有些“怪”，但实际上已经被长期使用、且值得在新架构中升级成正式规则的做法。

这份文档覆盖的观察来源不只包括：

- `_old_/1-kernel/1.1-cores/base`
- `_old_/1-kernel/1.1-cores/interconnection`
- `_old_/1-kernel/1.1-cores/communication`

还包括它们在下面这些层中的真实使用方式：

- `_old_/1-kernel/1.1-cores/task`
- `_old_/1-kernel/1.1-cores/ui-runtime`
- `_old_/1-kernel/1.1-cores/tcp-client`
- `_old_/1-kernel/1.1-cores/tdp-client`
- `2-ui/*`
- `3-adapter/*`
- `4-assembly/*`
- `0-mock-server/*`

本文档的目的不是为老实现洗白，而是防止重构时只清掉“怪味”，却把那些真正贴合你业务特点的工程纪律一起删掉。

---

## 2. 总体结论

老工程里有一批值得保留的东西，并不总是体现在“类名好不好看”或“边界干不干净”上，而是体现在下面这些长期稳定成立的事实里：

1. 启动过程其实已经天然分层。
2. requestId 和 commandId 在业务里承担的是两种不同责任。
3. 运行时路由上下文不应该混进业务 action 载荷里。
4. 同一个 `null` 在状态层和同步层其实不是同一种语义。
5. 持久化不是“谁能写谁都写”，而是有明确 owner lane。
6. 可执行对象与可同步对象其实已经被人为分开了。
7. 某些 descriptor 的解析顺序已经形成了稳定工程语言。
8. transport 配置和连接地址其实已经在向“延迟解析”演进。

这些都应该升级成新架构里的正式规则。

---

## 3. 补充规则

## 3.1 启动必须分三阶段

老工程实际上已经把启动分成了三个阶段：

1. `preInitiatedState`：在 store 创建前注入纯同步真相。
2. `modulePreSetup / ensureModulePreSetup`：在 runtime 启动前完成宿主能力接线。
3. `initialize` command：在 runtime 可用后启动异步行为。

证据位置：

- [preInitiateInstanceInfo.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/preInitiateInstanceInfo.ts)
- [applicationManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/application/applicationManager.ts)
- [modulePreSetup.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/4-assembly/android/mixc-retail-rn84v2/src/application/modulePreSetup.ts)
- [initialize.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/actors/initialize.ts)

重构后规则：

1. 纯同步、可由环境直接推导的真相只能进入启动前 seed。
2. 宿主注入只能进入 host bootstrap 阶段，并且必须幂等。
3. 需要 store、runtime、ports 都就绪后才能执行的逻辑，必须走 initialize/runtime start 阶段。

这条规则的价值很高，因为它直接避免了“该同步的 startup truth 被异步化”和“该幂等的宿主接线混进业务 initialize”。

## 3.2 `RequestId` 与 `CommandId` 必须分开归属

老工程里这两个 ID 虽然都只是字符串，但职责完全不同：

1. `requestId` 往往由调用方生成，并被 UI/task 持有，用于统一观测一次业务请求。
2. `command.id` 由 runtime 自动生成，用于区分 request 下面的具体 command 节点。

证据位置：

- [command.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/command.ts)
- [usePaymentModal.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/2-ui/2.2-modules/mixc-trade/src/hooks/usePaymentModal.ts)
- [commandTaskAdapter.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/task/src/foundations/taskAdapter/commandTaskAdapter.ts)
- [useRequestStatus.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/hooks/useRequestStatus.ts)

重构后规则：

1. `RequestId` 继续是调用方可持有、可传入、可观测的业务关联 ID。
2. `CommandId` 继续由 runtime 内核负责生成。
3. 一个 `RequestId` 下天然允许 fan-out 多个 `CommandId`。
4. UI/selector 默认围绕 `RequestId` 观测，runtime journal/ledger 围绕 `CommandId` 记录。

## 3.3 内部编排命令必须与业务请求分层

老工程用 `INTERNAL` 作为内部命令的哨兵值，这个写法本身不一定要保留，但它背后的规则必须保留：

1. 系统内部编排命令不应污染业务 request 观测。
2. 内部命令不应默认参与远程路由与 request 结果聚合。

证据位置：

- [command.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/command.ts)
- [registerActorSystem.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/registerActorSystem.ts)
- [commandConverter.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/commandConverter.ts)

重构后规则：

1. 新架构必须继续保留“内部编排命令”和“业务请求命令”的显式区分。
2. request ledger / projection 默认只跟踪业务请求。
3. initialize、bootstrap、housekeeping 这类命令必须有正式的内部执行通道，而不是伪装成普通 request。

## 3.4 路由上下文由 runtime 注入，action/reducer 保持 scope-neutral

老工程里一个非常有价值的模式是：

1. 业务 action 本身不携带 workspace/instanceMode。
2. actor 在 runtime 上下文里决定应该把 action 落到哪个 slice key。
3. reducer 只关心业务语义，不关心自己现在是 MAIN 还是 BRANCH、MASTER 还是 SLAVE。

证据位置：

- [workspace.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/workspace.ts)
- [instanceMode.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/instanceMode.ts)
- [screen.ts actor](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/ui-runtime/src/features/actors/screen.ts)

重构后规则：

1. 新架构继续让 routing context 成为 execution context 的一部分。
2. 业务 action/reducer/slice 不直接承担路由职责。
3. workspace、instanceMode、node route 等都由 runtime 路由层注入和解析。

## 3.5 上下文三轴必须保持正交

老工程里最容易让人误判的一点是：

1. `workspace`
2. `instanceMode`
3. `displayMode`

这三者不是一回事，也不应该被粗暴等同。

证据位置：

- [instanceInfo.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/slices/instanceInfo.ts)
- [preInitiateInstanceInfo.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/preInitiateInstanceInfo.ts)
- [kernel-core-ui-runtime-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md)

典型例子：

1. secondary display 不必然等于 branch workspace。
2. slave + primary display 才会进入 branch。

重构后规则：

1. 这三轴必须继续独立建模。
2. 派生规则必须写在显式策略中。
3. 不允许把某一轴当成另一轴的缩写字段。

## 3.6 业务清空值与同步 tombstone 必须分层

老工程里同样是 `null`，其实有两种完全不同的语义：

1. 在业务 slice 中，清空字段时写 `{ value: null, updatedAt }`，表示“这个字段现在的业务值为空”。
2. 在同步 patch 中，直接写 `null`，表示“这个顶层 key 应该被删除/清理”。

证据位置：

- [screen slice](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/ui-runtime/src/features/slices/screen.ts)
- [uiVariables slice](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/ui-runtime/src/features/slices/uiVariables.ts)
- [batchUpdateState.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/batchUpdateState.ts)
- [stateSyncMiddleware.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/middlewares/stateSyncMiddleware.ts)

重构后规则：

1. “业务值为空”和“同步层删除 key”必须是两种显式语义。
2. 新架构不应再让这两种语义共享同一个裸 `null`。
3. projection/state 清空要保留时间戳，patch/tombstone 要有单独协议表达。

## 3.7 `persistToStorage` 与持久化 owner lane 必须分开

老工程里 `persistToStorage: true` 并不等于“所有实例都持久化”。

真实规则是：

1. slice 只声明自己有持久化意图。
2. 真正落盘只发生在 `displayIndex === 0` 的 owner 实例。

证据位置：

- [applicationManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/application/applicationManager.ts)
- [2026-04-08-ui-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-08-ui-runtime-design.md)

重构后规则：

1. persistence intent 与 persistence owner 必须显式分离。
2. 同一份 runtime state 不能在多个 display/node 上并行争抢本地持久化真相。
3. secondary/slave 默认消费同步或镜像结果，而不是自建持久化真相。

## 3.8 持久化命名空间必须按运行域隔离

老工程会用 `selectedServerSpace + dataVersion` 组成 storage prefix，这个做法虽然土，但非常有业务价值：

1. 避免切换环境后读到旧环境缓存。
2. 避免数据版本切换后沿用旧持久化结果。

证据位置：

- [applicationManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/application/applicationManager.ts)
- [stateStorage.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/adapters/stateStorage.ts)

重构后规则：

1. 新架构的持久化命名空间必须继续带运行域隔离信息。
2. 至少要支持 server/config/data version 级别的隔离。
3. 不能再把所有 runtime cache 混写到一个固定前缀下。

## 3.9 状态中只放可序列化 descriptor，不放可执行对象

老工程在 UI runtime 里已经天然遵守了一条很成熟的规则：

1. state 中保存的是 `ScreenPart`、`OverlayEntry` 这类可序列化 descriptor。
2. `componentType` 这类 React 组件本体只存在于 registry，不进 state。

证据位置：

- [base screen.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/screen.ts)
- [ui-runtime screen foundation](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/ui-runtime/src/foundations/screen.ts)
- [ScreenContainer.tsx](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/2-ui/2.1-cores/runtime-base/src/ui/components/ScreenContainer.tsx)
- [ModalContainer.tsx](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/2-ui/2.1-cores/runtime-base/src/ui/components/ModalContainer.tsx)

重构后规则：

1. projection/state/catalog 中只允许放可序列化 descriptor。
2. 组件、脚本执行器、宿主句柄、socket 实例这类不可序列化对象必须留在 registry/runtime/ports。
3. UI 只在渲染时按 descriptor 去 registry 解析实际组件。

## 3.10 descriptor 解析必须有确定顺序，不靠偶然遍历

老工程里已经形成了两类很成熟的解析顺序：

1. screen part：按 `screenMode + workspace + instanceMode` 过滤，再按 `indexInContainer` 排序，再选第一个 `readyToEnter`。
2. task definition：优先 state 中的运行时定义，再看注册定义；若有多版本，先匹配 `operatingSystems`，最后回退到通用版本。

证据位置：

- [ui-runtime screen foundation](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/ui-runtime/src/foundations/screen.ts)
- [taskSystem.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/task/src/foundations/taskSystem.ts)
- [taskDefinition accessory](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/task/src/foundations/accessory.ts)

重构后规则：

1. 所有 descriptor 解析都必须有显式优先级。
2. 允许 runtime override，但必须定义清楚优先级和回退策略。
3. “按上下文过滤、按优先级排序、按 readiness/compatibility 决策”应成为统一套路。

## 3.11 执行/拦截顺序必须显式，不能靠导入顺序碰运气

老工程里 middleware 已经不是靠 import 顺序，而是显式 `priority` 排序。
communication 里也已经把并发、限流、统计做成独立控制器，而不是塞进 endpoint 定义。

证据位置：

- [applicationManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/application/applicationManager.ts)
- [RequestQueueManager.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/http/RequestQueueManager.ts)
- [HttpExecutionController.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/http/HttpExecutionController.ts)

重构后规则：

1. pipeline / middleware / interceptor / execution policy 的顺序必须可声明、可打印、可验证。
2. 并发数、限流、队列长度、重试等要有可观测 stats。
3. 这些策略必须与业务 endpoint/profile 声明分离。

## 3.12 transport contract 要声明式，server 解析要延迟绑定

老 `communication` 里一条非常值得继承的方向是：

1. endpoint/profile 本身是纯声明对象。
2. server 地址不是写死在 endpoint 里，而是运行时通过 resolver/provider 决定。
3. 每次 call/connect 前都可以刷新 server 配置。

证据位置：

- [defineHttpEndpoint.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/http/defineHttpEndpoint.ts)
- [defineSocketProfile.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/ws/defineSocketProfile.ts)
- [HttpRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/http/HttpRuntime.ts)
- [SocketRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/ws/SocketRuntime.ts)
- [ServerResolver.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/communication/src/foundations/shared/ServerResolver.ts)

重构后规则：

1. transport contract 必须是纯定义，不夹带运行态实例。
2. server 解析必须支持运行时刷新，而不是构造时冻结。
3. service module 继续按 `moduleName` 注册和查找，避免 ad-hoc 零散调用。

## 3.13 基础设施元数据必须被隔离，不能混进业务遍历

老工程里 `_persist` 虽然只是 redux-persist 的辅助字段，但它已经逼出了一个成熟规则：

1. 任何 state 遍历、同步、比较、清理逻辑，都必须显式跳过基础设施元数据。

证据位置：

- [persistKey.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/persistKey.ts)
- [batchUpdateState.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/batchUpdateState.ts)
- [stateSyncMiddleware.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/middlewares/stateSyncMiddleware.ts)

重构后规则：

1. 新架构里的 persistence/runtime metadata 必须统一隔离。
2. 不能让基础设施 key 进入业务同步、业务 selector、业务 patch 比较。
3. 这类元数据必须由框架层自己消费。

## 3.14 宿主能力接线必须幂等，并且先于 runtime 启动

assembly 和 adapter 层反复出现了 `ensureModulePreSetup()` 这种写法，它不是巧合，而是很实际的工程纪律：

1. 宿主能力接线可能在多个入口被调用。
2. 但真正的注册动作必须只发生一次。
3. 运行时启动前必须先保证宿主 ports 已经就绪。

证据位置：

- [android modulePreSetup](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/4-assembly/android/mixc-retail-rn84v2/src/application/modulePreSetup.ts)
- [electron modulePreSetup](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/4-assembly/electron/mixc-retail-v1/src/application/modulePreSetup.ts)

重构后规则：

1. host bootstrap 必须幂等。
2. runtime-shell 创建前必须先拿到完整的 ports。
3. 上游入口可以重复调用 bootstrap helper，但不会重复污染 runtime。

---

## 4. 这些规则对新架构的直接影响

基于上面这些观察，后续 `1-kernel/1.1-base/*` 设计与实现必须额外满足：

1. runtime start 需要正式拆成 startup seed、host bootstrap、post-start initialize 三层。
2. request ledger 要明确区分 caller-owned `RequestId` 与 runtime-owned `CommandId`。
3. 内部编排命令必须有正式语义，而不是混入普通 request。
4. route context 必须由 runtime 注入，不回灌进业务 action 载荷。
5. value-null 与 tombstone-null 必须分层建模。
6. persistence owner lane 与 persistence intent 必须分离。
7. state 里只能放可序列化 descriptor。
8. descriptor 解析必须显式优先级、显式回退。
9. transport contract 必须声明式，server 配置必须可延迟刷新。
10. infra metadata 必须被框架层隔离。

---

## 5. 一句话结论

老工程里最值得保留的“奇怪做法”，本质上不是奇怪，而是下面这些已经被业务验证的硬需求：

1. 启动要分层。
2. 请求和命令要分层。
3. 路由和业务要分层。
4. 清空值和删除补丁要分层。
5. 持久化意图和持久化 owner 要分层。
6. descriptor 和 executable 要分层。

新架构应该做的，不是抹平这些层次，而是把它们从隐式经验升级成显式规则。
