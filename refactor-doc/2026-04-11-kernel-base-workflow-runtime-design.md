# 2026-04-11 kernel-base workflow-runtime 设计文档

## 1. 结论

旧 `_old_/1-kernel/1.1-cores/task` 不应迁移为新 `task` 包，而应迁移为：

`1-kernel/1.1-base/workflow-runtime`

它的定位是“客户端本地工作流编排运行时”，不是服务端 task 域，也不是 TDP `tcp.task.release` topic 的直接消费器。

这一版设计与上一轮最大的变化有两点：

1. `workflow` 对外不再是“最后才得到 Result”的模型，而是 `observable-first`。
2. `workflow` 运行采用“全局串行队列”，后进入的 workflow 会先处于 `WAITING_IN_QUEUE`。

也就是说：

1. `run` 的第一输出就是可订阅的 `Observable<WorkflowObservation>`。
2. `selector(requestId)` 返回的内容，与 `Observable` 发射内容完全同构。
3. 每个 workflow 从排队、运行、步骤推进、异常、最终结果，全部通过同一个 observation 协议持续可观测。

这版设计保留旧 `task` 包最有价值的能力：

1. 可注册的流程定义。
2. 按运行环境选择定义。
3. `command / externalCall / externalSubscribe / externalOn` 等扩展方向。
4. 流式 progress。
5. cancel。
6. timeout。
7. retry / skip / compensate。
8. loop 执行。
9. requestId 关联业务观测。

同时去掉旧设计里不应继承的部分：

1. 不再有 `TaskSystem.getInstance()` 全局单例。
2. 不再直接依赖 `storeEntry`。
3. 不再直接写 interconnection 的 request slice。
4. 不再让 workflow adapter 自己订阅全局 requestStatus。
5. 不再把服务端 `task_release / task_instance` 和客户端 workflow 混成一个概念。

---

## 2. 包职责

`workflow-runtime` 只负责本地流程编排。

负责：

1. workflow definition 注册与解析。
2. workflow run 创建。
3. 全局串行队列调度。
4. step 执行编排。
5. adapter 调度。
6. `Observable<WorkflowObservation>` 发射。
7. `WorkflowObservation` read model。
8. cancel / timeout / retry / skip / compensate / loop。
9. 将 workflow 终态与关键结果回收到 `request projection`。

不负责：

1. 服务端 `task_release / task_instance` 的建模。
2. TDP projection 同步。
3. TDP command inbox 消费。
4. TCP task result HTTP 上报。
5. React hooks。
6. 平台外设的具体实现。
7. 直接修改其他包 slice。

---

## 3. 与现有 base 包边界

### 3.1 与 runtime-shell

`runtime-shell` 仍然是包加载、command 注册、state 装配、request projection 的总入口。

`workflow-runtime` 以普通 `KernelRuntimeModule` 接入：

1. 提供 `moduleName`。
2. 提供 `stateSlices`。
3. 提供 `commands`。
4. 提供 `errorDefinitions`。
5. 提供 `parameterDefinitions`。
6. 在 `install(context)` 中注册 handler。

同时，`workflow-runtime` 还会在 install 时创建自己的 runtime-scoped workflow engine。

### 3.2 与 execution-runtime

`execution-runtime` 仍然是 command 真相源。

但 `workflow-runtime` 要区分两种入口：

1. `workflowRuntime.run$(input)`：observable-first，本包 runtime API。
2. `runWorkflow` command：跨包边界入口。

这两个入口不是重复能力，而是不同层级：

1. 业务包跨包调用时必须走 `runWorkflow` command。
2. 包内、测试、或者本包 selector/UI 桥接时，可以使用 `run$()`。
3. `runWorkflow` command 内部最终也是调用同一个 workflow engine。

不能让现有 command handler 直接返回 `Observable`，因为当前 `execution-runtime` 的 handler 模型是 `Promise<ExecutionResult>`，见：

1. [createExecutionRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/execution-runtime/src/foundations/createExecutionRuntime.ts)
2. [createKernelRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts)

因此正确做法是：

1. `run$()` 直接返回 `Observable<WorkflowObservation>`。
2. `runWorkflow` command 负责触发 `run$()`，并等待 workflow 终态，再将终态摘要作为 command result 返回。
3. 过程中所有细粒度状态进入 `WorkflowObservation` state。

### 3.3 与 topology-runtime

`topology-runtime` 负责 request lifecycle 和主副端 request projection。

`workflow-runtime` 不重建 requestStatus。

关系应为：

1. `runWorkflow` command 开始时，`runtime-shell` 已同步创建 request projection。
2. workflow 内部执行 command step 时，通过 `handlerContext.dispatchChild()` 执行子 command。
3. 子 command lifecycle 自动进入同一个 requestId。
4. workflow 自己的细粒度运行态不直接写 request projection，而是写 `WorkflowObservation`。
5. workflow 到终态时，`runWorkflow` command 返回终态摘要，进入 request projection。

因此：

1. `requestProjection` 负责“请求在跨端、跨 command 维度上是否完成”。
2. `WorkflowObservation` 负责“workflow 当前在排队、跑到哪一步、上下文和最终结果是什么”。

### 3.4 与 state-runtime

`workflow-runtime` 的可读状态放在 `state-runtime`。

建议 slice：

1. `workflowDefinitions`
2. `workflowObservations`
3. `workflowQueue`

`workflowDefinitions` 可以持久化。

`workflowObservations` 一阶段默认 runtime-only。

`workflowQueue` 一阶段默认 runtime-only。

原因：

1. queue 是本次进程内的控制面状态。
2. observation 更多是运行时观测，不应默认重启恢复后继续执行。
3. 如果未来要做 durable workflow，需要单独设计 replay / idempotency / compensation，不应在一阶段偷做。

