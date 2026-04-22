# 1-kernel/1.1-base 代码审查报告

**日期**：2026-04-20  
**审查范围**：`1-kernel/1.1-base` 下所有包  
**包列表**：contracts、platform-ports、definition-registry、execution-runtime、host-runtime、state-runtime、transport-runtime（及 v2/v3 系列包）

---

## 一、总体评价

整体架构分层清晰，类型系统设计较为严谨，immutable 模式执行较好。但在以下几个维度存在明显问题：安全性隐患、类型安全漏洞、设计不一致、健壮性不足、以及部分逻辑错误。

---

## 二、问题清单

### [CRITICAL] C1 — ticket token 使用 Math.random() 生成，存在安全隐患

**位置**：`host-runtime/src/foundations/createHostRuntime.ts:97`

```ts
token: `ticket_${Math.random().toString(36).slice(2, 12)}`,
```

**问题**：`Math.random()` 是伪随机数，不具备密码学安全性，token 可被预测或暴力枚举。PairingTicket 的 token 用于身份验证（processHello 中校验），一旦被猜中，攻击者可伪造合法节点接入。

**建议**：使用 `crypto.randomBytes` 或 `crypto.getRandomValues` 生成 token。

---

### [CRITICAL] C2 — ID 生成函数存在碰撞风险

**位置**：`host-runtime/src/foundations/ids.ts:7-8`

```ts
const createHostIdPayload = (): string => {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
```

**问题**：`Date.now()` 精度为毫秒，同一毫秒内多次调用时时间戳相同；随机部分仅 8 位 base36（约 36^8 ≈ 28 亿），在高并发场景下碰撞概率不可忽视。SessionId、ConnectionId、EnvelopeId 等均依赖此函数，碰撞会导致会话混乱或消息路由错误。

**建议**：使用 UUID v4 或加入单调递增序列号。

---

### [HIGH] H1 — relayEnvelope 中 resolveRelayChannel 依赖字段名嗅探，脆弱且不可维护

**位置**：`host-runtime/src/foundations/createHostRuntime.ts:47-58`

```ts
const resolveRelayChannel = (envelope: HostRelayEnvelope): HostRelayChannel => {
    if ('commandName' in envelope) { return 'dispatch' }
    if ('projection' in envelope) { return 'projection' }
    if ('snapshot' in envelope || 'summaryBySlice' in envelope || ...) { return 'resume' }
    return 'event'
}
```

**问题**：通过检查字段名来判断 envelope 类型，是结构性鸭子类型判断。一旦任何 envelope 类型新增/重命名字段，channel 判断就会静默出错。`HostRelayEnvelope` 是联合类型，应通过判别字段（discriminant）区分。

**建议**：在 `HostRelayEnvelope` 各成员类型上添加 `channel: HostRelayChannel` 判别字段，或添加 `kind` 字段，消除字段嗅探。

---

### [HIGH] H2 — processHello 中 tickets.occupy 被调用两次，逻辑重复且状态不一致

**位置**：`host-runtime/src/foundations/createHostRuntime.ts:373-415`

```ts
tickets.occupy(ticketRecord.ticket.token, { ..., connected: false, ... }, receivedAt)
// ... attachConnection ...
tickets.occupy(ticketRecord.ticket.token, { ..., connected: true, ... }, receivedAt)
```

**问题**：同一 token 的 occupy 被调用两次，第一次 `connected: false`，第二次 `connected: true`。这是为了在 attachConnection 前后更新状态，但两次调用之间如果 attachConnection 抛出异常，ticket 状态将停留在 `connected: false` 的中间态，与实际连接状态不一致。

**建议**：合并为一次 occupy 调用，在 attachConnection 成功后统一更新；或使用事务性更新模式。

---

### [HIGH] H3 — expireIdleConnections 使用 `.filter(Boolean) as any` 绕过类型系统

**位置**：`host-runtime/src/foundations/createHostRuntime.ts:608-609`

```ts
.filter(Boolean) as any
```

**问题**：`detachConnection` 返回 `HostConnectionDetachResult | undefined`，用 `.filter(Boolean)` 过滤 undefined 后强转 `as any`，完全丢失类型信息。调用方无法得到正确的类型推断，且掩盖了潜在的逻辑问题。

