# Topology Runtime V3 Design

日期：2026-04-18

状态：重写版，待评审；尚未进入实施计划和代码修改。

## 1. 背景

`topology-runtime-v2` 目前已经覆盖了：

1. 主副端长连接
2. remote command relay
3. request lifecycle mirror
4. 双向 state sync
5. reconnect / resume

但它同时引入了几类结构性问题：

1. **把稳定恢复信息和临时握手材料混在一起。**
   - `masterInfo.serverAddress` 这类长期可恢复信息，与 `ticketToken / session / resume` 这类连接期材料被耦合在同一条链路上。
   - 冷启动后经常出现“地址没错，但握手材料过期”的脆弱路径。

2. **把宿主槽位、业务显示角色、拓扑角色混在一起。**
   - `displayIndex / standalone / displayMode / instanceMode` 在 v2 中能工作，但语义没有完全拉平。
   - 结果是 assembly 层一旦要支持“独立副机 + 电源切换 + 本地持久化 gate”，就很容易误用字段。

3. **协议过重。**
   - `resume-begin / resume-complete`
   - `state-sync-summary / diff / commit-ack`
   - ticket / session / reconnect barrier
   - 这些叠在一起后，调试和恢复都很重。

4. **上一轮设计有一个根本性偏差：把业务拓扑误建模成图网络。**
   - 重新核对旧工程、v2、assembly 与 host 之后，当前业务并不是多 peer / leader tree。
   - 业务约束已经明确：**就是一主一副配对**。

所以 V3 的目标不是继续修 v2，也不是把 topology 设计成通用多节点图，而是定义一个：

1. **严格围绕一主一副 pair 的 core 拓扑模型**
2. **把宿主差异留给 assembly / host 处理**
3. **把恢复逻辑降到最小可证实的集合**

---

## 2. 已核对的事实

### 2.1 旧工程一开始就是一主一副思路

旧工程 `interconnection` 初始化时直接按 `displayIndex` 做初始推导：

1. `displayIndex === 0` -> `standalone=true`、`MASTER`、`PRIMARY`
2. `displayIndex > 0` -> `standalone=false`、`SLAVE`、`SECONDARY`

参考：`_old_/1-kernel/1.1-cores/interconnection/src/foundations/preInitiateInstanceInfo.ts:6`

这说明旧工程的默认世界观不是“多节点拓扑图”，而是：

- 一个主端
- 一个副端
- 通过一条连接互相同步

### 2.2 旧工程明确支持双向同步

旧工程 state sync middleware 根据 `instanceMode` 选择方向：

1. master 时同步 `statesToSyncFromMasterToSlave`
2. slave 时同步 `statesToSyncFromSlaveToMaster`

参考：`_old_/1-kernel/1.1-cores/interconnection/src/features/middlewares/stateSyncMiddleware.ts:26`

这说明：

- 一主一副不等于单向
- 单机双屏和双机主副，在 core 拓扑上都可以是双向同步
- 真正重要的是 **每个 slice 只有一个 authority**，不是“只有主端能发数据”

### 2.3 v2 也已经验证了 slave->master 双向同步

v2 测试已经明确覆盖：

- `slave-to-master` 实时 state sync

参考：`1-kernel/1.1-base/topology-runtime-v2/test/scenarios/topology-runtime-v2-live-state-sync-slave-to-master.spec.ts:10`

所以新的 V3 设计不能再把“同机”和“跨机”的差异讲成“一个双向、一个单向”或者“一个简单、一个要图模型”。

### 2.4 当前 Android topology host 也是 pair-oriented

当前 Android `TopologyHostV3Runtime` 的核心真相源是：

1. ticket -> session
2. session -> nodes
3. hello 时检查 role occupancy
4. `master` role 必须和 ticket owner 匹配
5. 某个 role 已被占用时拒绝新的 hello

参考：`3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Runtime.kt`

这其实已经说明当前 host 的业务模型也是：

- 一个 session 内就是一对配对角色
- 不是任意多节点 mesh

### 2.5 宿主层的真正差异，不是拓扑图差异

当前 assembly 里已经有两类截然不同的宿主语义：

1. **managed secondary**
   - `displayIndex > 0 && displayCount > 1`
   - 进入 `SLAVE + SECONDARY`
   - 不 bootstrap TCP identity
   - 需要禁止本地业务 state persistence
   - 参考：`4-assembly/android/mixc-retail-assembly-rn84/src/application/bootstrapRuntime.ts:6`

2. **standalone slave**
   - 单屏设备，`displayIndex === 0`
   - 可以配置为 `SLAVE`
   - 仍然需要 bootstrap 自己的 TCP identity
   - 仍然需要本地业务持久化
   - 参考：`4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-bootstrap-runtime.spec.ts:96`

所以应该拆开的不是“单机 vs 双机 topology”，而是：

- **core 拓扑：统一的一主一副配对模型**
- **宿主运行约束：managed secondary vs standalone slave**

---

## 3. 设计目标

V3 只追求三件事：

1. **简单**
   - 一主一副 pair 模型
   - 最小持久化真相源
   - 最少协议消息

2. **高效**
   - steady-state 走 update
   - reconnect 允许直接 snapshot 修复
   - 不追求协议炫技

3. **健壮**
   - 只要 locator 还在，就能持续重连
   - 临时凭证不进入 core 持久化真相源
   - reconnect 后总能回到一致状态

更具体的目标：

