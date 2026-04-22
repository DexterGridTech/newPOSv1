# 1-kernel/1.1-base 设计审查报告

**日期：** 2026-04-17  
**范围：** `1-kernel/1.1-base` 下所有包  
**方法：** 阅读源码，理解设计意图，从架构合理性角度找出问题

---

## 一、包结构总览

| 包名 | 职责 |
|------|------|
| `contracts` | 协议类型定义（命令、拓扑、状态同步、请求生命周期等） |
| `platform-ports` | 平台能力抽象接口（存储、设备、日志等） |
| `definition-registry` | 错误/参数定义注册 |
| `state-runtime` | Redux store 封装 + 持久化 + 同步算法 |
| `execution-runtime` | 执行日志（journal） |
| `host-runtime` | 主机端会话管理、配对、中继 |
| `transport-runtime` | HTTP 传输工具函数 |
| `runtime-shell-v2` | 内核运行时总装配入口 |
| `topology-runtime-v2` | 主副屏同步计划（summary/diff 生成） |
| `workflow-runtime-v2` | 工作流运行时 |
| `ui-runtime-v2` | UI 运行时 |
| `tcp-control-runtime-v2` | TCP 控制运行时 |
| `tdp-sync-runtime-v2` | TDP 同步运行时 |

---

## 二、设计问题详述

### 问题 1：`StateRuntime` 接口直接暴露 `getStore()` —— 破坏封装

**位置：** `state-runtime/src/types/runtime.ts:20`

**问题描述：**

```ts
export interface StateRuntime {
    getStore(): EnhancedStore   // ← 直接暴露 Redux store
    getState(): RootState
    ...
}
```

`StateRuntime` 的设计意图是封装 Redux store，让外部只通过声明式接口操作状态。但 `getStore()` 把原始 `EnhancedStore` 暴露出去，外部可以直接 `store.dispatch(任意action)`，完全绕过 `StateRuntime` 的持久化、脏标记、同步等机制。

**实际影响：** `runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts:51` 中直接取出 store 并调用 `store.dispatch`，持久化的 `markPersistenceDirty` 不会被触发。

**建议：** 移除 `getStore()`，改为在 `StateRuntime` 上提供 `dispatch(action)` 和 `subscribe(listener)` 方法，让所有状态变更都经过 `StateRuntime` 管控。

---

### 问题 2：`createStateRuntime` 函数体超过 600 行 —— 违反单一职责

**位置：** `state-runtime/src/foundations/createStateRuntime.ts`

**问题描述：**

该函数承担了以下所有职责：
- Redux store 创建
- 持久化 key 生成（`createFieldStorageKey`、`createRecordStoragePrefix` 等 4 个函数）
- 持久化条目导出（`exportEntries`）
- 持久化写入（`flushPersistence`）
- 持久化读取（`hydratePersistence`）
- 状态恢复（`applyPersistedState`、`buildStatePatchFromSnapshot`）
- 脏标记管理
- 防抖调度（`scheduleFlush`）
- store 订阅监听

这些职责完全可以拆分为独立模块（如 `PersistenceManager`），但全部堆在一个闭包里，导致：
1. 函数内部状态（`persistedValueCache`、`flushTimer`、`hydratePromise` 等）散落各处，难以追踪
2. 测试只能整体测试，无法单独测试持久化逻辑
3. 600+ 行违反了项目自身 coding-style 规定的 800 行上限，且远超 50 行函数规范

**建议：** 将持久化逻辑提取为独立的 `createPersistenceManager(input, store)` 模块。

---

### 问题 3：`runtimeStateSync.ts` 中 `syncMode` 逻辑永远为 `'authoritative'`

**位置：** `runtime-shell-v2/src/foundations/runtimeStateSync.ts:15-17`

**问题描述：**

```ts
const syncMode = envelope.direction === 'master-to-slave' || envelope.direction === 'slave-to-master'
    ? 'authoritative'
    : 'latest-wins'
```

`StateSyncDiffEnvelope.direction` 的类型定义（`contracts/src/types/stateSync.ts:28`）只有两个值：`'master-to-slave'` 和 `'slave-to-master'`，不存在第三种值。因此这个三元表达式的 `else` 分支（`'latest-wins'`）永远不会执行，`syncMode` 永远是 `'authoritative'`。

