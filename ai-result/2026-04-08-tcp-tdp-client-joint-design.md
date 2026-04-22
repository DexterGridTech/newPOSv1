# TCP Client 与 TDP Client 联合构建设计

## 1. 文档目标

本文档用于重新设计以下三个位置的后续演进方向：

- `1-kernel/1.1-cores/communication`
- `1-kernel/1.1-cores/tcp-client`
- `1-kernel/1.1-cores/tdp-client`

设计前提基于以下现状已经重新核对：

- 老服务端：`0-mock-server/kernel-server`
- 老客户端：`1-kernel/1.1-cores/terminal`
- 新服务端：`0-mock-server/mock-terminal-platform`
- 参考迁移文档：`docs/tcp-tdp-client-design-claude`

本次设计结论不是继续扩展老 `terminal`，而是拆出两个新包：

- `tcp-client`：终端控制面客户端
- `tdp-client`：终端数据面客户端

同时，对 `communication` 进行一次有限增强，使其成为两个新包共同依赖的 HTTP/WS 通信基座。

## 2. 已核对的关键事实

### 2.1 新服务端 TCP 真实契约

来自 `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts` 与 `routes.ts` 的事实：

- 激活接口：`POST /api/v1/terminals/activate`
- 刷新 token 接口：`POST /api/v1/terminals/token/refresh`
- 回报任务结果接口：`POST /api/v1/terminals/:terminalId/tasks/:instanceId/result`
- 激活成功返回：
  - `terminalId`
  - `token`
  - `refreshToken`
  - `expiresIn`
- 终端激活后已具备基础主数据绑定：
  - `platformId`
  - `tenantId`
  - `brandId`
  - `projectId`
  - `storeId`
  - `profileId`
  - `templateId`

### 2.2 新服务端 TDP 真实契约

