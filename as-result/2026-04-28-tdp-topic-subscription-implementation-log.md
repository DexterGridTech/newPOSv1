# TDP Topic 按需订阅改造实施记录

> 开始日期：2026-04-28  
> 目标：执行 `as-result/2026-04-28-tdp-topic-subscription-redesign-review-detailed.md` 中的完整设计，并按步骤验证。  
> 原则：每个批次包含目标、改动、验证、结果和下一步。

---

## 批次 0：启动与基线确认

### 目标

- 将当前会话目标锁定为 TDP topic 按需订阅完整落地。
- 先盘点现有实现，确认第一批可安全落地的范围。

### 已确认事实

- 根目录仅存在顶层 `AGENTS.md`，当前改动受顶层工作协议约束。
- 当前工作树没有已跟踪文件脏改动；`as-result` 下文档为未跟踪文件。
- 服务端 TDP handshake 已有 `subscribedTopics` 字段，但当前只存储在 session 中，没有参与 snapshot / changes / realtime push 过滤。
- 终端 TDP protocol 类型已有 `subscribedTopics` 字段，但当前连接发送的是空数组或未汇总的值。
- TCP 激活请求当前没有 `clientRuntime` / assembly capability 字段。

### 下一步

批次 1 先实现终端 topic interest 声明与汇总的最小闭环，并补测试。

---

## 批次 0.1：设计一致性复核与暂停实施

### 触发原因

用户指出此前说明中同时出现“终端订阅 topic 在激活时发生”和“订阅 topic 在 TDP handshake 时发生”的说法，存在阶段边界混淆风险。

### 处理决策

- 暂停进入代码实施。
- 先全面复核 `as-result/tdp-topic-subscription-redesign.md` 与 `as-result/2026-04-28-tdp-topic-subscription-redesign-review-detailed.md`。
- 将 TCP activation 与 TDP handshake 的职责边界写入两份设计文档。

### 已修订结论

- TCP 激活只做终端身份、激活码授权、TerminalProfile/TerminalTemplate 与 assembly capability 的兼容性校验。
- TDP topic 订阅只发生在 TDP `HANDSHAKE`。终端启动 runtime 时可以汇总 `tdpTopicInterests`，但这是本地准备动作，不是协议订阅动作。
- `TerminalAssemblyCapabilityManifestV1` 不包含 `supportedTopicKeys`，避免把激活能力校验误当成 TDP 订阅。
- module manifest 字段统一为 `tdpTopicInterests`，单条声明字段统一为 `topicKey`，协议字段继续使用 `subscribedTopics`。
- `required` 统一为可选字段，默认 `false`。
- `SESSION_READY.requiredMissingTopics` 的 strict 与 degraded 时序已拆开。
- HTTP fallback 已按“WS 重连 / WS 在线补页 / 无 WS 或调试”的三种场景拆开。
- FULL_SNAPSHOT 分片不再表述为天然断点续传；断线后默认重新 handshake 并重新发送完整分片序列。

### 下一步

完成本轮文档验证后，再恢复批次 1 的代码实施。

---

## 批次 1：终端 topic interest 声明与订阅汇总

### 目标

- 让各 runtime/business module 能声明自己关心的 TDP topic。
- TDP runtime 在启动时基于 runtime descriptors 汇总订阅集合，并在 TDP `HANDSHAKE` 中发送给服务端。
- 保持 TCP activation 与 TDP subscription 边界清晰。

### 已改动

- `runtime-shell-v2`：
  - 新增 `TdpTopicInterestDeclarationV1`。
  - `KernelRuntimeModuleV2` / module DSL / module descriptor 支持 `tdpTopicInterests`。
  - runtime lifecycle/install context 暴露 descriptors，供 TDP runtime 汇总。
- `tdp-sync-runtime-v2`：
  - 新增 `foundations/topicSubscription.ts`。
  - 定义 `tdp.topic-subscription.v1` 与 `tdp.subscription-hash.v1` capability。
  - 订阅 hash 使用 `fnv1a64:...`，只绑定规范化后的 topic key 集合；`reason` / `required` 不参与 hash。
  - `HANDSHAKE` 发送 `capabilities`、`subscribedTopics`、`subscriptionHash`、`subscriptionMode: explicit`、`subscriptionVersion: 1`。
  - `tdp-sync-runtime-v2` 自身声明基础 system topics：`error.message`、`system.parameter`、`terminal.hot-update.desired`、`terminal.group.membership`、`config.delta`。
