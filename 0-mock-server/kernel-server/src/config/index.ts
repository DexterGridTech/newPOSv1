/**
 * 服务器配置常量
 */

export const CONFIG = {
  // 服务器端口
  PORT: 9999,

  // 监听地址，0.0.0.0 允许局域网访问
  HOST: '0.0.0.0',

  // 数据库路径
  DB_PATH: './data/kernel.db',

  // CORS配置
  CORS_ORIGIN: '*',

  // WebSocket心跳间隔(毫秒)
  HEARTBEAT_INTERVAL: 30000,

  // WebSocket心跳超时(毫秒)
  HEARTBEAT_TIMEOUT: 60000,

  // 路由前缀
  ROUTES: {
    API: '/kernel-server/api',
    WS: '/kernel-server/ws',
    MANAGER: '/kernel-server/manager',
    WEB: '/kernel-server'
  }
} as const;
