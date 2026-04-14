# Kernel Base Application Structure Second Pass

## 本轮目标

在第一轮完成 v2 runtime 包装配入口规整之后，这一轮继续收束两个问题：

1. 非 v2 基础包的 `src/application` 不能继续空着，必须承担真实公开入口职责。
2. `ui-runtime-v2` 需要补回旧 `navigation / ui-runtime` 中那些“开发者一看就会用”的 helper 与 selector 能力，而不是只保留底层 command。

## 一、非 v2 基础包的 `application` 规则

本轮已统一以下包：

1. `contracts`
2. `definition-registry`
3. `execution-runtime`
4. `host-runtime`
5. `platform-ports`
6. `state-runtime`
7. `transport-runtime`

统一原则：

1. 这些包不是 runtime module，不需要伪造 `createXxxModule`。
2. 但它们的 `src/application` 仍然必须是真实公开入口，而不是空目录。
3. `src/application/index.ts` 只暴露“开发者在装配或使用时最先应该看到的稳定工厂/入口”。
4. `src/index.ts` 优先导出 `application`，不再直接把 `foundations` 整层铺开。

### 当前各包公开入口

1. `contracts`
   1. definition / error / runtimeId / time / validator
2. `definition-registry`
   1. registry
3. `execution-runtime`
   1. command / createExecutionRuntime
4. `host-runtime`
   1. createHostRuntime
5. `platform-ports`
   1. createPlatformPorts / logger
6. `state-runtime`
   1. createStateRuntime
7. `transport-runtime`
   1. typed / http endpoint & policy / http runtime / http service factory / socket profile & runtime

结论：

1. `src/application` 现在不再是摆设。
2. 开发者打开包后，先看 `application` 就能知道该包怎么被使用。

## 二、`ui-runtime-v2` 继承并增强的 helper 能力

本轮从旧 `navigation` 与旧 `ui-runtime` 里保留并迁回了这些能力，但基于新架构重新落位：

1. 全局 screen registry 继续保留。
2. 支持通过 `partKey` 直接查询 `rendererKey`。
3. 支持按 `containerKey + runtime context` 查询候选 screen definitions。
4. 支持在“当前 screen 为空”时，自动回退到第一个 ready screen。
5. 支持 overlay / modal / alert 的 helper factory，降低业务直接拼 runtime entry 的成本。

### 新增 helper / selector

1. `registerUiScreenDefinition`
2. `registerUiScreenDefinitions`
3. `selectUiScreenRendererKey`
4. `selectUiCurrentScreenOrFirstReady`
5. `createUiOverlayScreen`
6. `createUiModalScreen`
7. `createUiAlertDefinition`
8. `createUiAlertScreen`

### 边界约束

1. 仍然不依赖 React。
2. 仍然以 `rendererKey: string` 为桥接点，而不是直接暴露组件类型。
3. helper 只负责定义构造与查询便利性，不引入新的运行时真相源。

## 三、测试入口统一

本轮把之前残留的脚本式测试也统一收束了。

已统一为 `vitest` 套件入口的包：

1. `contracts`
2. `definition-registry`
3. `execution-runtime`
4. `host-runtime`
5. `platform-ports`
6. `state-runtime`
7. `transport-runtime`
8. `runtime-shell-v2`
9. `ui-runtime-v2`

统一规则：

1. `test/index.ts` 只做套件导入。
2. 真正测试文件放在 `test/scenarios/*`.
3. 不再用 `tsx ./test/index.ts` 承担测试执行器职责。

原因：

1. `vitest` 才是当前仓库这批基础包的一致测试执行器。
2. 脚本式测试入口会让 `test/index.ts` 同时承担“执行器 + 测试内容”，结构不清晰。
3. 切到 `vitest` 后，测试发现、单测扩展、IDE 阅读都更直接。

补充规则：

1. 如果某个 workspace 包新增了 `vitest` 脚本或其他新工具依赖，必须同步刷新仓库安装状态与 `yarn.lock`。

## 四、当前验证结果

本轮实际通过的校验包括：

1. `@impos2/kernel-base-contracts` type-check
2. `@impos2/kernel-base-contracts` test
3. `@impos2/kernel-base-definition-registry` type-check
4. `@impos2/kernel-base-definition-registry` test
5. `@impos2/kernel-base-execution-runtime` type-check
6. `@impos2/kernel-base-execution-runtime` test
7. `@impos2/kernel-base-host-runtime` type-check
8. `@impos2/kernel-base-host-runtime` test
9. `@impos2/kernel-base-platform-ports` type-check
10. `@impos2/kernel-base-platform-ports` test
11. `@impos2/kernel-base-state-runtime` type-check
12. `@impos2/kernel-base-state-runtime` test
13. `@impos2/kernel-base-transport-runtime` type-check
14. `@impos2/kernel-base-transport-runtime` test
15. `@impos2/kernel-base-runtime-shell-v2` type-check
16. `@impos2/kernel-base-runtime-shell-v2` test
17. `@impos2/kernel-base-ui-runtime-v2` type-check
18. `@impos2/kernel-base-ui-runtime-v2` test

其中 `ui-runtime-v2` 已覆盖：

1. helper/selectors 单元语义
2. 基于真实 `0-mock-server/dual-topology-host` 的主从双拓扑 live 同步场景

## 五、收束后的结构约束

后续继续重构 `1-kernel/1.1-base` 时，默认遵守：

1. `src/application` 必须是真实入口，不允许空目录占位。
2. 非 runtime 包的 `application` 暴露“稳定使用入口”，不是内部实现全集。
3. runtime 包的 `application` 暴露“装配入口”，不是把模块工厂继续藏回 `foundations`。
4. `src/index.ts` 默认不再整层暴露 `foundations`。
5. `test/index.ts` 默认只做套件导入。
6. 任何包级 helper，都优先做成“降低业务定义成本”的工厂/selector，而不是让业务拼原始结构。

补充一条经过本轮验证的新规则：

1. `foundations` 不应再作为根导出层直接暴露。
2. 如果某个基础对象已经被外部真实依赖，而且它表达的是“稳定协议或稳定 DSL”，应迁到 `application` 或 `supports`。
3. 典型例子：
   1. `runtime-shell-v2` 的 `createKernelRuntimeV2` 属于 `application`。
   2. `runtime-shell-v2` 的 `defineCommand / createCommand / onCommand` 属于稳定 DSL，放进 `supports`。
   3. `tdp-sync-runtime-v2` 的 `tdpSyncV2SocketProfile` 属于稳定 socket 协议，放进 `supports/socketProfile.ts`。
4. 如果某个 foundations 符号没有被外部真实使用，或者只是内部装配细节，就不要继续根导出。

## 六、下一步价值

这轮收束完成后，`1-kernel/1.1-base` 的开发者体验已经比前一版更清晰：

1. 打开任意包都能更快知道“从哪开始用”。
2. 初始化入口、helper、测试入口的认知模型开始统一。
3. 后续继续迁移 `ui-runtime-v2`、以及再往上迁移业务包时，阅读和继承成本会更低。
