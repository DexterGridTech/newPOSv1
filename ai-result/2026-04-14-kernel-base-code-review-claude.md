# 1-kernel/1.1-base 代码审查报告

**日期**: 2026-04-14  
**审查范围**: `1-kernel/1.1-base` 下全部 13 个包  
**审查维度**: 架构设计、类型系统、依赖关系、代码质量、可维护性、潜在缺陷

---

## 一、包结构总览

| 包名 | 职责定位 |
|------|---------|
| `contracts` | 全局契约：ID 类型、命令信封、拓扑、参数、兼容性等核心类型与工具函数 |
| `platform-ports` | 平台适配接口：Logger、Storage、Device、AppControl 等 Port 定义与工厂 |
| `definition-registry` | 定义注册表：错误定义、参数定义的注册与查询 |
| `state-runtime` | Redux 状态运行时：Store 创建、持久化、同步 diff 应用 |
| `execution-runtime` | 命令执行运行时：ExecutionCommand、ExecutionJournal、中间件接口 |
| `transport-runtime` | 传输层抽象：HTTP Endpoint、WebSocket Profile、ServerCatalog |
| `host-runtime` | 宿主运行时：配对票据、兼容性评估、故障注入注册表 |
| `runtime-shell-v2` | 内核运行时外壳 v2：命令调度、Actor 执行、请求账本、状态同步 |
| `tcp-control-runtime-v2` | TCP 控制通道运行时（v2） |
| `tdp-sync-runtime-v2` | TDP 同步运行时（v2） |
| `workflow-runtime-v2` | 工作流运行时（v2） |
| `topology-runtime-v2` | 拓扑运行时（v2） |
| `ui-runtime-v2` | UI 运行时（v2） |

---

## 二、设计意图识别

### 2.1 整体架构意图

该层实现了一套**事件驱动、Actor 模型**的分布式内核框架，核心设计意图如下：

1. **命令总线（Command Bus）**：所有业务操作以 `CommandIntent` 形式发起，经 `runtime-shell-v2` 调度到注册的 Actor Handler 执行，支持本地（`local`）和对端（`peer`）两种路由目标。

2. **多 Actor 并发执行**：同一命令可被多个 Actor 并发处理，结果聚合为 `CommandAggregateResult`，支持 `COMPLETED / PARTIAL_FAILED / FAILED / TIMEOUT` 四种聚合状态。

3. **请求账本（Request Ledger）**：以 `RequestId` 为维度追踪一次请求内所有命令的执行状态，支持订阅监听，为 UI 层提供实时进度反馈。

4. **模块化插件体系**：通过 `KernelRuntimeModuleV2` 接口，各业务模块以插件形式注入 stateSlices、commandDefinitions、actorDefinitions，实现关注点分离。

5. **平台无关性**：通过 `PlatformPorts` 抽象所有平台能力（日志、存储、设备、网络），内核层零平台依赖。

6. **状态持久化与同步**：`state-runtime` 提供细粒度的字段级/记录级持久化，以及基于 diff 的跨节点状态同步。

7. **主从拓扑（Master/Slave）**：`topology.ts` 和 `host-runtime` 体现了 master/slave 节点配对、握手、兼容性协商的设计。

---

## 三、各包详细审查

### 3.1 contracts

**设计亮点**

- Branded Types（`RequestId`、`CommandId` 等）防止 ID 混用，类型安全极佳。
- `INTERNAL_REQUEST_ID` / `INTERNAL_SESSION_ID` 常量统一内部调用标识，设计合理。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| MEDIUM | `foundations/time.ts:6` | `getMonth() + 1` 未 `pad2`，月份 1-9 月输出单位数，与其他字段格式不一致 |
| LOW | `types/command.ts` | `CommandRouteContext.metadata` 类型为 `Record<string, unknown>`，过于宽泛，缺乏约束 |
| LOW | `types/projection.ts` | `resultsByCommand` 和 `mergedResults` 均为 `Record<string, unknown>`，丢失类型信息 |

**整改建议**

