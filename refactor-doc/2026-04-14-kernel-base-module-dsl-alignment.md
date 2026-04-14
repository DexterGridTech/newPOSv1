# Kernel Base 模块 DSL 对齐说明

## 目标

把 `1-kernel/1.1-cores` 里最值得继承的开发体验迁移到 `1-kernel/1.1-base`：

1. 开发者只写模块内短名。
2. `moduleName` 是字符串真相源。
3. 模块对象集中声明能力。
4. `src/application` 结构统一，便于阅读和继承。

## 本轮结论

旧工程最值得继承的不是全局 `ApplicationManager` 或全局 command bus，而是下面这套模块级 DSL 思想：

1. `createModuleCommands(moduleName, {...})`
2. `createActors(moduleName, {...})`
3. `createModuleStateKeys(moduleName, [...])`
4. 根入口直接暴露 `module / commands / actors / errors / parameters`

新架构在保留 v2 运行时模型的前提下，对齐为：

1. `createModuleCommandFactory(moduleName)`
2. `createModuleActorFactory(moduleName)`
3. `defineKernelRuntimeModuleManifestV2({...})`
4. `deriveKernelRuntimeModuleDescriptorV2(createModule)`
5. `createRuntimeModuleLifecycleLogger({moduleName, context})`

## 统一规则

### 1. application 目录

所有运行时包的 `src/application` 统一为：

1. `createModule.ts`
2. `moduleManifest.ts`
3. `index.ts`

其中：

1. `createModule.ts` 负责导出 `createXxxModuleV2`
2. `createModule.ts` 负责导出 `xxxModuleV2Descriptor`
3. `moduleManifest.ts` 负责集中声明 `moduleName / packageVersion / dependencies / stateSlices / commandDefinitions / errorDefinitions / parameterDefinitions`
4. `index.ts` 只 re-export `./createModule` 和 `./moduleManifest`

禁止把模块装配转发放到 `src/foundations/module.ts`。`foundations` 只放业务基础设施，模块对象和装配入口统一放到 `application`。

### 1.1 包根 index 规则

所有运行时包的 `src/index.ts` 统一遵守下面顺序：

1. `moduleName / packageVersion`
2. `application`
3. `selectors / hooks / supports / types / foundations`
4. 显式导出 `xxxModuleManifest`
5. 显式导出 `createXxxModuleV2 / xxxModuleV2Descriptor / xxxV2PreSetup`
6. 显式导出 `CommandDefinitions / CommandNames / StateSlices / StateActions / ErrorDefinitions / ParameterDefinitions`

目标是让开发者只看 `src/index.ts` 就知道这个包的：

1. 如何装配
2. 暴露了哪些命令
3. 有哪些状态切片
4. 错误和参数从哪里定义

### 2. descriptor 规则

禁止手写下面这些镜像信息：

1. `actorKeys`
2. `commandNames`
3. `stateSliceNames`
4. `hasInstall`
5. `hasPreSetup`

统一使用：

1. `deriveKernelRuntimeModuleDescriptorV2(createModule)`

### 3. 依赖规则

包依赖其他模块时：

1. 禁止写裸模块名字符串。
2. 必须引用目标包导出的 `moduleName` 常量。

### 4. command 定义规则

包内 command 定义时：

1. 优先使用 `const defineModuleCommand = createModuleCommandFactory(moduleName)`
2. 业务开发只写命令短名，如 `run-workflow`
3. 禁止在每条 command 上重复传 `moduleName`

### 5. actor 定义规则

包内 actor 定义时：

1. 优先使用 `const defineActor = createModuleActorFactory(moduleName)`
2. 业务开发只写 actor 短名
3. 禁止在每个 actor 定义对象里重复铺开 `moduleName`

### 6. 模块清单规则

包内模块清单统一放到 `src/application/moduleManifest.ts`：

1. 使用 `defineKernelRuntimeModuleManifestV2({...})`
2. `dependencies` 必须引用目标包导出的 `moduleName`，禁止裸字符串
3. `stateSlices / commandDefinitions / errorDefinitions / parameterDefinitions` 在 manifest 里集中声明
4. `createModule.ts` 只负责补充运行时 actor、`preSetup` 和 `install`
5. `install` 日志里的清单数据优先从 manifest 的 `stateSliceNames / commandNames / errorKeys / parameterKeys` 读取

### 7. 生命周期日志规则

包级 `preSetup/install` 日志：

1. 统一使用 `createRuntimeModuleLifecycleLogger`
2. 禁止每个包重复手写 event 名和 message 模板
3. 允许在 `logInstall` 里补充包自己的 `stateSlices / commandNames / hasAssembly` 等数据

## 本轮已对齐范围

已完成：

1. `runtime-shell-v2`
2. `tcp-control-runtime-v2`
3. `tdp-sync-runtime-v2`
4. `topology-runtime-v2`
5. `workflow-runtime-v2`
6. `ui-runtime-v2`

并且已经额外完成：

1. actor 定义全部统一到 `createModuleActorFactory(moduleName)`
2. 5 个业务型 v2 包已经引入 `moduleManifest.ts`
3. `foundations/module.ts` 历史转发层已移除
4. 包根 `src/index.ts` 已开始对齐老工程式“模块入口优先、能力清单显式导出”

## 后续建议

后续如果继续收紧开发体验，优先级如下：

1. 在新包脚手架规范里强制使用本文件约定
2. 继续减少 `createModule.ts` 里的环境默认值和临时 fallback 配置
3. 包根 `src/index.ts` 保持模块入口优先、类型/协议/selector/supports 次之、features 内部聚合按需导出
