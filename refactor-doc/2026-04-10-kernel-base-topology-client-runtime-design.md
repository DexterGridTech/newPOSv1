# `topology-client-runtime` 设计草案

## 1. 文档目标

本文档用于定义替代旧 `_old_/1-kernel/1.1-cores/interconnection` 的客户端侧运行时包。

旧 `interconnection` 不能被简单替换成一个同名新包，因为它实际混合了四类职责：

1. 主副机连接、重连、远程命令、状态同步编排。
2. `instanceMode / displayMode / workspace / standalone / enableSlave / masterInfo` 等运行上下文状态。
3. `workspace / instanceMode` 作用域 slice key 与 dispatch helper。
4. request status 读模型与 React hook。

新架构必须继承这些业务能力，但不能继续把它们塞进一个大包。

本文档只定义客户端侧替代方案，不进入具体实现。

---

## 2. 总体结论

新增客户端侧编排包：

1. 目录：`1-kernel/1.1-base/topology-client-runtime`
2. 包名：`@impos2/kernel-base-topology-client-runtime`
3. `moduleName`：`kernel.base.topology-client-runtime`

它不是旧 `interconnection` 的平移版本，而是一个薄的客户端拓扑编排层。

它的核心职责是：

1. 把 `topology-runtime`、`transport-runtime`、`state-runtime`、`runtime-shell` 的能力装配成终端客户端可运行的主副机体验。
2. 维护客户端可读的拓扑上下文与连接状态 read model。
3. 编排 hello / resume / state sync / remote command / lifecycle snapshot 这些跨端流程。
4. 提供替代旧 `interconnection` command 的正式客户端命令。

它不负责：

1. 不重新实现 owner-ledger。
2. 不重新实现状态 diff 算法。
3. 不重新实现 HTTP / WS 基础设施。
4. 不承载 React hook。
5. 不承载通用 `workspace / instanceMode` slice helper。

---

## 3. 为什么需要新增这个包

当前新架构已经有：

1. `topology-runtime`：控制面核心、owner-ledger、request projection、sync session、恢复状态。
2. `transport-runtime`：HTTP / WS transport 基础设施。
3. `host-runtime`：可嵌入的主副机 host pairing / relay 核心。
4. `dual-topology-host`：Node/mock server shell。
5. `runtime-shell`：模块装配、命令执行、catalog / request projection 读模型。
6. `state-runtime`：通用 Redux/state 基础设施。

但这些包仍缺一个“客户端运行时编排层”：

1. 谁在启动时根据 `enableSlave / masterInfo` 决定是否连接。
2. 谁把 socket 连接状态写入全局可读 state。
3. 谁在 reconnect 后触发 resume barrier，而不是一股脑 flush。
4. 谁把 state sync envelope 送进 `topology-runtime` 并调用 `state-runtime` 应用 diff。
5. 谁把 remote command envelope 送给对端，并把远端 lifecycle event 接回本地 request projection。
6. 谁提供旧 `setInstanceToMaster / setMasterInfo / startConnection` 这类业务命令的新版本。

如果把这些都塞回 `topology-runtime`，`topology-runtime` 会重新变成大 manager。

如果放在 `runtime-shell`，`runtime-shell` 会混入主副机业务拓扑策略。

因此需要一个独立的薄包：`topology-client-runtime`。

---

## 4. 与其他包的边界

## 4.1 `contracts`

`contracts` 负责公开协议对象。

`topology-client-runtime` 只使用这些协议，不私造协议：

1. `NodeHello / NodeHelloAck`
2. `CommandDispatchEnvelope`
3. `CommandEventEnvelope`
4. `RequestLifecycleSnapshot`
5. `StateSyncSummaryEnvelope`
6. `StateSyncDiffEnvelope`
7. `StateSyncCommitAckEnvelope`
8. `ProjectionMirrorEnvelope`
9. `NodeRuntimeInfo`
10. `TimestampMs / RequestId / CommandId / SessionId / NodeId`

## 4.2 `state-runtime`

`state-runtime` 继续是通用 state 基础设施。

应放在 `state-runtime` 的能力：

1. `RootState` 声明合并扩展点。
2. `createScopedStateKey / createScopedStatePath`。
3. `workspace / instanceMode / displayMode` 这类 scope descriptor 类型。
4. 后续要补齐的 `createScopedStateKeys`。
5. 后续要补齐的 `createScopedSliceDescriptors`。
6. 后续要补齐的 `dispatchScopedAction`。

