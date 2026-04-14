# 2026-04-14 ui-runtime-v2 逐项能力对照

## 1. 审计范围

本文件对照三套实现：

1. 旧 `navigation`：`1-kernel/1.1-cores/navigation`
2. 旧 `ui-runtime`：`1-kernel/1.1-cores/ui-runtime`
3. 新 `ui-runtime-v2`：`1-kernel/1.1-base/ui-runtime-v2`

审计目标：

1. 判断旧 `navigation / ui-runtime` 的核心能力是否已迁移到 `ui-runtime-v2`
2. 区分“已继承”“已增强”“未迁移但应该后续做”“故意不做”
3. 为后续删除旧包、迁移 `2-ui` 提供依据

## 2. 总体结论

`ui-runtime-v2` 已经覆盖并增强了旧包的 kernel runtime 核心能力：

1. screen definition registry
2. container current screen runtime
3. overlay stack runtime
4. generic ui variable runtime
5. workspace 维度 state
6. 主副屏 state sync
7. 清空/重置的同步友好语义
8. 真双拓扑 live 验证

但旧包中有一类能力不应该迁入 `1-kernel`：

1. React hooks
2. `componentType` 注册与解析
3. `ScreenPart -> React component` 渲染桥接

这些能力当前在 `2-ui` 中仍有大量实际使用。新架构下应该在 `2-ui` 层建立 `rendererKey -> React component` 的桥接包，而不是把 React 依赖带回 `1-kernel`。

## 3. 能力矩阵

| 能力 | 旧 navigation | 旧 ui-runtime | ui-runtime-v2 | 结论 |
| --- | --- | --- | --- | --- |
| moduleName | 有 | 有 | 有 | 已继承 |
| packageVersion | 有 | 有 | 有 | 已继承 |
| Redux slice/state | 有，混在 `uiVariables` | 有，拆成 3 个 slice | 有，基于 `state-runtime` | 已增强 |
| Command/Actor | 有 | 有 | 有，基于 `runtime-shell-v2` | 已增强 |
| Screen registry | 有 | 有 | 有 | 已继承并去 React |
| `componentType` | 有 | 有 | 无 | 故意不做，迁到 `2-ui` |
| `rendererKey` | 无 | 无 | 有 | 新增强 |
| container current screen | 通过 `uiVariables[containerKey]` | 独立 `screen` slice | 独立 `screen` workspace slice | 已增强 |
| `showScreen` | `navigateTo` 间接实现 | 有 | 有 | 已增强 |
| `replaceScreen` | 无 | 有 | 有 | 已继承 |
| `resetScreen` | 无 | 有 | 有 | 已继承 |
| modal/overlay stack | `primaryModals/secondaryModals` | 独立 `overlay` slice | 独立 `overlay` workspace slice | 已增强 |
| `openOverlay/openModal` | `openModal` | `openOverlay` | `openOverlay` | 已继承 |
| `closeOverlay/closeModal` | `closeModal` | `closeOverlay` | `closeOverlay` | 已继承 |
| `clearOverlays` | 无 | 有 | 有 | 已继承 |
| UI variables | 有 | 有 | 有 | 已继承 |
| UI variable clear | 写 `value:null` | 写 `value:null` | 写 `value:null` | 已继承 |
| workspace sync | 依赖 interconnection | 依赖 interconnection | 依赖 topology-runtime-v2 + state-runtime | 已增强 |
| `MAIN -> MASTER_TO_SLAVE` | 有 | 有 | 有 | 已继承 |
| `BRANCH -> SLAVE_TO_MASTER` | 有 | 有 | 有 | 已继承并 live 验证 |
| owner-only persistence | 旧 base/interconnection | 旧 base/interconnection | state-runtime descriptor | 已增强 |
| hooks | 有 | 有 | 仅规则注释 | 故意不做 |
| apis | 空对象 | 空对象 | 无 api 导出 | 无业务价值，不迁 |
| epics/redux-observable | 有空结构 | 有空结构 | 无 | 按已确认规则移除 |
| middlewares | 有空结构 | 有空结构 | 无 | 按已确认规则移除 |

