# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`admin-console` 在这里验证真实工作台页面和管理员登录交互。

覆盖目标：

1. 左上角多击唤起管理员入口
2. 动态密码登录
3. 工作台 tab 切换
4. 设备 / 日志 / 连接器 / 终端 / 适配器测试几个代表性区域
5. 适配器一键测试结果可见

## Commands

启动可视页面：

```bash
corepack yarn workspace @next/ui-base-admin-console expo:web
```

默认自动化：

```bash
corepack yarn workspace @next/ui-base-admin-console test-expo
```

可视化自动化：

```bash
corepack yarn workspace @next/ui-base-admin-console test-expo:visible
```
