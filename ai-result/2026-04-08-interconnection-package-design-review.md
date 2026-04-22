# interconnection 包设计评审与零到一重设计方案

## 1. 结论先行

`1-kernel/1.1-cores/interconnection` 实际上不是一个“连接工具包”，而是当前仓库里非常核心的“实例拓扑内核”。

它同时承担了下面几层职责：

1. 实例身份与运行拓扑：`master / slave`、`primary / secondary`、`main / branch`
2. 主副端连接生命周期：本地 server、WebSocket 配对、心跳、重连
3. 跨端命令路由：本地命令自动转远程命令
4. 跨端状态同步：按 slice 的 `syncType` 做自动同步
5. 分布式请求观测：`requestStatus` 跨主副端合并
6. 多数 core/module 的上下文基础设施：workspace slice、instanceMode slice、selector、枚举、辅助函数

它最强的地方是：把 POS 多屏/主副协同场景抽成了一套统一语言，让下游模块可以用同一种方式描述“状态在哪一端生效、命令在哪一端执行、状态应该往哪一端同步”。

它最大的问题也来自这里：职责过宽，导致它已经不是一个普通 core 包，而是整个仓库的运行时底座。只要它的语义变，影响的不是一个包，而是整条上下游链路。

## 2. 阅读范围

本次重点阅读了以下内容：

### 2.1 包本体

1. `1-kernel/1.1-cores/interconnection/src/features/*`
2. `1-kernel/1.1-cores/interconnection/src/foundations/*`
3. `1-kernel/1.1-cores/interconnection/src/types/*`
4. `1-kernel/1.1-cores/interconnection/dev/*`

### 2.2 直接上下游与实际使用方

1. `1-kernel/1.1-cores/ui-runtime/*`
2. `1-kernel/1.1-cores/navigation/*`
3. `1-kernel/1.1-cores/task/*`
4. `1-kernel/1.1-cores/terminal/*`
5. `1-kernel/1.2-modules/pay-base/*`
6. `1-kernel/1.2-modules/order-create-traditional/*`
7. `2-ui/2.1-cores/admin/*`
8. `2-ui/2.2-modules/mixc-trade/*`
9. `2-ui/2.2-modules/mixc-workbench/*`
10. `2-ui/2.3-integrations/mixc-retail/*`
11. `4-assembly/electron/mixc-retail-v1/src/application/modulePreSetup.ts`
12. `4-assembly/android/mixc-retail-rn84v2/src/application/modulePreSetup.ts`
13. `3-adapter/electron/adapterV1/src/main/index.ts`
14. `3-adapter/electron/adapterV1/src/renderer/foundations/localWebServer.ts`
15. `4-assembly/android/mixc-retail-rn84v2/src/foundations/localWebServer.ts`
16. `0-mock-server/master-ws-server-dual/*`

### 2.3 方法论文档

1. `spec/kernel-core-dev-methodology.md`
2. `spec/kernel-core-ui-runtime-dev-methodology.md`
3. `docs/superpowers/specs/2026-04-08-ui-runtime-design.md`

## 3. 它在整套架构中的真实位置

如果只看包名，容易以为它只是“主副设备连接层”。但从代码与上下游依赖看，它真实上更像下面这个位置：

1. `kernel-core-base` 之上的第一层 runtime 基础设施
2. `ui-runtime / navigation / task / pay-base / order-create-traditional` 这类包共享的上下文系统
3. assembly 与 adapter 之间关于“本地连接服务”的适配点
4. 多屏、多实例、多 workspace 运行语义的唯一来源

换句话说，它已经是“平台约束定义者”，不是“被业务调用的一个工具模块”。

## 4. 现有设计的核心特点

## 4.1 用三组上下文维度描述运行拓扑

`InstanceInfoState` 把运行环境抽成了：

1. `instanceMode`: `MASTER / SLAVE`
2. `displayMode`: `PRIMARY / SECONDARY`
3. `workspace`: `MAIN / BRANCH`
4. `standalone`
5. `enableSlave`
6. `masterInfo`

其中最关键的不是字段本身，而是它把“设备身份”“屏幕身份”“业务状态域”放进了同一个上下文模型里。

这套模型直接驱动了下游：

1. ScreenPart 过滤
2. workspace slice 定位
3. 命令执行路由
4. 主副端状态同步方向

