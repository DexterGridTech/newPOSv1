# @impos2/kernel-core-tdp-client

`tdp-client` 是终端和 `mock-terminal-platform` 数据面之间的实时同步客户端 core 包。

它建立在两个基础之上：

- `@impos2/kernel-core-communication`：提供 HTTP + WebSocket 基础设施
- `@impos2/kernel-core-tcp-client`：提供 `terminalId` 和 `accessToken`

`tdp-client` 的核心目标不是直接落业务对象，而是提供一个稳定的数据面同步壳层：

- 建立 TDP WebSocket 会话
- 完成握手
- 处理全量快照和增量追平
- 接收实时 projection 推送
- 接收命令投递
- 向服务端发送 `ACK` 和 `STATE_REPORT`
- 在非手动断开时持续重连

## 1. 包定位

这是一个标准 `AppModule`：

- 模块名：`kernel.core.tdpClient`
- 依赖：
  - `@impos2/kernel-core-base`
  - `@impos2/kernel-core-communication`
  - `@impos2/kernel-core-tcp-client`

导出入口在 [src/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/index.ts)。

## 2. 职责边界

### 负责

- 用 `tcp-client` 提供的 `terminalId + accessToken` 建立 WebSocket 会话
- 发送 `HANDSHAKE`
- 处理 `SESSION_READY`
- 处理 `FULL_SNAPSHOT`
- 处理 `CHANGESET`
- 处理 `PROJECTION_CHANGED`
- 处理 `PROJECTION_BATCH`
- 处理 `COMMAND_DELIVERED`
- 处理 `PONG`
- 处理 `EDGE_DEGRADED`
- 处理 `SESSION_REHOME_REQUIRED`
- 处理 `ERROR`
- 记录最小恢复游标，保证重启后增量恢复

### 不负责

- 直接把 projection 持久化到本地
- 保证 command 一定被客户端消费成功
- 业务对象建模，例如订单、用户、通知
- 长离线期间的命令补投语义

当前设计里，projection 和 commandInbox 更接近“原始数据面输入缓存”，不是最终业务落库模型。

## 3. 当前协议语义

协议定义见 [src/types/shared/tdpProtocol.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/types/shared/tdpProtocol.ts)。

### 非常关键的区分

- `revision`：某个 `topic + scope` 内部的投影版本号
- `cursor`：某个终端的数据面全局增量游标

当前实现里：

- `HANDSHAKE.lastCursor` 用的是全局 `cursor`
- `CHANGESET.nextCursor` 是全局 `cursor`
- `PROJECTION_CHANGED.data.cursor` 是全局 `cursor`
- `ACK.cursor` 确认的是全局 `cursor`
- `STATE_REPORT.lastAppliedCursor` 回报的也是全局 `cursor`

不要把 projection 的 `revision` 当成断点恢复游标使用。这个问题已经在当前实现和 mock 服务里修正过了。

补充一点：当前代码和 mock 服务里仍有少数字段名沿用 `Revision` 命名，例如：

- `lastDeliveredRevision`
- `lastAckedRevision`
- `lastAppliedRevision`

这些字段名目前是历史命名，实际承载的也是全局 `cursor` 进度，而不是 projection `revision`。

## 4. 状态设计

### 总体原则

`tdp-client` 当前明确区分：

- 最小持久化真相源
- runtime-only 状态
- 原始数据面缓存

### 持久化 slice

当前只有 `tdpSync` 持久化，而且还是最小化持久化。

定义见 [src/features/slices/tdpSync.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/slices/tdpSync.ts)。

保留的核心字段：

- `lastCursor`
- `lastAppliedRevision`

同一个 slice 中以下字段显式不持久化：

- `snapshotStatus`
- `changesStatus`
- `lastDeliveredRevision`
- `lastAckedRevision`

原因很明确：

- `lastCursor` 是跨重启增量恢复的最小真相源
- `lastAppliedRevision` 虽然字段名叫 revision，但当前语义是“本地确认真正应用过的最后 cursor”
- 其他字段都只是当前进程的运行观测值

