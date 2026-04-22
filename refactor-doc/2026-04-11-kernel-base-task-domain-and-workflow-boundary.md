# 服务端 Task 域与客户端 Workflow 边界设计

## 1. 文档目标

本文档用于明确下面三个概念的边界：

1. `0-mock-server/mock-terminal-platform` 服务端 TCP task。
2. 客户端 `tdp-sync-runtime` / `tcp-control-runtime` 对 task 的接收、确认与结果回报。
3. 旧 `_old_/1-kernel/1.1-cores/task` 后续在新架构中的目标命名和职责。

结论先行：

1. 服务端的 `task` 是平台业务域概念。
2. TDP 里的 `tcp.task.release` 是数据面投影 topic。
3. 旧 `1.1-cores/task` 本质是客户端本地流程编排引擎，不应继续命名为 `task`。
4. 后续迁移旧 `1.1-cores/task` 时，推荐新包命名为 `workflow-runtime`。

---

## 2. 当前服务端 Task 定义

服务端 task 由两层对象组成：

1. `task_release`
2. `task_instance`

### 2.1 `task_release`

`task_release` 表示一次平台侧任务发布。

关键字段语义：

1. `releaseId`：发布单 ID。
2. `taskType`：任务类型，目前包括 `CONFIG_PUBLISH`、`APP_UPGRADE`、`REMOTE_CONTROL`。
3. `sourceType / sourceId`：任务来源。
4. `targetSelectorJson`：目标终端选择器。
5. `payloadJson`：发布内容。
6. `priority`：优先级。
7. `status / approvalStatus`：发布单生命周期。
8. `createdAt / updatedAt`：long 时间戳。

创建入口：

1. `POST /api/v1/admin/tasks/releases`
2. `createTaskRelease(input)`

### 2.2 `task_instance`

`task_instance` 表示某台终端上需要处理的一条具体任务实例。

关键字段语义：

1. `instanceId`：终端侧回报结果时必须携带的实例 ID。
2. `releaseId`：所属发布单。
3. `terminalId`：目标终端。
4. `taskType`：冗余任务类型，方便按实例查询。
5. `status`：业务完成状态。
6. `deliveryStatus`：数据面投递状态。
7. `payloadJson`：终端要消费或执行的 payload。
8. `resultJson / errorJson`：业务完成结果。
9. `deliveredAt / finishedAt`：long 时间戳。

实例化入口：

1. `createTaskInstancesForRelease(releaseId)`
2. 每个目标终端生成一条 `task_instance`
3. 初始 `status = PENDING`
4. 初始 `deliveryStatus = PENDING`

---

## 3. 服务端 Task 运行原理

服务端 task 发布后，会进入数据面派发：

1. 创建 `task_release`
2. 展开为多个 `task_instance`
3. 根据 `taskType` 决定派发模式
4. 终端接收后 ACK
5. 业务执行完成后由终端回报 result

当前有两种派发模式。

## 3.1 Projection 模式

适用任务：

1. `CONFIG_PUBLISH`
2. `APP_UPGRADE`
3. 后续所有更偏“状态同步 / 业务真相源”的任务

服务端行为：

1. 写入或更新 TDP projection。
2. topic 固定为 `tcp.task.release`。
3. scope 是 `TERMINAL`。
4. scope key 是 `terminalId`。
5. item key 当前等价于终端维度下的 projection 记录。
6. payload 包含 `releaseId / instanceId / payload / dispatchedAt`。
7. 写入 change log。
8. 如果终端在线，通过 WebSocket 推 `PROJECTION_CHANGED`。
9. 更新 `task_instance.deliveryStatus = DELIVERED`。

客户端语义：

1. 收到 projection 不等于业务已经完成。
2. 收到 projection 只代表终端已看见一条平台发布任务。
3. 客户端业务模块应把它消费成自己的业务 read model。
4. 是否立即执行、展示确认、排队执行、静默应用，由业务模块决定。

## 3.2 Command 模式

适用任务：

1. `REMOTE_CONTROL`
2. 后续所有更偏“即时动作 / 远端指令”的任务

服务端行为：

