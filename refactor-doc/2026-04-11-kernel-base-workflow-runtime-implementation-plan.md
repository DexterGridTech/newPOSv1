# 2026-04-11 kernel-base workflow-runtime 实施计划

## 1. 目标

本轮先完成 `workflow-runtime` 的最小可运行闭环，不做 TDP 动态 definitions 下发。

必须完成：

1. `workflow-runtime` 可作为 `KernelRuntimeModule` 被 `runtime-shell` 加载。
2. `run$()` 返回 `Observable<WorkflowObservation>`，运行过程和终态都通过 observation 发射。
3. `selectWorkflowObservationByRequestId` 与 `run$()` 发射内容同构。
4. 全局串行队列可用，第二个 workflow 在第一个完成前进入 `WAITING_IN_QUEUE`。
5. `runWorkflow` command 复用当前 command 的 `requestId`，等待 workflow 终态并返回摘要。
6. `command` step 通过 `dispatchChild()` 调用子 command。
7. definition 注册、删除、cancel 有公开 command。
8. errorMessages / systemParameters 先注册进 catalog，后续 topic 下发另开阶段。

## 2. 实施切分

### 2.1 公开面

补齐：

1. `src/features/commands/index.ts`
2. `src/types/runtime.ts`
3. `src/foundations/module.ts`
4. `src/foundations/index.ts`
5. `src/index.ts`
6. `src/hooks/index.ts`

关键约束：

1. `1-kernel` 不依赖 React。
2. Slice actions 只在包内使用，不作为跨包写入口。
3. 跨包写入必须走 command。

### 2.2 引擎

收敛 `createWorkflowEngine.ts`：

1. queue FIFO。
2. active run 结束后自动启动下一个。
3. queued run 先写入 `WAITING_IN_QUEUE`。
4. terminal observation 必须发射并 complete。
5. duplicate active requestId 直接结构化失败。
6. disabled / not found definition 形成 failed observation，不让 stream 静默崩掉。
7. `command` step 支持 `input.value.commandName / input.value.payload` 的一阶段协议。

一阶段暂不做：

1. script adapter。
2. external-call / external-subscribe / external-on adapter。
3. durable replay。
4. TDP definitions topic。

### 2.3 测试

先补 vitest 最小闭环：

1. 注册 definition 后 `run$()` 能完成，并且 selector 返回终态 observation。
2. 第二个 workflow 在第一个完成前进入 `WAITING_IN_QUEUE`，第一个完成后第二个再启动。
3. `runWorkflow` command 可执行 `command` step，并返回终态摘要。
4. definition not found 形成 failed observation。
5. duplicate active requestId 抛结构化错误。
6. cancel queued run 后 observation 进入 `CANCELLED`。

## 3. 下一阶段

本轮通过后，继续：

1. TDP workflow definitions topic 下发、增删改和“执行最新 definition”测试。
2. errorMessages topic 下发更新。
3. systemParameters topic 下发更新。
4. script / timeout / retry / loop 的增强测试。
