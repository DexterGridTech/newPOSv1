# Kernel WebSocket 客户端

用于连接 Kernel 服务器的 WebSocket 客户端模块。

## 特性

- **单例模式**: 全局唯一实例，避免重复连接
- **多地址支持**: 支持多个服务器地址顺序尝试连接
- **自动心跳**: 服务器主动发送心跳，客户端自动响应
- **消息队列**: 连接建立前的消息自动缓存，连接后自动发送
- **消息去重**: 基于消息ID的去重机制，避免重复处理
- **错误处理**: 完善的错误处理和事件通知机制
- **资源管理**: 自动清理过期缓存，支持手动销毁

## 架构设计

### 核心组件

1. **KernelWebSocketClient**: 主客户端类，提供对外API
2. **KernelConnectionManager**: 连接管理器，负责WebSocket连接和消息收发
3. **KernelEventManager**: 事件管理器，负责事件的注册和触发
4. **KernelHeartbeatManager**: 心跳管理器，负责心跳检测和超时处理

### 与 master-ws 的区别

- **独立状态**: 完全独立的状态管理，不与 master-ws 互相干扰
- **独立类型**: 使用 `Kernel` 前缀的类型定义，避免命名冲突
- **简化连接**: 无需 HTTP 注册，直接 WebSocket 连接
- **被动心跳**: 服务器主动发送心跳，客户端响应（master-ws 是客户端主动发送）

## 使用方法

### 基本用法

```typescript
import { KernelWebSocketClient } from '@/core/kernel-ws';
import { KernelConnectionEventType } from '@/types';

// 获取客户端实例
const client = KernelWebSocketClient.getInstance();

// 注册事件监听
client.on(KernelConnectionEventType.CONNECTED, (event) => {
  console.log('连接成功:', event.serverUrl);
});

client.on(KernelConnectionEventType.MESSAGE, (event) => {
  console.log('收到消息:', event.message);
});

client.on(KernelConnectionEventType.DISCONNECTED, (event) => {
  console.log('连接断开:', event.reason);
});

// 连接到服务器
await client.connect({
  deviceId: 'device-001',
  token: 'your-token',
  api: kernelDeviceAPI.connectKernelWS, // Api类型，HttpMethod必须是WS
  connectionTimeout: 10000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  autoHeartbeatResponse: true,
});

// 发送消息
await client.sendMessage('CUSTOM_MESSAGE', {
  content: 'Hello Server'
});

// 断开连接
client.disconnect('用户主动断开');

// 销毁客户端（释放所有资源）
client.destroy();
```

### 配置说明

```typescript
interface KernelWebSocketClientConfig {
  deviceId: string;              // 设备ID（必填）
  token: string;                 // 设备Token（必填）
  api: Api;                      // API配置，用于获取服务器地址（必填）
  connectionTimeout?: number;    // 连接超时时间，默认10秒
  heartbeatInterval?: number;    // 心跳间隔，默认30秒
  heartbeatTimeout?: number;     // 心跳超时，默认60秒
  autoHeartbeatResponse?: boolean; // 是否自动响应心跳，默认true
  maxQueueSize?: number;         // 最大消息队列大小，默认100
}
```

## 连接流程

1. 从 `ApiManager` 获取服务器配置（基于 `api.serverName`）
2. 顺序遍历 `addresses` 列表（不并发）
3. 将 HTTP/HTTPS 地址转换为 WS/WSS
4. 单个地址失败后立即尝试下一个
5. 首次成功即停止，不再尝试其他地址
6. 所有地址失败则抛出错误

## 事件类型

### KernelConnectionEventType

- `STATE_CHANGE`: 状态变更
- `CONNECTED`: 连接成功
- `CONNECT_FAILED`: 连接失败
- `DISCONNECTED`: 连接断开
- `MESSAGE`: 收到消息
- `ERROR`: 发生错误
- `HEARTBEAT_TIMEOUT`: 心跳超时

## 消息类型

### KernelMessageType

- `CONNECTED`: 连接成功消息（服务器发送）
- `HEARTBEAT`: 心跳消息（服务器发送）
- `HEARTBEAT_RESPONSE`: 心跳响应（客户端发送）
- `UNIT_DATA_CHANGED`: 单元数据变更通知
- `REMOTE_COMMAND`: 远程指令

## 状态管理

### KernelConnectionState

- `DISCONNECTED`: 已断开
- `CONNECTING`: 连接中
- `CONNECTED`: 已连接
- `DISCONNECTING`: 断开中
- `ERROR`: 错误状态

## 错误处理

### KernelConnectionErrorType

- `CONNECTION_TIMEOUT`: 连接超时
- `CONNECTION_FAILED`: 连接失败
- `ALL_SERVERS_FAILED`: 所有服务器连接失败
- `HEARTBEAT_TIMEOUT`: 心跳超时
- `SEND_MESSAGE_FAILED`: 发送消息失败
- `UNKNOWN_ERROR`: 未知错误

## 注意事项

1. **单例模式**: 全局只有一个实例，多次调用 `getInstance()` 返回同一实例
2. **状态检查**: 发送消息前请检查 `isConnected()` 状态
3. **资源释放**: 不再使用时调用 `destroy()` 释放资源
4. **事件清理**: 组件卸载时记得移除事件监听器
5. **错误处理**: 连接失败、错误、心跳超时会自动断开连接

## 最佳实践

1. 在应用启动时初始化客户端
2. 注册全局事件监听器处理连接状态
3. 使用消息队列处理连接建立前的消息
4. 实现重连机制（监听 DISCONNECTED 事件）
5. 在应用退出时调用 destroy() 清理资源