1. 保留旧工程最有价值的语义：**只要知道对端地址，就能一直尝试连接**
2. 保留 v2 已经验证有效的能力：
   - 双向 state sync
   - command relay
   - request lifecycle mirror
3. 删除 v2 中对当前业务没有直接价值的复杂度：
   - 重型 resume barrier
   - 过深的 session/ticket 核心语义
   - 图拓扑抽象
4. 明确宿主层硬约束：
   - `displayMode === 'SECONDARY' && standalone === false` 禁止业务 stateStorage
   - `standalone=true` 的 slave 允许本地持久化

---

## 4. 设计原则

### 4.1 先定业务拓扑，再谈宿主差异

V3 的第一原则：

> **core 拓扑永远只建模一主一副配对，不建模图网络。**

也就是说：

1. 一个 pair session 只有两个业务角色：`MASTER` / `SLAVE`
2. 一个 runtime 只需要知道自己的 peer
3. 不存在多上游、多候选 authority、多跳拓扑路径

### 4.2 双向同步，但每个 slice 只能有一个 authority

V3 允许：

1. master -> slave 同步
2. slave -> master 同步

但不允许：

1. 同一份事实由双方同时当 authority
2. 不声明方向的“全量 store 自动双向同步”

所以正确模型是：

- 拓扑是双向通道
- 数据是**按 slice 单向 authoritative**

### 4.3 稳定 locator 与临时连接材料分离

进入持久化真相源的，只能是：

1. `instanceMode`
2. `enableSlave`
3. `masterLocator`
4. `preferredDisplayMode`

不进入持久化真相源的：

1. `sessionId`
2. `ticketToken`
3. `ticketExpiresAt`
4. `resume pending state`
5. 其他临时 auth 材料

### 4.4 reconnect 先求确定性，不先求省流量

V3 reconnect 默认走：

1. 断线
2. 重连
3. `hello / hello-ack`
4. authoritative side 发 `snapshot`
5. 恢复到 `ACTIVE`

不再默认走：

1. summary/diff/commit barrier
2. 旧 session 的“半恢复”技巧
3. 为了少发一次 snapshot 而引入复杂状态机

### 4.5 宿主差异只放 assembly / host，不放进 core pair 模型

下列差异属于宿主层，不属于 core topology：

1. slave 是内建副屏，还是独立设备
2. slave 能不能本地持久化
3. 电源变化时 displayMode 如何切换
4. 启动时 topology binding 从哪里拿
5. transport 是否需要 ticket

---

## 5. 场景统一模型

## 5.1 统一抽象

无论下面哪种场景，core topology 都只看成：

- 一个 `master`
- 一个 `slave`
- 一条 pair link

### 场景 A：单机双屏

- primary runtime = master
- managed secondary runtime = slave
- 两端在同一台设备上

### 场景 B：双机单屏

- A = master
- B = standalone slave
- 两端在不同设备上

### 场景 C：双机双屏

如果业务上仍然是一主一副配对，那么 V3 不把它理解成四节点拓扑，而是只认当前业务 pair：

- 哪个 runtime 是本次业务 pair 的 master
- 哪个 runtime 是本次业务 pair 的 slave

其他本机显示槽位、附属屏幕、辅助进程，都属于宿主层能力，不进入 V3 core 拓扑建模。

## 5.2 真正的场景差异在哪

### managed secondary

特征：

1. `displayIndex > 0 && displayCount > 1`
2. `standalone=false`
3. `displayMode` 默认 `SECONDARY`
4. 不拥有本地业务持久化真相源
5. 不能 bootstrap 自己独立业务身份

### standalone slave

特征：

1. `displayIndex === 0`
2. `standalone=true`
3. `instanceMode=SLAVE`
4. 可本地持久化
5. 可 bootstrap 自己独立业务身份
6. 可根据电源/业务策略在 `PRIMARY / SECONDARY` 间切 displayMode

结论：

- 这两者的区别是**宿主约束差异**
- 不是 core topology 是否应该变成多 peer 图模型

---

## 6. 运行语义

## 6.1 Core 配置真相源

```ts
type TopologyServerAddress = {
  address: string
}

interface TopologyV3ConfigState {
  instanceMode: 'MASTER' | 'SLAVE'
  enableSlave: boolean
  masterLocator?: {
    masterNodeId?: string
    masterDeviceId?: string
    serverAddress: TopologyServerAddress[]
    httpBaseUrl?: string
    addedAt: number
  } | null
  preferredDisplayMode?: 'PRIMARY' | 'SECONDARY'
}
```

说明：

1. `standalone` 不持久化
2. `workspace` 不持久化
3. `sessionId / ticket / resume` 不持久化
4. `masterLocator` 是“如何找到当前业务 pair 的 master”

## 6.2 Core 运行态

```ts
interface TopologyV3RuntimeState {
  standalone: boolean
  displayMode: 'PRIMARY' | 'SECONDARY'
  workspace: 'MAIN' | 'BRANCH'
  connection: {
    status: 'DISCONNECTED' | 'CONNECTING' | 'SYNCING' | 'ACTIVE'
    reconnectAttempt: number
    sessionId?: string
    peerNodeId?: string
    peerDeviceId?: string
    lastError?: string
    lastHelloAt?: number
    lastSnapshotAt?: number
    lastUpdateAt?: number
  }
}
```

说明：

1. `standalone` 继续由宿主 display context 推导，不作为拓扑角色字段
2. `displayMode` 继续表示业务显示角色，不等于 `instanceMode`
3. `workspace` 继续沿用既有规则：`SLAVE + PRIMARY -> BRANCH`，其余 `MAIN`