1. 创建 command outbox。
2. 把真实 `task_instance.instanceId` 写入 command payload。
3. 通过 WebSocket 推 `COMMAND_DELIVERED`。
4. 更新 `task_instance.deliveryStatus = DELIVERED`。
5. 等终端 ACK 后可进入 `ACKED`。
6. 等终端通过 TCP 回报最终业务结果。

客户端语义：

1. `COMMAND_DELIVERED` 是即时执行信号。
2. TDP ACK 只表示数据面收到，不表示业务执行成功。
3. 业务执行成功或失败后，必须调用 `tcp-control-runtime.reportTaskResult`。
4. 最终由服务端更新 `task_instance.status / resultJson / errorJson / finishedAt`。

---

## 4. 客户端执行模型

客户端侧必须把 “收到任务” 和 “执行任务” 分开。

## 4.1 `tdp-sync-runtime` 的责任

`tdp-sync-runtime` 只负责数据面同步：

1. 建立 TDP 会话。
2. 接收 snapshot / changes / projection push。
3. 接收 command delivered。
4. 写入 projection state。
5. 写入 command inbox。
6. 发送 ACK。
7. 发送 state report。
8. 维护 cursor / reconnect / resume。

它不负责：

1. 判断 `CONFIG_PUBLISH` 应该如何应用。
2. 判断 `APP_UPGRADE` 应该如何下载和安装。
3. 执行 `REMOTE_CONTROL` 的具体业务动作。
4. 长期持久化 projection 原文。
5. 长期持久化 command inbox。

## 4.2 `tcp-control-runtime` 的责任

`tcp-control-runtime` 只负责 TCP 控制面：

1. 激活终端。
2. 刷新 token。
3. 持久化 terminal identity / credential / binding。
4. 回报 task result。

它不负责：

1. TDP WebSocket。
2. projection 消费。
3. command inbox 消费。
4. 本地 workflow 执行。

## 4.3 业务模块的责任

后续业务模块迁移时，应按业务域消费 projection 或 command。

对于 `tcp.task.release`：

1. 业务模块监听或选择 `tdpProjection.byTopic['tcp.task.release']`。
2. 将 projection payload 转为本包自己的业务 state。
3. 业务 state 才是业务 UI 和业务执行逻辑的真相源。
4. 业务 state 可以持久化、同步到副屏、按 workspace/display 作用域隔离。
5. 原始 projection 只作为输入流，不作为业务长期真相源。

对于 `COMMAND_DELIVERED`：

1. 业务模块或专门的命令消费模块读取 command inbox。
2. 按 `topic` 找到执行者。
3. 执行动作。
4. 成功或失败后通过 `reportTaskResult` 回报。
5. 不把 command inbox 设计成重启后必须补执行的 durable queue。

---

## 5. 旧 `1.1-cores/task` 的真实职责

旧 `_old_/1-kernel/1.1-cores/task` 当前做的是客户端本地流程编排。

核心能力：

1. 注册 `TaskDefinition`。
2. 根据 key 查找任务定义。
3. 支持按操作系统和版本选择不同定义。
4. 通过 adapter 执行节点动作。
5. 内置 command / external call / external subscribe / external on adapter。
6. 通过 Observable 推送 `ProgressData`。
7. 支持 loop 执行。
8. 支持 cancel。
9. 支持任务级 timeout。
10. 通过 requestId 向 request 状态写入进度。

还有一个必须明确继承的旧设计细节：

1. 动态 JS 脚本不是由 task adapter 类执行。
2. 旧工程里 `argsScript / resultScript / condition` 统一走 `base` 包的 `scriptsExecution.executeScript(...)`。
3. task adapter 只负责节点动作本身，例如 command dispatch、external call、external subscribe、external on。
4. 也就是说，旧 task 的真实执行链路是：
   1. 先跑 `condition / argsScript`
   2. 再调用对应 adapter 执行动作
   3. 再跑 `resultScript`
5. 这个分层是对的，新架构应该保留，而不是把 script engine 塞进某个 workflow adapter 里。

这套能力有价值，但它不是服务端 task 域。

旧包命名问题：

