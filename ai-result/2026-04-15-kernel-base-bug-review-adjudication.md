# 1-kernel/1.1-base Bug Report 裁决与整改结果

基于 [ai-result/2026-04-14-kernel-base-bug-review.md](/Users/dexter/Documents/workspace/idea/newPOSv1/ai-result/2026-04-14-kernel-base-bug-review.md) 对照真实代码、单元测试、live 集成测试后的最终裁决如下。

本轮原则：

1. 只修改真实 bug，且要求有明确收益。
2. 对看起来不像 bug、但容易反复争论的点，补保护性测试锁定当前契约。
3. 不为了“报告全打勾”去引入额外复杂度。

## 一、已证实并完成整改

这些问题被判定为真实 bug，且本轮已完成代码修复与测试验证。

1. `platform-ports/logger.ts`
   `maskValue` 缺少循环引用保护，已加 `WeakSet`，并补 circular payload 测试。

2. `transport-runtime/socketRuntime.ts`
   `send()` 在未建立 transportConnection 时仍累加 `outboundMessageCount`；
   `onError()` 后未切到 `disconnected`；
   `state-change` 在 `resolved` 为空前 connectionId 不稳定。
   以上均已修复并补测试。

3. `transport-runtime/httpRuntime.ts`
   `enforceRateLimit()` 放在 `acquireSlot()` 之后，导致限流请求先占并发槽。
   已调整顺序并通过测试验证。

4. `workflow-runtime-v2/connectorRuntime.ts`
   `external-subscribe` 存在订阅 id 竞态，可能 `unsubscribe('')`。
   已修复并补回归测试。

5. `tcp-control-runtime-v2/credentialActor.ts`
   refresh 失败时 `credentialStatus` 卡在 `REFRESHING`。
   已改为失败后回到 `EMPTY`，恢复可重试语义。

6. `state-runtime/createStateRuntime.ts`
   `flushPersistence` 链式竞态、immediate flush 不清 timer、hydrate 无并发保护、死代码分支、坏 JSON 导致 hydrate 全失败。
   已全部修复并有测试覆盖。

7. `contracts` / `execution-runtime` / `runtime-shell-v2` / `workflow-runtime-v2` / `transport-runtime`
   AppError 鸭子类型判断过宽。
   已统一改为 `isAppError()`。

8. `definition-registry/resolve.ts`
   `resolveErrorDefinitionByKey()` 在 `key !== appError.key` 时静默返回错误结果；
   number decode 未拒绝 `NaN`。
   已修复并补测试。

9. `definition-registry/registry.ts` 与 `ui-runtime-v2/screenRegistry.ts`
   `registerMany()` 依赖 `this.register`，解构调用有丢 `this` 风险。
   已修复。

10. `runtime-shell-v2/requestLedger.ts`
    mirrored/local command 初始状态错误地落成 `COMPLETED`。
    已统一为 `RUNNING`，并同步修正 actor running 状态。

11. `topology-runtime-v2/orchestrator.ts`
    `stopConnection()` 未取消 state 订阅；
    `listenersAttached` 未复位；
    `handleRemoteDispatch()` 异常可能吞掉；
    `waitForRemoteStarted()` 未识别远端 `RUNNING`。
    已修复并通过本包 live 测试。

12. `tdp-sync-runtime-v2/sessionConnectionRuntime.ts`
    `dispatchCommand(tdpMessageReceived)` 异常曾被静默丢失。
    已补 `.catch()` 日志。

13. `contracts/time.ts`
    日期格式月份/日期未补零。
    已修复并补测试。

14. `contracts/runtimeId.ts`
    运行时 ID 随机后缀过短。
    已改为优先 `crypto.randomUUID()`，并补测试。

15. `contracts/validator.ts`
    `positiveFiniteNumber` 用 `Number.MIN_VALUE` 表意不清。
    已改为明确 `value > 0`。

16. `host-runtime/sessions.ts`
    `detachConnection()` 覆盖 `pendingNodeIds`，多节点断开时会丢历史 pending 节点；
    `resolveStatus()` 对空节点数组语义不稳。
    已修复并补测试。

17. `host-runtime/relay.ts`
    `drain()` 用递减计数方式更新 `queueBySession`，多连接场景下统计可能失真。
    已改为按 session 重算，并补测试。

18. `host-runtime/faults.ts`
    `remainingHits <= 0` 的规则会出现“第一次命中前就已无效”的语义歧义。
    已统一规范为最少生效一次，并补测试。

19. `workflow-runtime-v2/scriptRuntime.ts`
    `functionCache` 无上限增长；
    `cacheKey` 有碰撞风险。
    已改为有限容量缓存，并用结构化 key。

20. `workflow-runtime-v2/engine.ts`
    `run$` 在 setup/入队阶段抛错时可能让订阅侧感知不清晰。
    已补显式 `subscriber.error(...)` 路径，并加测试验证。

21. `workflow-runtime-v2/engineObservation.ts`
    `completedObservationLimit=0` 原先会被忽略回默认值。
    已改为允许 `0`，并补测试。

22. `tdp-sync-runtime-v2/sessionConnectionRuntime.ts`
    本轮发现并修复一个真实回归：把握手移到 `onConnected()` 后，因底层 `socketRuntime.connect()` 的赋值时序，握手可能在 transportConnection 可用前发送失败。
    已恢复为 `connect()` resolve 后立即发握手，并补测试验证。

## 二、不是 bug，但补了保护测试/证据

