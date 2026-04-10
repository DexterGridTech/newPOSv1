# 核心基础包重构当前进展与下一步计划

## 1. 文档目标

本文档用于汇总截至目前为止，核心基础包重构第一阶段已经完成的工作、已经确认的设计结论、当前仓库状态，以及下一步的直接实施计划。

本文档是阶段性工作纪要，不替代下面这些正式设计文档：

- [refactor-doc/2026-04-08-kernel-base-refactor-architecture.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-08-kernel-base-refactor-architecture.md)
- [refactor-doc/2026-04-08-kernel-base-refactor-implementation-plan.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-08-kernel-base-refactor-implementation-plan.md)
- [refactor-doc/2026-04-08-dual-topology-protocol-and-host-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-08-dual-topology-protocol-and-host-design.md)
- [refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md)
- [refactor-doc/2026-04-09-kernel-core-implicit-effective-rules.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-core-implicit-effective-rules.md)

---

## 2. 已完成的核心设计结论

### 2.1 新基础架构包划分已经确定

第一阶段新基础架构不再沿用旧 `base / interconnection / communication` 三包边界，而是重构为以下 10 个基础包：

1. `1-kernel/1.1-base/contracts`
2. `1-kernel/1.1-base/definition-registry`
3. `1-kernel/1.1-base/platform-ports`
4. `1-kernel/1.1-base/state-runtime`
5. `1-kernel/1.1-base/execution-runtime`
6. `1-kernel/1.1-base/transport-runtime`
7. `1-kernel/1.1-base/topology-runtime`
8. `1-kernel/1.1-base/host-runtime`
9. `1-kernel/1.1-base/topology-client-runtime`
10. `1-kernel/1.1-base/runtime-shell`

配套宿主包确定为：

1. `0-mock-server/dual-topology-host`

说明：

1. `host-runtime` 是可嵌入的双机 host 控制面核心。
2. `dual-topology-host` 是 Node/mock server shell，不作为产品终端包直接继承打包。
3. 后续主屏机内置宿主应复用 `host-runtime` 的 contract/runtime 边界，而不是复用 mock shell。
4. `state-runtime` 是统一 Redux/state 基础设施，不承载具体业务语义。
5. `topology-runtime` 负责活的控制面真相，同时内部承载拓扑域的恢复型 Redux state。
6. `topology-client-runtime` 负责客户端侧拓扑编排、连接 read model 与公开 topology context。
7. `runtime-shell` 基于 `state-runtime` 承载 `errorCatalog / parameterCatalog / requestProjection` 等全局读模型状态。

### 2.2 新架构的关键约束已经确认

以下约束已经在前序讨论中明确，不再反复摇摆：

1. 不考虑迁移成本，不为了兼容旧 API 妥协设计。
2. `1-kernel` 不能依赖 React。
3. `1-kernel/*/src/hooks/index.ts` 只保留规则说明，不实现 React hooks。
4. 所有包都必须保留统一结构，并包含 `src/moduleName.ts`。
5. `moduleName` 继续是正式命名空间，而不是可有可无的装饰。
6. 全局 `state` 可以读，但跨包写只能通过公开 `command`。
7. `slice action / reducer / actor / middleware` 都属于包内实现细节，不对外暴露为写接口。
8. 不再保留多个全局 manager 并列存在。
9. request 开始前的状态写入必须是同步的。
10. 默认不强调 teardown。
11. `runtimeVersion` 不是硬匹配门槛。
12. `epics / redux-observable` 不再进入新架构。
13. Redux 继续保留在 kernel，作为统一业务 state 能力。
14. Redux 不再承担 request/control-plane 真相。
15. `RootState` 继续允许各包通过声明合并扩展。

### 2.3 时间、ID、日志、错误、参数方向已经确认

下面这些基础语言已经单独形成设计文档，并得到确认：

1. 所有存储时间字段统一为毫秒时间戳数字。
2. 时间格式化只用于展示和日志渲染。
3. 统一运行时 ID helper 只作用于 `1-kernel / 2-ui / 3-adapter / 4-assembly`。
4. `0-mock-server` 只做协议兼容，不复用产品侧统一 ID 生成实现。
5. logger 统一升级为结构化 `LogEvent` 模型。
6. `DEV` 允许原文，`PROD` 必须脱敏。
7. logger 要提供尽可能多的 helper，减少业务拼日志对象。
8. 旧 `errorMessages.ts` 被重构为 `errorDefinitions + registry + catalog + resolver` 四层模型。
9. 旧 `systemParameters.ts` 被重构为 `parameterDefinitions + registry + catalog + resolver` 四层模型。

### 2.4 旧工程必须继承的亮点已经沉淀

已经额外完成两类重要文档整理：

1. 从 `base / interconnection` 评审文档中提炼出必须继承并超越的架构亮点。
2. 从整个仓库真实使用方式中提炼出一批“怪但有效”的隐式规则，并升级为新架构显式约束。

这些内容后续会直接约束实现，不再只停留在口头理解。

---

## 3. 已完成的仓库落地工作

### 3.1 workspace 已接入 `1-kernel/1.1-base/*`

仓库根 `package.json` 已加入：

1. `1-kernel/1.1-base/*`

并且依赖安装已经执行过，因此以下文件已变化：

1. `package.json`
2. `yarn.lock`
3. `.yarn/install-state.gz`

### 3.2 batch A 三个包的骨架已经创建

当前已经创建的包：

1. `1-kernel/1.1-base/contracts`
2. `1-kernel/1.1-base/platform-ports`
3. `1-kernel/1.1-base/definition-registry`

这三个包均已具备统一骨架，包括：

