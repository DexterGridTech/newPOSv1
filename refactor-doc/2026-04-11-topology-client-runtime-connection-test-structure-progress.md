# 2026-04-11 topology-client-runtime connection 测试结构收缩进展

## 1. 本次完成内容

在已经拆出 topology live state-sync 独立场景之后，又继续收缩了 `connection-runtime.spec.ts` 的重复搭建代码。

本次新增/调整：

1. `test/helpers/liveHarness.ts` 新增通用 `createTopologyHostLiveHarness()`
2. `test/helpers/liveHarness.ts` 新增：
   1. `configureTopologyPair()`
   2. `waitForTopologyPairConnected()`
   3. `startTopologyConnectionPair()`
3. `connection-runtime.spec.ts` 中两条场景已切到公共 helper：
   1. `controls topology connection lifecycle through public commands`
   2. `connects through assembly injected node ws adapter and projects peer/connection state`

---

## 2. 当前 helper 边界

### 2.1 `topologyClientHarness.ts`

仍只保留通用轻量辅助：

1. `waitFor`
2. `createHello`
3. `createRuntimeInfo`
4. echo 类测试模块
5. server cleanup

### 2.2 `liveHarness.ts`

现在承载两类真实联调公共件：

1. host pair 搭建
   1. 启动 `dual-topology-host`
   2. 创建 ticket
   3. 创建 master/slave socket runtime
   4. 生成 assembly 绑定
   5. 提供 `connectMasterHello()`
2. topology pair 编排
   1. 配置主副机 recovery state
   2. 启动双端 topology connection
   3. 等待双端 `CONNECTED`

state-sync 仍是在这个基础上继续叠加最小 `syncValue` slice/module。

---

## 3. 收缩结果

本次之后：

1. `connection-runtime.spec.ts` 降到 `642` 行
2. `liveHarness.ts` 提升为 topology 真实联调的主 helper
3. topology 测试结构已经开始形成：
   1. `topologyClientHarness.ts` 负责轻量通用辅助
   2. `liveHarness.ts` 负责真实 host 联调搭建
   3. `dispatch-runtime.spec.ts` 负责请求/命令/投影恢复
   4. 独立 live state-sync spec 负责双屏同步主链路
   5. `connection-runtime.spec.ts` 负责连接生命周期与重连

这比继续把所有真实 host 流程都堆在各自 spec 里更稳。

---

## 4. 当前验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json --noEmit`
2. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/connection-runtime.spec.ts`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/*.spec.ts`

全量结果维持：

1. `5` 个 test files
2. `16` 条测试
3. 全部通过

---

## 5. 下一步建议

下一步不建议再大规模抽测试框架。

更合适的顺序是：

1. 保持当前 helper 边界，不再继续为了抽象而抽象
2. 开始规划 topology 与 terminal 数据面的联动验证
3. 先找最小联动点：
   1. topology 侧 state-sync
   2. terminal 侧已验证的 TCP/TDP 基线
   3. 通过一个小的组合场景验证它们能否接起来

也就是说，topology 这层测试结构现在已经足够用了，下一步重点应回到“跨基础包联动验证”。
