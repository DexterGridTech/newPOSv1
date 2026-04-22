# UI Automation Runtime 设计与实现计划审查

日期：2026-04-18

审查对象：
- `docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md`
- `docs/superpowers/plans/2026-04-18-ui-automation-runtime-implementation.md`

---

## 问题汇总

| 优先级 | 编号 | 问题 |
|--------|------|------|
| 必须修复 | 问题 2 | `wait.forIdle` 是纯 setTimeout 假实现，不满足 spec 语义 |
| 必须修复 | 问题 4 | `eventBus` 无回调机制，`publish` 只返回列表，事件无法推送 |
| 必须修复 | 问题 5 | `AutomationSocketServer` 无消息处理循环，是空壳 |
| 必须修复 | 问题 6 | `scripts.execute` 缺少 Product 模式的服务端 guard |
| 应该修复 | 问题 1 | `automationTrace` 只保留最后一条，无法支撑多步骤排障 |
| 应该修复 | 问题 3 | `clearScreenContext` 的 `nextScreenKey` 语义有歧义 |
| 应该修复 | 问题 9 | `createBrowserScriptExecutorAdapter` 泛型 `T` 作用域错误 |
| 需要验证 | 问题 7 | `runtime-react` 依赖 `ui-automation-runtime` 存在循环依赖风险 |
| 需要验证 | 问题 8 | Task 8 不是真正迁移，仍然直接操作 DOM |

---

## 详细说明

### 问题 1：automationTrace 只保留最后一条记录（应该修复）

**位置**：实现计划 Task 5，`createAutomationTrace`

spec 第 7.2 节要求 trace 用于"自动化失败排障、联调过程取证、快速定位错误"。但实现只保留一条：

```ts
let lastTrace: AutomationTraceEntry | undefined
```

**问题**：多步骤自动化流程失败时，只能看到最后一步，前面所有上下文全部丢失，无法排障。

**建议**：改为有界环形缓冲区，保留最近 N 条（如 50 条）。保留 `getLastTrace()` 接口，补充 `getTraceHistory(n?: number)` 方法。

---

### 问题 2：wait.forIdle 是纯 setTimeout 假实现（必须修复）

**位置**：实现计划 Task 5，`createWaitEngine`

spec 第 7.3 节明确定义 idle 判断维度：
1. 没有 in-flight automation action
2. 没有 in-flight `scripts.execute`
3. request ledger 中没有非终态 request
4. quiet window 内没有新的 `stateChanged` / `screenChanged` / `requestChanged`

但实现是：

```ts
await new Promise(resolve => setTimeout(resolve, Math.min(quietWindowMs, options.timeoutMs)))
return {ok: true}
```

**问题**：这是一个永远返回成功的假实现，不检查任何 runtime 状态。自动化脚本在 runtime 繁忙时会误判为 idle，导致时序错误。

**建议**：`waitEngine` 需要注入 runtime 状态观察接口（request ledger 快照、in-flight action 计数器、event bus 订阅），才能实现真正的 idle 检测。

---

### 问题 3：clearScreenContext 的 nextScreenKey 语义有歧义（应该修复）

**位置**：实现计划 Task 4，`semanticRegistry.clearScreenContext`

实现代码：

```ts
clearScreenContext(target, nextScreenKey) {
    for (const [key, node] of liveNodes.entries()) {
        if (node.target === target && !node.persistent && node.screenKey !== nextScreenKey) {
            markStale(key)
        }
    }
}
```

**问题**：用 `node.screenKey !== nextScreenKey` 判断是否清理。如果 overlay 节点的 `screenKey` 是 `global`，而 `nextScreenKey` 是 `detail`，overlay 节点会被错误清理，除非标记为 `persistent`。这要求所有 overlay/alert 节点都必须手动加 `persistent: true`，容易遗漏。

**建议**：`clearScreenContext` 接收 `visibleContextKeys: string[]` 而不是单个 `nextScreenKey`，或在 spec 中明确约定 overlay/alert 节点的 `screenKey` 固定值（如 `overlay`、`alert`），并在清理逻辑中排除这些保留 key。

---

### 问题 4：eventBus 无回调机制，事件无法推送（必须修复）

**位置**：实现计划 Task 5，`createAutomationEventBus`

`subscribe` 没有接收 handler，`publish` 只返回匹配的订阅列表：

```ts
publish(event: AutomationEvent): readonly AutomationSubscription[]
```

**问题**：订阅者无法收到事件。`events.subscribe` / `events.unsubscribe` 协议方法在这个实现下无法真正工作，整个事件系统是空转的。

**建议**：

```ts
subscribe(
    subscription: Omit<AutomationSubscription, 'id'>,
    handler: (event: AutomationEvent) => void
): string
```

`publish` 时直接调用匹配订阅的 handler，而不是返回列表让调用方自己处理。

---

### 问题 5：AutomationSocketServer 无消息处理循环，是空壳（必须修复）

**位置**：实现计划 Task 9，`AutomationSocketServer.kt`

