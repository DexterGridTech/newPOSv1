# 2026-04-13 kernel-base v2 夜间进展

## 1. 本轮完成项

本轮按夜间计划实际完成了下面事情：

1. `1-kernel/1.1-base/contracts`
   1. 已补常用 validator，并从包出口导出：
      1. `nonEmptyString`
      2. `finiteNumberAtLeast`
      3. `positiveFiniteNumber`
      4. `nonNegativeFiniteNumber`
      5. `integerAtLeast`
2. `1-kernel/1.1-base/runtime-shell-v2`
   1. 已补 request ledger 的远端镜像能力：
      1. `registerMirroredCommand`
      2. `applyRemoteCommandEvent`
      3. `applyRequestLifecycleSnapshot`
   2. 已补运行时公开 API 和 module context 对应能力，供 `topology-runtime-v2` 正式使用。
   3. 已补单测覆盖远端 command completion 与 request snapshot 导入。
3. `1-kernel/1.1-base/topology-runtime-v2`
   1. 已完成首版落地，承担旧 `topology-runtime` + `topology-client-runtime` 合并方向。
   2. 已修复 live 连接首个关键缺陷：
      1. `node-hello` 发送时机调整到 `await socketRuntime.connect(...)` 之后。
   3. 已修复 peer 识别缺陷：
      1. 不再只依赖 `node-hello-ack.peerRuntime`
      2. 会从 `resume-begin`、`command-dispatch`、`command-event`、`request-lifecycle-snapshot`、`state-sync-*` 等消息补齐 peer 上下文
   4. 已修复 resume 回声问题：
      1. 收到 `resume-begin` 后只发送 resume artifacts
      2. 不再递归再次 `beginResume()`
   5. 已接入 `runtime-shell-v2` 新增的镜像能力：
      1. 远端 `command-dispatch` 会先注册 mirrored command
      2. 远端 `command-event` 会更新 request ledger
      3. 远端 `request-lifecycle-snapshot` 会导入 request ledger
   6. 已补 unit/live 测试：
      1. context 投影
      2. 无 assembly 失败
      3. peer gateway 路由
      4. mirrored remote event
      5. dual-topology-host live connection
4. `1-kernel/1.1-base/tcp-control-runtime-v2`
   1. 本轮未再改架构，但已完成全量回归验证。
5. `1-kernel/1.1-base/tdp-sync-runtime-v2`
   1. 本轮未再改业务协议，但已完成全量回归验证。
   2. 已修复测试基础设施问题：
      1. `vitest.config.ts` 增加 `fileParallelism: false`
      2. 避免 live 测试并行时共享 `mock-terminal-platform` 模块级数据库连接导致偶发失败
   3. `tdp-sync-runtime-v2-live-restart-recovery.spec.ts` 已显式放宽单测试超时到 `15_000`
6. `1-kernel/1.1-base/workflow-runtime-v2`
   1. 本轮未再改功能，但已完成全量回归验证。

## 2. 本轮关键判断

### 2.1 topology v2 不是“不可用”，而是之前缺少几个关键运行时语义

已确认之前卡点主要有三类：

1. peer 识别来源过窄，只看 `hello ack`
2. `resume-begin` 处理方式错误，形成主副机回声循环
3. `runtime-shell-v2` 还没有正式暴露远端 request 镜像能力，导致 topology v2 只能停在“能转发消息”，不能把结果回写到 request 真相源

本轮已经把这三点补齐。

### 2.2 tdp-sync-runtime-v2 剩余失败不是协议错误，而是测试并行污染

已确认现象：

1. `tdp-sync-runtime-v2-live-restart-recovery.spec.ts` 单跑稳定通过
2. 整包跑时偶发在最后一个 `waitFor` 阶段超时
3. 根因是 live 测试文件并行时，`mock-terminal-platform` test server 共享模块级 DB 连接重置链路，产生非业务性干扰

处理方式：

1. 对 `tdp-sync-runtime-v2` 测试关闭文件级并行
2. 保留真实 live/restart 场景，不用假 mock 替代

## 3. 验证结果

本轮完成后，以下命令已通过：

1. `corepack yarn workspace @impos2/kernel-base-contracts test`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
3. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
4. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 test`
5. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
6. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`
7. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 type-check`
8. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test`

其中 live/mock 联调已覆盖：

