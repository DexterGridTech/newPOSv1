# TDP Projection Lifecycle / TTL 实施日志

> 日期：2026-04-29  
> 依据：
> - `as-result/2026-04-29-tdp-projection-lifecycle-ttl-implementation-plan.md`
> - `ai-result/2026-04-29-tdp-projection-lifecycle-ttl-implementation-plan-v2.md`

## 阶段 0：决策确认和防线测试

### 产品/技术决策

1. 第一批 expiring topic 只启用 `order.payment.completed`。
2. 第一阶段不新增 `tdp_projection_lifecycle_events` 表。TDP 只保证到期前投递、到期后 tombstone 收敛；过期后不承诺历史 payload 查询。若后续需要审计历史，应在专门审计/事件表中脱敏保存，而不是依赖 projection 当前态。
3. TTL 是 projection 生命周期，不是业务实体生命周期；到期动作必须生成带 cursor 的 delete/tombstone，不能静默删除。

### 红灯测试计划

- 服务端新增 `tdp-projection-lifecycle.spec.ts`：
  - `persistent` topic 携带 `ttlMs` 必须拒绝。
  - `command-outbox` topic 通过 projection upsert 必须拒绝。
  - `order.payment.completed` 写入 TTL 后，TTL 内 snapshot 可见，TTL 后即使 scheduler 未执行 snapshot 也不可见。

### 阶段 0/1/2 部分验证记录

1. 红灯验证：
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server test -- src/test/tdp-projection-lifecycle.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：新增 3 个用例失败，原因分别是 TTL 被 persistent topic 接受、command-outbox topic 被 projection upsert 接受、`expiresAt` 未返回。
2. 变更：
   - 新增 `tdp/lifecyclePolicy.ts`，统一解析 topic policy 和 TTL 计算。
   - 扩展 `tdp_topics`、`tdp_projections`、`tdp_terminal_projection_access`、`tdp_change_logs`、`tdp_projection_source_events` schema/migration。
   - `upsertProjectionBatch` 接入 lifecycle 校验和 `expiresAt` 写入，`source_event_id` 重放返回原始 lifecycle/expiresAt。
   - snapshot 查询增加 `(expires_at IS NULL OR expires_at > now)` 过滤。
3. 绿灯验证：
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server type-check`
   - 结果：通过。
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server vitest run src/test/tdp-projection-lifecycle.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：3 tests passed。

## 阶段 2：服务端 scheduler 初步实现

### 变更

- 新增 `tdp/expiryScheduler.ts`：
  - `runTdpProjectionExpiryOnce` 支持 claim、claim timeout、per terminal tombstone 事务、`tombstone_key` 幂等、提交后在线推送。
  - `getTdpProjectionExpiryStats` 和 `startTdpProjectionExpiryScheduler`。
- 新增 admin API：
  - `POST /api/v1/admin/tdp/projections/expire/run-once`
  - `GET /api/v1/admin/tdp/projections/expiry-stats`
- 服务启动时开启 projection expiry scheduler。

### 验证

1. 红灯：
   - 新增 `generates idempotent TTL tombstones with terminal cursors` 后，先失败于 run-once endpoint 不存在。
2. 修复中发现并处理：
   - `sqlite.transaction(...)` 如果在模块加载时创建，会绑定测试重置前的旧 sqlite 连接，run-once 报 `The database connection is not open`。
   - 处理：事务函数改为运行时基于当前 `sqlite` 连接创建并立即执行。
3. 绿灯：
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server type-check && corepack yarn workspace @next/mock-terminal-platform-server vitest run src/test/tdp-projection-lifecycle.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：type-check 通过，4 tests passed。

## 阶段 2 补强：scheduler、topic subscription、backpressure 和导入兼容

### 变更

- `tdp/lifecyclePolicy.ts`
  - 内置 `order.payment.completed` 为第一批 `expiring + projection` topic。
  - `remote.control` 等 command topic 走 `command-outbox`，projection upsert 直接拒绝。
  - TTL 基准统一为 `occurredAt ?? serverNow`。
  - `persistent` topic 携带 `ttlMs/expiresAt` 拒绝，`expiring` topic 校验 min/max/default TTL。
- `tdp/service.ts`
  - `tdp_projections`、`tdp_terminal_projection_access`、`tdp_change_logs` 写入 `lifecycle/expiresAt/changeReason/tombstoneKey`。
  - snapshot 查询增加 `operation != 'delete'` 和 `(expires_at IS NULL OR expires_at > now)`，不依赖 scheduler。
  - changes 查询保留历史 upsert/delete 顺序，只按 cursor/topic/subscription 分页。
  - `source_event_id` 幂等重放返回原始 `expiresAt` 和 `IDEMPOTENT_REPLAY`，不刷新 TTL。
- `tdp/expiryScheduler.ts`
  - claim expired projections，逐 terminal tombstone 事务写入，`tombstone_key` 幂等。
  - `maxTombstonesPerRun` 控制单轮 tombstone 上限，未处理完的 projection 重新回到 pending。
  - 事务提交后再推送在线 session，并复用 session subscription 过滤。
  - 暴露 `runOnce` 结果和 `expiry-stats` 指标。
- `sandbox/service.ts`、`export/importService.ts`
  - seed/import/export topic lifecycle 字段兼容，旧数据默认 `persistent`。
- `tdp-dynamic-group.spec.ts`
  - 修正 dynamic group fanout 回归，确保 TTL lifecycle 字段不会破坏 group/policy 投递。

### 验证

1. 服务端 type-check：
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server type-check`
   - 结果：通过。
