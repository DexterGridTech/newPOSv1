# 协议与API规范

> 版本：1.0 | 状态：正式稿 | 日期：2026-04-05

---

## 1. WebSocket 协议

### 1.1 连接建立

#### 连接 URL

```
wss://<gateway>/tdp/ws/connect?terminalId={id}&token={jwt}
```

**参数说明：**
- `terminalId`：终端唯一标识
- `token`：JWT 认证令牌，包含 `terminalId`、`tenantId`、`orgScopeId`、`profileScopeId`

#### 握手消息（客户端 → 服务端）

```json
{
  "type": "HANDSHAKE",
  "data": {
    "terminalId": "pos-001",
    "tenantId": "t-001",
    "orgScopeId": "store:s-001",
    "profileScopeId": "device-model:pos-standard",
    "appVersion": "2.1.0",
    "lastCursor": 10020,
    "capabilities": ["print", "scan"],
    "subscribedTopics": [
      "menu.catalog",
      "menu.availability",
      "order.pending",
      "store.config",
      "config.system-params",
      "table.status",
      "booking.today",
      "order.urge",
      "print.command",
      "remote.control"
    ]
  }
}
```

**字段说明：**
- `terminalId`：终端实例 ID
- `tenantId`：租户 ID
- `orgScopeId`：组织作用域 ID（格式：`{type}:{id}`）
- `profileScopeId`：终端画像 ID（格式：`device-model:{model}`）
- `appVersion`：终端应用版本
- `lastCursor`：终端已消费到的 Revision（首次连接为 0）
- `capabilities`：终端能力列表
- `subscribedTopics`：订阅的 Topic 列表

#### 握手响应（服务端 → 客户端）

```json
{
  "type": "SESSION_READY",
  "data": {
    "sessionId": "sess_xxx",
    "nodeId": "l2-beijing-01",
    "nodeState": "healthy",
    "highWatermark": 10042,
    "syncMode": "incremental",
    "alternativeEndpoints": [
      "wss://l2-beijing-02.example.com/tdp/ws/connect",
      "wss://l1-central.example.com/tdp/ws/connect"
    ]
  }
}
```

**字段说明：**
- `sessionId`：会话 ID
- `nodeId`：当前连接的节点 ID
- `nodeState`：节点状态（`healthy` / `grace` / `degraded`）
- `highWatermark`：当前最新 Revision
- `syncMode`：同步模式（`incremental` / `full`）
- `alternativeEndpoints`：备用连接端点列表

**syncMode 决策规则：**
- `lastCursor == 0`：首次连接 → `full`
- `lastCursor < highWatermark - 1000`：落后过多 → `full`
- `lastCursor` 对应的 Change Log 已过期 → `full`
- 其他情况 → `incremental`

---

### 1.2 实时推送消息

#### PROJECTION_CHANGED（投影变更）

```json
{
  "type": "PROJECTION_CHANGED",
  "eventId": "evt_xxx",
  "timestamp": 1712304600000,
  "data": {
    "topic": "order.pending",
    "itemKey": "order:20240405001",
    "operation": "upsert",
    "scopeType": "store",
    "scopeId": "store:s-001",
    "revision": 10043,
    "payload": {
      "orderId": "order_20240405001",
      "orderNo": "#20240405001",
      "scene": "DINE_IN",
      "items": [
        {
          "productId": "prod_001",
          "productName": "宫保鸡丁",
          "quantity": 1,
          "price": 2800
        }
      ],
      "amount": 2800,
      "status": "PAID",
      "createdAt": "2026-04-05T10:30:00Z"
    },
    "occurredAt": "2026-04-05T10:30:00Z",
    "sourceSystem": "trading-service"
  }
}
```

**operation 枚举：**
- `upsert`：插入或更新
- `delete`：删除（tombstone）

#### PROJECTION_BATCH（批量变更）

当短时间内有多个变更时，服务端可合并推送：

```json
{
  "type": "PROJECTION_BATCH",
  "eventId": "batch_xxx",
  "timestamp": 1712304600000,
  "data": {
    "changes": [
      { /* PROJECTION_CHANGED data 1 */ },
      { /* PROJECTION_CHANGED data 2 */ },
      { /* PROJECTION_CHANGED data 3 */ }
    ]
  }
}
```

---

