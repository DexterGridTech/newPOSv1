# host-runtime-rn84 与极薄 Android RN84 Assembly 设计

日期：2026-04-24

## 1. 背景

当前 `4-assembly/android/mixc-retail-assembly-rn84` 同时承担了三类职责：

1. Android RN84 宿主职责：`MainApplication`、`MainActivity`、双进程副屏、启动遮罩、热更新 bundle resolver、重启编排、系统 UI 控制。
2. Native 能力桥接职责：TurboModule specs、Kotlin TurboModule 实现、`ReactPackage` 注册，以及对 `3-adapter/android/adapter-android-v2` managers 的桥接。
3. 产品组装职责：加载 `2-ui/2.3-integration/retail-shell`，组合 kernel/ui/business modules，配置品牌启动资源、包名、版本、签名、自动化端口等。

未来如果新增 `xxx-assembly-rn84`，按当前形态会复制 99% 的 Android / TurboModule / runtime wiring 代码，只替换 integration shell 和品牌启动资源。这会带来：

1. Codegen specs 重复，多个 assembly 容易生成不同包名的 `Native*Spec`。
2. Native bugfix 需要跨多个 assembly 同步。
3. 主副屏、热更新、自动化、拓扑 host 这类宿主能力难以统一验证。
4. Assembly 很容易继续沉淀非业务能力，违背“Android assembly 越薄越好”的分层约束。

因此目标是抽出一个 RN84 宿主运行时库：`3-adapter/android/host-runtime-rn84`，让未来 assembly 只保留产品差异。

## 2. 设计目标

### 2.1 主要目标

1. 新建 `3-adapter/android/host-runtime-rn84`，作为 React Native 0.84 New Architecture Module Library。
2. 将 `mixc-retail-assembly-rn84` 中非业务、可复用的 Android / TurboModule / JS host runtime 能力迁入 `host-runtime-rn84`。
3. 新建 `4-assembly/android/mixc-catering-assembly-rn84`，作为极薄产品 assembly。
4. 新建 `2-ui/2.3-integration/catering-shell`，初期可直接复制 `retail-shell` 并重命名，为后续餐饮业务 shell 留出独立入口。
5. 保持 `4-assembly/android/mixc-retail-assembly-rn84` 老工程不变，不在本次迁移中重写 retail assembly。

### 2.2 非目标

1. 不重构 `1-kernel/**` 的业务状态机。
2. 不改变现有 `adapter-android-v2` managers 的业务语义。
3. 不在第一阶段迁移 retail assembly 到新库；retail 仅作为能力复刻参考和回归对照。
4. 不引入新三方依赖。
5. 不把 catering shell 做成真正业务差异；第一阶段只建立可替换 integration shell 的结构。

## 3. 目标包结构

```text
3-adapter/android/
  adapter-android-v2/
    adapter-lib/                         # 纯 Android reusable managers/services，保持现状
  host-runtime-rn84/
    package.json                         # RN module library，拥有 codegenConfig
    react-native.config.js               # 暴露 Android library 给 RN CLI/autolinking
    android/
      build.gradle                       # com.android.library + com.facebook.react
      src/main/AndroidManifest.xml
      src/main/java/com/impos2/hostruntimern84/
        HostRuntimePackage.kt
        HostRuntimeConfig.kt
        HostRuntimeActivityDelegate.kt    # 通用 Activity 生命周期/launch options 委托
        HostRuntimeApplicationSupport.kt   # Application/ReactHost helper，不直接持有 PackageList
        hotupdate/
        restart/
        startup/
        turbomodules/
    src/
      index.ts
      hostApp/createHostApp.tsx
      application/*
      platform-ports/*
      turbomodules/specs/*
      turbomodules/*
      types/*

2-ui/2.3-integration/
  catering-shell/
    package.json
    src/*                                # 初期复制 retail-shell 并改 moduleName/package name

4-assembly/android/
  mixc-catering-assembly-rn84/
    package.json
    App.tsx                              # 只传 RootScreen / createShellModule / productConfig
    index.js                             # 注册 MixcCateringAssemblyRN84
    android/
      app/src/main/java/.../MainApplication.kt
      app/src/main/java/.../MainActivity.kt
      app/src/main/java/.../SecondaryActivity.kt
      app/src/main/res/*                 # 品牌启动图、launcher、strings、styles
      app/build.gradle                   # app id、签名、版本、bundle input
```

## 4. 分层职责

### 4.1 `adapter-android-v2`

继续作为 Android native reusable capability 层。

保留职责：

1. `AppControlManager`、`DeviceManager`、`LogManager`、`StateStorageManager`。
2. `ConnectorManager`、文件选择、扫码、脚本执行。
3. `TopologyHostV3Manager`、server/service/websocket runtime。
4. `HotUpdateBootMarkerStore`、`HotUpdatePackageInstaller` 等热更新原语。
5. Automation socket server / script bridge。

不新增职责：

1. 不直接注册 RN TurboModule。
2. 不加载 shell。
3. 不组合 kernel runtime。
4. 不持有产品 app id / 启动画面 / 签名 / release info。

### 4.2 `host-runtime-rn84`

作为 RN84 宿主运行时库，负责“所有产品 assembly 共用的宿主能力”。

