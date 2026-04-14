# Kernel Base Application Structure Implementation

## 本轮完成内容

本轮对 `1-kernel/1.1-base` 中核心 v2 runtime 包完成了一次成体系的结构规整，目标不是改业务能力，而是把“开发者怎么读、怎么装、怎么初始化”一次性理顺。

完成结果：

1. `runtime-shell-v2` 新增统一 app 装配入口 `createKernelRuntimeApp(...)`。
2. `runtime-shell-v2` 新增模块依赖排序、模块 descriptor、pre-setup 机制、启动日志汇总。
3. `tcp-control-runtime-v2`
4. `tdp-sync-runtime-v2`
5. `topology-runtime-v2`
6. `ui-runtime-v2`
7. `workflow-runtime-v2`

以上 5 个 runtime 包都已补齐真实的 `src/application` 主入口，不再让开发者只能从 `src/foundations/module.ts` 找模块工厂。

## 新结构规则

### 1. `src/application`

现在 `src/application` 是 runtime 包的第一公开入口，承载：

1. `createXxxModuleV2(...)`
2. `xxxModuleV2Descriptor`
3. `xxxRuntimeV2PreSetup`

要求：

1. 开发者优先从这里理解包的装配方式。
2. `foundations/module.ts` 只保留兼容性 re-export，不再作为首选阅读入口。

### 2. `src/index.ts`

现在统一遵守：

1. 导出 `moduleName`
2. 导出 `packageVersion`
3. 导出 `application`
4. 导出稳定的 `types / supports / selectors / hooks`
5. 导出必要的 `features/commands`，以及确实需要对外读取的 `features/slices`
6. 不再默认 `export * from './foundations'`

说明：

1. foundations 仍然存在，但不再作为默认公开面。
2. 只有确实被外部使用、且应该稳定的 foundations 能力才单独导出。

### 3. `createKernelRuntimeApp(...)`

`runtime-shell-v2` 现在提供新的总装配入口：

```ts
import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'

const app = createKernelRuntimeApp({
    runtimeName: 'kernel-main',
    platformPorts,
    modules: [
        createTcpControlRuntimeModuleV2(),
        createTdpSyncRuntimeModuleV2(),
        createTopologyRuntimeModuleV2(),
        createUiRuntimeModuleV2(),
        createWorkflowRuntimeModuleV2(),
    ],
})

await app.start()
```

它负责：

1. 按依赖关系排序模块
2. 执行各模块 `preSetup`
3. 输出启动阶段日志
4. 创建并启动 `KernelRuntimeV2`
5. 暴露统一的 `descriptor`

### 4. `preSetup`

每个 runtime 包现在都支持 `preSetup(context)`。

当前这一轮：

1. 主要用于显式声明“这个包在 runtime 启动前会参与装配”
2. 同时输出结构化日志
3. 没有引入额外复杂语义

后续如有需要，可以把包级预处理、环境校验、装配前准备逻辑继续收进这里。

### 5. 模块 descriptor

每个 runtime 包都补了静态 descriptor，统一包含：

1. `moduleName`
2. `packageVersion`
3. `dependencies`
4. `stateSliceNames`
5. `commandNames`
6. `actorKeys`
7. `errorKeys`
8. `parameterKeys`
9. `hasInstall`
10. `hasPreSetup`

用途：

1. 方便阅读
2. 方便日志输出
3. 方便后续做 runtime 自检和可视化

## 测试入口规整

本轮也统一了测试入口风格：

1. `runtime-shell-v2/test/index.ts`
2. `topology-runtime-v2/test/index.ts`
3. `workflow-runtime-v2/test/index.ts`

规则：

1. `test/index.ts` 只做测试套件入口导入
2. 不再在 `test/index.ts` 里直接 `exec vitest`

## 验证结果

已通过：

1. `@impos2/kernel-base-runtime-shell-v2` type-check
2. `@impos2/kernel-base-tcp-control-runtime-v2` type-check
3. `@impos2/kernel-base-tdp-sync-runtime-v2` type-check
4. `@impos2/kernel-base-topology-runtime-v2` type-check
5. `@impos2/kernel-base-ui-runtime-v2` type-check
6. `@impos2/kernel-base-workflow-runtime-v2` type-check
7. `@impos2/kernel-base-runtime-shell-v2` test
8. `@impos2/kernel-base-topology-runtime-v2` test
9. `@impos2/kernel-base-ui-runtime-v2` test
10. `@impos2/kernel-base-workflow-runtime-v2` test

## 后续约束

后续新增或重构 `1-kernel/1.1-base` runtime 包时，默认遵守：

1. 模块工厂写在 `src/application/createXxxModuleV2.ts`
2. descriptor 和 preSetup 与模块工厂放在同一 application 入口层
3. `src/index.ts` 不再整层 re-export foundations
4. `test/index.ts` 统一做套件入口导入
5. 总 runtime 初始化优先使用 `createKernelRuntimeApp(...)`