- 业务包：
  - `organization-iam-master-data` 声明组织/IAM topic interests。
  - `catering-product-master-data` 声明商品 topic interests。
  - `catering-store-operating-master-data` 声明门店运营 topic interests。

### 验证

- `1-kernel/1.1-base/runtime-shell-v2`
  - `corepack yarn type-check`
  - `corepack yarn test -- --no-file-parallelism --maxWorkers=1`
  - 结果：通过，27 个测试通过。
- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "sends resolved topic subscription"`
  - 结果：通过。
- 业务包：
  - `organization-iam-master-data`: `corepack yarn type-check` 通过。
  - `catering-product-master-data`: `corepack yarn type-check` 通过。
  - `catering-store-operating-master-data`: `corepack yarn type-check` 通过。

### 结果

- AC-1.1 / AC-1.2 主链路已落地。
- 老模块不声明 `tdpTopicInterests` 时视为空声明，不影响 runtime 启动。

---

## 批次 2：服务端按订阅过滤与终端本地防御过滤

### 目标

- 服务端在 explicit 订阅模式下只返回/推送订阅 topic。
- 终端在本地 projection 仓库写入前再次过滤未订阅 topic，形成防御层。
- legacy 老终端仍保持 all-topic 行为。

### 已改动

- `mock-terminal-platform`：
  - `HANDSHAKE` 解析 `capabilities/subscribedTopics/subscriptionHash`，区分 `explicit` 与 `legacy-all`。
  - 服务端规范化 topic key，生成 `acceptedTopics/rejectedTopics/requiredMissingTopics` 与服务端侧 hash。
  - `SESSION_READY.subscription` 返回订阅摘要。
  - `getTerminalSnapshotEnvelope`、`getTerminalChangesSince`、`getHighWatermarkForTerminal` 支持 `TdpServerSubscriptionFilter`。
  - explicit 空订阅返回空 snapshot/changes，highWatermark 为 0。
  - realtime push 在 `queueProjectionChangeToOnlineTerminal` 前按 session accepted topics 过滤。
  - HTTP snapshot/changes endpoint 支持 `subscribedTopics=a,b` 显式过滤。
- `tdp-sync-runtime-v2`：
  - `SESSION_READY.subscription` 写入 session/sync state。
  - `messageActor` 在派发 projection repository 命令前过滤 `FULL_SNAPSHOT` / `CHANGESET` / `PROJECTION_CHANGED` / `PROJECTION_BATCH`。
  - `reduceServerMessage.ts` 同步提供过滤工具，保留 reducer 边界防御。
  - TCP reset 时清理 subscription binding；普通 bootstrap 不清理持久化恢复出的 `activeSubscriptionHash/activeSubscribedTopics`。

### 验证

- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "filters terminal snapshot"`
  - 结果：通过。
- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "filters unsubscribed"`
  - 结果：通过。

### 结果

- AC-2.1 / AC-2.2 / AC-2.3 / AC-2.4 的基础过滤链路已落地。
- HTTP fallback 目前支持显式 `subscribedTopics`；终端补页接入见批次 3。

---

## 批次 3：hasMore、HTTP 补页与 cursor ACK 时序

### 目标

- 修复 CHANGESET `hasMore` 语义，避免离线超过一页变更时数据截断。
- 终端收到 `hasMore = true` 后通过 HTTP changes endpoint 拉取后续页。
- cursor ACK 不再直接监听 `tdpSnapshotLoaded/tdpChangesLoaded`，改为 projection state 写入和 topic change 重算完成后再发送。

### 已改动

- `mock-terminal-platform`：
  - `getTerminalChangesSince` 返回 `{ changes, hasMore }`。
  - 查询使用 `limit + 1` 明确判断是否还有更多可见 changes。
  - WS `CHANGESET` 与 HTTP changes endpoint 均使用新的 `hasMore`。
- `tdp-sync-runtime-v2`：
  - `TdpSyncHttpServiceV2.getSnapshot/getChanges` 增加 subscription options，并把 `subscribedTopics/subscriptionHash` 放入 query。
  - 新增 `TdpSyncHttpServiceRefV2`，module install 时保存 HTTP service 供 actor 使用。
  - 新增 `TdpChangesFetchActor`：
    - 监听 `changesApplyCompleted`；
    - `hasMore = true` 时 dispatch `fetchMoreChanges`；
    - 通过 HTTP 拉取下一页；
    - 将结果再次派发为 `tdpChangesLoaded`，直到 `hasMore = false`。
  - 新增内部命令 `fetchMoreChanges`、`snapshotApplyCompleted`、`changesApplyCompleted`。
  - `TdpProjectionRepositoryActor` 在 state 写入和 `recomputeResolvedTopicChanges` 完成后派发 apply-completed 命令。
  - `TdpCursorFeedbackActor` 改为监听 `snapshotApplyCompleted/changesApplyCompleted`，不再监听原始 loaded 命令。
  - `tdpChangesLoaded/changesApplyCompleted/fetchMoreChanges` 显式允许 reentry，以支持同一 catch-up 链路内连续补页。

### 验证

- 先写红测：
  - `tdp-sync-runtime-v2.spec.ts` 新增 “fetches remaining changes over HTTP with the active subscription when CHANGESET has more pages”。
  - 首次运行失败在第二页 projection 未写入，证明测试打中缺失补页逻辑。
- 绿化后验证：
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "fetches remaining changes"`
  - 结果：通过。
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "auto acknowledges|filters unsubscribed|fetches remaining changes|sends resolved topic subscription"`
  - 结果：通过，5 个相关测试通过。
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "filters terminal snapshot|reports hasMore"`
  - 结果：通过，2 个相关测试通过。
  - `1-kernel/1.1-base/tdp-sync-runtime-v2`: `corepack yarn type-check` 通过。
  - `0-mock-server/mock-terminal-platform/server`: `corepack yarn type-check` 通过。

