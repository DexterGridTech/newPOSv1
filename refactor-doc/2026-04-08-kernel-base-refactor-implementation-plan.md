# 核心基础包重构第一阶段实施计划

## 1. 文档目标

本文档用于将第一阶段核心基础包重构设计拆解为可执行实施顺序。

本文档覆盖范围：

- `1-kernel/1.1-base`
- `0-mock-server/dual-topology-host`

本文档不直接开始迁移旧业务包，只定义第一阶段应该先搭哪些基础件、验证哪些语义、达到哪些验收门槛。

---

## 2. 总体实施原则

本实施计划除本章约束外，还必须同时遵守：

- [refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md)
- [refactor-doc/2026-04-09-kernel-base-time-and-runtime-id-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-base-time-and-runtime-id-design.md)

后续每个 step 不仅要解决旧问题，还必须显式回答：

1. 继承了旧架构的哪条核心亮点。
2. 如何把该亮点升级成更显式、更清晰的新协议。

### 2.1 先搭骨架，再接行为

第一阶段先建立：

- 包骨架
- 协议对象
- runtime 入口
- host 入口

再逐步接入：

- request ledger
- projection
- transport
- topology host

不允许先把业务命令硬搬过去，再反向补基础设施。

### 2.2 先建立真相源，再建立 projection

request 相关实施顺序必须是：

1. owner-ledger
2. command lifecycle 事件
3. projection builder
4. projection slice / selector
5. projection mirror

不能反过来。

### 2.3 先控制面，再通用同步

第一阶段只建设 request/control-plane 所需同步与镜像，不扩展通用状态同步方案。

### 2.4 每一步都必须可验证

每个阶段都必须具备：

- `dev`
- 类型检查
- 明确验收点

涉及主副机的步骤必须具备真实链路验证。

### 2.5 每一步都必须回答“继承了什么”

每个 step 在设计和落地时，都必须同时回答：

1. 这一 step 继承了旧架构的什么核心工程价值。
2. 这一 step 如何避免把该价值和旧实现方式一起推翻。

例如：

1. `contracts` 要继承旧统一上下文语言与模块契约。
2. `execution-runtime` 要继承旧 command 驱动思想。
3. `topology-runtime` 要继承旧 POS 多屏拓扑语言与跨端 request 观测价值。
4. `runtime-shell` 要继承旧统一 runtime 总装配价值。

### 2.6 不允许用“边界清晰”换掉“低接入成本”

后续每个 step 都必须注意：

1. 新架构可以更显式。
2. 但不能把过去由基础设施统一承担的主副协同工作重新甩回业务包。

因此每个新包都必须兼顾：

1. 清晰边界
2. 统一入口
3. 对下游足够低的接入成本

### 2.7 时间与 ID 必须先统一

第一阶段不能把时间与运行时 ID 留到后面再补。

必须从第一步就定死：

1. 存储中的时间字段统一为毫秒时间戳数字。
2. 时间格式化只属于展示与日志渲染层。
3. `1-kernel / 2-ui / 3-adapter / 4-assembly` 统一走同一套 runtime ID helper。
4. `0-mock-server` 不接入这套 helper，只要求协议兼容。

---

## 3. 第一阶段总体顺序

第一阶段建议拆为 8 个 step：

1. 建立 `contracts`
2. 建立 `platform-ports`
3. 建立 `definition-registry`
4. 建立 `execution-runtime`
5. 建立 `topology-runtime`
6. 建立 `runtime-shell`
7. 建立 `transport-runtime`
8. 建立 `dual-topology-host`

顺序说明：

- `transport-runtime` 虽然是基础包，但本阶段 request/control-plane 先由协议对象和 topology 设计驱动。
- 先定义 topology 所需最小 transport 抽象，再补通用 HTTP/WS runtime，更容易避免把 topology 语义混进 transport。

补充说明：

这个顺序同时服务于两件事：

1. 先把旧架构真正正确的统一语言与统一 runtime 思想保留下来。
2. 再把旧架构中最容易混层的 transport / topology / request 语义拆清楚。

---

## 4. Step 1：建立 `contracts`

### 4.1 目标

建立整个新基础架构的最底层公共语言。

### 4.2 输出

- 包目录骨架
- `src/moduleName.ts`
- `package.json`
- `src/generated/packageVersion.ts`
- `src/index.ts`
- `TimestampMs` 与时间 helper
- 运行时 ID 类型与生成 helper
- request / topology / compatibility 协议对象
- `AppModule` 新契约
- `protocolVersion` 常量

### 4.3 必须完成的对象

