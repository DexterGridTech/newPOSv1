# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`catering-shell` 在这里验证完整 integration 闭环，而不是只看静态欢迎页。

覆盖目标：

1. 启动真实 kernel runtime + ui base 包组合
2. 使用真实 `mock-terminal-platform` 完成终端激活
3. 激活后由 actor 驱动切换到 catering welcome screen
4. 打开管理员工作台并执行注销激活
5. 注销后重新回到 terminal-console 的激活页

## Commands

启动可视页面：

```bash
corepack yarn workspace @next/ui-integration-catering-shell dev:web
```

`dev:web` 只启动 Expo Web，不内嵌启动 mock platform。手动联调时请先按目标环境单独启动或配置服务端，例如本地 mock：

```bash
corepack yarn mock:platform:dev
```

如果需要在管理员控制台的“实例与拓扑”里验证主机开启拓扑服务，请单独启动 dual topology host：

```bash
corepack yarn B:dual-topology-host-v3
```

默认手动页面读取 `server-config-v2` 的 dev 配置；`EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL` 只是可选覆盖，不再是启动前置条件。
`dual-topology-host-v3` 默认使用 `server-config-v2` dev 里的
`http://127.0.0.1:8888/mockMasterServer`，也可以用
`EXPO_PUBLIC_DUAL_TOPOLOGY_HOST_BASE_URL` 和 `EXPO_PUBLIC_DUAL_TOPOLOGY_HOST_WS_URL`
覆盖到其它服务器。

默认自动化：

```bash
corepack yarn workspace @next/ui-integration-catering-shell test-expo
```

可视化自动化：

```bash
corepack yarn workspace @next/ui-integration-catering-shell test-expo:visible
```

`test-expo` 为了自动化确定性，会自己启动内嵌 mock platform 并注入 `EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL`。
拓扑 host 仍是独立服务；需要覆盖时同样通过 `EXPO_PUBLIC_DUAL_TOPOLOGY_HOST_BASE_URL` 指向外部服务。
