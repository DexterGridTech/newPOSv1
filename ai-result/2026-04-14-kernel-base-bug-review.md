# 1-kernel/1.1-base Bug 检查报告

**日期：** 2026-04-14  
**范围：** `1-kernel/1.1-base` 下全部 13 个包，共 421 个源文件  
**方法：** 逐文件静态分析，重点关注逻辑错误、类型安全、边界条件、空值处理、异步竞态、内存泄漏

---

## 严重级别说明

| 级别 | 含义 |
|------|------|
| CRITICAL | 必然导致运行时崩溃或数据损坏 |
| HIGH | 在特定场景下会产生错误行为，影响核心功能 |
| MEDIUM | 存在潜在风险，在边界条件下可能出错 |
| LOW | 代码质量问题，不影响当前功能但存在隐患 |

---

## 汇总统计

| 包名 | CRITICAL | HIGH | MEDIUM | LOW | 合计 |
|------|----------|------|--------|-----|------|
| contracts | 0 | 0 | 3 | 5 | 8 |
| platform-ports | 0 | 1 | 3 | 4 | 8 |
| definition-registry | 0 | 1 | 3 | 3 | 7 |
| execution-runtime | 0 | 1 | 2 | 2 | 5 |
| host-runtime | 0 | 4 | 4 | 3 | 11 |
| state-runtime | 1 | 3 | 5 | 3 | 12 |
| transport-runtime | 0 | 3 | 5 | 3 | 11 |
| runtime-shell-v2 | 0 | 2 | 4 | 4 | 10 |
| tcp-control-runtime-v2 | 0 | 1 | 5 | 3 | 9 |
| tdp-sync-runtime-v2 | 0 | 2 | 6 | 3 | 11 |
| topology-runtime-v2 | 1 | 3 | 8 | 3 | 15 |
| workflow-runtime-v2 | 0 | 2 | 4 | 4 | 10 |
| ui-runtime-v2 | 0 | 0 | 1 | 3 | 4 |
| **合计** | **2** | **23** | **53** | **43** | **121** |

---

## 优先修复清单（CRITICAL + HIGH）

| # | 包 | 文件 | 问题 |
|---|-----|------|------|
| 1 | state-runtime | `foundations/createStateRuntime.ts` | `flushPersistence` 竞态：链式 Promise 内写入旧快照 |
| 2 | topology-runtime-v2 | `foundations/orchestrator.ts` | `waitForRemoteStarted` 忙等轮询，CPU 100% 风险 |
| 3 | host-runtime | `foundations/sessions.ts` | `detachConnection` 覆盖 `pendingNodeIds`，丢失重连状态 |
| 4 | host-runtime | `foundations/relay.ts` | `drain` 计数器更新错误，多连接时 `queueBySession` 可能为负 |
| 5 | topology-runtime-v2 | `foundations/orchestrator.ts` | `stateUnsubscribe` 未在断连时调用，内存泄漏 |
| 6 | topology-runtime-v2 | `foundations/orchestrator.ts` | `listenersAttached` 重连时不重置，事件监听器不再注册 |
| 7 | topology-runtime-v2 | `foundations/orchestrator.ts` | `handleRemoteDispatch` `.then()` 错误静默吞掉，远程命令永久挂起 |
| 8 | state-runtime | `foundations/createStateRuntime.ts` | `flushTimer` immediate 模式未清除已有 debounce timer |
| 9 | state-runtime | `foundations/createStateRuntime.ts` | `hydratePersistence` 无并发保护，重复 apply 状态 |
| 10 | state-runtime | `foundations/createStateRuntime.ts` | `store.subscribe` 中 `!persistenceDirty` 永远为 false，死代码 |
| 11 | runtime-shell-v2 | `foundations/runtimeCommandDispatcher.ts` | 超时后 `execution` Promise 仍修改 ledger，状态污染 |
| 12 | runtime-shell-v2 | `foundations/runtimeCommandDispatcher.ts` | `executionStack` 入栈用 `requestId`，出栈用 `commandId`，字段不匹配导致 stack 永久累积 |
| 13 | transport-runtime | `foundations/httpRuntime.ts` | `enforceRateLimit` 在 `acquireSlot` 之后执行，被限流请求仍消耗并发槽 |
| 14 | transport-runtime | `foundations/socketRuntime.ts` | `send` 静默丢弃消息但 `outboundMessageCount` 已 +1，指标失真 |
| 15 | transport-runtime | `foundations/socketRuntime.ts` | `onError` 后连接状态未更新为 `disconnected` |
| 16 | tdp-sync-runtime-v2 | `foundations/sessionConnectionRuntime.ts` | `void dispatchCommand` 错误静默丢失 |
| 17 | tdp-sync-runtime-v2 | `foundations/sessionConnectionRuntime.ts` | `sendHandshake` 在 connect resolve 后立即调用，socket 可能未 ready |
| 18 | workflow-runtime-v2 | `foundations/connectorRuntime.ts` | subscribe 竞态：`subscriptionId` 赋值前 `onMessage` 已触发，unsubscribe 传入空字符串 |
| 19 | workflow-runtime-v2 | `foundations/scriptRuntime.ts` | `functionCache` 无上限增长，内存泄漏 |
| 20 | definition-registry | `supports/resolve.ts` | `resolveErrorDefinitionByKey` 传入 `key` 与 `appError.key` 不一致时静默返回错误结果 |
| 21 | execution-runtime | `foundations/createExecutionRuntime.ts` | AppError 鸭子类型检测过于宽松，误判普通对象 |
| 22 | platform-ports | `foundations/logger.ts` | `maskValue` 递归无循环引用保护，栈溢出风险 |
| 23 | host-runtime | `foundations/createHostRuntime.ts` | `relay.markDisconnected()` 与 `markDropped()` 可能重复计数同一事件 |
| 24 | host-runtime | `foundations/faults.ts` | `remainingHits === 0` 边界：规则从未命中就被删除 |
| 25 | tcp-control-runtime-v2 | `features/actors/credentialActor.ts` | refresh 失败时 `credentialStatus` 停留在 `REFRESHING`，无法重试 |

