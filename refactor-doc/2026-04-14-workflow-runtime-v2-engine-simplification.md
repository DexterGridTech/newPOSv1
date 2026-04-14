# workflow-runtime-v2 engine 简化记录

日期：2026-04-14

目标：解决 `workflow-runtime-v2/src/foundations/engine.ts` 承担职责过重的问题，避免 workflow 引擎继续演化成新的“大而全运行时文件”。

## 本轮约束

1. 外部 API 不变。
2. `createWorkflowEngineV2` 函数名与导出路径不变。
3. `run$ / runFromCommand / cancel / registerDefinitions / removeDefinition` 的行为语义不变。
4. 不新增包，只拆内部 foundations 文件。

## 旧问题

旧 `engine.ts` 同时承担：

1. workflow 内存运行态管理
2. observable 订阅桥接
3. observation 写入与 trim
4. queue 串行调度
5. definition 解析
6. workflow timeout / step timeout
7. step condition / retry / skip / compensate
8. cancel 处理
9. runtime facade 暴露

文件接近 `900` 行，后续继续打磨 workflow 输入 / 输出 / context 协议时，修改面会过大。

## 本轮拆分结果

### 1. `engine.ts`

保留为 workflow engine 的薄装配层，职责收敛为：

1. 创建内存运行态 `WorkflowEngineMutableState`
2. 装配 config / definitionResolver / observationRuntime / executor
3. 管理 queue 串行调度与 activeRun 切换
4. 暴露 runtime facade 与 `runFromCommand`

### 2. `engineConfig.ts`

负责从 runtime-shell parameter catalog 读取 workflow runtime 参数：

1. `eventHistoryLimit`
2. `queueSizeLimit`
3. `completedObservationLimit`
4. workflow 默认 timeout
5. step 默认 timeout

### 3. `engineDefinition.ts`

负责 workflow definition 解析：

1. 按 source + platform 解析 definition
2. 区分 not found / disabled
3. 将 definition 阶段错误收敛成统一 `AppError`

### 4. `engineObservationRuntime.ts`

负责 observation 运行时语义：

1. 统一 `notify`
2. 统一 selector/state 写入
3. `registry.addObserver` 桥接
4. terminal observation trim

### 5. `engineExecutor.ts`

负责 workflow 执行策略：

1. 创建运行中 observation
2. 递归执行 flow/custom/command/external-* step
3. condition / retry / skip / compensate
4. workflow / step timeout
5. 产出 terminal observation 或 failed-before-start 结果

### 6. `defaults.ts`

补充 `createFailedObservation(...)`，避免 queue/runtime/executor 各自重复拼失败观测对象。

## 当前结构收益

1. `engine.ts` 已从约 `900` 行收敛到 `388` 行。
2. step 执行策略与 queue 编排解耦，后续调整 workflow DSL 时不必直接改 queue/facade。
3. observation trim 与 observer bridge 不再混在执行流程里，阅读主流程更直接。
4. 外部调用方式保持不变，现有模块与测试无需改接口。

## 验证结果

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 type-check` 通过。
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test` 通过，`14` 个测试全部通过。
3. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 check:circular` 通过，无循环依赖。

## 后续仍可继续优化，但不属于本轮阻塞项

1. `engineExecutor.ts` 仍然偏大，后续可以继续拆成：
   1. `stepExecution.ts`
   2. `stepErrorStrategy.ts`
   3. `workflowTerminalization.ts`
2. `engine.ts` 当前仍保留 queue 调度；如果后续 workflow queue 语义再增强，再考虑单独抽 `engineQueueRuntime.ts`。
3. `scriptRuntime.ts` 当前 `314` 行，后续若 workflow 脚本协议继续增强，也可以再拆。
