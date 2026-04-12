# 2026-04-11 tdp-sync-runtime 重连能力当前进展

## 1. 本次完成内容

已在 `1-kernel/1.1-base/tdp-sync-runtime` 落地以下能力：

1. `WS` 默认无限期重连。
2. 重连间隔参数化。
3. 测试场景允许显式限制重连次数，避免测试长时间挂起。
4. 重连后自动重新连接并重新发送 `HANDSHAKE`。
5. 已把测试公共搭建抽到 `test/helpers/runtimeHarness.ts`，后续复杂场景可以拆成多个独立 spec 文件继续扩充。

---

## 2. 关键设计决策

### 2.1 重连编排放在 `tdp-sync-runtime`

本次没有把“自动重连”塞进 `transport-runtime` 通用层，而是放在 `tdp-sync-runtime` 自己编排。

原因：

1. TDP 重连时必须重新取最新 `terminalId` / `accessToken` / `lastCursor`。
2. 重连后必须重新发送 `HANDSHAKE`，这属于协议语义，不是纯传输语义。
3. 这和 `topology-client-runtime` 现有做法是一致的，更容易后续统一两套 `WS` 策略。

### 2.2 默认值继承旧工程节奏

新参数默认值：

1. `kernel.base.tdp-sync-runtime.reconnect-interval-ms = 20000`
2. `kernel.base.tdp-sync-runtime.reconnect-attempts = -1`

说明：

1. `20000ms` 继承旧 `interconnection` 中 `masterServerReconnectInterval` 的节奏。
2. `-1` 表示无限重连，是当前业务硬性要求。

---

## 3. 新增参数

位于：

1. `1-kernel/1.1-base/tdp-sync-runtime/src/supports/parameters.ts`

新增：

1. `tdpReconnectIntervalMs`
2. `tdpReconnectAttempts`

语义：

1. 运行时默认通过 parameter catalog 控制重连间隔。
2. 生产默认无限重连。
3. 测试可通过模块入参 `socket.reconnectAttempts` 或 startup parameter 覆盖为有限次数。

---

## 4. 当前验证情况

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tdp-sync-runtime/test/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime.spec.ts 1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-reconnect.spec.ts`

其中新增验证：

1. socket 断开后会按参数化间隔自动重连。
2. 重连后会再次发出 `HANDSHAKE`。
3. 测试中可把重连次数限制为 `1`，避免无限等待。

---

## 5. 测试结构调整

已新增：

1. `1-kernel/1.1-base/tdp-sync-runtime/test/helpers/runtimeHarness.ts`
2. `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime-reconnect.spec.ts`

说明：

1. 后续真实联调场景不再堆到一个大文件里。
2. 后面至少要继续拆出：
   1. 握手与初次全量同步
   2. 后台数据更新推送
   3. 网络中断与恢复
   4. 控制信号与协议错误
   5. 重启恢复

---

## 6. 下一步

下一步不是继续在包内 mock 上堆逻辑，而是进入真实 `mock-terminal-platform` 联调。

优先顺序：

1. 为 `tdp-sync-runtime` 增加 live harness，负责：
   1. 启动 / 探活 `mock-terminal-platform`
   2. 调 `POST /mock-debug/kernel-base-test/prepare`
   3. 封装 admin 查询接口
2. 按场景拆分 live spec：
   1. `tdp-sync-runtime-live-handshake.spec.ts`
   2. `tdp-sync-runtime-live-projection.spec.ts`
   3. `tdp-sync-runtime-live-reconnect.spec.ts`
   4. `tdp-sync-runtime-live-control-signals.spec.ts`
   5. `tdp-sync-runtime-live-restart-recovery.spec.ts`
3. 做完 TDP live 场景后，再检查 `topology-client-runtime` 是否完全采用相同的 `WS` 重连策略与参数模型。
