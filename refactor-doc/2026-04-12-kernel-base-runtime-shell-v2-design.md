# 2026-04-12 kernel-base runtime-shell-v2 设计文档

## 1. 结论

`runtime-shell-v2` 是 `1-kernel/1.1-base` 第一阶段 v2 重构的总入口。

它不是对当前 `runtime-shell` 的小修补，而是重新定义一套更贴近旧工程心智、同时边界更清晰的运行时模型：

1. `Command` 是唯一业务消息载体。
2. `Actor` 是指令执行者。
3. 一个 command 默认广播给所有声明了该 command handler 的 actor。
4. actor 可以继续发出 child command。
5. request 真相源是内存 `RequestLedger`，不是 Redux。
6. 路由通过 `dispatch(..., {target})` 显式指定，不进入 payload。
7. runtime 启动生命周期由内置全局 `initialize` command 统一承载。

这一版的目标不是兼容旧 API，而是把旧 `base + interconnection` 里最有价值的语言重新立住：

1. 统一 runtime 装配。
2. 统一 command/actor 语言。
3. 统一 request 级观测。
4. 统一跨包写入边界。

同时去掉已经确认不再保留的东西：

1. `registerHandler` 单执行者模型。
2. “再引入一套广播 API”的双轨心智。
3. `dispatchChild` 这种需要额外记忆的命名。
4. `sessionId` 在节点内执行模型中的核心地位。
5. 把 request 真相写进 Redux 才能读状态的依赖。
6. `initializeCommands` 这类模块私有启动脚本。

---

## 2. 包身份

目标包：

1. 目录：`1-kernel/1.1-base/runtime-shell-v2`
2. 包名：`@impos2/kernel-base-runtime-shell-v2`
3. `moduleName`：`kernel.base.runtime-shell-v2`

说明：

1. `runtime-shell-v2` 是第一阶段唯一的节点内执行总入口。
2. 旧 `runtime-shell` 先保留，不再作为新设计继续扩展。
3. 后续 `tcp-control-runtime-v2 / tdp-sync-runtime-v2 / workflow-runtime-v2` 都依赖它。

---

## 3. 为什么必须做 v2

当前 `runtime-shell + execution-runtime` 已经解决了一部分问题，但核心心智仍然和旧工程错位：

1. `registerHandler(commandName, handler)` 默认只有一个执行者。
2. 为了补广播，又引入一套额外 actor 通道，开发者要思考“什么时候是 command，什么时候是广播”。
3. `dispatchChild` 和 `dispatch` 分成两套命名，增加记忆成本。
4. request projection 现在是可读的，但真相到底在 execution 还是 topology，心智仍然不够统一。
5. 节点内执行模型过于贴近当前实现，不够贴近旧工程里已经被业务长期验证的 `Command -> Actor` 语言。

用户已经明确拒绝继续沿“单执行者 command + 额外广播 actor”这条路往下走。

因此 `runtime-shell-v2` 的出发点必须直接回到旧工程的正确心智：

1. command 就是业务指令。
2. actor 就是指令执行者。
3. 一个 command 可以被多个 actor 执行。
4. 结果由运行时统一聚合。

---

## 4. 设计硬约束

### 4.1 开发者只需要理解一套模型

最终业务开发者只需要理解四件事：

1. 定义 command。
2. 定义 actor，并声明它处理哪些 command。
3. 调用 `dispatch(...)`。
4. 按 `requestId` 查询 request 运行结果。

不再要求开发者额外理解：

1. 另一套广播 API。
2. `sendToRemoteExecute` 这类隐式远程命令转换。
3. `dispatchChild` 与 `dispatch` 的差异。
4. request 必须进 Redux 才能被 UI 读取。

### 4.2 跨包写入规则必须继承旧工程

旧工程里已经事实成立的边界，这一版要显式固化：

1. store 的 state 允许全局读取。
2. 跨包读取优先通过 selector。
3. 跨包写入只能通过目标包公开 command。
4. slice action、reducer、actor handler 都不是跨包公开写接口。

### 4.3 `RequestLedger` 是唯一 request 真相源

这一点在 v2 里必须非常明确：

1. request 真相不进 Redux。
2. request 真相不依赖 topology projection。
3. request 真相由 `runtime-shell-v2` 内部的 `RequestLedger` 维护。
4. selector/query 面向的是 `RequestLedger` 的只读查询结果。

### 4.4 路由不进入 payload

统一写法：

```ts
runtime.dispatch(command, {target: 'local'})
runtime.dispatch(command, {target: 'peer'})
context.dispatch(command, {target: 'local'})
context.dispatch(command, {target: 'peer'})
```

