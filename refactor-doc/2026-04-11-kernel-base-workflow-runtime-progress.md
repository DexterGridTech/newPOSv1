# 2026-04-11 kernel-base workflow-runtime 落地进展

## 1. 本轮已完成

`1-kernel/1.1-base/workflow-runtime` 已完成“本地编排最小闭环 + TDP 动态 definitions 下发闭环”，可作为正式 base 包继续演进。

已落地能力：

1. 已提供正式 `createWorkflowRuntimeModule()` 模块工厂。
2. 已提供正式 command names：
   1. `runWorkflow`
   2. `cancelWorkflowRun`
   3. `registerWorkflowDefinitions`
   4. `removeWorkflowDefinition`
3. 已提供正式 state slices：
   1. `workflowDefinitions`
   2. `workflowObservations`
   3. `workflowQueue`
4. 已提供 runtime facade：
   1. `run$()`
   2. `cancel()`
   3. `getObservation()`
   4. `registerDefinitions()`
   5. `removeDefinition()`
5. 已实现 observable-first 运行模型。
6. 已实现 selector 与 `run$()` observation 同构。
7. 已实现全局串行 FIFO queue。
8. 已实现 queued workflow 的 `WAITING_IN_QUEUE` 状态。
9. 已实现 `runWorkflow` command 复用当前 command `requestId`。
10. 已实现 `command` step 通过 `dispatchChild()` 调子 command。
11. 已实现 queued run cancel。
12. 已注册 errorDefinitions / parameterDefinitions 到 runtime catalog。
13. 已支持从 TDP topic 动态接收远端 workflow definitions。
14. 已支持远端 workflow definitions 的 add / update / delete。
15. 远端 workflow definitions 更新后，后续执行会直接使用最新定义。

## 2. 已验证内容

包级验证已经通过：

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime type-check`
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime test`

当前测试覆盖：

1. `run$()` 终态 observation 与 selector 返回内容一致。
2. 全局串行 queue 正常工作，第二个 workflow 先进入 `WAITING_IN_QUEUE`。
3. `runWorkflow` command 可以驱动 `command` step。
4. definition missing 时形成 failed observation。
5. duplicate active requestId 会被拒绝。
6. queued workflow 可以被 cancel。
7. 真实 `mock-terminal-platform + tdp-sync-runtime` 下发 workflow definitions topic 后，终端可以：
   1. 接收新增 definition
   2. 执行新增 definition
   3. 接收 definition 更新
   4. 执行最新 definition
   5. 接收 definition 删除
   6. 删除后拒绝继续执行
8. `external-subscribe` 可以等待首条外部消息并在完成后取消订阅。
9. `external-on` 可以按 `eventType + target` 等待一次事件。
10. `compensate` 会执行补偿 step，但 workflow 终态仍保持失败，不误判为成功。
11. step timeout 终态已区分为 `TIMED_OUT`。
12. workflow timeout 已生效，超时后会终止整个 run。
13. 默认 workflow timeout / step timeout 已可以通过参数目录生效。
14. timeout 后迟到结果不会再覆盖 observation 终态。

## 3. 本轮刻意未做

这部分不是遗漏，是明确留给下一阶段：

1. script step。
2. loop 深化实现。
3. script 执行日志与脱敏策略深化。
4. durable replay / crash recovery。
5. errorMessages topic 下发更新。
6. systemParameters topic 下发更新。

## 4. 当前边界判断

当前 `workflow-runtime` 已经能支撑下一步进入“远端配置面扩展”阶段。

原因：

1. 本地 definition 注册、删除、解析已经站住。
2. workflow observation 协议已经稳定。
3. `runWorkflow` command 与 request projection 的衔接已经打通。
4. queue / cancel / 子 command request 复用已经可验证。
5. 远端 workflow definitions 的 add / update / delete 已经通过真实联调验证。

因此下一步不需要继续在 workflow definitions topic 基础面上打转，而应该进入：

1. 把同样的 TDP 动态配置模型用于 `errorMessages`。
2. 把同样的 TDP 动态配置模型用于 `systemParameters`。
3. 继续完善 workflow step 协议里剩余的 loop 和日志规则。

## 5. 代码落点

本轮关键代码：

1. `1-kernel/1.1-base/workflow-runtime/src/foundations/module.ts`
2. `1-kernel/1.1-base/workflow-runtime/src/foundations/createWorkflowEngine.ts`
3. `1-kernel/1.1-base/workflow-runtime/src/foundations/remoteDefinitions.ts`
4. `1-kernel/1.1-base/workflow-runtime/src/features/commands/index.ts`
5. `1-kernel/1.1-base/workflow-runtime/test/scenarios/workflow-runtime.spec.ts`
6. `1-kernel/1.1-base/workflow-runtime/test/scenarios/workflow-runtime-live-remote-definitions.spec.ts`
7. `1-kernel/1.1-base/workflow-runtime/src/foundations/connectorRuntime.ts`
8. `1-kernel/1.1-base/workflow-runtime/test/scenarios/workflow-runtime-advanced.spec.ts`
