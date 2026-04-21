# Topology Standalone Slave And Persistence Design

日期：2026-04-18

状态：设计待确认，尚未进入实施计划和代码修改。

## 1. 背景

当前 `4-assembly/android/mixc-retail-assembly-rn84` 已经具备新的 RN84 assembly、`topology-runtime-v2`、Android topology host、UI 自动化 runtime 与 admin-console 基础能力。

但新工程在主副屏、独立副机、状态持久化、外部 master 接入这几类语义上还没有完整对齐旧工程：

1. 内建副屏不应读取或写入本地业务 stateStorage。
2. 独立单屏 slave 即使切到 secondary display，也仍然是 standalone 设备，必须保留本地持久化。
3. 单屏设备 B 可以作为 standalone slave 连接另一台单屏 master 设备 A。
4. standalone slave 连接 master 后，通电源状态变化可以触发 primary / secondary display 切换。
5. Product 环境可以编入相关能力，但不应默认启动自动化 socket、topology 调试入口或额外后台资源。

本设计用于确认这些语义如何在新工程中落地。确认后再单独编写实施计划，再开始改代码。

## 2. 已核对的旧工程语义

### 2.1 standalone 初始规则

旧工程通过 `displayIndex === 0` 推导 standalone：

参考：`1-kernel/1.1-cores/interconnection/src/foundations/preInitiateInstanceInfo.ts`

关键语义：

1. `displayIndex === 0` 初始为 standalone。
2. standalone 初始为 master / primary。
3. `displayIndex > 0` 初始为 slave / secondary。
4. 内建双屏场景中，secondary 默认不 standalone。

### 2.2 旧工程持久化近似规则

旧工程 `ApplicationManager` 中 persisted slice 只在 `displayIndex === 0` 时落盘：

参考：`1-kernel/1.1-cores/base/src/application/applicationManager.ts`

这在旧架构里等价于：

1. 主屏和单屏设备持久化。
2. 内建副屏不持久化。

但在新工程中不能继续简单使用 `displayIndex` 近似，因为新场景要求：

1. 单屏设备 B 作为 slave 时仍然 `displayIndex=0`。
2. B 即使 displayMode 被切到 `SECONDARY`，也仍然是 `standalone=true`。
3. B 的 state 必须持续本地保存。

因此新工程需要改成明确规则：

> 只有 `displayMode === "SECONDARY" && standalone === false` 禁止本地 stateStorage。

### 2.3 旧工程电源触发切屏规则

旧工程只对 standalone slave 响应电源状态变化：

参考：`1-kernel/1.1-cores/interconnection/src/features/actors/initialize.ts`

规则：

1. `standalone && instanceMode === SLAVE && powerConnected && displayMode === PRIMARY`
   - 建议切到 secondary display。
2. `standalone && instanceMode === SLAVE && !powerConnected && displayMode === SECONDARY`
   - 建议切回 primary display。

这个逻辑不适用于 managed secondary，也不适用于所有 slave。

### 2.4 旧工程独立副机连接 master 流程

旧 admin 里独立副机连接 master 的流程是：

参考：`2-ui/2.1-cores/admin/src/hooks/useSwitchInstanceMode.ts`

1. 切换本机为 slave。
2. 扫码或输入 masterInfo。
3. 写入 masterInfo。
4. 调用 startConnection。

新工程当前 admin-console 只具备最基础的 mode / connection 按钮，尚未提供完整 masterInfo 录入、清空、分享、ticket 申请和外部 master 接入能力。

## 2.5 已核对的新 kernel 兼容事实

### 2.5.1 `deriveTopologyStandalone` 与单屏 slave 语义并不冲突

当前 `topology-runtime-v2` 的 `deriveTopologyStandalone` 优先使用 `displayIndex`：

参考：`1-kernel/1.1-base/topology-runtime-v2/src/foundations/context.ts`

这意味着：

