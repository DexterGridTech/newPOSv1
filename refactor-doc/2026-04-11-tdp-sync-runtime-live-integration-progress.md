# 2026-04-11 tdp-sync-runtime 真实联调当前进展

## 1. 本次新增的真实联调覆盖

当前 `1-kernel/1.1-base/tdp-sync-runtime` 已完成以下真实 `mock-terminal-platform` 联调场景：

1. `tdp-sync-runtime-live-handshake.spec.ts`
   1. 真实启动 `mock-terminal-platform`
   2. 准备 `kernel-base-test` 沙箱
   3. 真实 TCP 激活
   4. 真实 TDP `WS` 握手
   5. 校验客户端 session/sync 状态与服务端 admin session 视图
2. `tdp-sync-runtime-live-projection.spec.ts`
   1. 后台 admin 注入 projection
   2. 客户端收到 `PROJECTION_CHANGED`
   3. 本地 projection / cursor / ack / apply 状态更新
   4. 服务端 session 的 `lastAckedRevision` / `lastAppliedRevision` 同步更新
3. `tdp-sync-runtime-live-reconnect.spec.ts`
   1. 服务端强制关闭 session
   2. 客户端按参数化间隔自动重连
   3. 重连后重新握手
   4. 重连后继续接收后台 projection 更新
4. `tdp-sync-runtime-live-control-signals.spec.ts`
   1. `EDGE_DEGRADED`
   2. `SESSION_REHOME_REQUIRED`
   3. `ERROR` 协议错误注入
5. `tdp-sync-runtime-live-command-delivered.spec.ts`
   1. 后台创建真实 `REMOTE_CONTROL` 发布单
   2. 客户端收到 `COMMAND_DELIVERED`
   3. 客户端同步回写 `ACK`
   4. 服务端 `command_outbox` 状态推进到 `ACKED`
   5. 服务端 `task_instances.delivery_status` 推进到 `ACKED`
   6. admin trace 可直接看到 ACK 后的任务实例状态
6. `tdp-sync-runtime-live-restart-recovery.spec.ts`
   1. 第一个 runtime 持久化最小恢复集
   2. 第二个 runtime 读取同一份文件存储
   3. 重连后走 `incremental` 同步
   4. 旧 `tdpCommandInbox` 不会被错误恢复
7. `tdp-sync-runtime-live-scope-priority.spec.ts`
   1. 同一 `topic + itemKey` 在 `PLATFORM / PROJECT / BRAND / TENANT / STORE / TERMINAL` 多 scope 并存
   2. 终端侧 raw projection 不覆盖
   3. 终端侧可按 `Platform < Project < Brand < Tenant < Store < Terminal` 解析最终生效值
8. `tdp-sync-runtime-live-batch-upsert.spec.ts`
   1. 后台显式 batch-upsert projection
   2. 服务端按终端聚合为正式 `PROJECTION_BATCH`
   3. 终端侧一次性接收并落地多条 item

另有包内 mock 场景：

1. `tdp-sync-runtime.spec.ts`
2. `tdp-sync-runtime-reconnect.spec.ts`

---

## 2. 当前测试结构

### 2.1 包内 helper

新增：

1. `1-kernel/1.1-base/tdp-sync-runtime/test/helpers/runtimeHarness.ts`
2. `1-kernel/1.1-base/tdp-sync-runtime/test/helpers/liveHarness.ts`

作用：

1. 区分“包内 mock 验证”与“真实 mock-terminal-platform 联调”两类测试装配。
2. 后续复杂场景都应继续拆成单独 spec 文件，不再堆到一个大测试里。

### 2.2 mock server 测试入口

新增：

1. `0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer.ts`

作用：

1. 测试进程内随机端口启动真实 HTTP + WS server。
2. 跟踪并销毁底层 socket，避免 Vitest afterEach 卡住。
3. 使用独立临时 SQLite 文件，保证 live tests 互相隔离。

---

## 3. 为真实联调修掉的真实问题

### 3.1 mock-terminal-platform 沙箱清理逻辑有真实 bug

问题：

1. `prepareKernelBaseTestSandbox()` 原先按 `sandbox_id` 删除 `terminal_credentials`。
2. 但 `terminal_credentials` 没有 `sandbox_id` 字段。
3. `task_instances` 也没有 `sandbox_id` 字段。

结果：

1. 真实 prepare 接口会直接报 SQL 错误。
2. 这不是测试假问题，而是服务端真实 bug。

修正：

1. `terminal_credentials` 改为按 `terminal_id` 间接删除。
2. `task_instances` 改为按 `release_id` 间接删除。

### 3.2 live tests 之前共享仓库数据库文件

问题：

1. 原 server 只使用固定 `mock-terminal-platform.sqlite`。
2. 多个 live spec 全量运行时会互相污染状态。

修正：