## 4.2 它不是只提供连接能力，还提供“上下文态切片框架”

`createWorkspaceSlice / toModuleSliceConfigs / dispatchWorkspaceAction` 和 `createInstanceModeSlice / dispatchInstanceModeAction` 说明这个包已经不只是 interconnection。

它还定义了：

1. 如何按 `workspace` 拆 slice
2. 如何按 `instanceMode` 拆 slice
3. action type 如何动态改写到正确的分区 slice
4. 下游模块如何声明自己是否参与主副同步

这也是为什么 `ui-runtime`、`navigation`、`pay-base`、`order-create-traditional` 都深度依赖它。

## 4.3 命令路由是“隐式远程化”的

`commandWithExtra` 与 `remoteCommandConverter` 做了两件事：

1. 给命令自动补齐 `workspace` 与 `instanceMode`
2. 如果命令目标 `instanceMode` 不等于当前实例，就自动转成 `sendToRemoteExecute`

这意味着业务 actor 不一定要显式写“远程调用”，很多情况下只要带上目标上下文，命令就会自动跨端执行。

这是整个包最有代表性的设计特征之一。

## 4.4 状态同步是“slice 元数据驱动”的

`ModuleSliceConfig.syncType` 被当成同步声明：

1. `ISOLATED`
2. `MASTER_TO_SLAVE`
3. `SLAVE_TO_MASTER`

`setStateNeedToSync` 在 module pre-setup 阶段扫全量模块，把需要同步的 slice 注册到两个全局集合里。

然后 `stateSyncMiddleware` 按这些集合做同步。

这是一种非常强的“平台约定优先”设计。

## 4.5 同步协议基于顶层字段的 `updatedAt`

当前同步不是通用 diff 引擎，而是依赖一种非常明确但也很脆弱的契约：

1. slice 顶层字段必须是 `{ value, updatedAt }`
2. 远端同步写回必须提供 `batchUpdateState`
3. 删除不能直接 `delete`，而要写 `null + updatedAt`

这个设计直接影响了后续 `navigation -> ui-runtime` 的 slice 设计方式。

## 4.6 请求观测是分布式的

`requestStatus` 不是普通 UI loading 状态，而是一个跨主副端的命令执行台账。

特点是：

1. 生命周期来自 ActorSystem 全局 listener
2. 状态按 `instanceMode` 分 slice
3. 通过 `selectMergedRequestStatus` 做主副合并
4. `task` 包和 UI hook 直接消费它

这让“命令从本端发出、在远端执行、结果再被本端 UI 观察”成为可能。

## 4.7 transport 层是“本地 server + pair websocket”模型

`DualWebSocketClient` 与 `master-ws-server-dual` 形成的是一个非常具体的协议模型：

1. master 启动本地 server
2. slave 通过 `masterInfo.serverAddress` 注册
3. 服务端维护一对 master/slave
4. 消息按 pair 双向转发
5. 心跳维持连接
6. peer 不在线时允许短暂缓存与重试

这不是通用通信层，而是明确针对主副屏协同的 pair 模型。

## 4.8 adapter 边界是对的

`registerLocalWebServer` 的存在说明设计者已经意识到：

1. Electron 与 RN 上的 server 启动方式不同
2. interconnection 不应该自己直接绑定某个平台 API
3. 本地 server 能力需要由 assembly/adapter 注入

这一点是设计上很成熟的部分。

## 5. 这套设计真正优秀的地方

## 5.1 它抓住了产品真实问题，而不是追求抽象优雅

它没有把问题抽象成浏览器 route、窗口管理、通用分布式状态机，而是非常直接地围绕 POS 多屏场景建模：

1. 主屏与副屏
2. 同机双屏与外部从机
3. 哪些状态主写副读
4. 哪些命令应该在另一端执行

这使它和产品形态是贴合的。

## 5.2 它提供了一套统一的“上下文语言”

下游大量包之所以能协同，是因为它们都围绕同样的上下文语义工作：

1. `InstanceMode`
2. `DisplayMode`
3. `Workspace`
4. `SyncType`

这一点非常重要。统一语言比单个实现技巧更有价值。

## 5.3 它把主副同步从业务包里抽掉了

下游业务包大多只需要：