1. 只要 runtime 的 `displayIndex === 0`，`standalone` 就会保持为 `true`。
2. 单屏设备 B 即使切成 `instanceMode=SLAVE`，只要仍是同一个单屏 runtime，`displayIndex` 仍为 `0`，因此 `standalone` 仍为 `true`。
3. B 再切到 `displayMode=SECONDARY` 时，`standalone` 也仍然可以保持为 `true`。

因此本设计不需要为了“单屏 slave 仍为 standalone”去修改 kernel 的 `deriveTopologyStandalone` 逻辑。

### 2.5.2 `setDisplayMode` command 已存在

当前 `topology-runtime-v2` 已有：

1. `setDisplayMode`
2. `setInstanceMode`
3. `setEnableSlave`
4. `setMasterInfo`
5. `clearMasterInfo`
6. `startTopologyConnection`
7. `restartTopologyConnection`

参考：`1-kernel/1.1-base/topology-runtime-v2/src/features/commands/index.ts`  
参考：`1-kernel/1.1-base/topology-runtime-v2/src/features/actors/contextActor.ts`

因此本轮的 display switch 和 topology admin 扩展不需要为这些 command 额外修改 kernel。

### 2.5.3 `masterNodeId` 已存在于 assembly launch，不存在于 kernel `masterInfo`

需要区分两类模型：

1. `AssemblyTopologyLaunchOptions`
   - 当前已有 `masterNodeId`
   - 用于 assembly launch / native prepareLaunch
2. `TopologyV2MasterInfo`
   - 当前只有 `deviceId/serverAddress/addedAt`
   - 不包含 `masterNodeId`

因此本设计中“需要在 assembly/admin 扩展 `masterInfo` 以携带 `masterNodeId`”这个结论仍然成立，只是不能把 launch model 和 recovery model 混为一谈。

## 3. 新工程当前缺口

### 3.1 assembly stateStorage 无 topology-aware gate

当前 `createAssemblyPlatformPorts` 无条件注入 MMKV-backed storage：

参考：`4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`

当前 `createAssemblyStateStorage` 只按 namespace 创建原生 storage：

参考：`4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/stateStorage.ts`

缺口：

1. managed secondary 会直接读写 MMKV。
2. admin-console 诊断和清缓存也会绕过 topology 语义。
3. 不能表达“只有 `secondary && standalone=false` 禁止 storage”的精确规则。

### 3.2 assembly topology binding 是启动时静态的

当前 `createAssemblyTopologyInput` 从 `props.topology` 静态创建 socket runtime / profile / hello：

参考：`4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`

缺口：

1. 单屏设备启动时通常没有外部 master 的 ticket。
2. 用户后续在 admin-console 输入 masterInfo 后，当前 binding 不会自动更新。
3. `createHello` 使用启动时的 `ticketToken`，不能使用运行时新申请的 ticket。

### 3.3 `resolveTopologyLaunch` 只覆盖内建双屏启动

当前 `resolveAssemblyTopologyLaunch` 只负责 `displayCount > 1` 时的 native launch props 补齐：

参考：`4-assembly/android/mixc-retail-assembly-rn84/src/application/resolveTopologyLaunch.ts`

缺口：

1. 单屏 slave 连接外部 master 不是 launch-time 能解决的。
2. 外部 master 接入需要运行时从 admin / automation 触发。

### 3.4 admin-console topology 操作不足

当前 `AdminTopologySection` 只展示状态，并提供：

1. 切 master。
2. 切 slave。
3. 启动连接。
4. 重启连接。

参考：`2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`

缺口：

1. 不能录入 masterInfo。
2. 不能清空 masterInfo。
3. 不能生成 master 分享信息。
4. 不能申请 ticket。
5. 不能切 primary / secondary display。
6. 不能启用 / 禁用 slave 能力。

### 3.5 host ticket 已存在但缺少上层编排

Android topology host 已提供 `POST /tickets`：

参考：`3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Server.kt`

请求要求：

1. `masterNodeId` 必填。
2. 可选 `transportUrls`。
3. 可选 `expiresInMs`。

返回：

1. `token`
2. `sessionId`
3. `expiresAt`
4. `transportUrls`