1. `package.json`
2. `tsconfig.json`
3. `src/index.ts`
4. `src/moduleName.ts`
5. `src/generated/packageVersion.ts`
6. `src/hooks/index.ts`
7. `test/index.ts`
8. `src/application`
9. `src/features`
10. `src/foundations`
11. `src/selectors`
12. `src/supports`
13. `src/types`

### 3.3 新包命名空间已经落位

当前三个包的 `moduleName` 已确定为：

1. `kernel.base.contracts`
2. `kernel.base.platform-ports`
3. `kernel.base.definition-registry`

### 3.4 三个骨架包当前可独立通过类型检查

已确认下面三个 workspace 命令当前均可通过：

1. `corepack yarn workspace @impos2/kernel-base-contracts type-check`
2. `corepack yarn workspace @impos2/kernel-base-platform-ports type-check`
3. `corepack yarn workspace @impos2/kernel-base-definition-registry type-check`

说明：

1. 当前通过的是骨架态类型检查。
2. 还没有进入第一轮真实 contract 实现。

---

## 4. 已完成的分析与复核工作

### 4.1 已重新阅读并纳入参考的老工程内容

已针对第一阶段范围重新审阅：

1. `1-kernel/1.1-cores/base`
2. `1-kernel/1.1-cores/interconnection`
3. `1-kernel/1.1-cores/communication`

同时也延伸阅读了它们在以下层的真实使用方式：

1. `1-kernel/1.1-cores/task`
2. `1-kernel/1.1-cores/ui-runtime`
3. `1-kernel/1.1-cores/tcp-client`
4. `1-kernel/1.1-cores/tdp-client`
5. `2-ui/*`
6. `3-adapter/*`
7. `4-assembly/*`
8. `0-mock-server/*`

### 4.2 已确认需要明确继承的老语义

基于重新阅读，已经明确这些语义必须进入新 contract：

1. 启动三阶段：`preInitiatedState`、`modulePreSetup`、`initialize`
2. `RequestId` 与 `CommandId` 必须分责
3. `INTERNAL` 语义必须保留为正式内部编排语义
4. 路由上下文由 runtime 注入，不混进业务 action
5. `workspace / instanceMode / displayMode` 三轴必须正交
6. 业务清空值与同步 tombstone 必须分层
7. `persistToStorage` 与持久化 owner lane 必须分开
8. 持久化命名空间必须按运行域隔离
9. state 里只放可序列化 descriptor
10. descriptor 解析必须有显式顺序
11. middleware / 拦截 / 执行顺序必须显式
12. transport 定义应声明式、地址应延迟解析
13. `SLAVE` 的 `masterInfo` 必须能持久化恢复，否则重启后无法自动回连 `MASTER`
14. `errorCatalog / parameterCatalog` 的运行值必须有统一 state 承载，而不能只留在内存
15. `RootState` 的可扩展性必须保留旧包声明合并模型

### 4.2A 最新补充结论

这一轮讨论后，又新增确认了以下边界：

1. `state-runtime` 是纯通用包，不做领域业务逻辑。
2. `topology-state` 不单独拆包，直接并入 `topology-runtime`。
3. `topology-runtime` 内部既有活的控制面真相，也有恢复型 state。
4. `runtime-shell` 内部承载全局 catalog 与 request projection 的 state。
5. `command` 的协议定义在 `contracts`，执行核心在 `execution-runtime`。
6. 旧 `actor system` 不再保留为全局基础设施，其职责下沉成模块内部 handler 组织方式。
7. `workspace / instanceMode / displayMode` 作用域 helper 归 `state-runtime`，而不是归客户端拓扑包。
8. 旧 `interconnection` 的客户端连接/重连/resume/remote-command 编排，独立升级为 `topology-client-runtime`。
9. `src/foundations` 不等于包根默认公开 API；包根只暴露稳定能力，内部 helper 走包内边界。
10. 包内测试若需验证内部算法，应改走包内相对路径导入，而不是逼迫产品 API 暴露实现细节。
11. `typed()` 这类外部声明 DSL helper 可以保留为稳定 API，但 `moduleResolver / readModel / serverCatalog / ledger` 这类实现 helper 默认不对外公开。
12. 第一批基础包的 `src/index.ts` 已开始收敛为显式稳定文件导出，不再统一透传 `./foundations`。

### 4.3 已确认需要进入 batch A 的首批 contract 要素

下一轮实现时，batch A 首先要落地的对象已基本收敛为：

1. `TimestampMs`
2. `nowTimestampMs`
3. `formatTimestampMs`
4. `RuntimeIdKind`
5. `RequestId / CommandId / SessionId / NodeId / EnvelopeId / DispatchId / ProjectionId`
6. `createRuntimeId`
7. `createRequestId / createCommandId / createSessionId / createNodeId`
8. `ErrorDefinition / AppError / ErrorCatalogEntry`
9. `ParameterDefinition / ParameterCatalogEntry / ResolvedParameter`
10. `NodeRuntimeInfo`
11. `PairingTicket`
12. `NodeHello / NodeHelloAck`
13. `CompatibilityDecision`
14. `CommandDispatchEnvelope`
15. `CommandEventEnvelope`
16. `RequestProjection`
17. `ProjectionMirrorEnvelope`
18. `AppModule` 的新 manifest 契约
19. `LoggerPort / LogEvent / LogLevel`
20. error / parameter definition registry contract

---

## 5. 当前尚未开始或尚未完成的代码工作

当前阶段已经不再只是“设计已定、骨架已建”，而是：

