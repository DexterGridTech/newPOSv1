# 2026-04-13 旧 base 包退役审计

## 1. 本轮目标

按下面顺序做旧包退役判断：

1. 先对比旧包核心能力是否已经迁到 v2。
2. 再检查仓库内是否还有活依赖。
3. 只有前两项都成立，才删除旧包。

本轮先审计：

1. `1-kernel/1.1-base/tdp-sync-runtime`
2. `1-kernel/1.1-base/tcp-control-runtime`
3. `1-kernel/1.1-base/runtime-shell`
4. `1-kernel/1.1-base/topology-runtime`

## 2. tdp-sync-runtime 审计结论

### 2.1 旧包核心职责

旧 `tdp-sync-runtime` 实际承担的不是单一 websocket 连接，而是一整套 TDP 客户端语义：

1. 会话连接、握手、断线重连。
2. `FULL_SNAPSHOT / CHANGESET / PROJECTION_CHANGED / PROJECTION_BATCH` 消费。
3. projection 仓库持久化与重启恢复。
4. scope priority 生效值计算。
5. `topic-data-changed` 广播。
6. `error.message / system.parameter` 到 runtime-shell catalog 的桥接。
7. `COMMAND_DELIVERED` 入 inbox，并对服务端 outbox / task instance 做 ACK 回写。
8. `EDGE_DEGRADED / SESSION_REHOME_REQUIRED / ERROR` 控制信号接收。
9. projection 流的 `ACK + STATE_REPORT` 反馈。

### 2.2 v2 对应实现

现在这些职责已在 `tdp-sync-runtime-v2` 中明确拆开：

1. `messageActor.ts`
   1. 负责 TDP 服务端消息拆分成内部 command。
2. `projectionRepositoryActor.ts`
   1. 负责 projection 仓库写入与重算触发。
3. `cursorFeedbackActor.ts`
   1. 负责 projection 流的 `ACK + STATE_REPORT` 回写。
4. `commandInboxActor.ts`
   1. 负责 `COMMAND_DELIVERED` 入 inbox。
5. `commandAckActor.ts`
   1. 负责远端 command ACK。
6. `sessionConnectionActor.ts`
   1. 负责 connect / disconnect / ACK / STATE_REPORT / ping 发送。
7. `sessionStateActor.ts`
   1. 负责 ready / pong / degraded / rehome / protocol failed 状态。
8. `topicChangeActor.ts`
   1. 负责 resolved topic 变化广播。
9. `systemCatalogBridgeActor.ts`
   1. 负责 `error.message / system.parameter` 桥接到 `runtime-shell-v2`。
10. `sessionConnectionRuntime.ts`
    1. 负责 socket 连接生命周期与重连参数化。

### 2.3 本轮发现并补齐的关键缺口

本轮发现：v2 虽然保留了 `reportAppliedCursor` 命令和 `sendStateReport()` 发送能力，但之前没有 actor 真正触发它。

这会导致旧包已有、且服务端真实依赖的语义缺失：

1. terminal 收到 projection 后，服务端 session 的 `lastAppliedRevision` 不会推进。
2. 旧 live 场景 `projection -> ack/apply -> server session state` 无法成立。

本轮新增：

1. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/cursorFeedbackActor.ts`
   1. 对 `snapshot / changes / projection / projection-batch` 自动发送：
      1. `acknowledgeCursor`
      2. `reportAppliedCursor`
2. `sessionConnectionActor.ts`
   1. 在发送 ACK / STATE_REPORT 后同步更新本地 `lastAckedCursor / lastAppliedCursor`

### 2.4 当前测试证明

`tdp-sync-runtime-v2` 当前已具备以下证明：

1. `tdp-sync-runtime-v2.spec.ts`
   1. initialize bootstrap
   2. scope priority
   3. effective topic broadcast
   4. system catalog bridge
   5. projection repository persistence / restore
   6. remote command ACK
   7. projection stream `ACK + STATE_REPORT`
2. `tdp-sync-runtime-v2-live-roundtrip.spec.ts`
   1. live handshake + projection roundtrip
3. `tdp-sync-runtime-v2-live-projection-feedback.spec.ts`
   1. live projection 后服务端 session 的 `lastAckedRevision / lastAppliedRevision` 同步推进
4. `tdp-sync-runtime-v2-live-reconnect.spec.ts`
   1. forced close 后 reconnect + projection 继续接收
5. `tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
   1. projection 仓库和 cursor 真正跨进程恢复