1. 用 `createWorkspaceSlice`
2. 声明 `syncType`
3. 用 `dispatchWorkspaceAction`
4. 把顶层值包成 `ValueWithUpdatedAt`

剩下的主副同步、远端 patch 应用、中间件监听，都不用每个包自己重写。

这大大降低了业务包接入主副同步的成本。

## 5.4 远程命令路由的使用门槛很低

`withExtra({ instanceMode })` 或默认 MAIN -> MASTER 的行为，虽然隐式，但在使用体验上非常顺手。

对于大量“主端发起，副端执行”或“副端发起，主端执行”的动作，这个设计能显著减少模板代码。

## 5.5 `requestStatus` 的设计非常实用

这一部分是被低估的优点。

它让：

1. `task` 可以汇报进度
2. UI 可以等待跨端命令结果
3. 一个 request 下多 actor 的执行情况可以统一观察

这对 POS 终端这种异步步骤多、联动多的系统非常有价值。

## 5.6 它为 `ui-runtime` 新设计提供了直接约束

`ui-runtime` 现在要求：

1. 顶层字段带 `updatedAt`
2. `batchUpdateState`
3. 清空用 `null`

这些约束并不是凭空来的，而是 interconnection 的同步模型逼出来的。

从“平台规则生成下游设计约束”这个角度看，它是成功的。

## 6. 主要问题与结构性缺点

## 6.1 职责过宽，是当前最大问题

它现在混合了五类不同层次的东西：

1. 运行时拓扑状态
2. transport 与配对连接
3. 命令路由
4. 状态同步框架
5. 请求观测

外加两个“并不属于 interconnection 本体”的东西：

1. workspace/instanceMode slice helper
2. localWebServer adapter 抽象

结果是：

1. 包很难独立理解
2. 很难单独替换其中一层
3. 任意改动都容易扩大影响面

## 6.2 包名已经无法准确表达职责

今天它更像：

1. topology kernel
2. replica sync substrate
3. remote command router

而不是单纯 interconnection。

这会导致认知偏差：新接手的人会低估它的影响范围。

## 6.3 上下文维度之间有明显耦合和隐式规则

最典型的是 `workspace`。

当前 `workspace` 既被持久化在 `instanceInfo`，又由 reducer 根据 `instanceMode + displayMode` 推导。

这会带来两个问题：

1. 它到底是真实状态，还是派生状态，不够清晰
2. 规则隐含在 reducer 里，下游只看到结果，看不到策略

特别是当前规则：

1. `SLAVE + PRIMARY => BRANCH`
2. 其他情况基本回到 `MAIN`

这不是一个直观模型，下游很难凭常识推断。

## 6.4 命令默认路由过于隐式

`commandWithExtra` 里“如果 workspace 是 MAIN 且不是内部命令，则默认 target instanceMode = MASTER”这条规则非常重。

它的好处是省事，坏处是：

1. 业务代码读起来不显式
2. 命令到底是本地执行还是远端执行，不看 converter 不知道
3. 对新角色、新拓扑扩展不友好

当前这套设计非常适合“两端模型”，但不适合未来扩展到更复杂拓扑。

## 6.5 同步协议是强约定，但不是强类型协议

当前同步高度依赖约定，而不是显式 contract：

1. 顶层字段必须有 `updatedAt`
2. reducer 必须实现 `batchUpdateState`
3. 删除必须写 `null`

这些规则在工程上有效，但有几个问题：

1. 规则散落在不同包中
2. 类型系统没有强制保证
3. 只要某个新 slice 忘了遵守，问题就会在运行时才暴露

也就是说，这是一种“靠团队默契维持”的架构。

## 6.6 全局单例和全局注册过重

典型位置：

1. `storeEntry`
2. `ActorSystem`
3. `DualWebSocketClient.getInstance()`
4. `statesToSyncFromMasterToSlave`
5. `statesToSyncFromSlaveToMaster`

这类全局单例让系统使用很方便，但代价是：

1. 测试隔离差
2. 多 app 实例难处理
3. modulePreSetup 顺序与幂等性要求高

## 6.7 transport 语义与业务完成语义混在一起

`sendToRemoteExecute` 等待的是 `REMOTE_COMMAND_EXECUTED`，本质上只说明：

1. 远端已经接收并发起执行

它不等于：

1. 远端业务命令已经完成
2. 远端业务结果已经可用