### 结果

- AC-1.4 / AC-1.5 / AC-1.6 已落地。
- 通过本批实现确认：当前 runtime-shell 对同一 command 的多个 actor handler 使用 `Promise.all` 并发执行，因此 ACK 时序必须通过显式 apply-completed 命令保证，不能依赖 actor 注册顺序。

### 下一步

- 继续处理大数据量相关改造：FULL_SNAPSHOT 分片、cursor 批量预分配、change log retention / cursor stale 判断。

---

## 批次 4：FULL_SNAPSHOT 分片与兼容回退

### 目标

- 避免大 full snapshot 作为单条 WebSocket 巨型消息发送。
- 新客户端走 `SNAPSHOT_BEGIN / SNAPSHOT_CHUNK / SNAPSHOT_END`；老客户端继续收到 `FULL_SNAPSHOT`。
- 断线后不做“天然断点续传”承诺，重连后重新 handshake 并重新发送完整分片序列。

### 已改动

- `mock-terminal-platform`：
  - WS 协议新增 `SNAPSHOT_BEGIN`、`SNAPSHOT_CHUNK`、`SNAPSHOT_END`。
  - `HANDSHAKE.capabilities` 包含 `tdp.snapshot-chunk.v1` 时，服务端按 50 条一片发送分片 snapshot。
  - 不支持分片 capability 的客户端保持旧 `FULL_SNAPSHOT` 行为。
- `tdp-sync-runtime-v2`：
  - 协议类型新增 snapshot chunk 消息。
  - `messageActor` 维护 pending snapshot buffer，只在 `SNAPSHOT_END` 后派发 `tdpSnapshotLoaded`，保证终端本地仓库原子替换语义。
  - 每个 chunk 仍经过本地订阅防御过滤。

### 验证

- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "chunked full snapshots|legacy full snapshot"`
  - 结果：通过。
- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "buffers chunked snapshots"`
  - 结果：通过。

### 结果

- 大 snapshot 的协议分片能力已落地。
- 当前终端仍是在 `SNAPSHOT_END` 后一次性写入 Redux；异步分批写 Redux 尚未实现，见“遗留风险”。

---

## 批次 5：服务端 materialization、cursor 预分配与 retention

### 目标

- snapshot 不再依赖无限增长的 `tdp_change_logs`。
- 批量 projection 写入避免 N+1 cursor 查询。
- change log 支持保留策略，cursor 过期时强制 full snapshot。

### 已改动

