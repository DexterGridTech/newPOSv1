# 2026-04-11 topology-client-runtime errors / parameters 补充记录

## 本次补充范围

针对 `1-kernel/1.1-base/topology-client-runtime`，补齐双屏通讯运行时本身需要使用的错误定义与系统参数定义，并确保参数不是“只注册不使用”，而是实际进入连接与命令执行行为。

本次不扩展业务包，不迁移旧 `1-kernel/1.2-modules/*`。

## 新增错误定义

位置：

- `1-kernel/1.1-base/topology-client-runtime/src/supports/errors.ts`

当前补入：

- `kernel.base.topology-client-runtime.session_unavailable`
- `kernel.base.topology-client-runtime.assembly_required`
- `kernel.base.topology-client-runtime.connection_precheck_failed`
- `kernel.base.topology-client-runtime.connection_failed`
- `kernel.base.topology-client-runtime.remote_not_connected`
- `kernel.base.topology-client-runtime.remote_command_response_timeout`

说明：

1. 旧 `interconnection` 里双屏通讯失败类错误并不是业务层错误，而是核心通讯运行时错误，新架构里继续保留这个定位。
2. 不是复刻旧 `DefinedErrorMessage` 形态，而是落到 manifest error definitions，再通过 runtime shell resolver 解析。
3. 当前真正进入运行路径的核心错误是：
   - `session_unavailable`
   - `assembly_required`
   - `remote_not_connected`
   - `remote_command_response_timeout`

## 新增参数定义

位置：

- `1-kernel/1.1-base/topology-client-runtime/src/supports/parameters.ts`

当前补入：

- `kernel.base.topology-client-runtime.master-server.bootstrap-delay-ms`
- `kernel.base.topology-client-runtime.slave.connect-delay-ms`
- `kernel.base.topology-client-runtime.server.reconnect-interval-ms`
- `kernel.base.topology-client-runtime.server.connection-timeout-ms`
- `kernel.base.topology-client-runtime.server.heartbeat-timeout-ms`
- `kernel.base.topology-client-runtime.remote-command.response-timeout-ms`

默认值继承旧 `interconnection` 设计经验：

- bootstrap delay: `2000`
- slave connect delay: `4000`
- reconnect interval: `20000`
- connection timeout: `10000`
- heartbeat timeout: `60000`
- remote command response timeout: `6000`

说明：

1. 当前没有强行把所有参数一次性接到所有路径，只把已经有明确运行语义且当前架构确实需要的部分接上。
2. 没有过度设计参数层级，也没有引入额外 manager。

## 实际生效行为

### 1. Socket profile 元信息由参数驱动

`topology-client-runtime` 在创建 orchestrator 时，会基于 runtime 可解析的 parameter catalog，重写 assembly 提供的 socket profile 元信息：

- `connectionTimeoutMs`
- `heartbeatTimeoutMs`
- `reconnectDelayMs`

目的：

1. 让双屏通讯包自己的连接策略由自己的参数控制。
2. 不要求 assembly 手工重复传同一套超时配置。

### 2. 远端命令 started barrier 超时由参数驱动

`dispatchRemoteCommand()` 内部等待远端命令进入 `started` 的 barrier，不再写死 `2000ms`，而是读取：

- `kernel.base.topology-client-runtime.remote-command.response-timeout-ms`

超时后抛：

- `kernel.base.topology-client-runtime.remote_command_response_timeout`

### 3. 连接失败后的自动重连由 topology-client-runtime 自己调度

这次确认了一个关键事实：

1. 当前 `transport-runtime` 的 `reconnecting` 事件只是事件，不负责真正的延迟重连调度。
2. 因此“连接失败后多少秒重试”这类业务相关连接策略，应该由 `topology-client-runtime` 自己控制。

现在行为是：

1. 初次连接失败，进入 `DISCONNECTED`，记录 `connectionError`。
2. 根据 `server.reconnect-interval-ms` 安排下一次重试。
3. 重试时 `reconnectAttempt` 递增。
4. 成功收到 `node-hello-ack` 后，`reconnectAttempt` 归零。
5. 手动 `stopTopologyConnection` 不会被后台自动重连拉起。
6. 手动 `restartTopologyConnection` 会先清理旧状态，再重新发起连接。

## 为了支持本次能力做的基础调整

### runtime-shell 模块上下文新增参数解析能力

位置：

- `1-kernel/1.1-base/runtime-shell/src/types/module.ts`
- `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`

新增：

- `RuntimeModuleContext.resolveParameter(...)`

原因：

1. 模块 `install()` 阶段就需要读取参数，不能要求模块只能在 runtime fully started 之后再拿参数。
2. 这对 kernel 内部运行时包是必要能力，不是 UI / React hooks 能力。

## 测试验证

本次验证全部走真实场景测试，不做纯 mock 口头验证。

通过：

- `corepack yarn workspace @impos2/kernel-base-topology-client-runtime test`
- `corepack yarn workspace @impos2/kernel-base-topology-client-runtime type-check`
- `corepack yarn workspace @impos2/kernel-base-runtime-shell test`
- `corepack yarn workspace @impos2/kernel-base-runtime-shell type-check`
- `corepack yarn workspace @impos2/kernel-base-definition-registry test`

新增重点场景：

1. `connection-runtime.spec.ts`
   - 校验 topology-client-runtime 的 parameter defaults 与 startup override 可解析。
   - 使用 `0-mock-server/dual-topology-host` 的真实 host/server，验证连接失败后按参数间隔自动重连，并在 host 延迟启动后最终连上。

## 当前结论

双屏通讯包确实需要自己的 `errors` 和 `parameters`，而且这类能力应该直接内建在 `topology-client-runtime`，不是留给业务包自己发明。

当前这轮已经满足：

1. 定义公开。
2. 运行时真实使用。
3. 双屏 host 场景验证通过。

补充进展：

1. `topology-client-runtime` 已补齐 `projection-mirror` 消息类型，不再只识别 dispatch / event / snapshot / state-sync。
2. `runtime-shell` 已提供 `applyProjectionMirror(...)`，语义明确为“只更新 request projection read model，不触碰 owner-ledger 真相”。
3. 已新增真实 `dual-topology-host` 场景验证：
4. slave 仍通过 `request-lifecycle-snapshot` 恢复 request projection。
5. owner 侧可通过 `projection-mirror` 更新自己的读模型显示。
6. 这继续满足先前约束：projection mirror 是可选能力，不是 request correctness 前提。

后续可继续补的方向：

1. `master-server.bootstrap-delay-ms` / `slave.connect-delay-ms` 是否需要进入 initialize / auto-start 调度。
2. `connection_precheck_failed` / `connection_failed` 是否需要在更多命令入口替代裸字符串错误。
3. transport-runtime 是否要在更底层统一提供真正的 reconnect scheduler；如果做，这需要单独评估职责边界，不能顺手塞进去。
