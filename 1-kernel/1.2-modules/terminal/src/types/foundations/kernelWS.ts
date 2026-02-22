/**
 * Kernel WebSocket 客户端类型定义
 * 用于连接 Kernel 服务器的 WebSocket 客户端
 */

/**
 * Kernel 消息类型
 */
export enum KernelMessageType {
  CONNECTED = 'CONNECTED',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_RESPONSE = 'HEARTBEAT_RESPONSE',
  UNIT_DATA_CHANGED = 'UNIT_DATA_CHANGED',
  REMOTE_COMMAND = 'REMOTE_COMMAND',
}

/**
 * Kernel 消息封装
 */
export interface KernelMessageWrapper {
  type: KernelMessageType | string;
  data: any;
}

/**
 * Kernel WebSocket 客户端配置
 */
export interface KernelWebSocketClientConfig {
  /** 设备ID */
  deviceId: string;
  /** 设备Token */
  token: string;
  /** API配置(用于获取服务器地址) */
  api: any; // 实际类型为 Api,但避免循环依赖
  /** 连接超时时间(毫秒) */
  connectionTimeout?: number;
  /** 心跳间隔(毫秒) */
  heartbeatInterval?: number;
  /** 心跳超时(毫秒) */
  heartbeatTimeout?: number;
  /** 是否自动响应心跳 */
  autoHeartbeatResponse?: boolean;
  /** 最大消息队列大小 */
  maxQueueSize?: number;
}

/**
 * Kernel 连接状态
 */
export enum KernelConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  ERROR = 'ERROR',
}

/**
 * Kernel 连接事件类型
 */
export enum KernelConnectionEventType {
  STATE_CHANGE = 'STATE_CHANGE',
  CONNECTED = 'CONNECTED',
  CONNECT_FAILED = 'CONNECT_FAILED',
  DISCONNECTED = 'DISCONNECTED',
  MESSAGE = 'MESSAGE',
  ERROR = 'ERROR',
  HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
}

/**
 * Kernel 连接错误类型
 */
export enum KernelConnectionErrorType {
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ALL_SERVERS_FAILED = 'ALL_SERVERS_FAILED',
  HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
  SEND_MESSAGE_FAILED = 'SEND_MESSAGE_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Kernel 连接错误
 */
export interface KernelConnectionError {
  type: KernelConnectionErrorType;
  message: string;
  serverUrl?: string;
  originalError?: any;
}

/**
 * Kernel 状态变更事件
 */
export interface KernelStateChangeEvent {
  oldState: KernelConnectionState;
  newState: KernelConnectionState;
}

/**
 * Kernel 连接成功事件
 */
export interface KernelConnectedEvent {
  serverUrl: string;
}

/**
 * Kernel 连接失败事件
 */
export interface KernelConnectFailedEvent {
  error: KernelConnectionError;
}

/**
 * Kernel 断开连接事件
 */
export interface KernelDisconnectedEvent {
  manual: boolean;
  reason?: string;
}

/**
 * Kernel 消息事件
 */
export interface KernelMessageEvent {
  message: KernelMessageWrapper;
}

/**
 * Kernel 错误事件
 */
export interface KernelErrorEvent {
  error: KernelConnectionError;
}

/**
 * Kernel WebSocket 事件回调
 */
export interface KernelWebSocketEventCallbacks {
  onStateChange?: (event: KernelStateChangeEvent) => void;
  onConnected?: (event: KernelConnectedEvent) => void;
  onConnectFailed?: (event: KernelConnectFailedEvent) => void;
  onDisconnected?: (event: KernelDisconnectedEvent) => void;
  onMessage?: (event: KernelMessageEvent) => void;
  onError?: (event: KernelErrorEvent) => void;
  onHeartbeatTimeout?: (event: KernelErrorEvent) => void;
}

/**
 * Kernel WebSocket 客户端接口
 */
export interface IKernelWebSocketClient {
  connect(config: KernelWebSocketClientConfig): Promise<void>;
  disconnect(reason?: string): void;
  sendMessage(type: string, data: any): Promise<void>;
  isConnected(): boolean;
  getState(): KernelConnectionState;
  on(event: KernelConnectionEventType, callback: Function): void;
  off(event: KernelConnectionEventType, callback: Function): void;
  destroy(): void;
}

/**
 * 发送消息选项
 */
export interface KernelSendMessageOptions {
  /** 消息优先级 */
  priority?: 'high' | 'normal' | 'low';
  /** 超时时间(毫秒) */
  timeout?: number;
}
