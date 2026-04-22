# 1-kernel/1.1-base 测试覆盖建议报告

**日期：** 2026-04-14  
**范围：** `1-kernel/1.1-base` 下全部 13 个包  
**方法：** 扫描已修复代码 + 分析现有测试 spec，识别缺失测试场景

---

## 优先级说明

| 优先级 | 含义 |
|--------|------|
| HIGH | 核心逻辑/错误路径，缺失会导致回归风险 |
| MEDIUM | 边界条件/配置路径，缺失会降低信心 |
| LOW | 防御性检查/文档化行为，缺失影响可维护性 |

---

## 修复状态汇总

| 包名 | 修复状态 | 遗留问题 |
|------|----------|----------|
| contracts | 已修复 | 无 |
| platform-ports | 已修复 | 数组 data 被丢弃行为未文档化 |
| definition-registry | 已修复 | 无 |
| execution-runtime | 已修复 | handler 未找到时 throw 而非返回 failed result（有意设计） |
| host-runtime | 已修复 | rebindConnection 后 session count 依赖隐式一致性 |
| state-runtime | 已修复 | immediate flush 错误静默；record 类型恢复逻辑依赖扁平结构 |
| transport-runtime | 已修复 | 无 |
| runtime-shell-v2 | 已修复 | TIMEOUT 掩盖 FAILED；重复 commandId 注册不重置状态 |
| tcp-control-runtime-v2 | 已修复 | `expiresAt` 仍有 `as any`；refresh 失败后 status=EMPTY 可能误导消费方 |
| tdp-sync-runtime-v2 | 已修复 | 无 |
| topology-runtime-v2 | 已修复 | 无 |
| workflow-runtime-v2 | 已修复 | cancel 无法中断 active step；subscribe 后 settle 前 unsubscribe 泄漏 |
| ui-runtime-v2 | 部分修复 | slave-to-master 重连未覆盖 |

---

## 详细测试场景建议

---

### contracts

**现有覆盖：** runtime id 格式/唯一性、`formatTimestampMs`、`createAppError` 模板渲染、基础 validator 边界

#### 缺失场景

- **[HIGH]** `renderErrorTemplate` 独立单元测试
  - 目的：验证模板替换、缺失 key 返回空字符串、多占位符、无 args 时的行为
  - 关键断言：`renderErrorTemplate('hello ${name}', {name:'world'})` === `'hello world'`；`renderErrorTemplate('${x}', undefined)` === `''`

- **[HIGH]** `isAppError` 对非法值的守卫
  - 目的：确保 null、string、缺字段对象均返回 false
  - 关键断言：`isAppError(null)` === false；`isAppError({key:'k'})` === false

- **[MEDIUM]** `finiteNumberAtLeast` / `nonNegativeFiniteNumber` 边界
  - 目的：验证 `Infinity`、`NaN`、负数、0 的行为
  - 关键断言：`nonNegativeFiniteNumber(0)` === true；`nonNegativeFiniteNumber(Infinity)` === false

- **[MEDIUM]** `createRuntimeId` 降级路径（无 `crypto.randomUUID`）
  - 目的：在 `crypto` 不可用时仍能生成合法 id
  - 关键断言：id 仍匹配 `^run_[a-z0-9]+_[a-z0-9]+$`

- **[LOW]** `createAppError` 不传 `code` 时 fallback 到 `key`
  - 关键断言：`appError.code === appError.key`

---

### platform-ports

**现有覆盖：** PROD 模式敏感字段 mask、循环引用保护、`createPlatformPorts` 注入

#### 缺失场景

- **[HIGH]** DEV/TEST 模式下敏感字段不被 mask
  - 目的：验证非 PROD 环境 `maskingMode === 'raw'`，token 值原样输出
  - 关键断言：`events[0].data.token === 'secret-token'`；`maskingMode === 'raw'`

- **[HIGH]** `data` 为数组时的行为（被丢弃或保留）
  - 目的：明确数组 data 的行为是设计意图还是遗漏，文档化
  - 关键断言：`events[0].data === undefined`（若是设计意图）

- **[MEDIUM]** `scope()` 和 `withContext()` 链式调用后事件字段正确合并
  - 目的：验证 scope binding 和 context merge 在嵌套调用时正确叠加
  - 关键断言：`event.scope` 包含父子合并字段；`event.context` 包含 withContext 传入的值

