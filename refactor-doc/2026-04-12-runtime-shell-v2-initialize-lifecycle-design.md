# runtime-shell-v2 initialize 生命周期设计

## 1. 目标

为 `runtime-shell-v2` 补齐一个与旧工程 `kernelCoreBaseCommands.initialize` 对齐的统一启动生命周期：

1. `state` 持久化恢复完成后触发。
2. `module.install(...)` 装配完成后触发。
3. 通过一个全局广播 command 通知所有模块开始自己的运行时初始化。
4. `start()` 必须等待该初始化完成后才返回。

本设计替代 `KernelRuntimeModuleV2.initializeCommands` 的分散式启动脚本模式。

---

## 2. 结论

采用单一全局广播方案：

1. 在 `runtime-shell-v2` 内置 `runtimeShellV2CommandDefinitions.initialize`。
2. `createKernelRuntimeV2(...).start()` 固定执行：
   1. `hydratePersistence()`
   2. `module.install(...)`
   3. 广播 `runtimeShellV2CommandDefinitions.initialize`
   4. 等待所有 initialize actors 完成
   5. 运行时 ready
3. `KernelRuntimeModuleV2.initializeCommands` 废弃，不再作为新模块启动机制。
4. 需要自动启动的模块，一律监听全局 initialize，再发出自己的业务 command。

---

## 3. 命令定义

命令定义放在 `runtime-shell-v2` 内部：

```ts
runtimeShellV2CommandDefinitions.initialize = defineCommand<Record<string, never>>({
    moduleName,
    commandName: 'initialize',
    visibility: 'internal',
    allowNoActor: true,
    allowReentry: false,
    defaultTarget: 'local',
})
```

约束：

1. `initialize` 是运行时生命周期命令，不是业务公开 API。
2. `target` 固定为本地 runtime，不跨拓扑传播。
3. payload 为空对象，不额外设计生命周期协议。
4. 模块需要的上下文通过 `ActorExecutionContext` 和已恢复的 state 获取。

---

## 4. start 时序

`runtime.start()` 的唯一合法启动时序：

1. 构造阶段完成 store、actor handler 注册、module 列表装载。
2. 首次调用 `start()`。
3. 执行 `stateRuntime.hydratePersistence()`。
4. 依次执行所有 `module.install(...)`。
5. 广播 `runtimeShellV2CommandDefinitions.initialize`。
6. 等待该 request 内所有 actor 及其 child command 完成。
7. 若成功，`start()` 返回，runtime 进入 ready 状态。

说明：

1. initialize 是全局广播，所以多个模块都可以监听。
2. initialize actor 内部允许继续 `dispatchCommand(...)`，并进入同一个 request 聚合。
3. `install()` 早于 initialize，这保证 initialize actor 读取到的是已装配好的依赖和已恢复好的 state。

---

## 5. 幂等与异常

### 5.1 幂等

`start()` 必须幂等：

1. 首次调用时执行完整启动链。
2. 第二次及以后调用直接返回。
3. 不允许重复广播 initialize。

原因：

1. 避免重复连接、重复订阅、重复 bootstrap。
2. 与旧 `ApplicationManager.init()` 的 `initialized` 语义一致。

### 5.2 initialize 失败

`initialize` 是 runtime ready 的一部分，因此：

1. 如果 initialize 聚合状态是 `FAILED / PARTIAL_FAILED / TIMEOUT`，`start()` 必须 reject。
2. 失败信息保留在 `RequestLedger` 中，便于测试与排障。
3. runtime logger 需要输出一条明确的启动失败日志。

不采用“忽略失败继续启动”的原因：

1. 会把“runtime 未准备好”伪装成“已启动”。
2. TDP、拓扑、后续业务模块都会依赖这条生命周期。

---

## 6. 模块开发规范

以后模块遵守下面规则：

1. `module.install(context)` 只做装配，不做自动启动。
2. 需要自动启动时，定义 initialize actor，监听 `runtimeShellV2CommandDefinitions.initialize`。
3. initialize actor 里再发出模块自己的 bootstrap command。
4. 不再使用 `initializeCommands`。

推荐写法：

```ts
onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
    await context.dispatchCommand(createCommand(someModuleCommands.bootstrap, {}))
    return {}
})
```

适用场景：

1. TDP bootstrap
2. topology 自动连接
3. 本地恢复后重建运行时缓存
4. 业务级启动任务

不适用场景：

1. 纯依赖装配
2. service / engine / repository 引用创建
3. 常量注册

这些仍放在 `install()`。

---

## 7. 对当前 v2 包的影响

### 7.1 runtime-shell-v2

需要新增：

1. `initialize` command 定义
2. `start()` 的 initialize 广播与幂等控制
3. 启动失败日志

### 7.2 tdp-sync-runtime-v2

当前：

1. 使用 `initializeCommands: [bootstrapTdpSync]`

调整为：

1. 删除 `initializeCommands`
2. 新增 initialize actor，监听全局 initialize
3. 在 initialize actor 中 `dispatchCommand(bootstrapTdpSync)`

### 7.3 workflow-runtime-v2 / tcp-control-runtime-v2

当前不需要自动启动动作，因此：

1. 暂不需要 initialize actor
2. 保持 `install()` 只做装配

---

## 8. 测试要求

至少补下面测试：

1. `runtime-shell-v2`：
   1. `start()` 会在 `hydratePersistence + install` 后自动广播 initialize。
   2. `start()` 二次调用不会重复广播 initialize。
   3. initialize actor 失败时，`start()` reject，且 ledger 保留失败 request。
2. `tdp-sync-runtime-v2`：
   1. 通过全局 initialize 自动触发 bootstrap，而不是 `initializeCommands`。
   2. 持久化恢复后的自动 bootstrap 仍然成立。

---

## 9. 开发规范补充

新增规范：

1. `runtime-shell-v2` 是唯一启动生命周期入口。
2. 模块自动启动逻辑必须通过 initialize actor 实现。
3. `initializeCommands` 视为废弃接口，后续逐步从 v2 包中移除。
4. 任何涉及持久化恢复的模块，都要测试“恢复完成后 initialize 才触发”。