不放在 `state-runtime` 的能力：

1. 不计算当前 `workspace`。
2. 不知道当前 `instanceMode`。
3. 不知道 `masterInfo`。
4. 不知道主副机连接状态。

也就是说，`state-runtime` 提供“作用域 state 工具”，但不提供“当前拓扑上下文真相”。

## 4.3 `topology-runtime`

`topology-runtime` 负责活的控制面真相。

保留在 `topology-runtime` 的能力：

1. owner-ledger。
2. request lifecycle truth。
3. request projection builder。
4. state sync session。
5. recovery state。
6. compatibility decision。

不放进 `topology-runtime` 的能力：

1. 不直接创建 socket。
2. 不处理 reconnect timer。
3. 不关心具体 host URL。
4. 不维护 UI 可读的 connection slice。
5. 不导出 React hook。

`topology-client-runtime` 调用 `topology-runtime`，但不替代它。

## 4.4 `transport-runtime`

`transport-runtime` 只负责 transport。

`topology-client-runtime` 使用它完成：

1. socket profile 解析。
2. WS 连接。
3. send / receive envelope。
4. transport metrics。

`transport-runtime` 不理解：

1. request 是否完成。
2. remote command 是否开始。
3. state sync baseline 是否可前进。
4. master/slave 是否应该切换。

## 4.5 `runtime-shell`

`runtime-shell` 是唯一总装配入口。

`topology-client-runtime` 应以 runtime module 的方式接入 `runtime-shell`：

1. 提供 module manifest。
2. 注册 topology client commands。
3. 贡献公开 read model slice descriptor。
4. 在 initialize 阶段按上下文决定是否启动连接。
5. 通过 bridge 调用 `runtime-shell.handleRemoteDispatch / applyRemoteCommandEvent / getRequestProjection` 等能力。

当前 `runtime-shell` 还有一个必须补齐的能力缺口：

1. 它现在只装配自身 read model。
2. 后续必须支持模块贡献 app-wide state slices。
3. 否则 `topology-client-runtime` 的公开 read model 无法成为全局 `RootState` 的一部分。

这不是迁移妥协，而是新架构必须补齐的运行时能力。

## 4.6 `host-runtime` 与 `dual-topology-host`

`host-runtime` 负责 host pairing / session / relay。

`dual-topology-host` 只是 Node/mock shell。

`topology-client-runtime` 的定位是 host 的客户端：

1. master 端可以连接内置 host。
2. slave 端可以连接 master 暴露的 host。
3. 本地开发可以连接 `0-mock-server/dual-topology-host`。

它不应该依赖 `0-mock-server/dual-topology-host` 的实现。

---

## 5. 公开 read model

新包必须提供旧 `interconnection` 被 UI 和业务 selector 依赖的全局可读状态，但要拆清楚状态语义。

## 5.1 `topologyContext`

建议 state key：

`kernel.base.topology-client-runtime.context`

字段：

1. `instanceMode`
2. `displayMode`
3. `workspace`
4. `standalone`
5. `enableSlave`
6. `masterInfo`
7. `localNodeId`
8. `updatedAt`

语义：

1. 它是公开 read model。
2. 它由 environment + `topology-runtime` recovery state 派生。
3. 它不独立持久化。
4. 持久化真相仍在 `topology-runtime` recovery state。

`workspace` 派生规则继承旧工程：

1. `instanceMode === SLAVE && displayMode === PRIMARY` 时为 `BRANCH`。
2. 其他情况为 `MAIN`。
3. `displayMode === SECONDARY` 不自动等于 `BRANCH`。

## 5.2 `topologyConnection`

建议 state key：

`kernel.base.topology-client-runtime.connection`

字段：

1. `serverConnectionStatus`
2. `connectedAt`
3. `disconnectedAt`
4. `connectionError`
5. `connectionHistory`
6. `reconnectAttempt`
7. `lastHelloAt`
8. `lastResumeAt`

语义：

1. runtime-only。
2. 不持久化。
3. 不作为 request 真相。
4. 只用于 UI、日志、dev/test 观测。

## 5.3 `topologyPeer`

建议 state key：

`kernel.base.topology-client-runtime.peer`

字段：