### runtime-only slice

#### `tdpSession`

定义见 [src/types/state/tdpSession.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/types/state/tdpSession.ts)。

关键字段：

- `status`
- `reconnectAttempt`
- `sessionId`
- `nodeId`
- `nodeState`
- `syncMode`
- `highWatermark`
- `connectedAt`
- `lastPongAt`
- `alternativeEndpoints`
- `disconnectReason`

它纯粹是会话运行态，不应该跨重启保留。

#### `tdpControlSignals`

定义见 [src/types/state/tdpControlSignals.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/types/state/tdpControlSignals.ts)。

关键字段：

- `lastProtocolError`
- `lastEdgeDegraded`
- `lastRehomeRequired`
- `lastDisconnectReason`

它用于 UI、日志、调试工具观察协议层控制信号。

### 原始数据缓存 slice

#### `tdpProjection`

定义见 [src/types/state/tdpProjection.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/types/state/tdpProjection.ts)。

结构：

- 第一层：`topic`
- 第二层：`itemKey`

即：

```ts
Record<string, Record<string, TdpProjectionEnvelope>>
```

它只保留运行时内存，不做本地持久化。

#### `tdpCommandInbox`

定义见 [src/types/state/tdpCommandInbox.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/types/state/tdpCommandInbox.ts)。

结构：

- `itemsById`
- `orderedIds`

它表示“服务端已经推到终端的数据面 command 原文”，不是一个需要离线重放的持久命令队列。

当前设计里它也只保留在运行时内存。

## 5. 为什么 projection 和 commandInbox 不持久化

这是当前实现的明确选择，不是遗漏。

原因是：

- projection 是原始数据面输入，真正业务对象应由上层自行消费和落库
- command 是异步触发信号，不要求客户端离线后几天再补做
- 如果终端当时没收到或没及时响应，服务端应把状态标成超时未响应，而不是依赖客户端本地重放

所以当前包的恢复策略是：

- 不恢复原始 projection 缓存
- 不恢复 command inbox
- 只恢复 `cursor`
- 重启后尽量走增量同步，避免全量重拉

## 6. 对外公开的能力

### 模块导出

包入口导出：

- `kernelCoreTdpClientModule`
- `kernelCoreTdpClientCommands`
- `kernelCoreTdpClientSlice`
- `kernelCoreTdpClientErrorMessages`
- `kernelCoreTdpClientParameters`
- `types / selectors / foundations / supports`

### Commands

定义见 [src/features/commands/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/commands/index.ts)。

分为两类。

#### 业务层主动调用的命令

- `connectTdpSession`
- `disconnectTdpSession`
- `acknowledgeCursor`
- `reportAppliedCursor`
- `sendPing`

一般业务层直接主动用的通常只有：

- `connectTdpSession`
- `disconnectTdpSession`

`acknowledgeCursor` 和 `reportAppliedCursor` 通常由内部 actor 自动触发。

#### 运行时桥接命令

这些主要是 socket runtime 事件或协议消息拆解后的内部命令：

- `tdpSocketConnected`
- `tdpSocketReconnecting`
- `tdpSocketDisconnected`
- `tdpSocketErrored`
- `tdpSocketHeartbeatTimedOut`
- `tdpMessageReceived`
- `tdpSessionReady`
- `tdpSnapshotLoaded`
- `tdpChangesLoaded`
- `tdpProjectionReceived`
- `tdpProjectionBatchReceived`
- `tdpCommandDelivered`
- `tdpPongReceived`
- `tdpEdgeDegraded`
- `tdpSessionRehomeRequired`
- `tdpProtocolFailed`

### Selectors

定义见 [src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/selectors/index.ts)。

当前 selectors 直接暴露 slice state：

- `selectTdpSessionState`
- `selectTdpSyncState`
- `selectTdpProjectionState`
- `selectTdpCommandInboxState`
- `selectTdpControlSignalsState`

