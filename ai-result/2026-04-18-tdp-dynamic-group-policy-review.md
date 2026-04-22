# TDP Dynamic Group / Projection Policy 设计文档 Review

> 文档路径：`docs/superpowers/specs/2026-04-18-tdp-dynamic-group-policy-design.md`
> Review 日期：2026-04-18

---

## 总体评价

整体设计思路清晰，方向正确。核心判断——"服务端算 membership、终端复用 resolved projection"——是合理的，避免了在终端引入第二套求值引擎。文档结构完整，从背景、目标、模型、API 到 UI 都有覆盖。

但存在若干需要在实现前明确的问题，分为**设计缺陷**、**逻辑模糊**、**遗漏项**三类，详见下文。

---

## 一、设计缺陷（需修正）

### 1.1 GROUP scope 在优先级链中的位置语义不够精确

文档定义：

> `PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP(ordered...) -> TERMINAL`

问题：`GROUP` 被插入在 `STORE` 和 `TERMINAL` 之间，但 group 的 selector 可以跨 store、跨 project，甚至跨 tenant。这意味着一个 `GROUP` scope 的 policy 可能在语义上比 `STORE` 更宽泛，却拥有比 `STORE` 更高的优先级。

**举例**：一个 group 匹配"所有 runtimeVersion=1.0 的终端"，它横跨多个 store。如果该 group 的 policy 优先级高于 store，则 store 级别的差异化配置会被全部覆盖，这与"越具体越高优先级"的直觉相悖。

**建议**：
- 明确 group 的优先级语义：group 是"横切关注点"，不是"更具体的 scope"。
- 可以考虑让 group priority 字段决定它插入 scope chain 的位置，而不是固定在 STORE 之后。
- 或者明确文档说明：group 的设计意图就是"覆盖 store 默认值"，使用者需要理解这一点。

---

### 1.2 `projection_policies` 与现有 `tdp_projections` 的同步机制未定义

文档说：

> `tdp_projections` 更适合作为"从 policy 物化出来的数据面结果"

但文档没有说明：
- policy 启用/停用/编辑后，`tdp_projections` 如何同步更新？
- 是立即同步还是异步？
- 如果同步失败，终端会拿到旧数据还是无数据？
- `tdp_projections` 中 `GROUP` scope 的记录是否与 policy 一一对应？

**建议**：补充 policy → projection 的物化流程，明确触发时机、失败处理、幂等性保证。

---

### 1.3 `terminal.group.membership` topic 的更新时机与终端感知延迟未说明

文档描述了 membership 通过 TDP topic 下发，但没有说明：
- membership 重算完成后，服务端通过什么机制通知终端？
- 是主动推送 `PROJECTION_CHANGED`，还是等终端下次连接时才拿到新 membership？
- 如果终端在线，membership 变化到终端感知之间的延迟是多少？

这对热更新场景尤其关键——如果终端需要等下次重连才能拿到新 membership，热更新的"持续命中"能力就大打折扣。

**建议**：明确 membership 变化的推送机制，区分"终端在线"和"终端离线后重连"两种场景。

---

## 二、逻辑模糊（需澄清）

### 2.1 `priority` 字段在 group 和 policy 两个实体上都存在，语义不统一

- `selector_groups.priority`：表示 group 在同层 group 之间的默认优先级
- `projection_policies.priority`：文档说"主要在服务端解释和 membership group 排序时使用"

问题：
- policy 上的 priority 和 group 上的 priority 是什么关系？
- 同一个 group 下的多个 policy（不同 topic）之间，priority 有意义吗？
- 如果 policy.priority 只在服务端排序时使用，终端侧完全不感知，那它的实际作用是什么？

**建议**：明确两个 priority 字段各自的作用域，避免实现时产生歧义。建议 policy 上的 priority 要么删除，要么明确其唯一用途。

---

### 2.2 `rank` 字段的计算规则与 `priority` 的关系不清晰

文档说 membership 中的 `rank` 是"服务端最终排序后的组内顺位"，排序规则为：

1. priority 低的在前
2. priority 相同则更具体的 selector 在后
3. 仍相同则 updatedAt 新的在后
4. 仍相同则 groupId 字典序兜底

问题：
- "更具体的 selector"如何量化？文档没有定义 selector 具体度的计算方式。
- 如果两个 group 的 selector 字段数量相同但字段不同，谁更具体？
- 这个规则在实现时很容易产生歧义，建议给出明确的算法或放弃"具体度"这一维度。

**建议**：简化排序规则，去掉"更具体"这一模糊维度，改为纯 priority + updatedAt + groupId 的确定性排序。

---

### 2.3 `sandboxId` 在新实体中的隔离语义未说明

三个新实体（`selector_groups`、`selector_group_memberships`、`projection_policies`）都有 `sandboxId` 字段，但文档没有说明：
- sandbox 之间的 group/policy 是否完全隔离？
- 跨 sandbox 的 terminal 能否命中同一个 group？
- sandbox 切换时，membership 是否需要重算？

