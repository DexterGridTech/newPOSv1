# Kernel Base Application Structure Design

## 背景

对比 `_old_/1-kernel/1.1-cores/*` 与当前 `1-kernel/1.1-base/*`，新架构在能力边界、协议、可测试性上已经明显更强，但在“开发者第一眼能否看懂怎么接入、怎么初始化、哪些是公开入口”这件事上反而退步了。

当前主要问题：

1. 很多包的 `src/application` 目录是空的，占位但没有承载真实职责。
2. 运行时包的模块入口定义散落在 `src/foundations/module.ts`，开发者不容易判断这是公开装配入口，还是内部实现细节。
3. `src/index.ts` 多数采用“整层 re-export”，公开面太宽，哪些是稳定 API、哪些是内部基础实现不够清晰。
4. 整个 runtime 的初始化虽然能力齐全，但缺少一个类似旧 `ApplicationManager.generateStore(appConfig)` 那样“显式传入配置、按步骤初始化、统一打印加载过程”的总入口。
5. `test/index.ts` 风格不统一，有的跑 vitest，有的只是说明文字，有的只是 import spec，开发者很难快速理解一个包的测试分层和建议入口。

## 旧架构中需要继承的亮点

旧 `_old_/1-kernel/1.1-cores/*` 不是照搬对象，但以下思想必须继承：

1. 包内有明确装配入口。
   开发者打开 `src/application` 或 `src/index.ts`，就能知道这个包如何参与系统初始化。
2. 包导出面短而清晰。
   `src/index.ts` 不只是导出一堆符号，而是在结构上告诉开发者：
   1. 这个包是什么。
   2. 它依赖什么。
   3. 它提供什么。
3. 总装配入口显式接收配置。
   初始化不是“自己到处拼”，而是“一个统一入口接收 appConfig，然后按确定步骤完成初始化”。
4. 初始化过程对开发者可观测。
   旧 `ApplicationManager` 虽然过重，但“分步骤打印加载信息”这个设计是正确的。
5. 预处理钩子存在且位置明确。
   是否真的需要 pre-setup 可以逐包决定，但入口位置不能模糊。

## 本次设计目标

本次不是回退到旧 architecture，而是在保持 v2 单 runtime 真相源的前提下，把“结构可读性”和“初始化可理解性”补回来。

目标如下：

1. 每个基础包都有真实的 `src/application` 职责，不再保留空目录。
2. 每个 runtime 包的公开装配入口都进入 `src/application`，不再把模块定义藏在 `src/foundations/module.ts`。
3. `src/index.ts` 统一收敛成“短而稳”的公开 API 面。
4. 在 `runtime-shell-v2` 提供统一的 runtime app/bootstrap 入口，显式接收 appConfig 并打印步骤日志。
5. 测试入口和测试分层规则统一，方便开发者快速找到 unit / integration / live 的入口。

## 总体方案

采用“包内装配 + 总装配”的方案。

### 一、每个包的统一目录角色

每个 `1-kernel/1.1-base/*` 包统一采用下面语义：

1. `src/application`
   只放对外装配入口、包级预处理、模块描述信息、开发者入口。
2. `src/features`
   只放 command / actor / slice 等运行时特征定义。
3. `src/foundations`
   只放内部实现细节，不作为首选对外接入入口。
4. `src/supports`
   放 errors / parameters / definition factory / helper 这类“稳定支持层”。
5. `src/index.ts`
   只导出稳定公开 API。

### 二、每个 runtime 包统一公开的 application 入口

所有 runtime 型包统一提供以下入口：

1. `createXxxModuleV2(input?)`
   对外主装配入口。
2. `xxxModuleV2Descriptor`
   用于阅读和 introspection，说明这个包包含哪些 slices / commands / actors / dependencies / assembly 需求。
3. `xxxModuleV2PreSetup(input?)`
   包级预处理入口。没有预处理逻辑的包也保留统一接口，返回空结果。

对应目录建议：

1. `src/application/createXxxModuleV2.ts`
2. `src/application/preSetup.ts`
3. `src/application/descriptor.ts`
4. `src/application/index.ts`

其中：

1. `src/application/createXxxModuleV2.ts` 是开发者主入口。
2. `src/foundations/module.ts` 不再作为公开入口；能删则删，不能删则只保留为内部 helper。

### 三、统一 runtime app/bootstrap 总入口

在 `runtime-shell-v2` 中增加一个新的总装配入口：

1. `createKernelRuntimeApp(config)`

它不是旧的 global singleton manager，而是一个显式工厂。

建议结构：

1. `src/application/createKernelRuntimeApp.ts`
2. `src/application/runtimeAppLogger.ts`
3. `src/application/runtimeAppConfig.ts`
4. `src/application/index.ts`

### 四、runtime app 的职责

`createKernelRuntimeApp(config)` 负责：

1. 解析模块列表与依赖关系。
2. 顺序执行 `module pre-setup`。
3. 收集 module descriptor 并输出加载摘要。
4. 创建 `KernelRuntimeV2`。
5. 调用每个 module 的 `install(context)`。
6. hydrate persistence。
7. 触发统一 initialize lifecycle command。
8. 输出完成日志。