- **[MEDIUM]** `emit()` 直接写入原始 LogEvent（绕过 createLogEvent）
  - 目的：验证 `emit` 不做任何转换，原样传给 `write`
  - 关键断言：`events[0] === originalEvent`（引用相等）

- **[MEDIUM]** 嵌套对象中敏感字段被递归 mask
  - 目的：`{user: {password: 'x'}}` 中深层字段也被 mask
  - 关键断言：`events[0].data.user.password === '[MASKED]'`

- **[LOW]** `containsSensitiveRaw` 对数组中含敏感对象的检测
  - 关键断言：`[{token: 'x'}]` 触发 `containsSensitiveRaw === true`

---

### definition-registry

**现有覆盖：** `resolveAppError` 两种 source、`resolveParameter` number/boolean 全路径、`resolveErrorDefinitionByKey` key 不匹配抛出

#### 缺失场景

- **[HIGH]** `resolveParameter` json 类型解码
  - 目的：验证 string rawValue 被 `JSON.parse`，对象 rawValue 直接透传
  - 关键断言：`value` 深等于原始对象；非法 JSON string 触发 fallback

- **[HIGH]** `resolveParameter` 无 catalog 时返回 default
  - 目的：验证 `source === 'default'`，`valid === true`
  - 关键断言：`result.source === 'default'`；`result.value === definition.defaultValue`

- **[HIGH]** `createKeyedDefinitionRegistry` 重复注册抛出
  - 目的：验证 `register` 同 key 两次抛出含 kind 的错误信息
  - 关键断言：`expect(() => registry.register(same)).toThrow(/duplicated definition key/)`

- **[MEDIUM]** `resolveErrorDefinitionByKey` 无 appError 且有 catalog override
  - 目的：验证 `source === 'catalog'`，template 来自 catalog
  - 关键断言：`result.source === 'catalog'`

- **[MEDIUM]** `resolveParameter` 自定义 `decode` 函数路径
  - 目的：验证 definition 提供 `decode` 时跳过内置类型解码
  - 关键断言：`decode` 被调用，返回值作为 `value`

- **[MEDIUM]** `createDefinitionResolverBundle` 的 `resolveParameterByKey`
  - 目的：验证 bundle 方法正确代理到 registry + catalog
  - 关键断言：key 不存在时抛出；存在时返回正确 value

- **[LOW]** `registry.list()` 和 `registry.snapshot()` 返回正确内容
  - 关键断言：`list()` 长度与注册数一致；`snapshot()` 是 frozen 对象

---

### execution-runtime

**现有覆盖：** lifecycle 顺序、middleware 嵌套/重入、child dispatch、AppError 归一化、`commandNotFound` throw

#### 缺失场景

- **[HIGH]** 重复注册同名 handler 抛出
  - 目的：验证 `registerHandler` 同名两次抛出 `Duplicated handler`
  - 关键断言：`expect(() => runtime.registerHandler('x', h)).toThrow(/Duplicated handler/)`

- **[HIGH]** child dispatch 失败时父 handler 的错误传播
  - 目的：child 抛出时父 handler 收到 failed result，父命令也以 failed 结束
  - 关键断言：`result.status === 'failed'`；journal 包含 child:failed 和 parent:failed

- **[MEDIUM]** middleware 本身抛出时归一化为 failed result
  - 目的：middleware（非 handler）抛出时，外层 try/catch 捕获并返回 failed
  - 关键断言：`result.status === 'failed'`；`result.error.key === commandExecutionFailed.key`

- **[MEDIUM]** `normalizeError` 对非 Error 对象（字符串、数字）的处理
  - 目的：handler 抛出非 Error 值时，details 字段正确记录原始值
  - 关键断言：`result.error.details.error` 等于原始抛出值

- **[LOW]** `createExecutionJournal` 独立单元测试
  - 目的：验证 `append` 后 `list()` 返回正确顺序的事件
  - 关键断言：多次 append 后 `list()` 长度和顺序正确

---

### host-runtime

**现有覆盖：** 双向 hello/session 建立、capability 拒绝、断连重连 resume、多节点 pendingNodeIds、heartbeat 超时驱逐、fault rule 基础触发、relay drain pending count

#### 缺失场景

