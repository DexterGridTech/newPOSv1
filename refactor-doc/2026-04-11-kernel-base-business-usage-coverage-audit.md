# 核心基础包业务用法覆盖审计

## 1. 文档目标

本文档用于回答当前阶段最关键的问题：

1. 旧业务包到底如何真实使用 `1-kernel/1.1-cores/base`、`interconnection`、`communication`。
2. 这些真实使用模式，在新的 `1-kernel/1.1-base/*` 中是否已经有正式承载。
3. 哪些地方已经被测试覆盖，哪些地方还需要继续补验证。

当前阶段结论继续保持：

1. 不迁业务包代码。
2. 先把旧业务包对旧 core 的真实依赖模式审清楚。
3. 再用这些模式去反推新基础包的能力与测试覆盖。

---

## 2. 本轮阅读范围

本轮重点复核了以下业务包和旧 core 文件：

1. `1-kernel/1.2-modules/pay-base`
2. `1-kernel/1.2-modules/order-create-traditional`
3. `1-kernel/1.2-modules/user-base`
4. `1-kernel/1.2-modules/product-from-contract`
5. `1-kernel/1.2-modules/mixc-user-login`
6. `2-ui/2.2-modules/mixc-trade`
7. `2-ui/2.1-cores/admin`
8. `1-kernel/1.1-cores/interconnection/src/foundations/workspace.ts`
9. `1-kernel/1.1-cores/interconnection/src/foundations/instanceMode.ts`
10. `1-kernel/1.1-cores/communication/src/foundations/http/*`
11. `1-kernel/1.1-cores/communication/src/supports/errors/normalizeCommunicationError.ts`

---

## 3. 旧业务包的真实依赖模式

### 3.1 模块命名空间与状态 key 声明

旧业务包几乎都遵守同一模式：

1. 每个包有独立 `moduleName.ts`
2. 通过 `createModuleStateKeys(moduleName, [...])` 声明普通 slice key
3. 通过 `createModuleWorkspaceStateKeys(moduleName, [...])` 声明 workspace base key
4. 通过 `createModuleInstanceModeStateKeys(moduleName, [...])` 声明 instanceMode base key

典型位置：

1. `1-kernel/1.2-modules/pay-base/src/types/shared/moduleStateKey.ts`
2. `1-kernel/1.2-modules/user-base/src/types/shared/moduleStateKey.ts`
3. `2-ui/2.2-modules/mixc-management/src/types/shared/moduleStateKey.ts`

这里真正有价值的不是旧 helper 名字本身，而是这条规则：

1. 所有业务 state key 必须先由包集中声明。
2. 业务代码不应在 selector/actor 里临时手拼模块状态 key。

### 3.2 workspace / instanceMode 作用域状态

旧业务包的大量真实行为都依赖作用域状态：

1. selector 通过 `workspace` 决定读哪个 slice
2. actor 通过 `command.extra.workspace` 决定把 action 派发到哪个 slice
3. actor 通过 `command.extra.instanceMode` 决定把动作转发到哪个运行域

典型位置：

1. `1-kernel/1.2-modules/order-create-traditional/src/selectors/selectDraftProductOrders.ts`
2. `1-kernel/1.2-modules/pay-base/src/features/actors/paymentRequest.ts`
3. `1-kernel/1.1-cores/interconnection/src/foundations/workspace.ts`
4. `1-kernel/1.1-cores/interconnection/src/foundations/instanceMode.ts`

这里真正的业务需求是：

1. 有正式的 scope key helper。
2. 有正式的 scoped action type 重写规则。
3. 有正式的 routeContext -> scoped dispatch helper。

### 3.3 actor 内直接读写全局 store

旧业务包广泛存在下面两种模式：

1. actor 内读别的 slice 当前 state
2. actor 内派发本包 slice action

典型位置：

1. `1-kernel/1.2-modules/user-base/src/features/actors/user.ts`
2. `1-kernel/1.2-modules/pay-base/src/features/actors/paymentRequest.ts`
3. `1-kernel/1.2-modules/product-from-contract/src/features/actors/contract.ts`
4. `2-ui/2.2-modules/mixc-trade/src/hooks/usePaymentModal.ts`

旧实现依赖 `storeEntry`，但抽掉旧坏设计后，保留下来的本质需求其实是：

1. handler/actor 运行时必须能同步读全局 state。
2. handler/actor 运行时必须能分发 action。
3. 跨包写入仍然只能走公开 command，不公开 slice action。

### 3.4 `ValueWithUpdatedAt` 与动态 `Record`

旧业务包大量把业务状态建模为：

1. `ValueWithUpdatedAt<T>`
2. `Record<string, ValueWithUpdatedAt<T>>`

典型位置：

