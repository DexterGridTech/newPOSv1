# newPOSv1 终端架构总览

本仓库中的终端程序由 `1-kernel`、`2-ui`、`3-adapter`、`4-assembly` 四层组成，面向商场/餐饮 POS 终端的多屏、多机、在线主数据、热更新、运维自动化与后台联动场景。当前产品命名统一为 **NEXT**，包名统一使用 `@next/*`，Android namespace/applicationId 使用 `com.next.*`。

本文描述终端侧的总体架构、设计原则、依赖方向、加载关系和扩展规范。涉及具体包实现前，应同时阅读：

1. `AGENTS.md`
2. `spec/layered-runtime-communication-standard.md`
3. `spec/kernel-core-dev-methodology.md`
4. `spec/kernel-core-ui-runtime-dev-methodology.md`
5. `docs/superpowers/specs/2026-04-08-ui-runtime-design.md`

## 目录分层

```text
1-kernel/
  1.1-base/          基础 kernel runtime、协议、状态、通信、拓扑、TDP、UI runtime、workflow
  1.2-business/      终端业务 kernel 包：主数据、业务读模型、业务 command/selector
  server-config-v2/  运行时服务器空间和服务地址配置

2-ui/
  2.1-base/          UI 基础运行时、桥接、运维工具、自动化能力
  2.2-business/      业务 UI 组件/工作台，只渲染业务状态并发起 public command
  2.3-integration/   产品级 UI 集成 shell，组合 base UI 与 business UI

3-adapter/
  android/           Android 原生能力适配、RN84 可复用 host runtime

4-assembly/
  android/           产品 assembly，负责最终 App 组合、产品参数和 Android 壳
```

## 核心设计思想

### 一、四层职责边界

| 层级 | 核心职责 | 禁止事项 |
| --- | --- | --- |
| `1-kernel` | 协议、状态、command、actor、selector、业务事实与领域状态迁移 | 禁止依赖 React/RN/Android；禁止持有具体 UI 组件；禁止直接调用平台 API |
| `2-ui` | 渲染 state、提供交互 bridge、组装 UI runtime、运维 UI、自动化语义节点 | 禁止直接改 kernel slice；禁止绕过 public command 拼完整领域链路 |
| `3-adapter` | 暴露 Android/RN 原生事实和能力，提供可复用 host runtime | 禁止依赖业务包；禁止沉淀产品业务逻辑 |
| `4-assembly` | 产品最终组合、产品参数、入口、打包、发布和极薄 wiring | 禁止长期承载业务状态机；能力缺口应下沉到 base/UI/adapter |

跨层写操作统一走 **public command**。跨层读操作优先走 **selector/state**。需要用户确认的领域行为必须拆成：

```text
kernel request command -> UI bridge/alert/modal -> user confirm -> kernel execute command
```

例如拓扑电源状态变化触发显示模式切换时，由 topology runtime 发起确认请求，由 `topology-runtime-bridge` 打开默认确认框，再由确认按钮 dispatch `confirmPowerDisplayModeSwitch`。

### 二、状态是 UI 的真相源

UI 不应通过 ad hoc 本地变量硬拼页面变化。终端界面变化必须跟随 state：

- TCP 激活状态来自 `tcp-control-runtime-v2`。
- TDP projection 与 topic 变化来自 `tdp-sync-runtime-v2`。
- 主副机/显示模式来自 `topology-runtime-v3`。
- 页面、overlay、alert、变量来自 `ui-runtime-v2`。
- 业务主数据来自 `1.2-business` 对应业务包。

### 三、Assembly 越薄越好

`4-assembly/android/mixc-catering-assembly-rn84` 是当前 Android RN84 产品 assembly。它应只组合：

- `@next/host-runtime-rn84`
- 产品需要的 `@next/ui-integration-*` shell
- Android application metadata、entry、Gradle 打包、release manifest

不应在 assembly 中补业务状态机、业务主数据映射、拓扑策略或 UI 业务逻辑。如果 lower layer 能力不足，应优先补：

1. `1-kernel/1.1-base` 的协议/command/actor/selector
2. `1-kernel/1.2-business` 的业务状态和 read model
3. `2-ui/2.1-base` 的 bridge/runtime 能力
4. `2-ui/2.2-business` 的业务 UI
5. `3-adapter/android` 的平台端口或原生能力

## 依赖关系

推荐依赖方向如下：

```text
4-assembly/android/*
  -> 3-adapter/android/host-runtime-rn84
  -> 2-ui/2.3-integration/*
      -> 2-ui/2.2-business/*
      -> 2-ui/2.1-base/*
      -> 1-kernel/1.2-business/*
      -> 1-kernel/1.1-base/*
  -> 1-kernel/server-config-v2

3-adapter/android/host-runtime-rn84
  -> 3-adapter/android/adapter-android-v2
  -> 2-ui/2.1-base/*
  -> 1-kernel/1.1-base/*
  -> 1-kernel/server-config-v2
  ! must not -> 1-kernel/1.2-business/* or 2-ui/2.2-business/*
```