1. `database/index.ts` 支持重置 DB 连接。
2. test server 启动时切换到独立临时 SQLite 文件。
3. 关闭时恢复默认连接。

### 3.3 客户端 `PROJECTION_CHANGED` ACK 本地状态缺口

问题：

1. 客户端收到 `PROJECTION_CHANGED` 会发 `ACK`。
2. 但本地 `lastAckedCursor` 没同步更新。
3. 导致客户端 state 与服务端 session 视图存在语义不一致。

修正：

1. `PROJECTION_CHANGED` 与 `PROJECTION_BATCH` 分支在发送 `ACK` 前同步更新本地 `lastAckedCursor`。

### 3.4 mock-terminal-platform 的 remote control ACK 链路有真实 bug

问题：

1. `wsServer` 原先 ACK 回写优先把 `instanceId` 传给 `acknowledgeSessionRevision()`。
2. `dispatchRemoteControlRelease()` 原先会让外部 payload 的 `instanceId` 覆盖真实 `task_instances.instance_id`。
3. 结果是 `command_outbox` 和 `task_instances` 的 ACK 链路会断开。

修正：

1. `wsServer` 改为优先使用 `message.data.itemKey`，只在缺失时才 fallback 到 `instanceId`。
2. `dispatchRemoteControlRelease()` 改为始终让真实 `instance.instance_id` 覆盖 payload 里的同名字段。
3. `getTaskTrace()` 补齐 camelCase 视图字段，方便测试与联调直接断言。

### 3.5 TDP projection 模型原先不支持真正业务数据面

问题：

1. 原先 projection 唯一键只有 `topic + scopeType + scopeKey`。
2. 同一 topic 下无法按业务 `itemKey` 并存多条数据。
3. 原先终端同步链路只接收 `scopeType = TERMINAL` 的投影。
4. 这会直接卡住 workflow definitions、systemParameters、errorMessages 等需要“同 topic 多 item、多 scope 覆盖”的真实场景。

修正：

1. `mock-terminal-platform` projection / change-log 模型已升级为：
   1. `topicKey`
   2. `scopeType`
   3. `scopeKey`
   4. `itemKey`
2. `tdp_change_logs` 已增加 `targetTerminalId`，所以所有 scope 的变更都能进入终端游标体系。
3. 终端 snapshot / incremental changes 已按 `targetTerminalId` 收全量 scope 投影。
4. 终端 raw projection state 已改为 `topic -> bucket(scopeType:scopeId:itemKey)`。
5. 新增按优先级读取 selector，顺序固定为：
   1. `Platform`
   2. `Project`
   3. `Brand`
   4. `Tenant`
   5. `Store`
   6. `Terminal`

### 3.6 mock-terminal-platform 已具备正式 batch projection API

本轮新增：

1. `POST /api/v1/admin/tdp/projections/batch-upsert`

能力：

1. 一次请求提交一个 projection 列表。
2. 每条 projection 用 `itemKey` 区分。
3. 支持 `operation: upsert | delete`。
4. 服务端会按目标终端聚合后正式下发 `PROJECTION_BATCH`。

这意味着后续业务不需要依赖“时间窗碰巧合并”为 batch，而是可以明确使用 batch API。

---

## 4. 当前已验证命令/协议闭环

已通过真实联调验证的内容：

1. TCP 激活获取 `terminalId + token`
2. TDP `HANDSHAKE`
3. `SESSION_READY`
4. `FULL_SNAPSHOT`
5. `PROJECTION_CHANGED`
6. `ACK`
7. `STATE_REPORT`
8. 服务端 session ack/apply 观测
9. 强制断线后的自动重连
10. 重连后的重新握手
11. `EDGE_DEGRADED`
12. `SESSION_REHOME_REQUIRED`
13. `ERROR`
14. `COMMAND_DELIVERED`
15. `command_outbox ACK`
16. `task_instances.delivery_status ACK`
17. 重启后按持久化 cursor 增量恢复

---

## 5. 当前验证命令

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/test/tsconfig.json --noEmit`
2. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/*.spec.ts`

当前结果：

1. `8` 个 spec 文件全部通过
2. 当前 `15` 个 spec 文件全部通过
3. 当前 `17` 条测试全部通过

---

## 6. 下一步

下一步仍然聚焦 old core -> new base，不进入业务包迁移。

优先顺序：

1. 补 `mock-terminal-platform` 的 fault / scene 联动场景
2. 继续把 `errorMessages / systemParameters` 迁移成基于 TDP topic 的动态配置面
3. 继续验证 `tcp-control-runtime + tdp-sync-runtime` 对旧 terminal core 的承接面
4. 回查 `topology-client-runtime` 的 `WS` 重连策略，统一成与 TDP 相同的策略模型：
   1. 默认无限重连
   2. 重连间隔参数化
   3. 测试可限制重连次数
