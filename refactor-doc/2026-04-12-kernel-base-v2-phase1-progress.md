# 2026-04-12 kernel-base v2 phase1 进展

## 1. 当前已完成

截至 2026-04-12，phase1 已完成 3 个 v2 包的第一阶段落地与验证：

1. `1-kernel/1.1-base/runtime-shell-v2`
2. `1-kernel/1.1-base/tcp-control-runtime-v2`
3. `1-kernel/1.1-base/tdp-sync-runtime-v2`

这三者都已经完成：

1. `type-check`
2. `test`

通过命令：

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
3. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 test`
5. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`
6. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`

---

## 2. runtime-shell-v2 当前能力

已落实：

1. `Command / Actor / RequestLedger` 广播执行模型。
2. `runtime.dispatch` 与 actor 内 `dispatch` 统一。
3. request 状态在 command 开始前立即进入 `RUNNING`。
4. 同 request 子 command 聚合。
5. 同 actor 同 command 默认禁止 reentry，可按 command 显式打开。
6. `peer` target 无 gateway 时直接失败。
7. state-runtime 持久化已经正式接入，不再是纯内存 app-state。
8. 增补了 `error catalog / parameter catalog` 最小能力：
   1. 内置 slice
   2. 内置 internal command
   3. 内置 catalog actor

当前仍未做：

1. `resolveParameter / resolveError` 风格的高阶 resolver API。
2. request selector 的更细粒度 read-model 封装。
3. 与 topology v2 的整合。

---

## 3. tcp-control-runtime-v2 当前能力

已落实：

1. `bootstrapTcpControl / activateTerminal / refreshCredential / reportTaskResult / resetTcpControl`
2. 4 个 slice：
   1. `identity`
   2. `credential`
   3. `binding`
   4. `runtime`
3. 按属性级持久化：
   1. `terminalId`
   2. `accessToken / refreshToken`
   3. binding 上下文
4. runtime-only 状态不持久化。
5. 命令全链路测试改为走 `runtime-shell-v2.dispatch(createCommand(...))`。
6. 重启恢复测试已验证：
   1. identity 恢复
   2. credential 恢复
   3. binding 恢复
   4. runtime slice 不恢复

说明：

1. 这版先复用旧 HTTP 协议形状。
2. `mock-terminal-platform` 的真实联调版还没迁到 v2 live harness。

---

## 4. tdp-sync-runtime-v2 当前能力

这次先落的是“数据面核心 MVP”，不是完整 WS/live 版。

已落实：

1. 5 类 slice：
   1. `session`
   2. `sync`
   3. `projection`
   4. `command-inbox`
   5. `control-signals`
2. projection 仓库按 `projectionId = topic:scopeType:scopeId:itemKey` 持久化。
3. scope priority 解析：
   1. `Platform < Project < Brand < Tenant < Store < Terminal`
4. `tdpTopicDataChanged` 作为正式 command，对外广播生效变化。
5. `error.message / system.parameter` bridge 到 `runtime-shell-v2` catalog command。
6. `tdpMessageReceived -> internal command -> repository/state` 的转换链路已经建立。
7. delete 后 fallback 到低优先级 projection 的规则已验证。
8. projection 仓库与 cursor 的重启恢复已验证。
9. actor 结构已按职责拆分，不再把多个 actor 和状态迁移细节堆在单一 `features/actors/index.ts`。
10. TDP 状态迁移已引入 domain action：
   1. actor 只 dispatch 单个业务语义 action
   2. 各 slice 通过 reducer/extraReducers 响应
   3. `topic change` 与 `system catalog bridge` 已解耦为独立 actor

当前还未做：

1. WS 连接/握手/心跳/重连/runtime assembly 接入。
2. `mock-terminal-platform` 的 live TDP 联调迁到 v2。
3. `workflow.definition` 与 `workflow-runtime-v2` 的真实 topic 对接。
4. reconnect / restart / batch push / scene 测试迁到 v2。

---

## 5. 当前结论

到现在为止，基础架构已经具备继续推进 `workflow-runtime-v2` 的条件：

1. command/actor/request 模型已经稳定。
2. TCP 控制面已经可用。
3. TDP 的 projection 数据面核心已经可用。
4. `error.message / system.parameter` 的 topic 下发桥接路径已经打通。

所以后续不需要先迁业务包。
应该继续先完成：

1. `workflow-runtime-v2`
2. `tdp-sync-runtime-v2` 的 WS/live 层
3. `topology-runtime-v2`

---

## 6. 下一步

建议下一步进入：

1. `workflow-runtime-v2`

优先完成：

1. observable-first workflow run protocol
2. requestId -> workflow observation selector
3. global serial queue
4. `workflow.definition` topic 动态定义接入
5. command/actor/result/异常场景测试

完成 `workflow-runtime-v2` 之后，再回头把：

1. `tdp-sync-runtime-v2` 的 WS/live runtime
2. `mock-terminal-platform` live scene
3. `topology-runtime-v2`

串起来。

补充进展：

截至本次更新，`workflow-runtime-v2` 的第一版最小可用能力已经完成并通过 `type-check` / `test`。
详细记录见：

1. `refactor-doc/2026-04-12-kernel-base-workflow-runtime-v2-progress.md`