- **[HIGH]** relay-delay fault rule 延迟投递后 `availableAt` 生效
  - 目的：验证 `matchRelay` 返回 `delayMs` 后，drain 在时间未到时不返回该条目
  - 关键断言：`drain(connectionId, now)` 在 `now < availableAt` 时长度为 0，`now >= availableAt` 时长度为 1

- **[HIGH]** relay-drop fault rule 丢弃当前 relay
  - 目的：验证 `dropCurrentRelay=true` 时 relay 不进入队列
  - 关键断言：`relayResult.deliveries` 长度为 0，`relayPendingCount` 不增加

- **[HIGH]** relay-disconnect-target fault rule 触发断连
  - 目的：验证 `disconnectTarget=true` 时目标节点连接被断开，session 进入 `resume-required`
  - 关键断言：`result.disconnectTarget === true`，session status 变为 `resume-required`

- **[HIGH]** hello-delay fault rule 延迟 hello 处理
  - 目的：验证 `matchHello` 返回 `delayMs` 时调用方能读取到延迟值，规则被消费后移除
  - 关键断言：`matchResult.delayMs` 等于规则设定值

- **[MEDIUM]** `replaceRules` 完整替换规则列表
  - 目的：验证 `replaceRules` 后旧规则不再生效，新规则立即生效
  - 关键断言：旧 ruleId 不在 `list()` 中，新规则 match 正常

- **[MEDIUM]** 同一 session 多条 fault rule 叠加时取最大 delayMs
  - 目的：验证多条 `relay-delay` 规则同时匹配时 `result.delayMs` 取最大值
  - 关键断言：`result.delayMs === Math.max(rule1.delayMs, rule2.delayMs)`

- **[MEDIUM]** `updateHello` 为已有 session 新增第三个节点
  - 目的：验证 `updateHello` 对新 nodeId 走 else 分支正确创建节点记录
  - 关键断言：`session.nodes` 包含新 nodeId，`lastHelloAt` 正确

- **[MEDIUM]** `degraded` compatibility level 使 session status 变为 `degraded`
  - 目的：验证 `resolveStatus` 中 `degraded` 分支
  - 关键断言：`updateHello` 传入 `compatibility.level === 'degraded'` 后 `session.status === 'degraded'`

- **[LOW]** `markHeartbeat` 对不存在的 connectionId 返回 undefined 且不抛出

- **[LOW]** `getByToken` 在 session 不存在时返回 undefined

---

### state-runtime

**现有覆盖：** Redux store 注册、field/record 持久化写入恢复、protected 路由、sync diff/summary/tombstone、scoped key 生成、workspace 隔离

#### 缺失场景

- **[HIGH]** `persistenceDebounceMs` 防抖：多次变更只触发一次 flush
  - 目的：验证 debounced flush 模式下 timer 被正确设置
  - 关键断言：使用 `vi.useFakeTimers`，debounce 窗口内多次 dispatch，`flushPersistence` 只被调用一次

- **[HIGH]** `flushMode: 'immediate'` 的 field 变更立即触发 flush
  - 目的：验证 `collectPersistenceModes` 返回 `immediate` 时 `scheduleFlush('immediate')` 被调用
  - 关键断言：dispatch 后无需等待 timer，storage 中立即有新值

- **[HIGH]** hydrate 前 store 变更不触发 flush（`hydrated=false` 守卫）
  - 目的：防止 hydrate 完成前的初始化 dispatch 触发错误的持久化
  - 关键断言：在 `hydratePersistence()` 调用前 dispatch，storage 中无写入

- **[HIGH]** record 类型持久化恢复（hydrate 后 state 正确重建）
  - 目的：验证 manifest + 各 entry key 能被正确读回并还原为 slice state
  - 关键断言：hydrate 后 `runtime.getState()[sliceName]` 包含所有原始 record 条目

- **[HIGH]** protected record 类型路由到 `secureStateStorage`
  - 目的：验证 `protection: 'protected'` 的 record descriptor 的 manifest 和 entry 都写入 secure storage
  - 关键断言：`plain.saved.size === 0`，`secure.saved` 包含 manifest key 和 entry key

- **[MEDIUM]** `exportPersistedState` 是纯读操作，不含 storage 副作用
  - 关键断言：调用后 `storage.saved` 不变，返回值包含正确的 entries

