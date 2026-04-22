# 1-kernel/1.1-base 简化评审

日期：2026-04-14

目标：从“是否过度设计、是否可以更简单、是否为统一结构付出了过高复杂度”三个角度，重新审视 `1-kernel/1.1-base` 下各包。这里不讨论“有没有 bug”，只讨论“是否值得简化”。

评审方式：

1. 先按包扫描公开入口、目录结构、`application/createModule.ts`。
2. 再重点看大文件、复杂运行时、重复抽象。
3. 最后按“建议优先简化 / 可选简化 / 先保留”分类。

说明：

1. 本文默认认可当前重构总方向是正确的：职责拆分、协议显式、基础能力下沉。
2. 本文不是要把设计打回旧包，而是找出“新架构里已经开始为了整齐而变复杂”的地方。
3. 行号以当前仓库内容为准，后续修改后可能漂移。

---

## 总体判断

当前 `1-kernel/1.1-base` 的主要风险，不是职责拆分过多，而是这三类复杂度开始叠加：

1. 统一结构带来的空目录、空入口、空导出过多。
2. 一部分运行时把“核心流程、状态投影、日志、超时、桥接、重连、恢复”全部堆进一个文件。
3. 若干 helper / DSL / 中转层本意是提效，但在低复杂包上已经开始让阅读路径变长。

整体上，我认为：

1. `runtime-shell-v2 / state-runtime / topology-runtime-v2 / workflow-runtime-v2` 的大方向是对的，但内部需要降复杂度。
2. `contracts / platform-ports / definition-registry / execution-runtime / transport-runtime` 存在不少“结构统一优先于实际需要”的痕迹。
3. `host-runtime` 功能完整，但已经接近“一个独立子系统”，后续如果继续加功能，很容易变成新的重包。

---

## 一、建议优先简化

这些项我认为“简化收益高，风险可控，而且不简化会持续拉高后续业务开发心智负担”。

### 1. 全仓过多空壳目录与空入口，统一结构已经压过可读性

现象：

1. 大多数包都保留了 `src/application`、`src/hooks`、`src/selectors`、`src/supports`、`src/features/*` 等统一目录。
2. 其中很多目录在当前包里没有真实内容，只是为了“和别的包看起来一样”。
3. 大量 `index.ts` 只是注释 + `export {}`，或者仅做一层简单转发。

典型文件：

1. [contracts/src/hooks/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/contracts/src/hooks/index.ts)
2. [contracts/src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/contracts/src/selectors/index.ts)
3. [platform-ports/src/supports/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/platform-ports/src/supports/index.ts)
4. [execution-runtime/src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/execution-runtime/src/selectors/index.ts)
5. [host-runtime/src/hooks/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/host-runtime/src/hooks/index.ts)

问题：

1. 对新人而言，目录很多，但真正有东西的地方很少，阅读路径被拉长。
2. `src/index.ts -> application/index.ts -> foundations/*.ts` 的多跳转发，在简单包里没有实际收益。
3. “为了统一而统一”的结构，会让简单包看起来也像复杂包。

建议：

1. 保留仓库级结构规则，但允许“简单包裁剪空层”。
2. 对没有真实内容的 `hooks/selectors/supports/features`，直接删目录，不再保留空占位文件。
3. `src/index.ts` 允许直接导出真实文件，不必强制经过 `application/index.ts`。

建议优先级：高

---

### 2. `runtime-shell-v2` 单文件承担职责过多，已经接近第二个 ApplicationManager

核心文件：

1. [runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts)
2. [runtime-shell-v2/src/foundations/requestLedger.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/foundations/requestLedger.ts)

现象：

`createKernelRuntimeV2.ts` 同时处理：

1. runtime 初始化
2. state-runtime 装配
3. command dispatch
4. peer dispatch
5. actor 执行
6. 超时控制
7. request ledger 对接
8. 默认 catalog 注入
9. sync slice 应用
10. runtime start 生命周期日志

问题：

1. 虽然功能上没问题，但阅读时已经很难一眼抓住主流程。
2. 后续如果再加一个内核级能力，很容易继续往这个文件里堆。
3. 这会和你明确不喜欢的旧 `ApplicationManager` 风险越来越像。

建议：

把 `createKernelRuntimeV2.ts` 拆成更明确的内部单元，但不新增外部概念：

