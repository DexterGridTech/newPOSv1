# WebSocket 客户端使用指南

通用的 WebSocket 客户端,支持连接 Master-Slave WebSocket 服务器,适用于 Master 和 Slave 设备。

## 功能特性

- ✅ 单例模式,全局共享实例
- ✅ 支持多服务器地址,自动故障转移
- ✅ HTTP 注册 + WebSocket 连接的两阶段认证
- ✅ 自动心跳检测和响应
- ✅ 完整的事件回调系统
- ✅ 消息队列管理
- ✅ 类型安全的 TypeScript 支持
- ✅ 自动内存清理
- ✅ 详细的错误处理

## 基本使用

### Master 设备连接

```typescript
import { WebSocketClient, DeviceType, ConnectionEventType } from '@impos2/core-base/foundations/ws';

// 获取客户端实例
const wsClient = WebSocketClient.getInstance();

// 注册事件回调
wsClient.on(ConnectionEventType.CONNECTED, (event) => {
  console.log('连接成功:', event.serverUrl);
});

wsClient.on(ConnectionEventType.MESSAGE, (event) => {
  console.log('收到消息:', event.message);
});

wsClient.on(ConnectionEventType.DISCONNECTED, (event) => {
  console.log('连接断开:', event.reason);
});

wsClient.on(ConnectionEventType.CONNECT_FAILED, (event) => {
  console.error('连接失败:', event.error);
});

// 连接配置
const config = {
  deviceRegistration: {
    type: DeviceType.MASTER,
    deviceId: 'master-001',
    deviceName: 'master-device-1',
  },
  serverUrls: [
    'http://localhost:8888/mockMasterServer',
    'http://192.168.1.100:8888/mockMasterServer',
  ],
  connectionTimeout: 10000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  autoHeartbeatResponse: true,
};

// 连接服务器
try {
  await wsClient.connect(config);
  console.log('连接成功');
} catch (error) {
  console.error('连接失败:', error);
}
```

### Slave 设备连接

```typescript
import { WebSocketClient, DeviceType } from '@impos2/core-base/foundations/ws';

const wsClient = WebSocketClient.getInstance();

const config = {
  deviceRegistration: {
    type: DeviceType.SLAVE,
    deviceId: 'slave-001',
    deviceName: 'slave-device-1',
    masterDeviceId: 'master-001', // 必须指定 Master 设备 ID
  },
  serverUrls: [
    'http://localhost:8888/mockMasterServer',
  ],
};

await wsClient.connect(config);
```

## 发送消息

### 基本发送

```typescript
// 发送业务消息
await wsClient.sendMessage('ORDER_CREATED', {
  orderId: '12345',
  amount: 100.00,
  items: ['item1', 'item2'],
});

// content 会自动 JSON 序列化
await wsClient.sendMessage('SYNC_DATA', {
  timestamp: Date.now(),
  data: {...},
});
```

### 等待连接后发送

```typescript
// 如果未连接,消息会加入队列,连接成功后自动发送
await wsClient.sendMessage('DELAYED_MESSAGE', {
  content: 'This will be sent after connection',
}, {
  waitForConnection: true,
});
```

## 事件监听

### 所有事件类型

```typescript
import { ConnectionEventType } from '@impos2/core-base/foundations/ws';

// 状态变更
wsClient.on(ConnectionEventType.STATE_CHANGE, (event) => {
  console.log(`状态变更: ${event.oldState} -> ${event.newState}`);
});

// 连接成功
wsClient.on(ConnectionEventType.CONNECTED, (event) => {
  console.log('连接成功:', event.serverUrl, event.deviceInfo);
});

// 连接失败
wsClient.on(ConnectionEventType.CONNECT_FAILED, (event) => {
  console.error('连接失败:', event.error.type, event.error.message);
});

// 断开连接
wsClient.on(ConnectionEventType.DISCONNECTED, (event) => {
  console.log('断开连接:', event.wasClean ? '正常' : '异常', event.reason);
});

// 收到消息
wsClient.on(ConnectionEventType.MESSAGE, (event) => {
  const { message } = event;
  console.log('收到消息:', message.type, message.from);

  // 解析 content
  const content = JSON.parse(message.content);
  console.log('消息内容:', content);
});

// 发生错误
wsClient.on(ConnectionEventType.ERROR, (event) => {
  console.error('错误:', event.error);
});

// 心跳超时
wsClient.on(ConnectionEventType.HEARTBEAT_TIMEOUT, () => {
  console.warn('心跳超时');
});
```