## 4. Screen Registry 对照

### 4.1 旧包能力

旧 `navigation/ui-runtime` 的 registry 能力包括：

1. `registerScreenPart`
2. `getScreenPartComponentType`
3. `getScreenPartReadyToEnter`
4. `getFirstReadyScreenPartByContainerKey`
5. `getScreenPartsByContainerKey`

关键业务特点：

1. 按 `screenMode` 分 registry
2. 按 `workspace` / `instanceMode` 过滤
3. 按 `indexInContainer` 排序
4. 支持 `readyToEnter`
5. 找到结果时去掉 `componentType`，返回纯 `ScreenPart`

### 4.2 v2 对照

`ui-runtime-v2` 已提供：

1. `registerUiScreenDefinitions`
2. `selectUiScreenDefinition`
3. `selectUiScreenDefinitionsByContainer`
4. `selectFirstReadyUiScreenDefinition`
5. `buildUiScreenRegistryContext`

继承点：

1. 仍然按 screen definition 驱动 UI
2. 仍然支持 `screenMode/workspace/instanceMode`
3. 仍然支持 `indexInContainer`
4. 仍然支持 `readyToEnter`
5. 仍然支持 container 下查找可进入 screen

增强点：

1. 不再依赖 React `ComponentType`
2. 用 `rendererKey` 作为 kernel 与 UI 层的公开协议
3. registry 类型从 `ScreenPartRegistration` 改成 `UiScreenDefinition`
4. selector 可显式传 context overrides，测试和未来 UI 层桥接更清晰

注意：

旧 `getScreenPartComponentType` 没迁到 v2 是正确的。这个能力要在未来 `2-ui` 层通过 `rendererKey -> component` 完成。

## 5. Screen Runtime 对照

### 5.1 旧 navigation

`navigation.navigateTo` 的实现方式：

1. 接收 `target: ScreenPart`
2. 如果 `target.containerKey` 存在，就调用 `setUiVariables({[containerKey]: target})`
3. 当前 screen 实际混在 `uiVariables` 里

缺点：

1. screen state 和普通 ui variable 混在一起
2. `containerKey` 是隐式变量 key
3. 语义上是 screen，存储上却是 uiVariables

### 5.2 旧 ui-runtime

旧 `ui-runtime` 已经修正为独立 `screen` slice：

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`
4. `ScreenRuntimeState = Record<containerKey, ValueWithUpdatedAt<ScreenEntry | null>>`

### 5.3 v2 对照

`ui-runtime-v2` 继续保留并增强：

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`
4. `UiScreenRuntimeEntry`
5. `selectUiScreen`

增强点：

1. 使用 `rendererKey`
2. 使用 `SyncValueEnvelope`
3. 持久化按 record 粒度描述，避免整个 slice 对象过大
4. actor 通过 `topology-runtime-v2` 读取 workspace
5. command result 明确返回 `containerKey`

已验证：

1. 单进程 command -> actor -> slice -> selector
2. 主到副真双拓扑同步
3. reset 后 `value:null` 同步

## 6. Overlay Runtime 对照

### 6.1 旧 navigation

旧 `navigation` 将 modal 放在 `uiVariables` slice 中：

1. `primaryModals`
2. `secondaryModals`
3. `openModal`
4. `closeModal`

### 6.2 旧 ui-runtime

旧 `ui-runtime` 改成独立 `overlay` slice：

1. `primaryOverlays`
2. `secondaryOverlays`
3. `openOverlay`
4. `closeOverlay`
5. `clearOverlays`

### 6.3 v2 对照

`ui-runtime-v2` 已继承：

1. `UiOverlayEntry`
2. `openOverlay`
3. `closeOverlay`
4. `clearOverlays`
5. `selectUiOverlays`
6. primary/secondary display split

