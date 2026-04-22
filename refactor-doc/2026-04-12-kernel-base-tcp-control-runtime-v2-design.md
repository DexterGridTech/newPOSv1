# 2026-04-12 kernel-base tcp-control-runtime-v2 设计文档

## 1. 结论

`tcp-control-runtime-v2` 是旧 `_old_/1-kernel/1.1-cores/tcp-client` 在新基础架构里的控制面迁移目标。

它负责终端控制面，不负责 TDP 数据面：

1. 终端激活。
2. credential 刷新。
3. task result 上报。
4. terminal identity / credential / binding 的本地真相。

v2 的核心变化不是重做业务协议，而是把现有能力迁移到 `runtime-shell-v2` 的统一 `Command / Actor` 模型：

1. 对外只暴露 command。
2. 包内通过 actor 执行业务指令。
3. slice action 不跨包导出。
4. 测试入口统一从 command 走完整业务链路。

---

## 2. 包身份

目标包：

1. 目录：`1-kernel/1.1-base/tcp-control-runtime-v2`
2. 包名：`@impos2/kernel-base-tcp-control-runtime-v2`
3. `moduleName`：`kernel.base.tcp-control-runtime-v2`

说明：

1. 当前 `tcp-control-runtime` 先保留，不继续基于旧 `registerHandler` 风格扩展。
2. `tcp-control-runtime-v2` 直接依赖 `runtime-shell-v2`。
3. 后续 `tdp-sync-runtime-v2` 依赖它读取 `terminalId + accessToken`。

---

## 3. 职责边界

负责：

1. 设备前置信息采集与本地身份初始化。
2. 激活码激活终端。
3. 保存 terminal identity。
4. 保存 accessToken / refreshToken / expiresAt。
5. 保存 terminal binding context。
6. 上报服务端 task result。
7. 暴露稳定 selector 给其他包读取。
8. 提供 error definitions 与 system parameter definitions。

不负责：

1. WebSocket 连接。
2. TDP projection 仓库。
3. TDP scope priority。
4. workflow 执行。
5. 服务端 task 发布模型。
6. 主副机 peer command 路由。
7. React hook。

---

## 4. 状态设计

v2 继续保留现有 4 个 slice 的语义，因为这个边界已经清晰：

1. `tcpIdentity`
2. `tcpCredential`
3. `tcpBinding`
4. `tcpRuntime`

### 4.1 `tcpIdentity`

字段：

1. `deviceFingerprint`
2. `deviceInfo`
3. `terminalId`
4. `activationStatus`
5. `activatedAt`

持久化：

1. 持久化。
2. 按属性级持久化，不把整个 slice 作为不可拆大对象持久化。

说明：

1. `terminalId` 是 TDP 建立会话的身份来源。
2. 时间字段全部使用毫秒时间戳数字。

### 4.2 `tcpCredential`

字段：

1. `accessToken`
2. `refreshToken`
3. `expiresAt`
4. `refreshExpiresAt`
5. `status`
6. `updatedAt`

持久化：

1. 持久化。
2. `accessToken / refreshToken` 默认走可加密存储。
3. 不允许生产环境 silent fallback 到明文 protected storage。

### 4.3 `tcpBinding`

字段：

1. `platformId`
2. `tenantId`
3. `brandId`
4. `projectId`
5. `storeId`
6. `profileId`
7. `templateId`

持久化：

1. 持久化。
2. 后续 TDP projection scope priority 会用到其中的上下文。

### 4.4 `tcpRuntime`

字段：

1. `bootstrapped`
2. `lastActivationRequestId`
3. `lastRefreshRequestId`
4. `lastTaskReportRequestId`
5. `lastError`

持久化：

1. 不持久化。

原因：

1. 这些都是运行时观测字段。
2. 重启后应由 bootstrap 重建，而不是恢复旧 request 观测痕迹。

---

## 5. Command 设计

### 5.1 公开 command

