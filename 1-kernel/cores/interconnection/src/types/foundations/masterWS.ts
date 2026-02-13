/**
 * Master WebSocket 客户端类型定义
 * 用于连接 Master 服务器的 WebSocket 客户端
 */

import {InstanceMode} from "../shared/instance";

/**
 * 消息封装类型 (与服务器协议一致)
 */
export interface MessageWrapper {
    /** 发送者设备名称 */
    from: string;
    /** 消息ID */
    id: string;
    /** 消息类型 */
    type: string;
    /** 消息内容 (JSON字符串) */
    data: any;

    /** 目标设备名称(可选,用于Master向指定Slave发送消息) */
    targetDevice: string|null;
}
/**
 * 设备注册信息
 */
export interface DeviceRegistration {
    /** 设备类型 */
    type: InstanceMode;
    /** 设备ID */
    deviceId: string;
    /** 设备名称 */
    deviceName: string;
    /** Master设备ID (仅slave设备需要) */
    masterDeviceId?: string;
}

/**
 * HTTP 注册响应
 */
export interface RegistrationResponse {
    /** 是否成功 */
    success: boolean;
    /** 错误消息 */
    error?: string;
    /** 注册token */
    token?: string;
    /** 设备信息 */
    deviceInfo?: {
        deviceType: InstanceMode;
        deviceId: string;
        deviceName: string;
    };
}

/**
 * WebSocket 连接配置
 */
export interface WebSocketClientConfig {
    /** 设备注册信息 */
    deviceRegistration: DeviceRegistration;
    /** 服务器地址列表 (HTTP注册地址) */
    serverUrls: string[];
    /** 连接超时时间 (毫秒) */
    connectionTimeout?: number;
    /** 心跳间隔 (毫秒) */
    heartbeatInterval?: number;
    /** 心跳超时 (毫秒) */
    heartbeatTimeout?: number;
    /** 是否自动发送心跳响应 */
    autoHeartbeatResponse?: boolean;
    /** 消息队列最大长度 */
    maxQueueSize?: number;
}

/**
 * 连接状态
 */
export enum ConnectionState {
    /** 未连接 */
    DISCONNECTED = 'DISCONNECTED',
    /** 注册中 */
    REGISTERING = 'REGISTERING',
    /** 连接中 */
    CONNECTING = 'CONNECTING',
    /** 已连接 */
    CONNECTED = 'CONNECTED',
    /** 断开中 */
    DISCONNECTING = 'DISCONNECTING',
    /** 错误 */
    ERROR = 'ERROR'
}

/**
 * 连接事件类型
 */
export enum ConnectionEventType {
    /** 状态变更 */
    STATE_CHANGE = 'STATE_CHANGE',
    /** 连接成功 */
    CONNECTED = 'CONNECTED',
    /** 连接失败 */
    CONNECT_FAILED = 'CONNECT_FAILED',
    /** 断开连接 */
    DISCONNECTED = 'DISCONNECTED',
    /** 收到消息 */
    MESSAGE = 'MESSAGE',
    /** 发生错误 */
    ERROR = 'ERROR',
    /** 心跳超时 */
    HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT'
}

/**
 * 连接错误类型
 */
export enum ConnectionErrorType {
    /** 注册失败 */
    REGISTRATION_FAILED = 'REGISTRATION_FAILED',
    /** WebSocket连接失败 */
    WEBSOCKET_FAILED = 'WEBSOCKET_FAILED',
    /** 所有服务器都连接失败 */
    ALL_SERVERS_FAILED = 'ALL_SERVERS_FAILED',
    /** 心跳超时 */
    HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
    /** 连接超时 */
    CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
    /** 网络错误 */
    NETWORK_ERROR = 'NETWORK_ERROR',
    /** 未知错误 */
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 连接错误
 */
export interface ConnectionError {
    /** 错误类型 */
    type: ConnectionErrorType;
    /** 错误消息 */
    message: string;
    /** 原始错误 */
    originalError?: Error;
    /** 尝试的服务器地址 */
    serverUrl?: string;
}

/**
 * 状态变更事件
 */
export interface StateChangeEvent {
    /** 旧状态 */
    oldState: ConnectionState;
    /** 新状态 */
    newState: ConnectionState;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 连接成功事件
 */
export interface ConnectedEvent {
    /** 服务器地址 */
    serverUrl: string;
    /** 连接时间戳 */
    timestamp: number;
    /** 设备信息 */
    deviceInfo: {
        deviceType: InstanceMode;
        deviceId: string;
        deviceName: string;
    };
}

/**
 * 连接失败事件
 */
export interface ConnectFailedEvent {
    /** 错误信息 */
    error: ConnectionError;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 断开连接事件
 */
export interface DisconnectedEvent {
    /** 是否主动断开 */
    wasClean: boolean;
    /** 断开原因 */
    reason?: string;
    /** 错误信息 */
    error?: ConnectionError;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 消息事件
 */
export interface MessageEvent {
    /** 消息内容 */
    message: MessageWrapper;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 错误事件
 */
export interface ErrorEvent {
    /** 错误信息 */
    error: ConnectionError;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 事件回调类型
 */
export interface WebSocketEventCallbacks {
    /** 状态变更 */
    onStateChange?: (event: StateChangeEvent) => void;
    /** 连接成功 */
    onConnected?: (event: ConnectedEvent) => void;
    /** 连接失败 */
    onConnectFailed?: (event: ConnectFailedEvent) => void;
    /** 断开连接 */
    onDisconnected?: (event: DisconnectedEvent) => void;
    /** 收到消息 */
    onMessage?: (event: MessageEvent) => void;
    /** 发生错误 */
    onError?: (event: ErrorEvent) => void;
    /** 心跳超时 */
    onHeartbeatTimeout?: () => void;
}

/**
 * 系统消息类型 (与服务器协议一致)
 */
export const SYSTEM_MESSAGE_TYPES = {
    /** Slave设备连接通知 */
    SLAVE_CONNECTED: '__system_slave_connected',
    /** Slave设备断开通知 */
    SLAVE_DISCONNECTED: '__system_slave_disconnected',
    /** 心跳检测 */
    HEARTBEAT: '__system_heartbeat',
    /** 心跳响应 */
    HEARTBEAT_ACK: '__system_heartbeat_ack',
} as const;

/**
 * 消息发送选项
 */
export interface SendMessageOptions {
    /** 是否等待连接成功后发送 */
    waitForConnection?: boolean;
    /** 超时时间 (毫秒) */
    timeout?: number;
}

/**
 * WebSocket 客户端接口
 */
export interface IWebSocketClient {
    /** 连接到服务器 */
    connect(config: WebSocketClientConfig): Promise<void>;
    /** 断开连接 */
    disconnect(reason?: string): void;
    /** 发送消息 */
    sendMessage(type: string, content: any, targetDevice:string|null,options?: SendMessageOptions): Promise<void>;
    /** 获取当前连接状态 */
    getState(): ConnectionState;
    /** 是否已连接 */
    isConnected(): boolean;
    /** 注册事件回调 */
    on(eventType: ConnectionEventType, callback: Function): void;
    /** 注销事件回调 */
    off(eventType: ConnectionEventType, callback: Function): void;
    /** 销毁实例 */
    destroy(): void;
}
