/**
 * 服务器配置
 */
export interface ServerConfig {
  /** 服务器端口 */
  port: number;
  /** WebSocket路径前缀 */
  basePath: string;
  /** 待注册设备token过期时间(毫秒) */
  tokenExpireTime: number;
  /** 清理过期设备的间隔时间(毫秒) */
  cleanupInterval: number;
  /** 心跳检测间隔(毫秒) */
  heartbeatInterval: number;
  /** 心跳超时时间(毫秒) */
  heartbeatTimeout: number;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: ServerConfig = {
  port: 8888,
  basePath: '/mockMasterServer',
  tokenExpireTime: 5 * 60 * 1000, // 5分钟
  cleanupInterval: 60 * 1000, // 1分钟
  heartbeatInterval: 30 * 1000, // 30秒
  heartbeatTimeout: 60 * 1000, // 60秒
  logLevel: 'info',
};

/**
 * 合并配置
 */
export function mergeConfig(customConfig?: Partial<ServerConfig>): ServerConfig {
  return {
    ...DEFAULT_CONFIG,
    ...customConfig,
  };
}
