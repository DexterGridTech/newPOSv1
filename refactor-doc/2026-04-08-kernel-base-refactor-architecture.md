# 核心基础包重构总体架构设计

## 1. 文档目标

本文档用于定义第一阶段核心基础包重构的目标架构，覆盖以下范围：

- `1-kernel/1.1-cores/base`
- `1-kernel/1.1-cores/interconnection`
- `1-kernel/1.1-cores/communication`
- `0-mock-server/master-ws-server-dual`

本阶段只做目标架构设计，不考虑迁移妥协，不保留历史全局 manager 模式，不以旧包边界为新架构边界。

本阶段目标是得到一套：

- 职责清晰
- 依赖明确
- 协议公开
- 扩展性强
- 兼容主副机双节点业务特点
- 兼容当前工程统一包结构

的新基础架构。

---

## 2. 设计原则

### 2.1 不以旧包边界约束新架构

旧 `base / interconnection / communication` 的拆分不再视为目标架构边界。

新架构允许包数更多或更少，只以职责边界是否清晰为判断标准。

### 2.2 不保留全局 manager 并列模型

新架构不再保留多个全局 manager 并列存在的运行方式，包括但不限于：

- `ApplicationManager`
- `ActorSystem.getInstance()`
- `storeEntry` 作为运行时真相源入口
- `ApiManager`

新架构统一采用显式 runtime 实例模型。

### 2.3 request 真相源与 projection 分离

request 相关模型必须区分：

- 真相源
- 本地读模型

request 真相源不再通过跨机 slice 同步承担。

request projection 可以进入本地 store 供 selector/UI 读取，但只能是读模型。

### 2.4 主副机控制面与普通状态同步分离

以下内容属于控制面：

- 主副机配对
- 远程命令派发
- request owner 聚合
- request 结果回传
- projection 镜像

以上内容必须由显式协议承担，不再由通用状态同步隐式承载。

普通业务状态是否同步，后续可独立设计，不与 request 正确性绑定。

### 2.5 `1-kernel` 不依赖 React

`1-kernel` 不允许依赖 React 包。

`1-kernel` 中允许保留：

- `src/hooks/index.ts`

但该文件仅用于放置规则说明，不提供 React hook 实现。

### 2.6 统一包结构

新包必须遵守当前仓库统一结构风格，兼容：

- `1-kernel`
- `2-ui`
- `4-assembly`

公共骨架统一为：

- `src/application`
- `src/features`
- `src/foundations`
- `src/selectors`
- `src/hooks`
- `src/supports`
- `src/types`
- `src/generated`
- `dev`

其中 `features` 内部结构统一为：

- `commands`
- `actors`
- `middlewares`
- `slices`

允许某些纯协议包仅保留轻量占位实现，但目录骨架保持统一。

### 2.7 遵循当前版本管理体系

本阶段设计必须纳入 [终端版本管理说明.md](/Users/dexter/Documents/workspace/idea/newPOSv1/终端版本管理说明.md) 的版本体系。

新架构中的：

- `packageVersion`
- `assemblyVersion`
- `bundleVersion`
- `runtimeVersion`
- `protocolVersion`

必须语义清晰，不互相混用。

---

## 3. 新基础架构包划分

重构后基础架构统一落在：

- `1-kernel/1.1-base`

第一阶段定义以下 7 个核心包：

1. `contracts`
2. `definition-registry`
3. `platform-ports`
4. `execution-runtime`
5. `transport-runtime`
6. `topology-runtime`
7. `runtime-shell`

此外配套新增一个主副机宿主承载包：

- `0-mock-server/dual-topology-host`

---

## 4. 各包职责

### 4.1 `contracts`

职责：

- 定义公开协议
- 定义公共类型
- 定义模块契约
- 定义 request / command / topology 协议对象

不负责：

- 执行逻辑
- 运行时状态
- store 装配

### 4.2 `definition-registry`

职责：

- 定义注册与查询
- task / error / parameter / screen descriptor 注册

不负责：

- 执行
- 拓扑
- transport

### 4.3 `platform-ports`

职责：

- 平台能力接口定义
- logger / storage / device / appControl / localWebServer / connector 等 port

不负责：

- runtime 业务执行
- request 聚合

### 4.4 `execution-runtime`

职责：

- 单机命令执行模型
- command dispatch pipeline
- handler 执行
- execution middleware
- 本机 execution journal

不负责：

- 主副机 owner 判定
- 远程 request 聚合
- wire protocol

### 4.5 `transport-runtime`

职责：

- 通用 HTTP / WS / 未来 TCP 类 transport 基座
- 连接、重连、序列化、顺序通道、会话承载
- endpoint / socket profile 抽象

不负责：

- request owner 语义
- 主副机控制面聚合

### 4.6 `topology-runtime`

职责：

- 主副机拓扑控制面
- pairing / session / route / owner-ledger
- request 聚合
- compatibility decision
- projection 构建与镜像策略

不负责：

- 本机命令 handler 执行
- UI store 装配

### 4.7 `runtime-shell`

职责：

- runtime 总装配入口
- modules 挂载
- execution-runtime / topology-runtime / transport-runtime 接入
- projection state 对接 store
- selector 对外暴露

不负责：

- 自己实现 transport 协议
- 自己实现 host relay

### 4.8 `0-mock-server/dual-topology-host`

职责：

- 双机拓扑宿主的开发验证实现
- pairing ticket 管理
- hello/ack 建链
- 有序消息转发
- 心跳、断线、重连窗口
- 观测与故障注入

