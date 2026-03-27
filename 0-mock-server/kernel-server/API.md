# API 文档

> IMPOS2 Kernel Server API 完整调用说明

## 📋 目录

- [基础信息](#基础信息)
- [管理后台 API](#管理后台-api)
- [设备 API](#设备-api)
- [WebSocket 连接](#websocket-连接)
- [响应格式](#响应格式)
- [错误代码](#错误代码)

---

## 基础信息

### Base URL

- 管理后台: `http://localhost:9999/kernel-server/manager`
- 设备API: `http://localhost:9999/kernel-server/api`
- WebSocket连接: `ws://localhost:9999/kernel-server/ws`

### 请求头

```http
Content-Type: application/json
```

### Token 认证

设备API需要在请求头中携带Token:

```http
Authorization: Bearer {token}
```

---

## 管理后台 API

管理后台API用于后台管理系统,无需Token认证。

### 1. 单元管理 (Units)

#### 1.1 获取单元列表

```http
GET /units?type={type}
```

**Query参数**:
- `type` (可选): 单元类型 (`entity` | `model` | `terminal`)

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "unit_123",
      "name": "总部",
      "key": "headquarter",
      "type": "entity",
      "parentId": null,
      "rootPath": ["unit_123"],
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 1.2 获取单元详情

```http
GET /units/:id
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": {
    "id": "unit_123",
    "name": "总部",
    "key": "headquarter",
    "type": "entity",
    "parentId": null,
    "rootPath": ["unit_123"],
    "createdAt": 1704528000000,
    "updatedAt": 1704528000000
  }
}
```

#### 1.3 获取单元树

```http
GET /units/:id/tree
```

**响应**: 包含children的树形结构

#### 1.4 创建单元

```http
POST /units
```

**请求体**:
```json
{
  "name": "分店A",
  "key": "branch_a",
  "type": "entity",
  "parentId": "unit_123"
}
```

**Terminal类型额外字段**:
```json
{
  "name": "收银台1",
  "key": "pos_001",
  "type": "terminal",
  "entityUnitId": "entity_id",
  "modelUnitId": "model_id",
  "activeCode": "ACT123",
  "deactiveCode": "DEACT123"
}
```

#### 1.5 更新单元

```http
PUT /units/:id
```

**请求体**: 同创建单元

#### 1.6 删除单元

```http
DELETE /units/:id
```

**注意**: 级联删除所有子单元和相关数据

---

### 2. 设备管理 (Devices)

#### 2.1 获取设备列表

```http
GET /devices
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "device_123",
      "terminalId": "terminal_001",
      "manufacturer": "Sunmi",
      "os": "Android",
      "osVersion": "11",
      "cpu": "Snapdragon",
      "memory": "4GB",
      "disk": "64GB",
      "network": "WiFi",
      "token": "token_abc123",
      "operatingEntityId": "entity_001",
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 2.2 获取设备详情

```http
GET /devices/:id
```

#### 2.3 获取设备连接状态

```http
GET /devices/:id/connection
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "conn_123",
      "deviceId": "device_123",
      "connectedAt": 1704528000000,
      "disconnectedAt": null,
      "clientIp": "192.168.1.100",
      "userAgent": "POS-Client/1.0",
      "status": "connected"
    }
  ]
}
```

#### 2.4 删除设备

```http
DELETE /devices/:id
```

---

### 3. 单元数据分组 (UnitDataGroups)

#### 3.1 获取分组列表

```http
GET /unit-data-groups
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "key": "app_config",
      "name": "应用配置",
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 3.2 创建分组

```http
POST /unit-data-groups
```

**请求体**:
```json
{
  "key": "theme",
  "name": "主题配置"
}
```

#### 3.3 更新分组

```http
PUT /unit-data-groups/:key
```

**请求体**:
```json
{
  "name": "主题配置(更新)"
}
```

#### 3.4 删除分组

```http
DELETE /unit-data-groups/:key
```

**注意**: 级联删除所有相关数据项

---

### 4. 单元数据项 (UnitDataItems)

#### 4.1 获取数据项列表

```http
GET /unit-data-items?group={groupKey}
```

**Query参数**:
- `group` (可选): 分组key,用于过滤

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "item_123",
      "name": "主题颜色",
      "path": "app.theme.color",
      "groupKey": "theme",
      "defaultValue": "{\"primary\": \"blue\"}",
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 4.2 创建数据项

```http
POST /unit-data-items
```

**请求体**:
```json
{
  "name": "字体大小",
  "path": "app.theme.fontSize",
  "groupKey": "theme",
  "defaultValue": "{\"size\": 14}"
}
```

#### 4.3 更新数据项

```http
PUT /unit-data-items/:id
```

#### 4.4 删除数据项

```http
DELETE /unit-data-items/:id
```

---

### 5. 单元数据模板 (Templates)

#### 5.1 获取单元的模板列表

```http
GET /units/:unitId/templates
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "template_123",
      "name": "主题配置模板",
      "unitId": "unit_123",
      "unitType": "entity",
      "valid": true,
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 5.2 创建模板

```http
POST /units/:unitId/templates
```

**请求体**:
```json
{
  "name": "主题配置模板",
  "unitType": "entity",
  "valid": true
}
```

#### 5.3 更新模板

```http
PUT /templates/:id
```

#### 5.4 删除模板

```http
DELETE /templates/:id
```

---

### 6. 单元数据 (UnitData)

#### 6.1 获取模板的数据列表

```http
GET /templates/:templateId/data
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "data_123",
      "name": "主题颜色",
      "path": "app.theme.color",
      "key": "theme_color",
      "templateId": "template_123",
      "groupKey": "theme",
      "unitId": "unit_123",
      "unitType": "entity",
      "value": "{\"primary\": \"red\"}",
      "extra": null,
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 6.2 创建单元数据

```http
POST /templates/:templateId/data
```

**请求体**:
```json
{
  "name": "主题颜色",
  "path": "app.theme.color",
  "key": "theme_color",
  "groupKey": "theme",
  "unitId": "unit_123",
  "unitType": "entity",
  "value": "{\"primary\": \"red\"}",
  "extra": null
}
```

#### 6.3 更新单元数据

```http
PUT /unit-data/:id
```

#### 6.4 删除单元数据

```http
DELETE /unit-data/:id
```

---

### 7. 指令项 (CommandItems)

#### 7.1 获取指令项列表

```http
GET /command-items
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "cmd_item_123",
      "name": "重启应用",
      "type": "system",
      "valid": true,
      "defaultPayload": "{\"action\": \"restart\"}",
      "createdAt": 1704528000000,
      "updatedAt": 1704528000000
    }
  ]
}
```

#### 7.2 创建指令项

```http
POST /command-items
```

**请求体**:
```json
{
  "name": "重启应用",
  "type": "system",
  "valid": true,
  "defaultPayload": "{\"action\": \"restart\"}"
}
```

#### 7.3 更新指令项

```http
PUT /command-items/:id
```

#### 7.4 删除指令项

```http
DELETE /command-items/:id
```

---

### 8. 指令管理 (Commands)

#### 8.1 发送指令到设备

```http
POST /devices/:deviceId/commands
```

**请求体**:
```json
{
  "commandItemId": "cmd_item_123",
  "payload": "{\"action\": \"restart\"}",
  "requestId": "req_123",
  "sessionId": "session_456"
}
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": {
    "command": {
      "id": "cmd_789",
      "commandItemId": "cmd_item_123",
      "type": "system",
      "payload": "{\"action\": \"restart\"}",
      "requestId": "req_123",
      "sessionId": "session_456",
      "createdAt": 1704528000000
    },
    "record": {
      "id": "record_999",
      "commandId": "cmd_789",
      "deviceId": "device_123",
      "requestId": "req_123",
      "sessionId": "session_456",
      "sendAt": 1704528000000,
      "sendResult": true,
      "receiveAt": null,
      "receiveResult": null
    },
    "sent": true
  }
}
```

**sent字段说明**:
- `true`: 指令已通过WebSocket成功推送给设备
- `false`: 设备离线,指令未推送(但已保存记录)

#### 8.2 获取设备的指令记录

```http
GET /devices/:deviceId/command-records
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "record_999",
      "commandId": "cmd_789",
      "deviceId": "device_123",
      "requestId": "req_123",
      "sessionId": "session_456",
      "sendAt": 1704528000000,
      "sendResult": true,
      "receiveAt": 1704528060000,
      "receiveResult": true
    }
  ]
}
```

#### 8.3 删除指令记录

```http
DELETE /command-records/:id
```

**路径参数**:
- `id`: 指令记录ID

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": null
}
```

**说明**: 删除指定的指令记录。此操作不可恢复，请谨慎使用。

---

## 设备 API

设备API需要Token认证,Token通过设备激活获取。

### 1. 设备激活

```http
POST /api/device/activate
```

**请求体**:
```json
{
  "activeCode": "ACT123",
  "device": {
    "id": "device_unique_id",
    "manufacturer": "Sunmi",
    "os": "Android",
    "osVersion": "11",
    "cpu": "Snapdragon",
    "memory": "4GB",
    "disk": "64GB",
    "network": "WiFi"
  }
}
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": {
    "terminal": {
      "id": "terminal_001",
      "name": "收银台1",
      "key": "pos_001",
      "type": "terminal"
    },
    "model": {
      "id": "model_001",
      "name": "Sunmi T2",
      "key": "sunmi_t2",
      "type": "model"
    },
    "hostEntity": {
      "id": "entity_001",
      "name": "分店A",
      "key": "branch_a",
      "type": "entity"
    },
    "token": "token_abc123def456"
  }
}
```

**重要**: 保存返回的token,后续所有设备API调用都需要此token。

---

### 2. 设置操作实体

```http
POST /api/device/operating-entity
Authorization: Bearer {token}
```

**请求体**:
```json
{
  "deviceId": "device_123",
  "operatingEntityId": "entity_002"
}
```

**响应**: 返回更新后的设备信息

**说明**: 设置设备当前操作的业务实体,影响数据同步范围。

---

### 3. 设备解绑

```http
POST /api/device/deactivate
```

**请求体**:
```json
{
  "deviceId": "device_123",
  "deactiveCode": "DEACT123"
}
```

**响应**:
```json
{
  "code": "SUCCESS",
  "data": null
}
```

**注意**: 解绑后token失效,需重新激活。

---

### 4. 确认指令接收

```http
POST /api/command/confirm
Authorization: Bearer {token}
```

**请求体**:
```json
{
  "commandId": "cmd_789"
}
```

**响应**: 返回更新后的指令记录

**说明**: 设备收到WebSocket推送的指令后,调用此接口确认接收。传入的是指令ID(commandId),而不是记录ID。

---

### 5. 获取单元数据

```http
POST /api/unit-data/by-group
Authorization: Bearer {token}
```

**请求体**:
```json
{
  "deviceId": "device_123",
  "group": "theme",
  "data": [
    {
      "id": "data_123",
      "updatedAt": 1704528000000
    },
    {
      "id": "data_456",
      "updatedAt": 1704520000000
    }
  ]
}
```

**响应示例**:
```json
{
  "code": "SUCCESS",
  "data": {
    "updated": [
      {
        "id": "data_456",
        "name": "主题颜色",
        "path": "app.theme.color",
        "key": "theme_color",
        "templateId": "template_123",
        "groupKey": "theme",
        "unitId": "unit_123",
        "unitType": "entity",
        "value": "{\"primary\": \"blue\"}",
        "extra": null,
        "createdAt": 1704528000000,
        "updatedAt": 1704528060000
      }
    ],
    "deleted": ["data_789"]
  }
}
```

**增量同步逻辑**:
1. 客户端发送本地数据的 `id` 和 `updatedAt`
2. 服务器返回:
   - `updated`: 服务器端新增或更新的数据(updatedAt更新的)
   - `deleted`: 服务器端已删除的数据id列表

**数据范围**: 包含Terminal、Model、Entity的rootPath中所有单元的数据

---

## WebSocket 连接

### 建立连接

```
ws://localhost:9999/kernel-server/ws/connect?deviceId={deviceId}&token={token}
```

**Query参数**:
- `deviceId`: 设备ID
- `token`: 设备Token

**连接建立后的消息格式**:

#### 1. 连接成功

```json
{
  "type": "CONNECTED",
  "data": {
    "message": "WebSocket connection established",
    "timestamp": 1704528000000
  }
}
```

#### 2. 心跳消息 (每30秒)

```json
{
  "type": "HEARTBEAT",
  "data": {
    "timestamp": 1704528030000
  }
}
```

#### 3. 单元数据变更推送

```json
{
  "type": "UNIT_DATA_CHANGED",
  "data": {
    "updated": [
      {
        "id": "data_456",
        "name": "主题颜色",
        "path": "app.theme.color",
        "value": "{\"primary\": \"green\"}",
        "updatedAt": 1704528100000
      }
    ],
    "deleted": ["data_789"]
  }
}
```

**处理建议**:
- 收到`updated`数组: 更新或新增本地数据
- 收到`deleted`数组: 删除本地对应id的数据

#### 4. 远程指令推送

```json
{
  "type": "REMOTE_COMMAND",
  "data": {
    "commandId": "cmd_789",
    "commandItemId": "cmd_item_123",
    "commandItemName": "重启应用",
    "type": "system",
    "valid": true,
    "payload": {
      "action": "restart"
    },
    "requestId": "req_123",
    "sessionId": "session_456",
    "createdAt": 1704528000000,
    "updatedAt": 1704528000000
  }
}
```

**字段说明**:
- `commandId`: 指令ID（用于确认接收）
- `commandItemId`: 指令项ID
- `commandItemName`: 指令项名称
- `type`: 指令类型
- `valid`: 指令项是否有效
- `payload`: 指令负载数据（对象格式，而非 JSON 字符串）
- `requestId`: 请求ID（可选，用于追踪请求）
- `sessionId`: 会话ID（可选，用于关联会话）
- `createdAt`: 指令项创建时间
- `updatedAt`: 指令项更新时间

**注意**:
- 不包含 `defaultPayload` 字段
- `payload` 字段为对象格式，终端可以直接使用，无需 JSON.parse()

**处理流程**:
1. 收到指令消息
2. 执行指令
3. 调用 `/api/command/confirm` 确认接收

### WebSocket客户端示例 (JavaScript)

```javascript
const ws = new WebSocket(
  `ws://localhost:9999/kernel-server/ws/connect?deviceId=${deviceId}&token=${token}`
);

