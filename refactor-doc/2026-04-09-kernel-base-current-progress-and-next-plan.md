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

第一阶段新基础架构不再沿用旧 `base / interconnection / communication` 三包边界，而是重构为以下 7 个基础包：

1. `1-kernel/1.1-base/contracts`
2. `1-kernel/1.1-base/definition-registry`
3. `1-kernel/1.1-base/platform-ports`
4. `1-kernel/1.1-base/execution-runtime`
5. `1-kernel/1.1-base/transport-runtime`
6. `1-kernel/1.1-base/topology-runtime`
7. `1-kernel/1.1-base/runtime-shell`

配套宿主包确定为：

1. `0-mock-server/dual-topology-host`

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
7. `dev/index.ts`
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

## 5. 当前尚未开始的代码工作

虽然设计和骨架已经推进到位，但以下工作目前还没有真正开始提交实现：

1. `contracts` 的真实类型与 helper 实现
2. `platform-ports` 的真实 port interface 与 logger contract 实现
3. `definition-registry` 的真实 registry contract 与 factory 实现
4. batch A 专项实施计划文档
5. batch A 的 `dev` 验证入口替换

也就是说，当前阶段仍然是：

1. 设计已定
2. 骨架已建
3. 代码实现尚未正式展开

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

---

## 7. 下一步直接计划

下一步不再扩散范围，直接进入 batch A 的第一轮真实实现。

### 7.1 第一步：补 batch A 实施计划文档

新增一份只面向 batch A 的实现计划文档，范围只覆盖：

1. `contracts`
2. `platform-ports`
3. `definition-registry`

这份计划文档要把已确认的设计结论拆成可执行任务，而不是继续写架构原则。

### 7.2 第二步：实现 `contracts`

优先完成：

1. 时间 contract
2. 运行时 ID contract
3. 错误 contract
4. 参数 contract
5. request / topology / projection 协议对象
6. `AppModule` 新契约
7. `protocolVersion` 对外导出整理

目标：

1. 让 `contracts` 成为后续所有新包的正式公共语言底座。

### 7.3 第三步：实现 `platform-ports`

优先完成：

1. `PlatformPorts`
2. `LoggerPort`
3. `LogEvent / LogLevel`
4. 脱敏策略相关 contract
5. storage / device / appControl / localWebServer 等基础 port interface
6. `createPlatformPorts(...)`

目标：

1. 用 runtime-scoped ports 替代旧全局 `registerXxx` 模式。

### 7.4 第四步：实现 `definition-registry`

优先完成：

1. error definition registry contract
2. parameter definition registry contract
3. 统一 registry factory
4. duplicate key 检测
5. query API

目标：

1. 先把定义型对象从执行型对象中拆干净。

### 7.5 第五步：做 batch A 验证

至少完成：

1. 三个包再次 `type-check`
2. `dev/index.ts` 替换为首轮验证入口
3. 检查对外导出是否完整
4. 检查 `1-kernel` 下没有 React 依赖

---

## 8. 一句话总结

到目前为止，这次重构已经完成了第一阶段最关键的前置工作：

1. 新架构边界已经定型。
2. 必须继承的老工程亮点已经系统化沉淀。
3. 隐式但有效的业务规则已经被显式化。
4. batch A 的三个新基础包骨架已经建好并接入 workspace。

下一步应停止继续扩张文档范围，直接进入 `contracts / platform-ports / definition-registry` 的第一轮真实代码实现。