说明：

1. command payload 只承载业务数据。
2. 路由是运行时语义，不再塞进 payload。
3. `peer` 不可达时直接失败，不做隐式 fallback。

### 4.5 默认值必须尽量简单

`defineCommand` 默认：

1. `visibility = public`
2. `timeoutMs = 60_000`
3. `allowNoActor = false`
4. `allowReentry = false`
5. `defaultTarget = local`

开发者只有在确实需要覆盖时才显式覆盖。

### 4.6 `1-kernel` 不依赖 React

`runtime-shell-v2` 不依赖 React。

`src/hooks/index.ts` 可以保留，但只放规则注释，不提供 React hook。

---

## 5. 核心对象模型

## 5.1 `CommandDefinition`

`CommandDefinition` 负责定义一种业务指令，不直接携带运行时上下文。

建议模型：

```ts
export interface CommandDefinition<TPayload = unknown> {
    moduleName: string
    commandName: string
    visibility: 'public' | 'internal'
    timeoutMs: number
    allowNoActor: boolean
    allowReentry: boolean
    defaultTarget: 'local' | 'peer'
}
```

约束：

1. `commandName` 必须稳定，格式为 `moduleName.localName`。
2. `visibility` 只决定跨包可见性，不影响运行时是否能执行。
3. `allowReentry` 是循环保护豁免开关，不是“无限递归许可”。

## 5.1.1 内置 `initialize` lifecycle command

`runtime-shell-v2` 内置一个全局广播生命周期命令：

```ts
runtimeShellV2CommandDefinitions.initialize = defineCommand<Record<string, never>>({
    moduleName,
    commandName: 'initialize',
    visibility: 'internal',
    allowNoActor: true,
    defaultTarget: 'local',
})
```

语义：

1. 它只表示本地 runtime 已完成持久化恢复和模块装配。
2. 它不会默认跨 peer/topology 传播。
3. payload 保持为空对象。
4. 模块需要自动启动时，监听该 command，再发出自己的 bootstrap command。

`runtime.start()` 固定时序：

1. `stateRuntime.hydratePersistence()`
2. `module.install(...)`
3. 广播 `runtimeShellV2CommandDefinitions.initialize`
4. 等待所有 initialize actors 完成
5. runtime ready

约束：

1. `start()` 幂等，重复调用不重复广播 initialize。
2. initialize 聚合结果为 `FAILED / PARTIAL_FAILED / TIMEOUT` 时，`start()` 直接失败。
3. 新模块不再使用 `initializeCommands`。

## 5.2 `CommandIntent`

`CommandIntent` 是 command 的运行时实例，代表一次具体 dispatch。

建议模型：

```ts
export interface CommandIntent<TPayload = unknown> {
    definition: CommandDefinition<TPayload>
    payload: TPayload
}
```

说明：

1. 业务代码创建的是 `CommandIntent`。
2. `requestId / commandId / parentCommandId / target` 都由 runtime 在 dispatch 时补齐。
3. 这保留了旧工程“command 是消息对象”的开发体验，但不再复用旧的全局类实例模型。

## 5.3 `ActorDefinition`

`ActorDefinition` 是执行者声明，不再是“事件广播接收器”。

建议模型：

```ts
export interface ActorDefinition {
    moduleName: string
    actorName: string
    actorKey: string
    handlers: readonly ActorCommandHandlerDefinition[]
}

export interface ActorCommandHandlerDefinition<TPayload = unknown> {
    commandName: string
    handle: (context: ActorExecutionContext<TPayload>) => Promise<Record<string, unknown> | void>
}
```

约束：

1. 一个 actor 可以处理多个 command。
2. 一个 command 也可以被多个 actor 同时处理。
3. actor 仍然是模块内声明对象，不对外暴露内部 handler。

## 5.4 `DispatchOptions`

```ts
export interface DispatchOptions {
    requestId?: RequestId
    parentCommandId?: CommandId
    target?: 'local' | 'peer'
    routeContext?: CommandRouteContext
}
```

说明：

1. 根 command 可不传 `requestId`，由 runtime 自动生成。
2. child command 自动继承同一个 `requestId`。
3. `parentCommandId` 由 runtime/handler context 自动补齐，业务层通常不手写。

## 5.5 `ActorExecutionContext`

这一版统一只保留 `dispatch` 一个名字。