```typescript
// time.ts 修复月份补零
return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ...`
```

---

### 3.2 platform-ports

**设计亮点**

- Logger 实现了敏感字段自动 MASK（PROD 环境），安全意识强。
- `scope()` / `withContext()` 链式 API 设计优雅，支持结构化日志。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| MEDIUM | `types/ports.ts` | `ConnectorPort` 所有方法均为可选（`?`），调用方需大量空值检查，接口过于松散 |
| LOW | `types/ports.ts:74` | `CreatePlatformPortsInput extends PlatformPorts` 是空扩展，无实际意义，可直接用 `PlatformPorts` |
| LOW | `foundations/logger.ts` | `containsSensitiveRaw` 对字符串类型直接返回 `false`，无法检测字符串值中的敏感内容 |

**整改建议**

```typescript
// 移除无意义的空扩展
export type CreatePlatformPortsInput = PlatformPorts
```

---

### 3.3 definition-registry

**设计亮点**

- 泛型 `DefinitionRegistry<TDefinition>` 设计简洁，复用性好。
- `register` 时检测重复 key，防止静默覆盖。
- `snapshot()` 返回冻结对象，防止外部修改。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| HIGH | `foundations/registry.ts:13` | `register` 重复 key 时抛出原生 `Error`，未使用项目统一的 `AppError` 体系 |
| MEDIUM | `types/definition.ts` | `ErrorDefinitionEntry` 和 `ParameterDefinitionEntry` 是纯类型别名，存在冗余 |
| LOW | `types/registry.ts` | `DefinitionRegistryBundle` 硬编码了 `errors` 和 `parameters` 两个字段，扩展性差 |

---

### 3.4 state-runtime

**设计亮点**

- 持久化支持字段级（`field`）和记录级（`record`）两种粒度，灵活性高。
- `manifest` 机制管理 record 类型的存储 key 集合，避免孤儿数据。
- `persistenceChain`（Promise 链）保证持久化操作串行，防止竞态。
- 状态签名（`lastStateSignature`）避免无变化时的冗余写入。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| HIGH | `foundations/createStateRuntime.ts:82` | `cloneState` 使用 `JSON.parse(JSON.stringify(value))`，无法处理 `undefined`、`Date`、循环引用，存在数据丢失风险 |
| HIGH | `foundations/createStateRuntime.ts:308` | `persistenceChain` 链式追加但从不清理，长时间运行后 Promise 链无限增长，内存泄漏 |
| MEDIUM | `foundations/createStateRuntime.ts:532` | store.subscribe 回调中每次序列化全部 entries 计算签名，高频 dispatch 时性能开销大 |
| LOW | `types/slice.ts` | `StateRuntimeSliceDescriptor.reducer` 为可选，但无 reducer 的 slice 无法响应 action，设计意图不明确 |

---

### 3.5 execution-runtime

**设计亮点**

- `ExecutionMiddleware` 接口提供标准中间件链，扩展点清晰。
- `createInternalExecutionCommand` 工厂函数统一内部命令创建。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| HIGH | `types/execution.ts` | `ExecutionJournal` 与 `runtime-shell-v2` 的 `RequestLedger` 职责重叠，但 Journal 在 `runtime-shell-v2` 中未被使用，形成死代码 |
| MEDIUM | `types/execution.ts:47` | `ExecutionHandler` 返回 `Promise<Record<string, unknown> \| void>`，`void` 分支导致调用方无法区分"无结果"和"未实现" |
| LOW | `foundations/command.ts` | `createExecutionCommand` 仅做对象展开，无任何校验或转换，工厂函数价值存疑 |

---

### 3.6 transport-runtime

**设计亮点**

- `defineHttpEndpoint` / `defineSocketProfile` 提供类型安全的端点定义 DSL。
- `ServerCatalog` 集中管理服务地址，支持运行时动态替换（`replaceServers`）。
- `JsonSocketCodec` 实现 `SocketCodec` 接口，编解码可替换。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| HIGH | `foundations/socketProfile.ts:72` | `JsonSocketCodec.deserialize` 的 `catch` 块直接 `throw error`，等同于无 catch，应补充错误上下文 |
| MEDIUM | `foundations/httpEndpoint.ts` / `socketProfile.ts` | `trimTrailingSlash` / `trimLeadingSlash` 在两个文件中完全重复定义，应提取到 `shared.ts` |
| MEDIUM | `foundations/serverCatalog.ts` | `replaceServers` 先 `clear()` 再逐个注册，若中途抛出异常，catalog 处于部分清空状态，存在原子性问题 |

**整改建议**

```typescript
// socketProfile.ts - 补充错误上下文
deserialize(raw: string): TIncoming {
  try {
    return JSON.parse(raw) as TIncoming
  } catch (error) {
    throw new Error(`JsonSocketCodec: failed to deserialize: ${raw.slice(0, 100)}`, { cause: error })
  }
}

