# 核心基础包重构总体架构设计

## 1. 文档目标

本文档用于定义第一阶段核心基础包重构的目标架构，覆盖以下范围：

- `_old_/1-kernel/1.1-cores/base`
- `_old_/1-kernel/1.1-cores/interconnection`
- `_old_/1-kernel/1.1-cores/communication`
- `_old_/0-mock-server/master-ws-server-dual`

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

在本章所有原则之外，后续设计还必须同时遵守：

- [refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-core-inherited-strengths-and-upgrade-requirements.md)
- [refactor-doc/2026-04-09-kernel-base-time-and-runtime-id-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-base-time-and-runtime-id-design.md)
- [refactor-doc/2026-04-09-kernel-core-implicit-effective-rules.md](/Users/dexter/Documents/workspace/idea/newPOSv1/refactor-doc/2026-04-09-kernel-core-implicit-effective-rules.md)

该文档明确规定了旧 `base` 与 `interconnection` 中必须继承并超越的设计亮点。
本章只描述新架构边界，不再重复那份文档中的完整约束清单。

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
- `test`

其中 `features` 内部结构统一为：

- `commands`
- `actors`
- `slices`

允许某些纯协议包仅保留轻量占位实现，但目录骨架保持统一。

此外所有包都必须包含：

- `src/moduleName.ts`

`moduleName` 在本仓库里不是可选装饰，而是统一结构、统一命名空间、统一状态键/日志键/协议键语言的一部分。
`1-kernel/1.1-base/*` 的命名规则统一为：

- `kernel.base.<package-name>`

### 2.7 遵循当前版本管理体系

本阶段设计必须纳入 [终端版本管理说明.md](/Users/dexter/Documents/workspace/idea/newPOSv1/终端版本管理说明.md) 的版本体系。

新架构中的：

- `packageVersion`
- `assemblyVersion`
- `bundleVersion`
- `runtimeVersion`
- `protocolVersion`

必须语义清晰，不互相混用。

### 2.8 继承旧架构的统一运行时思想

新架构虽然不保留旧 `ApplicationManager / ActorSystem / ApiManager` 这些全局实现，但必须继续继承旧架构真正有效的统一运行时思想：

1. 模块继续以 manifest/descriptor 形式进入 runtime。
2. command 继续作为跨包协作的统一主语。
3. 主副拓扑继续是一等概念，而不是 UI 层补丁。
4. request 继续支持跨端统一观测。

这里强调的是：

1. 要替换旧实现方式。
2. 但不能丢掉旧架构已经验证正确的统一语言与统一 runtime 价值。

### 2.9 继承旧架构的低接入成本

新架构必须比旧架构边界更清晰，但不能让下游业务包接入成本明显上升。

必须继续保留的工程特征：

1. 业务包主要负责声明，而不是自己拼底层 runtime。
2. 同步、远程路由、宿主适配仍尽量从业务包中抽离。
3. `ui-runtime`、后续业务模块仍应通过统一 contract 和 helper 低成本接入。

### 2.10 包边界读写规则

新架构必须把旧工程里的包边界默契升级成显式规则：

1. store 的 `state` 允许全局读取。
2. 跨包读取优先通过 selector 暴露稳定读接口。
3. 跨包写入只能通过目标包公开的 `command` 进入。
4. `slice action`、`reducer`、`actor`、`middleware` 都属于包内实现，不作为跨包写接口公开。

也就是说：

1. `state` 是全局可读的。
2. `command` 是跨包公开写接口。
3. `slice` 只是包内状态实现细节。

### 2.10A 包根导出边界规则

新架构里的目录结构统一，不代表目录里的内容都自动成为对外 API。

必须增加一条显式规则：

1. `src/foundations` 是包内实现分层，不等于包根默认全量公开。
2. 包根只暴露稳定、面向外部协作的能力、类型、selector 和少量明确设计为 DSL/helper 的构件。
3. `moduleResolver`、`readModel`、`ledger`、`registry`、`policy controller`、`server catalog` 这类实现性 helper，默认属于包内细节。
4. 包内测试如果要验证内部算法，可以直接走包内相对路径导入，不应反向逼迫产品 API 暴露内部 helper。
5. 只有明确被定义为外部声明语言的一部分时，helper 才应作为稳定 API 暴露，例如 transport 的 `typed()`。

也就是说：

1. 统一目录结构是工程规范。
2. 稳定公开 API 需要单独判断。
3. “方便测试” 不是扩大包根导出的理由。
4. 已落地要求：`src/index.ts` 应直接显式导出稳定公共文件，而不是再统一 `export * from './foundations'`。

### 2.11 继承旧架构的可观测性要求

旧 `base` 和 `interconnection` 虽然自身验证体系不完整，但它们已经证明这套系统必须强调：

1. 启动可观测
2. request 可观测
3. session/sync/dispatch 可观测
4. 真双机、真实恢复场景下可验证

