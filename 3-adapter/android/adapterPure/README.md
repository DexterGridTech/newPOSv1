# adapterPure

## 定位

`adapterPure` 是新的原生适配层基础包，只承载 Android 原生能力，不集成 React Native。

它的目标是把后续整合层需要依赖的原生能力先沉淀成一个独立、可测试、可复用的原生模块，避免：

- 原生逻辑直接散落在整合层工程里
- 每次换 RN 版本都要把底层能力重写一遍
- 调试某个硬件/系统能力时必须先跑整套 RN 业务

当前目录下包含两部分：

- `adapter-lib`：真正对外复用的原生能力库
- `dev-app`：仅用于本包独立调试和验证的 Android 壳工程

## 设计原则

- `adapterPure` 只做原生功能，不依赖 RN
- 能抽象成接口/模型的，优先沉到 `interfaces`
- 核心 manager 要具备可诊断性，遇到异常不能轻易闪退
- `dev-app` 只用于测试，不作为对外导出内容
- 不通过 Maven/AAR 发布，后续由整合层以源码方式引用

## 目录说明

### `adapter-lib/src/main/java/com/impos2/adapter`

- `appcontrol`
  - 宿主控制能力，例如全屏、锁定、加载态等
- `camera`
  - 摄像头扫码 Activity、覆盖层与流程协调器
- `connector`
  - 外部连接能力统一入口，承载 camera / intent / HID / passive channel
- `constants`
  - 事件名等常量
- `device`
  - 设备信息、电源状态、系统状态采集
- `errors`
  - 错误码定义
- `interfaces`
  - 对外抽象接口与模型定义
- `logger`
  - 文件日志管理
- `scripts`
  - QuickJS 脚本执行引擎
- `storage`
  - 轻量原生 KV 存储
- `webserver`
  - LocalWebServer、设备连接关系与 Service 生命周期管理

### `dev-app`

`dev-app` 是本包的独立验证入口，用来直接测试：

- Camera 扫码
- Connector
- Device
- ScriptEngine
- StateStorage
- LocalWebServer
- AppControl

这里的测试页和调试壳只服务于迁移与验收，不属于对外导出能力的一部分。

## 核心模块说明

### ConnectorManager

对外连接能力总入口。

负责：

- 统一 request/response 调用
- 维护任务超时、取消、完成态
- 管理 HID / passive channel 订阅
- 汇总可用 target 与诊断信息

### LocalWebServerManager / LocalWebServerService

LocalWebServer 的门面与后台宿主。

负责：

- 启停本地服务
- 管理前台服务通知
- 暴露状态、地址、统计信息
- 协调 DeviceConnectionManager

### DeviceConnectionManager

维护设备注册、配对、socket 映射和连接统计。

重点是：

- 读写一致性
- 异常断开清理
- 避免脏状态长期残留

### ScriptEngineManager

QuickJS 脚本执行入口。

重点是：

- 单线程 runtime
- 超时后 runtime 回收与重建
- native function 回调桥接
- 字节码缓存
- 统计与诊断

### CameraScannerManager

协调扫码页拉起、结果回传和重复启动保护。

### AppControlManager

负责全屏、锁定、加载态等宿主能力。

### DeviceManager

负责设备与系统信息采集，并对电源状态变化提供监听能力。

### LogManager

负责控制台日志落盘、日志文件轮换与读取清理。

### StateStorageManager

当前基于 `SharedPreferences` 实现，仅作为 adapterPure 阶段的原生独立存储。

注意：

- 它不是最终整合层的生产持久化方案
- `mixc-retail-rn84v2` 中正式业务存储链路应走 `MMKV 4.x`

## 与整合层的关系

目标迁移模式是：

- `adapterPure`：只保留原生能力
- `mixc-retail-rn84v2`：负责 RN、TurboModule、TS 适配器注册，以及对 `adapterPure` 的调用

也就是说：

- 原生能力在 `adapterPure` 本包里要能独立测试
- 同一份能力在整合层里也要能通过 RN/TurboModule 被验证

## 常用命令

在仓库根目录执行：

```bash
npm run adapter:android-pure:build
npm run adapter:android-pure:run
npm run adapter:android-pure:start
npm run adapter:android-pure:all
```

如果只想直接编译本包：

```bash
cd 3-adapter/android/adapterPure
source ~/.zshrc && ./gradlew :adapter-lib:compileDebugKotlin :dev-app:assembleDebug
```

## 当前边界与注意事项

### 1. StateStorage 仍是原生轻量实现

这是刻意设计，不是遗漏。最终业务存储在整合层落 MMKV。

### 2. LocalWebServer 需要主进程语义配合

单看 `adapterPure` 可以独立验证服务能力，但最终在整合层里仍要结合主副屏、重启策略和业务通信约束使用。

### 3. ScriptEngine 已做过一轮稳定性增强

当前具备：

- 单线程执行器模型
- timeout 后 runtime 重建
- compile cache
- 运行态诊断

但生产前仍建议结合真实业务脚本做长稳验证。

### 4. dev-app 不对外导出

`dev-app` 只用于开发调试。本包作为依赖提供给其他工程时，真正有意义的是 `adapter-lib`。
