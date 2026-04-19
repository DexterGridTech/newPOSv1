# UI Automation Runtime Design

日期：2026-04-18

## 1. 背景与目标

当前仓库已经形成新的 kernel / ui / adapter / assembly 分层：

1. `1-kernel/1.1-base` 提供 runtime-shell、state-runtime、ui-runtime、workflow-runtime、transport 等基础能力。
2. `2-ui/2.1-base` 提供 UI 基础运行时与基础控制台能力，例如 `runtime-react`、`input-runtime`、`terminal-console`、`admin-console`。
3. `3-adapter/android/adapter-android-v2` 是新的 Android 原生适配层。
4. `4-assembly/android/mixc-retail-assembly-rn84` 是新的 Android RN84 组装层，当前已具备双屏、双进程、TurboModule、真实激活链路与原生 MMKV 等能力。

现阶段需要建立一套统一的 UI 自动化与运行时调试控制面，用于覆盖以下场景：

1. 在 Android 设备上，通过 `adb` 与 App 双向通讯，驱动复杂自动化流程并读取运行时数据。
2. 在 Web / Expo 测试环境中，用尽量一致的协议与调用方式完成 UI 包自动化测试。
3. 统一支撑后续 `2-ui` 基础包与 `4-assembly` 集成包的自动化测试，不再长期依赖分散脚本、坐标点击和临时调试入口。
4. 为运行时调试提供稳定的读取 state / request / current screen / UI 语义树 / trace 的能力，方便开发联调。

本设计的目标不是做一个通用的 agent 平台，也不是做重量级测试框架，而是在现有架构上新增一套边界清晰、默认不启动、协议统一、宿主可适配、足够完成绝大多数 UI 自动化和运行时调试任务的基础设施。

## 2. 关键约束

### 2.1 环境与启停约束

1. 整套自动化能力在 Product 环境不启动。
2. Product 环境可以编入相关代码，但默认不创建 runtime registry、不启动 socket / ws server、不注册自动化 target、不保留 trace / snapshot listener。
3. Debug / internal / test 场景下，通过 assembly 或 test helper 显式调用启动入口后才开始工作。

### 2.2 架构边界约束

1. UI 自动化 TS 控制面统一沉淀到 `2-ui/2.1-base` 下的新包中，不污染其他 UI 业务包。
2. Android 原生通讯逻辑放在 `3-adapter/android/adapter-android-v2`。
3. `4-assembly/android/mixc-retail-assembly-rn84` 只负责桥接和装配，不承载大量自动化语义逻辑。
4. 尽量不修改 kernel 包。如果必须修改，只允许做小而明确的辅助能力补充，例如帮助通过稳定字符串查询 command definition、读取 request、或暴露必要 selector / facade；任何修改都必须严格遵守包职责。

### 2.3 技术约束

1. Android 侧通讯只通过本机 `localhost` + `adb forward/reverse` 接入，不走局域网暴露。
2. Android 原生适配层不负责原生 Android 页面自动化控制；它只负责 ADB 与 TS 控制面的通讯，以及脚本执行等宿主能力桥接。
3. UI 自动化主路径采用语义节点查询与动作执行，不以坐标点击为主。
4. 允许保留动态脚本执行能力，但该能力不由 TS runtime 直接 `eval`；统一走适配器接口：
   1. Android 由原生脚本引擎执行；
   2. Web / Expo 由 browser / helper 侧实现；
   3. 脚本执行是 escape hatch，不是主自动化路径。

## 3. 方案概览

推荐方案为：

1. 在 `2-ui/2.1-base` 新增包 `ui-automation-runtime`，承接所有 TS 侧自动化与调试控制能力。
2. 在 `3-adapter/android/adapter-android-v2` 提供 Android 本地 socket server 与宿主脚本执行后端。
3. 在 `4-assembly/android/mixc-retail-assembly-rn84` 中将双屏 runtime、Android host 通讯层和 `ui-automation-runtime` 装配起来。
4. Web / Expo 测试环境通过 `test-expo` / `test` helper 起一个轻量 WebSocket host，将浏览器中的 automation runtime 与 Node 测试脚本接起来。

推荐原则：