`tcp-control-runtime-v2` 对外公开：

1. `bootstrapTcpControl`
2. `activateTerminal`
3. `refreshCredential`
4. `reportTaskResult`
5. `resetTcpControl`

说明：

1. 这些 command 可以被其他包跨包调用。
2. 其他包不允许直接 dispatch 本包 slice action。

### 5.2 内部 command

内部 command：

1. `bootstrapTcpControlSucceeded`
2. `activateTerminalSucceeded`
3. `credentialRefreshed`
4. `taskResultReported`

说明：

1. 内部 command 仍然走 `runtime-shell-v2`。
2. 内部 command 的 `visibility = internal`。
3. 内部 command 不作为跨包稳定 API 暴露。

### 5.3 默认值

除非特别说明，本包 command 使用 `runtime-shell-v2` 默认值：

1. `visibility = public`
2. `timeoutMs = 60_000`
3. `allowNoActor = false`
4. `allowReentry = false`
5. `defaultTarget = local`

内部 command 显式设置：

1. `visibility = internal`

---

## 6. Actor 设计

建议 actor：

1. `TcpBootstrapActor`
2. `TcpActivationActor`
3. `TcpCredentialActor`
4. `TcpTaskReportActor`
5. `TcpStateMutationActor`

### 6.1 `TcpBootstrapActor`

处理：

1. `bootstrapTcpControl`

职责：

1. 确认 state 已完成 hydrate。
2. 重置 `tcpRuntime` 运行态字段。
3. 根据现有 identity/credential 判断是否需要 runtime 标记。
4. 发出 `bootstrapTcpControlSucceeded`。

### 6.2 `TcpActivationActor`

处理：

1. `activateTerminal`

职责：

1. 从 platform ports 获取设备信息。
2. 调用 HTTP activation API。
3. 解析 terminal identity / binding / credential。
4. 发出 `activateTerminalSucceeded`。

### 6.3 `TcpCredentialActor`

处理：

1. `refreshCredential`

职责：

1. 从 state 读取 refreshToken。
2. 校验 credential 是否存在。
3. 调用 HTTP refresh API。
4. 发出 `credentialRefreshed`。

### 6.4 `TcpTaskReportActor`

处理：

1. `reportTaskResult`

职责：

1. 从 state 读取 terminalId / accessToken。
2. 调用 task result report API。
3. 发出 `taskResultReported`。

### 6.5 `TcpStateMutationActor`

处理：

1. `bootstrapTcpControlSucceeded`
2. `activateTerminalSucceeded`
3. `credentialRefreshed`
4. `taskResultReported`
5. `resetTcpControl`

职责：

1. 本包所有 slice 写入统一从这里完成。
2. 其他 actor 不直接跨文件导出 reducer action 给外部使用。

说明：

1. `TcpStateMutationActor` 是包内状态落地执行者，不是跨包 service。
2. 业务包如果需要改变 TCP 状态，仍然只能调用公开 command。

---

## 7. HTTP 与 transport

`tcp-control-runtime-v2` 继续复用现有 `transport-runtime` 和 `mock-terminal-platform` 已经验证的 HTTP 基础设施，不重复造轮子。

最小 API：

1. `POST /api/v1/terminals/activate`
2. `POST /api/v1/terminals/token/refresh`
3. `POST /api/v1/terminals/{terminalId}/tasks/{instanceId}/result`

约束：

1. HTTP 失败统一转成本包结构化 `AppError`。
2. accessToken 写日志时遵循 `DEV raw / PROD masked`。
3. 不把 transport 成功当成业务完成，业务完成以 command aggregate result 和 state selector 双重验证。

---

## 8. Selectors

稳定公开 selector：

1. `selectTcpIdentitySnapshot`
2. `selectTcpCredentialSnapshot`
3. `selectTcpBindingSnapshot`
4. `selectTcpRuntimeState`
5. `selectTcpTerminalId`
6. `selectTcpAccessToken`
7. `selectTcpRefreshToken`
8. `selectTcpIsActivated`

