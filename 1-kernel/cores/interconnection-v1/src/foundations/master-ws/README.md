# DualWebSocketClient 使用指南

对接 `master-ws-server-dual` 的 1:1 配对、双向转发 WebSocket 客户端。

## 与老客户端的核心差异

| 维度 | 老客户端 (MasterWebSocketClient) | 新客户端 (DualWebSocketClient) |
|------|--------------------------------|-------------------------------|
| 配对模式 | 1:N（master 对多个 slave） | 1:1（master 与 slave 一对一绑定） |
| 消息路由 | 需指定 `targetDevice` | 服务端自动转发到对端，无需指定目标 |
| 设备标识 | `deviceId` + `deviceName` | 仅 `deviceId` |
| 心跳机制 | 客户端主动发心跳 | 服务端发心跳，客户端被动响应 ACK |
| 文件结构 | 4 文件（Client/Connection/Event/Heartbeat） | 单文件内聚 |
| 状态机 | 含 `ERROR` 中间状态 | 无 `ERROR` 状态，失败直接回 `DISCONNECTED` |
| master 注册 | 无额外配置 | 可传入 `runtimeConfig`（心跳/超时参数） |

## 连接流程

```
HTTP POST /register (注册设备，获取 token)
        ↓
WebSocket /ws?token=<TOKEN> (用 token 建立连接)
        ↓
服务端发送 HEARTBEAT → 客户端自动回复 HEARTBEAT_ACK
        ↓
双向收发业务消息（服务端自动转发到对端）
```

## 基本使用

### Master 设备

```typescript
import {
  DualWebSocketClient,
  ConnectionEventType,
  SYSTEM_NOTIFICATION,
} from '@impos2/kernel-core-interconnection-v1';
import {InstanceMode} from '@impos2/kernel-core-interconnection-v1';

const client = DualWebSocketClient.getInstance();

// 监听事件
client.on(ConnectionEventType.CONNECTED, (e: ConnectedEvent) => {
  console.log('已连接:', e.serverUrl);
});

client.on(ConnectionEventType.MESSAGE, (e: WSMessageEvent) => {
  const {message} = e;
  if (message.type === SYSTEM_NOTIFICATION.SLAVE_CONNECTED) {
    console.log('Slave 已连接:', message.data.deviceId);
  } else if (message.type === SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED) {
    console.log('Slave 已断开:', message.data.reason);
  } else {
    console.log('业务消息:', message.type, message.data);
  }
});

client.on(ConnectionEventType.DISCONNECTED, (e: DisconnectedEvent) => {
  console.log('已断开:', e.reason);
});

// 连接
await client.connect({
  deviceRegistration: {
    type: InstanceMode.master,
    deviceId: 'master-001',
    // master 可选传入运行时配置
    runtimeConfig: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 60000,
      retryCacheTimeout: 30000,
    },
  },
  serverUrls: ['http://localhost:8080/api'],
});

// 发送消息（自动转发到配对的 slave）
client.sendMessage('ORDER_CREATED', {orderId: '12345', amount: 100});
```

### Slave 设备

```typescript
const client = DualWebSocketClient.getInstance();

await client.connect({
  deviceRegistration: {
    type: InstanceMode.slave,
    deviceId: 'slave-001',
    masterDeviceId: 'master-001', // 必须指定要配对的 master
  },
  serverUrls: ['http://localhost:8080/api'],
});

// 发送消息（自动转发到配对的 master）
client.sendMessage('SYNC_DATA', {key: 'cart', value: [...]});
```

## 配置项

```typescript
interface DualClientConfig {
  deviceRegistration: DeviceRegistration;
  serverUrls: string[];          // 服务器地址列表，按顺序 failover
  connectionTimeout?: number;    // 连接超时，默认 10000ms
  heartbeatTimeout?: number;     // 心跳超时，默认 60000ms
  maxQueueSize?: number;         // 消息队列上限，默认 100
}
```

## 状态流转

```
DISCONNECTED → REGISTERING → CONNECTING → CONNECTED
     ↑              |              |            |
     |              v              v            v
     +←←←←←←←←←←←←+←←←←←←←←←←←←+      DISCONNECTING
                                                |
                                                v
                                          DISCONNECTED
```

- 连接失败：直接回 `DISCONNECTED`，无中间 `ERROR` 状态
- 主动断开：`DISCONNECTING` → cleanup → `DISCONNECTED`
- 被动断开（服务端关闭/网络中断）：cleanup → `DISCONNECTED`

## 事件类型

| 事件 | 触发时机 | 回调参数 |
|------|---------|---------|
| `STATE_CHANGE` | 任何状态变更 | `StateChangeEvent` |
| `CONNECTED` | 连接成功 | `ConnectedEvent` |
| `CONNECT_FAILED` | 连接失败 | `ConnectFailedEvent` |
| `DISCONNECTED` | 连接断开 | `DisconnectedEvent` |
| `MESSAGE` | 收到业务消息 | `WSMessageEvent` |
| `ERROR` | WebSocket 错误 | `WSErrorEvent` |
| `HEARTBEAT_TIMEOUT` | 心跳超时 | `WSErrorEvent` |

## 内置机制

- **心跳**：服务端定时发 `HEARTBEAT`，客户端自动回复 `HEARTBEAT_ACK`，超时未收到心跳则触发断开
- **去重**：LRU + TTL 双策略，自动过滤重复消息（5 分钟 TTL，上限 1000 条）
- **消息队列**：`REGISTERING`/`CONNECTING` 状态下调用 `sendMessage` 会排队，连接成功后自动 flush
- **failover**：多 server 按顺序尝试，每次失败自动清理 ws 资源后尝试下一个
- **自动断开**：`CONNECT_FAILED`、`ERROR`、`HEARTBEAT_TIMEOUT` 事件内部自动调用 `disconnect()`

## 注意事项

1. 单例模式，`getInstance()` 全局共享
2. Slave 连接前，对应 Master 必须已连接到服务端
3. 1:1 配对，一个 master 只能绑定一个 slave
4. 组件销毁时调用 `off()` 注销监听，避免内存泄漏
5. 完全销毁用 `destroy()`，之后需重新 `getInstance()` 获取新实例