---

## 详细分析

---

### contracts

#### `foundations/runtimeId.ts`

- **[MEDIUM]** ID 碰撞风险 (行 27)
  - `Math.random().toString(36).slice(2, 10)` 仅 8 位 base36（约 48 bit 熵），同一毫秒内高并发可能碰撞
  - 修复：使用 `crypto.getRandomValues()` 或增加随机字符长度至 16 位

#### `foundations/time.ts`

- **[MEDIUM]** 月份和日期未补零 (行 10)
  - `value.getMonth() + 1` 和 `value.getDate()` 直接拼接，个位数时输出 `2026-4-7`，与小时/分钟/秒的 `pad2` 处理不一致
  - 修复：对月份和日期同样使用 `pad2`

#### `foundations/validator.ts`

- **[MEDIUM]** `positiveFiniteNumber` 使用 `Number.MIN_VALUE` 作为最小值 (行 11)
  - `Number.MIN_VALUE` 是最小正浮点数（约 `5e-324`），语义上应为"大于0"，但与 `nonNegativeFiniteNumber` 边界极近，容易混淆
  - 修复：明确使用 `value > 0` 并加注释

#### `foundations/error.ts`

- **[LOW]** `createAppError` 不捕获调用栈，`stack` 字段从未赋值 (行 14-35)
  - 修复：考虑在创建时捕获 `new Error().stack`

#### `foundations/definition.ts`

- **[LOW]** `listDefinitions` 使用 `as` 强制转换绕过类型检查 (行 80)
  - 修复：约束泛型 `TDefinition extends Record<string, TValue>` 并返回 `TValue[]`

#### `types/topology.ts`

- **[LOW]** `NodeHelloAck.accepted=false` 时 `compatibility` 仍为必填，语义不清晰 (行 35-50)
  - 修复：使用判别联合类型区分接受/拒绝两种情况

#### `types/projection.ts`

- **[MEDIUM]** `RequestProjection.projectionId` 为可选字段，作为主键却可为 undefined (行 4)
  - 修复：明确何时可以没有 `projectionId`，若无合理场景则改为必填

#### `types/stateSync.ts`

- **[LOW]** `tombstone=true` 时 `value` 应为 `undefined`，但类型未通过判别联合强制约束 (行 12)
  - 修复：使用判别联合类型

#### `types/request.ts`

- **[LOW]** `RequestLifecycleSnapshot` 使用 `readonly` 数组但内部字段均可变，浅层只读无法防止内部状态被修改

---

### platform-ports

#### `foundations/logger.ts`

- **[HIGH]** `maskValue` 递归无循环引用保护，栈溢出风险 (行 32-50)
  - 若 `input.data` 中存在循环引用对象，递归调用会导致栈溢出
  - 修复：使用 `WeakSet` 追踪已访问对象

- **[MEDIUM]** `createLogEvent` 中 `maskedData` 强制转换为 `Record<string, unknown>` 不安全 (行 78)
  - 若运行时传入数组，转换后类型不安全
  - 修复：添加 `typeof maskedData === 'object' && !Array.isArray(maskedData)` 守卫

- **[MEDIUM]** `containsSensitiveRaw` 对字符串类型直接返回 `false`，不检测字符串内容 (行 17-19)
  - 若整个 `data` 就是 token 字符串，不会被检测
  - 修复：在文档中明确说明此函数只检测对象键名

- **[LOW]** `emit` 方法直接透传 `LogEvent`，绕过 masking 逻辑 (行 97-99)
  - 修复：在 `emit` 中也应用 masking，或明确标注为底层直通接口