ws.onopen = () => {
  console.log('WebSocket连接成功');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'CONNECTED':
      console.log('连接建立:', message.data);
      break;

    case 'HEARTBEAT':
      console.log('心跳:', message.data.timestamp);
      break;

    case 'UNIT_DATA_CHANGED':
      handleDataChange(message.data);
      break;

    case 'REMOTE_COMMAND':
      executeCommand(message.data);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket连接错误:', error);
};

ws.onclose = () => {
  console.log('WebSocket连接关闭');
  // 重连逻辑
};
```

---

## 响应格式

### 成功响应

```json
{
  "code": "SUCCESS",
  "data": { /* 响应数据 */ }
}
```

### 错误响应

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述",
  "data": null
}
```

---

## 错误代码

| 错误码 | 说明 |
|--------|------|
| `SUCCESS` | 请求成功 |
| `INVALID_REQUEST` | 请求参数错误 |
| `NOT_FOUND` | 资源不存在 |
| `DUPLICATE_KEY` | 键值重复 |
| `DEVICE_NOT_FOUND` | 设备不存在 |
| `TERMINAL_NOT_FOUND` | 终端不存在 |
| `INVALID_TOKEN` | Token无效 |
| `INVALID_CODE` | 激活码/解绑码无效 |
| `TERMINAL_ALREADY_BOUND` | 终端已绑定其他设备 |
| `DATABASE_ERROR` | 数据库错误 |
| `INTERNAL_ERROR` | 服务器内部错误 |
| `UNAUTHORIZED` | 未授权 |
| `DEVICE_OFFLINE` | 设备离线(指令发送失败) |

