# Mock Terminal Platform API 文档

本文档基于当前真实实现梳理，不是概念草案。

## 通用返回格式

成功：

```json
{
  "success": true,
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "error": {
    "message": "错误信息",
    "details": {}
  }
}
```

---

## 1. 平台与审计

### `GET /api/v1/admin/overview`
- 平台总览统计
- 返回：终端、任务、Session、Topic、Fault 统计

### `GET /api/v1/admin/sandboxes`
- 查询沙箱列表

### `GET /api/v1/admin/audit-logs?page=&pageSize=`
- 查询审计日志分页
- 参数：
  - `page`：页码，默认 1
  - `pageSize`：每页条数，默认 20，最大 100

---

## 2. 导入导出与模板库

### `GET /api/v1/admin/export`
- 获取全量导出 JSON 对象

### `GET /api/v1/admin/export/download`
- 下载全量导出文件
- 返回附件：`mock-terminal-platform-export.json`

### `GET /api/v1/admin/templates/topic-library`
- 获取 Topic 模板库

### `GET /api/v1/admin/templates/fault-library`
- 获取 Fault 模板库

### `POST /api/v1/admin/import/templates/validate`
- 导入模板预检
- 请求体：

```json
{
  "topics": [
    {
      "key": "terminal.debug.flag",
      "name": "终端调试标记",
      "scopeType": "TERMINAL",
      "schema": {"type": "object"}
    }
  ],
  "faultRules": [
    {
      "name": "配置延迟模板",
      "targetType": "TDP_DELIVERY",
      "matcher": {"taskType": "CONFIG_PUBLISH"},
      "action": {"type": "DELAY", "durationMs": 3000}
    }
  ]
}
```

### `POST /api/v1/admin/import/templates`
- 导入 Topic / Fault 模板
- 请求体同预检接口

---

## 3. TCP 管理接口

### `GET /api/v1/admin/terminals`
- 查询终端列表

### `GET /api/v1/admin/profiles`
- 查询终端 Profile 列表

### `GET /api/v1/admin/templates`
- 查询终端 Template 列表

### `GET /api/v1/admin/activation-codes`
- 查询激活码列表

### `POST /api/v1/admin/activation-codes/batch`
- 批量生成激活码
- 请求体：

```json
{
  "count": 5
}
```

### `POST /api/v1/terminals/activate`
- 模拟终端激活
- 请求体：

```json
{
  "activationCode": "ACT-XXXX",
  "deviceFingerprint": "mock-fingerprint",
  "deviceInfo": {
    "model": "Mock-POS-X1",
    "osVersion": "Android 14",
    "manufacturer": "IMPOS2"
  }
}
```

### `POST /api/v1/terminals/token/refresh`
- 刷新终端 token

### `GET /api/v1/admin/tasks/releases`
- 查询任务发布单列表

### `GET /api/v1/admin/tasks/instances`
- 查询任务实例列表

### `GET /api/v1/admin/tasks/instances/:instanceId/trace`
- 查询任务实例完整链路
- 返回：
  - 实例数据
  - 发布单数据
  - TDP Projection / Change Log 链路

### `POST /api/v1/admin/tasks/releases`
- 创建任务发布单并自动分发到 TDP
- 请求体：

```json
{
  "title": "控制台-配置下发",
  "taskType": "CONFIG_PUBLISH",
  "sourceType": "CONFIG",
  "sourceId": "config-2026.04.06",
  "priority": 70,
  "targetTerminalIds": ["T-1001", "T-1002"],
  "payload": {
    "configVersion": "config-2026.04.06",
    "mode": "delta"
  }
}
```

### `POST /api/v1/terminals/:terminalId/tasks/:instanceId/result`
- 上报任务执行结果

### `POST /internal/data-plane/tasks/delivery-status`
- TDP 回写投递状态

### `POST /internal/control-plane/tasks/dispatch`
- 手动触发任务委托到 TDP

---

## 4. TDP 管理接口

### `GET /api/v1/admin/tdp/sessions`
- 查询 Session 列表

### `POST /api/v1/tdp/sessions/connect`
- 建立 Session
- 请求体：

```json
{
  "terminalId": "T-1001",
  "clientVersion": "2.4.0-dev",
  "protocolVersion": "tdp-1.0"
}
```

### `POST /api/v1/tdp/sessions/:sessionId/heartbeat`
- 发送心跳

### `POST /api/v1/tdp/sessions/:sessionId/disconnect`
- 断开 Session

### `GET /api/v1/admin/tdp/topics`
- 查询 Topic 列表

### `POST /api/v1/admin/tdp/topics`
- 创建 Topic

### `GET /api/v1/admin/tdp/scopes`
- 查询 Scope 统计

### `POST /api/v1/admin/tdp/projections/upsert`
- 注入 / 更新 Projection
- 请求体：

```json
{
  "topicKey": "terminal.runtime.config",
  "scopeType": "TERMINAL",
  "scopeKey": "T-1001",
  "payload": {
    "desiredVersion": "2.4.0"
  }
}
```

### `GET /api/v1/admin/tdp/projections`
- 查询 Projection 列表

### `GET /api/v1/admin/tdp/change-logs`
- 查询 Change Log 列表

### `GET /api/v1/tdp/terminals/:terminalId/snapshot`
- 查询终端维度 snapshot

### `GET /api/v1/tdp/terminals/:terminalId/changes`
- 查询终端维度 changes

---

## 5. 场景与故障接口

### `GET /mock-admin/scenes/templates`
- 查询场景模板库

### `POST /mock-admin/scenes/:sceneTemplateId/run`
- 运行场景模板

### `POST /mock-admin/terminals/batch-create`
- 批量造终端

### `POST /mock-admin/terminals/:terminalId/force-status`
- 强制修改终端状态

### `GET /mock-admin/fault-rules`
- 查询故障规则列表

### `POST /mock-admin/fault-rules`
- 新增故障规则

### `PUT /mock-admin/fault-rules/:faultRuleId`
- 更新故障规则

### `POST /mock-admin/fault-rules/:faultRuleId/hit`
- 模拟故障规则命中

### `POST /mock-debug/tasks/:instanceId/mock-result`
- 给任务实例写入伪结果