## 6.3 `standalone` 规则

V3 沿用当前正确规则：

1. 如果有 display context，就优先以 `displayIndex === 0` 推导 `standalone`
2. 这能保证：
   - managed secondary -> `standalone=false`
   - standalone slave -> `standalone=true`
3. 但这条规则有一个前提：**assembly 必须始终把 `displayIndex` 传给 topology runtime**

参考既有实现：`1-kernel/1.1-base/topology-runtime-v2/src/foundations/context.ts:18`

所以 V3 不需要再引入新的 `standaloneDevice` 字段。

同时必须明确：

1. 如果 `displayIndex` 缺失，现有 fallback 逻辑里 `instanceMode=SLAVE` 仍可能推导出 `standalone=false`
2. 这会直接破坏 standalone slave 的 storage gate 判定
3. 因此 **V3 assembly 初始化必须把 `displayIndex` / `displayCount` 视为必填宿主上下文**
4. assembly 侧需要在 topology bootstrap / binding 初始化时加入 guard：缺少 display context 时，不允许进入 V3 topology 启动流程

## 6.4 storage gate 规则

唯一禁用业务本地持久化的条件：

```ts
displayMode === 'SECONDARY' && standalone === false
```

也就是：

- **只禁 managed secondary**
- 不禁 standalone slave，即使它当前 `displayMode='SECONDARY'`

这条规则继续放在 assembly 层，而不是 core topology。

## 6.5 激活 / 拓扑互斥规则

V3 必须把 **TCP 激活资格** 和 **拓扑角色资格** 明确成一套可验证规则，而不是让 UI 或宿主各自猜测。

### 单屏设备状态机

#### `MASTER + UNACTIVATED`

允许：

1. 执行 TCP 激活
2. 手动切换为 `SLAVE`
3. 手动打开 `enableSlave`

约束：

1. 默认 topology host 不启动
2. `enableSlave=true` 时自动启动 topology host
3. `enableSlave=false` 时自动关闭 topology host

#### `MASTER + ACTIVATED`

允许：

1. 保持 `MASTER`
2. 手动打开或关闭 `enableSlave`
3. 对外提供 topology host 服务

禁止：

1. 直接切换为 `SLAVE`
2. 在未解除激活前进入副机配对流程

也就是说：

- **已激活单屏主机，必须先解除 TCP 激活，才能切换成 `SLAVE`。**

#### `SLAVE`

允许：

1. 保存或导入 `masterLocator`
2. 发起 pair connect
3. 作为 standalone slave 保留本地业务持久化

禁止：

1. 执行 TCP 激活
2. 打开“把自己当主机激活”的 UI 流程

### managed secondary 的额外限制

`displayMode === 'SECONDARY' && standalone === false` 时：

1. 不参与 TCP 激活
2. 不展示激活表单
3. 不允许切到 `MASTER`

原因不是 topology 本身，而是它只是主机上的托管副屏 runtime。

### 运行时守卫

除了 UI 限制，assembly / runtime 层也必须兜底拒绝非法命令：

1. `instanceMode=SLAVE` 时，拒绝 `activateTerminal`
2. `MASTER + ACTIVATED` 时，拒绝 `setInstanceMode(SLAVE)`
3. managed secondary 时，拒绝任何激活命令
4. `setEnableSlave(true/false)` 需要同步驱动 host start/stop，而不是只改 store

因此 V3 的策略是：

- **UI 负责提前说明并禁用**
- **runtime 负责最终裁决**

---

## 7. Pair 连接模型

## 7.1 核心连接语义

V3 的连接语义就是：

1. slave 根据 `masterLocator` 找 master
2. transport 建链
3. 双方 `hello / hello-ack`
4. 建立 pair session
5. authoritative side 发 snapshot
6. steady-state 走 update / command / request mirror

master 侧如果 `enableSlave=true`，则允许接受 pair 连接。

## 7.2 关于 ticket 的定位

V3 默认 **不使用 ticket**。

也就是说：

1. slave 只要拿到 `masterLocator`
2. 就直接按地址建链
3. 然后走 `hello / hello-ack`

这是 V3 简化设计的一部分，因为当前业务已经明确：

- 就是一主一副配对
- 可以完全不考虑安全性
- 目标是简单、高效、健壮，而不是引入额外握手材料

因此：

1. ticket 不是 V3 core 真相源
2. ticket 也不是 V3 默认 host 协议的一部分
3. `0-mock-server/dual-topology-host-v3` 和 Android host v3 都应先实现 **address-only pairing**

如果迁移阶段必须临时兼容旧 ticket host：

1. 只能作为 **兼容模式**
2. 不能改变 V3 core 状态模型
3. 不能要求把 ticket 写入 `TopologyV3ConfigState`

也就是说，ticket 在 V3 里最多只是迁移期 transport 兼容层，不是产品语义本身。

## 7.3 reconnect 模型

统一 reconnect：

1. 连接断开 -> `DISCONNECTED`
2. 只要 locator 还在，就继续重连
3. 重新 `hello / hello-ack`
4. authoritative side 重发 snapshot
5. 回到 `ACTIVE`

V3 第一版不做：

1. core resume barrier
2. core summary/diff/commit 协商
3. reconnect 时依赖旧 session continuation

---

## 8. 协议

## 8.1 保留消息

### `hello`

```ts
type TopologyV3Hello = {
  type: 'hello'
  helloId: string
  runtime: {
    nodeId: string
    deviceId: string
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    standalone: boolean
    protocolVersion: '2026.04-v3'
    capabilities: string[]
  }
  sentAt: number
}
```

