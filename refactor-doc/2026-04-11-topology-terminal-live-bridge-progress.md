# 2026-04-11 topology 与 terminal 数据面最小真实联动进展

## 本次目标

在不做“大一统超级集成测试”的前提下，补一个最小但真实的跨基础包联动场景，验证下面这条链路已经可以成立：

1. `tcp-control-runtime` 真实激活终端。
2. `tdp-sync-runtime` 真实连接 `mock-terminal-platform` 并接收 projection。
3. 主屏 runtime 把 terminal projection 消费成一个可 topology 同步的业务 slice。
4. `topology-client-runtime` 通过真实 `dual-topology-host` 把该 slice 镜像到副屏。

这个场景的目标不是覆盖所有 terminal 业务，而是证明：

1. terminal 数据面已经不是孤立能力。
2. topology state-sync 也不是孤立能力。
3. 两者可以通过清晰的 slice 边界自然接起来。

## 本次实现

新增测试支撑：

1. `1-kernel/1.1-base/topology-client-runtime/test/helpers/terminalTopologyBridgeHarness.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge.spec.ts`

同时补充：

1. `1-kernel/1.1-base/topology-client-runtime/package.json`
   为 test 侧增加 `@impos2/kernel-base-tcp-control-runtime`、`@impos2/kernel-base-tdp-sync-runtime` 的 workspace 依赖。

### 设计取舍

本次没有改 topology / TCP / TDP 核心协议，也没有新增运行时产品能力，只做测试桥接：

1. 新增一个测试专用 `terminal-bridge` slice，`syncIntent = master-to-slave`。
2. 新增一个测试专用 command，从主屏 runtime 当前的 `tdpProjection` 中读取指定 projection，并写入该 bridge slice。
3. 副屏只加载相同的 bridge slice + topology runtime，不加载 terminal runtime。

这样做的原因：

1. 最小化联动范围，只证明“terminal 状态可以通过 slice 边界接入 topology”。
2. 不把 terminal runtime 直接塞到副屏，避免把测试目标扩散成“主副屏都跑完整 terminal 栈”。
3. 不为测试去篡改正式包的职责边界。

### 关键实现细节

1. terminal 侧服务仍然使用真实 `0-mock-server/mock-terminal-platform`。
2. topology 侧服务仍然使用真实 `0-mock-server/dual-topology-host`。
3. 主屏 runtime 同时加载：
   1. `tcp-control-runtime`
   2. `tdp-sync-runtime`
   3. `topology-client-runtime`
   4. 测试桥接模块
4. 副屏 runtime 只加载：
   1. `topology-client-runtime`
   2. 测试桥接模块
5. 为避免 `runtime-shell.app-state` 的 protected persistence 报错，测试 runtime 显式注入了内存型 `stateStorage` / `secureStateStorage`。

