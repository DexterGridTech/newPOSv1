# Mock Platform Multi-Sandbox 实现计划审查

日期：2026-04-18
审查对象：`docs/superpowers/plans/2026-04-18-mock-platform-multi-sandbox.md`

---

## 问题汇总

| 优先级 | 编号 | 问题 |
|--------|------|------|
| 必须修复 | 问题 1 | Task 1 的 TDD 步骤顺序有误，先改服务端再跑测试，测试无法真正验证 RED 阶段 |
| 必须修复 | 问题 2 | Task 4 Step 3 的 slice 定义中 `syncIntent: 'isolated'` 与双屏设计原则冲突 |
| 必须修复 | 问题 3 | Task 5 中 TDP 读取 TCP sandbox state 的方式未说明跨 runtime 读取路径 |
| 应该修复 | 问题 4 | Task 1 Step 5 的路由代码没有校验 `sandboxId` 是否为空，直接透传给 service |
| 应该修复 | 问题 5 | Task 3 的 admin web 改动没有覆盖所有 API，File Map 与 Task 内容不一致 |
| 应该修复 | 问题 6 | Task 6 的跨 sandbox 隔离测试代码是伪代码，`platformB.admin.forceCloseSessionFromSandboxA` 不存在 |
| 需要确认 | 问题 7 | Task 4 Step 6 中 `credentialActor` 读取 sandbox ID 的来源有歧义 |
| 需要确认 | 问题 8 | Task 7 的文档更新没有列出具体要修改的内容，执行者无法判断完成标准 |

---

## 详细说明

### 问题 1：Task 1 的 TDD 步骤顺序有误（必须修复）

**位置**：Task 1，Step 1 ~ Step 6

当前顺序：
1. Step 1：写失败测试（断言激活时缺少 sandboxId 会失败）
2. Step 2：跑测试，期望 FAIL
3. Step 3~5：改服务端代码
4. Step 6：再跑测试，期望"仍然 FAIL，但失败原因变了"

**问题**：Step 6 期望的是"still FAIL, but now at client/runtime contract mismatches"，这意味着 Task 1 结束时测试仍然是红的。这不是 TDD 的 RED→GREEN 节奏，而是把 GREEN 推迟到了 Task 4。

这样做的风险是：Task 1 的 commit 包含了服务端改动，但没有任何绿色测试证明这些改动是正确的。如果 Task 4 执行时发现 Task 1 的服务端逻辑有 bug，回溯成本很高。

**建议**：Task 1 应该只做服务端改动，并配套一个能在 Task 1 内部跑绿的服务端单元测试（直接调用 service 函数，不依赖客户端 runtime）。客户端 runtime 的端到端测试放到 Task 4 再补全。

---

### 问题 2：tcpSandbox slice 的 syncIntent: 'isolated' 与双屏设计原则冲突（必须修复）

**位置**：Task 4，Step 3，`tcpSandboxV2SliceDescriptor`

```ts
export const tcpSandboxV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpSandboxState> = {
  syncIntent: 'isolated',
  ...
}
```

**问题**：设计文档（spec）的 `Dual-screen / multi-process rule` 明确要求：

> if a secondary process needs sandbox context for any TCP or TDP behavior, that context must be available through the same runtime truth path used by the primary process

`syncIntent: 'isolated'` 意味着 secondary 进程无法读取 primary 进程的 sandbox state。但 Task 5 中 TDP 需要读取 `selectTcpSandboxId(state)` 来获取 sandboxId。如果 secondary 进程的 TDP 也需要连接，它读到的 `tcpSandbox` 将是空的。

这与 spec 的双屏规则直接冲突。

**建议**：需要在实现计划中明确选择 spec 提出的两种方案之一：
1. 只有 primary 进程负责 TCP/TDP 连接，secondary 只消费已同步的业务状态 → `syncIntent: 'isolated'` 可以保留，但需要说明 secondary 不做 TDP 连接
2. sandbox context 通过 topology sync 同步到 secondary → `syncIntent` 需要改为支持同步的模式

---

### 问题 3：TDP 读取 TCP sandbox state 的跨 runtime 路径未说明（必须修复）

**位置**：Task 5，Step 5

```ts
const sandboxId = selectTcpSandboxId(state)
```

**问题**：`tdp-sync-runtime-v2` 是独立的 runtime 包，它的 `state` 是自己的 Redux store。`selectTcpSandboxId` 是 `tcp-control-runtime-v2` 的 selector，它期望的 state 结构是 TCP runtime 的 store。

这两个 runtime 的 store 是不同的对象。直接在 TDP runtime 的 `sessionConnectionRuntime.ts` 里调用 `selectTcpSandboxId(state)` 会读到 `undefined`，因为 TDP store 里没有 `TCP_SANDBOX_STATE_KEY` 这个 key。

**建议**：需要说明 TDP runtime 如何获取 TCP sandbox state。现有架构中通常通过以下方式之一：
1. topology runtime 将 TCP sandbox state 同步到 TDP runtime 可读的位置
2. TDP runtime 通过 platform port 注入一个 `getSandboxId()` 回调，由 assembly 层在初始化时绑定
3. TDP runtime 直接依赖 TCP runtime 的 store 引用（耦合度高，不推荐）

Task 5 必须明确选择哪种方式，并在 File Map 中补充对应的修改文件。

---

### 问题 4：Task 1 路由代码没有校验 sandboxId 为空（应该修复）

**位置**：Task 1，Step 5

```ts
router.post('/api/v1/terminals/activate', (req, res) => {
  try {
    const result = activateTerminal({
      sandboxId: req.body?.sandboxId,
      ...
    })
```