### 3.5 与 topology-client-runtime

主副屏远程执行不由 `workflow-runtime` 自己发 WS。

规则：

1. workflow step 如果要远端执行，只能是 command step。
2. command routing context 由业务 command input 决定。
3. `topology-client-runtime` 负责远程 dispatch、远端 started 确认、projection mirror。
4. workflow 只等待 command step 的执行结果。

### 3.6 与 tcp-control-runtime / tdp-sync-runtime

`workflow-runtime` 不直接理解服务端 task。

如果业务收到 `tcp.task.release` projection 或 `REMOTE_CONTROL` command，需要业务包先把它消费成业务 state 或业务 command，然后按需调用 `runWorkflow` command 或 `run$()`。

结果上报也不由 `workflow-runtime` 自动做。

如果某个 workflow 的业务结果需要回报服务端 task instance，应由业务包在 workflow 终态后调用 `tcp-control-runtime.reportTaskResult`，或者在 workflow 里通过 command step 调用业务公开 command，再由该 command 调 `reportTaskResult`。

### 3.7 与 platform-ports

`workflow-runtime` 后续一定需要一个明确的脚本执行端口，但它不应被建模成 workflow adapter。

旧工程的正确分层值得继承：

1. `argsScript / resultScript / condition` 统一由独立脚本执行器负责。
2. `command / externalCall / externalSubscribe / externalOn` 这些节点动作才由 adapter 负责。
3. adapter 不负责解释或运行 workflow script。

因此新架构建议是：

1. 在 `platform-ports` 中补一个 `scriptExecutor` 风格的 port。
2. `workflow-runtime` 自己编排 `condition -> input script/mapping -> adapter execute -> output script/mapping`。
3. Android / Electron 继续复用旧工程已经比较成熟的脚本执行基础设施，不重复造轮子。
4. Node/Web 默认实现仍可保留开发调试友好的 `new Function` 风格兜底，但作为 port 的默认实现，而不是 workflow adapter 的职责。

---

## 4. moduleName 规则

新包必须有稳定 `moduleName`：

`kernel.base.workflow-runtime`

用途：

1. 日志 scope。
2. error definition 归属。
3. parameter definition 归属。
4. packageVersion 加载日志。
5. module dependency 声明。
6. definition 来源标记。

所有 workflow definition 也必须携带 `moduleName`。

---

## 5. 核心公开接口

### 5.1 Runtime API：`run$`

```ts
export interface RunWorkflowInput<TInput = unknown> {
    workflowKey: string
    requestId: RequestId
    input?: TInput
    workflowRunId?: WorkflowRunId
    context?: WorkflowRunContextInput
    options?: WorkflowRunOptions
}

export interface WorkflowRuntime {
    run$<TInput = unknown>(input: RunWorkflowInput<TInput>): Observable<WorkflowObservation>
    cancel(input: CancelWorkflowRunInput): void
    getObservation(requestId: RequestId): WorkflowObservation | undefined
}
```

语义：

1. `run$()` 返回时 workflow 可能已经是 `WAITING_IN_QUEUE`。
2. `Observable` 从第一次订阅起持续发射完整 observation 快照。
3. 到达终态后发射最后一次 observation，然后 complete。
4. 同一个 `requestId` 不允许重复创建第二个 active workflow run。
5. 如果 `requestId` 已存在 active run，直接返回该 requestId 对应 observation 流，或者抛结构化错误，默认建议抛错，避免语义含糊。

### 5.2 Public Command：`runWorkflow`

```ts
export interface RunWorkflowCommandInput<TInput = unknown> {
    workflowKey: string
    input?: TInput
    context?: WorkflowRunContextInput
    options?: WorkflowRunOptions
}
```

`runWorkflow` command 的职责：

1. 复用当前 command 的 `requestId`。
2. 内部调用 `workflowRuntime.run$({ requestId, ... })`。
3. 等待 workflow 到终态。
4. 将终态摘要作为 command result 返回。

也就是说：

1. `run$()` 是实时观察入口。
2. `runWorkflow` command 是跨包调用入口。
3. 它们底层跑的是同一个 workflow run。

### 5.3 Public Command：`cancelWorkflowRun`

```ts
export interface CancelWorkflowRunInput {
    requestId?: RequestId
    workflowRunId?: WorkflowRunId
    reason?: string
}
```

规则：

1. 至少给 `requestId` 或 `workflowRunId` 之一。
2. 优先按 `workflowRunId` 精确取消。
3. 队列中的 workflow 也允许取消。
4. 取消后 observable 发射终态 `CANCELLED` 并 complete。

### 5.4 Public Command：`registerWorkflowDefinitions`

```ts
export interface RegisterWorkflowDefinitionsInput {
    definitions: readonly WorkflowDefinition[]
    source: 'module' | 'host' | 'remote' | 'test'
    updatedAt?: number
}
```

### 5.5 Public Command：`removeWorkflowDefinition`

```ts
export interface RemoveWorkflowDefinitionInput {
    workflowKey: string
    definitionId?: string
}
```

---

## 6. Selector 规则

必须提供一个 selector，输入 `requestId`，返回内容与 `run$()` 发射内容完全相同。

建议公开：

1. `selectWorkflowObservationByRequestId(state, requestId)`
2. `selectWorkflowObservationStatusByRequestId(state, requestId)`
3. `selectWorkflowQueue(state)`
4. `selectActiveWorkflowObservation(state)`
5. `selectWorkflowDefinition(state, workflowKey)`

这里的核心规则是：

1. `Observable<WorkflowObservation>` 发射的结构。
2. selector 读取的 `WorkflowObservation` 结构。

必须 100% 同构。