- `mock-terminal-platform`：
  - 新增 `tdp_terminal_projection_access`，作为 terminal 当前可见 projection 的 materialized access 表。
  - `getTerminalSnapshotEnvelope` 改从 access 表读取，而不是依赖 change log join。
  - `getHighWatermarkForTerminal` 改从 access 表 `last_cursor` 计算 visible highWatermark。
  - 写 change log 时同步 upsert access 表。
  - 新增 `tdp_terminal_cursors`，保存每 terminal high watermark。
  - `upsertProjectionBatch` / `fanoutExistingProjectionToTerminalIds` 接入 `preallocateCursorsByTerminal`。
  - 新增 `pruneTdpChangeLogs`、`getOldestRetainedCursorForTerminal`、`isTerminalCursorStale`。
  - WS `syncMode` 改为基于 retention stale 判断，不再使用 `highWatermark - 1000` 魔法数字。
  - 新增 admin endpoint `POST /api/v1/admin/tdp/change-logs/prune`。
  - 新增 `retentionScheduler.ts`，server 启动后每天定期执行 change log prune，可用 `TDP_CHANGE_LOG_PRUNE_INTERVAL_MS` 和 `TDP_CHANGE_LOG_RETAIN_RECENT_CURSORS` 调整。

### 验证

- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn type-check`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "change log pruning"`
  - 结果：通过。

### 结果

- change log retention 后，snapshot 仍可从 materialized access 表重建。
- 低于最老保留 cursor 的终端重连会进入 full snapshot。

---

## 批次 6：fingerprint 优化、变更 topic 定向重算与 selector memoization

### 目标

- 避免单条 realtime projection 触发所有 topic 全量 fingerprint 重算。
- 避免 fingerprint 使用 `JSON.stringify(payload)`。
- 保证 revision fingerprint 的内容不可变前提清晰。

### 已改动

- `tdp-sync-runtime-v2`：
  - `toTopicFingerprintV2` 改为基于 `itemKey / scopeType / scopeId / revision / operation`。
  - 新增 `recomputeChangedTopicChanges` 命令。
  - `PROJECTION_CHANGED` / `PROJECTION_BATCH` 只重算变化 topic。
  - `terminal.group.membership` 变化时仍全量重算，因为 scope 链可能影响所有 topic。
  - `FULL_SNAPSHOT` / `CHANGESET` 保持全量重算。
  - `selectScopePriorityChain` 增加 memoization。

### 验证

- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "revision metadata|recomputes topic changes"`
  - 结果：通过。

### 结果

- AC-4.1 / AC-4.2 / AC-4.3 的核心功能语义已落地。
- 重要前提：服务端必须保证同一 `topic + scope + itemKey + revision` 的 payload 内容不可变；幂等重放不能用相同 revision 携带不同 payload。

---

## 批次 7：TCP activation 与 TerminalProfile/Template 兼容性校验

### 目标

- 解决“一个 KDS assembly 拿到收银机激活码后被激活成收银终端”的风险。
- 保持阶段边界：TCP activation 只做 profile/template/assembly compatibility；TDP topic subscription 仍只在 TDP handshake。

### 已改动

- `tcp-control-runtime-v2`：
  - 新增 `TerminalAssemblyCapabilityManifestV1`。
  - `ActivateTerminalApiRequest` 支持 `clientRuntime`。
  - `TcpControlRuntimeAssemblyV2` 支持 `resolveClientRuntimeCapability(context)`。
  - activation actor 发请求时携带 command payload 或 assembly resolved 的 `clientRuntime`。
  - response 类型新增 `activationCompatibility`。
- `mock-terminal-platform`：
  - activation 读取激活码绑定的 `terminal_profiles` / `terminal_templates`。
  - 老终端不传或传入非法 `clientRuntime` 时 legacy allow，并在响应和 audit 中记录 `CLIENT_RUNTIME_MISSING`。
  - 新终端传 `clientRuntime` 时校验：
    - `profile.profileCode in supportedProfileCodes`
    - 如果声明 `supportedTemplateCodes`，校验 `template.templateCode`
    - 如果 template presetConfig 声明 `requiredCapabilities`，校验 `supportedCapabilities`
  - 不匹配时返回 `TERMINAL_PROFILE_NOT_SUPPORTED` / `TERMINAL_TEMPLATE_NOT_SUPPORTED` / `TERMINAL_CAPABILITY_NOT_SATISFIED`，并透传 details。
  - 激活成功时把 capability snapshot 写入 `deviceInfo.runtimeInfo.activationCapability`。

### 验证

- `1-kernel/1.1-base/tcp-control-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn vitest run test/scenarios/tcp-control-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，9 个测试通过。
- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn type-check`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "terminal activation"`
  - 结果：通过，覆盖 legacy allow、匹配成功、profile 不匹配拒绝。

### 结果

- AC-SYS-5 中 profile/template compatibility 的主链路已落地。
- 本阶段没有把 profile/template 自动扩展成 topic；TDP handshake 仍以终端模块 `tdpTopicInterests` 为准。

