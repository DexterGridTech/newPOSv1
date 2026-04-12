# tcp-control-runtime 与 tdp-sync-runtime 设计

## 1. 文档目标

本文档用于收敛旧：

- `1-kernel/1.1-cores/tcp-client`
- `1-kernel/1.1-cores/tdp-client`

在新架构下的目标落点、包边界、公开协议、状态设计与验证方式。

本设计明确采用两包方案，不再额外拆第 3 个共享包。

---

## 2. 目标包

本阶段目标包为：

1. `1-kernel/1.1-base/tcp-control-runtime`
2. `1-kernel/1.1-base/tdp-sync-runtime`

说明：

1. `tcp-control-runtime` 对应旧 `tcp-client`。
2. `tdp-sync-runtime` 对应旧 `tdp-client`。
3. `tdp-sync-runtime` 单向依赖 `tcp-control-runtime`。
4. 不再新增单独的 “terminal identity/auth” 第三包，避免过度设计。

---

## 3. 总体边界

### 3.1 `tcp-control-runtime`

只负责 TCP 控制面：

1. 设备前置信息采集。
2. 终端激活。
3. access token / refresh token 刷新。
4. 任务结果回报。
5. 本地控制面身份、凭证、binding 的持久化真相源。

不负责：

1. WebSocket。
2. projection。
3. command inbox。
4. cursor 恢复。
5. 数据面同步。

### 3.2 `tdp-sync-runtime`

只负责 TDP 数据面：

1. 用 `terminalId + accessToken` 建立会话。
2. handshake / snapshot / changes / projection push / command delivered。
3. ping / pong。
4. ack / state report。
5. reconnect / resume。
6. 最小恢复集持久化。

不负责：

1. 终端激活。
2. token 真相源。
3. 业务对象持久化。
4. durable command replay。

---

## 4. `tcp-control-runtime` 设计

### 4.1 状态设计

保留 4 个 slice，语义直接继承旧包：

1. `tcpIdentity`
2. `tcpCredential`
3. `tcpBinding`
4. `tcpRuntime`

其中：

1. `tcpIdentity` 持久化。
2. `tcpCredential` 持久化。
3. `tcpBinding` 持久化。
4. `tcpRuntime` runtime-only。

### 4.2 `tcpIdentity`

保留字段方向：

1. `deviceFingerprint`
2. `deviceInfo`
3. `terminalId`
4. `activationStatus`
5. `activatedAt`

其中：

1. `deviceFingerprint / deviceInfo` 是激活前置条件。
2. `terminalId` 是 TDP 侧的身份来源。

### 4.3 `tcpCredential`

保留字段方向：

1. `accessToken`
2. `refreshToken`
3. `expiresAt`
4. `refreshExpiresAt`
5. `status`
6. `updatedAt`

它是控制面 credential 的唯一真相源。

### 4.4 `tcpBinding`

保留字段方向：

1. `platformId`
2. `tenantId`
3. `brandId`
4. `projectId`
5. `storeId`
6. `profileId`
7. `templateId`

### 4.5 `tcpRuntime`

只保留运行态观测字段：

1. `bootstrapped`
2. `lastActivationRequestId`
3. `lastRefreshRequestId`
4. `lastTaskReportRequestId`
5. `lastError`

这些字段不做跨重启恢复。

### 4.6 commands

对外公开 command：

1. `activateTerminal`
2. `refreshCredential`
3. `reportTaskResult`
4. `resetTcpControl`

内部 command：

1. `bootstrapTcpControl`
2. `bootstrapTcpControlSucceeded`
3. `activateTerminalSucceeded`
4. `credentialRefreshed`
5. `taskResultReported`

说明：

1. 新命名不必完全沿用旧名，但语义应保持稳定。
2. 跨包写入仍然只能通过 command。

### 4.7 selectors

稳定公开 selector：

1. `selectTcpIdentitySnapshot`
2. `selectTcpCredentialSnapshot`
3. `selectTcpBindingSnapshot`
4. `selectTcpRuntimeState`
5. `selectTcpTerminalId`
6. `selectTcpAccessToken`
7. `selectTcpRefreshToken`
8. `selectTcpIsActivated`

说明：

1. snapshot selector 继续作为业务侧主要消费面。
2. 不对外暴露 slice action。

### 4.8 transport

全部走新 `transport-runtime`：

1. `POST /api/v1/terminals/activate`
2. `POST /api/v1/terminals/token/refresh`
3. `POST /api/v1/terminals/{terminalId}/tasks/{instanceId}/result`

错误统一经 `normalizeTransportError` 收敛。

### 4.9 errors

继承旧错误语义：

1. 激活码无效
2. 激活失败
3. credential 缺失
4. credential 过期
5. refresh 失败
6. task result report 失败
7. bootstrap hydration 失败

### 4.10 parameters

当前只保留：

1. `credentialRefreshLeadTimeMs`

说明：

1. 先保留定义，但不强行引入自动刷新机制。
2. 自动刷新如果后续需要，再作为二期能力。

---

## 5. `tdp-sync-runtime` 设计

### 5.1 状态设计

保留 5 个 slice：

1. `tdpSession`
2. `tdpSync`
3. `tdpProjection`
4. `tdpCommandInbox`
5. `tdpControlSignals`