不能出现“observable 是一套结构，selector 又是一套结构”。

---

## 7. ID 协议

所有 ID 使用 `contracts` 内统一运行时 ID 生成能力。

建议新增品牌类型：

```ts
export type WorkflowDefinitionId = Brand<string, 'WorkflowDefinitionId'>
export type WorkflowRunId = Brand<string, 'WorkflowRunId'>
export type WorkflowStepRunId = Brand<string, 'WorkflowStepRunId'>
```

ID 关系：

1. `requestId`：workflow 主观测 ID，也是 selector 键。
2. `commandId`：`runWorkflow` command 本身的 command ID。
3. `workflowRunId`：一次 workflow 实例 ID。
4. `stepRunId`：一次 step 执行 ID。
5. `childCommandId`：command step 调子 command 时由 runtime-shell 生成。

必须遵守：

1. 一个 `requestId` 在同一时刻只能对应一个 active workflow run。
2. 一个 workflow run 只能属于一个 requestId。
3. 一个 workflow run 可以包含多个 step run。
4. 一个 step run 如果是 command step，可以对应一个 child command。
5. 所有 observation/event 都必须带 `requestId / workflowRunId / stepRunId?`。

---

## 8. WorkflowDefinition 协议

### 8.1 定义结构

```ts
export interface WorkflowDefinition<TInput = unknown, TOutput = unknown> {
    definitionId?: WorkflowDefinitionId
    workflowKey: string
    moduleName: string
    name: string
    description?: string
    enabled: boolean
    version?: string
    tags?: readonly string[]
    platform?: WorkflowPlatformMatcher
    inputSchema?: WorkflowSchemaDescriptor
    outputSchema?: WorkflowSchemaDescriptor
    rootStep: WorkflowStepDefinition
    timeoutMs?: number
    defaultOptions?: WorkflowRunOptions
    createdAt?: number
    updatedAt?: number
}
```

### 8.2 平台匹配

旧包按 `operatingSystems.os / osVersion` 选择 definition。新包保留这个能力，但协议更明确：

```ts
export interface WorkflowPlatformMatcher {
    os?: string
    osVersion?: string
    deviceModel?: string
    runtimeVersion?: string
    capabilities?: readonly string[]
}
```

选择顺序：

1. `enabled=false` 的定义不参与。
2. 优先匹配 capability。
3. 再匹配 os / osVersion。
4. 再匹配 runtimeVersion。
5. 无平台条件的是 fallback。
6. 多个匹配时选择更具体的定义。
7. 仍冲突则按 `updatedAt` 最新者。

### 8.4 定义来源层级

旧 `task` 里，definition 实际来自两类地方：

1. 模块随包注册的本地 definition
2. state 中可动态更新、可持久化的 definition

新 `workflow-runtime` 已经扩成四层来源：

1. `module`
2. `host`
3. `remote`
4. `test`

但这里必须再把“来源优先级”和“同层内选择规则”写死，不然后续业务迁移会摇摆。

建议固定为：

1. 解析顺序先按 source：`host > remote > module > test`
2. 同一个 source 内，再按平台匹配和 `updatedAt` 选择最合适 definition
3. `test` 只用于测试覆盖，不参与正式产品运行时覆盖

原因：

1. `host` 是终端本地明确写入的定义，应该拥有最高优先级
2. `remote` 是服务器下发的运营配置，优先级高于模块内默认定义
3. `module` 是代码内兜底定义
4. `test` 只是测试注入，不应干扰正式解析

因此最终规则不是“把四个桶简单拼起来再按 `updatedAt` 取最新”，而是：

1. 先按 source 层级筛选可用候选集
2. 找到第一个有可用候选集的 source
3. 只在这个 source 内做最终 definition resolve

### 8.3 schema 描述

一阶段不引入重型 schema 库。

只定义轻量 descriptor：

```ts
export interface WorkflowSchemaDescriptor {
    schemaType: 'json-schema-lite'
    required?: readonly string[]
    properties?: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown'
        sensitive?: boolean
    }>
}
```

用途：

1. DEV 环境校验输入输出。
2. 日志脱敏。
3. 文档化 workflow 协议。
4. 未来可替换为更专业 validator，但一阶段不强制。

---

## 9. 输入协议

### 9.1 Command Input

`runWorkflow` command payload 只放业务输入：

```ts
{
    workflowKey: 'payment.scan-pay',
    input: {
        paymentRequestCode: 'PR001',
        amount: 1200
    },
    options: {
        loop: false
    }
}
```

不允许放：

1. store。
2. dispatch。
3. adapter 实例。
4. logger 实例。
5. React 对象。

### 9.2 Workflow Context Input

```ts
export interface WorkflowRunContextInput {
    businessKey?: string
    workspace?: string
    displayMode?: string
    instanceMode?: string
    attributes?: Record<string, unknown>
}
```

### 9.3 Runtime Context

```ts
export interface WorkflowRuntimeContext {
    requestId: RequestId
    commandId?: CommandId
    workflowRunId: WorkflowRunId
    workflowKey: string
    localNodeId: NodeId
    moduleName: string
    startedAt: number
    signal: AbortSignal
    logger: LoggerPort
    resolveParameter<T>(key: string): ResolvedParameter<T>
    resolveError(key: string): ResolvedErrorView
}
```

runtime context 只读。

adapter 不能直接修改 runtime context。

### 9.4 业务结果协议

旧 `task` 被业务真实依赖的一条语义是：

1. 业务经常只拿 `requestId`
2. 然后通过 request 结果去读最终输出
3. 甚至会直接读取类似 `requestStatus.results.context.root` 这种结果位置

这个做法不优雅，但业务确实依赖“只给 requestId 就能拿终态结果”。

