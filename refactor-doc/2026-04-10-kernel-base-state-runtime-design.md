# `state-runtime` 设计草案

## 1. 文档目标

本文档用于把旧 `base + interconnection` 中的统一 Redux/state 能力，重构为新的 `1-kernel/1.1-base/state-runtime`。

本文档只回答第一阶段最核心的三个问题：

1. `state-runtime` 到底负责什么，不负责什么。
2. `topology-runtime`、`runtime-shell` 分别如何基于它承载自己的可变状态。
3. 为什么 Redux 必须继续留在 kernel 核心能力里，但又不能再承担 request/control-plane 真相。

---

## 2. 总体结论

新的状态体系采用三层分工：

1. `state-runtime`
2. `topology-runtime`
3. `runtime-shell`

职责分别是：

1. `state-runtime` 只提供通用状态基础设施。
2. `topology-runtime` 在其内部承载拓扑域自己的恢复型状态。
3. `runtime-shell` 在其内部承载全局 catalog 和 request projection 等读模型状态。

一句话总结：

1. Redux 必须继续留在 kernel。
2. 但 Redux 只承担业务 state 与恢复型 state，不再承担 request/control-plane 真相。

---

## 3. 为什么 Redux 必须继续留在 kernel

原因不是“习惯了 Redux”，而是旧工程已经证明下列能力必须统一存在：

1. 统一的 `RootState`
2. 统一的 slice 注册与装配
3. 统一的持久化规则
4. 统一的主副机状态同步规则
5. 统一的 workspace / instanceMode 路由 helper
6. 统一的 selector 读取方式

如果把 Redux 从 kernel 中移走，会直接造成：

1. `1-kernel/1.2-modules/*` 各业务包自己实现 store 体系
2. workspace slice 和主副机同步规则分散
3. 持久化约束无法统一
4. `errorCatalog / parameterCatalog / topology seed` 这类全局可变数据无统一承载层

这不是真正的解耦，只是把复杂度下放给所有业务包。

因此：

1. Redux 必须继续是 kernel 的统一业务 state 能力。
2. 但 Redux 不再承担 request/control-plane 正确性。

---

## 4. 为什么 request/control-plane 真相不能继续放在 Redux

旧工程里的 `requestStatus` 已经暴露出一个关键事实：

1. 远端 command 开始、结束、结果回传的正确性，依赖真实的 owner 和实时协议。
2. 单靠 slice 同步，会出现 transport 完成与业务完成混在一起的问题。

因此：

1. request 真相必须回到 `topology-runtime` 的 owner-ledger。
2. request projection 可以进入 Redux，但只能是读模型。
3. 远程 command 的 dispatch/accept/start/complete/error 这些控制面事实，不再以 Redux 为真相源。

---

## 5. `state-runtime` 的职责边界

`state-runtime` 只负责通用基础设施。

### 5.1 负责的内容

1. 定义 `RootState` 基础接口
2. 允许各包通过声明合并扩展 `RootState`
3. 定义 slice descriptor
4. 定义持久化意图和同步意图
5. 提供 store 创建和 reducer 装配能力
6. 提供统一的持久化 owner lane 规则
7. 提供 workspace / instanceMode 作用域 slice 的基础 helper
8. 提供统一的 selector/helper 约束
9. 提供顶层 `ValueWithUpdatedAt` 风格同步所需的通用 contract

### 5.2 不负责的内容

1. 不定义 `masterInfo`
2. 不定义 `errorCatalog`
3. 不定义 `parameterCatalog`
4. 不定义 request ledger
5. 不定义 topology session
6. 不定义具体业务 slice

也就是说：

1. `state-runtime` 只做“状态基础设施”。
2. 所有领域语义都由上层包自己拥有。

---

## 6. `RootState` 扩展规则

这条规则必须完全继承旧包的做法。

### 6.1 规则

1. `state-runtime` 导出基础 `RootState` 空壳接口。
2. 每个拥有 state 的包，都通过 `declare module '@impos2/kernel-base-state-runtime'` 扩展 `RootState`。
3. `RootState` 的扩展继续依赖 TypeScript 声明合并。

### 6.2 这样做的原因