来自 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`、`wsServer.ts`、`service.ts` 的事实：

- TDP 主入口已是 WebSocket：
  - `/api/v1/tdp/ws/connect?terminalId={terminalId}&token={token}`
- TDP 仍保留 HTTP 补偿链路：
  - `GET /api/v1/tdp/terminals/:terminalId/snapshot`
  - `GET /api/v1/tdp/terminals/:terminalId/changes`
- 客户端消息：
  - `HANDSHAKE`
  - `PING`
  - `STATE_REPORT`
  - `ACK`
- 服务端消息：
  - `SESSION_READY`
  - `FULL_SNAPSHOT`
  - `CHANGESET`
  - `PROJECTION_CHANGED`
  - `PROJECTION_BATCH`
  - `COMMAND_DELIVERED`
  - `PONG`
  - `EDGE_DEGRADED`
  - `SESSION_REHOME_REQUIRED`
  - `ERROR`

### 2.3 TDP 当前已支持的关键行为

来自 `mock-terminal-platform/docs/README.md` 与开发/测试手册的事实：

- `HANDSHAKE -> SESSION_READY`
- `FULL_SNAPSHOT`
- `CHANGESET`
- `PING / PONG`
- Projection 写入后的实时推送
- `PROJECTION_BATCH` 批量推送
- 客户端 `ACK`
- Session 持久化 `lastDeliveredRevision / lastAckedRevision / lastAppliedRevision`
- `highWatermark / ackLag / applyLag`
- `EDGE_DEGRADED / SESSION_REHOME_REQUIRED`
- `remote.control / print.command` 的 command 专用通道

### 2.4 老客户端的问题不是“代码旧”，而是边界错误

来自 `1-kernel/1.1-cores/terminal` 的事实：

- 旧 `terminal` 把激活、token、连接、unitData、远程命令全混在一个包里
- 旧包依赖旧 `ApiManager`、旧 `Api`、旧 `kernel-ws`
- 旧包核心模型是 `Unit / unitData / rootPath`
- 这与新服务端的 TCP/TDP 显式职责边界不匹配

因此，新方案必须是重建边界，不是文件平移。

## 3. 总体设计结论

### 3.1 三个包的职责

本次设计采用三层拆分：

1. `communication`
   - 提供通用 HTTP/WS runtime 基座
   - 不感知 TCP/TDP 业务语义

2. `tcp-client`
   - 提供终端控制面客户端
   - 负责激活、凭证、终端基础上下文、任务结果回报

3. `tdp-client`
   - 提供终端数据面客户端
   - 负责 WebSocket 会话、投影同步、ACK、command 收件箱、rehome/degraded

### 3.2 推荐依赖方向

依赖方向固定为：

- `tcp-client` 依赖 `base`、`communication`
- `tdp-client` 依赖 `base`、`communication`、`tcp-client`

不采用两个包各自维护身份和 token 的方案。

### 3.3 状态真源

状态真源必须明确：

- `tcp-client` 是终端身份真源
  - `terminalId`
  - `accessToken`
  - `refreshToken`
  - `expiresAt`
  - 激活态
  - 终端基础绑定信息
- `tdp-client` 不复制这些核心字段
  - 通过 selector 读取 `tcp-client`
  - 只持有数据面运行态

这条边界不可破坏，否则后续必然出现 token 竞态和状态漂移。

## 4. communication 包的后续演进

### 4.1 设计原则

`communication` 需要继续增强，但增强边界必须受控：

- 可以增强“WS 怎么接、怎么发、怎么注册 service、怎么管理 runtime”
- 不能下沉“TDP 语义”

也就是说：

- `communication` 负责通用通信基建
- `tdp-client` 负责 TDP 协议适配

### 4.2 当前已具备能力

已存在：

- HTTP:
  - `defineHttpEndpoint`
  - `HttpClient`
  - `HttpRuntime`
  - `HttpServiceRegistry`
  - `defineHttpServiceModule`
- WS:
  - `defineSocketProfile`
  - `BaseSocketClient`
  - `SocketConnectionOrchestrator`
  - `buildSocketUrl`
  - metrics / trace / hooks 基础骨架

### 4.3 建议新增的 WS 基础设施

建议新增：

- `SocketRuntime`
  - 作用类似 `HttpRuntime`
  - 统一装配 `ServerResolver + SocketFactory + BaseSocketClient + Orchestrator`
- `SocketServiceRegistry`
  - 按模块注册/获取 WS service
- `defineSocketServiceModule`
  - 建立 service-first 的 WS 调用方式
- `JsonSocketCodec`
  - 统一默认 JSON 编解码与 parse error 包装
- `normalizeSocketError`
  - 将 WS 低层错误收敛到 `CommunicationError`
- `SocketSessionRegistry`
  - 在 runtime 级别管理 profile 实例与连接状态

### 4.4 明确不放进 communication 的内容

以下内容绝不能放进 `communication`：

- `HANDSHAKE / PING / ACK / STATE_REPORT`
- `SESSION_READY / FULL_SNAPSHOT / CHANGESET`
- `PROJECTION_CHANGED / PROJECTION_BATCH`
- `COMMAND_DELIVERED`
- `highWatermark / revision / cursor`
- `EDGE_DEGRADED / SESSION_REHOME_REQUIRED`
- projection merge
- command inbox

这些都属于 `tdp-client`。

## 5. tcp-client 包设计

### 5.1 包定位

`tcp-client` 定位为：

> 面向终端控制面的通用客户端核心包

它负责：

- 激活终端
- 管理终端身份
- 管理凭证
- 刷新 token
- 回报任务结果
- 提供终端基础上下文给其他包使用

### 5.2 包目录建议

```text
1-kernel/1.1-cores/tcp-client/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts
    ├── moduleName.ts
    ├── application/
    │   ├── modulePreSetup.ts
    │   ├── bootstrap.ts
    │   ├── wiring.ts
    │   └── index.ts
    ├── types/
    │   ├── foundations/
    │   ├── shared/
    │   ├── state/
    │   ├── moduleState.ts
    │   └── index.ts
    ├── supports/
    │   ├── apis/
    │   ├── errors/
    │   ├── parameters/
    │   └── index.ts
    ├── foundations/
    │   ├── adapters/
    │   ├── services/
    │   ├── repositories/
    │   ├── coordinators/
    │   └── index.ts
    ├── features/
    │   ├── slices/
    │   ├── commands/
    │   ├── actors/
    │   ├── middlewares/
    │   ├── epics/
    │   └── selectors/
    ├── hooks/
    └── selectors/