新架构必须保留这个业务能力，但要把协议做清楚：

1. `run$()` / `selectWorkflowObservationByRequestId(requestId)` 是细粒度运行态真相源
2. `runWorkflow` command 的返回 summary 是跨包调用的终态摘要
3. request projection 里只放“稳定终态摘要”，不再塞整份 workflow observation

建议固定 request projection / command result 中的 workflow 摘要结构：

```ts
export interface RunWorkflowSummary {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
    result?: {
        output?: unknown
        variables?: Record<string, unknown>
        stepOutputs?: Record<string, unknown>
    }
    error?: WorkflowErrorView
    completedAt?: number
}
```

规则：

1. `output` 是 workflow 对外声明的最终输出
2. `variables` / `stepOutputs` 只作为兼容旧业务读取习惯的补充摘要
3. UI 或业务要看运行过程，一律读 observation selector
4. UI 或业务只关心完成结果时，可以只读 request projection summary

这样可以替代旧工程里那种：

1. 把整份 context 塞进 request results
2. 业务自己猜 `root/open/xxx` 到底在哪个字段里

新的明确约束是：

1. 最终对外结果优先读 `summary.result.output`
2. 兼容期如需读上下文痕迹，只能从 `summary.result.variables / stepOutputs` 读取
3. 不再鼓励业务直接依赖某个 stepKey 恰好叫 `root`

---

## 10. Context 协议

旧 `task` 把 `context: Record<string, any>` 作为全局共享可变对象。这个能力有用，且你的场景是闭合系统，所以不需要限制得过于死。

新设计保留脚本和可变上下文，但仍要让协议清晰。

拆成三层：

### 10.1 `input`

原始业务输入。

规则：

1. 原则上只读。
2. 每个 step 可读。
3. 不建议改写。

### 10.2 `variables`

workflow 内部共享变量。

```ts
export type WorkflowVariables = Record<string, unknown>
```

规则：

1. mapping 和 script 都可以写入。
2. step 完成后可合并 patch。
3. 最近一次 observation 必须反映最新变量快照。

### 10.3 `stepOutputs`

按 step key 记录输出。

```ts
export type WorkflowStepOutputs = Record<string, unknown>
```

### 10.4 Context Snapshot

```ts
export interface WorkflowContextSnapshot {
    input: unknown
    variables: Record<string, unknown>
    stepOutputs: Record<string, unknown>
    loopIndex: number
    updatedAt: number
}
```

日志和 state 存储 context 时仍要走脱敏 helper，但 script 本身不做过多能力限制。

---

## 11. Step 协议

### 11.1 Step 类型

```ts
export type WorkflowStepType =
    | 'flow'
    | 'command'
    | 'external-call'
    | 'external-subscribe'
    | 'external-on'
    | 'custom'
```

### 11.2 Step 定义

```ts
export interface WorkflowStepDefinition {
    stepKey: string
    name: string
    type: WorkflowStepType
    timeoutMs?: number
    condition?: WorkflowExpression
    input?: WorkflowInputMapping
    output?: WorkflowOutputMapping
    strategy?: WorkflowStepStrategy
    steps?: readonly WorkflowStepDefinition[]
}
```

### 11.3 flow step

`flow` 是顺序执行容器。

一阶段只支持串行。

你的补充要求是“多个 workflow 不能同时运行”，因此这里有两层串行：

1. workflow 内部 step 串行。
2. workflow 之间也串行。

### 11.4 command step

```ts
export interface WorkflowCommandStepInput {
    commandName: string
    payload: unknown
    context?: CommandRouteContext
    internal?: boolean
}
```

执行规则：

1. 使用 `handlerContext.dispatchChild()`。
2. 继承当前 requestId。
3. 子 command lifecycle 自动进入 request projection。
4. command step 输出等于 child command result。
5. command step 失败时按 strategy 处理。

禁止：

1. adapter 自己创建 commandId。
2. adapter 直接调用旧 `getCommandByName`。
3. adapter 直接订阅 requestStatus。

### 11.5 external-call step

用于一次性外部调用。

### 11.6 external-subscribe step

用于持续订阅外部事件。

语义：

1. 不是 durable queue。
2. cancel 后必须取消订阅。
3. timeout 后必须取消订阅。
4. observation 中要能看到订阅期间的 progress。

### 11.7 external-on step

用于等待一次外部事件。

### 11.8 custom step

保留扩展口。

---

## 12. Script / Expression 协议

这里按你的要求调整：不要限制过多。

因为这不是开放系统，workflow definition 和 script 都由业务自己负责，所以新设计应该：

1. 保留 script。
2. 不把 script 关进太小的能力盒子。
3. 只做最基本的可维护性和异常边界约束。

建议协议：

```ts
export type WorkflowExpression =
    | {type: 'path'; path: string}
    | {type: 'script'; language: 'javascript'; source: string}
```

script 规则改为：

1. DEV / PROD 都允许。
2. 不强制限制为只读 context snapshot。
3. 允许 script 读写当前 workflow context。
4. 允许 script 做数据整理、条件判断、结果映射、变量写入。
5. 但 script 的异常必须被 runtime 统一捕获并转成结构化 workflow error。
6. script 执行超时必须可控，避免卡死整个 workflow。

也就是说，不限制“能不能写”，只限制“出错和超时时必须被 runtime 接住”。

### 12.1 旧工程继承规则

旧工程这块不是“adapter 执行脚本”，而是两层职责明确分开：

1. `condition / argsScript / resultScript` 由 `base` 的脚本执行器执行。
2. 节点动作由 task adapter 执行。

这个分层在新架构里必须保留。

不能做成：

1. command adapter 内部顺手执行 script。
2. external-call adapter 自己决定如何解释 workflow expression。
3. 每个 adapter 各自实现一套脚本执行规则。