### Foundations

定义见 [src/foundations/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/foundations/index.ts)。

当前对外开放：

- `TdpHttpService`
- `tdpHttpService`
- `TdpSocketService`
- `createTdpSocketService`
- `TdpSessionRepository`
- `tdpSessionRepository`
- `TdpHandshakeCoordinator`
- `tdpHandshakeCoordinator`

## 7. 与 communication 的关系

### HTTP 能力

`tdp-client` 使用 `communication.HttpRuntime` 封装两个兜底 HTTP 接口：

- `GET /api/v1/tdp/terminals/{terminalId}/snapshot`
- `GET /api/v1/tdp/terminals/{terminalId}/changes`

定义见 [src/supports/apis/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/supports/apis/index.ts)。

`TdpHttpService` 只做：

- 全量快照获取
- 指定 `cursor` 之后的增量补偿获取

实现见 [src/foundations/services/TdpHttpService.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/foundations/services/TdpHttpService.ts)。

### WebSocket 能力

`tdp-client` 使用 `communication.SocketRuntime`，不是自己直接管理底层重连状态机。

profile 定义见 [src/supports/profiles/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/supports/profiles/index.ts)。

当前 profile：

- 名称：`tdpClient.session`
- 路径：`/api/v1/tdp/ws/connect`
- query：`{ terminalId, token }`
- `heartbeatTimeoutMs = 30000`
- `reconnectAttempts = -1`
- `reconnectIntervalMs = 1000`

`reconnectAttempts = -1` 的含义是：非手动断开时一直重试。

socket service 实现见 [src/foundations/services/TdpSocketService.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/foundations/services/TdpSocketService.ts)。

## 8. 初始化、握手和同步流程

### 初始化

初始化链路：

1. `kernelCoreBaseCommands.initialize`
2. `InitializeActor` 清理控制信号 runtime
3. 触发 `bootstrapTdpClient`
4. `BootstrapActor` 重置本进程 runtime slice

其中 `bootstrap` 会清掉：

- `tdpSession`
- `tdpProjection`
- `tdpCommandInbox`
- `tdpControlSignals`
- `tdpSync` 的 runtime 字段

但不会清掉：

- `tdpSync.lastCursor`
- `tdpSync.lastAppliedRevision`

对应实现：

- [src/features/actors/initialize.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/actors/initialize.ts)
- [src/features/actors/bootstrap.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/actors/bootstrap.ts)

### 建立连接

连接链路：

1. 调用 `connectTdpSession`
2. 从 `tcp-client` selector 读取 `terminalId` 和 `accessToken`
3. 建立 socket 连接
4. runtime 发出 `CONNECTED`
5. `SessionActor` 自动发送 `HANDSHAKE`

关键点：

- `tdp-client` 不重复维护终端身份真相源
- `terminalId/token` 完全依赖 `tcp-client`

实现见 [src/features/actors/session.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/actors/session.ts)。

### 握手

`HANDSHAKE` 由 `TdpHandshakeCoordinator` 生成，默认包含：

- `terminalId`
- `appVersion`
- `lastCursor`
- `protocolVersion`

实现见 [src/foundations/coordinators/TdpHandshakeCoordinator.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/foundations/coordinators/TdpHandshakeCoordinator.ts)。

### 收到 `SESSION_READY`

当服务端返回 `SESSION_READY` 时，会更新：

- `status = READY`
- `sessionId`
- `nodeId`
- `nodeState`
- `syncMode`
- `highWatermark`
- `alternativeEndpoints`
- `connectedAt`

这里的 `highWatermark` 当前也是全局 `cursor` 水位。

### 收到 `FULL_SNAPSHOT`

处理逻辑：

1. 用快照替换整个 `tdpProjection`
2. `snapshotStatus = ready`
3. `changesStatus = ready`
4. 用 `highWatermark` 更新：
   - `lastCursor`
   - `lastDeliveredRevision`
   - `lastAckedRevision`
   - `lastAppliedRevision`
