# runtime-shell 远端命令回环设计与已验证语义

## 1. 文档目标

本文档记录 `runtime-shell` 在第一阶段已经落地并验证通过的远端命令最小闭环语义：

1. owner runtime 创建 remote dispatch
2. peer runtime 代执行 remote dispatch
3. peer runtime 返回 command event
4. owner runtime 应用 remote event 并收敛 request projection

本文档只描述已经实现并通过测试的最小事实，不扩展到后续更大的 transport 封装。

---

## 2. 本轮确认的核心规则

### 2.1 owner 先登记 child，再发 remote dispatch

规则：

1. remote child command 不能由远端事件“倒推发现”。
2. owner runtime 必须先在本地 `owner-ledger` 中登记 child node。
3. 然后才能生成并发送 `CommandDispatchEnvelope`。

这条规则已经通过 `runtime-shell` 本地双 runtime 测试与 `dual-topology-host` 真实 WS 测试共同验证。

### 2.2 peer 代执行不成为 owner

规则：

1. peer runtime 收到 remote dispatch 后，只负责执行 handler。
2. peer 不得为该 `requestId` 在本地创建 owner request record。
3. peer 返回 `accepted / started / completed | failed` 事件即可。

这意味着：

1. request 真相仍只保留在 owner `topology-runtime`。
2. peer 本地不会出现该 request 的 owner projection。

### 2.3 owner projection 只由 owner-ledger 收敛

规则：

1. owner runtime 收到 remote `command-event` 后，只回写本地 `topology-runtime`。
2. `request projection` 由 owner-ledger 派生。
3. request 完成与结果合并不依赖对端 slice 或 mirror 回传。

这与之前确认的总原则一致：

1. request correctness 不依赖跨机 slice 同步。
2. projection mirror 只是读模型能力，不是真相源。

---

## 3. 本轮实现中的一个关键修正

在本轮实现 `handleRemoteDispatch(...)` 时，暴露了一个重要问题：

1. peer runtime 复用了本地 `execution-runtime`。
2. `execution-runtime` 的 `started` 生命周期回调默认会写回本地 `topology-runtime`。
3. 但 remote dispatch 的 request 并不属于 peer 本地 owner-ledger。
4. 因此会触发 `kernel.base.topology-runtime.request_not_found`。

修正后的规则是：

1. `runtime-shell` 在接收 `execution-runtime` lifecycle 时，只对本地 topology 已登记的 command 应用 lifecycle。
2. 如果该 command 不存在于本地 owner-ledger，则忽略该 lifecycle 对 topology 的回写。

这条修正的本质不是补丁，而是正式约束：

1. execution lifecycle 不等于 owner lifecycle。
2. 只有 owner 已知 command，才能推进 owner-ledger。

---

## 4. 当前已验证的闭环

### 4.1 包内双 runtime 闭环

`@impos2/kernel-base-runtime-shell` 当前已验证：

1. owner runtime 可执行本地 root command。
2. owner runtime 可导出 request lifecycle snapshot 并拿到 `rootCommandId`。
3. owner runtime 可创建 remote child dispatch envelope。
4. peer runtime 可处理 remote dispatch 并返回 3 个 lifecycle event。
5. owner runtime 应用这些 event 后，request projection 会收敛为 `complete`。
6. child command 结果会落到 `resultsByCommand[childCommandId]`。
7. `mergedResults` 会按既有 projection 合并规则反映远端结果。

### 4.2 真实 WS 闭环

`@impos2/dual-topology-host` 当前已验证：

1. owner runtime 生成的 `command-dispatch` 可经真实 WS relay 到 peer。
2. peer runtime 执行后生成的 `command-event` 可经真实 WS relay 回 owner。
3. owner runtime 应用 real WS 回传事件后，request projection 会收敛为 `complete`。
4. peer runtime 本地不会为 remote request 生成 owner projection。

---

## 5. 当前边界

本轮闭环明确只做到：

1. root local command + single remote child command
2. peer 返回 `accepted / started / completed | failed`
3. owner 本地应用 remote event 并更新 request projection

本轮明确还没有做：

1. 多级 remote child 嵌套分发
2. 通用 route planner
3. transport-runtime 与 dual topology socket 的正式集成
4. projection mirror 与 remote event 的统一总线
5. 跨重连后的 remote command 自动恢复执行

---

## 6. 对下一步的直接约束

后续如果继续推进 transport/runtime 贯通，必须继续遵守：

1. `transport-runtime` 只负责 socket 连接与消息收发，不解释 owner truth。
2. `host-runtime` 只负责 relay / resume barrier，不解释 request 完成语义。
3. `runtime-shell` 仍是 request owner truth 的唯一总装配入口。
4. peer 代执行 remote dispatch 时，不得偷偷演化成第二份 owner ledger。
