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
15. 1-kernal、2-ui、3-adapter 目录中的 package.json 要注意，每个包中都有 dev 目录用于开发调试，和 src 目录用于导出给其他包依赖。本包程序单独启动时，不启动 src 的 index。同时确保作为依赖导出的时候，dev 目录不会被导出
16. 任何配置文件中不允许出现绝对路径
17. 遇到棘手的问题的时候，不要尝试越过问题使用简单方式。当你想尝试越过问题的时候，问我，让我来决策如何解决。

# 背景

我在做一个 Monorepo 结构的企业级的 React Native 裸工程项目，目标是设计一个业界通用的产品，既满足架构稳定性又要满足业务多样性。 设计理念是将项目分层实现，总共分为 4 层：业务逻辑层、UI 层、适配层、整合层。

* 业务逻辑层是用 redux toolkit 和 redux observable 实现的，分功能模块，每个模块一个 package，有开发调试的代码，但只导出核心功能给其他工程集成。无界面，对 kotlin 层的调用封装了 Adapter 接口，后续适配层需实现接口并注入。
* UI 层是用 React Native expo 实现的，集成业务逻辑层，方便在 web 中调试，有开发调试的代码，但只导出核心功能给其他工程集成。针对不同业务，会有不同的 package
* 适配层是 React Native 裸工程，提供对 Android 端的调用逻辑，以及实现 Adapter 的接口，针对不同的 android 机型和硬件差异，会有不同的 package，有开发调试的代码，但只导出核心功能（包括 kotlin 和 ts 的部分）给其他工程集成，使用TurboModule和Hermes和fabric。
* 整合层是 React Native 裸工程，仅做集成，会实现部分业务逻辑，比如分屏、重启、热更新等底层功能。对于具体机型和具体业务，将 UI 层与适配层集成在一起。，使用TurboModule和Hermes和fabric。



# RN New Arch (Fabric + TurboModules) 严格编码规范

## 禁止出现：TurboModule 找不到、Codegen 失败、原生注册失败、编译报错、运行时崩溃

### 一、项目环境约定

* 基于 **React Native 0.72+ 裸工程**
* 已开启：`newArchEnabled=true` / `RCT_NEW_ARCH_ENABLED=1`
* 必须使用 **Codegen + TurboModules + Fabric** 完整新架构流程
* 禁止混用旧架构模块写法（禁止 `ReactContextBaseJavaModule`、`RCTBridgeModule` 等旧方式）

---

# 二、核心强制规则（必须严格遵守）

## 1. TurboModule 定义与 Codegen 规范

1. **所有 Native 模块必须通过 Codegen 规范定义**
   * 使用 `*.native.js` 或 `*.ts` 作为 Spec 文件
   * 严格遵循 FB 官方 Codegen 结构：
     ts

     ```
     import type {TurboModule} from 'react-native/Libraries/TurboModule/RCTExport';
     import {TurboModuleRegistry} from 'react-native';

     export interface MyModuleSpec extends TurboModule {
       // 方法必须完整定义
       myMethod: (arg: string) => Promise<string>;
     }

     export default TurboModuleRegistry.getEnforcing<MyModuleSpec>('MyModule');
     ```
2. **JS 调用名称必须与原生 getName () 完全一致，大小写敏感**
   * 不允许简写、别名、驼峰不匹配
3. **禁止直接手写 TurboModule 注册代码**
   * 必须由 Codegen 自动生成，不手写 `TurboModuleRegistry` 底层逻辑

## 2. Android 端 TurboModule 强制规则

1. 模块必须：
   * 实现 `TurboModule`
   * 提供 `getName()` 返回与 JS 完全一致的字符串
2. Package 必须继承 `TurboReactPackage`
3. 必须在 `getModule()` 中返回模块实例
4. 禁止使用旧版 `ReactPackage`、`BaseJavaModule`
5. 必须确保 Codegen 任务执行：
   * `./gradlew generateCodegenArtifactsFromSchema`
6. 构建前必须 clean：
   * `./gradlew clean`

## 3. iOS 端 TurboModule 强制规则

1. 必须实现 `RCTTurboModule` 协议
2. 必须实现 `+ (NSString *)moduleName`
3. 必须在 Pod 中正确依赖 React-Codegen
4. 安装 Pod 必须带新架构开关：
   bash

   运行

   ```
   RCT_NEW_ARCH_ENABLED=1 pod install
   ```
5. 禁止使用旧版 `RCT_EXPORT_METHOD`、`RCT_EXTERN_METHOD`

## 4. 必须避免的 “TurboModule 找不到” 常见根源

1. **未执行 Codegen → 直接导致注册失败**
   * 每次修改 Spec 必须重新跑 Codegen
2. **缓存未清理**
   * Metro 缓存、build 缓存、haste 缓存、Pods 缓存
