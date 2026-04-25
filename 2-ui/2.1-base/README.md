# 2-ui/2.1-base

`2-ui/2.1-base` 是终端 UI 基础层，负责把 kernel state 渲染为 React Native UI，并提供 UI runtime、终端控制台、运维后台、输入运行时、拓扑/热更新桥接、自动化控制面等通用 UI 能力。

当前主要包：

| 包 | 定位 |
| --- | --- |
| `runtime-react` | `ui-runtime-v2` 的 React Native 渲染桥，负责 screen、overlay、alert、semantic automation。 |
| `terminal-console` | TCP 激活/终端状态相关基础 UI。 |
| `admin-console` | 终端侧管理员入口、设备/拓扑/日志/诊断工具。 |
| `input-runtime` | 输入、虚拟键盘、输入控制基础能力。 |
| `topology-runtime-bridge` | topology runtime 交互请求到 UI alert/modal 的桥接。 |
| `hot-update-runtime-bridge` | 热更新重启/进度类 UI bridge。 |
| `ui-automation-runtime` | 浏览器/Android automation 的统一 UI 语义节点和 RPC 控制面。 |

## 目录定位

本层依赖 `1-kernel`，不依赖 `3-adapter` 和 `4-assembly`。它可以引用 kernel command/selector/types，但不能直接改 kernel slice。

```text
1-kernel state/command/selector -> 2-ui/2.1-base render/bridge -> 2-ui/2.2-business / 2.3-integration
```

## 可以放什么

- React/RN 基础组件、runtime shell、host component。
- screen/overlay/alert 的渲染桥。
- UI bridge：将 kernel request command 转为 modal/alert/用户动作。
- Admin/diagnostic 工具 UI。
- Semantic automation node 注册、query、action、wait 协议。
- test-expo、React test renderer 场景验证。

## 不应该放什么

- 具体业务主数据 read model。
- Android 原生实现或 TurboModule 直接实现。
- 产品最终路由和产品级业务组合。
- 直接 dispatch 其他包 slice action。
- 在 UI 里硬编码完整业务链路，例如“点击按钮 -> 拼 API -> 改 kernel state”。

## UI runtime 规范

1. 页面由 `ui-runtime-v2` 的 screen state 决定。
2. overlay/alert 必须通过 `ui-runtime-v2` state 渲染，不使用 ad hoc 全局弹窗。
3. 默认 alert 只由 `AlertHost` 渲染，`OverlayHost` 必须过滤 default alert，避免重复确认卡。
4. 用户交互只 dispatch public command。
5. UI 可以维护输入框、展开折叠等临时展示状态，但业务真相必须来自 kernel state。
6. 每个可自动化节点应有稳定 `testID` / semantic id。

## Bridge 规范

当 kernel 需要 UI 确认时：

1. kernel 发 `request-*` command。
2. bridge actor 打开 overlay/alert。
3. 用户确认后 dispatch kernel `confirm/execute` command。
4. 取消时只关闭 overlay 或 dispatch 明确 cancel command。

不要让 kernel import UI；也不要让 UI 直接绕过 request 语义执行敏感状态迁移。

## 新增基础 UI 包注意事项

新增 `@next/ui-base-*` 包时：

1. 明确它是通用 UI 能力还是业务 UI；业务 UI 应放 `2.2-business`。
2. 对外暴露 `createModule`、components、types、必要 supports。
3. 如果注册 screen part，保持 partKey/rendererKey 稳定。
4. 如果提供 bridge，必须有 command-flow 测试。
5. 如果提供 automation，必须有 semantic node 测试。
6. 不要引入产品 assembly 依赖。

## 验证建议

```bash
corepack yarn workspace @next/ui-base-runtime-react test
corepack yarn workspace @next/ui-base-runtime-react type-check
corepack yarn workspace @next/ui-base-admin-console test
```

涉及真实 RN 或多屏时，优先补 test-expo 或 Android automation 验证。