- **[LOW]** `CreatePlatformPortsInput extends PlatformPorts` 是空扩展，增加不必要的间接层 (行 74)

#### `types/ports.ts`

- **[MEDIUM]** `ConnectorPort.subscribe` 返回 `Promise<string>`（订阅 ID），调用方若未保存 ID 无法取消订阅 (行 47-53)
  - 修复：考虑返回包含 `unsubscribe` 方法的对象，或提供 `AbortSignal` 参数

- **[LOW]** `StateStoragePort` 批量操作均为可选，缺少统一的降级封装

#### `foundations/createPlatformPorts.ts`

- **[LOW]** `Object.freeze` 只做浅冻结，port 对象内部属性仍可被修改 (行 6-8)

---

### definition-registry

#### `supports/resolve.ts`

- **[HIGH]** `resolveErrorDefinitionByKey` 传入 `key` 与 `appError.key` 不一致时静默返回错误结果 (行 163-192)
  - 调用方传入 `key='A'` 但 `appError.key='B'`，会静默返回 B 的解析结果
  - 修复：加断言 `input.appError.key === input.key`，或移除 `key` 参数改为直接从 `appError.key` 取值

- **[MEDIUM]** `decodeParameterValue` 中 `number` 类型解码不验证 NaN (行 83-85)
  - `Number("abc")` 返回 `NaN`，若 `validate` 未检查 NaN，会作为合法值存入
  - 修复：解码后加 `if (isNaN(result)) throw new Error(...)`

- **[MEDIUM]** `resolveErrorDefinitionByKey` 无 `appError` 时 `template` 可能为 `undefined`，传入 `renderErrorTemplate` 不安全 (行 180-190)
  - 修复：加空值保护 `message: template ? renderErrorTemplate(template) : ''`

- **[MEDIUM]** `resolveParameter` catch 块完全忽略异常，吞掉解码错误上下文 (行 130-137)
  - 修复：至少记录警告日志

- **[LOW]** `decodeBooleanParameterValue` 对 `null`/`undefined` 的错误信息不够友好 (行 72)

- **[LOW]** `registry.ts` `registerMany` 使用 `this.register`，解构调用时 `this` 丢失 (行 21-24)

- **[LOW]** `registry.ts` `snapshot()` 只做浅冻结，definition 对象内部字段仍可被修改 (行 43)

---

### execution-runtime

#### `foundations/createExecutionRuntime.ts`

- **[HIGH]** AppError 鸭子类型检测过于宽松 (行 45-47)
  - 仅检查 `'key' in error && 'message' in error`，任何含这两个字段的普通对象都被误判为 AppError
  - 修复：增加对 `code`、`category`、`severity` 等必要字段的检查，或引入 `isAppError` 类型守卫

- **[MEDIUM]** `execute` 中 handler 未找到时直接 `throw`，破坏 `ExecutionResult` 接口契约 (行 166-176)
  - 修复：改为返回 `{ status: 'failed', error: createAppError(...) }`

- **[MEDIUM]** `dispatchChild` 未透传 `options`，子命令的 `onLifecycleEvent` 回调不触发 (行 193-195)
  - 修复：改为 `dispatchChild: child => execute(child, options)`

- **[LOW]** `journal.ts` `records` 数组无上限，长期运行内存无限增长 (行 7)
  - 修复：增加最大容量限制（环形缓冲区）

- **[LOW]** `types/execution.ts` `ExecutionSuccessResult.result` 类型限定为 `Record<string, unknown>`，不包含 `void`/数组 (行 28)

---

### host-runtime

#### `foundations/sessions.ts`

- **[HIGH]** `detachConnection` 无条件覆盖 `pendingNodeIds`，丢失已有重连状态 (行 214-219)
  - 若 session 已处于 `resyncing` 状态（有多个 pending 节点），另一节点断开时 `pendingNodeIds` 被重置为只含刚断开的节点
  - 修复：合并而非覆盖：`pendingNodeIds: Array.from(new Set([...session.resume.pendingNodeIds, target.nodeId]))`

- **[MEDIUM]** `resolveStatus` 中 `nodes` 为空时 `every` 返回 `true`，错误判断为 `'closed'` (行 92-95)
  - 修复：加前置检查 `nodes.length > 0`

#### `foundations/relay.ts`

- **[HIGH]** `drain` 中 `queueBySession` 计数器更新错误 (行 153-158)
  - 多连接时只减去当前 connectionId 的 ready 条目数，`pendingCount` 可能出现负数或不准确
  - 修复：`drain` 后重新计算该 session 所有连接队列的总和

- **[MEDIUM]** `supports/sync.ts` `createSliceSyncDiff` 发送 tombstone 时使用 `remoteEntry.updatedAt`，对方收到后因时间戳相等不会更新 (行 122-126)
  - 修复：使用 `nowTimestampMs()` 或 `remoteEntry.updatedAt + 1` 作为 tombstone 时间戳