1. `runtimeBoot.ts`
2. `commandDispatcher.ts`
3. `actorExecutor.ts`
4. `peerDispatch.ts`
5. `catalogBootstrap.ts`
6. `stateSyncApply.ts`

注意：

1. 这是内部文件拆分，不是新增包。
2. 外部 API 不需要变化。

建议优先级：高

---

### 3. `workflow-runtime-v2` 引擎过重，已经把太多策略都塞进一个 engine

核心文件：

1. [workflow-runtime-v2/src/foundations/engine.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/workflow-runtime-v2/src/foundations/engine.ts)

现象：

这个文件接近 900 行，承担了：

1. observable 订阅分发
2. 运行队列
3. 排队状态更新
4. observation trim
5. definition 解析
6. workflow timeout
7. step timeout
8. 条件判断
9. retry
10. skip
11. compensate
12. cancel
13. terminal result 聚合
14. state 写入

问题：

1. 这是当前 `1-kernel/1.1-base` 里过度设计风险最高的文件。
2. 其中“队列管理”和“步骤执行策略”其实是两个不同维度，不应该长期揉在一起。
3. 后续业务一多，workflow 很可能继续膨胀。

建议：

优先做两层拆分：

1. `workflowQueueRuntime.ts`
   负责排队、激活、取消、完成、观察者通知
2. `workflowExecutor.ts`
   负责 definition 解析、step 执行、retry/skip/compensate/timeout

然后保留 `engine.ts` 作为很薄的一层装配。

这不是为了“学术漂亮”，而是为了后续你要继续打磨 workflow 输入/输出/context 协议时，不至于每改一处都动到整台机器。

建议优先级：高

---

### 4. `topology-runtime-v2` 编排器也过重，而且和 `tdp-sync-runtime-v2` 存在重复的连接控制形态

核心文件：

1. [topology-runtime-v2/src/foundations/orchestrator.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/topology-runtime-v2/src/foundations/orchestrator.ts)
2. [tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts)

现象：

二者都在做：

1. socket 绑定
2. reconnect timer
3. handshake / connected / disconnected / error
4. runtime state patch
5. message 分发
6. reconnect policy 解析

但两边各自有一套实现方式。

问题：

1. 这类“相似但不相同”的基础设施最容易以后越走越散。
2. 现在还没完全重复造轮子，但已经能看出控制流风格不统一。
3. 如果 topology / tdp 后面还会增强重连、会话恢复、metrics，这种分叉会越来越难维护。

建议：

不是强行抽成一个总线级大抽象，而是做一个轻量共用 helper：

1. 统一“socket lifecycle controller”最小骨架
2. 把“重连次数、延迟、手动断开、timer 清理、事件绑定”这类公共流程下沉
3. topology/tdp 只各自保留协议差异部分

这样比现在完全平行实现更稳，也比硬抽成通用超级 runtime 更克制。

建议优先级：高

---

### 5. `state-runtime` 持久化实现很强，但一个文件同时做了“描述模型 + 编码 + manifest + flush 策略 + hydrate + 变更检测”

核心文件：

1. [state-runtime/src/foundations/createStateRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts)

现象：

这个实现本身是有价值的，尤其是：

1. 字段级持久化
2. record 级别 key 拆分
3. plain / protected 分离
4. 自动 flush
5. 恢复与 patch 应用

问题：

1. 复杂度并不是来自功能错误，而是所有机制都集中在一个文件。
2. 后续如果再加加密策略、压缩策略、迁移策略，这里会继续爆炸。
3. 目前阅读成本已经明显高于“一个基础包该有的体感”。

建议：

内部拆分为：

1. `persistenceKeys.ts`
2. `persistenceEncode.ts`
3. `persistenceExport.ts`
4. `persistenceHydrate.ts`
5. `persistenceFlush.ts`
6. `persistenceChangeWatch.ts`

注意：

1. 我不建议削弱这个包的能力。
2. 我建议降低实现聚合度。

建议优先级：高

---

## 二、可选简化

这些项不是必须现在做，但如果你很在意“开发体验清爽”，它们值得逐步收紧。

### 6. 一部分 DSL/helper 已经开始“比直接写对象更绕”

典型文件：

1. [runtime-shell-v2/src/supports/moduleDsl.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/supports/moduleDsl.ts)
2. [transport-runtime/src/foundations/httpServiceFactory.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/httpServiceFactory.ts)

