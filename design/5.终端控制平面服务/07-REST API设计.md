# 07-REST API设计

## 1. API 设计原则

### 1.1 RESTful 规范

- 使用标准 HTTP 方法：GET、POST、PUT、DELETE
- 使用名词复数形式：`/terminals`、`/configs`
- 使用层级结构：`/terminals/{id}/bind`
- 使用查询参数进行过滤：`?status=ACTIVE&storeId=s-001`

### 1.2 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2026-04-06T10:00:00Z"
}
```

### 1.3 错误码定义

| 错误码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |

### 1.4 认证授权

**认证方式**：JWT Token

```http
Authorization: Bearer {accessToken}
```

**权限模型**：基于 RBAC 的权限控制

| 角色 | 说明 | 权限范围 |
|------|------|---------|
| PLATFORM_ADMIN | 平台管理员 | 所有权限 |
| TENANT_ADMIN | 租户管理员 | 租户内管理权限 |
| STORE_MANAGER | 门店管理员 | 门店内管理权限 |
| TERMINAL | 终端设备 | 仅自身相关权限 |

**Token 结构**：

```json
{
  "sub": "pos-001",
  "role": "TERMINAL",
  "permissions": ["terminal:view", "config:view", "version:view"],
  "tenantId": "t-001",
  "storeId": "s-001",
  "exp": 1712400000,
  "iat": 1711795200
}
```

**详细设计**：参见 [13-安全设计.md](./13-安全设计.md)

---

## 2. 终端管理 API

### 2.1 查询终端列表

```http
GET /api/v1/terminals?storeId=s-001&status=ACTIVE&page=1&size=20
```

响应：

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "terminalId": "pos-001",
        "deviceId": "android-001",
        "storeId": "s-001",
        "profileId": "pos-standard",
        "status": "BOUND",
        "connectStatus": "ONLINE",
        "currentAppVersion": "2.3.1",
        "lastSeenAt": "2026-04-06T10:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

### 2.2 查询终端详情

```http
GET /api/v1/terminals/{terminalId}
```

响应：

```json
{
  "code": 200,
  "data": {
    "terminalId": "pos-001",
    "deviceId": "android-001",
    "deviceSn": "SN-001",
    "deviceFingerprint": "fp-xxx",
    "projectId": "mall-001",
    "tenantId": "t-001",
    "storeId": "s-001",
    "profileId": "pos-standard",
    "templateId": "mixc-retail-pos",
    "status": "BOUND",
    "connectStatus": "ONLINE",
    "healthStatus": "HEALTHY",
    "currentAppVersion": "2.3.1",
    "currentConfigVersion": "cfg-001",
    "tags": ["vip-store", "flagship"],
    "capabilities": ["print", "scan"],
    "activatedAt": "2026-04-01T10:00:00Z",
    "lastSeenAt": "2026-04-06T10:00:00Z"
  }
}
```

### 2.3 绑定终端

```http
POST /api/v1/terminals/{terminalId}/bind
Content-Type: application/json

{
  "storeId": "s-001",
  "profileId": "pos-standard",
  "templateId": "mixc-retail-pos"
}
```

### 2.4 换绑终端

```http
POST /api/v1/terminals/{terminalId}/rebind
Content-Type: application/json

{
  "newStoreId": "s-002",
  "newProfileId": "pos-standard",
  "newTemplateId": "mixc-retail-pos",
  "reason": "门店调拨"
}
```

### 2.5 暂停终端

```http
POST /api/v1/terminals/{terminalId}/suspend
Content-Type: application/json

{
  "reason": "设备故障"
}
```

### 2.6 恢复终端

```http
POST /api/v1/terminals/{terminalId}/resume
```

### 2.7 退役终端

```http
POST /api/v1/terminals/{terminalId}/retire
Content-Type: application/json

{
  "reason": "设备报废"
}
```

---

## 3. 激活管理 API

### 3.1 生成激活码批次

```http
POST /api/v1/activation-codes/batches
Content-Type: application/json