1. TS-heavy：自动化语义、查询、事件、等待、调试能力都在 TS 包中闭环。
2. Android adapter 只做 transport / host bridge / script backend，不做业务语义。
3. 统一协议，不统一 transport 实现：
   1. Android：adb + local socket；
   2. Web / Expo：WebSocket + test helper。
4. 统一 client API，尽量让调用方不关心宿主差异。

## 4. 包职责与目录结构

### 4.1 `2-ui/2.1-base/ui-automation-runtime`

#### 职责

该包是整个 UI 自动化与运行时调试控制面的唯一 TS 入口，负责：

1. 定义统一协议 contract。
2. 维护 runtime target registry。
3. 提供 query / action / wait / event / trace 能力。
4. 提供 client API，供 Node 测试脚本、未来 CLI、调试工具、浏览器 helper 复用。
5. 定义宿主适配器接口，包括脚本执行接口。
6. 提供 Web / Expo 下的 host helper 与 transport glue。
7. 默认 inert，不自动启动。

#### 目录结构原则

该包保持与 `2-ui/2.1-base` 其他兄弟包一致的外层结构，即：

1. `src/application`
2. `src/foundations`
3. `src/supports`
4. `src/types`
5. `src/index.ts`
6. `src/moduleName.ts`
7. `test`
8. `test-expo`

不强制一开始就具备 `contexts/hooks/ui`，除非后续确实出现 React 侧 Provider / hook 的明确需求。

#### 建议文件布局

1. `src/application/createModule.ts`
2. `src/application/moduleManifest.ts`
3. `src/application/createAutomationRuntime.ts`
4. `src/application/index.ts`
5. `src/foundations/protocol.ts`
6. `src/foundations/targetRegistry.ts`
7. `src/foundations/queryEngine.ts`
8. `src/foundations/actionExecutor.ts`
9. `src/foundations/waitEngine.ts`
10. `src/foundations/eventBus.ts`
11. `src/foundations/automationTrace.ts`
12. `src/supports/scriptExecutorAdapter.ts`
13. `src/supports/browserAutomationHost.ts`
14. `src/supports/webSocketAutomationHost.ts`
15. `src/supports/nodeSelectors.ts`
16. `src/types/protocol.ts`
17. `src/types/runtime.ts`
18. `src/types/actions.ts`
19. `src/types/selectors.ts`
20. `src/types/events.ts`

### 4.2 `3-adapter/android/adapter-android-v2`

#### 职责

该层只负责 Android 原生通讯与宿主后端桥接：

1. 启动本机 `localhost` socket server。
2. 通过 `adb forward/reverse` 提供宿主机接入能力。
3. 维护连接会话、消息收发、心跳、断线清理。
4. 负责将消息桥接给 assembly / TS automation runtime。
5. 提供统一脚本执行后端桥接，复用现有脚本执行能力。

#### 非职责

1. 不负责 Android 原生页面自动化。
2. 不负责业务 command / state / UI 语义解析。
3. 不承担 assembly 逻辑和双屏业务路由。

#### 建议布局

在 `adapter-lib` 内增量增加 `automation` 相关目录，例如：

1. `automation/AutomationSocketServer.kt`
2. `automation/AutomationSession.kt`
3. `automation/AutomationMessageCodec.kt`
4. `automation/AutomationHostBridge.kt`
5. `automation/AutomationScriptExecutorBridge.kt`

### 4.3 `4-assembly/android/mixc-retail-assembly-rn84`

#### 职责

assembly 只负责三件事：

1. 启动后根据环境决定是否启动 automation runtime。
2. 将主屏与副屏 runtime 注册为 `primary` / `secondary` target。
3. 将 Android host bridge 与 `ui-automation-runtime` 接起来。

#### 非职责

1. 不实现复杂 query / action / wait 逻辑。
2. 不重新定义协议。
3. 不承载测试 helper 逻辑。

#### 装配建议

建议在 assembly 中增加 `src/application/automation/` 作为装配收口点，并在合适时机完成：

1. 创建 automation runtime 实例。
2. 连接 native transport / host adapter。
3. 注册主屏 runtime target。
4. 注册副屏 runtime target。
5. 在 Product 环境默认不调用启动入口。

## 5. 协议模型

### 5.1 传输模型

统一采用薄 `JSON-RPC 2.0 + event stream` 协议。