#### `foundations/faults.ts`

- **[HIGH]** `remainingHits` 初始为 `0` 时，第一次匹配就触发删除，规则从未真正命中就被消耗 (行 44-51)
  - 修复：在 `addRule` 时校验 `remainingHits >= 1`，或将条件改为 `rule.remainingHits != null && rule.remainingHits > 0`

- **[MEDIUM]** `matchHello` 中对 `hello-reject` 规则只取第一个，但仍对所有匹配规则调用 `consumeRule`，后续 reject 规则被消耗但不生效 (行 76-87)
  - 修复：明确文档说明"只有第一条 reject 规则生效"，或只消耗实际生效的规则

#### `foundations/createHostRuntime.ts`

- **[HIGH]** `relay.markDisconnected()` 与 `relay.markDropped()` 可能在同一次调用中都触发，重复计数同一事件 (行 465, 476)
  - 修复：明确两者是互斥还是可叠加，加注释或加互斥逻辑

- **[MEDIUM]** `expireIdleConnections` 使用 `.filter(Boolean) as any` 强制类型转换 (行 609)
  - 修复：使用类型谓词 `.filter((r): r is HostConnectionDetachResult => r != null)`

- **[MEDIUM]** `processHello` 中 `sessions.create` 与 `tickets.bindSession` 无原子性保证，异常时状态不一致 (行 355-371)
  - 修复：考虑将两者封装为原子操作，或在异常时清理已创建的 session

#### `foundations/ids.ts`

- **[LOW]** `Math.random()` 生成 token，约 60 bit 熵，安全敏感场景不够强 (行 8)
  - 修复：使用 `crypto.randomUUID()`

#### `foundations/observability.ts`

- **[LOW]** `events.shift()` 时间复杂度 O(n)，高频日志场景性能问题 (行 41-43)
  - 修复：使用循环缓冲区

#### `foundations/compatibility.ts`

- **[LOW]** `protocolVersion` 使用严格相等比较，无法处理向后兼容的小版本差异 (行 12)

---

### state-runtime

#### `foundations/createStateRuntime.ts`

- **[CRITICAL]** `flushPersistence` 竞态：`snapshot` 在链式 Promise 外捕获，链内写入的是旧快照 (行 303-408)
  - 若 flush1 失败，`persistenceChain` 无错误处理，链断裂后 flush2 仍执行
  - 修复：将 `exportEntries()` 移入 `.then()` 内部捕获最新状态，并添加 `.catch(() => {})` 防止链断裂

- **[HIGH]** `scheduleFlush('immediate')` 未清除已有 debounce timer，导致多余的 flush (行 416-418)
  - 修复：immediate 模式前先 `clearTimeout(flushTimer)`

- **[HIGH]** `store.subscribe` 中 `!persistenceDirty` 永远为 `false`（刚设为 `true`），条件判断是死代码 (行 577-578)
  - 修复：移除该条件，或重新审视设计意图

- **[HIGH]** `hydratePersistence` 无并发保护，并发调用时状态被重复 apply (行 476-548)
  - 修复：引入 `hydratePromise` 共享 Promise 防止重复执行

- **[MEDIUM]** `decodeEntry` 中 `JSON.parse` 无错误处理，非法 JSON 导致整个 hydrate 失败 (行 89-93)
  - 修复：用 try/catch 包裹，解析失败返回 `undefined`

- **[MEDIUM]** `cloneState` 使用 `JSON.parse(JSON.stringify(value))`，无法处理 `undefined`/`Date`/`Map`/循环引用 (行 85)
  - 修复：使用 `structuredClone(value)`

- **[MEDIUM]** `buildStatePatchFromSnapshot` 中 record 类型条目直接合并到 `slicePatch` 顶层，还原逻辑可能不正确 (行 233-239)
  - 修复：通过 `descriptor.setEntries` 反向操作还原，而非直接合并

#### `supports/sync.ts`

- **[MEDIUM]** `createSliceSyncDiff` tombstone 时间戳等于对方已知时间戳，对方收到后不会更新 (行 122-126)
  - 修复：使用 `nowTimestampMs()` 或 `remoteEntry.updatedAt + 1`

- **[MEDIUM]** `isSyncValueEnvelope` 类型守卫过于宽松，只检查 `updatedAt` 是否为 `number` (行 9-14)
  - 修复：根据完整结构添加更严格的检查

#### `supports/scopedSlice.ts`

- **[MEDIUM]** `isScopedValueRecord` 存在误判：普通对象的 key 恰好与 `scopeValues` 匹配时被误判为 scoped record (行 8-20)
  - 修复：通过包装类型（如 `{__scoped: true, values: {...}}`）明确区分

#### `supports/scope.ts`

