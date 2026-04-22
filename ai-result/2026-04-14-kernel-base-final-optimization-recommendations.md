# 1-kernel/1.1-base 最终优化建议报告

**日期**: 2026-04-14  
**适用范围**: `1-kernel/1.1-base` 全部基础包  
**报告性质**: 对以下两份报告做合并、取舍、回查代码后的最终收口结论  

参考输入：

1. `ai-result/2026-04-14-kernel-base-code-review.md`
2. `ai-result/2026-04-14-kernel-base-code-review-claude.md`

本报告不是简单折中，而是基于两份报告中的共识点、分歧点，再回到代码做二次核对后形成的最终建议。后续如果要进入正式整改，应以本报告为准。

---

## 一、最终判断

`1-kernel/1.1-base` 当前已经不是“重构草稿层”，而是一套已经成型的新版 kernel 基座。主链已经清晰，方向也是对的，可以承接后续业务模块迁移。

当前最值得肯定的事实有四个：

1. 新主链已经成立，而且边界明显优于旧 core。  
   目前真正的主链是：
   `contracts -> platform-ports -> state-runtime -> runtime-shell-v2 -> transport-runtime -> tcp-control-runtime-v2 / tdp-sync-runtime-v2 / topology-runtime-v2 / workflow-runtime-v2 / ui-runtime-v2`

2. 核心能力拆分基本正确。  
   request、state、transport、topology、workflow、ui 已经不再像旧包那样高度缠绕，这一点是本次重构最重要的成果。

3. 测试方法已经明显升级。  
   尤其是双机、重连、mock 服务联调、恢复验证这些场景，已经不是简单 reducer 测试，而是逐步接近真实运行链路。

4. 新版架构已经形成“专业 kernel”的雏形。  
   协议公开、模块分层、平台隔离、持久化分粒度、命令广播与结果聚合，这些都比旧架构更成熟。

但它还没有完全达到“稳定基座、可放心迁移全部业务包”的状态。当前还存在三类必须尽快收口的问题：

1. 少数基础契约与实现不一致。
2. 少数基础热路径未来会成为性能瓶颈。
3. 少数超大运行时文件已经开始侵蚀可维护性。

所以最终结论是：

`1-kernel/1.1-base` 可以继续作为后续迁移主基座，但必须先完成一批高优先级整改，特别是契约正确性、request 生命周期正确性、state 持久化热路径、workflow 观测状态淘汰、超大 orchestrator/engine 拆分这几项。

---

## 二、两份报告的最终取舍结论

### 2.1 明确认定为“必须采纳”的建议

以下建议在两份报告中要么有共识，要么经过回查代码后可以明确确认：

1. `runtime-shell-v2` 存在对外公开但未真正实现的 request projection API，需要删掉或补全，不能继续半成品公开。
2. `state-runtime` 当前以全量 `exportEntries() + JSON.stringify(...)` 做持久化变更检测，未来一定会成为热路径瓶颈。
3. `definition-registry` 的 boolean decode 存在明确语义错误，`"false"` 当前会被解成 `true`。
4. `workflow-runtime-v2` 的 observation state 缺少淘汰机制，长期运行会持续膨胀。
5. `runtime-shell-v2 / topology-runtime-v2 / workflow-runtime-v2 / tdp-sync-runtime-v2` 中的 `as any` 穿透过多，削弱了这次重构最重要的“协议边界可依赖”目标。
6. `topology-runtime-v2` 的 `orchestrator.ts` 和 `workflow-runtime-v2` 的 `engine.ts` 复杂度已经过高，必须拆。
7. `runtime-shell-v2` 与 `ui-runtime-v2` 的包内循环依赖应该清理。
8. `transport-runtime` 的 websocket 能力成熟度仍低于 HTTP runtime，应继续补齐 reconnect / failover / metrics 语义。

### 2.2 来自 Claude 报告、经核对后确认“有价值且应纳入最终报告”的建议

以下点在主报告里没有单独列为最高优先级，但经代码核对后，确认是有价值的补充：

