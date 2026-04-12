# 2026-04-12 kernel-base tdp-sync-runtime-v2 设计文档

## 1. 结论

`tdp-sync-runtime-v2` 是旧 `1-kernel/1.1-cores/tdp-client` 在新基础架构里的迁移目标。

它负责 TDP 数据面，不负责 TCP 控制面：

1. 基于 `terminalId + accessToken` 建立 TDP 会话。
2. 处理 handshake / snapshot / changes / projection push / command delivered。
3. 管理 reconnect / resume / ack / apply。
4. 维护本地 projection 仓库。
5. 基于 scope priority 计算“当前生效值”。
6. 把生效变化转成通用 command：`tdpTopicDataChanged`。

这一版最重要的设计结论有四条：

1. `tdp-sync-runtime-v2` 自己维护全量业务 projection 仓库，并持久化到本地。
2. 当前生效 projection 不持久化，需要时按 scope priority 即时计算。
3. 变化对外统一发布为普通 command `tdpTopicDataChanged`，而不是额外广播 API。
4. `error.message / system.parameter` 是唯一特例，由 `tdp-sync-runtime-v2` 自己桥接到 `runtime-shell-v2` 的 catalog command。

---

## 2. 包身份

目标包：

1. 目录：`1-kernel/1.1-base/tdp-sync-runtime-v2`
2. 包名：`@impos2/kernel-base-tdp-sync-runtime-v2`
3. `moduleName`：`kernel.base.tdp-sync-runtime-v2`

依赖：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `transport-runtime`
4. `state-runtime`
5. `platform-ports`

---

## 3. 职责边界

负责：

1. TDP session 生命周期。
2. WS 建连、握手、心跳、重连、resume。
3. snapshot / changes 拉取与增量游标推进。
4. raw projection 仓库。
5. raw command inbox。
6. control signals。
7. scope priority 计算。
8. `tdpTopicDataChanged` command 发布。
9. `error.message / system.parameter` topic 特例桥接。

不负责：

1. terminal 激活与 token 真相源。
2. workflow 执行。
3. request 真相源。
4. 主副拓扑 peer command 路由。
5. 业务 read model 的最终落地。
6. React hook。

---

## 4. 状态设计

v2 继续保留 5 类状态，但语义更明确：

1. `tdpSession`
2. `tdpSync`
3. `tdpProjectionRepository`
4. `tdpCommandInbox`
5. `tdpControlSignals`

### 4.1 `tdpSession`

字段：

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

持久化：

1. 不持久化。

### 4.2 `tdpSync`

字段：

1. `snapshotStatus`
2. `changesStatus`
3. `lastCursor`
4. `lastDeliveredCursor`
5. `lastAckedCursor`
6. `lastAppliedCursor`

持久化：

1. 只持久化最小恢复集。
2. 至少包括 `lastCursor / lastAppliedCursor`。
3. 运行态字段在 bootstrap 时重置，不携带跨重启噪音。

### 4.3 `tdpProjectionRepository`

这是 v2 的关键真相源之一。

状态结构：

```ts
type ProjectionId = `${topic}:${scopeType}:${scopeId}:${itemKey}`

type TdpProjectionRepositoryState = Record<ProjectionId, TdpProjectionEnvelope>
```

每条记录最小包含：

1. `topic`
2. `itemKey`
3. `scopeType`
4. `scopeId`
5. `revision`
6. `operation`
7. `payload`
8. `occurredAt`
9. `sourceReleaseId`

持久化：

1. 逐 projectionId 单条持久化。
2. 不把整个 topic 聚成一个超大对象持久化。

原因：

1. 支持同 topic 多 item。
2. 支持同 topic 同 itemKey 多 scope 并存。
3. 支持 delete 后回退到低优先级值。
4. 重启后可继续基于本地仓库计算当前生效值。

### 4.4 `tdpCommandInbox`

持久化：

1. 不持久化。

原因：

1. command inbox 是时效性信号，不保证跨重启补执行。

### 4.5 `tdpControlSignals`

持久化：

1. 不持久化。

原因：

1. 只服务于本进程连接观测与排障。

