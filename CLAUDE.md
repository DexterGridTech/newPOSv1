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
16. 任何配置文件中不允许出现绝对路径

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