说明：

1. `state` 全局可读。
2. 跨包读取优先走 selector。
3. selector 是本包正式读接口。

---

## 9. errors / parameters

### 9.1 errors

继承现有稳定错误语义，并把 key 升级为 v2 命名空间：

1. `kernel.base.tcp-control-runtime-v2.activation_code_invalid`
2. `kernel.base.tcp-control-runtime-v2.activation_failed`
3. `kernel.base.tcp-control-runtime-v2.credential_missing`
4. `kernel.base.tcp-control-runtime-v2.credential_expired`
5. `kernel.base.tcp-control-runtime-v2.refresh_failed`
6. `kernel.base.tcp-control-runtime-v2.task_result_report_failed`
7. `kernel.base.tcp-control-runtime-v2.bootstrap_hydration_failed`

### 9.2 parameters

第一版保留：

1. `kernel.base.tcp-control-runtime-v2.credential-refresh-lead-time-ms`

说明：

1. 仍不强行做自动刷新。
2. 如果后续业务需要自动刷新，再把调度能力作为单独 command/actor 补入。

---

## 10. 与其他包边界

### 10.1 与 `runtime-shell-v2`

依赖：

1. command definition。
2. actor definition。
3. dispatch。
4. request query。
5. error / parameter resolve。

不反向依赖：

1. `runtime-shell-v2` 不应 import 本包业务类型。

### 10.2 与 `tdp-sync-runtime-v2`

`tdp-sync-runtime-v2` 读取：

1. `selectTcpTerminalId`
2. `selectTcpAccessToken`
3. `selectTcpBindingSnapshot`

但写入 TCP 相关状态只能通过：

1. `refreshCredential`
2. `resetTcpControl`

### 10.3 与 `workflow-runtime-v2`

`workflow-runtime-v2` 不直接依赖 TCP 控制面。

如果 workflow 需要上报 task result，应通过 command step 调用：

1. `reportTaskResult`

---

## 11. 测试门槛

### 11.1 单包测试

必须覆盖：

1. bootstrap 重置 runtime-only 状态，不破坏 identity/credential/binding。
2. activateTerminal 成功后写入 identity/credential/binding。
3. refreshCredential 成功后更新 credential。
4. reportTaskResult 成功后写入 runtime request 观测。
5. resetTcpControl 清空持久化真相源和 runtime-only 状态。
6. credential 缺失时返回结构化错误。

所有测试入口必须是 command：

1. `runtime.dispatch(tcpCommands.activateTerminal(...))`
2. 断言 `CommandAggregateResult`
3. 再断言 selector state
4. 再断言 request query

### 11.2 真实联调测试

联调必须使用：

1. `0-mock-server/mock-terminal-platform`
2. `kernel-base-test` 沙箱

覆盖：

1. 激活码激活真实 HTTP 闭环。
2. token refresh 真实 HTTP 闭环。
3. task result report 真实 HTTP 闭环。
4. `full / seed / verify` 真实重启恢复。

重启恢复必须验证：

1. `tcpIdentity / tcpCredential / tcpBinding` 可恢复。
2. `tcpRuntime` 不恢复旧运行态。
3. protected credential storage 的行为符合加密存储约束。

---

## 12. MVP 范围

第一阶段实现：

1. 包骨架。
2. command definitions。
3. actor definitions。
4. 4 个 slice。
5. HTTP service 复用。
6. selectors。
7. errors / parameters。
8. 单包测试与真实 mock-terminal-platform 联调。

第一阶段不实现：

1. 自动 credential refresh 定时器。
2. TDP WS 会话。
3. 服务端 task release 消费。
4. 主副机同步。

---

## 13. 下一步

`tcp-control-runtime-v2` 设计确认后，继续输出：

1. `tdp-sync-runtime-v2` 设计文档
2. `workflow-runtime-v2` 设计文档

然后再进入第一阶段实现。