缺口：

1. admin / assembly 还没有用它完成 standalone slave runtime attach。
2. `TopologyV2MasterInfo` 当前没有 `masterNodeId` 字段。

## 4. 目标

### 4.1 功能目标

1. 精确实现 managed secondary 不读写本地 stateStorage。
2. 保证 standalone slave 永远保留本地 stateStorage。
3. 支持单屏 slave 连接外部 master。
4. 支持 standalone slave primary / secondary display 切换。
5. 支持 powerConnected 触发 standalone slave displayMode 切换。
6. admin-console 成为人工调试和自动化测试的统一 topology 控制入口。
7. 支持后续 UI 自动化脚本通过该入口完成 activation 到 deactivation 的完整业务流程验证。

### 4.2 约束目标

1. 尽量不改 kernel。
2. 不把 topology 语义散落到业务 UI 包。
3. 不新增重量级 service / manager 抽象。
4. 不让 Product 环境默认启动自动化或调试资源。
5. 不破坏现有内建双屏 launch 流程。

## 5. 非目标

本轮不做：

1. 不重构 `topology-runtime-v2` 的整体 state model。
2. 不把 `TopologyV2MasterInfo` 强行大改为新协议对象。
3. 不引入新的 Android 原生页面自动化能力。
4. 不新增复杂二维码平台抽象。
5. 不改变 UI 自动化 runtime 的主协议设计。
6. 不迁移全部业务流程测试，除非本轮能力已经验证闭环后进入单独测试迁移计划。

## 6. 核心规则

### 6.1 持久化 gate

唯一禁用本地 stateStorage 的条件：

```ts
displayMode === 'SECONDARY' && standalone === false
```

行为：

1. `getItem` 返回 `null`。
2. `getAllKeys` 返回 `[]`。
3. `setItem` / `removeItem` / `clear` / `multiSet` no-op。
4. secure-state 与普通 state 遵守同一 gate，除非后续有明确反例。

非禁用场景：

1. `MASTER + standalone=true`
2. `SLAVE + standalone=true + PRIMARY`
3. `SLAVE + standalone=true + SECONDARY`
4. `MASTER + standalone=false`，如果未来出现，先不特殊处理。

说明：

1. 这里依赖的是 topology context 中最终可读的 `standalone/displayMode`，不是对 `instanceMode` 做额外近似推导。
2. 对单屏 slave 设备，因为其 `displayIndex===0`，当前 kernel context 仍可维持 `standalone=true`，所以不会误命中禁用条件。

### 6.2 standalone 含义

`standalone` 表示本机是否独立运行，而不是是否处于 master/slave 模式。

因此：

1. 单屏设备 A 默认 `standalone=true`。
2. 单屏设备 B 默认 `standalone=true`。
3. B 切成 slave 连接 A 后，B 仍然 `standalone=true`。
4. B 通电后切到 secondary display，B 仍然 `standalone=true`。
5. 内建副屏是 `standalone=false`。

### 6.3 displayMode 切换

第一版采用直接切换，不做确认弹窗：

1. `standalone && SLAVE && powerConnected && PRIMARY`
   - 直接 dispatch `setDisplayMode({displayMode:'SECONDARY'})`
2. `standalone && SLAVE && !powerConnected && SECONDARY`
   - 直接 dispatch `setDisplayMode({displayMode:'PRIMARY'})`

后续如需恢复旧工程确认弹窗体验，再单独补 UI confirmation，不影响本轮底层能力。

### 6.4 外部 master 接入

单屏 slave 连接外部 master 时：

1. 不依赖 launch-time `props.topology`。
2. 由 admin-console 或 automation 脚本在运行时导入 master 信息。
3. assembly 根据 master 信息请求 fresh ticket。
4. assembly 更新动态 topology binding。
5. runtime 执行 start / restart connection。

### 6.5 `enableSlave` 的语义

`enableSlave` 只表示：

> 当前设备在 `instanceMode=MASTER` 时，是否允许外部或本机 slave 接入。

因此：