1. `1-kernel/1.2-modules/pay-base/src/types/state/paymentFunction.ts`
2. `1-kernel/1.2-modules/pay-base/src/types/state/payingOrder.ts`
3. `1-kernel/1.2-modules/order-create-traditional/src/types/state/createOrder.ts`
4. `1-kernel/1.2-modules/product-from-contract/src/types/state/contract.ts`

这说明两件事必须保留：

1. 顶层同步仍然围绕 `updatedAt` 运作。
2. 动态 `Record<string, T>` 必须有正式的持久化和同步表达。

### 3.5 `batchUpdateState` 的真实意义

旧业务包不是为了“方便少写 reducer”而用 `batchUpdateState`，而是为了：

1. 让同步回写有统一入口。
2. 让动态 `Record` 状态能按顶层 key 合并。

典型位置：

1. `1-kernel/1.2-modules/user-base/src/features/slices/user.ts`
2. `1-kernel/1.2-modules/pay-base/src/features/slices/paymentFunction.ts`
3. `1-kernel/1.2-modules/order-create-traditional/src/features/slices/createOrder.ts`
4. `1-kernel/1.2-modules/product-from-contract/src/features/slices/contract.ts`

新架构里，这一层已经被拆成：

1. `state-runtime` 的 sync summary / diff / apply
2. `topology-runtime` 的同步计划与会话

### 3.6 RootState 声明合并与 selector 全局读取

旧业务包持续依赖：

1. `RootState` 可被每个包声明合并扩展
2. selector 可以直接全局读取其他包 state

典型位置：

1. `2-ui/2.2-modules/mixc-trade/src/selectors/selectOrderCreation.ts`
2. `1-kernel/1.2-modules/pay-base/src/selectors/selectPaymentRequest.ts`
3. `2-ui/*/src/types/kernel-core-base-augment.ts`

这条规则必须继续保留。

### 3.7 errorMessages / systemParameters 的真实使用

旧业务包普遍通过静态定义来声明：

1. `DefinedErrorMessage`
2. `DefinedSystemParameter`

但运行时真正需要的是：

1. 定义注册
2. 运行值 catalog
3. selector/resolve 读取
4. 重启恢复

典型位置：

1. `1-kernel/1.2-modules/pay-base/src/supports/errors/index.ts`
2. `1-kernel/1.2-modules/user-base/src/supports/parameters/index.ts`
3. `2-ui/2.1-cores/admin/src/supports/errors/index.ts`
4. `2-ui/2.2-modules/mixc-trade/src/supports/parameters/index.ts`

### 3.8 command / actor 的真实使用方式

旧业务包的命令系统虽然松，但形成了稳定写法：

1. `createModuleCommands(moduleName, {...})`
2. `defineCommand<TPayload>()`
3. actor 内通过命令处理器承载业务逻辑
4. 可以在 handler 内派发子命令

典型位置：

1. `1-kernel/1.2-modules/user-base/src/features/commands/index.ts`
2. `1-kernel/1.2-modules/user-base/src/features/actors/user.ts`
3. `1-kernel/1.2-modules/pay-base/src/features/actors/paymentRequest.ts`

真正要继承的是：

1. 命令是正式跨包写接口。
2. handler 运行时要拿到 route context、state、dispatch、child dispatch。

### 3.9 HTTP service 模块与错误归一化

旧 `communication` 在业务层最有价值的能力，不是旧的大包本身，而是这套声明式 HTTP 模式：

1. `defineHttpEndpoint`
2. `HttpRuntime`
3. `defineHttpServiceModule`
4. `normalizeCommunicationError`

典型位置：

1. `1-kernel/1.2-modules/mixc-user-login/src/supports/http-services.ts`
2. `1-kernel/1.2-modules/mixc-user-login/src/features/actors/user.ts`

这套模式的价值是：

1. endpoint 定义集中。
2. service façade 对业务更友好。
3. actor 不直接处理 transport 细节。
4. transport 错误可以统一映射到业务可消费错误。

---

## 4. 新基础包当前覆盖状态

### 4.1 已经有正式承载并已测试覆盖

#### A. RootState 声明合并

已由 `state-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/types/state.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### B. scope key / path / descriptor

已由 `state-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/supports/scope.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### C. scoped action type 与 scoped dispatcher

已由 `state-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/supports/scope.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### D. field / record 持久化与 protected 存储

已由 `state-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### E. 动态 Record 同步、summary / diff / tombstone

已由 `state-runtime + topology-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`
2. `1-kernel/1.1-base/topology-runtime/test/scenarios/topology-runtime.spec.ts`
3. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/dispatch-runtime.spec.ts`

#### F. request projection / errorCatalog / parameterCatalog 运行值承载

已由 `runtime-shell` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/runtime-shell/src/foundations/readModel.ts`
2. `1-kernel/1.1-base/runtime-shell/test/scenarios/runtime-shell.spec.ts`

