# Kernel Base V2 迁移总计划

日期：2026-04-12

## 1. 目标

在不破坏当前 `1-kernel/1.1-base` 已有实现的前提下，新建一套 `v2` 运行时体系，回归旧工程正确的 `Command / Actor` 职责语义，同时保留新架构已经验证正确的 request / topology / TDP / workflow 能力。

`v2` 的总原则：

1. `Command` 是唯一业务消息载体。
2. `Actor` 是指令执行者。
3. 一个 command 默认广播给所有声明了该 command handler 的 actor。
4. actor 可以继续 dispatch 子 command。
5. request 真相源是内存 `RequestLedger`，不再要求写入 state。
6. topology 只处理跨节点 command 控制面，不介入节点内 actor 执行。

## 2. 当前 1.1-base 全包扫描结论

当前 `1-kernel/1.1-base` 下有 13 个包：

1. `contracts`
2. `definition-registry`
3. `execution-runtime`
4. `host-runtime`
5. `platform-ports`
6. `runtime-shell`
7. `state-runtime`
8. `tcp-control-runtime`
9. `tdp-sync-runtime`
10. `topology-client-runtime`
11. `topology-runtime`
12. `transport-runtime`
13. `workflow-runtime`

### 2.1 第一批必须进入 v2 的包

这些包直接绑定当前 `runtime-shell` / `registerHandler` / `dispatchChild` / 广播 actor 模型，必须新建 v2：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `tdp-sync-runtime-v2`
4. `workflow-runtime-v2`
5. `topology-runtime-v2`

说明：

1. `topology-runtime-v2` 同时承接当前 `topology-runtime` 与 `topology-client-runtime` 的 v2 职责。
2. 第二阶段不再新建 `topology-client-runtime-v2`，避免拓扑包继续拆得过散。

### 2.2 先保持不动、继续复用的包

这些包第一阶段不需要新建 v2：

1. `contracts`
2. `definition-registry`
3. `platform-ports`
4. `state-runtime`
5. `transport-runtime`

说明：

1. `RequestLedger` 不进 Redux/state，因此 `state-runtime` 第一阶段继续复用。
2. `transport-runtime` 主要是 HTTP / WS transport，不需要跟着 command/actor 模型一起重做。
3. `contracts` 和 `definition-registry` 先复用，等 v2 类型稳定后再决定是否抽公共协议。

### 2.3 后续再评估的包

这些包不作为第一阶段目标，但可能在 topology v2 阶段需要适配：

1. `execution-runtime`
2. `host-runtime`

当前判断：

1. `execution-runtime` 先不单独建 v2，优先把执行树和多 actor 聚合内聚到 `runtime-shell-v2`。
2. `host-runtime` 等 `topology-runtime-v2` 设计完成后再判断是否需要 `host-runtime-v2`。

## 3. 第一阶段范围

第一阶段先做 4 个包：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `tdp-sync-runtime-v2`
4. `workflow-runtime-v2`

第一阶段先不实现：

1. `topology-runtime-v2`

原因：

1. 当前最大的架构分歧在节点内 `Command / Actor` 模型。
2. 如果本地模型没稳定就先做 topology，会把问题放大到跨节点协议层。

## 4. 第二阶段范围

第二阶段再做：

1. `topology-runtime-v2`
2. 必要时 `host-runtime` 适配或 `host-runtime-v2`

第二阶段目标：

1. `local / peer` 路由闭环
2. 跨节点 command envelope 收发
3. request tree 跨主副机收敛
4. `dual-topology-host` 联调验证
5. 主副连接客户端、peer 路由入口、topology 上下文与连接状态全部内聚在 `topology-runtime-v2`

## 5. 推荐实施顺序

严格按下面顺序推进：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `tdp-sync-runtime-v2`
4. `workflow-runtime-v2`
5. `topology-runtime-v2`

## 6. 每个包的职责

### 6.1 runtime-shell-v2

职责：

1. `Command` 定义与工厂
2. `Actor` 定义与自动注册
3. 统一 `dispatch`
4. 多 actor 广播执行
5. `RequestLedger`
6. 聚合结果
7. 循环保护
8. selector/query API

不负责：

1. Redux request state
2. TDP projection 仓库
3. workflow 业务语义
4. transport 细节