Native 侧职责：

1. 持有 TurboModule specs 对应的 Kotlin 实现。
2. 提供 `HostRuntimePackage` 给 RN autolinking 或手动注册。
3. 封装主副屏启动、双进程生命周期、secondary ACK、启动遮罩、全屏/系统 UI 重放。
4. 封装热更新 bundle resolver 和 boot marker 读取。
5. 封装 app restart 编排。
6. 封装 launch options 生成，把 display/device/topology 初始 facts 传给 JS。
7. 依赖 `adapter-android-v2` managers，但不把 managers 复制进自身。

JS 侧职责：

1. 提供 `createHostApp({RootScreen, createShellModule, productConfig})`。
2. 提供通用 `HostRuntimeApp` React 组件，承载原 `App.tsx` 中的启动阶段、runtime start、automation host、load-complete report、version report、boot error UI。
3. 提供 `createHostKernelRuntimeApp(...)`，承载原 `createApp.ts` 中的 kernel/base/UI/common business module wiring。
4. 提供 platform-ports 实现：device、connector、stateStorage、logger、hotUpdate、topologyHost、terminalLogs、transport、tdpSync。
5. 提供 native wrappers：`nativeDevice`、`nativeConnector`、`nativeLogger`、`nativeHotUpdate`、`nativeAutomationHost` 等。
6. 暴露测试辅助函数，方便新 assembly 复用现有 vitest 场景。

不承担职责：

1. 不直接 import `@impos2/ui-integration-retail-shell` 或 `@impos2/ui-integration-catering-shell`。
2. 不持有产品品牌文案、启动图、launcher icon。
3. 不决定产品 shell 的 RootScreen。
4. 不持有具体 assembly 的 applicationId、namespace、签名配置。

### 4.3 `catering-shell`

作为 `2-ui/2.3-integration` 层的餐饮集成 shell。

第一阶段策略：

1. 直接复制 `retail-shell`。
2. 包名改为 `@impos2/ui-integration-catering-shell`。
3. `moduleName` 改为 catering 专属值，例如 `ui.integration.catering-shell`。
4. UI 文案可暂时保持与 retail 一致或改为餐饮占位，但需要避免继续使用 retail module namespace。
5. 后续餐饮业务差异只在 `catering-shell` 及其依赖的 kernel/UI/business modules 内演进。

### 4.4 `mixc-catering-assembly-rn84`

作为极薄产品壳。

保留职责：

1. Android app id、namespace、签名、版本号。
2. 品牌启动画面、launcher icon、`strings.xml`。
3. `AppRegistry.registerComponent('MixcCateringAssemblyRN84', ...)`。
4. 调用 `createHostApp({RootScreen, createShellModule, productConfig})`。
5. Gradle/Maven/RN CLI app 级配置。
6. 必要的 `MainApplication`、`MainActivity`、`SecondaryActivity` 子类或极薄委托。

禁止职责：

1. 不放 TurboModule specs。
2. 不放 TurboModule Kotlin 实现。
3. 不复制 platform-ports。
4. 不复制 automation/topology/hot-update runtime wiring。
5. 不直接访问 `adapter-android-v2` managers，除非只是传给 `host-runtime-rn84` 的配置委托。

## 5. `createHostApp` API 设计

### 5.1 调用形态

`mixc-catering-assembly-rn84/App.tsx` 目标形态：

```tsx
import {createHostApp} from '@impos2/host-runtime-rn84'
import {RootScreen, createModule as createShellModule} from '@impos2/ui-integration-catering-shell'

export default createHostApp({
  RootScreen,
  createShellModule,
  productConfig: {
    productId: 'mixc-catering',
    appRegistryName: 'MixcCateringAssemblyRN84',
    logTag: 'assembly.android.mixc-catering-rn84',
    moduleName: 'assembly.android.mixc-catering-rn84',
    releaseInfo,
    automation: {
      adbSocketDebugEnabled: true,
      primaryPort: 19081,
      secondaryPort: 19082,
    },
    serverConfig: kernelBaseDevServerConfig,
  },
})
```

### 5.2 参数说明

```ts
interface CreateHostAppOptions {
  RootScreen: React.ComponentType<HostRootScreenProps>
  createShellModule: () => RuntimeModuleV2
  productConfig: HostRuntimeProductConfig
}
```

`HostRuntimeProductConfig` 至少包含：

1. `productId`：稳定产品 ID，用于 storage namespace、日志、release manifest 区分。
2. `moduleName`：assembly runtime module namespace。
3. `appRegistryName`：Android `getMainComponentName()` / JS `AppRegistry` 对齐名。
4. `logTag`：native/JS boot log 前缀。
5. `releaseInfo`：由 assembly release 脚本生成。
6. `automation`：automation socket 端口、ADB debug 开关、target 命名。
7. `serverConfig`：默认 dev/mock server catalog。
8. `reactotron`：可选 emulator/device host。
9. `featureFlags`：可选热更新 resolver、terminal version report 等开关。

### 5.3 为什么不让 host runtime import shell

`host-runtime-rn84` 是共用宿主库，如果它 import 某个 shell，就会重新形成“retail 宿主”的隐式依赖。正确方向是：

