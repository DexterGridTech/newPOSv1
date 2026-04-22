# TCP Client 与 TDP Client 联合实施计划

## 1. 计划目标

基于已确认的联合设计文档：

- `ai-result/2026-04-08-tcp-tdp-client-joint-design.md`

本计划用于指导以下三个位置的实施：

- `1-kernel/1.1-cores/communication`
- `1-kernel/1.1-cores/tcp-client`
- `1-kernel/1.1-cores/tdp-client`

计划原则：

- 先补通信基座，再建控制面，再建数据面
- 每一阶段都必须有可验证产出
- 不在一个阶段内同时改动过多边界
- 不反向污染老 `terminal`

## 2. 实施总顺序

按以下顺序推进：

1. Phase 1：增强 `communication` 的 WS runtime
2. Phase 2：创建 `tcp-client`
3. Phase 3：创建 `tdp-client`
4. Phase 4：在 assembly 层试接入并验证替换路径

不建议跳过 Phase 1 直接实现 `tdp-client`，否则 `tdp-client` 会被迫自己补一套半成品 runtime。

## 3. Phase 1：communication WS runtime 增强

### 3.1 目标

让 `communication` 的 WS 能力达到和 HTTP 类似的可接入水平：

- 有 runtime
- 有 registry
- 有 service-first 门面
- 有统一 codec
- 有统一错误归一化

但仍然保持通用，不感知 TDP 协议。

### 3.2 任务拆分

#### Task 1.1 新增 WS runtime 类型

新增或扩展：

- `src/types/foundations/ws.ts`

需要增加：

- `SocketCodec<TIncoming, TOutgoing>`
- `SocketRuntimeConfig`
- `SocketManagedConnection`
- `SocketServiceModuleDefinition<TServices>`
- `SocketReconnectPolicy`
- `SocketBootstrapFailurePolicy`

验收：

- 类型文件能独立表达 runtime/service/codec 配置
- 不引入 TDP 专属字段

#### Task 1.2 实现 `SocketRuntime`

新增：

- `src/foundations/ws/SocketRuntime.ts`

职责：

- 管理 `ServerResolver`
- 管理底层 socket client
- 管理 orchestrator
- 维护 profileName -> managed connection 映射
- 暴露统一调用入口

建议接口：

- `registerProfile(...)`
- `connect(profileName, input)`
- `disconnect(profileName, reason?)`
- `send(profileName, message)`
- `on(profileName, eventType, listener)`
- `off(profileName, eventType, listener)`
- `getConnectionState(profileName)`

验收：

- 能替代手工 new `BaseSocketClient + Orchestrator`
- 一个 runtime 可管理多个 profile

#### Task 1.3 实现 `SocketServiceRegistry`

新增：

- `src/foundations/ws/SocketServiceRegistry.ts`

职责：

- `registerModule(moduleName, services)`
- `getModule(moduleName)`
- `hasModule(moduleName)`
- `clear()`

验收：

- 用法与 HTTP registry 风格一致

#### Task 1.4 实现 `defineSocketServiceModule`

新增：

- `src/foundations/ws/defineSocketServiceModule.ts`

职责：

- 提供强类型 service-first 模块定义

验收：

- 与 `defineHttpServiceModule` 风格一致

#### Task 1.5 实现 `JsonSocketCodec`

新增：

- `src/foundations/ws/JsonSocketCodec.ts`

职责：

- 默认 `serialize`
- 默认 `deserialize`
- parse error 包装

验收：

- 上层不需要重复 `JSON.stringify / JSON.parse`

#### Task 1.6 实现 `normalizeSocketError`

新增：

- `src/foundations/ws/normalizeSocketError.ts`

职责：

- close / parse / bootstrap / hook / runtime error 统一收敛为 `CommunicationError`

验收：

- 上层拿到稳定错误模型

#### Task 1.7 补 dev 示例与测试

新增或扩展 `dev/`：

- `socket-runtime-demo.ts`
- `test-ws-service-registry.ts`
- `test-ws-runtime.ts`
- `test-ws-session-orchestrator.ts`

验收：

- service-first 使用方式可运行
- reconnect / refresh policy 不回退
- metrics / hooks 仍可用

### 3.3 Phase 1 完成标准

必须满足：

- `communication` 可独立提供 WS runtime 基座
- 新增能力不引入 TDP 语义
- dev demo 能证明接入方式明显比当前底层写法更顺手

## 4. Phase 2：创建 tcp-client

### 4.1 目标

先建立终端身份与控制面真源，让后续 `tdp-client` 有稳定依赖。

### 4.2 任务拆分