1. `runtime-shell-v2/src/foundations/requestLedger.ts` 中 `applyRequestLifecycleSnapshot(...)` 对命令状态的映射有明确错误。  
   当前逻辑把非 `error`、非 `complete` 的命令状态都映射成了 `COMPLETED`，这会导致远端镜像的“进行中命令”被错误视为已完成。  
   这不是风格问题，是实际逻辑错误，优先级应上调到最高级。

2. `runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts` 中 actor timeout 的 `setTimeout` 没有在正常执行完成后清理。  
   这至少是实现质量问题，也会给高频命令带来不必要的 timer 残留，应修正。

3. `contracts/src/foundations/time.ts` 的时间格式没有对月份和日期补零。  
   你前面已经明确要求“统一时间 long 存储、统一格式化输出”，那这里就不应出现格式不一致。

4. `transport-runtime/src/foundations/serverCatalog.ts` 的 `replaceServers(...)` 先 `clear()` 再逐个写入，不具备原子性。  
   一旦中途校验失败，catalog 会进入半更新状态。这个问题不影响主干设计，但应尽快修正。

5. `package.json` 内部工作区依赖写法目前并不统一。  
   现在确实还存在若干 `@impos2/kernel-base-*` 依赖写成 `"*"` 而不是 `"workspace:*"` 的情况。  
   这一点我不认定为 P0 功能风险，但认定为必须统一的仓库规范问题。对一个强调包边界和层级结构的 monorepo 来说，继续混用是不可接受的。

### 2.3 经核对后“降级处理”或“不作为当前高优问题”的建议

Claude 报告里也有一些点不是完全没道理，但不应被提升为当前主矛盾：

1. `state-runtime` 的 `cloneState = JSON.parse(JSON.stringify(...))`  
   这确实不适合承载 `Date / undefined / 非 JSON 值`。  
   但从当前设计目标看，持久化状态本来就应是可 JSON 序列化的 plain data。  
   所以这更像“契约需要明文化并加验证”，而不是当前基础包的核心 bug。  
   最终建议：
   不把它列入最高优整改，而是补文档与运行时校验，明确 persistence slice 只允许 JSON-safe 数据。

2. `persistenceChain` 是否构成“无限增长内存泄漏”  
   当前实现确实是串行 promise 链，但仅凭这一点，不能直接下结论说已经形成严重内存泄漏。  
   真正更明确、更迫切的问题仍然是“每次 store 变化都做全量导出和全量序列化签名”。  
   所以这里不升为高优 finding。

3. `host-runtime` 中 `consumeRule` 直接 mutate `remainingHits`  
   这在内部可变 registry 里不算结构性问题。  
   但由于 `replaceRules(nextRules)` 只是浅复制数组，没有深复制 rule 对象，所以它确实会把外部传入对象一起改掉。  
   这更适合作为中优先级的封装一致性问题，而不是当前主链阻塞点。

4. `applySlicePatches(..., skipPersistence)` 之类的建议  
   这个方向不是完全错误，但你当前架构里“真实状态更新后应自动持久化”是重要设计原则。  
   在没有明确重复写放大问题之前，不建议把 `skipPersistence` 做成通用开关，否则会引入新的隐式语义。

---

## 三、建议明确保留并继续强化的优秀设计

这些不是“可以接受”，而是应该明确写进后续整改原则中，要求后面的包继续继承。

### 3.1 主链分层正确，不能回退

以下分层是当前新版架构最宝贵的成果，不应回退到旧 core 的“大一统 manager”模式：

1. `contracts` 负责公共协议和统一基础类型。
2. `platform-ports` 负责平台能力抽象。
3. `state-runtime` 负责 Redux 与细粒度持久化真相源。
4. `runtime-shell-v2` 负责命令广播执行、结果聚合、request ledger、模块装载。
5. `transport-runtime` 负责 transport 抽象，而不是再回到旧式 API 管理大一统。
6. `topology-runtime-v2` 负责活的控制面。
7. `tdp-sync-runtime-v2` 负责 projection 仓库与 topic 生效变化广播。
8. `workflow-runtime-v2` 负责工作流。
9. `ui-runtime-v2` 负责无 React 依赖的 UI runtime 能力。

### 3.2 `state-runtime` 的“字段级 / 记录级持久化”是当前新版 kernel 的核心亮点之一