### `hello-ack`

```ts
type TopologyV3HelloAck = {
  type: 'hello-ack'
  helloId: string
  accepted: boolean
  sessionId?: string
  peerRuntime?: {
    nodeId: string
    deviceId: string
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    standalone: boolean
    protocolVersion: '2026.04-v3'
    capabilities: string[]
  }
  rejectionCode?: string
  rejectionMessage?: string
  hostTime: number
}
```

### `state-snapshot`

```ts
type TopologyV3StateSnapshot = {
  type: 'state-snapshot'
  sessionId: string
  sourceNodeId: string
  targetNodeId: string
  entries: Array<{
    sliceName: string
    revision: string | number
    payload: unknown
  }>
  sentAt: number
}
```

### `state-update`

```ts
type TopologyV3StateUpdate = {
  type: 'state-update'
  sessionId: string
  sourceNodeId: string
  targetNodeId: string
  sliceName: string
  revision: string | number
  payload: unknown
  sentAt: number
}
```

### `command-dispatch`

保留。

### `command-event`

保留。

### `request-snapshot`

保留，用于 request lifecycle mirror。

## 8.2 明确移除

V3 第一版从 core 协议移除：

1. `resume-begin`
2. `resume-complete`
3. `state-sync-summary`
4. `state-sync-diff`
5. `state-sync-commit-ack`
6. 任何多 peer 路由 / 转发协议
7. `resumeTopologySession` command

原因很简单：

- 当前业务就是 pair
- reconnect 直接 snapshot 修复即可
- 图模型和重 barrier 只会增加脆弱性

也就是说：

1. V3 不再暴露“手工进入 resume barrier”的 command
2. 需要人工干预时，只保留 `start / stop / restart topology connection`

---

## 9. 数据同步规则

## 9.1 必须声明同步描述符

V3 不允许“自动深比较整个 store”。

每个参与 pair 同步的 slice 必须声明：

```ts
interface TopologyV3SyncDescriptor {
  sliceName: string
  authority: 'MASTER' | 'SLAVE'
  mode: 'snapshot-only' | 'snapshot-and-update'
  getRevision(state: RootState): string | number
  exportSnapshot(state: RootState): unknown
  applySnapshot(state: RootState, payload: unknown): RootState
  exportUpdate?(input: {prevState: RootState; nextState: RootState}): unknown | undefined
  applyUpdate?(state: RootState, payload: unknown): RootState
}
```

这一定义需要明确它的归属层：

1. `TopologyV3SyncDescriptor` 是 **topology-runtime-v3 内部 registry 描述符**
2. 它 **不是** `state-runtime` 包里 `StateRuntimeSyncDescriptor` 的直接替代
3. `state-runtime` 仍保留现有职责：
   - slice reducer / persistence
   - `syncIntent`
   - `sync`
4. V3 第一版不要求修改 `1-kernel/1.1-base/state-runtime` 的公共类型

V3 第一版建议采用：

1. 业务 slice 继续通过 `StateRuntimeSliceDescriptor.syncIntent` 声明方向
2. `master-to-slave` -> `authority='MASTER'`
3. `slave-to-master` -> `authority='SLAVE'`
4. `slice.sync` 继续承载低层数据导出/应用能力
5. `TopologyV3SyncDescriptor` 在 topology-runtime-v3 内把：
   - `sliceName`
   - `authority`
   - `mode`
   - revision 策略
   - snapshot/update 编排
   收口成一份 pair sync registry

也就是说：

- V3 首先重构 topology 编排层
- 不先重构 state-runtime 类型系统

当前所有 `syncIntent='isolated'` 的 slice 在 V3 下仍然保持 isolated，除非业务显式迁移它们。

## 9.2 authority 规则

### master authoritative

例如：

1. 激活态
2. TCP/TDP 主业务读模型
3. 主业务页面只读视图状态

规则：

- master 决定真相
- slave 只接收
- reconnect 后以 master snapshot 覆盖 slave

### slave authoritative

例如：

1. slave 本地输入状态
2. slave 诊断/测量结果
3. slave 本地 UI / request 反馈

规则：

- slave 决定真相
- master 只接收
- reconnect 后以 slave snapshot / update 修复 master

### local-only

例如：

1. 本地宿主调试开关
2. 不应跨 pair 传播的本地 UI 状态

规则：

- 不参与 topology

## 9.3 reconnect 时的恢复原则

pair reconnect 的恢复原则非常简单：

1. 先回到物理连通
2. 再补 authoritative snapshot
3. 再恢复 steady-state update

V3 第一版不做“按 revision 讨价还价决定谁发什么”。

## 9.4 revision 与幂等规则

V3 第一版要明确以下约束：

1. `revision` 由 authoritative side 的 slice/exporter 自己生成
2. `revision` 可以是：
   - 单调递增数字
   - 稳定 hash
   - 业务版本戳
3. topology runtime 不统一替业务 slice 生成 revision

reconnect 时：

1. 每次新的 `hello / hello-ack` 成功后，**第一份 authoritative snapshot 必须强制应用**
2. 即使它的 `revision` 和上次连接前相同，也不能因为“看起来没变”而跳过
3. 因为它承担的是“会话重建后的基线确认”，不只是普通增量更新

steady-state update 时：

1. 接收方可以按 slice 自己的 revision 规则丢弃明显过旧的数据
2. 但 V3 第一版不做跨 slice 的统一冲突仲裁