- **[LOW]** `createScopedStateKey` 忽略 `scope.axis`，不同 axis 相同 value 会产生相同 key，导致命名冲突 (行 14-17)
  - 修复：将 axis 纳入 key 生成：`${baseKey}.${scope.axis}.${scope.value}`

- **[LOW]** `flushTimer` 类型 `ReturnType<typeof setTimeout>` 在 Node.js 和浏览器环境下不同，可能产生类型冲突 (行 116)

- **[LOW]** `toScopedSliceDescriptors` 中 `input.config.reducers[value]` 可能为 `undefined` (行 151)

---

### transport-runtime

#### `foundations/socketRuntime.ts`

- **[HIGH]** `send` 静默丢弃消息但 `outboundMessageCount` 已 +1，指标失真 (行 234-237)
  - `connection.transportConnection` 为 `undefined` 时 `?.sendRaw(...)` 静默忽略，但计数器已递增
  - 修复：仅在实际发送成功后才递增计数器，并向调用方返回失败结果

- **[HIGH]** `onError` 回调后连接状态未更新为 `disconnected` (行 206-213)
  - `onError` 触发时只调用 `finalizeMetric` 和 `emitEvent`，`state` 仍停留在 `'connected'`
  - 修复：在 `onError` 中同样调用 `setState(connection, 'disconnected')`

- **[MEDIUM]** `setState` 在 `resolved` 为 undefined 时每次生成不同 connectionId，监听方无法关联同一连接的多个事件 (行 59)
  - 修复：在 `ManagedSocketConnection` 中预先存储稳定的 connectionId

#### `foundations/httpRuntime.ts`

- **[HIGH]** `enforceRateLimit` 在 `acquireSlot` 之后执行，被限流请求仍消耗并发槽 (行 29-38)
  - 修复：将 `enforceRateLimit` 移到 `acquireSlot` 之前执行

- **[MEDIUM]** `shouldRetry` 默认返回 `true`，对所有错误（含 4xx）无差别重试 (行 184-189)
  - 修复：默认值改为 `false`，或默认只对网络错误/5xx 重试

- **[MEDIUM]** `replaceServers` 清空 `preferredAddressByServer`，但 `refreshServers` 不清空，旧偏好地址可能指向已不存在的地址 (行 325-329)
  - 修复：在 `refreshServers` 中也清理失效的偏好地址

#### `foundations/socketProfile.ts`

- **[MEDIUM]** `buildSocketUrl` 对无效 URL 不做保护，`new URL(joinedUrl)` 抛出未捕获的 `TypeError` (行 53-63)
  - 修复：用 try/catch 包裹并抛出 `createTransportConfigurationError`

#### `foundations/httpServiceFactory.ts`

- **[MEDIUM]** `callHttpEnvelope` 中 `envelope.error` 为 undefined 时 details 完全丢失，调试信息缺失 (行 157-163)
  - 修复：将完整的 `envelope` 作为 details 传入

#### `supports/errors.ts`

- **[LOW]** `normalizeTransportError` 对 AppError 的判断过于宽松，仅检查 `key` 和 `message` 字段 (行 74-76)
  - 修复：增加对 `category`、`severity` 等必要字段的检查

#### `foundations/socketProfile.ts`

- **[LOW]** `JsonSocketCodec.deserialize` 的 `catch (error) { throw error }` 是死代码 (行 72-75)
  - 修复：直接移除 try/catch，或改为抛出统一的 `createTransportParseError`

---

### runtime-shell-v2

#### `foundations/runtimeCommandDispatcher.ts`

- **[HIGH]** 超时后 `execution` Promise 仍在后台运行，resolve 后修改 ledger 状态，造成状态污染 (行 219-259)
  - 修复：引入 `cancelled` flag，在 `.then/.catch` 中 guard；或使用 `AbortController`

- **[HIGH]** `executionStack` 入栈存 `requestId`，出栈匹配 `commandId`，字段不匹配导致出栈失败，stack 永久累积，所有同名命令被误判为重入 (行 87-92)
  - 修复：统一入栈和出栈的匹配键

- **[MEDIUM]** `commandIntent.definition.timeoutMs` 为 undefined 时 `setTimeout(..., undefined)` 等同于 `setTimeout(..., 0)`，所有未配置 timeout 的命令立即超时 (行 228)
  - 修复：仅在 `timeoutMs` 有值时才创建 timeout Promise

- **[MEDIUM]** peer dispatch 时 `ledger.registerCommand` 被调用两次的潜在风险 (行 113, 162)
  - 修复：加注释说明两个分支互斥，或统一到分支前调用

#### `foundations/requestLedger.ts`

- **[MEDIUM]** `registerCommand` 初始状态设为 `'COMPLETED'` 而非 `'RUNNING'`，内部状态不一致 (行 148)
  - 修复：初始 status 应为 `'RUNNING'`