6. `tdp-sync-runtime-v2-live-system-catalog.spec.ts`
   1. `error.message / system.parameter` live bridge + fallback delete
7. `tdp-sync-runtime-v2-live-control-signals.spec.ts`
   1. degraded / rehome / protocol error
8. `tdp-sync-runtime-v2-live-command-roundtrip.spec.ts`
   1. `COMMAND_DELIVERED` ACK 到服务端 outbox / task instance
   2. 同一 instance 后续通过 TCP 上报最终结果

### 2.5 当前依赖检查

使用精确搜索，仅检查 `0-mock-server / 1-kernel / 2-ui / 3-adapter / 4-assembly` 活代码：

1. 未发现任何新包或业务包对 `@impos2/kernel-base-tdp-sync-runtime` 的活依赖。
2. 当前命中的只有：
   1. 旧包自己的源码和测试
   2. `yarn.lock`

### 2.6 结论

结论：

1. `tdp-sync-runtime-v2` 已达到旧 `tdp-sync-runtime` 的退役条件。
2. 旧 `tdp-sync-runtime` 可以删除。

## 3. tcp-control-runtime 审计结论

### 3.1 功能对比

旧 `tcp-control-runtime` 的核心职责是：

1. bootstrap 设备信息。
2. terminal activate。
3. credential refresh。
4. task result report。
5. identity / credential / binding 持久化恢复。
6. runtime-only request 观测不跨重启恢复。

`tcp-control-runtime-v2` 当前测试面与旧包基本一一对齐：

1. `tcp-control-runtime-v2.spec.ts`
   1. activate / refresh / result report
   2. request ledger 观测
   3. recovery-only persistence
2. `tcp-control-runtime-v2-live-roundtrip.spec.ts`
   1. 真服务联调 activate / refresh / task result report
3. `tcp-control-runtime-v2-live-restart-recovery.spec.ts`
   1. 真重启恢复 identity / credential / binding

### 3.2 当前依赖检查

活代码里当前还命中的旧依赖只有：

1. `tdp-sync-runtime` 旧包源码 / 测试
2. `tcp-control-runtime` 旧包自身

也就是说：

1. 一旦旧 `tdp-sync-runtime` 删除，旧 `tcp-control-runtime` 也将不再被其他活代码依赖。

### 3.3 结论

结论：

1. `tcp-control-runtime-v2` 已基本达到退役旧包条件。
2. 删除顺序上应放在旧 `tdp-sync-runtime` 删除之后。

## 4. runtime-shell / topology-runtime 退役结论

### 4.1 旧 runtime-shell 的核心职责

旧 `runtime-shell` 主要承担四类事情：

1. 模块装载、state runtime 装载、catalog 装载。
2. command 执行、child dispatch、request projection 聚合。
3. 远端 dispatch / event / lifecycle snapshot 桥接。
4. 与旧 `topology-runtime` 的 request projection / state sync 集成。

### 4.2 v2 对应能力

当前这些能力已拆分到：

1. `runtime-shell-v2`
   1. command/actor 广播执行
   2. request ledger
   3. parameter / error catalog
   4. state runtime 装载
2. `topology-runtime-v2`
   1. peer dispatch gateway
   2. request lifecycle snapshot mirror
   3. request projection mirror
   4. state sync summary / diff / commit ack
3. `dual-topology-host` 测试专用 helper
   1. 将旧 `runtime-shell` 测试接口按最小必要集合映射到 v2
   2. 不把旧 API 继续回灌到正式包边界

### 4.3 本轮补齐与迁移

本轮完成：

1. `0-mock-server/dual-topology-host/package.json`
   1. 依赖从 `@impos2/kernel-base-runtime-shell` 切到 `@impos2/kernel-base-runtime-shell-v2`
