/**
 * 响应格式化工具
 */

import { ResponseWrapper, ErrorCode } from '../types';

/**
 * 创建成功响应
 */
export function success<T>(data?: T, message?: string, extra?: any): ResponseWrapper<T> {
  return {
    code: ErrorCode.SUCCESS,
    message: message || 'Success',
    data,
    extra
  };
}

/**
 * 创建错误响应
 */
export function error(code: ErrorCode | string, message: string, extra?: any): ResponseWrapper {
  return {
    code,
    message,
    extra
  };
}

/**
 * 创建未找到错误响应
 */
export function notFound(resource: string): ResponseWrapper {
  return error(ErrorCode.NOT_FOUND, `${resource} not found`);
}

/**
 * 创建无效请求错误响应
 */
export function invalidRequest(message: string): ResponseWrapper {
  return error(ErrorCode.INVALID_REQUEST, message);
}

/**
 * 创建重复键错误响应
 */
export function duplicateKey(field: string): ResponseWrapper {
  return error(ErrorCode.DUPLICATE_KEY, `${field} already exists`);
}

/**
 * 创建数据库错误响应
 */
export function databaseError(message?: string): ResponseWrapper {
  return error(ErrorCode.DATABASE_ERROR, message || 'Database error occurred');
}

/**
 * 创建内部错误响应
 */
export function internalError(message?: string): ResponseWrapper {
  return error(ErrorCode.INTERNAL_ERROR, message || 'Internal server error');
}

/**
 * 创建未授权错误响应
 */
export function unauthorized(message?: string): ResponseWrapper {
  return error(ErrorCode.UNAUTHORIZED, message || 'Unauthorized');
}