---

## 5. Scope Priority

终端当前生效 projection 固定按下面优先级选取：

1. `Platform`
2. `Project`
3. `Brand`
4. `Tenant`
5. `Store`
6. `Terminal`

实际选取规则：

1. 同一个 `topic + itemKey` 可以同时存在多个 scope 版本。
2. 终端收到任何变更时，不直接把某一条写成“当前值真相”。
3. 读取或发布 topic change 前，始终按当前终端 binding + terminalId 计算最高优先级生效值。

说明：

1. 这是终端本地读取规则。
2. 服务端不应限制 scopeType 推送范围，所有相关 scope 都应该下发到终端。

---

## 6. Projection 仓库与 topic change 模型

## 6.1 为什么必须持久化全量 projection 仓库

用户已经明确要求：

1. `tdp-sync-runtime` 要做全量业务 projection 仓库。
2. projection 仓库存本地 state。
3. 当前生效值可以内存现算，不用存。

原因：

1. 如果只存当前生效值，重启后无法对 delete fallback 做正确计算。
2. workflow definitions / errorMessages / systemParameters 这类多 scope 覆盖场景会直接失真。

## 6.2 通用 command：`tdpTopicDataChanged`

这一版把之前“topic change 广播 actor”的摇摆彻底收敛回统一模型：

1. `tdpTopicDataChanged` 是正式 command。
2. 任何关心 topic 的模块，都声明自己的 actor handler 去处理这个 command。
3. `tdp-sync-runtime-v2` 自己不去理解业务含义。

payload 固定为：

```ts
export interface TdpTopicDataChangedPayload {
    topic: string
    changes: Array<{
        operation: 'upsert' | 'delete'
        itemKey: string
        payload?: Record<string, unknown>
        revision?: number
    }>
}
```

关键约束：

1. `changes` 只描述“按当前优先级计算后，真正生效变化的内容”。
2. 业务包不需要理解优先级细节，只关心自己应该怎样更新。

## 6.3 变化计算规则

当 projection 仓库变化时：

1. 先取某个 topic 变化前的 resolved projection。
2. 再取变化后的 resolved projection。
3. 对比 itemKey 集合，生成最小变化集。

例如：

1. 原来有：
   1. `topicA itemKeyA StoreA data1`
   2. `topicA itemKeyA TerminalA data2`
2. 新变化：
   1. delete `topicA itemKeyA TerminalA`
3. 则外部只应看到：
   1. `tdpTopicDataChanged(topicA, [{operation: 'upsert', itemKey: 'itemKeyA', payload: data1}])`

也就是：

1. 终端外部收到的是“当前生效值变成了什么”。
2. 而不是“底层某个 scope 删掉了一条原始 projection”。

---

## 7. Command 设计

### 7.1 公开 command

对外公开：

1. `bootstrapTdpSync`
2. `connectTdpSession`
3. `disconnectTdpSession`
4. `acknowledgeCursor`
5. `reportAppliedCursor`
6. `sendPing`
7. `tdpTopicDataChanged`

说明：

1. `tdpTopicDataChanged` 是稳定跨包能力，不再是额外广播接口。
2. 上层业务包只需要依赖这个 command。

### 7.2 内部 command

内部 command：

1. `bootstrapTdpSyncSucceeded`
2. `tdpSocketConnected`
3. `tdpSocketReconnecting`
4. `tdpSocketDisconnected`
5. `tdpSocketErrored`
6. `tdpSocketHeartbeatTimedOut`
7. `tdpMessageReceived`
8. `tdpSessionReady`
9. `tdpSnapshotLoaded`
10. `tdpChangesLoaded`
11. `tdpProjectionReceived`
12. `tdpProjectionBatchReceived`
13. `tdpCommandDelivered`
14. `tdpPongReceived`
15. `tdpEdgeDegraded`
16. `tdpSessionRehomeRequired`
17. `tdpProtocolFailed`

这些 command 全部 `visibility = internal`。

---

## 8. Actor 设计

建议 actor：

