# 2026-04-11 topology task panel 真实联动进展

## 本次目标

在已有 terminal bridge 基线之上，再往前推进一步：

1. 不再只同步一个测试专用 bridge entry。
2. 改为把真实 `tcp.task.release` projection 自动消费成业务风格 read model。
3. 再通过真实 topology state sync 把该 read model 从主屏同步到副屏。
4. 最后继续通过 TCP 把该 task instance 的结果回报给服务端。

这一步的意义是：

1. 证明客户端已经可以把服务端 task 域转成自己的业务真相源。
2. 证明该业务真相源可以主副屏同步。
3. 证明同步后的业务真相源不会阻断 task result report 闭环。

---

## 本次实现

新增：

1. `1-kernel/1.1-base/topology-client-runtime/test/helpers/taskReadModelModule.ts`
2. `1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel.spec.ts`

同时扩展：

1. `1-kernel/1.1-base/topology-client-runtime/test/helpers/terminalTopologyBridgeHarness.ts`

### `taskReadModelModule.ts`

该测试模块做的事很简单：

1. 订阅 `selectTdpProjectionState(...).byTopic['tcp.task.release']`
2. 将每条 projection 转为 `TerminalTaskPanelEntry`
3. 以 `instanceId` 为 key 形成 `Record<string, TerminalTaskPanelEntry>`
4. 设置 `syncIntent = master-to-slave`

当前 `TerminalTaskPanelEntry` 字段：

1. `instanceId`
2. `releaseId`
3. `taskType`
4. `scopeId`
5. `sourceReleaseId`
6. `revision`
7. `payload`
8. `dispatchedAt`
9. `updatedAt`

它的定位不是正式产品包，而是一个非常接近真实业务迁移入口的测试 read model。

### live spec

`topology-client-runtime-live-task-panel.spec.ts` 跑的是这条真实链路：

1. 启动 `mock-terminal-platform`
2. 启动 `dual-topology-host`
3. 主屏加载：
   1. `tcp-control-runtime`
   2. `tdp-sync-runtime`
   3. `topology-client-runtime`
   4. `task panel` 测试模块
4. 副屏加载：
   1. `topology-client-runtime`
   2. `task panel` 测试模块
5. 主屏激活终端并连接 TDP
6. 服务端运行 `scene-batch-terminal-online`
7. 主屏收到真实 `tcp.task.release`
8. 主屏 task panel slice 自动形成业务 entry
9. 副屏收到同一条 task panel entry
10. 主屏继续通过 TCP 回报该 `instanceId` 的 `COMPLETED`
11. 服务端 `task_instance.status` 更新为 `COMPLETED`

---

## 验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json --noEmit`
2. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-task-panel.spec.ts`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/*.spec.ts`

当前全量结果：

1. `topology-client-runtime` scenario test files 为 `9`
2. scenario tests 为 `20`
3. 全部通过

---

## 已确认的结论

本次确认了几件关键事情：

1. `tcp.task.release` 可以稳定作为业务模块输入流。
2. 客户端不需要直接拿 raw projection 当产品真相源。
3. 一个业务风格 `Record<string, Entry>` slice 已足够承接当前 task 域迁移入口。
4. topology state sync 可以直接同步这种业务风格 slice。
5. 同步完成后，不影响继续通过 TCP 回报任务执行结果。

这说明服务端 task 域、客户端业务 read model、主副屏同步、最终结果回报，已经能形成一条真实可验证闭环。

---

## 仍未覆盖的点

还没覆盖：

1. `task panel` 在 TDP forced close / reconnect 后继续收新任务。
2. `REMOTE_CONTROL` 类型 command 被业务消费后形成业务 read model。
3. 一个以上 task topic 或多个 task 视图并行演进时的同步行为。
4. 真正业务包迁入后对该测试模块的替换验证。

---

## 下一步建议

下一步优先级建议：

1. 先补 `task panel reconnect` 场景。
2. 再补 `REMOTE_CONTROL business read model` 场景。
3. 两者稳定后，再开始真正迁移 `1-kernel/1.2-business` 的 task/scene 相关业务包。