```ts
export interface ActorExecutionContext<TPayload = unknown> {
    readonly runtimeId: RuntimeInstanceId
    readonly command: DispatchedCommand<TPayload>
    readonly actor: {
        actorKey: string
        moduleName: string
        actorName: string
    }
    getState(): RootState
    dispatchAction(action: UnknownAction): UnknownAction
    dispatch<TChildPayload = unknown>(
        command: CommandIntent<TChildPayload>,
        options?: Omit<DispatchOptions, 'requestId' | 'parentCommandId'>,
    ): Promise<CommandAggregateResult>
    queryRequest(requestId: RequestId): RequestQueryResult | undefined
    resolveError(...)
    resolveParameter(...)
}
```

说明：

1. 这里没有 `dispatchChild`，统一都叫 `dispatch`。
2. child command 会自动带上当前 `requestId` 和 `parentCommandId`。
3. actor 再发出的 command，也同样进入完整的 ledger 与聚合流程。

## 5.6 `DispatchedCommand`

```ts
export interface DispatchedCommand<TPayload = unknown> {
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    commandName: string
    payload: TPayload
    target: 'local' | 'peer'
    routeContext?: CommandRouteContext
    dispatchedAt: TimestampMs
}
```

`sessionId` 从 v2 的节点内执行模型中去掉。

---

## 6. 结果协议

## 6.1 `ActorExecutionResult`

```ts
export interface ActorExecutionResult {
    actorKey: string
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT'
    startedAt?: TimestampMs
    completedAt?: TimestampMs
    result?: Record<string, unknown>
    error?: AppError
}
```

## 6.2 `CommandAggregateResult`

```ts
export interface CommandAggregateResult {
    requestId: RequestId
    commandId: CommandId
    parentCommandId?: CommandId
    commandName: string
    target: 'local' | 'peer'
    status: 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED' | 'TIMEOUT'
    startedAt: TimestampMs
    completedAt: TimestampMs
    actorResults: readonly ActorExecutionResult[]
}
```

这一版不提供“隐式合并后的业务 result 真相”。

理由：

1. 一个 command 可以由多个 actor 执行。
2. 多 actor 的返回值不存在通用的自动合并语义。
3. 强行做 `mergedResult` 很容易重新引入隐式覆盖。

因此：

1. 真相是 `actorResults`。
2. 上层如果确实需要统一摘要，可在自己的 command/actor 中显式整理。

## 6.3 状态归约规则

1. `COMPLETED`
   条件：至少有一个 actor 执行，且全部执行成功。
2. `PARTIAL_FAILED`
   条件：至少一个 actor 成功，且至少一个 actor 失败。
3. `FAILED`
   条件：
   1. 所有 actor 都失败。
   2. 没有命中 actor，且 `allowNoActor = false`。
4. `TIMEOUT`
   条件：命令级 timeout 到达时，仍存在未完成 actor。

补充：

1. `allowNoActor = true` 时，如果没有命中 actor，返回 `COMPLETED`，`actorResults` 为空。
2. `TIMEOUT` 仍然保留已完成 actor 的结果，便于排障与上层兜底。

---

## 7. `RequestLedger`

## 7.1 定位

`RequestLedger` 是 `runtime-shell-v2` 内部的 request 真相源。

负责：

1. request 注册。
2. command 树注册。
3. actor 执行状态跟踪。
4. 聚合结果收敛。
5. 查询与订阅。

不负责：

1. Redux 持久化。
2. 跨节点镜像。
3. transport ack。
4. projection 仓库。

## 7.2 `RequestQueryResult`

建议查询结果：

```ts
export interface RequestQueryResult {
    requestId: RequestId
    rootCommandId: CommandId
    status: 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED' | 'TIMEOUT'
    startedAt: TimestampMs
    updatedAt: TimestampMs
    commands: readonly CommandAggregateResult[]
}
```

设计理由：

1. UI/业务最关心的是“这个 request 现在跑到哪了，最后怎么样了”。
2. `commands` 直接展示整个请求链路下所有 command 的聚合结果。
3. 这比旧工程只靠 request slice 的简化状态更可解释。

## 7.3 查询与订阅接口

`runtime-shell-v2` 对外至少暴露：

1. `queryRequest(requestId)`
2. `subscribeRequests(listener)`
3. `subscribeRequest(requestId, listener)`

说明：

1. `1-kernel` 只提供查询与订阅，不提供 React hook。
2. `2-ui` 后续可以基于这个订阅接口包装自己的 hook/selectors。
3. request 不是 Redux 真相，但对 UI 仍然是即时可读的。

## 7.4 同步时序要求

这一点必须显式继承旧工程的关键特征：

1. 在 actor handler 真正开始前，请求状态必须已经进入“运行中”。
2. 不能出现“command 已经执行了，但 request 还没变”的异步缝隙。

因此节点内执行的同步边界必须是：

