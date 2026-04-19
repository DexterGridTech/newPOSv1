# mixc-retail-assembly-rn84

`mixc-retail-assembly-rn84` 是新的 Android RN 0.84 组装层包。

当前阶段只先搭建最小 RN bare host 工程骨架，后续会继续完成：

1. 双屏启动与重启原生宿主
2. TurboModule 与平台能力桥接
3. 基于 `createKernelRuntimeApp(...)` 的 JS runtime 启动
4. 与 `adapter-android-v2` 的完整联调

## 可见自动化

激活 → 管理员注销激活 的模拟器可见链路：

```bash
corepack yarn assembly:android-mixc-retail-rn84:test-visible:admin-loop
```

前置条件：

1. `mock-terminal-platform` 已按 `1-kernel/server-config-v2` 定义地址启动；
2. Android 模拟器已连接；
3. RN debug app 已安装，Metro 可用。