1. 这和旧包工程风格一致。
2. 这对当前 monorepo 的包间协作最直接。
3. 你已经明确接受这类隐式类型耦合，不需要额外纠正。

### 6.3 结果

1. 所有包都可像旧包一样读取全局 `RootState`。
2. `state-runtime` 本身仍保持通用，不预知所有业务 state。

---

## 7. 环境轴与状态轴的分工

旧工程里这几个概念不能混：

1. `displayIndex`
2. `displayCount`
3. `instanceMode`
4. `displayMode`
5. `workspace`

新架构建议分工如下：

### 7.1 环境直接输入

这些来自 environment，不作为 Redux 真相：

1. `displayIndex`
2. `displayCount`
3. `deviceId`

### 7.2 派生运行上下文

这些由 environment 与拓扑状态共同决定：

1. `standalone`
2. `workspace`

其中：

1. `workspace` 应尽量保持派生语义，而不是重复存两份真相。
2. `workspace` 的作用主要是路由和 state scope。

### 7.3 可恢复的拓扑域状态

这些应进入基于 Redux 的持久化状态：

1. `masterInfo`
2. `enableSlave`
3. 可操作的 `instanceMode`
4. 可操作的 `displayMode`

原因：

1. 它们是后续重启恢复和自动连接的种子。
2. 旧工程已经证明 `SLAVE` 需要从持久化状态中取回 `masterInfo`，否则无法自动重连。

---

## 8. `topology-runtime` 如何使用 `state-runtime`

`topology-runtime` 内部既有活的控制面真相，也有恢复型 state。

### 8.1 活的控制面真相

这些不放 Redux：

1. pairing session
2. heartbeat
3. route decision
4. owner-ledger
5. request lifecycle truth
6. remote dispatch truth

### 8.2 恢复型 state

这些基于 `state-runtime` 承载：

1. `masterInfo`
2. `enableSlave`
3. 可恢复的 `instanceMode`
4. 可恢复的 `displayMode`
5. 其他明确属于 topology 域、且重启后仍需保留的 last-known state

### 8.3 核心规则

1. `topology-runtime` 不再把“控制面真相”和“恢复型 state”混成一个 store 真相源。
2. 但它仍然拥有自己的 Redux slice，因为这些 slice 就是 topology 域的一部分。

---

## 9. `runtime-shell` 如何使用 `state-runtime`

`runtime-shell` 负责承载跨领域的全局可变数据。

### 9.1 应进入 `runtime-shell` state 的内容

1. `errorCatalog`
2. `parameterCatalog`
3. request projection read model

### 9.2 原因

1. `errorDefinition / parameterDefinition` 属于静态定义，应在 `definition-registry`
2. `errorCatalog / parameterCatalog` 属于运行时可变值，应能持久化和恢复
3. request projection 是读模型，适合对外暴露给 selector/UI

### 9.3 规则

1. `runtime-shell` 通过 `state-runtime` 建立自己的 slice
2. 但这些 slice 依然只是读模型或 catalog 状态
3. 它们不反向成为 control-plane 真相

---

## 10. 持久化与同步规则

`state-runtime` 必须继续继承旧工程已经被验证有效的规则。

### 10.1 持久化

1. slice 只声明 `persistIntent`
2. 持久化不是整 slice blob，而是由 slice 内的 persistence schema 显式声明
3. persistence schema 支持两类条目：
4. `field`，适合普通对象字段
5. `record`，适合 `Record<string, T>` 这类动态 entry 状态
6. 真正是否落盘，仍由 owner lane 决定
7. 持久化命名空间必须继续按运行域隔离
8. 敏感条目支持 `protected` 路由到安全存储，不允许 silent fallback 到明文
9. 对业务层表现必须是自动 restore、自动持久化，不要求业务手动调用落盘 API
10. kernel 内部只保留 `flushPersistence` 这类屏障能力，用于测试和极少数关键切换时机

### 10.2 同步

1. 业务 state 的跨机同步，继续保留顶层 `updatedAt` 比较思路
2. `workspace / instanceMode` scope helper 继续保留
3. `displayMode` 也允许进入 scoped helper，但不强行塞进全局 command route contract
4. request/control-plane 正确性不再依赖这套同步

