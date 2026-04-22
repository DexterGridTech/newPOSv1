# `state-runtime` 同步契约草案

## 1. 文档目标

本文档用于承接旧 `interconnection + base` 中已经验证有效的状态同步规则，并将其整理成新的 `state-runtime` 同步契约。

本轮只回答三件事：

1. 旧工程里真正值得继承的同步核心语义是什么。
2. 新架构里哪些东西属于 `state-runtime` 通用能力，哪些仍属于 `topology-runtime` 控制面。
3. 为什么旧 `null = 删除` 需要升级为显式 tombstone。

---

## 2. 旧工程里必须继承的同步亮点

重新阅读旧实现后，最值得继承的不是字符串拼 action/type 本身，而是下面几条语义：

1. 同步比较基于 `updatedAt`
2. 只同步需要同步的 slice，而不是全量状态
3. 首次连通时先交换摘要，再按差异补齐
4. slice 内部支持动态 `Record<string, ValueWithUpdatedAt<T>>`
5. 删除也参与同步，而不是只同步新增和修改
6. `instanceMode / workspace` 会直接影响状态路由面

对应旧实现可见：

1. [batchUpdateState.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/batchUpdateState.ts)
2. [stateSyncMiddleware.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/middlewares/stateSyncMiddleware.ts)
3. [instanceInterconnection.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/features/actors/instanceInterconnection.ts)
4. [instanceMode.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/instanceMode.ts)
5. [workspace.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/workspace.ts)

---

## 3. 新架构的职责拆分

### 3.1 属于 `state-runtime` 的通用能力

`state-runtime` 现在应该正式拥有下面这些同步基础契约：

1. `SyncValueEnvelope<T>`
2. `SyncRecordState<T>`
3. `SyncStateSummary`
4. `createSyncStateSummary`
5. `mergeSyncRecordState`
6. `createSyncTombstone`
7. `StateScopeDescriptor`
8. `createScopedStateKey`
9. `createScopedStatePath`

这些能力只处理“状态怎么表达、怎么比较、怎么合并、怎么标识作用域”。

它们不处理：

1. 谁是 owner
2. 谁往谁同步
3. 何时发网络消息
4. 请求生命周期是否结束

这些仍然不属于 `state-runtime`。

### 3.2 属于 `topology-runtime` 的控制面能力

以下内容仍属于 `topology-runtime`：

1. 主副机角色判断
2. 同步方向判定
3. 连通后的摘要交换
4. 差异补发
5. 离线重连后的增量恢复编排
6. request/control-plane 正确性

也就是说：

1. `state-runtime` 负责“状态同步的语法”
2. `topology-runtime` 负责“状态同步的时机和路径”

---

## 4. 新的同步值模型

旧模型是：

1. 正常值：`{ value, updatedAt }`
2. 删除值：`null`

这个模型的问题是：

1. `null` 同时承担“业务值为空”和“同步删除”两种语义
2. 动态 `Record` 删除后，恢复和同步链路都容易产生歧义

新模型改为：

1. 正常值：`{ value, updatedAt }`
2. 删除值：`{ updatedAt, tombstone: true }`

这样做的好处是：

1. 删除也是正式同步事件
2. tombstone 可以参与 `updatedAt` 比较
3. 业务值为空与同步删除语义分离
4. 动态 `Record` 的跨机合并会更稳定

---

## 5. 新的作用域模型

旧工程里 `instanceMode / workspace` 通过字符串拼接隐式形成作用域 slice。

这个思想本身有效，但表达方式太隐式。

新契约改为显式 `StateScopeDescriptor`：

1. `axis: 'instanceMode' | 'workspace' | 'displayMode'`
2. `value: string`

辅助函数：

1. `createScopedStateKey(baseKey, scope)`
2. `createScopedStatePath(baseKey, scopes)`

这一步还没有直接替代高层 routing/runtime，只是先把 contract 正式化，避免后续继续在业务包里手拼 key。

---

## 6. 已落地实现

目前已经在 `state-runtime` 中落地：

1. `SyncValueEnvelope`
2. `SyncRecordState`
3. `SyncStateSummary`
4. `createSyncStateSummary`
5. `mergeSyncRecordState`
6. `createSyncTombstone`
7. `StateScopeDescriptor`
8. `createScopedStateKey`
9. `createScopedStatePath`
10. `StateRuntimeSliceDescriptor.sync`
11. `createSliceSyncSummary`
12. `createSliceSyncDiff`

相关代码：

1. [sync.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/types/sync.ts)
2. [supports/sync.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/supports/sync.ts)
3. [supports/scope.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/supports/scope.ts)

测试已覆盖：

1. `updatedAt` 优先级合并
2. tombstone 显式保留
3. summary 抽取
4. scope key/path 构造
5. slice-level summary/diff 生成

---

## 7. 与旧 `interconnection` 的映射关系

旧实现里最关键的两段逻辑是：

1. `collectLocalStateSummary`
2. `synStateAtConnected` 中的差异比较与补发

它们在新契约中的映射如下：

1. 旧 `collectLocalStateSummary(stateKeys)` 对应新 `createSliceSyncSummary(descriptor, state)`
2. 旧 `remote summary + local state -> diff` 对应新 `createSliceSyncDiff(descriptor, state, remoteSummary)`
3. 旧 `null` 删除通知，对应新 `createSyncTombstone(updatedAt)`

这意味着后续真正替换 `interconnection` 时，不再需要把：

1. 摘要抽取逻辑手写在 actor 里
2. 差异生成逻辑手写在 actor 里
3. 删除语义继续混在 `null` 中

而是可以变成：

