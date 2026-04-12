# 2026-04-12 workflow-runtime 协议收口实现进展

## 1. 本轮已完成内容

围绕 `workflow-runtime` 第二轮协议收口，本轮已落地下面四件事：

1. `platform-ports` 增加 `ScriptExecutorPort`
2. `workflow-runtime` definition 解析切到 source-aware 模型
3. `RunWorkflowSummary` 收紧为显式 `result.output / variables / stepOutputs`
4. `workflow-runtime` 补上 `condition -> input mapping/script -> step action -> output mapping/script` 标准执行链

---

## 2. 代码落点

### 2.1 platform-ports

已改：

1. `1-kernel/1.1-base/platform-ports/src/types/ports.ts`
2. `1-kernel/1.1-base/platform-ports/test/index.ts`

结果：

1. `PlatformPorts` 现在支持可选 `scriptExecutor`
2. `createPlatformPorts(...)` 已验证可以透传该端口

### 2.2 workflow-runtime

已改：

1. `src/foundations/definitionResolver.ts`
2. `src/selectors/index.ts`
3. `src/foundations/createWorkflowEngine.ts`
4. `src/foundations/module.ts`
5. `src/foundations/scriptRuntime.ts`
6. `src/foundations/index.ts`
7. `src/types/runtime.ts`
8. `src/supports/errors.ts`
9. `test/scenarios/workflow-runtime.spec.ts`

---

## 3. definition 解析规则

当前实现已不再简单把四个 source 拼成一个数组再按 `updatedAt` 取最新。

已改为：

1. source 优先级：`host > remote > module > test`
2. 先找第一个有可用 definition 的 source
3. 再只在这个 source 内按 `updatedAt` 选 definition

这和文档约束保持一致。

---

## 4. 终态 summary 结构

当前 `runWorkflow` command 返回的 summary 已变成：

```ts
{
  requestId,
  workflowRunId,
  workflowKey,
  status,
  result: {
    output,
    variables,
    stepOutputs,
  },
  error,
  completedAt,
}
```

也就是说：

1. 业务如果只拿 `requestId`，仍可通过 request 结果体系读终态摘要
2. 但不需要再依赖旧式 `results.context.root`
3. 最终应该优先读取 `result.output`

---

## 5. 标准执行链

当前 `workflow-runtime` 已经支持：

1. `condition`
2. `input.value` 中的 script/path/plain value
3. `output.result`
4. `output.variables`

标准链路现在是：

1. 读取当前 context
2. 执行 `condition`
3. 条件不通过则 `SKIPPED`
4. 执行 `input` 解析
5. 执行 step 动作
6. 执行 `output` 解析
7. 更新 `variables / stepOutputs / observation`

本轮先覆盖：

1. `command`
2. `custom`
3. `flow`

外部型 step 还没有做完整 adapter runtime，这部分后续继续补。

---

## 6. root flow 输出规则

为了避免 root flow 最终结果被后置 guard/清理步骤覆盖，本轮明确了一个临时但合理的规则：

1. 优先取 `rootStep.stepKey` 对应的 output
2. 若 root 是 `flow` 且自身无 output，则取第一个已完成子 step 的 output

这个规则比“最后一个完成子 step 覆盖最终结果”更接近当前业务预期。

后续如果需要更强表达力，可以再加显式 root-level output mapping。

---

## 7. 测试结果

已通过：

### platform-ports

1. `corepack yarn workspace @impos2/kernel-base-platform-ports test`
2. `corepack yarn workspace @impos2/kernel-base-platform-ports type-check`

### workflow-runtime

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime test`
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime type-check`

当前 `workflow-runtime` 通过：

1. 2 个 test files
2. 11 个 tests
3. 全部通过

新增覆盖了：

1. definition source 优先级
2. summary 的 `result.output / stepOutputs`
3. `condition` script
4. `input` script
5. `output` script

---

## 8. 第三轮补充收口

在第二轮协议收口基础上，本轮继续补了第三轮最关键的执行语义：

1. `external-subscribe` step 已可通过 `connector.subscribe / unsubscribe` 执行
2. `external-on` step 已可通过 `connector.on` 等待一次事件
3. `compensate` 已收紧为：
   1. 允许执行补偿 step
   2. 但原始失败不会因为补偿成功而被误判为 workflow 成功
4. step timeout 终态已改为 `TIMED_OUT`，不再混成普通 `FAILED`
5. workflow timeout 已正式接入执行链，超时后直接终止整个 run
6. workflow / step 默认 timeout 已接到 runtime parameter 解析：
   1. `kernel.base.workflow-runtime.default-workflow-timeout-ms`
   2. `kernel.base.workflow-runtime.default-step-timeout-ms`
7. timeout 后迟到结果已被忽略，终态不会被后续慢结果覆盖

## 9. 第三轮新增测试

本轮新增：

1. `test/scenarios/workflow-runtime-advanced.spec.ts`

新增覆盖：

1. `external-subscribe`
2. `external-on`
3. `compensate`
4. `runWorkflow.options.timeoutMs` 驱动的 workflow timeout
5. 默认 step timeout 参数
6. 默认 workflow timeout 参数
7. timeout 后 late result 不回写 observation

同时修正了：

1. live remote definitions 删除 definition 后，`runWorkflow` command 失败断言改为命令级 `failed`
2. 旧 timeout 测试改为新协议的 `TIMED_OUT`

---

## 10. 最新测试结果

当前已通过：

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime test`
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime type-check`

当前 `workflow-runtime` 通过：

1. 3 个 test files
2. 22 个 tests
3. 全部通过

---

## 11. 当前还未完成的点

这轮不是最终完成版，下面几件事还要继续：

1. loop 协议还没有进入正式测试和实现收口
2. script 执行日志与脱敏策略还没有按日志规范进一步细化
3. request projection 与 workflow summary 的更多集成测试还不够
4. workflowDefinitions / errorMessages / systemParameters 三类远端动态配置之间还没统一成一套 topic handler 规则

## 12. 下一步建议

下一步继续做 `workflow-runtime`，不要切业务迁移：

1. 继续把 loop 协议做完整
2. 把 workflow 动态配置面与 `tdp-sync-runtime` 的通用 topic 变化命令模型对齐
3. 开始让 `workflow-runtime` 消费真实终端链路中的动态定义和后续参数/错误配置
4. 再把 workflow 与 topology/tcp-control 的闭环边界补严

到这一步后，再开始迁旧 `task` 相关业务包，会更稳。
