# 2-ui/2.2-business

`2-ui/2.2-business` 是终端业务 UI 层。这里放置具体业务域的 React/RN UI、业务工作台、业务组件和业务 screen part，但不承载业务状态真相。

当前包：

| 包 | 定位 |
| --- | --- |
| `catering-master-data-workbench` | 餐饮终端主数据工作台，展示组织/IAM、商品菜单、门店经营等 terminal-safe 主数据。 |

## 目录定位

本层位于 business kernel 和 integration shell 之间：

```text
1-kernel/1.2-business -> 2-ui/2.2-business -> 2-ui/2.3-integration -> 4-assembly
```

它负责“如何展示业务状态”和“用户如何发起业务操作”，不负责“业务状态如何成为真相”。

## 可以放什么

- 业务 screen、工作台、卡片、表格、列表、空态、诊断面板。
- 业务 screen part 定义。
- 基于 selector 的业务展示 view model。
- 用户交互到 public command 的桥接。
- 纯 UI formatter、组件样式、展示级别文案。
- 业务 UI 场景测试。

## 不应该放什么

- 业务主数据 projection reducer。
- TCP/TDP/topology 原始通信逻辑。
- Android 原生调用。
- 产品 App 入口或 assembly wiring。
- 绕过 `1.2-business` 直接解析远端 projection 成业务状态。
- 跨包直接 dispatch slice action。

## 业务 UI 规范

1. UI 必须跟随 state，不靠 ad hoc 逻辑硬拼。
2. 展示数据从 selector 或稳定 state 读取。
3. 写操作发 public command。
4. 页面切换通过 `ui-runtime-v2` screen state。
5. overlay/alert 通过 `ui-runtime-v2`，不要本地临时重复弹窗。
6. 业务 UI 应显示 diagnostics，便于现场排查主数据缺失或 projection 异常。
7. 主副屏 UI 应明确 primary/secondary screen part，不复用导致语义混乱。

## 新增业务 UI 包注意事项

新增 `@next/ui-business-*` 包时：

1. 先确认对应 `1.2-business` kernel 包已经定义 read model 和 selector。
2. UI 包只消费 selector/types，不自建业务 truth source。
3. 如果有主副屏差异，应分别定义 primary/secondary screen part。
4. 需要产品组合时交给 `2.3-integration`，不要在本层绑定 assembly。
5. 测试必须覆盖：数据为空、数据完整、diagnostics、主副屏/工作区差异。

## 验证建议

- TypeScript type-check。
- React renderer 单元测试或 test-expo。
- 与 integration shell 一起验证 screen switch 和 automation node。