```

### 5.3 Slice 设计

建议保留 4 个 slice：

#### `tcpIdentity`

- `deviceFingerprint?: string`
- `deviceInfo?: Record<string, unknown>`
- `terminalId?: string`
- `activationStatus: 'UNACTIVATED' | 'ACTIVATING' | 'ACTIVATED' | 'FAILED'`
- `activatedAt?: number`

建议 `persistToStorage: true`

#### `tcpCredential`

- `accessToken?: string`
- `refreshToken?: string`
- `expiresAt?: number`
- `refreshExpiresAt?: number`
- `updatedAt?: number`
- `status: 'EMPTY' | 'READY' | 'REFRESHING' | 'EXPIRED'`

建议 `persistToStorage: true`

#### `tcpBinding`

v1 先保存基础绑定引用：

- `platformId?`
- `tenantId?`
- `brandId?`
- `projectId?`
- `storeId?`
- `profileId?`
- `templateId?`

建议 `persistToStorage: true`

#### `tcpRuntime`

- `bootstrapped: boolean`
- `lastActivationRequestId?: string`
- `lastRefreshRequestId?: string`
- `lastTaskReportRequestId?: string`
- `lastError?: IAppError | null`

建议 `persistToStorage: false`

### 5.4 Command 设计

#### 对外公开命令

- `bootstrapTcpClient`
- `activateTerminal`
- `refreshCredential`
- `reportTaskResult`
- `resetTcpClient`

#### 内部流转命令

- `bootstrapTcpClientSucceeded`
- `activateTerminalSucceeded`
- `credentialRefreshed`
- `credentialRefreshFailed`
- `taskResultReported`
- `taskResultReportFailed`
- `terminalIdentityHydrated`
- `terminalCredentialHydrated`

### 5.5 Actor 划分

建议拆为 3 个 Actor：

- `InitializeActor`
  - 触发 bootstrap
- `IdentityActor`
  - 激活
  - 恢复 identity/binding
- `CredentialActor`
  - 刷新 credential
  - 检查 token 有效期
- `TaskReportActor`
  - 回报任务结果

### 5.6 Foundations 设计

建议具备：

- `TcpHttpService`
  - activate / refresh / reportTaskResult
- `TcpCredentialRepository`
  - 持久化 token 与过期时间
- `TcpIdentityRepository`
  - 持久化终端身份与绑定上下文
- `TcpActivationCoordinator`
  - 组织激活流程
- `TcpCredentialCoordinator`
  - 组织 token 刷新流程

### 5.7 Error 设计

建议定义：

- `tcpActivationCodeInvalid`
- `tcpActivationFailed`
- `tcpCredentialMissing`
- `tcpCredentialExpired`
- `tcpRefreshTokenInvalid`
- `tcpRefreshFailed`
- `tcpTaskResultReportFailed`
- `tcpBootstrapHydrationFailed`
- `tcpRuntimeNotReady`

## 6. tdp-client 包设计

### 6.1 包定位

`tdp-client` 定位为：

> 面向终端数据面的通用客户端核心包

它负责：

- 建立 TDP WebSocket 会话
- 发送 handshake / ping / state_report / ack
- 接收 snapshot / changes / projection push / command push
- 管理 cursor 与 revision
- 管理 projection cache
- 管理 command inbox
- 处理 degraded / rehome
- 必要时执行 HTTP 补偿同步

### 6.2 包目录建议

```text
1-kernel/1.1-cores/tdp-client/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts
    ├── moduleName.ts
    ├── application/
    │   ├── modulePreSetup.ts
    │   ├── bootstrap.ts
    │   ├── wiring.ts
    │   └── index.ts
    ├── types/
    │   ├── foundations/
    │   ├── shared/
    │   ├── state/
    │   ├── moduleState.ts
    │   └── index.ts
    ├── supports/
    │   ├── apis/
    │   ├── profiles/
    │   ├── errors/
    │   ├── parameters/
    │   └── index.ts
    ├── foundations/
    │   ├── services/
    │   ├── repositories/
    │   ├── coordinators/
    │   ├── mappers/
    │   └── index.ts
    ├── features/
    │   ├── slices/
    │   ├── commands/
    │   ├── actors/
    │   ├── middlewares/
    │   ├── epics/
    │   └── selectors/
    ├── hooks/
    └── selectors/