**建议**：使用类型谓词：`.filter((r): r is HostConnectionDetachResult => r !== undefined)`。

---

### [HIGH] H4 — relayEnvelope 中 fault.disconnectTarget 时调用 relay.markDisconnected() 语义不明

**位置**：`host-runtime/src/foundations/createHostRuntime.ts:464-471`

```ts
if (fault.disconnectTarget && targetNode.connectionId) {
    relay.markDisconnected()
    disconnectedConnectionIds.push(targetNode.connectionId)
    detachConnection({ ... })
}
```

**问题**：`relay.markDisconnected()` 不传任何参数，无法确定它标记的是哪个连接/会话的断开状态。这是一个全局计数器操作，与具体的 connectionId 解耦，可能导致统计数据不准确。

---

### [HIGH] H5 — ExecutionJournal 无界增长，存在内存泄漏风险

**位置**：`execution-runtime/src/foundations/journal.ts:6-17`

```ts
const records: ExecutionJournalRecord[] = []
return {
    append(record) { records.push(record) },
    list() { return [...records] },
}
```

**问题**：journal 数组无上限，长期运行的进程中会持续增长，最终导致内存耗尽。对比 `HostObservability` 有 `maxEvents` 限制，journal 缺乏同等保护。

**建议**：添加 `maxRecords` 上限参数，超出时丢弃最旧记录（循环缓冲区）。

---

### [MEDIUM] M1 — ParameterDefinition.validate 返回 boolean，无法表达验证失败原因

**位置**：`contracts/src/types/parameter.ts:11`

```ts
validate?: (value: TValue) => boolean
```

**问题**：validate 只返回 true/false，调用方无法知道为什么验证失败，导致错误信息只能是通用提示，不利于调试和用户反馈。

**建议**：改为 `validate?: (value: TValue) => true | string`，返回字符串表示错误原因。

---

### [MEDIUM] M2 — CommandEventEnvelope.eventType 与 ExecutionLifecycleEvent.eventType 枚举不对齐

**位置**：`contracts/src/types/command.ts:40` vs `execution-runtime/src/types/execution.ts:40`

```ts
// command.ts
eventType: 'accepted' | 'started' | 'resultPatch' | 'completed' | 'failed'

// execution.ts
eventType: 'started' | 'completed' | 'failed'
```

**问题**：两个 eventType 枚举不一致，`CommandEventEnvelope` 有 `accepted` 和 `resultPatch`，而 `ExecutionLifecycleEvent` 没有。描述同一生命周期的不同视角，枚举值不对齐，在状态映射时容易遗漏或产生歧义。

**建议**：统一定义 `CommandLifecycleEventType`，两处共用。

---

### [MEDIUM] M3 — 'complete' vs 'completed' 拼写不一致，存在静默 bug 风险

**位置**：`contracts/src/types/request.ts:4` vs `execution-runtime/src/types/execution.ts:27`

```ts
// request.ts - CommandLifecycleStatus
'complete'

// execution.ts - ExecutionSuccessResult
status: 'completed'
```

**问题**：`CommandLifecycleStatus` 用 `'complete'`，`ExecutionSuccessResult` 用 `'completed'`，两处不一致。在状态映射时字符串比较不匹配会产生静默 bug。

**建议**：统一使用 `'completed'`。

---

### [MEDIUM] M4 — createPlatformPorts 仅做浅冻结，无实际价值

**位置**：`platform-ports/src/foundations/createPlatformPorts.ts`

```ts
export const createPlatformPorts = (input: CreatePlatformPortsInput): PlatformPorts => {
    return Object.freeze({ ...input })
}
```

**问题**：该函数仅展开 input 并浅冻结，没有任何验证、初始化或组合逻辑。`Object.freeze` 是浅冻结，对嵌套对象无效。调用方直接传入对象字面量效果相同，这个工厂函数是无意义的抽象。

**建议**：要么删除此函数，要么在此处加入端口完整性校验逻辑。

---

### [MEDIUM] M5 — scope.ts 中三个 createModule*StateKeys 函数实现完全相同

**位置**：`state-runtime/src/supports/scope.ts:19-32`