2. 服务端专项 + 回归：
   - 命令：`corepack yarn workspace @next/mock-terminal-platform-server test -- src/test/tdp-projection-lifecycle.spec.ts src/test/tdp-dynamic-group.spec.ts src/test/tdp-projection-publisher.spec.ts src/test/terminal-log-api.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：7 files passed，65 tests passed。
   - 说明：Vitest workspace 配置会同时带起 `sandbox-api/hot-update-*` 等同 workspace 测试文件，属于当前仓库正常行为。

## 阶段 3：终端协议和本地防御

### 变更

- `types/state.ts`、`types/protocol.ts`、`types/runtime.ts`
  - projection envelope 增加 `expiresAt/lifecycle/expiryReason`。
  - sync state 增加 `serverClockOffsetMs/lastExpiredProjectionCleanupAt`。
  - module input 增加 `projectionExpiryCleanup` 配置。
- `foundations/projectionExpiry.ts`
  - 新增本地过期判断：`expiresAt + 5min grace <= estimatedServerNow` 才视为本地可丢弃。
  - 新增 server clock offset 估算，优先使用服务端 timestamp，降低终端时钟偏差影响。
- `messageActor.ts`
  - 从 `SESSION_READY` 或消息 timestamp 计算 `serverClockOffsetMs`。
  - `CHANGESET/PROJECTION_CHANGED/PROJECTION_BATCH/SNAPSHOT_CHUNK` 保持 topic subscription 过滤。
- `projectionRepositoryActor.ts`
  - snapshot 改为 staging chunk apply，commit 后一次性替换 active repository，避免大快照半应用。
  - `tdpProjectionReceived/tdpProjectionBatchReceived` 在写 state、触发 topic changed、flush persistence 后再 ACK/complete。
  - 新增 `cleanupExpiredTdpProjections` command：删除本地过期 projection，触发 changed topic rebuild；如果 fingerprint 已经不变，也显式发 delete 变更给业务 read model。
- `tdpProjection.ts`
  - reducer 在 snapshot/changes/realtime apply 时做本地过期防御：过期 upsert 不写仓库，但 cursor 仍由 sync slice 推进；delete 总是应用。
  - 对历史扁平 record 持久化结构保留 hydrate 兼容。
- `tdpSync.ts` selector
  - `selectTdpActiveProjectionEntries*` 增加本地过期过滤，持久化旧数据即使尚未物理清理也不会暴露给业务。
  - resolved projection 选择会跳过已过期的高优先级 projection，回落到仍有效的低优先级 projection。
- `createModule.ts`、`initializeActor.ts`
  - runtime initialize 时执行一次 cleanup。
  - 默认每 5 分钟定时 cleanup，可通过 module input 关闭或调 interval。

### 修复记录

1. ACK 顺序风险：
   - 设计要求不能在 state/persistence 之前 ACK projection cursor。
   - 当前实现把 ACK/`projectionApplyCompleted` 放在 reducer apply、topic recompute、`flushPersistence()` 之后。
2. UI root-screen 测试旧 race：
   - `2-ui/2.3-integration/catering-shell/test/scenarios/catering-shell-root-screen.spec.tsx` 中 primary/secondary 标题断言前补 `waitForNode(...)`。
   - 该修复不改变产品逻辑，只让测试等待 semantic node 注册完成。

### 验证

1. 终端 type-check：
   - 命令：`corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 type-check`
   - 结果：通过。
2. 终端专项 + live + 重启回归：
   - 命令：`corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test -- test/scenarios/tdp-sync-runtime-v2.spec.ts test/scenarios/tdp-sync-runtime-v2-live-projection-lifecycle.spec.ts test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：16 files passed，70 tests passed。
   - 说明：同包 Vitest workspace 会扩展运行同包其他 live/hot-update spec，属于正常行为。
3. UI shell：
   - 命令：`corepack yarn workspace @next/ui-integration-catering-shell type-check`
   - 结果：通过。
   - 命令：`corepack yarn vitest run test/scenarios/catering-shell-module.spec.ts --no-file-parallelism --maxWorkers=1`
   - 目录：`2-ui/2.3-integration/catering-shell`
   - 结果：1 file passed，3 tests passed。
   - 命令：`corepack yarn vitest run test/scenarios/catering-shell-root-screen.spec.tsx --no-file-parallelism --maxWorkers=1 --reporter=dot`
   - 结果：通过。
   - 命令：`corepack yarn vitest run --no-file-parallelism --maxWorkers=1 --reporter=dot`
   - 结果：通过；存在 React test renderer/act/reselect identity 旧 warning，无失败。