```

### 6.3 Slice 设计

建议至少保留 5 个 slice：

#### `tdpSession`

- `status: 'IDLE' | 'CONNECTING' | 'HANDSHAKING' | 'READY' | 'DEGRADED' | 'REHOME_REQUIRED' | 'DISCONNECTED' | 'ERROR'`
- `sessionId?: string`
- `nodeId?: string`
- `nodeState?: 'healthy' | 'grace' | 'degraded'`
- `syncMode?: 'incremental' | 'full'`
- `highWatermark?: number`
- `lastCursor?: number`
- `connectedAt?: number`
- `lastPongAt?: number`
- `alternativeEndpoints: string[]`

建议 `persistToStorage: false`

#### `tdpSync`

- `snapshotStatus: 'idle' | 'loading' | 'ready' | 'error'`
- `changesStatus: 'idle' | 'catching-up' | 'ready' | 'error'`
- `lastDeliveredRevision?: number`
- `lastAckedRevision?: number`
- `lastAppliedRevision?: number`
- `ackLag?: number`
- `applyLag?: number`
- `lastRecoveredAt?: number`

建议不直接持久化，由 repository 保存恢复元数据。

#### `tdpProjection`

采用 normalized 结构：

- `byTopic: Record<string, Record<string, TdpProjectionItemState>>`
- `revisionIndex: Record<string, number>`

`TdpProjectionItemState`:

- `topic`
- `itemKey`
- `scopeType`
- `scopeId`
- `revision`
- `payload`
- `occurredAt`
- `sourceReleaseId?`

不要直接做 redux-persist。

#### `tdpCommandInbox`

- `itemsById: Record<string, TdpCommandInboxItem>`
- `orderedIds: string[]`
- `unackedIds: string[]`
- `consumedIds: string[]`

不要直接做 redux-persist。

#### `tdpControlSignals`

- `edgeDegraded?: { reason: string; issuedAt: number; gracePeriodSeconds: number; alternativeEndpoints: string[] }`
- `rehomeRequired?: { reason: string; deadline: number; alternativeEndpoints: string[] }`
- `lastProtocolError?: IAppError | null`

建议 `persistToStorage: false`

### 6.4 Command 设计

#### 对外公开命令

- `bootstrapTdpClient`
- `connectTdpSession`
- `disconnectTdpSession`
- `sendTdpStateReport`
- `ackProjection`
- `ackCommand`
- `recoverTdpGap`
- `clearConsumedCommand`
- `resetTdpClient`

#### 内部流转命令

- `tdpSessionReady`
- `tdpHandshakeRejected`
- `tdpPongReceived`
- `tdpProjectionBatchReceived`
- `tdpProjectionChangedReceived`
- `tdpCommandDeliveredReceived`
- `tdpEdgeDegradedReceived`
- `tdpSessionRehomeRequiredReceived`
- `tdpSocketDisconnected`
- `tdpRecoveryCompleted`
- `tdpRecoveryFailed`

### 6.5 Actor 划分

建议拆为 4 个 Actor：

- `TdpSessionActor`
  - connect / handshake / disconnect
- `TdpSyncActor`
  - snapshot / changes / projection merge / recover
- `TdpCommandActor`
  - command inbox / ack / clear consumed
- `TdpSignalActor`
  - degraded / rehome / protocol-level control messages

### 6.6 Foundations 设计

建议具备：

- `TdpSocketService`
  - 基于 `communication.SocketRuntime`
  - 封装 connect / send / disconnect / event subscription
- `TdpFallbackHttpService`
  - `getSnapshot`
  - `getChangesSince`
- `TdpProjectionRepository`
  - 保存 projection cache 与 cursor 恢复信息
- `TdpCommandInboxRepository`
  - 保存未消费 command
- `TdpSessionCoordinator`
  - 管理会话、握手、重连、rehome
- `TdpSyncCoordinator`
  - 管理全量/增量同步与补偿恢复
- `TdpAckCoordinator`
  - 管理 projection ack 与 command ack
- `TdpServerMessageMapper`
  - 将服务端 WS 消息映射为内部 command

### 6.7 Error 设计

建议定义：

- `tdpHandshakeRequired`
- `tdpHandshakeRejected`
- `tdpTerminalIdMismatch`
- `tdpSessionUnauthorized`
- `tdpSessionConnectFailed`
- `tdpHeartbeatTimeout`
- `tdpReconnectExceeded`
- `tdpCursorGapTooLarge`
- `tdpSnapshotFallbackFailed`
- `tdpAckFailed`
- `tdpCommandInboxCorrupted`
- `tdpUnsupportedServerMessage`
- `tdpSessionRehomeRequired`
- `tdpNodeDegraded`

## 7. 基础设施复用原则

两个新包都必须复用现有 `1-kernel` 的运行时约定：

- `AppModule`
- `createModuleCommands`
- `defineCommand`
- `Actor.defineCommandHandler`
- `DefinedErrorMessage`
- `AppError`
- `DefinedSystemParameter`

不另造新的 command bus、错误系统或状态注册系统。

## 8. 持久化策略

### 8.1 tcp-client

建议：

- `tcpIdentity`：持久化
- `tcpCredential`：持久化
- `tcpBinding`：持久化
- `tcpRuntime`：不持久化

### 8.2 tdp-client

建议：

- `tdpSession`：不持久化
- `tdpSync`：不直接持久化
- `tdpProjection`：不直接持久化
- `tdpCommandInbox`：不直接持久化
- `tdpControlSignals`：不持久化

真正需要跨重启恢复的数据通过 repository 解决：

- `lastCursor`
- `lastAckedRevision`
- `lastAppliedRevision`
- local projection cache
- 未消费 commands

## 9. 关键流程设计

### 9.1 冷启动

1. `base.initialize`
2. `tcp-client.bootstrapTcpClient`
3. 恢复 identity / credential / binding / device info
4. 如果 token 即将过期，刷新 token
5. 如果终端未激活，停在 TCP
6. 如果终端已激活，`tdp-client.bootstrapTdpClient`
7. 恢复 cursor / projection meta / unconsumed commands
8. 执行 `connectTdpSession`

### 9.2 激活

1. `activateTerminal`
2. 采集 `deviceFingerprint / deviceInfo`
3. 调 activate endpoint
4. 持久化 `terminalId / token / refreshToken / expiresAt`
5. 更新 `tcpIdentity / tcpCredential / tcpBinding`
6. 自动触发 `bootstrapTdpClient`

### 9.3 token 刷新

1. 判断 `expiresAt`
2. 调 refresh endpoint
3. 更新 credential
4. 后续 TDP 重连自动使用新 token

### 9.4 TDP 建连与握手

1. WS connect
2. 发送 `HANDSHAKE`
3. 等待 `SESSION_READY`
4. 根据 `syncMode`
   - `full` 等 `FULL_SNAPSHOT`
   - `incremental` 等 `CHANGESET`

### 9.5 全量/增量同步

#### FULL_SNAPSHOT

1. 写 projection repository
2. 重建 normalized cache
3. 更新 cursor 与 applied revision
4. 发送可选 `STATE_REPORT`

#### CHANGESET

1. 按 revision 合并
2. 更新 projection store
3. 更新 cursor
4. 必要时继续补偿恢复

### 9.6 实时推送

#### PROJECTION_CHANGED

1. message mapper -> 内部 command
2. 合并单条 projection
3. 更新 `lastDeliveredRevision`
4. 根据策略 ACK

#### PROJECTION_BATCH

1. mapper -> 批量 command
2. 合并 batch
3. 更新最大 delivered revision
4. 根据策略 ACK

### 9.7 command 通道

1. 收到 `COMMAND_DELIVERED`
2. 写入 inbox
3. 上层业务消费
4. `ackCommand`
5. 标记 consumed 或清理

### 9.8 degraded / rehome

#### EDGE_DEGRADED

1. 更新控制信号状态
2. 进入 `DEGRADED`
3. 保持连接
4. 缩短检查周期

#### SESSION_REHOME_REQUIRED

1. 更新控制信号状态
2. 进入 `REHOME_REQUIRED`
3. 主动断开
4. 使用 alternative endpoints 重连
5. 带上最新 cursor 恢复

### 9.9 断线与补偿恢复

1. 断线
2. 触发重连
3. 成功则增量恢复
4. 若 gap 过大，走 HTTP `changes`
5. 若仍无法恢复，走 HTTP `snapshot`
6. 恢复完成后回 steady state

## 10. communication、tcp-client、tdp-client 三者协作关系

### 10.1 communication

只负责：

- endpoint/profile 契约描述
- runtime 装配
- transport
- failover / retry / hooks / metrics
- service registry

### 10.2 tcp-client

只负责：

- 终端身份与控制面调用
- 凭证真源
- token 生命周期

### 10.3 tdp-client

只负责：

- 数据面协议适配
- projection / command 同步
- cursor / revision / ACK

### 10.4 强约束

- `tdp-client` 不得保存自己的 accessToken 真源
- `communication` 不得知道 TDP 业务字段
- `tcp-client` 不得承担 projection / command inbox 逻辑

## 11. 与老 terminal 包的关系

### 11.1 不迁移的内容

以下内容不进入新包核心模型：

- `Unit`
- `unitData`
- `rootPath`
- 旧 `kernel-ws`
- 旧 `Api / ApiManager`

### 11.2 可借鉴但不复用的内容

可以借鉴：

- 包结构风格
- `Command + Actor + Slice` 组织方式
- `persistToStorage` 的使用方式

不直接复用：

- 老协议对象
- 老状态模型
- 老连接客户端

## 12. 推荐实施顺序

### Phase 1

先增强 `communication`：

- `SocketRuntime`
- `SocketServiceRegistry`
- `defineSocketServiceModule`
- `JsonSocketCodec`
- `normalizeSocketError`

### Phase 2

实现 `tcp-client`：

- activate
- refresh token
- report task result
- identity / credential persistence

### Phase 3

实现 `tdp-client`：

- connect
- handshake
- snapshot / changes
- projection push
- command push
- ack
- rehome / degraded

### Phase 4

在 assembly 层逐步替换旧 `terminal`

## 13. v1 明确不做

- 不迁移 `unitData`
- 不兼容 `Unit` 树为权威模型
- 不做全局单调 revision 修复
- 不做完整 command catalog 平台
- 不让 `tdp-client` 直接执行具体业务命令
- 不让 `communication` 感知 TDP 协议语义

## 14. 风险与注意事项

### 14.1 最大风险

最大风险不是代码实现，而是边界再次回退：

- 把 token 又放进 `tdp-client`
- 把 handshake / ack 逻辑塞回 `communication`
- 把 projection cache 直接丢给 redux-persist
- 把 command 业务执行写进 `tdp-client`

这些都必须避免。

### 14.2 当前 mock 服务端仍有演进空间

虽然 TDP 主入口已经落地，但仍存在这些后续服务端演进点：

- 全局单调 revision 尚未完成
- command catalog / TTL / replay 治理未完整
- HTTP session 兼容接口仍在

因此客户端设计必须保留演进余地，不能把 mock 实现细节写死为永久协议。

## 15. 最终建议

本次联合设计的推荐落点为：

- `communication` 升级为真正的 HTTP/WS 通用 runtime 基座
- `tcp-client` 成为终端身份与控制面真源
- `tdp-client` 成为数据面协议适配与状态管理核心
- `tdp-client` 显式依赖 `tcp-client`
- 不再继续扩展老 `terminal`

这个方案最符合当前仓库已有的 `1-kernel` 运行机制，也最符合 `mock-terminal-platform` 已经演进出的真实 TCP/TDP 边界。
