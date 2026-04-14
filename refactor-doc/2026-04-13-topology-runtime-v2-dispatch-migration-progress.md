# 2026-04-13 topology-runtime-v2 dispatch 迁移进展

## 1. 本轮目标

本轮只收口 `topology-runtime-v2` 的一个关键缺口：

1. 远端 command live roundtrip 语义补齐。
2. request / query / projection 的 started 与 completed 语义对齐旧拓扑。
3. 不改旧包，只修正 `runtime-shell-v2` + `topology-runtime-v2` 的 v2 实现。

## 2. 本轮完成项

### 2.1 修复 topology-runtime-v2 公共导出冲突

问题：

1. `TopologyV2ProjectionState` 同时从 `types/state.ts` 和 `features/slices/projectionState.ts` 暴露，导致 `src/index.ts` 聚合导出时报 `TS2308`。

处理：

1. 统一以 `types/state.ts` 为公共类型真相源。
2. `projectionState.ts` 改为直接引用 `../../types` 中的 `TopologyV2ProjectionState`。

结果：

1. `@impos2/kernel-base-topology-runtime-v2` 的 `type-check` 恢复通过。

### 2.2 对齐远端 dispatch 的 started 屏障语义

旧拓扑的关键语义是：

1. `dispatchRemoteCommand()` 返回时，只要求远端已经开始执行。
2. 最终完成态通过 request snapshot / projection / selector 持续观察，而不是阻塞在 dispatch 返回值里。

本轮在 `topology-runtime-v2/src/foundations/orchestrator.ts` 做了三件事：

1. 新增 `waitForRemoteStarted()`，改为等待远端 command 在 owner 本地 request ledger 中出现第一个 actorResult。
2. `dispatchRemoteCommand()` 不再等待 `waitForRemoteResult()`，而是等待 `waitForRemoteStarted()`。
3. 远端收到 `command-dispatch` 后，会立刻回发一个 `command-event.started`，再继续本地执行和最终 completed / failed 回传。

结果：

1. `dispatchPeerCommand` 不再卡死等待远端完成。
2. v2 行为重新回到旧拓扑“started barrier + selector 持续观察”的模型。

### 2.3 修复 owner 侧 mirrored command 预注册时机

问题：

1. 之前 mirrored command 是在远端收到 `command-dispatch` 后才注册。
2. 这样 owner 收到远端 `command-event` 时，本地 request ledger 里还没有对应 command 节点，事件无法挂入 request 树。

处理：

1. 在 owner 发出 `command-dispatch` 之前，先 `registerMirroredCommand(...)`。
2. 远端执行侧不再重复注册 mirrored command，而是直接发送 started / completed / failed 事件。

结果：

1. owner 本地 request query 能完整观测远端 command 的 started -> completed 生命周期。

### 2.4 修复 request query 的 completedAt 语义

问题：

1. `runtime-shell-v2` 的 `RequestLedger.toAggregate()` 会把未完成 command 的 `completedAt` 自动补成 `nowTimestampMs()`。
2. 这会让 selector / query 把“started 但未完成”的 command 错判成“已完成”。

处理：

1. `CommandAggregateResult.completedAt` 改为可选。
2. `RequestLedger.toAggregate()` 对未完成 command 不再伪造 `completedAt`。

结果：

1. request selector / query 的 completed 判定恢复准确。
2. `topology-runtime-v2` live roundtrip 测试可以真实区分 started 与 completed。

## 3. 本轮验证结果

已通过：

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
3. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test -- --runInBand`

当前 `topology-runtime-v2` 已通过的 live 关键场景：

1. dual-topology-host 基础双端连接。
2. projection mirror 转发到 owner read model。
3. public topology command 驱动远端 command，并通过 request query 观察最终完成结果。

## 4. 本轮涉及文件

1. `1-kernel/1.1-base/topology-runtime-v2/src/features/slices/projectionState.ts`
2. `1-kernel/1.1-base/topology-runtime-v2/src/foundations/orchestrator.ts`
3. `1-kernel/1.1-base/runtime-shell-v2/src/types/command.ts`
4. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/requestLedger.ts`

