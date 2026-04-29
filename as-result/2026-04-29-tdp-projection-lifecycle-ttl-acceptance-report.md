# TDP Projection Lifecycle / TTL 验收报告

> 日期：2026-04-29  
> 分支：`codex/tdp-projection-lifecycle-ttl`  
> 依据：
> - `as-result/2026-04-29-tdp-projection-lifecycle-ttl-implementation-plan.md`
> - `ai-result/2026-04-29-tdp-projection-lifecycle-ttl-implementation-plan-v2.md`

## 1. 结论

TDP Projection Lifecycle / TTL 已按两份计划落地并完成验收。当前实现满足 V2 的 AC-1 ~ AC-19：

- 服务端支持 topic lifecycle policy、TTL 校验、`expiresAt` 持久化、snapshot 过期过滤、changes 保序、scheduler tombstone、幂等和 backpressure。
- 终端支持协议字段、本地过期防御、selector 过滤、启动/定时 cleanup、cursor 正确推进、重启恢复不暴露过期 projection。
- `order.payment.completed` 已作为第一批 expiring topic 接入 catering shell topic interest。
- VM/Android 真链路已完成发布、终端接收、服务端过期、终端清理、force-stop/start 后不恢复污染的验证。

## 2. 实现范围

### 服务端

- 新增：
  - `0-mock-server/mock-terminal-platform/server/src/modules/tdp/lifecyclePolicy.ts`
  - `0-mock-server/mock-terminal-platform/server/src/modules/tdp/expiryScheduler.ts`
  - `0-mock-server/mock-terminal-platform/server/src/test/tdp-projection-lifecycle.spec.ts`
- 修改：
  - DB schema/migration 增加 topic lifecycle、projection expiry、access expiry、change log tombstone 字段和索引。
  - `upsertProjectionBatch` 接入 lifecycle policy，写入 `expiresAt/lifecycle/changeReason`。
  - snapshot 过滤过期 projection；changes 保留 upsert/delete 历史顺序。
  - admin API 增加 `POST /api/v1/admin/tdp/projections/expire/run-once` 和 `GET /api/v1/admin/tdp/projections/expiry-stats`。
  - seed/import/export 兼容 lifecycle 字段，旧数据默认 persistent。

### 终端

- 新增：
  - `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/projectionExpiry.ts`
  - `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-projection-lifecycle.spec.ts`
- 修改：
  - projection 协议和 state 支持 `expiresAt/lifecycle/expiryReason`。
  - sync state 持久化 `serverClockOffsetMs`，用于本地 TTL 防御。
  - reducer/selector 本地过滤过期 projection，delete tombstone 总是应用。
  - `cleanupExpiredTdpProjections` command 支持启动和定时清理，清理后触发 topic changed/rebuild。
  - 大 snapshot 通过 staging chunk apply 后一次性 commit，避免半应用。

### UI

- `2-ui/2.3-integration/catering-shell/src/application/moduleManifest.ts`
  - 增加 `order.payment.completed` topic interest。
- `catering-shell-root-screen.spec.tsx`
  - 修复旧测试 race：标题读取前等待 semantic node 注册。

## 3. 自动化验证

### 服务端

1. `corepack yarn workspace @next/mock-terminal-platform-server type-check`
   - 结果：通过。