必须做成：

1. `workflow-runtime` 统一解释 definition 中的 expression / mapping / script。
2. adapter 只接收已经准备好的 step input。
3. adapter 返回原始 output / progress event。
4. `workflow-runtime` 再统一执行 output mapping / result script。

### 12.2 脚本执行端口

建议后续补充下面这个统一端口，位置放在 `platform-ports`：

```ts
export interface ScriptExecutorPort {
    execute<T = unknown>(input: {
        source: string
        params?: Record<string, unknown>
        globals?: Record<string, unknown>
        timeoutMs?: number
    }): Promise<T>
}
```

规则：

1. `workflow-runtime` 只依赖这个 port，不依赖具体平台实现。
2. Android / Electron 适配器层复用旧工程已有 `scriptsExecution` 能力。
3. DEV 环境可记录脚本源码摘要与执行耗时。
4. PROD 环境只记录脚本摘要、耗时、错误码，不直接打敏感原文。

### 12.3 workflow 内部标准执行链路

每个 step 的推荐标准执行链路是：

1. 读取当前 `WorkflowContextSnapshot`
2. 执行 `condition`
3. 若跳过，则生成 `step.skipped`
4. 执行 `input mapping / input script`
5. 调用对应 adapter 执行动作
6. 持续接收 adapter progress event
7. 执行 `output mapping / output script`
8. 更新 `variables / stepOutputs / observation`

这样能完整继承旧工程这几个真实场景：

1. 先用脚本把扫码结果整理成 command payload。
2. adapter 只负责真正发 command 或调外设。
3. 再用脚本把 command / 外设原始返回值整理成下游可用数据。

### 12.4 为什么不让脚本直接走 adapter

原因很直接：

1. script 是 workflow 定义解释层能力，不是节点动作执行层能力。
2. 同一个 script 规则需要在 `condition / input / output` 三处复用。
3. 如果下沉到 adapter，会造成每个 adapter 自己处理脚本语义，规则分裂。
4. 后续远程下发 workflowDefinitions 时，也更需要统一解释器，而不是 adapter 私有逻辑。

输入映射：

```ts
export interface WorkflowInputMapping {
    from?: string
    value?: unknown
    object?: Record<string, WorkflowExpression | unknown>
}
```

输出映射：

```ts
export interface WorkflowOutputMapping {
    toStepOutput?: boolean
    variables?: Record<string, WorkflowExpression>
    result?: WorkflowExpression
}
```

---

## 13. 核心观测协议：WorkflowObservation

这是本设计最关键的对象。

`run$()` 发射它。  
selector 也返回它。  
UI 和业务统一消费它。

```ts
export interface WorkflowObservation<TOutput = unknown> {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    status:
        | 'WAITING_IN_QUEUE'
        | 'RUNNING'
        | 'COMPLETED'
        | 'FAILED'
        | 'CANCELLED'
        | 'TIMED_OUT'
    queuePosition?: number
    startedAt: number
    updatedAt: number
    completedAt?: number
    cancelledAt?: number
    timedOutAt?: number
    progress: {
        current: number
        total: number
        percent: number
        activeStepKey?: string
    }
    loopIndex: number
    context: WorkflowContextSnapshot
    steps: Record<string, WorkflowStepObservation>
    events: readonly WorkflowEvent[]
    output?: TOutput
    error?: WorkflowErrorView
}
```

### 13.1 WorkflowStepObservation

```ts
export interface WorkflowStepObservation<TOutput = unknown> {
    stepRunId: WorkflowStepRunId
    stepKey: string
    type: WorkflowStepType
    status:
        | 'PENDING'
        | 'RUNNING'
        | 'COMPLETED'
        | 'SKIPPED'
        | 'FAILED'
        | 'CANCELLED'
        | 'TIMED_OUT'
    startedAt?: number
    updatedAt: number
    completedAt?: number
    output?: TOutput
    error?: WorkflowErrorView
    retryCount?: number
}
```

### 13.2 WorkflowEvent

```ts
export type WorkflowEventType =
    | 'workflow.waiting'
    | 'workflow.started'
    | 'workflow.loop.started'
    | 'workflow.loop.completed'
    | 'workflow.completed'
    | 'workflow.failed'
    | 'workflow.cancelled'
    | 'workflow.timed-out'
    | 'step.started'
    | 'step.progress'
    | 'step.completed'
    | 'step.skipped'
    | 'step.retrying'
    | 'step.compensating'
    | 'step.failed'
    | 'step.cancelled'
    | 'step.timed-out'
```

```ts
export interface WorkflowEvent<TPayload = unknown> {
    eventId: string
    requestId: RequestId
    workflowRunId: WorkflowRunId
    stepRunId?: WorkflowStepRunId
    stepKey?: string
    type: WorkflowEventType
    payload?: TPayload
    error?: WorkflowErrorView
    occurredAt: number
}
```

规则：

1. `events` 保存过程和结果。
2. `observation` 保存当前整份快照。
3. 每次发射 observable 都发当前整份 observation。
4. selector 返回的也是当前整份 observation。

---

## 14. 队列模型

这是你补充后的新增硬约束：

1. 多个 workflow 不能同时运行。
2. 第二个 workflow 可以提交。
3. 但如果前一个还没结束，第二个必须进入 `WAITING_IN_QUEUE`。

### 14.1 队列规则

建议采用 FIFO。

状态：

1. `idle`
2. `running`
3. `queued`

行为：

1. 当前没有 active workflow 时，新的 workflow 立刻进入 `RUNNING`。
2. 当前已有 active workflow 时，新的 workflow 进入 queue。
3. queue 中 workflow 的 `run$()` 立即发射 `WAITING_IN_QUEUE` observation。
4. 当前 active workflow 到终态后，queue 头部切为 `RUNNING`。
5. 被取消的 queued workflow 直接从 queue 移除，并发射 `CANCELLED`。