5. 自动发送：
   - `ACK`
   - `STATE_REPORT`

### 收到 `CHANGESET`

处理逻辑：

1. 逐条应用增量到 `tdpProjection`
2. 更新 `lastCursor = nextCursor`
3. 更新 `highWatermark`
4. 更新 delivered / acked / applied 游标字段
5. 如果 `hasMore = true`，`changesStatus = catching-up`
6. 自动发送：
   - `ACK`
   - `STATE_REPORT`

### 收到实时增量

`PROJECTION_CHANGED` 和 `PROJECTION_BATCH` 都会：

- 把变化写入 `tdpProjection`
- 更新 `lastCursor`
- 更新 `lastAppliedRevision`
- 自动发送 `ACK`
- 自动发送 `STATE_REPORT`

相关实现见 [src/features/actors/sync.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/features/actors/sync.ts)。

## 9. 命令投递语义

`COMMAND_DELIVERED` 会被写入 `tdpCommandInbox`，随后客户端会自动发送一个 `ACK`。

这里的语义是：

- ACK 的是“客户端收到了这次数据面投递”
- 不等于“客户端业务一定执行成功”

当前实现不会：

- 持久化 command inbox
- 重启后补投未处理命令
- 维护离线 command 执行保障

这符合当前定位：command 是及时信号，不是可无限延期重试的 durable 作业。

## 10. 重连策略

### 自动重连

当前策略是：

- 非手动断开：一直重试
- 手动断开：停止重连

这是通过 `communication` 的 socket profile 元信息实现的，并由 runtime 事件桥接到本模块命令链。

### 心跳超时

当收到 `HEARTBEAT_TIMEOUT` 时：

- 状态切到 `RECONNECTING`
- 记录断开原因 `heartbeat timeout`

### 手动断开

执行 `disconnectTdpSession` 时：

- 主动调用 runtime.disconnect
- 状态切到 `DISCONNECTED`
- 记录断开原因 `disconnect by command`
- 不继续自动重连

## 11. 错误与控制信号

### 协议错误

如果服务端发送 `ERROR`，客户端会：

- 生成 `AppError`
- 设置 `tdpSession.status = ERROR`
- 写入 `tdpControlSignals.lastProtocolError`

### 边缘降级

收到 `EDGE_DEGRADED` 时，客户端会：

- `status = DEGRADED`
- 更新 `nodeState`
- 更新 `alternativeEndpoints`
- 记录 `lastEdgeDegraded`

### 要求迁移

收到 `SESSION_REHOME_REQUIRED` 时，客户端会：

- `status = REHOME_REQUIRED`
- 更新 `alternativeEndpoints`
- 记录 `lastRehomeRequired`

错误定义见 [src/supports/errors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/supports/errors/index.ts)：

- `tdpCredentialMissing`
- `tdpHandshakeFailed`
- `tdpProtocolError`

参数定义见 [src/supports/parameters/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/src/supports/parameters/index.ts)：

- `tdpPingIntervalMs`

## 12. 使用方式

### 注册模块

```ts
import {ApplicationManager, ScreenMode} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientModule} from '@impos2/kernel-core-tdp-client'
import {devServerSpace} from '@impos2/kernel-server-config'

const {store} = await ApplicationManager.getInstance().generateStore({
  serverSpace: devServerSpace,
  environment: {
    deviceId: 'demo-device',
    production: false,
    screenMode: ScreenMode.DESKTOP,
    displayCount: 1,
    displayIndex: 0,
  },
  preInitiatedState: {},
  module: kernelCoreTdpClientModule,
})

ApplicationManager.getInstance().init()
```

注意：这个模块依赖 `tcp-client`，因此你注册 `kernelCoreTdpClientModule` 时，会自动把 `tcp-client` 一起带入依赖树。

### 建立连接

前提是 `tcp-client` 已经完成激活，store 中已有：