1. `mock-terminal-platform`
   1. TCP v2 live roundtrip
   2. TCP v2 restart recovery
   3. TDP v2 live roundtrip
   4. TDP v2 reconnect
   5. TDP v2 restart recovery
   6. TDP v2 system catalog live bridge
   6. Workflow v2 remote definitions
2. `dual-topology-host`
   1. topology-runtime-v2 live connection
   2. topology-runtime-v2 remote command roundtrip
   3. topology-runtime-v2 projection mirror
   4. topology-runtime-v2 state sync master -> slave
   5. topology-runtime-v2 state sync slave -> master
   6. topology-runtime-v2 reconnect + resume + continuous sync recovery

## 4. 当前剩余缺口

当前判断需要更新：

1. `contracts`、`runtime-shell-v2`、`tcp-control-runtime-v2`、`tdp-sync-runtime-v2`、`workflow-runtime-v2`、`topology-runtime-v2`
   1. 都已经进入可继续迁移后续 kernel 旧 core 能力的基线。
2. `topology-runtime-v2` 这一轮已经补齐之前列出的关键 live 缺口：
   1. 远端 command roundtrip
   2. request snapshot / projection mirror
   3. state sync master -> slave
   4. state sync slave -> master
   5. relay disconnect 后 reconnect + resume + continuous sync 恢复
3. 当前真正还没有开始的，不是 `topology-runtime-v2` 自身的基础能力，而是“哪些 v2 使用方需要正式接入 topology v2 peer 路由”。

也就是说，当前剩余工作已经从“补 topology-runtime-v2 自身闭环”切换为“让后续包逐步消费 topology-runtime-v2 的 peer 能力”。

## 5. 对“是否可以开始业务模块迁移”的结论

结论更新为：

1. `contracts`、`runtime-shell-v2`、`tcp-control-runtime-v2`、`tdp-sync-runtime-v2`、`workflow-runtime-v2`
   1. 已达到可以继续承接业务迁移的状态
2. `topology-runtime-v2`
   1. 已达到可以继续做核心能力迁移的状态
   2. 远端 command、request mirror、projection mirror、state sync、reconnect/resume 都已有真实联调验证
   3. 现在可以进入“把旧 core 里真正需要双屏 peer 路由的能力逐步迁到 v2”的阶段

## 6. 下一步建议

下一步建议收口为两条：

1. 继续让后续 v2 runtime 按需接入 `topology-runtime-v2`
   1. 优先分析哪些旧 core 能力真的需要 peer route，而不是先广泛接线
   2. 保持“能力依赖 topology，不形成业务反向依赖”
2. 继续推进剩余旧 core 到 base 的迁移
   1. 尤其是后续会直接消费 request / state / peer 同步模型的能力线

不再建议把时间继续花在重复补 `topology-runtime-v2` 自身基础场景上。

## 7. 本轮额外结构收口

1. `transport-runtime` 已删除一条历史遗留的 `dual-topology-socket-runtime.spec.ts`
2. 原因是这条测试本质上在验证旧 `runtime-shell` + 旧 `topology-runtime` 的集成能力，不属于纯 transport 包职责
3. 收口后，`transport-runtime` 只保留：
   1. socket 纯 transport 语义测试
   2. http 纯 transport 语义测试
4. 这样 `1-kernel/1.1-base/transport-runtime` 不再在测试层继续挂着旧执行模型依赖

## 8. 本轮涉及的关键文件

本轮主要新增或修改的关键文件：

1. `1-kernel/1.1-base/contracts/src/foundations/validator.ts`
2. `1-kernel/1.1-base/runtime-shell-v2/src/types/runtime.ts`
3. `1-kernel/1.1-base/runtime-shell-v2/src/types/module.ts`
4. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/requestLedger.ts`
5. `1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts`
6. `1-kernel/1.1-base/runtime-shell-v2/test/scenarios/runtime-shell-v2.spec.ts`
7. `1-kernel/1.1-base/topology-runtime-v2/src/foundations/orchestrator.ts`
8. `1-kernel/1.1-base/topology-runtime-v2/test/scenarios/topology-runtime-v2.spec.ts`
9. `1-kernel/1.1-base/topology-runtime-v2/test/scenarios/topology-runtime-v2-live-connection.spec.ts`
10. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
11. `1-kernel/1.1-base/tdp-sync-runtime-v2/vitest.config.ts`
12. `1-kernel/1.1-base/transport-runtime/package.json`
