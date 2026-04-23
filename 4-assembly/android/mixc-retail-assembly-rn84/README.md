# mixc-retail-assembly-rn84

`mixc-retail-assembly-rn84` 是 Android RN 0.84 组装层包。

当前职责边界：

1. 启动 RN84 bare host、主副屏进程和最终 native wiring；
2. 通过 TurboModule 暴露 RN84 宿主需要的 adapter managers / native capabilities；
3. 装配 `createKernelRuntimeApp(...)`、platform-ports、kernel modules 和 ui modules；
4. 执行 Android 宿主级启动、重启、热更新 bundle 选择与 automation socket 验证。

分层约束：

1. assembly 不持有 topology / serverSpace / hot-update 等业务状态机；
2. 平台事实统一进入 `platform-ports`，跨层写操作统一走 public command / actor；
3. 如果 lower layer 能力不足，优先补 `platform-ports`、kernel runtime、UI bridge 或 adapter manager，不把缺口沉淀为 assembly 业务逻辑；
4. assembly 保留的是 RN84 宿主启动、重启和最终 wiring，不复刻配对协议或多步 admin flow。

## 可见自动化

激活 → 管理员注销激活 的模拟器可见链路：

```bash
corepack yarn assembly:android-mixc-retail-rn84:test-visible:admin-loop
```

前置条件：

1. `mock-terminal-platform` 已按 `1-kernel/server-config-v2` 定义地址启动；
2. Android 模拟器已连接；
3. RN debug app 已安装，Metro 可用。