1. `task` 和服务端 `task_release / task_instance` 混淆。
2. `task` 和 TDP topic `tcp.task.release` 混淆。
3. `task` 和本地 workflow definition 混淆。
4. 后续业务模块迁移时会让开发者误以为所有平台任务都必须进这个包。

因此新架构不建议继续使用 `task` 作为包名。

---

## 6. 推荐新命名

推荐迁移目标：

1. `1-kernel/1.1-base/workflow-runtime`

备选命名：

1. `flow-runtime`
2. `operation-runtime`
3. `task-workflow-runtime`

最终推荐仍是 `workflow-runtime`。

理由：

1. `workflow` 比 `task` 更准确表达“节点编排 + adapter 执行 + 进度流”。
2. 避免和服务端 task 域冲突。
3. 避免和 TDP `tcp.task.release` topic 冲突。
4. 可以自然承载 loop、cancel、timeout、progress、adapter。
5. 未来也可以服务扫码加购、支付流程、外部事件订阅等本地业务流程。

## 6.1 `workflow-runtime` 的边界

只负责：

1. workflow definition 注册。
2. workflow definition 解析。
3. workflow run 创建。
4. workflow step 执行。
5. adapter 调度。
6. progress stream。
7. cancel / timeout。
8. workflow run read model。

不负责：

1. 服务端 task release 建模。
2. 服务端 task instance 生命周期。
3. TDP projection 同步。
4. TDP command inbox。
5. TCP task result HTTP 细节。
6. React hooks。

## 6.2 `workflow-runtime` 与 command 的关系

`workflow-runtime` 可以执行 command，但 command 只是 adapter 的一种。

规则：

1. 跨包业务写入仍然必须通过 command。
2. workflow step 如果要改其他包状态，必须调用对方公开 command。
3. workflow 不允许直接 import 其他包 slice action。
4. workflow progress 可以进入 request projection / request read model。
5. workflow 的内部 step command 应明确标记为内部编排，不污染业务 request 聚合语义。

## 6.3 `workflow-runtime` 与 state 的关系

建议保留两类 state：

1. `workflowDefinitions`
2. `workflowRuns`

`workflowDefinitions`：

1. 保存可序列化 descriptor。
2. 支持按 key 注册。
3. 支持按 platform / OS / version 选择。
4. 是否持久化需要后续按真实来源确认。

`workflowRuns`：

1. 保存运行进度 read model。
2. 用于 UI 和测试观测。
3. 默认 runtime-only。
4. 是否需要持久化未完成 run，后续单独设计，不作为一阶段默认能力。

---

## 7. 后续是否需要 `task-consumer-runtime`

当前不建议新增 `task-consumer-runtime` 包。

原因：

1. `tcp.task.release` 只是一个 TDP topic。
2. 不同业务 task 的消费方式差异会很大。
3. 过早抽统一 consumer 包容易变成新的大而全中心。
4. 当前基础能力已经由 `tdp-sync-runtime` 和 `tcp-control-runtime` 承载。

后续推荐做法：

1. 在真实业务迁移时，由业务包自己消费 `tcp.task.release`。
2. 如果多个业务包反复出现完全相同的消费模板，再抽一个轻量 helper。
3. helper 只做 projection 解包、instanceId 校验、result report 包装，不持有业务状态。

---

## 8. 标准客户端闭环

## 8.1 Projection Task 闭环

标准流程：

1. 服务端创建 `task_release`。
2. 服务端创建 `task_instance`。
3. 服务端写入 `tcp.task.release` projection。
4. TDP 推送 `PROJECTION_CHANGED`。
5. `tdp-sync-runtime` 写入 projection state。
6. `tdp-sync-runtime` ACK projection cursor。
7. 业务模块消费 projection。
8. 业务模块写入自己的业务 state。
9. 业务执行完成后调用 `tcp-control-runtime.reportTaskResult`。
10. 服务端更新 `task_instance.status / resultJson / finishedAt`。

关键语义：

1. 第 6 步只代表数据面已收到。
2. 第 9 步才代表业务完成。
3. 不允许把 projection ACK 当成业务完成。