- **[MEDIUM]** `subscribeRequests` 注册时同步触发所有历史记录，可能阻塞调用栈 (行 361-365)
  - 修复：使用 `queueMicrotask` 异步触发历史回放

#### `foundations/runtimeStateSync.ts`

- **[LOW]** `applyStateSyncDiff` 跳过非对象 slice 时无日志警告，状态同步不完整难以排查 (行 18-21)
  - 修复：添加 warn 日志

#### `application/resolveModuleOrder.ts`

- **[MEDIUM]** 循环依赖错误信息只显示最后一个节点，不显示完整路径 (行 25-27)
  - 修复：在 DFS 中维护路径栈，输出完整路径如 `A -> B -> C -> A`

#### `foundations/runtimeParameterResolver.ts`

- **[LOW]** 无 definition 且无 catalogEntry 时返回 `undefined as TValue`，类型断言掩盖空值 (行 38-43)

#### `foundations/requestLedger.ts`

- **[LOW]** `applyRemoteCommandEvent` 手动构造 `AppError` 对象缺少必要字段 (行 263-273)
  - 修复：使用 `createAppError` 工厂函数统一构造

---

### tcp-control-runtime-v2

#### `features/actors/credentialActor.ts`

- **[HIGH]** refresh 失败时 `credentialStatus` 停留在 `'REFRESHING'`，外部无法判断是否可重试 (行 75-78)
  - 修复：在 catch 中调用 `setCredentialStatus('EMPTY')` 或新增 `'REFRESH_FAILED'` 状态

- **[MEDIUM]** `refreshExpiresAt` 未从服务端更新，可能造成过期判断错误 (行 56)
  - 修复：若服务端不返回新的 `refreshExpiresIn`，在文档中明确说明

#### `features/actors/activationActor.ts`

- **[MEDIUM]** `expiresAt` 和 `refreshExpiresAt` 使用 `as any` 强转，绕过 `TimestampMs` 类型检查 (行 60, 63)
  - 修复：使用 `Math.round()` 并确保类型正确

- **[MEDIUM]** 激活成功后未显式更新 `activationStatus` 为 `'ACTIVATED'`，依赖 `setActivatedIdentity` 内部隐式行为 (行 65-83)
  - 修复：在成功路径中显式调用 `setActivationStatus('ACTIVATED')`

#### `features/actors/bootstrapActor.ts`

- **[MEDIUM]** 硬编码字符串拼接访问 Redux state，与 `stateKeys` 常量脱节 (行 21)
  - 修复：使用对应 selector 访问状态

#### `features/slices/tcpCredential.ts`

- **[MEDIUM]** `setCredential` 中 `refreshToken` 为 `undefined` 时不更新，无法主动清除 `refreshToken`，语义不清晰 (行 28-30)
  - 修复：添加注释说明设计意图，或提供 `clearRefreshToken` 专用 action

- **[LOW]** `expiresAt`/`refreshExpiresAt`/`updatedAt` 使用 `as any` 绕过 `TimestampMs` 类型约束 (行 31-35)

#### `foundations/httpService.ts`

- **[LOW]** `TcpPlatformEnvelope` 的 `success` 字段未被显式校验，依赖底层实现

---

### tdp-sync-runtime-v2

#### `foundations/sessionConnectionRuntime.ts`

- **[HIGH]** `void dispatchCommand(...)` 使用 `void` 忽略 Promise，错误静默丢失 (行 266)
  - 修复：改为 `.catch(err => logger.error(err))`

- **[HIGH]** `sendHandshake` 在 `connect` resolve 后立即调用，socket 可能尚未 ready (行 200-201)
  - 修复：在 `onConnected` 事件回调中发送握手，而非 connect Promise resolve 后立即发送

- **[MEDIUM]** `lastConnectionStartResult` 共享变量存在竞态，并发调用时后一次覆盖前一次结果 (行 176, 212)
  - 修复：将结果作为局部变量在 `performSocketConnection` 中返回

- **[MEDIUM]** 重连时未检查 `accessToken` 是否过期，可能使用已过期 token 建立连接 (行 183-188)
  - 修复：连接前检查 `expiresAt`，若已过期先触发 credential refresh

#### `features/slices/tdpSync.ts`

- **[MEDIUM]** `resetRuntimeState` 未重置 `lastAppliedCursor`，重连后 applied cursor 与实际状态不一致 (行 34-39)
  - 修复：加入 `state.lastAppliedCursor = undefined`

- **[LOW]** `bootstrapResetRuntime` 同样未重置 `lastAppliedCursor` (行 43-48)

#### `features/slices/tdpCommandInbox.ts`

- **[MEDIUM]** `orderedIds` 使用 `unshift` 不断前插，无上限，长时间运行内存泄漏 (行 17-20)
  - 修复：设置最大容量（如 1000 条），超出时移除末尾旧条目

#### `features/actors/commandAckActor.ts`