1. batch A 已完成首轮真实实现
2. `execution-runtime` 已完成首轮真实实现
3. `topology-runtime` 已完成首轮真实实现
4. `runtime-shell` 已完成首轮真实实现
5. `transport-runtime` 已完成首轮真实实现
6. `host-runtime` 已完成首轮真实实现
7. `dual-topology-host` 已完成首轮 Node/mock shell 实现
8. `1-kernel/1.1-base/*` 已统一切换为正式 `test/` 验证入口，并删除原 `dev` 目录
9. `state-runtime` 设计文档已单独形成，准备进入实现阶段

### 5.2 `state-runtime` 首轮实现已完成

已完成：

1. `1-kernel/1.1-base/state-runtime` 包骨架创建
2. `RootState` 声明合并扩展点落位
3. 通用 `PersistIntent / SyncIntent / ValueWithUpdatedAt / StateRuntimeSliceDescriptor` 落位
4. `createStateRuntime` 与通用 store 装配能力落位
5. `state-runtime` 自身 `type-check` 与 `vitest` 已通过
6. 持久化模型已从整 slice snapshot 升级为 schema-driven field / record entry persistence
7. `state-runtime` 已支持自动 hydrate、自动脏写、内核级 `flushPersistence` 屏障
8. `StateStoragePort` 已补充 `multiGet / multiSet / multiRemove`
9. `PlatformPorts` 已补充 `secureStateStorage`
10. persistence schema 已支持 `protected` 条目路由到安全存储
11. 动态 `Record<string, T>` 已支持 manifest + entry key 模型

### 5.3 `topology-runtime` 已接入恢复型 state

已完成：

1. `topology-runtime` 新增 recovery state 类型与 API
2. recovery state 内部已改为通过 `state-runtime` 承载，而不是裸内存闭包
3. recovery persistence 已接入 `stateStorage`
4. `masterInfo / instanceMode / displayMode / enableSlave` 已按字段级自动持久化
5. 已补充真实存储恢复测试，覆盖 slave reconnect 所需 `masterInfo` 恢复

### 5.4 `runtime-shell` 已接入自动恢复型读模型持久化

已完成：

1. `errorCatalog / parameterCatalog` 已改为 `state-runtime` record persistence
2. `requestProjection` 继续保持 runtime-only，不参与本地持久化
3. `createKernelRuntime.start()` 已调整为先 hydrate，再 bootstrap / install / initialize
4. 默认 definition 不再覆盖已恢复 catalog 运行值
5. 已补充 runtime-shell 场景验证，覆盖 catalog 恢复与 topology recovery 恢复

### 5.5 `state-runtime` 同步契约已开始落地

已完成：

1. 旧 `updatedAt` 比较语义已重新梳理并形成独立文档
2. 新 `SyncValueEnvelope` / `SyncRecordState` / `SyncStateSummary` 已落到 `state-runtime`
3. 旧 `null = 删除` 已升级为显式 tombstone 模型
4. `instanceMode / workspace / displayMode` 的 scope 已抽象为正式 contract
5. 已补充单元测试固定 `updatedAt` 合并、tombstone 和 scoped key/path 语义
6. `StateRuntimeSliceDescriptor.sync`、`createSliceSyncSummary`、`createSliceSyncDiff` 已落位
7. 新 helper 已能直接映射旧 `interconnection` 的摘要交换和差异生成逻辑
8. `topology-runtime` 已新增按 `syncIntent` 生成 summary/diff 的同步计划层
9. `topology-runtime` 已新增同步会话编排层，开始覆盖旧 `connectedToServer / synStateAtConnected / startToSync` 之间的控制流程
10. `topology-runtime` 已新增持续同步观察层，开始替代旧 `stateSyncMiddleware` 的基线缓存与成功后提交语义
11. `contracts` 已新增传输无关的 state sync envelope，`topology-runtime` 已能生成/消费 summary、diff、commit ack envelope
3. 已补充 `SLAVE` 重启恢复所需 topology seed 的测试用例
4. `topology-runtime` 创建时已补充结构化加载日志
5. `topology-runtime` 的 `type-check` 与 `vitest` 已通过

### 5.4 `runtime-shell` 已接入 `state-runtime`

已完成：

1. `requestProjection / errorCatalog / parameterCatalog` 已改为通过 `state-runtime` 承载
2. `runtime-shell` 启动过程已补充类似旧 `ApplicationManager` 的结构化加载日志
3. 已验证 `kernel-runtime-start / modules-resolved / host-bootstrap / install / initialize-commands` 等事件输出
4. `runtime-shell` 已切换为正式 `vitest` 场景测试入口，不再只依赖 `test/index.ts` 脚本
5. `runtime-shell` 场景测试与 `type-check` 已通过

### 5.5 当前最新阶段结论

截至目前：

1. `host-runtime / dual-topology-host / transport-runtime` 围绕双机 host relay、resume barrier、state sync envelope 的第一轮实现已经完成。
2. `topology-client-runtime` 已完成首轮 context / connection / peer / sync read model 实现，并与 `topology-runtime` recovery state 建立持续同步关系。
3. `topology-client-runtime` 已支持通过 assembly 注入 socket runtime/profile/hello provider，不在 kernel 内直接依赖 Node ws。
4. 下一阶段不再是继续扩 transport/host，而是进入旧 `interconnection` 的客户端侧替代包深水区实现。

这一轮新增确认：

