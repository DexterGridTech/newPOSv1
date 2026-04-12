# 2026-04-13 kernel-base 长期设计记忆

## 1. 总体目标

当前重构目标不是修补旧 core，而是以 `1-kernel/1.1-base` 为新基线，重新建立更专业的 kernel/base 架构，同时继承旧工程已经验证过的业务特性。

本阶段优先范围：

1. `base`
2. `interconnection`
3. `communication`

这些旧包不要求一一对应迁移成同名新包。新架构允许拆得更细，也允许合并，只要求职责清晰、依赖明确、协议公开、扩展性强。

## 2. 全局结构规则

以下规则属于长期有效约束：

1. 所有新重构包放在 `1-kernel/1.1-base`
2. 所有文档和过程记录放在 `refactor-doc`
3. `1-kernel` 不能依赖 React
4. `hooks/index.ts` 可以保留，但只作为规则说明入口，不承载 React 逻辑
5. `moduleName` 是所有包的统一结构要素
6. `test` 目录取代 `dev`
7. 不再使用 `features/epics`
8. 不再保留 `features/middlewares` 空目录规范
9. 统一参考仓库现有 `1-kernel` / `2-ui` / `4-assembly` 子包结构，不随意自创异构目录布局
10. `_package_template_` 只是模板参考，不是当前直接产物

## 3. 核心架构原则

### 3.1 不为迁移成本妥协

已经明确确认：

1. 不考虑迁移成本
2. 旧 API/旧 manager/旧 storeEntry 这类不好的设计，不做“先兼容再慢慢改”
3. 重构阶段就直接去掉坏设计

### 3.2 Redux 继续作为 kernel 核心真相源之一

后续结论不是“去 Redux”，而是：

1. request 真相源不必继续放 Redux
2. 但业务长期状态、可恢复状态、业务 slice 扩展能力仍然要保留 Redux 作为 kernel 核心能力
3. `state-runtime` 作为通用 state 能力包
4. root state 允许各包扩展

### 3.3 状态分层

必须先区分：

1. 最小持久化真相源
2. runtime-only 状态

结论：

1. request 可以只保留内存真相源
2. topology 活的控制面真相主要在 runtime
3. 但诸如 masterInfo 这类重启后还要恢复连接的信息，要持久化到 state
4. projection 仓库要本地持久化，不然重启后无法重新计算优先级生效结果

## 4. Command / Actor 模型长期规则

这是本轮最重要的长期记忆之一。

### 4.1 角色定义

1. Command 代表业务指令
2. Actor 代表指令执行者
3. Actor 可以监听上层依赖包的 command
4. Actor 可以再发出 command

### 4.2 执行模型

最终采用方案：

1. 所有 command 默认广播给匹配的 actor
2. 但结果仍要聚合成一个 request / command aggregate result
3. actor 内再次发出的 command 也要继续纳入同一个 request 结果体系

### 4.3 设计简化规则

已经确认的简化：

1. `runtime.dispatch` 和 `context.dispatchChild` 合并认知，统一走 `dispatchCommand`
2. `visibility` 默认 `public`
3. `timeoutMs` 默认 `60s`
4. `sessionId` 不作为 command 核心模型字段强制存在

### 4.4 跨包写入规则

长期约束：

1. store/state 全局可读
2. slice action 不对外开放给跨包直接调用
3. 跨包写入必须走对方 command

也就是：

1. command 是跨包调用边界
2. action 是包内实现细节

## 5. Request / Workflow / 结果语义

### 5.1 Request 状态

已经确认：

1. request 不必强制继续写入 Redux
2. 但必须能通过 selector 或等价查询能力给 UI/业务层读取
3. request 生命周期真相源可以放在内存 ledger

### 5.2 Workflow 运行模型

已经确认的 workflow 设计要点：

1. `run()` 直接返回 observable
2. observable 连续发射运行过程状态和最终结果
3. 需要有 selector，输入 `RequestId`，输出与 observable 同构的状态
4. workflow 串行运行
5. 后续 workflow 可以进入队列，状态为 `waiting in queue`
6. script 不做过度限制，不把它设计成开放平台

## 6. Topology / 双屏 / 主副机长期规则

### 6.1 topology 包方向

已经确认：

1. 不再保留分裂的 `topology-runtime` + `topology-client-runtime`
2. 新架构合并为 `topology-runtime-v2`