消息类型分为：

1. request
2. response
3. event

所有 transport 只负责传输同一套协议消息：

1. Android：socket + adb
2. Web / Expo：WebSocket + test helper

### 5.1.1 连接握手与协议版本

为了避免 client / server 迭代不同步导致的误调用，连接建立后必须先完成一次握手。

第一版增加：

1. `session.hello`

调用方式：

1. client 建连后首先调用 `session.hello`
2. server 返回：
   1. `protocolVersion`
   2. `capabilities`
   3. `availableTargets`
   4. `buildProfile`
   5. `productMode`
   6. `scriptExecutionAvailable`

规则：

1. `session.hello` 失败时，client 不应继续调用其他方法。
2. `runtime.getInfo` 也应返回 `protocolVersion`，便于调试与日志取证。
3. 第一版不做复杂多版本协商；server 只返回自己支持的协议版本，client 负责判断是否兼容。

### 5.2 Target 模型

协议中的 target 显式区分：

1. `primary`
2. `secondary`
3. `host`
4. `all`

语义说明：

1. `primary` / `secondary` 对应双 Activity / 双进程 / 双 JS runtime。
2. `host` 对应宿主级能力，例如 transport、脚本执行、设备信息、连接状态。
3. `all` 仅用于广播式只读查询或事件订阅。

补充规则：

1. `all` 不允许用于 `command.dispatch`、`scripts.execute` 或其他有副作用的方法。
2. `all` 不允许用于所有 `wait.*` 方法，避免双屏聚合语义歧义。
3. 如果调用方需要“等待主副屏都满足条件”，应在 client 侧显式组合两个 wait，而不是依赖 server 端隐式 AND / OR 聚合。

### 5.3 核心方法面

#### Session / Connection

1. `session.hello`

#### Runtime / Query

1. `runtime.getInfo`
2. `runtime.getState`
3. `runtime.selectState`
4. `runtime.listRequests`
5. `runtime.getRequest`
6. `runtime.getCurrentScreen`

#### UI / Automation

1. `ui.getTree`
2. `ui.queryNodes`
3. `ui.getNode`
4. `ui.getFocusedNode`
5. `ui.getBounds`
6. `ui.performAction`
7. `ui.revealNode`
8. `ui.scroll`
9. `ui.setValue`
10. `ui.clearValue`
11. `ui.submit`

#### Runtime control

1. `command.dispatch`

#### Wait / Sync

1. `wait.forNode`
2. `wait.forScreen`
3. `wait.forState`
4. `wait.forRequest`
5. `wait.forIdle`

#### Diagnostics

1. `automation.getLastTrace`
2. `automation.clearTrace`
3. `events.subscribe`
4. `events.unsubscribe`

#### Script execution

1. `scripts.execute`

### 5.4 为什么以 `ui.performAction` 为主而不是 `tapAt`

自动化主路径应优先使用语义节点动作，而不是坐标：

1. Web / Expo 与 Android assembly 才能共享大部分脚本。
2. 动作语义更稳定，例如 `press`、`changeText`、`submit`、`focus`。
3. 节点查询结果可携带 `availableActions`，便于脚本先判断目标是否可操作。

坐标级能力允许保留为兜底，但不应成为第一版主协议的核心能力。

### 5.5 `ui.revealNode` 与 `ui.scroll` 的边界

`ui.revealNode` 的语义是“让目标语义节点进入可交互可见区域”，不是高亮显示。

第一版定义：

1. `ui.revealNode` 接收 node selector 或 nodeId。
2. 如果节点已经可见且可交互，直接返回当前节点快照。
3. 如果节点位于已知滚动容器中，runtime 尝试执行最小滚动让节点进入可见区域。
4. 如果无法推断滚动容器或无法完成 reveal，返回明确错误与当前 trace，不静默降级为坐标点击。

`ui.scroll` 的语义更底层，只表达对指定滚动容器或方向的滚动动作。自动化脚本优先使用 `ui.revealNode`，只有需要精确控制滚动距离或方向时才直接调用 `ui.scroll`。

### 5.6 Assembly 调试与测试工作流约定

对于 `4-assembly/android/mixc-retail-assembly-rn84` 的自动化调试，本设计默认规定一条 canonical 工作流：

