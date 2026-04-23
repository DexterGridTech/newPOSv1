# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`terminal-console` 在这里验证真实终端激活 UI 和 `mock-terminal-platform` 联调。

覆盖目标：

1. 启动真实 kernel runtime + tcp-control-runtime-v2
2. 从真实 mock 平台读取激活码
3. 在 Expo Web 页面完成终端激活
4. 激活成功后摘要页更新为已激活状态

## Commands

启动可视页面：

```bash
corepack yarn workspace @impos2/ui-base-terminal-console expo:web
```

默认自动化：

```bash
corepack yarn workspace @impos2/ui-base-terminal-console test-expo
```

可视化自动化：

```bash
corepack yarn workspace @impos2/ui-base-terminal-console test-expo:visible
```

This folder is test-only.
Production code under `src/` must not import Expo.
