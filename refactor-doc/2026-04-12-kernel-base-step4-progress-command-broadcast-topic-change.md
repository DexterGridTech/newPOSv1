# Kernel Base Step4 进展：Command + Broadcast Actor + Topic Change

日期：2026-04-12

## 本次完成

本次已完成下面四件关键事情：

1. `runtime-shell` 正式支持 `broadcast actor` 广播能力。
2. `tdp-sync-runtime` 正式改为发布通用 `tdpTopicDataChanged` actor event。
3. `workflow-runtime` 已改为消费 `tdpTopicDataChanged`，不再直接盯 TDP 内部状态。
4. `error.message` / `system.parameter` 保留为 `tdp-sync-runtime -> runtime-shell command` 的唯一特例桥接。

## 已验证的最终模型

### 1. command 与 actor 双模型

现在 kernel base 的协作模型明确为：

1. command：单执行者、能力调用、带 request lifecycle。
2. actor：多执行者广播、能力事件、无 request lifecycle。

这解决了两个问题：

1. 保留旧工程里 actor 广播对业务扩展的价值。
2. 避免把所有跨包协作都做成 command，导致业务依赖过重。

### 2. tdpTopicDataChanged 只暴露“生效变化”

`tdp-sync-runtime` 对外只发布：

1. topic
2. 当前优先级计算后的生效变化列表

不再暴露：

1. scope priority 计算过程
2. scopeType / scopeId 内部决策细节
3. 原始 projection 仓库的中间状态

业务模块只处理“我现在应该怎么变”。

### 3. 高优先级删除后的回退语义已验证

已新增活体验证：

1. store 级和 terminal 级同时存在时，普通模块收到 terminal 生效值的 `upsert`。
2. terminal 删除后，普通模块收到 store 回退值的 `upsert`。
3. 所有 scope 都删除后，普通模块收到 `delete`。

这证明后续业务模块不需要知道优先级规则，只要监听 `tdpTopicDataChanged` 即可。

## 本次发现并修复的问题

### 问题：topic change 发布存在并发竞态

旧实现是：

1. `context.subscribeState(() => void publishTopicDataChanges(...))`
2. 每次 state 变化都 fire-and-forget 异步发布

在批量 projection 更新时，会出现多个发布过程并发执行：

1. 前一个发布过程还没完成
2. 后一个发布过程已经拿到更新后的 state 开始跑
3. 两个过程会交错回写 fingerprint

结果：

1. 普通 topic 大部分场景可能刚好还能过。
2. `system catalog` 因为还要桥接回 runtime-shell command，更容易暴露竞态，出现 live test 超时。

### 修复

改为串行 drain 模式：

1. 订阅回调只负责打 `dirty` 标记。
2. 如果当前没有 publisher 在跑，则启动一个串行 worker。
3. worker 每次消费当前 dirty 状态并执行一次 `publishTopicDataChanges`。
4. 执行期间如果再次收到 state 变化，只设置 dirty，当前轮完成后再跑下一轮。

这个修复已经通过完整 `tdp-sync-runtime` live 回归验证。

## 测试结果

已通过：

1. `@impos2/kernel-base-runtime-shell test`
2. `@impos2/kernel-base-runtime-shell type-check`
3. `@impos2/kernel-base-tdp-sync-runtime test`
4. `@impos2/kernel-base-tdp-sync-runtime type-check`
5. `@impos2/kernel-base-workflow-runtime test`
6. `@impos2/kernel-base-workflow-runtime type-check`

## 对后续业务模块迁移的影响

后续业务模块接 TDP topic 时，推荐统一模式：

1. 自己声明 topic 对应的 state slice。
2. 自己注册 `tdpTopicDataChanged` actor。
3. 在 actor 中判断 topic 是否归自己负责。
4. 再通过本包内部 action / command 更新 state。

禁止的模式：

1. 让 `tdp-sync-runtime` 直接调业务模块 command。
2. 业务模块自己重复实现 scope priority。
3. 业务模块直接依赖 TDP projection 仓库的内部结构。

