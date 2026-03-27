/**
 * Express应用配置
 */

import express, { Express } from 'express';
import compression from 'compression';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { CONFIG } from './config';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 导入路由
import apiRoutes from './routes/api';
import managerRoutes from './routes/manager';

// ES Module 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 创建Express应用
 */
export function createApp(): Express {
  const app = express();

  // gzip 压缩中间件 (必须在其他中间件之前)
  app.use(compression({
    // 压缩级别 (0-9, 默认 6)
    level: 6,
    // 只压缩大于 1KB 的响应
    threshold: 1024,
    // 压缩所有响应类型
    filter: (req, res) => {
      // 如果请求明确不接受压缩,则不压缩
      if (req.headers['x-no-compression']) {
        return false;
      }
      // 使用默认的压缩过滤器
      return compression.filter(req, res);
    }
  }) as any);

  // 基础中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(corsMiddleware);

  // 路由
  app.use(CONFIG.ROUTES.API, apiRoutes);
  app.use(CONFIG.ROUTES.MANAGER, managerRoutes);

  // 静态文件服务(管理后台前端)
  const webDistPath = path.join(__dirname, '../web/dist');
  app.use(CONFIG.ROUTES.WEB, express.static(webDistPath));

  // 404处理
  app.use(notFoundHandler);

  // 错误处理
  app.use(errorHandler);

  return app;
}