#### Task 2.1 创建包骨架

创建：

- `1-kernel/1.1-cores/tcp-client/package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/moduleName.ts`
- 标准目录树

验收：

- 能按 `AppModule` 方式被工程识别

#### Task 2.2 定义 types 与 state

新增：

- `types/shared/*`
- `types/state/*`
- `types/moduleState.ts`

需要表达：

- identity
- credential
- binding
- runtime

验收：

- 类型不依赖旧 `terminal` 的 `Unit` 体系

#### Task 2.3 定义 HTTP endpoints 与 service

新增：

- `supports/apis/*`
- `foundations/services/TcpHttpService.ts`

接入：

- activate
- refresh token
- report task result

验收：

- 完整基于 `communication` 的 `HttpRuntime`
- 不使用旧 `ApiManager`

#### Task 2.4 定义 repositories

新增：

- `TcpCredentialRepository`
- `TcpIdentityRepository`

职责：

- 保存 identity
- 保存 binding
- 保存 credential

验收：

- 冷启动能恢复 identity / credential

#### Task 2.5 定义 commands / errors / parameters

新增：

- `features/commands/index.ts`
- `supports/errors/index.ts`
- `supports/parameters/index.ts`

验收：

- 命令、错误、参数命名全部收敛到控制面边界

#### Task 2.6 实现 actors 与 slices

新增：

- `IdentityActor`
- `CredentialActor`
- `TaskReportActor`

新增 slices：

- `tcpIdentity`
- `tcpCredential`
- `tcpBinding`
- `tcpRuntime`

验收：

- 能完成激活、刷新、任务结果回报的状态推进

#### Task 2.7 实现 bootstrap 与 modulePreSetup

新增：

- `application/modulePreSetup.ts`
- `application/bootstrap.ts`
- `application/wiring.ts`

职责：

- 注册 http service module
- 初始化 runtime
- 执行冷启动恢复

验收：

- 已激活终端重启后可恢复 identity / credential

#### Task 2.8 补 hooks 与 selectors

新增：

- `useTcpIdentity`
- `useTcpCredentialStatus`
- `useTcpBinding`

验收：

- 上层可以只通过 hooks/selectors 使用控制面状态

### 4.3 Phase 2 完成标准

必须满足：

- 能独立跑通 activate
- 能独立跑通 refresh token
- 能独立跑通 report task result
- identity / credential / binding 有稳定真源

## 5. Phase 3：创建 tdp-client

### 5.1 目标

在不重复管理 token 的前提下，实现完整 TDP 会话与同步能力。

### 5.2 任务拆分

#### Task 3.1 创建包骨架

创建：

- `1-kernel/1.1-cores/tdp-client/package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/moduleName.ts`
- 标准目录树

验收：

- 模块依赖中显式依赖 `tcp-client`

#### Task 3.2 定义 TDP 协议类型

新增：

- `types/shared/protocol.ts`
- `types/shared/projection.ts`
- `types/shared/commandInbox.ts`
- `types/state/*`

需要表达：

- client messages
- server messages
- projection item
- command inbox item
- control signal state

验收：

- 类型与 `mock-terminal-platform` 当前真实协议一致

#### Task 3.3 定义 socket profile 与 fallback apis

新增：

- `supports/profiles/tdpSocketProfile.ts`
- `supports/apis/tdpFallbackApis.ts`

接入：

- `/api/v1/tdp/ws/connect`
- `/api/v1/tdp/terminals/:terminalId/snapshot`
- `/api/v1/tdp/terminals/:terminalId/changes`

验收：

- socket profile 不直接埋业务逻辑
- fallback endpoint 可独立调用

#### Task 3.4 实现 foundations

新增：

- `TdpSocketService`
- `TdpFallbackHttpService`
- `TdpProjectionRepository`
- `TdpCommandInboxRepository`
- `TdpSessionCoordinator`
- `TdpSyncCoordinator`
- `TdpAckCoordinator`
- `TdpServerMessageMapper`

验收：

- 会话、恢复、ACK、inbox 职责边界清晰

#### Task 3.5 定义 commands / errors / parameters

新增：

- `features/commands/index.ts`
- `supports/errors/index.ts`
- `supports/parameters/index.ts`

验收：

- 命令覆盖 connect / ack / recover / reset
- 错误覆盖 handshake / auth / reconnect / fallback / inbox

#### Task 3.6 实现 slices

新增：

- `tdpSession`
- `tdpSync`
- `tdpProjection`
- `tdpCommandInbox`
- `tdpControlSignals`

验收：

- projection 与 command inbox 不直接使用 redux-persist