---

## 批次 8：Realtime 背压与 command topic gate

### 目标

- 避免服务端在批量导入时对同一 session 无限连续发送 `PROJECTION_BATCH`。
- `COMMAND_DELIVERED` 也必须按 session topic subscription 过滤。
- ACK/APPLIED 必须在 realtime projection 写入和 topic 重算之后推进。

### 已改动

- `tdp-sync-runtime-v2`：
  - 协议新增客户端 `BATCH_ACK`。
  - `PROJECTION_BATCH` 支持 `batchId`。
  - 终端在 batch 写入本地仓库、定向 topic 重算后发送 `BATCH_ACK`。
  - 新增 `projectionApplyCompleted`、`projectionBatchApplyCompleted`，单条 realtime projection 和 batch 的 cursor ACK 也改为 apply-completed 后置。
- `mock-terminal-platform`：
  - online session 保存 `inflightBatchCount` / `deferredBatchFlush`。
  - `inflightBatchCount >= 3` 时暂停该 session 的 batch flush。
  - 收到 `BATCH_ACK` 后释放 inflight 并继续 flush deferred queue。
  - `dispatchRemoteControlRelease` 发送 `COMMAND_DELIVERED` 前按 session subscription 过滤 command topic。
  - 若没有任何 session 实际收到 command，task instance / command outbox 保持 `PENDING`；有订阅匹配 session 收到时才标记 `DELIVERED`。

### 验证

- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1 -t "projection stream messages"`
  - 结果：通过，覆盖 realtime ACK、STATE_REPORT、BATCH_ACK。
- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1 -t "backpressure"`
  - 结果：通过，覆盖 3 个 inflight batch 后暂停，`BATCH_ACK` 后继续发送 deferred batch。
  - `corepack yarn vitest run src/test/terminal-log-api.spec.ts --no-file-parallelism --maxWorkers=1 -t "subscribed to the command topic"`
  - 结果：通过，覆盖 subscribed session 收到 command，unsubscribed session 不收到。

### 结果

- 背压控制的最小可靠闭环已实现。
- command delivery 已纳入 topic subscription gate。

---

## 批次 9：最终验证矩阵

### 已执行验证

- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，25 个测试通过。
  - `corepack yarn vitest run test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，1 个真实重启恢复测试通过。
- `1-kernel/1.1-base/tcp-control-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn vitest run test/scenarios/tcp-control-runtime-v2.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，9 个测试通过。
- `1-kernel/1.1-base/runtime-shell-v2`
  - `corepack yarn type-check`
  - `corepack yarn test -- --no-file-parallelism --maxWorkers=1`
  - 结果：通过，27 个测试通过。
- `1-kernel/1.2-business/organization-iam-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- `1-kernel/1.2-business/catering-product-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- `1-kernel/1.2-business/catering-store-operating-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn type-check`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，17 个测试通过。
  - `corepack yarn vitest run src/test/terminal-log-api.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，3 个测试通过。
- 仓库根目录：
  - `git diff --check`
  - 结果：通过。

### 本批次补充结论

- 批次 9 之后又补齐了 P1/P2 收尾项：
  - `tdpProjection` 已采用 active/staging 双缓冲，`tdpSnapshotLoaded` 会拆成 `beginSnapshotApply` / `applySnapshotChunk` / `commitSnapshotApply`，selector 只读 active buffer，避免半新半旧数据暴露。
  - projection entries 持久化已从 `immediate` 调整为 `debounced`；cursor、ACK、subscription binding 等关键恢复字段仍保持 immediate。
  - 服务端 handshake 已支持 profile/template `allowedTopics` 二次裁剪，最终 `acceptedTopics = requestedTopics ∩ allowedTopics`（未配置 allowlist 时兼容放行 requested topics）。
  - required topics 严格模式已落地：服务端在 `SESSION_READY` 暴露 `requiredMissingTopics` 后发送 `TDP_REQUIRED_TOPICS_REJECTED`，不继续 snapshot/changes；终端收到后进入 protocol failed。
- subscriptionHash mismatch 当前仍按设计评审建议采用“服务端 normalized hash 为准并回传”的兼容策略，没有作为错误阻断。

---

## 批次 10：虚拟机端到端验收

### 目标

- 在用户已开启的 Android 虚拟机上证明当前实现可以被真实 RN84 assembly 加载。
- 验证真实 UI 激活、TDP explicit subscription handshake、snapshot 双缓冲应用、实时订阅内变更、订阅外过滤与 ACK 推进。

### 环境确认

- `adb devices`
  - 结果：`emulator-5554 device`。
- `curl http://127.0.0.1:5810/health`
  - 结果：`{"success":true,"data":{"status":"ok"}}`。