- `RequestId`
- `CommandId`
- `SessionId`
- `NodeId`
- `TimestampMs`
- `nowTimestampMs`
- `formatTimestampMs`
- `createRuntimeId`
- `ErrorDefinition`
- `AppError`
- `ErrorCatalogEntry`
- `ParameterDefinition`
- `ParameterCatalogEntry`
- `NodeRuntimeInfo`
- `PairingTicket`
- `NodeHello`
- `NodeHelloAck`
- `CompatibilityDecision`
- `CommandDispatchEnvelope`
- `CommandEventEnvelope`
- `RequestProjection`
- `ProjectionMirrorEnvelope`

### 4.4 验收

- 可以独立 type-check
- `src/index.ts` 对外导出完整
- 包版本接入 `packageVersion`
- 不依赖 React
- 不依赖其他新基础包
- 必须显式承接旧架构的统一上下文语言与模块契约价值
- 必须显式定义时间统一为毫秒时间戳数字
- 必须显式定义产品 runtime 四层统一 ID helper
- 必须显式标记该统一 ID 方案不外溢到 `0-mock-server`

---

## 5. Step 2：建立 `platform-ports`

### 5.1 目标

统一平台能力接口，替代旧 `base` 中散落的 adapter/global access 方式。

### 5.2 输出

- `src/moduleName.ts`
- `PlatformPorts`
- logger / storage / device / appControl / localWebServer / connector 等 port interface
- `LogEvent` / `LogLevel` / `LoggerPort`
- `DEV raw / PROD masked` 脱敏规则
- 场景化 logger helper 设计
- `createPlatformPorts(...)`

补充要求：

- `LogEvent.timestamp` 统一使用毫秒时间戳数字
- port context 中的 `requestId / commandId / sessionId / nodeId` 使用显式语义字段

### 5.3 验收

- 可以独立 type-check
- 只依赖 `contracts`
- 不引入运行时真相源
- 不出现全局单例
- 必须把旧 adapter 注入方向升级成 runtime-scoped ports，而不是全局注册槽位
- 必须把 logger 从“文本打印抽象”升级成“结构化日志事件接口”

---

## 6. Step 3：建立 `definition-registry`

### 6.1 目标

把定义型对象从执行型对象中彻底拆开。

### 6.2 输出

- `src/moduleName.ts`
- registry factory
- error / parameter / task / screen descriptor 注册器
- errorDefinition registry
- parameterDefinition registry
- 查询 API

补充要求：

- registry 相关目录对象中的 `updatedAt` 一律使用毫秒时间戳数字

### 6.3 验收

- 可注册与查询
- 不包含执行逻辑
- 不依赖 transport / topology
- 必须继承旧统一注册中心的工程价值，但不再重回大一统 `base`
- 错误定义注册与运行时错误目录必须语义分离
- 参数定义注册与运行时参数目录必须语义分离

---

## 7. Step 4：建立 `execution-runtime`

### 7.1 目标

建立单机命令执行内核，替代旧 `ActorSystem + listener + executeFromParent` 的隐式组合。

### 7.2 输出

- `createExecutionRuntime(...)`
- `ExecutionRuntime`
- `ExecutionContext`
- `ExecutionMiddleware`
- `ExecutionJournal`
- child dispatch API

### 7.3 本阶段只做什么

- 本机 command 注册与执行
- 本机 lifecycle event 发射
- 本机同步登记
- 本机错误归一化

### 7.4 本阶段不做什么

- owner-ledger
- remote dispatch
- projection mirror

### 7.5 关键验收

- command 在 handler 前同步登记
- child command 不再走裸 `executeFromParent`
- runtime 不依赖全局 manager
- 可用 dev 用例验证同步/异步边界
- 必须显式继承旧 command 驱动体系，而不是退回 service 直连

---

## 8. Step 5：建立 `topology-runtime`

### 8.1 目标

建立主副机控制面与 owner-ledger。

### 8.2 输出

- `createTopologyRuntime(...)`
- `TopologyRuntime`
- `OwnerLedger`
- `RoutePlanner`
- `CompatibilityEvaluator`
- `ProjectionBuilder`
- `ProjectionMirrorManager`

### 8.3 本阶段先做什么

- pairing 概念
- owner-ledger
- remote dispatch / remote event 接口
- request projection 构建
- compatibility decision

### 8.4 后置能力

- projection mirror 能力可在此 step 后半段或 Step 8 联动补齐

### 8.5 关键验收

- child node 先登记再派发
- request complete 由 owner-ledger 判定
- `resultsByCommand + mergedResults` 投影可用
- `CompatibilityDecision` 可正常产出
- 必须显式继承旧 POS 多屏拓扑语言与跨端 request 观测能力

---

## 9. Step 6：建立 `runtime-shell`

### 9.1 目标

形成唯一总装配入口。

### 9.2 输出

- `createKernelRuntime(...)`
- `KernelRuntime`
- runtime 对外 `execute(...)`
- request projection selector
- runtime projection state

### 9.3 state 分类

runtime-shell 只管理三类 state：

1. persistent truth state
2. runtime projection state
3. local shell state