2. `0-mock-server/dual-topology-host/test/scenarios/ws-server.spec.ts`
   1. 全部改为 v2 runtime test harness
3. `0-mock-server/dual-topology-host/test/helpers/runtimeV2Harness.ts`
   1. 新增测试专用兼容层
   2. 继续覆盖：
      1. 远端 dispatch round-trip
      2. request lifecycle snapshot resume
      3. state sync summary / diff / commit ack
      4. resume barrier 期间的排队派发
4. 活代码精确扫描
   1. `0-mock-server / 1-kernel / 2-ui / 3-adapter / 4-assembly / package.json`
   2. 已无旧 `runtime-shell / topology-runtime / topology-client-runtime` 活依赖
5. 删除旧包：
   1. `1-kernel/1.1-base/runtime-shell`
   2. `1-kernel/1.1-base/topology-runtime`

### 4.4 删除后回归

删除后重新安装并通过：

1. `corepack yarn install`
2. `corepack yarn workspace @impos2/dual-topology-host type-check`
3. `corepack yarn workspace @impos2/dual-topology-host test`
4. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
5. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test`
6. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`

### 4.5 结论

结论：

1. 旧 `runtime-shell` 已达到退役条件并已删除。
2. 旧 `topology-runtime` 已达到退役条件并已删除。
3. `dual-topology-host` 已成为 v2 链路的真实双屏 mock 验证入口。

## 5. 当前旧 base 包退役状态

当前已删除：

1. `1-kernel/1.1-base/tdp-sync-runtime`
2. `1-kernel/1.1-base/tcp-control-runtime`
3. `1-kernel/1.1-base/workflow-runtime`
4. `1-kernel/1.1-base/topology-client-runtime`
5. `1-kernel/1.1-base/runtime-shell`
6. `1-kernel/1.1-base/topology-runtime`
7. `1-kernel/1.1-base/tcp-control-runtime`
8. `1-kernel/1.1-base/tdp-sync-runtime`

当前旧 core 基础包退役面已收口完成，后续重点不再是继续删这批旧包，而是：

1. 继续对照旧 `_old_/1-kernel/1.1-cores/*` 的业务特性与边界约束。
2. 在 v2 基础包上补齐剩余可迁移能力与规范。
3. 再进入旧业务模块迁移验证。

## 6.1 本轮补充确认

截至 2026-04-13 本轮收口，针对本次要求优先处理的两个旧包，已经额外完成下面确认：

1. 物理目录确认：
   1. `1-kernel/1.1-base` 目录下只剩
      1. `tcp-control-runtime-v2`
      2. `tdp-sync-runtime-v2`
   2. 旧 `tcp-control-runtime` / `tdp-sync-runtime` 目录都已不存在。
2. 活依赖精确扫描：
   1. 对 `0-mock-server / 1-kernel / 2-ui / 3-adapter / 4-assembly / package.json / yarn.lock` 精确搜索，
   2. 已无任何旧 `@impos2/kernel-base-tcp-control-runtime` / `@impos2/kernel-base-tdp-sync-runtime` 活依赖命中。
3. 删除后回归：
   1. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 test`
   2. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
   3. 上述命令均已通过。

结论：

1. 用户本轮要求先处理的两个旧包，已经真正完成退役。
2. 当前不再需要围绕这两个旧目录继续做删除动作。
3. 后续工作应切回“补齐 v2 基础层承载旧 core 业务特性”的主线。

## 6. 本轮验证命令

本轮新增并通过：

1. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
3. `corepack yarn workspace @impos2/dual-topology-host type-check`
4. `corepack yarn workspace @impos2/dual-topology-host test`
5. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
6. `corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 test`
7. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`

当前关键结果：

1. `dual-topology-host`：`2` 个测试文件通过，`7` 个测试用例通过
2. `runtime-shell-v2`：`1` 个测试文件通过，`14` 个测试用例通过
3. `topology-runtime-v2`：`11` 个测试文件通过，`19` 个测试用例通过
4. `workflow-runtime-v2`：`2` 个测试文件通过，`12` 个测试用例通过