- mock platform 进程：
  - PID `87317`，cwd 为 `0-mock-server/mock-terminal-platform/server`，命令为 `tsx src/index.ts`。
- Metro 进程：
  - PID `53474`，cwd 为 `4-assembly/android/mixc-catering-assembly-rn84`，命令为 `react-native ... start --reset-cache`。
- `node scripts/setup-android-port-forwarding.mjs`
  - 结果：`8081`、`5810`、`9090` reverse 成功。

### 步骤与证据

1. VM smoke
   - 命令：`node scripts/android-automation-rpc.mjs smoke --target primary --timeout 20000`
   - 结果：automation host 可用，`availableTargets = ["host", "primary"]`，初始 screen 为 `ui.base.terminal.activate-device`。

2. 真实 UI 激活
   - 准备激活码：`node scripts/mock-platform-prepare-activation.mjs --sandbox-id sandbox-kernel-base-test --count 1`
   - 结果：`activationCode = 200000000001`，`sandboxId = sandbox-kernel-base-test`。
   - UI 激活命令：`node scripts/android-automation-rpc.mjs activate-device sandbox-kernel-base-test 200000000001 --target primary --timeout 30000`
   - 结果：`activationStatus = ACTIVATED`，`terminalId = terminal_fqikrm1x0e0g`。

3. 重启应用后重新加载当前 Metro bundle
   - 命令：`adb -s emulator-5554 shell am force-stop com.next.mixccateringassemblyrn84 && node scripts/android-automation-rpc.mjs smoke --target primary --timeout 30000`
   - 结果：恢复到业务主屏 `ui.business.catering-master-data-workbench.primary-workbench`，props 中包含 `terminalId = terminal_fqikrm1x0e0g`。

4. TDP explicit subscription handshake
   - 读取 `kernel.base.tdp-sync-runtime-v2.session`：
     - `status = READY`
     - `syncMode = full`
     - `subscription.mode = explicit`
     - `subscription.hash = fnv1a64:b65323fc62f184fe`
     - `acceptedTopics` 共 43 个，包含组织、IAM、餐饮商品、系统与 hot-update 基础 topic。
     - `rejectedTopics = []`
     - `requiredMissingTopics = []`
   - 读取 `kernel.base.tdp-sync-runtime-v2.sync`：
     - `activeSubscriptionHash = fnv1a64:b65323fc62f184fe`
     - `activeSubscribedTopics` 与 session accepted topics 一致。

5. Snapshot 应用与双缓冲仓库形状
   - 读取 `kernel.base.tdp-sync-runtime-v2.projection`：
     - 顶层 key 为 `activeEntries` / `activeBufferId`。
     - `activeEntries` 条数为 1362。
     - sample 包含 `terminal.group.membership`、`iam.role.catalog`、`org.store.profile` 等订阅内 topic。
   - 读取 `kernel.base.tdp-sync-runtime-v2.sync`：
     - `lastCursor = 1366`
     - `lastAppliedCursor = 1366`
     - `lastAckedCursor = 1366`
     - `snapshotStatus = ready`
     - `changesStatus = ready`

6. 实时订阅内变更与 ACK
   - 通过 `/api/v1/admin/tdp/projections/batch-upsert` 写入 `org.store.profile`，只投递给 `terminal_fqikrm1x0e0g`。
   - 服务端返回：
     - `topicKey = org.store.profile`
     - `revision = 4`
     - `sourceEventId = evt-vm-tdp-live-1777388424073`
   - VM 轮询结果：
     - projection entry revision 变为 `4`
     - payload marker 为 `vm-tdp-live-1777388424073`
     - `lastCursor = 1367`
     - `lastAppliedCursor = 1367`
     - `lastAckedCursor = 1367`
     - `lastDeliveredCursor = 1367`

7. 订阅外 topic 过滤
   - 通过 `/api/v1/admin/tdp/projections/batch-upsert` 写入 `unsubscribed.vm.probe`，目标仍是 `terminal_fqikrm1x0e0g`。
   - 服务端接受后台数据写入，返回 `status = ACCEPTED`。
   - VM 校验：
     - `activeEntries["unsubscribed.vm.probe:STORE:store-kernel-base-test:vm-tdp-filter-1777388461968"] = null`
     - `lastAppliedCursor` 和 `lastAckedCursor` 保持 `1367`，未因未订阅 topic 推进。

