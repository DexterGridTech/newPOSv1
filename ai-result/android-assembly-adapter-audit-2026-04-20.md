# `mixc-retail-assembly-rn84` / `adapter-android-v2` 全面代码审计报告

日期：2026-04-20

审计范围：

1. `4-assembly/android/mixc-retail-assembly-rn84`
2. `3-adapter/android/adapter-android-v2`

审计目标：

1. 对照原设计与后续演进设计，确认两包在原生层的职责边界是否成立。
2. 检查关键业务链路是否兑现设计约束，尤其是双屏启动、topology host、热更新、自动化、脚本执行、连接器与原生控制链路。
3. 给出按严重级别排序的审计结论，供后续重构与验收使用。

---

## 一、结论摘要

整体判断：**分层大方向是成立的，但尚未达到“设计完全闭环、可放心长期演进”的状态。**

当前较明确的正向结论：

1. `adapter-android-v2` 仍然是纯 Android 原生能力层，没有引入 React Native 依赖，也保留了 `adapter-lib + dev-app` 结构，符合 `docs/superpowers/specs/2026-04-16-android-assembly-v2-design.md:45-53,221-250` 的定位。
2. `mixc-retail-assembly-rn84` 仍然是 RN bare host + TurboModule + runtime composition 层，`createApp.ts` 通过 `createKernelRuntimeApp(...)` 做统一总装配，符合 `docs/superpowers/specs/2026-04-16-android-assembly-v2-design.md:54-63,359-418` 与 `refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md:125-173`。
3. 热更新链路已经明显朝“通用下载、hash、解压、marker store 下沉到 adapter，assembly 只做 bundle resolver / 启动确认 / bridge”的方向收口。`HotUpdatePackageInstaller.kt` 与 `HotUpdateBootMarkerStore.kt` 已经位于 adapter，assembly 侧 `createAssemblyHotUpdatePort()` 只做桥接，方向正确。
4. managed secondary 的 storage gate 已按最新设计落地：只有 `displayMode === 'SECONDARY' && standalone === false` 才禁用本地持久化，符合 `docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md:380-391` 与 `docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md:340-370`。
5. 双屏场景下“原生启动协调器准备 loopback host / locator，secondary 通过 launch options 接入”的整体思路，与最新 V3 设计是一致的，不能再按更早期的单屏 `enableSlave` 规则去误判双屏内建副屏场景。

但仍然存在几处高风险偏差，已经影响“设计兑现度”和“真实交付质量”：

1. `adapter` 的 dev-app 还在验证旧 `topologyhost`，不是当前 assembly 实际使用的 `topologyhostv3`，导致“适配层可独立验证”的承诺失真。
2. `topologyhostv3` 目前只实现了最小 pair/relay 壳，**没有实现设计中明确要求的 heartbeat timeout / connection detach 语义**，与 V3 设计不一致。
3. 双屏主进程对“副屏是否真的还活着”的状态判断不成立，可能导致副屏无法被再次拉起，或重启链路总是走超时分支。
4. assembly `release` 构建仍使用 debug 签名，且未开启混淆/瘦身，属于明显的发布硬化缺口。

综合建议：**当前架构可以继续沿用，但必须先补齐 topology host V3 验证面、双屏活性状态、发布构建硬化这三块，否则后续继续堆业务会把问题固化。**

---

## 二、设计定位与当前实现对照

### 2.1 `adapter-android-v2` 的设计定位

设计要求：

1. 纯 Android 原生能力层，不拥有 React Native、TurboModule spec、JS runtime bootstrap。
2. 承载可复用的 native manager / service / capability model。
3. `topologyHost` 应该是 adapter 内部的完整 native capability，而不是 assembly 再拆一层协议实现。
4. `dev-app` 要成为 adapter 能力的独立验证壳。

当前实现评估：**大体一致，但验证面与最新 V3 能力脱节。**

证据：