增强点：

1. overlay entry 携带 `rendererKey`
2. overlay snapshot 作为 record sync entry，同步字段清晰
3. live 覆盖 open/close/clear

注意：

旧 `createModalScreen/createOverlayScreen` 是 UI 层构造 `ScreenPart` 的 helper。v2 当前只提供 `createUiOverlayEntry` 这种 kernel 内部工厂。未来如果 `2-ui` 需要更顺手的 helper，应在 UI 桥接包里提供 `createModalDefinitionRef` 或类似工厂，不应该回到 kernel 依赖 React。

## 7. UI Variables 对照

### 7.1 旧包能力

旧 `navigation/ui-runtime` 都支持：

1. `setUiVariables`
2. `clearUiVariables`
3. `selectUiVariable`
4. `useEditableUiVariable`
5. 每个 key 存 `ValueWithUpdatedAt`
6. clear 时写 `value:null`

### 7.2 v2 对照

`ui-runtime-v2` 已继承：

1. `setUiVariables`
2. `clearUiVariables`
3. `selectUiVariable`
4. record persistence
5. record sync
6. clear 写 `value:null`

增强点：

1. 持久化按 record 粒度描述
2. actor 只通过 command 写 state
3. live 覆盖 set/clear/reconnect

未迁移但不属于 kernel 缺口：

1. `useEditableUiVariable`
2. `UiVariable<T>` hook 类型

原因：

1. `1-kernel` 不依赖 React
2. hook 应由 `2-ui` 基于 v2 selector + command 封装

## 8. 同步与持久化对照

### 8.1 旧包

旧包依赖 `interconnection`：

1. `createWorkspaceSlice`
2. `dispatchWorkspaceAction`
3. `SyncType.MASTER_TO_SLAVE`
4. `SyncType.SLAVE_TO_MASTER`
5. `batchUpdateState`
6. `persistToStorage: true`

### 8.2 v2

v2 改为：

1. `state-runtime` 定义 slice descriptor
2. `topology-runtime-v2` 执行拓扑同步
3. `runtime-shell-v2` 执行 command/actor
4. `persistIntent: owner-only`
5. `syncIntent: master-to-slave / slave-to-master`
6. record/field persistence descriptor

增强点：

1. 同步协议从旧 `batchUpdateState` 隐式动作升级成 state descriptor
2. `screen/uiVariable` 支持 record 粒度持久化
3. live 已覆盖主到副、副到主、重连继续同步
4. 从机默认 `SLAVE + SECONDARY + MAIN workspace` 语义已在测试中固定

## 9. Command / Actor 对照

### 9.1 旧 navigation

命令：

1. `navigateTo`
2. `openModal`
3. `closeModal`
4. `setUiVariables`
5. `clearUiVariables`

actor：

1. `NavigateActor`
2. `UiVariableActor`

### 9.2 旧 ui-runtime