1. 新增客户端侧编排包 `1-kernel/1.1-base/topology-client-runtime`
2. `workspace / instanceMode / displayMode` 的 scoped state helper 归 `state-runtime`
3. `topologyContext / connection / peer / sync` 这类全局可读 topology read model 归 `topology-client-runtime`
4. request 真相仍归 `topology-runtime`，request projection read model 仍归 `runtime-shell`
5. `state-runtime` 现在不仅能自动 hydrate / persist，也已经具备正式 `applySlicePatches(...)` 回写 API，可承接跨机 state sync diff 的落地。
6. `runtime-shell` 已把 `RuntimeModuleContext.applyStateSyncDiff(...)` 接到正式 `state-runtime` API，不再使用伪 action 或错误的 persisted-state 占位逻辑。
7. `topology-client-runtime` 已接入正式 state sync session 编排：`beginSyncSession -> summary -> diff -> apply -> commit ack -> activateContinuousSync`。
8. `topology-runtime` 已修正两个关键同步语义：
9. `remote summary` 缺失某个 slice 时，要视作该 slice 远端为空，而不是直接跳过。
10. 即使 diff 为空，也要返回空 diff envelope，让对端完成 commit ack 与 baseline 推进，而不是卡在 awaiting-diff。
11. 已新增真实双机 `dual-topology-host` 场景测试，验证 master-to-slave slice 能通过 summary/diff/apply/ack 闭环同步到 slave。

这一轮新增设计文档：

1. [refactor-doc/2026-04-10-kernel-base-topology-client-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-10-kernel-base-topology-client-runtime-design.md)

直接下一步建议顺序：

1. 继续扩 `topology-client-runtime`，补 continuous sync 的运行期 diff 收集与推送，而不只是在 reconnect/resume 阶段完成首轮对齐。
2. 明确并落地单向同步 authority 规则，避免 `master-to-slave` / `slave-to-master` 双端都对同一 slice 生成修正 diff。
3. 再补 `state-runtime` 的 scoped helper，使其正式替代旧 `createModuleWorkspaceStateKeys / toModuleSliceConfigs / dispatchWorkspaceAction`
4. 最后开始旧 `interconnection` 客户端语义向新 topology shell 的整体验证迁移

---

## 5.1 Batch A 已完成项

以下 batch A 工作已经完成：

1. `contracts` 的首轮真实类型与 helper 实现
2. `platform-ports` 的首轮 port interface 与 logger contract 实现
3. `definition-registry` 的首轮 registry contract 与 factory 实现
4. batch A 专项实施计划文档
5. batch A 三个包的 `test` 验证入口替换

### 5.1.1 `contracts` 已完成内容

已完成的核心对象包括：

1. `TimestampMs`
2. `RuntimeInstanceId / RequestId / CommandId / SessionId / NodeId / EnvelopeId / DispatchId / ProjectionId`
3. `RuntimeIdKind`
4. `INTERNAL_REQUEST_ID / INTERNAL_SESSION_ID`
5. `nowTimestampMs / formatTimestampMs`
6. `createRuntimeId`
7. `createRuntimeInstanceId / createRequestId / createCommandId / createSessionId / createNodeId`
8. `createEnvelopeId / createDispatchId / createProjectionId`
9. `ErrorDefinition / AppError / ErrorCatalogEntry`
10. `ParameterDefinition / ParameterCatalogEntry / ResolvedParameter`
11. `createAppError / renderErrorTemplate`
12. `AppModule` 新 manifest 契约
13. `CompatibilityDecision`
14. `NodeRuntimeInfo / PairingTicket / NodeHello / NodeHelloAck`
15. `CommandDispatchEnvelope / CommandEventEnvelope`
16. `RequestProjection / ProjectionMirrorEnvelope`

### 5.1.2 `platform-ports` 已完成内容

已完成的核心对象包括：

1. `LogLevel / LogEnvironmentMode / LogMaskingMode`
2. `LogScope / LogContext / LogEvent`
3. `LoggerPort`
4. `createLoggerPort(...)`
5. `PlatformPorts`
6. `StateStoragePort`
7. `DevicePort`
8. `AppControlPort`
9. `LocalWebServerPort`
10. `ConnectorPort`
11. `createPlatformPorts(...)`

同时已验证：

1. `PROD` 模式下日志自动脱敏
2. 敏感字段会转为 `[MASKED]`

### 5.1.3 `definition-registry` 已完成内容

已完成的核心对象包括：

1. `KeyedDefinition`
2. `DefinitionRegistry<T>`
3. `DefinitionRegistryBundle`
4. `createKeyedDefinitionRegistry(...)`
5. `createDefinitionRegistryBundle(...)`

当前 bundle 已先支持：

1. error definition registry
2. parameter definition registry

同时已验证：

1. 注册
2. 查询
3. duplicate key 拦截

---

## 5.2 第二批已完成项

以下第二批工作已经完成首轮实现：

1. `execution-runtime` 包骨架创建
2. `execution-runtime` 专项实施计划文档
3. `execution-runtime` 的首轮单机执行内核实现
4. `execution-runtime` 的 `type-check` 与 `test` 验证通过

### 5.2.1 `execution-runtime` 已完成内容

已完成的核心对象包括：

1. `ExecutionCommand`
2. `ExecutionContext`
3. `ExecutionResult`
4. `ExecutionLifecycleEvent`
5. `ExecutionHandler`
6. `ExecutionMiddleware`
7. `ExecutionJournalRecord`
8. `ExecutionJournal`
9. `ExecutionRuntime`
10. `createExecutionCommand(...)`
11. `createInternalExecutionCommand(...)`
12. `createExecutionJournal(...)`
13. `createExecutionRuntime(...)`

### 5.2.2 `execution-runtime` 当前已验证行为

当前已验证：

1. runtime 不依赖全局 `commandBus`
2. runtime 不依赖全局 `ActorSystem`
3. command 在 handler 进入前会先发出 `started` lifecycle event
4. internal command lane 可正常执行
5. 本机 journal 可记录 `started / completed`

---

## 5.3 第三批已完成项

以下第三批工作已经完成首轮实现：