```ts
export const createModuleWorkspaceStateKeys = ...    // 与 createModuleStateKeys 完全相同
export const createModuleInstanceModeStateKeys = ... // 与 createModuleStateKeys 完全相同
export const createModuleDisplayModeStateKeys = ...  // 与 createModuleStateKeys 完全相同
```

**问题**：三个函数体与 `createModuleStateKeys` 完全一致，是纯粹的重复代码。函数名暗示有不同行为，实际上没有，会误导使用者。

**建议**：删除三个重复函数，统一使用 `createModuleStateKeys`。

---

### [MEDIUM] M6 — appendQueryToUrl 直接修改传入的 URL 对象，违反不可变原则

**位置**：`transport-runtime/src/foundations/shared.ts:50-68`

```ts
export const appendQueryToUrl = (url: URL, query?: Record<string, unknown>): URL => {
    Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, String(value))  // 直接修改传入的 url
    })
    return url
}
```

**问题**：函数直接修改传入的 `URL` 对象，违反不可变原则。调用方传入的 URL 对象会被意外修改，导致难以追踪的 bug。

**建议**：在函数内部创建新的 URL 对象：`const result = new URL(url.toString())`，对 result 操作后返回。

---

### [MEDIUM] M7 — nodeWsTransport 中 open 事件监听重复注册

**位置**：`transport-runtime/test/helpers/nodeWsTransport.ts:16-31`

```ts
socket.on('open', () => { handlers.onOpen() })
// ...
await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', error => reject(error))
})
```

**问题**：`open` 事件被注册了两次——一次用 `socket.on`（持久监听），一次用 `socket.once`（用于等待连接）。如果 `open` 事件触发时 `handlers.onOpen()` 抛出异常，Promise 不会 reject，导致连接挂起。此外，`error` 事件也被注册了两次（`socket.on('error')` 和 `socket.once('error')`），在 Node.js 中多个 error 监听器同时触发时行为可能不符合预期。

**建议**：合并两次监听，在 `once('open')` 回调中同时调用 `handlers.onOpen()` 和 `resolve()`。

---

### [MEDIUM] M8 — HostSessionRecord.nodes 使用 Record<string, ...> 而非 Record<NodeId, ...>

**位置**：`host-runtime/src/types/session.ts:47-58`

```ts
export interface HostSessionRecord {
    nodes: Record<string, HostSessionNodeRecord>  // 应为 Record<NodeId, ...>
}
```

**问题**：`nodes` 的 key 是 `NodeId`（branded type），但声明为 `string`，丢失了类型约束。在 `createHostRuntime.ts:386` 中也有 `Object.values(session.nodes).find(...)` 的遍历，如果 key 类型不正确，后续重构时容易引入错误。

**建议**：改为 `Record<NodeId, HostSessionNodeRecord>`。

---

### [LOW] L1 — CompatibilityDecision.reasons 在 full 级别时为空数组，但类型未区分

**位置**：`contracts/src/types/compatibility.ts` + `host-runtime/src/foundations/compatibility.ts:50-54`

```ts
return {
    level: 'full',
    reasons: [],  // full 时 reasons 永远为空
    ...
}
```

**问题**：`reasons` 在 `full` 级别时永远为空数组，在 `rejected`/`degraded` 时才有内容，但类型定义没有区分这一语义。调用方需要自行理解这个约定，容易误用。

**建议**：用判别联合类型区分三种级别，`full` 级别不包含 `reasons` 字段。

---

### [LOW] L2 — ErrorDefinition.code 为可选字段，但 AppError.code 为必填，存在语义矛盾

**位置**：`contracts/src/types/error.ts:17-24` vs `:26-43`

```ts
export interface ErrorDefinition {
    code?: string  // 可选
}

export interface AppError {
    code: string   // 必填
}
```

**问题**：`ErrorDefinition` 的 `code` 是可选的，但 `AppError` 的 `code` 是必填的。从 `ErrorDefinition` 创建 `AppError` 时，如果 `code` 未定义，需要特殊处理，但类型系统没有强制这一约束，容易产生空字符串或 undefined 被强转的情况。

**建议**：将 `ErrorDefinition.code` 改为必填，或在 `AppError` 中将 `code` 改为可选。

---

### [LOW] L3 — compilePath 中路径参数校验不完整

**位置**：`transport-runtime/src/foundations/shared.ts:26-48`