### 6.2 tcp-control-runtime-v2

职责：

1. terminal 激活
2. credential 刷新
3. task result 上报
4. terminal identity / credential / binding state
5. 作为 TDP v2 的前置依赖

### 6.3 tdp-sync-runtime-v2

职责：

1. TDP 会话、握手、重连、增量恢复
2. projection 仓库
3. scope priority 计算
4. 发出普通 command：`tdpCommands.topicDataChanged`
5. `error.message / system.parameter` 特例 bridge actor

### 6.4 workflow-runtime-v2

职责：

1. workflow definitions
2. workflow queue
3. workflow observations
4. `run()` observable
5. selector/query
6. 监听 `tdpCommands.topicDataChanged` 更新远端 definitions

### 6.5 topology-runtime-v2

职责：

1. command envelope 跨节点控制面
2. owner/source/target 路由
3. accepted/running/completed/failed/timeout 回传
4. request 跨节点收敛辅助
5. 主副连接客户端
6. peer 路由接入点
7. topology 上下文与连接状态
8. 跨节点 dispatch 入口
9. 重连、resume、state-sync、projection-mirror 的客户端侧编排

说明：

1. `topology-runtime-v2` 是第二阶段唯一拓扑 v2 包。
2. 它不是把两个旧包机械拼接成大包，而是把“拓扑协议真相”和“终端侧连接编排”放回一个清晰的拓扑运行时边界。
3. 其内部文件仍需按职责拆分，不能重新形成一个超大文件。

## 7. 关键设计约束

### 7.1 业务开发者心智

最终业务开发者只需要理解：

1. 定义 `Command`
2. 定义 `Actor.handle(Command, handler)`
3. `dispatch(Command)`
4. 查询 `request`

不再额外暴露：

1. 第二套广播 API
2. `sessionId`
3. 隐式 converter
4. `sendToRemoteExecute`

### 7.2 默认值

`defineCommand` 默认：

1. `visibility = public`
2. `timeoutMs = 60_000`
3. `allowNoActor = false`
4. `allowReentry = false`
5. `defaultTarget = local`

### 7.3 路由

路由不进 payload。

统一写法：

1. `runtime.dispatch(command, {target: 'local' | 'peer'})`
2. `context.dispatch(command, {target: 'local' | 'peer'})`

第一阶段只暴露：

1. `local`
2. `peer`

### 7.4 Request 真相源

1. `RequestLedger` 是唯一真相源
2. 不要求写入 Redux state
3. selector 直接基于 `RequestLedger` 或其只读投影

## 8. 第一阶段验收门槛

必须同时满足下面 4 条：

1. `runtime-shell-v2` 单节点 command/actor 模型稳定
2. `tcp-control-runtime-v2` 能正常完成激活/刷新/上报闭环
3. `tdp-sync-runtime-v2` 能把 topic 变化转成普通 command，并被多个 actor 消费
4. `workflow-runtime-v2` 能动态接收 workflow definition 并执行

## 9. 测试策略

### 9.0 通用测试原则

后续所有 `v2` 包测试都必须遵守：

1. 测试入口优先是 `Command`
2. 主断言对象优先是：
   - `CommandAggregateResult`
   - `request` selector / query 结果
3. state selector 只作为补充验证，不作为“命令完成”的唯一判断依据
4. 不直接调用内部 service / reducer / actor handler 证明业务流程正确
5. topic / workflow / topology 场景也必须从 command 入口验证整条执行链

### 9.1 第一阶段

1. `runtime-shell-v2`
   - 单元测试为主
2. `tcp-control-runtime-v2`
   - `mock-terminal-platform` 联调
3. `tdp-sync-runtime-v2`
   - `mock-terminal-platform` 联调
4. `workflow-runtime-v2`
   - `mock-terminal-platform` 联调

### 9.2 第二阶段

1. `topology-runtime-v2`

统一通过：

1. `0-mock-server/dual-topology-host`

做双机真实验证。

## 10. 下一步

下一步不直接写代码，先落正式设计文档：

1. `runtime-shell-v2` 设计文档
2. `tcp-control-runtime-v2` 设计文档
3. `tdp-sync-runtime-v2` 设计文档
4. `workflow-runtime-v2` 设计文档

设计确认后，再按顺序逐包实现。