- **[MEDIUM]** `lastCursor` 为 `undefined` 时默认 `0`，重连后服务端重发大量历史数据 (行 17)
  - 修复：若 `lastCursor` 为 `undefined`，跳过 ack 或记录警告

- **[MEDIUM]** `context.command.payload.payload.instanceId` 双层 `payload` 访问，结构变更时静默返回 `undefined` (行 24)

#### `features/actors/cursorFeedbackActor.ts`

- **[MEDIUM]** `dispatchCursorFeedback` 与 `commandAckActor` 可能对同一 cursor 发送重复 ack (行 14-21)
  - 修复：明确两个 actor 的职责边界，或在 `sessionConnectionActor` 中做去重

#### `foundations/topicChangePublisher.ts`

- **[MEDIUM]** `toTopicFingerprint` 使用 `JSON.stringify` 比较 payload，对象属性顺序不稳定，误判数据变更 (行 29)
  - 修复：使用稳定序列化库（如 `fast-json-stable-stringify`）

- **[LOW]** `fingerprintRef.resolvedByTopic` 无清理机制，已删除 topic 的条目永久残留 (行 122-123)

#### `features/actors/bootstrapActor.ts`

- **[MEDIUM]** 硬编码字符串拼接访问 Redux state (行 21)
  - 修复：使用 `selectTdpSyncState(context.getState())?.lastCursor`

---

### topology-runtime-v2

#### `foundations/orchestrator.ts`

- **[CRITICAL]** `waitForRemoteStarted`/`waitForRemoteResult` 使用忙等轮询，`pollIntervalMs` 极小时 CPU 100% 占用，超时后未清理 mirrored command (行 322-372)
  - 修复：使用 Promise + setTimeout 实现非阻塞等待；超时后调用清理接口注销 mirrored command

- **[HIGH]** `handleRemoteDispatch` 的 `.then()` 中 `send()` 抛出异常时错误被吞掉，对端永远收不到 `command-event`，远程命令永久挂起 (行 448-478)
  - 修复：添加 `.catch()` 处理，或将 `.then()` 改为 `await` + try/catch

- **[HIGH]** `stateUnsubscribe` 在 `stopConnection`/`restartConnection` 时未被调用，状态订阅持续存在，内存泄漏 (行 597, 749-760)
  - 修复：在 `stopConnection` 中调用 `stateUnsubscribe?.()` 并置为 `undefined`

- **[HIGH]** `listenersAttached` 重连时不重置，新连接的事件监听器不再注册 (行 593-614)
  - 修复：在 `stopConnection` 中将 `listenersAttached` 重置为 `false`

- **[MEDIUM]** `resolveAuthoritativeDirection` 与 `resolveSyncDirection` 语义相反但命名相似，极易混淆导致同步方向错误 (行 84-98)
  - 修复：添加详细注释，或统一命名约定

- **[MEDIUM]** `createPeerRuntimeInfoFromNodeId` 无法获取真实 peer 信息时用本地 `platform`/`product` 填充，可能导致能力协商错误 (行 152-173)
  - 修复：对无法确定的字段使用 `'unknown'`

- **[MEDIUM]** `beginResume` 在 `sessionId` 不存在时静默返回，无日志，难以排查 (行 282-284)
  - 修复：添加 warn 日志

#### `foundations/orchestratorIncoming.ts`

- **[MEDIUM]** `handleHelloAck` 在检查 `accepted` 之前就调用 `setSessionId`，`accepted=false` 时 sessionId 被设为无效值 (行 45-46)
  - 修复：将 `setSessionId` 调用移至 `accepted` 检查通过后

- **[MEDIUM]** `handleStateSyncSummary` diff 为空时直接进入 continuous 模式，未验证 session 是否已通过 `begin()` 初始化 (行 135-148)

#### `foundations/syncSession.ts`

- **[MEDIUM]** `sessions` Map 只增不减，断开重连后历史 session 永远不被清除，内存泄漏 (行 33)
  - 修复：添加 `remove(sessionId)` 方法，在连接断开时清理

- **[LOW]** `collectContinuousDiff` 中 `startedAt: current?.startedAt ?? 0`，session 不存在时 `startedAt` 为 0（Unix 纪元），时间统计完全错误 (行 93)

#### `features/actors/contextActor.ts`

- **[MEDIUM]** 多个 command handler 均无 `return` 语句，返回 `undefined` (行 26-54)
  - 修复：统一添加 `return {}`

- **[LOW]** `buildContextState` 中 `recoveryState ?? {}` 传入空对象，需确认 `createTopologyContextState` 对空输入的处理

#### `features/actors/initializeActor.ts`

- **[MEDIUM]** `.catch(() => {})` 完全吞掉自动连接失败的错误，无任何日志 (行 47-54)
  - 修复：`.catch(err => logger.warn('auto-connect failed', err))`

---

### workflow-runtime-v2