request 相关统一进入：

- runtime projection state

### 9.4 关键验收

- `runtime-shell` 成为唯一装配入口
- 不再存在多个全局 manager 并列
- request projection 可通过 selector 读取
- `1-kernel` 中 `hooks/index.ts` 只保留规则说明
- 必须继续保留旧统一 runtime 装配价值，而不是把装配责任散回下游

---

## 10. Step 7：建立 `transport-runtime`

### 10.1 目标

把旧 `communication` 的通用 HTTP/WS 通信能力沉淀为新 transport 基座。

### 10.2 输出

- `HttpRuntime`
- `SocketRuntime`
- endpoint/profile 定义
- transport adapter
- metrics / retry / failover 基础能力

### 10.3 本阶段边界

必须明确：

- transport-runtime 不承载 owner-ledger
- transport-runtime 不解释 request 完成语义
- transport-runtime 只承载通道和会话

### 10.4 关键验收

- topology-runtime 可依赖 transport 抽象，不依赖旧 `communication`
- `tcp-client` / `tdp-client` 后续可迁移到此基座
- 与旧 `ApiManager` 清晰切断
- 必须继承旧 HTTP/WS 基础设施价值，但不再混入 topology 和 request 完成语义

---

## 11. Step 8：建立 `dual-topology-host`

### 11.1 目标

建立新的双机宿主开发承载实现。

### 11.2 输出

- `0-mock-server/dual-topology-host`
- ticket / hello / ack 流程
- session 管理
- dispatch / event / projection mirror relay
- stats / observation
- fault injection

### 11.3 与产品实现关系

本包是：

- 开发与联调承载实现

后续产品形态下沉到：

- `3-adapter/android/adapterPure`

### 11.4 关键验收

- 可以建立 master/slave session
- 可以完成 dispatch / event 往返
- 可以完成 compatibility decision
- 可以模拟延迟、断连、丢包
- 必须继承旧 pair host 模型，但 host 不承担 request 真相判定

---

## 12. 第一阶段验收门槛

第一阶段全部完成后，必须满足以下门槛：

1. 新 7 个包与 `dual-topology-host` 均创建完成并能 type-check。
2. request 控制面不再依赖跨机 slice 同步。
3. request projection 可通过 runtime-shell selector 读取。
4. `protocolVersion`、`runtimeVersion`、`assemblyVersion` 在握手模型中位置清晰。
5. `runtime-shell` 成为唯一总装配入口。
6. `transport-runtime` 与 `topology-runtime` 边界清晰。
7. 新架构明确继承了旧统一 runtime、command 主语、POS 多屏拓扑语言、跨端 request 观测这四项核心价值。
8. 下游业务包未来接入新架构时，不需要重新承担主副机基础设施细节。
9. 所有时间相关存储字段均以毫秒时间戳数字表达。
10. 产品 runtime 四层已明确统一运行时 ID 生成规则，且作用域不外溢到 `0-mock-server`。

---

## 13. 第一阶段不做的事

为了防止范围失控，第一阶段明确不做：

1. 旧业务模块迁移
2. `ui-runtime` 迁移
3. `tcp-client` / `tdp-client` 迁移
4. 通用业务状态同步新方案
5. 历史兼容层包装
6. Android 产品内置宿主正式实现

这些都属于后续阶段。

---

## 14. 推荐实施批次

建议按以下批次推进，每批完成后都由用户确认。

### 批次 A：协议与契约层

- `contracts`
- `platform-ports`
- `definition-registry`

### 批次 B：单机执行层

- `execution-runtime`

### 批次 C：双机控制面

- `topology-runtime`
- `dual-topology-host`

### 批次 D：总装配与读模型

- `runtime-shell`

### 批次 E：通用 transport 基座

- `transport-runtime`

这样安排的原因：

- 先把 request 真相源和 runtime 模型定住
- 再把 transport 基座对齐新控制面
- 避免先做 transport，后面再返工 request 语义

每个批次完成后都应补一次“继承检查”：

1. 是否保留了旧架构最强的工程价值。
2. 是否只是替换了旧名字，却没有真正升级协议与边界。

---

## 15. 当前建议的下一步

在第一阶段实施中，下一步建议立即进入：

- 批次 A：创建 `contracts / platform-ports / definition-registry`

原因：

1. 这是所有后续包的共同依赖。
2. 这一步不会触碰历史业务迁移。
3. 可以最快形成新的公共语言和公共结构。

---

## 16. 结论

第一阶段不是一次性大迁移，而是重建新的基础架构地基。

推荐路径是：

1. 先建契约层
2. 再建单机执行层
3. 再建双机控制面与宿主
4. 再建总装配入口
5. 最后补通用 transport 基座

只有这样，后续其他 kernel 包迁移时，才不会把旧问题重新带回新架构。
