# 2026-04-12 kernel-base workflow 协议细化记录

## 1. 本轮目标

这轮不是继续加功能代码，而是把旧 `1-kernel/1.1-cores/task` 对业务真正提供的能力，收敛成新 `1-kernel/1.1-base/workflow-runtime` 的正式协议。

重点回答四个问题：

1. 旧 `task` 到底被业务怎样使用。
2. 新 `workflow` 的最终结果应该如何对外暴露。
3. workflow definition 的来源优先级应该怎么定。
4. 动态 JS script 在新架构里到底由谁执行。

---

## 2. 旧 task 被业务真实依赖的点

经过对旧工程的回读，业务真正依赖的不是 `TaskSystem` 单例本身，而是下面三条语义。

### 2.1 业务配置只存 `taskDefinitionKey`

典型场景：

1. 支付功能配置里只保存 `taskDefinitionKey`
2. 业务 actor 执行时，通过 `kernelCoreTaskCommands.executeTask({ taskDefinitionKey, initContext })`
3. 业务本身并不关心 task adapter、node 细节、TaskSystem 生命周期

这说明后续迁移时，最小替代单位不是“迁移 TaskSystem API”，而是：

1. 把 `taskDefinitionKey` 升级成 `workflowKey`
2. 保留“业务配置只引用一个 definition key”的能力

### 2.2 业务常常只拿 `requestId`

典型场景：

1. UI 发起一个 command 或 task
2. 业务只保存 `requestId`
3. 后续通过 `useRequestStatus(requestId)` 读取状态
4. 完成后再从结果里拿最终输出

这说明：

1. `requestId` 在新架构里仍然必须是第一公民
2. `workflowRunId` 可以新增，但不能替代 `requestId` 成为业务层主入口

### 2.3 动态 definitions 会被状态覆盖并持久化

旧 `task` 明确有：

1. `taskDefinitions` slice
2. `updateTaskDefinitions` command
3. `persistToStorage: true`

也就是说，旧架构早就不是“只靠代码静态注册 definition”。

这个价值新架构必须继承：

1. definition 可以动态更新
2. definition 更新后可重启保留
3. 本地定义和远程定义必须共存，而不是互相清空

---

## 3. 旧 task 的真实结果语义

旧 `task` 对业务最别扭但最真实的价值，是它最后仍然把结果挂回了 request 结果体系，导致业务可以：

1. 用 `requestId` 看是否完成
2. 用 `requestId` 去拿最终结果

甚至旧业务里已经出现：

1. `requestStatus.results?.context?.root`
2. `requestStatus.results?.payingMainOrderCode`

这种读取方式说明两个事实：

1. 业务需要“只靠 requestId 就能取最终结果”
2. 旧结果协议不够清晰，导致业务只能猜字段位置

---

## 4. 新 workflow 的结果协议

结论：

1. 细粒度运行态由 `WorkflowObservation` 承担
2. 跨包终态摘要由 `RunWorkflowSummary` 承担
3. `request projection` 中只放终态摘要，不放整份 observation

建议固定终态摘要为：

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

### 4.1 为什么这样设计

因为它同时满足三层诉求：

1. 业务层仍然可以只用 `requestId` 取最终结果
2. UI / 前端如果要看运行过程，可以转去看 observation
3. 不再鼓励业务去猜 `context.root/open/xxx`

### 4.2 结果读取规则

新规则应该强制为：

1. 只关心终态结果：读 request projection 里的 `summary.result.output`
2. 需要兼容性读取上下文：读 `summary.result.variables / stepOutputs`
3. 需要细粒度过程：读 `selectWorkflowObservationByRequestId(requestId)`

---

## 5. 新 workflow 的 definition 来源层级

当前新状态模型已经分了四个 source：

1. `module`
2. `host`
3. `remote`
4. `test`

但后续必须把“来源优先级”写死，否则实现会反复摇摆。

建议固定为：

1. `host`
2. `remote`
3. `module`
4. `test`

解析规则：

1. 先按 source 层级寻找可用候选集
2. 找到第一个非空可用候选集后停止继续降级
3. 只在该 source 内按平台匹配和 `updatedAt` 选最终 definition

### 5.1 这样定的原因

1. `host` 是终端本地明确写入的定义，应拥有最高优先级
2. `remote` 是服务器下发运营配置，高于代码内默认定义
3. `module` 是代码兜底定义
4. `test` 只是测试注入，不应污染正式运行时

### 5.2 与旧 task 的对应关系

旧 `task` 实际只有“代码注册 + state 覆盖”两层。

新架构只是把它精细化为：

1. 本地宿主覆盖
2. 远程运营覆盖
3. 模块默认值
4. 测试注入

本质上是继承旧能力，不是另起炉灶。

---

## 6. Script 执行边界

这块已经确认，必须明确继承旧工程的正确分层。

旧工程真实模型是：

1. `condition / argsScript / resultScript` 由 `base` 的脚本执行器执行
2. 节点动作本身由 task adapter 执行
3. task adapter 不负责解释 workflow script

新架构应保持同样分层：

1. `workflow-runtime` 负责解释 expression / mapping / script
2. workflow adapter 只负责 step 动作
3. 平台具体脚本引擎通过 `platform-ports` 注入

建议补充统一端口：

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

### 6.1 这样做的好处

1. `condition / input / output` 三类脚本规则统一
2. Android / Electron 能直接复用旧脚本能力
3. 不会让每个 adapter 自己长出一套脚本解释规则
4. 远程 workflowDefinitions 下发后也更容易统一执行

---

## 7. 新 workflow 的分层职责

### 7.1 request projection

只负责：

1. request 是否完成
2. 终态摘要
3. 跨端请求生命周期观察

不负责：

1. 细粒度 step 过程
2. queue 状态
3. 全量 workflow context 快照

### 7.2 workflow observation

只负责：

1. queue 状态
2. running 进度
3. step 状态
4. 运行时上下文快照
5. 细粒度事件

### 7.3 workflow definitions

只负责：

1. definition descriptor 仓库
2. 多 source 共存
3. 重启恢复
4. 平台匹配与来源优先级

---

## 8. 旧业务迁移时必须保留的最小体验

后续把旧业务从 `task` 迁到 `workflow` 时，至少要保证下面体验不退化：

1. 业务配置里仍然可以只写 `workflowKey`
2. 发起后仍然可以只存 `requestId`
3. 只看完成与否时继续用 request 结果体系
4. 想看 workflow 过程时再去读 observation selector
5. 动态 definitions 重启后仍然有效

也就是说，迁移后的开发体验应变成：

1. 粗粒度仍然像旧 command/request 一样简单
2. 细粒度再进入 workflow 专用观测模型

---

## 9. 对当前实现的影响

这轮协议细化之后，后续代码层面至少要补下面几件事：

1. `RunWorkflowSummary` 改成显式 `result.output / result.variables / result.stepOutputs`
2. `definitionResolver` 改为按 `host > remote > module > test` 分层解析，而不是简单按时间取最新
3. `workflow-runtime` 增加统一 script executor 依赖
4. `workflow` 的 input/output mapping 与 script 执行链路真正落地

---

## 10. 下一步建议

下一步不直接迁业务包，先做 `workflow-runtime` 第二轮实现收口：

1. 落地 definition source 优先级
2. 收紧 `RunWorkflowSummary` 结构
3. 引入脚本执行端口
4. 落地 `condition -> input mapping/script -> adapter -> output mapping/script` 标准执行链

这四步做完，再开始迁旧 `task` 相关业务包，会稳很多。