// serverCatalog.ts - 原子性替换：先校验全部，再替换
replaceServers(nextServers) {
  for (const server of nextServers) {
    if (!server.addresses.length) throw createTransportConfigurationError(...)
  }
  servers.clear()
  nextServers.forEach(server => servers.set(server.serverName, server))
}
```

---

### 3.7 host-runtime

**设计亮点**

- `evaluateHostCompatibility` 逻辑清晰，三级兼容性（`full/degraded/rejected`）设计合理。
- `HostFaultRegistry` 故障注入机制设计精良，支持按 session/node/role 精确匹配，适合测试场景。
- `TicketRegistry` 的 `cloneRecord` 保证不可变性。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| HIGH | `foundations/faults.ts:44` | `consumeRule` 直接修改 `rule.remainingHits`（mutation），违反不可变原则 |
| MEDIUM | `foundations/compatibility.ts:12` | 兼容性判断仅比较 `protocolVersion` 字符串相等，无法处理语义化版本的向后兼容场景 |
| MEDIUM | `foundations/tickets.ts:39` | `ticket.issuedAt ?? nowTimestampMs()` 中 `issuedAt` 类型为 `number`，不可能为 `undefined`，`??` 是冗余防御 |

**整改建议**

```typescript
// faults.ts - 修复 mutation 问题，保持不可变
const consumeRule = (rule: HostFaultRule) => {
  if (rule.remainingHits == null) return
  if (rule.remainingHits <= 1) {
    rules = rules.filter(r => r.ruleId !== rule.ruleId)
  } else {
    rules = rules.map(r => r.ruleId === rule.ruleId ? { ...r, remainingHits: r.remainingHits! - 1 } : r)
  }
}
```

---

### 3.8 runtime-shell-v2

**设计亮点**

- 完整的命令生命周期：注册 → 调度 → 执行 → 聚合 → 账本记录。
- `Promise.race([execution, timeout])` 实现 Actor 超时保护。
- 重入检测（`executionStack`）防止同一 Actor 在同一请求内递归调用。
- `peerDispatchGateway` 可运行时动态安装，支持延迟绑定。

**缺陷**

| 级别 | 位置 | 问题 |
|------|------|------|
| CRITICAL | `foundations/requestLedger.ts:304` | `applyRequestLifecycleSnapshot` 中 `running` 状态被错误映射为 `COMPLETED`（三元表达式最后分支），逻辑错误 |
| CRITICAL | `foundations/requestLedger.ts:163` | `runtimeId: 'runtime_shell_v2_mirror' as any` 使用 `as any` 绕过 Branded Type 类型安全 |
| HIGH | `foundations/createKernelRuntimeV2.ts:390` | `setTimeout` 超时 Promise 在 Actor 完成后不会被取消，内存泄漏 |
| HIGH | `foundations/createKernelRuntimeV2.ts:163` | `ledger.query(requestId as any)` 强制类型转换，破坏类型安全 |
| MEDIUM | `foundations/createKernelRuntimeV2.ts:182` | `applyProjectionMirror` 和 `getRequestProjection` 是 noop/返回 undefined，但暴露在公共接口上，调用方无法感知未实现 |
| LOW | `foundations/createKernelRuntimeV2.ts:44` | `noopLogger` 与 `state-runtime` 中的 `NOOP_LOGGER` 完全重复，应提取到 `platform-ports` 统一导出 |

**整改建议**

```typescript
// 1. 修复 snapshot 状态映射
status: command.status === 'error'
  ? 'FAILED'
  : command.status === 'complete'
    ? 'COMPLETED'
    : 'RUNNING'  // 修复：running 不应映射为 COMPLETED

// 2. 超时 timer 应可取消，防止内存泄漏
let timeoutId: ReturnType<typeof setTimeout>
const timeout = new Promise<ActorExecutionResult>(resolve => {
  timeoutId = setTimeout(() => resolve({ actorKey: ..., status: 'TIMEOUT', ... }), commandIntent.definition.timeoutMs)
})
const actorResult = await Promise.race([execution, timeout])
clearTimeout(timeoutId!)
```

---

## 四、跨包依赖关系审查

### 4.1 依赖图

```
contracts
  └── platform-ports
        ├── definition-registry
        ├── state-runtime
        │     └── runtime-shell-v2
        │           ├── transport-runtime
        │           └── host-runtime
        └── execution-runtime
