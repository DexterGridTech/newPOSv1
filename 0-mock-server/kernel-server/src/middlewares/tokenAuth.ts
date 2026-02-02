/**
 * Token认证中间件(用于设备API)
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database';
import { unauthorized } from '../utils/response';

/**
 * 扩展Express Request类型,添加device字段
 */
declare global {
  namespace Express {
    interface Request {
      device?: any;
    }
  }
}

/**
 * Token认证中间件
 */
export function tokenAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    // 获取Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(unauthorized('Missing or invalid authorization header'));
      return;
    }

    // 提取token
    const token = authHeader.substring(7);

    // 验证token
    const db = getDatabase();
    const device = db.prepare('SELECT * FROM device WHERE token = ?').get(token);

    if (!device) {
      res.status(401).json(unauthorized('Invalid token'));
      return;
    }

    // 将设备信息添加到请求对象
    req.device = device;
    next();
  } catch (err) {
    console.error('Token auth error:', err);
    res.status(401).json(unauthorized('Token validation failed'));
  }
}
