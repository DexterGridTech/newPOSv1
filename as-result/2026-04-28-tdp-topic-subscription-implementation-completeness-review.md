# TDP Topic 订阅实现完整性最终复核报告

> 日期：2026-04-28  
> 复核范围：`tdp-topic-subscription-redesign.md`、`2026-04-28-tdp-topic-subscription-redesign-review-detailed.md`、当前实现与最终验证证据  
> 结论口径：不以阶段性通过为完成，必须覆盖本地测试矩阵、VM 端到端、关键异常路径和可观测性。

## 1. 最终结论

本轮 TDP topic 按需订阅改造已经达到当前会话的完成定义：

- topic interest 由各 runtime/business module manifest 声明。
- TDP `HANDSHAKE` 汇总发送 `subscribedTopics / requiredTopics / subscriptionHash / previousAcceptedSubscriptionHash / capabilities`。
- 服务端以 profile/template policy 二次裁剪 requested topics，得到 accepted subscription，并按 accepted topics 过滤 snapshot、changes、realtime projection、command delivery。
- 终端在写入 projection repository 前仍做本地防御过滤。
- cursor validity 已同时绑定本地 requested subscription 与服务端 accepted subscription；server accepted hash 改变会强制 full sync。
- FULL_SNAPSHOT 分片、chunk 完整性校验、HTTP hasMore 补页、realtime batch ACK/backpressure、durable ACK barrier、per-terminal change log retention、HTTP fallback hash/policy 校验、session 结构化观测均已落地。
- 真实 `mixc-catering-assembly-rn84` 已上报 activation capability，能阻断 profile/template 不匹配的错误激活路径。
- VM 端验证证明真实 assembly 能连接、订阅、接收订阅内变更并 ACK，同时过滤订阅外 topic 且不推进 ACK。

因此，之前报告中列出的 H1/H2/H3/H4 与 M1/M2/M3/M5/M6 已完成；AC-SYS-2 已补 smoke 级性能基准。更严格的 UI FPS、长周期 30 天表规模、真实批量生产数据压测仍建议作为后续专项，不再阻塞本次功能验收。

## 2. 第 8 节逐项复核

| 优先级项 | 最终状态 | 关键证据 |
|---|---|---|
| H1：4-assembly 接入 `resolveClientRuntimeCapability` | 已完成 | `host-runtime-rn84/createApp.ts` 创建 `TerminalAssemblyCapabilityManifestV1`；`mixc-catering-assembly-rn84/App.tsx` 声明 POS profile/template/capabilities；`assembly-create-app.spec.ts` 验证传入 TCP assembly。 |
| H2：server accepted subscription hash 纳入 cursor validity | 已完成 | 终端持久化 requested/accepted hash；handshake 携带 `previousAcceptedSubscriptionHash`；服务端 accepted hash 变化时 `syncMode = full`；server 测试覆盖。 |
| H3：chunk completeness 校验 | 已完成 | `messageActor.ts` 校验 index、重复、缺失、item count；失败进入 protocol failed，不提交 projection/cursor；客户端测试覆盖。 |
| H4：persistence barrier 后 ACK | 已完成 | `runtime-shell-v2` 暴露 `flushPersistence()`；TDP repository actor 在 apply/recompute 后 await flush 再 completed/ACK；客户端测试覆盖 ACK 延迟到 flush 后。 |
| M1：selector memoization | 已完成 | topic index + topic entries array 复用 + resolved projection WeakMap cache；测试验证无关 topic 更新后 resolved result 引用稳定。 |
| M2：per-terminal retention | 已完成 | `pruneTdpChangeLogs` 使用 `ROW_NUMBER() OVER (PARTITION BY sandbox_id, target_terminal_id ...)`；server 测试覆盖。 |
| M3：session subscription 结构化可查 | 已完成 | `tdp_sessions` 存储 subscription JSON 字段；`/api/v1/admin/tdp/sessions` 返回 `subscription` 并按 acceptedTopics 计算 lag。 |
| M5：base required topics | 已完成 | `error.message`、`system.parameter`、`terminal.hot-update.desired`、`terminal.group.membership` 为 required；测试断言 required topics。 |
| M6：HTTP fallback hash/policy | 已完成 | 显式 HTTP fallback 必须带 `subscriptionHash`；服务端重算 accepted hash，不匹配返回 400；server 测试覆盖。 |
| 性能 smoke | 已完成 smoke 级 | 客户端 1000 item snapshot apply；服务端 100 terminal fanout/filter/prune budget。 |

## 3. 原始设计逐项对照