1. `peerNodeId`
2. `peerDeviceId`
3. `peerInstanceMode`
4. `peerDisplayMode`
5. `peerWorkspace`
6. `connectedAt`
7. `disconnectedAt`
8. `peerConnectionHistory`

语义：

1. 替代旧 `instanceInterconnection.master.slaveConnection`。
2. 同时吸收旧 `slaveStatus` 的有效语义。
3. runtime-only。
4. 不持久化。

旧 `slaveStatus` 不再作为独立 slice 进入新架构。

原因：

1. 仓库内真实消费很少，主要出现在旧 `ui-runtime/dev` 观测。
2. 它表达的是 peer runtime info，而不是业务 state。
3. 新架构用 `topologyPeer` 明确表达即可。

## 5.4 `topologySync`

建议 state key：

`kernel.base.topology-client-runtime.sync`

字段：

1. `resumeStatus`
2. `activeSessionId`
3. `lastSummarySentAt`
4. `lastDiffAppliedAt`
5. `lastCommitAckAt`
6. `continuousSyncActive`

语义：

1. runtime-only。
2. 用于调试 resume barrier 和连续同步。
3. 不作为业务同步真相。

---

## 6. request 读模型归属

旧 `useRequestStatus` 不进入 `topology-client-runtime`。

新规则：

1. request 真相源在 `topology-runtime` owner-ledger。
2. request projection read model 在 `runtime-shell`。
3. kernel 包只导出 selector，不导出 React hook。
4. React hook 由 `2-ui` 层基于 selector 包一层。

旧 `useRequestStatus(requestId)` 的替代方向：

1. `runtime-shell` 导出 `selectRequestProjection(state, requestId)`。
2. `runtime-shell` 或 UI 层再提供 `selectCommandRequestStatus` 兼容 UI 需要的聚合结构。
3. `2-ui` 提供 `useRequestProjection` 或 `useRequestStatus` hook。

结果值来源：

1. 不再通过跨机 slice 同步拿 result。
2. 远端 command 的 result 通过 `CommandEventEnvelope` 或 `RequestLifecycleSnapshot` 回到 owner-ledger。
3. owner-ledger 生成 request projection。
4. `runtime-shell` 把 projection 同步到 read model。
5. UI 通过 selector 读取 projection。

这样比旧工程更明确：

1. slice 同步只同步业务 state。
2. request result 走控制面协议。
3. UI 仍然可以围绕 `requestId` 统一观测。

---

## 7. 公开 commands

`topology-client-runtime` 应提供正式 command，而不是让外部直接写 slice。

## 7.1 上下文命令

1. `setInstanceMode`
2. `setDisplayMode`
3. `setEnableSlave`
4. `setMasterInfo`
5. `clearMasterInfo`
6. `refreshTopologyContext`

规则：

1. command handler 同步更新 `topology-runtime` recovery state。
2. command handler 同步更新公开 `topologyContext` read model。
3. 涉及持久化字段时，`topology-runtime` 自动调度持久化。
4. 不对外 export slice action。

## 7.2 连接命令

1. `startTopologyConnection`
2. `stopTopologyConnection`
3. `restartTopologyConnection`
4. `resumeTopologySession`

规则：

1. `startTopologyConnection` 不等于 request 成功。
2. 它只代表客户端开始连接流程。
3. 连接状态必须通过 `topologyConnection` read model 观察。
4. 恢复同步必须通过 resume barrier 完成，不允许离线后无脑 flush。

## 7.3 远程命令

1. `dispatchRemoteCommand`
2. `acceptRemoteCommand`
3. `applyRemoteCommandEvent`
4. `applyRequestLifecycleSnapshot`

规则：

1. 远程命令开始前，owner-ledger 必须同步登记 request / command 状态。
2. 远端接收命令后，必须先同步写入 `started` lifecycle，再返回 accept ack。
3. 本地 `dispatchRemoteCommand` 不能只因 transport send 成功就视为业务完成。
4. command result 通过 lifecycle event / request projection 返回。

这一点继承并超越旧 `sendToRemoteExecute` 的有效设计：

1. 旧设计避免了 CommandA 提前完成但 CommandB 还没开始状态的问题。
2. 新设计把这个隐式依赖升级为正式协议约束。

## 7.4 状态同步命令

1. `sendStateSyncSummary`
2. `applyStateSyncSummary`
3. `applyStateSyncDiff`
4. `applyStateSyncCommitAck`

规则：