1. `topology-runtime` 包骨架创建
2. `topology-runtime` 专项实施计划文档
3. `topology-runtime` 的首轮 owner-ledger 内核实现
4. `topology-runtime` 的 `type-check` 与 `test` 验证通过

### 5.3.1 `topology-runtime` 已完成内容

已完成的核心对象包括：

1. `OwnerCommandNodeStatus`
2. `OwnerCommandNode`
3. `OwnerLedgerRecord`
4. `RegisterRootRequestInput`
5. `OwnerLedger`
6. `CompatibilityEvaluationInput`
7. `CreateTopologyRuntimeInput`
8. `TopologyRuntime`
9. `createOwnerLedger(...)`
10. `buildRequestProjection(...)`
11. `evaluateCompatibility(...)`
12. `createTopologyRuntime(...)`

### 5.3.2 `topology-runtime` 当前已验证行为

当前已验证：

1. request owner truth 已从旧 slice 同步思路切换为本地 owner-ledger 聚合
2. root request 可注册为正式 owner record，而不是临时观测态
3. child command dispatch 会挂接到既有 request 树，而不是独立漂浮
4. remote command event 可回写既有 command node 生命周期
5. request projection 可从 owner-ledger 实时派生 `status / pendingCommandCount / mergedResults`
6. protocolVersion 不一致会被直接拒绝
7. runtimeVersion 不一致只会降级，不会阻断兼容协商
8. `RequestLifecycleSnapshot` 已具备 `ownerNodeId / rootCommandId / commands / commandResults`，足以重建 request 读模型
9. lifecycle snapshot 可从 `topology-runtime` 导出并重新应用，恢复后不会把 pending request 错判成完成

---

## 5.4 第四批已完成项

以下第四批工作已经完成首轮实现：

1. `runtime-shell` 包骨架创建
2. `runtime-shell` 专项实施计划文档
3. `runtime-shell` 的首轮总装配内核实现
4. `runtime-shell` 的包内 `type-check` 与 `test` 验证通过

### 5.4.1 `runtime-shell` 已完成内容

已完成的核心对象包括：

1. `KernelRuntimeModule`
2. `KernelRuntime`
3. `StartupSeed`
4. `DispatchRuntimeCommandInput`
5. `KernelRuntimeHandler`
6. `RuntimeShellState`
7. `RuntimeReadModel`
8. `resolveRuntimeModules(...)`
9. `createRuntimeReadModel(...)`
10. `createKernelRuntime(...)`
11. request projection / error catalog / parameter catalog selectors

### 5.4.2 `runtime-shell` 当前已验证行为

当前已验证：

1. `runtime-shell` 已成为新基础架构中的唯一总装配入口
2. startup 已拆成 `startup seed -> host bootstrap -> post-start initialize` 三段
3. 模块依赖会先解析为 dependency-first 顺序，而不是依赖运行期碰运气
4. `CommandId` 已回收到 runtime 内生成，`RequestId` 仍允许由调用方持有和传入
5. 初始化命令会走 internal command lane，而不是直接调用 handler
6. request projection 已成为 runtime 可读的正式读模型
7. error catalog / parameter catalog 已成为 runtime 可读目录，而不是定义注册表本身
8. 本地 child command dispatch 会回写 `topology-runtime` 的 owner-ledger
9. runtime 已可导出并应用 `RequestLifecycleSnapshot`，应用后 selector 能恢复 request projection 视图
10. owner runtime 已可创建 remote child dispatch envelope，并在本地 owner-ledger 中先登记 child node
11. peer runtime 已可代执行 remote dispatch，并返回 `accepted / started / completed | failed` event 序列
12. owner runtime 已可应用 remote command event，并收敛 request projection 与远端结果
13. peer 代执行 remote dispatch 时，不会在本地错误创建 owner request projection

### 5.4.3 本轮补充：remote command `started` 已改为实时回传

本轮对 `runtime-shell` 与 `topology-client-runtime` 补了一处关键时序修正：

1. 之前 `runtime-shell.handleRemoteDispatch(...)` 会在 peer 端命令执行结束后，一次性返回 `accepted / started / completed | failed`。
2. 这种实现虽然最终能收敛 request projection，但 `started` 不是实时回传，不满足双机 request 状态必须先同步的约束。
3. 现在 `execution-runtime.execute(...)` 已支持单次执行级别的 lifecycle observer。
4. `runtime-shell.handleRemoteDispatch(...)` 已改为在 peer 端真实发出 lifecycle 时，立即产出对应 `CommandEventEnvelope`。
5. `topology-client-runtime` 收到 remote dispatch 后，会把这些 event 逐条实时经 socket 回传，而不是等执行结束后再批量发送。

本轮新增验证：

1. `runtime-shell` 场景测试已验证 `handleRemoteDispatch(..., {onEvent})` 能按 `accepted -> started -> completed` 的顺序实时产出事件。
2. `topology-client-runtime` 场景测试已验证，在真实 `dual-topology-host` + Node ws adapter 联调下，owner 端可以先观测到 remote `started`，随后再观测到 `completed`，并最终收敛 request projection。

这条修正很关键，因为它把之前“旧工程靠 `sendToRemoteExecute` 等远端确认才能勉强接上 request 状态”的隐式业务规律，升级成了新架构里的显式 runtime 约束。

---

## 5.5 第五批已完成项

以下第五批工作已经完成首轮实现：

1. `transport-runtime` 包骨架创建
2. `transport-runtime` 专项实施计划文档
3. `transport-runtime` 的首轮 HTTP / WS foundation 实现
4. `transport-runtime` 按新规范切换到正式 `test/` 目录
5. `transport-runtime` 的包内 `type-check`、`test`、`test:scenario` 验证通过