- **[MEDIUM]** `applyPersistedState` 直接应用快照并清除 dirty flag
  - 关键断言：dispatch 后 state 更新，后续 flush 不写 storage

- **[MEDIUM]** `shouldPersist` 回调控制 field 是否写入 storage
  - 关键断言：`shouldPersist` 返回 false 时该 field 不被持久化

- **[MEDIUM]** `allowPersistence: false` 时 flush 和 hydrate 均为空操作
  - 关键断言：`flushPersistence()` 返回 `{entries: []}`，storage 无写入

- **[MEDIUM]** `createSliceSyncDiff` 对本地有 tombstone 的条目正确传播
  - 关键断言：diff 包含该 key，value 为 tombstone

- **[LOW]** 并发 `hydratePersistence` 调用只执行一次（`hydratePromise` 去重）
  - 关键断言：两次并发调用后 storage.getItem 只被调用一次

---

### runtime-shell-v2

**现有覆盖：** 多 actor 广播聚合、重入检测、actor 超时、peer gateway 路由、`initialize` 命令、远端命令事件、request lifecycle snapshot 导入、parameter decode/validate

#### 缺失场景

- **[HIGH]** `applyRemoteCommandEvent` 处理 `accepted` 事件后 command 仍为 RUNNING
  - 目的：验证修复后 accepted 事件不会提前终结 command
  - 关键断言：`applyRemoteCommandEvent({eventType: 'accepted'})` 后 command status 仍为 `RUNNING`，`completedAt` 为 undefined

- **[HIGH]** `applyRemoteCommandEvent` 处理 `failed` 事件，error 字段正确映射
  - 目的：验证远端失败事件的 error 被正确转换为 `AppError` 结构
  - 关键断言：`actorResults[0].error.key === envelope.error.key`，status 为 `FAILED`

- **[HIGH]** `toRequestStatus` TIMEOUT + FAILED 混合场景
  - 目的：确认当前行为（TIMEOUT 掩盖 FAILED）是预期设计
  - 关键断言：`request.status === 'TIMEOUT'`，同时 `request.commands` 中包含 FAILED 命令

- **[HIGH]** `subscribeRequest` 在 request 已存在时立即回调当前状态
  - 目的：验证 late subscriber 能立即收到当前快照
  - 关键断言：注册 subscriber 后立即收到一次回调，status 与当前 request 一致

- **[MEDIUM]** `applyRemoteCommandEvent` 处理 `started` 事件更新 actor startedAt
  - 关键断言：`actorResults` 长度不变，`startedAt` 被更新

- **[MEDIUM]** `subscribeRequests` 注册时回放所有已有 records
  - 关键断言：注册前已有 N 个 request，注册后立即收到 N 次回调

- **[MEDIUM]** `registerMirroredCommand` 对重复 commandId 幂等（不重复添加）
  - 关键断言：两次注册同一 commandId 后，`queryRequest.commands` 长度为 1

- **[MEDIUM]** `applyRequestLifecycleSnapshot` 处理 `error` 状态的 command
  - 关键断言：`queryRequest.commands[0].status === 'FAILED'`

- **[LOW]** `markActorStarted` 对同一 actorKey 幂等
  - 关键断言：两次调用后 `actorResults` 长度为 1

- **[LOW]** `getRecord`/`getCommandRecord` 对不存在的 id 抛出明确错误
  - 关键断言：错误信息包含 requestId/commandId 便于调试

---

### transport-runtime

**现有覆盖：** failover/preferred address 记忆、`replaceServers` 回滚、service-first 调用模式、envelope 错误映射、path 参数缺失、socket 完整生命周期、socket error 状态

#### 缺失场景

- **[HIGH]** `maxConcurrent` 并发限制队列行为
  - 目的：验证超出 `maxConcurrent` 的请求进入队列，前一个完成后才释放
  - 关键断言：同时发起 N+1 个请求时，第 N+1 个在前 N 个完成前不执行；`activeCount` 不超过上限

- **[HIGH]** `rateLimitWindowMs` + `rateLimitMaxRequests` 速率限制触发
  - 目的：在窗口内超出请求数时抛出 rate limit 错误
  - 关键断言：抛出包含 `windowMs`/`maxRequests` 的 transport network error；窗口滑出后可继续请求