这一点必须保留并继续强化，不要退回旧 `redux-persist` 式整 slice 存储：

1. `field` 粒度持久化适合稳定配置值。
2. `record` 粒度持久化适合 projection 仓库、动态表、字典仓。
3. 支持 `protected` 存储的设计，对 token 等敏感内容是必要能力。
4. 自动持久化而非业务手动触发，这是正确方向。

真正要改的是热路径实现，不是设计方向。

### 3.3 `runtime-shell-v2` 的“命令广播 + actor 执行 + 结果聚合 + request selector”模型值得保留

这套模型已经明显优于旧包里“命令系统过于隐式但功能强”的状态。它最值得保留的点是：

1. Command 仍代表业务指令。
2. Actor 仍代表执行者。
3. 一个 command 可被多个 actor 处理。
4. 结果能聚合。
5. 还能通过 `queryRequest / subscribeRequest` 观察 request 状态。

这条主线是正确的，后续不要再回到“单执行者才能简单”的方向。

### 3.4 `transport-runtime` 的定义式 DSL 比旧工程专业

以下能力应继续沿用：

1. `defineHttpEndpoint`
2. `defineSocketProfile`
3. `ServerCatalog`
4. 与 `server-config-v2` 的分层

说明现在的方向是“服务定义”和“地址配置”分离，这比旧工程里把地址、调用逻辑、错误处理揉在一起更适合作为长期基座。

### 3.5 `ui-runtime-v2` 明确不依赖 React，这条约束必须坚持

你已经明确要求 `1-kernel` 不能依赖 React，这个约束在 `ui-runtime-v2` 上是成立的。  
`rendererKey`、global registry、overlay/runtime 分离这些方向也都是对的。  
后续要改的是循环依赖和文档显式性，不是回退到 React 内核化。

---

## 四、最终必须优先整改项

这里是收口后的真正高优先级列表。后续整改顺序建议以此为准。

### 4.1 P0：先修正确性问题

#### 4.1.1 修复 request lifecycle snapshot 映射错误

涉及文件：

1. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/requestLedger.ts`

当前问题：

`applyRequestLifecycleSnapshot(...)` 中，`command.status` 只要不是 `error` 或 `complete`，就会被映射成 `COMPLETED`。

直接后果：

1. 远端 request 镜像中的“started / accepted / dispatched”等进行中命令会被错误显示为已完成。
2. 双机 request 观察结果会失真。
3. 这会直接伤到你前面最强调的“主副机 request 状态不能乱”目标。

这个问题应列为当前 `1.1-base` 最需要先修的一项。

#### 4.1.2 清理或补全 `runtime-shell-v2` 的 request projection 假接口

涉及文件：

1. `1-kernel/1.1-base/runtime-shell-v2/src/types/runtime.ts`
2. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts`

当前问题：

1. `applyProjectionMirror(...)` 对外公开，但实现为空。
2. `getRequestProjection(...)` 对外公开，但永远返回 `undefined`。

最终建议：

优先删除，而不是继续挂着。  
因为你已经确认 request 真相不靠 redux，也没有要求 `runtime-shell-v2` 强持有 projection read model。那就不要在 runtime 公共接口上保留“看起来有、实际上没有”的能力。

#### 4.1.3 修复 `definition-registry` 的 boolean decode 错误

涉及文件：

1. `1-kernel/1.1-base/definition-registry/src/supports/resolve.ts`

当前问题：

`Boolean("false") === true`，现有实现会把很多合法下发值解错。

这不是小问题，因为后续 `systemParameters` 明确会走动态下发。

最终建议：

在 `contracts` 或 `definition-registry` 内建立统一的基础 decode helper，至少覆盖：

1. `true / "true" / 1 / "1"`
2. `false / "false" / 0 / "0"`
3. 非法值明确失败

### 4.2 P1：尽快修热路径和长期运行问题

#### 4.2.1 重做 `state-runtime` 的 persistence dirty tracking

涉及文件：

1. `1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts`

当前问题不是“能不能工作”，而是“越成功越慢”。

应整改为：

1. 以 slice 为单位做脏判断。
2. `record` 型状态尽量做到 entry 粒度更新。
3. `exportPersistedState()` 保留给测试和调试。
4. 主热路径不要再依赖全量展开和全量序列化。

