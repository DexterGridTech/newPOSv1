# 2026-04-12 workflow-runtime 协议收口实现计划

## 1. 目标

把 `refactor-doc/2026-04-12-kernel-base-workflow-protocol-refinement.md` 中确认的协议落到当前实现里。

本轮不迁业务包，只改基础包：

1. `1-kernel/1.1-base/platform-ports`
2. `1-kernel/1.1-base/workflow-runtime`

## 2. 需要改的文件

### platform-ports

1. `src/types/ports.ts`
   - 增加 `ScriptExecutorPort`
   - `PlatformPorts` 增加可选 `scriptExecutor`
2. `test/index.ts`
   - 验证 `createPlatformPorts` 能保留 `scriptExecutor`

### workflow-runtime

1. `src/types/runtime.ts`
   - 收紧 `RunWorkflowSummary`
2. `src/foundations/module.ts`
   - `toRunSummary` 改成 `result.output / variables / stepOutputs`
3. `src/foundations/definitionResolver.ts`
   - 增加 source 分层解析
4. `src/selectors/index.ts`
   - selector 不再简单拼四个 source
   - 提供 resolver 需要的 source-aware definitions
5. `src/foundations/createWorkflowEngine.ts`
   - 读取 source-aware definitions
   - 引入 expression / mapping / script 执行链
6. `src/types/definition.ts`
   - 必要时补充 mapping 类型说明
7. `test/scenarios/workflow-runtime.spec.ts`
   - 补 source 优先级测试
   - 补 summary result 测试
   - 补 script input/output/condition 测试

## 3. 实施顺序

1. 先补 `platform-ports` 的 `scriptExecutor` 类型和测试。
2. 再补 workflow definition source-aware selector / resolver 测试。
3. 实现 source 优先级。
4. 补 summary result 测试并改 `RunWorkflowSummary`。
5. 补 script/mapping 测试。
6. 实现 workflow 内部标准执行链。
7. 运行：
   - `corepack yarn workspace @impos2/kernel-base-platform-ports test`
   - `corepack yarn workspace @impos2/kernel-base-platform-ports type-check`
   - `corepack yarn workspace @impos2/kernel-base-workflow-runtime test`
   - `corepack yarn workspace @impos2/kernel-base-workflow-runtime type-check`

## 4. 验收标准

1. `host > remote > module > test` 生效。
2. `RunWorkflowSummary.result.output` 包含 workflow 对外输出。
3. `RunWorkflowSummary.result.stepOutputs` 包含 step 输出摘要。
4. `condition` 为 false 时 step 被跳过。
5. input script 能生成 command/custom step 输入。
6. output script 能生成最终 output。
7. workflow 业务异常仍然进入 observation，不走 observable error。