命令：

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`
4. `openOverlay`
5. `closeOverlay`
6. `clearOverlays`
7. `setUiVariables`
8. `clearUiVariables`

actor：

1. `ScreenActor`
2. `OverlayActor`
3. `UiVariableActor`

### 9.3 v2

命令：

1. `registerScreenDefinitions`
2. `showScreen`
3. `replaceScreen`
4. `resetScreen`
5. `openOverlay`
6. `closeOverlay`
7. `clearOverlays`
8. `setUiVariables`
9. `clearUiVariables`

actor：

1. `UiRuntimeScreenRegistryActor`
2. `UiRuntimeScreenRuntimeActor`
3. `UiRuntimeOverlayRuntimeActor`
4. `UiRuntimeVariableRuntimeActor`

增强点：

1. registry 注册也走 command
2. actor 按职责拆分
3. command result 有最小业务结果
4. 通过 `runtime-shell-v2` 获得统一 request/actor 执行模型

## 10. 对外 API 与 Hooks 对照

### 10.1 旧包仍被实际使用的 UI 层能力

仓库扫描发现，下面能力在 `2-ui` 仍有实际使用：

1. `useEditableUiVariable`
2. `useUiOverlays`
3. `useUiModels`
4. `useChildScreenPart`
5. `getScreenPartComponentType`
6. `getScreenPartsByContainerKey`
7. `createModalScreen`
8. `defaultAlertPartKey`

使用位置集中在：

1. `2-ui/2.1-cores/base`
2. `2-ui/2.1-cores/runtime-base`
3. `2-ui/2.1-cores/terminal`
4. `2-ui/2.2-modules/mixc-*`
5. `2-ui/2.3-integrations/mixc-retail`

### 10.2 v2 的处理结论

这些能力不能直接迁到 `1-kernel/1.1-base/ui-runtime-v2`，原因是：

1. 它们依赖 React 或 react-redux
2. 它们依赖 `ComponentType`
3. 它们是 UI 渲染层能力，不是 kernel runtime 真相源能力

后续正确方向：

1. 在 `2-ui` 建一个基于 v2 的 runtime bridge
2. bridge 负责 `rendererKey -> React component`
3. bridge 提供 `useEditableUiVariableV2 / useUiOverlaysV2 / useChildScreenDefinitionV2`
4. bridge 使用 `ui-runtime-v2` 的 selector 和 command

## 11. Error / Parameter / API 对照

### 11.1 Error

旧包：

1. `navigation.error`
2. `ui-runtime.error`

v2：

1. `invalid_screen_target`
2. `duplicated_screen_definition`
3. `overlay_id_required`

结论：

v2 更具体，已增强。

### 11.2 Parameter

旧包：

1. 空参数对象

v2：

1. `registry.cache-size-hint`

结论：

v2 已具备参数定义能力，但当前业务参数还很少。没有发现旧包有必须迁移的参数。

### 11.3 API

旧包：

1. `kernelCoreNavigationApis = {}`
2. `kernelCoreUiRuntimeApis = {}`

v2：

1. 不导出空 api 对象

结论：

不迁移空 API 是正确的。

## 12. 测试对照

旧 `ui-runtime`：

1. 单进程状态验证
2. 旧 `master-ws-server-dual` 双进程验证
3. 验证 slave secondary display 仍在 main workspace

v2：

1. 单进程 runtime 测试
2. state-runtime descriptor sync 测试
3. 真实 `dual-topology-host` 主到副 live
4. clear/reset live
5. reconnect live
6. branch slave-to-master live

结论：

v2 的测试覆盖已经超过旧包。

## 13. 删除旧包前的阻碍

从 kernel runtime 能力看，`ui-runtime-v2` 已经足够替代旧 `ui-runtime/navigation`。

真正阻碍不是 kernel 能力缺失，而是 `2-ui` 仍依赖旧 UI 层 API：

1. `componentType` 注册
2. `getScreenPartComponentType`
3. React hooks
4. `createModalScreen`
5. `defaultAlertPartKey`

因此删除旧包前需要先做：

1. 设计 `2-ui` 的 v2 bridge 包
2. 迁移 `2-ui` screen part 定义到 `rendererKey`
3. 迁移 UI hooks
4. 迁移 modal/screen container 渲染逻辑
5. 迁移业务模块的 `screenParts`

## 14. 最终判断

`ui-runtime-v2` 的 kernel runtime 能力已经迁移完成，并且比旧 `navigation/ui-runtime` 更专业：

1. kernel 不再依赖 React
2. runtime state 分层更清晰
3. sync/persistence 由 descriptor 明确声明
4. command/actor 边界更清楚
5. live 场景覆盖更扎实

后续不应该继续往 `ui-runtime-v2` 塞 React 相关兼容 API。

下一步建议直接进入 `2-ui runtime bridge` 的设计与落地。