#### 4.2.2 给 `workflow-runtime-v2` 增加 observation retention

涉及文件：

1. `1-kernel/1.1-base/workflow-runtime-v2/src/features/slices/workflowObservations.ts`
2. `1-kernel/1.1-base/workflow-runtime-v2/src/foundations/engine.ts`

建议至少明确两层语义：

1. 活跃 request 的观测状态。
2. 已完成 request 的保留策略。

不要继续让 `byRequestId` 无限增长。

#### 4.2.3 清理核心运行时中的 `as any`

重点范围：

1. `runtime-shell-v2`
2. `topology-runtime-v2`
3. `workflow-runtime-v2`
4. `tdp-sync-runtime-v2`

目标不是追求“零 any 宗教化”，而是收紧协议边界：

1. branded id 要统一通过工厂创建。
2. 状态读取要通过 typed helper。
3. 不要再用 `'UNKNOWN' as any` 这类伪值占位。

### 4.3 P1：尽快拆超大文件

#### 4.3.1 拆 `topology-runtime-v2` 的 `orchestrator.ts`

建议至少拆成以下子责任：

1. connection lifecycle
2. session handshake / resume
3. remote command dispatch
4. request mirror / lifecycle sync
5. state sync session

#### 4.3.2 拆 `workflow-runtime-v2` 的 `engine.ts`

建议至少拆成以下子责任：

1. queue / scheduling
2. observation notify
3. script execution
4. connector invocation
5. state projection / selector feed

这两项不是为了“好看”，而是因为当前复杂度已经会影响下一轮包迁移。

---

## 五、重要但可以放在第二阶段的整改项

### 5.1 统一内部 workspace 依赖写法

当前仓库内确实还有一些基础包依赖写成 `"*"`。

我的最终判断是：

1. 这不是当前最严重的功能问题。
2. 但这是明显的仓库规范不一致。
3. 对一个强调 monorepo 内部层级和包边界的工程来说，应全部统一成 `"workspace:*"`。

所以这项应进入第二阶段统一清理。

### 5.2 修复 timeout timer 未清理

涉及文件：

1. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts`

这项实现质量应修，但不应高于前面的 request lifecycle 与持久化热路径问题。

### 5.3 修复 `serverCatalog.replaceServers(...)` 的原子性

涉及文件：

1. `1-kernel/1.1-base/transport-runtime/src/foundations/serverCatalog.ts`

建议先完整校验 `nextServers`，通过后再替换。

### 5.4 补齐 socket runtime 的统一策略

`transport-runtime` 不需要过度设计，但 websocket runtime 至少应逐步沉淀：

1. reconnect policy
2. failover policy
3. heartbeat / liveness hook
4. failure metrics

否则这些能力还会继续向上漂浮到 topology、tdp、业务模块里。

### 5.5 清理包内循环依赖

重点处理：

1. `runtime-shell-v2`
2. `ui-runtime-v2`

建议原则：

1. 内部实现禁止反向依赖本包聚合出口。
2. 共享类型提到 `types/shared.ts` 一类文件。
3. 只允许外部从 `index.ts` 导入。

### 5.6 低成本一致性修正

这一批都不难，但对整体专业度有帮助：

1. `contracts/src/foundations/time.ts` 中月份、日期格式补零。
2. 提取重复的 `noopLogger`。
3. 提取重复的 slash trim helper。
4. 把全局共享 registry、最后写入者生效等已接受约束写进文档，不再只靠隐式代码约定。

---

## 六、包分级的最终建议

当前 `1.1-base` 里不应再维持“所有包都同样重要”的叙事。应该明确分层，否则后续业务迁移会摇摆。

### 6.1 Tier 1：终端主链基座

后续业务模块迁移，原则上只允许基于这些包：

1. `contracts`
2. `platform-ports`
3. `state-runtime`
4. `runtime-shell-v2`
5. `transport-runtime`
6. `tcp-control-runtime-v2`
7. `tdp-sync-runtime-v2`
8. `topology-runtime-v2`
9. `workflow-runtime-v2`
10. `ui-runtime-v2`

### 6.2 Tier 2：辅助层 / 预备层 / 宿主层

这些包不是坏设计，但不应被描述为“终端迁移主基座”：

1. `definition-registry`
2. `execution-runtime`
3. `host-runtime`

其中：

1. `definition-registry` 要么后续并入主链，要么明确保持辅助定义层。
2. `execution-runtime` 当前和 `runtime-shell-v2` 存在重复叙事，不建议继续扩张。
3. `host-runtime` 主要服务于宿主 / mock / host 侧，不属于终端业务基座。

---

## 七、建议补充到后续开发规范中的几点

### 7.1 持久化状态必须是 JSON-safe plain data

既然 `state-runtime` 的持久化和快照导出本质上是 JSON 语义，那就应该明确规则：

1. 不允许把 `Date`、类实例、函数、不可序列化结构放进 persistence slice。
2. 所有时间都用 long。
3. 展示和日志统一用基础格式化工具。

### 7.2 公共接口不能先占位再长期空实现

这次 `runtime-shell-v2` 的 projection API 已经说明了问题。  
后续任何基础包都应遵守：

1. 未实现能力不进入 public interface。
2. 需要实验的能力先放 internal。
3. 一旦对外公开，就要有明确语义、明确测试。

### 7.3 超过一定复杂度的运行时文件必须主动拆分

尤其是 kernel 运行时包，应形成规则：

1. 一个文件同时承担协议转换、状态拼装、外部 IO、生命周期编排时，应拆。
2. Actor 定义按职责分文件，不允许继续回到大 index 堆逻辑。

### 7.4 仓库内部依赖统一使用 workspace protocol

即使当前 Yarn workspace 在很多场景下能正确联到本地包，也不应继续混用。  
这属于 monorepo 基础卫生，应作为显式规范执行。

---

## 八、最终推荐整改顺序

### 第一阶段：先补正确性

1. 修 `requestLedger.applyRequestLifecycleSnapshot(...)` 的状态映射错误。
2. 清理 `runtime-shell-v2` 的假 projection API。
3. 修 `definition-registry` boolean decode。
4. 修 actor timeout timer 清理。

### 第二阶段：补长期稳定性

1. 重做 `state-runtime` 的 dirty tracking。
2. 给 `workflow-runtime-v2` 增加 observation retention。
3. 修 `serverCatalog.replaceServers(...)` 原子性。
4. 清理核心 `as any` 穿透。

### 第三阶段：补可维护性

1. 拆 `topology-runtime-v2/orchestrator.ts`
2. 拆 `workflow-runtime-v2/engine.ts`
3. 清理 `runtime-shell-v2 / ui-runtime-v2` 循环依赖

### 第四阶段：补基础设施成熟度和仓库卫生

1. socket runtime 策略增强
2. workspace 依赖写法统一
3. 时间格式、重复 helper、文档显式性统一

### 第五阶段：补包分级与迁移规范

1. 明确 Tier 1 / Tier 2
2. 明确后续业务迁移只能依赖 Tier 1
3. 让辅助层是否继续演进进入主链有明确结论

---

## 九、最终结论

综合两份报告，并回到代码核对后，我的最终判断是：

1. `1-kernel/1.1-base` 的重构方向是成立的，而且已经明显优于旧 core。
2. 当前真正的问题不在“架构方向错了”，而在“少量基础 correctness、少量热路径性能、少量超大运行时复杂度”还没有收口。
3. Claude 报告里最有价值的补充是：  
   `requestLedger` 的状态映射 bug、timeout timer 清理、workspace 依赖统一、时间格式细节、serverCatalog 原子性。  
   这些值得吸收。
4. 但也不能把所有实现细节都上升为主矛盾。  
   例如 `cloneState(JSON)`、`persistenceChain`、`skipPersistence` 这些点，更适合作为规则澄清或次级优化，而不是当前主线阻塞项。

最终建议是：

继续以 `1-kernel/1.1-base` 作为新版 kernel 主基座推进，但在开始大规模迁移更多业务包之前，先完成本报告第四章和第八章第一、第二阶段的整改。  
完成后，再进入下一轮更大规模的业务包迁移，会更稳，也更符合你这次“不要为迁移成本妥协，只要专业架构”的目标。