### 14.2 `workflowQueue` slice

```ts
export interface WorkflowQueueState {
    activeRequestId?: RequestId
    queuedRequestIds: readonly RequestId[]
    updatedAt: number
}
```

### 14.3 `queuePosition`

1. active workflow 没有 `queuePosition`。
2. queued workflow 有 `queuePosition`，从 1 开始。
3. 每次队列变化，queued workflow 对应 observation 要更新并重新发射。

---

## 15. Lifecycle 状态机

### 15.1 Workflow 状态

```ts
export type WorkflowRunStatus =
    | 'WAITING_IN_QUEUE'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMED_OUT'
```

### 15.2 Step 状态

```ts
export type WorkflowStepStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'COMPLETED'
    | 'SKIPPED'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMED_OUT'
```

### 15.3 错误策略

```ts
export interface WorkflowStepStrategy {
    onError?: 'fail' | 'retry' | 'skip' | 'compensate'
    retry?: {
        times: number
        intervalMs: number
        backoff?: 'fixed' | 'linear'
    }
    compensationStepKey?: string
}
```

默认 `onError = 'fail'`。

---

## 16. Loop 协议

保留旧 `task` 的 loop 能力。

```ts
export interface WorkflowRunOptions {
    loop?: boolean | {
        enabled: boolean
        maxLoops?: number
        intervalMs?: number
        resetVariables?: boolean
    }
    timeoutMs?: number
    progressHistoryLimit?: number
}
```

规则：

1. 默认不 loop。
2. `loop=true` 等价于无限 loop。
3. 测试可传 `maxLoops`。
4. 每轮 loop 都要更新 observation。
5. loop 中发生异常，按当前 step strategy 和 workflow timeout 规则处理。

---

## 17. Timeout 协议

分两层：

1. workflow 级 timeout。
2. step 级 timeout。

规则：

1. step timeout 只影响当前 step。
2. workflow timeout 终止整个 run。
3. timeout 必须更新 observation 为 `TIMED_OUT`。
4. timeout 必须写 event。
5. timeout 后迟到结果必须丢弃。

---

## 18. Adapter 协议

### 18.1 Adapter 接口

```ts
export interface WorkflowAdapter<TInput = unknown, TOutput = unknown> {
    type: WorkflowStepType
    execute(input: WorkflowAdapterExecuteInput<TInput>): AsyncIterable<WorkflowAdapterEvent<TOutput>> | Promise<TOutput>
}
```

### 18.2 Execute Input

```ts
export interface WorkflowAdapterExecuteInput<TInput = unknown> {
    requestId: RequestId
    commandId?: CommandId
    workflowRunId: WorkflowRunId
    stepRunId: WorkflowStepRunId
    stepKey: string
    input: TInput
    context: WorkflowContextSnapshot
    signal: AbortSignal
    logger: LoggerPort
    dispatchChild(input: DispatchChildCommandInput): Promise<ExecutionResult>
    resolveParameter<T>(key: string): ResolvedParameter<T>
}
```

### 18.3 Adapter Event

```ts
export type WorkflowAdapterEvent<TOutput = unknown> =
    | {type: 'progress'; payload?: unknown}
    | {type: 'output'; output: TOutput}
```

规则：

1. adapter 可以返回 Promise，适合一次性调用。
2. adapter 可以返回 AsyncIterable，适合持续进度。
3. adapter 抛错必须被 runtime 捕获并归一化。
4. adapter 不直接写 Redux。
5. adapter 不直接访问 runtime-shell。
6. adapter 不负责执行 workflow script / expression。
7. adapter 只处理 step 动作本身。

---

## 19. 异常处理规则

你要求“做好各类异常处理”，这块需要单独明确。

### 19.1 定义解析异常

场景：

1. workflow definition 不存在。
2. definition disabled。
3. 多个 definition 匹配冲突。
4. definition 结构非法。

处理：

1. 立刻生成 observation。
2. observation 直接进入 `FAILED`。
3. `events` 中写入 `workflow.failed`。
4. `run$()` 仍然发一次终态 observation 后 complete。

### 19.2 queue 异常

场景：

1. 同一个 `requestId` 重复 run active workflow。
2. 队列状态损坏。

处理：

1. 生成结构化 error。
2. 不允许 silently ignore。
3. 如果是重复提交，默认报错，不自动复用。

### 19.3 script 异常

场景：

1. `condition script` 抛错。
2. `input script` 抛错。
3. `output script` 抛错。

处理：

1. 统一归一化为 `workflowScriptFailed`。
2. 写入 step error。
3. 按 strategy 处理：retry / skip / compensate / fail。

### 19.4 adapter 异常

场景：

1. Promise reject。
2. AsyncIterable 中断。
3. 返回非法 payload。

处理：

1. 统一归一化为 `workflowAdapterFailed`。
2. 写入 observation。
3. 若该 step 已 timeout/cancel，迟到异常忽略。

### 19.5 cancel / timeout / stale result

最关键规则：

1. cancel 后任何迟到结果都必须丢弃。
2. timeout 后任何迟到结果都必须丢弃。
3. queue 中被取消的 workflow 不能再进入 running。
4. active workflow 终态后必须立刻释放队列。

### 19.6 observable 异常

不建议把业务异常走 `subscriber.error()`。

更稳的规则是：

1. workflow 业务异常都体现在 observation 的 `status=FAILED` 与 `error` 字段。
2. observable 只在“runtime 自己已经无法保证 observation 正确性”的致命错误下才 `error`。