### 结果

- VM 端真实 activation、TDP explicit handshake、snapshot 应用、实时订阅内推送、订阅外过滤和 ACK 推进均通过。
- 本次 VM 校验不是只检查“请求成功”，而是读取了终端 runtime state 和 projection state 作为完成证据。

---

## 批次 11：按第 8 节收尾项完成最终闭环

### 目标

- 按 `2026-04-28-tdp-topic-subscription-implementation-completeness-review.md` 第 8 节逐项修复剩余高/中优先级缺口。
- 不把“阶段性验证通过”当完成，最终补齐本地矩阵、VM 端到端证据和项目长期记忆。

### 已确认的闭环项

1. **真实 assembly capability 已接入**
   - `3-adapter/android/host-runtime-rn84/src/application/createApp.ts` 已把 `activationCapability` 规范化为 `TerminalAssemblyCapabilityManifestV1`，并通过 `resolveClientRuntimeCapability()` 交给 `tcp-control-runtime-v2`。
   - `4-assembly/android/mixc-catering-assembly-rn84/App.tsx` 已声明：
     - `supportedProfileCodes = ["KERNEL_BASE_ANDROID_POS"]`
     - `supportedTemplateCodes = ["KERNEL_BASE_ANDROID_POS_STANDARD"]`
     - `supportedCapabilities` 包含 `android.rn84`、`product.mixc-catering`、`profile.kernel-base-android-pos`。
   - `assembly-create-app.spec.ts` 已验证 assembly 实际传入 capability manifest。

2. **server accepted subscription hash 已纳入 cursor validity**
   - 终端 handshake 发送 `previousAcceptedSubscriptionHash` / `previousAcceptedTopics`。
   - 终端持久化 `lastRequestedSubscriptionHash/topics` 与 `lastAcceptedSubscriptionHash/topics`。
   - 服务端按 profile/template policy 得出 accepted subscription hash；当客户端携带旧 cursor 且 previous accepted hash 与当前 accepted hash 不同，强制 `syncMode = full`。
   - 服务端测试覆盖 `forces full sync when current accepted subscription hash differs from client previous accepted hash`。

3. **chunked snapshot 完整性校验已补齐**
   - 终端校验 chunk index 范围、重复 chunk、缺失 chunk、`receivedItemCount < totalItems`。
   - 失败时清空 pending snapshot，派发 `tdpProtocolFailed`，不提交 projection，不推进 cursor。
   - 测试覆盖 `rejects incomplete chunked snapshots without committing partial data or cursor`。

4. **ACK/APPLIED 持久化 barrier 已补齐**
   - `runtime-shell-v2` actor/module context 新增 `flushPersistence()`。
   - TDP snapshot、changes、single projection、projection batch 在 state 写入与 topic recompute 后 `await context.flushPersistence()`，再发送 apply-completed / ACK / BATCH_ACK。
   - 测试覆盖 `delays projection ACK until projection state is flushed to persistent storage`。

5. **selector memoization 收尾完成**
   - `selectTdpActiveProjectionEntriesByTopic` 建立 topic index，并在无关 topic 更新时复用未变化 topic 的 entries array。
   - `selectTdpResolvedProjectionByTopic` 改为基于 topic entries array + scope chain 的 WeakMap 缓存；同一 topic 未变化时可复用 resolved result。
   - 测试在 `resolves scope priority...` 中断言无关 topic 变更后 `workflow.definition` resolved result 保持引用稳定。

6. **per-terminal retention 与 session 结构化可观测性已补齐**
   - `pruneTdpChangeLogs` 改为按 `(sandbox_id, target_terminal_id)` 分组保留最近 cursor。
   - `/api/v1/admin/tdp/sessions` 返回结构化 `subscription`，并用 explicit accepted topics 计算 `ackLag/applyLag`。

7. **HTTP fallback hash/policy 校验已补齐**
   - HTTP snapshot/changes 带 `subscribedTopics` 时必须带 `subscriptionHash`。
   - 服务端重新套用 profile/template allowedTopics 并计算 accepted hash，不匹配返回 400。

8. **性能 smoke 已补齐**
   - 客户端覆盖 1000 item snapshot apply 的本地预算。
   - 服务端覆盖 100 terminal topic fanout、HTTP topic filter、retention prune 的 smoke budget。