### 6.2 双屏连接和恢复原则

从旧工程继承并保留的核心思想：

1. 离线重连不是简单 flush，而是自动同步恢复
2. 主副机 request 状态不能乱
3. request 状态之所以旧工程理论上可接上，是因为远端执行确认与 request start 同步回传顺序被串起来了

新架构受到的启发：

1. 远端开始执行之前，主机不能过早认定 request 完成
2. topology 协议要把恢复、快照、镜像、远端事件回灌做成一套完整链路

### 6.3 topology v2 当前确认的正确方向

1. peer 识别不能只依赖 hello ack
2. resume-begin 不能形成主副机回声循环
3. request snapshot / command event / projection mirror / state sync 都是 topology 的关键消息面

## 7. TDP / Projection / Topic 长期规则

### 7.1 Topic 与 projection 模型

已经确认：

1. 服务端不应该限制 scopeType 推送
2. 终端要接收所有 scopeType 的数据
3. 终端按优先级生效：
   1. Platform
   2. Project
   3. Brand
   4. Tenant
   5. Store
   6. Terminal
4. topic 相当于 group 概念
5. projection 必须支持 `itemKey` 作为业务唯一标识
6. mock-terminal-platform 必须支持 projection 批量 upsert / 批量推送

### 7.2 tdp-sync-runtime 通用能力

已经确认：

1. `tdp-sync-runtime` 保存全量业务 projection 仓库到本地 state
2. 按 projection id 维度持久化，避免单条过大
3. 生效态可以运行时计算，不必整份持久化
4. projection 变化后，统一发出通用 topic data changed command
5. 业务包自己监听该 command 处理自己的 state

### 7.3 基础例外桥接

已经确认只有一类例外：

1. `errorMessages`
2. `systemParameters`

因为它们属于更底层基础包，不能依赖上层 topic 广播来监听自己，所以允许由 `tdp-sync-runtime` 桥接调用 runtime-shell 相关 command 更新基础状态。

## 8. ErrorMessage / SystemParameter 规则

长期规则：

1. 动态数据放入 state-runtime 支撑的可变 state
2. 后续所有模块开发中，凡是出现可配置错误文案或系统参数，都优先抽为 `errorMessages / systemParameters`
3. “写后续模块逻辑的同时需要抽出 `errorMessages / systemParameters`”已经是开发规范

### 8.1 日志和敏感信息规则

1. DEV 环境允许原文
2. PROD 环境强制脱敏
3. 需要更多 helper，减少业务手写拼日志

## 9. 持久化长期规则

### 9.1 适配器抽象

持久化最终通过适配器完成，因为 Android / Node / Web / Electron 实现不同。

### 9.2 粒度规则

已经确认：

1. 不再走 redux-persist 整 slice 大对象式思路
2. 新持久化可以细化到 slice state 的属性级 key
3. 要支持加密存储
4. 要支持动态 record 型 state
5. 对业务层应尽量自动持久化，不要求业务手工 flush 单字段

## 10. 时间 / ID / 命名规则

长期规则：

1. 所有时间存储都用 long 毫秒值
2. 展示和日志格式化统一走基础时间工具
3. 统一运行时 ID 生成器由 kernel/base 提供
4. ID 统一能力只在 `1-kernel` / `2-ui` / `3-adapter` / `4-assembly` 四层使用，不外溢

## 11. 不需要修正的“可接受缺点”

这些点已明确说明当前不作为重构目标：

1. 类型边界依赖声明合并，隐式耦合太重
2. adapter 注册是“最后写入者生效”的全局可变状态
3. 命令系统的执行模型过于宽松
4. `ApplicationManager` 内部步骤过多，缺乏子系统边界
5. 命令默认路由过于隐式
6. transport 语义与业务完成语义混在一起

## 12. 当前阶段结论

当前阶段的长期方向已经稳定：

1. `contracts`
2. `runtime-shell-v2`
3. `tcp-control-runtime-v2`
4. `tdp-sync-runtime-v2`
5. `workflow-runtime-v2`
6. `topology-runtime-v2`

这几条线里，前五者已进入较稳定基线；`topology-runtime-v2` 已走通方向，但还要继续补齐旧 topology-client-runtime 的 live command / snapshot / mirror / state-sync 场景，之后再大规模迁业务模块。
