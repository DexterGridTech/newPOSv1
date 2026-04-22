# 1-kernel/1.1-base 全量代码审查报告

**日期**: 2026-04-14  
**审查范围**: `1-kernel/1.1-base` 下全部 13 个包  
**审查方式**: 设计审查 + 代码抽样深读 + 测试与依赖关系核对 + 静态检查  
**审查重点**: 设计意图、边界清晰度、对外契约完整性、类型系统可靠性、复杂度、测试覆盖、长期迁移风险

---

## 一、执行摘要

### 1.1 总体判断

`1-kernel/1.1-base` 已经具备一套可运行、可联调、可扩展的新版 kernel 基座，主干能力已经成立：

1. `runtime-shell-v2 + state-runtime + topology-runtime-v2 + transport-runtime + tcp-control-runtime-v2 + tdp-sync-runtime-v2 + workflow-runtime-v2 + ui-runtime-v2` 这条主链已经能支撑当前新版 kernel 能力。
2. 测试面整体是比较扎实的，尤其是 `tcp-control-runtime-v2 / tdp-sync-runtime-v2 / topology-runtime-v2 / ui-runtime-v2` 的 live 场景覆盖明显强于一般重构工程。
3. 模块边界总体比旧 core 更清晰，尤其是把 request ledger、state runtime、transport、topology、workflow 拆开，是正确方向。

但当前还有四类关键问题，会直接影响你后续迁移业务包时的质量和维护成本：

1. **公开契约与实际实现不一致**  
   `runtime-shell-v2` 对外公开了 `applyProjectionMirror / getRequestProjection`，但当前实现是空的，容易形成“接口存在但语义不存在”的误导。
2. **基础设施层存在性能与复杂度隐患**  
   `state-runtime` 现在用全量 `JSON.stringify(exportEntries())` 做持久化变更检测，在 projection 仓库和未来业务大状态场景下会成为瓶颈。
3. **少数关键基础包存在“预备层”和“主干层”并存**  
   `definition-registry / execution-runtime / host-runtime` 设计并不差，但目前没有真正进入新版 kernel 主干，导致 `1.1-base` 同时存在两套基础叙事。
4. **类型系统被大量 `as any` 穿透**  
   这在 `runtime-shell-v2 / topology-runtime-v2 / host-runtime / workflow-runtime-v2 / tdp-sync-runtime-v2` 中比较明显。现在能跑，但会削弱你这次重构最核心的“协议明确、边界可靠”目标。

### 1.2 静态检查结果

已核对：

1. 所有 `1-kernel/1.1-base/*` 包 `type-check` 当前通过。
2. `madge` 检查发现两个包内循环依赖：
   1. `runtime-shell-v2`
   2. `ui-runtime-v2`
3. 多个 `1.1-base` 包目录下仍残留 `.turbo` 目录，不符合你当前仓库卫生目标。

---

## 二、优先级最高的 Findings

以下 findings 按严重级别排序。这里优先列“真正会影响后续架构稳定性”的问题，不列纯风格意见。

### 2.1 `runtime-shell-v2` 公开了 request projection 契约，但当前实现是空的

**级别**: `HIGH`

**证据**

