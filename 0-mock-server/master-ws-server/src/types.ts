/**
 * 消息封装类型
 * type 是业务类型,由业务层定义,服务器不枚举
 */
export interface MessageWrapper {
  /** 发送者设备名称 */
  from: string;
  /** 消息ID */
  id: string;
  /** 消息类型(业务类型,服务器不限制) */
  type: string;
  /** 消息内容 */
  data: any;
  /** 目标设备名称(可选,用于Master向指定Slave发送消息) */
  targetDevice?: string;
}

/**
 * 设备类型
 */
export enum DeviceType {
  MASTER = 'master',
  SLAVE = 'slave'
}

/**
 * 设备注册信息
 */
export interface DeviceRegistration {
  /** 设备类型 */
  type: DeviceType;
  /** 设备ID */
  deviceId: string;
  /** 设备名称(唯一) */
  deviceName: string;
  /** Master设备ID (仅slave设备需要) */
  masterDeviceId?: string;
}

/**
 * 设备信息
 */
export interface DeviceInfo extends DeviceRegistration {
  /** 连接时间 */
  connectedAt: Date;
  /** 注册token */
  token: string;
}

/**
 * 系统通知类型(服务器内部使用)
 */
export const SYSTEM_NOTIFICATION = {
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
 * HTTP注册响应
 */
export interface RegistrationResponse {
  /** 是否成功 */
  success: boolean;
  /** 错误消息 */
  error?: string;
  /** 注册token(用于WebSocket连接) */
  token?: string;
  /** 设备信息 */
  deviceInfo?: {
    deviceType: DeviceType;
    deviceId: string;
    deviceName: string;
  };
}