## 5. 当前剩余缺口

这部分结论在后续补测后已经更新。

当前 `topology-runtime-v2` 已经补齐并通过真实联调的 live 能力包括：

1. dual-topology-host 基础双端连接
2. remote command roundtrip
3. request snapshot / projection mirror
4. state sync 首轮 summary / diff
5. state sync continuous master -> slave
6. state sync continuous slave -> master
7. relay disconnect 后 reconnect + resume + continuous sync 恢复

因此本文件后续记录的重点，不再是“topology 自身还有没有基础缺口”，而是“相关运行时如何稳定建立在这条拓扑 v2 基线上”。

## 6. 本轮补充修复：state sync continuous lane authority

### 6.1 问题现象

在 `topology-runtime-v2` 新增的两个 live state sync 用例里：

1. 首轮 resume summary/diff 可以成功落地。
2. 首轮同步后，`continuousSyncActive` 也会进入 `true`。
3. 但 authoritative 侧后续再次更新 slice 时，不会继续向对端发送 diff。

运行期诊断结论：

1. `master-to-slave` 场景里，master 首轮数据能同步到 slave。
2. master 第二次更新后，master 本地 slice 已更新，但 slave 保持旧值。
3. 两端 `lastCommitAckAt`、`lastDiffAppliedAt` 都不再推进，说明问题不在 diff apply，而在 authoritative 侧没有继续发出 diff。

### 6.2 根因

`topology-runtime-v2/src/foundations/orchestrator.ts` 中：

1. `getAuthoritativeDirection()` 被实现成了 `getContinuousDirection()`。
2. 这会让 master 侧在连续同步阶段错误地把 authoritative lane 判成 `slave-to-master`。
3. 结果是 master 后续本应继续推进的 `master-to-slave` lane 被跳过，continuous diff 永远不会再发。

旧 `topology-client-runtime` 的正确规则是：

1. 本机 `MASTER` 负责 `master-to-slave`
2. 本机 `SLAVE` 负责 `slave-to-master`

也就是 authoritative lane 只看本机 `instanceMode`，不跟随 `peerRole` 动态切换。

### 6.3 修复

处理：

1. 在 `topology-runtime-v2/src/foundations/orchestrator.ts` 中新增 `resolveAuthoritativeDirection(localInstanceMode)`。
2. `getAuthoritativeDirection()` 改为只根据本机 `instanceMode` 返回 `SLAVE -> slave-to-master`，其他情况返回 `master-to-slave`。

结果：

1. `master-to-slave` 场景下，master 第二次更新后会继续发出 continuous diff。
2. `slave-to-master` 场景下，slave 第二次更新也会继续发出 continuous diff。
3. v2 的 continuous lane authority 已重新对齐旧拓扑。

## 7. 本轮验证结果补充

新增通过：

1. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 exec vitest run test/scenarios/topology-runtime-v2-live-state-sync-master-to-slave.spec.ts --testTimeout=20000`
2. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 exec vitest run test/scenarios/topology-runtime-v2-live-state-sync-slave-to-master.spec.ts --testTimeout=20000`
3. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test`

当前 `topology-runtime-v2` 已覆盖的 live 能力包括：

1. dual-topology-host 基础双端连接
2. request / remote command roundtrip
3. projection mirror 转发
4. state sync 首轮 summary/diff
5. state sync continuous master -> slave
6. state sync continuous slave -> master

## 8. 当前判断

结论：

1. `topology-runtime-v2` 已经跨过“只能连通、不能稳定承接远端 command”的阶段。
2. 现在它已经具备稳定的远端 command roundtrip、request snapshot / projection mirror、topology state sync、以及 reconnect/resume 恢复基线。
3. 下一步重点已经从 topology 自身补洞，切换为让后续 v2 使用方逐步消费这条 peer route 基线。

## 9. 本轮补充修复：reconnect listener 丢失与重连职责收口

### 9.1 问题现象

在新增 live 用例 `topology-runtime-v2-live-reconnect-state-sync-master-to-slave.spec.ts` 里，现象是：

1. host 侧故障注入后，目标 slave 连接会被真实断开。
2. slave 侧能够发起新的 websocket 连接，并再次发送 `node-hello`。
3. 但 reconnect 后 host 长时间等不到新的 resume 闭环，随后把新连接以 `heartbeat-timeout` 清理掉。

### 9.2 根因

根因不在 host，而在 `topology-runtime-v2` 自己的连接生命周期管理：

1. `startConnection()` 每次重连都会再次调用 `socketRuntime.registerProfile(...)`。
2. `SocketRuntime.registerProfile()` 当前实现会直接替换对应 profile 的 managed connection。
3. `topology-runtime-v2` 的 `attachListeners()` 又被 `listenersAttached` 防重保护，所以旧 listener 不会重新绑到新 managed connection 上。

结果：

1. reconnect 后虽然 socket 能连上、hello 也能发出去。
2. 但 `node-hello-ack`、`resume-*`、`__host_heartbeat` 这些入站消息已经没有 listener 接收。
3. 最终表现成“看起来重连了，但拓扑语义没恢复”。

### 9.3 修复

本轮把 `topology-runtime-v2` 的连接模型收口到和 `topology-client-runtime` 一致：

1. orchestrator 创建时，如果 binding 带 profile，只注册一次 `registerProfile(profile)`。
2. `attachListeners()` 只绑定一次，贯穿整个 orchestrator 生命周期，不再在 stop/restart 时拆掉重绑。
3. `startConnection()` 改为只做 `connect()`，不再重复注册 profile。
4. 增加 `connectionToken`，防止旧的异步 connect 在新的 connect 之后回流污染状态。
5. `stopConnection()` 只负责清理 reconnect timer、增加 token、断开当前连接，不再破坏 listener 绑定。

### 9.4 transport-runtime 职责回退

本轮还把之前临时加到 `transport-runtime` 的自动重连补丁回退掉。

原因：

1. `topology-runtime-v2`、`topology-client-runtime`、`tdp-sync-runtime-v2` 都有自己的业务级重连语义。
2. transport 层自动重连会和这些 orchestrator / session runtime 的调度器形成双重拥有者，制造竞态。
3. 这类重连必须由上层 runtime 自己控制，transport 只负责连接、收发、事件分发。

### 9.5 本轮验证结果补充

新增通过：

1. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 exec vitest run test/scenarios/topology-runtime-v2-live-reconnect-state-sync-master-to-slave.spec.ts --testTimeout=30000`
2. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 exec vitest run --testTimeout=30000`
3. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-transport-runtime type-check`

当前已确认：

1. reconnect 后 slave 会重新 hello。
2. host 会重新开始并完成 resume。
3. reconnect 后 continuous authoritative sync 会继续推进，而不是 blind flush。
4. `transport-runtime` 已恢复为纯 transport，不再偷偷接管业务重连。

### 9.6 当前下一步

`topology-runtime-v2` 当前已经具备：

1. live connect
2. remote command roundtrip
3. projection mirror
4. state sync baseline
5. state sync continuous sync
6. relay disconnect 后 reconnect + resume + continuous sync 恢复

接下来应转向：

1. 识别哪些后续 v2 runtime 或业务迁移线真正需要 peer dispatch / request mirror / state sync
2. 按需接入 `runtime-shell-v2.installPeerDispatchGateway(...)` 与 `topology-runtime-v2`，而不是先在所有包里泛化接线
3. 保持“拓扑能力被消费，但业务包不反向侵入拓扑实现”的边界

## 10. 本轮补充：tdp-sync-runtime-v2 system catalog live 闭环

### 10.1 目标

补齐之前只在非 live 层面覆盖的基础 topic 下发场景：

## 11. 本轮补充：runtime-shell-v2 并发 command 重入判定收窄，修复 TDP restart recovery 波动

### 11.1 问题现象

`tdp-sync-runtime-v2-live-restart-recovery.spec.ts` 之前间歇性失败，失败时表现稳定一致：