## 9.5 第一版可靠性假设

V3 第一版明确依赖：

1. 单条 WebSocket 连接内消息是有序的
2. WebSocket 传输本身提供基础可靠交付
3. V3 不额外引入应用层 ack / sequence / resend 协议

这意味着：

1. 如果 bootstrap snapshot 在预期时间内没有到达，应判定本次连接失败
2. 然后走断开 -> 重连 -> `hello / snapshot` 重建
3. 第一版不定义“单独补拉 snapshot”的额外消息

---

## 10. core 与 assembly 的职责边界

## 10.1 core 负责

1. 配置真相源
2. pair link 生命周期
3. hello / ack
4. snapshot / update
5. command relay
6. request lifecycle mirror
7. reconnect
8. per-slice authority enforcement

### runtime-only peer state

`peerState` 在 V3 中继续保留，但语义要明确：

1. 只保存当前 pair peer 的运行态信息
2. 来源是 `hello / hello-ack / disconnect`
3. `persistIntent='never'`
4. `syncIntent='isolated'`

也就是说，`peerState` 不是业务同步 slice，只是连接观测状态。

## 10.2 assembly 负责

1. managed secondary 的 storage gate
2. standalone slave 的本地持久化保留
3. displayMode 电源切换规则
4. topology binding source
5. locator 导入、解析与连接绑定
6. admin-console 的人工控制入口
7. TCP 激活资格守卫
8. `enableSlave` 与 topology host 生命周期绑定

## 10.3 UI / 管理面板负责

### admin topology panel

需要明确展示并约束：

1. 当前 `instanceMode / displayMode / standalone / activationStatus`
2. 当前 topology host 是否已启动
3. `MASTER + ACTIVATED` 为什么不能切 `SLAVE`
4. `SLAVE` 为什么不能做 TCP 激活
5. `enableSlave` 开关与 host 生命周期的联动结果

### TCP 激活页面

TCP 激活页面不是单纯表单页，也必须体现 topology 约束：

1. `instanceMode=SLAVE` 时，不展示可提交激活表单
2. managed secondary 时，不展示激活表单
3. `MASTER + UNACTIVATED` 时，正常展示激活表单
4. `MASTER + ACTIVATED` 时，展示“已激活”状态，而不是再次提交激活
5. 页面上必须给出明确禁用原因，而不是只把按钮置灰

激活页至少要能表达以下文案级语义：

1. 当前是副机，副机不允许激活，请先切回主机
2. 当前是托管副屏，托管副屏不参与激活
3. 当前设备已激活，如需改为副机，请先解除激活

## 10.4 host / adapter 负责

1. HTTP / WS 承载
2. pair session / role occupancy
3. 在线 relay
4. 心跳超时 / connection detach
5. fault injection
6. 在 `enableSlave=true` 时暴露 topology host，在 `enableSlave=false` 时关闭
7. 允许 assembly 观察 host running / stopped / error 状态

V3 host / adapter **不做 offline queued relay**。原因是业务拓扑已经收敛为一主一副，断线期间的中间消息缓存既不能保证业务最新状态，也会重新引入 v2 的 resume barrier 复杂度。断线期间发往离线 peer 的 relay 消息直接丢弃；重新连接后通过 `hello / hello-ack` 和 authoritative `state-snapshot` 恢复一致性。

## 10.5 `0-mock-server/dual-topology-host-v3` 负责

V3 必须新建：

```text
0-mock-server/dual-topology-host-v3
```

它的职责不是“再造一个业务宿主”，而是做 **kernel / adapter / assembly 联调的 V3 基准 host**。

### 核心职责

1. 提供 pair-only 的 HTTP / WS 承载
2. 实现 V3 基线协议：
   - `hello`
   - `hello-ack`
   - `state-snapshot`
   - `state-update`
   - `command-dispatch`
   - `command-event`
   - `request-snapshot`
3. 实现一主一副 role occupancy
4. 提供断线、重连、delay、drop 等 fault injection
5. 为 `topology-runtime-v3` 提供 live integration test server

### 不做的事

1. 不做 ticket 作为默认前置条件
2. 不做多 peer / graph routing
3. 不掺入 displayMode / standalone / power policy 这类 assembly 语义

### 建议接口面

HTTP：

1. `GET /status`
2. `GET /stats`
3. `GET /diagnostics`
4. `POST /fault-rules`
5. `DELETE /fault-rules`

WS：

1. `GET /ws`
2. 消息完全按 V3 pair protocol 收发

### 设计原则

1. 默认只支持 address-only pairing
2. 默认只允许一个 `MASTER` + 一个 `SLAVE`
3. reconnect 后重新 `hello`，再发 authoritative snapshot
4. host 自己不保存业务 state 真相，只做 relay / session 壳

### 与现有 mock server 的关系

V3 第一版建议：

1. `dual-topology-host-v3` 保持为独立 workspace 包
2. 不先并入 `mock-terminal-platform`
3. 不复用现有 `dual-topology-host` 的 ticket / resume 行为

测试启动方式：

1. live test 通过包内 helper 显式 start / close
2. 端口优先使用动态空闲端口或测试专用端口
3. 不和现有 mock server 常驻端口耦合

### 测试职责

`dual-topology-host-v3` 自己要覆盖：

1. master/slave hello 接入
2. role occupancy reject
3. 在线 relay 转发
4. reconnect 后 snapshot 修复
5. fault rule 生效

同时它还要被 `1-kernel/1.1-base/topology-runtime-v3` 的 live test 直接复用。