长期定位：

- 协议开发实现与联调承载实现
- 后续产品形态将下沉为主屏机内置宿主实现

不负责：

- request owner 聚合
- 业务命令执行
- request complete 判定

---

## 5. 包依赖方向

依赖方向定义如下：

- `definition-registry` -> `contracts`
- `platform-ports` -> `contracts`
- `execution-runtime` -> `contracts`, `definition-registry`, `platform-ports`
- `transport-runtime` -> `contracts`, `platform-ports`
- `topology-runtime` -> `contracts`, `execution-runtime`, `transport-runtime`, `platform-ports`
- `runtime-shell` -> `contracts`, `definition-registry`, `platform-ports`, `execution-runtime`, `transport-runtime`, `topology-runtime`

约束：

- `contracts` 为最底层公共语言，不依赖其他基础包
- `runtime-shell` 为唯一总装配入口
- 后续不再允许多个全局 manager 并列存在

---

## 6. 显式 runtime 实例模型

新架构统一采用显式 runtime 实例模型。

建议总入口：

```ts
const runtime = createKernelRuntime({
  platformPorts,
  transportAdapter,
  releaseInfo,
  runtimeIdentity,
  modules,
})

await runtime.start()
```

运行时原则：

- module 挂载到 runtime 实例
- command 通过 runtime 实例执行
- request projection 通过 runtime 实例读取
- store 只是 runtime-shell 的读模型承载，不再是全局运行时真相源

---

## 7. request 模型

### 7.1 request 真相源

request 真相源采用 owner-ledger 模型。

核心规则：

- request owner 默认是 root command 发起节点
- child command 必须先登记到 owner ledger
- remote event 只推进已登记节点状态
- request complete 只能由 owner ledger 判定

### 7.2 command node 内部状态

内部节点状态定义为：

- `registered`
- `dispatched`
- `accepted`
- `started`
- `complete`
- `error`

### 7.3 request 对外聚合状态

对业务/UI 暴露的 request 聚合状态保持简单三态：

- `started`
- `complete`
- `error`

### 7.4 结果模型

结果真相源存在于 owner ledger。

结果分为两类：

- `resultPatch`
- `resultComplete`

对外 projection 同时暴露：

- `resultsByCommand`
- `mergedResults`

这是为了兼顾：

- 语义稳定
- 业务读取便利性

### 7.5 projection 原则

request projection 只是读模型。

约束：

- owner ledger 不跨机复制
- projection 可本地入 store
- projection 可按 capability 镜像给 peer

---

## 8. 主副机控制面原则

### 8.1 control plane 与 projection plane 分离

request 生命周期、结果回传、主副机配对属于控制面。

projection 属于读模型平面。

两者必须分离。

### 8.2 transport hop 与业务完成语义分离

旧设计中 transport 语义和业务完成语义混在一起。

新架构要求：

- remote dispatch 完成，只表示 transport/dispatch 完成
- request complete 由 owner ledger 决定

### 8.3 compatibility decision

主副机握手结果采用 3 档：

- `full`
- `degraded`
- `rejected`

兼容判定优先级：

1. `protocolVersion`：硬门槛
2. `requiredCapabilities`：硬门槛
3. `runtimeVersion`：软门槛，参与降级策略
4. `assemblyVersion`：治理与策略参考

---

## 9. 版本体系接入规则

依据 [终端版本管理说明.md](/Users/dexter/Documents/workspace/idea/newPOSv1/终端版本管理说明.md)，新架构中的版本字段职责如下：

### 9.1 `packageVersion`

来源：

- 各包 `package.json.version`
- `src/generated/packageVersion.ts`

职责：

- 研发追踪
- 模块版本展示

不参与：

- 主副机互连判定

### 9.2 `assemblyVersion`

来源：

- assembly `releaseInfo`

职责：

- 终端安装包版本
- 运维与治理判断

### 9.3 `bundleVersion`

来源：

- assembly `releaseInfo`

职责：

- OTA / JS Bundle 发布追踪

### 9.4 `runtimeVersion`

来源：

- assembly `releaseInfo`

职责：

- 运行时兼容线
- compatibility decision 输入

不要求：

- 主副机精确匹配后才能互连

### 9.5 `protocolVersion`

来源：

- `contracts` 或 `topology-runtime` 的公开协议版本常量

职责：

- 控制面协议兼容门槛

要求：

- 作为主副机互连硬门槛

---

## 10. 开发验证要求

第一阶段所有新基础包都必须具备：

- `dev`
- selector/projection/state 语义验证

涉及主副机的包必须额外具备：

- request owner 聚合验证
- 远程 dispatch / event 时序验证
- projection mirror 验证
- 版本兼容握手验证
- 故障注入验证

`dual-topology-host` 需要承担：

- 时序观测
- 延迟/丢包/断连模拟
- 配对和 session 统计

---

## 11. 本阶段设计结论

第一阶段重构并不是把旧 `base / interconnection / communication` 重新包装，而是建立新的基础运行时体系。

本阶段最终结论如下：

1. 新基础架构采用 7 包模型。
2. `runtime-shell` 成为唯一总装配入口。
3. request 真相源从跨机 slice 模式升级为 owner-ledger 模式。
4. `transport-runtime` 负责通用通信，`topology-runtime` 负责主副机控制面。
5. `dual-topology-host` 作为开发承载宿主纳入整体设计，并为后续主屏机内置实现提供参考。
6. 新架构正式接入现有版本管理体系，并将 `runtimeVersion / protocolVersion` 纳入主副机兼容判断。