1. A 作为 master 接受 B 连接前，应先 `enableSlave=true`。
2. B 作为 slave 主动连 A 时，本机的 `enableSlave` 对 outbound connect 不构成前置条件。
3. admin-console 中的“启用副机能力”按钮，表示“允许当前设备作为 master 接受 slave”，不是“允许当前设备作为 slave 连接别人”。

## 7. 场景矩阵

| 场景 | displayIndex | instanceMode | displayMode | standalone | stateStorage | 连接方式 |
| --- | --- | --- | --- | --- | --- | --- |
| 单屏 master A | 0 | MASTER | PRIMARY | true | 启用 | 可启动 host |
| 单屏 slave B primary | 0 | SLAVE | PRIMARY | true | 启用 | 连接外部 A |
| 单屏 slave B secondary | 0 | SLAVE | SECONDARY | true | 启用 | 连接外部 A |
| 内建主屏 | 0 | MASTER | PRIMARY | true | 启用 | 本机 loopback host |
| 内建副屏 | >0 | SLAVE | SECONDARY | false | 禁用 | 本机 loopback host |

说明：

1. 这里描述的是目标语义，也是当前 kernel context 在 `displayIndex=0` 单屏 runtime 下可以成立的状态。
2. 单屏 slave B secondary 不是“内建副屏”，因此不应套用 managed secondary 的持久化禁用规则。

## 8. 设计方案

推荐方案：

> topology-runtime-v2 保持为统一运行时；assembly 提供 topology-aware storage gate、动态 topology binding、外部 master ticket 编排；admin-console 提供统一操作入口。

分层：

1. `2-ui/2.1-base/admin-console`
   - 扩展 topology 管理 UI 与 host action 接口。
2. `4-assembly/android/mixc-retail-assembly-rn84`
   - 实现 storage gate、动态 binding、外部 master 连接、power display switch。
3. `3-adapter/android/adapter-android-v2`
   - 复用现有 topology host HTTP / diagnostics 能力。
4. `1-kernel/1.1-base/topology-runtime-v2`
   - 默认不改；如遇类型或 selector 缺口，仅做小型辅助补充。

## 9. Assembly StateStorage 设计

### 9.1 入口

在 assembly 层新增 topology-aware storage wrapper。

建议形态：

```ts
createAssemblyStateStorage(layer, {
  shouldDisablePersistence?: () => boolean
})
```

`shouldDisablePersistence` 由 assembly runtime 提供，基于最新 topology context 计算：

```ts
context.displayMode === 'SECONDARY' && context.standalone === false
```

这里的 gate 是**动态求值**，不是启动时静态快照。

实现语义应为：

1. storage wrapper 在每次 `getItem/setItem/removeItem/clear/...` 调用时都重新执行 `shouldDisablePersistence()`。
2. 不要求 storage wrapper 自己订阅 topology context。
3. topology context 变化后，下一次 storage 操作自然读取到新的 gate 结果。
4. 启动早期 topology context 尚未完成时，默认按“未禁用”处理，待 context 建立后再按真实 gate 生效。

### 9.2 行为

禁用时：

1. 读操作返回空结果。
2. 写操作 no-op。
3. clear no-op，避免 managed secondary 清掉主屏/本机共享 namespace。

启用时：

1. 透传到真实 MMKV。
2. 保留现有 namespace 规则。

### 9.3 admin-console 直接 storage 操作

`adminConsoleConfig` 中所有直接创建 storage 的地方都必须改为使用同一个 gated storage，避免绕过 gate。

当前已确认的直接入口至少包括：

