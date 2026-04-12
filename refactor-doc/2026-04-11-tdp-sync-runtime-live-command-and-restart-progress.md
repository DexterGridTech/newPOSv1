# 2026-04-11 tdp-sync-runtime live command 与 restart-recovery 进展

## 1. 本次完成内容

本次把 `1-kernel/1.1-base/tdp-sync-runtime` 最关键的两条 live 闭环补齐了：

1. `tdp-sync-runtime-live-command-delivered.spec.ts`
   1. 真实启动 `mock-terminal-platform`
   2. 真实 TCP 激活
   3. 真实 TDP 握手建连
   4. 后台创建 `REMOTE_CONTROL` 发布单
   5. 客户端收到 `COMMAND_DELIVERED`
   6. 客户端同步回写 `ACK`
   7. 服务端 `command_outbox.status` 变为 `ACKED`
   8. 服务端 `task_instances.delivery_status` 变为 `ACKED`
   9. admin trace 可直接看到任务实例的 ACK 结果
2. `tdp-sync-runtime-live-restart-recovery.spec.ts`
   1. 第一个 runtime 收到真实 projection 并写入最小恢复集
   2. 显式 `flushPersistence()`
   3. 第二个全新 runtime 读取同一份文件存储
   4. 重连后按 `incremental` 模式恢复
   5. 旧 `tdpCommandInbox` 不会跨重启复活

---

## 2. 本次确认的设计结论

### 2.1 `COMMAND_DELIVERED` 的 ACK 语义已经打通

当前确认的新模型是成立的：

1. `COMMAND_DELIVERED` 只做时效性交付，不做长期离线补执行。
2. 客户端收到命令后，核心职责是：
   1. 写入 inbox 供业务消费
   2. 同步回写 `ACK`
   3. 让服务端把投递状态推进到 `ACKED`
3. 任务最终业务结果不再依赖 core 层 slice 同步，而由业务协议自己上报。

这和前面已经确认的“请求生命周期同步写 state、结果不依赖 request slice 传递”是一致的。

### 2.2 restart-recovery 继续坚持“最小恢复集”

live 场景再次验证了下面结论是正确的：

1. 只持久化 `tdpSync.lastCursor`
2. 只持久化 `tdpSync.lastAppliedCursor`
3. `tdpCommandInbox` 不持久化
4. `projection` 原始缓存也不是恢复真相源

也就是说，重启恢复关注的是“从哪里继续同步”，不是“把上次进程的运行时 inbox 原样复活”。

---

## 3. 本次通过 live 联调发现并修复的真实服务端问题

### 3.1 ACK 回写优先取错字段

文件：

1. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`

问题：

1. 原来优先把 `instanceId` 当成 `acknowledgeSessionRevision().itemKey`
2. 但 `remote.control` / `print.command` 的 ACK 应优先使用 `commandId` / `itemKey`
3. 导致 `command_outbox.command_id` 对不上

修正：

1. 改为优先传 `message.data.itemKey`
2. 只在没有 `itemKey` 时 fallback 到 `instanceId`

### 3.2 remote control payload 会被外部 `instanceId` 污染

文件：

1. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`

问题：

1. `dispatchRemoteControlRelease()` 原来先写真实实例 ID，再展开 `basePayload`
2. 如果外部 payload 自己带了 `instanceId`，会把数据库里的真实 `task_instances.instance_id` 覆盖掉
3. 结果是 command outbox 已 ACK，但任务实例无法正确推进到 `ACKED`

修正：

1. 改成先展开 `basePayload`
2. 再用真实 `instance.instance_id` 覆盖 `payload.instanceId`

这说明 `mock-terminal-platform` 现在已经不只是“假服务”，而是新 core 包联调的真实测试地基，发现 bug 就应直接修，不在客户端打补丁规避。

### 3.3 task trace 接口输出过于原始

文件：

1. `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts`

问题：

1. `getTaskTrace()` 之前主要直接返回 DB 原始字段
2. `listTaskInstances()` 用的是 camelCase 视图，但 trace 接口还是 snake_case 原始形状
3. 联调排查和测试断言都不够稳定

修正：

1. `trace.instance` 补齐 `instanceId / deliveryStatus / terminalId / createdAt` 等 camelCase 视图
2. `trace.release` 补齐 `releaseId / taskType / targetSelector / createdAt` 等视图
3. `trace.dataPlane.projections / changes` 也补齐统一的 camelCase 字段
4. 同时保留原始 DB 字段，方便底层排查

---

## 4. 当前验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/test/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-command-delivered.spec.ts 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-live-restart-recovery.spec.ts`
4. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/*.spec.ts`

当前结果：

1. `8` 个 spec 文件全部通过
2. `10` 条测试全部通过

---

## 5. 对后续迁移的意义

到这一步，`tdp-sync-runtime` 已经不只是“协议能连上”，而是已经证明了新 base 架构可以承接旧 `tdp-client` 的几个关键业务特征：

1. 真实 TCP + TDP 组合握手闭环
2. 真实后台 projection 推送
3. 真实控制信号注入
4. 真实网络中断自动重连
5. 真实 `COMMAND_DELIVERED -> ACKED`
6. 真实重启后的增量恢复

这意味着后面继续迁移 `tcp-client / tdp-client` 时，核心风险已经从“底层模型是否成立”收敛到“业务协议和业务模块怎么接入”。

---

## 6. 下一步建议

下一步建议继续顺着旧 core 收尾，不进入业务包迁移：

1. 回到 `tcp-control-runtime`，补和 `mock-terminal-platform` 更复杂的 live 场景
2. 补 `fault / scene` 组合场景，覆盖网络中断、后台数据变化、重试参数等复杂联动
3. 开始验证 `tcp-control-runtime + tdp-sync-runtime` 是否已经足以承接旧 `tcp-client / tdp-client` 的业务使用面
4. 然后再进入旧 terminal 相关 core 的正式迁移拆包