1. 优先使用本地 skill `~/.codex/skills/android-assembly-socket-debug`
2. 优先使用 `scripts/android-automation-rpc.mjs` 直接通过 ADB + socket 与 assembly 通讯
3. 优先读取真实 runtime state / request / current screen / semantic UI 节点
4. 优先使用单条 `command.dispatch` 或局部 `ui.performAction` 做问题隔离
5. 最后才是完整可见 UI 自动化脚本

原因：

1. 这条路径比高层脚本更容易 isolate 问题。
2. 这条路径天然支持主屏 / 副屏分别观察。
3. 这条路径天然支持把 UI 现象与 runtime state / request 结果一起验证。

#### 5.6.1 证据优先级

调试时，默认证据优先级如下：

1. socket RPC 读到的真实 runtime 结果
2. targeted TS logs
3. targeted native logs
4. 代码阅读

也就是说：

1. 代码阅读用于缩小范围，不是主要证据。
2. 出现运行时 bug 时，应优先补日志并重跑，而不是长时间停留在推理层面。

#### 5.6.2 时序判断约束

1. 副屏延迟启动约 `3s` 是业务要求。
2. 冷启动 ready 时间与 ready 后的主副屏同步延迟必须分开判断。
3. 当前仓库已经验证：主副屏都 ready 后，主屏 state 变化传播到副屏 state / UI 大约在 `~100ms` 量级。

#### 5.6.3 启动失败处理约束

1. 如果副屏按预期应启动但未启动，应先按 crash / hang 处理。
2. 不应用“手动再拉起副屏”来掩盖启动问题后继续测业务。
3. 若需要后续会话复用，统一通过 `~/.codex/skills/android-assembly-socket-debug` 进入这条工作流，而不是重新临时发明脚本/步骤。

## 6. 选择器与 UI 语义模型

### 6.1 选择器能力

第一版建议支持：

1. `testID`
2. `semanticId`
3. `text`
4. `role`
5. `screen`
6. `path`

查询结果至少返回：

1. `nodeId`
2. `testID`
3. `semanticId`
4. `role`
5. `text`
6. `value`
7. `visible`
8. `enabled`
9. `focused`
10. `bounds`
11. `availableActions`

### 6.2 UI 语义来源

`ui.getTree` 返回的是 automation semantic tree，而不是完整的 React / Fabric / native view tree。

第一版明确不采用以下方案作为主实现路径：

1. 不直接遍历 RN Fabric Shadow Tree。
2. 不依赖 Android Accessibility 作为主数据源。

第一版的主数据源是 TS 侧维护的 semantic registry。该 registry 由 `ui-automation-runtime` 维护，节点来源为：

1. 现有稳定 `testID`
2. `ui-runtime` 当前 screen / overlay / alert 信息
3. 通过 helper / wrapper / hook 显式注册的 host 节点元信息
4. assembly / test helper 明确注册的额外调试节点

节点注册机制建议：

1. 优先在 `runtime-react` root shell、overlay host、alert host、以及 `2-ui/2.1-base` 中已经复用的基础 UI primitive 上挂接注册 helper。
2. 对已有稳定 `testID` 的关键节点，通过 `ref + onLayout + mount/unmount` 维护 registry。
3. `ui.getBounds`、`ui.queryNodes`、`ui.getTree` 均基于 registry，而不是直接从 Fabric 内部结构反射。
4. Web / Expo 场景允许 test helper 额外利用浏览器 DOM / `data-testid` 做补强，但那是 helper 增强，不是跨平台主语义来源。

这意味着第一版的 `ui.getTree` 是“可自动化语义树”，不是“完整渲染树”。它只覆盖：

1. 已注册节点
2. 当前 screen / overlay / alert 上下文
3. 与自动化执行直接相关的语义信息

后续如需引入 Android Accessibility 作为兜底，只能作为 host-side 可选增强，不改变第一版主设计。

原则：

1. 不把自动化代码散落到业务包。
2. 尽量通过公开 selector、公开 command、已有 `testID` 和显式注册扩展完成语义建模。

### 6.3 Semantic registry 生命周期

为了避免 screen 切换后返回已经不存在的幽灵节点，semantic registry 必须显式管理节点生命周期。