1. reconnect 后先 summary。
2. 对端计算 diff。
3. 本端 apply diff。
4. 本端发送 commit ack。
5. continuous baseline 只能在 commit ack 后前进。
6. 不允许把本地队列一股脑 flush 给对端。
7. continuous diff 的目标节点应优先取 `topology-runtime` 当前 sync lane 上记录的 `peerNodeId`，不能只依赖 hello ack 的 `peerRuntime`。
8. 原因是先连上的一端在首个 hello-ack 中可能拿不到 peer runtime，但它仍然需要在首轮 commit ack 后继续向已知 peer lane 发增量。

---

## 8. 旧 helper 的去向

## 8.1 `createModuleWorkspaceStateKeys`

去向：`state-runtime`。

新名字建议：

`createWorkspaceStateKeys`

原因：

1. 这是通用作用域 state key 能力。
2. 不属于拓扑连接。

## 8.2 `createModuleInstanceModeStateKeys`

去向：`state-runtime`。

新名字建议：

`createInstanceModeStateKeys`

原因同上。

## 8.3 `toModuleSliceConfigs`

去向：`state-runtime`。

新名字建议：

`toScopedSliceDescriptors`

原因：

1. 新架构不再使用旧 `ModuleSliceConfig`。
2. 应输出 `StateRuntimeSliceDescriptor`。
3. 支持 `workspace / instanceMode / displayMode` 三类 scope。

## 8.4 `dispatchWorkspaceAction`

去向：`state-runtime` 或 `runtime-shell` 模块上下文。

新名字建议：

`dispatchScopedAction`

使用约束：

1. 仅供 command handler / module internals 使用。
2. 不作为跨包公开写接口。
3. 外部仍只能通过目标包 command 写入。

## 8.5 `getWorkspace / getDisplayMode / getInstanceMode`

去向：`topology-client-runtime` selectors 与 runtime context。

规则：

1. handler 内优先使用 runtime context，不直接读全局 state。
2. selector 层可以读取 `topologyContext`。
3. UI 层通过 selector/hook 读取，不直接依赖旧 state key。

当前已落地的稳定 selector：

1. `selectTopologyInstanceMode`
2. `selectTopologyDisplayMode`
3. `selectTopologyWorkspace`
4. `selectTopologyStandalone`
5. `selectTopologyEnableSlave`
6. `selectTopologyMasterInfo`
7. `selectTopologyLocalNodeId`
8. `selectTopologyServerConnected`
9. `selectTopologyPeerConnected`
10. `selectTopologyPeerNodeId`
11. `selectTopologyScopedStateKey`

## 8.6 `selectSlaveConnected`

去向：`topology-client-runtime` selector。

新语义：

1. `selectPeerConnected`
2. `selectSlaveConnected` 可作为 UI 层兼容命名，但新 kernel API 优先使用 `peer` 语言。

当前实现结论：

1. kernel 只正式导出 `selectTopologyPeerConnected`
2. 如后续 UI/业务层仍想保留 `selectSlaveConnected` 名字，应在 `2-ui` 层自行包一层兼容 selector

## 8.7 `useRequestStatus`

去向：`2-ui`。

规则：

1. `1-kernel` 只导出 selector。
2. `2-ui` 负责 React hook。

---

## 9. 启动流程

新流程必须继承旧工程三阶段启动规则。

## 9.1 host bootstrap

职责：

1. 宿主装配 transport adapter。
2. 宿主装配 state storage / secure state storage。
3. master 主屏机需要内置 host 时，由 assembly 或 adapter 启动 `host-runtime`。
4. `topology-client-runtime` 不直接依赖 mock server shell。

## 9.2 hydrate

顺序：

1. `runtime-shell` hydrate app-wide state。
2. `topology-runtime` hydrate recovery state。
3. `runtime-shell` hydrate catalog / request projection read model。
4. `topology-client-runtime` 从 environment + recovery state 同步生成 `topologyContext`。

关键点：

1. `masterInfo` 必须在 initialize 前恢复。
2. 否则 `SLAVE` 无法重启后自动找到 master。

## 9.3 initialize

`topology-client-runtime` initialize 时判断：

1. 当前是 master 且 `enableSlave === true`，启动连接/监听流程。
2. 当前是 slave 且 `masterInfo != null`，启动连接流程。
3. 其他情况只更新 read model，不主动连。

每个环境包加载入口必须输出加载内容日志：