1. `adapter-lib` 只依赖 Android / Kotlin / MMKV / QuickJS / CameraX / ML Kit 等纯原生栈，见 `3-adapter/android/adapter-android-v2/adapter-lib/build.gradle:23-37`。
2. `topologyhostv3`、`connector`、`scripts`、`storage`、`logger`、`appcontrol`、`automation`、`hotupdate` 都在 `adapter-lib` 内部，符合 native capability 层定位。
3. 但 `dev-app` 的拓扑验证页仍然直接依赖旧 `com.impos2.adapterv2.topologyhost.TopologyHostManager`，见 `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/topologyhost/TopologyHostTestFragment.kt:22-27,33-35`，并继续验证旧 `/tickets`、`/health`、旧 stats 结构，见 `...TopologyHostTestFragment.kt:84-85,149-192,205-208`。这与当前 assembly 实际桥接的 `topologyhostv3` 已经脱节。

### 2.2 `mixc-retail-assembly-rn84` 的设计定位

设计要求：

1. 保持为 RN bare host 应用。
2. 拥有 TurboModule 注册、双屏启动 / 重启编排、launch props、runtime composition。
3. 不拥有低层原生能力实现，也不应承载 topology host 协议逻辑本体。

当前实现评估：**整体一致。**

证据：

1. `MainApplication` 只负责 RN host 初始化与 `AdapterPackage` 注入，见 `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/MainApplication.kt:16-29,52-81`。
2. `AdapterPackage` 只注册 bridge 模块，不承载能力实现本体，见 `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AdapterPackage.kt:12-23,32-45`。
3. `createApp.ts` 是清晰的 assembly bootstrap：创建 platform ports、topology binding、kernel runtime app、automation、topology host lifecycle sync，见 `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts:78-146,212-243,365-432`。
4. `createAssemblyPlatformPorts()` 把原生能力注入 runtime-scoped `platformPorts`，符合“platform ports 进入 runtime-scoped 容器”的设计要求，见 `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts:10-41`。

### 2.3 热更新职责边界

当前状态：**已基本收口到正确方向。**

证据：

1. 下载、hash、解压、marker store 已下沉到 adapter：
   - `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/hotupdate/HotUpdatePackageInstaller.kt:30-135`
   - `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/hotupdate/HotUpdateBootMarkerStore.kt:25-202`
2. assembly 侧只剩 bridge / bundle 选择 / 启动确认：
   - `4-assembly/.../turbomodules/HotUpdateTurboModule.kt:41-247`
   - `4-assembly/.../HotUpdateBundleResolver.kt:7-32`
   - `4-assembly/.../src/platform-ports/hotUpdate.ts:4-20`
   - `4-assembly/.../src/application/reportAppLoadComplete.ts:23-79`
3. 这一点与热更新设计文档中的职责分工一致：TS 编排，native 真正下载/校验/解压/落盘，见 `docs/hot-update-system-guide.md:1210-1230,1246-1265`。

结论：这条边界已经明显优于前一阶段，是当前两包最健康的一条主链路。

---

## 三、分级问题清单

## HIGH

### H1. `adapter` 的 Topology 验证台仍绑定旧 `topologyhost`，导致“适配层可独立验证”失真

位置：

