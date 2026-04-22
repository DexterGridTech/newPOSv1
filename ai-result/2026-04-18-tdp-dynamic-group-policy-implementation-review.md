# TDP Dynamic Group / Projection Policy 实现计划 Review

> 文档路径：`docs/superpowers/plans/2026-04-18-tdp-dynamic-group-policy-implementation.md`
> Review 日期：2026-04-18

---

## 总体评价

计划结构清晰，TDD 节奏正确（先写失败测试、再实现、再验证），任务拆分合理，5 个 Task 之间依赖关系明确。代码示例与实际代码库的风格基本吻合。

但通过核查实际代码库，发现若干与现有代码不符的地方，以及几个逻辑问题，需要在执行前修正。

---

## 一、与现有代码不符（执行前必须修正）

### 1.1 Task 1 Step 1 测试中的 `/mock-debug/kernel-base-test/prepare` 端点不存在

计划中的测试代码：

```ts
await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
  method: 'POST',
})
```

核查结果：`sandbox-api.spec.ts` 中的测试直接调用 `/api/v1/terminals/activate` 等业务接口，没有 `/mock-debug/*/prepare` 这类预置端点。`createMockTerminalPlatformTestServer` 也没有暴露此类接口。

**建议**：参照 `sandbox-api.spec.ts` 的模式，直接通过业务 API 准备测试数据（先激活 terminal），不要依赖不存在的 prepare 端点。

---

### 1.2 Task 1 Step 1 测试中的 `group-memberships` 路径与 Task 2 Step 5 的路由定义不一致

Task 1 测试中：
```
GET /api/v1/admin/tdp/terminals/:terminalId/group-memberships
```

Task 2 Step 5 路由定义中：
```
GET /api/v1/admin/tdp/terminals/:terminalId/group-memberships
```

但设计文档（spec）中定义的是：
```
GET /api/v1/admin/tdp/terminals/:terminalId/memberships
```

三处不一致。建议统一为设计文档的 `memberships`，或在计划中明确说明与 spec 的偏差原因。

---

### 1.3 Task 4 Step 1 测试中 `seedStateWithProjections` 函数不存在

计划中：
```ts
const state = seedStateWithProjections([...])
```

核查 `tdp-sync-runtime-v2/test/` 目录，没有 `seedStateWithProjections` 这个 helper。现有测试（`tdp-sync-runtime-v2.spec.ts`）使用的是 live harness 模式，不是直接构造 state。

**建议**：要么在 `test/helpers/` 中新建该 helper 并在 File Map 中列出，要么改用 live harness 模式写这个测试。

---

### 1.4 Task 4 Step 3 中 `selectTdpResolvedProjection` 的调用签名需核实

计划中：
```ts
selectTdpResolvedProjection(state, { topic: 'config.delta', itemKey: 'main' })
```

但 `tdpSync.ts` 中的 selector 实际签名需要核实是否接受 `{ topic, itemKey }` 对象，还是分开传参。建议在实现前先读 `selectors/tdpSync.ts` 确认签名，避免类型错误。

---

### 1.5 Task 5 Step 2 中 `activateLiveTerminal` 函数不在 File Map 中

计划中：
```ts
await activateLiveTerminal(harness.runtime, platform.prepare.sandboxId, '200000000008', 'device-live-tdp-group-001')
```

`activateLiveTerminal` 没有在 File Map 中列出，也没有说明它来自哪个 helper 文件。如果是新建函数，需要加入 File Map；如果是现有函数，需要标注来源文件。

---

### 1.6 Task 5 Step 2 中 `createLivePlatform` 函数不在 File Map 中

同上，`createLivePlatform()` 没有在 File Map 中列出。`liveHarness.ts` 中目前只有 `createLiveRuntime`，没有 `createLivePlatform`。需要明确这个函数是新建还是现有。

---

## 二、逻辑问题（需澄清）

### 2.1 Task 1 的测试依赖 terminal 主数据，但没有说明如何准备

`recomputeTerminalMemberships` 需要读取 terminal 的主数据（projectId、storeId、templateId 等）来匹配 selector。但 Task 1 的测试只创建了 group，没有说明如何准备一个带完整主数据的 terminal。

如果 terminal 不存在或主数据不完整，matcher 会因为缺少字段而无法命中，测试会因为错误原因失败，而不是因为功能未实现失败。

**建议**：在 Task 1 Step 1 的测试中，补充 terminal 激活步骤，确保测试数据完整。

---

### 2.2 Task 2 Step 3 中 `materializeProjectionToTerminals` 的 `targetTerminalIds` 来源未说明

对于 `GROUP` scope policy，`resolvePolicyTargetTerminalIds` 需要查询当前 membership 表来找到目标 terminals。但如果 membership 还没有重算（比如 group 刚创建），target 列表可能为空，导致 policy 创建成功但没有任何 terminal 收到变更。

计划没有说明这种情况下的预期行为：是报错、是静默成功、还是要求先重算 membership？

**建议**：在 `policyService` 的实现说明中补充：policy 创建时若 membership 为空，允许静默成功，但需要在 policy 详情中标注"当前无命中终端"。

---

