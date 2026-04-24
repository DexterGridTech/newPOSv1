# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`input-runtime` 在这里验证真实 RN Web 页面上的输入行为，而不是只测 controller。

覆盖目标：

1. 默认字段走系统键盘路径
2. 显式 virtual 字段会打开虚拟键盘
3. PIN 键盘回写值
4. 金额键盘回写值
5. 激活码键盘回写值

## Commands

启动可视页面：

```bash
corepack yarn workspace @next/ui-base-input-runtime expo:web
```

默认自动化：

```bash
corepack yarn workspace @next/ui-base-input-runtime test-expo
```

可视化自动化：

```bash
corepack yarn workspace @next/ui-base-input-runtime test-expo:visible
```