第一版规则：

1. registry 按 target 独立维护；`primary` 和 `secondary` 各有自己的 registry，不通过 primary 隐式同步 secondary 节点。
2. 每个注册节点必须带 `target`、`runtimeId`、`screenKey`、`mountId`、`nodeId`。
3. 节点 mount 时注册，unmount 时由注册 helper 清理。
4. 节点 layout 更新时只更新 bounds / visible / enabled 等动态字段，不重新创建稳定语义身份。
5. screen / overlay / alert 上下文变化时，registry 必须清理不属于当前可见上下文且没有显式声明为 persistent 的节点。
6. target disposed 或 runtime 重启时，registry 必须清空该 target 的全部节点，并发出 `runtime.disposed` 或等价事件。

补充策略：

1. registry 可以保留极短暂的 stale grace window 用于处理 React mount/unmount 和 layout 事件顺序，但过期节点不得被 `ui.queryNodes` 返回为可操作节点。
2. `ui.getNode` 如命中 stale 节点，必须返回 `STALE_NODE`，并提示调用方重新 `ui.queryNodes`。
3. `ui.performAction` 在执行前必须重新验证节点仍然 mounted、visible、enabled，并且属于当前 target / screen 上下文。

## 7. 事件与 Trace 模型

### 7.1 事件主题

第一版建议至少支持：

1. `runtime.ready`
2. `runtime.disposed`
3. `runtime.screenChanged`
4. `runtime.stateChanged`
5. `runtime.requestChanged`
6. `automation.completed`
7. `host.connectionChanged`
8. `registry.nodeMounted`
9. `registry.nodeUnmounted`

事件订阅应支持按：

1. `target`
2. `topic`
3. 关键字段 filter

进行过滤，避免双屏场景下事件噪音过大。

订阅生命周期规则：

1. `events.subscribe` 返回 subscription id。
2. `events.unsubscribe` 按 subscription id 取消订阅。
3. session 断开时，server 必须自动清理该 session 下所有订阅。
4. target disposed 时，server 必须停止向该 target 的已失效订阅继续推送节点 / runtime 事件。

### 7.2 Trace

第一版必须记录自动化 trace，至少包含：

1. 查询输入
2. 查询结果
3. 动作输入
4. 动作结果
5. 等待条件
6. 超时 / 失败原因
7. 与该步骤相关的最近 screen / request / state 摘要

trace 用于：

1. 自动化失败排障
2. 联调过程取证
3. 在没有完整截图体系的情况下快速定位错误

### 7.3 Wait 语义

为了避免自动化脚本退化成 `sleep`，wait 系列方法必须有清晰且可验证的语义。

第一版统一规则：

1. 所有 `wait.*` 方法都只接受单 target：`primary`、`secondary`、`host`。
2. 不允许 `target = all`。
3. 每次 wait 都必须有 timeout；未显式传入时使用统一默认值。
4. timeout 时返回最近一次 blocker 摘要，便于 trace 取证。

#### `wait.forIdle`

`wait.forIdle` 的语义定义为：在一个连续 quiet window 内，目标 target 没有新的“自动化相关活动”。

第一版建议 quiet window 默认值：

1. `quietWindowMs = 300`

第一版的 idle 判断维度：

1. 当前 target 没有 in-flight automation action。
2. 当前 target 没有 in-flight `scripts.execute`。
3. 当前 target 的 request ledger 中没有非终态 request。
4. 在 quiet window 内没有新的：
   1. `runtime.stateChanged`
   2. `runtime.screenChanged`
   3. `runtime.requestChanged`

补充说明：

1. `primary` idle 与 `secondary` idle 相互独立。
2. 如果调用方需要等待“双屏都 idle”，应在 client 侧分别等待两个 target。
3. `host` idle 只关注 host 自己的 transport / script execution / session work，不推断 JS runtime 状态。

## 8. 脚本执行适配器

### 8.1 设计原则

允许存在动态脚本执行能力，但该能力不是 TS runtime 内建 `eval`，而是统一走适配器接口：

1. Android：走原生脚本执行引擎
2. Web / Expo：由 test helper / browser host 提供默认实现
3. 调用入口统一为 `scripts.execute`

### 8.2 使用定位