### 注销事件监听

```typescript
const handleMessage = (event) => {
  console.log('消息:', event.message);
};

// 注册
wsClient.on(ConnectionEventType.MESSAGE, handleMessage);

// 注销
wsClient.off(ConnectionEventType.MESSAGE, handleMessage);
```

## 连接状态

### 检查连接状态

```typescript
import { ConnectionState } from '@impos2/core-base/foundations/ws';

// 获取当前状态
const state = wsClient.getState();

switch (state) {
  case ConnectionState.DISCONNECTED:
    console.log('未连接');
    break;
  case ConnectionState.REGISTERING:
    console.log('注册中');
    break;
  case ConnectionState.CONNECTING:
    console.log('连接中');
    break;
  case ConnectionState.CONNECTED:
    console.log('已连接');
    break;
  case ConnectionState.DISCONNECTING:
    console.log('断开中');
    break;
  case ConnectionState.ERROR:
    console.log('错误');
    break;
}

// 简单判断是否已连接
if (wsClient.isConnected()) {
  console.log('当前已连接');
}
```

## 断开连接

```typescript
// 主动断开连接
wsClient.disconnect('用户主动断开');

// 或不传原因
wsClient.disconnect();
```

## 销毁实例

```typescript
// 完全销毁客户端实例,释放所有资源
wsClient.destroy();

// 销毁后需要重新获取实例
const newClient = WebSocketClient.getInstance();
```

## 错误处理

### 错误类型

```typescript
import { ConnectionErrorType } from '@impos2/core-base/foundations/ws';

wsClient.on(ConnectionEventType.CONNECT_FAILED, (event) => {
  const { error } = event;

  switch (error.type) {
    case ConnectionErrorType.REGISTRATION_FAILED:
      console.error('HTTP注册失败:', error.message);
      break;
    case ConnectionErrorType.WEBSOCKET_FAILED:
      console.error('WebSocket连接失败:', error.message);
      break;
    case ConnectionErrorType.ALL_SERVERS_FAILED:
      console.error('所有服务器都连接失败');
      break;
    case ConnectionErrorType.HEARTBEAT_TIMEOUT:
      console.error('心跳超时');
      break;
    case ConnectionErrorType.CONNECTION_TIMEOUT:
      console.error('连接超时:', error.message);
      break;
    case ConnectionErrorType.NETWORK_ERROR:
      console.error('网络错误');
      break;
    default:
      console.error('未知错误:', error.message);
  }
});
```

## 配置选项

### 完整配置

```typescript
interface WebSocketClientConfig {
  /** 设备注册信息 */
  deviceRegistration: {
    type: DeviceType.MASTER | DeviceType.SLAVE;
    deviceId: string;
    deviceName: string;
    masterDeviceId?: string; // Slave 设备必需
  };

  /** 服务器地址列表 (HTTP注册地址) */
  serverUrls: string[];

  /** 连接超时时间 (毫秒) - 默认 10000 */
  connectionTimeout?: number;

  /** 心跳间隔 (毫秒) - 默认 30000 */
  heartbeatInterval?: number;

  /** 心跳超时 (毫秒) - 默认 60000 */
  heartbeatTimeout?: number;

  /** 是否自动发送心跳响应 - 默认 true */
  autoHeartbeatResponse?: boolean;

  /** 消息队列最大长度 - 默认 100 */
  maxQueueSize?: number;
}
```

## 系统消息

客户端会自动处理以下系统消息:

```typescript
import { SYSTEM_MESSAGE_TYPES } from '@impos2/core-base/foundations/ws';

// 心跳检测 (自动处理,不会触发 MESSAGE 事件)
SYSTEM_MESSAGE_TYPES.HEARTBEAT

// 心跳响应 (自动发送)
SYSTEM_MESSAGE_TYPES.HEARTBEAT_ACK

// Slave 连接通知 (仅 Master 接收)
SYSTEM_MESSAGE_TYPES.SLAVE_CONNECTED

// Slave 断开通知 (仅 Master 接收)
SYSTEM_MESSAGE_TYPES.SLAVE_DISCONNECTED
```

Master 设备接收 Slave 连接/断开通知:

```typescript
wsClient.on(ConnectionEventType.MESSAGE, (event) => {
  const { message } = event;

  if (message.type === SYSTEM_MESSAGE_TYPES.SLAVE_CONNECTED) {
    const slaveInfo = JSON.parse(message.content);
    console.log('Slave 设备已连接:', slaveInfo.deviceName);
  }

  if (message.type === SYSTEM_MESSAGE_TYPES.SLAVE_DISCONNECTED) {
    const slaveInfo = JSON.parse(message.content);
    console.log('Slave 设备已断开:', slaveInfo.deviceName);
  }
});
```

## 最佳实践

### 1. 重连逻辑

```typescript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

wsClient.on(ConnectionEventType.DISCONNECTED, async (event) => {
  if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`尝试重连 (${reconnectAttempts}/${maxReconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await wsClient.connect(config);
        reconnectAttempts = 0; // 重置计数
      } catch (error) {
        console.error('重连失败:', error);
      }
    }, 3000 * reconnectAttempts); // 递增延迟
  }
});

wsClient.on(ConnectionEventType.CONNECTED, () => {
  reconnectAttempts = 0; // 连接成功,重置计数
});
```

### 2. 消息去重

```typescript
const processedMessageIds = new Set<string>();

wsClient.on(ConnectionEventType.MESSAGE, (event) => {
  const { message } = event;

  // 检查消息是否已处理
  if (processedMessageIds.has(message.id)) {
    console.log('重复消息,跳过:', message.id);
    return;
  }

  // 标记为已处理
  processedMessageIds.add(message.id);

  // 定期清理旧消息ID (保留最近1000条)
  if (processedMessageIds.size > 1000) {
    const oldestIds = Array.from(processedMessageIds).slice(0, 500);
    oldestIds.forEach(id => processedMessageIds.delete(id));
  }

  // 处理消息
  handleMessage(message);
});
```

### 3. 类型安全的消息处理

```typescript
// 定义消息类型
enum MessageType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  SYNC_DATA = 'SYNC_DATA',
}

interface OrderCreatedPayload {
  orderId: string;
  amount: number;
  items: string[];
}

// 类型安全的消息发送
async function sendOrderCreated(payload: OrderCreatedPayload) {
  await wsClient.sendMessage(MessageType.ORDER_CREATED, payload);
}

// 类型安全的消息处理
wsClient.on(ConnectionEventType.MESSAGE, (event) => {
  const { message } = event;

  switch (message.type) {
    case MessageType.ORDER_CREATED: {
      const payload: OrderCreatedPayload = JSON.parse(message.content);
      handleOrderCreated(payload);
      break;
    }
    case MessageType.ORDER_UPDATED: {
      // ...
      break;
    }
  }
});
```

## 注意事项

1. **单例模式**: 全局只有一个实例,多次调用 `getInstance()` 返回同一个实例
2. **内存管理**: 确保在不需要时调用 `disconnect()` 或 `destroy()` 释放资源
3. **事件清理**: 组件销毁时记得注销事件监听,避免内存泄漏
4. **错误处理**: 始终注册 `CONNECT_FAILED` 和 `ERROR` 事件处理器
5. **心跳机制**: 客户端自动处理心跳,无需手动干预
6. **消息队列**: 队列满时新消息会被丢弃,注意 `maxQueueSize` 配置
7. **服务器顺序**: 会按 `serverUrls` 数组顺序尝试连接,建议优先服务器放前面
8. **Master 依赖**: Slave 设备连接时,对应的 Master 必须已连接