1. `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/topologyhost/TopologyHostTestFragment.kt:22-27,33-35`
2. `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/topologyhost/TopologyHostTestFragment.kt:84-85,149-192,205-208`
3. `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/TestHomeFragment.kt:46-52`
4. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/TopologyHostTurboModule.kt:22-40`

问题：

1. `dev-app` 首页文案已经声明“旧 LocalWebServer 不再作为协议能力保留”，见 `TestHomeFragment.kt:46-52`。
2. 但实际 topology 验证页仍然依赖旧 `TopologyHostManager`，还在校验旧 `/tickets`、`/health`、`ticketCount`、`relayCounters` 这些旧模型字段，见 `TopologyHostTestFragment.kt:149-192,205-208`。
3. 与此同时，assembly 真正桥接的是 `TopologyHostV3Manager`，见 `TopologyHostTurboModule.kt:22-40`。

风险：

1. adapter 的“独立验证”已经不能证明 assembly 当前使用的 topology host 真的可用。
2. 现场排障时会出现“dev-app 过了，但 assembly 真实 host 仍有问题”的假阳性。
3. 会误导后续开发继续围绕旧 host 语义扩展，而不是围绕 V3 设计收口。

建议：

1. 直接把 `dev-app` 的 topology 页迁移到 `topologyhostv3`。
2. 删除或显式标注旧 `topologyhost` 页面为 legacy。
3. 所有 topology 验证动作、状态字段、HTTP/WS smoke case 一律以 V3 服务面为准。

---

### H2. `TopologyHostV3` 未实现 heartbeat timeout / host-side liveness 语义，与 V3 设计不一致

位置：

1. 设计要求：`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md:853-863`
2. 设计要求：`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md:898-916`
3. 实现：`3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Server.kt:172-199`
4. 实现：`3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Runtime.kt:33-83,125-151`
5. 模型：`3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Models.kt:33-91`

问题：

1. V3 设计明确要求 host / adapter 负责 heartbeat timeout / connection detach / host state observation。
2. 当前 `TopologyHostV3Server.handleIncomingMessage(...)` 只处理 `hello`、`state-snapshot`、`state-update`、`command-dispatch`、`command-event`、`request-snapshot`，没有 heartbeat 消息处理。
3. `TopologyHostV3Runtime` 里也没有 lastHeartbeat、timeout 检查、定时断链、peer liveness 状态。
4. 当前所谓 detach 只发生在 socket 物理关闭或 fault-rule 主动断链时，见 `TopologyHostV3Server.kt:156-169,209-212`。

风险：

1. peer 假死、网络悬挂、进程卡死场景下，host 无法按协议层主动识别超时。
2. 上层只能等到底层 socket 自己出错，liveness 语义不足。
3. 与设计文档要求的 topology V3 行为不一致，后续 kernel/assembly/automation 读到的 host 状态会偏乐观。

建议：

1. 为 V3 host 增加 heartbeat / heartbeat-ack / timeout 机制，或至少补一个明确的“简化替代语义”并更新设计文档。
2. 在 diagnostics / status 中暴露 peer 最近心跳时间与 timeout 状态。
3. 为 heartbeat timeout 增加 adapter 单测与 assembly 集成验证。

---

### H3. 副屏活性状态在主进程中不成立，可能导致副屏无法重拉起、重启总走超时分支

位置：

1. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/startup/SecondaryDisplayLauncher.kt:27-43,53-104`
2. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/MainActivity.kt:176-205`
3. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/SecondaryActivity.kt:75-105`
4. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/startup/SecondaryProcessController.kt:27-33,75-120`

问题：

1. 主进程的 `SecondaryDisplayLauncher.isSecondaryActive` 只返回 `launchRequested`，见 `SecondaryDisplayLauncher.kt:33-43`。
2. 一旦主进程调用 `startIfAvailable()` 并成功发起 `startActivity(...)`，`launchRequested` 就会变成 `true`，见 `SecondaryDisplayLauncher.kt:64-77`。
3. 但当前副进程 `SecondaryActivity` 并不会回调主进程的 `MainActivity.onSecondaryActivityCreated()` / `onSecondaryActivityDestroyed()`；这两个方法虽然存在于 `MainActivity.kt:181-191`，但在当前实现里没有调用链。
4. `SecondaryActivity` 只会更新自己进程内的 `SecondaryProcessController.secondaryAlive`，见 `SecondaryActivity.kt:78-79,99-103`；而 `SecondaryProcessController` 注释也明确说明这不是主进程真相源，见 `SecondaryProcessController.kt:27-33`。

风险：

1. 主进程可能在首次拉起副屏后永久认为“副屏仍然 active”，即使副屏实际已经退出。
2. `MainActivity.launchSecondaryIfAvailable()` 后续会被 `isSecondaryActive` 拦住，导致副屏无法再次拉起。
3. `AppRestartManager.restart()` 会把 `currentActivity.isSecondaryDisplayActive` 作为是否需要等待副进程 ACK 的依据，见 `AppRestartManager.kt:73-76`；如果这个状态是脏的，重启链路会无意义地等待 4 秒超时。

建议：

1. 建立主进程可见的 secondary started / stopped 回传机制。
2. 不要再让 `launchRequested` 同时扮演“启动中”和“已存活”两个语义。
3. 把 `MainActivity.onSecondaryActivityCreated()/Destroyed()` 真的接入跨进程回报链路，或删除这组死接口，避免误导。

---

### H4. `release` 构建仍使用 debug keystore，且未开启 shrink/minify，存在明显发布硬化缺口

位置：

1. `4-assembly/android/mixc-retail-assembly-rn84/android/app/build.gradle:15,32-49`

问题：

1. `release` 仍使用 `signingConfigs.debug`，见 `build.gradle:45-46`。
2. `enableProguardInReleaseBuilds = false`，见 `build.gradle:15,47-49`。

风险：

1. 如果这套 assembly 被当作真实交付包产出，debug 签名是明显的发布风险。
2. 未开启 shrink/minify 会扩大逆向暴露面，也会增加包体与符号暴露。
3. 这会直接拉低“assembly 是可交付宿主”的成熟度判断。

建议：

1. 立即拆分真实 release signingConfig。
2. 明确区分 `internal/debug/release` 三类交付面。
3. 至少在 CI 中禁止“debug 签名的 release 变体”被误当成可发布包。

---

## MEDIUM

### M1. System file picker 取消路径仍未 finishTask，任务会泄漏且调用方得不到取消结果

位置：

1. `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/connector/ConnectorManager.kt:368-415`

问题：

1. `startSystemFilePicker(...)` 中，`task.cancelAction` 只做 `canceledTaskCount.incrementAndGet()`，见 `ConnectorManager.kt:404-406`。
2. 它没有调用 `finishTask(...)`，也没有回调 `callback(...)`。

风险：

1. 调用方在取消场景下收不到结束信号。
2. 任务会一直残留在 `tasks` 表中，直到超时或整体 shutdown。
3. 这属于用户可感知的交互挂起，不只是代码整洁问题。

建议：

1. 取消路径统一走 `finishTask(task, canceledResponse, callback)`。
2. 为 system file picker 增加“用户取消”单测。

---

### M2. 热更新下载器没有连接/读取超时，也没有真正可中断的下载语义

位置：

1. `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/hotupdate/HotUpdatePackageInstaller.kt:98-118`
2. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/HotUpdateTurboModule.kt:189-197`