注意：

1. runtime 真正执行核心仍然在 `createKernelRuntimeV2`。
2. `createKernelRuntimeApp` 是装配器，不是第二套 runtime。

### 五、统一的 appConfig

新增 `KernelRuntimeAppConfig`，显式承载初始化配置。

建议字段：

1. `runtimeName`
2. `localNodeId`
3. `platformPorts`
4. `modules`
5. `peerDispatchGateway`
6. `startupSeed`
   用于 error catalog / parameter catalog / 其他启动时注入
7. `logger`
   控制启动阶段日志
8. `initialize`
   控制是否在 start 后自动触发 initialize lifecycle

返回结果建议为：

1. `runtime`
2. `moduleGraph`
3. `descriptor`
4. `start()`
5. `flushPersistence()`

### 六、统一的模块描述对象

每个模块都应能被描述成一个稳定对象：

1. `moduleName`
2. `packageVersion`
3. `dependencies`
4. `stateSliceNames`
5. `commandNames`
6. `actorNames`
7. `errorKeys`
8. `parameterKeys`
9. `requiresAssembly`
10. `supportsPreSetup`

这样开发者不需要读 `features` 和 `foundations` 才知道模块是什么。

### 七、统一 `src/index.ts` 规则

`src/index.ts` 统一遵守以下规则：

1. 必须导出 `moduleName` 与 `packageVersion`。
2. 必须导出 `application`。
3. 可以导出 `types` / `supports` / `selectors` / `hooks`。
4. 可以导出少量稳定 `features/commands` 与 `features/slices`。
5. 默认不再 `export * from './foundations'`。

原因：

1. foundations 是内部实现层，不应该默认成为公开 API 面。
2. 公开 API 面过宽，会让开发者直接依赖内部对象，后续难以演进。

### 八、统一测试入口

每个包的 `test` 目录至少统一这几点：

1. `test/index.ts`
   只做包测试入口说明，或统一导入测试套件。
2. `test/helpers`
   放测试装配与复用工具。
3. `test/scenarios`
   放明确场景测试。

后续可进一步收敛为：

1. `test/unit`
2. `test/integration`
3. `test/live`

但本轮先不强行重排全部目录，只统一入口与说明。

## 第一轮落地范围

第一轮只做以下内容：

1. 在 `runtime-shell-v2` 引入 `createKernelRuntimeApp` 总装配入口。
2. 将 `tcp-control-runtime-v2` / `tdp-sync-runtime-v2` / `topology-runtime-v2` / `ui-runtime-v2` / `workflow-runtime-v2` 的模块入口迁入 `src/application`。
3. 统一这些包的 `src/index.ts` 导出风格。
4. 让空的 `src/application/index.ts` 变成真实入口。
5. 统一相关 `test/index.ts` 的风格与说明。

这一轮先不处理：

1. 所有非 runtime 型包的 application 目录深度建设。
2. 全量重排所有测试目录层级。
3. foundations 层的大规模拆文件。

## 开发者最终使用目标

重构后，希望开发者使用方式收敛成下面形式：

```ts
import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createTdpSyncRuntimeModuleV2} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {createTopologyRuntimeModuleV2} from '@impos2/kernel-base-topology-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'

const app = createKernelRuntimeApp({
    runtimeName: 'main-kernel-runtime',
    platformPorts,
    modules: [
        createTcpControlRuntimeModuleV2(),
        createTdpSyncRuntimeModuleV2(),
        createTopologyRuntimeModuleV2(),
        createUiRuntimeModuleV2(),
    ],
})

await app.start()
```

同时，当开发者打开任意一个包时，应能通过：

1. `src/application/index.ts`
2. `src/index.ts`

快速知道：

1. 这个包怎么装。
2. 这个包依赖什么。
3. 这个包公开什么。

## 风险与控制

### 风险 1

导出面调整可能影响现有测试与包间引用。

控制：

1. 第一轮保持旧导出兼容。
2. 新入口先增加，再逐步把使用方切过去。

### 风险 2

如果 app bootstrap 设计过重，会重新演变成旧 `ApplicationManager` 的超大职责。

控制：

1. `createKernelRuntimeApp` 只做装配，不承担业务逻辑。
2. runtime 真正执行能力仍然留在 `createKernelRuntimeV2`。

### 风险 3

application 层如果只是简单转发，可能被认为形式大于内容。

控制：

1. application 层必须承载真实装配职责、descriptor、pre-setup 与开发者说明。
2. 空 application 文件全部清理掉。

## 结论

本次结构规整不回退到旧 global manager 模式，而是：

1. 继承旧架构“显式装配、预处理入口、短导出、初始化步骤可观测”的优点。
2. 保留 v2 架构“单 runtime 真相源、协议明确、模块职责更清晰”的优点。
3. 用 `application` 层和 `runtime app bootstrap` 层，把“架构正确但阅读门槛高”的问题补回来。
