/**
 * 错误处理中间件
 */

import { Request, Response, NextFunction } from 'express';
import { internalError } from '../utils/response';

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('Error occurred:', err);

  // 如果响应已发送,则跳过
  if (res.headersSent) {
    return next(err);
  }

  // 返回错误响应
  const response = internalError(err.message || 'An unexpected error occurred');
  res.status(500).json(response);
}

/**
 * 404处理中间件
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });
}