实现只做了 `ServerSocket` 的 start/stop，没有 accept 连接、读取消息、调用 `AutomationHostBridge.onMessage` 的逻辑。`AutomationHostBridge` 接口定义了 `onMessage`，但没有任何地方调用它。

**问题**：这是一个无法处理任何 JSON-RPC 请求的空壳。Task 9 的核心逻辑缺失。

**建议**：`start()` 中需要启动后台线程（或 coroutine）做 accept loop：
1. `serverSocket.accept()` 接受连接，创建 `AutomationSession`
2. 每个连接起独立线程/coroutine 读取 newline-delimited JSON
3. 调用 `bridge.onMessage(session, message)` 获取响应
4. 将响应写回 socket
5. 连接断开时清理 session 和订阅

---

### 问题 6：scripts.execute 缺少服务端 Product 模式 guard（必须修复）

**位置**：spec 第 8.3 节 vs 实现计划 Task 3/10

spec 明确要求：即使配置错误导致 Product 环境误启动 automation runtime，`scripts.execute` 也必须返回 `METHOD_NOT_AVAILABLE`，不能只依赖"默认不启动"。

但实现计划中 `createAutomationRuntime` 在 `productMode` 时只是让 `registerTarget` 返回空函数，没有对 `scripts.execute` 请求本身加服务端 guard。

**问题**：如果调用方绕过 `session.hello` 的 `scriptExecutionAvailable` 检查直接发送 `scripts.execute` 请求，没有任何地方会拦截并返回 `METHOD_NOT_AVAILABLE`。

**建议**：在 request dispatcher 层（处理 JSON-RPC 请求的地方）对 `scripts.execute` 加显式的 `productMode` 检查，不能只依赖客户端自律。

---

### 问题 7：runtime-react 依赖 ui-automation-runtime 存在循环依赖风险（需要验证）

**位置**：实现计划 Task 7

Task 7 要在 `runtime-react/package.json` 中添加：
```json
"@impos2/ui-base-automation-runtime": "workspace:*"
```

而 `ui-automation-runtime` 的 `package.json`（Task 1）已经依赖：
```json
"@impos2/kernel-base-ui-runtime-v2": "workspace:*"
```

**问题**：需要确认 `kernel-base-ui-runtime-v2` 和 `ui-base-runtime-react` 的依赖关系。如果存在 `runtime-react → kernel-base-ui-runtime-v2 → ... → runtime-react` 的路径，会形成循环依赖，yarn workspace 会报错。

**建议**：Task 7 执行前先用 `yarn why @impos2/ui-base-runtime-react` 确认依赖图。如果有风险，`runtime-react` 对 automation runtime 的依赖应改为通过 context/injection 注入（传入 `SemanticRegistry` 实例），而不是直接 import 包。

---

### 问题 8：Task 8 不是真正迁移（需要验证）

**位置**：实现计划 Task 8

Task 8 声称"迁移 input-runtime Expo 自动化到新 runtime client"，但实际代码只是在 `runAutomation.mjs` 里封装了一个本地 `createAutomationClient` helper，仍然直接操作 DOM（`document.querySelector`）和 `clickTestId`，完全没有使用 `ui-automation-runtime` 包的任何 API。

**问题**：这不是迁移，是重新包装了旧逻辑。spec 第 13 节阶段 2 的验收标准是"通过新 runtime 跑通同等自动化流程"，Task 8 不满足这个标准。

**建议**：Task 8 应明确标注为"过渡桥接"，推迟到 WebSocket transport 跑通后再做真正的迁移。避免给后续执行者造成"已完成迁移"的误判。

---

### 问题 9：createBrowserScriptExecutorAdapter 泛型 T 作用域错误（应该修复）

**位置**：实现计划 Task 6，`scriptExecutorAdapter.ts`

```ts
export const createBrowserScriptExecutorAdapter = (host: {
    execute<T = unknown>(source, params, globals, timeoutMs): T | Promise<T>
}): AutomationScriptExecutorAdapter => ({
    async execute(input) {
        return await host.execute<T>(...)  // T 在这里未定义
    },
})
```

**问题**：`execute` 方法体内的 `T` 是 `host.execute` 的类型参数，但在外层箭头函数中 `T` 没有作用域，TypeScript 会报错。

**建议**：

```ts
async execute<T = unknown>(input: AutomationScriptExecutionInput): Promise<T> {
    return await host.execute<T>(input.source, input.params, input.globals, input.timeoutMs)
}
```

或者直接用 `unknown` 替代泛型，在调用侧做类型断言。

---

## 结论

设计文档（spec）整体方向正确，架构边界清晰，约束合理。主要问题集中在实现计划（plan）的具体代码上：

1. 几个核心引擎（wait、eventBus、socket server）是骨架实现，缺少真正的逻辑，需要在执行前补全。
2. `scripts.execute` 的 Product guard 需要在服务端显式实现，不能只依赖客户端。
3. trace 只保留一条会严重影响排障能力，建议在 Task 5 执行时同步修正。
