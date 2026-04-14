# 2026-04-14 旧 core 到 base 的迁移审计

## 1. 审计目标

本轮审计范围：

1. `1-kernel/1.1-cores/base`
2. `1-kernel/1.1-cores/interconnection`
3. `1-kernel/1.1-cores/communication`
4. `1-kernel/1.1-cores/navigation`
5. `1-kernel/1.1-cores/task`
6. `1-kernel/1.1-cores/tcp-client`
7. `1-kernel/1.1-cores/tdp-client`
8. `1-kernel/1.1-cores/terminal`

明确排除：

1. `1-kernel/1.1-cores/ui-runtime`
2. `1-kernel/1.1-cores/shared-dev`

排除原因：

1. `ui-runtime` 是新替代包，本轮问题已明确排除。
2. `shared-dev` 是旧 core 开发验证辅助目录，不是运行时包。新测试辅助能力已经迁到 `1-kernel/test-support`。

审计判断标准：

1. 先判断旧包的核心业务能力是否已经在 `1-kernel/1.1-base` 有新架构承接。
2. 再判断未承接内容是否属于旧包的错误边界、旧业务 read model、旧 API 兼容层。
3. 只有属于“仍应保留的核心能力”但未迁移时，才继续迁移。

---

## 2. 总体结论

总体结论：

1. 除 `ui-runtime` 外，旧 `1.1-cores` 里应进入 `1.1-base` 的核心基础能力已经基本完成迁移。
2. 本轮确认并补齐了一个真实缺口：旧 `task` 的 platform-aware definition 选择能力。
3. 旧 `terminal` 的底层核心能力已经被 `tcp-control-runtime-v2`、`tdp-sync-runtime-v2`、`topology-runtime-v2` 拆分承接。
4. 旧 `terminal` 的 `Unit / unitData / rootPath` 模型不应直接迁入 `1.1-base`，后续业务包应通过 `tdpTopicDataChanged` 自行建立业务 state/read model。
5. 旧 `navigation` 已由 `1-kernel/1.1-cores/ui-runtime` 作为专项替代方向承接，不属于 `1.1-base` 目标。

本轮已经补齐：

1. `workflow-runtime-v2` 增加 `runtimePlatform` 输入。
2. `workflow-runtime-v2` 的 definition resolver 支持按 `os / osVersion / deviceModel / runtimeVersion / capabilities` 匹配。
3. 匹配规则继承旧 `TaskSystem.setOperatingSystem()` 的业务价值，但不恢复全局单例。
4. 增加测试覆盖 platform-specific definition 优先，未匹配时回退 generic definition。

验证结果：

1. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`
2. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 type-check`

---

## 3. 逐包迁移对账

### 3.1 `base`

旧 `base` 核心能力：

1. moduleName 与包级命名空间。
2. command / actor 基础模型。
3. request 状态与结果观测。
4. Redux store 与 slice 装载。
5. errorMessages / systemParameters。
6. logger、time、runtime id。
7. adapter / connector / script executor 等平台边界。
8. hooks 统一出口。

新承接包：

1. `contracts`
2. `platform-ports`
3. `state-runtime`
4. `runtime-shell-v2`
5. `definition-registry`

当前结论：

1. 已迁移。
2. `storeEntry`、旧 `ApiManager`、旧全局 manager 并列模式不再保留。
3. request 真相源已经迁到 `runtime-shell-v2` 的内存 ledger，并提供 `queryRequest / subscribeRequest`。
4. errorMessages / systemParameters 已迁入 `runtime-shell-v2` catalog，并支持由 TDP system topic 动态更新。
5. hooks 目录保留，但 kernel 包不依赖 React。

### 3.2 `communication`

旧 `communication` 核心能力：

1. HTTP endpoint / client / runtime。
2. WS profile / socket runtime。
3. 多 server address 切换。
4. 失败重试。
5. transport error 归一化。
6. 和 server config 动态注入配合。

新承接包：

1. `transport-runtime`
2. `server-config-v2`
3. `1-kernel/test-support/serverConfig.ts`

当前结论：

1. 已迁移核心能力。
2. HTTP 地址切换、失败重试、有效地址保持已经在 `transport-runtime` 测试里验证。
3. `server-config-v2` 只保留纯配置，不再承载 resolver/helper。
4. server config 结构类型归入 `transport-runtime`。
5. 测试解析和 override 逻辑归入 `1-kernel/test-support`。

未直接搬迁的旧设计：

1. 旧 communication 的完整 interceptor 体系。
2. 旧 envelope 自动解包策略。
3. 旧 request queue / 限流扩展。

判断：

