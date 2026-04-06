# @impos2/assembly-android-mixc-retail-rn84v2

## 概述

`mixc-retail-rn84v2` 是新的 Android 整合层工程，职责是把：

- `1-kernel` / `2-ui` 的 TS 业务能力
- `3-adapter/android/adapterPure` 的纯原生能力

在 RN 0.84 新架构下整合为一个可运行的裸工程。

这个包的核心定位不是“再实现一套 adapter”，而是：

- 提供 RN 宿主
- 提供双屏启动与重启控制
- 通过 TurboModule 把整合层需要的原生能力暴露给 JS
- 在主副屏双进程模式下，保证主副屏都能独立重建并重新加载 JS 环境

## 当前架构原则

### 1. 双进程，双 JS 环境

当前工程必须保持：

- 主屏运行在主进程
- 副屏运行在 `:secondary` 进程
- 主副屏各自拥有独立的 `Application / ReactHost / Hermes runtime`

这样设计的原因是：

- 主副屏业务逻辑本身就是按两套环境设计
- 后续要支持热更新，重启时必须真正清理并重建运行环境
- 一个屏幕异常不应该直接污染另一个屏幕的 JS 上下文

### 2. adapterPure 只做原生能力

整合层不重新实现 adapterPure 的底层功能，而是复用 adapterPure 已经完成的原生能力，例如：

- `AppControlManager`
- `ConnectorManager`
- `DeviceManager`
- `LocalWebServerManager`
- `LogManager`
- `ScriptEngineManager`

整合层自己的价值主要在“宿主控制”和“桥接组织”。

### 3. TS 侧注册在上层完成

本包原生层只提供 TurboModule 与宿主控制。
TS 适配器注册应在 JS 层入口完成，例如：

- `src/application/modulePreSetup.ts`

按既定方案完成 7 个注册：

- `registerLogger(loggerAdapter)`
- `registerDevice(deviceAdapter)`
- `registerStateStorage(stateStorageAdapter)`
- `registerExternalConnector(externalConnectorAdapter)`
- `registerScriptsExecution(scriptExecutionAdapter)`
- `registerLocalWebServer(localWebServerAdapter)`
- `registerAppControl(appControlAdapter)`

## 原生层目录说明

### 入口类

- `android/app/src/main/java/com/mixcretailrn84v2/MainApplication.kt`
  - 应用级入口
  - 初始化 RN 0.84 新架构
  - 注册 `AdapterPackage`

- `android/app/src/main/java/com/mixcretailrn84v2/MainActivity.kt`
  - 主屏宿主 Activity
  - 负责主屏启动、重启、全屏状态维护、按键转发、副屏启动入口

- `android/app/src/main/java/com/mixcretailrn84v2/SecondaryActivity.kt`
  - 副屏宿主 Activity
  - 运行在独立进程
  - 负责受控退出、ACK 回传、彻底结束副进程

### 启动链路

- `startup/LaunchOptionsFactory.kt`
  - 统一生成主副屏 launch options

- `startup/StartupCoordinator.kt`
  - 编排“显示遮罩、等待主屏 ready、关闭遮罩、延迟启动副屏”

- `startup/StartupOverlayManager.kt`
  - 管理主屏上的原生启动遮罩

- `startup/SecondaryDisplayLauncher.kt`
  - 负责把副屏 Activity 拉起到第二块屏幕

- `startup/SecondaryProcessController.kt`
  - 主副进程之间的关停请求与 ACK 控制器

- `startup/StartupAuditLogger.kt`
  - 标准化启动/重启审计日志

### 重启链路

- `restart/AppRestartManager.kt`
  - 编排“停 webserver -> 关副屏 -> reload 主屏 -> 主屏 ready 后重建副屏”

### TurboModule

- `turbomodules/AdapterPackage.kt`
  - 整合层原生模块总注册入口

- `turbomodules/AppControlTurboModule.kt`
  - 加载态、全屏、锁定、重启、退出

- `turbomodules/ConnectorTurboModule.kt`
  - Connector 主调、订阅、事件转发、宿主按键转发

- `turbomodules/DeviceTurboModule.kt`
  - 设备信息、系统状态