该能力定位为 escape hatch，用于：

1. 补齐少量非标准调试动作
2. 特殊联调阶段快速验证宿主环境
3. 支持已有脚本执行适配体系的复用

该能力不应成为：

1. 主自动化 API
2. 默认断言路径
3. 代替 query / action / wait 的主要机制

### 8.3 运行时边界

第一版不引入 token / session 鉴权，原因是这套能力默认只在 test / debug / internal 场景通过显式启动入口开启。

但 `scripts.execute` 必须有额外运行时 guard：

1. 只有在 `session.hello` 返回 `scriptExecutionAvailable = true` 时，client 才允许调用。
2. Product 模式下，即使代码被编入，只要 automation runtime 未启动，`scripts.execute` 就不可达。
3. 若发生配置错误导致 Product 环境误启动 automation runtime，`scripts.execute` 也必须返回 `METHOD_NOT_AVAILABLE`，不能仅依赖“默认不启动”。
4. `scripts.execute` 的结果和错误都必须进入 trace。

## 9. Web / Expo 运行方式

### 9.1 总体思路

Web / Expo 不直接依赖 Android socket server，而是使用测试目录中的 helper 提供宿主侧 server / bridge。

调用链为：

1. `test-expo/App.tsx` 或 shell 启动后挂载 browser automation runtime。
2. `test-expo/helper` 起 WebSocket host / bridge。
3. Node 测试脚本通过统一 client 连接 helper。
4. helper 将消息转发给浏览器中的 automation runtime。

### 9.2 设计要求

1. helper 代码只存在于 `test-expo` / `test` 目录。
2. 生产 UI 包运行路径不引入 helper。
3. 未来每个 UI base 包的 Expo 自动化都能逐步迁移到这套统一 runtime，而不是长期保留每包自定义 `runAutomation.mjs` 协议。

## 10. Android 运行方式

### 10.1 总体思路

Android 通过 `adb forward` 连接 assembly 内部启动的 localhost socket server。

调用链为：

1. assembly 根据环境决定是否启动 automation runtime。
2. assembly 将 `primary` / `secondary` runtime 注册到 automation runtime。
3. adapter-android-v2 启动 localhost socket server。
4. 宿主机通过 `adb forward tcp:<hostPort> tcp:<devicePort>` 接入。
5. 客户端通过统一 JSON-RPC 调用 Android assembly。

### 10.1.1 真机端口与双进程规则

`mixc-retail-assembly-rn84` 的主屏和副屏运行在两个 Android 进程中，因此 automation socket 不能共用同一个设备端口。

第一版固定端口为：

1. 主屏 `primary`：设备本机 `127.0.0.1:18584`
2. 副屏 `secondary`：设备本机 `127.0.0.1:18585`

宿主机接入规则：

1. automation socket 使用 `adb forward`，方向是宿主机到设备。
2. Metro / mock server / Reactotron 仍使用 `adb reverse`，方向是设备到宿主机。
3. 主副屏 smoke 应分别执行，不通过 `all` 隐式聚合。

推荐命令：

```bash
node scripts/android-automation-rpc.mjs smoke --target primary
node scripts/android-automation-rpc.mjs smoke --target secondary
node scripts/android-automation-rpc.mjs type-virtual ui-base-terminal-activate-device:sandbox sandbox-test-001 --target primary
node scripts/android-automation-rpc.mjs type-virtual ui-base-terminal-activate-device:input ABC123 --target primary
node scripts/android-automation-rpc.mjs activate-device sandbox-test-001 ABC123 --target primary
node scripts/android-automation-rpc.mjs wait-activated sandbox-test-001 --target primary
```

当前真机验收标准：

1. `session.hello` 返回 `protocolVersion`、`availableTargets`、`capabilities`。
2. `runtime.getInfo` 返回正确的 `displayContext` 和 current screen。
3. `ui.getTree` 返回真实 semantic registry 节点。
4. `wait.forIdle` 可以在 target 空闲时成功返回。
5. 至少一个真实 UI action 链路能改变真机 UI，并可通过 `wait.forNode` / `ui.getNode` 读回结果。

### 10.2 Product 语义

Product 环境中：