这说明 `SyncDiffOptions.mode` 中的 `'latest-wins'` 模式要么是未完成的设计，要么是死代码。

**建议：** 要么删除 `'latest-wins'` 分支和对应的 `SyncDiffOptions.mode` 类型值，要么在 `direction` 类型中补充触发该模式的值，并明确其语义。

---

### 问题 4：`PlatformPorts` 中 `ConnectorPort` 接口过于宽泛 —— 类型安全丢失

**位置：** `platform-ports/src/types/ports.ts:45-66`

**问题描述：**

```ts
export interface ConnectorPort {
    call?(input: {
        channel: Record<string, unknown>   // ← 完全无类型
        action: string
        params?: Record<string, unknown>   // ← 完全无类型
    }): Promise<Record<string, unknown>>   // ← 完全无类型
}
```

`ConnectorPort` 是适配层与业务层之间的核心通信接口，但所有参数和返回值都是 `Record<string, unknown>`，调用方无法从类型系统得到任何约束，错误只能在运行时发现。与项目 CLAUDE.md 中"能用类型表示的就不用字符串"的原则相悖。同样问题存在于 `LocalWebServerPort`、`AppControlPort.switchServerSpace` 等接口。

**建议：** 使用泛型参数约束 channel、params 和返回值类型，或为每种具体 connector 定义专属接口，`ConnectorPort` 仅作为基础约束。

---

### 问题 5：`host-runtime` 中 `resolveRelayChannel` 用字段嗅探判断信封类型 —— 脆弱的鸭子类型

**位置：** `host-runtime/src/foundations/createHostRuntime.ts:47-58`

**问题描述：**

```ts
const resolveRelayChannel = (envelope: HostRelayEnvelope): HostRelayChannel => {
    if ('commandName' in envelope) return 'dispatch'
    if ('projection' in envelope) return 'projection'
    if ('snapshot' in envelope || 'summaryBySlice' in envelope || ...) return 'resume'
    return 'event'
}
```

通过检查字段是否存在来判断信封类型，是典型的脆弱设计：若未来某个信封类型新增了 `commandName` 字段，就会被错误路由。`HostRelayEnvelope` 是联合类型，但没有利用判别联合（discriminated union）的 `kind`/`type` 字段。`resolveRelayTargetNodeId` 中存在同样问题。

**建议：** 在所有信封类型上添加统一的 `channel: HostRelayChannel` 判别字段，直接用 `envelope.channel` 路由，消除字段嗅探。

---

### 问题 6：`PairingTicket.token` 用 `Math.random()` 生成 —— 安全性不足

**位置：** `host-runtime/src/foundations/createHostRuntime.ts:96`

**问题描述：**

```ts
token: `ticket_${Math.random().toString(36).slice(2, 12)}`,
```

`Math.random()` 是伪随机数，不具备密码学安全性，约 50 bits 熵值，在高频配对场景下存在碰撞和预测风险。配对 ticket 是安全敏感的凭证。

**建议：** 将 token 生成逻辑注入为可替换依赖（`CreateHostRuntimeInput.generateToken?`），让适配层提供平台安全实现（`crypto.getRandomValues()` 或 `crypto.randomBytes()`）。

---

### 问题 7：`ExecutionJournal` 无界增长 —— 内存泄漏风险

**位置：** `execution-runtime/src/foundations/journal.ts`

**问题描述：**

```ts
const records: ExecutionJournalRecord[] = []
return {
    append(record) { records.push(record) },  // 无上限
    list() { return [...records] },
}
```

只有 `append` 和 `list`，没有清理机制。在长时间运行的 POS 终端场景中，每次命令执行都会追加记录，最终导致内存持续增长。对比 `host-runtime` 的 `observability` 有 `maxEvents` 限制，`ExecutionJournal` 缺少同等保护。

**建议：** 添加 `maxRecords` 上限（循环缓冲区或 FIFO 淘汰），或提供 `clear()` / `trim()` 方法。

---

### 问题 8：`persistIntent` 与 `persistence` 双重开关语义重叠