2. `corepack yarn workspace @next/mock-terminal-platform-server test -- src/test/tdp-projection-lifecycle.spec.ts src/test/tdp-dynamic-group.spec.ts src/test/tdp-projection-publisher.spec.ts src/test/terminal-log-api.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：7 files passed，65 tests passed。
   - 说明：Vitest workspace 配置会一起执行同 workspace 的 `sandbox-api/hot-update-*` 等测试文件，属于当前仓库正常行为。

### 终端

1. `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 type-check`
   - 结果：通过。
2. `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test -- test/scenarios/tdp-sync-runtime-v2.spec.ts test/scenarios/tdp-sync-runtime-v2-live-projection-lifecycle.spec.ts test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts --no-file-parallelism --maxWorkers=1`
   - 结果：16 files passed，70 tests passed。

### UI

1. `corepack yarn workspace @next/ui-integration-catering-shell type-check`
   - 结果：通过。
2. `corepack yarn vitest run test/scenarios/catering-shell-module.spec.ts --no-file-parallelism --maxWorkers=1`
   - 目录：`2-ui/2.3-integration/catering-shell`
   - 结果：1 file passed，3 tests passed。
3. `corepack yarn vitest run test/scenarios/catering-shell-root-screen.spec.tsx --no-file-parallelism --maxWorkers=1 --reporter=dot`
   - 结果：通过。
4. `corepack yarn vitest run --no-file-parallelism --maxWorkers=1 --reporter=dot`
   - 目录：`2-ui/2.3-integration/catering-shell`
   - 结果：通过；存在 React test renderer/act/reselect identity 旧 warning，无失败。

## 4. VM / Android 验证

### 环境

- mock platform dev server：`127.0.0.1:5810`
- Android device：`emulator-5554`
- primary automation：`18584`
- secondary automation：`18585`
- app package：`com.next.mixccateringassemblyrn84`
- sandboxId：`sandbox-kernel-base-test`
- terminalId：`terminal_hia5fetysys6`
- primary screen：`ui.business.catering-master-data-workbench.primary-workbench`
- TDP subscription：`activeSubscribedTopics` 包含 `order.payment.completed`

### TTL 链路证据

| 项 | 结果 |
|---|---|
| itemKey | `payment-vm-ttl-1777429300600` |
| publish status | `ACCEPTED` |
| publish expiresAt | `2026-04-29T02:21:52.714Z` |
| terminal upsert visible | `lifecycle=expiring`，payload `orderId=payment-vm-ttl-1777429300600` |
| cursorAfterUpsert | `311` |
| expiry run claimedProjectionCount | `1` |
| expiry run expiredProjectionCount | `1` |
| expiry run generatedTombstoneCount | `1` |
| expiry run duplicateTombstoneCount | `0` |
| expiry run oldestExpiredLagMs | `1783` |
| expiry run durationMs | `6` |
| cursorAfterDelete | `312` |
| localEntryAfterDelete | `null` |

服务端 change log：

| cursor | operation | changeReason | expiresAt | tombstoneKey |
|---:|---|---|---:|---|
| 311 | upsert | `PUBLISHER_UPSERT` | `1777429312714` | `null` |
| 312 | delete | `TTL_EXPIRED` | `1777429312714` | `ttl-expire:projection_6u0ixl7nihuz:terminal_hia5fetysys6:1:1777429312714` |

服务端 projection 当前态：

- `lifecycle=expiring`
- `expiresAt=2026-04-29T02:21:52.714Z`
- `expiredAt=2026-04-29T02:21:54.497Z`
- `expiryReason=TTL_EXPIRED`
- `expiryStatus=done`

### 重启恢复证据

1. 重启前目标 entry：
   - path：`kernel.base.tdp-sync-runtime-v2.projection.activeEntries["order.payment.completed:TERMINAL:terminal_hia5fetysys6:payment-vm-ttl-1777429300600"]`
   - 结果：`null`
   - session：`READY`
   - cursor：`lastCursor=312`，`lastAppliedCursor=312`，`lastAckedCursor=312`
2. force-stop/start：
   - 命令：`adb shell am force-stop com.next.mixccateringassemblyrn84 && sleep 2 && adb shell am start -n com.next.mixccateringassemblyrn84/.MainActivity`
   - 重启前 runtimeId：`run_moacpxoj_lr3c460wvzl6qth5`
   - 重启后 runtimeId：`run_moadf7yg_r2st5t4oof48g2uw`
3. 重启后：
   - activation status：`ACTIVATED`
   - TDP session：`READY`
   - cursor：`lastCursor=314`，`lastAppliedCursor=314`，`lastDeliveredCursor=314`，`lastAckedCursor=314`
   - 目标 entry：`null`
   - 结论：过期 projection 未从终端持久化恢复并污染业务 read model。

### HTTP fallback 补证

- 单 topic subscription hash：`fnv1a64:edb10add81506120`
- snapshot：`snapshotCount=0`，`snapshotMatch=null`
- changes from cursor 310：
  - upsert cursor `311`
  - delete cursor `312`
  - delete `expiryReason=TTL_EXPIRED`
- highWatermark：`312`

## 5. AC-1 ~ AC-19 对照

| AC | 验收项 | 证据 | 结论 |
|---|---|---|---|
| AC-1 | persistent topic 不能 TTL | `tdp-projection-lifecycle.spec.ts`：`rejects ttl fields for persistent projection topics` | 通过 |
| AC-2 | expiring topic 计算并保存 `expiresAt` | 服务端专项测试、VM publish `expiresAt=2026-04-29T02:21:52.714Z`、DB/admin projection 当前态 | 通过 |
| AC-3 | command-outbox topic 拒绝 projection upsert | `rejects projection upsert for command-outbox topics` | 通过 |
| AC-4 | `ttlBase = occurredAt ?? serverNow`，不随路径变化 | `uses occurredAt as ttl base and rejects unsafe publisher clocks or ttl ranges` | 通过 |
| AC-5 | TTL 后 snapshot 不返回过期 projection，scheduler 未跑时也正确 | `filters expired expiring projections from snapshot even before scheduler runs`，VM HTTP snapshot `snapshotCount=0` | 通过 |
| AC-6 | scheduler 事务化生成 tombstone cursor | `generates idempotent TTL tombstones with terminal cursors`，VM cursor 312 delete | 通过 |
| AC-7 | scheduler 幂等，重复 run 不重复 tombstone | `generates idempotent TTL tombstones with terminal cursors` second run `generatedTombstoneCount=0` | 通过 |
| AC-8 | scheduler fanout 分批事务，进程崩溃后可重试 | `expiryScheduler.ts` claim timeout + tombstone_key 幂等；`processes expired projections with max tombstone backpressure across repeated runs` 验证分批重试收敛 | 通过 |
| AC-9 | scheduler 大批量有背压，不产生无界内存队列 | `processes expired projections with max tombstone backpressure across repeated runs`，`maxTombstonesPerRun=3` 分两轮处理 6 条 | 通过 |
| AC-10 | 在线 session 只收到订阅 topic 的 delete | `pushes TTL delete only to online sessions subscribed to the expired topic` | 通过 |
| AC-11 | changes 分页返回 upsert/delete 顺序，hasMore 正确 | `pages changes in cursor order across publisher upserts and TTL deletes`，VM HTTP changes 311/312 顺序 | 通过 |
| AC-12 | 幂等重放返回原始 `expiresAt` 和 `IDEMPOTENT_REPLAY` | `replays source_event_id with the original expiresAt instead of refreshing TTL` | 通过 |
| AC-13 | 终端过期 upsert 不写仓库但推进 cursor | `filters expired projection upserts locally while advancing cursor and applying TTL tombstones` | 通过 |
| AC-14 | 终端晚清理原则：grace 内不提前丢弃 | `projectionExpiry.ts` 5min grace；终端测试覆盖即将过期/超过 grace 的本地判断 | 通过 |
| AC-15 | 终端 selector 不暴露过期 projection | `hides persisted expired projections...`、`resolves to a lower-priority projection when the higher-priority projection is expired` | 通过 |
| AC-16 | 终端本地清理触发业务 rebuild | `hides persisted expired projections and cleanup physically removes them with topic changed rebuild` | 通过 |
| AC-17 | 重启恢复后不暴露过期 projection | live test `receives expiring projection...does not restore expired data after restart`；VM force-stop/start 后目标 entry `null` | 通过 |
| AC-18 | VM 实机链路完成 upsert/delete/restart | 第 4 节 VM 证据 | 通过 |
| AC-19 | 文档和长期记忆更新 | 本报告、实施日志、`.omx/project-memory.json` 更新 | 通过 |

## 6. 完成定义对照

1. 服务端支持 topic lifecycle policy，`persistent` topic 默认拒绝 TTL，`expiring` topic 能计算、校验并保存 `expiresAt`：通过。
2. 服务端 snapshot 过滤过期投影，不依赖 scheduler 才正确：通过。
3. expiry scheduler 具备 claim、事务、幂等 tombstone、背压和指标，重复执行不会重复生成 tombstone：通过。
4. TTL tombstone 写入 `tdp_change_logs`，保持 terminal cursor 单调递增：通过。
5. 在线 session 只收到自己订阅 topic 的 TTL delete：通过。
6. 终端协议、projection 仓库、selector、topic changed 广播都正确处理 `expiresAt` 和 TTL delete：通过。
7. 终端本地持久化恢复后，不会向业务 read model 暴露已经过期的 projection：通过。
8. `command-outbox` topic 不能通过 projection upsert 写入：通过。
9. 服务端测试、终端测试、live/e2e、VM 验证全部通过：通过。
10. 文档和项目长期记忆更新，能说明实现边界、已验证证据和剩余风险：通过。

## 7. 剩余风险和后续建议

1. 第一阶段没有新增 `tdp_projection_lifecycle_events` 历史 payload 表。当前设计只保证 projection 当前态和 change log 收敛，不承诺过期后历史 payload 查询。如果后续有审计/追责需求，应新增专门 lifecycle event/audit 表，并明确脱敏策略。
2. 第一阶段不物理清理 `tdp_terminal_projection_access` 的 delete row。它当前仍承担 highWatermark/cursor 收敛职责；后续如果做 access cleanup，必须先引入或确认独立 terminal cursor 权威表，避免 highWatermark 回退。
3. 当前 VM 验证是在 Android emulator 上完成，不等同真实物理设备性能结论。功能链路已经覆盖真实 runtime/网络/持久化，但性能阈值仍建议在真机上另做一轮。
4. UI 全包测试仍有 React test renderer/act/reselect identity 旧 warning。本次修改未引入失败，但后续可单独清理测试噪声，降低回归判断成本。
