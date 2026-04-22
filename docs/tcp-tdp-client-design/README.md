# terminal-data 设计总览

> 目标：为 `_old_/1-kernel/1.1-cores/terminal` 提供新一代替代包设计方案。  
> 包名建议：`@impos2/kernel-core-terminal-data`  
> 模块名建议：`kernel.core.terminal-data`

---

## 文档目录

- `docs/tcp-tdp-client-design/00-设计背景与目标.md`
- `docs/tcp-tdp-client-design/01-架构与边界设计.md`
- `docs/tcp-tdp-client-design/02-领域模型与状态设计.md`
- `docs/tcp-tdp-client-design/03-模块结构与接口设计.md`
- `docs/tcp-tdp-client-design/04-关键流程设计.md`
- `docs/tcp-tdp-client-design/05-兼容策略与迁移建议.md`

---

## 一句话定义

`terminal-data` 是一个**面向终端侧的 TCP/TDP 客户端通用数据内核**。  
它负责：

- 终端身份与激活状态
- TCP 控制面客户端能力
- TDP 数据面会话与数据同步能力
- 终端本地运行时数据状态
- 终端绑定上下文与派生树视图
- 任务投递接收、结果回报与同步编排

它**不再以旧 `unitData + Unit 树 + kernelWS` 作为核心模型**。

---

## 与旧 `terminal` 包的根本差异

旧 `terminal` 包的中心思想是：
- 设备激活
- kernel API token 注入
- kernel WS 连接
- unitData 变更同步
- operatingEntity / model / terminal 的树状覆盖

新 `terminal-data` 的中心思想是：
- TCP 显式实体引用
- TDP 显式 Topic / Scope / Projection / ChangeLog
- 客户端本地显式状态
- 显式激活与绑定上下文
- 派生树仅作为客户端视图能力，不作为服务端权威模型

---

## 核心结论

### 保留在新内核中的能力
- 终端身份、激活、认证态
- 终端绑定上下文
- TDP Session / heartbeat / reconnect / catch-up
- Projection 缓存与变更消费
- 任务投递接收与结果回报
- 本地配置目标、版本目标、能力状态
- 派生树视图能力

### 不保留为核心模型的能力
- 旧 `unitData` 体系
- 旧 `Unit` 万能树模型
- 旧 `rootPath` 覆盖优先级
- 老 `kernelWS` 专属协议语义
- 项目特定业务域解释逻辑

---

## 设计原则摘要

- **显式实体优先**：`tenant / brand / store / profile / terminal` 为显式引用实体
- **客户端派生树**：允许在客户端内部构建通用树，但不要求服务端转为树权威模型
- **控制面与数据面解耦**：TCP 与 TDP 在客户端中分别建模与同步
- **强状态可观察**：每类状态都有明确 slice、selector、actor 与 command
- **框架风格继承 `1-kernel`**：保持 `AppModule + slices + commands + actors + supports + foundations` 结构
- **适配层注入**：设备、存储、网络、连接、时钟、日志全部通过 foundation / adapter 抽象接入