当前系统能工作，是因为另有 `requestStatus` 这条观测链路补上了“完成态”。

这意味着 transport ack 与业务 completion 被拆成两条语义链，但 API 侧没有讲清楚。

## 6.8 `slaveStatus` 这条支线明显未完成

它存在，但当前问题很多：

1. 消费方几乎没有
2. `setDisplayToSecondary` 里却写入 `DisplayMode.PRIMARY`
3. 类型导出与 RootState augmentation 也没有完整覆盖它

说明这部分并没有真正收敛成稳定设计。

## 6.9 本地 server 的默认 mock fallback 过于宽松

`foundations/adapters/localWebServer.ts` 在未注册 adapter 时直接返回测试地址。

这对 dev 很方便，但会带来两个风险：

1. 配置缺失时不够显性
2. 真实环境误接 mock 语义的可能性上升

更稳妥的做法应该是：

1. dev/test 明确允许 fallback
2. product 环境显式报错

## 6.10 包自己的 dev 验证不符合当前更成熟的方法论

`interconnection/dev/master.ts` 与 `dev/slave.ts` 只是最小启动脚本，不是当前方法论推荐的：

1. selector/state 语义断言
2. 双进程结果收集
3. 持久化恢复验证

这意味着它本身的验证体系弱于它的下游新包，例如 `ui-runtime`。

## 7. 已发现的具体实现问题

下面这些不是“风格问题”，而是比较明确的缺陷或危险点：

## 7.1 `selectSlaveConnected` 逻辑有误

文件：`1-kernel/1.1-cores/interconnection/src/selectors/selectSlaveConnected.ts`

当前判断：

1. `const slaveConnected = !instanceInterconnection.master.slaveConnection?.disconnectedAt`

如果 `slaveConnection` 本身是 `undefined`，这个表达式会得到 `true`。

结果是：

1. 只要当前是 master，就有机会在“根本没有 slave 连接”时返回已连接

而这个 selector 已被 `mixc-trade` 里的 `OrderPriceConfirmContainer` 直接使用。

## 7.2 `setDisplayToSecondary` 写错了 `slaveStatus.displayMode`

文件：`1-kernel/1.1-cores/interconnection/src/features/actors/instanceInfo.ts`

当前逻辑里：

1. `setDisplayToPrimary` 写 `DisplayMode.PRIMARY`
2. `setDisplayToSecondary` 也写 `DisplayMode.PRIMARY`

这明显不是有意设计，更像实现错误。

## 7.3 `slaveStatus` 没有完整进入类型导出面

相关文件：

1. `src/types/moduleState.ts`
2. `src/types/state/index.ts`

当前 slice 已存在，但类型层没有完整覆盖，说明这块设计收束不完整。

## 7.4 `compression.ts` 目前是死代码

文件：`1-kernel/1.1-cores/interconnection/src/foundations/master-ws/compression.ts`

当前没有真正接入 client/server 消息路径。

这说明包内存在“曾想做但没有闭环”的演化残留。

## 8. 这个包真正应该被继承下来的设计思路

如果让我继承它的思路，我会坚定保留下面这些“方向正确”的东西：

1. 多屏 POS 运行时必须把主副拓扑作为一等概念，而不是 UI 层补丁
2. `instanceMode / displayMode / workspace / syncType` 这种统一语言必须保留
3. 业务包不应该自己处理主副同步细节
4. 远程命令路由应该继续沿用 command 风格，而不是直接散落 websocket 调用
5. 请求观测必须跨端统一
6. 本地 server 适配必须保持平台无关
7. dev 验证必须是真双进程，而不是单进程 mock

也就是说，我不会推翻它的产品思路；我会重做的是结构与协议。

## 9. 如果从零到一重设计，我会怎么做

## 9.1 总体策略

我会保留“一个统一 facade 包”，但把内部拆成四个子域。

原因：

1. 继续给下游一个稳定入口，避免全仓库 import 面爆炸
2. 内部边界必须清晰，否则这个包会继续膨胀

我会把它拆成：

1. `topology`：实例身份、显示模式、workspace 策略、配对目标
2. `transport`：本地 server、pair websocket、心跳、重连、peer presence
3. `replication`：状态同步注册、握手、patch 生成与应用
4. `remote-execution`：命令路由、远程执行、请求观测