判断：

1. `createModuleCommandFactory`、`createModuleActorFactory` 是有价值的，建议保留。
2. `defineKernelRuntimeModuleManifestV2` 也是有价值的，能减少手写重复。
3. 但 `deriveKernelRuntimeModuleDescriptorV2(createModule)` 在多数业务包里，价值较弱，阅读时反而多一跳。
4. `httpServiceFactory` 能力强，但普通业务开发者不一定真需要这么泛化的工厂层。

建议：

1. 保留 command/actor factory。
2. 评估 descriptor 是否可以退为“仅 assembly/dev tooling 用”，不作为每包默认显式导出重点。
3. `httpServiceFactory` 可以保留底层实现，但对业务公开更薄的 `createXxxHttpService(...)` 风格。

建议优先级：中

---

### 7. `contracts / definition-registry / execution-runtime / platform-ports` 这些轻量包没必要强行长成“完整模块形态”

现象：

这些包里很多目录存在，但实际功能很薄。

例如：

1. [execution-runtime/src/application/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/execution-runtime/src/application/index.ts)
2. [definition-registry/src/application/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/definition-registry/src/application/index.ts)
3. [platform-ports/src/application/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/platform-ports/src/application/index.ts)

问题：

1. 它们不是 runtime module，不需要看起来像 runtime module。
2. 当前结构让读者误以为这些包有 actor/command/slice/application 等完整模块语义。

建议：

对这类基础工具包允许更直接的结构，例如：

1. `src/index.ts`
2. `src/foundations/*`
3. `src/types/*`
4. `src/supports/*`

不再硬保留 `features/*`、空 hooks、空 selectors。

建议优先级：中

---

### 8. `transport-runtime` 的 HTTP/Socket 运行时做得不错，但内部模型数有点偏多

核心文件：

1. [transport-runtime/src/foundations/httpRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/httpRuntime.ts)
2. [transport-runtime/src/foundations/socketRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/httpRuntime.ts)
3. [transport-runtime/src/foundations/httpServiceFactory.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/src/foundations/httpServiceFactory.ts)

问题：

1. `serverCatalog + executionController + endpoint factory + service factory + httpServiceModule` 对业务开发来说层次偏多。
2. `httpServiceModule` 当前几乎没有明显消费价值。
3. 若目标是“复用旧 communication 的优秀基础设施，但新架构更专业”，那这里的专业应该体现在边界清晰，而不是中间概念尽量多。

建议：

1. 评估删除或内收 `httpServiceModule`。
2. 保留 `createHttpRuntime` / `defineHttpEndpoint` / `createModuleHttpEndpointFactory` 三件核心武器即可。
3. 其余 helper 降为内部辅助。

建议优先级：中

---

### 9. `definition-registry` 和 `runtime-shell-v2.resolveParameter` 之间存在职责轻度重复

相关文件：

1. [definition-registry/src/supports/resolve.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/definition-registry/src/supports/resolve.ts)
2. [runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts)

现象：

1. `definition-registry` 有一套 parameter/error resolve。
2. `runtime-shell-v2` 内部又有一套自己的 parameter resolve。

问题：

1. 现在功能上还不冲突，但长期看容易产生两套规范。
2. 后面如果增加参数 decode/validation 规则，很可能要改两处。

建议：

1. 统一参数解析逻辑来源。
2. `runtime-shell-v2` 可以内联非常薄的一层，但核心 decode/validate/fallback 逻辑最好复用 `definition-registry`。

建议优先级：中

---

### 10. `ui-runtime-v2` 的共享 registry 放在 selector 文件里，位置不够直观

相关文件：

1. [ui-runtime-v2/src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/selectors/index.ts)

现象：

`sharedRegistry`、`registerUiScreenDefinition(s)`、`getUiScreenRegistry()` 都定义在 selector 文件里。

问题：

1. selector 文件承担了“读 state + 管 registry + 提供注册 API”三种角色。
2. 这不是严重 bug，但结构味道不够好。

建议：

1. 把 registry 相关 API 挪到 `foundations/screenRegistry.ts` 或 `application/runtimeRegistry.ts`。
2. selector 文件只保留只读查询。

建议优先级：中

---

## 三、先保留，不建议为简化而简化

这些地方虽然复杂，但我认为复杂度基本有业务价值。