## 本次验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge.spec.ts`
4. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/*.spec.ts`

全量结果：

1. `topology-client-runtime` scenario test files 由 `5` 个增加到 `6` 个。
2. scenario tests 由 `16` 条增加到 `17` 条。
3. 全部通过。

### 已被证明的语义

本次场景已经证明：

1. 主屏通过真实 TCP/TDP 链路拿到的 projection，可以进入主屏 Redux 真相源。
2. 该真相源可以被拓扑同步机制当作普通业务 slice 处理。
3. 副屏最终观测到的是同步后的业务 state，而不是“某个请求成功了”。

换句话说，后续业务模块迁移时，可以按“业务 slice 真相源 -> topology 同步”这条路线建设，而不必直接耦合 terminal 协议层。

## 当前还没覆盖的内容

当前已经继续覆盖到：

1. terminal projection 连续多次更新后，副屏持续增量跟进。
2. terminal websocket 被服务端强制断开并自动重连后，bridge slice 仍可继续驱动 topology 增量同步。
3. 基于真实 `tcp.task.release` 的业务风格 task read model，已经可以在主屏形成并同步到副屏。
4. 该 task read model 对应的 `task_instance` 已能继续回报服务端完成结果。

新增测试：

1. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge-sequential.spec.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge-reconnect.spec.ts`
3. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel.spec.ts`

同时扩展：

1. `1-kernel/1.1-base/topology-client-runtime/test/helpers/terminalTopologyBridgeHarness.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/helpers/taskReadModelModule.ts`

新增 harness 能力：

1. 支持注入 `tdpReconnectIntervalMs`。
2. 支持对当前活动 TDP session 做服务端强制断开。
3. 支持等待重连后的新 session ready。

### 新增验证结果

已通过：

1. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge-sequential.spec.ts`
2. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-terminal-bridge-reconnect.spec.ts`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel.spec.ts`
4. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/*.spec.ts`

全量结果进一步变更为：

1. `topology-client-runtime` scenario test files 由 `8` 个增加到 `9` 个。
2. scenario tests 由 `19` 条增加到 `20` 条。
3. 全部通过。

### 已新增证明的语义

这两条场景进一步证明：

1. bridge slice 可以承接同一 topic/itemKey 的连续 revision 更新，不是一次性验证。
2. TDP 重连后的增量 projection，仍然可以继续进入主屏业务真相源，并通过 topology 同步到副屏。
3. `tcp.task.release` 不必停留在“测试 bridge slice”层面，已经可以被转换为更接近真实业务包形态的 `task panel` read model。
4. 主屏业务 read model 通过 topology 同步到副屏后，仍可继续沿 TCP `report task result` 闭环回写服务端。

因此目前已经具备“主屏 terminal 数据面恢复后，副屏业务镜像继续正确前进”的基础证明。

### 这次新增的 task panel 模型

这次没有继续在 `terminalTopologyBridgeHarness.ts` 里堆临时逻辑，而是单独补了测试模块：

1. `taskReadModelModule.ts` 订阅 `tdpProjection.byTopic['tcp.task.release']`
2. 将 projection 转成 `TerminalTaskPanelEntry`
3. 以 `instanceId` 为 key 形成业务风格 `Record<string, Entry>` slice
4. `syncIntent = master-to-slave`
5. 副屏直接消费 topology 镜像后的 task panel state

这一层更接近后续真实业务迁移时的写法：

1. projection 只是输入流
2. 业务 slice 才是产品真相源
3. 业务完成后通过 TCP 回报结果

### 仍未覆盖的内容

还没有在同一套 bridge 验证里覆盖：

1. `task panel` 在 TDP forced close / reconnect 后继续接收新的 `tcp.task.release` 并同步到副屏。
2. `REMOTE_CONTROL` command inbox 被业务消费后形成业务 read model，再同步到副屏。
3. 多 topic 并发更新时，业务 read model 分 topic/分域的长期演进语义。
4. 真正业务模块 slice 直接替换测试模块后的迁移落地验证。

这些都应该基于本次 harness 继续扩，不建议回到“大杂烩单文件”测试模式。

## 下一步建议

建议继续沿这条线递进：

1. 先给当前 `task panel` 场景补一个 reconnect 后继续增长的 live spec。
2. 再补一个 `REMOTE_CONTROL` 消费成业务 read model 的 live spec，区分 projection task 与 command task。
3. 等这两类模型都稳定后，再正式进入 `1-kernel/1.2-business` 的业务包迁移。

这样可以保持节奏：

1. 先证基础能力组合成立。
2. 再证复杂恢复链路。
3. 最后再迁移真实业务模块。

补充约束：

1. 这里提到的 “task/scene 相关 slice” 指服务端 task 域在客户端侧形成的业务 read model。
2. 不应把旧 `_old_/1-kernel/1.1-cores/task` 直接当作这个 read model 的落点。
3. 旧 `task` 包后续按 `workflow-runtime` 方向迁移，详见：
   [refactor-doc/2026-04-11-kernel-base-task-domain-and-workflow-boundary.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-11-kernel-base-task-domain-and-workflow-boundary.md)