### 5.5.1 `transport-runtime` 已完成内容

已完成的核心对象包括：

1. `TransportRequestContext`
2. `TransportServerAddress`
3. `TransportServerDefinition`
4. `ServerCatalog`
5. `typed(...)`
6. `compilePath(...)`
7. `defineHttpEndpoint(...)`
8. `buildHttpUrl(...)`
9. `HttpExecutionController`
10. `createHttpRuntime(...)`
11. `defineSocketProfile(...)`
12. `buildSocketUrl(...)`
13. `JsonSocketCodec`
14. `createSocketRuntime(...)`

### 5.5.2 `transport-runtime` 当前已验证行为

当前已验证：

1. HTTP endpoint 仍保持声明式 contract，而不是回到旧 `ApiManager` 风格。
2. server address 仍为 late-bound resolution，不在定义期冻结。
3. HTTP runtime 在首地址失败后可按顺序 failover 到第二地址。
4. WS runtime 可完成 profile 注册、连接、消息接收、发送、断开。
5. WS transport-level close 可触发 reconnect 事件，而不解释业务完成语义。
6. `transport-runtime` 的正式验证入口已从临时 `dev` 语义切换为正式 `test` 语义。
7. `transport-runtime` 已在测试层接入 Node `ws` transport adapter，并完成到 `dual-topology-host` 的真实 socket 接线。
8. `SocketProfile + SocketRuntime` 已能承载 `node-hello / command-dispatch / command-event` 的真实双机消息流。
9. `SocketProfile + SocketRuntime` 已能承载 `resume-begin / request-lifecycle-snapshot / resume-complete` 的真实双机 resume 控制流。
10. `SocketProfile + SocketRuntime` 已能承载 `state-sync-summary / state-sync-diff / state-sync-commit-ack` 的真实双机 state sync 控制流。
11. `transport-runtime` 已验证连续同步基线只有在收到 `commit ack` 后才推进，未确认前不会误提交 baseline。
12. `transport-runtime` 承载真实双机消息时，仍未混入 request owner truth、projection 聚合或业务完成解释。

### 5.5.3 `transport-runtime` 与旧 `communication` 的关系

本轮 `transport-runtime` 不是平地重写，而是明确继承和改造了旧 `1-kernel/1.1-cores/communication` 中已经验证有效的基础设施思想，包括：

1. 声明式 HTTP endpoint 语言
2. 声明式 WS profile 语言
3. late-bound server resolver 思路
4. HTTP retry / failover / execution control 思路
5. WS codec / connection state / event dispatch 思路

本轮同时剔除了不符合新边界的部分：

1. 不再保留旧 manager 式全局门面
2. 不把 topology / request owner / request 完成语义混入 transport
3. 不把正式验证继续停留在单个 `dev/index.ts`

---

## 5.6 第六批已完成项

以下第六批工作已经完成首轮实现：

1. `host-runtime` 包骨架创建
2. `host-runtime` 的首轮可嵌入 host 控制面实现
3. `host-runtime` 按新规范使用正式 `test/` 目录
4. `host-runtime` 的包内 `type-check`、`test`、`test:scenario` 验证通过

### 5.6.1 `host-runtime` 已完成内容

已完成的核心对象包括：

1. `HostRuntime`
2. `HostSessionRecord`
3. `HostTicketRecord`
4. `HostRelayDelivery`
5. `HostFaultRule`
6. `HostObservationEvent`
7. `createHostRuntime(...)`
8. pairing ticket issue / bind / occupancy
9. hello / ack compatibility flow
10. session attach / detach / heartbeat / idle expire
11. ordered relay enqueue / drain
12. offline peer relay queue and reconnection rebind
13. host observability
14. fault injection registry

补充说明：

1. 上述 offline queue / rebind 是 first-pass 过渡能力。
2. 正式重连恢复语义已确认升级为“先 resume 对齐，再恢复实时流”。
3. 详见 [refactor-doc/2026-04-09-dual-topology-reconnect-resume-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-dual-topology-reconnect-resume-design.md)

### 5.6.2 `host-runtime` 当前已验证行为

当前已验证：

1. ticket 可发放，master/slave hello 可建立同一 session。
2. hello 会显式返回 `NodeHelloAck`，而不是把连接成功当成协议成功。
3. 缺失必需 capability 会被拒绝。
4. relay 会按 channel 生成有序 sequence。
5. peer 离线时 relay 会真实进入待回绑队列。
6. peer 重连后离线队列当前会回绑到新 connection。
7. heartbeat 会真正更新内部连接记录。
8. idle timeout 会按最后 heartbeat 时间断开连接。
9. projection mirror envelope 会路由到 owner node。
10. reconnect 后 queued relay 默认不会直接 drain。
11. 只有显式 `beginResume -> completeResume` 后，reconnected peer 才能恢复 queued relay 交付。
12. resume barrier 期间允许 `request lifecycle snapshot` 控制面消息先行交付，但普通 dispatch 仍保持阻塞。

说明：

1. 第 6 条仅表示当前 first-pass 行为。
2. 当前实现已经进入 resume barrier 语义，不再允许“重连即 flush”。

---

## 5.7 第七批已完成项

以下第七批工作已经完成首轮实现：

1. `dual-topology-host` 包骨架创建
2. `dual-topology-host` 重新定位为 Node/mock shell
3. `dual-topology-host` 依赖 `@impos2/kernel-base-host-runtime`
4. `dual-topology-host` 按新规范使用正式 `test/` 目录，并删除原 `dev` 入口
5. `dual-topology-host` 的包内 `type-check`、`test`、`test:scenario` 验证通过

### 5.7.1 `dual-topology-host` 当前边界