### 11. `tcp-control-runtime-v2` 目前复杂度基本合理

判断：

1. 包体不大。
2. command、actor、state、http service 边界清楚。
3. 复杂度主要来自业务流程本身，而不是额外抽象。

建议：

1. 不做结构层面大改。
2. 只继续保持 `httpService` 定义体验更顺手即可。

---

### 12. `tdp-sync-runtime-v2` 的 projection 仓库与 topic change 语义本身值得保留

判断：

1. projection 原始仓库存 state
2. 运行时按优先级求 resolved projection
3. 再广播 `tdpTopicDataChanged`

这是符合你业务场景的，不属于过度设计。

需要简化的是实现聚合度，不是能力本身。

---

### 13. `topology-runtime-v2` 的恢复与连续同步机制值得保留

判断：

1. 请求生命周期镜像
2. 状态 summary / diff / ack
3. resume begin / complete

这些都是你双机业务真需求，不是“为了高级而高级”。

问题仍然是：文件太重、连接控制可以更统一。

---

### 14. `state-runtime` 的字段级/record 级持久化能力值得保留

判断：

1. 这是对旧 `redux-persist` 大对象持久化问题的关键超越。
2. 支持 protected storage 也符合你的明确诉求。

所以不建议砍能力，只建议拆实现。

---

## 四、可能已经“复杂度超过收益”的包

这几项我建议你重点拍板是否保留现状。

### A. `execution-runtime`

现状：

1. 有独立 middleware、journal、生命周期事件、child dispatch。
2. 仓库内实际使用几乎只有测试自身。

证据：

1. 代码搜索里几乎没有实际业务消费，主要在测试。

结论：

1. 高概率属于“设计过了头，但还没真正成为公共基建”。
2. 如果它不是后续明确要给业务层单独使用的通用 runtime，可以考虑弱化甚至并入别处。

建议：

1. 要么明确它的目标用户和场景。
2. 要么降级成更小的内部工具。

---

### B. `host-runtime`

现状：

1. 能力完整。
2. 但已经接近一个独立系统。
3. 当前主要消费方集中在 `0-mock-server/dual-topology-host`。

结论：

1. 如果它未来只服务 mock host，这个实现偏重。
2. 如果你未来还要把 host 模型长期作为“拓扑服务内核”，那它的重量是合理的。

建议：

1. 这项需要你业务判断。
2. 我个人倾向：暂时保留，不先简化功能，只警惕继续膨胀。

---

## 五、我建议的简化顺序

如果要开始动，建议顺序如下：

1. 先收缩空目录/空入口/空导出规则。
2. 再拆 `runtime-shell-v2` 内部实现文件。
3. 再拆 `workflow-runtime-v2` 的 queue 与 executor。
4. 再抽 `topology-runtime-v2` 和 `tdp-sync-runtime-v2` 的公共 socket lifecycle helper。
5. 再决定 `execution-runtime` 是否保留为公开基础包。

---

## 六、建议你先拍板的 8 个问题

1. 简单基础包是否允许不保留空的 `hooks/selectors/features` 目录？
2. `src/index.ts` 是否允许直接导出真实实现，而不是必须经过 `application/index.ts`？
3. `execution-runtime` 是不是还要作为公开基础包长期保留？
4. `host-runtime` 是否只是 mock server 基建，还是未来长期正式存在的 host 内核？
5. `runtime-shell-v2` 是否接受内部拆文件，但保持外部 API 不变？
6. `workflow-runtime-v2` 是否接受拆成 queue/runtime + executor 两层？
7. `topology-runtime-v2` 与 `tdp-sync-runtime-v2` 是否接受共用轻量 socket lifecycle helper？
8. `ui-runtime-v2` 的 screen registry 是否要从 selector 文件中迁出？

---

## 七、总结

当前 `1-kernel/1.1-base` 最大的问题，不是方向错了，而是“统一结构”和“抽象完整度”开始压过“开发者一眼能懂”。

最值得立即处理的，不是删功能，而是：

1. 删除没有真实价值的空层。
2. 把几个超级大文件拆开。
3. 收紧重复逻辑与重复控制流。

如果只用一句话概括：

当前 base 已经具备专业架构的骨架，但部分实现开始从“专业”滑向“重”。下一轮优化的目标，不该是继续加层，而是让同样的能力，用更短的阅读路径呈现出来。