## 10.6 `3-adapter/android/adapter-android-v2` 的 V3 redesign

V3 不建议在现有 `topologyhost` 目录上直接硬改，而是建议先并行引入一套新的 namespace / 文件组，例如：

```text
3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3
```

等 V3 稳定后，再决定是否替换旧实现。

### 设计目标

1. 保持它是纯 Android 宿主服务
2. 对齐 `dual-topology-host-v3` 的协议和默认行为
3. 默认不依赖 ticket
4. 保留现有 manager/service/status/diagnostics 的壳结构

### V3 host 的职责

1. start / stop Android Service
2. 暴露 `addressInfo / status / stats / diagnostics`
3. 维护单个 pair session 的 occupancy
4. 在线 relay，离线 peer 的 relay 直接丢弃
5. 维护 reconnect 所需的最小会话上下文
6. 提供可观测日志
7. 提供 fault rule 注入

### V3 host 不负责

1. 决定设备能否激活 TCP
2. 决定设备是否应该切 `MASTER / SLAVE`
3. 决定 displayMode 如何跟随电源变化
4. 读写 JS 或 kernel recovery state

这些都属于 assembly / runtime 层。

### 推荐公开 API

保留：

1. `start(config)`
2. `stop()`
3. `getStatus()`
4. `getStats()`
5. `getDiagnosticsSnapshot()`
6. `replaceFaultRules(rules)`

新增或明确：

1. `disconnectPeer()`：主动断开当前 pair
2. `clearSession()`：清理当前临时 pair session

移除默认依赖：

1. `issueTicket(...)` 不再是 V3 基线路径

如果迁移期必须保留，也应：

1. 标注为 legacy compatibility
2. 不被 assembly 的 V3 默认流程调用

### 生命周期规则

1. host 不自行常驻
2. 由上层显式 start / stop
3. 对单屏 `MASTER`，`enableSlave=true` 才 start
4. `enableSlave=false` 必须 stop
5. Product 可以编入，但不会默认启动多余 host 进程

## 10.7 `4-assembly/android/mixc-retail-assembly-rn84` 的 V3 redesign

assembly 是 V3 里最关键的宿主收口层，因为：

1. 它知道 displayCount / displayIndex
2. 它知道 TCP 激活状态
3. 它知道 managed secondary 和 standalone slave 的区别
4. 它负责把 Android host 与 kernel topology runtime 接起来

### 10.7.1 真相源划分

#### kernel topology config state

只保存稳定业务真相：

1. `instanceMode`
2. `enableSlave`
3. `masterLocator`
4. `preferredDisplayMode`

#### assembly binding state

只保存 assembly 侧派生信息：

1. 当前已解析的 `ws/http` 地址
2. 当前 host running status
3. 最近一次导入的 locator payload
4. 最近一次 connect 错误

它不是第二份业务真相源，必须由 kernel config state 或 native host 状态派生。

### 10.7.2 `masterLocator` 与 binding source 的关系

V3 里要明确：

1. `masterLocator` 是 kernel 可恢复真相源
2. `AssemblyTopologyBindingState` 是 assembly 运行态缓存
3. import / clear locator 时，两边都要同步
4. 但最终以 kernel `masterLocator` 为业务真相

也就是说：

- binding source 负责“如何连”
- kernel config 负责“应该连谁”

### 10.7.3 单机双屏

对于 `displayCount > 1`：

1. primary runtime 默认 `MASTER + PRIMARY`
2. managed secondary runtime 默认 `SLAVE + SECONDARY`
3. primary 负责启动 loopback host
4. secondary 通过 native launch coordinator 拿到 locator 后接入 primary
5. secondary 不读业务 stateStorage

这里不再需要 ticket。

`TopologyLaunchCoordinator` 的 V3 目标应该改成：

1. 确保 primary host 已启动
2. 生成主端 `masterNodeId`
3. 返回 locator（`wsUrl/httpBaseUrl`）
4. secondary 依此直接建链

当前已有的原生入口是：

- `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/startup/TopologyLaunchCoordinator.kt`

V3 第一版建议：

1. 在 V2 与 V3 并行期间，优先新增 V3 sibling 实现或在 `topology-v3` 命名空间收口
2. 不直接把现有 V2 coordinator 改成破坏式兼容

如果 primary host 启动失败：

1. secondary 不允许猜测地址或自建主机
2. secondary 保持 `DISCONNECTED`
3. assembly 记录明确错误并暴露给 admin / logs / automation

### 10.7.4 单屏主机

对于 `displayCount === 1 && instanceMode=MASTER`：

1. 默认 topology host 不启动
2. `enableSlave=true` 时启动 topology host
3. `enableSlave=false` 时停止 topology host
4. host running 后可导出 share payload / locator

如果设备已经 `ACTIVATED`：

1. 仍可保持 `MASTER`
2. 仍可打开 `enableSlave`
3. 但不能切成 `SLAVE`

`enableSlave` 与 host 生命周期的绑定层，也要在这里明确：

1. 这个绑定属于 **assembly 层**
2. 不是 core topology actor 直接调用 native host
3. assembly 通过 store subscription / selector 监听 `enableSlave + instanceMode + displayCount`
4. 然后驱动 `nativeTopologyHost.start/stop`

这样可以保持：

- core topology 只关心 pair 语义
- host 生命周期仍由宿主层负责

### 10.7.5 单屏副机

对于 `displayCount === 1 && instanceMode=SLAVE`：