- **[HIGH]** `shouldRetry` 返回 false 时立即终止不再尝试后续地址
  - 目的：验证 `shouldRetry(error, request) === false` 时直接 throw，不继续 failover
  - 关键断言：`calls` 数组长度为 1；错误为 `httpRuntimeFailed`

- **[MEDIUM]** `failoverStrategy: 'single-address'` 只尝试首个地址
  - 关键断言：`calls` 只包含 `primary`；失败后不切换

- **[MEDIUM]** `serverProvider` 动态提供 server 列表
  - 目的：验证 `serverProvider?.()` 路径在每次 call 时被调用
  - 关键断言：`serverProvider` 被调用；请求使用动态返回的地址

- **[MEDIUM]** `metricsRecorder.recordCall` 在成功和失败时均被调用
  - 关键断言：成功时 `success: true`，失败时 `success: false`，`attempts` 长度与实际尝试次数一致

- **[LOW]** socket `replaceServers` 后重连使用新地址
  - 关键断言：重连后 `selectedAddress` 来自新 server 列表

---

### tdp-sync-runtime-v2

**现有覆盖：** bootstrap 初始化、scope 优先级、topic 变更发布、系统 catalog 桥接、projection 持久化恢复、远程命令 ACK、握手时序、live 重连

#### 缺失场景

- **[HIGH]** `SESSION_READY` 消息触发 `resetReconnectAttempt`
  - 目的：验证收到 `SESSION_READY` 后重连计数归零
  - 关键断言：模拟断线重连后收到 `SESSION_READY`，再次断线时重连计数从 0 开始

- **[HIGH]** 缺少 terminalId/accessToken 时 `connectTdpSession` 抛出 `credentialMissing` 错误
  - 目的：验证未激活状态下发起连接的错误路径
  - 关键断言：result.status 为 `FAILED`；error.key 为 `credentialMissing`

- **[HIGH]** `getReconnectAttempts` 优先级：parameter catalog override > input.socket > PROD 默认值
  - 关键断言：注入 parameter catalog 后重连次数使用 override 值；PROD 模式下默认 -1

- **[MEDIUM]** `publishTopicDataChangesV2` fingerprint 去重：相同内容不重复 dispatch
  - 目的：验证 fingerprint 相同时不触发 `tdpTopicDataChanged` command
  - 关键断言：两次相同 projection 状态下 `changedTopicCount === 0`

- **[MEDIUM]** `toChangeItems` 正确生成 delete 操作（item 从 current 消失）
  - 目的：验证 previous 有、current 无时生成 `operation: 'delete'` 的 change item
  - 关键断言：changes 包含 `{operation: 'delete', itemKey: '...', revision: previousEntry.revision}`

- **[MEDIUM]** `sendStateReport` 在 `tdpChangesLoaded` 后发送正确的 `lastAppliedCursor`
  - 关键断言：`STATE_REPORT.data.lastAppliedCursor` 等于 `nextCursor`

- **[LOW]** `resolveReconnectDelayMs` 优先级：input.socket > parameter catalog > default

---

### topology-runtime-v2

**现有覆盖：** topology context 投影、peer dispatch 路由、rejected hello-ack、slave precheck、远程 command event、live 双节点握手、projection mirror、`dispatchPeerCommand`

#### 缺失场景

- **[HIGH]** `syncSession` 完整状态流转：begin → acceptRemoteSummary → activateContinuous → collectContinuousDiff → commitContinuous
  - 目的：验证 sync session 各阶段状态字段的正确性
  - 关键断言：`begin` 后 status 为 `awaiting-diff`；`activateContinuous` 后 status 为 `continuous` 且 `baselineSummaryBySlice` 非空；`commitContinuous` 后 `baselineSummaryBySlice` 更新

- **[HIGH]** `maybeSendContinuousSyncDiff` 去重：相同 diff signature 不重复发送
  - 目的：验证 `lastContinuousDiffSignature` 防止重复发送相同 diff
  - 关键断言：state 未变化时 send 不被调用第二次；state 变化后 send 被调用

- **[HIGH]** `stopConnection` 后 `listenersAttached` 重置，重新 `startConnection` 可再次 attach listeners
  - 目的：验证 stop → start 循环不会因 `listenersAttached = true` 导致事件监听丢失
  - 关键断言：stop 后 `listenersAttached` 为 false；再次 start 后 connected 事件正常触发