1. 第二个 runtime 已经成功从本地持久化恢复 `lastCursor=1 / lastAppliedCursor=1`。
2. reconnect 后 websocket `HANDSHAKE` 成功，`SESSION_READY.syncMode === 'incremental'`。
3. mock-terminal-platform admin 接口也确认 `cursor=2` 的增量变更已经存在。
4. 但客户端 projection 仓库一直停留在旧 revision，`lastCursor` 也停留在 1，不再前进。

也就是说，问题不是持久化恢复失败，而是 reconnect 后的第一批增量消息偶发没有进入本地 command/actor 链路。

### 11.2 根因

根因不在 TDP 协议本身，而在 `runtime-shell-v2` 的默认 command re-entry 防护过宽：

1. 当前实现把 `commandName + actorKey` 作为全局重入键。
2. 只要某个 actor 还在执行同名 command，另一个不同 `requestId` 的同名 command 也会被误判为“重入”。
3. TDP websocket reconnect 时，服务端会连续推送 `SESSION_READY` 和 `CHANGESET`。
4. 第一条 `tdpMessageReceived` 还在 await 子 command 时，第二条 `tdpMessageReceived` 进来就可能被错误拦截。

结果：

1. `SESSION_READY` 可以成功写入 session state。
2. 紧随其后的 `CHANGESET` 偶发被 runtime-shell-v2 自己拒绝。
3. 最终表现成“incremental ready 了，但游标和 projection 没继续推进”。

### 11.3 修复

本轮把 `runtime-shell-v2` 的 re-entry 判定收窄为“同一 request 内的递归重入”，不再错误阻止跨 request 的正常并发：

1. `executionStack` 记录项增加 `requestId`。
2. `createKernelRuntimeV2.ts` 中的重入检查从 `commandName + actorKey` 改为 `requestId + commandName + actorKey`。
3. 这样仍然可以防止 actor 在同一 request 树里递归调用自身形成死循环。
4. 但 websocket / topology / transport 这类不同 request 的入站消息不会再互相误伤。

### 11.4 回归测试

补充：

1. `runtime-shell-v2/test/scenarios/runtime-shell-v2.spec.ts`
2. 新增“same command + same actor 在不同 request 下允许并发执行”的回归用例。

验证：

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`

### 11.5 TDP 回归结果

修复后：

1. `tdp-sync-runtime-v2-live-restart-recovery.spec.ts` 连续高频运行 12 次全部通过。
2. 临时调试输出已从该 spec 清理。
3. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`

均已通过。

### 11.5.1 横向 v2 回归补充

在 topology 初始化与 precheck 语义收口后，已再次完成横向整包回归：

1. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test`
2. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 test`
3. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
4. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`

当前结论：

1. `topology-runtime-v2` 的 initialize 自动连接、连接 precheck、reconnect / resume 语义不会再打坏其它 v2 runtime 的现有联调链路。
2. `runtime-shell-v2` 的 request 级 re-entry 收窄，已经成为当前四个 v2 runtime 的稳定公共底座。

### 11.6 对 topology-runtime-v2 的意义

这次修复不是只服务 TDP。

`topology-runtime-v2`、后续 `tcp-control-runtime-v2`、`workflow-runtime-v2` 也都建立在同一个 `runtime-shell-v2` 广播 command 模型上。把并发消息误判为 re-entry 的问题在任何 websocket / relay / 外部事件密集场景下都可能出现。

因此本轮结论是：

1. `allowReentry` 仍然只代表“允许同一 request 树里的递归重入”。
2. 不同 request 的同名 command 并发，本来就属于正常执行模型，runtime-shell-v2 不应阻止。
3. 这条规则应作为后续 v2 runtime 迁移的基础约束继续沿用。

## 12. 本轮补充：topology initialize / precheck 语义收口

### 12.1 处理目标

把 topology 自动连接的触发时机正式收口到 `runtime-shell-v2.initialize` 生命周期，而不是模块安装期。

### 12.2 处理

本轮新增并收口了下面语义：

1. `topology-runtime-v2` 新增 `initializeActor`
2. 自动连接不再在 module install 时抢跑，而是在 runtime initialize 后按参数延迟调度
3. `startConnection()` 增加 precheck：
   1. `SLAVE` 必须具备 `masterInfo.serverAddress`
   2. `MASTER` 的 auto 模式要求 `standalone === true` 且 `enableSlave === true`
4. 非 reconnect 场景下：
   1. precheck 失败返回结构化 `connectionPrecheckFailed`
   2. 首次 connect 失败返回结构化 `connectionFailed`
5. reconnect 场景仍维持“更新状态并继续调度”，不向外抛出启动级错误

### 12.3 意义

这让 topology v2 的连接模型进一步贴近旧工程里“runtime hydrate 完成后再 initialize”的原则，同时保留现在已经验证通过的 reconnect / resume 闭环。

## 13. 本轮额外结构收口

1. `transport-runtime` 已删除历史遗留的 `dual-topology-socket-runtime.spec.ts`
2. 原因是这条测试在验证旧 `runtime-shell` + 旧 `topology-runtime` 集成，不属于纯 transport 包职责
3. 收口后，`transport-runtime` 不再在测试层继续挂着旧执行模型依赖

1. `error.message`
2. `system.parameter`

这两个 topic 是基础例外桥接，由 `tdp-sync-runtime-v2` 消费通用 `tdpTopicDataChanged` 后再调用 `runtime-shell-v2` 的 catalog command 更新基础状态。

### 10.2 新增验证

新增测试：

1. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-system-catalog.spec.ts`