1. Shell 属于产品集成层，向上提供 `RootScreen` 和 `createModule`。
2. Host runtime 只知道“有一个 shell module 和一个 RootScreen”。
3. Assembly 负责把具体 shell 传入 host runtime。

这样未来新增 `xxx-shell` 时，native/Codegen/host JS 都不用变。

## 6. Codegen 设计

### 6.1 当前问题

当前 `mixc-retail-assembly-rn84/package.json` 拥有：

```json
"codegenConfig": {
  "name": "MixcRetailAssemblyRN84Spec",
  "type": "modules",
  "jsSrcsDir": "src/turbomodules/specs",
  "android": {
    "javaPackageName": "com.impos2.mixcretailassemblyrn84.turbomodules"
  }
}
```

这意味着：

1. `Native*Spec` 生成在 retail assembly 的包名下。
2. Kotlin TurboModule 实现继承 retail 包名下的 `Native*Spec`。
3. 新建 `xxx-assembly-rn84` 如果复制这套配置，就会生成另一套 `Native*Spec`。
4. 如果某个 native module library 又声明同名 specs，可能出现重复 Codegen artifacts、重复 module provider 或包名不一致。

### 6.2 目标 Codegen 所有权

迁移后：

1. `host-runtime-rn84` 是唯一拥有 TurboModule specs 的包。
2. `host-runtime-rn84/package.json` 拥有 `codegenConfig`。
3. `mixc-catering-assembly-rn84/package.json` 不声明 `codegenConfig`。
4. `mixc-catering-assembly-rn84/src` 不包含 `turbomodules/specs`。
5. Kotlin TurboModule 继承 `com.impos2.hostruntimern84.turbomodules.Native*Spec`。

建议配置：

```json
"codegenConfig": {
  "name": "Impos2HostRuntimeRN84Spec",
  "type": "modules",
  "jsSrcsDir": "src/turbomodules/specs",
  "android": {
    "javaPackageName": "com.impos2.hostruntimern84.turbomodules"
  }
}
```

### 6.3 Module name 稳定性

可以保持现有 JS module names：

1. `DeviceTurboModule`
2. `LoggerTurboModule`
3. `ScriptsTurboModule`
4. `ConnectorTurboModule`
5. `TopologyHostTurboModule`
6. `StateStorageTurboModule`
7. `AppControlTurboModule`
8. `AutomationTurboModule`
9. `HotUpdateTurboModule`

保持 module name 不变的好处：

1. JS wrappers 迁移成本低。
2. 现有测试 mock 更容易平移。
3. 新旧 retail/catering 在运行时不会共存于同一个 app，所以不需要产品前缀区分。

注意：同一个 Android app 内不能同时注册两套同名 TurboModules。因此新 catering app 只能依赖新 `host-runtime-rn84` 的 TurboModules，不能再复制 assembly 内 TurboModules。

### 6.4 Autolinking 策略

推荐 `host-runtime-rn84` 按 RN module library 方式暴露 Android 项目：

```js
module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
      },
    },
  },
}
```

`mixc-catering-assembly-rn84` 通过 package dependency 引入：

```json
"dependencies": {
  "@impos2/host-runtime-rn84": "workspace:*"
}
```

Android app 的 `settings.gradle` 保留 RN CLI autolinking：

```gradle
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(...)
}
```

`android/app/build.gradle` 保留：

```gradle
react {
  autolinkLibrariesWithApp()
}
```

这样 app 不需要手动 include `:host-runtime-rn84`。但因为本仓库当前 `adapter-android-v2` 是普通 Android library，不是 RN autolink dependency，所以 `host-runtime-rn84/android/build.gradle` 需要通过 Gradle dependency 引用它。可选两种方案：

1. 在 root assembly `settings.gradle` 中 include `:adapter-android-v2`，`host-runtime-rn84` 用 `implementation project(':adapter-android-v2')`。
2. 将 `adapter-android-v2` 也发布/声明成可解析 Gradle artifact。

第一阶段建议使用方案 1，最少改动，但把 include 集中在 app Gradle，不复制 TurboModule 代码。中长期可以把 `adapter-android-v2` 也规范成稳定 Maven/local artifact。

### 6.5 Codegen 风险与规避

| 风险 | 原因 | 规避 |
| --- | --- | --- |
| 找不到 `Native*Spec` | library 未被 RN CLI 发现或未执行 Codegen | 确保 dependency、`react-native.config.js`、`codegenConfig`、`com.facebook.react` plugin 完整 |
| 重复 module name | app 同时注册旧 assembly package 和新 library package | catering assembly 不复制旧 `AdapterPackage`，只依赖 `host-runtime-rn84` |
| 包名不一致 | Kotlin import 仍指向旧 retail 包名 | Kotlin 全部改为 `com.impos2.hostruntimern84.turbomodules.Native*Spec` |
| specs 被 app 和 library 同时扫描 | assembly 仍保留 `codegenConfig` 或 specs | 极薄 assembly 删除 codegenConfig 和 `src/turbomodules/specs` |
| Gradle project 解析失败 | autolink 生成的 project 与手动 include 名称冲突 | 不手动 include host runtime；只手动 include adapter-lib 如有必要 |
| Release minify 缺规则 | TurboModule/adapter 类被 R8 裁剪 | 在 host runtime `consumer-rules.pro` 放 RN module/adapter 必要 keep rules |

