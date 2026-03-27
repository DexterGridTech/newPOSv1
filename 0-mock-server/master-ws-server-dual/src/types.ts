export interface MessageWrapper {
  from: string;
  id: string;
  type: string;
  data: any;
}

export enum DeviceType {
  MASTER = 'master',
  SLAVE = 'slave'
}

export interface DeviceRegistration {
  type: DeviceType;
  deviceId: string;
  masterDeviceId?: string;
  /** master 注册时可传入运行时配置 */
  runtimeConfig?: Partial<RuntimeConfig>;
}

export interface RuntimeConfig {
  tokenExpireTime: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  retryCacheTimeout: number;
}

export interface DeviceInfo extends DeviceRegistration {
  connectedAt: Date;
  token: string;
}

export const SYSTEM_NOTIFICATION = {
  SLAVE_CONNECTED: '__system_slave_connected',
  SLAVE_DISCONNECTED: '__system_slave_disconnected',
  HEARTBEAT: '__system_heartbeat',
  HEARTBEAT_ACK: '__system_heartbeat_ack',
} as const;

export interface RegistrationResponse {
  success: boolean;
  error?: string;
  token?: string;
  deviceInfo?: {
    deviceType: DeviceType;
    deviceId: string;
  };
}