### 10.2A scoped helper 已落地能力

当前 `state-runtime` 已正式提供：

1. `createWorkspaceStateKeys`
2. `createInstanceModeStateKeys`
3. `createDisplayModeStateKeys`
4. `createScopedStateDescriptors`
5. `createScopedActionType`
6. `createScopedDispatchAction`
7. `createWorkspaceActionDispatcher`
8. `createInstanceModeActionDispatcher`
9. `createDisplayModeActionDispatcher`
10. `getScopedStateKey`
11. `createScopedStateSlice`
12. `createWorkspaceStateSlice`
13. `createInstanceModeStateSlice`
14. `createDisplayModeStateSlice`
15. `toScopedSliceDescriptors`
16. `toWorkspaceStateDescriptors`
17. `toInstanceModeStateDescriptors`
18. `toDisplayModeStateDescriptors`

这些 helper 的语义边界已经明确：

1. `create*StateSlice` 只负责按 scope 展开多个 reducer/slice name，并复用同一组 action creator。
2. 这些 action creator 的 `type` 必须保持未 scoped 的 base slice action type，交给 routeContext/scoped dispatcher 去做最终重写。
3. 原因是旧业务长期依赖“先拿基础 action，再按 workspace / instanceMode 路由改写”的模式；如果 action 自身先带 scope，会产生双 scope 拼接错误。
4. `to*StateDescriptors` 只负责把展开后的 reducer 注册成 `StateRuntimeSliceDescriptor`。
5. `persistIntent / syncIntent / persistence / sync` 既支持统一值，也支持按 scope value 单独覆盖。
6. 对象型 `sync` 配置例如 `{kind: 'record'}` 必须按“单个正式值”处理，不能误判成 scope map。
7. scope map 只有在对象 key 全部命中当前 `values` 时，才视为按 scope 配置。

当前约束：

1. scoped helper 只处理 key/path/action type 重写，不读取 topology 真相。
2. `workspace / instanceMode` 可以直接由 command route context 提供。
3. `displayMode` 若要参与 scoped dispatch，由上层显式传入 scope value，不为了它扩大全局 command route contract。

### 10.3 清空语义

1. 业务值清空与 tombstone 删除必须明确区分
2. 不再让裸 `null` 同时承担两种语义

### 10.4 自动持久化策略

1. state 变更必须同步完成
2. 持久化写盘由 kernel 自动调度，不暴露给业务层
3. persistence schema 支持 `flushMode`
4. `immediate` 适合 `masterInfo / token / errorCatalog / parameterCatalog` 这类关键恢复种子
5. `debounced` 适合普通高频状态
6. runtime 启动时先 hydrate persistence，再进入 bootstrap / install / initialize
7. 已恢复的运行值优先级高于模块默认定义，默认定义只在当前 key 尚不存在时补入

---

## 11. command 与 actor 的新位置

为了避免后续理解再次混乱，这里直接定性：

1. `command` 作为统一执行主语继续保留
2. `command` 的协议定义在 `contracts`
3. `command` 的执行核心在 `execution-runtime`
4. 旧 `actor system` 不再保留为全局基础设施
5. `actor` 的职责下沉成模块内部的 handler 组织方式

也就是说：

1. 新架构保留 command
2. 弱化 actor system
3. 强化 execution runtime

---

## 12. 当前收敛后的包边界

截至本轮讨论，建议的核心边界如下：

1. `state-runtime`
2. `execution-runtime`
3. `transport-runtime`
4. `topology-runtime`
5. `runtime-shell`

其中：

1. 不再新增 `topology-state` 独立包
2. `topology-runtime` 内含自己的恢复型 state
3. `runtime-shell` 内含 `errorCatalog / parameterCatalog / requestProjection` 读模型 state

---

## 13. 下一步

下一步建议直接进入以下工作：

1. 更新总架构文档中的包清单和职责描述
2. 为 `state-runtime` 单独制定 package skeleton 和类型边界
3. 设计 `RootState` 扩展点、slice descriptor、persist/sync contract
4. 再开始实现 `1-kernel/1.1-base/state-runtime`