**问题**：`req.body?.sandboxId` 可能是 `undefined`。这个值直接传给 `activateTerminal`，而 `activateTerminal` 内部调用 `assertSandboxUsable(sandboxId)`，`assertSandboxUsable` 调用 `getSandboxById(sandboxId)`。

如果 `sandboxId` 是 `undefined`，`getSandboxById(undefined)` 的行为取决于 Drizzle 的实现，可能返回第一条记录，也可能抛出类型错误，而不是返回预期的 `SANDBOX_ID_REQUIRED` 错误码。

**建议**：路由层应该在调用 service 之前显式校验：

```ts
const sandboxId = req.body?.sandboxId
if (!sandboxId) {
  return fail(res, 'SANDBOX_ID_REQUIRED')
}
```

这与 spec 的要求一致：`terminal-facing APIs must reject missing sandbox ID immediately`。

---

### 问题 5：Task 3 的 admin web 改动覆盖不完整（应该修复）

**位置**：Task 3，File Map 与 Step 2

File Map 中 admin web 只列了三个文件：`api.ts`、`App.tsx`、`types.ts`。

Task 3 Step 2 的示例代码只展示了 `getTerminals` 和 `createTaskRelease` 两个接口。

**问题**：spec 的 Admin APIs 章节列出了至少 5 类接口需要携带 sandboxId：
1. `GET /api/v1/admin/terminals`
2. `GET /api/v1/admin/tdp/sessions`
3. `POST /api/v1/admin/tasks/releases`
4. `POST /api/v1/admin/tdp/projections/upsert`
5. `POST /api/v1/admin/tdp/sessions/:sessionId/force-close`

但 Task 3 的示例代码只覆盖了前两类，没有说明 `force-close`、`projections/upsert` 等接口如何处理。如果执行者只按示例实现，会遗漏这些接口。

**建议**：Task 3 Step 2 应该明确列出 `createSandboxScopedApi` 需要包含的所有方法，或者至少说明"所有 sandbox-scoped 接口都必须通过这个 wrapper 调用，不允许直接调用 `request()`"。

---

### 问题 6：Task 6 的跨 sandbox 隔离测试代码是伪代码（应该修复）

**位置**：Task 6，Step 2

```ts
await expect(
  platformB.admin.forceCloseSessionFromSandboxA(sessionIdB),
).rejects.toThrow(/sandbox/i)
```

**问题**：`platformB.admin.forceCloseSessionFromSandboxA` 这个方法名是伪造的，live harness 里不存在这样的 helper。执行者看到这段代码会不知道如何实现。

实际上这个测试要验证的是：用 sandbox A 的 admin 凭证，对 sandbox B 的 sessionId 发起 force-close，服务端应该返回 `SANDBOX_SESSION_MISMATCH`。

**建议**：改为更具体的实现指引：

```ts
// 用 sandboxA 的 admin API 尝试 force-close sandboxB 的 session
const result = await adminRequest(baseUrl, {
  method: 'POST',
  path: `/api/v1/admin/tdp/sessions/${sessionIdFromSandboxB}/force-close`,
  body: { sandboxId: sandboxA.sandboxId },
})
expect(result.error).toMatch(/SANDBOX_SESSION_MISMATCH/i)
```

---

### 问题 7：credentialActor 读取 sandbox ID 的来源有歧义（需要确认）

**位置**：Task 4，Step 6

```ts
const sandboxId = actorContext.command.payload.sandboxId ?? selectTcpSandboxId(actorContext.getState())
```

**问题**：`credentialActor`（token refresh）的 command payload 里通常不包含 `sandboxId`，因为 refresh 是自动触发的，不是用户主动输入的。这里的 `actorContext.command.payload.sandboxId` 大概率是 `undefined`，实际走的是 `?? selectTcpSandboxId(actorContext.getState())` 这条路。

但这段代码同时出现在 `activationActor` 的说明里，两个 actor 的逻辑被混在一起描述，容易让执行者误以为 `credentialActor` 的 command payload 也需要携带 `sandboxId`。

**建议**：分开描述两个 actor 的逻辑：
- `activationActor`：从 `command.payload.sandboxId` 读取（用户输入），激活成功后 dispatch `setSandboxId`
- `credentialActor` / `deactivationActor` / `taskReportActor`：只从 `selectTcpSandboxId(state)` 读取，如果为空则 fail-fast

---

### 问题 8：Task 7 文档更新没有具体内容指引（需要确认）

**位置**：Task 7，Step 1

Task 7 列出了 4 个文档文件需要更新，但只给出了 curl 示例和 WebSocket URL 示例，没有说明：
1. 每个文档文件需要修改哪些章节
2. 是否需要删除旧的 sandbox-implicit 示例
3. 文档更新的完成标准是什么

**问题**：执行者无法判断文档更新是否完成，也无法在 code review 时验证文档是否遗漏了重要内容。

**建议**：至少为每个文档文件说明需要更新的章节名称，例如：
- `给开发的进阶手册.md`：更新"激活终端"章节，补充 sandboxId 参数说明
- `给测试的联调用例手册.md`：更新所有 curl 示例，补充 sandboxId
- `后台使用手册.md`：更新 WebSocket 连接示例

---

## 总体评价

实现计划整体结构清晰，任务拆分合理，TDD 节奏基本正确。主要问题集中在两个方面：

1. **双屏 sandbox 同步路径**（问题 2、3）是本计划最大的技术风险。`syncIntent: 'isolated'` 和 TDP 跨 runtime 读取 TCP state 这两个问题如果不在 Task 4/5 执行前明确，会导致双屏场景下 TDP 连接失败，且排查成本高。

2. **Task 1 的 TDD 节奏**（问题 1）建议调整，避免服务端改动在没有绿色测试保护的情况下提交。

其余问题相对独立，不影响整体架构，可以在执行阶段逐一处理。