这些条目经核对后认为报告判断过重，或属于当前架构的明确契约，不建议按报告方式修改；但已通过测试把关键语义固定下来。

1. `tdp-sync-runtime-v2 sendHandshake too early`
   报告结论不成立。当前实现里“connect resolve 后发握手”才是正确时机；
   改到 `connected` 事件里反而会因为底层赋值顺序产生真实丢包。
   已补测试锁定该契约。

2. `runtime-shell-v2 executionStack 入栈/出栈字段不匹配`
   报告误判。当前实现入栈同时记录 `requestId + commandName + actorKey + commandId`，
   出栈是用 `commandId + actorKey`，逻辑是一致的。
   现有 `runtime-shell-v2` 测试已覆盖 re-entry / 并发请求场景。

3. `runtime-shell-v2 超时后 execution promise 仍可能污染 ledger`
   风险被报告放大。当前 ledger 完成以 `Promise.race()` 结果为准，后续执行结果并不会再次写总状态。
   这条本轮不改，实现风险低于继续加 abort/cancel 复杂度。

4. `state-runtime createScopedStateKey 未包含 axis`
   当前更像兼容性约束，不宜贸然改 key 规则。
   报告作为设计提醒有价值，但不是本轮 bug。

5. `topology-runtime-v2/orchestratorIncoming.ts handleHelloAck`
   报告指出 rejected ack 也会先写 sessionId，这个担忧有价值。
   当前外部读模型不应把 rejected session 作为 active session 使用。
   已补保护测试，确认 rejected ack 不会污染 active sync context。

6. `workflow-runtime-v2 run$ 错误传播`
   原报告提的是 queue overflow，实际更稳妥的验证点是 setup 阶段重复 requestId。
   已用保护测试验证 `run$` 出错会走 error 通道，不会悬挂。

## 三、更像设计建议，暂不改

这些条目不是没有道理，但更偏向设计优化、接口演进或取舍，不属于当前应立即修改的 bug。

1. `execution-runtime` handler-not-found 应返回 failed result 而不是 throw
   这会改变执行契约，影响面比报告描述更大，当前先保持不变。

2. `workflow-runtime-v2` 同步脚本超时无法中断死循环
   这是 JS 单线程事实，真正解决要上 Worker/隔离执行，属于架构扩展，不是本轮小修。

3. `workflow-runtime-v2 connector.on 必须强制返回 off`
   是好建议，但会推动平台端口契约升级，本轮不动。

4. `topology-runtime-v2 createPeerRuntimeInfoFromNodeId` 的填充值策略
   现阶段属于协商降级策略，不是已证实 bug。

5. `ui-runtime-v2 sharedRegistry` 单例污染
   报告有一定道理，但当前没有实证失败，且会牵涉 selector/registry 重新注入，先不改。

6. `host-runtime createHostRuntime.ts` 中 `markDisconnected()` / `markDropped()` 是否互斥
   当前允许同一 fault 既断连接又丢当前 relay，这更像产品语义取舍，不是明显 bug。

7. `contracts` 中多处类型更严/判别联合更完整
   值得做，但属于类型工程优化，不是当前运行缺陷。

## 四、本轮新增/强化的测试覆盖

1. `contracts`
   时间格式补零、ID 随机后缀长度、validator 语义。

2. `host-runtime`
   多节点 resume pending 合并、relayPendingCount 多连接重算、fault `remainingHits` 下限。

3. `tdp-sync-runtime-v2`
   握手必须在 socket connect resolve 后发送。

4. `workflow-runtime-v2`
   `run$` setup error 走 error 通道；
   `completedObservationLimit = 0` 生效。

5. `topology-runtime-v2`
   rejected hello ack 不污染 active session/sync context。

## 五、本轮验证结果

已通过测试：

1. `@impos2/kernel-base-contracts`
2. `@impos2/kernel-base-platform-ports`
3. `@impos2/kernel-base-definition-registry`
4. `@impos2/kernel-base-transport-runtime`
5. `@impos2/kernel-base-runtime-shell-v2`
6. `@impos2/kernel-base-state-runtime`
7. `@impos2/kernel-base-host-runtime`
8. `@impos2/kernel-base-tdp-sync-runtime-v2`
9. `@impos2/kernel-base-workflow-runtime-v2`
10. `@impos2/kernel-base-topology-runtime-v2`

已通过类型检查：

1. `@impos2/kernel-base-contracts`
2. `@impos2/kernel-base-host-runtime`
3. `@impos2/kernel-base-tdp-sync-runtime-v2`
4. `@impos2/kernel-base-workflow-runtime-v2`
5. `@impos2/kernel-base-topology-runtime-v2`

已通过环依赖检查：

1. `@impos2/kernel-base-contracts`
2. `@impos2/kernel-base-host-runtime`
3. `@impos2/kernel-base-tdp-sync-runtime-v2`
4. `@impos2/kernel-base-workflow-runtime-v2`
5. `@impos2/kernel-base-topology-runtime-v2`

## 六、结论

这份 bug report 里有不少高价值问题，尤其是状态竞态、握手时序、订阅清理、catalog 解析这些地方，值得修，而且本轮已经落地。

同时也有一部分条目属于：

1. 设计建议被包装成 bug；
2. 对当前实现语义的误读；
3. 从“理论上可能更优”直接跳到了“必须修改”。

这类条目本轮没有机械跟随，而是通过保护测试把当前有效契约固定下来。这样系统既更稳，也避免为了迎合报告而引入新的复杂度。