覆盖链路：

1. 启动真实 `mock-terminal-platform` test server。
2. 启动真实 TCP v2 + TDP v2 runtime。
3. 终端激活并建立 TDP websocket session。
4. 通过 `mock-terminal-platform` admin batch-upsert 下发：
   1. `error.message`
   2. `system.parameter`
5. 同时写入 `STORE` 与 `TERMINAL` 两层数据，验证终端优先级生效为 `TERMINAL`。
6. 删除 `TERMINAL` 层数据，验证生效值回退到 `STORE`。
7. 删除 `STORE` 层数据，验证 runtime-shell catalog 彻底移除对应 key。

### 10.3 顺手修复

修复 `tdp-sync-runtime-v2/package.json` 漏声明依赖：

1. 新增 `@impos2/kernel-base-transport-runtime`

原因：

1. `tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts` 直接 import `createHttpRuntime` / `HttpTransport`。
2. 包依赖声明必须和源码 import 边界一致，不能只靠 workspace 提升或测试环境间接可见。

### 10.4 验证结果

已通过：

1. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 exec vitest run test/scenarios/tdp-sync-runtime-v2-live-system-catalog.spec.ts`
2. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
3. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

## 11. 本轮补充：transport-runtime 重连语义收口

### 11.1 问题

在前面回退 `transport-runtime` 自动重连后，还残留了一组不干净的语义：

1. transport 不再真正发起 reconnect。
2. 但 `socketRuntime` 仍会在 `onClose` 后发出：
   1. `state-change -> reconnecting`
   2. `reconnecting` 事件

这会让上层 runtime 误以为 transport 自己正在重连，属于假的状态语义。

### 11.2 处理

本轮把 `transport-runtime` 收回到纯 transport 抽象：

1. 删除 `SocketConnectionState` 里的 `reconnecting`
2. 删除 `SocketEventType` 里的 `reconnecting`
3. 删除 `SocketReconnectingEvent`
4. 删除 `socketRuntime.onClose()` 中伪造的 reconnecting 状态推进和事件发射
5. `tdp-sync-runtime-v2` 删除对 transport `reconnecting` 事件的监听，重连状态完全由自己的 `scheduleReconnect()` 驱动

### 11.3 验证

已通过：

1. `corepack yarn workspace @impos2/kernel-base-transport-runtime type-check`
2. `corepack yarn workspace @impos2/kernel-base-transport-runtime test`
3. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

### 11.4 说明

当前判断：

1. transport 层只提供 connect / disconnect / send / message / error / disconnected 这些基础语义。
2. 任何业务级 reconnect/backoff/resume，都应由 `topology-runtime-v2`、`tdp-sync-runtime-v2` 这类上层 runtime 自己负责。
3. 这样更符合之前确认的“transport 语义与业务完成语义不要再混”的目标。