- **[HIGH]** `sendResumeArtifacts` 在重连后发送 state-sync-summary 和 request-lifecycle-snapshot
  - 目的：验证断线重连后 resume 流程完整性
  - 关键断言：`beginResume` 调用后 send 包含 `resume-begin`、`state-sync-summary`、`resume-complete` 消息；`resumeStatus` 变为 `completed`

- **[MEDIUM]** `handleHelloAck` accepted=false 时 sessionId 不被写入
  - 目的：验证修复后 rejected hello-ack 不污染 sessionId
  - 关键断言：`activeSessionId` 仍为 undefined

- **[MEDIUM]** `commitContinuous` 对不存在的 session 返回 undefined
  - 关键断言：`syncSessions.commitContinuous('nonexistent', ...)` 返回 `undefined`

- **[MEDIUM]** live：state-sync-diff 通过真实 relay 传递，slave 应用 diff 后状态与 master 一致
  - 目的：验证 continuous sync 的端到端数据一致性
  - 关键断言：master 状态变更后，slave 在 `waitFor` 内收到 diff 并应用，两侧 slice 状态相同

- **[LOW]** `waitForRemoteStarted` 超时后抛出 `remoteCommandResponseTimeout` 错误
  - 关键断言：error.key 为 `remoteCommandResponseTimeout`；`timeoutMs` 字段正确

---

### workflow-runtime-v2

**现有覆盖：** 串行队列、completed observation 限制、重复 requestId 检测、command-step 执行、定义源优先级、script 表达式/条件/output mapping、external-call retry/skip、external-subscribe 正常+竞态、external-on target 过滤、compensation、timeout、live 远程定义

#### 缺失场景

- **[HIGH]** 取消正在 active 执行中的 workflow run
  - 目的：验证 `cancel()` 对 `state.activeRun` 生效，observation 变为 `CANCELLED`
  - 关键断言：`observation.status === 'CANCELLED'`；`observation.cancelledAt` 有值；后续 run 能正常启动

- **[HIGH]** `external-subscribe` 在 `subscribe()` 本身 reject 时的错误处理
  - 目的：验证 `subscribe()` Promise reject 时 workflow step 以 FAILED 结束，不挂起
  - 关键断言：step status 为 `FAILED`；workflow status 为 `FAILED`

- **[HIGH]** `external-subscribe` timeout 触发后 unsubscribe 被调用
  - 目的：验证超时后 `unsubscribe(subscriptionId)` 被调用，无资源泄漏
  - 关键断言：`unsubscribed` 数组包含正确的 subscriptionId；step status 为 `FAILED`

- **[HIGH]** `external-on` timeout 触发后 `off()` 被调用
  - 关键断言：step status 为 `FAILED`；`off` 被调用

- **[MEDIUM]** queue size limit 超限时 `run$` subscriber 收到 error
  - 关键断言：subscriber 收到包含 queue size 信息的 error

- **[MEDIUM]** `resolveWorkflowInput` 的 `object` mapping 场景
  - 目的：验证 `mapping.object` 中多个 key 各自通过 expression 求值后组合成对象
  - 关键断言：step input 为正确的合并对象

- **[MEDIUM]** `evaluateWorkflowExpression` path 表达式访问不存在路径返回 `undefined`
  - 关键断言：返回值为 `undefined`，workflow 不崩溃

- **[MEDIUM]** script executor port 失败时包装为 `workflowScriptFailed` error
  - 关键断言：error key 为 `workflowScriptFailed`；`details.reason === 'port-failed'`

- **[LOW]** `functionCache` LRU 超过 200 条时驱逐最旧条目
  - 关键断言：插入第 201 条后 `functionCache.size === 200`；最旧的 key 被删除

---

### tcp-control-runtime-v2

**现有覆盖：** bootstrap → activate → refresh → reportTaskResult 完整流程、持久化写入/恢复、HTTP 调用序列、live roundtrip、live restart recovery

#### 缺失场景

- **[HIGH]** `refreshCredential` 在无 refreshToken 时的错误路径
  - 目的：验证 `credential.refreshToken` 为空时 dispatch `setLastError`，status 不变为 REFRESHING
  - 关键断言：command result status 为 `FAILED`；`selectTcpCredentialSnapshot().status` 不为 `REFRESHING`