1. moduleName。
2. packageVersion。
3. registered commands。
4. registered slices。
5. transport profile。
6. topology context 摘要。

日志必须遵守：

1. DEV 可输出原文。
2. PROD 必须脱敏。

---

## 10. 连接与恢复流程

## 10.1 connect

流程：

1. 写 `topologyConnection.serverConnectionStatus = CONNECTING`。
2. 创建 socket runtime。
3. 发送 `NodeHello`。
4. 接收 `NodeHelloAck`。
5. 写 `CONNECTED`。
6. 更新 peer read model。

## 10.2 disconnect

流程：

1. 写 `DISCONNECTED`。
2. 记录 `disconnectedAt / connectionError / history`。
3. 停止 continuous sync。
4. 保留 recovery state。
5. 按参数触发 reconnect。

## 10.3 reconnect / resume

流程：

1. reconnect 成功后进入 resume barrier。
2. 先交换 runtime info。
3. 再交换 state summary。
4. 再应用 diff。
5. 再发送 commit ack。
6. commit ack 后才恢复 continuous sync baseline。
7. resume 完成后再允许普通 remote command 继续。

这继承旧 `interconnection` 的有效设计：

1. 离线重连不是简单 flush 本地变化。
2. 先比较 `updatedAt` 摘要，再只补差异。

---

## 11. 状态同步范围

`topology-client-runtime` 不硬编码业务包 state key。

同步范围应来自 app-wide `StateRuntimeSliceDescriptor`：

1. `syncIntent = master-to-slave`
2. `syncIntent = slave-to-master`
3. `syncIntent = bidirectional`
4. `sync` descriptor 显式声明 record entries。

旧 `statesToSyncFromMasterToSlave / statesToSyncFromSlaveToMaster` 不再保留为全局硬编码列表。

新规则：

1. slice 自己声明同步意图。
2. runtime 根据当前 topology direction 收集候选 slice。
3. `topology-runtime` 负责 summary / diff / session。
4. `state-runtime` 负责读取和应用 slice diff。
5. `topology-client-runtime` 负责发 envelope 和推进阶段。

---

## 12. 依赖方向

建议依赖方向：

1. `topology-client-runtime` 依赖 `contracts`。
2. `topology-client-runtime` 依赖 `state-runtime`。
3. `topology-client-runtime` 依赖 `topology-runtime`。
4. `topology-client-runtime` 依赖 `transport-runtime`。
5. `topology-client-runtime` 依赖 `platform-ports`。
6. `topology-client-runtime` 可以依赖 `runtime-shell` 的 module type，也可以先通过 `contracts` 中的 bridge interface 解耦。

不允许：

1. `topology-runtime` 反向依赖 `topology-client-runtime`。
2. `transport-runtime` 理解 topology 业务语义。
3. `1-kernel` 依赖 React。
4. `0-mock-server` 成为产品侧依赖。

为避免循环依赖，推荐新增轻量 bridge interface：

```ts
interface TopologyClientRuntimeBridge {
  handleRemoteDispatch(envelope: CommandDispatchEnvelope): Promise<readonly CommandEventEnvelope[]>
  applyRemoteCommandEvent(envelope: CommandEventEnvelope): void
  applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
  getRequestProjection(requestId: RequestId): RequestProjection | undefined
}
```

该 interface 可放在 `topology-client-runtime` types 中，也可后续提升到 `contracts`。

---

## 13. 测试要求

新包必须从第一版开始建立真实测试，而不是只测 reducer。

## 13.1 单进程测试

覆盖：

1. environment + recovery state 生成 `topologyContext`。
2. `instanceMode / displayMode` 改变后同步派生 `workspace`。
3. `masterInfo` 写入后进入 `topology-runtime` recovery state。
4. 公开 read model 不独立持久化。
5. command handler 不 export slice action。

## 13.2 重启恢复测试

采用 `full / seed / verify`。

覆盖：

1. `SLAVE` 写入 `masterInfo`。
2. seed flush persistence。
3. verify 全新进程 hydrate。
4. verify initialize 后能拿到 `masterInfo` 并准备连接 master。
5. `connection` / `peer` runtime-only 状态不恢复旧值。

## 13.3 双机测试

使用：

1. `host-runtime`
2. `0-mock-server/dual-topology-host`
3. `transport-runtime`
4. `runtime-shell`

覆盖：