1. 可以编入 adapter / assembly / ui-automation-runtime 代码。
2. 默认不调用 automation runtime 启动入口。
3. 默认不启动 socket server。
4. 默认不注册 targets。
5. 默认不创建 trace / event / query collector。
6. 默认不暴露 `scripts.execute` capability。

因此 Product 运行时没有自动化进程、常驻 listener 或额外 socket 资源占用。

## 11. 第一版范围

### 11.1 第一版必须交付

1. `runtime.getInfo`
2. `command.dispatch`
3. `runtime.getState`
4. `runtime.selectState`
5. `runtime.listRequests`
6. `runtime.getRequest`
7. `runtime.getCurrentScreen`
8. `ui.getTree`
9. `ui.queryNodes`
10. `ui.getNode`
11. `ui.getFocusedNode`
12. `ui.getBounds`
13. `ui.performAction`
14. `ui.revealNode`
15. `ui.scroll`
16. `ui.setValue`
17. `ui.clearValue`
18. `ui.submit`
19. `wait.forNode`
20. `wait.forScreen`
21. `wait.forState`
22. `wait.forRequest`
23. `wait.forIdle`
24. `events.subscribe`
25. `events.unsubscribe`
26. `automation.getLastTrace`
27. `scripts.execute`

### 11.2 第一版暂不纳入范围

1. 录制回放
2. 图像识别 / OCR
3. 复杂 selector DSL
4. 多设备协同编排
5. 任意 native 对象探测
6. 任意业务私有对象注入
7. 重量级步骤编排语言
8. `debug.invoke`

## 12. Kernel 边界策略

默认策略：

1. 尽量不修改 `1-kernel/1.1-base`。
2. 自动化优先复用已有 runtime facade、selectors、request/state 读取能力。
3. 通过 assembly / ui-automation-runtime 侧的组合与注册完成大部分能力。

如果必须修改 kernel：

1. 只允许补充小而清晰的辅助能力。
2. 必须严格对齐所在包职责。
3. 不允许把自动化逻辑直接下沉到 kernel 基础层。

允许的示例：

1. 通过稳定字符串查询 public command definition 的 helper。
2. 读取 request ledger 的更直接 facade。
3. 暴露现有 screen / overlay / alert 的稳定 selector。

不允许的示例：

1. 在 kernel 包中直接实现 automation protocol。
2. 在 kernel 内长期维护 UI 自动化专用 listener / trace / socket。
3. 将业务私有调试逻辑塞入基础 runtime。

## 13. 分阶段落地计划

### 阶段 1：协议与 TS 内核

范围：

1. 建立 `ui-automation-runtime` 包骨架。
2. 建立 protocol / target registry / query / wait / trace 的 headless 版本。
3. 建立统一 client API。
4. 建立基础测试。

验证：

1. `type-check`
2. `test`
3. headless 场景测试覆盖 target 路由、query、wait、trace

### 阶段 2：Web / Expo helper

范围：

1. 建立 `test-expo` / `test` helper。
2. 跑通 WebSocket transport。
3. 在至少一个 `2-ui/2.1-base` 包中做真实迁移试点。

验证：

1. 保持原有 `test-expo` 能力不退化。
2. 通过新 runtime 跑通同等自动化流程。

### 阶段 3：Android adapter transport

范围：

1. 在 `adapter-android-v2` 加入 localhost socket server。
2. 在 assembly 中接入 native bridge。
3. 跑通主屏 runtime target 通讯。

验证：

1. 真机 / 模拟器 `adb forward` 后可连接。
2. 能查询 runtime info / state / current screen。

### 阶段 4：双屏与脚本执行

范围：

1. 注册 `secondary` target。
2. 接入 unified script executor adapter。
3. 跑通双屏 query / command / wait / trace。

验证：

1. 主副屏能独立查询与控制。
2. 双屏自动化 trace 清晰可读。

### 阶段 5：统一 UI / assembly 自动化试点

范围：

1. 选择一个 `2-ui` 基础包和 `mixc-retail-assembly-rn84` 进行试点迁移。
2. 用这套 runtime 覆盖真实复杂操作 + 结果确认。

验证：

1. 能完成复杂脚本流程。
2. 能读取 request / state / current screen / UI tree。
3. 失败时 trace 足以定位问题。

## 14. 验证策略

每一阶段都必须同时包含：

