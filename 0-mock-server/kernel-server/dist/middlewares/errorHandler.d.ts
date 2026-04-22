/**
 * 错误处理中间件
 */
import { Request, Response, NextFunction } from 'express';
/**
 * 全局错误处理中间件
 */
export declare function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void;
/**
 * 404处理中间件
 */
export declare function notFoundHandler(req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map