因此新架构的每个核心包都必须从一开始就为 `dev` 验证留出正式入口，不允许只留下最小启动脚本。

### 2.12 时间与运行时 ID 规则

新架构必须把旧工程已经事实成立的时间与 ID 使用习惯，升级成显式硬约束：

1. 所有存储中的时间字段一律使用毫秒时间戳数字，不存格式化字符串。
2. 时间格式化只允许用于展示和日志渲染。
3. `1-kernel / 2-ui / 3-adapter / 4-assembly` 四层统一使用同一套运行时 ID helper。
4. `0-mock-server` 只要求协议兼容，不接入这套统一 ID 生成实现。

也就是说：

1. 时间真相统一。
2. 产品 runtime 的 ID 语言统一。
3. mock/server 与产品 runtime 的实现边界清晰。

---

## 3. 新基础架构包划分

重构后基础架构统一落在：

- `1-kernel/1.1-base`

第一阶段定义以下 10 个核心包：

1. `contracts`
2. `definition-registry`
3. `platform-ports`
4. `state-runtime`
5. `execution-runtime`
6. `transport-runtime`
7. `topology-runtime`
8. `host-runtime`
9. `topology-client-runtime`
10. `runtime-shell`

此外配套新增一个主副机宿主承载包：

- `0-mock-server/dual-topology-host`

补充约束：

1. 这 10 个包不是为了机械替代旧 `base / interconnection / communication` 三个包，而是为了把旧架构正确的思想按职责重新收口。
2. `topology-client-runtime` 是客户端侧拓扑编排层，不是旧 `interconnection` 的平移版本。
3. `host-runtime` 是可嵌入的 host pairing / relay 核心，不等于 Node/mock shell。
4. `dual-topology-host` 只是 `host-runtime` 的 Node/mock 宿主实现。
5. 新包划分必须同时体现“统一 runtime”与“显式边界”两种要求。
6. 任何一个新包如果只能通过重新引入全局单例或隐藏耦合才能工作，都说明划分仍有问题。

---

## 4. 各包职责

### 4.1 `contracts`

职责：

- 定义公开协议
- 定义公共类型
- 定义 `TimestampMs` 与统一时间 helper
- 定义统一运行时 ID 类型与生成 helper
- 定义模块契约
- 定义 request / command / topology 协议对象
- 定义 `ErrorDefinition / AppError / ErrorCatalogEntry` 等错误协议对象
- 定义 `ParameterDefinition / ParameterCatalogEntry / ResolvedParameter` 等参数协议对象

不负责：

- 执行逻辑
- 运行时状态
- store 装配

### 4.2 `definition-registry`

职责：

- 定义注册与查询
- task / error / parameter / screen descriptor 注册
- 错误定义注册与按 key 查询
- 参数定义注册与按 key 查询

不负责：

- 执行
- 拓扑
- transport

### 4.3 `platform-ports`

职责：

- 平台能力接口定义
- logger / storage / device / appControl / localWebServer / connector 等 port
- logger 结构化事件模型与 helper 约束
- `DEV raw / PROD masked` 日志策略约束
- 约束所有 port 上下文字段使用显式 ID 字段和毫秒时间戳字段

不负责：

- runtime 业务执行
- request 聚合

### 4.4 `state-runtime`

职责：

- 定义统一 state runtime 基座
- 定义 `RootState` 扩展点
- 定义 slice descriptor、persist intent、sync intent 等通用 state contract
- 提供 store 创建、slice 注册、selector/helper 约束
- 提供 workspace / instanceMode / 顶层 `updatedAt` 同步所需的基础能力
- 保留旧工程的 `RootState` 声明合并扩展能力

明确定位：

- `state-runtime` 是通用包
- `state-runtime` 不承载具体业务语义
- `state-runtime` 不拥有 `masterInfo`、`errorCatalog`、`parameterCatalog` 这些领域概念

不负责：

- request/control-plane 真相
- topology 业务逻辑
- error/parameter 定义注册
- 直接决定哪些领域状态应该持久化

### 4.5 `execution-runtime`

职责：

- 单机命令执行模型
- command dispatch pipeline
- handler 执行
- execution middleware
- 本机 execution journal

说明：

- 新架构继续保留 `command` 作为统一执行主语
- 旧 `actor system` 不再作为全局基础设施保留
- `actor` 的职责下沉为模块内部的 handler 组织形式

不负责：

- 主副机 owner 判定
- 远程 request 聚合
- wire protocol

### 4.6 `transport-runtime`

职责：

- 通用 HTTP / WS / 未来 TCP 类 transport 基座
- 连接、重连、序列化、顺序通道、会话承载
- endpoint / socket profile 抽象

不负责：

- request owner 语义
- 主副机控制面聚合

### 4.7 `topology-runtime`

职责：