如果允许进一步抽包，我会把 `createWorkspaceSlice / createInstanceModeSlice` 从 interconnection 中抽出去，变成独立的 context-state 基础包，因为它们本质上不是连接能力，而是“上下文分区状态工具”。

## 9.2 我会重做状态边界

当前 `instanceInfo` 混合了真相源与派生态。我会改成下面四类状态。

### A. 持久化真相源：`topologyProfile`

只保留真正跨重启有意义的配置：

1. `desiredInstanceMode`
2. `enableSlave`
3. `pairedTarget`
4. `pairingSource`
5. `updatedAt`

其中 `pairedTarget` 替代今天的 `masterInfo`，并显式记录来源：

1. `preInitiated`
2. `scanned`
3. `runtimeLocal`

### B. 运行时派生态：`topologyRuntime`

只放当前进程基于环境计算出的事实：

1. `resolvedInstanceMode`
2. `resolvedDisplayMode`
3. `resolvedWorkspace`
4. `standalone`
5. `displayIndex`
6. `displayCount`

这里最关键的一点是：

`workspace` 不再当成既存储又推导的字段，而是明确成为策略产物。

### C. 连接运行态：`pairConnectionRuntime`

只放 transport 相关内容：

1. `status`
2. `currentServerUrl`
3. `connectedAt`
4. `disconnectedAt`
5. `lastError`
6. `attempt`
7. `peerPresence`
8. `heartbeat`

### D. 同步运行态：`replicationRuntime`

把今天含混的 `startToSync` 拆清楚：

1. `phase: idle | handshaking | live`
2. `lastHandshakeAt`
3. `registeredSliceCount`
4. `pendingPatchCount`
5. `lastAppliedVersionBySlice`

这样“连接成功”和“同步已进入 live”就不会再混在一起。

## 9.3 我会重做上下文传播方式

我会保留命令自动补 context 的思路，但改成“显式策略 + 自动补默认值”。

### 当前问题

现在的问题不是自动补值，而是自动路由规则太隐式。

### 新设计

我会给 command 上下文引入显式字段：

1. `workspace`
2. `targetRole`
3. `originRole`
4. `routingPolicy`

其中：

1. 普通业务命令不传时，系统自动补当前 `workspace`
2. 需要远端执行时，业务层应显式声明 `targetRole`
3. compatibility 模式下仍可保留“MAIN 默认 MASTER”的旧规则，但只作为兼容层，不作为核心语义

这样既保留易用性，又不把核心逻辑藏进 converter 魔法里。

## 9.4 我会重做同步协议，但继承 `updatedAt` 思路

我不会否定 `updatedAt`，因为它对这个项目是实用的。

但我会把它从“隐式约定”升级成“显式 contract”。

### 新的同步注册接口

每个可同步 slice 必须注册一个 adapter：

1. `summarize(state) => summary`
2. `diff(local, remoteSummary) => patch`
3. `applyPatch(state, patch)`

然后提供一个默认 adapter，专门服务于当前最常见的结构：

1. `Record<string, ValueWithUpdatedAt<T>>`

这样 `ui-runtime`、`pay-base`、`order-create-traditional` 这类包仍然可以低成本接入，但 contract 会清晰很多。

### 新的 patch 结构

我会使用显式 patch，而不是“payload 里 null 代表删除”的隐式协议：

1. `upserts`
2. `deletes`
3. `baseVersion`
4. `sliceKey`

`null tombstone` 仍可在 adapter 内部兼容，但不会成为公共协议本身。

### 新的握手机制

连接成功后不直接 `startToSync`，而是：

1. 双方交换 `HELLO`
2. 携带能力信息、schema version、slice summary
3. 各自算 patch
4. patch 应用完成后进入 `live`

这样同步相位会更明确，调试也更容易。

## 9.5 我会把“远程执行已接收”和“业务执行完成”拆成两层 API

这是我最想修的一点。

### 现有问题

`sendToRemoteExecute` 返回的是“远端收到了并开始执行”，不是“业务完成”。

### 新设计

我会定义两层确认：

1. `accepted`
2. `completed`

API 形式上允许调用方选择：

1. 只等 `accepted`
2. 等 `completed`

同时 `requestStatus` 继续保留，但职责变成“跨 actor / 跨端执行观测”，不再承担 transport completion 的补丁角色。