### 1.3 心跳与状态上报

#### PING / PONG（心跳）

```json
// 客户端 → 服务端（每 30 秒）
{ "type": "PING" }

// 服务端 → 客户端
{ "type": "PONG" }
```

#### STATE_REPORT（终端状态上报）

```json
{
  "type": "STATE_REPORT",
  "data": {
    "lastAppliedRevision": 10042,
    "connectionMetrics": {
      "latency": 45,
      "reconnectCount": 0
    },
    "localStoreMetrics": {
      "projectionCount": 150,
      "storageSize": 2048000
    }
  }
}
```

**上报频率：**
- 正常情况：每 5 分钟
- 同步完成后：立即上报
- 连接质量变化时：立即上报

---

### 1.4 系统控制消息

#### EDGE_DEGRADED（边缘节点降级）

```json
{
  "type": "EDGE_DEGRADED",
  "data": {
    "reason": "upstream_disconnected",
    "issuedAt": "2026-04-05T11:00:00Z",
    "nodeState": "grace",
    "gracePeriodSeconds": 300,
    "alternativeEndpoints": [
      "wss://l2-beijing-02.example.com/tdp/ws/connect",
      "wss://l1-central.example.com/tdp/ws/connect"
    ]
  }
}
```

**reason 枚举：**
- `upstream_disconnected`：L2 与 L1 断连
- `high_load`：节点负载过高
- `maintenance_mode`：进入维护模式

**nodeState 枚举：**
- `healthy`：正常
- `grace`：宽限期（仍可服务，但建议迁移）
- `degraded`：降级（只读，不接受新连接）

#### SESSION_REHOME_REQUIRED（会话迁移要求）

```json
{
  "type": "SESSION_REHOME_REQUIRED",
  "data": {
    "reason": "node_draining",
    "deadline": "2026-04-05T11:10:00Z",
    "alternativeEndpoints": [
      "wss://l2-beijing-02.example.com/tdp/ws/connect"
    ]
  }
}
```

**终端处理流程：**
1. 收到 `SESSION_REHOME_REQUIRED` 消息
2. 在 `deadline` 前完成当前操作
3. 主动断开当前连接
4. 连接到 `alternativeEndpoints` 中的第一个可用端点
5. 携带 `lastAppliedRevision` 重新握手

---

### 1.5 连接状态机

```
┌─────────────┐
│ DISCONNECTED│
└──────┬──────┘
       │ connect()
       ▼
┌─────────────┐
│ CONNECTING  │
└──────┬──────┘
       │ HANDSHAKE
       ▼
┌─────────────┐
│ HANDSHAKING │
└──────┬──────┘
       │ SESSION_READY
       ▼
┌─────────────┐     syncMode=incremental
│   SYNCING   ├──────────────────────────┐
└──────┬──────┘                          │
       │ syncMode=full                   │
       │ (HTTP /v1/sync/reconcile)       │
       ▼                                 ▼
┌─────────────┐                   ┌─────────────┐
│FULL_SYNCING │                   │INCR_SYNCING │
└──────┬──────┘                   └──────┬──────┘
       │                                 │
       └────────────┬────────────────────┘
                    │ sync complete
                    ▼
             ┌─────────────┐
             │   ONLINE    │◄──┐
             └──────┬──────┘   │
                    │          │ PROJECTION_CHANGED
                    │          │ (实时推送)
                    └──────────┘
```

---

## 2. HTTP API

### 2.1 写入 API（业务系统调用）

#### PUT /v1/projections/items

写入或更新单个 Projection Item。

**请求头：**
```
Authorization: Bearer <service_token>
Content-Type: application/json
```

**请求体：**
```json
{
  "tenantId": "t-001",
  "topic": "order.pending",
  "itemKey": "order:20240405001",
  "scopeType": "store",
  "scopeId": "store:s-001",
  "payload": {
    "orderId": "order_20240405001",
    "orderNo": "#20240405001",
    "status": "PAID",
    "amount": 5800,
    "items": [...]
  },
  "schemaVersion": "1.0",
  "sourceSystem": "trading-service",
  "occurredAt": "2026-04-05T10:30:00Z",
  "idempotencyKey": "evt_12345",
  "expiresAt": null
}
```