{
  "batchName": "2026-04-06批次",
  "count": 100,
  "projectId": "mall-001",
  "tenantId": "t-001",
  "storeId": "s-001",
  "profileId": "pos-standard",
  "templateId": "mixc-retail-pos",
  "maxUseCount": 1,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

### 3.2 激活终端

```http
POST /api/v1/activation/activate
Content-Type: application/json

{
  "activationCode": "ACT-20260406-0001",
  "deviceId": "android-001",
  "deviceSn": "SN-001",
  "deviceFingerprint": "fp-xxx",
  "appVersion": "2.3.1",
  "platform": "android-rn84",
  "capabilities": ["print", "scan"]
}
```

响应：

```json
{
  "code": 200,
  "data": {
    "terminalId": "pos-001",
    "projectId": "mall-001",
    "tenantId": "t-001",
    "storeId": "s-001",
    "profileId": "pos-standard",
    "templateId": "mixc-retail-pos",
    "tcpAccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tcpRefreshToken": "refresh-xxx",
    "tokenExpiresAt": "2026-04-13T10:00:00Z",
    "tdpIdentity": {
      "terminalId": "pos-001",
      "orgScopeId": "store:s-001",
      "profileScopeId": "device-model:pos-standard"
    }
  }
}
```

### 3.3 刷新 Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-xxx"
}
```

---

## 4. 配置管理 API

### 4.1 创建配置版本

```http
POST /api/v1/configs
Content-Type: application/json

{
  "configName": "pos-config",
  "schemaId": "pos-config-schema-v1",
  "projectId": "mall-001",
  "profileId": "pos-standard",
  "configData": {
    "printEnabled": true,
    "scanTimeout": 30000
  }
}
```

### 4.2 查询配置版本列表

```http
GET /api/v1/configs?projectId=mall-001&profileId=pos-standard&status=PUBLISHED
```

### 4.3 创建配置发布

```http
POST /api/v1/config-releases
Content-Type: application/json

{
  "configVersionId": "cfg-001",
  "releaseName": "配置发布-20260406",
  "targetScope": {
    "storeIds": ["s-001", "s-002"],
    "profileIds": ["pos-standard"]
  },
  "grayscaleStrategy": {
    "type": "PERCENTAGE",
    "percentage": 10
  },
  "scheduledAt": "2026-04-06T10:00:00Z"
}
```

### 4.4 执行配置发布

```http
POST /api/v1/config-releases/{releaseId}/execute
```

### 4.5 回滚配置发布

```http
POST /api/v1/config-releases/{releaseId}/rollback
Content-Type: application/json

{
  "reason": "配置错误"
}
```

---

## 5. 版本管理 API

### 5.1 上传热更新包

```http
POST /api/v1/app-packages/upload
Content-Type: multipart/form-data

file: app-bundle-2.3.1.zip
```

响应：

```json
{
  "code": 200,
  "data": {
    "packageUrl": "https://oss.example.com/app-packages/bundle-2.3.1.zip",
    "packageHash": "sha256-xxx",
    "packageSize": 10485760
  }
}
```

### 5.2 创建应用版本

```http
POST /api/v1/app-versions
Content-Type: application/json

{
  "appName": "mixc-retail-pos",
  "version": "2.3.1",
  "bundleVersion": "2026.04.06.001",
  "platform": "android-rn84",
  "profileId": "pos-standard",
  "packageUrl": "https://oss.example.com/app-packages/bundle-2.3.1.zip",
  "packageHash": "sha256-xxx",
  "packageSize": 10485760,
  "versionType": "HOT_UPDATE",
  "changeLog": ["修复支付模块崩溃问题", "优化打印性能"],
  "forceUpdate": false,
  "minCompatibleVersion": "2.3.0"
}
```

### 5.3 查询应用版本列表

```http
GET /api/v1/app-versions?platform=android-rn84&profileId=pos-standard&status=PUBLISHED
```

### 5.4 创建升级发布

```http
POST /api/v1/upgrade-releases
Content-Type: application/json