1. 每个 slice 自己声明 `sync` schema
2. `topology-runtime` 按 `syncIntent` 选择要同步的 slice
3. 通用 helper 统一生成 summary 和 diff
4. 控制面只负责发送与接收，不负责重写状态比较规则

---

## 8. `topology-runtime` 同步计划层

本轮已经在 `topology-runtime` 中新增同步计划层。

它负责：

1. 按 `syncIntent` 选择需要同步的 slice
2. 调用 `state-runtime` 的 slice summary helper
3. 调用 `state-runtime` 的 slice diff helper
4. 输出面向传输层的 summary/diff plan

它不负责：

1. WebSocket 发送
2. 离线队列
3. 重试
4. 对端连接管理
5. request/control-plane 生命周期

已落地代码：

1. [stateSyncPlan.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime/src/foundations/stateSyncPlan.ts)
2. [sync.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime/src/types/sync.ts)

已覆盖测试：

1. `master-to-slave` 方向只选择 `master-to-slave` slice
2. `isolated` slice 不进入 summary/diff
3. 本地新于远端时生成本地补发 diff
4. 远端有、本地无时生成 tombstone diff
5. 本地有、远端无时生成本地补发 diff

---

## 9. `topology-runtime` 同步会话编排层

本轮进一步补上了同步会话编排层。

它负责：

1. 开始一次同步会话
2. 为本次会话生成本地 summary
3. 接收远端 summary
4. 计算本次会话的 diff
5. 把会话状态从 `awaiting-diff` 推进到 `active`
6. 提供会话查询与清理

补充约束：

1. 同步会话的真正键不是单一 `sessionId`，而是 `(sessionId, direction)`。
2. 同一个双机 session 内可以同时存在 `master-to-slave` 与 `slave-to-master` 两条 lane。
3. `commit ack` 只能推进对应 direction 的 baseline，不能模糊提交整个 session。
4. continuous 阶段的目标 peer 也应以该 lane 的 `peerNodeId` 为准，而不是依赖 hello ack 中是否携带 `peerRuntime`。

它仍然不负责：

1. 网络发送
2. 网络接收
3. 自动重试
4. 断线重连
5. 持续增量监听

已落地代码：

1. [stateSyncSession.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime/src/foundations/stateSyncSession.ts)
2. [createTopologyRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts)

这一步对应旧 `interconnection` 中：

1. `connectedToServer` / `peerConnected` 触发摘要交换的入口
2. `synStateAtConnected` 完成首轮差异比对
3. `startToSync` 进入持续同步前的准备阶段

但新架构把这三件事拆清了：

1. 会话编排在 `topology-runtime`
2. 状态比较在 `state-runtime`
3. transport 后续再接

---

## 10. 持续同步观察层

本轮继续补上了“持续同步观察层”，用于替代旧 `stateSyncMiddleware` 的缓存/基线逻辑。

它现在支持：

1. `activateContinuousSync`
2. `collectContinuousSyncDiff`
3. `commitContinuousSync`

核心语义：

1. 只有在显式 `activateContinuousSync` 后，才进入持续同步阶段
2. `collectContinuousSyncDiff` 只根据当前 baseline 计算 diff
3. `commitContinuousSync` 成功后才推进 baseline
4. 如果本轮发送失败，不调用 commit，下一轮仍能重新产出相同 diff
5. 发送方在收到 `StateSyncCommitAckEnvelope` 后，也必须把本 direction lane 推进到 `continuous`，否则后续自动增量不会启动

这正是旧 `stateSyncMiddleware` 最重要的正确性语义：

1. 发现变化不等于同步成功
2. 只有发送成功后才能更新缓存基线

新架构下，这条规则不再藏在 middleware 私有变量里，而是被提升为 `topology-runtime` 的显式控制面能力。

---

## 11. 传输无关的同步协议 envelope

本轮已经把同步消息正式提升为 `contracts` 中的协议 envelope，而不是继续沿用旧 `SYNC_STATE + 任意 payload` 的做法。

当前已定义：

1. `StateSyncSummaryEnvelope`
2. `StateSyncDiffEnvelope`
3. `StateSyncCommitAckEnvelope`

这些 envelope 的职责分别是：

1. 首轮摘要交换
2. 首轮差异补发
3. 持续同步成功后的基线提交确认

`topology-runtime` 现在已经能：

1. 从同步会话生成 `StateSyncSummaryEnvelope`
2. 消费远端 `StateSyncSummaryEnvelope` 并生成 `StateSyncDiffEnvelope`
3. 消费 `StateSyncCommitAckEnvelope` 推进连续同步基线

这意味着：

1. 同步控制面已经不依赖具体 WebSocket 客户端实现
2. 后续接 `transport-runtime` 时，只需要做 envelope 发送与分发映射
3. `dual-topology-host` 也可以直接 relay 这些 envelope，而不需要知道业务 slice 细节

---

## 12. 下一步建议

下一步不建议直接大范围改业务包，而是按下面顺序推进：

1. 先在 `state-runtime` 补 `SyncSliceDescriptor` 这类更正式的 slice-level sync schema
2. 再在 `topology-runtime` 中引入“摘要比较 + 差异生成” helper
3. 再补“持续同步观察器”，替代旧 `stateSyncMiddleware`
4. 现在开始把 `transport-runtime` / `dual-topology-host` 事件接到这些 envelope handler 上
5. 最后才把旧 `interconnection` 那套状态同步流正式映射到新 `topology-runtime + state-runtime`

这样可以保持：

1. 通用 contract 先稳定
2. 控制面时序后接入
3. 不会过早把旧实现细节硬拷到新架构里