## 9.6 我会保留 adapter 模式，但去掉生产环境静默 fallback

`localWebServer` 仍然保留接口化设计：

1. Electron 注入实现
2. RN 注入实现
3. Dev mock 注入实现

但我会区分三种模式：

1. `dev/test`: 允许未注册时 fallback
2. `preview`: 明确警告
3. `production`: 直接报错

这样可以避免“因为忘记注入 adapter，却仍然跑在默认测试地址上”的隐患。

## 9.7 我会把 `slaveStatus` 重新定义成“peer projection”，或者直接删掉

当前 `slaveStatus` 最大的问题不是实现 bug，而是语义不清。

如果未来 master 需要看到 slave 的状态，我会重做成：

1. `peerProjection.<peerId>.displayMode`
2. `peerProjection.<peerId>.workspace`
3. `peerProjection.<peerId>.updatedAt`

如果暂时没人消费，我会先删掉，而不是保留一个未完成分支。

## 9.8 我会把公共读接口收敛成 selector，不鼓励直接读 store

现在很多下游直接：

1. `getInstanceMode()`
2. `getWorkspace()`
3. 甚至直接 `(state as any)[key]`

这会让包越来越像“全局变量仓库”。

重设计后我会明确分两类接口：

1. React/UI 层：selector / hook
2. Actor/command 层：typed accessor service

尽量减少裸 `storeEntry.getStateByKey(...)` 暴露面。

## 9.9 我会重建这个包自己的 dev 验证体系

按当前方法论，这个包至少应有三类验证：

### A. 单进程 topology 语义验证

验证：

1. 环境启动 -> `resolvedInstanceMode/displayMode/workspace`
2. `setInstanceMode`
3. `setDisplayMode`
4. `pairedTarget` 持久化

### B. 真双进程 pair + sync 验证

验证：

1. master/slave 注册
2. peer 上下线
3. 远程命令
4. slice 同步
5. requestStatus 合并

### C. 真实重启恢复验证

采用 `full / seed / verify`：

1. `seed` 写入 `topologyProfile`
2. `verify` 新进程恢复并验证连接策略
3. 明确断言“哪些状态该恢复，哪些不该恢复”

这一步必须在包本体完成，不能只靠 `ui-runtime` 间接替它验证。

## 10. 如果是我来落地，我会怎么分阶段做

我不会一次性推翻它，因为它的下游面太广。

我会分四阶段：

### 第一阶段：先补事实正确性

先修明显缺陷：

1. `selectSlaveConnected`
2. `setDisplayToSecondary`
3. `slaveStatus` 类型缺口
4. package 自身 dev harness

### 第二阶段：把 contract 显式化，但先不改消费方

1. 引入 sync adapter registry
2. 引入显式 routing context
3. 保留旧 converter 作为 compatibility layer

### 第三阶段：抽离通用 context-state helper

把：

1. `createWorkspaceSlice`
2. `toModuleSliceConfigs`
3. `createInstanceModeSlice`

抽成独立基础设施层，解除“所有使用 workspace slice 的包都必须依赖 interconnection”的结构性耦合。

### 第四阶段：收缩 interconnection 对外 API

最终对外只保留：

1. topology commands/selectors
2. transport status/selectors
3. sync registration API
4. request ledger API

而不是今天这种“从枚举到 slice helper 到 adapter 接口到 runtime actor 全都从一个包导出”的模式。

## 11. 最终判断

我对这个包的总体判断是：

1. 产品思路是对的
2. 平台思路也是对的
3. 但结构已经长成了“关键基础设施大包”

它不适合被简单评价成“设计好/不好”。

更准确的评价应该是：

1. 它定义了当前仓库最重要的一套运行时语义
2. 这套语义让大量业务包得以快速协同
3. 但它把太多横切关注点压到了一个包里
4. 未来如果继续扩展，不先做结构重整，维护成本会越来越高

如果让我继承它的设计思路重新做，我不会推翻它的核心哲学：

1. 主副拓扑是一等公民
2. 状态同步按 slice 声明
3. 命令仍然是系统主语
4. 请求观测必须跨端统一

我会做的是把这些正确思想，从“依赖隐式约定和单体大包支撑”重构成“职责清晰、契约显式、验证完备的运行时底座”。
