# 2026-04-11 topology-client-runtime 重连策略收敛进展

## 1. 本次完成内容

已在 `1-kernel/1.1-base/topology-client-runtime` 完成以下收敛：

1. `WS` 重连策略与 `tdp-sync-runtime` 对齐。
2. 生产默认改为无限重连。
3. 重连间隔继续参数化，默认 `20000ms`。
4. 测试场景支持显式限制重连次数。
5. `test/tsconfig.json` 已修正为可覆盖跨包 test helper 与 mock server 引用，不再沿用错误的包内 `rootDir`。

---

## 2. 关键设计结论

### 2.1 重连仍由 `topology-client-runtime` 自己编排

本次没有把自动重连下沉到 `transport-runtime`。

原因：

1. `transport-runtime` 只负责 transport 连接与事件上报。
2. `topology-client-runtime` 重连时还要重新执行 `hello -> resume -> state-sync` 协议编排。
3. 这和 `tdp-sync-runtime` 的“业务 runtime 自己拿最新上下文并决定是否重连”保持一致。

### 2.2 参数模型与 TDP 收敛

新增参数：

1. `kernel.base.topology-client-runtime.server.reconnect-attempts`

默认值：

1. `server.reconnect-interval-ms = 20000`
2. `server.reconnect-attempts = -1`

语义：

1. `-1` 表示无限重连。
2. `0 / 1 / 2 / ...` 表示有限重连次数。
3. 测试或特殊装配可通过 `createTopologyClientRuntimeModule({ socket: { reconnectAttempts } })` 显式覆盖。

---

## 3. 代码落点

本次改动集中在：

1. `1-kernel/1.1-base/topology-client-runtime/src/supports/parameters.ts`
2. `1-kernel/1.1-base/topology-client-runtime/src/types/runtime.ts`
3. `1-kernel/1.1-base/topology-client-runtime/src/foundations/module.ts`
4. `1-kernel/1.1-base/topology-client-runtime/src/foundations/orchestrator.ts`
5. `1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json`
6. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/connection-runtime.spec.ts`
7. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/context-runtime.spec.ts`
8. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/dispatch-runtime.spec.ts`

具体说明：

1. `orchestrator` 在 `scheduleReconnect()` 中增加重连上限判断。
2. `createResolvedBinding()` 不再把 `reconnectAttempts` 硬编码为 `0`。
3. 模块入参新增 `socket.reconnectAttempts`，用于测试与特殊装配覆盖。
4. 测试编译配置改成与 `tdp-sync-runtime/test` 一致的仓库级 `rootDir`。

---

## 4. 当前验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/connection-runtime.spec.ts`

新增或强化验证点：

1. 参数默认值可解析出 `serverReconnectAttempts = -1`。
2. 延迟启动 host 的场景下，客户端会按参数间隔自动重连并最终连上。
3. 当 `socket.reconnectAttempts = 2` 时，客户端最多只会再调度两次重连，然后停在 `DISCONNECTED`。

---

## 5. 与当前业务要求的对应关系

这一轮之后：

1. `tdp-sync-runtime` 与 `topology-client-runtime` 都采用“生产无限重连，测试可限次，间隔参数化”的同一原则。
2. `topology-client-runtime` 仍保留业务层编排权，不会被 `transport-runtime` 抢走协议语义。
3. IDEA 中此前这包 `test` 目录大量 `TS6059` / `TS2307` 级别的路径配置问题已被收敛到可编译状态。

---

## 6. 下一步建议

建议按下面顺序继续：

1. 回到 `tdp-sync-runtime`，继续补真实 live 场景：
   1. `COMMAND_DELIVERED`
   2. restart-recovery
   3. fault / scene 联动
2. 然后再决定是继续把旧 `tcp-client / tdp-client` 迁移完，还是开始收敛下一个 core 基础包。

