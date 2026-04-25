# 1-kernel/server-config-v2

`1-kernel/server-config-v2` 是终端 runtime 的服务器空间配置包。它集中定义 mock platform、dual topology host、测试服务等服务名、server space、base URL、fallback 地址和环境配置。

## 目录定位

本包属于 kernel 基础配置层，提供纯配置和类型，不承载业务逻辑：

```text
server-config-v2 -> transport-runtime / tcp-control-runtime / tdp-sync-runtime / host-runtime-rn84
```

它让终端 runtime 通过稳定的 server space 选择服务，而不是在业务包、UI 或 assembly 中散落 URL 字符串。

## 可以放什么

- 服务名常量，例如 `SERVER_NAME_MOCK_TERMINAL_PLATFORM`。
- server space 常量，例如 dev/test 环境配置。
- `TransportServerConfig` 结构。
- 本地开发、测试、mock、拓扑 host 的 endpoint 定义。
- 地址 fallback、addressName、transport metadata。

## 不应该放什么

- fetch/axios/websocket 客户端实现。
- 业务 API DTO 或业务解析逻辑。
- Android emulator 端口转发脚本。
- UI 文案或环境切换页面。
- 用户凭证、token、密钥。

## 配置规范

1. 服务名必须使用稳定常量，不在调用方硬编码。
2. dev/test 配置分文件维护，避免测试地址污染开发环境。
3. Android emulator 访问宿主机时应通过端口转发或约定地址，不在业务层临时拼接。
4. 新增服务必须说明：服务名、用途、默认地址、是否支持 fallback、哪些 runtime 使用。
5. 不要在业务包中新增“临时 URL”；应先扩展本包。

## 与运行时关系

- `transport-runtime` 使用这里的配置解析 server space。
- `tcp-control-runtime-v2` 通过 server space 找到 activation/control API。
- `tdp-sync-runtime-v2` 通过 server space 找到 TDP endpoint。
- Android host runtime 使用 dev config 组合终端启动环境。

## 新增服务注意事项

新增后台服务或 mock 服务时：

1. 先在本包定义服务名常量。
2. 在 dev/test config 中提供明确 endpoint。
3. 给调用方暴露配置，而不是暴露具体 URL 字符串。
4. 在调用 runtime 中新增 selector/command 级测试，确认 server space 切换语义。
5. 如果服务需要 Android 访问，补充端口转发脚本或说明。
