/**
 * 设备相关类型定义
 */

/**
 * 设备信息
 */
export interface DeviceInfo {
  id: string;
  manufacturer: string;
  os: string;
  osVersion: string;
  cpu: string;
  memory: string;
  disk: string;
  network: string;
}

/**
 * 设备记录
 */
export interface Device extends DeviceInfo {
  terminalId: string;
  token: string;
  operatingEntityId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 设备连接状态
 */
export enum DeviceConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected'
}

/**
 * 设备连接信息
 */
export interface DeviceConnectionInfo {
  id: string;
  deviceId: string;
  connectedAt: number;
  disconnectedAt: number | null;
  clientIp: string | null;
  userAgent: string | null;
  status: DeviceConnectionStatus;
}

/**
 * 激活设备请求
 */
export interface ActivateDeviceRequest {
  activeCode: string;
  device: DeviceInfo;
}

/**
 * 激活设备响应
 */
export interface ActivateDeviceResponse {
  terminal: {
    id: string;
    name: string;
    key: string;
    type: string;
  };
  model: {
    id: string;
    name: string;
    key: string;
    type: string;
  };
  hostEntity: {
    id: string;
    name: string;
    key: string;
    type: string;
  };
  token: string;
}

/**
 * 设置操作实体请求
 */
export interface SetOperatingEntityRequest {
  deviceId: string;
  operatingEntityId: string;
}

/**
 * 解绑设备请求
 */
export interface DeactivateDeviceRequest {
  deviceId: string;
  deactiveCode: string;
}
