# topology-runtime-v2 / tdp-sync-runtime-v2 连接控制简化设计

日期：2026-04-14

目标：解决这两个问题：

1. `topology-runtime-v2/src/foundations/orchestrator.ts` 过重。
2. `topology-runtime-v2` 与 `tdp-sync-runtime-v2` 在 socket 连接控制形态上重复实现，未来会持续分叉。

前提约束：

1. 不抽协议层公共 runtime。
2. 不把 topology / tdp 的业务语义揉成一个统一会话抽象。
3. 只抽“socket lifecycle controller”这一层最小共性骨架。
4. 外部 API 保持不变。

## 一、问题复盘

### 1. topology orchestrator 当前承担过多职责

`orchestrator.ts` 当前同时承担：

1. socket binding 解析
2. 连接生命周期管理
3. reconnect timer
4. hello / resume / state-sync
5. 远端 command dispatch
6. request lifecycle 镜像等待
7. projection mirror 与 sync diff 推送

这会让任何后续改动都打到同一个文件。

### 2. topology 与 tdp 已经出现重复连接控制骨架

两边都在做：

1. `manualStop / manualDisconnect`
2. reconnect timer 清理
3. reconnect attempt 计数
4. `connected / disconnected / error / message` 监听绑定
5. 自动重连判定
6. `start / stop / restart`

真正不同的是：

1. topology 连上后发 `hello`，并走 `resume / state-sync`
2. tdp 连上后发 `HANDSHAKE`，并走 `ACK / PING / STATE_REPORT`

所以重复的是连接控制骨架，不是协议语义。

## 二、设计结论

### 1. 在 transport-runtime 增加轻量 `socketLifecycleController`

新增文件：

1. `1-kernel/1.1-base/transport-runtime/src/foundations/socketLifecycleController.ts`

它只负责：

1. `start / stop / restart`
2. `manualStop` 控制
3. reconnect timer
4. reconnect attempt
5. stale connect token
6. `attach()` 只注册一次监听器
7. disconnect / error 后统一调度重连

它明确不负责：

1. hello / handshake
2. resume / state-sync
3. ACK / PING / STATE_REPORT
4. patch 任何业务 slice
5. request / projection / sync session 语义

### 2. topology-runtime-v2 保留协议编排，只抽连接生命周期

拆分后结构建议：

1. `orchestrator.ts`
只保留装配、gateway 暴露、公开方法出口。

2. `orchestratorConnection.ts`
负责：
   1. topology socket lifecycle 适配
   2. precheck
   3. connected 后发 hello
   4. disconnected / error 后 patch topology state
   5. reconnect 与 resume 入口衔接

3. `orchestratorDispatch.ts`
负责：
   1. remote command dispatch envelope
   2. wait remote started
   3. wait remote result

保留不动：

1. `orchestratorIncoming.ts`
2. `orchestratorMessages.ts`
3. `syncSession.ts`
4. `syncPlan.ts`

### 3. tdp-sync-runtime-v2 保留协议编排，只抽连接生命周期

拆分后结构建议：

1. `sessionConnectionRuntime.ts`
只保留装配与对外 runtime API：
   1. `startSocketConnection`
   2. `disconnect`
   3. `sendAck`
   4. `sendStateReport`
   5. `sendPing`

2. `sessionConnectionLifecycle.ts`
负责：
   1. 解析 reconnect policy
   2. attached listeners
   3. connected 后发 handshake
   4. disconnected / error 后 patch tdp state
   5. `SESSION_READY` 后 attempt 清零

保留不动：

1. `socketBinding.ts`
2. `reduceServerMessage.ts`
3. actors / slices

## 三、controller 最小契约

### 1. controller 暴露

1. `start(options?: {isReconnect?: boolean})`
2. `stop(reason?: string)`
3. `restart(reason?: string)`
4. `attach()`

### 2. 调用方提供

1. `connect(options?): Promise<void>`
2. `disconnect(reason?): void`
3. `attachListeners(): void`
4. `resolveReconnectPolicy(): {attempts: number; delayMs: number}`
5. `shouldReconnect(): boolean`
6. `onConnectStarting(input)`
7. `onConnected()`
8. `onDisconnected(reason?)`
9. `onError(error)`
10. `onReconnectScheduled(input)`
11. `onReconnectGiveUp(input)`

### 3. 契约边界

这个 controller：

1. 不持有 profileName
2. 不理解消息类型
3. 不直接订阅 runtime state
4. 不做 logger 以外的业务行为

也就是说它只是一个“连接控制骨架”。

## 四、状态与语义边界

### 1. topology 仍然自己维护

1. `connectionState`
2. `syncState`
3. `peerState`
4. `resumeStatus`
5. `continuousSyncActive`
6. remote command wait/result
7. hello / resume / state-sync 语义

### 2. tdp 仍然自己维护

1. `tdpSession.status`
2. `disconnectReason`
3. `lastDisconnectReason`
4. `reconnectAttempt`
5. `HANDSHAKING / CONNECTING / RECONNECTING / DISCONNECTED`
6. `SESSION_READY`
7. `ACK / PING / STATE_REPORT / message dispatch`

## 五、测试策略

### 1. transport-runtime

新增 `socketLifecycleController` 单元测试，至少覆盖：

1. `manual stop` 后不自动重连
2. reconnect attempt 达上限后停止
3. `restart()` 会清 timer 并重新连接
4. stale connect 不污染当前连接
5. disconnect / error 走统一重连调度

### 2. topology-runtime-v2

保留现有 live tests，重点确认：

1. 连接建立
2. 断线重连
3. resume
4. remote command roundtrip
5. state sync / projection mirror

### 3. tdp-sync-runtime-v2

保留现有 live tests，重点确认：

1. WS 无限期重连参数化策略不变
2. `SESSION_READY` 后 reconnect attempt 清零
3. reconnect / restart recovery 不回归
4. projection feedback / command roundtrip / system catalog 不回归

## 六、实施顺序

1. 先在 `transport-runtime` 落 `socketLifecycleController`
2. 再迁 `tdp-sync-runtime-v2`
   原因：
   它协议更简单，先验证 controller 骨架是否合适
3. 再迁 `topology-runtime-v2`
   原因：
   它还带 hello / resume / state-sync / remote dispatch，复杂度更高
4. 最后跑两个包的 type-check / test / circular 检查

## 七、明确不做

本轮明确不做这些事情：

1. 不统一 topology 和 tdp 的消息协议
2. 不抽统一 session runtime
3. 不改 state 结构
4. 不顺手重做 reconnect 参数模型
5. 不顺手改 request mirror / sync session 语义