#### `foundations/scriptRuntime.ts`

- **[HIGH]** `functionCache` 是模块级全局 Map，永不清理，内存泄漏 (行 11)
  - 修复：使用 LRU Cache 限制最大条目数

- **[MEDIUM]** `cacheKey` 构造存在碰撞风险，source 含 `|` 或 argumentNames 含 `,` 时不同组合产生相同 key (行 65)
  - 修复：对 source 和 argumentNames 分别 JSON 序列化后再拼接

- **[MEDIUM]** 超时机制无法中断正在执行的同步脚本（死循环/长时间计算），`setTimeout` 在 JS 线程阻塞时不触发 (行 74-114)
  - 修复：对不可信脚本使用 Worker 线程隔离执行

- **[LOW]** `getContextGlobals` 展开 `stepOutputs` 的 key 直接注入全局作用域，若 stepKey 与保留字同名会静默覆盖 (行 13-24)

#### `foundations/connectorRuntime.ts`

- **[HIGH]** `executeExternalSubscribe` 竞态：`subscriptionId` 赋值前 `onMessage`/`onError` 已触发，`unsubscribe('')` 传入空字符串，资源泄漏 (行 67-128)
  - 修复：在 `subscribe` 返回 id 之后再注册 `onMessage`/`onError`

- **[MEDIUM]** `executeExternalOn` 中 `connector.on` 返回 `undefined` 时超时后无法注销监听器 (行 158-187)
  - 修复：要求 connector 接口强制返回 off 函数，或注册前检查

#### `foundations/engineExecutor.ts`

- **[MEDIUM]** 补偿步骤失败时仍使用原始步骤的 `errorView`，掩盖补偿步骤的真实错误 (行 266-283)

- **[LOW]** `toAppError` AppError 判断过于宽松，仅检查 `key` 和 `message` 字段 (行 64-76)

#### `foundations/engine.ts`

- **[MEDIUM]** `enqueue` 抛出异常时 `run$` 无 try/catch，subscriber 不会收到 error 通知，`run.subject` 悬挂 (行 256-261)
  - 修复：在 Observable 工厂函数中用 try/catch 包裹 `enqueue`

#### `foundations/engineObservation.ts`

- **[LOW]** `toParameterNumber` 要求 `raw > 0`，但 `completedObservationLimit` 合法值包含 0，配置为 0 时被忽略并使用默认值 100 (行 109-118)
  - 修复：将判断改为 `raw >= 0`

#### `features/slices/workflowDefinitions.ts`

- **[MEDIUM]** `removeDefinition` 无 `definitionId` 时 filter 计算是无用功，代码意图不清晰，容易误读为 bug (行 53-73)
  - 修复：将无 `definitionId` 时的逻辑提前 return

---

### ui-runtime-v2

#### `selectors/index.ts`

- **[MEDIUM]** `sharedRegistry` 是模块级单例，多实例或测试场景下状态污染 (行 22)
  - 修复：通过依赖注入传入 registry，或提供 `resetRegistry()` 方法供测试使用

#### `foundations/screenRegistry.ts`

- **[LOW]** `registerMany` 使用 `this.register`，解构调用时 `this` 丢失 (行 21-24)
  - 修复：使用箭头函数定义方法，或直接调用内部函数引用

#### `features/slices/overlayState.ts`

- **[LOW]** `applyOverlaySnapshot` 中 `as SyncValueEnvelope<UiOverlayEntry[]>` 直接 cast，未校验 `value` 是否为数组 (行 110-111)
  - 修复：赋值前校验 `incoming.value` 是否为数组

#### `features/actors/overlayRuntimeActor.ts`

- **[LOW]** `clearOverlays` 中 `getDisplayMode(context)` 在 dispatch action 后被调用两次，第二次可能读到已变更的状态 (行 60-67)
  - 修复：在 dispatch 前缓存 `displayMode` 变量

---

## 附录：跨包共性问题

以下问题在多个包中重复出现，建议统一修复：

1. **AppError 鸭子类型检测过于宽松**（execution-runtime、workflow-runtime-v2、transport-runtime）
   - 统一引入 `isAppError(error)` 类型守卫函数

2. **`Math.random()` 用于 ID/Token 生成**（contracts、host-runtime）
   - 统一使用 `crypto.randomUUID()` 或 `crypto.getRandomValues()`

3. **硬编码字符串拼接访问 Redux state**（tcp-control-runtime-v2、tdp-sync-runtime-v2）
   - 统一使用对应 selector 函数

4. **`as any` 绕过 `TimestampMs` 类型约束**（tcp-control-runtime-v2）
   - 统一 `TimestampMs = number` 类型别名，消除所有 `as any`

5. **`registerMany` 中 `this` 上下文丢失风险**（definition-registry、ui-runtime-v2）
   - 统一改为箭头函数属性或直接调用内部函数引用