#### G. handler 运行时上下文、child dispatch、request projection 汇聚

已由 `runtime-shell + execution-runtime` 承载，且已有测试。

对应文件：

1. `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`
2. `1-kernel/1.1-base/runtime-shell/test/scenarios/runtime-shell.spec.ts`

### 4.2 本轮补齐的正式承载

#### A. moduleName -> state key 声明 helper

为了承接旧业务包“所有状态 key 先集中声明”的有效规则，本轮在 `state-runtime` 补齐：

1. `createModuleStateKeys`
2. `createModuleWorkspaceStateKeys`
3. `createModuleInstanceModeStateKeys`
4. `createModuleDisplayModeStateKeys`

说明：

1. 这些 helper 不再混入旧 `interconnection` 的业务语义。
2. 它们只是正式表达“按模块声明 base key”的稳定 API。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/supports/scope.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### A2. 声明式 scoped slice / descriptor helper

为了承接旧 `workspace.ts / instanceMode.ts` 中“先展开多个 scoped reducer，再统一生成 slice config”的模式，本轮在 `state-runtime` 补齐：

1. `createScopedStateSlice`
2. `createWorkspaceStateSlice`
3. `createInstanceModeStateSlice`
4. `createDisplayModeStateSlice`
5. `toScopedSliceDescriptors`
6. `toWorkspaceStateDescriptors`
7. `toInstanceModeStateDescriptors`
8. `toDisplayModeStateDescriptors`

说明：

1. 旧业务以后不需要再自己复制 workspace/instanceMode slice 展开模板。
2. `persistIntent / syncIntent / persistence / sync` 支持统一值和按 scope 单独配置。
3. `create*StateSlice` 返回的 action creator 明确保持未 scoped 的 base action type，避免和 scoped dispatcher 叠加后出现双 scope 拼接错误。
4. 已专门补测试，确保 `{kind: 'record'}` 这类对象型正式配置不会被误判成按 scope 的映射对象。

对应文件：

1. `1-kernel/1.1-base/state-runtime/src/supports/scopedSlice.ts`
2. `1-kernel/1.1-base/state-runtime/test/scenarios/state-runtime.spec.ts`

#### B. 声明式 HTTP service module

为了承接旧 `communication` 的好设计，而不是把业务 actor 直接绑到 transport，本轮在 `transport-runtime` 补齐：

1. `defineHttpServiceModule`

说明：

1. 这不是兼容旧包名字而已。
2. 这是把“endpoint 定义”和“业务 service façade”分开的正式做法保留下来。

对应文件：

1. `1-kernel/1.1-base/transport-runtime/src/foundations/httpServiceModule.ts`
2. `1-kernel/1.1-base/transport-runtime/test/scenarios/http-runtime.spec.ts`

#### C. topology 读取语义 selector

为了替代旧 `interconnection/src/foundations/accessory.ts` 的高频读取能力，本轮在 `topology-client-runtime` 固定了稳定 selector 面：

1. `selectTopologyInstanceMode`
2. `selectTopologyDisplayMode`
3. `selectTopologyWorkspace`
4. `selectTopologyStandalone`
5. `selectTopologyEnableSlave`
6. `selectTopologyMasterInfo`
7. `selectTopologyLocalNodeId`
8. `selectTopologyServerConnected`
9. `selectTopologyPeerConnected`
10. `selectTopologyPeerNodeId`
11. `selectTopologyScopedStateKey`

说明：

1. 新 kernel 不再提供旧式全局 getter。
2. 统一改为 selector 读取。
3. `selectTopologyScopedStateKey` 只做“基于当前 workspace 计算 scoped state key”，不负责读写 store。
4. 这组 selector 已通过 `dual-topology-host` 真实双机连接测试验证。

对应文件：