1. `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
2. `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`

## 10. Dynamic Topology Binding 设计

### 10.1 当前问题

当前 `createAssemblyTopologyInput` 将 `wsUrl`、`ticketToken`、`role` 固定在启动 props 中。

这不适合：

1. 单屏 slave 后续手工配置 master。
2. ticket 过期后刷新。
3. 外部 master 地址变化后重连。

### 10.2 新 binding source

在 assembly 创建一个可变 binding source：

```ts
interface AssemblyTopologyBindingState {
  role: 'master' | 'slave'
  localNodeId: string
  masterNodeId?: string
  ticketToken?: string
  ticketExpiresAt?: number
  wsUrl?: string
  httpBaseUrl?: string
}
```

能力：

1. `get()`
2. `set(next)`
3. `clear()`
4. `hasUsableTicket()`
5. `resolveServer()`

### 10.2.1 与 recovery state 的关系

`AssemblyTopologyBindingState` 与 `TopologyV2RecoveryState` 并存，但职责不同：

1. `TopologyV2RecoveryState`
   - 持久化真相源
   - 保存用户意图和可恢复配置
   - 例如 `instanceMode/displayMode/enableSlave/masterInfo`
2. `AssemblyTopologyBindingState`
   - runtime-only 连接材料
   - 保存当前实际连接所需的易失信息
   - 例如 `ticketToken/ticketExpiresAt/localNodeId/masterNodeId/wsUrl/httpBaseUrl`

同步规则：

1. recovery state 中的 `masterInfo` 是 binding source 的输入之一。
2. binding source 可以从 recovery state 推导基础地址信息，但 fresh ticket 只存在于 binding source，不回写 recovery state。
3. 用户 clear masterInfo 时：
   - 清 recovery state 的 `masterInfo`
   - 清 binding source
   - 停止当前 topology connection
4. 用户仅重启连接时：
   - 不改 recovery state
   - 仅刷新 binding source 内的 ticket。

### 10.3 socket runtime 稳定，server catalog 可替换

`resolveSocketBinding()` 始终返回同一个 socket runtime 和 profile。

连接前：

1. 从 binding source 读取最新 `wsUrl`。
2. 转换为 HTTP baseUrl。
3. 调用 socket runtime `replaceServers()`。

`createHello()`：

1. 从 binding source 读取最新 `ticketToken`。
2. 从 binding source 读取最新 `role/localNodeId`。
3. 如果没有可用 ticket，返回 `undefined` 或抛出明确错误，由连接 precheck 暴露。

`hasUsableTicket()` 规则：

1. 没有 `ticketToken` -> 不可用
2. 没有 `ticketExpiresAt` -> 默认不可用
3. `Date.now() >= ticketExpiresAt - refreshWindowMs` -> 视为不可用

第一版建议 `refreshWindowMs = 15_000`。

### 10.3.1 ticket 刷新策略

第一版不做后台定时刷新，只在连接动作前刷新：

1. `startTopologyConnection`
2. `restartTopologyConnection`
3. auto reconnect 前的 assembly precheck（如果能拦截到）

刷新条件：

1. 没有 ticket
2. ticket 已过期
3. ticket 即将在 `refreshWindowMs` 内过期

这样可以避免后台定时器和额外状态机，同时满足稳定重连。

### 10.4 内建双屏兼容

内建双屏启动时：

1. `resolveAssemblyTopologyLaunch` 仍然补齐 native launch props。
2. assembly 用 launch props 初始化 binding source。
3. 后续逻辑仍走同一动态 binding。

### 10.5 单屏 slave runtime attach

单屏 slave 运行时：

1. 初始 binding source 可以为空。
2. topology module 仍可安装。
3. 用户导入 masterInfo 后，assembly 请求 ticket 并填充 binding source。
4. 再执行 `startTopologyConnection`。

## 11. 外部 Master 接入设计

### 11.1 Master 分享载荷

统一分享载荷：

```json
{
  "formatVersion": "2026.04",
  "deviceId": "MASTER-DEVICE-ID",
  "masterNodeId": "node_android_host_MASTER-DEVICE-ID",
  "wsUrl": "ws://192.168.1.10:8888/mockMasterServer/ws",
  "httpBaseUrl": "http://192.168.1.10:8888/mockMasterServer"
}
```

字段：

1. `deviceId`
   - 展示和业务识别用。
2. `formatVersion`
   - 分享载荷格式版本，不等同于 runtime protocol version。
   - 第一版只做兼容校验，不做复杂协商。
2. `masterNodeId`
   - 申请 ticket 必需。
3. `wsUrl`
   - slave socket 连接地址。
4. `httpBaseUrl`
   - slave 请求 `/tickets` 的 HTTP 地址。

### 11.2 `masterInfo` 扩展策略

第一版不改 kernel 公共类型。

assembly/admin 内部使用兼容扩展：

```ts
type AssemblyTopologyMasterInfo = TopologyV2MasterInfo & {
  masterNodeId?: string
  httpBaseUrl?: string
}
```

原因：

1. `TopologyV2MasterInfo` 当前只含 `deviceId/serverAddress/addedAt`。
2. recovery reducer 会整体保留 `masterInfo` 对象。
3. 先避免扩大 kernel 类型影响面。

### 11.3 Ticket 申请

由 TS / assembly 直接调用 master host：

```http
POST {httpBaseUrl}/tickets
Content-Type: application/json

