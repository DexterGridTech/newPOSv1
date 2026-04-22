/**
 * 响应格式化工具
 */
import { ResponseWrapper, ErrorCode } from '../types';
/**
 * 创建成功响应
 */
export declare function success<T>(data?: T, message?: string, extra?: any): ResponseWrapper<T>;
/**
 * 创建错误响应
 */
export declare function error(code: ErrorCode | string, message: string, extra?: any): ResponseWrapper;
/**
 * 创建未找到错误响应
 */
export declare function notFound(resource: string): ResponseWrapper;
/**
 * 创建无效请求错误响应
 */
export declare function invalidRequest(message: string): ResponseWrapper;
/**
 * 创建重复键错误响应
 */
export declare function duplicateKey(field: string): ResponseWrapper;
/**
 * 创建数据库错误响应
 */
export declare function databaseError(message?: string): ResponseWrapper;
/**
 * 创建内部错误响应
 */
export declare function internalError(message?: string): ResponseWrapper;
/**
 * 创建未授权错误响应
 */
export declare function unauthorized(message?: string): ResponseWrapper;
//# sourceMappingURL=response.d.ts.map