禁止反向依赖：

- `1-kernel` 不依赖 `2-ui`、`3-adapter`、`4-assembly`。
- `2-ui/2.1-base` 不依赖具体产品 assembly。
- `3-adapter/android/host-runtime-rn84` 不依赖任何 business 包。
- 业务包不直接 import 他包 slice action 改状态。

## 加载关系

终端 App 的典型加载顺序：

1. Android 启动 `MainActivity`，RN84 host runtime 创建 launch options。
2. `host-runtime-rn84` 创建 platform ports、native wrappers、state storage、automation host、hot-update port。
3. `createApp` 组合 kernel base modules、UI base modules、产品注入的 integration shell。
4. `runtime-shell-v2` 执行 module pre-setup、install、actor registration、initial command。
5. TCP/TDP/topology/UI runtime 根据持久化状态恢复 identity、server space、projection、screen、overlay。
6. 产品 `ui-integration` 根据 activation state 将屏幕切到激活页或主数据工作台。
7. Android automation socket 暴露 runtime state、screen、semantic UI tree、requests、script execution。

## 传递关系

### 终端激活与主数据

```text
Activation code
  -> tcp-control-runtime-v2 activate command
  -> server binding/profile/template
  -> TCP identity + credential + binding state
  -> tdp-sync-runtime-v2 connect/session
  -> projection topic changes
  -> 1.2-business master-data read models
  -> 2.2-business workbench UI
  -> 2.3-integration shell screen switch
```

### 主副机与显示模式

```text
Native display/device facts
  -> adapter/host runtime launch context
  -> topology-runtime-v3 context/config
  -> topology-runtime-bridge request confirmation
  -> ui-runtime-v2 default alert
  -> confirm command
  -> topology-runtime-v3 displayMode state
  -> ui-runtime-v2 selects primary/secondary screen and overlays
```

### 热更新

```text
release manifest + generated JS bundle
  -> hot-update package zip
  -> mock/admin platform release policy
  -> TDP desired hot-update projection
  -> native hot-update download/install marker
  -> app restart
  -> host-runtime-rn84 reads active marker
  -> tdp-sync-runtime-v2 current hot-update state
  -> terminal version report API
```

## 重点能力

- TCP 激活、解除激活、凭证恢复和终端绑定。
- TDP projection 同步、topic data changed、cursor ack、动态策略下发。
- topology-runtime-v3 一主一副、多屏/单屏、主副机 state sync、连接恢复。
- ui-runtime-v2 screen/overlay/alert/workspace/UI variable 统一状态管理。
- runtime-react 负责 React Native 渲染和 semantic automation 注册。
- admin-console 提供终端侧运维入口：设备、连接、日志、拓扑、诊断。
- Android automation socket 支持 state/screen/UI tree/request/script/log 的真实联调。
- hot-update release bundle、package、download、install、restart、version report 链路。

## 新增业务包流程

新增业务包时按层新增，不要跨层偷懒：

1. 在 `1-kernel/1.2-business` 新增业务 kernel 包，定义状态、command、actor、selector、topic/projection 映射和测试。
2. 在 `2-ui/2.2-business` 新增业务 UI 包，只读 selector/state，只通过 public command 写入。
3. 在 `2-ui/2.3-integration` 新增或扩展产品 shell，组合业务 UI、base UI、screen parts 和工作流。
4. 在 `4-assembly/android/*` 注入新的 integration shell；不要直接注入业务 kernel/UI 包到 `host-runtime-rn84`。
5. 如果需要原生能力，先补 `3-adapter/android/adapter-android-v2` 或 `host-runtime-rn84` 的 platform port，再由 kernel/UI 通过端口使用。

## 验证要求

完成终端能力变更前，不能只说“阶段性通过”。至少根据变更范围选择：

- 包级 unit/scenario test。
- TypeScript type-check。
- Android Gradle bundle/APK 构建。
- Android automation socket 状态、屏幕、UI tree、request 验证。
- TDP/TCP/topology state 验证。
- JS logcat 与 native logcat 扫描。
- App 重启/副机关闭重连/热更新后恢复。
- 服务端 API / version history / master-data evidence。

常用命令示例：

```bash
corepack yarn workspace @next/ui-base-runtime-react test
corepack yarn workspace @next/assembly-android-mixc-catering-assembly-rn84 test
node scripts/release/release-bundle-full.cjs --app assembly-android-mixc-catering-rn84 --channel production
node scripts/release/package-hot-update.cjs --app assembly-android-mixc-catering-rn84 --channel production
ANDROID_TOPOLOGY_HOST_DEVICE_ID=emulator-5554 corepack yarn android:port-forward
```

## 命名与历史包

- 新命名统一使用 `next` / `Next` / `NEXT`。
- 历史旧产品命名只能出现在明确说明 legacy artifact 的文档上下文中。
- `4-assembly/android/mixc-retail-assembly-rn84` 与 `2-ui/2.3-integration/retail-shell` 是历史参考/待移除对象，不用于新增功能。
