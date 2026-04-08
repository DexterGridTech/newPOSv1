# 双机拓扑协议与宿主设计

## 1. 文档目标

本文档定义新双机模型中：

- 主副机控制面协议
- request 生命周期协议
- projection 镜像策略
- `dual-topology-host` 宿主边界
- 与版本管理体系的结合方式

本文档是 `topology-runtime` 和 `0-mock-server/dual-topology-host` 的共同设计依据。

---

## 2. 设计目标

双机模型必须满足以下目标：

1. 主副机 request 生命周期语义明确。
2. request 结果与 request 完成判断不依赖跨机 slice 同步。
3. 协议兼容性有显式判断机制。
4. 宿主实现可先在 Node 环境验证，后续下沉到主屏机内置宿主。

---

## 3. request 生命周期模型

### 3.1 owner-ledger 规则

一个 request 只存在一个 owner。

默认规则：

- root command 发起节点即 owner 节点

owner 节点持有唯一权威 ledger。

### 3.2 child command 规则

child command 派发规则：

1. 先在 owner ledger 中登记 child node
2. 再执行 route
3. 再发 remote dispatch

远端 lifecycle event 只能推进已登记节点状态，不能用于“发现新节点”。

### 3.3 command node 状态

内部状态：

- `registered`
- `dispatched`
- `accepted`
- `started`
- `complete`
- `error`

### 3.4 request 聚合状态

对外聚合状态：

- `started`
- `complete`
- `error`

判定规则：

- 任一 node `error` -> request `error`
- 所有 node terminal -> request `complete`
- 否则 -> request `started`

terminal 状态：

- `complete`
- `error`

---

## 4. 控制面协议对象

### 4.1 节点信息

```ts
export interface NodeRuntimeInfo {
  nodeId: string
  deviceId: string
  role: 'master' | 'slave'
  platform: string
  product: string
  assemblyAppId: string
  assemblyVersion: string
  buildNumber: number
  bundleVersion: string
  runtimeVersion: string
  protocolVersion: string
  capabilities: string[]
}
```

### 4.2 pairing ticket

```ts
export interface PairingTicket {
  token: string
  masterNodeId: string
  transportUrls: string[]
  issuedAt: number
  expiresAt: number
  hostRuntime: NodeRuntimeInfo
}
```

### 4.3 hello / ack

```ts
export interface NodeHello {
  helloId: string
  ticketToken: string
  runtime: NodeRuntimeInfo
  sentAt: number
}

export interface CompatibilityDecision {
  level: 'full' | 'degraded' | 'rejected'
  reasons: string[]
  enabledCapabilities: string[]
  disabledCapabilities: string[]
}

export interface NodeHelloAck {
  helloId: string
  accepted: boolean
  sessionId?: string
  peerRuntime?: NodeRuntimeInfo
  compatibility: CompatibilityDecision
  rejectionCode?:
    | 'TOKEN_INVALID'
    | 'TOKEN_EXPIRED'
    | 'ROLE_CONFLICT'
    | 'PROTOCOL_INCOMPATIBLE'
    | 'CAPABILITY_MISSING'
    | 'PAIR_OCCUPIED'
  rejectionMessage?: string
  hostTime: number
}
```

### 4.4 command dispatch

```ts
export interface CommandDispatchEnvelope {
  envelopeId: string
  sessionId: string
  requestId: string
  commandId: string
  parentCommandId?: string
  ownerNodeId: string
  sourceNodeId: string
  targetNodeId: string
  commandName: string
  payload: unknown
  context: {
    sessionId?: string
    workspace?: string
    routeTags?: string[]
    metadata?: Record<string, unknown>
  }
  sentAt: number
}
```

### 4.5 command event

```ts
export interface CommandEventEnvelope {
  envelopeId: string
  sessionId: string
  requestId: string
  commandId: string
  ownerNodeId: string
  sourceNodeId: string
  eventType: 'accepted' | 'started' | 'resultPatch' | 'completed' | 'failed'
  resultPatch?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: {
    key: string
    code: string
    message: string
    details?: unknown
  }
  occurredAt: number
}
```

### 4.6 request projection

