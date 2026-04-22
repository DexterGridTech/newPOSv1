# 2026-04-12 kernel-base workflow-runtime-v2 设计文档

## 1. 结论

`workflow-runtime-v2` 是旧 `_old_/1-kernel/1.1-cores/task` 在新基础架构下的正式迁移目标。

它不是服务端 task 域，也不是 TDP projection 包，而是终端本地工作流编排运行时。

v2 需要同时满足四条已经确认的硬要求：

1. `run()` 直接返回 `Observable<WorkflowObservation>`，持续发射过程状态和最终结果。
2. 提供按 `requestId` 查询的 selector/query，返回内容与 observable 发射内容同构。
3. workflow 全局串行执行，后进入的 workflow 可以先 `run()`，但状态必须先是 `WAITING_IN_QUEUE`。
4. workflow definitions 能从 TDP topic 动态更新，并在后续执行中立即使用最新 definition。

同时，这一版必须回到统一的 `Command / Actor` 心智：

1. 对外业务入口是 `runWorkflow` command。
2. `workflow-runtime-v2` 自己通过 actor 处理这个 command。
3. 来自 TDP 的 topic 更新也统一转成 command：`tdpTopicDataChanged`。
4. workflow 不再依赖额外广播 API。

---

## 2. 包身份

目标包：

1. 目录：`1-kernel/1.1-base/workflow-runtime-v2`
2. 包名：`@impos2/kernel-base-workflow-runtime-v2`
3. `moduleName`：`kernel.base.workflow-runtime-v2`

依赖：

1. `runtime-shell-v2`
2. `tdp-sync-runtime-v2`
3. `platform-ports`
4. `state-runtime`

可选依赖：

1. `tcp-control-runtime-v2`

---

## 3. 职责边界

负责：

1. workflow definition 注册、存储、解析。
2. workflow run 创建。
3. 串行队列调度。
4. step 执行编排。
5. 脚本执行与 mapping。
6. `Observable<WorkflowObservation>` 发射。
7. `requestId -> observation` 查询。
8. cancel / timeout / retry / skip / compensate / loop。
9. 接收 `tdpTopicDataChanged` 更新远程 definitions。

不负责：

1. 服务端 task 发布模型。
2. TDP raw projection 仓库。
3. TCP task result HTTP 控制面。
4. request 真相源。
5. React hook。
6. 主副 peer 路由。

---

## 4. 公开接口

## 4.1 Runtime API

```ts
export interface WorkflowRuntimeV2 {
    run$<TInput = unknown>(input: RunWorkflowInput<TInput>): Observable<WorkflowObservation>
    cancel(input: CancelWorkflowRunInput): void
    getObservation(requestId: RequestId): WorkflowObservation | undefined
}
```

语义：

1. `run$()` 返回后，即使 workflow 尚未运行，也必须立刻能收到首个 observation。
2. 如果当前有其他 workflow 在执行，新 workflow 的首个 observation 状态就是 `WAITING_IN_QUEUE`。
3. 到达终态后，再发最后一次 observation，然后 complete。

## 4.2 Public Command

对外公开 command：

1. `runWorkflow`
2. `cancelWorkflowRun`
3. `registerWorkflowDefinitions`
4. `removeWorkflowDefinition`

说明：

1. 跨包调用 workflow，统一走 `runWorkflow` command。
2. 包内测试或某些宿主桥接可直接使用 `run$()`。
3. `runWorkflow` command 最终也复用同一个 workflow engine。

---

## 5. 结果协议

## 5.1 细粒度运行态：`WorkflowObservation`

`run$()` 与 selector/query 返回同构对象：