## 7. Native 迁移设计

### 7.1 从 retail assembly 迁入 host runtime 的 native 文件

迁入并重命名 package：

1. `HotUpdateBundleResolver.kt` -> `hotupdate/HostRuntimeBundleResolver.kt`
2. `restart/AppRestartManager.kt`
3. `startup/LaunchOptionsFactory.kt`
4. `startup/ReactLifecycleGate.kt`
5. `startup/SecondaryDisplayLauncher.kt`
6. `startup/SecondaryProcessController.kt`
7. `startup/StartupAuditLogger.kt`
8. `startup/StartupCoordinator.kt`
9. `startup/StartupOverlayManager.kt`
10. `startup/TopologyLaunchCoordinator.kt`
11. `turbomodules/*TurboModule.kt`
12. `turbomodules/AdapterPackage.kt` -> `HostRuntimePackage.kt`

### 7.2 由 assembly 保留的 native 文件

第一版不采用 `HostRuntimeMainActivity : ReactActivity` 的继承式封装，而采用“assembly 继承 RN 模板 + host runtime 提供 delegate/helper”的委托式封装。原因是 RN 0.84 的 `ReactActivity` / `ReactActivityDelegate` / `DefaultReactNativeHost` 与 app 级 `BuildConfig`、`PackageList`、`applicationId`、`getMainComponentName()` 强耦合；这些信息应留在 assembly，不能让 library 反向假设。

`mixc-catering-assembly-rn84` 保留极薄类：

```kotlin
class MainActivity : ReactActivity() {
  private val hostDelegate by lazy {
    HostRuntimeActivityDelegate(
      activity = this,
      mainComponentName = "MixcCateringAssemblyRN84",
      displayIndex = 0,
      nativeConfig = HostRuntimeNativeConfig(
        logTagPrefix = "mixc-catering",
        startupOverlay = StartupOverlayConfig.LottieRawRes(R.raw.startup_intro),
      ),
    )
  }

  override fun getMainComponentName(): String = "MixcCateringAssemblyRN84"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    hostDelegate.createReactActivityDelegate()

  override fun onCreate(savedInstanceState: Bundle?) {
    hostDelegate.beforeOnCreate()
    super.onCreate(savedInstanceState)
    hostDelegate.afterOnCreate()
  }
}
```

```kotlin
class SecondaryActivity : ReactActivity() {
  private val hostDelegate by lazy {
    HostRuntimeActivityDelegate(
      activity = this,
      mainComponentName = "MixcCateringAssemblyRN84",
      displayIndex = 1,
      nativeConfig = HostRuntimeNativeConfig(
        logTagPrefix = "mixc-catering",
        startupOverlay = StartupOverlayConfig.LottieRawRes(R.raw.startup_intro),
      ),
    )
  }

  override fun getMainComponentName(): String = "MixcCateringAssemblyRN84"
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    hostDelegate.createReactActivityDelegate()
}
```

`MainApplication` 第一版也保留在 assembly 中，只复用 host runtime 提供的 helper。`getPackages()` 必须由 assembly 调用 app 构建生成的 `PackageList`，再追加 autolink/手动包；library 不能直接访问 app 生成的 `PackageList`。

```kotlin
class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: DefaultReactNativeHost =
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> =
        HostRuntimeApplicationSupport.withHostRuntimePackages(
          PackageList(this@MainApplication).packages,
        )

      override fun getJSBundleFile(): String? =
        HostRuntimeApplicationSupport.resolveJsBundleFile(
          application = this@MainApplication,
          fallback = super.getJSBundleFile(),
          enableHotUpdateBundleResolver = BuildConfig.ENABLE_HOT_UPDATE_BUNDLE_RESOLVER,
        )
    }
}
```

`HostRuntimeApplicationSupport.withHostRuntimePackages` 的签名和职责应固定，避免 assembly 侧猜测：

```kotlin
object HostRuntimeApplicationSupport {
  fun withHostRuntimePackages(base: MutableList<ReactPackage>): MutableList<ReactPackage> {
    base.add(HostRuntimePackage())
    return base
  }
}
```

它只在 autolinking 生成的 `PackageList` 基础上追加 `HostRuntimePackage()`，不创建或读取 app 级 `PackageList`，也不追加产品 shell 相关 package。

后续如果确认 RN 0.84 app 模板可安全参数化，再考虑进一步下沉为 `HostRuntimeApplicationDelegate`。在第一版中，所有需要 `BuildConfig`、`PackageList`、`applicationId` 的逻辑都保留 assembly 所有权。

### 7.3 Native 配置对象

`host-runtime-rn84` 需要一个 native 配置入口，避免硬编码 retail 包名/action/tag/品牌资源。配置由 assembly 的 `MainActivity` / `SecondaryActivity` 创建 delegate 时显式构造并传入；需要全局初始化的部分由 assembly 的 `MainApplication.onCreate()` 调用 `HostRuntimeApplicationSupport.initialize(...)`。不要提供 `fromApplication(...)` 这类隐式工厂，因为品牌启动资源、日志前缀等产品事实不能从 `Application` 自动推断。