1. 公共接口声明：
   [runtime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/types/runtime.ts#L66)
2. 实际实现：
   [createKernelRuntimeV2.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts#L182)

当前表现：

1. `applyProjectionMirror(...)` 是空函数。
2. `getRequestProjection(...)` 永远返回 `undefined`。

**为什么这是问题**

这不是“暂未使用”的内部细节，而是已经进入公开 runtime 契约的 API。对使用者来说，它表达的是“runtime-shell-v2 具备 request projection read model 能力”；但实际语义并不存在。

这会导致两类风险：

1. 后续业务包或测试辅助层误以为这是稳定能力。
2. `runtime-shell-v2` 与 `topology-runtime-v2` 的 request mirror 责任边界继续模糊。

**整改建议**

二选一，而且要尽快定：

1. 如果 `request projection` 真相应继续放在 `topology-runtime-v2 / 业务模块`，就把这两个 API 从 `runtime-shell-v2` 公共接口删掉，只保留 `queryRequest / subscribeRequest`。
2. 如果你仍想保留“统一 request projection 查询口”，那就补一个明确的 projection read model，并让 `applyProjectionMirror / getRequestProjection` 真正有实现。

我的建议是第一种。因为你前面已经确认 request 真相源不放 redux，不应该再让 `runtime-shell-v2` 挂一个假的 projection 面。

---

### 2.2 `state-runtime` 的持久化变更检测采用全量序列化签名，未来会成为基础设施瓶颈

**级别**: `HIGH`

**证据**

1. `store.subscribe` 内每次都计算全量签名：
   [createStateRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts#L527)
2. 签名内容来自 `exportEntries()` 的全量展开：
   [createStateRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts#L532)

**为什么这是问题**

当前这套实现对“小而稳”的持久化状态很友好，简单、可靠、容易验证。但你的业务未来明确会有：

1. `tdp-sync-runtime-v2` 的 projection 仓库。
2. `workflow-runtime-v2` 的 observation 状态。
3. 后续业务模块自己的 Redux 扩展状态。

在这种前提下，每次 store 任意变化都执行：

1. 重新遍历全部 persistable slices。
2. 重新展开全部 persistable entries。
3. 再做整段 `JSON.stringify(...)`。

这会让 `state-runtime` 的复杂度和状态规模强绑定。包越成功、状态越多，基础设施越慢。

**整改建议**

建议收口成增量策略，不要再用全量签名做主路径：

1. 给 slice descriptor 增加“持久化脏标记来源”。
2. 只针对变更 slice 重新生成对应 storage entries。
3. `record` 型持久化尽量按 entry key 粒度更新，不重新扫整 slice。
4. 保留 `exportPersistedState()` 全量导出能力用于测试与调试，但不要继续让它参与每次订阅的热路径。

这个整改优先级很高，因为它会影响所有未来迁入 `state-runtime` 的包。

---

### 2.3 `definition-registry` 的 boolean 参数解码逻辑有实际语义错误

**级别**: `HIGH`

**证据**

1. [resolve.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/definition-registry/src/supports/resolve.ts#L68)

当前逻辑：

```ts
if (definition.valueType === 'boolean') {
  return Boolean(rawValue) as TValue
}
```

这意味着：

1. `rawValue = "false"` 会被解码成 `true`
2. `rawValue = "0"` 也会被解码成 `true`

**为什么这是问题**

这是明确错误，不是风格问题。后续一旦任何 boolean 型 system parameter 从远端 catalog 下发字符串值，就会出现错误行为，而且不易排查。

**整改建议**

至少要补标准 decode 规则：

1. `true / "true" / 1 / "1"` -> `true`
2. `false / "false" / 0 / "0"` -> `false`
3. 其他值 -> decode 失败，走 `catalog-fallback`

同时补测试用例，当前 `definition-registry` 只测了 number decode，没有覆盖 boolean decode。

---

### 2.4 `workflow-runtime-v2` 的 observation state 没有淘汰策略，长期运行会无限积累

**级别**: `HIGH`

**证据**

1. observation slice 提供 `removeObservation`，但没有被运行时实际使用：  
   [workflowObservations.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/workflow-runtime-v2/src/features/slices/workflowObservations.ts#L26)
2. 全局检索只有 slice 自己定义了该 action，没有引擎使用它：
   `rg "removeObservation(" ...`

**为什么这是问题**

你已经把 workflow 设计成：

1. 可持续观察。
2. 可排队执行。
3. 可动态从 TDP 下发 definition。

这意味着 workflow 很可能是长期运行能力，而不是一次性 demo。现在 `workflowObservations.byRequestId` 只增不减，终端长期运行后会出现：

1. 内存 state 越积越大。
2. selector 越来越慢。
3. DevTools / 持续调试体验恶化。

**整改建议**

给 observation 增加明确 retention 策略：

1. 只保留活动中 request。
2. 已完成 request 只保留最近 N 条。
3. 或者保留一段时间后自动清理。

如果你还想给 UI 查询完成历史，那应该拆成：

1. 活动 observation：内存热状态。
2. 历史结果：可选持久化读模型。

不要继续把这两种语义混在一个 `workflowObservations` slice 里。

---

### 2.5 `runtime-shell-v2 / topology-runtime-v2 / host-runtime` 大量使用 `as any` 穿透核心协议类型

**级别**: `HIGH`

**证据**

1. `runtime-shell-v2`：  
   [createKernelRuntimeV2.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts#L163)
2. `topology-runtime-v2`：  
   [orchestrator.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime-v2/src/foundations/orchestrator.ts#L383)
3. `host-runtime`：  
   [host-runtime.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/host-runtime/test/scenarios/host-runtime.spec.ts#L44)

还有多处：

1. `'UNKNOWN' as any`
2. branded id 强转
3. timestamp 强转
4. `store.getState() as any`

**为什么这是问题**

你这次重构的核心目标之一就是“协议公开、依赖明确、边界清晰”。`as any` 会把这些目标直接打折：

1. 协议类型失去约束力。
2. 真正的边界错误会被编译器吞掉。
3. 后续业务迁移时更容易靠强转蒙混过关。

**整改建议**

优先做三件事：

1. 把 branded id / timestamp 的创建统一收口为工厂函数，不允许 runtime 内部手写 `as any`。
2. 给 `context.getState()` 提供更强的 typed helper，而不是到处 `as any`。
3. 把 `UNKNOWN` 这种哨兵值改成显式可空字段，不要用假的 branded 值占位。

这是中期持续整改项，不一定一轮清完，但必须进规范。

---

### 2.6 `runtime-shell-v2` 和 `ui-runtime-v2` 存在包内循环依赖

**级别**: `MEDIUM`

**证据**

1. `madge` 检查发现：
   1. `runtime-shell-v2` 1 个循环
   2. `ui-runtime-v2` 1 个循环

相关文件：

1. `runtime-shell-v2/src/types/module.ts` <-> `runtime-shell-v2/src/types/runtime.ts`
2. `ui-runtime-v2/src/foundations/index.ts` -> `module.ts` -> `features/actors/index.ts` -> `overlayRuntimeActor.ts` -> `foundations/index.ts`

**为什么这是问题**

这说明当前导出组织方式仍然有“聚合出口反向参与内部实现”的问题。现在虽然没炸，但它会：

1. 拉高认知成本。
2. 容易在后续新增导出时扩大循环。
3. 让内部实现不够稳定。

**整改建议**

1. 内部实现文件禁止从本包 `foundations/index.ts` 反向导入。
2. `types/module.ts / types/runtime.ts` 共享的类型提取到 `types/shared.ts`。
3. 只允许外部从 `index.ts` 聚合导出，内部实现必须走具体文件路径。

---

### 2.7 `transport-runtime` 的 socket runtime 仍然偏“原始连接器”，与 HTTP runtime 成熟度不对称

**级别**: `MEDIUM`

**证据**

1. HTTP runtime 有：
   1. 地址偏好记忆
   2. retry rounds
   3. failover strategy
   4. metrics
2. socket runtime 当前只有：
   1. 连接
   2. 消息分发
   3. 基础 metric

代码位置：

1. [httpRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/httpRuntime.ts#L28)
2. [socketRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/socketRuntime.ts#L66)

**为什么这是问题**

你的新版上层大量依赖 socket：

1. `tdp-sync-runtime-v2`
2. `topology-runtime-v2`

但 socket runtime 自身没有形成与 HTTP runtime 对等的“可配置 execution policy”。结果是：

1. 上层模块各自实现 reconnect / timeout / heartbeat 语义。
2. transport 层无法沉淀统一 websocket 策略。

当前这不是立即阻塞项，但它会让 `transport-runtime` 长期停留在“半底层工具库”状态。

**整改建议**

不是让你把它做成巨型大包，而是适度收口：

1. 给 socket runtime 增加可选 reconnect policy 接口。
2. 给 connection metrics 增加连续失败统计。
3. 把“地址选择策略”从固定取第一个地址提升为可扩展策略。

---

### 2.8 `1.1-base` 当前存在“主干基础层”和“预备基础层”两套叙事并存

**级别**: `MEDIUM`

**证据**

实际消费关系显示：

1. `runtime-shell-v2 / state-runtime / topology-runtime-v2 / transport-runtime / tcp-control-runtime-v2 / tdp-sync-runtime-v2 / workflow-runtime-v2 / ui-runtime-v2` 已进入主链。
2. `definition-registry / execution-runtime` 基本只在自己测试中使用。
3. `host-runtime` 主要被 `dual-topology-host` 使用，不在终端主链中。

**为什么这是问题**

这会让后续开发者困惑：

1. 到底新版 kernel 的真正基础入口是 `runtime-shell-v2` 体系，还是 `execution-runtime + definition-registry` 体系？
2. 哪些包是正式基础设施，哪些包是辅助实验层？

**整改建议**

建议尽快给 `1.1-base` 包分级：

1. `Tier 1`: 主链基础包，后续业务迁移必须基于它们。
2. `Tier 2`: 预备/宿主/辅助包，不直接面向终端业务迁移。

我建议当前分法：

1. Tier 1:
   `contracts / platform-ports / state-runtime / runtime-shell-v2 / transport-runtime / topology-runtime-v2 / tcp-control-runtime-v2 / tdp-sync-runtime-v2 / workflow-runtime-v2 / ui-runtime-v2`
2. Tier 2:
   `definition-registry / execution-runtime / host-runtime`

然后在文档中明确：

1. Tier 2 是否会继续并入主链
2. 还是保持为服务端/测试/预备能力

---

## 三、逐包审查

以下按包给出设计意图、优点、缺陷与建议。

### 3.1 `contracts`

**设计意图**

作为新版 kernel 的最底层契约包，承载：

1. branded ids
2. command / request / projection / topology 协议类型
3. error / parameter 基础模型
4. 时间与 runtime id 工具
5. validator 与 definition helper

**优点**

1. `moduleName` 规范统一。
2. ID 工厂完整，命名清晰。
3. `createModuleErrorFactory / createModuleParameterFactory` 很适合你当前的包定义风格。
4. `hooks/index.ts` 规则注释明确，符合你“kernel 不依赖 React”的约束。

**缺陷**

1. `positiveFiniteNumber = finiteNumberAtLeast(Number.MIN_VALUE)` 语义可读性一般，容易让维护者误判正数定义。
2. `AppError` 没有强制结构化 `details` / `cause` 规范，后续日志上报时会比较散。
3. `contracts/test/index.ts` 仍然是脚本式验证，不是标准 `vitest` 场景，和其他包风格不一致。

**建议**

1. 补一个 `decodeBoolean` 或更通用的基础 decode helper，给 `definition-registry` 复用。
2. 收紧 `AppError.details` 的推荐结构。
3. 把 `contracts` 也统一到 `vitest` 风格，保持基座一致性。

---

### 3.2 `platform-ports`

**设计意图**

抽象平台依赖，避免 kernel 直接依赖 Android / Node / Electron / Web 运行环境。

**优点**

1. `PlatformPorts` 抽象清晰，边界正确。
2. `logger` 设计整体不错，`scope + withContext` 易用。
3. DEV 原文 / PROD 脱敏规则已经落地。

**缺陷**

1. `createPlatformPorts()` 只是 `Object.freeze({...input})`，价值偏薄。
2. 脱敏规则只看字段名，不看 `error.message`、`message`、字符串 raw 内容，上传后台后可能仍会混入敏感串。
3. `ConnectorPort` 的输入输出过于 `Record<string, unknown>` 化，未来 workflow connector 使用时会不断失去类型。

**建议**

1. `platform-ports` 继续保持轻，但要补一层“推荐 port contract”的文档。
2. 把日志脱敏 helper 独立为可复用策略，而不是完全内嵌在 logger 里。
3. 给 `ConnectorPort` 增加 typed wrapper，而不是继续让上层大量 `Record<string, unknown>`。

---

### 3.3 `definition-registry`

**设计意图**

做错误定义、参数定义的注册与解析层。

**优点**

1. registry API 小而清晰。
2. `createDefinitionResolverBundle()` 组合式设计合理。

**缺陷**

1. boolean decode 有明确 bug，见前述 finding。
2. 当前几乎没有进入主链消费，价值没有真正落地。
3. `register / getOrThrow` 使用裸 `Error`，不利于进入正式运行时。

**建议**

1. 如果保留这个包，就让 `runtime-shell-v2` 真正复用它，而不是自己再实现一套 parameter resolve。
2. 如果短期不进入主链，就明确把它标成 Tier 2 辅助层。

---

### 3.4 `execution-runtime`

**设计意图**

抽象一个更通用的 command execution runtime。

**优点**

1. middleware 链路清晰。
2. execution journal 很直观。
3. 测试写得比较完整。

**缺陷**

1. 当前不在主链中使用，和 `runtime-shell-v2` 形成重复叙事。
2. `registerHandler(commandName, handler)` 单执行者模型和你已经确认的“广播 actor + 聚合 result”主模型不一致。
3. 很多价值已经被 `runtime-shell-v2` 超越。

**建议**

1. 不建议继续扩展它。
2. 二选一：
   1. 要么明确降级成辅助实验层。
   2. 要么把它彻底吸收进 `runtime-shell-v2` 内部，不再单独公开。

按你当前方向，我建议第一种。

---

### 3.5 `state-runtime`

**设计意图**

作为 Redux 核心运行时，统一：

1. store 创建
2. owner-only persistence
3. record/field 粒度持久化
4. sync summary / diff 支撑

**优点**

1. 这是当前新版 kernel 最有价值的基础包之一。
2. 你要求的“按属性/按记录粒度持久化”、“支持 secureStateStorage”、“自动持久化”都已经落地。
3. `record manifest` 设计是对旧 `redux-persist` 整 slice 存储的明显升级。

**缺陷**

1. 全量签名性能问题，见高优 finding。
2. `serializableCheck: false / immutableCheck: false` 是现实妥协，但意味着 store 层防线被完全关闭。
3. `NOOP_LOGGER as any` 说明 logger contract 还没完全收口。

**建议**

1. 优先优化 persistence dirty tracking。
2. 给 `StateRuntimeSliceDescriptor` 增加更明确的性能约束文档。
3. 明确哪些 slice 禁止进入 persistence 热路径。

---

### 3.6 `runtime-shell-v2`

**设计意图**

作为新版 kernel 真正的执行内核，负责：

1. 模块装载
2. command 广播执行
3. actor result 聚合
4. request ledger
5. parameter / error catalog
6. state runtime 装载

**优点**

1. 这是当前新版 kernel 的核心枢纽，方向是对的。
2. `dispatchCommand / queryRequest / subscribeRequest` 公开面已经很适合业务和 UI 使用。
3. 你要求的 initialize 命令入口已经建立。

**缺陷**

1. 对外契约与实现不一致，见高优 finding。
2. `types/module.ts` 与 `types/runtime.ts` 循环依赖。
3. 仍有较多 `as any`。

**建议**

1. 先清理 request projection 假接口。
2. 再做 types shared 拆分，去掉循环依赖。
3. 最后做 branded type 穿透整改。

---

### 3.7 `transport-runtime`

**设计意图**

承接 HTTP / WS 基础设施，作为新通信基座。

**优点**

1. DSL 化 endpoint/profile 定义比旧 API 体系专业很多。
2. `createModuleHttpEndpointFactory` 非常符合你现在的模块定义方式。
3. HTTP 地址切换、失败重试、有效地址保持语义已经有测试。

**缺陷**

1. WS runtime 仍然偏底层，成熟度弱于 HTTP runtime。
2. `socket-runtime` 当前测试覆盖不到多地址 failover 这类复杂情形。
3. `callHttpEnvelope` 很实用，但错误映射还可以更细。

**建议**

1. 保持克制，不要重做成大包。
2. 但要继续补 socket policy 能力和测试。

---

### 3.8 `tcp-control-runtime-v2`

**设计意图**

承接终端激活、credential、binding、task result report。

**优点**

1. 包边界清楚。
2. live + restart recovery 场景覆盖完整。
3. 与 `server-config-v2` 配合方向正确。

**缺陷**

1. `module.ts` 内仍内置默认 fetch transport 与默认本地地址：
   [module.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/module.ts#L19)
2. 这会让“assembly 注入优先”和“默认测试能力”混在一起。

**建议**

1. 默认实现可以保留，但应更明确标为 test-friendly fallback。
2. 正式 assembly 应尽量强制注入 runtime，而不是长期依赖默认本地地址。

---

### 3.9 `tdp-sync-runtime-v2`

**设计意图**

承接 TDP 会话、projection 仓库、topic 生效值重算、system catalog bridge、command inbox 等。

**优点**

1. actor 已按职责拆开，这点很好。
2. topicDataChanged 广播模型已经接近你要的方向。
3. 真正把 projection 仓库持久化、优先级重算、system topic bridge 跑通了。

**缺陷**

1. `systemCatalogBridgeActor` 中 `updatedAt` 仍靠 `as any ?? Date.now()`，说明协议未完全收紧：  
   [systemCatalogBridgeActor.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/systemCatalogBridgeActor.ts#L23)
2. `tdpProjection` 用 `flushMode: 'immediate'`，配合当前 `state-runtime` 全量签名，会放大性能问题。
3. `httpService.ts` 默认 serverName 仍写死 `mock-terminal-platform`，虽然当前能接受，但后续建议再抽一层 topic/http service 元数据。

**建议**

1. 先不大改业务语义。
2. 先把 projection 持久化路径和 `state-runtime` 性能问题一起收口。

---

### 3.10 `topology-runtime-v2`

**设计意图**

承接双机拓扑、主副机 command 路由、状态同步、request snapshot/resume。

**优点**

1. 这是当前新版架构中第二个最关键的包。
2. 功能面已经很强，而且真实 live 测试很多。
3. 合并原 `topology-runtime` 和 `topology-client-runtime` 是正确决定。

**缺陷**

1. `orchestrator.ts` 已经达到 1000+ 行，复杂度过高：  
   [orchestrator.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime-v2/src/foundations/orchestrator.ts)
2. `syncSession.ts` 仍有 `'UNKNOWN' as any` 这种占位型实现。
3. `context`、`sync`、`dispatch`、`resume` 语义仍然耦在同一个 orchestrator 中。

**建议**

这是必须分解的：

1. `connection lifecycle`
2. `remote dispatch`
3. `request resume / lifecycle mirror`
4. `state sync session`

至少拆出 3 个内部协作对象，不要继续把所有行为堆在一个 orchestrator。

---

### 3.11 `workflow-runtime-v2`

**设计意图**

承接新版 workflow 定义、运行队列、持续观察、动态 definition 下发。

**优点**

1. 这是很有潜力的一块，方向明显优于旧 task。
2. `run$ + selector by requestId + queue` 这个模型已经建立。
3. 远端 definition topic 联动已打通。

**缺陷**

1. `engine.ts` 达到 1300+ 行，复杂度过高。
2. `workflowObservations` 没有 retention。
3. `scriptRuntime / connectorRuntime / engine` 之间的职责还不够锐利。

**建议**

后续你说要继续精修 workflow 设计，我认同。当前先不急着大改语义，但至少要：

1. 先补 observation retention。
2. 再拆 `engine` 内部 runner / queue / notifier / state projection。

---

### 3.12 `ui-runtime-v2`

**设计意图**

承接 screen registry、screen runtime、overlay runtime、uiVariables runtime。

**优点**

1. kernel runtime 这部分已经很完整了。
2. 明确去掉 React 依赖是正确的。
3. `rendererKey` 设计是升级点。

**缺陷**

1. 共享 registry 是包级单例：
   [selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/selectors/index.ts#L22)
2. 这和你允许的“最后写入者生效的全局可变状态”是一致的，但仍然意味着测试隔离和多 runtime 并存时有隐式影响。
3. 包内循环依赖存在。

**建议**

1. 既然你接受全局注册模型，就不用改成实例级 registry。
2. 但至少要把“这是全局共享 registry”写进正式文档和 README，而不是只有代码里隐式存在。

---

### 3.13 `host-runtime`

**设计意图**

更偏宿主侧 runtime，为 `dual-topology-host` 提供票据、hello、resume、relay、fault injection。

**优点**

1. 作为 mock/host 侧能力，设计是完整的。
2. fault injection 很有价值。

**缺陷**

1. 不在终端主链中。
2. 仍有不少裸 `Error`。
3. 当前更像“宿主服务内核”，而不是终端 kernel 基础层。

**建议**

1. 包本身不是坏设计。
2. 但建议在文档中明确它属于宿主/服务端辅助基础层，不属于终端业务模块迁移基座。

---

## 四、全局设计优点

这部分是我认为值得保留并继续强化的亮点。

1. `moduleName` 统一保留，而且所有包命名收口一致，这很好。
2. `hooks/index.ts` 规则注释贯彻得很一致，开发者一眼能看懂约束。
3. `errorMessages / systemParameters` 工厂化定义方向正确。
4. 时间、ID、日志、state persistence 已经初步形成统一基础设施。
5. 测试不再只是 reducer 级假测试，已经大量接近真实链路。

---

## 五、全局缺陷与整改顺序建议

### 第一阶段：先补“公开契约正确性”

1. 清理 `runtime-shell-v2` 的 request projection 假接口。
2. 修复 `definition-registry` boolean decode。
3. 清掉明显的 `'UNKNOWN' as any` / 假 branded 值占位。

### 第二阶段：补“基础设施长期稳定性”

1. 重做 `state-runtime` 的 persistence dirty tracking。
2. 给 `workflowObservations` 增加 retention。
3. 给 `transport-runtime` 的 socket policy 适度补强。

### 第三阶段：补“可维护性”

1. 拆 `topology-runtime-v2` orchestrator。
2. 拆 `workflow-runtime-v2` engine。
3. 清理 `runtime-shell-v2 / ui-runtime-v2` 循环依赖。

### 第四阶段：补“包分级与文档”

1. 明确 `1.1-base` 的 Tier 1 / Tier 2。
2. 标记哪些包是终端主链基座，哪些包是宿主/辅助层。
3. 形成“业务迁移只能基于 Tier 1”的规范。

---

## 六、按包状态建议

### 应继续作为主链基座强化

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

### 应明确定位为辅助/宿主/预备层

1. `definition-registry`
2. `execution-runtime`
3. `host-runtime`

---

## 七、最终结论

`1-kernel/1.1-base` 当前不是“设计很乱的半成品”，相反，它已经是一套**方向正确、主链成立、测试面较强**的新基座。

但它也还没有完全达到你要的“专业、边界明确、长期可维护”的最终状态。最重要的不是继续加功能，而是先收口这四件事：

1. 公开契约必须和真实实现一致。
2. 基础设施热路径不能靠全量序列化撑着。
3. 超大 orchestrator / engine 必须拆。
4. `1.1-base` 内部要尽快从“两套基础叙事并存”收口成“一套主链基座 + 一套辅助层”。

如果你要，我下一步可以继续做两件事之一：

1. 基于这份 review，输出一份 **`1-kernel/1.1-base` 整改路线图**，按优先级拆成可执行任务。
2. 直接从最高优先级开始，先修第一批基础问题：
   1. `runtime-shell-v2` 假接口收口
   2. `definition-registry` boolean decode
   3. `state-runtime` 持久化热路径优化设计