- `turbomodules/LocalWebServerTurboModule.kt`
  - LocalWebServer 启停、状态、统计

- `turbomodules/LoggerTurboModule.kt`
  - 日志写入与日志文件管理

- `turbomodules/ScriptsTurboModule.kt`
  - JS 脚本执行与 native function 回调桥接

## 启动时序

### 首次启动

1. `MainActivity` 创建
2. `StartupCoordinator.attachPrimary()` 展示原生启动遮罩
3. 主屏 JS 加载完成后，通过 `AppControlTurboModule.hideLoading(0)` 进入 `onAppLoadComplete`
4. `StartupCoordinator` 并行执行两件事：
   - 1.5 秒后关闭启动遮罩
   - 3 秒后尝试拉起副屏
5. 如果存在第二块屏幕，则 `SecondaryActivity` 在副进程中启动

### 重启

1. JS 调用 `restartApp()`
2. `AppRestartManager` 记录审计日志
3. 如果主进程 `LocalWebServer` 正在运行，先停止并等待真正进入 `STOPPED`
4. 如果副屏在运行，则向副进程发送关停请求
5. 副进程退出前回发 ACK，并结束自身进程
6. 主进程执行 `reactHost.reload("user restart")`
7. 主屏 JS 重新 ready 后，跳过启动遮罩，仅保留副屏启动编排

## 为什么副进程必须 killProcess

仅仅 `finish()` / `finishAndRemoveTask()` 不够。

因为你后续要做热更新，要求副屏也必须真正清理并重新加载新的 JS 环境。如果不主动结束副进程：

- 旧进程中的 ReactHost / Hermes runtime 可能继续存活
- 旧的 native 单例状态可能残留
- 下一轮副屏启动不一定是完整重建

因此当前设计中，副进程在受控退出路径里会：

- 先发 ACK
- 再 `Process.killProcess(Process.myPid())`

## LocalWebServer 规则

当前业务约束：

- LocalWebServer 只允许主进程启动
- 重启前若主进程 LocalWebServer 正在运行，必须先停掉
- 后续由 JS 自己决定何时重新启动

整合层原生代码已经按这个约束处理重启流程。

## 调试建议

### 查看启动与重启审计日志

```bash
adb logcat -s StartupAudit
```

重点关注：

- `activity_created`
- `app_load_complete`
- `restart_requested`
- `local_web_server_stopping`
- `local_web_server_stopped`
- `secondary_shutdown_requested`
- `secondary_ack_received`
- `secondary_shutdown_timeout`
- `secondary_process_exit`
- `main_reacthost_reload`

### 关于 DevTools

当前是双进程双 JS 环境。
RN DevTools 默认通过 `device` 粒度打开调试，不会自动给主屏 / 副屏提供独立选择器。
因此在 Metro 里按 `J` 时，通常只会打开一个 DevTools 窗口，并附着到当前活跃或后启动的 runtime。

这不是本工程逻辑错误，而是 RN 默认调试链路对多 runtime 场景支持不足。

## 维护注意事项

### 1. 不要把副屏改回单进程多 Surface

当前业务明确要求两套独立 JS 环境。即使共享 `ReactHost` 的多 Surface 方案更省资源，也不满足后续热更新与彻底重建要求。

### 2. 不要让副屏直接触发全局 restart

应用级重启只能由主屏宿主统一编排。副屏只能接受主进程下发的关停请求，不能反向控制主进程生命周期。

### 3. 不要在重启链路里跳过停 webserver

如果未来为追求速度而直接 `reactHost.reload()`，容易导致：

- 端口占用
- 遗留连接未关闭
- 新旧会话重叠

### 4. 修改启动时序时要同时看遮罩和副屏启动

当前是并行时序：

- 主屏 ready 后 1.5 秒关遮罩
- 主屏 ready 后 3 秒拉副屏

如果后续改动时间，要同时验证：

- 启动视觉是否自然
- 副屏是否稳定拉起
- 重启后是否仍能完整重建

## 备注

当前 README 只覆盖本包原生层职责，不覆盖上层复杂业务通信逻辑。主副屏之间更高层的 localServer 协议、业务消息流等，属于后续业务层主题，不在这里展开。