**响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "revision": 10042,
    "affectedTerminals": 3
  }
}
```

**错误响应：**
```json
{
  "code": 400,
  "message": "Topic not registered",
  "error": "TOPIC_NOT_FOUND"
}
```

**错误码：**
- `TOPIC_NOT_FOUND`：Topic 未注册
- `INVALID_SCOPE`：Scope 不合法
- `PAYLOAD_TOO_LARGE`：Payload 超过限制
- `SCHEMA_VALIDATION_FAILED`：Schema 校验失败
- `IDEMPOTENCY_CONFLICT`：幂等键冲突（相同 key 但 payload 不同）

#### DELETE /v1/projections/items

标记 Projection Item 为 tombstone。

**请求体：**
```json
{
  "tenantId": "t-001",
  "topic": "order.pending",
  "itemKey": "order:20240405001",
  "scopeType": "store",
  "scopeId": "store:s-001",
  "idempotencyKey": "evt_12346"
}
```

**响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "revision": 10043,
    "affectedTerminals": 3
  }
}
```

#### POST /v1/projections/batch

批量写入（原子性，全成功或全失败）。

**请求体：**
```json
{
  "items": [
    {
      "tenantId": "t-001",
      "topic": "menu.availability",
      "itemKey": "product:prod_001",
      "scopeType": "store",
      "scopeId": "store:s-001",
      "payload": { "status": "SOLD_OUT" },
      "idempotencyKey": "evt_001"
    },
    {
      "tenantId": "t-001",
      "topic": "menu.availability",
      "itemKey": "product:prod_002",
      "scopeType": "store",
      "scopeId": "store:s-001",
      "payload": { "status": "AVAILABLE" },
      "idempotencyKey": "evt_002"
    }
  ]
}
```