```kotlin
data class HostRuntimeNativeConfig(
  val logTagPrefix: String,
  val secondaryProcessSuffix: String = ":secondary",
  val startupOverlay: StartupOverlayConfig = StartupOverlayConfig.Disabled,
)

object SecondaryActions {
  fun restartRequest(context: Context) = "${context.packageName}.action.SECONDARY_RESTART_REQUEST"
  fun restartAck(context: Context) = "${context.packageName}.action.SECONDARY_RESTART_ACK"
  fun started(context: Context) = "${context.packageName}.action.SECONDARY_STARTED"
  fun stopped(context: Context) = "${context.packageName}.action.SECONDARY_STOPPED"
}

sealed interface StartupOverlayConfig {
  data object Disabled : StartupOverlayConfig
  data class LottieRawRes(val resId: Int) : StartupOverlayConfig
  data class ImageDrawableRes(val resId: Int) : StartupOverlayConfig
}
```

实现时不建议使用 `startupLogoResName: String?` 这种字符串资源名，因为它缺少类型约束且运行时失败晚。assembly 应直接传 `R.raw.startup_intro`、`R.drawable.startup_logo` 这类强类型资源 ID。

`StartupOverlayManager` 不再保持无配置 `object` 单例。它应改为以下二选一：

1. 普通类：`StartupOverlayManager(activity, config)`，由 `HostRuntimeActivityDelegate` 持有。
2. 保持 object，但所有入口方法显式接收 `StartupOverlayConfig`，不读取隐藏全局状态。

第一版建议使用普通类，避免多 Activity/多进程下共享错误配置。

Android broadcast action 必须稳定且避免跨 app 冲突。action 运行时用 `context.packageName` 派生：

```text
${context.packageName}.action.SECONDARY_RESTART_REQUEST
${context.packageName}.action.SECONDARY_RESTART_ACK
${context.packageName}.action.SECONDARY_STARTED
${context.packageName}.action.SECONDARY_STOPPED
```

接收端也必须同步使用同一套派生逻辑。第一版不依赖 `AndroidManifest.xml` 静态 `<intent-filter>`，全部由 `SecondaryProcessController.createRestartRequestFilter(context)` / `createSecondaryStateFilter(context)` 动态注册 receiver，内部统一调用 `SecondaryActions.*(context)`。这样不需要在 manifest 中写 `${applicationId}.action.*` 占位符，也避免 manifest merger 与 library/action 的耦合。

## 8. JS 迁移设计

### 8.1 从 retail assembly 迁入 host runtime 的 JS 文件

迁入后重命名 `assembly` 前缀为 `hostRuntime` 或保留兼容导出：

1. `src/turbomodules/specs/*`
2. `src/turbomodules/*`
3. `src/platform-ports/*`
4. `src/application/automation/*`
5. `src/application/topology/*`
6. `src/application/bootstrapRuntime.ts`
7. `src/application/createModule.ts`
8. `src/application/moduleManifest.ts`
9. `src/application/reportAppLoadComplete.ts`
10. `src/application/reportTerminalVersion.ts`
11. `src/application/resolveTopologyLaunch.ts`
12. `src/application/syncHotUpdateStateFromNativeBoot.ts`
13. `src/application/versionReportOutbox.ts`
14. `src/types/*`

需要改造的重点：

1. 原 `moduleName` 从固定文件变成 `productConfig.moduleName`。
2. 原 `releaseInfo` 从 `../generated/releaseInfo` 变成 `productConfig.releaseInfo`。
3. 原 `createRetailShellModule()` 从直接 import 变成 `options.createShellModule()`。
4. 原 `RootScreen` 从直接 import 变成 `options.RootScreen`。
5. 原 automation/log/storage namespace 从 `mixc-retail-assembly-rn84` 改成 `productConfig.productId` 派生。
6. 原 reactotron 配置从 package.json 字段读取改为 `productConfig.reactotron` 或可选默认。

### 8.2 `createHostKernelRuntimeApp`

原 `createApp.ts` 中 modules 列表可拆成三段：

1. Host 基础 modules：assembly/host runtime module、transport、topology、tcp、tdp、terminal log upload、workflow、ui runtime、runtime-react、input、topology bridge、admin console、terminal console。
2. Common business modules：organization IAM、catering product master data、catering store operating master data、master data workbench。这里需要谨慎：它们目前虽然服务 retail/catering，但不一定对所有未来 `xxx-shell` 都通用。
3. Product shell module：由 `createShellModule` 注入。

建议第一阶段 API 支持覆盖：

```ts
createHostApp({
  RootScreen,
  createShellModule,
  productConfig,
  extraKernelModules: [
    createOrganizationIamMasterDataModule(),
    createCateringProductMasterDataModule(),
    createCateringStoreOperatingMasterDataModule(),
    createMasterDataWorkbenchModule(),
  ],
})
```

`host-runtime-rn84` 不导出 `createDefaultMasterDataModules()`，也不依赖 catering/retail master-data business packages。原因是这些 modules 虽然对 `mixc-catering` 合理，但不是 RN84 宿主默认能力；放进 host runtime 会让未来非餐饮 assembly 误以为它们是通用基础设施，并显著加重 host runtime 依赖树。