```

### 4.2 依赖版本不一致（HIGH）

以下包对内部依赖使用了 `"*"` 而非 `"workspace:*"`：

| 包 | 问题依赖 |
|----|---------|
| `definition-registry` | `@impos2/kernel-base-contracts: "*"` |
| `transport-runtime` | `@impos2/kernel-base-contracts: "*"`, `@impos2/kernel-base-platform-ports: "*"` |
| `host-runtime` | `@impos2/kernel-base-contracts: "*"`, `@impos2/kernel-base-platform-ports: "*"` |
| `execution-runtime` | `@impos2/kernel-base-contracts: "*"`, `@impos2/kernel-base-definition-registry: "*"`, `@impos2/kernel-base-platform-ports: "*"` |
| `platform-ports` | `@impos2/kernel-base-contracts: "*"` |
| `runtime-shell-v2` | `@impos2/kernel-base-contracts: "*"`, `@impos2/kernel-base-platform-ports: "*"` |

`"*"` 在 yarn workspace 中会解析为 npm registry 最新版本，而非本地 workspace 版本，CI 全新安装时可能拉取错误版本。

**整改**：所有内部包依赖统一改为 `"workspace:*"`。

---

## 五、通用代码质量问题

### 5.1 重复代码

| 问题 | 位置 |
|------|------|
| `noopLogger` 重复定义 | `createKernelRuntimeV2.ts:44`, `createStateRuntime.ts:17` |
| `trimTrailingSlash` / `trimLeadingSlash` 重复 | `httpEndpoint.ts`, `socketProfile.ts` |

### 5.2 类型安全漏洞

| 问题 | 位置 |
|------|------|
| `as any` 强制转换 | `requestLedger.ts:163`, `requestLedger.ts:292`, `createKernelRuntimeV2.ts:163` |
| `Record<string, unknown>` 过度使用 | 多处丢失业务语义 |

### 5.3 错误处理不统一

- 部分地方抛出原生 `new Error()`，部分使用 `createAppError()`，不统一。
- `definition-registry` 的注册冲突错误无法被上层 `AppError` 体系捕获和分类。

---

## 六、整体架构缺陷

### 6.1 execution-runtime 定位模糊（HIGH）

`execution-runtime` 定义了 `ExecutionJournal`、`ExecutionMiddleware` 等，但：
- `runtime-shell-v2` 未使用 `ExecutionJournal`，自己实现了 `RequestLedger`
- `ExecutionMiddleware` 接口存在但无任何实现或使用
- `ExecutionContext` 与 `ActorExecutionContext` 高度相似但并存

**建议**：明确边界——要么合并 Journal，要么删除未使用接口，避免"幽灵包"。

### 6.2 applyProjectionMirror / getRequestProjection 是未完成功能（MEDIUM）

这两个方法在 `KernelRuntimeV2` 公共接口中暴露，但实现为 noop/返回 undefined。

**建议**：从 `KernelRuntimeV2` 接口中移除，改为通过模块安装时注入的方式提供。

### 6.3 状态同步与持久化的隐式副作用链路（MEDIUM）

同步 diff 应用后会触发 store.subscribe，进而触发持久化，这个副作用链路隐式且难以追踪。

**建议**：在 `applySlicePatches` 中增加 `skipPersistence` 选项，让同步 diff 应用不触发持久化。

---

## 七、整改优先级汇总

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | `requestLedger.ts:304` snapshot 状态 `running→COMPLETED` 逻辑错误 | 请求状态显示错误 |
| P0 | 所有内部依赖 `"*"` 改为 `"workspace:*"` | CI 构建可能拉取错误版本 |
| P1 | `setTimeout` 超时 Promise 未取消 | 内存泄漏 |
| P1 | `faults.ts` consumeRule mutation | 故障注入规则状态错误 |
| P1 | `as any` 强制转换（3 处） | 类型安全被破坏 |
| P2 | `cloneState` 使用 JSON 序列化 | 特殊值丢失 |
| P2 | `persistenceChain` 无限增长 | 长时间运行内存泄漏 |
| P2 | `noopLogger` / `trimSlash` 重复代码 | 维护成本 |
| P3 | `execution-runtime` 定位模糊 | 架构清晰度 |
| P3 | `applyProjectionMirror` noop 暴露 | 接口误导 |
| P3 | `time.ts` 月份未补零 | 日志格式不一致 |

---

*报告生成时间：2026-04-14*