1. 这些属于后续增强项，不是当前 core 迁移阻塞项。
2. 当前 TCP/TDP/Workflow/Topology 的 base 验证不依赖这些能力。
3. 不应为了追平旧包而把 `transport-runtime` 重新做成大包。

### 3.3 `interconnection`

旧 `interconnection` 核心能力：

1. instanceMode / displayMode / workspace。
2. masterInfo 持久化与重启自动连接。
3. 双屏 command 路由。
4. request lifecycle 与 request result 镜像。
5. 主副屏 state sync。
6. 断线重连后的自动同步，而不是盲目 flush。
7. local web server / master WS 接入。

新承接包：

1. `topology-runtime-v2`
2. `runtime-shell-v2`
3. `state-runtime`
4. `0-mock-server/dual-topology-host`

当前结论：

1. 已迁移。
2. `topology-runtime-v2` 合并了承接旧 `topology-runtime` 与 `topology-client-runtime` 的能力。
3. `runtime-shell-v2` 提供本机 command ledger 和 request 查询。
4. `topology-runtime-v2` 提供 peer dispatch gateway、request mirror、state sync、resume/reconnect。
5. `dual-topology-host` 已作为真实双屏 mock 验证入口。

### 3.4 `navigation`

旧 `navigation` 核心能力：

1. screen runtime。
2. uiVariables。
3. workspace slice。
4. 主副屏 UI 状态同步。

新承接包：

1. `1-kernel/1.1-cores/ui-runtime`

当前结论：

1. 本轮不迁入 `1.1-base`。
2. 这是已明确的专项替代方向。
3. 对照文档为 `docs/superpowers/specs/2026-04-08-ui-runtime-design.md`。

### 3.5 `task`

旧 `task` 核心能力：

1. `TaskDefinition` 注册与动态更新。
2. `TaskSystem` 执行入口。
3. 流式 progress。
4. command adapter。
5. external call / subscribe / on adapter。
6. script 执行。
7. timeout。
8. cancel。
9. loop。
10. requestId 关联观测。
11. 按 `os / osVersion` 选择 task definition。

新承接包：

1. `workflow-runtime-v2`
2. `platform-ports`
3. `runtime-shell-v2`
4. `tdp-sync-runtime-v2`

当前结论：

1. 已迁移，并在本轮补齐最后一个核心缺口。
2. 旧 `TaskSystem` 不再作为全局单例保留。
3. 旧 `executeTask` 升级为 `runWorkflow`。
4. 旧 progress 升级为 `WorkflowObservation`。
5. 旧 `taskDefinitions` slice 升级为 `workflowDefinitions` slice。
6. 旧 external adapters 升级为 connector port 下的 `external-call / external-subscribe / external-on` step。
7. 旧 command adapter 升级为 `command` step，通过 `runtime-shell-v2` 的 `dispatchCommand` 执行。
8. 旧动态 task definition 更新升级为 workflow definitions command 和 TDP topic 下发。

本轮补齐：

1. `CreateWorkflowRuntimeModuleV2Input.runtimePlatform`。
2. `resolveWorkflowDefinitionFromSources(..., runtimePlatform)`。
3. platform matcher 支持：
   1. `os`
   2. `osVersion`
   3. `deviceModel`
   4. `runtimeVersion`
   5. `capabilities`
4. 同 source 内先选 platform-specific definition，找不到再回退 generic definition。

### 3.6 `tcp-client`

旧 `tcp-client` 核心能力：

1. terminal activation。
2. terminal identity。
3. credential refresh。
4. binding context。
5. task result report。
6. identity / credential / binding 持久化恢复。
7. runtime-only request 观测。

新承接包：

1. `tcp-control-runtime-v2`
2. `transport-runtime`
3. `state-runtime`

当前结论：

1. 已迁移。
2. 真实 `mock-terminal-platform` 激活、refresh、task result report、重启恢复均已覆盖。

### 3.7 `tdp-client`

旧 `tdp-client` 核心能力：

1. TDP session handshake。
2. snapshot / changes / projection push。
3. cursor / ack / applied state report。
4. command inbox。
5. control signals。
6. 无限期真实场景重连，测试可限制次数。
7. projection 仓库存入 state，按 projection id 拆分。
8. scope priority 生效值计算。
9. `tdpTopicDataChanged` 生效变化广播。
10. error.message / system.parameter system topic 桥接。
11. workflow definitions topic 下发。

新承接包：

1. `tdp-sync-runtime-v2`
2. `tcp-control-runtime-v2`
3. `runtime-shell-v2`
4. `workflow-runtime-v2`

当前结论：

1. 已迁移。
2. `tdp-sync-runtime-v2` 已承担全量 projection 仓库、scope priority、topic 生效变化、ACK/STATE_REPORT、command inbox、system catalog bridge。
3. `workflow-runtime-v2` 通过监听 `tdpTopicDataChanged` 更新 remote workflow definitions。

