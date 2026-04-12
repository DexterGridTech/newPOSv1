# 2026-04-11 kernel-base 基础包 errors / parameters 补充回填记录

## 本次目标

本次工作聚焦已经完成首轮重构的基础包，把仍散落在实现中的稳定错误语义与稳定运行参数回填为公开定义，并确保这些定义已经接入运行时代码与测试。

覆盖范围：

1. `1-kernel/1.1-base/execution-runtime`
2. `1-kernel/1.1-base/runtime-shell`
3. `1-kernel/1.1-base/topology-runtime`
4. `1-kernel/1.1-base/transport-runtime`
5. `1-kernel/1.1-base/host-runtime`
6. `1-kernel/1.1-base/state-runtime`

---

## 已完成内容

### execution-runtime

新增：

1. `src/supports/errors.ts`

公开错误定义：

1. `kernel.base.execution-runtime.command_not_found`
2. `kernel.base.execution-runtime.command_execution_failed`

实现已改为直接使用这组定义。

### runtime-shell

新增：

1. `src/supports/errors.ts`

公开错误定义：

1. `kernel.base.runtime-shell.execute_failed`

实现接线：

1. 根命令执行兜底错误改为使用 `runtimeShellErrorDefinitions.executeFailed`
2. runtime 启动时会把 `execution-runtime / topology-runtime / runtime-shell` 的内建错误定义注册进 registry
3. 若 `errorCatalog` 没有对应项，会自动补默认 catalog entry

### topology-runtime

新增：

1. `src/supports/errors.ts`

公开错误定义：

1. `kernel.base.topology-runtime.request_already_registered`
2. `kernel.base.topology-runtime.request_not_found`
3. `kernel.base.topology-runtime.command_not_found`
4. `kernel.base.topology-runtime.command_parent_not_found`
5. `kernel.base.topology-runtime.remote_command_failed`

`ownerLedger.ts` 已全部切换为使用公开定义。

### transport-runtime

新增：

1. `src/supports/errors.ts`

公开错误定义：

1. `kernel.base.transport-runtime.configuration_error`
2. `kernel.base.transport-runtime.network_error`
3. `kernel.base.transport-runtime.parse_error`
4. `kernel.base.transport-runtime.http_runtime_failed`
5. `kernel.base.transport-runtime.socket_runtime_failed`

实现接线：

1. configuration/network/parse helper 已迁入 `supports/errors.ts`
2. `httpRuntime.ts` 已改为使用 `http_runtime_failed`
3. `socketRuntime.ts` 已改为使用 `socket_runtime_failed`
4. `shared.ts` 保留兼容转导出，避免当前内部实现大面积联动

### host-runtime

新增：

1. `src/supports/parameters.ts`

公开参数定义：

1. `kernel.base.host-runtime.heartbeat-timeout-ms`
2. `kernel.base.host-runtime.max-observation-events`

实现接线：

1. `createHostRuntime()` 中默认心跳超时已改为读取 `hostRuntimeParameterDefinitions.heartbeatTimeoutMs.defaultValue`
2. 观测事件保留数量默认值已改为读取 `hostRuntimeParameterDefinitions.maxObservationEvents.defaultValue`

说明：

1. `host-runtime` 目前仍是独立 runtime
2. 本次先建立公开默认值真相源，不强行接进 `runtime-shell parameterCatalog`

### state-runtime

新增：

1. `src/supports/errors.ts`
2. `src/supports/parameters.ts`

公开错误定义：

1. `kernel.base.state-runtime.protected_persistence_storage_missing`

公开参数定义：

1. `kernel.base.state-runtime.persistence.debounce-ms`

实现接线：

1. 缺失 `secureStateStorage` 且存在 `protected` persistence 条目时，改为抛结构化 `AppError`
2. 默认持久化 debounce 时间改为从公开 `ParameterDefinition` 读取
3. 结构化错误覆盖 `hydrate` 与 `flush` 两个持久化阶段
4. `runtime-shell` 已把 `state-runtime` 的内建错误和参数定义一并注册进统一 registry/catalog

说明：

1. `state-runtime` 仍保持纯通用基础设施，不引入业务语义
2. `protected` persistence 不允许 silent fallback 到明文存储

---

## 补充测试

### transport-runtime

新增验证：

1. 缺失 path param 时抛出结构化 `configuration_error`
2. 未注册 socket profile 时抛出结构化 `socket_runtime_failed`
3. 双屏 socket 场景继续使用 `0-mock-server/dual-topology-host`

### runtime-shell

新增验证：

1. `runtimeShellErrorDefinitions.executeFailed` 会在 runtime 启动后进入默认 `errorCatalog`

### host-runtime

新增验证：

1. 默认心跳超时行为确实来自公开参数定义，而不是写死在实现里

### state-runtime

新增验证：

1. 缺失 `secureStateStorage` 时抛出结构化 `protected_persistence_storage_missing`
2. `persistence.debounce-ms` 默认值和校验逻辑通过公开 `ParameterDefinition` 暴露
3. `runtime-shell` 启动后可在默认 `errorCatalog / parameterCatalog` 中读取 `state-runtime` 的内建定义

---

## 当前结论

这轮回填后，基础包里“已经形成稳定语义，但还写在实现内部”的关键错误与参数，已经完成第一轮公开化。

保留不动的部分主要是：

1. 纯内部编程期断言
2. 还没有形成全包统一语义的局部配置值

这符合当前重构原则：

1. 不过度设计
2. 只抽有长期价值的稳定语义
3. 抽出后必须真实接入运行时代码和测试

---

## 已验证命令

通过：

1. `corepack yarn workspace @impos2/kernel-base-execution-runtime type-check`
2. `corepack yarn workspace @impos2/kernel-base-execution-runtime test`
3. `corepack yarn workspace @impos2/kernel-base-topology-runtime type-check`
4. `corepack yarn workspace @impos2/kernel-base-topology-runtime test`
5. `corepack yarn workspace @impos2/kernel-base-transport-runtime type-check`
6. `corepack yarn workspace @impos2/kernel-base-transport-runtime test`
7. `corepack yarn workspace @impos2/kernel-base-host-runtime type-check`
8. `corepack yarn workspace @impos2/kernel-base-host-runtime test`
9. `corepack yarn workspace @impos2/kernel-base-runtime-shell type-check`
10. `corepack yarn workspace @impos2/kernel-base-runtime-shell test`
11. `corepack yarn workspace @impos2/kernel-base-state-runtime type-check`
12. `corepack yarn workspace @impos2/kernel-base-state-runtime test`
