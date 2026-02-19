import {InstanceMode} from "../../types/shared/instance";

/** 与 dual 服务端协议一致的消息封装 */
export interface MessageWrapper {
    from: string;
    id: string;
    type: string;
    data: any;
}

/** 设备注册信息 */
export interface DeviceRegistration {
    type: InstanceMode;
    deviceId: string;
    masterDeviceId?: string;
    runtimeConfig?: Partial<RuntimeConfig>;
}

/** 运行时配置（master 注册时可传入） */
export interface RuntimeConfig {
    tokenExpireTime: number;
    heartbeatInterval: number;
    heartbeatTimeout: number;
    retryCacheTimeout: number;
}

/** HTTP 注册响应 */
export interface RegistrationResponse {
    success: boolean;
    error?: string;
    token?: string;
    deviceInfo?: {
        deviceType: InstanceMode;
        deviceId: string;
    };
}

/** 系统通知类型（与服务端一致） */
export const SYSTEM_NOTIFICATION = {
    SLAVE_CONNECTED: '__system_slave_connected',
    SLAVE_DISCONNECTED: '__system_slave_disconnected',
    HEARTBEAT: '__system_heartbeat',
    HEARTBEAT_ACK: '__system_heartbeat_ack',
} as const;

/** 连接状态 */
export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    REGISTERING = 'REGISTERING',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTING = 'DISCONNECTING',
}

/** 连接事件类型 */
export enum ConnectionEventType {
    STATE_CHANGE = 'STATE_CHANGE',
    CONNECTED = 'CONNECTED',
    CONNECT_FAILED = 'CONNECT_FAILED',
    DISCONNECTED = 'DISCONNECTED',
    MESSAGE = 'MESSAGE',
    ERROR = 'ERROR',
    HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
}

/** 连接错误类型 */
export enum ConnectionErrorType {
    REGISTRATION_FAILED = 'REGISTRATION_FAILED',
    WEBSOCKET_FAILED = 'WEBSOCKET_FAILED',
    ALL_SERVERS_FAILED = 'ALL_SERVERS_FAILED',
    HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
    CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
    NETWORK_ERROR = 'NETWORK_ERROR',
}

/** 连接错误 */
export interface ConnectionError {
    type: ConnectionErrorType;
    message: string;
    originalError?: Error;
    serverUrl?: string;
}

/** 客户端配置 */
export interface DualClientConfig {
    deviceRegistration: DeviceRegistration;
    serverUrls: string[];
    connectionTimeout?: number;
    heartbeatTimeout?: number;
    maxQueueSize?: number;
}

/** 事件数据 */
export interface StateChangeEvent {
    oldState: ConnectionState;
    newState: ConnectionState;
    timestamp: number;
}

export interface ConnectedEvent {
    serverUrl: string;
    timestamp: number;
    deviceInfo: { deviceType: InstanceMode; deviceId: string };
}

export interface ConnectFailedEvent {
    error: ConnectionError;
    timestamp: number;
}

export interface DisconnectedEvent {
    wasClean: boolean;
    reason?: string;
    timestamp: number;
}

export interface WSMessageEvent {
    message: MessageWrapper;
    timestamp: number;
}

export interface WSErrorEvent {
    error: ConnectionError;
    timestamp: number;
}