3. **JS 与原生模块名不一致**
4. **新架构开关未真正开启**
   * Android: `newArchEnabled=true`
   * iOS: 必须用带标志的 pod install
5. **三方库未适配新架构**
   * 引入第三方库前必须确认支持 TurboModules
6. **手动修改 Codegen 生成文件**
   * 生成文件禁止编辑，否则必然报错

## 5. 交付代码必须附带的完整性内容

1. Spec 接口定义文件
2. Android 完整模块 + Package 代码
3. iOS 完整模块代码
4. Podfile/gradle.properties 关键配置
5. 必执行命令清单（codegen、clean、pod install）
6. 常见报错排查说明（如模块找不到、link 失败、codegen 失败）

## 6. 当你编写代码时，必须自动检查

* [ ]  是否使用新架构规范
* [ ]  是否有完整 Spec 并支持 Codegen
* [ ]  JS 调用名与原生 getName 完全一致
* [ ]  Android 继承 TurboReactPackage
* [ ]  iOS 实现 RCTTurboModule
* [ ]  无旧架构 API 混用
* [ ]  附带清理缓存与构建命令
* [ ]  明确说明如何避免 “TurboModule 找不到”

---

# Monorepo 中多 RN 版本共存规范

## 背景

本项目 Monorepo 中存在多个 RN 版本并存的情况：
- 根目录（1-kernel、2-ui 层）：RN 0.77 + React 18
- 适配层/整合层（3-adapter、4-integration）：RN 0.84+ + React 19（新架构）

当一个 RN 裸工程包（适配层/整合层）依赖了使用旧版 RN 的 `@impos2/*` 包时，必须处理版本冲突。

## 必须解决的三类问题

### 1. Android 原生启动崩溃：`libreact_featureflagsjni.so not found`

**原因**：RN 0.76+ 将 `libreact_featureflagsjni` 合并进了 `libreactnative.so`，但 `SoLoader.init(this, false)` 使用 `SystemDelegate` 直接查找独立 so 文件，找不到。

**修复**：`MainApplication.kt` 中必须使用 Codegen 生成的 `ReactNativeApplicationEntryPoint`：

```kotlin
override fun onCreate() {
    super.onCreate()
    ReactNativeApplicationEntryPoint.loadReactNative(this)
    // 不要手动调用 SoLoader.init(this, false) 或 DefaultNewArchitectureEntryPoint.load()
}
```

`ReactNativeApplicationEntryPoint` 由 Gradle 构建时自动生成（位于 `app/build/generated/autolinking/`），内部已正确使用 `OpenSourceMergedSoMapping`。

### 2. JS 运行时崩溃：`TurboModuleRegistry.getEnforcing('DeviceInfo') could not be found`

**原因**：Metro 在解析 `@impos2/*` 包内部的 `import 'react-native'` 时，从包所在目录（根目录 `node_modules/@impos2/`）向上查找，找到了根目录的 RN 0.77 的 JS。而 native 端是 RN 0.84，JS 与 native 模块名不匹配。

**修复**：在 `metro.config.js` 中用 `resolveRequest` 强制重定向，见下方完整配置。

### 3. JS 运行时崩溃：`Cannot read property 'ReactCurrentDispatcher' of undefined`

**原因**：`react/jsx-runtime` 是子路径导入，`fs.existsSync(localNodeModules + '/react/jsx-runtime')` 返回 false（目录不存在），导致重定向被跳过，解析到根目录 React 18 的 `jsx-runtime`。而 `react` 本身被重定向到了本地 React 19，两者 API 不兼容（React 19 移除了 `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`）。

**修复**：用 `getPackageName()` 提取包名（处理子路径），再检查包目录是否存在，见下方完整配置。

## 标准 metro.config.js 模板（多 RN 版本 Monorepo）

