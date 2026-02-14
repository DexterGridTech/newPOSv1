# Master-Slave WebSocket 测试服务器

基于 WebSocket 的 Master-Slave 设备通信测试服务器。

## 功能特性

- ✅ Master 设备和 Slave 设备管理
- ✅ HTTP 注册 + WebSocket 连接的两阶段认证
- ✅ Token 认证机制
- ✅ 设备注册与连接状态管理
- ✅ Master 和 Slave 设备双向通信
- ✅ Slave 设备连接/断开通知
- ✅ Master 断开时自动断开关联的 Slave 设备
- ✅ 心跳检测机制
- ✅ 日志管理系统
- ✅ 可配置的服务器参数
- ✅ 消息封装与类型化
- ✅ 完整的 TypeScript 类型定义

## 服务器地址

```
HTTP注册: http://localhost:8888/mockMasterServer/register
WebSocket: ws://localhost:8888/mockMasterServer/ws?token=<TOKEN>
健康检查: http://localhost:8888/mockMasterServer/health
统计信息: http://localhost:8888/mockMasterServer/stats
```

## 安装依赖

```bash
npm install --no-audit
```

## 使用方法

### 开发模式运行

```bash
npm run dev
```

### 编译

```bash
npm run build
```

### 生产模式运行

```bash
npm start
```

### 自定义配置

```typescript
import { MasterSlaveWebSocketServer } from '@impos2/master-ws-server';

const server = new MasterSlaveWebSocketServer({
  port: 8888,
  basePath: '/mockMasterServer',
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
  heartbeatInterval: 30000, // 心跳间隔 30秒
  heartbeatTimeout: 60000, // 心跳超时 60秒
  tokenExpireTime: 300000, // Token过期时间 5分钟
  cleanupInterval: 60000, // 清理间隔 1分钟
});
```

## 消息协议

所有消息使用 `MessageWrapper` 封装:

```typescript
interface MessageWrapper {
  from: string;      // 发送者设备名称
  id: string;        // 消息ID
  type: string;      // 消息类型
  content: string;   // 消息内容(JSON字符串)
  targetDevice?: string;  // 目标设备名称(可选,用于Master向指定Slave发送消息)
}
```

## 连接流程

### 1. Master 设备注册

#### 步骤1: HTTP 注册

发送 POST 请求到 `http://localhost:8888/mockMasterServer/register`:

```json
{
  "type": "master",
  "deviceId": "master-001",
  "deviceName": "master-device-1"
}
```

**成功响应:**

```json
{
  "success": true,
  "token": "generated-token-string",
  "deviceInfo": {
    "deviceType": "master",
    "deviceId": "master-001",
    "deviceName": "master-device-1"
  }
}
```

#### 步骤2: WebSocket 连接

使用获取的 token 连接 WebSocket:

```
ws://localhost:8888/mockMasterServer/ws?token=generated-token-string
```

### 2. Slave 设备注册

#### 步骤1: HTTP 注册

发送 POST 请求到注册接口:

```json
{
  "type": "slave",
  "deviceId": "slave-001",
  "deviceName": "slave-device-1",
  "masterDeviceId": "master-001"
}
```

**注意:** Slave 注册时 Master 设备必须已经连接

#### 步骤2: WebSocket 连接

使用获取的 token 连接 WebSocket

连接成功后,Master 设备会收到 Slave 连接通知:

```json
{
  "from": "__system",
  "id": "notification-id",
  "type": "__system_slave_connected",
  "content": "{\"deviceId\":\"slave-001\",\"deviceName\":\"slave-device-1\",\"connectedAt\":\"2025-12-27T...\"}"
}
```

## 消息通信

### Slave 发送消息给 Master

Slave 设备发送消息,服务器会自动转发给关联的 Master 设备:

```json
{
  "from": "slave-device-1",
  "id": "msg-id",
  "type": "business_message",
  "content": "{\"action\":\"updateStatus\",\"data\":{...}}"
}
```

### Master 广播消息给所有 Slave

Master 设备发送消息(不指定 `targetDevice`),服务器会广播给所有关联的 Slave 设备:

```json
{
  "from": "master-device-1",
  "id": "msg-id",
  "type": "broadcast_message",
  "content": "{\"action\":\"syncData\",\"data\":{...}}"
}
```

### Master 发送消息给指定 Slave

Master 设备发送消息时指定 `targetDevice` 字段,服务器会只发送给指定的 Slave 设备:

```json
{
  "from": "master-device-1",
  "id": "msg-id",
  "type": "targeted_message",
  "content": "{\"action\":\"updateConfig\",\"data\":{...}}",
  "targetDevice": "slave-device-1"
}
```

**注意事项:**
- `targetDevice` 必须是有效的 Slave 设备名称(deviceName)
- 该 Slave 设备必须属于该 Master 设备
- 如果指定的 Slave 不存在或不属于该 Master,消息将被丢弃并记录日志

## 断开连接

### Slave 设备断开

- Slave 主动断开或异常断线时,Master 设备会收到通知:

```json
{
  "from": "__system",
  "id": "notification-id",
  "type": "__system_slave_disconnected",
  "content": "{\"deviceId\":\"slave-001\",\"deviceName\":\"slave-device-1\",\"disconnectedAt\":\"2025-12-27T...\"}"
}
```

### Master 设备断开

- Master 断开时,所有关联的 Slave 设备会被自动断开连接

## 心跳机制

服务器会定期向所有连接的设备发送心跳消息:

```json
{
  "from": "__system",
  "id": "heartbeat-id",
  "type": "__system_heartbeat",
  "content": "{\"timestamp\":1703665200000}"
}
```

客户端应响应心跳:

```json
{
  "from": "device-name",
  "id": "response-id",
  "type": "__system_heartbeat_ack",
  "content": "{\"timestamp\":1703665200000}"
}
```

如果设备在超时时间内未响应心跳,连接将被自动断开。

默认配置:
- 心跳间隔: 30秒
- 心跳超时: 60秒

## 错误处理

### HTTP 注册错误

```json
{
  "success": false,
  "error": "Error message description"
}
```

常见错误:
- `Missing required fields`: 缺少必需字段
- `Invalid device type`: 设备类型无效
- `Device name already exists`: 设备名称已存在
- `Master device not connected`: Master设备未连接(Slave注册时)

### WebSocket 连接错误

- 无效或过期的 token 将导致连接被拒绝
- 设备名称冲突会导致连接失败

## 架构设计

```
src/
├── master.ts                          # 服务器入口
├── MasterSlaveWebSocketServer.ts     # WebSocket服务器核心实现
├── DeviceConnectionManager.ts        # 设备连接管理器
├── Logger.ts                         # 日志管理器
├── config.ts                         # 配置管理
└── types.ts                          # 类型定义
```

## 系统通知类型

服务器内部使用的系统通知类型:

- `__system_slave_connected`: Slave设备连接通知
- `__system_slave_disconnected`: Slave设备断开通知
- `__system_heartbeat`: 心跳检测
- `__system_heartbeat_ack`: 心跳响应

## 注意事项

1. HTTP 注册必须先于 WebSocket 连接
2. Token 有效期为 5 分钟(可配置)
3. Master 设备必须先于 Slave 设备连接
4. Slave 设备注册时必须提供有效的 masterDeviceId
5. 设备名称必须唯一
6. Master 断开连接会导致所有关联的 Slave 设备自动断开
7. 所有消息的 content 字段都是 JSON 字符串,需要进行序列化/反序列化
8. 客户端应正确响应心跳消息以保持连接
9. 支持 CORS,可跨域访问 HTTP 接口