{
  "masterNodeId": "node_android_host_MASTER-DEVICE-ID"
}
```

不新增原生 `issueTicket` TurboModule。

原因：

1. Android host 已经有 HTTP endpoint。
2. mock host 与 Android host 协议一致。
3. 直接调用更接近真实外部 slave 接入场景。
4. 避免把远端 master ticket 申请伪装成本机原生能力。

### 11.4 Slave 连接流程

输入 master share payload 后：

1. 校验 `deviceId/masterNodeId/wsUrl/httpBaseUrl`。
2. dispatch `setInstanceMode({instanceMode:'SLAVE'})`。
3. dispatch `setMasterInfo({masterInfo})`。
4. 请求 `POST /tickets`。
5. 更新 dynamic binding source。
6. dispatch `restartTopologyConnection`。

失败处理：

1. 缺 `masterNodeId`：不请求 ticket，直接返回可读错误。
2. `/tickets` 失败：保留 masterInfo，但连接状态显示错误。
3. ticket 成功但 WS 失败：保留 masterInfo 和 binding source，允许重试。
4. 用户 clear masterInfo：停止连接，清 binding source，清 recovery masterInfo。

## 12. Admin Console 设计

### 12.1 UI 分区

`AdminTopologySection` 扩展为四个块：

1. 实例状态
   - instanceMode
   - displayMode
   - standalone
   - workspace
   - enableSlave
   - connection status
2. 模式与显示
   - 切 master
   - 切 slave
   - 切 primary
   - 切 secondary
   - enable slave
   - disable slave
3. 主机信息
   - 当前 masterInfo
   - 手工输入/编辑 masterInfo
   - 导入分享 JSON
   - 清空 masterInfo
4. 连接控制
   - start
   - restart
   - stop
   - master host status
   - master share payload

### 12.2 Host action 接口

在 admin-console module input 中增加可选 topology host actions。

建议接口：

```ts
interface AdminTopologyHostSource {
  getSharePayload?(): Promise<AdminTopologySharePayload | null>
  importSharePayload?(payload: AdminTopologySharePayload): Promise<void>
  clearMasterInfo?(): Promise<void>
  requestTicketAndConnect?(): Promise<void>
  getTopologyHostStatus?(): Promise<Record<string, unknown> | null>
}
```

UI 仍通过 runtime command 读写标准 topology state；host action 只处理 assembly-specific 动作，例如：

1. 生成分享 payload。
2. 导入 payload。
3. 请求 ticket 并更新 dynamic binding。
4. 读取原生 host 诊断信息。

不放入 host action 的能力：

1. `setInstanceMode`
2. `setDisplayMode`
3. `setEnableSlave`
4. `startTopologyConnection`
5. `restartTopologyConnection`
6. `stopTopologyConnection`

这些仍然优先走 runtime command，避免 host action 与标准 runtime command 边界重叠。

### 12.3 不污染其他包

admin-console 只定义可选接口。

没有 assembly host source 时：

1. 显示标准 topology state。
2. 保留基础 runtime command 按钮。
3. 隐藏或禁用外部 master 连接相关按钮。

## 13. Power Display Switch 设计

### 13.1 触发条件

assembly 监听 native power status change。

仅当以下条件同时满足时处理：

```ts
context.standalone === true
context.instanceMode === 'SLAVE'
```

### 13.2 切换规则

1. `powerConnected === true && displayMode === 'PRIMARY'`
   - dispatch `setDisplayMode({displayMode:'SECONDARY'})`
2. `powerConnected === false && displayMode === 'SECONDARY'`
   - dispatch `setDisplayMode({displayMode:'PRIMARY'})`

### 13.3 第一版交互

第一版直接切换，不做确认弹窗。

理由：

1. 自动化测试需要可预测、可脚本化。
2. 旧确认弹窗属于 UX 体验，不是底层拓扑能力。
3. 后续可在 UI 层增加确认开关，不影响底层命令。

## 14. Product 环境约束

### 14.1 自动化 runtime

Product 环境：

1. 不启动 automation socket。
2. 不注册 automation targets。
3. 不启动事件订阅、trace buffer、semantic registry 额外后台监听。
4. `scripts.execute` 即使误调用也必须返回不可用。

### 14.2 topology / stateStorage

Product 环境仍可以使用 topology 和 stateStorage 正常业务能力。

Product 不禁用：

1. 内建双屏 topology。
2. 正常业务 state 持久化。
3. standalone slave 的本地持久化。

Product 仅不启动 UI 自动化调试控制面。

## 15. 测试设计

### 15.1 stateStorage gate 单元测试

覆盖矩阵：

1. `MASTER + standalone=true + PRIMARY`
   - storage 读写正常。
2. `SLAVE + standalone=true + PRIMARY`
   - storage 读写正常。
3. `SLAVE + standalone=true + SECONDARY`
   - storage 读写正常。
4. `SLAVE + standalone=false + SECONDARY`
   - storage get 返回 null，write no-op。

断言：

1. 禁用场景不会写入底层 MMKV mock。
2. 禁用场景 clear 不会清掉底层已有值。
3. standalone slave secondary 不会被误禁用。

### 15.2 dynamic topology binding 测试

覆盖：

1. 启动 props 初始化 binding。
2. 运行时导入新 master 后替换 server catalog。
3. `createHello` 使用新 ticket。
4. ticket 缺失时 start connection 返回明确失败。

### 15.3 admin-console 测试

覆盖：

1. 显示 standalone / displayMode / workspace。
2. 点击切 slave 发出正确 command。
3. 点击切 primary / secondary 发出正确 command。
4. 导入 master share payload 调用 host action。
5. 清空 masterInfo 调用 host action。
6. host action 不存在时，外部 master 操作禁用或隐藏。

### 15.4 assembly 外部 master 流程测试

用 mock host 或 Android host compatible mock 验证：

1. A 启动 host。
2. A 生成 share payload。
3. B 导入 share payload。
4. B 请求 `/tickets`。
5. B 更新 binding。
6. B 启动 topology connection。
7. B 的 standalone stateStorage 仍然启用。

### 15.5 power display switch 测试

覆盖：

1. standalone slave primary + powerConnected -> secondary。
2. standalone slave secondary + powerDisconnected -> primary。
3. managed secondary power change 不触发。
4. master power change 不触发。
5. standalone slave 切屏后 storage gate 仍保持启用。

## 16. 实施边界建议

确认本设计后，实施计划建议拆成 6 个阶段：

1. storage gate 与测试。
2. dynamic topology binding 与测试。
3. external master ticket flow 与测试。
4. admin-console topology UI/action 扩展与测试。
5. power display switch 与测试。
6. assembly 端到端验证与文档/记忆更新。

每阶段都应先补测试，再实现，再运行针对性验证。

建议的阶段验收边界：

1. 阶段 1 完成后
   - 可以独立验证 managed secondary 不再读写本地 storage。
2. 阶段 2 完成后
   - 可以独立验证内建双屏和运行时 binding 更新不需要重建 runtime。
3. 阶段 3 完成后
   - 可以独立验证单屏 slave 导入 master 后可申请 ticket 并重连。
4. 阶段 4 完成后
   - 可以独立通过 admin-console 手工完成外部 master 接入。
5. 阶段 5 完成后
   - 可以独立验证 standalone slave 的 power display switch。
6. 阶段 6 完成后
   - 再做 assembly 端到端业务链路验证和规范沉淀。

## 17. 风险

### 17.1 `masterNodeId` 暂不进 kernel type

风险：

1. TypeScript 类型上需要 assembly/admin 使用扩展类型。
2. 后续如果多处都依赖 `masterNodeId`，可能需要正式提升到 kernel type。

当前判断：

1. 第一版先不扩大 kernel 影响面。
2. 保留后续升级空间。

### 17.2 dynamic binding 与 orchestrator 生命周期

风险：

1. topology orchestrator install 时会创建 binding。
2. 如果 binding 初始为空，需要保证后续可更新后再连接。

缓解：

1. socket runtime/profile 对象启动时即可创建。
2. server catalog 和 hello 内容运行时读取 binding source。
3. start connection 前做 precheck。

### 17.3 直接 power 切屏可能影响人工体验

风险：

1. 用户可能希望看到确认弹窗。

当前判断：

1. 本轮优先自动化与真机可操作性。
2. 确认弹窗可作为后续 UI 增强。

## 18. Implementation Notes

本轮实现遵守原设计边界：不扩大 `topology-runtime-v2` 公共模型，尽量把产品拓扑语义留在 assembly/admin 边界。

实际落地：

1. `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyStorageGate.ts`
   - 精确实现 `displayMode === 'SECONDARY' && standalone === false` 时禁用 stateStorage。
2. `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyBinding.ts`
   - 使用动态 binding source，让 socket runtime/profile 保持稳定，server catalog / hello 从最新 binding 读取。
3. `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologySharePayload.ts`
   - assembly/admin 层扩展 `masterNodeId` 与 `httpBaseUrl`，不修改 kernel `TopologyV2MasterInfo` 公共类型。
4. `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyExternalMaster.ts`
   - standalone slave 直接调用 master host HTTP `POST /tickets` 获取新 ticket。
5. `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyPowerDisplaySwitch.ts`
   - standalone slave 根据 `powerConnected` 直接切换 `PRIMARY` / `SECONDARY`，第一版不做确认弹窗。
6. `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
   - admin-console host action 负责 share payload、导入 payload、清空 masterInfo、申请 ticket 并重启连接。