1. `TdpBootstrapActor`
2. `TdpSessionActor`
3. `TdpMessageActor`
4. `TdpProjectionRepositoryActor`
5. `TdpCommandInboxActor`
6. `TdpControlSignalActor`
7. `TdpTopicChangeActor`
8. `TdpSystemCatalogBridgeActor`

结构约束：

1. `src/features/actors/index.ts` 只做 actor 聚合导出，不承载具体业务逻辑。
2. 每个 actor 按职责单独放文件，例如：
   1. `bootstrapActor.ts`
   2. `messageActor.ts`
   3. `projectionRepositoryActor.ts`
   4. `commandInboxActor.ts`
   5. `sessionStateActor.ts`
   6. `topicChangeActor.ts`
   7. `systemCatalogBridgeActor.ts`
3. actor 内不要堆一串 `dispatchAction(setXxx)` 去手写状态迁移细节。
4. 同一业务语义下需要同时修改多个 slice 时，应优先定义单个 domain action，由各 slice 在 reducer 内共同响应。
5. actor 应表达“收到什么 command，触发什么业务语义”，而不是直接暴露 reducer 内部实现细节。

### 8.1 `TdpBootstrapActor`

处理：

1. `bootstrapTdpSync`

职责：

1. hydrate projection repository 与 sync cursor。
2. 重置 runtime-only 状态。
3. 发出 `bootstrapTdpSyncSucceeded`。

关键约束：

1. bootstrap 不能清空 projection repository。
2. bootstrap 不能清空恢复游标。

### 8.2 `TdpSessionActor`

处理：

1. `connectTdpSession`
2. `disconnectTdpSession`
3. `sendPing`
4. 各类 socket lifecycle internal command

职责：

1. 连接 transport socket。
2. 负责重连策略与 heartbeat。
3. 负责 handshake、resume、snapshot/changes 启动时机。

### 8.3 `TdpMessageActor`

处理：

1. `tdpMessageReceived`

职责：

1. 解析协议消息。
2. 转发成 `tdpSessionReady / tdpSnapshotLoaded / tdpProjectionReceived / tdpCommandDelivered ...` 等内部 command。

### 8.4 `TdpProjectionRepositoryActor`

处理：

1. `tdpSnapshotLoaded`
2. `tdpChangesLoaded`
3. `tdpProjectionReceived`
4. `tdpProjectionBatchReceived`

职责：

1. 维护 raw projection repository。
2. 推进 `lastCursor / lastAppliedCursor`。
3. 在每次 repository 改变后调度 `tdpTopicDataChanged` 计算。

### 8.5 `TdpTopicChangeActor`

处理：

1. repository 变化后的内部触发 command，例如 `recomputeResolvedTopicChanges`

职责：

1. 计算 resolved topic changes。
2. 为每个发生变化的 topic 发出正式 `tdpTopicDataChanged` command。

说明：

1. 这里不直接改业务 state。
2. 这里只把数据面变化转成统一业务语言。

### 8.6 `TdpSystemCatalogBridgeActor`

这是唯一特例 bridge。

处理：

1. `tdpTopicDataChanged`

职责：

1. 如果 topic 是 `error.message`，调用 `runtime-shell-v2` 的 catalog command。
2. 如果 topic 是 `system.parameter`，调用 `runtime-shell-v2` 的 catalog command。

原因：

1. `runtime-shell-v2` 是基础包，不能反向依赖 `tdp-sync-runtime-v2`。
2. 但 catalog 更新又必须有正式写入口。

---

## 9. `error.message / system.parameter` topic 约束

### 9.1 主题键

固定：

1. `error.message`
2. `system.parameter`

### 9.2 转换规则

1. 远端 projection 先进入 raw repository。
2. 再按 scope priority 求当前生效值。
3. 再转成 `runtime-shell-v2` 的 catalog update/remove command。
4. 高优先级 delete 后应自动回退到低优先级值。

### 9.3 不允许的做法

1. 业务包自己去扫 TDP raw projection 仓库。
2. 业务包自己去写 runtime-shell catalog state。
3. `tdp-sync-runtime-v2` 直接 import 其他业务模块的 command 做特殊分支。

唯一例外就是：

