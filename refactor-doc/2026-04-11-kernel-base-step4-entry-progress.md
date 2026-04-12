# 2026-04-11 kernel-base 第四步入口进展

## 1. 当前阶段结论

进入第四步前，前三步可以视为完成。

### 第一步

`task panel reconnect`

已完成并有真实联动验证：

1. 主屏消费 `tcp.task.release` projection 成业务 read model。
2. 业务 read model 通过 `topology-client-runtime` 同步到副屏。
3. 断线重连后，新进入的 task entry 仍能继续同步。

对应测试：

1. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel.spec.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel-reconnect.spec.ts`

### 第二步

`REMOTE_CONTROL business read model`

已完成并有真实联动验证：

1. `tdp-sync-runtime` 接收真实 `REMOTE_CONTROL`。
2. 业务测试模块消费 command inbox。
3. 消费结果形成业务 read model。
4. 业务 read model 可以通过 topology 同步。
5. 最终通过 `tcp-control-runtime.reportTaskResult` 回报服务端。

对应测试：

1. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-remote-command-panel.spec.ts`

### 第三步

`topology-client-runtime` WS 重连策略统一

已完成收敛：

1. 默认无限重连。
2. 重连间隔参数化。
3. 测试可限次。
4. 与 `tdp-sync-runtime` 采用同一原则。

对应文档：

1. `refactor-doc/2026-04-11-topology-client-runtime-reconnect-progress.md`

对应关键代码：

1. `1-kernel/1.1-base/topology-client-runtime/src/supports/parameters.ts`
2. `1-kernel/1.1-base/topology-client-runtime/src/foundations/orchestrator.ts`
3. `1-kernel/1.1-base/topology-client-runtime/src/foundations/module.ts`

对应关键测试：

1. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/connection-runtime.spec.ts`

---

## 2. 为什么现在可以进入第四步

第四步是重新设计 `workflow-runtime`。

在进入这一步前，原本最大的风险有三个：

1. 服务端 task 到客户端业务 state 的链路还没证明。
2. 主副屏同步与重连语义还没稳定。
3. 远端 command 与 request projection 的边界还可能继续摇摆。

现在这三个风险都已经压下来了：

1. 业务 read model 已证明能承接 projection 与 command inbox。
2. topology 的主副同步、resume、reconnect 已有真实验证。
3. request lifecycle 已经从旧 request slice 迁到 `runtime-shell + topology-runtime` 模型。

因此第四步可以不再纠缠“服务端 task 要不要直接进 workflow”，而是只专注“客户端本地流程如何专业化”。

---

## 3. 第四步文档输出

本轮已输出：

1. `refactor-doc/2026-04-11-kernel-base-workflow-runtime-design.md`

这份文档已经覆盖：

1. 包职责。
2. 与 `execution-runtime / runtime-shell / state-runtime / topology-runtime / topology-client-runtime / tcp-control-runtime / tdp-sync-runtime` 的边界。
3. `run$()` observable-first 入口与 `runWorkflow` command 边界。
4. `WorkflowObservation` 协议，以及 observable 发射内容与 selector 返回内容同构的约束。
5. 全局串行 queue，以及 `WAITING_IN_QUEUE` 状态。
6. definition / input / output / context / progress / adapter / lifecycle / loop / timeout 协议。
7. requestId / workflowRunId / stepRunId 的关系。
8. state/read model 设计。
9. script 不做过度限制，只要求异常和超时可控。
10. 与旧 `task` 包的继承与淘汰清单。
11. 实施切分建议。

---

## 4. 下一步建议

在你审完 `workflow-runtime` 设计文档之前，不建议直接开始实现。

推荐顺序：

1. 先审 `refactor-doc/2026-04-11-kernel-base-workflow-runtime-design.md`。
2. 如果协议方向确认，再拆 implementation plan。
3. 先做最小闭环：
   1. definition 注册
   2. `run$()` runtime API
   3. `runWorkflow` command
   4. `WorkflowObservation` state
   5. `selectWorkflowObservationByRequestId`
   6. 全局串行 queue
   7. 串行 flow
   8. command step
   9. request projection 集成
4. 再补 cancel / timeout / retry / loop。
5. 最后再迁旧 `task` 的 external adapter 能力。

---

## 5. 当前 base 重构阶段判断

到现在为止，旧 core 中最重的基础链路已经基本站住：

1. contracts
2. definition-registry
3. platform-ports
4. state-runtime
5. execution-runtime
6. transport-runtime
7. topology-runtime
8. host-runtime
9. runtime-shell
10. tcp-control-runtime
11. tdp-sync-runtime
12. topology-client-runtime

现在真正还缺的“旧 core 关键能力”里，最重要的就是：

1. `workflow-runtime`
2. 后续对旧 `ui-runtime / terminal / navigation` 迁移时所需的业务闭环验证

所以第四步是合理的主战场，不是偏题。

---

## 6. 已记账的后续需求

这部分暂不在本轮先做，等 `workflow-runtime` 设计确认并实现后继续。

### 6.1 TDP 动态下发 workflow definitions

需要补一条正式链路：

1. 定义 workflow definitions 的专用 TDP topic。
2. 终端接收 projection 后解析为 `workflowDefinitions` slice。
3. 支持增 / 删 / 改。
4. 执行时始终按当前最新 definition resolve。

必须补真实测试：

1. 服务端通过 TDP 发布 workflow definition projection。
2. 终端接收并更新本地 state。
3. 再次执行 workflow 时使用最新 definition。
4. 删除后不可继续执行旧 definition。

### 6.2 TDP 动态下发 errorMessages / systemParameters

在 `workflow-runtime` 完成之后，还要继续补这两类能力：

1. `errorMessages` 的 topic 下发更新场景。
2. `systemParameters` 的 topic 下发更新场景。

必须补真实测试：

1. 服务端通过 TDP 下发更新。
2. 终端接收后解析并更新 runtime catalog / state。
3. 后续命令执行与 workflow 执行读取到最新值。
4. 重连后继续接收增量更新。