- **[HIGH]** `refreshCredential` HTTP 调用失败时状态回退为 EMPTY
  - 目的：验证 `httpService.refreshCredential()` 抛出时，status 回退为 `EMPTY`，`lastError` 被记录
  - 关键断言：`selectTcpCredentialSnapshot().status === 'EMPTY'`；`lastError` 非 null

- **[HIGH]** `refreshCredential` 成功后 `credentialRefreshed` command 被 dispatch
  - 目的：验证 `actorContext.dispatchCommand(credentialRefreshed, ...)` 被调用，payload 包含新 token
  - 关键断言：request 的 commands 链包含 `credentialRefreshed`；payload 中 `accessToken` 为新值

- **[MEDIUM]** `expiresAt` 计算正确性（`now + expiresIn * 1000`）
  - 关键断言：`selectTcpCredentialSnapshot().expiresAt` 约等于 `Date.now() + expiresIn * 1000`（误差 < 1s）

- **[MEDIUM]** 并发两次 `refreshCredential` 的行为
  - 目的：验证第二次 refresh 在第一次进行中时的行为，最终状态一致
  - 关键断言：最终 status 为 `READY`；accessToken 为最后一次成功的值

- **[LOW]** `reportTaskResult` 在未激活（无 terminalId）时的错误处理
  - 关键断言：command result status 为 `FAILED`；error key 有意义

---

### ui-runtime-v2

**现有覆盖：** screen/overlay/variable 注册与查询、`createUiModalScreen`/`createUiAlertScreen` 工厂、selector 逻辑、live master-to-slave 变量同步与重连

#### 缺失场景

- **[HIGH]** slave-to-master 方向断线重连后变量同步恢复
  - 目的：验证 slave 侧断线重连后，master 推送的变量仍能同步到 slave
  - 关键断言：重连后 slave 变量值与 master 一致；`continuousSyncActive` 为 true

- **[HIGH]** `showScreen` 在 instanceMode 不匹配时的过滤行为
  - 目的：验证 SLAVE 实例不显示 `instanceModes: ['MASTER']` 的 screen
  - 关键断言：`selectUiScreen` 返回 null 或 fallback

- **[HIGH]** `openOverlay` 后 `closeOverlay` 正确移除 overlay
  - 关键断言：close 后 `selectUiOverlays(state).length === 0`

- **[MEDIUM]** 多个 overlay 叠加后按 id 关闭特定 overlay
  - 关键断言：剩余 overlays 数量和 id 正确

- **[MEDIUM]** `selectUiCurrentScreenOrFirstReady` 在无 current screen 时返回第一个 ready definition
  - 目的：验证 fallback 逻辑，`indexInContainer` 排序正确
  - 关键断言：返回 `indexInContainer` 最小的 screen definition

- **[LOW]** `clearUiVariables` 清除全部变量（不传 key 列表）
  - 关键断言：所有变量均为 null

- **[LOW]** workspace 隔离：`main` workspace 的变量不影响 `branch` workspace
  - 关键断言：`selectUiVariable(state, key, 'branch')` 与 `selectUiVariable(state, key, 'main')` 独立

---

## 附录：缺失场景统计

| 包名 | HIGH | MEDIUM | LOW | 合计 |
|------|------|--------|-----|------|
| contracts | 2 | 2 | 1 | 5 |
| platform-ports | 2 | 3 | 1 | 6 |
| definition-registry | 3 | 3 | 1 | 7 |
| execution-runtime | 2 | 2 | 1 | 5 |
| host-runtime | 4 | 4 | 2 | 10 |
| state-runtime | 5 | 6 | 1 | 12 |
| runtime-shell-v2 | 4 | 5 | 2 | 11 |
| transport-runtime | 3 | 3 | 1 | 7 |
| tdp-sync-runtime-v2 | 3 | 3 | 1 | 7 |
| topology-runtime-v2 | 4 | 3 | 1 | 8 |
| workflow-runtime-v2 | 4 | 4 | 1 | 9 |
| tcp-control-runtime-v2 | 3 | 2 | 1 | 6 |
| ui-runtime-v2 | 3 | 2 | 2 | 7 |
| **合计** | **42** | **42** | **16** | **100** |
