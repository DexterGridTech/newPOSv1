# 2-ui/2.3-integration

`2-ui/2.3-integration` 是产品级 UI 集成层。它把 `2.1-base` 的基础 UI 能力、`2.2-business` 的业务 UI，以及 `1-kernel/1.2-business` 的业务 kernel module 组合成某个产品可直接注入 assembly 的 shell。

当前包：

| 包 | 定位 |
| --- | --- |
| `catering-shell` | 餐饮终端产品 shell，组合激活页、管理员入口、餐饮主数据工作台和相关业务模块。 |

## 目录定位

```text
2.1-base + 2.2-business + 1.2-business -> 2.3-integration -> 4-assembly/android/*
```

assembly 不应直接注入多个业务包，而应注入一个产品 integration shell。这样可以保持 assembly 极薄，也可以让产品 UI/业务组合在 UI 层收口。

## 可以放什么

- 产品 shell `createModule` / `createBusinessModules`。
- 产品级 screen flow：激活成功后进入哪个工作台、取消激活后如何回到激活页。
- 产品级 screen part 注册和默认 UI 组合。
- base UI、business UI、business kernel modules 的组合入口。
- 产品 UI 自动化和 test-expo 场景。
- terminal-safe 的产品策略，例如某产品主屏/副屏默认工作台选择。

## 不应该放什么

- Android 原生实现。
- host runtime 平台端口实现。
- 通用 kernel 基础能力。
- 可复用 business read model 的底层逻辑。
- 大量产品无关基础组件。

## 集成规范

1. 每个产品应有一个明确 shell，例如 `@next/ui-integration-catering-shell`。
2. shell 可以组合多个 business module，但应保持组合显式可读。
3. shell 负责产品视角的 screen wiring，不负责平台启动。
4. shell 通过 public command 与 kernel 通信。
5. shell 应暴露给 assembly 的入口尽量少而稳定。
6. 产品策略写在 integration shell；平台机制写在 host runtime；领域状态写在 kernel。

## 新增产品 shell 注意事项

新增 `@next/ui-integration-*` 时：

1. 明确产品域和目标 assembly。
2. 确认需要哪些 `1.2-business` 与 `2.2-business` 包。
3. 设计激活前、激活后、取消激活、TDP 未就绪、热更新重启后的 screen 行为。
4. 提供 automation 场景，验证主要工作台和管理员入口。
5. assembly 只引用这个 shell，不再额外注入业务包。

## 历史说明

旧 `retail-shell` 仅作为历史参考/待移除对象，不应承接新增功能。当前主线使用 `catering-shell`。