- 主副机拓扑控制面
- pairing / route / owner-ledger
- request 聚合与 projection 构建
- compatibility decision
- state sync session
- 基于 `state-runtime` 承载拓扑域的可恢复状态
- 保存 slave 重启恢复所需的 `masterInfo` 等 last-known topology seed
- 保存 `enableSlave`、可操作的 `instanceMode / displayMode` 等拓扑域可变状态

不负责：

- 本机命令 handler 执行
- transport socket 生命周期
- 客户端连接/重连策略
- UI 可读连接状态 slice

补充说明：

- `topology-runtime` 同时包含两层语义
- 活的控制面真相，例如 owner-ledger、remote dispatch、state sync session
- 可持久化的拓扑恢复状态，例如 `masterInfo`
- 其中只有“可恢复状态”进入基于 Redux 的 state 层
- request/control-plane 正确性本身不进入 Redux 真相源

### 4.8 `host-runtime`

职责：

- host pairing / relay / session 核心
- hello / ack / peer online / peer offline
- relay channel 与 resume barrier
- host 侧 state sync envelope / remote command envelope 中继
- 与产品宿主解耦的可嵌入 host 运行时

不负责：

- Node/mock server 进程包装
- 业务命令执行
- request owner 真相判定
- UI read model

### 4.9 `topology-client-runtime`

职责：

- 客户端侧主副机拓扑编排
- 根据 environment + recovery state 生成公开 topology context
- 维护连接、peer、resume、sync 等客户端 read model
- 编排 hello / reconnect / resume / state sync / remote command 流程
- 把 `topology-runtime`、`transport-runtime`、`runtime-shell` 装配成终端客户端运行体验
- 提供替代旧 `interconnection` 的正式 command 入口

不负责：

- owner-ledger 真相
- 通用 scoped state helper
- React hook
- HTTP / WS 基础设施

### 4.10 `runtime-shell`

职责：

- runtime 总装配入口
- modules 挂载与 app-wide state 装配
- state-runtime / execution-runtime / topology-runtime / transport-runtime / topology-client-runtime 接入
- request projection state 对接 store
- `errorCatalog` / parameter catalog 等全局读模型承接
- selector 对外暴露
- 基于 `state-runtime` 承载全局可变 catalog 数据

不负责：

- 自己实现 transport 协议
- 自己实现 host relay

### 4.11 `0-mock-server/dual-topology-host`

职责：

- 双机拓扑宿主的开发验证实现
- `host-runtime` 的 Node/mock shell
- pairing ticket 管理
- hello/ack 建链
- 有序消息转发
- 心跳、断线、重连窗口
- 观测与故障注入

长期定位：

- 协议开发实现与联调承载实现
- 后续产品形态将下沉为主屏机内置宿主实现

与统一 ID 方案的关系：

- 必须协议兼容
- 不要求复用 `1-kernel / 2-ui / 3-adapter / 4-assembly` 的统一 ID 生成实现

不负责：

- request owner 聚合
- 业务命令执行
- request complete 判定

---

## 5. 包依赖方向

依赖方向定义如下：

- `definition-registry` -> `contracts`
- `platform-ports` -> `contracts`
- `state-runtime` -> `contracts`, `platform-ports`
- `execution-runtime` -> `contracts`, `definition-registry`, `platform-ports`
- `transport-runtime` -> `contracts`, `platform-ports`
- `topology-runtime` -> `contracts`, `state-runtime`, `platform-ports`
- `host-runtime` -> `contracts`, `platform-ports`
- `topology-client-runtime` -> `contracts`, `platform-ports`, `state-runtime`, `transport-runtime`, `topology-runtime`
- `runtime-shell` -> `contracts`, `definition-registry`, `platform-ports`, `state-runtime`, `execution-runtime`, `transport-runtime`, `topology-runtime`, `topology-client-runtime`

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
- runtime 内的时间真相一律使用 `TimestampMs`
- runtime 内的 request / command / session / node 标识统一走语义化 ID helper

补充约束：

- Redux 继续保留在 kernel 里，作为统一业务 state 能力的一部分
- 但 Redux 不再承担 request/control-plane 真相
- 所有领域 state 均通过 `state-runtime` 统一接入
- `RootState` 必须继续允许各包通过声明合并扩展

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

所有 request / command / projection 时间字段必须满足：

1. 只存毫秒时间戳数字
2. 不存格式化时间文本
3. 日志和 UI 展示时再格式化

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

并且必须验证：

- 时间字段以毫秒时间戳数字写入 state / protocol / persistence
- 产品 runtime 四层统一 ID helper 可稳定产出语义化 ID
- `0-mock-server` 即使使用独立 ID 实现，也能与协议正常互通

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
7. 新架构正式确立“时间统一为毫秒时间戳数字、产品四层统一运行时 ID、mock/server 仅做协议兼容”的基础约束。