**位置：** `state-runtime/src/types/slice.ts` 和 `state-runtime/src/foundations/createStateRuntime.ts:139-141`

**问题描述：**

```ts
// 两个字段都要满足才真正持久化
slice.persistIntent === 'owner-only' && (slice.persistence?.length ?? 0) > 0
```

存在两个独立的持久化开关：`persistIntent === 'owner-only'` 且 `persistence` 数组非空，两者都满足才真正持久化。这造成：
- 声明 `persistIntent: 'owner-only'` 但不填 `persistence` → 静默无效
- 填了 `persistence` 但 `persistIntent: 'never'` → 静默无效
- 两个字段语义重叠，`persistIntent` 的存在价值不明确

**建议：** 统一为单一控制点：有 `persistence` 数组即表示需要持久化，移除 `persistIntent` 字段；或用条件类型在 TypeScript 层面禁止矛盾组合。

---

### 问题 9：`topology-runtime-v2` 硬编码 `mode: 'authoritative'`，与问题 3 形成死代码闭环

**位置：** `topology-runtime-v2/src/foundations/syncPlan.ts:62-68`

**问题描述：**

```ts
const diff = createSliceSyncDiff(slice, sliceState, remoteSummary, { mode: 'authoritative' })
```

`syncPlan.ts` 生成 diff 时始终使用 `authoritative` 模式。结合问题 3，`'latest-wins'` 在整个调用链中从未被实际使用，说明这个模式是未完成的设计或过度设计的抽象。

**建议：** 如果 `'latest-wins'` 确实有业务场景，应在 `TopologyV2SyncDiffInput` 中暴露 `mode` 参数；否则删除该选项，简化代码。

---

### 问题 10：ID 类型全部是 `string` 别名 —— 名义类型保护缺失

**位置：** `contracts/src/types/ids`（通过各文件 import 推断）

**问题描述：**

`SessionId`、`NodeId`、`CommandId`、`RequestId`、`EnvelopeId` 等均为 `string` 的类型别名。TypeScript 结构类型系统不区分这些别名，导致不同 ID 之间可以互相赋值而编译器不报错。`createHostRuntime.ts:90` 中已出现 `as any` 强转来绕过类型检查，说明这个问题已在实践中造成麻烦。

**建议：** 使用品牌类型（branded types）增强名义类型安全：
```ts
type NodeId = string & { readonly __brand: 'NodeId' }
```

---

## 三、问题汇总与优先级

| # | 问题 | 严重程度 | 影响范围 |
|---|------|----------|----------|
| 1 | `StateRuntime` 暴露 `getStore()` 破坏封装 | 高 | 持久化、同步机制失效风险 |
| 2 | `createStateRuntime` 600+ 行违反单一职责 | 高 | 可维护性、可测试性 |
| 3 | `syncMode` 永远为 `authoritative`，`latest-wins` 是死代码 | 中 | 代码可信度、未来扩展 |
| 4 | `ConnectorPort` 全用 `Record<string, unknown>` | 中 | 类型安全、运行时错误 |
| 5 | 信封类型用字段嗅探路由 | 中 | 路由正确性、可扩展性 |
| 6 | ticket token 用 `Math.random()` | 中 | 安全性 |
| 7 | `ExecutionJournal` 无界增长 | 中 | 长时间运行内存泄漏 |
| 8 | `persistIntent` 与 `persistence` 双重开关 | 低 | 配置混乱、静默失效 |
| 9 | `topology` 硬编码 `authoritative` | 低 | 死代码 |
| 10 | ID 类型无名义保护 | 低 | 类型安全 |

---

## 四、总体评价

整体架构分层清晰，`contracts` / `platform-ports` / `state-runtime` / `host-runtime` 的职责划分有明确意图，注释中的"设计意图"说明也体现了良好的设计思考。主要问题集中在：

1. **封装边界被自己打破**（问题 1）：`StateRuntime` 设计了封装但又暴露了原始 store
2. **函数体过大**（问题 2）：持久化逻辑应独立为子模块
3. **未完成的抽象留下死代码**（问题 3、9）：`latest-wins` 模式设计了但从未接通
4. **安全敏感点使用了不安全实现**（问题 6）：token 生成应注入为平台依赖