| 设计要求 | 状态 | 说明 |
|---|---|---|
| 终端 module manifest 声明 topic interest | 已实现 | runtime-shell descriptor 与 DSL 支持 `tdpTopicInterests`，三个 business master-data 包已声明。 |
| TCP activation 不做 topic 订阅 | 已实现 | activation 只传 `clientRuntime` capability；TDP 订阅仅在 handshake。 |
| TDP handshake 发送 topic/hash/capabilities | 已实现 | 包含 requested topics、required topics、hash、snapshot chunk capability、previous accepted hash。 |
| 服务端基于 accepted topics 过滤 snapshot/changes/realtime | 已实现 | snapshot/access、changes、highWatermark、queue realtime 均支持 subscription filter。 |
| 本地防御过滤 | 已实现 | `messageActor` 在 repository command 前过滤各类 projection 消息。 |
| required missing 严格失败 | 已实现 | `SESSION_READY` 暴露 missing 后终端 protocol failed，服务端发送错误并停止同步。 |
| subscriptionHash 变化 full rebase | 已实现 | 本地 requested 变化不复用 cursor；server accepted policy 变化强制 full。 |
| snapshot chunk 协议与完整性 | 已实现 | 服务端 chunk；终端 buffer；完整性失败不 commit。 |
| snapshot 双缓冲与原子发布 | 已实现 | `activeEntries/stagedEntries`，selector 只读 active。 |
| hasMore 与 HTTP 分页补拉 | 已实现 | `changesFetchActor` 通过 HTTP endpoint 补页，不重握手。 |
| ACK 必须在 state/topic/persistence 完成后 | 已实现 | completed command 后置，且 await `flushPersistence()`。 |
| realtime backpressure / BATCH_ACK | 已实现 | 服务端 inflight threshold + deferred flush；终端 batch apply 后 ACK。 |
| cursor 批量预分配 | 已实现 | server 批量 upsert/fanout 使用预分配 cursor。 |
| change log retention | 已实现 | materialized access 表支撑 snapshot；change log 按 terminal 保留最近 cursor。 |
| revision fingerprint | 已实现 | fingerprint 使用 item/scope/revision/operation，不 stringify payload；需保持 revision 内容不可变不变量。 |
| selector memoization | 已实现 | scope chain、topic index、resolved-by-topic 均具备缓存。 |
| profile/template compatibility | 已实现 | server 校验 profile/template/capabilities；真实 assembly 上报 capability。 |
| profile/template 不自动扩展 topic | 已实现 | profile/template 只做 allowlist 裁剪，最终仍以终端 requested topics 为准。 |

## 4. 最终验证证据

### 本地矩阵

- `tdp-sync-runtime-v2`: `corepack yarn type-check` + `corepack yarn test -- --no-file-parallelism --maxWorkers=1`，15 files / 65 tests passed。
- `runtime-shell-v2`: type-check + tests，27 tests passed。
- `tcp-control-runtime-v2`: type-check + tests，3 files / 11 tests passed。
- `mock-terminal-platform/server`: type-check + `tdp-projection-publisher.spec.ts` + `terminal-log-api.spec.ts`，2 files / 24 tests passed。
- `host-runtime-rn84`: type-check passed。
- `mixc-catering-assembly-rn84`: type-check + `assembly-create-app.spec.ts`，8 tests passed。
- 三个 business master-data 包：type-check passed。
- repo root: `git diff --check` passed。

### VM 端到端

- 设备：`emulator-5554 device`。
- App：`com.next.mixccateringassemblyrn84`，force-stop 后重新加载当前 Metro bundle。
- Automation smoke：`availableTargets = ["host", "primary"]`，当前业务主屏为 `ui.business.catering-master-data-workbench.primary-workbench`。
- 终端状态：`terminal_fqikrm1x0e0g`，`activationStatus = ACTIVATED`。
- TDP session：
  - `status = READY`
  - `syncMode = incremental`
  - `subscription.mode = explicit`
  - `subscription.hash = fnv1a64:b65323fc62f184fe`
  - `acceptedTopicCount = 43`
  - `rejectedTopics = []`
  - `requiredMissingTopics = []`
- 订阅内变更：
  - 发布 `org.store.profile` marker `vm-tdp-final-1777394742998`。
  - 终端 projection 收到 marker。
  - ACK 从 `1671` 推进到 `1672`。
- 订阅外变更：
  - 发布 `unsubscribed.vm.probe`。
  - 终端 activeEntries 无该 projection。
  - ACK 仍为 `1672`。
- 服务端 session：
  - live explicit session 可查。
  - `ackLag = 0`
  - `applyLag = 0`

## 5. 第三方视角评估

### 完整性

当前实现已经不是“主链路基本可用”，而是覆盖了协议、终端、服务端、assembly 装配、异常路径、HTTP fallback 和观测面的完整闭环。profile/template 与 topic subscription 的阶段边界也已经清晰：TCP activation 校验终端类型能力；TDP handshake 表达当前代码需要的数据范围。

### 效率

服务端侧避免了“全 topic 推送 + 终端过滤”的旧路径，snapshot 依赖 materialized access 而不是无限 change log，realtime 支持 batch/backpressure，retention 按 terminal 保留。终端侧将 projection 按 topic 索引，fingerprint 使用 revision 元数据，realtime 只重算 changed topics，并避免无关 topic 变更导致 resolved selector 重算。

### 健壮性

网络/协议异常下，chunk 不完整不会提交；cursor 复用受 requested/accepted subscription 双重约束；ACK 受 persistence barrier 约束；HTTP fallback 无法绕过服务端 accepted policy；VM 真实验证证明订阅外 topic 不污染终端 state，也不推进 ACK。

## 6. 剩余非阻塞建议

以下属于后续专项优化，不影响本轮验收：

1. 做更严格的 UI FPS / JS blocking instrumentation，而不是只用 smoke budget。
2. 做 30 天 retention 表规模和索引压测，验证真实生产量级下的查询曲线。
3. 清理历史 VM/dev session 数据，避免 `/api/v1/admin/tdp/sessions` 在长期调试后出现大量旧 session 噪声。
4. 未来若生产启用 HTTP fallback，需要补 token/session binding，而不只依赖 admin/debug 边界。

## 7. 最终判定

> TDP topic subscription 的完整设计已落地并通过本地矩阵与 VM 端到端验收。当前会话目标已满足。