---

## 使用示例

### 完整的设备接入流程

#### 1. 设备激活

```bash
curl -X POST http://localhost:9999/kernel-server/api/device/activate \
  -H "Content-Type: application/json" \
  -d '{
    "activeCode": "ACT123",
    "device": {
      "id": "device_001",
      "manufacturer": "Sunmi",
      "os": "Android",
      "osVersion": "11",
      "cpu": "Snapdragon",
      "memory": "4GB",
      "disk": "64GB",
      "network": "WiFi"
    }
  }'
```

#### 2. 建立WebSocket连接

```javascript
const token = "从激活响应中获取的token";
const deviceId = "device_001";

const ws = new WebSocket(
  `ws://localhost:9999/kernel-server/ws/connect?deviceId=${deviceId}&token=${token}`
);

ws.onopen = () => {
  console.log('WebSocket连接成功');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('收到消息:', message);
};
```

#### 3. 设置操作实体

```bash
curl -X POST http://localhost:9999/kernel-server/api/device/operating-entity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "deviceId": "device_001",
    "operatingEntityId": "entity_002"
  }'
```

#### 4. 同步单元数据

```bash
curl -X POST http://localhost:9999/kernel-server/api/unit-data/by-group \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "deviceId": "device_001",
    "group": "theme",
    "data": []
  }'
```

#### 5. 接收并确认指令

```javascript
// 收到指令推送
eventSource.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'REMOTE_COMMAND') {
    const { commandId, payload } = message.data;

    // 执行指令
    await executeCommand(payload);

    // 确认接收
    await fetch('http://localhost:9999/kernel-server/api/command/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ commandId })
    });
  }
};
```

---

## 注意事项

1. **Token安全**: Token应妥善保存,避免泄露
2. **WebSocket重连**: 网络中断时应实现自动重连机制
3. **心跳监听**: 监听心跳消息,判断连接是否正常
4. **增量同步**: 定期调用数据同步接口,保持数据最新
5. **指令确认**: 收到指令后务必调用确认接口
6. **错误处理**: 根据错误码进行相应处理

---

> 更多信息请参考 [README.md](./README.md) 和 [DEVELOPMENT.md](./DEVELOPMENT.md)