1. `type-check`
2. `test`
3. 在需要时补 `test-expo`
4. Android 阶段必须有真实设备 / 模拟器验证，不只做 headless 单测

对于 assembly / Android 相关阶段，遵守仓库现有验证原则：

1. 优先真实 mock server / dual-topology-host / 双屏环境验证。
2. 不把“请求返回成功”当成闭环完成。
3. 优先验证 selector / state / request / current screen 语义。

## 15. 风险与规避

### 风险 1：双进程双 runtime 复杂度高

规避：

1. 协议中显式区分 `primary` / `secondary`。
2. 不假设共享 store。
3. target 注册 / 断线 / disposed 事件必须是协议级概念。

### 风险 2：UI 语义树容易变脆

规避：

1. 优先依赖 `testID`。
2. 明确支持少量 `semanticId` 与显式注册节点。
3. 坐标动作只做兜底，不做主路径。

### 风险 3：脚本执行滥用

规避：

1. `scripts.execute` 只做 escape hatch。
2. 文档与测试都要求优先走 query / action / wait。
3. 将脚本执行结果纳入 trace，避免黑盒化。

### 风险 4：污染业务包

规避：

1. 自动化逻辑只沉淀在 `ui-automation-runtime`、helper、assembly 装配和 adapter 中。
2. 业务包不引入专门自动化代码路径。
3. 尽量利用已有 public command、selector、testID。

## 16. 结论

推荐落地方向为：

1. 新增 `2-ui/2.1-base/ui-automation-runtime` 作为统一 TS 控制面。
2. 在 `3-adapter/android/adapter-android-v2` 中提供 Android adb-only transport 与脚本执行后端桥接。
3. 在 `4-assembly/android/mixc-retail-assembly-rn84` 中完成双屏 runtime 与 native host bridge 的装配。
4. 在 Web / Expo 测试环境中通过 `test-expo` / `test` helper 提供 WebSocket host。
5. 全部能力默认不启动，只有测试 / 调试场景显式装配时才进入工作态。

该方案在保持架构边界清晰的前提下，能够逐步统一后续所有 `2-ui` 基础包与 `4-assembly` 集成包的自动化测试与运行时调试能力。

## 17. 后续默认约束

这份方案不是一次性试点文档，而是后续 UI 自动化演进的默认标准。

后续约束：

1. 新增或重构 `2-ui` 包时，默认优先接入 `ui-automation-runtime`，而不是再定义一套包私有自动化协议。
2. 新增 rendered UI 测试时，优先使用共享 automation helper / semantic query / action / wait 语义，而不是直接依赖组件内部树结构。
3. 新增 `test-expo` 自动化时，优先复用共享 browser harness，不再复制粘贴每包自定义 `runAutomation.mjs` 协议层。
4. 新增高价值 UI 节点时，应同步考虑：
   1. 稳定 `testID`
   2. 是否需要进入 semantic registry
   3. 是否需要暴露明确的可操作 action
5. 如果某个场景暂时必须绕过该方案，应把它标记为临时 escape hatch，并在后续回收进共享协议，而不是沉淀成第二套长期标准。

## 18. Topology-aware Automation 约束

与主副机、独立副机、双屏或状态持久化相关的 UI 自动化，必须同时遵守 `docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md`。

关键规则：

1. managed secondary 的本地 stateStorage 必须视为禁用，唯一条件是 `displayMode === 'SECONDARY' && standalone === false`。
2. standalone slave 即使 `displayMode === 'SECONDARY'`，也仍然保留本地持久化。
3. 外部 master 接入必须通过 admin-console / automation 触发：
   1. 导入 share payload；
   2. 写入 masterInfo；
   3. 请求 `/tickets`；
   4. 更新 dynamic topology binding；
   5. 重启 topology connection。
4. power display switch 是 assembly 级能力：仅 `standalone && instanceMode === 'SLAVE'` 响应 `powerConnected` 切换。
5. 测试脚本应通过 `ui-automation-runtime` 操作 admin-console 的 topology section，不应绕过 UI 直接改内部 slice，除非是明确的低层单元测试。
6. 双屏断言必须显式 target `primary` / `secondary`；不要用隐式 `all` 等待拓扑状态收敛。