1. 可以保存 `masterLocator`
2. 可以持续重连 master
3. `standalone` 继续按 `displayIndex===0` 推导，因此仍为 `true`
4. 本地业务 stateStorage 保留
5. 可以在业务规则允许时切 `displayMode`

这里必须和旧错误设计划清界限：

- `standalone` 不是从“是否 slave”推导
- 而是优先从 display slot 推导

因此 standalone slave 不会因为 `instanceMode=SLAVE` 就丢失本地持久化资格。

但这个结论依赖一个硬约束：

1. assembly 创建 topology context 时必须带上 `displayIndex`
2. 如果缺少 `displayIndex`，不得继续启动 V3 topology
3. 相应测试必须覆盖“缺 display context 时拒绝启动”的 guard

### 10.7.6 激活页与 runtime guard

assembly 需要提供一个统一 selector / service，供：

1. TCP 激活页面
2. admin topology 面板
3. runtime command guard

共同判断当前资格。

建议输出统一 reason code：

1. `managed-secondary`
2. `slave-instance`
3. `activated-master-cannot-switch-to-slave`
4. `already-activated`
5. `master-unactivated`

然后：

1. UI 用 reason code 渲染提示文案
2. runtime command guard 用 reason code 做最终拒绝

### 10.7.7 可观测性

assembly 必须增加结构化日志，至少覆盖：

1. `enableSlave` 切换
2. host start / stop
3. locator import / clear
4. hello sent / ack received
5. snapshot applied
6. pair disconnected / reconnect scheduled
7. activation guard reject

V3 调试不应只靠读代码猜，必须靠日志 + socket 证据排查。

## 10.8 `2-ui/2.1-base/admin-console` 的 V3 redesign

admin topology 面板要从“命令按钮堆积”改成“受约束的 pair 控制面板”。

### 10.8.1 职责边界

UI 仍通过 runtime command 读写标准 topology state：

1. `setInstanceMode`
2. `setDisplayMode`
3. `setEnableSlave`
4. `setMasterInfo / clearMasterInfo`
5. `start / stop / restart topology connection`

`AdminTopologyHost` 只处理 assembly-specific host 动作：

1. `getSharePayload`
2. `importSharePayload`
3. `clearMasterInfo`
4. `connectByLocator` 或 `restartAfterImport`
5. `getTopologyHostStatus`
6. `getTopologyHostDiagnostics`

也就是说：

- host action 不再重复承载 `setInstanceMode / setDisplayMode`
- runtime command 和 host action 的边界要清晰分开

### 10.8.2 面板信息结构

建议拆成 5 组：

1. **角色与激活**
   - `instanceMode`
   - `displayMode`
   - `standalone`
   - `activationStatus`
   - 当前限制原因

2. **主机服务**
   - `enableSlave`
   - host running/stopped/error
   - address info
   - 当前 pair peer

3. **配对控制**
   - 导出 share payload
   - 导入 share payload
   - 清空 locator
   - 启动连接 / 重连 / 主动断开

4. **显示模式**
   - 仅 standalone slave 可切 `PRIMARY / SECONDARY`

5. **诊断**
   - 最近 hello / snapshot / reconnect / error
   - host diagnostics 快照

### 10.8.3 动作约束矩阵

#### 切到 `SLAVE`

允许：

1. 单屏 `MASTER + UNACTIVATED`

禁止：

1. `MASTER + ACTIVATED`
2. managed secondary

#### TCP 激活

允许：

1. `MASTER + UNACTIVATED`

禁止：

1. `SLAVE`
2. managed secondary

#### `enableSlave`

允许：

1. 单屏 `MASTER`
2. 已激活主机也允许

禁止或无意义：

1. managed secondary
2. `SLAVE`

#### 切 displayMode

允许：

1. standalone slave

禁止：

1. managed secondary 手工改 displayMode
2. 单屏 `MASTER`

### 10.8.4 share payload 语义

`formatVersion` 不是 transport protocol version，而是 **share payload 的格式版本**。

因此：

1. slave 导入时要校验 `formatVersion`
2. 只要 payload format 兼容，就可以连接
3. 不要求和底层 WS protocol version 一一对应

建议 payload 至少包含：

```ts
type AdminTopologySharePayloadV3 = {
  formatVersion: '2026.04'
  masterNodeId: string
  deviceId: string
  serverAddress: TopologyServerAddress[]
  httpBaseUrl?: string
  wsUrl?: string
  exportedAt: number
}
```

### 10.8.5 激活页联动

admin topology 面板与 TCP 激活页面必须共用同一套限制说明，不允许：

1. 一个页面说可激活
2. 另一个页面又说不可激活

因此需要共用同一份 selector / reason code。

---

## 11. 包结构建议

建议结构：

```text
1-kernel/1.1-base/topology-runtime-v3
├── src/
│   ├── application/
│   │   ├── createModule.ts
│   │   └── moduleManifest.ts
│   ├── features/
│   │   ├── actors/
│   │   │   ├── configActor.ts
│   │   │   ├── connectionActor.ts
│   │   │   ├── syncActor.ts
│   │   │   ├── dispatchActor.ts
│   │   │   └── initializeActor.ts
│   │   ├── commands/
│   │   └── slices/
│   │       ├── configState.ts
│   │       ├── runtimeState.ts
│   │       ├── peerState.ts
│   │       └── requestMirrorState.ts
│   ├── foundations/
│   │   ├── pairContext.ts
│   │   ├── pairLinkController.ts
│   │   ├── syncRegistry.ts
│   │   ├── protocol.ts
│   │   └── runtimeDerivation.ts
│   ├── supports/
│   └── types/
└── test/
```