## 8.2 Command Task 闭环

标准流程：

1. 服务端创建 `REMOTE_CONTROL` release。
2. 服务端创建 `task_instance`。
3. 服务端创建 command outbox。
4. TDP 推送 `COMMAND_DELIVERED`。
5. `tdp-sync-runtime` 写入 command inbox。
6. `tdp-sync-runtime` ACK command。
7. 业务执行者读取 command inbox。
8. 业务执行者按 `topic` 执行动作。
9. 业务执行完成后调用 `tcp-control-runtime.reportTaskResult`。
10. 服务端更新 `task_instance.status / resultJson / finishedAt`。

关键语义：

1. 第 6 步只代表 command 已到达终端。
2. 第 9 步才代表 remote control 的业务动作完成。
3. command inbox 不做长期补执行队列。

---

## 9. 测试约束

后续测试必须覆盖以下真实链路：

1. `mock-terminal-platform` 创建 task release。
2. TDP projection 推送到客户端。
3. 客户端消费 `tcp.task.release` 成业务 state。
4. 主屏业务 state 通过 topology 同步到副屏。
5. TDP command delivered 到客户端。
6. 客户端 ACK 后服务端 delivery status 进入 `ACKED`。
7. 客户端 report task result 后服务端 instance status 进入 `COMPLETED / FAILED`。
8. TDP 断线重连后继续接收新的 task release projection。
9. TDP 重启恢复后基于 cursor 继续增量同步。

当前已经有基础验证：

1. `tdp-sync-runtime` 已验证 projection、scene、multi-terminal、command result roundtrip。
2. `topology-client-runtime` 已验证 terminal projection 主副屏同步。
3. 下一步需要补“业务风格 task read model”的主副屏同步测试。

---

## 10. 迁移结论

旧 `_old_/1-kernel/1.1-cores/task` 后续不应直接迁为 `1-kernel/1.1-base/task`。

推荐迁移为：

1. `1-kernel/1.1-base/workflow-runtime`

旧能力继承清单：

1. `TaskDefinition` 升级为 `WorkflowDefinition`。
2. `TaskNode` 升级为 `WorkflowNode` 或 `WorkflowStep`。
3. `TaskAdapter` 升级为 `WorkflowAdapter`。
4. `ProgressData` 升级为 `WorkflowProgress`.
5. `TaskSystem` 升级为 runtime-scoped `WorkflowRuntime`，不再做全局单例。
6. `executeTask` command 升级为 `runWorkflow` command。
7. `cancel(requestId)` 升级为 `cancelWorkflowRun` command 或 runtime API。
8. `taskDefinitions` slice 升级为 `workflowDefinitions` slice。

必须去掉的旧设计：

1. 全局单例 `TaskSystem.getInstance()`。
2. 直接依赖旧 `storeEntry`。
3. 通过 interconnection slice 直接写 request result。
4. 包名继续叫 `task`。

必须保留并升级的旧设计：

1. definition descriptor 可注册。
2. definition 可由 state 动态更新。
3. definition 可按运行环境选择。
4. adapter 扩展机制。
5. command adapter。
6. external call / subscribe / on adapter 的扩展方向。
7. progress 流。
8. cancel。
9. timeout。
10. loop 执行。
11. requestId 作为业务观测关联 ID。
12. script 执行器与节点 adapter 分层。

---

## 11. 后续执行建议

下一步不急着迁移 `workflow-runtime`。

建议顺序：

1. 先在 `topology-client-runtime/test` 补一个业务风格 task read model 测试模块。
2. 用真实 `mock-terminal-platform` scene 触发 `tcp.task.release`。
3. 主屏消费 projection 成业务 state。
4. 通过 topology 同步到副屏。
5. 再验证 TDP 重连后新的 task projection 仍然能进入业务 state。
6. 这些测试通过后，再开始设计 `workflow-runtime`。

这样可以先证明：

1. 服务端 task 域已经能进入客户端业务真相源。
2. 客户端业务真相源可以主副屏同步。
3. `workflow-runtime` 后续只需解决“本地流程怎么执行”，不需要承担平台 task 域职责。
