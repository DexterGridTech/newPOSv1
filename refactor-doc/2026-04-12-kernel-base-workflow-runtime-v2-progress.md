# 2026-04-12 kernel-base workflow-runtime-v2 进展

## 1. 当前已完成

`1-kernel/1.1-base/workflow-runtime-v2` 已完成第一版最小可用实现，并通过：

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`

已覆盖能力：

1. `run$()` 直接返回 `Observable<WorkflowObservation>`。
2. selector `selectWorkflowObservationByRequestId` 与 observable 终态发射内容同构。
3. workflow 全局串行。
4. 队列中的 workflow 首个状态为 `WAITING_IN_QUEUE`。
5. `runWorkflow` command 返回终态 `RunWorkflowSummary`。
6. definitions source priority：
   1. `host`
   2. `remote`
   3. `module`
   4. `test`
7. `tdpTopicDataChanged(topic = workflow.definition)` 可更新 remote definitions，并在后续执行中立即使用最新定义。

---

## 2. 当前结构

已按职责拆分：

1. `src/features/actors/workflowRunActor.ts`
2. `src/features/actors/workflowControlActor.ts`
3. `src/features/actors/workflowDefinitionMutationActor.ts`
4. `src/features/actors/workflowRemoteDefinitionActor.ts`
5. `src/features/commands/index.ts`
6. `src/features/slices/workflowDefinitions.ts`
7. `src/features/slices/workflowObservations.ts`
8. `src/features/slices/workflowQueue.ts`
9. `src/foundations/defaults.ts`
10. `src/foundations/definitionResolver.ts`
11. `src/foundations/engine.ts`
12. `src/foundations/module.ts`

约束已遵守：

1. `actors/index.ts` 只做聚合导出。
2. `dispatchAction` 与 `dispatchCommand` 语义分开。
3. kernel 层不依赖 React。

---

## 3. 当前测试覆盖

已通过场景：

1. selector observation 与 `run$()` terminal observation 同构。
2. 第二个 workflow 在队列中先收到 `WAITING_IN_QUEUE`。
3. `runWorkflow` command 返回 terminal summary。
4. definitions source priority 解析正确。
5. 远端 topic 更新 workflow definition 后，执行使用最新版本。

---

## 4. 当前仍未完成

这版还是最小可用，不是完整工作流平台。

尚未做：

1. `external-call`
2. `external-subscribe`
3. `external-on`
4. `retry / compensate / loop`
5. 脚本表达式执行
6. timeout / cancel 的更细粒度场景
7. event history limit / queue size limit 真正进入行为
8. 与后续 `topology-runtime-v2` 的 peer 语义协同

---

## 5. 下一步建议

建议下一步继续：

1. 先补 `workflow-runtime-v2` 的 step 能力：
   1. `external-call`
   2. `external-subscribe`
   3. `external-on`
   4. timeout / cancel / retry
2. 再回到 `tdp-sync-runtime-v2` 的 live WS/runtime 层。
3. 然后开始合并 `topology-runtime-v2`。