这里不再出现：

1. leader tree
2. multi-peer router
3. topology graph planner

同时建议新增或并行以下包 / 目录：

```text
0-mock-server/dual-topology-host-v3
3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3
4-assembly/android/mixc-retail-assembly-rn84/src/application/topology-v3
```

UI 层不建议新开拓扑专用包，而是继续在现有：

```text
2-ui/2.1-base/admin-console
2-ui/2.1-base/terminal-console
```

内完成 V3 控制面板和激活限制，这样可以保持 UI 层规范一致，不额外制造孤岛包。

---

## 12. 迁移与第一版范围

### 12.1 v2 -> v3 迁移策略

V3 必须按并行迁移设计，而不是原地替换：

1. `topology-runtime-v2` 与 `topology-runtime-v3` 并行存在
2. `dual-topology-host` 与 `dual-topology-host-v3` 并行存在
3. Android host v2 与 v3 并行存在，直到 assembly 完成切换

迁移顺序建议：

1. 先落 `dual-topology-host-v3`
2. 再落 Android host v3
3. 再落 `topology-runtime-v3`
4. 再切 assembly / admin / activation UI
5. 最后清理 v2 入口

### 12.2 关于 `tdp-sync-runtime-v2` 的迁移边界

当前代码事实表明：

1. `tdp-sync-runtime-v2` 的业务 slice 主要仍依赖 `state-runtime.syncIntent`
2. 但它的 live harness / tests 明确依赖 `topology-runtime-v2` 的联调基建
3. assembly 当前也直接装配 `topology-runtime-v2`

因此 V3 第一版必须把 TDP 迁移当成一个显式检查项，而不是默认“应该天然兼容”。

第一版建议：

1. 不先改 `tdp-sync-runtime-v2` 的业务 slice 结构
2. 先把 topology live harness / sync status adapter 替换到 V3
3. 明确核查所有 `@impos2/kernel-base-topology-runtime-v2` import 点
4. 等 assembly 和 live tests 稳定后，再考虑删除 v2 依赖

### 12.3 第一版范围

V3 第一版只做：

1. pair locator 持久化
2. 自动 reconnect
3. `hello / hello-ack`
4. `state-snapshot`
5. `state-update`
6. `command-dispatch / command-event`
7. `request-snapshot`
8. 明确的 per-slice authority
9. TCP 激活页面与 runtime 资格限制
10. `dual-topology-host-v3`
11. Android host v3 基线协议
12. admin topology 面板重构

第一版不做：

1. core ticket 语义
2. core resume barrier
3. state summary/diff/commit 协商
4. 多 peer / 图拓扑
5. 多跳路由
6. pair 之外的节点编排抽象
7. V3 默认 ticket 配对

如果必须保留 ticket，只能在迁移期作为 compatibility mode，不进入第一版主链。

---

## 13. 测试矩阵

V3 必须至少覆盖：

1. **单机双屏 managed secondary**
   - master 改 state
   - slave 同步显示
   - slave 不读本地业务 storage
   - 既要有 `shouldDisableAssemblyStatePersistence` 的单元测试，也要有带 instrumented storage 的 live 验证

2. **双机单屏 standalone slave**
   - slave 保留本地业务 storage
   - slave 能通过 locator 自动连 master
   - power 切换时能改 displayMode
   - 缺少 `displayIndex` 时必须拒绝 topology 启动

3. **slave -> master 双向同步**
   - slave authoritative slice 正常回传 master

4. **command relay**
   - master 发 command 到 slave
   - slave 回传 command event

5. **request lifecycle mirror**
   - request 状态能在 pair 间镜像

6. **断线重连**
   - 断线
   - 重连
   - snapshot 修复状态

7. **ticket 非核心化**
   - 即使 transport 需要 ticket，core 也不把 ticket 作为持久化真相源

8. **激活资格限制**
   - `SLAVE` 无法发起 TCP 激活
   - managed secondary 不显示激活表单
   - `MASTER + ACTIVATED` 无法直接切到 `SLAVE`

9. **激活页 UI 限制**
   - `MASTER + UNACTIVATED` 显示可提交表单
   - `MASTER + ACTIVATED` 显示已激活态
   - `SLAVE` 显示禁用原因
   - managed secondary 显示禁用原因

10. **mock host v3**
   - address-only pairing
   - role occupancy
   - reconnect 后 snapshot 修复
   - fault rule 生效

11. **Android host v3**
   - `enableSlave=true` 才启动
   - `enableSlave=false` 停止
   - 不依赖 ticket
   - 可返回 diagnostics / stats / current pair

12. **admin topology panel**
   - 动作禁用理由正确
   - host status 与 runtime state 一致
   - share payload import/export 正常
   - standalone slave displayMode 控制正确

---

## 14. 结论

V3 的正确方向不是：

1. 继续修补 v2 的复杂 barrier
2. 引入 leader/follower 图模型
3. 把“单机双屏”和“跨机主副”拆成两套拓扑设计

V3 的正确方向应该是：

1. **业务拓扑严格收敛为一主一副配对**
2. **双向同步，但每个 slice 单 authority**
3. **core 只做 pair topology**
4. **managed secondary / standalone slave 的差异留给 assembly**
5. **reconnect 走 hello + snapshot，不再走重 barrier**

这样既能继承旧工程最有价值的语义，也能把 v2 过重的复杂度拿掉。