1. `1-kernel/1.1-base/topology-client-runtime/src/selectors/topologyClient.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/context-runtime.spec.ts`
3. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/connection-runtime.spec.ts`

#### D. transport-runtime 错误与参数支持层

本轮在 `transport-runtime` 补齐了两类正式支持层：

1. 低层默认执行策略参数定义
2. 统一 transport error -> AppError 归一化 helper

已补参数：

1. `transportRuntimeParameterDefinitions.httpRetryRounds`
2. `transportRuntimeParameterDefinitions.httpFailoverStrategy`
3. `transportRuntimeParameterDefinitions.socketReconnectAttempts`
4. `transportRuntimeParameterDefinitions.socketReconnectDelayMs`
5. `transportRuntimeParameterDefinitions.socketConnectionTimeoutMs`
6. `transportRuntimeParameterDefinitions.socketHeartbeatIntervalMs`
7. `transportRuntimeParameterDefinitions.socketHeartbeatTimeoutMs`

已补 helper：

1. `normalizeTransportError`

当前定位：

1. 这组参数表达 transport 层默认执行策略，不表达 topology 业务策略。
2. 远程命令超时、主副机重连节奏等业务参数，继续归 `topology-client-runtime`。
3. `normalizeTransportError` 是新 `communication.normalizeCommunicationError` 的最小继承版本，但返回新架构 `AppError`，不回到旧 `APIError` 模型。

对应文件：

1. `1-kernel/1.1-base/transport-runtime/src/supports/errors.ts`
2. `1-kernel/1.1-base/transport-runtime/src/supports/parameters.ts`
3. `1-kernel/1.1-base/transport-runtime/test/scenarios/http-runtime.spec.ts`
4. `1-kernel/1.1-base/transport-runtime/test/scenarios/socket-runtime.spec.ts`

---

## 5. 仍需继续补的覆盖点

### 5.1 execution-runtime 已补独立 vitest 级测试

本轮已补齐 `execution-runtime` 的独立 `vitest` 场景，覆盖：

1. handler 成功 / 失败生命周期
2. internal command 默认 request/session 语义
3. child dispatch 事件顺序
4. middleware 链顺序
5. middleware re-entry 错误归一化
6. command not found 错误归一化

同时收敛了一个真实执行语义：

1. middleware 抛错现在与 handler 抛错一样，统一归一成 `failed` execution result。
2. 这避免了中间件链把异常直接炸出 runtime，导致上层需要写两套错误处理。

对应文件：

1. `1-kernel/1.1-base/execution-runtime/src/foundations/createExecutionRuntime.ts`
2. `1-kernel/1.1-base/execution-runtime/test/scenarios/execution-runtime.spec.ts`

### 5.2 execution-runtime 不单独补 parameters 是刻意设计

截至本轮，`execution-runtime` 已补 errors 和独立测试，但没有新增 `parameters.ts`。

这是刻意保持克制，不是遗漏：

1. 当前 execution 核心没有稳定存在的运行时调优旋钮。
2. 生命周期、middleware、child dispatch 的行为属于固定执行语义，不适合抽成运行参数。
3. 如果以后真的出现可调执行策略，例如队列深度、并发上限、生命周期观测采样率，再单独增加参数，不提前造空概念。

### 5.3 业务侧 selector 模式的覆盖仍可继续增强

当前已经覆盖 scope helper 和 runtime state，但还没专门做一组“按旧业务 selector 习惯读取”的测试样本。

建议后续增加：

1. `workspace` scoped selector 示例
2. `instanceMode` scoped selector 示例
3. `ValueWithUpdatedAt<Record>` 组合读取示例

### 5.4 旧高频 helper 的迁移方向已经明确

截至本轮，旧 `interconnection` 高频 helper 的去向已基本明确：

1. `createModuleWorkspaceStateKeys / createModuleInstanceModeStateKeys`
2. 继续由 `state-runtime` 承接
3. `createWorkspaceSlice / createInstanceModeSlice / toModuleSliceConfigs`
4. 由 `state-runtime` 的 scoped slice/descriptor helper 替代
5. `getInstanceMode / getDisplayMode / getWorkspace / getStandalone / getEnableSlave`
6. 由 `topology-client-runtime` selector 承接
7. `getWorkspaceStateKey`
8. 由 `selectTopologyScopedStateKey(state, baseKey)` 承接

仍保持的硬规则：

1. 全局 state 可读。
2. 跨包写仍然只能走目标包公开 command。
3. 不重新暴露旧包内 slice action 作为公开 API。

### 5.5 旧业务式用法样例已开始纳入测试

本轮额外补入了两类贴近旧业务的样例测试：

1. 按当前 workspace 计算 scoped state key，再读取 `ValueWithUpdatedAt` 字段
2. 对 `Record<string, ValueWithUpdatedAt<T>>` 做 value 提取和业务过滤

这两类样例的价值是：

1. 验证新基座确实能承接旧业务 selector 写法。
2. 不急着新增 helper，先用测试证明现有 contract 已经够用。
3. 如果后续业务迁移时发现大量重复，再从真实重复处抽最小 helper。

---

## 6. 当前结论

截至本轮，可以明确下结论：

1. 旧业务包对旧 core 的依赖，并不是无边界的一团。
2. 它们实际上依赖一组稳定、可继承的模式。
3. 新基础包已经覆盖了其中的大部分关键模式。
4. 本轮又补齐了两个重要表达层缺口：
5. `moduleName -> state key` 的正式 helper
6. 声明式 HTTP service module helper

下一步应继续坚持当前策略：

1. 不迁业务包。
2. 继续沿着“旧业务真实使用模式 -> 新基础包测试覆盖”的方向补验证。
3. 优先补 `execution-runtime` 和 `transport-runtime` 的贴近业务测试，不要扩新抽象。
