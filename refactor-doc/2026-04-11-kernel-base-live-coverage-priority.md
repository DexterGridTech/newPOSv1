# 2026-04-11 kernel-base live 覆盖优先级说明

## 1. 当前判断

在 `tcp-control-runtime` 和 `tdp-sync-runtime` 都已经有真实 live 基线之后，下一步优先级明确如下：

1. 先补 `scene` 驱动的真实组合场景
2. 暂不优先补 `fault rule -> transport 行为注入`

这个判断是有意为之，不是遗漏。

---

## 2. 为什么先做 scene，不先做 fault

### 2.1 `scene` 已经是真实业务流入口

当前 `mock-terminal-platform` 的 `scene` 已经直接驱动：

1. 批量造终端
2. 创建任务发布单
3. 生成任务实例
4. 进入 TDP 数据面投递

也就是说，`scene` 已经是一个真实的“后台业务动作 -> TCP/TDP 客户端行为”联动入口。

### 2.2 `fault` 目前还只是管理数据

当前 `faultRules` 能力主要是：

1. 创建规则
2. 更新规则
3. 手动累加 hitCount
4. 在 debug 界面上做观测

但它还没有真正接进：

1. HTTP 请求失败注入
2. WS 握手失败注入
3. projection 丢包/乱序注入
4. command 投递超时注入

所以如果现在为了测试去硬做一层 `fault -> transport` 接入，反而容易变成“为了做测试先发明一套注入框架”，这不符合当前“够用就好，不做过度设计”的要求。

---

## 3. 当前 live 基线已经具备什么

### 3.1 `tcp-control-runtime`

已验证：

1. 真实激活码激活
2. 真实 refresh token 刷新
3. 真实任务结果回报
4. 真实重启后的 identity / credential / binding 恢复

### 3.2 `tdp-sync-runtime`

已验证：

1. 真实 TDP 握手
2. 真实 projection push
3. 真实控制信号
4. 真实网络中断自动重连
5. 真实 `COMMAND_DELIVERED -> ACKED`
6. 真实重启后的增量恢复

这说明现在缺的已经不是单点协议能力，而是“多步业务动作组合起来是否仍然稳定”。

---

## 4. 因此下一步最有价值的测试

优先补下面几类 `scene` 级组合场景：

1. 批量终端上线后，多个终端收到真实 projection 更新
2. 后台连续多次更新后，客户端 cursor / projection / ack 是否稳定推进
3. 断线重连后，scene 继续推进时是否仍能正确增量恢复
4. task release + command deliver + task result report 的连续闭环

当前状态更新：

1. 第一组 `scene` 联动已经完成，见：
   1. `tdp-sync-runtime-live-scene-batch-terminal-online.spec.ts`
   2. `tdp-sync-runtime-live-scene-sequential-progress.spec.ts`
   3. `tdp-sync-runtime-live-scene-reconnect-recovery.spec.ts`
2. 同时修掉了 mock server 的三个真实缺口：
   1. scene 模板之前并未真正 dispatch to tdp
   2. scene 之前无法指定当前在线终端作为目标
   3. projection 模式 dispatch 之前没显式返回 `mode`

因此下一步不再是“要不要做 scene”，而是继续把 scene 做深。当前已经验证：

1. 单次 scene 投递
2. 连续 scene 投递
3. scene 后断线重连再继续投递

剩余更有价值的是：

1. 多终端同时在线批量投递
2. scene 与双屏拓扑联动

补充状态更新：

1. `remote control delivery + task result report` 的连续闭环也已经完成，见：
   1. `tdp-sync-runtime-live-command-result-roundtrip.spec.ts`
2. 这条链路已经证明：
   1. TDP 的 ACK 语义
   2. TCP 的最终结果回报语义
   3. 同一个 `task instance` 的两阶段状态推进
   可以在新 base 架构里真实接起来。

3. 多终端同时在线的 scene 批量投递也已经完成，见：
   1. `tdp-sync-runtime-live-scene-multi-terminal.spec.ts`
4. 这说明 terminal 数据面的下一个重点已经不是单终端稳定性，而是开始与 `topology / dual-topology` 的联动验证。

这些场景一旦通过，说明新 base 架构对旧 terminal core 的承接已经接近完成。

---

## 5. 后续什么时候再补 fault

只有在下面条件成立时，再补 `fault -> transport 行为注入` 才是划算的：

1. scene 级联调已经证明主链路稳定
2. 我们已经明确知道某类失败语义是后续业务真实需要反复回放的
3. 这些失败语义不能只靠 admin 手动操作或已有 live harness 模拟

在那之前，继续沿着真实 server admin 接口和真实 scene 模板推进，更专业，也更稳。 
