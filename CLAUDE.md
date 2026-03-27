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

# 背景

我在做一个 Monorepo 结构的企业级的 React Native 裸工程项目，目标是设计一个业界通用的产品，既满足架构稳定性又要满足业务多样性。 设计理念是将项目分层实现，总共分为 4 层：业务逻辑层、UI 层、适配层、整合层。

* 业务逻辑层是用 redux toolkit 和 redux observable 实现的，分功能模块，每个模块一个 package，有开发调试的代码，但只导出核心功能给其他工程集成。无界面，对 kotlin 层的调用封装了 Adapter 接口，后续适配层需实现接口并注入。
* UI 层是用 React Native expo 实现的，集成业务逻辑层，方便在 web 中调试，有开发调试的代码，但只导出核心功能给其他工程集成。针对不同业务，会有不同的 package
* 适配层是 React Native 裸工程，提供对 Android 端的调用逻辑，以及实现 Adapter 的接口，针对不同的 android 机型和硬件差异，会有不同的 package，有开发调试的代码，但只导出核心功能（包括 kotlin 和 ts 的部分）给其他工程集成，使用TurboModule和Hermes，不使用fabric。
* 整合层是 React Native 裸工程，仅做集成，会实现部分业务逻辑，比如分屏、重启、热更新等底层功能。对于具体机型和具体业务，将 UI 层与适配层集成在一起。，使用TurboModule和Hermes，，不使用fabric。