这样 UI 和业务层只要订阅 next 即可，不会因为一次业务失败而丢失整个观测链。

---

## 20. State / Read Model

### 20.1 `workflowDefinitions`

```ts
export interface WorkflowDefinitionsState {
    byKey: Record<string, readonly WorkflowDefinition[]>
    updatedAt: number
}
```

### 20.2 `workflowObservations`

```ts
export interface WorkflowObservationsState {
    byRequestId: Record<string, WorkflowObservation>
    updatedAt: number
}
```

### 20.3 `workflowQueue`

```ts
export interface WorkflowQueueState {
    activeRequestId?: RequestId
    queuedRequestIds: readonly RequestId[]
    updatedAt: number
}
```

持久化建议：

1. `workflowDefinitions` 可持久化。
2. `workflowObservations` 一阶段默认不持久化。
3. `workflowQueue` 一阶段默认不持久化。

### 20.4 为什么 definitions 要持久化

旧 `task` 的一个真实业务价值是：

1. 动态 definition 可以通过 state 下发和更新
2. 终端重启后仍然保留
3. 不需要每次启动都重新走一次完整下发

这个价值在新架构必须保留。

因此：

1. `workflowDefinitions.bySource` 持久化是合理且必要的
2. 特别是 `host / remote` 两层，必须保留重启恢复能力
3. `workflowObservations / queue` 则不持久化，避免把未完成 workflow 恢复成伪活状态

---

## 21. ErrorMessages

建议：

1. `workflowDefinitionNotFound`
2. `workflowDefinitionDisabled`
3. `workflowDefinitionInvalid`
4. `workflowInputInvalid`
5. `workflowOutputInvalid`
6. `workflowRunDuplicateRequest`
7. `workflowRunNotFound`
8. `workflowRunAlreadyTerminal`
9. `workflowRunCancelled`
10. `workflowRunTimedOut`
11. `workflowStepTimedOut`
12. `workflowStepFailed`
13. `workflowAdapterNotFound`
14. `workflowAdapterFailed`
15. `workflowScriptFailed`
16. `workflowQueueCorrupted`

规则：

1. runtime 使用 `createAppError`。
2. observation 中使用脱敏后的 `WorkflowErrorView`。
3. DEV 可原文日志。
4. PROD 默认脱敏。

---

## 22. SystemParameters

建议参数：

1. `kernel.base.workflow-runtime.default-workflow-timeout-ms`
2. `kernel.base.workflow-runtime.default-step-timeout-ms`
3. `kernel.base.workflow-runtime.loop-interval-ms`
4. `kernel.base.workflow-runtime.progress-history-limit`
5. `kernel.base.workflow-runtime.script-timeout-ms`
6. `kernel.base.workflow-runtime.log-raw-context-in-dev`
7. `kernel.base.workflow-runtime.max-queued-runs`

这里删掉 `allow-script-expression`，因为按你的要求，不再做这类限制开关。

---

## 23. 日志协议

所有日志必须带：

1. `moduleName`
2. `workflowKey`
3. `workflowRunId`
4. `requestId`
5. `commandId`
6. `stepKey`
7. `stepRunId`

日志事件建议：

1. `workflow.queue.waiting`
2. `workflow.run.started`
3. `workflow.step.started`
4. `workflow.step.completed`
5. `workflow.step.failed`
6. `workflow.step.retrying`
7. `workflow.run.completed`
8. `workflow.run.failed`
9. `workflow.run.cancelled`
10. `workflow.run.timed-out`

敏感数据规则：

1. DEV 环境允许原文。
2. PROD 默认脱敏。
3. schema 中 `sensitive=true` 字段必须脱敏。
4. context / input / output 进入日志时必须走 helper。

---

## 24. 与旧 task 包的对应关系

| 旧概念 | 新概念 | 处理方式 |
| --- | --- | --- |
| `TaskSystem` | `WorkflowRuntime` | runtime-scoped，不做全局单例 |
| `TaskDefinition` | `WorkflowDefinition` | 保留定义注册与环境匹配 |
| `TaskNode` | `WorkflowStepDefinition` | 保留 flow / atomic step |
| `TaskAdapter` | `WorkflowAdapter` | Promise / AsyncIterable |
| `ProgressData` | `WorkflowObservation + WorkflowEvent` | 观测快照与事件分层 |
| `executeTask` | `runWorkflow` command / `run$()` runtime API | command 负责跨包，run$ 负责实时观测 |
| `cancel(requestId)` | `cancelWorkflowRun` | 按 requestId 或 workflowRunId 取消 |
| `taskDefinitions` slice | `workflowDefinitions` | 可持久化 |
| requestStatus 写 result | request projection + workflowObservation | 不再直接写旧 slice |
| `argsScript/resultScript` | path/script + mapping | 保留 script，不做过度限制 |

### 24.1 旧业务真实依赖的三条语义

从当前旧业务代码看，后续迁移时真正必须保住的是这三条：

1. `taskDefinitionKey` 可以由业务配置项引用，而不是只能写死在代码里
2. 业务层只拿 `requestId` 也能观察状态和读取最终结果
3. definition 可以动态更新并在重启后保留

新 `workflow-runtime` 对应落点应明确为：

1. `taskDefinitionKey` 升级成 `workflowKey`
2. `useRequestStatus(requestId)` 继续承担“请求是否完成”的粗粒度职责
3. `selectWorkflowObservationByRequestId(requestId)` 承担 workflow 细粒度观测职责
4. `workflowDefinitions` 承担动态 definition 的持久化职责

---

## 25. 典型业务链路

### 25.1 支付流程

新链路：