如果需要复用餐饮后台能力，可以在 `catering-shell` 或 `mixc-catering-assembly-rn84` 内提供产品级 helper，例如：

```ts
import {createCateringHostBusinessModules} from '@impos2/ui-integration-catering-shell'

createHostApp({
  RootScreen,
  createShellModule,
  productConfig,
  extraKernelModules: createCateringHostBusinessModules(),
})
```

这样 host runtime 只内置真正通用的 base modules，产品/行业 modules 由 shell 或 assembly 显式注入。`createCateringHostBusinessModules()` 第一阶段放在 `catering-shell` 是临时便利方案；如果后续多个 catering assembly 共同复用，应再提取到更合适的独立 kernel/business composition 包，避免 UI integration shell 长期承担 kernel 模块组装职责。

### 8.3 `HostRuntimeApp` 渲染流程

目标保留现有 `App.tsx` 语义：

1. normalize launch props。
2. resolve topology launch。
3. create runtime app。
4. start runtime。
5. start automation host。
6. mount `Provider` + `UiRuntimeProvider` + `RootScreen`。
7. report app load complete。
8. report terminal version。
9. boot error fallback UI。
10. unmount 时停止 automation subscription。

差异点全部来自 options：

1. boot log tag。
2. testID 前缀。
3. product shell root screen。
4. release/version info。

## 9. Android app / Gradle 设计

### 9.1 `host-runtime-rn84/android/build.gradle`

应使用：

```gradle
apply plugin: 'com.android.library'
apply plugin: 'org.jetbrains.kotlin.android'
apply plugin: 'com.facebook.react'

def safeExt = { name, fallback ->
  rootProject.ext.has(name) ? rootProject.ext.get(name) : fallback
}

react {
  jsRootDir = file("..")
  libraryName = "Impos2HostRuntimeRN84Spec"
  codegenJavaPackageName = "com.impos2.hostruntimern84.turbomodules"
}

android {
  namespace 'com.impos2.hostruntimern84'
  compileSdk safeExt('compileSdkVersion', 35)

  defaultConfig {
    minSdk safeExt('minSdkVersion', 24)
    consumerProguardFiles 'consumer-rules.pro'
  }
}

dependencies {
  implementation 'com.facebook.react:react-android'
  implementation project(':adapter-android-v2')
  implementation 'androidx.core:core-ktx:1.13.1'
  implementation 'androidx.core:core-splashscreen:1.0.1'
  implementation 'com.airbnb.android:lottie:6.7.1'
}
```

`compileSdk` / `minSdk` 必须带 fallback，因为 RN module library 被 assembly app 纳入构建时，`rootProject` 是 assembly 的 Android Gradle root，不是 monorepo 根。若 assembly root 没有定义 `ext.compileSdkVersion`，library 仍应可编译。

`react {}` 配置需在实施时按 RN 0.84 官方 module library 模板核对；核心要求是 `sourceDir` 指向的 `android/build.gradle` 应用 `com.facebook.react` plugin，并能让 Codegen 从 package `codegenConfig` 扫描 `src/turbomodules/specs`。`jsRootDir = file("..")` 的方向是对的，因为 `android/..` 就是 `host-runtime-rn84/`；`codegenJavaPackageName` 是否需要在 Gradle 显式声明，应以 RN 0.84 模板为准，避免与 `package.json` 的 `codegenConfig.android.javaPackageName` 重复冲突。

注意：如果 `project(':adapter-android-v2')` 在 app settings 中不可见，Gradle 会失败。因此第一阶段 `mixc-catering-assembly-rn84/android/settings.gradle` 仍需 include adapter-lib：

```gradle
include ':adapter-android-v2'
project(':adapter-android-v2').projectDir = file('../../../../3-adapter/android/adapter-android-v2/adapter-lib')
```

但不 include `host-runtime-rn84`，让 RN autolinking include 它。

### 9.2 `mixc-catering-assembly-rn84/android/app/build.gradle`

保留 app 级配置：

1. `applicationId "com.impos2.mixccateringassemblyrn84"`
2. `namespace "com.impos2.mixccateringassemblyrn84"`
3. `versionCode` / `versionName`
4. signing configs
5. `ENABLE_HOT_UPDATE_BUNDLE_RESOLVER`
6. RN `react { root, reactNativeDir, codegenDir, cliFile, entryFile, hermesCommand, autolinkLibrariesWithApp() }`
7. workspace bundle source roots：`1-kernel`、`2-ui`、`3-adapter/android/host-runtime-rn84`

依赖：

```gradle
dependencies {
  implementation("com.facebook.react:react-android")
  implementation("androidx.core:core-splashscreen:1.0.1")
  implementation("com.airbnb.android:lottie:6.7.1")
  if (hermesEnabled.toBoolean()) implementation("com.facebook.react:hermes-android") else implementation jscFlavor
}
```

`host-runtime-rn84` 应由 autolinking 自动加入，不在 app dependencies 手写 `implementation project(':host-runtime-rn84')`，除非 RN CLI 发现失败。

## 10. Workspace 接入

