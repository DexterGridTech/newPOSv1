# TDP Topic 按需订阅改造 — 深度设计评审报告

> 评审日期：2026-04-28  
> 评审人：AI Code Review  
> 评审范围：`as-result/tdp-topic-subscription-redesign.md`（设计文档）+ 全量代码审查  
> 代码基线：`1-kernel/1.1-base/tdp-sync-runtime-v2`、`0-mock-server/mock-terminal-platform`  
> 文档版本：详细版（含代码级分析、精确行号、完整修复方案）

---

## 目录

1. [总体评价](#一总体评价)
2. [设计合理性逐条评审](#二设计合理性逐条评审)
3. [风险评审（含代码证据）](#三风险评审含代码证据)
4. [最优方案评估](#四最优方案评估)
5. [实施顺序评估](#五实施顺序评估)
6. [大数据量传输风险与最优设计](#六大数据量传输风险与最优设计)
7. [设计盲点深度分析](#七设计盲点深度分析)
8. [变更日志保留策略缺失](#八变更日志保留策略缺失)
9. [总结与行动清单](#九总结与行动清单)
10. [完整验收标准](#十完整验收标准)

---

## 一、总体评价

### 1.1 设计质量评分

| 维度 | 评分 | 说明 |
|---|---|---|
| 设计方向 | ⭐⭐⭐⭐⭐ | 正确，无需调整 |
| 安全边界 | ⭐⭐⭐⭐⭐ | 清晰，订阅只能收窄 |
| 兼容策略 | ⭐⭐⭐⭐⭐ | legacy-all 完整 |
| 风险识别 | ⭐⭐⭐⭐ | 全面，但 SESSION_READY 时序和 HTTP fallback 场景需补充 |
| 实施顺序 | ⭐⭐⭐⭐⭐ | 合理，渐进式 |
| 现有实现盲点 | ⚠️ 多处 | 见第六、七、八节，部分需在改造前修复 |

### 1.2 结论

**设计方向正确，可以推进实施。** 设计文档对现有代码事实的描述准确（`subscribedTopics` 字段存在但未被使用、服务端推送未过滤、业务包本地过滤等均与代码一致），分层清晰，安全边界明确，兼容策略完整。

**但有一个重要前提**：现有实现中存在若干独立于订阅改造的结构性 bug 和性能问题，其中部分问题会被订阅改造放大。建议在推进改造的同时，将这些问题纳入修复计划。

### 1.3 本轮一致性校准结论

本轮复核后，需要把两个阶段的语义固定下来，避免文档和后续实现混淆：

- **TCP 激活阶段**只解决“这台设备能不能被激活成激活码绑定的 TerminalProfile/TerminalTemplate”。终端在这里可以上报 `clientRuntime` / assembly capability，用于 profile/template 兼容性校验，但不在这里订阅 TDP topic。
- **TDP handshake 阶段**才解决“这台已激活终端当前代码关心哪些 topic”。终端在启动 runtime 时汇总各模块的 `tdpTopicInterests`，并在 TDP `HANDSHAKE` 中发送 `subscribedTopics + subscriptionHash + capabilities`。
- `TerminalAssemblyCapabilityManifestV1` 与 `TdpTopicInterestDeclarationV1` 必须分开。前者属于 TCP 激活兼容性，后者属于 TDP 订阅声明。不要把 `supportedTopicKeys` 放进 TCP 激活请求作为订阅依据。
- 本文统一使用 `tdpTopicInterests` 作为 module manifest 字段名，使用 `topicKey` 作为单条声明字段名；协议层继续使用已经存在的 `subscribedTopics: string[]`。
- `required` 在声明中为可选字段，默认 `false`；`required` 只用于缺失 topic 的降级/阻断决策，不参与 `subscriptionHash`。`subscriptionHash` 只绑定规范化后的 topic key 集合，保证服务端可以仅凭 `subscribedTopics` 独立计算同一个 hash。

---

## 二、设计合理性逐条评审

### 2.1 manifest 声明 topic interest ✅ 合理

**设计文档主张**：将 topic interest 放在 `KernelRuntimeModuleV2` manifest 中，通过 `TdpTopicInterestDeclarationV1` 类型声明。

**代码现状验证**：

当前 topic list 只在 `foundations/topics.ts` 中维护，与 module descriptor 完全解耦。TDP runtime 在 handshake 时无法自动汇总各业务包的 topic 需求，只能发送空的 `subscribedTopics: []`（见 `wsServer.ts:handleHandshake`）。

```typescript
// 当前 wsServer.ts 握手逻辑（简化）
// subscribedTopics 字段存在于 handshake 消息类型中，但服务端收到后不做任何过滤
const session = {
  terminalId,
  subscribedTopics: message.data.subscribedTopics ?? [],  // 存储但不使用
  // ...
}
```

**设计方案解决了这个根本问题**：manifest 声明使 TDP runtime 可以在模块加载时自动汇总所有业务包的 topic 需求，无需业务包主动注册。

**补充建议**：

`TdpTopicInterestDeclarationV1` 中的 `reason` 字段建议改为可选且**不参与 hash 计算**：

```typescript
// 建议的类型定义
interface TdpTopicInterestDeclarationV1 {
  topicKey: string
  required?: boolean
  reason?: string  // 可选，仅用于文档/调试，不参与 subscriptionHash 计算
}

// hash 计算时排除 reason / required / module source，只绑定真实数据范围
const computeSubscriptionHash = (topics: TdpTopicInterestDeclarationV1[]): string => {
  const normalized = topics
    .map(t => t.topicKey)
    .sort()
    .join('|')
  return sha256(normalized).slice(0, 16)
}
```

**理由**：`reason` 是注释性文字，开发者可能随时修改措辞；`required` 是本地/服务端能力决策语义，不改变数据范围。如果这些字段参与 hash，会导致 subscriptionHash 抖动，触发不必要的全量 snapshot；同时服务端无法仅凭 `subscribedTopics` 独立复算客户端 hash。

---

### 2.2 subscriptionHash 绑定 cursor ✅ 合理

**设计文档主张**：`cursor validity = terminalId + subscriptionHash`，当 subscriptionHash 变化时强制 `lastCursor = 0`。

**代码现状验证**：

当前 `lastCursor` 是全局的，存储在 `tdpSyncV2DomainSlice` 中，没有绑定订阅集合：

```typescript
// 当前 tdpSyncV2DomainSlice（简化）
interface TdpSyncV2DomainState {
  lastCursor: number  // 全局 cursor，无订阅绑定
  syncStatus: TdpSyncStatus
  // ...
}
```

如果订阅集合变化（例如新增了一个业务包），`lastCursor` 仍然是旧值，服务端会发送增量 changeset，但这个 changeset 不包含新订阅 topic 的历史数据，导致新 topic 的数据缺失。

**设计方案的正确性**：强制 hash 变化时 `lastCursor = 0` 是必要的，确保新订阅 topic 能收到完整的历史快照。

**风险补充**：

设计文档第 7.2 节提到"服务端判断 `client.subscriptionHash != server-normalized-subscriptionHash` 时 ERROR 或 FULL"，但没有明确说明处理优先级。

**建议明确**：服务端以自己规范化后的 hash 为准，客户端 hash 仅用于快速比对，不作为服务端决策依据。具体流程：

```
客户端发送 handshake:
  subscriptionHash: "abc123"
  subscribedTopics: ["org.store.profile", "catering.product"]

服务端处理:
  1. 对 subscribedTopics 做规范化（排序、去重、校验）
  2. 计算 server-normalized-hash = sha256(sorted topics)
  3. 如果 server-normalized-hash != client.subscriptionHash:
     → 记录警告日志（客户端 hash 计算有误）
     → 以 server-normalized-hash 为准继续处理
     → 在 SESSION_READY 中返回 acceptedTopics（服务端规范化后的结果）
  4. 客户端收到 SESSION_READY 后，用 acceptedTopics 重新计算本地 hash
     → 如果不一致，更新本地 hash（不触发重连）
```

---

### 2.3 双层防御过滤 ✅ 合理

**设计文档主张**：TDP runtime 层 + 业务包层的双重过滤。

**代码现状验证**：

当前业务包层的过滤在 `foundations/topics.ts` 中通过 topic key 白名单实现，但 TDP runtime 层没有任何过滤（服务端推送所有 topic 的数据，runtime 全部接收并存入 Redux state）。

**设计方案的正确性**：双层防御是正确的分层防御，不是重复浪费：

- **TDP runtime 层**：在数据进入 Redux state 之前过滤，减少内存占用和 fingerprint 计算量
- **业务包层**：在数据暴露给业务逻辑之前过滤，防止业务包意外访问未订阅的 topic 数据

两层过滤的职责不同，缺一不可。

---

### 2.4 visible highWatermark ✅ 合理但需要细化

**设计文档主张**：`getHighWatermarkForTerminal` 按订阅范围计算 visible highWatermark。

**边界情况分析**：

假设终端订阅集合为 `[org.store.profile]`，服务端 change log 中最新的 cursor 对应的是 `catering.product`（未订阅）：

```
change_log:
  cursor=100, topic=org.store.profile  ← 订阅
  cursor=101, topic=catering.product   ← 未订阅
  cursor=102, topic=catering.product   ← 未订阅

全局 highWatermark = 102
visible highWatermark = 100（订阅范围内最大 cursor）
```

此时终端的 `hasMore` 判断基于 visible highWatermark=100，而终端当前 cursor 也是 100，所以 `hasMore = false`。这是正确的——终端确实已经同步了所有订阅 topic 的数据。

**但有一个微妙的问题**：如果后续 cursor=103 是 `org.store.profile` 的变更，服务端的实时推送会正确发送给终端（因为推送是基于 topic 过滤的）。但如果终端在 cursor=100 时断线，重连后发送 `lastCursor=100`，服务端需要正确返回 cursor=103 的变更（跳过 101、102）。

**建议在 SQL 实现中明确**：

```sql
-- visible highWatermark 查询
SELECT COALESCE(MAX(cursor), 0) as visible_high_watermark
FROM tdp_change_logs
WHERE sandbox_id = ? 
  AND target_terminal_id = ? 
  AND topic_key IN (/* 订阅 topic 列表 */)

-- changes since cursor 查询（带 topic 过滤）
SELECT * FROM tdp_change_logs
WHERE sandbox_id = ?
  AND target_terminal_id = ?
  AND cursor > ?
  AND topic_key IN (/* 订阅 topic 列表 */)
ORDER BY cursor ASC
LIMIT ?
```

---

## 三、风险评审（含代码证据）

### 3.1 高风险：subscriptionHash 稳定性

**风险描述**：`tdp-sync-runtime-v2` 自身声明的 base mandatory topics（`error.message`、`system.parameter` 等）如果在未来版本中新增或修改，会导致所有终端的 subscriptionHash 变化，触发全量 snapshot。

**影响范围**：所有终端，在 runtime 升级时同时触发全量 snapshot，可能造成服务端瞬时压力峰值。

**建议方案**：

方案 A：base mandatory topics 版本化

```typescript
// 版本化的 base topics
const TDP_BASE_TOPICS_V1 = [
  'error.message',
  'system.parameter',
  'iam.role.definition',
] as const

// 升级时用 V2，不修改 V1
const TDP_BASE_TOPICS_V2 = [
  ...TDP_BASE_TOPICS_V1,
  'system.feature.flag',  // 新增
] as const
```

方案 B：base topics 从 hash 计算中分离

```typescript
// hash 只计算业务 topic，base topics 由服务端强制注入
const computeSubscriptionHash = (
  businessTopics: string[],
  // baseTopics 不参与 hash
): string => {
  return sha256(businessTopics.sort().join('|')).slice(0, 16)
}
```

**推荐方案 B**：base topics 是 runtime 的内部实现细节，不应该暴露给 hash 计算，服务端可以在 SESSION_READY 中告知终端实际注入了哪些 base topics。

---

### 3.2 中风险：SESSION_READY 订阅摘要的时序

**风险描述**：当终端在处理 `SESSION_READY` 时发现有 `requiredMissingTopics`，需要进入 `DEGRADED` 状态，但此时 snapshot 数据可能已经在传输中。

**代码现状**：

```typescript
// wsServer.ts（简化）
// SESSION_READY 之后立即发送 FULL_SNAPSHOT 或 CHANGESET
sendMessage(socket, { type: 'SESSION_READY', data: { ... } })
// 没有等待客户端确认
sendMessage(socket, { type: 'FULL_SNAPSHOT', data: snapshotData })
```

**建议协议约定**：

严格模式（有 `requiredMissingTopics` 时，推荐第一阶段默认）：
```
服务端 → 客户端: SESSION_READY { requiredMissingTopics: ["iam.role.definition"] }
服务端: 不发送 snapshot / changes / chunk
服务端: 发送 ERROR 或等待客户端主动关闭
客户端: 检测到 requiredMissingTopics，进入 FAILED 或不可营业状态
```

降级兼容模式（仅灰度或显式允许时）：
```
服务端 → 客户端: SESSION_READY { requiredMissingTopics: ["iam.role.definition"], mode: "degraded" }
服务端: 不立即发送 snapshot
客户端: 检测到 requiredMissingTopics，进入 DEGRADED 状态
客户端 → 服务端: SESSION_DEGRADED_ACK { acceptDegradedMode: true }
服务端: 只发送按 acceptedTopics 过滤的 snapshot
```

正常模式（无 `requiredMissingTopics` 时）：
```
服务端 → 客户端: SESSION_READY { acceptedTopics: [...], rejectedTopics: [] }
服务端: 立即发送 snapshot（当前行为，无需等待）
```

---

### 3.3 中风险：多 session 的 cursor 语义

**风险描述**：同一 terminal 的两个 session（例如主屏和副屏）可能有不同的 subscriptionHash，但它们共享同一个 `tdp_terminal_subscription_offsets` 表的 `(sandbox_id, terminal_id, subscription_hash)` 主键。

**代码现状**：

当前 `tdp_sessions` 表没有 `subscriptionHash` 字段（已通过 `schema.ts` 确认），cursor 是按 `(sandbox_id, terminal_id)` 维护的，不区分 session。

**建议**：在设计文档中明确说明"同一 terminal 的不同 session 可以有不同的 subscriptionHash，服务端按 session 分别维护 cursor 和 queue"。

具体实现：

```sql
-- 建议的 session-level cursor 表
CREATE TABLE tdp_session_cursors (
  session_id TEXT NOT NULL,
  sandbox_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  subscription_hash TEXT NOT NULL,
  last_cursor INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id)
)
```

---

### 3.4 低风险：topic key 校验规则

**风险描述**：设计文档规定 topic key 只允许小写字母、数字、点、短横线、下划线，禁止 `*` wildcard。需要确认现有 topic key 是否全部符合规范。

**建议**：在第一阶段实施时，先对现有所有 topic key 做一次校验：

```typescript
const TOPIC_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/

const validateTopicKey = (key: string): boolean => {
  return TOPIC_KEY_PATTERN.test(key) && !key.includes('*')
}

// 启动时校验所有已注册 topic
const validateAllTopics = (topics: string[]): void => {
  const invalid = topics.filter(t => !validateTopicKey(t))
  if (invalid.length > 0) {
    throw new Error(`Invalid topic keys: ${invalid.join(', ')}`)
  }
}
```

---

### 3.5 低风险：HTTP fallback 的 session-aware 方案

**风险描述**：原设计文档第 6.10 节曾偏向方案 A（session-aware endpoint），但当前代码中 snapshot 和 changes 是在 WS 握手内联返回的。本轮一致性复核后，主设计已改为按场景选择：WS 断线走重新握手，WS 在线补页可用 session-aware 或显式订阅，特殊 HTTP/调试场景必须显式携带 subscription。

**代码现状**：

`httpService.ts` 中已经存在独立的 HTTP 接口：

```typescript
// httpService.ts（已存在）
GET /api/v1/tdp/terminals/{terminalId}/snapshot
GET /api/v1/tdp/terminals/{terminalId}/changes?cursor={cursor}&limit={limit}
```

这些接口目前用于开发调试，但可以作为 WS 断线后的补偿通道。

**建议**：

- 如果是 WS 断线后的补偿，应该重新建立 WS 连接（重新握手），而不是走 HTTP。
- 如果是特殊场景（如 WS 不可用），HTTP endpoint 应该接受 `subscriptionHash + topics` 参数（显式订阅），而不是依赖已失效的 sessionId。
- **分页补偿场景**（`hasMore = true` 时）：应该使用已有的 HTTP changes 接口，而不是重新握手。请求可以绑定仍有效的 session，也可以显式携带 `subscriptionHash + topics`，但不能回退为全量 terminal changes。

---

## 四、最优方案评估

### 4.1 关键架构决策评估

| 决策 | 评估 | 理由 |
|---|---|---|
| manifest 声明 topic interest | ✅ 最优 | 包契约，不是运行时配置，符合 YAGNI |
| subscriptionHash 绑定 cursor | ✅ 最优 | 避免漏数据，语义清晰 |
| 禁止 per-topic cursor 作为主协议 | ✅ 最优 | 复杂度不值得，第一阶段不需要 |
| 禁止 lastUpdatedAt 作为 cursor | ✅ 最优 | 时间戳不可靠，已有充分论证 |
| legacy-all 兼容模式 | ✅ 必要 | 老终端不能因服务端升级漏数据 |
| 双层防御过滤 | ✅ 最优 | 分层防御，各层职责清晰 |
| session-level queue | ✅ 最优 | 解决多 session cursor 污染问题 |

### 4.2 可以简化的地方

**`tdp_terminal_subscription_offsets` 表**：

设计文档第 6.2 节建议新增此表，但也说明"第一阶段也可以只加 session 字段"。建议**第一阶段不加此表**：

- 此表的主要用途是诊断和未来优化，不是核心功能
- 增加此表会增加握手时的写入操作，影响连接建立速度
- 第一阶段的核心目标是"服务端按需过滤"，不是"服务端诊断"

**`subscriptionHashChangedFrom` 字段**：

设计文档第 5.7 节提出在 handshake 中发送此字段，用于服务端观测。建议**第一阶段不实现**：

- 服务端可以通过 audit log 自行追踪 hash 变化
- 增加此字段会增加协议复杂度，但对核心功能没有贡献

### 4.3 需要补充的地方

**snapshot 替换时的原子性**：

设计文档第 5.9 节提到"终端 `tdpProjection` 使用 snapshot 替换本地 retained state"，但没有说明替换操作的原子性保证。

**建议补充**：snapshot 替换必须是原子操作，不能出现"旧 topic A 的数据 + 新 topic B 的数据"的混合状态。

当前 `tdpProjection.ts:49` 的 `applySnapshotLoaded` 实现：

```typescript
// 当前实现（非原子，有中间状态）
applySnapshotLoaded: (state, action) => {
  // 先清空
  Object.keys(state).forEach(key => { delete state[key] })
  // 再写入全部 — 如果此时有其他 action 插入，会看到空状态
  action.payload.snapshot.forEach(item => { state[toProjectionId(item)] = item })
}
```

Redux reducer 本身是同步的，在单个 reducer 执行期间不会有其他 action 插入，所以这个实现在 Redux 语义下是原子的。但如果改为异步分批写入（见第六节方案二），就需要额外的 `isApplyingSnapshot` 标志位。

**订阅缩小时的清理顺序**：

```
正确顺序：
1. 应用新 snapshot（只包含新订阅 topic）
2. 清除本地仓库中不在新订阅集合内的 topic 数据
3. 触发业务包 rebuild

错误顺序（会导致业务包短暂看到旧数据）：
1. 触发业务包 rebuild（此时旧 topic 数据还在）
2. 应用新 snapshot
3. 清除旧 topic 数据
```

---

## 五、实施顺序评估

### 5.1 设计文档四阶段评估

设计文档第 12 节的四阶段实施顺序是合理的，以下是每个阶段的补充建议。

### 5.2 第一阶段补充

**在"终端增加本地防御过滤"之前，建议先做**：

在 `tdp-sync-runtime-v2` 的 handshake 中加入 `capabilities`，让服务端可以识别新客户端。这里不要把 `subscribedTopics` 长期设计成空数组；空订阅只适合作为极短的 bootstrap shim，真正进入 AC-1.2 后必须发送已解析的 `subscribedTopics` 和稳定的 `subscriptionHash`。

```typescript
// 第一阶段 handshake 扩展（最小改动）
interface TdpHandshakeV2 {
  terminalId: string
  lastCursor: number
  subscribedTopics: string[]  // 来自 tdpTopicInterests resolver 的有效 topicKey 列表
  subscriptionHash: string    // 基于规范化订阅集合计算
  capabilities: string[]      // 例如 ['tdp.topic-subscription.v1']
}
```

如果需要拆批落地，可以先只发送 `capabilities` 来铺服务端 negotiation，但该过渡状态不能进入验收口径；验收口径必须是 handshake 携带真实订阅集合。

**第一阶段可以独立完成的优化**（与订阅改造无关）：

1. 修复 `hasMore` 硬编码 `false` 的 bug（见第七节盲点四）
2. 将 `applySnapshotLoaded` 改为异步分批写入（见第六节方案二）
3. 修复 `toTopicFingerprint` 的 `JSON.stringify` 问题（见第七节盲点六）

### 5.3 第二阶段注意

"snapshot / changes 加 topic filter"这一步需要特别注意：**必须同时修改 `getHighWatermarkForTerminal`**，否则 `hasMore` 判断会出错。

同时，第二阶段必须同步实施 FULL_SNAPSHOT 分片传输（见第六节方案一），原因：

- topic 订阅改造后，每次 subscriptionHash 变化都会触发 FULL_SNAPSHOT
- 如果不同步实施分片传输，大数据量场景下的断连风险会随着改造推进而增加
- **分片传输是第二阶段的前置条件，不是可选项**

### 5.4 第三阶段注意

"HTTP fallback session-aware"这一步需要先明确 HTTP fallback 的触发场景（见风险 3.5），不能默认选单一方案。

**建议优先实现**：`hasMore = true` 时的 HTTP 分页拉取（使用已有的 `httpService.ts` 接口），这比 session-aware snapshot endpoint 更紧迫，且实现更简单。分页请求必须绑定当前 subscription，可以使用仍有效的 session，也可以显式携带 `subscriptionHash + topics`。

---

## 六、大数据量传输风险与最优设计

> 本节基于对 `service.ts`、`tdpProjection.ts`、`sessionConnectionRuntime.ts`、`reduceServerMessage.ts` 的代码审查，独立于 topic 订阅改造，是当前实现的结构性盲点。

### 6.1 五个具体问题（含代码证据）

#### 问题一：FULL_SNAPSHOT 无分页，单条巨型消息（高风险）

**代码位置**：`service.ts:659` 的 `getTerminalSnapshotEnvelope`

```sql
-- 当前实现：无 LIMIT，无分页
SELECT DISTINCT p.* 
FROM tdp_projections p
JOIN tdp_terminal_topic_access c ON ...
WHERE p.sandbox_id = ? AND c.target_terminal_id = ?
-- 无 LIMIT，无分页
```

服务端把终端所有 projection 全量查出后，作为**单条 WebSocket 消息**发送。数据量大时（例如 500 条商品 × 多个 topic），这条消息可能达到数 MB 的 JSON。

**具体风险**：
- React Native 在部分 Android 设备上对单帧有内存限制，超限直接断连
- Hermes 引擎 `JSON.parse` 大字符串是同步操作，会阻塞 JS 线程，可能触发 ANR
- 网络抖动时大消息更容易中途断开，断开后整条消息作废，必须重传整个 snapshot

**topic 订阅改造的放大效应**：改造后每次 subscriptionHash 变化都触发 FULL_SNAPSHOT，触发频率从"仅首次连接"变为"每次业务包安装/卸载"，问题被放大。

---

#### 问题二：Redux reducer 同步处理大快照（高风险）

**代码位置**：`tdpProjection.ts:49` 的 `applySnapshotLoaded`

```typescript
applySnapshotLoaded: (state, action) => {
  // 先清空
  Object.keys(state).forEach(key => { delete state[key] })
  // 再写入全部 — 1000 条在 JS 线程上同步跑完，UI 完全冻结
  action.payload.snapshot.forEach(item => { state[toProjectionId(item)] = item })
}
```

1000 条 snapshot 在 JS 线程上同步跑完，期间 UI 完全冻结。topic 订阅改造后 FULL_SNAPSHOT 触发频率增加，问题被放大。

---

#### 问题三：无背压机制（中风险）

**代码位置**：`service.ts:186` 的 `BATCH_WINDOW_MS = 120ms`

`BATCH_WINDOW_MS = 120ms` 只是合并推送，不是限速。`upsertProjectionBatch`（`service.ts:1007`）在批量写入后直接调用 `flushProjectionQueueToOnlineTerminal`，绕过 timer，立即推送所有变更。

后台批量导入数据时，终端会在极短时间内收到大量 `PROJECTION_BATCH` 消息，JS 线程处理队列积压。

---

#### 问题四：N+1 cursor 查询（中风险）

**代码位置**：`service.ts:953` 的 `upsertProjectionBatch`

```typescript
// 每个 terminal 每条 projection 都单独调用 getNextCursorForTerminal
// 100 条 projection × 10 个终端 = 1000 次 SQLite 查询
for (const terminal of onlineTerminals) {
  for (const projection of projections) {
    const cursor = getNextCursorForTerminal(sandboxId, terminal.id)  // N+1
    // ...
  }
}
```

100 条 projection × 10 个终端 = 1000 次查询，在 SQLite 上会明显变慢，间接导致推送延迟堆积。

---

#### 问题五：`flushMode: 'immediate'` 持久化（低风险）

**代码位置**：`tdpProjection.ts:107`

```typescript
persistence: [{
  kind: 'record',
  storageKeyPrefix: 'entries',
  getEntries: state => state,
  flushMode: 'immediate',  // 每次 Redux state 变化都立即写本地存储
}]
```

大快照替换时，这意味着大量同步 I/O，在低端 Android 设备上可能造成明显卡顿。

---

### 6.2 五个最优解决方案

#### 方案一：FULL_SNAPSHOT 分片传输（解决问题一）

**协议扩展**：

```typescript
// 服务端新增消息类型
type SNAPSHOT_BEGIN = {
  type: 'SNAPSHOT_BEGIN'
  data: {
    snapshotId: string       // 本次 snapshot 的唯一 ID
    totalChunks: number      // 总分片数
    totalItems: number       // 总条目数
    highWatermark: number
    subscriptionHash: string
  }
}

type SNAPSHOT_CHUNK = {
  type: 'SNAPSHOT_CHUNK'
  data: {
    snapshotId: string
    chunkIndex: number       // 从 0 开始
    items: TdpProjectionEnvelope[]
  }
}

type SNAPSHOT_END = {
  type: 'SNAPSHOT_END'
  data: {
    snapshotId: string
    checksum?: string        // 可选：所有 itemKey 的 hash，用于完整性校验
  }
}
```

**服务端实现**（`service.ts`）：

```typescript
const SNAPSHOT_CHUNK_SIZE = 50  // 每片 50 条，约 50-200KB

const sendSnapshotChunked = (session, items, highWatermark, subscriptionHash) => {
  const snapshotId = createId('snap')
  const chunks = chunk(items, SNAPSHOT_CHUNK_SIZE)

  session.socket.send(JSON.stringify({
    type: 'SNAPSHOT_BEGIN',
    data: { snapshotId, totalChunks: chunks.length, totalItems: items.length, highWatermark, subscriptionHash }
  }))

  for (let i = 0; i < chunks.length; i++) {
    session.socket.send(JSON.stringify({
      type: 'SNAPSHOT_CHUNK',
      data: { snapshotId, chunkIndex: i, items: chunks[i] }
    }))
  }

  session.socket.send(JSON.stringify({
    type: 'SNAPSHOT_END',
    data: { snapshotId }
  }))
}
```

**终端实现**（`tdpProjection.ts`）：

```typescript
interface TdpProjectionState {
  entries: Record<string, TdpProjectionEnvelope>
  pendingSnapshot?: {
    snapshotId: string
    totalChunks: number
    receivedChunks: number
    buffer: TdpProjectionEnvelope[]
    highWatermark: number
  }
}

// SNAPSHOT_BEGIN：初始化缓冲区，不清空现有数据（用户仍可看到旧数据）
// SNAPSHOT_CHUNK：追加到缓冲区
// SNAPSHOT_END：原子替换 entries，清空缓冲区，触发 rebuild
```

**关键优势**：
- 每片消息小，网络中断后重连，服务端重新发送完整分片序列，比重传单条巨型消息更可靠；这不是天然断点续传。
- JS 线程每次只处理 50 条，不阻塞 UI
- 现有数据在 `SNAPSHOT_END` 前保持可用，用户不会看到空白状态

如果未来要做真正的 chunk 断点续传，需要终端在重连 handshake 中带上 `snapshotId + lastChunkIndex`，且服务端缓存同一次 snapshot 的分片结果。复杂度较高，第一阶段不建议做。

---

#### 方案二：异步分批写入 Redux（解决问题二）

```typescript
// messageActor.ts 中处理 FULL_SNAPSHOT
const applySnapshotAsync = async (snapshot: TdpProjectionEnvelope[], highWatermark: number) => {
  const BATCH_SIZE = 100
  dispatch(tdpProjectionV2Actions.setApplyingSnapshot(true))
  dispatch(tdpProjectionV2Actions.resetProjection())
  for (let i = 0; i < snapshot.length; i += BATCH_SIZE) {
    dispatch(tdpProjectionV2Actions.applyBatch(snapshot.slice(i, i + BATCH_SIZE)))
    await Promise.resolve()  // yield JS 线程，让 UI 有机会响应
  }
  dispatch(tdpProjectionV2Actions.setApplyingSnapshot(false))
  dispatch(tdpSyncV2DomainActions.snapshotApplyCompleted({ highWatermark }))
}
```

**注意**：`isApplyingSnapshot = true` 期间，业务包不能读取数据（数据不完整）。需要在 selector 层加保护：

```typescript
const selectTdpProjectionReady = (state: RootState) =>
  !state.tdpProjection.isApplyingSnapshot

// 业务包 selector 加前置检查
const selectProductList = createSelector(
  [selectTdpProjectionReady, selectRawProductEntries],
  (ready, entries) => ready ? Object.values(entries) : []
)
```

---

#### 方案三：服务端背压控制（解决问题三）

```typescript
// 终端收到 PROJECTION_BATCH 后发送 BATCH_ACK
type BATCH_ACK = {
  type: 'BATCH_ACK'
  data: {
    nextCursor: number
    processingLagMs?: number  // 终端处理耗时，服务端可据此调整推送速率
  }
}
```

服务端维护每个 session 的未确认 batch 数量，超过阈值（例如 3 个）时暂停推送，等待 ACK。

**建议作为第三阶段优化**，不是第一阶段必须项。

---

#### 方案四：cursor 批量预分配（解决问题四）

```typescript
// 服务端：批量写入前，一次性为每个 terminal 预分配 N 个 cursor
const preallocateCursors = (sandboxId: string, terminalId: string, count: number): number[] => {
  const row = sqlite.prepare(`
    SELECT COALESCE(MAX(cursor), 0) as high_watermark
    FROM tdp_change_logs WHERE sandbox_id = ? AND target_terminal_id = ?
  `).get(sandboxId, terminalId) as { high_watermark: number }
  const base = row.high_watermark + 1
  // 一次性更新 high_watermark，预留 count 个 cursor
  sqlite.prepare(`
    UPDATE tdp_terminal_cursors SET high_watermark = ? WHERE sandbox_id = ? AND terminal_id = ?
  `).run(base + count - 1, sandboxId, terminalId)
  return Array.from({ length: count }, (_, i) => base + i)
}
```

100 条 projection × 10 个终端只需 10 次查询，而不是 1000 次。

---

#### 方案五：持久化延迟写入（解决问题五）

```typescript
persistence: [{
  kind: 'record',
  storageKeyPrefix: 'entries',
  getEntries: state => state,
  flushMode: 'debounced',
  debounceMs: 500,  // snapshot 应用期间积累，500ms 后统一写入
}]
```

在 `SNAPSHOT_END` 或 `applySnapshotCompleted` 后触发一次性 flush，而不是每条 projection 写入都触发 I/O。

---

### 6.3 推荐实施优先级

| 优先级 | 方案 | 解决问题 | 实施阶段 |
|---|---|---|---|
| P0 | 方案一：FULL_SNAPSHOT 分片传输 | 单条大消息断连、ANR | 第二阶段前置 |
| P0 | 方案四：cursor 批量预分配 | N+1 查询导致推送延迟 | 第二阶段同步 |
| P1 | 方案二：异步分批写入 Redux | JS 线程阻塞 | 第一阶段可先做 |
| P2 | 方案五：持久化延迟写入 | 低端设备 I/O 卡顿 | 第二阶段 |
| P3 | 方案三：背压控制 | 批量导入时推送积压 | 第三阶段 |

---

## 七、设计盲点深度分析

> 本节基于对完整 actor 链路、selector、cursor 反馈机制的代码审查，指出设计文档未覆盖的结构性问题。每个盲点均包含：问题描述、代码证据、影响分析、最优修复方案。

### 7.1 盲点一：`recomputeResolvedTopicChanges` 的 O(N×M) 全量计算

**代码位置**：`topicChangePublisher.ts:117`、`projectionRepositoryActor.ts:19`

**问题描述**：

每次收到任何数据（snapshot、changeset、单条 projection、batch）后，都会触发一次 `publishTopicDataChangesV2`。这个函数的逻辑是：

1. 遍历 projection state 中**所有条目**，按 topic 分组
2. 对**每个 topic** 计算 fingerprint：`Object.values(entries).map(item => JSON.stringify(item.payload)).sort().join('|')`
3. 与上次 fingerprint 比对，有变化则 dispatch `tdpTopicDataChanged`

**代码证据**：

```typescript
// topicChangePublisher.ts:117（简化）
const publishTopicDataChangesV2 = (state: RootState, fingerprintRef: TopicChangePublisherFingerprintV2) => {
  const allTopics = selectAllTopicKeys(state)  // 获取所有 topic
  for (const topicKey of allTopics) {          // 遍历所有 topic
    const resolved = selectTdpResolvedProjectionByTopic(state, topicKey)  // 重建 scope 链
    const newFingerprint = toTopicFingerprint(resolved)                    // 全量 stringify
    if (newFingerprint !== fingerprintRef.byTopic[topicKey]) {
      fingerprintRef.byTopic[topicKey] = newFingerprint
      dispatch(tdpTopicDataChanged({ topicKey, data: resolved }))
    }
  }
}
```

**影响分析**：

后台批量更新 100 条商品，服务端发出 100 条 `PROJECTION_CHANGED`，终端每收到一条就触发一次全量 fingerprint 重算：

```
100 条变更 × 20 个 topic × 500 条/topic × JSON.stringify = 1,000,000 次 stringify 操作
```

topic 订阅改造后，虽然 topic 数量会减少，但单个 topic 内的条目数量不变，问题依然存在。

**最优修复方案**：fingerprint 增量维护

```typescript
// 收到单条 projection 变更时，只更新该 topic 的 fingerprint
const updateTopicFingerprintIncremental = (
  fingerprintRef: TopicChangePublisherFingerprintV2,
  changedTopicKey: string,
  state: RootState,
): boolean => {
  const resolved = selectTdpResolvedProjectionByTopic(state, changedTopicKey)
  const newFingerprint = toTopicFingerprint(resolved)
  if (newFingerprint === fingerprintRef.byTopic[changedTopicKey]) return false
  fingerprintRef.byTopic[changedTopicKey] = newFingerprint
  fingerprintRef.resolvedByTopic[changedTopicKey] = resolved
  return true
}

// PROJECTION_CHANGED 和 PROJECTION_BATCH 携带了 topic 信息，直接定向更新
// 只有 FULL_SNAPSHOT 和 CHANGESET 才需要全量重算
```

---

### 7.2 盲点二：cursor ACK 与数据落地的竞态

**代码位置**：`cursorFeedbackActor.ts`、`projectionRepositoryActor.ts`

**问题描述**：

`tdpSnapshotLoaded` 命令同时被两个 actor 监听：
- `TdpProjectionRepositoryActor`：写入 projection state，然后触发 `recomputeResolvedTopicChanges`
- `TdpCursorFeedbackActor`：发送 ACK 和 STATE_REPORT 给服务端

**顺序风险**：

actor 系统中，同一命令的多个 handler 的执行顺序取决于注册顺序和调度策略。cursor ACK 可能在 projection 数据实际写入 Redux state **之前**就发送给服务端。

这个结论需要结合当前 actor runtime 核实：如果 actor 系统保证同一 command 的多个 handler 串行执行，且注册顺序稳定，那么这里不一定存在真实并发竞态。但即便当前实现是串行的，ACK 顺序也不应依赖 actor 注册顺序这种隐式约定；设计上仍应引入显式的 apply completed 事件，把“已接收消息”和“已应用并可推进 cursor”拆开。

```
时序 A（正确）：
  tdpSnapshotLoaded
    → ProjectionRepositoryActor: 写入 state（同步完成）
    → CursorFeedbackActor: 发送 ACK

时序 B（竞态，可能发生）：
  tdpSnapshotLoaded
    → CursorFeedbackActor: 发送 ACK（此时 state 还未写入）
    → ProjectionRepositoryActor: 写入 state
```

**影响**：服务端收到 ACK 后认为终端已应用该 cursor，但终端实际上还没有完成写入。如果此时终端崩溃重启，用 ACK 过的 cursor 重连，服务端会发增量 changeset，但终端本地 projection 实际上是空的（崩溃前没有持久化完成）。

**最优修复方案**：cursor 反馈在数据确认落地后发送

```
tdpSnapshotLoaded
  → TdpProjectionRepositoryActor: 写入 state
    → recomputeResolvedTopicChanges: 计算变更，dispatch tdpTopicDataChanged
      → snapshotApplyCompleted（新增命令）
        → TdpCursorFeedbackActor: 此时再发 ACK（数据已落地）
```

新增 `snapshotApplyCompleted` 命令，作为数据落地的信号，`CursorFeedbackActor` 改为监听这个命令而不是 `tdpSnapshotLoaded`。

---

### 7.3 盲点三：`selectTdpResolvedProjectionByTopic` 无 memoization

**代码位置**：`selectors/tdpSync.ts:75`

**问题描述**：

`selectTdpResolvedProjectionByTopic` 每次调用都会：
1. 调用 `buildScopePriorityChain` 重建 scope 链（读取 binding、terminalId、group membership）
2. 遍历该 topic 的所有 entries，对每条 entry 在 scope 链中做 `findIndex`

这个 selector 没有 memoization。`publishTopicDataChangesV2` 对每个 topic 都调用一次，如果有 20 个 topic，就调用 20 次，每次都重建 scope 链。

**代码证据**：

```typescript
// selectors/tdpSync.ts:75（简化）
export const selectTdpResolvedProjectionByTopic = (
  state: RootState,
  topicKey: string,
): Record<string, TdpProjectionEnvelope> => {
  const scopeChain = buildScopePriorityChain(  // 每次调用都重建
    state.tcpBinding,
    state.tcpTerminalId,
    state.terminalGroupMembership,
  )
  const entries = selectTdpProjectionEntriesByTopic(state, topicKey)
  return resolveByPriority(entries, scopeChain)
}
```

**最优修复方案**：用 `reselect` memoized selector

```typescript
// scope 链只在 binding/terminalId/groupMembership 变化时重算
const selectScopePriorityChain = createSelector(
  [selectTcpBindingSnapshot, selectTcpTerminalId, selectTerminalGroupMembership],
  (binding, terminalId, groups) => buildScopePriorityChain(binding, terminalId, groups)
)

// 每个 topic 的 resolved projection 独立 memoize
const makeSelectTdpResolvedProjectionByTopic = () => createSelector(
  [selectTdpProjectionEntriesByTopic, selectScopePriorityChain],
  (entries, scopeChain) => resolveByPriority(entries, scopeChain)
)
```

---

### 7.4 盲点四：CHANGESET 的 `hasMore` 永远是 `false`

**代码位置**：`wsServer.ts:166-176`

**问题描述**：

```typescript
// wsServer.ts:166（当前实现）
const changes = getTerminalChangesSince(sandboxId, terminalId, lastCursor)
sendMessage(socket, {
  type: 'CHANGESET',
  data: {
    changes: changes.map(item => item.change),
    nextCursor: ...,
    hasMore: false,  // ← 硬编码 false，永远不分页
    highWatermark,
  },
})
```

`getTerminalChangesSince` 默认 `limit = 100`（`service.ts:697`），但 `hasMore` 永远是 `false`。如果终端离线期间积累了超过 100 条变更，握手时只拿到前 100 条，`hasMore = false` 让终端误以为已经同步完毕，实际上漏掉了后续变更。

**影响**：终端数据不完整，业务包看到的是截断的历史数据，且没有任何错误提示。

**修复方案**：

服务端：多查一条判断是否有更多

```typescript
// service.ts
const getTerminalChangesSince = (sandboxId, terminalId, cursor, limit = 100) => {
  const rows = sqlite.prepare(`
    SELECT * FROM tdp_change_logs
    WHERE sandbox_id = ? AND target_terminal_id = ? AND cursor > ?
    ORDER BY cursor ASC
    LIMIT ?
  `).all(sandboxId, terminalId, cursor, limit + 1)  // 多查一条
  
  const hasMore = rows.length > limit
  return { changes: rows.slice(0, limit), hasMore }
}
```

终端：处理 `hasMore = true` 时的分页拉取

```typescript
// messageActor.ts 处理 CHANGESET
case 'CHANGESET': {
  dispatch(tdpChangesLoaded({ changes: message.data.changes, nextCursor: message.data.nextCursor }))
  if (message.data.hasMore) {
    // 通过 HTTP 接口拉取下一页（使用已有的 httpService.ts 接口）
    dispatch(tdpFetchMoreChanges({ cursor: message.data.nextCursor }))
  }
  break
}
```

**注意**：分页拉取应该使用 HTTP 接口（`GET /api/v1/tdp/terminals/{terminalId}/changes?cursor=...`），而不是重新握手。`httpService.ts` 中已有此接口，可以直接使用。

---

### 7.5 盲点五：`syncMode` 判断依赖魔法数字 1000

**代码位置**：`wsServer.ts:113`

**问题描述**：

```typescript
// wsServer.ts:113
const syncMode = lastCursor === 0 || lastCursor < Math.max(0, highWatermark - 1000)
  ? 'full'
  : 'incremental'
```

服务端用 `highWatermark - 1000` 判断 cursor 是否"太旧"，超过 1000 个 cursor 差距就强制 full snapshot。这个 1000 是硬编码的魔法数字。

**具体问题**：

1. 后台批量导入了 2000 条数据（产生 2000 个 cursor），终端短暂离线后重连，即使实际上只有几条业务数据变化，也会触发 full snapshot
2. topic 订阅改造后，如果服务端改用 visible highWatermark，这个判断逻辑需要同步更新，否则会出现"visible cursor 差距小但全局 cursor 差距大"导致不必要的 full snapshot

**最优修复方案**：

```typescript
// 方案 A：改为可配置参数
const TDP_CURSOR_STALE_THRESHOLD = parseInt(process.env.TDP_CURSOR_STALE_THRESHOLD ?? '1000')

// 方案 B（推荐）：检查 cursor 是否在 change log 保留范围内
const isCursorStale = (sandboxId: string, terminalId: string, cursor: number): boolean => {
  const oldest = sqlite.prepare(`
    SELECT MIN(cursor) as oldest_cursor FROM tdp_change_logs
    WHERE sandbox_id = ? AND target_terminal_id = ?
  `).get(sandboxId, terminalId) as { oldest_cursor: number | null }
  
  if (oldest.oldest_cursor === null) return true  // 没有 change log，强制 full
  return cursor < oldest.oldest_cursor  // cursor 比最老的 change log 还旧，强制 full
}

// topic 订阅改造后，使用 visible highWatermark
const syncMode = lastCursor === 0 || isCursorStale(sandboxId, terminalId, lastCursor)
  ? 'full'
  : 'incremental'
```

---

### 7.6 盲点六：`toTopicFingerprint` 包含 `JSON.stringify(payload)`

**代码位置**：`topicChangePublisher.ts:24`

**问题描述**：

```typescript
// topicChangePublisher.ts:24
const toTopicFingerprint = (entries: Record<string, TdpProjectionEnvelope>) =>
    Object.values(entries)
        .map(item => [
            item.itemKey, item.scopeType, item.scopeId,
            item.revision, item.operation,
            JSON.stringify(item.payload),  // ← 问题所在
        ].join(':'))
        .sort()
        .join('|')
```

`JSON.stringify` 的输出依赖对象属性的插入顺序。如果服务端在不同时间返回同一条 projection，但 payload 对象的属性顺序不同（例如经过不同的序列化路径），fingerprint 会不同，导致业务包收到一次"假变更"通知。

**影响**：业务包触发不必要的 rebuild，可能导致 UI 闪烁。

**最优修复方案**：fingerprint 基于 `revision` 而不是 payload 内容

```typescript
const toTopicFingerprint = (entries: Record<string, TdpProjectionEnvelope>) =>
    Object.values(entries)
        .map(item => `${item.itemKey}:${item.scopeType}:${item.scopeId}:${item.revision}:${item.operation}`)
        .sort()
        .join('|')
```

`revision` 是服务端生成的单调递增序列。采用该方案的前提是服务端必须保证同一 `topic + scope + itemKey + revision` 的 payload 内容不可变；幂等重放、重试投递或 `IDEMPOTENT_REPLAY` 不能以相同 revision 携带不同 payload。这样既避免了 `JSON.stringify` 的性能开销，也消除了属性顺序导致的 fingerprint 抖动。

**边界情况**：`operation = 'DELETE'` 时 revision 可能为 0 或特殊值，需要确认服务端在删除时是否正确设置 revision。如果不确定，可以用 `${item.itemKey}:${item.revision}:${item.operation}` 作为 fingerprint key，operation 变化（如从 UPSERT 变为 DELETE）也会触发变更通知。

---

### 7.7 盲点七：`CHANGESET` 在握手时不分页，与 `hasMore` 语义矛盾

**代码位置**：`wsServer.ts:166`、`messageActor.ts`

**问题描述**：

握手时 `getTerminalChangesSince` 默认 limit=100，但终端收到 `CHANGESET` 后没有继续拉取的机制。当前 `messageActor.ts` 处理 `CHANGESET` 时直接调用 `tdpChangesLoaded`，没有检查 `hasMore` 并发起后续请求。

即使修复了 `hasMore = false` 的 bug（见盲点四），终端也没有处理 `hasMore = true` 的逻辑。这意味着离线超过 100 条变更的终端，即使服务端正确返回 `hasMore = true`，终端也不会继续拉取剩余变更。

**完整修复方案**：

```typescript
// 新增 changesFetchActor.ts
// 负责处理 hasMore = true 时的分页拉取

const changesFetchActor = createActor({
  name: 'TdpChangesFetchActor',
  handles: [tdpFetchMoreChanges],
  
  async handle(command, { dispatch, getState }) {
    const { cursor } = command.payload
    const { terminalId, sandboxId } = getState().tdpSyncV2Domain
    
    // 使用 HTTP 接口（不是 WS 重握手）
    const result = await httpService.getChanges(sandboxId, terminalId, cursor)
    
    dispatch(tdpChangesLoaded({
      changes: result.changes,
      nextCursor: result.nextCursor,
    }))
    
    if (result.hasMore) {
      // 继续拉取下一页
      dispatch(tdpFetchMoreChanges({ cursor: result.nextCursor }))
    }
  }
})
```

---

## 八、变更日志保留策略缺失

> 本节基于对 `schema.ts` 的审查，指出设计文档完全未覆盖的基础设施问题。

### 8.1 问题描述

**代码位置**：`database/schema.ts`

当前 `tdp_change_logs` 表没有任何保留策略字段：

```sql
-- schema.ts（当前）
CREATE TABLE tdp_change_logs (
  id TEXT PRIMARY KEY,
  sandbox_id TEXT NOT NULL,
  target_terminal_id TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  cursor INTEGER NOT NULL,
  change TEXT NOT NULL,
  created_at INTEGER NOT NULL
  -- 没有 expires_at，没有 retention_hours，没有 is_expired
)
```

`tdp_topics` 表虽然有 `retentionHours` 字段，但没有任何代码使用它来清理 `tdp_change_logs`。

**影响**：

1. `tdp_change_logs` 会无限增长，长期运行后 SQLite 文件会变得很大
2. `getTerminalChangesSince` 的查询性能会随时间退化（即使有索引，扫描范围也会增大）
3. 盲点五中的 `isCursorStale` 方案依赖"最老的 change log cursor"，如果没有清理策略，这个值永远是 1，导致 `isCursorStale` 永远返回 false

### 8.2 最优设计

**方案 A：基于时间的保留策略**

```sql
-- 新增字段
ALTER TABLE tdp_change_logs ADD COLUMN expires_at INTEGER;

-- 写入时设置过期时间（基于 topic 的 retentionHours）
INSERT INTO tdp_change_logs (id, ..., expires_at)
VALUES (?, ..., unixepoch() + ? * 3600)
-- ? = topic.retentionHours

-- 定期清理（每小时运行一次）
DELETE FROM tdp_change_logs WHERE expires_at < unixepoch()
```

**方案 B：基于 cursor 数量的保留策略（推荐）**

```sql
-- 每个 terminal 只保留最近 N 条 change log
-- N = TDP_CHANGE_LOG_RETENTION_COUNT（默认 10000）
DELETE FROM tdp_change_logs
WHERE sandbox_id = ? AND target_terminal_id = ?
  AND cursor < (
    SELECT MIN(cursor) FROM (
      SELECT cursor FROM tdp_change_logs
      WHERE sandbox_id = ? AND target_terminal_id = ?
      ORDER BY cursor DESC
      LIMIT 10000
    )
  )
```

**推荐方案 B**，原因：
- cursor 数量比时间更可预测（不受数据写入频率影响）
- 与 `isCursorStale` 的判断逻辑直接对应
- 清理后，cursor 小于 `MIN(cursor)` 的终端会被强制 full snapshot，语义清晰

### 8.3 与 topic 订阅改造的关系

topic 订阅改造后，change log 需要按 topic 过滤，这意味着：

- 同一个 cursor 位置的 change log 条目，对不同订阅集合的终端有不同的"可见性"
- 保留策略应该基于"全局 cursor 范围"，而不是"per-topic cursor 范围"
- 建议：保留策略以 `(sandbox_id, target_terminal_id)` 为粒度，不区分 topic

---

## 九、总结与行动清单

### 9.1 必须在第二阶段前修复的 Bug（阻塞性）

这些 bug 独立于 topic 订阅改造，但会被改造放大，必须优先修复：

| # | Bug | 代码位置 | 影响 | 修复方案 |
|---|---|---|---|---|
| B1 | `hasMore` 硬编码 `false` | `wsServer.ts:173` | 离线超 100 条变更时数据丢失 | 多查一条判断 hasMore |
| B2 | 终端不处理 `hasMore = true` | `messageActor.ts` | 即使服务端修复，终端也不会分页拉取 | 新增 changesFetchActor |
| B3 | cursor ACK 与数据落地竞态 | `cursorFeedbackActor.ts` | 崩溃重启后数据丢失 | ACK 改为监听 snapshotApplyCompleted |

### 9.2 必须与第二阶段同步实施的功能（前置条件）

| # | 功能 | 原因 |
|---|---|---|
| F1 | FULL_SNAPSHOT 分片传输 | 订阅改造后 FULL_SNAPSHOT 频率增加，不分片会放大断连风险 |
| F2 | `getHighWatermarkForTerminal` 改为 visible highWatermark | 否则 `hasMore` 判断出错 |
| F3 | cursor 批量预分配 | 否则 N+1 查询在大数据量下导致推送延迟 |

### 9.3 可随改造一并优化的性能问题

| # | 问题 | 代码位置 | 优化方案 |
|---|---|---|---|
| P1 | fingerprint 全量重算 | `topicChangePublisher.ts:117` | 改为增量维护，只更新变化的 topic |
| P2 | selector 无 memoization | `selectors/tdpSync.ts:75` | 用 reselect 缓存 scope 链 |
| P3 | `JSON.stringify(payload)` fingerprint | `topicChangePublisher.ts:24` | 改为基于 revision |
| P4 | `syncMode` 魔法数字 1000 | `wsServer.ts:113` | 改为检查 change log 保留范围 |
| P5 | change log 无保留策略 | `schema.ts` | 新增 cursor 数量保留策略 |
| P6 | `flushMode: 'immediate'` | `tdpProjection.ts:107` | 改为 debounced，500ms 后统一 flush |

### 9.4 下一步优化：Assembly 与 TerminalProfile/Template 的激活兼容性校验

#### 9.4.1 问题背景

当前服务端已经有 `terminal_profiles`、`terminal_templates`、`terminal_instances` 三类终端控制面数据：

- `terminal_profiles`：终端机型/角色能力画像，例如收银 POS、KDS 后厨屏、自助点餐机、打印网关。
- `terminal_templates`：终端激活/投放预设，例如标准收银模板、后厨屏模板、灰度模板。
- `terminal_instances`：真实激活出来的一台终端实例，持有 `profileId`、`templateId`、组织绑定和设备信息。

但终端侧当前只在 TCP binding 中保存 `profileId/templateId`，没有声明“当前运行的 4-assembly 包到底支持哪些 profile”。激活请求也只有 `sandboxId / activationCode / deviceFingerprint / deviceInfo`，没有 `assemblyId`、`supportedProfileCodes`、`supportedCapabilities` 等字段。

这会产生一个实际风险：

```
KDS assembly 拿到了收银 POS 的激活码
  -> 服务端按激活码创建 terminal_instances
  -> terminal_instances.profileId = cashier-pos
  -> 服务端认为这台设备是收银终端
  -> 后续可能给它推收银相关 topic / task / 权限
  -> 终端代码实际无法正确处理
```

这不是 topic 订阅本身能完全解决的问题。topic 订阅表达的是“当前终端代码想要什么数据”，而 TerminalProfile/Template 表达的是“服务端授权这台终端扮演什么角色”。两者都需要存在，并且激活时必须做兼容性校验。

#### 9.4.2 设计原则

1. **一切 TDP 数据订阅以终端 `tdpTopicInterests` 为准**：服务端不应该因为 profile/template 推导出一大堆终端没有声明的 topic。终端启动 runtime 后由已安装包汇总 `tdpTopicInterests`，并在 TDP handshake 中上报，服务端按需推送。

2. **激活身份必须由服务端授权**：终端不能自己决定“我要成为哪个 profile”。激活码仍然是服务端给出的授权载体，决定这次激活的目标 `profileId/templateId`。

3. **Assembly 只声明自己能支持什么，不声明自己要成为什么**：一个 4-assembly 包可以支持多个 profile，例如同一个 Android POS assembly 同时支持 `cashier-pos` 和 `self-service-pos`。但最终激活成哪个 profile，仍由激活码决定。

4. **激活时做交集校验**：服务端用激活码上的目标 profile/template，与终端上报的 assembly 能力声明做兼容性检查。不匹配则拒绝激活。

5. **暂不引入 effective runtime config**：本阶段不需要让服务端基于 profile/template 计算终端最终运行配置。profile/template 只作为激活角色和能力边界，数据同步仍以终端声明的 topic interest 为准。

#### 9.4.3 终端侧 Assembly 能力声明

建议每个 4-assembly 包提供一个稳定的能力 manifest，作为 TCP 激活请求的 `clientRuntime` 输入。它只表达“这个 assembly 能支持哪些终端角色和基础能力”，不表达 TDP 订阅集合。

```typescript
interface TerminalAssemblyCapabilityManifestV1 {
  protocolVersion: 'terminal-assembly-capability-v1'

  // 工程侧身份。建议来自 4-assembly 包 manifest，而不是运行时临时拼接。
  assemblyId: string
  assemblyVersion?: string
  appId?: string
  appVersion?: string
  bundleVersion?: string

  // 当前 assembly 能支持的服务端 TerminalProfile code。
  // 使用 code 而不是 id，避免不同 sandbox / 环境中 profileId 不稳定。
  supportedProfileCodes: string[]

  // 当前 assembly 的能力标签。用于校验 template 所要求的最低能力。
  supportedCapabilities?: string[]

  // 可选：如果某些 template 与 assembly 强绑定，可声明允许的 template code。
  // 第一阶段建议不强制使用，避免把部署模板和工程包耦合太死。
  supportedTemplateCodes?: string[]
}
```

示例：

```typescript
const kdsAssemblyCapability: TerminalAssemblyCapabilityManifestV1 = {
  protocolVersion: 'terminal-assembly-capability-v1',
  assemblyId: 'mixc-kds-assembly-rn84',
  assemblyVersion: '1.0.0',
  supportedProfileCodes: ['kds-screen', 'kitchen-display'],
  supportedCapabilities: [
    'kitchen-work-unit',
    'production-task-view',
    'production-status-update',
  ],
}
```

TDP topic interest 由 runtime module manifest 单独声明：

```typescript
interface TdpTopicInterestDeclarationV1 {
  topicKey: string
  category?: 'projection' | 'command' | 'system'
  required?: boolean
  reason?: string
}

interface KernelRuntimeModuleV2 {
  tdpTopicInterests?: readonly TdpTopicInterestDeclarationV1[]
}
```

启动时的关系是：

```
4-assembly capability manifest
  -> TCP activation clientRuntime
  -> profile/template 兼容性校验

runtime module descriptors
  -> TDP subscription resolver
  -> TDP HANDSHAKE subscribedTopics/subscriptionHash
  -> 服务端按需过滤
```

如果未来希望在 activation audit 中记录该 assembly 理论上会安装哪些 topic，可以作为诊断快照写入审计表，但不能作为激活阶段的订阅依据，也不能替代 TDP handshake。

#### 9.4.4 TCP 激活协议扩展

在 `ActivateTerminalApiRequest` 中新增 `clientRuntime`，保持向后兼容：老终端不传该字段时走 legacy 策略，新终端必须传。

```typescript
interface ActivateTerminalApiRequestV2 {
  sandboxId: string
  activationCode: string
  deviceFingerprint: string
  deviceInfo: TcpDeviceInfo

  clientRuntime?: {
    protocolVersion: 'terminal-activation-capability-v1'
    assemblyId: string
    assemblyVersion?: string
    appId?: string
    appVersion?: string
    bundleVersion?: string
    supportedProfileCodes: string[]
    supportedCapabilities?: string[]
    supportedTemplateCodes?: string[]
  }
}
```

服务端响应中建议返回规范化后的激活判定结果，便于终端记录和诊断：

```typescript
interface ActivateTerminalApiResponseV2 {
  terminalId: string
  token: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn?: number
  binding?: TcpBindingContext
  activationCompatibility?: {
    assemblyId?: string
    acceptedProfileCode: string
    acceptedTemplateCode?: string
    acceptedCapabilities?: string[]
    warnings?: string[]
  }
}
```

#### 9.4.5 服务端校验流程

服务端激活时的推荐流程：

```
1. 读取 activationCode
2. 读取 activation.profileId 对应的 terminal_profiles
3. 读取 activation.templateId 对应的 terminal_templates
4. 读取 clientRuntime
5. 如果 clientRuntime 缺失：
   - legacy 模式：允许旧终端继续激活，但写审计日志
   - strict 模式：拒绝激活，要求升级终端
6. 校验 profile.profileCode 是否在 supportedProfileCodes 中
7. 校验 template.templateCode 是否在 supportedTemplateCodes 中（如果终端声明了该字段）
8. 校验 template/presetConfig 中要求的能力是否被 supportedCapabilities 覆盖（如果服务端定义了 requiredCapabilities）
9. 校验通过后创建 terminal_instances
10. 将 assemblyId、assemblyVersion、capability snapshot 写入 terminal_instances 或独立审计表
```

失败时返回明确错误码：

```typescript
type TerminalActivationErrorCode =
  | 'TERMINAL_CLIENT_RUNTIME_REQUIRED'
  | 'TERMINAL_PROFILE_NOT_SUPPORTED'
  | 'TERMINAL_TEMPLATE_NOT_SUPPORTED'
  | 'TERMINAL_CAPABILITY_NOT_SATISFIED'
```

错误响应示例：

```json
{
  "success": false,
  "error": {
    "code": "TERMINAL_PROFILE_NOT_SUPPORTED",
    "message": "当前终端工程包不支持该激活码绑定的终端类型",
    "details": {
      "assemblyId": "mixc-kds-assembly-rn84",
      "requestedProfileCode": "cashier-pos",
      "supportedProfileCodes": ["kds-screen", "kitchen-display"]
    }
  }
}
```

#### 9.4.6 数据库与审计建议

第一阶段不一定要改动完整数据模型，但建议至少保留激活时的 assembly 能力快照，方便排查“为什么这台终端被允许激活成这个 profile”。

推荐在 `terminal_instances` 增加轻量字段：

```sql
ALTER TABLE terminal_instances ADD COLUMN assembly_id TEXT;
ALTER TABLE terminal_instances ADD COLUMN assembly_version TEXT;
ALTER TABLE terminal_instances ADD COLUMN activation_capability_json TEXT;
```

如果后续需要完整审计，可以拆独立表：

```sql
CREATE TABLE terminal_activation_compatibility_audits (
  audit_id TEXT PRIMARY KEY,
  sandbox_id TEXT NOT NULL,
  terminal_id TEXT,
  activation_code TEXT NOT NULL,
  assembly_id TEXT,
  requested_profile_id TEXT NOT NULL,
  requested_profile_code TEXT NOT NULL,
  requested_template_id TEXT,
  requested_template_code TEXT,
  supported_profile_codes_json TEXT NOT NULL,
  supported_capabilities_json TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);
```

#### 9.4.7 与 TDP topic 订阅的关系

这项优化不改变“topic 按需订阅”的主设计，只补上激活安全边界：

```
TCP activation:
  解决这台终端能不能激活成某个 TerminalProfile/Template

TDP handshake:
  解决这台已激活终端当前代码关心哪些 topic
```

服务端在 TDP handshake 阶段可以继续按 `subscribedTopics` 做过滤；如果需要更安全，可以增加一层授权校验：

- 终端请求 topic：来自 assembly/业务包声明。
- 服务端允许 topic：来自 terminal instance 的 profile/template/capability 边界。
- 最终 acceptedTopics = requestedTopics ∩ allowedTopics。

但第一阶段不要把 profile/template 自动扩展成 topic 列表，避免回到“服务端替终端决定要什么”的旧问题。

#### 9.4.8 推荐实施顺序

| 阶段 | 内容 | 是否阻塞 topic 订阅改造 |
|---|---|---|
| A1 | 4-assembly 增加 capability manifest | 不阻塞，但应尽早做 |
| A2 | TCP 激活请求携带 `clientRuntime` | 不阻塞 |
| A3 | 服务端 legacy 模式记录审计，不拒绝老终端 | 不阻塞 |
| A4 | 新终端 profile/template 不匹配时拒绝激活 | 建议在 topic 精细授权前完成 |
| A5 | TDP handshake 增加 `allowedTopics` 二次裁剪 | 可与第二阶段 topic filter 同步 |

#### 9.4.9 兼容策略

- 老终端不传 `clientRuntime`：默认 legacy allow，但记录 `CLIENT_RUNTIME_MISSING` 审计。
- 新终端传 `clientRuntime`：严格校验 profile/template 兼容性。
- 服务端灰度开关：按 sandbox / tenant / brand 开启 strict activation。
- 一旦某个 assembly 全量升级完成，可将该 assembly 对应 profile 切到 strict 模式。

---

## 十、完整验收标准

> 本节按实施阶段列出每个功能点的验收标准。验收标准分为三类：
> - **功能验收**：功能是否正确实现
> - **性能验收**：在指定数据量下的性能指标
> - **兼容验收**：与老版本的兼容性

---

### 第一阶段验收标准

#### AC-1.1：manifest 声明 topic interest

**功能验收**：
- [ ] `KernelRuntimeModuleV2` 类型中包含 `tdpTopicInterests?: TdpTopicInterestDeclarationV1[]` 字段
- [ ] `TdpTopicInterestDeclarationV1` 包含 `topicKey`、`required?`、`reason?` 字段
- [ ] `required` 未声明时按 `false` 规范化
- [ ] `reason` / `required` 字段不参与 `subscriptionHash` 计算（修改 reason 或 required 不改变 hash；hash 只绑定 topic key 集合）
- [ ] runtime-shell 能正确汇总所有已安装模块的 topic interest
- [ ] 汇总结果去重，相同 topicKey 的多个声明合并（required 取 OR）

**兼容验收**：
- [ ] 没有声明 `tdpTopicInterests` 的老模块，runtime 不报错，视为空声明

---

#### AC-1.2：handshake 发送 subscribedTopics + subscriptionHash

**功能验收**：
- [ ] `HANDSHAKE` 消息包含 `subscribedTopics: string[]`（已汇总的 topic key 列表）
- [ ] `HANDSHAKE` 消息包含 `subscriptionHash: string`（基于 sorted topic keys 的 hash）
- [ ] `HANDSHAKE` 消息包含 `capabilities: ['tdp.topic-subscription.v1']`
- [ ] subscriptionHash 计算稳定：相同 topic 集合，多次计算结果相同
- [ ] subscriptionHash 计算不受 topic 声明顺序影响（排序后计算）

**测试用例**：
```
输入：['catering.product', 'org.store.profile']
期望 hash：sha256('catering.product|org.store.profile').slice(0, 16)

输入：['org.store.profile', 'catering.product']（顺序不同）
期望 hash：相同（排序后计算）

输入：['catering.product', 'org.store.profile']，reason 字段修改
期望 hash：相同（reason 不参与计算）
```

---

#### AC-1.3：终端本地防御过滤

**功能验收**：
- [ ] TDP runtime 收到未订阅 topic 的 projection 时，不写入 Redux state
- [ ] TDP runtime 收到未订阅 topic 的 projection 时，记录协议异常日志
- [ ] 过滤发生在 `projectionRepositoryActor` 写入 state 之前

**测试用例**：
```
订阅集合：['org.store.profile']
收到 projection：{ topicKey: 'catering.product', ... }
期望：不写入 state，记录警告日志

收到 projection：{ topicKey: 'org.store.profile', ... }
期望：正常写入 state
```

---

#### AC-1.4：修复 `hasMore` 硬编码 false（Bug B1）

**功能验收**：
- [ ] `getTerminalChangesSince` 返回 `{ changes, hasMore }` 结构
- [ ] 当实际变更数量 > limit 时，`hasMore = true`
- [ ] 当实际变更数量 <= limit 时，`hasMore = false`

**测试用例**：
```
场景：终端离线期间产生 150 条变更，limit = 100
期望：第一次返回 100 条，hasMore = true
      第二次（cursor = 第100条的cursor）返回 50 条，hasMore = false
```

---

#### AC-1.5：终端处理 `hasMore = true`（Bug B2）

**功能验收**：
- [ ] `messageActor` 处理 `CHANGESET` 时检查 `hasMore`
- [ ] `hasMore = true` 时，dispatch `tdpFetchMoreChanges`
- [ ] `changesFetchActor` 通过 HTTP 接口拉取下一页
- [ ] 分页拉取直到 `hasMore = false` 为止
- [ ] 分页拉取期间，`syncStatus` 显示为 `syncing`

**性能验收**：
- [ ] 分页拉取不阻塞 UI（异步执行）
- [ ] 每页拉取间隔不超过 200ms（避免服务端压力）

---

#### AC-1.6：修复 cursor ACK 竞态（Bug B3）

**功能验收**：
- [ ] `TdpCursorFeedbackActor` 改为监听 `snapshotApplyCompleted` 命令
- [ ] `snapshotApplyCompleted` 在 `recomputeResolvedTopicChanges` 完成后 dispatch
- [ ] ACK 发送时，projection state 已完成写入（可通过 Redux state 验证）

**测试用例**：
```
场景：收到 FULL_SNAPSHOT，包含 500 条 projection
期望：
  1. projection state 写入完成
  2. recomputeResolvedTopicChanges 完成
  3. snapshotApplyCompleted dispatch
  4. ACK 发送给服务端
  （顺序必须严格按此）
```

---

### 第二阶段验收标准

#### AC-2.1：服务端 snapshot 按 topic 过滤

**功能验收**：
- [ ] `getTerminalSnapshotEnvelope` 接受 `subscribedTopics` 参数
- [ ] 返回的 snapshot 只包含订阅 topic 的 projection
- [ ] 未订阅 topic 的 projection 不出现在 snapshot 中

**测试用例**：
```
订阅集合：['org.store.profile']
服务端 projection 数据：
  - { topicKey: 'org.store.profile', itemKey: 'store-1', ... }
  - { topicKey: 'catering.product', itemKey: 'product-1', ... }

期望 snapshot：只包含 store-1，不包含 product-1
```

---

#### AC-2.2：服务端 changes 按 topic 过滤

**功能验收**：
- [ ] `getTerminalChangesSince` 接受 `subscribedTopics` 参数
- [ ] 返回的 changes 只包含订阅 topic 的变更
- [ ] `nextCursor` 是订阅范围内的最大 cursor（不是全局最大 cursor）

---

#### AC-2.3：服务端实时推送按 topic 过滤

**功能验收**：
- [ ] `queueProjectionChangeToOnlineTerminal` 在入队前检查 topic 是否在终端订阅集合内
- [ ] 未订阅 topic 的变更不入队，不推送给终端
- [ ] `PROJECTION_BATCH` 消息只包含订阅 topic 的变更

**性能验收**：
- [ ] topic 过滤不增加超过 5ms 的推送延迟（基于 100 个在线终端的场景）

---

#### AC-2.4：visible highWatermark

**功能验收**：
- [ ] `getHighWatermarkForTerminal` 接受 `subscribedTopics` 参数
- [ ] 返回的 highWatermark 是订阅范围内的最大 cursor
- [ ] `hasMore` 判断基于 visible highWatermark，而不是全局 highWatermark

**测试用例**：
```
订阅集合：['org.store.profile']
change_log：
  cursor=100, topic=org.store.profile
  cursor=101, topic=catering.product（未订阅）
  cursor=102, topic=catering.product（未订阅）

期望 visible highWatermark = 100
期望：终端 cursor=100 时，hasMore = false（已同步完所有订阅 topic 的数据）
```

---

#### AC-2.5：FULL_SNAPSHOT 分片传输

**功能验收**：
- [ ] 服务端发送 `SNAPSHOT_BEGIN` → N × `SNAPSHOT_CHUNK` → `SNAPSHOT_END` 序列
- [ ] 每个 `SNAPSHOT_CHUNK` 包含不超过 50 条 projection
- [ ] `SNAPSHOT_BEGIN` 包含 `totalChunks`、`totalItems`、`highWatermark`、`subscriptionHash`
- [ ] `SNAPSHOT_END` 包含 `snapshotId`（可选 checksum）
- [ ] 终端在 `SNAPSHOT_END` 前不清空现有数据（用户不会看到空白状态）
- [ ] 终端在 `SNAPSHOT_END` 时原子替换 entries

**性能验收**：
- [ ] 1000 条 projection 的 snapshot，JS 线程单次阻塞不超过 50ms
- [ ] 分片传输期间，UI 帧率不低于 30fps

**兼容验收**：
- [ ] 老版本终端（不支持分片）收到 `SNAPSHOT_BEGIN` 时，降级为接收完整 `FULL_SNAPSHOT`
- [ ] 服务端通过 `capabilities` 字段判断终端是否支持分片

---

#### AC-2.6：subscriptionHash 变化时强制 full snapshot

**功能验收**：
- [ ] 终端检测到 subscriptionHash 变化时，`lastCursor` 重置为 0
- [ ] 服务端收到 `lastCursor = 0` 时，发送 full snapshot（而不是 changeset）
- [ ] full snapshot 只包含新订阅集合的 topic 数据
- [ ] snapshot 应用完成后，清除本地仓库中不在新订阅集合内的 topic 数据

**测试用例**：
```
场景：终端从订阅 ['org.store.profile', 'catering.product'] 变为 ['org.store.profile']
期望：
  1. subscriptionHash 变化，lastCursor 重置为 0
  2. 重连后发送 lastCursor = 0
  3. 服务端发送只包含 org.store.profile 的 snapshot
  4. 终端应用 snapshot 后，catering.product 的本地数据被清除
  5. 业务包 rebuild，catering.product 相关 UI 清空
```

---

#### AC-2.7：SESSION_READY 订阅摘要

**功能验收**：
- [ ] `SESSION_READY` 包含 `acceptedTopics`、`rejectedTopics`、`requiredMissingTopics`
- [ ] `acceptedTopics` 是服务端规范化后的 topic 列表（排序、去重、校验）
- [ ] `rejectedTopics` 包含服务端拒绝的 topic（例如终端无权访问的 topic）
- [ ] `requiredMissingTopics` 包含 `required = true` 但服务端无法提供的 topic

**严格模式验收**（有 `requiredMissingTopics` 时）：
- [ ] 服务端在 `SESSION_READY` 中返回 `requiredMissingTopics` 时，不发送 snapshot/chunk/changes
- [ ] 服务端发送 `ERROR` 并关闭，或等待终端关闭；不能继续投递数据
- [ ] 终端收到 `requiredMissingTopics` 时，进入 FAILED 或不可营业状态

**降级兼容模式验收**（仅灰度或显式允许时）：
- [ ] 终端收到 degraded `SESSION_READY` 时进入 `DEGRADED` 状态
- [ ] 只有终端发送 `SESSION_DEGRADED_ACK { acceptDegradedMode: true }` 后，服务端才按 `acceptedTopics` 投递数据
- [ ] 业务包收到降级通知，且不能读取缺失 required topic 的业务视图

---

#### AC-2.8：cursor 批量预分配

**功能验收**：
- [ ] `upsertProjectionBatch` 在写入前，一次性为每个 terminal 预分配所需数量的 cursor
- [ ] 预分配后，每条 projection 直接使用预分配的 cursor，不再单独查询

**性能验收**：
- [ ] 100 条 projection × 10 个终端的批量写入，SQLite 查询次数 ≤ 10（每个 terminal 一次）
- [ ] 批量写入耗时比优化前减少 80% 以上

---

### 第三阶段验收标准

#### AC-3.1：legacy-all 兼容模式

**功能验收**：
- [ ] 老终端（不发送 `subscribedTopics`）收到所有 topic 的数据（legacy-all 模式）
- [ ] 新终端（发送 `subscribedTopics`）只收到订阅 topic 的数据（explicit 模式）
- [ ] 服务端通过 `capabilities` 字段区分新老终端

**兼容验收**：
- [ ] 老终端升级到新版本后，自动切换到 explicit 模式，不需要手动配置
- [ ] 新服务端部署后，老终端不受影响，数据不丢失

---

#### AC-3.2：change log 保留策略

**功能验收**：
- [ ] `tdp_change_logs` 表有保留策略（基于 cursor 数量或时间）
- [ ] 定期清理任务正常运行（每小时或每天）
- [ ] 清理后，cursor 过期的终端重连时被强制 full snapshot

**性能验收**：
- [ ] 长期运行（30 天）后，`tdp_change_logs` 表大小不超过配置的保留量
- [ ] 清理任务执行时，不影响正常的 projection 写入和推送

---

#### AC-3.3：`syncMode` 改为基于 change log 保留范围

**功能验收**：
- [ ] `syncMode` 判断改为检查 cursor 是否在 change log 保留范围内
- [ ] 移除硬编码的 1000 阈值
- [ ] cursor 过期（比最老的 change log 还旧）时，强制 full snapshot

---

### 第四阶段验收标准（性能优化）

#### AC-4.1：fingerprint 增量维护

**功能验收**：
- [ ] `PROJECTION_CHANGED` 和 `PROJECTION_BATCH` 只更新变化 topic 的 fingerprint
- [ ] `FULL_SNAPSHOT` 和 `CHANGESET` 全量重算所有 topic 的 fingerprint
- [ ] fingerprint 计算结果与全量重算结果一致

**性能验收**：
- [ ] 收到单条 `PROJECTION_CHANGED` 时，fingerprint 计算耗时 < 1ms（不管总 topic 数量）
- [ ] 收到 100 条 `PROJECTION_BATCH` 时，fingerprint 计算耗时 < 10ms

---

#### AC-4.2：selector memoization

**功能验收**：
- [ ] `selectScopePriorityChain` 只在 binding/terminalId/groupMembership 变化时重算
- [ ] `selectTdpResolvedProjectionByTopic` 只在 entries 或 scope 链变化时重算

**性能验收**：
- [ ] 收到单条 projection 变更时，`selectTdpResolvedProjectionByTopic` 的调用次数 = 1（只计算变化的 topic）
- [ ] scope 链重建次数 = 0（如果 binding/terminalId/groupMembership 未变化）

---

#### AC-4.3：fingerprint 基于 revision

**功能验收**：
- [ ] `toTopicFingerprint` 不再使用 `JSON.stringify(payload)`
- [ ] fingerprint 基于 `itemKey:scopeType:scopeId:revision:operation`
- [ ] 相同数据（revision 相同）的不同属性顺序，fingerprint 相同

**测试用例**：
```
数据 A：{ itemKey: 'x', revision: 5, payload: { a: 1, b: 2 } }
数据 B：{ itemKey: 'x', revision: 5, payload: { b: 2, a: 1 } }（属性顺序不同）
期望：fingerprint(A) === fingerprint(B)
```

---

#### AC-4.4：背压控制（可选）

**功能验收**：
- [ ] 终端收到 `PROJECTION_BATCH` 后发送 `BATCH_ACK`
- [ ] 服务端维护每个 session 的未确认 batch 数量
- [ ] 未确认 batch 超过阈值（3 个）时，服务端暂停推送

**性能验收**：
- [ ] 后台批量导入 1000 条数据时，终端 JS 线程不出现超过 500ms 的阻塞
- [ ] 背压控制不导致数据延迟超过 2 秒（正常推送场景）

---

### 整体系统验收标准

#### AC-SYS-1：数据完整性

- [ ] 终端从 `lastCursor = 0` 开始同步，最终 projection state 与服务端数据一致
- [ ] 终端离线 N 条变更后重连，所有变更都能正确同步（不丢失）
- [ ] subscriptionHash 变化后，新订阅 topic 的历史数据完整同步
- [ ] 订阅缩小后，旧 topic 的本地数据被完整清除

#### AC-SYS-2：性能基准

| 场景 | 指标 | 目标值 |
|---|---|---|
| 首次连接（500 条 projection） | snapshot 传输完成时间 | < 3s（4G 网络） |
| 首次连接（500 条 projection） | JS 线程最大阻塞时间 | < 100ms |
| 实时推送（单条变更） | 端到端延迟（服务端写入到终端 UI 更新） | < 500ms |
| 批量导入（100 条变更） | 终端处理完成时间 | < 2s |
| subscriptionHash 变化 | 重新同步完成时间 | < 5s（500 条 projection） |

#### AC-SYS-3：兼容性

- [ ] 老终端（不支持 topic 订阅）在新服务端上正常工作，数据不丢失
- [ ] 新终端在老服务端上正常工作（降级为 legacy-all 模式）
- [ ] 服务端滚动升级期间，在线终端不断连

#### AC-SYS-4：可观测性

- [ ] 服务端记录每个 session 的 `subscriptionHash`、`acceptedTopics`、`rejectedTopics`
- [ ] 服务端记录每次 full snapshot 的触发原因（首次连接 / subscriptionHash 变化 / cursor 过期）
- [ ] 终端记录每次 fingerprint 变化的 topic 和变化前后的 revision
- [ ] 终端记录 `isApplyingSnapshot` 的开始和结束时间（用于性能分析）

#### AC-SYS-5：Assembly 与 TerminalProfile/Template 激活兼容性

- [ ] 每个 4-assembly 包提供稳定的 capability manifest，包含 `assemblyId`、`supportedProfileCodes`、`supportedCapabilities?`
- [ ] capability manifest 不包含 TDP 订阅字段；TDP 订阅只来自 module manifest 的 `tdpTopicInterests`
- [ ] TCP 激活请求可携带 `clientRuntime`
- [ ] 服务端激活时读取激活码绑定的 `profileId/templateId`，并解析对应 `profileCode/templateCode`
- [ ] 新终端传入 `clientRuntime` 时，服务端校验 `profileCode in supportedProfileCodes`
- [ ] 如果终端声明了 `supportedTemplateCodes`，服务端校验 `templateCode in supportedTemplateCodes`
- [ ] profile/template 不兼容时拒绝激活，并返回 `TERMINAL_PROFILE_NOT_SUPPORTED` 或 `TERMINAL_TEMPLATE_NOT_SUPPORTED`
- [ ] 老终端未传 `clientRuntime` 时可走 legacy allow，但必须记录审计日志
- [ ] `terminal_instances` 或审计表记录激活时的 `assemblyId`、`assemblyVersion`、capability snapshot
- [ ] TDP handshake 的 `acceptedTopics` 仍以终端声明的 topic interest 为基础，不由 profile/template 自动扩展
- [ ] 如果启用 topic 授权裁剪，最终 `acceptedTopics = requestedTopics ∩ allowedTopics`