1. `dispatch` 创建 root request record 是同步的。
2. child command 注册到同一 request 是同步的。
3. 某个 actor handler 即将进入前，`RequestLedger` 同步写入该 actor execution 的 started 状态。
4. actor handler 结束后，同步写入 completed/failed/timed out。

这正是后续主副机 request 正确衔接的前提。

---

## 8. 执行流程

## 8.1 local command

本地执行流程：

```text
dispatch(commandIntent, options)
-> 归一化 target / routeContext / requestId / parentCommandId
-> 创建 commandId
-> RequestLedger 同步注册 request 与 command
-> 按 commandName 查找所有匹配 actor handler
-> 为每个 actor 建立 execution record
-> 逐个标记 started，然后并行执行 handler Promise
-> handler 内可继续 dispatch child command
-> 汇总所有 actor result
-> 计算 CommandAggregateResult
-> 回写 RequestLedger
-> 返回 aggregate result
```

几个关键点：

1. actor 查找是 O(1) 的 `commandName -> handlers[]` 索引，不再全量扫描所有 actor。
2. actor 启动顺序固定为模块依赖顺序 + actor 注册顺序。
3. handler Promise 可以并行结算，但聚合顺序必须稳定。

## 8.2 peer command

`peer` 路由是保留在 `runtime-shell-v2` API 里的正式语义，但真正跨节点协议不在第一阶段实现。

第一阶段规则：

1. `target = 'peer'` 时，由 runtime 的 peer dispatch 端口接管。
2. 如果未装配 `topology-runtime-v2`，立即返回结构化错误。
3. 不做隐式 fallback 到 `local`。

这样做的原因：

1. 业务代码从第一天就用统一写法。
2. 第二阶段只替换 peer 承载，不改业务调用面。

## 8.3 actor 再发出 child command

这是旧工程最重要的能力之一，v2 必须保留。

规则：

1. child command 自动继承同一个 `requestId`。
2. child command 自动带上当前 `commandId` 作为 `parentCommandId`。
3. child command 与 root command 使用完全相同的 dispatch 流程。
4. child command 的聚合结果进入同一个 request ledger。

允许的场景：

1. `CommandA -> Actor1.handle(CommandA) -> dispatch(CommandB) -> Actor1.handle(CommandB)`
2. `CommandA -> Actor1 -> dispatch(CommandB) -> Actor2`
3. `CommandA -> Actor1 -> dispatch(CommandB target=peer)`

---

## 9. 循环保护

## 9.1 为什么不能简单禁止“同 actor 再执行”

用户已经明确确认下面场景必须允许：

1. `CommandA` 由 `Actor1` 处理。
2. `Actor1` 再发出 `CommandB`。
3. `CommandB` 仍然由 `Actor1` 的另一个 handler 处理。

因此不能按 actor 名称做粗暴禁止。

## 9.2 默认保护规则

默认保护单位是：

`commandName + actorKey + 当前执行链`

也就是：

1. 同一执行链里，同一个 actor 再次处理同一个 command，默认视为循环。
2. 同 actor 处理不同 command，允许。
3. 同 command 被不同 actor 处理，允许。

## 9.3 `allowReentry`

当某个 command 天然允许重复进入同一 actor 时，可以把 command definition 的 `allowReentry` 设为 `true`。

但这不是无限递归开关，运行时仍应记录链路深度与路径，便于：

1. 排障日志。
2. request 查询。
3. 后续加最大深度保护。

---

## 10. 模块接入方式

## 10.1 `KernelRuntimeModuleV2`

`runtime-shell-v2` 仍然继承旧工程“模块 manifest 化”的长处。

建议模块契约：

```ts
export interface KernelRuntimeModuleV2 extends AppModule {
    dependencies?: readonly AppModuleDependency[]
    stateSlices?: readonly StateRuntimeSliceDescriptor<any>[]
    commandDefinitions?: readonly CommandDefinition[]
    actorDefinitions?: readonly ActorDefinition[]
    install?: (context: RuntimeModuleInstallContextV2) => Promise<void> | void
    initializeCommands?: readonly CommandIntent[]
}
```

说明：

1. `install` 仍然存在，但其职责是注册/装配，不是直接执行内部业务流程。
2. actor 和 command definition 都是稳定公开声明语言的一部分。
3. 模块依赖解析继续由 runtime 统一完成。

## 10.2 `moduleName` 必须保留

每个 v2 包都必须继续保留：

1. `src/moduleName.ts`
2. 稳定 `moduleName`

用途：

1. command 名字前缀。
2. actor key 前缀。
3. 日志 scope。
4. error / parameter 归属。
5. state slice key 归属。

---

## 11. errorMessages / systemParameters 在 v2 中的位置

