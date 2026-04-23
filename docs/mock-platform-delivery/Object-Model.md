# Mock Terminal Platform 对象模型

## 1. 顶层对象

### Sandbox
- 平台运行容器
- 用于承载一组终端、任务、Topic、故障规则与审计日志

### AuditLog
- 审计事件
- 记录后台操作、终端接入、导入导出、故障模拟等动作

---

## 2. TCP 对象模型

### TerminalInstance
- 终端实例
- 关键字段：
  - `terminalId`
  - `storeId`
  - `profileId`
  - `templateId`
  - `lifecycleStatus`
  - `presenceStatus`
  - `healthStatus`
  - `currentAppVersion`
  - `currentConfigVersion`

### TerminalProfile
- 终端能力画像
- 描述机型或业务形态下的能力集合

### TerminalTemplate
- 终端预设模板
- 描述默认配置与标签

### ActivationCode
- 激活码
- 用于将终端实例绑定到指定业务上下文

### TaskRelease
- 任务发布单
- 描述一次配置下发 / 升级 / 远控的治理动作
- 关键字段：
  - `taskType`
  - `sourceType`
  - `sourceId`
  - `priority`
  - `targetSelector`
  - `payload`
  - `status`

### TaskInstance
- 终端维度的任务实例
- 是 TaskRelease 的拆分结果
- 可追踪投递状态与执行结果

---

## 3. TDP 对象模型

### Session
- 终端与数据面的连接会话
- 包含：
  - `terminalId`
  - `clientVersion`
  - `protocolVersion`
  - `status`
  - `lastHeartbeatAt`

### Topic
- 数据面主题定义
- 当前采用：**允许注册 Topic 后自由扩展 Payload**
- 关键字段：
  - `key`
  - `name`
  - `payloadMode`
  - `scopeType`
  - `schema`

### Scope
- Topic 生效的聚合边界
- 当前实现支持：
  - `TERMINAL`
  - `STORE`
  - `TENANT`
  - `GLOBAL`

### Projection
- 某个 Topic 在某个 ScopeKey 下的当前快照
- 关键字段：
  - `topicKey`
  - `scopeType`
  - `scopeKey`
  - `revision`
  - `payload`

### ChangeLog
- Projection 变更历史
- 用于追踪 revision 演进和 TCP → TDP 链路

---

## 4. Mock 扩展对象

### SceneTemplate
- 场景模板
- 用于快速造数、发布任务、模拟业务联调链路
- 当前包含 `category`

### FaultRule
- 故障规则
- 描述某类投递/执行链路如何被延迟、失败、超时、伪造结果
- 关键字段：
  - `name`
  - `targetType`
  - `matcher`
  - `action`
  - `enabled`
  - `hitCount`

### TopicTemplate / FaultTemplate
- 平台内置模板库对象
- 用于导入与一键套用

---

## 5. 关键关系

### TCP → TDP
1. TCP 创建 `TaskRelease`
2. 拆分为多个 `TaskInstance`
3. 委托到 TDP
4. TDP 为目标终端写入 `Projection`
5. TDP 记录 `ChangeLog`
6. 终端回报结果后更新 `TaskInstance`

### Terminal ↔ Session ↔ Projection
1. 终端建立 `Session`
2. TDP 按 Topic / Scope 提供 `Projection`
3. 终端消费后通过 HTTP 回报结果

### Mock 治理增强
1. 后台可运行 `SceneTemplate`
2. 后台可注入 `FaultRule`
3. 所有动作进入 `AuditLog`

---

## 6. 当前设计原则

- TCP 与 TDP 保持边界清晰
- Mock-only 能力通过专用接口进入，不污染标准主链路
- Topic 先注册、Payload 可自由扩展
- Projection / ChangeLog 作为 TDP 核心观察面
- 后台优先支撑联调效率与问题复现
