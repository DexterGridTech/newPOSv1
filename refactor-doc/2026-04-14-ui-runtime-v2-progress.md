# 2026-04-14 ui-runtime-v2 当前进展

## 1. 当前结论

`1-kernel/1.1-base/ui-runtime-v2` 第一阶段已经完成到“可以作为后续 UI 迁移底座”的程度。

已完成的不是只有包结构和单测，而是包含真实双拓扑 live 验证：

1. `screen` 主到副同步。
2. `overlay` 主到副同步。
3. `uiVariables` 主到副同步。
4. `reset / clear` 的同步语义。
5. 断线重连后的持续同步。
6. `branch` 工作区从副到主同步。

## 2. 本轮补齐的关键点

### 2.1 从机上下文语义回归旧工程

live harness 已按旧工程真实语义收紧：

1. slave 默认 `instanceMode=SLAVE`
2. slave 默认 `displayMode=SECONDARY`
3. slave 在这个模式下 `workspace=MAIN`

这和旧 `ui-runtime` 的双进程验证保持一致，避免出现“测试通过但业务语义偏移”。

同时保留了可选能力：

1. 当 slave 设置为 `displayMode=PRIMARY` 时，workspace 会进入 `BRANCH`
2. 用于验证 `Workspace.BRANCH -> slave-to-master` 的反向同步语义

### 2.2 新增 live 场景

新增并通过：

1. `ui-runtime-v2-live-clear-master-to-slave.spec.ts`
2. `ui-runtime-v2-live-reconnect-master-to-slave.spec.ts`
3. `ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts`

对应覆盖：

1. `screen.reset -> value: null`
2. `clearOverlays -> []`
3. `clearUiVariables -> value: null`
4. 真双拓扑断线后 reconnect，再继续 authoritative sync
5. `branch` 工作区 screen 从 slave 同步回 master

## 3. 当前验证矩阵

### 3.1 包内语义

已覆盖：

1. screen definition registry
2. show / replace / reset
3. open / close / clear overlays
4. set / clear ui variables
5. selector 默认值与查询语义

文件：

1. [ui-runtime-v2.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2.spec.ts)

### 3.2 descriptor / sync 语义

已覆盖：

1. record sync
2. overlay snapshot sync
3. `null` 清理语义

文件：

1. [ui-runtime-v2-state-sync.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-state-sync.spec.ts)

### 3.3 真双拓扑 live

已覆盖：

1. 主屏 screen -> 副屏
2. 主屏 overlay -> 副屏
3. 主屏 uiVariables -> 副屏
4. 主屏 clear/reset -> 副屏
5. relay forced disconnect -> reconnect -> 再次同步
6. branch screen 副到主

文件：

1. [ui-runtime-v2-live-screen-master-to-slave.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-screen-master-to-slave.spec.ts)
2. [ui-runtime-v2-live-overlay-master-to-slave.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-overlay-master-to-slave.spec.ts)
3. [ui-runtime-v2-live-ui-variables-master-to-slave.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-ui-variables-master-to-slave.spec.ts)
4. [ui-runtime-v2-live-clear-master-to-slave.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-clear-master-to-slave.spec.ts)
5. [ui-runtime-v2-live-reconnect-master-to-slave.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-reconnect-master-to-slave.spec.ts)
6. [ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts)

## 4. 本轮确认可继承的规则

### 4.1 kernel 不依赖 React

继续成立：

1. `ui-runtime-v2` 只暴露 `rendererKey`
2. 不存 `componentType`
3. 真正的 `rendererKey -> React component` 映射留给 `2-ui`

### 4.2 action 不作为跨包写入口

继续成立：

1. state 全局可读
2. command 对外公开
3. slice action 只在包内 actor 使用

### 4.3 清理必须是同步友好的显式值

继续成立：

1. screen reset 写 `value: null`
2. ui variable clear 写 `value: null`
3. overlay clear 写 `[]`
4. 不依赖直接 delete

### 4.4 UI runtime 的同步验证必须看真实 slice

继续成立：

1. 不能只看“当前 selector”
2. live 断言必须直接检查目标 workspace slice
3. 因为 slave 的 current context 与被同步 workspace 可能不是同一视角

## 5. 当前仍然故意不做的事情

这些不是遗漏，是本阶段明确不做：

1. 不接 React hooks
2. 不接 `2-ui` renderer registry
3. 不实现 screen 生命周期 guard / resolver
4. 不实现业务级 route/history/back stack
5. 不迁移旧 `ui-runtime` 的所有外部消费者

## 6. 对后续工作的意义

这意味着后续可以进入两个方向：

1. 继续做旧 `_old_/1-kernel/1.1-cores/ui-runtime` 与 `navigation` 的能力对比清单，确认旧包还能否删除
2. 开始设计 `2-ui` 如何消费 `rendererKey`，建立真正的 UI 渲染桥接

在当前阶段，`ui-runtime-v2` 已经具备继续承接后续迁移的基础条件。
