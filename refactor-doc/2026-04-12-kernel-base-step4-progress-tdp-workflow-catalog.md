# 2026-04-12 kernel-base Step4 进展总结

## 1. 本轮完成范围

本轮已完成并验证下面三件事：

1. `1-kernel/1.1-base/tdp-sync-runtime` 重构收口
2. `1-kernel/1.1-base/workflow-runtime` 远程 definitions 生效模型修正
3. `errorMessages / systemParameters` 的 TDP topic 动态同步

也就是说，用户要求的这三个阶段：

1. `tdp-sync-runtime`
2. `workflow`
3. `errorMessages / systemParameters`

当前都已经完成代码落地和测试验证。

---

## 2. tdp-sync-runtime 现在的最终模型

### 2.1 projection 仓库

`tdp-sync-runtime` 现在明确采用：

1. raw projection 全量仓库存本地 state
2. state 结构是 `Record<projectionId, TdpProjectionEnvelope>`
3. `projectionId = topic:scopeType:scopeId:itemKey`
4. 持久化按 projectionId 单条落盘
5. 当前生效值不持久化，按 selector 现算

这样满足：

1. 同 topic 多 item
2. 同 topic 同 itemKey 多 scope 并存
3. 重启后仍可基于本地仓库继续增量恢复
4. 不再依赖旧 `byTopic` 大对象模型

### 2.2 scope 优先级

终端侧当前生效 projection 固定按下面优先级解析：

1. `Platform`
2. `Project`
3. `Brand`
4. `Tenant`
5. `Store`
6. `Terminal`

### 2.3 bootstrap 语义

已修正一个关键错误：

1. `bootstrapTdpSync` 不再清空已持久化 projection 仓库

现在 bootstrap 只重置运行态：

1. session
2. sync runtime 字段
3. command inbox
4. control signals

不会破坏 projection 仓库和恢复游标。

### 2.4 system topic 消费

`tdp-sync-runtime` 现在已内置系统 topic 消费器：

1. `error.message`
2. `system.parameter`

规则：

1. raw projection 仍然先进 projection 仓库
2. 再按 scope 优先级求当前生效值
3. 对应转换为 `runtime-shell` catalog command
4. 更新 `errorCatalog / parameterCatalog`
5. 高优先级 delete 后会自动回退到低优先级值

---

## 3. workflow-runtime 现在的最终模型

### 3.1 远程 definitions 来源

`workflow-runtime` 远程 definitions 不再直接扫 raw topic 全量条目，而是：

1. 从 `tdp-sync-runtime` 的 resolved projection 读取
2. 因此天然继承 `Platform < Project < Brand < Tenant < Store < Terminal` 优先级

### 3.2 definitions state source 分层

为避免远程 definitions 覆盖本地/module definitions，`workflowDefinitions` state 已改为按 source 分层：

1. `module`
2. `host`
3. `remote`
4. `test`

selector 对外仍保持统一：

1. `selectWorkflowDefinition(state, workflowKey)`

因此：

1. 远程 topic 更新只替换 `remote` bucket
2. module/local/test definitions 不会被误清空

### 3.3 delete fallback

如果同一个 workflow definition：

1. `STORE` 有一条
2. `TERMINAL` 有一条

那么：

1. 当前执行会优先使用 `TERMINAL`
2. 当 `TERMINAL` delete 后，会自动回退到 `STORE`

---

## 4. errorMessages / systemParameters 当前落点

虽然新架构不再把核心对象命名成 `errorMessages / systemParameters`，但这两条业务能力已经完成迁移：

1. `errorMessages` -> `errorCatalog`
2. `systemParameters` -> `parameterCatalog`

当前链路是：

1. TDP topic 下发
2. `tdp-sync-runtime` raw projection 仓库存储
3. 按 scope 优先级求当前生效 projection
4. 调 `runtime-shell` command 更新 catalog
5. 后续 `resolveError / resolveParameter` 立即读取最新值

这条链路已经验证：

1. add / update
2. 高优先级覆盖
3. 高优先级 delete 回退

---

## 5. 本轮新增/修正测试

### 5.1 tdp-sync-runtime

已通过：

1. `tdp-sync-runtime.spec.ts`
2. `tdp-sync-runtime-reconnect.spec.ts`
3. `tdp-sync-runtime-live-handshake.spec.ts`
4. `tdp-sync-runtime-live-projection.spec.ts`
5. `tdp-sync-runtime-live-reconnect.spec.ts`
6. `tdp-sync-runtime-live-restart-recovery.spec.ts`
7. `tdp-sync-runtime-live-control-signals.spec.ts`
8. `tdp-sync-runtime-live-command-delivered.spec.ts`
9. `tdp-sync-runtime-live-command-result-roundtrip.spec.ts`
10. `tdp-sync-runtime-live-batch-upsert.spec.ts`
11. `tdp-sync-runtime-live-scope-priority.spec.ts`
12. `tdp-sync-runtime-live-system-catalog.spec.ts`
13. `tdp-sync-runtime-live-scene-batch-terminal-online.spec.ts`
14. `tdp-sync-runtime-live-scene-multi-terminal.spec.ts`
15. `tdp-sync-runtime-live-scene-sequential-progress.spec.ts`
16. `tdp-sync-runtime-live-scene-reconnect-recovery.spec.ts`

当前结果：

1. `16` 个 test files
2. `18` 个 tests
3. 全部通过

### 5.2 workflow-runtime

已通过：

1. `workflow-runtime.spec.ts`
2. `workflow-runtime-live-remote-definitions.spec.ts`

新增覆盖：

1. 远程 definition add / update / delete
2. scope priority 生效
3. high-priority delete fallback
4. remote definitions 不覆盖 module/local definitions

当前结果：

1. `2` 个 test files
2. `9` 个 tests
3. 全部通过

---

## 6. 当前结论

到这一步，可以认为“旧 Core 里的 TDP 同步面 + workflow 动态定义面 + errorMessages/systemParameters 动态配置面”已经具备迁移业务模块所需的基础能力。

尤其是下面三条已经成立：

1. `tdp-sync-runtime` 已经不是临时联调包，而是稳定的 projection 仓库 + 恢复 + 优先级解析基础设施
2. `workflow-runtime` 已经能真实消费服务器动态下发的 workflow definitions
3. `runtime-shell` 已经能承接远程 error / parameter catalog 动态更新

---

## 7. 下一步建议

下一步建议进入：

1. `tcp-control-runtime` 与旧 `tcp-client / tdp-client` 剩余边界补齐
2. `task` 旧域向新 `workflow-runtime + tcp-control-runtime` 的完整映射梳理
3. 开始为后续 `1-kernel/1.2-business` 迁移准备首批业务包适配验证

其中，真正值得先做的是第 2 条：

1. 把旧 `_old_/1-kernel/1.1-cores/task` 的“服务端 task 发布/执行/回报模型”和新 `workflow-runtime` 的边界再精修一版
2. 输出一份精良的 workflow/task 协议设计文档
3. 再进入业务模块迁移