## 阶段 4：Live / VM 验证和验收证据

### VM 环境

- mock platform dev server：
  - 端口：`5810`
  - PID：`83105`
  - 进程：`node --require .../tsx/... src/index.ts`
- Android automation：
  - primary：`18584`
  - secondary：`18585`
  - `corepack yarn android:automation:hello --target primary --no-start`：通过。
  - `corepack yarn android:automation:hello --target secondary --no-start`：通过。
  - `corepack yarn android:automation:forward`：通过。
- 激活状态：
  - `sandboxId = sandbox-kernel-base-test`
  - `terminalId = terminal_hia5fetysys6`
  - primary 当前屏：`ui.business.catering-master-data-workbench.primary-workbench`
  - TDP `activeSubscribedTopics` 包含 `order.payment.completed`

### VM TTL 证明

1. 发布通知类 projection：
   - topic：`order.payment.completed`
   - itemKey：`payment-vm-ttl-1777429300600`
   - status：`ACCEPTED`
   - expiresAt：`2026-04-29T02:21:52.714Z`
   - 终端 upsert 可见：`lifecycle=expiring`，payload 中 `orderId` 等于 itemKey。
   - cursorAfterUpsert：`311`
2. run-once expiry：
   - `claimedProjectionCount=1`
   - `expiredProjectionCount=1`
   - `generatedTombstoneCount=1`
   - `duplicateTombstoneCount=0`
   - `oldestExpiredLagMs=1783`
   - `durationMs=6`
   - cursorAfterDelete：`312`
   - 终端 `activeEntries["order.payment.completed:TERMINAL:terminal_hia5fetysys6:payment-vm-ttl-1777429300600"] = null`
3. 服务端 change log：
   - cursor `311`：`operation=upsert`，`changeReason=PUBLISHER_UPSERT`，`expiresAt=1777429312714`
   - cursor `312`：`operation=delete`，`changeReason=TTL_EXPIRED`，`tombstoneKey=ttl-expire:projection_6u0ixl7nihuz:terminal_hia5fetysys6:1:1777429312714`
4. 服务端 projection 当前态：
   - `lifecycle=expiring`
   - `expiresAt=2026-04-29T02:21:52.714Z`
   - `expiredAt=2026-04-29T02:21:54.497Z`
   - `expiryReason=TTL_EXPIRED`
   - `expiryStatus=done`

### VM 重启恢复证明

1. 重启前：
   - 命令：`node scripts/android-automation-rpc.mjs call runtime.selectState '{"target":"primary","path":["kernel.base.tdp-sync-runtime-v2.projection","activeEntries","order.payment.completed:TERMINAL:terminal_hia5fetysys6:payment-vm-ttl-1777429300600"]}' --target primary --no-start --timeout 15000`
   - 结果：`null`
   - TDP session：`READY`
   - sync cursor：`lastCursor=312`，`lastAppliedCursor=312`，`lastAckedCursor=312`
2. force-stop/start：
   - 命令：`adb shell am force-stop com.next.mixccateringassemblyrn84 && sleep 2 && adb shell am start -n com.next.mixccateringassemblyrn84/.MainActivity`
   - 结果：app 重新启动。
   - 重启前 runtimeId：`run_moacpxoj_lr3c460wvzl6qth5`
   - 重启后 runtimeId：`run_moadf7yg_r2st5t4oof48g2uw`
3. 重启后：
   - activation status：`ACTIVATED`
   - TDP session：`READY`
   - sync cursor：`lastCursor=314`，`lastAppliedCursor=314`，`lastDeliveredCursor=314`，`lastAckedCursor=314`
   - `activeSubscribedTopics` 仍包含 `order.payment.completed`
   - 目标 projection 查询结果仍为 `null`，未从持久化恢复污染业务 read model。
4. 服务端 HTTP fallback 补证：
   - 单 topic subscription hash：`fnv1a64:edb10add81506120`
   - snapshot：`snapshotCount=0`，`snapshotMatch=null`
   - changes from cursor 310：按顺序返回 upsert(311) 和 delete(312)，delete `expiryReason=TTL_EXPIRED`
   - highWatermark：`312`

### 阶段 4 边界说明

- 第一阶段不做 `tdp_projection_lifecycle_events` 历史 payload 表；过期后 TDP 不承诺历史 payload 查询，只保证到期前投递、到期后 tombstone 收敛。
- 第一阶段不物理清理 `tdp_terminal_projection_access` delete row；保留它用于 highWatermark/cursor 收敛。后续可单独做 access cleanup，但必须先保证 highWatermark 不依赖 access row。
- UI 全包测试存在 React test renderer/act/reselect identity warning，是当前测试环境旧 warning；本次验证无失败。
