# 旧核心包到新基础架构的职责映射

## 1. 文档目标

本文档用于回答两个问题：

1. 旧 `base / interconnection / communication` 中的能力，在新架构里分别落到哪里。
2. 哪些旧能力会被保留、重做或删除。

本文档只描述目标职责映射，不描述迁移步骤。

---

## 2. 旧 `base` 的映射

### 2.1 保留并重建的能力

| 旧能力 | 新包 |
| --- | --- |
| 命令定义与命令调度 | `contracts` + `execution-runtime` |
| actor handler 模型 | `execution-runtime` |
| module 契约 | `contracts` |
| 错误定义、参数定义 | `contracts` + `definition-registry` |
| logger / storage / device / appControl / localWebServer 等平台适配 | `platform-ports` |
| runtime 总装配 | `runtime-shell` |

### 2.2 去掉的能力

以下旧能力不进入目标架构：

- `ApplicationManager` 全局总装配
- `ActorSystem.getInstance()` 全局单例
- `storeEntry` 作为运行时真相源
- `ApiManager` 全局通信入口
- listener 事后补账式 request 生命周期

### 2.3 重构结论

旧 `base` 不是保留为一个“超级底座包”，而是被拆成：

- `contracts`
- `definition-registry`
- `platform-ports`
- `execution-runtime`
- `runtime-shell`

---

## 3. 旧 `interconnection` 的映射

### 3.1 保留并重建的能力

| 旧能力 | 新包 |
| --- | --- |
| master/slave 节点角色与恢复状态 | `topology-runtime` |
| pairing / relay host 核心 | `host-runtime` |
| 客户端连接 / 重连 / resume / remote-command 编排 | `topology-client-runtime` |
| display / workspace / 主副节点关系公开 read model | `topology-client-runtime` |
| workspace / instanceMode 作用域 helper | `state-runtime` |
| request 聚合 | `topology-runtime` |
| request 对外读模型 | `runtime-shell` |
| request 的 React hook 包装 | `2-ui/*` |
| 主副机宿主承载实现 | `0-mock-server/dual-topology-host` |

### 3.2 去掉或重做的能力

以下旧实现不保留：

- `requestStatus` 作为跨机真相源
- `SYNC_STATE` 承担 request 正确性
- `REMOTE_COMMAND_EXECUTED` 混合 ack 语义
- master/slave slice 合并后推导 request 真相
- lifecycle listener 负责 request 真相源写入
- `interconnection` 同时承担 scoped state helper 与连接编排
- kernel 内直接提供 React hook

### 3.3 重构结论

旧 `interconnection` 的价值不是保留原包，而是把其：

- 拓扑概念
- 配对概念
- 主副屏业务特点
- request 聚合诉求
- scoped state 路由诉求

拆分升级为：

1. `topology-runtime` 的正式控制面模型
2. `topology-client-runtime` 的客户端编排模型
3. `state-runtime` 的通用 scoped state 工具
4. `runtime-shell` 的 request projection 读模型

---

## 4. 旧 `communication` 的映射

### 4.1 保留并重建的能力

| 旧能力 | 新包 |
| --- | --- |
| HTTP endpoint 定义 | `transport-runtime` |
| HTTP runtime / client | `transport-runtime` |
| WS socket profile / runtime | `transport-runtime` |
| transport metrics / retry / failover | `transport-runtime` |
| runtime-specific socket adapter 抽象 | `transport-runtime` |

### 4.2 不再留在 communication 语义中的能力

以下能力不应继续放在通信基座中：

- 主副机 request owner 语义
- 主副机命令生命周期协议
- request 聚合
- projection 镜像策略

这些统一进入：

- `topology-runtime`

### 4.3 重构结论

旧 `communication` 的正确继承方式不是继续保留“HTTP + WS + 主副机语义混在一起”的大包，而是：

- 通用通道基础设施 -> `transport-runtime`
- 双机控制面语义 -> `topology-runtime`

---

## 5. 旧 `master-ws-server-dual` 的映射

### 5.1 新定位

旧包：

- `0-mock-server/master-ws-server-dual`

新定位：

- `0-mock-server/dual-topology-host`

### 5.2 保留并重建的能力

| 旧能力 | 新位置 |
| --- | --- |
| master/slave 配对 | `host-runtime` + `dual-topology-host` |
| token / ticket 机制 | `host-runtime` + `dual-topology-host` |
| 心跳与断线管理 | `host-runtime` + `dual-topology-host` |
| 消息转发与缓存 | `host-runtime` + `dual-topology-host` |
| 上下线通知 | `host-runtime` + `dual-topology-host` |
| stats 与观测 | `dual-topology-host` |

### 5.3 不应继续承担的能力

- request owner 聚合
- 业务命令解释
- request complete 判定
- 通用业务状态同步真相源

### 5.4 长期目标

`dual-topology-host` 的 Node 版开发实现最终会对应到：

- `3-adapter/android/adapterPure`

中的主屏机内置 topology host 实现。

---

## 6. 新包与旧概念的对应关系

### 6.1 旧概念：全局 manager

新概念：

- `runtime-shell` 唯一总装配入口
- 显式 runtime 实例

### 6.2 旧概念：listener 补写 request 状态

新概念：

- owner ledger
- dispatch 前同步登记
- remote event 推进节点状态

### 6.3 旧概念：slice 同步即真相源同步

新概念：

- control plane 协议
- projection plane 读模型

### 6.4 旧概念：`ApiManager`

新概念：

- `transport-runtime`
- 显式 runtime / client / service registry

### 6.5 旧概念：主副机 WS 只是消息转发

新概念：

- topology host
- compatibility decision
- command dispatch / command event / projection mirror

---

## 7. 明确不保留的旧模式

以下模式在新架构中明确不保留：

1. 多个全局 manager 并列存在
2. request 真相源依赖跨机 slice 同步
3. transport 语义与 request 完成语义混在一起
4. UI / selector 直接依赖全局单例状态入口
5. 通信基座同时承担 transport 与拓扑控制面

---

## 8. 新架构公开 API 边界摘要

### 8.1 `contracts`

公开：

- 类型
- 协议
- 公开模型

### 8.2 `definition-registry`

公开：

- registry factory
- register / query API

### 8.3 `platform-ports`

公开：

- 平台 port interface
- ports assembly API

### 8.4 `execution-runtime`

公开：

- `createExecutionRuntime`
- `ExecutionRuntime`
- execution event API

### 8.5 `transport-runtime`

公开：

- `HttpRuntime`
- `SocketRuntime`
- endpoint/profile 定义与 transport adapter

### 8.6 `topology-runtime`

公开：

- `createTopologyRuntime`
- `PairingTicket`
- `NodeHello/NodeHelloAck`
- `dispatchRemote`
- request projection 访问 API

### 8.7 `runtime-shell`

公开：

- `createKernelRuntime`
- `KernelRuntime`
- request projection selectors
- runtime execute API

---

## 9. 本阶段映射结论

第一阶段重构的本质不是保留旧包名，而是重新定义：

- 运行时边界
- 控制面协议
- 读模型边界
- 宿主边界

这也是后续 `ui-runtime`、`tcp-client`、`tdp-client` 等包迁移的前提。
