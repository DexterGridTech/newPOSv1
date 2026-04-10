# 双机重连恢复语义设计结论

## 1. 结论

新双机架构必须继承旧 `interconnection` 中一个非常重要的优点：

1. 重连后不能直接恢复实时流。
2. 必须先做一次自动恢复对齐，再进入实时阶段。

但新架构不能继承旧实现方式：

1. 不能继续基于通用 slice 同步做恢复。
2. 不能把 request 正确性绑定到跨机 state merge。
3. 不能对离线期间积压的控制面消息做“重连即无脑 flush”。

因此，正式结论是：

1. 保留“自动补同步”原则。
2. 去掉“重连即 flush”语义。

---

## 2. 旧工程里真正值得继承的点

旧 `1-kernel/1.1-cores/interconnection` 的关键链路不是简单的 WebSocket 队列 flush，而是：

1. 连接恢复后先执行 `synStateAtConnected`。
2. 双方先交换本地状态摘要，而不是直接推送完整状态。
3. 基于 `updatedAt` 比较得出 diff。
4. diff 补齐后才把 `startToSync` 打开，开始恢复实时同步。

对应代码位置：

1. [instanceInterconnection.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/interconnection/src/features/actors/instanceInterconnection.ts)
2. [stateSyncMiddleware.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/interconnection/src/features/middlewares/stateSyncMiddleware.ts)
3. [syncRetryQueue.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/interconnection/src/foundations/syncRetryQueue.ts)

它的本质是一个“重连一致性屏障”：

1. 先恢复到一个可继续工作的共同基线。
2. 再继续实时增量流。

这个思想是正确的，必须继承。

---

## 3. 旧实现中必须丢掉的点

下面这些不应该进入新架构：

1. 基于通用 Redux slice 结构定义恢复协议。
2. 强制业务状态采用 `top-level { value, updatedAt }` 这种同步专用结构。
3. 依赖 `batchUpdateState` 和 `null tombstone` 来承载控制面恢复。
4. 将 request 结果、命令生命周期、普通业务 state 变化混入同一套同步机制。
5. 将连接恢复简化为“队列回绑后直接 flush”。

原因：

1. 这会把协议语义泄漏进业务 slice 结构。
2. 这会让控制面正确性被 UI/store 形态反向绑架。
3. 这会让 request 真相与业务状态镜像混淆。

---

## 4. 新架构的正式规则

### 4.1 命令 dispatch / event

规则：

1. `command-dispatch` 默认不做离线重放。
2. `command-event` 默认不靠 host 队列恢复正确性。
3. 如果对端离线，控制面只记录“当前无法实时送达”的事实，不伪造后续完成语义。

解释：

1. command 是时效性执行信号，不是可靠离线任务队列。
2. request 正确性必须回到 owner-ledger，而不是依赖 host 补发旧 dispatch。

### 4.2 projection / result / request view

规则：

1. request 真相仍由 owner-ledger 持有。
2. 重连后需要恢复的是 owner 可读的 request/projection 视图，而不是旧 dispatch 队列。
3. 恢复流程必须先完成一次显式 resume 对齐，再恢复实时 mirror / event 流。

解释：

1. 真正需要跨重连延续的是“当前 request 事实”。
2. 不是“离线时那些 transport 消息原样再送一遍”。

### 4.3 普通业务状态镜像

规则：

1. 普通业务状态是否跨机同步，后续可以独立设计。
2. 如果存在状态镜像，也必须采用显式协议。
3. 推荐模型是 `summary -> diff -> apply -> start streaming`。

说明：

1. 这个规则继承旧工程“先摘要比对、再补差异”的优点。
2. 但不再绑定到通用 slice 中间件和 reducer 协议。

---

## 5. 对 `host-runtime` 的直接约束

`host-runtime` 后续必须满足：

1. host 不再把“offline queue 重连回绑后立即 flush”作为正式恢复语义。
2. host 可以保留最小观察级离线暂存能力，但只能服务于短窗口控制面过渡。
3. host 必须支持“连接恢复后先进入 resume-required / resyncing，再进入 streaming”这一类显式状态。
4. host 负责承载 resume 协议流转，但不负责解释 owner-ledger 真相。

这意味着当前 first-pass 中的下面行为只是过渡实现，不是最终标准：

1. offline peer relay queue
2. reconnection rebind
3. reconnect 后直接 drain outbox

---

## 6. 对 `dual-topology-host` 的直接约束

`dual-topology-host` 后续必须满足：

1. WebSocket 重连后，不能把历史 relay 直接当成恢复完成。
2. shell 层需要支持 resume 阶段的协议交互与可观测输出。
3. HTTP / WS 联调验证必须覆盖：
   1. disconnect
   2. reconnect
   3. resume handshake
   4. resume diff/apply 完成
   5. resume 完成后再恢复实时流

---

## 7. 后续实现建议

后续实现按下面顺序推进：

1. 在 `host-runtime` 中把 session 从当前简单 `active / degraded / closed` 语义扩展为包含 resume 阶段的显式状态。
2. 为 `host-runtime` 增加 resume 相关 contract，例如摘要、待恢复能力、恢复完成标记。
3. 在 `dual-topology-host` 中把当前 offline queue 语义降级为“过渡缓存”，不再代表正式恢复机制。
4. 将真正的“恢复对齐”建立为显式协议，而不是 outbox drain。
5. 最终联通 `topology-runtime + host-runtime + dual-topology-host` 做真实重连恢复验证。

---

## 8. 最终判断

旧 `interconnection` 的“重连后自动同步”是优秀设计，应该继承。

但继承的是：

1. 先恢复对齐
2. 再恢复实时流

而不是继承：

1. slice 同步实现
2. reducer 驱动协议
3. 队列回绑后立即 flush