问题：

1. `HotUpdatePackageInstaller.downloadArchive(...)` 直接 `URL(packageUrl).openStream()`，没有 connect/read timeout，见 `HotUpdatePackageInstaller.kt:105-108`。
2. `HotUpdateTurboModule.invalidate()` 虽然会 `shutdownNow()` 下载线程池，见 `HotUpdateTurboModule.kt:189-197`，但阻塞中的网络 IO 不一定会因为线程中断而及时返回。

风险：

1. 当前实现已经不会阻塞 UI 线程，但会让热更新任务卡死在后台线程。
2. 极端网络环境下，更新任务可能长时间占住下载执行器，影响后续 update 请求。

建议：

1. 改成显式 `HttpURLConnection` 并设置 connect/read timeout。
2. 补充取消语义，至少让长期挂起的下载可以被观测和回收。

---

### M3. `TopologyHostV3Manager.ensureBound()` 仍是同步阻塞式绑定，可能在 bridge 调用面造成瞬时卡顿

位置：

1. `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Manager.kt:79-95`
2. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/TopologyHostTurboModule.kt:26-40`

问题：

1. `ensureBound()` 使用 `CountDownLatch.await(3, TimeUnit.SECONDS)` 等待 service bind，见 `TopologyHostV3Manager.kt:81-95`。
2. `TopologyHostTurboModule.startTopologyHost(...)` 直接同步调用 `manager.start(...)`，见 `TopologyHostTurboModule.kt:26-40`。

风险：

1. 第一次启动 host 时，TurboModule Promise 解析会被这段阻塞时间直接拖长。
2. 如果 bind 过程偶发慢，原生桥侧会出现明显毛刺。

建议：

1. 中期可改成异步 bind + 明确状态机。
2. 至少在 diagnostics 中区分 `STARTING/BINDING` 与真正 `RUNNING`。

---

## LOW / 说明性偏差

### L1. `reportAppLoadComplete()` 仍然直接调用 native `confirmLoadComplete()`，没有完全走 generic `HotUpdatePort.reportLoadComplete()`

位置：

1. 设计说明：`docs/hot-update-system-guide.md:1226-1230`
2. 实现：`4-assembly/android/mixc-retail-assembly-rn84/src/application/reportAppLoadComplete.ts:35-50`
3. 端口桥：`4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/hotUpdate.ts:17-19`

判断：

1. 这是文档已经明确记录的 Android assembly 特例，不属于当前必须立刻修复的功能性缺陷。
2. 但从长期收口看，这仍然是一个应继续简化的边界点。

---

## 四、业务链路专项复盘

### 4.1 启动 / 双屏 / 重启链路

优点：

1. `MainActivity`、`StartupCoordinator`、`AppRestartManager` 的职责划分清晰，宿主启动与重启不再散落在单一 Activity 中，见：
   - `MainActivity.kt:20-30,101-125,153-205`
   - `StartupCoordinator.kt:8-16,47-90,111-132`
   - `AppRestartManager.kt:17-29,64-151`
2. `AppRestartManager` 已使用 `WeakReference<MainActivity>`，降低了延迟回调持有 Activity 的问题，见 `AppRestartManager.kt:35-38,77-89`。

不足：

1. 主进程对副屏活性状态没有可靠真相源，见 H3。
2. 双屏生命周期在“native launch requested”与“secondary truly alive”之间仍缺一个明确 ACK。

### 4.2 Topology host 链路

优点：

1. assembly 只桥接 `TopologyHostV3Manager`，没有再把 topology 协议实现塞回 assembly，方向正确。
2. 双屏 `TopologyLaunchCoordinator` 的最新行为与 V3 设计一致：双屏 primary 负责启动 loopback host，secondary 通过 locator 接入，见：
   - 设计：`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md:1058-1075`
   - 实现：`TopologyLaunchCoordinator.kt:30-61,89-101`
3. 单屏场景下 `enableSlave` 与 host lifecycle 绑定已经进入 assembly JS helper，见 `assemblyTopologyHostLifecycle.ts:13-32` 与 `createApp.ts:257-363`。

不足：

1. `topologyhostv3` 还只是最小可跑通壳，不是完整 V3 host，见 H2。
2. `dev-app` 仍在验证旧 host，见 H1。

### 4.3 热更新链路

优点：

1. 职责边界明显改善，adapter 承担通用安装器与 marker store，assembly 只保留宿主相关逻辑。
2. `HotUpdateTurboModule.downloadPackage()` 已切到专用单线程 executor，不会阻塞 UI / native modules queue，见 `HotUpdateTurboModule.kt:33-37,60-104`。
3. `HotUpdateBundleResolver` / `reportAppLoadComplete` / `syncHotUpdateStateFromNativeBoot` 三段职责基本清楚。

不足：

1. 下载器缺少网络超时与真正可中断 IO，见 M2。
2. `HotUpdateBundleResolver.preparePrimaryBoot(1)` 仍把默认最大失败次数硬编码为 1，见 `HotUpdateBundleResolver.kt:11-16`。虽然当前 marker 自身可覆盖更大值，但默认策略仍然偏硬。

### 4.4 自动化 / 脚本执行链路

优点：

1. 自动化总体分层符合 `2-ui TS-heavy / adapter transport / assembly bridge` 的设计，见：
   - 设计：`docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md:31-64`
   - 实现：`createAssemblyAutomation.ts:19-45`、`createAutomationRequestDispatcher.ts:151-257`
2. `ScriptsTurboModule` 最近已经补上嵌套 `nativeScriptExecutor.execute()` 的 fail-fast 防护与 pending cleanup，当前版本明显比前一轮更稳，见：
   - `ScriptsTurboModule.kt:168-199`
   - `src/turbomodules/scripts.ts:18-35,45-49,50-100`
3. `ConnectorTurboModule.invalidate()` 已显式解绑 stream/passive listener 并清空静态实例，生命周期比之前健康，见 `ConnectorTurboModule.kt:199-208`。

不足：

1. `AutomationTurboModule.dispatchToJs()` 仍是同步等待 JS 回包模型，见 `AutomationTurboModule.kt:136-157`。这不一定是 bug，但吞吐和背压上限较低。
2. `ScriptsTurboModule.invokeNativeFunction()` 仍然是阻塞等待 JS callback 的模型，虽然当前已规避最明显的嵌套死锁，但长期仍建议走更清晰的异步桥约束。

### 4.5 连接器 / 原生控制 / 日志链路

优点：

1. `ConnectorManager` 的 handler 化收敛方式是对的，HID 广播分发也已经改成 fanout，而不是只发第一个订阅者，见 `ConnectorManager.kt:472-483,664-689`。
2. `AppControlManager` 采用 `WeakReference<Activity>` 管理当前 Activity，基础方向正确，见 `AppControlManager.kt:43-52`。

不足：

1. system file picker 取消路径仍未闭环，见 M1。
2. `LogManager` 虽然还在使用 `SimpleDateFormat`，但当前写入在 `writeMutex` 下串行执行，暂时不足以单独升级为本轮高优先级问题；后续可作为代码健康项继续清理。

---

## 五、测试与验证覆盖评估

当前测试覆盖的正向结论：

1. adapter 已有 hot update / topologyhostv3 / script / automation / HID fanout 单测，见：
   - `adapter-lib/src/test/java/com/impos2/adapterv2/hotupdate/HotUpdatePackageInstallerTest.kt:14-154`
   - `adapter-lib/src/test/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3RuntimeTest.kt:9-97`
2. assembly 已有 topology host lifecycle、report-app-load-complete、state storage、automation dispatcher 等场景测试，见：
   - `test/scenarios/assembly-topology-host-lifecycle.spec.ts:1-56`
   - `test/scenarios/assembly-report-app-load-complete.spec.ts:43-130`

当前明显缺口：

1. 没有覆盖 `TopologyHostV3` heartbeat timeout / peer liveness 的测试，因为实现本身就还没有这套语义。
2. 没有覆盖“主进程 secondary 状态回传正确”的原生集成验证。
3. adapter `dev-app` 没有验证当前 assembly 真正使用的 `topologyhostv3`。
4. 没有看到 release 构建硬化相关的 CI gate。

---

## 六、整改优先级建议

### P0：先修影响边界与交付质量的项

1. 把 adapter `dev-app` 的 topology 验证面迁移到 `topologyhostv3`。
2. 修复主进程 secondary alive 状态模型，建立真正的 secondary started / stopped 回传。
3. 修正 release signing / shrink 配置，防止 debug-signed release 继续存在。

### P1：补齐 topology V3 协议兑现度

1. 为 `topologyhostv3` 增加 heartbeat / timeout / diagnostics 状态。
2. 为 V3 host 增加独立集成 smoke。
3. 删除或冻结旧 `topologyhost` 的活跃验证入口，避免双轨误导。

### P2：补热更新与连接器收尾

1. 给热更新下载器补 connect/read timeout 与取消策略。
2. 修 system file picker cancelAction，确保任务正确 finish。
3. 视需要把 `HotUpdateBundleResolver` 的默认失败次数从硬编码改成显式配置。

---

## 七、最终判断

如果问题是“这两个包在原生层的分工是否已经基本成立”，答案是：

**成立，且比前一阶段清晰很多。**

如果问题是“它们是否已经完全兑现原设计中的定位和约束，可以当成稳定底座继续堆业务”，答案是：

**还没有。**

最核心的未完成点不在“assembly / adapter 是否已经混层”，而在：

1. `adapter` 对最新 `topologyhostv3` 的独立验证面还没补齐。
2. `topologyhostv3` 本身还没有完全兑现 V3 设计语义。
3. 双屏主进程对副屏存活状态的建模仍不可靠。
4. release 交付硬化仍明显不足。

换句话说：

**当前是“边界大体对了，但仍缺少几块决定工程成熟度的最后拼图”。**