1. `pay-base.runPaymentRequest`
2. `pay-base.executePaymentWorkflow`
3. `runWorkflow` command
4. command handler 内部调用 `run$()`
5. 若前面已有 workflow 在跑，则 observation 先进入 `WAITING_IN_QUEUE`
6. 当前 workflow 开始后，command step 调子 command
7. observation 持续更新
8. workflow 到终态后，command result 进入 request projection

### 25.2 持续扫码

1. UI 或业务 command 调 `runWorkflow`。
2. UI 用 `requestId` selector 或 `run$()` 订阅 observation。
3. workflow loop 持续处理扫码事件。
4. 每轮 loop observation 都更新。
5. 取消时调用 `cancelWorkflowRun`。

### 25.3 服务端 remote control

1. `tdp-sync-runtime` 收到 `COMMAND_DELIVERED`。
2. 业务包消费 command inbox。
3. 业务包创建业务 command。
4. 业务 command 调 `runWorkflow`。
5. UI 或业务按 requestId 读取 observation。
6. workflow 终态后业务包再调 `reportTaskResult`。

---

## 26. 测试策略

### 26.1 单包测试

必须覆盖：

1. definition 注册。
2. definition resolve。
3. disabled definition 不可执行。
4. `run$()` 第一次发射 observation。
5. queued workflow 发射 `WAITING_IN_QUEUE`。
6. active workflow 结束后 queue 头开始 `RUNNING`。
7. selector 返回内容与 observable 发射内容同构。
8. command step 调 child command。
9. external-call adapter 成功。
10. external-call adapter 失败。
11. step timeout。
12. workflow timeout。
13. retry。
14. skip。
15. compensate。
16. cancel active workflow。
17. cancel queued workflow。
18. loop + maxLoops。
19. progress history limit。
20. script 抛错。
21. stale result 被忽略。

### 26.2 与 runtime-shell 集成测试

必须验证：

1. `runWorkflow` command 开始前 request projection 已同步进入 state。
2. workflow observation 可按 requestId 读取。
3. child command 进入同一个 requestId。
4. workflow 终态摘要合入 request projection。
5. workflow 业务失败不会走 observable.error，而是 observation `FAILED`。

### 26.3 与 topology-client-runtime 集成测试

必须验证：

1. 主屏发起 workflow。
2. workflow 内部 command step 远端执行。
3. 远端 started 先同步回主屏。
4. 主屏 request projection 不提前 complete。
5. observation 按 requestId 可持续看到状态变化。
6. 远端完成后主屏 request projection complete。

### 26.4 与 mock-terminal-platform 集成测试

必须验证：

1. `tcp.task.release` projection 被业务 read model 消费后触发 workflow。
2. `REMOTE_CONTROL` command inbox 被业务 read model 消费后触发 workflow。
3. observation 可完整看到运行过程与最终结果。
4. workflow 终态后业务 command 调用 `reportTaskResult`。
5. 服务端 task instance 进入 `COMPLETED / FAILED`。

---

## 27. 一阶段不做的能力

为了避免过度设计，一阶段不做：

1. durable workflow 重启续跑。
2. parallel step。
3. 分布式 workflow 调度。
4. workflow definition 云端市场。
5. 完整 JSON Schema validator。
6. 可视化 workflow designer。
7. saga 级长事务补偿框架。
8. workflow run 跨天持久化恢复。

---

## 28. 推荐文件结构

```text
1-kernel/1.1-base/workflow-runtime
  src
    application
      modulePreSetup.ts
    features
      commands
      slices
        workflowDefinitions.ts
        workflowObservations.ts
        workflowQueue.ts
    foundations
      createWorkflowEngine.ts
      createWorkflowRunner.ts
      createWorkflowObservable.ts
      definitionResolver.ts
      queue.ts
      progress.ts
      context.ts
      adapters
        commandAdapter.ts
        externalCallAdapter.ts
        externalOnAdapter.ts
        externalSubscribeAdapter.ts
    selectors
    supports
      errors.ts
      parameters.ts
    types
      definition.ts
      observation.ts
      step.ts
      adapter.ts
      runtime.ts
      state.ts
    hooks
      index.ts
    index.ts
    moduleName.ts
  test
    helpers
    scenarios
```

---

## 29. 实施切分建议

第一批只做最小闭环：

1. 包骨架。
2. definition 注册。
3. `workflowObservations` / `workflowQueue` slice。
4. `run$()` runtime API。
5. `runWorkflow` command。
6. 全局串行 queue。
7. 串行 flow。
8. command step。
9. selector(requestId)。
10. request projection 集成测试。

第二批补控制能力：

1. cancel。
2. timeout。
3. retry / skip / compensate。
4. loop + maxLoops。
5. stale result 丢弃。

第三批补外部 adapter：

1. external-call。
2. external-on。
3. external-subscribe。
4. script 错误与超时处理。

第四批补真实业务验证：

1. 支付式 workflow。
2. 扫码式 loop workflow。
3. 主副屏远端 command step。
4. mock-terminal-platform remote control result roundtrip。

---

## 30. 当前判断

前三步基础验证已经足够支撑进入 `workflow-runtime` 设计阶段：

1. `task panel reconnect` 已证明 TDP projection 可以进入业务 read model，并通过 topology 同步到副屏。
2. `REMOTE_CONTROL business read model` 已证明 command inbox 可以被业务消费，并通过 TCP 回报服务端结果。
3. `topology-client-runtime` WS 重连已收敛为与 TDP 一致的模型：生产无限重连、间隔参数化、测试可限次。

因此 `workflow-runtime` 不需要承担服务端 task 和双屏同步职责，可以专注做本地流程编排。

而且在你新增的三个约束下，`observable-first + requestId selector + 全局串行 queue` 会比上一版单纯 `Promise<Result>` 的模型更贴合真实业务。
