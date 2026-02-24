/**
 * 应用入口文件
 */

import { createApp } from './app';
import { initDatabase, closeDatabase } from './database';
import { getWebSocketService } from './services/WebSocketService';
import { CONFIG } from './config';

/**
 * 启动服务器
 */
function startServer() {
  try {
    // 初始化数据库
    initDatabase();

    // 创建Express应用
    const app = createApp();

    // 启动服务器
    const server = app.listen(CONFIG.PORT, CONFIG.HOST, () => {
      console.log('='.repeat(60));
      console.log('IMPOS2 Kernel Server Started');
      console.log('='.repeat(60));
      console.log(`Server running on ${CONFIG.HOST}:${CONFIG.PORT}`);
      console.log(`API Base URL: http://${CONFIG.HOST}:${CONFIG.PORT}${CONFIG.ROUTES.API}`);
      console.log(`WebSocket URL: ws://${CONFIG.HOST}:${CONFIG.PORT}${CONFIG.ROUTES.WS}`);
      console.log(`Manager API: http://${CONFIG.HOST}:${CONFIG.PORT}${CONFIG.ROUTES.MANAGER}`);
      console.log(`Web Manager: http://${CONFIG.HOST}:${CONFIG.PORT}${CONFIG.ROUTES.WEB}/manager`);
      console.log('='.repeat(60));
    });

    // 初始化WebSocket服务
    const wsService = getWebSocketService();
    wsService.initialize(server);

    // 优雅关闭
    const shutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');

      // 关闭HTTP服务器
      server.close(() => {
        console.log('[Server] HTTP server closed');

        // 清理WebSocket连接
        const wsService = getWebSocketService();
        wsService.cleanup();

        // 关闭数据库
        closeDatabase();
        console.log('[Server] Database closed');

        console.log('[Server] Shutdown complete');
        process.exit(0);
      });

      // 如果10秒后仍未关闭,强制退出
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// 启动服务器
startServer();