Root `package.json` workspaces 需要新增：

```json
"3-adapter/android/host-runtime-rn84",
"2-ui/2.3-integration/catering-shell",
"4-assembly/android/mixc-catering-assembly-rn84"
```

Root scripts 可新增：

```json
"assembly:android-mixc-catering-rn84:test": "corepack yarn workspace @impos2/assembly-android-mixc-catering-rn84 test",
"assembly:android-mixc-catering-rn84:type-check": "corepack yarn workspace @impos2/assembly-android-mixc-catering-rn84 type-check",
"assembly:android-mixc-catering-rn84:android": "corepack yarn workspace @impos2/assembly-android-mixc-catering-rn84 android"
```

`host-runtime-rn84/package.json` 建议：

```json
{
  "name": "@impos2/host-runtime-rn84",
  "version": "1.0.0",
  "private": true,
  "react-native": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-runtime-shell-v2": "workspace:*",
    "@impos2/kernel-base-transport-runtime": "workspace:*",
    "@impos2/kernel-base-topology-runtime-v3": "workspace:*",
    "@impos2/kernel-base-tcp-control-runtime-v2": "workspace:*",
    "@impos2/kernel-base-tdp-sync-runtime-v2": "workspace:*",
    "@impos2/kernel-base-terminal-log-upload-runtime-v2": "workspace:*",
    "@impos2/kernel-base-ui-runtime-v2": "workspace:*",
    "@impos2/kernel-base-workflow-runtime-v2": "workspace:*",
    "@impos2/ui-base-runtime-react": "workspace:*",
    "@impos2/ui-base-input-runtime": "workspace:*",
    "@impos2/ui-base-admin-console": "workspace:*",
    "@impos2/ui-base-terminal-console": "workspace:*",
    "@impos2/ui-base-topology-runtime-bridge": "workspace:*"
  },
  "peerDependencies": {
    "react": "19.2.3",
    "react-native": "0.84.1",
    "react-redux": "^9.1.0"
  }
}
```

注意：`adapter-android-v2` 是纯 Android Gradle library，`host-runtime-rn84` 的 JS `package.json` 不声明 `@impos2/adapter-android-v2` 依赖，避免误导维护者以为 JS 层可以 import adapter。Android 依赖只通过 Gradle include + `implementation project(':adapter-android-v2')` 表达。

## 11. 测试与验证设计

### 11.1 单元测试迁移

从 retail assembly 平移到 host runtime 的测试：

1. `assembly-native-wrappers.spec.ts` -> `host-runtime-native-wrappers.spec.ts`
2. `assembly-platform-ports.spec.ts` -> `host-runtime-platform-ports.spec.ts`
3. `assembly-state-storage.spec.ts` -> `host-runtime-state-storage.spec.ts`
4. `assembly-topology-input.spec.ts` -> `host-runtime-topology-input.spec.ts`
5. `assembly-resolve-topology-launch.spec.ts` -> `host-runtime-resolve-topology-launch.spec.ts`
6. `assembly-automation-dispatcher.spec.ts` -> `host-runtime-automation-dispatcher.spec.ts`
7. `assembly-bootstrap-runtime.spec.ts` -> `host-runtime-bootstrap-runtime.spec.ts`
8. `assembly-create-app.spec.ts` -> `host-runtime-create-app.spec.ts`
9. `assembly-report-app-load-complete.spec.ts`
10. `assembly-report-terminal-version.spec.ts`

Catering assembly 只保留薄测试：

1. `app-wires-catering-shell.spec.tsx`：验证 `RootScreen/createShellModule/productConfig` 传入 host runtime。
2. `metro-config.spec.ts`：验证 Metro workspace watch folders / resolver。
3. 可选 CI/lint 检查：grep assembly `package.json` 不允许出现 `codegenConfig`；不建议为此单独写高维护成本的 `package-config.spec.ts`。

### 11.2 Android 构建验证

最低验收：

```bash
corepack yarn workspace @impos2/host-runtime-rn84 type-check
corepack yarn workspace @impos2/host-runtime-rn84 test
corepack yarn workspace @impos2/assembly-android-mixc-catering-rn84 type-check
corepack yarn workspace @impos2/assembly-android-mixc-catering-rn84 test
cd 4-assembly/android/mixc-catering-assembly-rn84/android && ./gradlew :app:assembleDebug
```

Codegen 专项验收：

1. Gradle build 生成 `NativeDeviceTurboModuleSpec` 等文件。
2. Kotlin TurboModule 编译通过。
3. APK 中只有一套 `DeviceTurboModule` 等 ReactModuleInfo。
4. `mixc-catering-assembly-rn84/package.json` 没有 `codegenConfig`。

### 11.3 真机/模拟器验证

完整验收：

1. 安装 debug app。
2. Metro 启动后主屏进入 shell root screen。
3. 主屏 load complete 上报成功。
4. 双屏设备或模拟 display 下副屏可启动。
5. automation socket hello/smoke 能返回。
6. topology host start/status 正常。
7. native state storage 写入后 app 重启仍可恢复。
8. debug 热更新关闭时走 Metro bundle；release/local release debug signing 时走 boot marker resolver。

## 12. 迁移步骤建议

