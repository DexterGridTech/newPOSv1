/**
 * Token认证中间件(用于设备API)
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function tokenAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=tokenAuth.d.ts.map