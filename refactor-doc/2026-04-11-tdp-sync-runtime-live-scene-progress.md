# 2026-04-11 tdp-sync-runtime live scene 联动进展

## 1. 本次完成内容

本次补上了 `tcp-control-runtime + tdp-sync-runtime + mock-terminal-platform scene` 的三条真实联合链路：

1. 客户端真实激活终端
2. 客户端真实建立 TDP session
3. 后台运行 `scene-batch-terminal-online`
4. scene 通过真实 `task release -> task instances -> dispatch to data plane`
5. 客户端收到 `tcp.task.release` projection
6. 客户端推进 `lastCursor / lastAckedCursor / lastAppliedCursor`
7. 服务端任务实例进入 `DELIVERED / ACKED` 观测态

对应新增测试：

1. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-scene-batch-terminal-online.spec.ts`
2. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-scene-sequential-progress.spec.ts`
3. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-scene-reconnect-recovery.spec.ts`

其中新增覆盖：

1. 同一终端连续两次运行 scene，cursor 和 projection revision 持续推进
2. scene 推进后强制断线，客户端自动重连后继续按 `incremental` 模式接收下一次 scene 更新

---

## 2. 本次发现并修复的真实 scene 缺口

### 2.1 scene 模板描述与实现不一致

文件：

1. `0-mock-server/mock-terminal-platform/server/src/modules/scene/service.ts`

问题：

1. `scene-batch-terminal-online` 的 steps 写的是 `dispatch to tdp`
2. 但实现原先只做到：
   1. 批量创建终端
   2. 创建发布单
   3. 创建实例
3. 并没有真正调用 `dispatchTaskReleaseToDataPlane()`

修正：

1. scene 模板现在会真实进入数据面投递
2. 返回结果也会带上 `tdp`

### 2.2 scene 之前无法命中当前已连接终端

问题：

1. `scene-batch-terminal-online` 原先固定把新批量造出来的终端作为目标
2. 这导致 live 测试中“当前已连接的终端”根本不会收到 scene 推送
3. 所以没法用 scene 验证真实在线客户端行为

修正：

1. `runSceneTemplate()` 现在接收可选输入：
   1. `targetTerminalIds`
   2. `batchCount`
2. admin route 已透传 `req.body`
3. live harness 已支持 `runSceneTemplate(sceneTemplateId, body)`

这不是为了测试特判，而是把 scene 真正变成“可控联调工具”，更符合它在 mock 平台中的角色。

### 2.3 数据面 dispatch 返回值之前缺少 mode

文件：

1. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`

问题：

1. `dispatchTaskReleaseToDataPlane()` 在 projection 模式下之前没返回 `mode`
2. admin 侧无法稳定区分 `PROJECTION / COMMAND`

修正：

1. projection 模式现在显式返回 `mode: 'PROJECTION'`

---

## 3. 当前验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/test/tsconfig.json --noEmit`
2. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-scene-batch-terminal-online.spec.ts`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/*.spec.ts`

当前结果：

1. `11` 个 spec 文件全部通过
2. `13` 条测试全部通过

---

## 4. 这一步意味着什么

到这一步，新的 base 架构已经不只是验证单点能力，而是开始验证真实后台动作驱动下的组合链路：

1. TCP 激活提供 terminal identity + credential
2. TDP session 提供数据面接收能力
3. scene 提供后台连续动作入口
4. projection 与 task delivery 状态能在真实 server/client 间闭环
5. scene 连续多次推进时，cursor / revision 仍然稳定单调前进
6. scene 推进后断线重连，仍能继续走增量恢复

这比单独测：

1. activate
2. handshake
3. projection
4. command

更接近旧 terminal core 在真实业务里的工作方式。

---

## 5. 下一步建议

建议继续沿 scene 级组合场景推进：

1. scene 与 topology / dual-topology 侧联动的后续验证
2. 如果这些都稳定，再决定是否值得把 fault rule 真正下沉成 transport 行为注入

## 6. 补充：remote control delivery + result 两阶段闭环

本轮额外补上了 `REMOTE_CONTROL` 的两阶段业务闭环：

1. 服务端创建 `REMOTE_CONTROL` 发布单
2. TDP 推送 `COMMAND_DELIVERED`
3. 客户端写入 `tdpCommandInbox`
4. 客户端通过 TDP 回写 ACK
5. 服务端 `command_outbox.status` 推进到 `ACKED`
6. 服务端 `task_instances.delivery_status` 推进到 `ACKED`
7. 客户端再通过 `tcp-control-runtime.reportTaskResult` 回报同一个 `instanceId` 的最终业务结果
8. 服务端 `task_instances.status` 推进到 `COMPLETED`
9. admin trace 能同时看到：
   1. `deliveryStatus: ACKED`
   2. `status: COMPLETED`
   3. result payload

对应新增测试：

1. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-command-result-roundtrip.spec.ts`

当前验证结果更新为：

1. `13` 个 spec 文件全部通过
2. `15` 条测试全部通过

这个测试明确验证了 delivery 与 result 是两阶段语义：

1. TDP 负责命令送达和 ACK
2. TCP 负责最终任务结果回报

这与旧工程中“请求/命令状态不能只看本地主命令结束”的业务经验是相容的。

## 7. 补充：多终端同时在线批量 scene 投递

本轮继续补上了多终端同时在线的 scene 批量投递验证：

1. 同一个真实 `mock-terminal-platform`
2. 两个独立 runtime
3. 两个不同 `localNodeId`
4. 两个不同激活码
5. 两个真实 TDP session
6. 后台运行一次 `scene-batch-terminal-online`
7. scene 目标同时包含两个在线终端
8. 两个 runtime 都收到同一个 release 对应的 `tcp.task.release` projection
9. 两个 runtime 各自推进自己的 `lastCursor / lastAckedCursor / lastAppliedCursor`
10. 服务端生成两个 task instance，且两个实例都进入 `DELIVERED / ACKED`

对应新增测试：

1. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-scene-multi-terminal.spec.ts`

这个测试证明：

1. 当前 TDP 数据面不是只能服务单终端单连接
2. scene 批量投递可以被多个在线终端同时消费
3. 不同 runtime 的 cursor / projection 状态不会互相污染

这一步之后，旧 `tcp-client / tdp-client` 迁移前的 terminal 数据面主链路风险已经明显收敛。