**响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "revisionRange": [10044, 10045],
    "affectedTerminals": 5
  }
}
```

---

### 2.2 终端同步 API

#### POST /v1/sync/changes

增量追平。

**请求头：**
```
Authorization: Bearer <terminal_token>
Content-Type: application/json
```

**请求体：**
```json
{
  "cursor": 10020,
  "topics": ["menu.catalog", "order.pending", "workunit.active"],
  "limit": 100
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "changes": [
      {
        "revision": 10021,
        "topic": "order.pending",
        "itemKey": "order:20240405001",
        "operation": "upsert",
        "scopeType": "store",
        "scopeId": "store:s-001",
        "payload": {
          "orderId": "order_20240405001",
          "orderNo": "#20240405001",
          "status": "PAID",
          "amount": 5800
        },
        "occurredAt": "2026-04-05T10:31:00Z"
      },
      {
        "revision": 10022,
        "topic": "workunit.active",
        "itemKey": "workunit:wu_001",
        "operation": "delete",
        "scopeType": "store",
        "scopeId": "store:s-001",
        "occurredAt": "2026-04-05T10:32:00Z"
      }
    ],
    "nextCursor": 10023,
    "hasMore": false,
    "highWatermark": 10042
  }
}
```

**字段说明：**
- `changes`：变更列表，按 Revision 升序排列
- `nextCursor`：下次请求的 cursor 值
- `hasMore`：是否还有更多变更
- `highWatermark`：当前最新 Revision

**分页策略：**
- 单次最多返回 100 条变更
- 如果 `hasMore=true`，终端应继续请求直到 `hasMore=false`

#### POST /v1/sync/reconcile

全量对账（当 cursor 过期或本地状态可疑时）。

**请求体：**
```json
{
  "topics": ["menu.catalog", "order.pending"],
  "localDigest": {
    "menu.catalog": "md5_hash_xxx",
    "order.pending": "md5_hash_yyy"
  }
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "fullSnapshot": [
      {
        "topic": "order.pending",
        "itemKey": "order:20240405001",
        "scopeType": "store",
        "scopeId": "store:s-001",
        "payload": {
          "orderId": "order_20240405001",
          "orderNo": "#20240405001",
          "status": "PAID",
          "amount": 5800
        },
        "revision": 10040
      },
      {
        "topic": "order.pending",
        "itemKey": "order:20240405002",
        "scopeType": "store",
        "scopeId": "store:s-001",
        "payload": {
          "orderId": "order_20240405002",
          "orderNo": "#20240405002",
          "status": "ACCEPTED",
          "amount": 3200
        },
        "revision": 10041
      }
    ],
    "highWatermark": 10042
  }
}
```

**说明：**
- `fullSnapshot` 只包含当前有效的 Projection（tombstone 的不返回）
- 终端收到后应清空本地对应 Topic 的数据，重新写入
- `localDigest` 用于服务端判断是否需要返回完整快照（可选优化）

---

### 2.3 管理 API

#### GET /v1/sessions

查询在线会话列表（运营后台使用）。

**请求参数：**
```
?storeId=s-001&deviceType=pos&page=1&pageSize=20
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "sessions": [
      {
        "sessionId": "sess_xxx",
        "terminalId": "pos-001",
        "tenantId": "t-001",
        "orgScopeId": "store:s-001",
        "profileScopeId": "device-model:pos-standard",
        "nodeId": "l2-beijing-01",
        "connectedAt": "2026-04-05T08:00:00Z",
        "lastHeartbeatAt": "2026-04-05T10:30:00Z",
        "lastAppliedRevision": 10042,
        "subscribedTopics": ["menu.catalog", "order.pending"]
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  }
}
```

#### POST /v1/sessions/{sessionId}/rehome

强制会话迁移（运维使用）。

**请求体：**
```json
{
  "targetNodeId": "l2-beijing-02",
  "gracePeriodSeconds": 60
}
```

**响应：**
```json
{
  "code": 200,
  "message": "Rehome command sent"
}
```

---

## 3. L1 / L2 联邦同步协议

### 3.1 L2 订阅 L1

L2 启动后，向 L1 注册并订阅需要的 Scope 集合。

**L2 → L1：**
```
POST /internal/federation/subscribe
Authorization: Bearer <l2_node_token>
```

```json
{
  "l2NodeId": "l2-beijing-01",
  "region": "beijing",
  "subscribedScopes": [
    { "scopeType": "store", "scopeId": "store:s-001" },
    { "scopeType": "store", "scopeId": "store:s-002" },
    { "scopeType": "store", "scopeId": "store:s-003" }
  ],
  "lastCursor": 10000
}
```

**L1 → L2：**
```json
{
  "code": 200,
  "data": {
    "subscriptionId": "sub_xxx",
    "highWatermark": 10042,
    "bootstrapRequired": true
  }
}
```

**字段说明：**
- `bootstrapRequired`：是否需要 Bootstrap 快照（首次订阅或 cursor 过期时为 true）

---

### 3.2 Bootstrap 快照

L2 首次订阅某 Scope 时，L1 返回该 Scope 的完整 Projection 快照。

**L2 → L1：**
```
POST /internal/federation/bootstrap
```

```json
{
  "subscriptionId": "sub_xxx",
  "scopeType": "store",
  "scopeId": "store:s-001",
  "topics": ["menu.catalog", "order.pending", "table.status"]
}
```

**L1 → L2：**
```json
{
  "code": 200,
  "data": {
    "snapshot": [
      {
        "topic": "menu.catalog",
        "itemKey": "menu-version:v20240405",
        "payload": { "version": "v20240405", "downloadUrl": "..." },
        "revision": 9800
      },
      {
        "topic": "order.pending",
        "itemKey": "order:20240405001",
        "payload": { "orderId": "order_20240405001", "status": "PAID" },
        "revision": 10020
      }
    ],
    "snapshotRevision": 10020
  }
}
```

**说明：**
- `snapshotRevision`：快照对应的 Revision，L2 应从此 Revision 开始增量同步

---

### 3.3 增量同步

L1 持续向 L2 推送增量变更（通过 WebSocket 或 HTTP 长轮询）。

#### WebSocket 推送（推荐）

**L1 → L2（WebSocket）：**
```json
{
  "type": "FEDERATION_CHANGE",
  "data": {
    "changes": [
      {
        "revision": 10043,
        "topic": "order.pending",
        "itemKey": "order:20240405003",
        "operation": "upsert",
        "scopeType": "store",
        "scopeId": "store:s-001",
        "payload": { "orderId": "order_20240405003", "status": "PAID" },
        "occurredAt": "2026-04-05T10:35:00Z"
      }
    ]
  }
}
```

**L2 → L1（Ack）：**
```json
{
  "type": "FEDERATION_ACK",
  "data": {
    "lastAppliedRevision": 10043
  }
}
```

#### HTTP 长轮询（备用）

**L2 → L1：**
```
GET /internal/federation/changes?subscriptionId=sub_xxx&cursor=10020&timeout=30000
```

**L1 → L2：**
```json
{
  "code": 200,
  "data": {
    "changes": [ /* 同 WebSocket */ ],
    "nextCursor": 10044,
    "hasMore": false
  }
}
```

---

### 3.4 L2 健康检查

L1 定期检查 L2 健康状态。

**L1 → L2：**
```
GET /internal/health
```

**L2 → L1：**
```json
{
  "status": "healthy",
  "upstreamConnected": true,
  "lastSyncRevision": 10042,
  "syncLagSeconds": 2,
  "connectedTerminals": 15
}
```

**status 枚举：**
- `healthy`：正常
- `degraded`：降级（上游断连但仍可服务）
- `unhealthy`：不健康（无法服务）

---

## 4. 认证与鉴权

### 4.1 Service Token（业务系统调用 TDP）

**Token 格式：** JWT

**Payload：**
```json
{
  "sub": "trading-service",
  "iss": "tdp-auth",
  "iat": 1712304600,
  "exp": 1712308200,
  "allowedTopics": [
    "order.pending",
    "order.urge"
  ],
  "allowedScopes": [
    "store:*"
  ]
}
```

**校验规则：**
- TDP 校验 Token 签名
- 校验 `allowedTopics` 是否包含请求的 Topic
- 校验 `allowedScopes` 是否匹配请求的 Scope

---

### 4.2 Terminal Token（终端连接 TDP）

**Token 格式：** JWT

**Payload：**
```json
{
  "sub": "pos-001",
  "iss": "terminal-auth",
  "iat": 1712304600,
  "exp": 1712391000,
  "terminalId": "pos-001",
  "tenantId": "t-001",
  "orgScopeId": "store:s-001",
  "profileScopeId": "device-model:pos-standard"
}
```

**校验规则：**
- TDP 校验 Token 签名
- 校验 `terminalId` 与连接参数一致
- 校验 `orgScopeId` 与 `profileScopeId` 绑定关系

---

### 4.3 L2 Node Token（L2 连接 L1）

**Token 格式：** JWT

**Payload：**
```json
{
  "sub": "l2-beijing-01",
  "iss": "federation-auth",
  "iat": 1712304600,
  "exp": 1712391000,
  "nodeId": "l2-beijing-01",
  "region": "beijing",
  "allowedScopes": [
    "store:s-001",
    "store:s-002",
    "store:s-003"
  ]
}
```

---

## 5. 传输加密

### 5.1 TLS 配置

- 所有 WebSocket 连接强制 WSS（TLS 1.3）
- 所有 HTTP API 强制 HTTPS
- 最低 TLS 版本：1.2
- 推荐 TLS 版本：1.3

### 5.2 证书管理

- L1 / L2 节点使用受信任的 CA 签发证书
- 证书有效期：1 年
- 自动续期：到期前 30 天

---

## 6. 错误处理

### 6.1 HTTP 错误码

| 状态码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（幂等键冲突） |
| 413 | Payload 过大 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

### 6.2 WebSocket 关闭码

| 关闭码 | 说明 |
|-------|------|
| 1000 | 正常关闭 |
| 1001 | 端点离开 |
| 1002 | 协议错误 |
| 1003 | 不支持的数据类型 |
| 1008 | 违反策略 |
| 1011 | 服务器内部错误 |
| 4000 | 认证失败 |
| 4001 | Token 过期 |
| 4002 | 会话迁移要求 |
| 4003 | 节点降级 |

---

## 7. 性能指标

### 7.1 延迟要求

| 操作 | P99 延迟 |
|------|---------|
| 写入 API | < 200ms |
| WebSocket 推送 | < 500ms |
| 增量同步 | < 1s |
| 全量对账 | < 5s |

### 7.2 吞吐量要求

| 指标 | 目标值 |
|------|--------|
| 写入 QPS | 500+ |
| 推送 QPS | 1000+ |
| 并发连接数 | 10000+ |

---

*上一篇：[02-业务域集成设计](./02-业务域集成设计.md)*
*下一篇：[04-数据模型与存储设计](./04-数据模型与存储设计.md)*