当前 `dual-topology-host` 只负责：

1. 创建 Node/mock 默认 `NodeRuntimeInfo`
2. 创建 mock-server scope logger
3. 装配并暴露 `host-runtime`
4. 提供 HTTP 管理接口：`health / stats / tickets / fault-rules`
5. 提供 WebSocket shell：`hello / heartbeat-ack / relay`
6. 负责把当前 host 输出消息路由到正确 socket
7. 已提供最小 resume 控制面协议：`resume-begin / request-lifecycle-snapshot / resume-complete`
8. 已把 `state-sync-summary / state-sync-diff / state-sync-commit-ack` 纳入 resume 控制流 relay

当前 `dual-topology-host` 明确不负责：

1. pairing/session/relay 注册表内部实现
2. request owner 聚合
3. business command handler 执行
4. request complete 判定
5. mergedResults 构造

### 5.7.2 `dual-topology-host` 当前已验证行为

当前已验证：

1. shell 能创建默认 Node host runtime info。
2. shell 暴露的 `hostRuntime` 与 `getHostRuntimeInfo()` 一致。
3. shell 通过 `host-runtime` 完成 ticket 发放与 master/slave hello 建链。
4. shell 可处理真实 HTTP 管理接口：`health / stats / tickets / fault-rules`。
5. shell 可处理真实 WebSocket `hello -> relay -> resume-begin -> resume-complete` 链路。
6. shell 已验证“离线期间 dispatch 不自动回放，resume 完成后才恢复交付”。
7. shell 的 `test` 与 `test:scenario` 都已切到真实网络入口，不再依赖纯消息级 mock。
8. shell 已验证“resume barrier 期间先交付 request lifecycle snapshot，再在 resume complete 后恢复 queued dispatch”。
9. shell 已验证“runtime-shell owner 导出的 snapshot 可经真实 WS resume 流程送达 peer，并在 peer runtime 恢复 request projection selector”。
10. shell 已验证“runtime-shell owner 导出的 remote command dispatch 可经真实 WS relay 到 peer runtime 执行，并将 remote command event 经真实 WS 回传 owner runtime”。
11. shell 已验证“owner runtime 应用 real WS 回传事件后，request projection 会收敛为 complete，且远端结果可回到 owner request 读模型”。
12. shell 已验证“resume barrier 期间 `state-sync-summary / state-sync-diff / state-sync-commit-ack` 可作为控制面消息先行交付”。
13. `topology-client-runtime` 已新增正式公开命令 `dispatchRemoteCommand`，返回语义不再等同 transport send，而是以远端 child command 到达 `started` barrier 为完成点。
14. `runtime-shell` / `topology-runtime` 已补齐 tracked request 枚举能力，`topology-client-runtime` 已可在 resume 时默认按当前 peer 自动导出相关 request lifecycle snapshot。
15. `dual-topology-host` 已补齐 `resume-begin` 的 peer relay，owner 侧与 peer 侧现在都可在真实 WS 链路中收到对端 resume 开始信号并回传 resume artifacts。
16. shell 已验证“无需 assembly 手工提供 requestId 列表，也能在真实双机链路上自动恢复当前 peer 相关 request projection”。
17. `topology-client-runtime` 已补齐正式公开上下文命令：`setInstanceMode / setDisplayMode / setEnableSlave / setMasterInfo / clearMasterInfo / refreshTopologyContext`。
18. `topology-client-runtime` 已补齐正式公开连接命令：`startTopologyConnection / stopTopologyConnection / restartTopologyConnection / resumeTopologySession`。
19. 上下文命令当前已明确只负责同步更新 `topology-runtime` recovery state 与 `topologyContext` read model，不隐式触发连接动作。
20. 连接命令当前已明确只负责连接编排，不顺手改业务上下文，边界与旧 `interconnection` 的大 actor 模式正式分开。
21. `topology-client-runtime` 已补充真实 `dual-topology-host` 场景测试，验证公开上下文命令与公开连接命令可在真实 WS 链路中工作。
22. `topology-client-runtime` orchestrator 已修正重复启动时的监听重复注册风险，连接监听注册现在为幂等行为。

---

## 6. 当前仓库状态说明

截至本文写入时，仓库存在以下状态：

### 6.1 已修改但未提交的文件

当前已存在修改：

1. `package.json`
2. `yarn.lock`
3. `.yarn/install-state.gz`
4. 若干 `refactor-doc/*.md`

### 6.2 新增但未提交的目录/文件

当前新增但未提交的内容主要包括：

1. `1-kernel/1.1-base/*`
2. 多份 `refactor-doc/2026-04-09-*.md`

说明：

1. 这些变更目前仍处于阶段性整理状态。
2. 还没有进入“实现完成并收口”的提交阶段。

### 6.3 当前验证说明

`runtime-shell` 阶段曾经出现过 workspace install-state assertion，但在本轮安装依赖并接入 `vitest` 后，当前新基础包已可通过包内验证。

已确认以下命令通过：

