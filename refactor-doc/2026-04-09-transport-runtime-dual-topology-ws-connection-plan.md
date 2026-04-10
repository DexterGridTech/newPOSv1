# transport-runtime 双机 WS 接线实施计划

## 1. 目标

本轮目标是验证 `transport-runtime` 可以正式承载双机 WebSocket 消息流，而不是继续在联调测试中手写裸 `WebSocket` 编排。

## 2. 边界

本轮只做测试承载层，不改变正式架构边界：

1. 不在 `1-kernel/1.1-base/transport-runtime/src` 中引入 Node `ws`。
2. 不在 `transport-runtime` 中解释 `request owner / projection / command lifecycle`。
3. 不创建新的 topology client 或 host client 包。
4. Node `ws` 只作为测试侧 `SocketTransport` 适配器存在。

## 3. 文件计划

新增：

1. `1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport.ts`
2. `1-kernel/1.1-base/transport-runtime/test/scenarios/dual-topology-socket-runtime.spec.ts`

修改：

1. `1-kernel/1.1-base/transport-runtime/package.json`
2. `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

## 4. 验证场景

新增测试会启动真实 `dual-topology-host`，然后：

1. 用 `SocketProfile + SocketRuntime` 建立 master 连接。
2. 用 `SocketProfile + SocketRuntime` 建立 slave 连接。
3. 通过 transport 发送 `node-hello` 并读取 `node-hello-ack`。
4. owner runtime 创建 remote dispatch。
5. 通过 master transport 发送 `command-dispatch`。
6. slave transport 收到 dispatch 后，由 peer runtime 执行。
7. peer runtime 通过 slave transport 回传 command events。
8. master transport 收到 events 后，owner runtime 应用事件并收敛 projection。

## 5. 验证命令

本轮完成后至少运行：

1. `corepack yarn workspace @impos2/kernel-base-transport-runtime type-check`
2. `corepack yarn workspace @impos2/kernel-base-transport-runtime test`
3. `corepack yarn workspace @impos2/dual-topology-host test`
