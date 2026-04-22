# 2026-04-07 mixc-user-login 打样包设计说明

## 目标

基于 `1-kernel/1.2-modules/user-base`，重新建立一个新的样板包：

- 新包路径：`1-kernel/1.2-modules/mixc-user-login`
- 新包 npm 名称：`@impos2/kernel-mixc-user-login`
- 新包模块名：`kernel.mixc.user.login`

并且要求：

1. 复制原有业务能力边界，不发明新业务
2. 不机械复制旧结构，而是做一次干净的重构增强
3. 将 HTTP 服务全面切换到 `communication` 的 service-first 体系
4. 把该包打造成后续模块迁移的样板包

## 已确认边界

### 业务边界

- 保持 `user-base` 当前业务边界不变
- 这次是“在原业务边界内重构”，不是新增业务能力

### 改造深度

- 不是最小迁移
- 不是只替换 `supports/apis`
- 是一次“样板级”重构增强

### 通信方式

- HTTP 使用 `communication` 包
- service-first
- 对象方法风格
- 手写 service 方法
- 模块级 registry / runtime 思路可在包内落地，但不强依赖外部旧 `ApiManager`

## 本轮实施原则

### 保留的内容

- 现有 Redux Toolkit / redux-observable 业务分层思想
- 现有 slice / actor / epic / middleware 的职责边界
- 现有业务状态和业务流程中有价值的部分

### 重点重构的内容

- 包名与模块名
- 对外导出符号命名
- `supports/apis` 及相关 HTTP 调用链
- 旧 HTTP 基础设施接入方式
- 与“mixc-user-login”语义不匹配的命名

### 不做的事

- 不修改原 `user-base`
- 不强行兼容旧 `ApiManager`
- 不把 WS 混进这次改造
- 不额外扩张登录域业务边界

## 预期结构

目标结构仍遵循当前 monorepo 模块习惯，但更干净：

- `application`
- `features`
- `foundations`
- `supports/http-services`
- `supports/errors`
- `supports/parameters`
- `types`
- `dev`

其中：

### supports/http-services

替代旧 `supports/apis` 作为新的 HTTP 组织层：

- service-first
- 按业务域对象组织方法
- 内部使用 `communication` 的 `HttpRuntime`
- 手写 service 方法，保证可读性和强类型

### foundations

承接真正稳定、与具体业务流程解耦的逻辑：

- 数据适配
- 领域对象转换
- 通用判断逻辑

### features

只保留与业务状态变化、命令、actor、epic 直接相关的逻辑。

## 关键迁移策略

### 第一步：结构复制与统一改名

将 `user-base` 复制为 `mixc-user-login`，并统一改名：

- package name
- module name
- 导出符号前缀
- 目录内引用路径

### 第二步：定位旧 HTTP 使用点

梳理：

- 旧 `supports/apis`
- actor / epic / command 中直接或间接调用的 HTTP 入口
- 业务流程与 HTTP 的耦合点

### 第三步：重建 HTTP 服务层

在新包中建立 `supports/http-services`：

- 定义 endpoint
- 建立 runtime
- 建立 service methods
- 由 feature 层通过 service 调用，而不是直接依赖旧 API 模型

### 第四步：清理命名与导出

让新包在外部看起来是一个真正新的模块，而不是 `user-base` 改名副本。

## 输出要求

本轮完成后，希望具备：

1. 新包可独立 type-check
2. 新包 dev 可用于基础验证
3. HTTP 已切换到 `communication`
4. 原 `user-base` 保持不动
5. 新包可作为后续迁移模板

## 补充修复

同时修复：

- `1-kernel/1.1-cores/communication/src/moduleName.ts`

应从当前错误的 npm 包名风格，改为与其他 core 一致的模块名风格：

- `kernel.core.communication`


## 本地兜底登录策略

原 `user-base` 中存在一段硬编码本地登录逻辑：

- 用户名：`boss`
- 密码：`boss`

本轮已确认处理方式：

- 保留该能力
- 但从正式 actor 业务逻辑中移出
- 调整到更适合 dev/mock 的位置，避免正式样板模块内部夹杂硬编码登录分支

这意味着：

- `mixc-user-login` 仍可保留该调试/演示能力
- 但正式 HTTP 登录流程将保持干净
- 样板包结构会更适合作为后续模块迁移模板

## 当前实施结果（阶段性）

已完成：

- 新建 `1-kernel/1.2-modules/mixc-user-login`
- 包名已改为 `@impos2/kernel-mixc-user-login`
- 模块名已改为 `kernel.mixc.user.login`
- 统一导出前缀已改为 `kernelMixcUserLogin...`
- 旧 `supports/apis` 已移除
- 新建 `supports/http-services.ts`
- 已基于 `communication` 的 `HttpRuntime + defineHttpEndpoint + service-first` 重写登录相关 HTTP 服务
- `features/actors/user.ts` 已改为调用新 HTTP services
- `boss/boss` 本地兜底登录已从旧的硬编码结构中抽出，保留为非生产环境下的本地调试能力
- `communication` 的 `moduleName` 已修正为 `kernel.core.communication`

当前验证情况：

- `mixc-user-login` 单包 TypeScript 编译已通过（使用 `tsc -p ... --noEmit`）

尚未完成：

- 将新包纳入 yarn workspace lockfile（需要一次 `yarn install`）
- 为 `mixc-user-login` 增加专门的 dev 验证场景
- 若要做真实 HTTP 集成验证，还需要确认运行时 baseURL 注入方式

## 新增完成：ServerSpace 正式接入

为避免在 `mixc-user-login` 中写死 HTTP 地址，本轮继续增强了 `communication`：

- `HttpRuntime` 已支持通过 `serverConfigProvider` 动态获取服务器配置
- 已新增 `ServerSpaceAdapter`，可将旧体系的 `storeEntry.getServerSpace()` 转换为 `communication` 使用的 `CommunicationServerConfig[]`
- `mixc-user-login` 的 `HttpRuntime` 已改为通过 `getCommunicationServersFromStoreEntry` 获取真实服务地址

这意味着：

- 新样板包没有绕过老工程的地址体系
- 也没有在样板包里写死临时 URL
- HTTP 真正通过 `communication` 与当前工程环境接通