1. master/slave hello。
2. peer connected / disconnected read model。
3. reconnect resume summary / diff / commit ack。
4. continuous sync baseline 只在 commit ack 后前进。
5. remote command started lifecycle 先同步，再允许 dispatch ack。
6. request result 最终进入 request projection。
7. `syncIntent = master-to-slave` 的首轮与连续增量都必须通过真实 `dual-topology-host` 验证。
8. `syncIntent = slave-to-master` 的首轮与连续增量也必须通过真实 `dual-topology-host` 验证。

当前已验证结论：

1. 在单向 slice 声明前提下，现有 authority 规则已经能正确覆盖 `master-to-slave` 与 `slave-to-master` 两条 lane。
2. 因此现阶段不需要额外引入更重的 authority 配置模型。
3. 下一阶段先保持 `syncIntent` 只声明单向同步，暂不开放 `bidirectional` 业务使用。

## 13.4 旧业务语义回归测试

至少要覆盖这些旧工程真实使用场景：

1. `selectSlaveConnected` 等价新 selector。
2. UI 可以读取 `instanceMode / displayMode / workspace / enableSlave / masterInfo`。
3. 业务模块可以按当前 workspace 读取 scoped state。
4. UI 可以围绕 `requestId` 读取 command started / complete / error / result。

---

## 14. 实施前置任务

在实现 `topology-client-runtime` 前，需要先补齐两个基础能力。

## 14.1 `runtime-shell` app-wide state 装配

当前 `runtime-shell` 只装配自身 read model。

需要补齐：

1. module 贡献 `StateRuntimeSliceDescriptor`。
2. `runtime-shell` 创建 app-wide state runtime。
3. `KernelRuntime.getState()` 返回 app-wide state + runtime-shell read model 的统一快照。
4. module command handler 可以通过 context 安全 dispatch scoped action。

否则新客户端包无法提供全局可读 topology state。

## 14.2 `state-runtime` scoped helper

当前这批 helper 已在 `state-runtime` 落地：

1. `createWorkspaceStateKeys`
2. `createInstanceModeStateKeys`
3. `createDisplayModeStateKeys`
4. `createScopedStateDescriptors`
5. `createScopedActionType`
6. `createScopedDispatchAction`
7. `createWorkspaceActionDispatcher`
8. `createInstanceModeActionDispatcher`
9. `createDisplayModeActionDispatcher`
10. `getScopedStateKey`

补充约束：

1. 这些 helper 保持通用，不依赖 topology。
2. scoped dispatch helper 接受显式 scope value，而不是强绑某个具体 runtime 的 route context 类型。
3. `workspace / instanceMode` 可直接复用 command route context。
4. `displayMode` 如果后续业务要参与 scoped dispatch，应由上层显式传入 scope value，而不是为了它扩大全局 command contract。

---

## 15. 设计取舍

## 15.1 不保留旧包名

不建议叫 `interconnection`。

原因：

1. 旧名字已经承载太多混合职责。
2. 新包只做 topology client orchestration。
3. 命名应直接反映它是 topology host 的 client side runtime。

## 15.2 不把 request status 放回 state sync

旧工程这块能跑，是因为 `sendToRemoteExecute` 等到了远端确认，远端确认前会同步写 request start。

新架构保留这个业务洞察，但换成正式协议：

1. 远端 accept 前必须记录 lifecycle started。
2. 本端收到 lifecycle started 后推进 owner-ledger。
3. request projection 由 owner-ledger 生成。
4. 普通 state sync 不再承担 request 正确性。

## 15.3 不为了减少包数牺牲边界

`topology-client-runtime` 的新增不是为了“多拆包”，而是为了避免：

1. `topology-runtime` 重新变成连接 manager。
2. `runtime-shell` 混入主副机策略。
3. `transport-runtime` 理解业务完成语义。

---

## 16. 当前确认点

建议确认以下设计点后再进入实现：

1. 是否接受新增 `1-kernel/1.1-base/topology-client-runtime`。
2. 是否接受 `workspace / instanceMode` helper 归入 `state-runtime`，而不是新客户端包。
3. 是否接受 `topologyContext` 是公开 read model，持久化真相仍在 `topology-runtime` recovery state。
4. 是否接受 request hook 不进入 kernel，kernel 只提供 selector。
5. 是否接受实现前先补 `runtime-shell` app-wide state 装配能力。
