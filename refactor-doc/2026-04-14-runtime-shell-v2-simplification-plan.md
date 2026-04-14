# runtime-shell-v2 简化计划

日期：2026-04-14

目标：解决 `runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts` 单文件职责过重的问题，避免它演化成新的 `ApplicationManager`。

约束：

1. 外部 API 不变。
2. `createKernelRuntimeV2` 函数名、导出路径不变。
3. command / actor / request lifecycle / state sync / initialize 行为不变。
4. 只做内部结构拆分，不新增包。

拆分方案：

1. `catalogBootstrap.ts`
   负责默认 error catalog 和 parameter catalog 写入。
2. `stateSyncRuntime.ts`
   负责 sync slice 查询和远端 state diff 应用。
3. `actorRegistry.ts`
   负责从 modules 收集 actor handler，并按注册顺序保存。
4. `commandDispatcher.ts`
   负责本机 command dispatch、peer dispatch、actor 执行、超时与 re-entry 防护。
5. `runtimeLifecycle.ts`
   负责 runtime start 阶段的日志、catalog bootstrap、module install、initialize command。

保留在 `createKernelRuntimeV2.ts` 的内容：

1. runtimeId/localNodeId/platformPorts/modules/stateRuntime/ledger 的创建。
2. store/action/state/request/sync/peer gateway 的胶水组合。
3. 返回 `KernelRuntimeV2` 对象。

验证：

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`

落地结果：

1. `createKernelRuntimeV2.ts` 已收敛为 runtime 组装入口，只保留 runtimeId / localNodeId / stateRuntime / ledger / lifecycle / dispatcher 的装配逻辑。
2. command dispatch、catalog bootstrap、parameter resolve、state sync、module lifecycle、actor registry 已拆到独立内部文件。
3. 新增内部文件不再通过 `src/foundations/index.ts` 对外暴露，避免内部拆分反向变成公开 API。
4. 外部入口、函数名、行为语义保持不变，`createKernelRuntimeV2` 仍是唯一核心创建入口。

本轮完成后状态：

1. `runtime-shell-v2` 已不再由单文件承担完整 ApplicationManager 式职责。
2. 外部开发者阅读入口仍然保持为 `src/application/*` 与 `src/index.ts`。
3. 后续如果继续优化，应优先处理 `requestLedger.ts` 的生命周期映射正确性，而不是继续拆分 `createKernelRuntimeV2.ts`。

本轮验证结果：

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check` 通过。
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test` 通过，`17` 个测试全部通过。