{
  "versionId": "ver-001",
  "releaseName": "版本升级-2.3.1",
  "targetScope": {
    "storeIds": ["s-001", "s-002"],
    "profileIds": ["pos-standard"]
  },
  "grayscaleStrategy": {
    "type": "PERCENTAGE",
    "percentage": 10
  },
  "scheduledAt": "2026-04-06T10:00:00Z"
}
```

### 5.5 执行升级发布

```http
POST /api/v1/upgrade-releases/{releaseId}/execute
```

### 5.6 回滚升级发布

```http
POST /api/v1/upgrade-releases/{releaseId}/rollback
Content-Type: application/json

{
  "reason": "版本不稳定"
}
```

---

## 6. 远程控制 API

### 6.1 创建控制任务

```http
POST /api/v1/control-tasks
Content-Type: application/json

{
  "taskName": "重启所有 POS 终端",
  "command": "RESTART",
  "targetScope": {
    "storeIds": ["s-001"],
    "profileIds": ["pos-standard"]
  },
  "parameters": {
    "delay": 60000
  },
  "scheduledAt": "2026-04-06T10:00:00Z"
}
```

### 6.2 查询任务列表

```http
GET /api/v1/control-tasks?command=RESTART&status=IN_PROGRESS
```

### 6.3 查询任务详情

```http
GET /api/v1/control-tasks/{taskId}
```

响应：

```json
{
  "code": 200,
  "data": {
    "taskId": "task-001",
    "taskName": "重启所有 POS 终端",
    "command": "RESTART",
    "status": "IN_PROGRESS",
    "totalCount": 10,
    "successCount": 8,
    "failedCount": 1,
    "pendingCount": 1,
    "startedAt": "2026-04-06T10:00:00Z"
  }
}
```

### 6.4 回报任务执行结果

```http
POST /api/v1/control-tasks/results
Content-Type: application/json

{
  "taskId": "task-001",
  "terminalId": "pos-001",
  "status": "SUCCESS",
  "executedAt": "2026-04-06T10:05:00Z",
  "result": {
    "restartedAt": "2026-04-06T10:05:00Z",
    "uptime": 120
  }
}
```

---

## 7. 设备能力模板 API

### 7.1 创建设备能力模板

```http
POST /api/v1/device-profiles
Content-Type: application/json

{
  "profileName": "标准 POS 终端",
  "profileCode": "pos-standard",
  "deviceCategory": "POS",
  "deviceModel": "Sunmi T2",
  "platform": "android-rn84",
  "capabilities": ["print", "scan", "dual-screen"],
  "allowedRemoteCommands": ["RESTART", "LOG_UPLOAD", "FORCE_SYNC"],
  "supportedUpgradeModes": ["FULL_PACKAGE", "HOT_UPDATE"],
  "configSchemaSetId": "pos-config-schema-v1"
}
```

### 7.2 查询设备能力模板列表

```http
GET /api/v1/device-profiles?deviceCategory=POS&status=ACTIVE
```

---

## 8. 审计日志 API

### 8.1 查询审计日志

```http
GET /api/v1/audit-logs?taskId=task-001&operator=admin&startTime=2026-04-01T00:00:00Z&endTime=2026-04-06T23:59:59Z
```

响应：

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "auditId": "audit-001",
        "taskId": "task-001",
        "terminalId": "pos-001",
        "command": "RESTART",
        "operator": "admin",
        "operatedAt": "2026-04-06T10:00:00Z",
        "parameters": {"delay": 60000},
        "result": {"restartedAt": "2026-04-06T10:05:00Z"}
      }
    ],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

---

## 9. 本文结论

REST API 设计展示了完整的接口实现：

- **终端管理**：查询、绑定、换绑、暂停、恢复、退役
- **激活管理**：生成激活码、激活终端、刷新 Token
- **配置管理**：创建配置、发布配置、回滚配置
- **版本管理**：上传更新包、创建版本、发布升级、回滚升级
- **远程控制**：创建任务、查询任务、回报结果
- **设备模板**：创建模板、查询模板
- **审计日志**：查询审计记录

所有 API 遵循 RESTful 规范，使用统一的响应格式和错误码。

---

*上一篇：[06-数据模型与存储设计](./06-数据模型与存储设计.md)*
*下一篇：[08-与TDP协同设计](./08-与TDP协同设计.md)*