1. `runtime-shell-v2` catalog command。

---

## 10. 与 workflow 的边界

workflow 的动态 definitions 也走相同 topic change 机制。

推荐固定 topic：

1. `workflow.definition`

流程：

1. TDP 下发 raw projection。
2. `tdp-sync-runtime-v2` 更新 repository。
3. 计算当前生效值。
4. 发出 `tdpTopicDataChanged({topic: 'workflow.definition', changes})`
5. `workflow-runtime-v2` 自己的 actor 处理该 command，更新 `workflowDefinitions` state。

说明：

1. 这不是 `tdp-sync-runtime-v2` 的特例。
2. 这是所有业务 topic 的标准接入方式。

---

## 11. 重连与恢复

### 11.1 生产要求

WS 重连策略固定为：

1. 生产环境无限重连。
2. 重连间隔参数化。
3. 测试场景允许传递重连次数上限。

### 11.2 重连后恢复

恢复原则：

1. 基于持久化的 `lastCursor / lastAppliedCursor` 继续增量同步。
2. projection repository 重启后仍然保留。
3. runtime-only session 与 control signal 状态重建。

### 11.3 不做的事情

1. 不做 raw command inbox 的持久化补执行。
2. 不做 projection flush-all 再重建。

用户已经明确确认，旧工程“离线重连后自动同步，而不是一股脑 flush”的方向是值得保留的。

---

## 12. errors / parameters

v2 需要继续保留并补齐：

1. 连接失败
2. 心跳超时
3. handshake 失败
4. protocol 失败
5. credential 缺失
6. projection apply 失败
7. ack/report 失败

参数至少包括：

1. reconnect interval
2. reconnect attempts for test
3. connection timeout
4. heartbeat timeout
5. ping interval

说明：

1. 这些参数要真实进入行为，不是只定义不使用。
2. 后续拓扑 WS 包也要采用同一套“生产无限重连、测试可限次、间隔参数化”的原则。

---

## 13. 与其他包边界

### 13.1 与 `tcp-control-runtime-v2`

读取：

1. `terminalId`
2. `accessToken`
3. `binding snapshot`

不负责刷新 credential 真相。

如果 token 不可用：

1. 返回结构化错误。
2. 是否触发 refresh，由上层 command 再决定，不在本包里隐式做业务补救。

### 13.2 与 `runtime-shell-v2`

依赖：

1. command/actor 执行模型。
2. request query。
3. catalog command。

### 13.3 与 `workflow-runtime-v2`

`workflow-runtime-v2` 只依赖：

1. `tdpTopicDataChanged`

不依赖：

1. raw projection repository 结构。

---

## 14. 测试门槛

### 14.1 单包测试

至少覆盖：

1. bootstrap 不清 projection repository。
2. scope priority 解析正确。
3. delete 后 fallback 到低优先级 projection。
4. `tdpTopicDataChanged` 只发出真正生效变化。
5. `error.message / system.parameter` bridge 正确。

### 14.2 真实联调测试

必须使用：

1. `0-mock-server/mock-terminal-platform`

覆盖：

1. handshake
2. projection push
3. batch-upsert projection
4. reconnect recovery
5. restart recovery
6. workflow definition topic add/update/delete
7. error.message topic add/update/delete/fallback
8. system.parameter topic add/update/delete/fallback
9. 多终端、多场景、网络中断、后台数据更新

要求：

1. 不同复杂场景拆成不同测试文件。
2. 测试入口优先是 command。
3. 主断言对象优先是 `CommandAggregateResult`、request query、selector。

---

## 15. MVP 范围

第一阶段实现：

1. projection repository
2. scope priority
3. reconnect/resume
4. `tdpTopicDataChanged`
5. `error.message / system.parameter` bridge
6. 与 `workflow-runtime-v2` 的 topic 对接

第一阶段不实现：

1. 主副拓扑 peer route
2. durable command replay
3. 业务 read model 自动落地

---

## 16. 下一步

`tdp-sync-runtime-v2` 设计确认后，继续输出：

1. `workflow-runtime-v2` 设计文档

然后再进入第一阶段实现。