```ts
export const compilePath = <TPath extends Record<string, unknown>>(
    pathTemplate: string,
    pathParams?: TPath,
): string => {
```

**问题**：当 `pathTemplate` 包含路径参数（如 `{id}`）但 `pathParams` 为 `undefined` 时，`rawValue` 为 `undefined`，会抛出 `createTransportConfigurationError`。但函数签名允许 `pathParams` 为可选，这与"有路径参数时必须提供 pathParams"的语义矛盾，类型系统无法在编译期捕获此错误。

**建议**：当 `pathTemplate` 含有路径参数时，通过函数重载强制要求 `pathParams` 必填。

---

## 三、设计层面问题

### D1 — definition-registry 中 KeyedDefinition 是冗余抽象

**位置**：`definition-registry/src/types/definition.ts`

```ts
export type ErrorDefinitionEntry = ErrorDefinition
export type ParameterDefinitionEntry = ParameterDefinition
```

`ErrorDefinitionEntry` 和 `ParameterDefinitionEntry` 是对 `ErrorDefinition` 和 `ParameterDefinition` 的纯别名，没有任何扩展，是无意义的类型别名，增加了理解成本。

---

### D2 — StateRuntimePersistenceRecordDescriptor 泛型约束过宽

**位置**：`state-runtime/src/types/persistence.ts:31-44`

```ts
export interface StateRuntimePersistenceRecordDescriptor<
    State extends Record<string, unknown> = Record<string, unknown>,
> {
    getEntries?: (state: State) => Record<string, unknown>
}
```

`getEntries` 返回 `Record<string, unknown>`，丢失了值类型信息。与 `StateRuntimePersistenceFieldDescriptor` 的泛型设计不一致（后者保留了 `State` 泛型）。

---

### D3 — RootState 是空接口，设计意图不明

**位置**：`state-runtime/src/types/state.ts`

```ts
export interface RootState {}
```

空接口在 TypeScript 中等同于 `{}`，接受任何非 null 值，没有类型约束作用。如果是用于模块扩展（declaration merging），应有注释说明；否则应删除。

---

## 四、缺失测试覆盖

以下核心逻辑缺乏测试文件：

| 包 | 缺失测试的关键逻辑 |
|---|---|
| `host-runtime` | `createHostRuntime`（processHello、relayEnvelope、expireIdleConnections） |
| `host-runtime` | `evaluateHostCompatibility` |
| `execution-runtime` | `createExecutionJournal` |
| `transport-runtime` | `compilePath`、`appendQueryToUrl`、`normalizeHeaders` |
| `state-runtime` | `scope.ts` 中所有工具函数 |

`transport-runtime` 有 `test/` 目录但仅包含 helper，无实际测试用例。

---

## 五、优先级汇总

| 级别 | 编号 | 问题 |
|------|------|------|
| CRITICAL | C1 | ticket token 使用 Math.random()，不安全 |
| CRITICAL | C2 | ID 生成碰撞风险 |
| HIGH | H1 | resolveRelayChannel 字段名嗅探 |
| HIGH | H2 | processHello 中 occupy 两次调用，中间态风险 |
| HIGH | H3 | expireIdleConnections 使用 `as any` 绕过类型 |
| HIGH | H4 | relay.markDisconnected() 无参数，语义不明 |
| HIGH | H5 | ExecutionJournal 无界增长 |
| MEDIUM | M1 | validate 返回 boolean，无法表达失败原因 |
| MEDIUM | M2 | eventType 枚举不对齐 |
| MEDIUM | M3 | 'complete' vs 'completed' 不一致 |
| MEDIUM | M4 | createPlatformPorts 无实际价值 |
| MEDIUM | M5 | scope.ts 三个重复函数 |
| MEDIUM | M6 | appendQueryToUrl 修改传入对象 |
| MEDIUM | M7 | nodeWsTransport open 事件重复注册 |
| MEDIUM | M8 | nodes 使用 Record<string,...> 而非 Record<NodeId,...> |
| LOW | L1 | CompatibilityDecision reasons 语义未区分 |
| LOW | L2 | ErrorDefinition.code 可选与 AppError.code 必填矛盾 |
| LOW | L3 | compilePath 路径参数校验不完整 |