**建议**：补充 sandbox 隔离语义，与现有 mock-platform 的 sandbox 设计保持一致。

---

### 2.4 `capabilitiesAll` 的 OR/AND 语义与其他字段不一致

文档说：
- 同一字段内数组表示 OR
- 不同字段之间表示 AND
- `capabilitiesAll` 表示必须全部包含

但 `capabilitiesAll` 的命名暗示"全部包含"，而其他字段是 OR。这会导致：
- 如果用户想表达"包含 A 或 B 中任意一个能力"，当前 DSL 无法表达。
- `capabilitiesAll` 和 `capabilitiesAny` 是否都需要支持？

**建议**：第一版明确只支持 `capabilitiesAll`（全部包含），并在文档中说明这是有意的限制，后续版本再扩展 `capabilitiesAny`。

---

## 三、遗漏项（需补充）

### 3.1 缺少 `terminal_runtime_facts` 的上报机制设计

文档在 Open Decisions 中提到"terminal runtime facts 是继续挂在 `terminal_instances` 还是单独建表"，但没有说明：
- 终端如何上报 `assemblyAppId / runtimeVersion / bundleVersion` 等运行时事实？
- 是在 TCP 激活时上报，还是通过独立的上报接口？
- 上报频率是什么？版本升级后如何触发重新上报？

这是 selector 能否正确匹配的前提，缺少这部分设计会导致 membership 计算依赖不完整的数据。

**建议**：在文档中补充 terminal runtime facts 的上报时机和字段来源，哪怕只是指向现有代码中的上报逻辑。

---

### 3.2 缺少 group 停用/删除后的 membership 清理流程

文档的 Recompute triggers 列出了触发重算的事件，但没有说明：
- group 停用后，已有的 membership 记录是保留还是删除？
- group 删除后，`terminal.group.membership` topic 中的引用如何清理？
- 终端侧如果缓存了旧的 membership，如何感知 group 已停用？

**建议**：补充 group 生命周期变化对 membership 和 projection 的影响，明确清理策略。

---

### 3.3 缺少并发重算的保护机制

文档说"mock-platform 第一版可以全部同步执行"，但没有说明：
- 如果同一个 terminal 同时触发多个重算（如激活 + 主数据变化同时发生），如何保证幂等？
- `membershipVersion` 的递增是否有乐观锁保护？

**建议**：即使第一版同步执行，也应说明 membershipVersion 的更新是原子操作，避免并发写入导致版本号混乱。

---

### 3.4 Admin UI 缺少"批量重算"入口

文档的 API 列表中有 `POST /groups/:groupId/recompute`（单 group 重算），但没有：
- 全量重算所有 group 的接口
- 按 project/store 范围批量重算的接口

在 selector 逻辑变更或主数据批量迁移后，运营人员需要触发全量重算，单 group 重算入口不够用。

**建议**：补充 `POST /api/v1/admin/tdp/groups/recompute-all` 或类似的批量重算接口，并在 UI 的策略总览页提供入口。

---

### 3.5 `decision-trace` API 的返回结构未定义

文档列出了 `GET /terminals/:terminalId/decision-trace` 接口，但没有定义返回结构。这是后台排障的核心接口，如果结构不明确，前后端实现容易产生偏差。

**建议**：补充该接口的 response schema，至少包含：terminalId、membershipSnapshot、perTopicCandidates、resolvedResults。

---

## 四、小问题

1. **Audit 事件编号重复**：文档中 Audit 事件列表第 7 条出现两次（`DELETE_PROJECTION_POLICY` 和 `RECOMPUTE_TERMINAL_MEMBERSHIP` 都标为 7），应修正为 8 条。

2. **`GROUP` scope 的 `scopeKey` 命名**：文档说 `scopeKey` 在 GROUP 场景下就是 `groupId`，但字段名叫 `scopeKey` 而不是 `scopeId`，与 `TdpProjectionEnvelope` 中的 `scopeId` 字段名不一致。建议统一命名，或在文档中说明映射关系。

3. **Non-goals 第 2 条与设计矛盾**：Non-goals 说"第一版不在终端本地解释 selector DSL"，但终端侧需要读取 `terminal.group.membership` topic 并构造 scope chain，这本质上是在消费 selector 的结果。措辞应改为"终端不执行 selector 匹配计算，只消费服务端计算好的 membership 结果"。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 设计缺陷 | 3 | 实现前必须解决 |
| 逻辑模糊 | 4 | 实现前需澄清 |
| 遗漏项 | 5 | 建议补充 |
| 小问题 | 3 | 可在实现中顺手修正 |

最需要优先解决的是：
1. **GROUP 优先级语义**（1.1）——直接影响终端 resolved projection 的正确性
2. **policy → projection 物化流程**（1.2）——核心数据流，缺失会导致实现无从下手
3. **membership 推送机制**（1.3）——决定"持续命中"能力的实时性