#### Task 3.7 实现 actors

新增：

- `TdpSessionActor`
- `TdpSyncActor`
- `TdpCommandActor`
- `TdpSignalActor`

验收：

- 所有 WS 服务端消息都先转成内部 command 再进 actor

#### Task 3.8 实现 bootstrap 与恢复

新增：

- `application/modulePreSetup.ts`
- `application/bootstrap.ts`
- `application/wiring.ts`

职责：

- 基于 `tcp-client` 读取 `terminalId / accessToken`
- 恢复 cursor / local projection meta / unconsumed commands
- 建立会话并完成初始同步

验收：

- 已激活终端冷启动可恢复到上次 cursor 附近

#### Task 3.9 补 hooks 与 selectors

新增：

- `useTdpSessionStatus`
- `useTdpProjection`
- `useTdpCommandInbox`
- `useTdpControlSignals`

验收：

- 上层不需要直接感知 repository 或底层 socket

#### Task 3.10 补 dev 示例与测试

新增或扩展：

- handshake demo
- full snapshot demo
- incremental changes demo
- projection batch demo
- command delivered + ack demo
- degraded / rehome demo

验收：

- 能完整对接 `mock-terminal-platform`

### 5.3 Phase 3 完成标准

必须满足：

- 能跑通 WebSocket 建连
- 能发送 handshake / ping / state_report / ack
- 能处理 snapshot / changes / projection push / command push
- 能处理 degraded / rehome
- 能通过 HTTP 补偿恢复 gap

## 6. Phase 4：assembly 接入与验证

### 6.1 目标

验证新包在真实装配层中可运行，而不是只停留在 isolated dev demo。

### 6.2 任务拆分

#### Task 4.1 选择最小试点 assembly

建议优先找一个最简单的 assembly 进行接入验证，不要直接替换所有项目。

验收：

- 试点范围可控

#### Task 4.2 接入模块依赖

在试点 assembly 中注册：

- `kernelCoreTcpClientModule`
- `kernelCoreTdpClientModule`

验收：

- `ApplicationManager` 能正常解析依赖并完成 `modulePreSetup`

#### Task 4.3 接入启动流程

应用启动时：

- 先执行 `bootstrapTcpClient`
- 再在满足激活态时执行 `bootstrapTdpClient`

验收：

- 冷启动链路正确

#### Task 4.4 页面与日志验证

验证：

- 激活
- token refresh
- tdp session ready
- projection push
- command ack
- rehome / degraded

验收：

- 与 `mock-terminal-platform` 后台可观测结果一致

### 6.3 Phase 4 完成标准

必须满足：

- 新包可在 assembly 中真实运行
- 与 `mock-terminal-platform` 的后台数据和日志能对上

## 7. 每阶段验收清单

### Phase 1

- `communication` 有可用的 `SocketRuntime`
- WS service-first 用法成立
- 不引入 TDP 语义

### Phase 2

- `tcp-client` 可独立激活终端
- `tcp-client` 可独立刷新 token
- `tcp-client` 可回报任务结果

### Phase 3

- `tdp-client` 可独立建立会话并完成同步
- `tdp-client` 可处理 projection 与 command 两条通道
- `tdp-client` 可处理 degraded / rehome

### Phase 4

- 试点 assembly 成功接入
- 新旧包未发生边界污染

## 8. 风险控制

### 8.1 最大设计风险

- 把 token 真源做成双份
- 把 TDP 协议下沉到 `communication`
- 把 projection cache 直接用 redux-persist 持久化
- 把 command 执行逻辑塞进 `tdp-client`

### 8.2 最大实施风险

- Phase 1 不充分，导致 `tdp-client` 重新手写 runtime
- 一开始就尝试 assembly 全量替换，导致问题定位困难
- 把 dev demo 当成真实接入验证，遗漏装配层问题

## 9. 推荐执行方式

建议执行节奏：

1. 先单独完成 Phase 1 并通过 dev demo。
2. 再单独完成 Phase 2，并用 `mock-terminal-platform` 验证激活与 token。
3. 再完成 Phase 3，跑通 TDP 全链路。
4. 最后进入试点 assembly。

不要并行开发三个阶段。

## 10. 最终建议

最稳妥的推进方式是：

- 先把 `communication` 补到可承接 WS 业务包
- 再把 `tcp-client` 做成身份与凭证真源
- 最后让 `tdp-client` 基于它完成协议与同步能力

这是当前仓库里最能控制风险、最符合现有 `1-kernel` 机制、也最贴近 `mock-terminal-platform` 真实演进状态的实施顺序。