```ts
export interface RequestProjection {
  requestId: string
  ownerNodeId: string
  status: 'started' | 'complete' | 'error'
  startedAt: number
  updatedAt: number
  resultsByCommand: Record<string, Record<string, unknown>>
  mergedResults: Record<string, unknown>
  errorsByCommand: Record<string, { key: string; code: string; message: string }>
  pendingCommandCount: number
}
```

### 4.7 projection mirror

```ts
export interface ProjectionMirrorEnvelope {
  envelopeId: string
  sessionId: string
  ownerNodeId: string
  projection: RequestProjection
  mirroredAt: number
}
```

---

## 5. 协议时序

### 5.1 remote child command 派发

推荐时序：

1. owner 创建 child node，写入 ledger，状态 `registered`
2. owner route 决策完成，状态变为 `dispatched`
3. owner 发送 `CommandDispatchEnvelope`
4. remote 收到后回 `accepted`
5. remote 真正开始执行时回 `started`
6. remote 过程结果回 `resultPatch`
7. remote 完成回 `completed`
8. remote 失败回 `failed`
9. owner 每次更新 ledger 后重建 projection

### 5.2 projection mirror

projection mirror 策略：

- 只在跨节点 request 场景考虑
- 只在双方 capability 支持时开启
- 默认不是强制链路

原则：

- ledger 不跨机复制
- projection 可跨机镜像

---

## 6. 同步与异步边界

### 6.1 同步阶段

以下动作必须同步完成：

- root request 创建
- child node 登记
- parent-child edge 建立
- owner ledger 写入
- 本地 projection 更新
- route decision

### 6.2 异步阶段

以下动作属于异步：

- transport 发送
- remote hello / ack
- remote command event 回传
- projection mirror

### 6.3 硬约束

以下约束必须成立：

- command node 必须先进入 owner ledger，后续才允许远端执行
- request complete 不允许依赖“当前已可见状态并集”
- result 真相源必须回 owner，再派生 projection

---

## 7. 兼容与版本管理

### 7.1 版本字段来源

依据 [终端版本管理说明.md](/Users/dexter/Documents/workspace/idea/newPOSv1/终端版本管理说明.md)：

- `assemblyVersion` -> assembly `releaseInfo`
- `buildNumber` -> assembly `releaseInfo`
- `bundleVersion` -> assembly `releaseInfo`
- `runtimeVersion` -> assembly `releaseInfo`
- `packageVersion` -> 各包 `src/generated/packageVersion.ts`

### 7.2 协议兼容判定

兼容判定优先级：

1. `protocolVersion`
2. `requiredCapabilities`
3. `runtimeVersion`
4. `assemblyVersion`

### 7.3 规则

- `protocolVersion`：硬门槛
- `requiredCapabilities`：硬门槛
- `runtimeVersion`：软门槛，可触发 `degraded`
- `assemblyVersion`：治理参考
- `packageVersion`：研发追踪，不参与互连判定

---

## 8. `dual-topology-host` 职责

### 8.1 职责范围

`dual-topology-host` 只做以下事情：

- pairing ticket 发放与校验
- hello/ack 建链
- session 管理
- 有序消息转发
- 心跳与断线管理
- dispatch / event / projection mirror 转发
- stats / observation
- fault injection

### 8.2 不负责的事情

以下内容不能放进 host：

- request owner 聚合
- business command handler 执行
- request complete 判定
- mergedResults 构造

### 8.3 长期落地位置

开发实现：

- `0-mock-server/dual-topology-host`

产品实现：

- `3-adapter/android/adapterPure` 的主屏机内置宿主能力

二者必须实现同一份 host contract。

---

## 9. 观测与故障注入

`dual-topology-host` 必须提供以下开发能力：

- session stats
- hello / ack / dispatch / event 时序日志
- 人工延迟注入
- 丢包注入
- 指定 event 触发断连
- reconnect 窗口验证

这些能力是主副机控制面重构的必要验证手段，而不是附属调试工具。

---

## 10. 结论

新的双机模型不再依赖：

- `SYNC_STATE` 作为 request 真相源传播机制
- `REMOTE_COMMAND_EXECUTED` 作为混合完成语义

而是升级为：

- owner-ledger
- command dispatch / command event 显式协议
- capability 协商下的 projection mirror
- 版本体系参与 compatibility decision

这套设计既保留了当前业务所需的主副机特性，又为后续主屏机内置宿主实现建立了清晰边界。