### 阶段 0：冻结现状

1. 不改 `mixc-retail-assembly-rn84`。
2. 记录当前 retail 测试命令和 Android assemble 结果，作为对照。
3. 明确本次新包以“复刻能力”为目标，不追求 retail 立即切换。

### 阶段 1：创建 `catering-shell`

1. 复制 `2-ui/2.3-integration/retail-shell` 到 `catering-shell`。
2. 改 package name、moduleName、测试命名。
3. 保持导出 API：`RootScreen`、`createModule`。
4. 跑 type-check/test。

### 阶段 2：创建 `host-runtime-rn84` 非 Codegen JS 层

1. 复制 assembly 中非 Spec 的 `platform-ports`、`application`、`types`。
2. 暂不迁移 `src/turbomodules/specs`，避免 specs 已进入 library 但 Android Codegen 链路尚未建立的半成品状态。
3. 抽 `createHostApp`。
4. 抽 `productConfig`，移除 retail hardcode。
5. 先迁移不依赖 native specs 的 vitest。

### 阶段 3：创建 `host-runtime-rn84` Android library 与 Codegen 闭环

1. 建立 RN module library Gradle 结构。
2. 同一阶段迁入 `src/turbomodules/specs` 和 TurboModule Kotlin 实现，保证 JS Spec + Kotlin `Native*Spec` + Gradle Codegen 一次闭环。
3. 迁入 startup/restart/hotupdate 通用类。
4. 将 package 改为 `com.impos2.hostruntimern84`。
5. 将 broadcast action 改为基于 `context.packageName` 派生，并使用动态 receiver filter。
6. 跑 Gradle library compile 或通过 catering app assemble 验证。
7. 再迁移依赖 native wrappers 的 vitest。

### 阶段 4：创建 `mixc-catering-assembly-rn84`

1. 复制 retail assembly 外壳。
2. 删除 `src/turbomodules`、`src/platform-ports`、大部分 `src/application`。
3. `App.tsx` 改为调用 `createHostApp`。
4. Android native 类改为继承/委托 host runtime。
5. 保留并替换品牌资源。
6. package 改名、app registry name 改名、Gradle namespace/applicationId 改名。
7. 跑 type-check/test/assembleDebug。

### 阶段 5：收敛模板

1. 如果 catering app 跑通，再整理一个 `assembly-rn84-template` 文档或脚手架。
2. 后续新 `xxx-assembly-rn84` 从 catering 的薄形态复制，而不是从 retail 复制。
3. retail assembly 可在后续独立任务中迁移到 `host-runtime-rn84`，但不是本次任务的一部分。

## 13. 剩余设计问题

### 13.1 Common business modules 是否应进入 host runtime

当前 retail assembly 直接装配了 organization IAM、catering product、catering store operating、master data workbench。它们对 catering 合理，但对未来任意 `xxx-shell` 不一定合理。

建议：

1. Host runtime 只内置 base runtime/UI modules。
2. 通过 `extraKernelModules` 接收业务/common modules。
3. 不在 host runtime 提供 master-data convenience preset；如需复用，由 `catering-shell` 或 catering assembly 提供产品级 helper。

### 13.2 Native Activity 是继承还是委托

继承最薄但风险更高：

```kotlin
class MainActivity : HostRuntimeMainActivity()
```

委托稍多几行但边界更稳：

```kotlin
class MainActivity : ReactActivity() {
  private val delegate = HostRuntimeActivityDelegate(...)
}
```

第一版明确采用委托。原因是 `BuildConfig`、`PackageList`、`applicationId`、`mainComponentName` 都是 app 级事实，应该留在 assembly。host runtime 只提供生命周期 helper、launch options、secondary/display/startup/restart 编排能力，不替 assembly 继承 RN app 模板。

### 13.3 `MainApplication` 能否完全下沉

`MainApplication` 受 app `BuildConfig`、`PackageList`、`getJSBundleFile()`、RN `loadReactNative()` 影响较大。完全下沉可能需要 host runtime 反向依赖 app 配置。

建议第一版：

1. `MainApplication` 留在 assembly。
2. host runtime 提供 `HostRuntimeApplicationSupport` helper，而不是完整持有 `DefaultReactNativeHost`。
3. `getPackages()` 由 assembly 调用 `PackageList(this).packages` 后传给 helper 追加 host runtime packages；library 不直接访问 app 生成的 `PackageList`。
4. assembly `MainApplication` 仍然只有少量配置代码。

这样比完全复制旧 `MainApplication` 薄很多，也降低 New Architecture 模板风险。

## 14. 验收标准

完成后应满足：

1. `mixc-retail-assembly-rn84` 文件未被修改。
2. `host-runtime-rn84` 是唯一拥有 RN84 host TurboModule specs 的新包。
3. `mixc-catering-assembly-rn84` 没有 `src/turbomodules/specs`，没有 Kotlin TurboModule 实现。
4. `mixc-catering-assembly-rn84/App.tsx` 只负责传入 `catering-shell` 与产品配置。
5. Android debug build 通过 Codegen 编译。
6. JS type-check/test 通过。
7. 文档记录清楚后续新 assembly 应复制 catering 薄形态，而不是复制 retail 老工程。