- `terminalId`
- `accessToken`

然后执行：

```ts
import {kernelCoreTdpClientCommands} from '@impos2/kernel-core-tdp-client'

kernelCoreTdpClientCommands.connectTdpSession(undefined).execute('connect-tdp-demo')
```

### 读取状态

```ts
import {
  selectTdpCommandInboxState,
  selectTdpControlSignalsState,
  selectTdpProjectionState,
  selectTdpSessionState,
  selectTdpSyncState,
} from '@impos2/kernel-core-tdp-client'

const state = store.getState()

const session = selectTdpSessionState(state)
const sync = selectTdpSyncState(state)
const projection = selectTdpProjectionState(state)
const inbox = selectTdpCommandInboxState(state)
const controlSignals = selectTdpControlSignalsState(state)
```

## 13. 与 mock-terminal-platform 的对齐情况

当前 `tdp-client` 已经和现有 mock 服务对齐并完成验证：

- WebSocket 握手
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
- `force-close` 后自动重连
- 手动断开后不自动重连
- 重启后基于 `lastCursor` 增量恢复

而且服务端已经配合调整为使用全局 `cursor` 作为断点恢复依据，不再把 projection `revision` 当成同步游标。

需要注意，部分 admin 观测接口字段名仍保留 `Revision` 后缀，但其数值语义已经切到 `cursor` 进度。

## 14. Dev 验证

dev 入口见 [dev/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tdp-client/dev/index.ts)。

这不是假的 mock 单测，而是完整环境验证：

- 真正启动应用 store
- 真正注册 state storage
- 真正依赖 `tcp-client` 激活
- 真正连接 mock-terminal-platform
- 直接断言 slice / selector / 服务端状态

### 运行方式

先启动服务端：

```bash
corepack yarn mock:platform:dev
```

再运行：

```bash
corepack yarn workspace @impos2/kernel-core-tdp-client dev
```

### 验证内容

`dev/index.ts` 会执行 `full -> seed -> verify` 重启闭环。

#### `seed`

主要验证：

- 如未激活则先通过 `tcp-client` 激活
- 建立 TDP 会话
- projection push
- projection batch push
- command delivered
- HTTP snapshot
- HTTP changes
- `hasMore=true` 分页增量
- `PING / PONG`
- `EDGE_DEGRADED`
- `SESSION_REHOME_REQUIRED`
- `ERROR`
- 服务端强制关闭后的自动重连
- 断连后再次变为 `READY`
- 服务端 `lastAckedRevision / lastAppliedRevision` 更新
- 手动断开后不重连

#### `verify`

主要验证：

- `tcpIdentity/tcpCredential/tdpSync` 会恢复
- `tdpProjection` 不恢复
- `tdpCommandInbox` 不恢复
- `tdpSession` 不恢复
- 重启后再次连接走 `incremental`
- 无新变化时，重连后 `lastCursor` 保持不变

本地持久化使用的是共享 file storage：

- [1-kernel/1.1-cores/shared-dev/fileStateStorage.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/shared-dev/fileStateStorage.ts)

输出文件：

- `ai-result/dev-storage/tdp-client.dev.storage.json`

## 15. 推荐给上层的使用方式

建议把 `tdp-client` 当作“数据面输入层”，而不是“业务存储层”。

推荐模式：

1. 上层监听 `tdpProjection` 的变化
2. 把需要的 projection 消费成业务对象
3. 把业务对象存入你自己的细粒度本地状态或数据库
4. 只把 `cursor` 留给 `tdp-client` 负责

这样能保持：

- `tdp-client` 足够薄
- 重启恢复足够稳定
- 业务本地化策略足够自由

## 16. 当前限制

- 还没有自动按 `tdpPingIntervalMs` 定时发 ping 的 epic
- `modulePreSetup` 当前为空
- 目前没有“projection 到业务对象”的内建消费器
- 当前 `selector` 主要返回原始 slice state，还没有再抽象出更高层 snapshot selector