这一版不能丢掉运行时错误与参数目录能力。

因此 `runtime-shell-v2` 仍然负责：

1. 默认 error definition 注册。
2. 默认 parameter definition 注册。
3. 运行态 error catalog 解析。
4. 运行态 parameter catalog 解析。

同时必须为后续 `tdp-sync-runtime-v2` 预留正式 command：

1. `upsertErrorCatalogEntries`
2. `removeErrorCatalogEntries`
3. `upsertParameterCatalogEntries`
4. `removeParameterCatalogEntries`

这样后续 special topic bridge 才有正式写入口。

补充约束：

1. error/parameter 的运行态可变值应走 `state-runtime` 存储。
2. `runtime-shell-v2` 负责公开 resolve/query 能力。
3. 写 catalog 的 command 仍由 `runtime-shell-v2` 自己定义并自己处理。

---

## 12. 日志与启动可观测性

`runtime-shell-v2` 启动时必须打正式 load 日志，风格对齐当前 `ApplicationManager`，但结构化输出。

至少包括：

1. runtimeId
2. localNodeId
3. module 数量与 moduleName 列表
4. command 数量
5. actor 数量
6. state slice 数量
7. error definition 数量
8. parameter definition 数量
9. packageVersion / protocolVersion / runtimeVersion

日志分类建议：

1. `runtime.lifecycle`
2. `runtime.load`
3. `command.lifecycle`
4. `request.lifecycle`

---

## 13. 与其他 v2 包的边界

## 13.1 与 `tcp-control-runtime-v2`

`runtime-shell-v2` 不负责 HTTP 业务，不直接理解 terminal activation / credential。

它只负责：

1. command/actor 执行。
2. request ledger。
3. error/parameter resolve。

## 13.2 与 `tdp-sync-runtime-v2`

`runtime-shell-v2` 不负责 projection 仓库与 scope priority。

但它要提供：

1. 能被 `tdp-sync-runtime-v2` 广播消费的 command 执行模型。
2. error/parameter 目录更新 command。

## 13.3 与 `workflow-runtime-v2`

`workflow-runtime-v2` 可以依赖 `runtime-shell-v2` 的统一 dispatch 与 request query。

但 workflow 自己的 queue/observation 不属于 `runtime-shell-v2`。

## 13.4 与 `topology-runtime-v2`

第二阶段里：

1. `runtime-shell-v2` 继续拥有节点内 request 真相。
2. `topology-runtime-v2` 负责 peer 路由与跨节点 envelope。
3. 两者通过 `peer dispatch gateway + remote lifecycle bridge` 对接。

---

## 14. MVP 范围

`runtime-shell-v2` 第一阶段只做节点内稳定模型，不在这里提前做过多拓扑设计。

第一阶段必须实现：

1. command definition / intent 工厂
2. actor definition / handler 注册
3. 单次 dispatch
4. 多 actor 广播执行
5. child command
6. `RequestLedger`
7. `queryRequest / subscribeRequest`
8. error/parameter catalog resolve 与 update command
9. 基础 load / command / request 日志

第一阶段不实现：

1. Redux request state 真相
2. `peer` 真正跨节点执行
3. transport ack
4. workflow queue
5. projection 仓库

---

## 15. 测试门槛

`runtime-shell-v2` 的测试必须全部以 command 为入口。

至少覆盖：

1. 一个 command 被两个 actor 同时处理，并返回稳定 `CommandAggregateResult`
2. `allowNoActor = false` 时无执行者失败
3. `allowNoActor = true` 时无执行者成功
4. actor 内部 `dispatch` child command，child 与 parent 进入同一个 request
5. `CommandA -> Actor1 -> CommandB -> Actor1` 合法场景
6. 同一 actor 同一 command 的默认循环保护
7. `allowReentry = true` 的豁免场景
8. timeout 后返回 `TIMEOUT`
9. request 在 actor handler 进入前已经可查询到 `RUNNING`
10. `queryRequest` 与订阅结果实时更新
11. `peer` 未装配时显式失败，不隐式 fallback

验收标准：

1. 业务方只需要理解一套 command/actor 模型。
2. request 不进 Redux，但前端/业务仍可即时查询运行状态。
3. 后续 `tcp-control-runtime-v2 / tdp-sync-runtime-v2 / workflow-runtime-v2` 可以直接基于这套模型继续设计。

---

## 16. 下一步

`runtime-shell-v2` 设计确认后，下一步顺序为：

1. `tcp-control-runtime-v2` 设计文档
2. `tdp-sync-runtime-v2` 设计文档
3. `workflow-runtime-v2` 设计文档

然后再进入第一阶段实现。
