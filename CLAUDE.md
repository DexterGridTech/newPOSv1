# 沟通过程

1. 全程使用中文与我沟通

# 技术要求思路

1. 模块与功能设计，必须考虑抽象与复用
2. 代码需要简洁，能用类型表示的，就不用字符串
3. 将变量抽离出业务代码统一维护
4. 如果遇到网络问题，请使用[http://127.0.0.1:7890](http://127.0.0.1:7890)或[https://127.0.0.1:7890](https://127.0.0.1:7890)作为临时代理
5. 使用`~/.zshrc`来加载环境变量
6. Monorepo 工程中对于需要统一版本号的 npm 包，在根目录 package.json 中约定版本
7. 使用 yarn workspace 管理 Monorepo 工程
8. JS 代码使用 TS 开发，强类型管控
9. 创建、修改 UI 界面时，所使用的组件、属性等，必须要考虑 react native 裸工程是否 100% 兼容
10. 使用 ui-ux-pro-max-skill 来做 UI 设计
11. 如果有文档输出，请输出到根目录 ai-result 中
12. adb 的路径在`/Users/dexter/Library/Android/sdk/platform-tools/adb`
13. 使用 TurboModule 作为 JS 代码和原生代码之间的通信通道
14. 使用 Hermes 作为 JS 代码的引擎
15. 2-ui、3-adapter 目录中的 package.json 要注意，每个包中都有 dev 目录用于开发调试，和 src 目录用于导出给其他包依赖。本包程序单独启动时，不启动 src 的 index。同时确保作为依赖导出的时候，dev 目录不会被导出

# 背景

我在做一个 Monorepo 结构的企业级的 React Native 裸工程项目，目标是设计一个业界通用的产品，既满足架构稳定性又要满足业务多样性。 设计理念是将项目分层实现，总共分为 4 层：业务逻辑层、UI 层、适配层、整合层。

* 业务逻辑层是用 redux toolkit 和 redux observable 实现的，分功能模块，每个模块一个 package，有开发调试的代码，但只导出核心功能给其他工程集成。无界面，对 kotlin 层的调用封装了 Adapter 接口，后续适配层需实现接口并注入。
* UI 层是用 React Native expo 实现的，集成业务逻辑层，方便在 web 中调试，有开发调试的代码，但只导出核心功能给其他工程集成。针对不同业务，会有不同的 package
* 适配层是 React Native 裸工程，提供对 Android 端的调用逻辑，以及实现 Adapter 的接口，针对不同的 android 机型和硬件差异，会有不同的 package，有开发调试的代码，但只导出核心功能（包括 kotlin 和 ts 的部分）给其他工程集成，使用TurboModule和Hermes，不使用fabric。
* 整合层是 React Native 裸工程，不做业务逻辑，仅做集成。对于具体机型和具体业务，将 UI 层与适配层集成在一起。，使用TurboModule和Hermes，，不使用fabric。


### 一、适配层 Package A 开发核心注意事项

适配层 A 是 \*\*「原生能力 + Adapter 接口」的标准化封装层 \*\*，面向整合层 B 提供 \*\*「TS/JS 标准接口 + Android 原生模块」**，开发时所有设计都要围绕**「可复用、可替换、易集成」\*\*，核心注意事项如下：

#### 1. 严格遵循「接口实现规范」，与业务逻辑层解耦

* 必须**严格实现业务逻辑层定义的 Adapter 接口**（建议把接口抽为**独立的公共包**，如`@mono/core-adapter`，让 A 和业务逻辑层都依赖这个包），禁止自定义接口入参 / 出参，确保后续替换适配层时，整合层 B 无需修改代码。
* Adapter 接口的实现类**做纯能力映射**，不包含任何业务逻辑（比如业务逻辑层定义`PayAdapter`，A 只实现`pay(orderId: string): Promise<boolean>`，不判断订单金额、状态等）。
* 所有接口返回**Promise 化**（适配 RN 的异步特性），异常统一封装为**标准化错误对象**（如`{ code: string, msg: string, data: any }`），避免整合层 B 处理零散的异常格式。

#### 2. 原生模块开发贴合 TurboModule/Hermes（无 Fabric）规范

* 按 RN 官方**TurboModule 裸工程开发规范**实现 Android 原生能力（Kotlin 优先），**禁用 Fabric 相关 API**，注册方式用「传统 TurboModule 注册」（`TurboReactPackage`），而非 Fabric 的`ReactPackage`。
* 所有自定义 TurboModule**实现懒加载**（Hermes 优化），在`TurboReactPackage`中通过`getModuleClass`动态注册，避免启动时加载所有原生模块。
* 原生代码与 TS/JS 层的**数据交互严格序列化**：仅用 RN 支持的基础类型（string/number/boolean/Array/Map），复杂对象通过`JSON.stringify/parse`传递，避免 Hermes 下的类型错乱。
* 原生模块的**生命周期与 RN 宿主解耦**：A 的原生代码不依赖整合层 B 的 Android 生命周期（如`Application`、`Activity`），而是通过**回调 / 事件**让 B 传递生命周期（比如 B 在`onCreate`中调用 A 的`init`方法）。

#### 3. 包的「导出控」：只露核心，隔离调试代码

* 你的需求是「有开发调试代码，但只导出核心功能」，需通过**3 个配置**实现隔离：
  1. `package.json`中指定 \*\*`main`（生产入口）**和**自定义`dev:main`（调试入口）\*\*，生产只暴露核心接口 / 模块；
  2. TS 代码中用**环境变量条件导出**（如`process.env.NODE_ENV === 'production'`时，不导出调试工具 / 测试用例）；
  3. 原生代码中用**Android BuildType**隔离（`debug`模式编译调试代码，`release`模式剔除，通过`if (BuildConfig.DEBUG)`判断）。
* `package.json`中必须配置 \*\*`types`字段 \*\*（指向 TS 声明文件），确保整合层 B 有完整的类型提示，提升集成效率。

#### 4. 原生代码的「机型 / 硬件适配隔离」

* 针对不同 Android 机型 / 硬件的差异，**将差异化逻辑抽为独立的 Kotlin 模块**（如`adapter-a-xx`、`adapter-a-yy`），核心包 A 只保留**通用逻辑 + 适配入口**，通过**配置化**让整合层 B 选择具体的适配子模块。
* 原生依赖（如硬件 SDK、第三方原生库）**声明为`api`而非`implementation`**（Android Gradle），确保整合层 B 能传递依赖到自身的原生工程中。

#### 5. 依赖管理：用 Peer Dependencies 做版本约束

* A 作为被集成的包，**所有与 RN 相关的核心依赖**（`react-native`、`hermes-engine`、`@react-native/turbomodule-core`）都要声明在 \*\*`peerDependencies`**中，且指定**兼容的版本范围 \*\*（如`react-native: ^0.72.0 || ^0.73.0`），禁止放在`dependencies`中。
  * 原因：避免 Monorepo 中出现多版本 RN，导致原生模块冲突、JS 桥接异常。
* 仅将**A 自身的私有依赖**（如 Kotlin 协程、TS 工具库）放在`dependencies`中，且优先选择**无原生代码**的纯 JS/TS 库。

#### 6. 调试能力：提供独立的调试入口，不依赖整合层

* 为 A 开发**极简的 RN 调试 Demo**（裸工程），包含 Adapter 接口的调用示例、TurboModule 的测试代码，可独立运行、调试，确保 A 的能力在被集成前是完整可用的。
* 开启 Hermes 的**调试模式**（`HermesDebug`），保留 Source Map，方便整合层 B 联调时定位 A 的问题。

### 二、整合层 Package B 开发核心注意事项

整合层 B 是 \*\*「机型 / 业务专属的纯集成层」**，核心职责是**「选择 UI 层 + 适配层 + 注入配置」**，**禁止编写任何业务逻辑、原生能力、Adapter 接口实现**，开发时的核心原则是**「配置化、可插拔、无侵入」\*\*，注意事项如下：

#### 1. 坚守「纯集成原则」，零业务 / 底层代码

* B 的代码目录中，**只保留「集成配置、入口文件、机型 / 业务专属配置」**，禁止：
  1. 修改适配层 A 的接口实现；
  2. 编写自定义 TurboModule / 原生代码（特殊情况可抽为新的适配包子包）；
  3. 在 B 中写业务逻辑（如 Redux reducer、页面逻辑）；
  4. 硬编码机型 / 业务参数（如接口地址、硬件 SDK 密钥）。
* 所有定制化需求 \*\* 通过「配置注入」\*\* 实现（如向 UI 层注入业务主题、向适配层 A 注入机型配置）。

#### 2. 原生工程：统一配置，复用适配层 A 的原生能力

* B 作为 RN 裸工程，**Android 原生工程的基础配置**（compileSdk、minSdk、targetSdk、Kotlin 版本、Hermes 开关、TurboModule 配置）**必须与适配层 A 完全一致**，避免原生编译冲突。
  * 建议：把 RN 原生基础配置抽为**独立的 Gradle 脚本包**（如`@mono/rn-gradle-config`），让 A 和所有 B 都引用这个包，实现配置统一。
* 禁止修改 A 的原生代码，若需要扩展原生能力，**新建适配包子包**（如`@mono/adapter-a-ext`），再让 B 集成该子包，保持 A 的核心稳定。

#### 3. 依赖管理：中心化管理，锁定所有依赖版本

* B 作为**最终的集成产物**，是 Monorepo 中**唯一声明 RN 核心依赖**（`react-native`、`hermes-engine`等）在`dependencies`中的包，所有被集成的包（UI 层、适配层 A、业务逻辑层）的`peerDependencies`都由 B 来满足。
* 在 B 的`package.json`中，**锁定所有依赖的版本**（如`react-native: 0.72.6`），禁止使用模糊版本（`^`/`~`），确保构建的可重复性。
* 统一管理**原生依赖的版本**（如 Android Gradle Plugin、Gradle、Kotlin），通过根目录的`gradle.properties`做全局配置（Monorepo 共享）。

#### 4. 配置化集成：抽离机型 / 业务配置，实现快速切换

* 为 B 创建**专属的配置文件**（如`config/business.ts`、`config/device.ts`），包含：
  1. UI 层的主题配置（颜色、字体、布局）；
  2. 适配层 A 的机型配置（硬件参数、原生 SDK 配置）；
  3. 业务逻辑层的环境配置（接口地址、Redux 中间件配置）；
  4. 第三方服务配置（埋点、推送、统计）。
* 配置文件**支持多环境切换**（dev/test/prod），通过环境变量（`APP_ENV`）加载，无需修改代码。

#### 5. 入口文件：做「唯一的注入点」，串联所有分层

* B 的 RN 入口文件（`index.tsx`/`App.tsx`）是**整个应用的唯一入口**，核心职责是：
  1. 初始化 Hermes、TurboModule；
  2. 将适配层 A 的 Adapter 实现**注入到业务逻辑层**的容器中（如 Redux store、全局 Context、依赖注入容器）；
  3. 加载 UI 层的核心组件，并注入业务 / 机型配置；
  4. 初始化原生模块（如调用 A 的`init`方法，传递 B 的 Android 生命周期）。
* 入口文件**保持极简**，不包含任何渲染逻辑，仅做「初始化 + 注入」。

#### 6. 构建与调试：适配企业级交付，支持多端打包

* B 作为最终交付物，需配置**完整的构建脚本**（`package.json`的`scripts`），支持：
  1. RN Metro 打包（dev/release）；
  2. Android 原生打包（debug/release/ 打渠道包）；
  3. 清缓存（Metro/Android/Gradle）；
  4. 联调命令（如`yarn run android:debug`）。
* 开启**远程调试**（Hermes Chrome 调试），并配置**sourceMap 包含所有依赖包**（A、UI 层、业务逻辑层），方便联调时定位问题。

#### 7. 工程隔离：Monorepo 下的专属环境，避免相互影响

* B 的 RN 裸工程**拥有独立的`ios/`（若需）、`android/`目录**，独立的 Metro 配置（`metro.config.js`），禁止与其他 B 包共享原生工程。
* Metro 配置中**指定专属的缓存目录**，避免不同 B 包的构建缓存冲突。

### 三、整合层 B 集成适配层 A 的完整流程

B 集成 A 的核心是 \*\*「两层联动」**：**TS/JS 层的接口引用 + Android 原生层的 TurboModule 注册 / 依赖合并**，再加上**Adapter 接口的注入 \*\*（让业务逻辑层 / UI 层能使用 A 的实现），全程基于 Monorepo 的 Yarn Workspaces，无需发布包，直接本地引用。

#### 前提准备

1. 已完成 Yarn Monorepo 的基础配置（根目录`package.json`配置`workspaces`）；
2. 适配层 A 的`package.json`已配置**包名**（如`@mono/adapter-a`）、`main`、`types`、`peerDependencies`；
3. 业务逻辑层已将 Adapter 接口抽为公共包（如`@mono/core-adapter`），A 和 B 都已依赖该包。

#### 步骤 1：TS/JS 层 集成 A（核心：包引用 + 接口导入）

##### 1.1 B 中添加 A 的依赖

在**根目录**执行 Yarn 命令，为 B 添加 A 的本地依赖（Monorepo 特性，无需 npm 发布）：

bash

运行

```
# 格式：yarn add 适配层包名 -W --prefix 整合层包目录
yarn add @mono/adapter-a -W --prefix packages/app/business-device-b
```

* `-W`：表示在 Monorepo 根目录执行；
* `--prefix`：指定依赖添加到哪个包（整合层 B 的目录）；
* 执行后，B 的`package.json`的`dependencies`中会出现`@mono/adapter-a: "*"`（Yarn Workspaces 自动处理为本地引用）。

##### 1.2 B 中导入 A 的核心能力

在 B 的代码中，直接通过**包名**导入 A 的 Adapter 实现、TS 工具方法，无需相对路径（Monorepo 的 Yarn Workspaces 会自动解析）：

tsx

```
// packages/app/business-device-b/src/config/adapter.ts
// 导入业务逻辑层的标准接口
import type { PayAdapter, UserAdapter } from '@mono/core-adapter';
// 导入适配层A的实现类（A严格实现了标准接口）
import { PayAdapterImpl, UserAdapterImpl } from '@mono/adapter-a';

// 实例化适配层实现（可传入B的机型配置）
export const payAdapter: PayAdapter = new PayAdapterImpl({
  deviceType: 'XX机型',
  paySdkVersion: '1.0.0',
});
export const userAdapter: UserAdapter = new UserAdapterImpl({
  isSupportBiometric: true,
});
```

#### 步骤 2：Android 原生层 集成 A（核心：Gradle 引用 + TurboModule 注册）

适配层 A 作为 RN 裸工程，包含`android/`原生目录，B 需要将 A 的原生模块**引入到自身的 Android 工程中**，并注册 A 的 TurboModule，分为**Gradle 配置**和**TurboModule 注册**两步，均为**无侵入式配置**。

##### 2.1 Gradle 配置（settings.gradle + build.gradle）

###### 第一步：在 B 的`android/settings.gradle`中引入 A 的 Android 模块

在 B 的`android/settings.gradle`末尾添加以下代码，**引用 Monorepo 中 A 的 android 目录**：

gradle

```
// packages/app/business-device-b/android/settings.gradle
// 1. 定义A的原生模块路径（Monorepo相对路径，根据你的目录结构调整）
def adapterAProjectDir = file("../../adapter/a/android")
// 2. 引入A的原生模块
include(":adapter-a")
project(":adapter-a").projectDir = adapterAProjectDir

// 若A有子适配模块（如adapter-a-ext），同理引入
// def adapterAExtProjectDir = file("../../adapter/a-ext/android")
// include(":adapter-a-ext")
// project(":adapter-a-ext").projectDir = adapterAExtProjectDir
```

###### 第二步：在 B 的`app/build.gradle`中添加 A 的依赖

在 B 的`android/app/build.gradle`的`dependencies`块中，添加 A 的原生模块依赖：

gradle

```
// packages/app/business-device-b/android/app/build.gradle
dependencies {
  // 其他依赖...
  // 引入适配层A的原生模块
  implementation project(":adapter-a")
  // 若有子适配模块，同理添加
  // implementation project(":adapter-a-ext")
}
```

###### 第三步：确保 A 和 B 的原生配置一致

将 A 的`android/build.gradle`、`android/gradle.properties`中的**基础配置**（如 compileSdk、minSdk、Hermes 开关）抽为公共 Gradle 脚本，让 B 的 Android 工程引用，示例：

gradle

```
// packages/app/business-device-b/android/build.gradle
// 引用Monorepo根目录的公共Gradle配置
apply from: file("../../../gradle/config.gradle")
```

##### 2.2 TurboModule 注册（MainApplication.kt）

适配层 A 的 TurboModule 需要在 B 的`MainApplication.kt`中**注册到 RN 的 TurboModule 管理器**，才能让 JS 层调用，步骤如下：

###### 第一步：A 中暴露 TurboReactPackage

在 A 的 Android 工程中，创建**自定义的 TurboReactPackage**，并将所有 TurboModule 注册到其中，且**对外暴露该 Package**（Kotlin 的`public`）：

kotlin

```
// packages/adapter/a/android/src/main/kotlin/com/mono/adaptera/AdapterATurboPackage.kt
package com.mono.adaptera

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.turbomodule.core.interfaces.TurboModule

class AdapterATurboPackage : TurboReactPackage() {
  // 注册TurboModule（无Fabric，重写此方法）
  override fun getModuleClass(name: String): Class<out NativeModule>? {
    return when (name) {
      // A中实现的TurboModule，如PayTurboModule、BiometricTurboModule
      "PayTurboModule" -> PayTurboModule::class.java
      "BiometricTurboModule" -> BiometricTurboModule::class.java
      else -> null
    }
  }

  // Hermes TurboModule支持
  override fun getTurboModule(name: String, reactContext: ReactApplicationContext): TurboModule? {
    return super.getTurboModule(name, reactContext)
  }
}
```

###### 第二步：B 中注册 A 的 TurboReactPackage

在 B 的`MainApplication.kt`中，将 A 的`AdapterATurboPackage`添加到`getPackages`方法中：

kotlin

```
// packages/app/business-device-b/android/src/main/kotlin/com/mono/businessdeviceb/MainApplication.kt
package com.mono.businessdeviceb

import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.mono.adaptera.AdapterATurboPackage // 导入A的TurboPackage
import java.util.Arrays.asList

class MainApplication : Application(), ReactApplication {

  private val mReactNativeHost = object : DefaultReactNativeHost(this) {
    override fun getPackages(): List<ReactPackage> {
      // 注册原生Package，添加A的TurboPackage
      return asList(
          MainReactPackage(),
          AdapterATurboPackage() // 适配层A的TurboModule注册
          // 其他Package...
      )
    }

    // 开启Hermes（必须与A一致）
    override fun getUseHermes(): Boolean = BuildConfig.IS_HERMES_ENABLED
  }

  override fun getReactNativeHost(): ReactNativeHost = mReactNativeHost
}
```

#### 步骤 3：Adapter 接口注入（核心：让上层使用 A 的实现）

这是**分层架构的关键步骤**：将适配层 A 的 Adapter 实现**注入到业务逻辑层**，让业务逻辑层 / UI 层无需感知 A 的存在，仅通过标准接口调用能力，实现**依赖倒置**（业务逻辑层依赖接口，而非具体实现）。

推荐两种**业界通用的注入方式**（根据你的 Redux 架构选择）：

##### 方式 1：Redux Store 注入（结合 Redux Toolkit/Observable）

将 Adapter 实例挂载到 Redux store 的`extra`字段中（Redux Toolkit 支持），让 Redux Thunk/Observable 能通过`getState`/`dispatch`获取 Adapter 实例：

tsx

```
// packages/app/business-device-b/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { createEpicMiddleware } from 'redux-observable';
// 业务逻辑层的reducer/epic
import { rootReducer } from '@mono/business-core/reducers';
import { rootEpic } from '@mono/business-core/epics';
// B中实例化的A的Adapter实现
import { payAdapter, userAdapter } from '../config/adapter';

// 创建epic中间件
const epicMiddleware = createEpicMiddleware();

// 配置Redux Store，将Adapter注入extra
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // 允许Adapter实例（包含函数）在store中传递
      serializableCheck: false,
    }).concat(epicMiddleware),
  // 注入Adapter实现，上层通过store.extra获取
  extra: {
    payAdapter,
    userAdapter,
  },
});

// 运行rootEpic
epicMiddleware.run(rootEpic);

// 导出类型，方便TS提示
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppExtra = typeof store.extra; // Adapter类型
```

业务逻辑层的 Epic/Thunk 中调用 Adapter：

tsx

```
// 业务逻辑层的epic（@mono/business-core/epics/pay.epic.ts）
import { ofType } from 'redux-observable';
import { mergeMap, map, catchError } from 'rxjs/operators';
import { payActions } from '../slices/paySlice';
import type { AppExtra, AppDispatch, RootState } from './types';

// 支付Epic，通过extra获取A的PayAdapter实现
export const payEpic = (action$: any, state$: any, extra: AppExtra) =>
  action$.pipe(
    ofType(payActions.payInitiate.type),
    mergeMap(async (action) => {
      try {
        // 调用适配层A的实现，业务逻辑层无需感知A
        const result = await extra.payAdapter.pay(action.payload.orderId);
        return payActions.paySuccess({ result });
      } catch (err) {
        return payActions.payFail({ error: err as { code: string; msg: string } });
      }
    }),
    catchError((err) => of(payActions.payFail({ error: err })))
  );
```

##### 方式 2：全局 Context 注入（React 层）

若 UI 层需要直接调用 Adapter，可通过 React 的**全局 Context**注入 Adapter 实例，适合非 Redux 的 UI 层逻辑：

tsx

```
// packages/app/business-device-b/src/context/AdapterContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import type { PayAdapter, UserAdapter } from '@mono/core-adapter';
import { payAdapter, userAdapter } from '../config/adapter';

// 定义Context类型
interface AdapterContextType {
  payAdapter: PayAdapter;
  userAdapter: UserAdapter;
}

// 创建Context
const AdapterContext = createContext<AdapterContextType | undefined>(undefined);

// 提供Context的Provider组件
export const AdapterProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AdapterContext.Provider value={{ payAdapter, userAdapter }}>
      {children}
    </AdapterContext.Provider>
  );
};

// 自定义Hook，方便UI层使用
export const useAdapter = () => {
  const context = useContext(AdapterContext);
  if (!context) {
    throw new Error('useAdapter must be used within an AdapterProvider');
  }
  return context;
};
```

在 B 的入口文件中包裹 Provider：

tsx

```
// packages/app/business-device-b/src/App.tsx
import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { AdapterProvider } from './context/AdapterContext';
import { store } from './store';
// 导入UI层的核心组件（业务专属）
import { BusinessApp } from '@mono/ui-business-x';

const App = () => {
  return (
    <ReduxProvider store={store}>
      <AdapterProvider>
        {/* 注入UI层，无需感知适配层A */}
        <BusinessApp />
      </AdapterProvider>
    </ReduxProvider>
  );
};

export default App;
```

UI 层中调用 Adapter：

tsx

```
// UI层组件（@mono/ui-business-x/src/components/PayButton.tsx）
import React from 'react';
import { Button } from 'react-native';
import { useAdapter } from '@mono/app/business-device-b/context/AdapterContext';

export const PayButton = ({ orderId }: { orderId: string }) => {
  const { payAdapter } = useAdapter();

  const handlePay = async () => {
    try {
      await payAdapter.pay(orderId);
      alert('支付成功');
    } catch (err) {
      alert(`支付失败：${(err as { msg: string }).msg}`);
    }
  };

  return <Button title="立即支付" onPress={handlePay} />;
};
```

#### 步骤 4：验证集成效果

1. **JS 层验证**：在 B 中运行 RN Metro，调用 A 的 Adapter 接口，查看是否能正常执行；
2. **原生层验证**：在 B 中运行 Android 工程（`yarn android`），调用 A 的 TurboModule（如原生支付、指纹识别），查看是否能正常调用原生能力；
3. **异常验证**：模拟接口调用失败、原生能力异常，查看是否能捕获标准化的错误对象。

### 四、Yarn Monorepo 核心配置（Workspaces）

你的项目是**企业级 RN 裸工程 Monorepo**，Yarn 的核心配置是**Workspaces**（替代 Lerna，Yarn 原生支持，更轻量），核心解决**包本地引用、依赖统一管理、避免 hoist 导致的 RN 原生模块冲突**问题，配置分为**根目录**和**各 Package**两部分，完全贴合 RN 裸工程、TurboModule、Hermes 的特性。

#### 目录结构（业界通用的 Monorepo 分层目录）

先定义**标准化的目录结构**（所有配置都基于此），适配你的四层架构，**必须严格遵循**，避免路径混乱：

plaintext

```
mono-rn-project/  # 根目录
├── package.json   # 根目录package.json，配置Workspaces、全局依赖
├── yarn.lock      # 统一依赖锁，必须提交Git
├── gradle/        # 全局Android Gradle配置（所有包共享）
├── metro.config.js# 全局Metro配置（可被各包继承）
├── tsconfig.json  # 全局TS配置（所有包继承）
├── packages/      # 所有Package的根目录
│   ├── core/      # 公共核心包（Adapter接口、工具类、类型定义）
│   │   ├── core-adapter/ # 业务逻辑层的标准Adapter接口包
│   │   └── core-utils/   # 公共TS/JS工具包
│   ├── business/  # 业务逻辑层（无界面，分模块）
│   │   ├── business-pay/
│   │   └── business-user/
│   ├── ui/        # UI层（Expo，分业务包）
│   │   ├── ui-business-x/
│   │   └── ui-business-y/
│   ├── adapter/   # 适配层（RN裸工程，分机型/硬件包）
│   │   └── a/     # 适配层Package A
│   └── app/       # 整合层（RN裸工程，分业务+机型包）
│       └── business-device-b/ # 整合层Package B
```

#### 核心配置 1：根目录`package.json`（Workspaces 核心）

根目录的`package.json`是 Monorepo 的**核心配置文件**，主要配置`workspaces`、`private`、`nohoist`（**RN 裸工程的关键**，避免原生模块被 hoist）、全局脚本：

json

```
{
  "name": "mono-rn-project",
  "private": true, // 必须设为true，禁止发布根包
  "version": "1.0.0",
  "workspaces": {
    "packages": [
      // 匹配所有packages下的子包（按你的四层架构）
      "packages/core/*",
      "packages/business/*",
      "packages/ui/*",
      "packages/adapter/*",
      "packages/app/*"
    ],
    "nohoist": [
      /**
       * 核心：RN裸工程必须配置nohoist，避免原生模块、TurboModule被hoist到根目录
       * 规则：
       * 1. 所有react-native相关包不hoist；
       * 2. 所有自定义TurboModule包（如@mono/adapter-a）不hoist；
       * 3. 所有有原生代码的包不hoist；
       * 4. Hermes相关包不hoist；
       */
      "**/react-native",
      "**/react-native/**",
      "**/@react-native/*",
      "**/@react-native/turbomodule-core",
      "**/hermes-engine",
      "**/@mono/adapter-*", // 所有适配层包
      "**/@mono/app-*",     // 所有整合层包
      "**/*turbo*"          // 所有TurboModule相关包
    ]
  },
  "scripts": {
    // 全局脚本，方便统一操作
    "clean": "rm -rf node_modules && rm -rf packages/**/node_modules && rm -rf packages/**/android/build",
    "type-check": "tsc --noEmit",
    "lint": "eslint packages/**/src"
  },
  "devDependencies": {
    // 全局开发依赖（所有包共享，无需在各包重复声明）
    "typescript": "^5.2.2",
    "eslint": "^8.56.0",
    "@types/react": "^18.2.48",
    "@types/react-native": "^0.72.8"
  },
  "engines": {
    // 锁定Node/Yarn版本，避免环境差异
    "node": ">=18.0.0",
    "yarn": ">=3.6.0"
  }
}
```

##### 关键说明：`nohoist`的重要性

RN 裸工程的**原生模块、TurboModule、Hermes**都依赖**本地 node\_modules**的文件路径，若 Yarn Workspaces 将这些包 \*\*hoist（提升）\*\* 到根目录的`node_modules`，会导致：

1. 原生模块找不到（Android Gradle 无法解析路径）；
2. TurboModule 注册失败；
3. Hermes 引擎加载异常。
   因此，必须将所有 RN 相关、有原生代码的包加入`nohoist`，确保它们留在各自 Package 的`node_modules`中。

#### 核心配置 2：根目录`tsconfig.json`（全局 TS 配置）

所有 Package 的 TS 配置**继承根目录的配置**，确保 TS 类型规范统一，避免类型冲突：

json

```
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // 配置路径别名，方便各包引用（如@mono/core-adapter => packages/core/core-adapter/src）
      "@mono/*": ["packages/*/src"],
      "@mono/core-adapter": ["packages/core/core-adapter/src"],
      "@mono/adapter-a": ["packages/adapter/a/src"]
    },
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Node",
    "jsx": "react-native",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "exclude": ["node_modules", "packages/**/android", "packages/**/ios", "packages/**/dist"]
}
```

各 Package 的`tsconfig.json`只需**继承根配置**即可：

json

```
// packages/adapter/a/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

#### 核心配置 3：根目录`metro.config.js`（全局 Metro 配置）

RN 的 Metro 打包器配置**全局共享**，各 Package（尤其是整合层 B）只需**继承并少量修改**，确保 Monorepo 下的包能被 Metro 正确解析：

javascript

运行

```
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// 根目录路径
const root = path.resolve(__dirname);

// 默认配置
const defaultConfig = getDefaultConfig(__dirname);

// 自定义配置：添加Monorepo路径解析、支持别名
const monoConfig = {
  watchFolders: [root], // 监听根目录，确保Metro能发现所有Package
  resolver: {
    nodeModulesPaths: [
      path.resolve(root, 'node_modules'),
      path.resolve(root, 'packages/**/node_modules'),
    ],
    // 解析路径别名（与tsconfig.json一致）
    alias: {
      '@mono': path.resolve(root, 'packages'),
      '@mono/core-adapter': path.resolve(root, 'packages/core/core-adapter/src'),
    },
  },
  // 开启Hermes（与所有包一致）
  transformer: {
    hermesParser: true,
    enableHermesTransformer: true,
  },
  serializer: {
    getModulesRunBeforeMainModule: () => [
      path.resolve(root, 'node_modules/react-native/Libraries/Core/InitializeCore.js'),
    ],
  },
};

// 合并配置
module.exports = mergeConfig(defaultConfig, monoConfig);
```

整合层 B 的 Metro 配置**继承根配置**即可：

javascript

运行

```
// packages/app/business-device-b/metro.config.js
const { mergeConfig } = require('@react-native/metro-config');
const rootMetroConfig = require('../../../metro.config.js');

module.exports = mergeConfig(rootMetroConfig, {
  // B的专属配置（如缓存目录）
  cacheStores: [
    new (require('metro-cache-fs').FSCacheStore)({
      root: require('path').resolve(__dirname, 'node_modules/.metro-cache'),
    }),
  ],
});
```

#### 核心配置 4：各 Package 的`package.json`规范

所有 Package（尤其是 A 和 B）的`package.json`必须遵循**统一规范**，确保 Monorepo 正常工作，以下是**适配层 A**和**整合层 B**的典型配置示例：

##### 适配层 A 的`package.json`（`packages/adapter/a/package.json`）

json

```
{
  "name": "@mono/adapter-a", // 包名：@命名空间/包名，避免冲突
  "version": "1.0.0",
  "description": "适配层A：Android原生能力+Adapter接口实现",
  "main": "src/index.ts", // 生产核心入口
  "types": "src/index.ts", // TS类型入口
  "dev:main": "src/debug/index.ts", // 调试入口（自定义）
  "private": false, // 若需发布为私有包，设为true；否则false
  "scripts": {
    "dev": "react-native start", // 独立调试
    "android": "react-native run-android", // 独立运行Android
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    // 核心：RN相关依赖设为peer，由整合层B提供
    "react": "^18.2.0",
    "react-native": "^0.72.0 || ^0.73.0",
    "@react-native/turbomodule-core": "^0.72.0",
    "hermes-engine": "^0.72.0",
    // 依赖业务逻辑层的标准接口包
    "@mono/core-adapter": "^1.0.0"
  },
  "dependencies": {
    // 自身私有依赖（无原生代码）
    "axios": "^1.6.5",
    "kotlinx-coroutines-core": "^1.7.3"
  },
  "devDependencies": {
    // 开发依赖（仅本地使用，不传递）
    "@types/axios": "^0.14.0"
  }
}
```

##### 整合层 B 的`package.json`（`packages/app/business-device-b/package.json`）

json

```
{
  "name": "@mono/business-device-b",
  "version": "1.0.0",
  "description": "整合层B：业务X+机型X集成包",
  "main": "src/index.tsx",
  "types": "src/index.tsx",
  "private": true, // 整合层是最终产物，设为true，禁止发布
  "scripts": {
    "start": "react-native start",
    "android": "react-native run-android",
    "android:debug": "react-native run-android --mode=debug",
    "android:release": "cd android && ./gradlew assembleRelease",
    "clean": "rm -rf node_modules && cd android && ./gradlew clean",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    // 整合层是唯一声明核心依赖的包，满足所有peerDependencies
    "react": "^18.2.0",
    "react-native": "0.72.6", // 锁定版本，无模糊符
    "@react-native/turbomodule-core": "0.72.6",
    "hermes-engine": "0.72.6",
    // 集成各层包（Monorepo本地引用）
    "@mono/adapter-a": "*",
    "@mono/ui-business-x": "*",
    "@mono/business-pay": "*",
    "@mono/business-user": "*",
    "@mono/core-adapter": "*",
    // Redux相关依赖
    "@reduxjs/toolkit": "^2.0.1",
    "redux-observable": "^3.0.0-rc.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    // 开发依赖
    "react-native-codegen": "0.72.12"
  },
  "rnpm": {
    // RN原生模块配置，指向自身android/ios目录
    "android": {
      "sourceDir": "android"
    }
  }
}
```

#### 核心配置 5：Yarn 命令使用规范

Monorepo 下的所有 Yarn 命令**优先在根目录执行**，配合`--prefix`指定包，避免在各包单独执行导致依赖混乱：

1. **安装全局依赖**：`yarn add <包名> -D -W`（`-W`表示根目录）；
2. **为指定包添加依赖**：`yarn add <包名> -W --prefix <包目录>`；
3. **安装所有依赖**：在根目录执行`yarn install`（自动解析所有包的依赖，生成统一的`yarn.lock`）；
4. **执行指定包的脚本**：`yarn workspace <包名> <脚本>`（如`yarn workspace @mono/business-device-b android`）；
5. **全局执行脚本**：在根目录执行`yarn <全局脚本>`（如`yarn type-check`）。

### 五、企业级架构额外优化点（提升稳定性 + 多样性）

基于你的目标「业界通用产品、架构稳定 + 业务多样」，补充几个**业界大厂的 RN Monorepo 分层架构最佳实践**，进一步优化你的设计：

#### 1. 依赖注入容器（替代 Redux/Context 注入）

若你的业务逻辑层复杂，推荐使用**TS/JS 依赖注入容器**（如`inversify-js`、`tsyringe`）管理 Adapter 接口的实现，实现**完全的依赖倒置**，无需在 Redux/Context 中硬编码 Adapter 实例，适配层的替换会更无感。

#### 2. 版本管理：用 Changesets 管理包版本

企业级 Monorepo 的包版本管理推荐使用**Changesets**，自动跟踪各包的变更，生成版本号、更新日志，支持**独立版本升级**（各包可单独升级版本，无需统一升级），避免手动管理版本的混乱。

#### 3. 构建流水线：CI/CD 分层构建

配置**GitLab CI/CD**或**GitHub Actions**，实现**分层构建**：

1. 公共核心包、业务逻辑层、UI 层：做**单元测试 + 类型检查 + 打包**；
2. 适配层：做**单元测试 + 原生编译测试 + Adapter 接口测试**；
3. 整合层：做**集成测试 + Android 打包 + 渠道包生成**；
   确保每一次代码提交都能验证架构的稳定性，提前发现问题。

#### 4. 原生能力抽离：打造 RN 原生组件库

将适配层 A 中的**通用原生能力**（如扫码、指纹识别、支付）抽为**独立的 RN 原生组件库**（Monorepo 包），让所有适配层包复用，减少重复开发，提升架构稳定性。

#### 5. 配置中心：远程拉取业务 / 机型配置

整合层 B 的配置文件（业务 / 机型 / 原生）推荐**从远程配置中心拉取**（如 Apollo Config、Nacos），无需打包即可修改配置，提升业务多样性的灵活度，适配不同的客户 / 渠道需求。

#### 6. 测试分层：单元测试 + 集成测试 + E2E 测试

* 业务逻辑层：做**单元测试**（Jest），测试纯逻辑；
* 适配层：做**单元测试（Jest）+ 原生测试（JUnit/Espresso）**，测试 Adapter 实现和原生模块；
* 整合层：做**集成测试（React Native Testing Library）+ E2E 测试（Detox）**，测试完整的应用流程；
  确保各层的代码质量，提升架构的稳定性。

### 总结

适配层 A 和整合层 B 是你 RN Monorepo 分层架构的**核心衔接层**，开发和集成的**核心原则**可总结为 3 点：

1. **A 做封装，只露标准**：A 严格实现业务逻辑层的 Adapter 接口，封装 TurboModule/Android 原生能力，仅暴露标准 TS/JS 接口，隔离调试代码，依赖用 Peer Dependencies 约束；
2. **B 做集成，不碰底层**：B 坚守纯集成原则，零业务 / 底层代码，通过配置化选择 UI 层 / 适配层，作为唯一的依赖入口满足所有包的 Peer Dependencies，原生配置与 A 完全一致；
3. **Monorepo 做联动，解决原生冲突**：基于 Yarn Workspaces 配置，核心是`nohoist`避免 RN 原生模块 / TurboModule 被提升，通过路径别名、全局配置实现包的本地引用和规范统一，B 通过「TS/JS 层包引用 + Android 原生层 Gradle/TurboModule 注册」集成 A，再通过依赖注入将 A 的实现交给上层使用。