```js
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');

const localNodeModules = path.resolve(__dirname, 'node_modules');
const rootNodeModules = path.resolve(__dirname, '../../../node_modules'); // 根据层级调整

// 用于重定向的锚点（本地 node_modules 内的真实文件）
const REDIRECT_ANCHOR = path.join(localNodeModules, 'react-native', 'index.js');

// 从模块名提取包名（处理 scoped 包和子路径，如 react/jsx-runtime → react）
function getPackageName(moduleName) {
  if (moduleName.startsWith('@')) {
    return moduleName.split('/').slice(0, 2).join('/');
  }
  return moduleName.split('/')[0];
}

// 需要强制解析到本地版本的包
const REDIRECT_PACKAGES = new Set(['react', 'react-native', 'react-dom']);

function shouldRedirectToLocal(moduleName) {
  const pkgName = getPackageName(moduleName);
  return (
    REDIRECT_PACKAGES.has(pkgName) ||
    pkgName.startsWith('@react-native') ||
    pkgName.startsWith('@react-navigation')
  );
}

const config = {
  watchFolders: [path.resolve(__dirname, '../../..')],
  resolver: {
    nodeModulesPaths: [localNodeModules, rootNodeModules],
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enablePackageExports: true,
    resolveRequest: (context, moduleName, platform) => {
      // 防止无限递归：已从本地锚点发起的解析直接走默认逻辑
      if (context.originModulePath === REDIRECT_ANCHOR) {
        return context.resolveRequest(context, moduleName, platform);
      }
      if (shouldRedirectToLocal(moduleName)) {
        const pkgName = getPackageName(moduleName);
        if (fs.existsSync(path.join(localNodeModules, pkgName))) {
          // 将 originModulePath 改为本地锚点，Metro 从 localNodeModules 开始查找
          return context.resolveRequest(
            {...context, originModulePath: REDIRECT_ANCHOR},
            moduleName,
            platform,
          );
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

## 检查清单

新建适配层/整合层 RN 裸工程时，必须确认：

- [ ] `package.json` 中 `react-native` 和 `react` 在 `dependencies`（不是 `peerDependencies`），确保 yarn 在本地安装
- [ ] `MainApplication.kt` 使用 `ReactNativeApplicationEntryPoint.loadReactNative(this)`，不手动调用 `SoLoader.init`
- [ ] `metro.config.js` 使用上方模板，包含 `resolveRequest` 重定向逻辑
- [ ] 每次修改 `metro.config.js` 后，必须带 `--reset-cache` 重启 Metro
- [ ] `@impos2/*` 包的 `peerDependencies` 中的 RN/React 版本与本工程不同时，不需要修改这些包，Metro 的 `resolveRequest` 会在运行时统一版本

---

# RN 0.84 Bridgeless 模式 TurboModule 问题排查

## 问题现象

在 RN 0.84 Bridgeless 模式下，即使 TurboModule 正确注册（`AdapterPackage.getModule()` 被调用），JS 层仍然获取不到模块：
- `TurboModuleRegistry.get('ModuleName')` 返回 `null`
- `global.__turboModuleProxy` 是 `undefined`
- `NativeModules.ModuleName` 也是 `null`

## 根本原因

**在 RN 0.84 Bridgeless 模式下，`__turboModuleProxy` 必须通过 Codegen 生成的 C++ JSI 绑定才能初始化。** 手动创建的 TurboModule（即使继承了 `TurboReactPackage` 和 `TurboModule`）不会自动获得 JSI 绑定。

## 解决方案（4 步）

### 1. 在 package.json 添加 codegenConfig

```json
{
  "codegenConfig": {
    "name": "YourModuleSpec",
    "type": "modules",
    "jsSrcsDir": "src/supports/apis",
    "android": {
      "javaPackageName": "com.yourapp.turbomodules"
    }
  }
}
```

### 2. JS 端使用 Codegen 标准方式

```typescript
import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
  myMethod(arg: string): Promise<string>
}

// 关键：只能有一个 TurboModuleRegistry 调用，使用 getEnforcing
export default TurboModuleRegistry.getEnforcing<Spec>('YourModule');
```

### 3. 运行 Codegen 生成 Spec

```bash
cd android
./gradlew generateCodegenArtifactsFromSchema
```

生成的文件位于：`app/build/generated/source/codegen/java/com/yourapp/turbomodules/NativeYourModuleSpec.java`

### 4. Kotlin 模块继承生成的 Spec

```kotlin
@ReactModule(name = YourModule.NAME)
class YourModule(reactContext: ReactApplicationContext) :
    NativeYourModuleSpec(reactContext) {

    companion object {
        const val NAME = "YourModule"
    }

    override fun getName() = NAME

    @ReactMethod
    override fun myMethod(arg: String, promise: Promise) {
        // 实现
    }
}
```

## 关键检查点

- [ ] `package.json` 有 `codegenConfig` 配置
- [ ] JS Spec 文件只有一个 `TurboModuleRegistry` 调用
- [ ] 使用 `getEnforcing` 而不是 `get`
- [ ] 运行了 `generateCodegenArtifactsFromSchema`
- [ ] Kotlin 类继承 Codegen 生成的 Java Spec
- [ ] 模块名在 JS 和 Native 端完全一致

---

# 三、当你生成代码时，必须遵循的最终承诺

1. 绝不写出会导致 **TurboModuleRegistry.getEnforcing(…) could not be found** 的代码
2. 绝不遗漏 Codegen 步骤
3. 绝不混用新旧架构 API
4. 所有 Native 模块可直接在开启 Fabric/Turbo 的 RN 裸工程中编译运行
5. 若涉及配置修改，必须给出完整、可复制的配置片段
6. 提供**一键清理缓存 + 重新构建**脚本