1. `corepack yarn workspace @impos2/kernel-base-contracts type-check`
2. `corepack yarn workspace @impos2/kernel-base-definition-registry type-check`
3. `corepack yarn workspace @impos2/kernel-base-platform-ports type-check`
4. `corepack yarn workspace @impos2/kernel-base-execution-runtime type-check`
5. `corepack yarn workspace @impos2/kernel-base-topology-runtime type-check`
6. `corepack yarn workspace @impos2/kernel-base-topology-runtime test`
7. `corepack yarn workspace @impos2/kernel-base-runtime-shell type-check`
8. `corepack yarn workspace @impos2/kernel-base-runtime-shell test`
9. `corepack yarn workspace @impos2/kernel-base-state-runtime type-check`
10. `corepack yarn workspace @impos2/kernel-base-state-runtime test`
11. `corepack yarn workspace @impos2/kernel-base-topology-client-runtime type-check`
12. `corepack yarn workspace @impos2/kernel-base-topology-client-runtime test`
13. `corepack yarn workspace @impos2/kernel-base-transport-runtime type-check`
14. `corepack yarn workspace @impos2/kernel-base-transport-runtime test`
15. `corepack yarn workspace @impos2/kernel-base-host-runtime type-check`
16. `corepack yarn workspace @impos2/kernel-base-host-runtime test`
17. `corepack yarn workspace @impos2/kernel-base-host-runtime test:scenario`
18. `corepack yarn workspace @impos2/dual-topology-host type-check`
19. `corepack yarn workspace @impos2/dual-topology-host test`
20. `corepack yarn workspace @impos2/dual-topology-host test:scenario`
21. `corepack yarn workspace @impos2/kernel-base-topology-client-runtime test -- --reporter=basic -t "automatically resumes owner tracked request snapshots for the current peer without manual request list"`
22. `corepack yarn workspace @impos2/kernel-base-topology-client-runtime test -- --reporter=basic -t "updates topology recovery state through public context commands"`
23. `corepack yarn workspace @impos2/kernel-base-topology-client-runtime test -- --reporter=basic -t "controls topology connection lifecycle through public commands"`

另外，`1-kernel/1.1-base/*` 下已确认不存在 `dev` 目录残留。

说明：

1. `state-runtime / topology-runtime / topology-client-runtime / runtime-shell / transport-runtime / host-runtime / dual-topology-host` 当前均已采用 `vitest run` 作为正式测试入口。
2. `contracts / definition-registry / platform-ports / execution-runtime` 仍可继续从 `test/index.ts` 迁移到 `test/scenarios/*.spec.ts`，但目录语义已经统一。

---

## 7. 下一步直接计划

`host-runtime` 与 `dual-topology-host` 已完成首轮最小闭环，`runtime-shell` 的 remote command round-trip 已完成本地双 runtime 与真实 WS 两层验证，`transport-runtime` 已完成 resume 控制流与 state sync 控制流的真实 socket 承载验证，`topology-client-runtime` 也已补齐公开 remote dispatch 与 owner-side auto resume 两条关键链路。下一步不再停留在 transport 测试层，而是开始真正的新 interconnection replacement shell 设计与实现。

### 7.1 第一步：开始新的 interconnection replacement shell 设计与首轮实现

优先实现：

1. 基于 `topology-runtime + transport-runtime + runtime-shell + dual-topology-host` 设计新的双机 interconnection shell。
2. 明确 shell 的边界：连接编排、hello/resume/state-sync/remote-command 协议接线、主副机状态观测。
3. 保持 `transport-runtime` 只负责连接和消息，不解释 owner truth。
4. 保持 `runtime-shell` 继续负责 snapshot 导出、snapshot 应用、remote event 应用。
5. 保持 `topology-runtime` 继续负责 state sync session、resume 对齐编排、continuous sync baseline 提交。

约束：

1. Node server shell 只能调用 `host-runtime`，不能复制控制面核心逻辑。
2. HTTP / WS 只属于 mock server shell，不下沉到 `1-kernel`。
3. host 不承载 request owner 聚合。
4. host 不承载业务命令完成判定。
5. host 不构造 mergedResults。

### 7.2 第二步：补新的 interconnection shell 与 runtime-shell 的真实联合验证

下一步需要建立跨包验证：

1. master shell 通过 transport 建链到 host。
2. slave shell 通过 transport 建链到 host。
3. master shell 负责触发 `summary -> diff -> apply -> commit-ack -> continuous sync`。
4. shell 与 runtime-shell 联合完成 remote dispatch / remote event / request projection mirror。
5. 在断线重连后，先走 resume barrier，再恢复 snapshot / state sync / dispatch / event 的实时流。
6. 在 shell 层把“收到对端 resume-begin 后回传本端 resume artifacts”的双向语义固化为正式约束，不再只依赖当前包内默认实现。

### 7.3 第三步：再决定是否需要 topology client / host client 专用包

当前 `topology-client-runtime` 已成为正式客户端侧编排层，因此这里的重点不再是“要不要有这个包”，而是“如何把公开命令与环境装配补齐到可替代旧 interconnection 的程度”。后续仍可继续评估是否需要更薄的 host-client helper，但不回退当前包边界。
下一步优先项改为：

1. 评估 state sync 的 slice 收集与 apply 落点，避免当前 `slices: []` 停留过久。
2. 把 `topology-client-runtime` 当前单一超大场景测试文件拆成按职责分工的多个 spec 文件，回到统一结构规范。
3. 在此基础上，再推进新的 interconnection replacement shell 与环境装配。

---

## 8. 一句话总结

到目前为止，这次重构已经完成了第一阶段最关键的前置工作：

1. 新架构边界已经定型。
2. 必须继承的老工程亮点已经系统化沉淀。
3. 隐式但有效的业务规则已经被显式化。
4. batch A 三个基础包、`execution-runtime`、`topology-runtime`、`runtime-shell`、`transport-runtime`、`host-runtime` 都已完成首轮真实实现并通过基础验证。
5. `dual-topology-host` 已成为明确依赖 `host-runtime` 的 Node/mock shell。
6. `1-kernel/1.1-base/*` 已统一使用 `test/`，原 `dev` 目录已删除。

下一步应停止继续扩张基础 runtime 文档范围，直接进入新的双机 interconnection shell 设计与实现，并让它正式替换旧 `interconnection` 的连接编排与状态同步职责。