### 最新 VM 端到端校验

- 环境：
  - `adb devices`：`emulator-5554 device`
  - `curl http://127.0.0.1:5810/health`：`{"success":true,"data":{"status":"ok"}}`
  - `curl http://127.0.0.1:8081/status`：`packager-status:running`
  - `node scripts/setup-android-port-forwarding.mjs`：`8081`、`5810`、`9090` reverse 成功。
- 注意：
  - 旧 App 进程一度未监听 automation socket；执行 `adb shell am force-stop com.next.mixccateringassemblyrn84` 后重新启动并加载当前 Metro bundle，`automation.host:start` 路径恢复正常。
- VM smoke：
  - `node scripts/android-automation-rpc.mjs smoke --target primary --timeout 60000`
  - 结果：`availableTargets = ["host", "primary"]`，`buildProfile = debug`，`scriptExecutionAvailable = true`，当前屏幕为 `ui.business.catering-master-data-workbench.primary-workbench`。
- TDP runtime state：
  - `terminalId = terminal_fqikrm1x0e0g`
  - `activationStatus = ACTIVATED`
  - `session.status = READY`
  - `session.syncMode = incremental`
  - `subscription.mode = explicit`
  - `subscription.hash = fnv1a64:b65323fc62f184fe`
  - `acceptedTopicCount = 43`
  - `rejectedTopics = []`
  - `requiredMissingTopics = []`
  - `lastRequestedSubscriptionHash = lastAcceptedSubscriptionHash = activeSubscriptionHash = fnv1a64:b65323fc62f184fe`
- 订阅内变更：
  - 发布 `org.store.profile`，marker `vm-tdp-final-1777394742998`。
  - 终端 projection 收到该 marker。
  - ACK 从 `1671` 推进到 `1672`。
- 订阅外变更：
  - 发布 `unsubscribed.vm.probe`。
  - 终端 `activeEntries["unsubscribed.vm.probe:STORE:store-kernel-base-test:<itemKey>"] = null`。
  - ACK 保持 `1672`，未因未订阅 topic 推进。
- 服务端 session：
  - `/api/v1/admin/tdp/sessions?sandboxId=sandbox-kernel-base-test` 显示 live explicit session。
  - `ackLag = 0`
  - `applyLag = 0`

### 最新本地验证矩阵

- `1-kernel/1.1-base/tdp-sync-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn test -- --no-file-parallelism --maxWorkers=1`
  - 结果：通过，15 个 test files，65 个 tests。
- `1-kernel/1.1-base/runtime-shell-v2`
  - `corepack yarn type-check`
  - `corepack yarn test -- --no-file-parallelism --maxWorkers=1`
  - 结果：通过，27 个 tests。
- `1-kernel/1.1-base/tcp-control-runtime-v2`
  - `corepack yarn type-check`
  - `corepack yarn test -- --no-file-parallelism --maxWorkers=1`
  - 结果：通过，3 个 test files，11 个 tests。
- `0-mock-server/mock-terminal-platform/server`
  - `corepack yarn type-check`
  - `corepack yarn vitest run src/test/tdp-projection-publisher.spec.ts src/test/terminal-log-api.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，2 个 test files，24 个 tests。
- `3-adapter/android/host-runtime-rn84`
  - `corepack yarn type-check`
  - 结果：通过。
- `4-assembly/android/mixc-catering-assembly-rn84`
  - `corepack yarn type-check`
  - `corepack yarn vitest run test/scenarios/assembly-create-app.spec.ts --no-file-parallelism --maxWorkers=1`
  - 结果：通过，8 个 tests。
- `1-kernel/1.2-business/organization-iam-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- `1-kernel/1.2-business/catering-product-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- `1-kernel/1.2-business/catering-store-operating-master-data`
  - `corepack yarn type-check`
  - 结果：通过。
- 仓库根目录：
  - `git diff --check`
  - 结果：通过。

### 最终结果

- 第 8 节列出的 H1/H2/H3/H4 与 M1/M2/M3/M5/M6 均已实现并有测试或 VM 证据。
- AC-SYS-2 已有 smoke 级性能基准；更严格的 UI FPS / 30 天表规模压测仍建议作为后续专项，不再阻塞本次 TDP topic subscription 功能验收。
- 本轮完成定义已满足：真实 VM 校验、本地矩阵、结果文档、项目长期记忆均进入收口。