### 2.3 Task 3 Step 3 中 `App.tsx` 的状态管理方式与现有代码规模不匹配

计划建议在 `App.tsx` 中新增 6 个 `useState`：

```ts
const [selectorGroups, setSelectorGroups] = useState<SelectorGroupItem[]>([])
const [projectionPolicies, setProjectionPolicies] = useState<ProjectionPolicyItem[]>([])
// ...
```

但 `App.tsx` 已经是一个大文件（git status 显示它在修改列表中）。继续往 `App.tsx` 堆状态会让文件更难维护，与 Task 3 Step 4 "不把所有 UI 继续堆在 App.tsx" 的目标自相矛盾。

**建议**：把策略中心的状态收敛到一个独立的 `useTdpPolicyCenter()` hook 中，`App.tsx` 只调用这个 hook，不直接持有这些状态。

---

### 2.4 Task 4 Step 4 中 "任意 projection 变化都重扫所有 topic" 的性能假设需要验证

计划说：

> 最直接的实现是把 scope-chain 依赖提升为"任意 projection 变化都重扫所有 topic"的既有逻辑继续成立

这个假设需要先确认现有 `topicChangePublisher.ts` 的实现是否已经是全量重扫，还是按 topic 增量比较。如果是增量比较，membership topic 变化不会自动触发其他 topic 重算，需要额外处理。

**建议**：在 Task 4 Step 4 之前，先读 `topicChangePublisher.ts:94` 确认当前行为，再决定是否需要修改。

---

## 三、遗漏项

### 3.1 File Map 缺少 `terminal_runtime_facts` 相关处理

设计文档（spec）中有 `Terminal Runtime Facts Contract`，要求在 terminal connect 时 upsert runtime facts，并在 facts 变化时触发 membership 重算。但计划的 File Map 和所有 Task 中都没有提到这部分实现。

如果 runtime facts 不落地，selector 中的 `assemblyAppId / runtimeVersion / bundleVersion` 等字段永远匹配不到，group 机制的核心价值就无法验证。

**建议**：在 Task 1 或 Task 2 中补充 runtime facts upsert 逻辑，至少覆盖 TDP HANDSHAKE 时的写入。

---

### 3.2 缺少 group 删除保护的测试

Task 2 Step 6 的 Expected 中提到"group delete 前若仍绑定 policy 则拒绝"，但 Task 2 Step 1 的失败测试中没有覆盖这个场景，Task 2 Step 4 的 `policyService` 实现说明中也没有提到删除保护逻辑放在哪里（是 `groupService` 还是 `policyService`）。

**建议**：在 Task 2 Step 1 的测试中补充删除保护场景，并在 `groupService` 的实现说明中明确：delete group 前检查是否有 enabled policy 绑定。

---

### 3.3 缺少 `recompute-all` 接口的实现说明

设计文档中有 `POST /api/v1/admin/tdp/groups/recompute-all`，Task 2 Step 5 的路由列表中也没有包含它。计划只实现了 `recompute-by-scope`，全量重算入口缺失。

**建议**：在 Task 2 Step 5 的路由列表中补充 `recompute-all`，实现上可以复用 `recompute-by-scope` 传入全量 terminalIds。

---

### 3.4 Task 3 缺少 `decision-trace` 相关 API 的前端封装

Task 3 Step 2 的 `api.ts` 封装中，`getTerminalDecisionTrace` 接受 `topicKey` 和 `itemKey` 两个参数，但设计文档的 `decision-trace` 接口返回的是全量 trace（所有 topic），不是单 topic。

两者语义不同：
- `decision-trace`：全量，用于总览
- `terminals/:terminalId/topics/:topicKey/decision`：单 topic，用于精确排障

计划把两者混用了。建议分开封装，`DecisionTracePanel` 先用全量接口，再按 topic 过滤展示。

---

## 四、小问题

1. **Task 5 Step 5 的测试命令格式有误**：`vitest run ... -- tdp-sync-runtime-v2-live-group-policy.spec.ts` 中的 `--` 分隔符在 yarn workspace 场景下不一定正确，应参照现有测试命令格式（如 `-t` 或直接传文件路径）。

2. **Task 2 Step 5 的 audit action 名称**：代码示例中用的是 `CREATE_POLICY`，但设计文档 Audit 章节定义的是 `CREATE_PROJECTION_POLICY`。建议统一。

3. **Task 3 Step 2 中 `api.ts` 的 `sandboxId` 注入**：计划说"延续当前自动注入 sandboxId 模式"，但示例代码中没有体现 sandboxId 注入，需要确认现有 `request()` 函数是否已经自动注入，还是需要手动传入。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 与现有代码不符 | 6 | 执行前必须修正 |
| 逻辑问题 | 4 | 执行前需澄清 |
| 遗漏项 | 4 | 建议补充 |
| 小问题 | 3 | 可顺手修正 |

最需要优先处理的：

1. **`/mock-debug/prepare` 端点不存在**（1.1）——Task 1 的测试直接跑不起来
2. **`seedStateWithProjections` 不存在**（1.3）——Task 4 的单元测试无法编写
3. **runtime facts 上报缺失**（3.1）——没有这部分，selector 的核心字段永远匹配不到，整个机制无法端到端验证