### 3.8 `terminal`

旧 `terminal` 实际混合了多类职责：

1. 终端激活与 token。
2. kernel WS 连接。
3. remote command 接收与确认。
4. unitData group 拉取、持久化与生效值计算。
5. errorMessages / systemParameters / taskDefinitions 的 unitData 桥接。
6. 业务包复用的 `createUnitDataStateKeys / generateUnitDataSliceConfig / getPathValuesFromUnitData`。
7. terminalConnection 状态与 UI 读取。
8. `setOperatingEntity / deactivateDevice / sendStateToServer` 等旧 kernel-server API。

新承接结果：

1. 激活与 token：`tcp-control-runtime-v2`。
2. TDP/WS session：`tdp-sync-runtime-v2`。
3. remote command delivery：`tdp-sync-runtime-v2` command inbox + `tcp-control-runtime-v2.reportTaskResult`。
4. projection data store：`tdp-sync-runtime-v2` projection repository。
5. scope priority：`tdp-sync-runtime-v2` selectors 和 `tdpTopicDataChanged`。
6. errorMessages / systemParameters：`tdp-sync-runtime-v2` system catalog bridge 到 `runtime-shell-v2`。
7. workflow definitions：`workflow-runtime-v2` 监听 workflow topic。
8. 主副屏状态同步：业务 read model 通过 `state-runtime` sync + `topology-runtime-v2` 承接。
9. 连接状态：TDP 连接状态由 `selectTdpSessionState` 读取，双屏 topology 连接状态由 `selectTopologyConnection` 读取。

当前结论：

1. 底层核心能力已迁移。
2. 不应把旧 `Unit / unitData / rootPath` 作为 base 真相源迁入 `1.1-base`。
3. 不应在 `tdp-sync-runtime-v2` 内直接消费业务 topic 并调用业务 command。
4. 后续业务包迁移时，应自行监听 `tdpTopicDataChanged`，把自己关心的 topic 转成自己的 state。
5. 旧 `createUnitDataStateKeys / generateUnitDataSliceConfig / getPathValuesFromUnitData` 如果后续大量重复出现，可以抽轻量业务 helper，但不应成为 base runtime 的核心职责。

明确不迁入 base 的旧 terminal 内容：

1. `Unit / unitData / rootPath` 作为中心模型。
2. `setOperatingEntity` 旧 kernel-server API。
3. `deactivateDevice` 旧 kernel-server API。
4. `sendStateToServer` 旧调试式全量 state 上报 API。
5. 旧 `kernel-ws` 单例客户端。

判断理由：

1. 这些内容会把旧 terminal 的混责重新带回 base。
2. 新架构已经将 TCP 控制面、TDP 数据面、双屏拓扑、业务 read model 分开。
3. 后续 `1-kernel/1.2-business` 迁移时应基于 topic + command + state-runtime 重建业务状态，而不是复用旧 terminal 的 unitData 中心模型。

---

## 4. 本轮代码变更

修改文件：

1. `1-kernel/1.1-base/workflow-runtime-v2/src/types/runtime.ts`
2. `1-kernel/1.1-base/workflow-runtime-v2/src/foundations/definitionResolver.ts`
3. `1-kernel/1.1-base/workflow-runtime-v2/src/foundations/engine.ts`
4. `1-kernel/1.1-base/workflow-runtime-v2/src/foundations/module.ts`
5. `1-kernel/1.1-base/workflow-runtime-v2/test/scenarios/workflow-runtime-v2.spec.ts`

新增能力：

1. workflow module 支持注入 `runtimePlatform`。
2. workflow definition resolver 支持 platform-specific 匹配。
3. 测试覆盖 platform-specific 优先与 generic fallback。

---

## 5. 后续建议

下一步不建议再新建 `terminal-runtime` 或 `unit-data-runtime` 放到 `1.1-base`。

建议后续顺序：

1. 以 `1-kernel/1.2-modules` 的真实业务使用为样本，设计 `1-kernel/1.2-business` 的 topic 消费规范。
2. 对每个业务包明确：
   1. 监听哪个 `tdpTopicDataChanged` topic。
   2. 转成哪个业务 state。
   3. 暴露哪个业务 command。
   4. 结果是否需要 `tcp-control-runtime-v2.reportTaskResult` 回报。
3. 如果多个业务包反复需要相同的 topic-to-state helper，再抽轻量 helper 包。
4. 不要把旧 `terminal` 的 `Unit / unitData / rootPath` 回灌到 `1.1-base`。

当前可进入下一阶段：

1. 继续完善基础包验证覆盖。
2. 或开始规划旧业务包到 `1-kernel/1.2-business` 的迁移方式。
