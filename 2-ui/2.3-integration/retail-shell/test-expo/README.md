# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`retail-shell` 在这里验证完整 integration 闭环，而不是只看静态欢迎页。

覆盖目标：

1. 启动真实 kernel runtime + ui base 包组合
2. 使用真实 `mock-terminal-platform` 完成终端激活
3. 激活后由 actor 驱动切换到 retail welcome screen
4. 打开管理员工作台并执行注销激活
5. 注销后重新回到 terminal-console 的激活页

## Commands

启动可视页面：

```bash
corepack yarn workspace @impos2/ui-integration-retail-shell expo:web
```

默认自动化：

```bash
corepack yarn workspace @impos2/ui-integration-retail-shell test-expo
```

可视化自动化：

```bash
corepack yarn workspace @impos2/ui-integration-retail-shell test-expo:visible
```