其中：

1. `tdpSession` runtime-only。
2. `tdpSync` 只持久化最小恢复集。
3. `tdpProjection` runtime-only。
4. `tdpCommandInbox` runtime-only。
5. `tdpControlSignals` runtime-only。

### 5.2 `tdpSync`

最小持久化字段：

1. `lastCursor`
2. `lastAppliedCursor`

对应旧实现中的：

1. `lastCursor`
2. `lastAppliedRevision`

新设计里建议统一逐步改名为 `Cursor` 语义，避免继续混用 `Revision`。

### 5.3 `tdpSession`

继续保留运行态会话观测字段：

1. `status`
2. `reconnectAttempt`
3. `sessionId`
4. `nodeId`
5. `nodeState`
6. `syncMode`
7. `highWatermark`
8. `connectedAt`
9. `lastPongAt`
10. `alternativeEndpoints`
11. `disconnectReason`

### 5.4 `tdpProjection`

继续作为原始数据面输入缓存：

1. 第一层是 `topic`
2. 第二层是 `itemKey`

它不承担业务落库真相源。

### 5.5 `tdpCommandInbox`

继续作为原始命令收件箱：

1. `itemsById`
2. `orderedIds`

它不承担离线 durable replay。

### 5.6 `tdpControlSignals`

保留协议控制信号观测：

1. `lastProtocolError`
2. `lastEdgeDegraded`
3. `lastRehomeRequired`
4. `lastDisconnectReason`

### 5.7 commands

对外公开 command：

1. `connectTdpSession`
2. `disconnectTdpSession`

半公开 command：

1. `acknowledgeCursor`
2. `reportAppliedCursor`
3. `sendPing`

内部桥接 command：

1. `bootstrapTdpSync`
2. `bootstrapTdpSyncSucceeded`
3. `tdpSocketConnected`
4. `tdpSocketReconnecting`
5. `tdpSocketDisconnected`
6. `tdpSocketErrored`
7. `tdpSocketHeartbeatTimedOut`
8. `tdpMessageReceived`
9. `tdpSessionReady`
10. `tdpSnapshotLoaded`
11. `tdpChangesLoaded`
12. `tdpProjectionReceived`
13. `tdpProjectionBatchReceived`
14. `tdpCommandDelivered`
15. `tdpPongReceived`
16. `tdpEdgeDegraded`
17. `tdpSessionRehomeRequired`
18. `tdpProtocolFailed`

### 5.8 selectors

稳定公开 selector：

1. `selectTdpSessionState`
2. `selectTdpSyncState`
3. `selectTdpProjectionState`
4. `selectTdpCommandInboxState`
5. `selectTdpControlSignalsState`

当前阶段先保持这个粒度，不急着再拆更细 selector。

### 5.9 transport

全部走新 `transport-runtime`：

HTTP：

1. `GET /api/v1/tdp/terminals/{terminalId}/snapshot`
2. `GET /api/v1/tdp/terminals/{terminalId}/changes`

Socket：

1. 路径 `/api/v1/tdp/ws/connect`
2. query 包含 `terminalId + token`

### 5.10 errors

先保留旧三类核心错误：

1. credential 缺失
2. handshake 失败
3. protocol error

后续如发现真实联调还需要更细分类，再补。

### 5.11 parameters

先保留：

1. `tdpPingIntervalMs`

其他重连/心跳/超时参数优先复用 `transport-runtime` 与 `topology-client-runtime` 已有参数定义，避免重复。

---

## 6. 与 `mock-terminal-platform` 的验证闭环

两个新包都统一依赖：

- `0-mock-server/mock-terminal-platform`

不新建独立测试服务。

### 6.1 测试前置

所有真实联调测试，统一先调用：

- `POST /mock-debug/kernel-base-test/prepare`

该入口会：

1. 重置 `sandbox-kernel-base-test`
2. 重新播种主数据
3. 重新播种激活码
4. 重新播种 TDP topic 基线
5. 切换当前 runtime sandbox

### 6.2 当前已播种的 TDP topics

1. `tcp.task.release`
2. `terminal.config.state`
3. `config.delta`
4. `menu.delta`
5. `printer.delta`
6. `remote.control`
7. `print.command`

### 6.3 `tcp-control-runtime` 验证

第一阶段必须覆盖：

1. 激活成功
2. token 刷新成功
3. task result report 成功
4. 持久化恢复正确
5. runtime-only 字段不会恢复

### 6.4 `tdp-sync-runtime` 验证

第一阶段必须覆盖：

1. 依赖 `tcp-control-runtime` 激活完成
2. 真实建立 WebSocket session
3. snapshot 拉取
4. change log 增量追平
5. projection push
6. command delivered
7. ack / applied state 回报
8. 重连与 resume
9. 重启后 cursor 恢复

---

## 7. 下一步实施顺序

1. 先创建 `tcp-control-runtime`
2. 实现最小闭环
3. 用 `kernel-base-test` 沙箱做真实验证
4. 再创建 `tdp-sync-runtime`
5. 再完成数据面闭环验证

当前不建议：

1. 直接迁业务包
2. 先做 `ui-runtime`
3. 先抽第三个 terminal 共享包