7. `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
   - assembly 持有动态 topology binding source、latest topology context snapshot 与 runtime ref，并传给 stateStorage gate、topology input、admin-console。
8. `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
   - 安装 power status listener，并复用纯 helper 处理 standalone slave 切屏。
9. `2-ui/2.1-base/admin-console/src/types/admin.ts` 与 `AdminTopologySection.tsx`
   - admin-console 只定义可选 topology host action；标准 `setInstanceMode` / `setDisplayMode` / `setEnableSlave` 仍走 runtime command。

验证命令：

1. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-state-storage.spec.ts test/scenarios/assembly-topology-input.spec.ts test/scenarios/assembly-standalone-slave-topology.spec.ts test/scenarios/assembly-power-display-switch.spec.ts test/scenarios/assembly-create-app.spec.ts`
2. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-admin-console-automation.spec.tsx`
3. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-runtime-module.spec.ts`
4. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`
5. `corepack yarn workspace @impos2/ui-base-admin-console test test/scenarios/admin-real-sections.spec.tsx`
6. `corepack yarn workspace @impos2/ui-base-admin-console type-check`

剩余边界：

1. `masterNodeId` 暂不提升进 kernel 公共类型；如果未来多包都需要读写该字段，再做一次小型 kernel type 升级。
2. display switch 当前是直接切换；确认弹窗属于后续 UX 增强，不影响自动化底层能力。
3. 本轮验证是 TS/assembly 自动化与单元/场景测试；真实两台 Android 设备 A/B 外部 master 接入仍需要单独实机验收。