```ts
export interface WorkflowObservation<TOutput = unknown> {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    status: 'WAITING_IN_QUEUE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
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

这就是：

1. observable 发射内容。
2. selector/query 返回内容。
3. UI/业务层查看过程状态的唯一正式模型。

## 5.2 终态摘要：`RunWorkflowSummary`

跨包 command 结果只返回终态摘要，不返回整份 observation。

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

原因：

1. request projection 只承载终态摘要，不能塞入整份 observation。
2. 业务仍然可以只靠 `requestId` 查看是否完成和最终结果。
3. 如果想看全过程，再用 requestId 读 observation selector/query。

---

## 6. 队列模型

## 6.1 串行执行

所有 workflow run 全局串行。

规则：

1. 同一时刻只允许一个 workflow 处于 `RUNNING`。
2. 后续 workflow 可先进入队列。
3. 队列中的 workflow observation 状态固定为 `WAITING_IN_QUEUE`。

## 6.2 排队行为

当第二个 workflow 在第一个还没完成时执行 `run$()`：

1. 不报错。
2. 立即返回 observable。
3. observable 首个事件状态是 `WAITING_IN_QUEUE`。
4. selector/query 也能立刻查到同样状态。

## 6.3 去重规则

默认：

1. 同一个 active `requestId` 不允许再创建第二个 workflow run。
2. 如果重复创建，同步抛结构化错误。

原因：

1. 业务仍然主要围绕 `requestId` 进行观测。
2. 不允许一个 requestId 映射多个活动 workflow run，避免语义模糊。

---

## 7. request 与 workflow 的关系

## 7.1 request 仍然是一等主语

旧业务大量场景只拿 `requestId`。

这一点必须继承：

1. workflow 内部可以新增 `workflowRunId`。
2. 但 `requestId` 仍然是业务主入口。

## 7.2 request 真相不在 workflow state

这一版已经确认：

1. request 真相在 `runtime-shell-v2.RequestLedger`。
2. workflow 不需要把 request 再写进 Redux。
3. workflow 只需要保证按 requestId 能查到 observation。

## 7.3 `runWorkflow` command 与 request projection 的衔接

流程：

1. 业务发出 `runWorkflow` command。
2. `runtime-shell-v2` 先同步创建 request record。
3. `workflow-runtime-v2` actor 处理 `runWorkflow`。
4. workflow 运行过程中，细粒度状态只写 observation state。
5. workflow 终态后，`runWorkflow` command 返回 `RunWorkflowSummary`。
6. request projection 只接这个终态摘要。

也就是说：

1. request projection 负责“请求最终怎样了”。
2. workflow observation 负责“过程跑到哪了”。

---

## 8. Definition 模型

## 8.1 definitions state

继续按 source 分层：

1. `module`
2. `host`
3. `remote`
4. `test`

持久化：

1. `workflowDefinitions.bySource` 持久化。

原因：

1. 动态 definitions 必须重启可恢复。
2. remote definitions 不能覆盖 module/host/test definitions。

## 8.2 source 优先级

固定为：

1. `host`
2. `remote`
3. `module`
4. `test`

解析规则：

1. 先按 source 层级寻找候选集。
2. 找到第一个非空 source 后停止继续向下找。
3. 在该 source 内再按平台匹配和 `updatedAt` 选最终 definition。

## 8.3 `workflowKey` 仍是业务引用主键

旧业务大量配置只保存 `taskDefinitionKey`。

新规则：

1. 迁移后业务配置只需要保存 `workflowKey`。
2. 业务不需要关心 definitionId、source bucket、远程 topic。

---

## 9. 与 TDP 的动态对接

## 9.1 topic

推荐固定：

1. `workflow.definition`

说明：

1. 具体 topic key 可由宿主传入覆盖。
2. 默认值应稳定，不使用模糊通配。

## 9.2 接入方式

这版统一走 `tdpTopicDataChanged` command，不再走特殊广播通道。

流程：

1. `tdp-sync-runtime-v2` 处理 raw projection。
2. 计算 resolved 生效变化。
3. 发出 `tdpTopicDataChanged({topic, changes})`。
4. `workflow-runtime-v2` 自己的 actor 处理这个 command。
5. 更新 `workflowDefinitions.bySource.remote`。

## 9.3 delete fallback

例如：

1. `STORE` scope 下有 workflow definition A。
2. `TERMINAL` scope 下又覆盖一条 definition A。

则：

1. 当前执行优先使用 `TERMINAL`。
2. 删除 `TERMINAL` 后，应自动回退到 `STORE`。
3. `workflow-runtime-v2` 不自己做 scope 计算，而是依赖 `tdp-sync-runtime-v2` 发出的 resolved change。

---

## 10. 脚本执行边界

## 10.1 不过度限制 script

用户已经明确要求：

1. 这不是开放系统。
2. script 不需要被过度限制。
3. 业务自己会负责 script 质量。

因此这版设计不做过重沙箱限制，不把 workflow 设计成对外开放平台。

## 10.2 仍然保持清晰分层

虽然不过度限制，但分层必须清楚：

1. `condition / argsScript / resultScript / mapping` 由 workflow runtime 自己编排。
2. 真正执行脚本的引擎通过 `platform-ports.scriptExecutor` 注入。
3. adapter 只负责 step 动作，不负责解释 workflow script。

建议端口：

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

说明：

1. Node/Web 可以保留开发友好的默认实现。
2. Android/Electron 复用现有成熟脚本基础设施。

---

## 11. Step 模型

继续保留并规范下面几类 step：

1. `flow`
2. `command`
3. `external-call`
4. `external-subscribe`
5. `external-on`
6. `custom`

最重要的是 `command` step。

规则：

1. command step 通过 `handlerContext.dispatch(...)` 发出 child command。
2. child command 自动进入同一个 requestId。
3. workflow 不直接改写 request 真相。

---

## 12. Actor 设计

建议 actor：

1. `WorkflowRunActor`
2. `WorkflowControlActor`
3. `WorkflowDefinitionMutationActor`
4. `WorkflowRemoteDefinitionActor`

### 12.1 `WorkflowRunActor`

处理：

1. `runWorkflow`

职责：

1. 创建或复用 workflow run。
2. 触发队列调度。
3. 等待终态 observation。
4. 返回 `RunWorkflowSummary`。

### 12.2 `WorkflowControlActor`

处理：

1. `cancelWorkflowRun`

职责：

1. 取消活动 workflow 或队列中的 workflow。
2. 保证 observation 状态变为 `CANCELLED`。

### 12.3 `WorkflowDefinitionMutationActor`

处理：

1. `registerWorkflowDefinitions`
2. `removeWorkflowDefinition`

职责：

1. 更新 definitions state。
2. 保持 source-aware 存储。

### 12.4 `WorkflowRemoteDefinitionActor`

处理：

1. `tdpTopicDataChanged`

职责：

1. 仅当 topic 匹配 workflow definition topic 时处理。
2. 将变化应用到 `remote` source bucket。
3. 不直接扫描 raw projection 仓库。

---

## 13. 观测模型

## 13.1 selector/query

至少暴露：

1. `selectWorkflowObservationByRequestId`
2. `selectWorkflowObservationStatusByRequestId`
3. `selectActiveWorkflowObservation`
4. `selectWorkflowDefinition(workflowKey)`

说明：

1. 这些 selector 用于 state 读模型。
2. 同时 runtime facade 也应提供 `getObservation(requestId)`。

## 13.2 observable 与 selector 同构

这是这一版的硬约束：

1. observable 发射什么，selector/query 就返回什么。
2. 业务层不需要记两套不同协议。

---

## 14. 错误与参数

至少保留：

1. workflow definition 不存在
2. duplicate request
3. step 执行失败
4. step 超时
5. script 执行失败
6. queue 调度异常

参数至少包括：

1. 默认 workflow timeout
2. event history limit
3. queue size limit

说明：

1. 这些参数要进入行为，不只是挂 catalog。
2. 错误 key 与参数 key 统一使用 `kernel.base.workflow-runtime-v2.*`

---

## 15. 与其他包边界

### 15.1 与 `runtime-shell-v2`

依赖：

1. command/actor 执行模型。
2. request ledger 查询。
3. command child dispatch。

### 15.2 与 `tdp-sync-runtime-v2`

只依赖：

1. `tdpTopicDataChanged`

不依赖：

1. raw projection repository。
2. scope priority 计算细节。

### 15.3 与 `tcp-control-runtime-v2`

可选依赖：

1. workflow 内部某些 command step 可能调用 `reportTaskResult`。

但 workflow runtime 自己不自动上报 task result。

---

## 16. 测试门槛

### 16.1 单包测试

必须覆盖：

1. `run$()` 首次发射 observation。
2. 第二个 workflow 在队列中时状态为 `WAITING_IN_QUEUE`。
3. `selector/query` 返回内容与 observable 发射内容同构。
4. 同一 active `requestId` 重复运行时报错。
5. `command` step 触发 child command 并进入同一 request。
6. cancel 生效。
7. timeout 生效。
8. 脚本执行失败正确进入 observation error。

### 16.2 真实联调测试

必须结合：

1. `tdp-sync-runtime-v2`
2. `0-mock-server/mock-terminal-platform`

重点覆盖：

1. TDP 发布 workflow definition topic。
2. 终端收到 add/update/delete。
3. `workflowDefinitions.remote` 正确更新。
4. 执行时使用最新 definition。
5. 高优先级 delete 后回退到低优先级 definition。
6. remote definitions 不覆盖 module/host definitions。

---

## 17. MVP 范围

第一阶段实现：

1. `run$()` observable-first
2. requestId query/selectors
3. 串行队列
4. definitions source-aware 持久化
5. `tdpTopicDataChanged` 对接远程 definitions
6. 基础 step 执行与脚本执行端口

第一阶段不实现：

1. durable workflow replay
2. 多 workflow 并行
3. 云端 workflow 市场

---

## 18. 下一步

第一阶段 4 个 v2 设计文档已经齐备：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `tdp-sync-runtime-v2`
4. `workflow-runtime-v2`

下一步可以开始进入实现阶段。
