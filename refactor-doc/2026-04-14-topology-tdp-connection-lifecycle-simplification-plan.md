# topology-runtime-v2 / tdp-sync-runtime-v2 连接控制简化实现计划

日期：2026-04-14

目标：按 `refactor-doc/2026-04-14-topology-tdp-connection-lifecycle-simplification-design.md` 落地实现，降低 `topology-runtime-v2` 复杂度，并统一 topology / tdp 的 socket lifecycle 控制骨架。

## 实施顺序

### 1. transport-runtime

新增：

1. `src/foundations/socketLifecycleController.ts`
2. `test/scenarios/socket-lifecycle-controller.spec.ts`

职责：

1. 封装 `start / stop / restart / attach`
2. 管 `manualStop / reconnectTimer / reconnectAttempt / connectionToken`
3. 调用方通过 callback 挂协议行为

验证：

1. `type-check`
2. `test`
3. `check:circular`

### 2. tdp-sync-runtime-v2

修改：

1. `src/foundations/sessionConnectionRuntime.ts`
2. 视情况新增 `src/foundations/sessionConnectionLifecycle.ts`

目标：

1. 把 reconnect timer / manualDisconnect / attach listeners / reconnect policy 下沉到 controller
2. 保留 handshake / SESSION_READY / tdpMessageReceived / sendAck / sendPing / sendStateReport 在本包内

验证：

1. `type-check`
2. `test`
3. `check:circular`

### 3. topology-runtime-v2

修改：

1. `src/foundations/orchestrator.ts`
2. 新增 `src/foundations/orchestratorConnection.ts`
3. 新增 `src/foundations/orchestratorDispatch.ts`

目标：

1. 把 socket lifecycle 与 reconnect 骨架下沉到 controller
2. 把 remote command dispatch / wait result 从 orchestrator 主文件拆出去
3. 保留 hello / resume / state-sync / incoming handlers 语义在 topology 包内

验证：

1. `type-check`
2. `test`
3. `check:circular`

## 收口标准

1. `topology-runtime-v2/orchestrator.ts` 明显收薄，不再承担连接控制与远端命令等待全部职责。
2. `tdp-sync-runtime-v2/sessionConnectionRuntime.ts` 不再自己维护 reconnect timer / manualDisconnect / attachOnce 骨架。
3. 两个包的现有 live tests 全部通过。
4. 不新增大而全公共 runtime，也不改变外部 API。
