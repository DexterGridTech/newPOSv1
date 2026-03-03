/**
 * API请求响应类型定义
 */

/**
 * 错误代码
 */
export enum ErrorCode {
  SUCCESS = 'SUCCESS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_CODE = 'INVALID_CODE',
  TERMINAL_ALREADY_BOUND = 'TERMINAL_ALREADY_BOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

/**
 * 响应额外信息
 */
export interface ResponseExtra {
  [key: string]: any;
}

/**
 * 响应封装类型
 */
export interface ResponseWrapper<T = any> {
  code: ErrorCode | string;
  message?: string;
  data?: T;
  extra?: ResponseExtra;
}

/**
 * 消息类型
 */
export enum MessageType {
  UNIT_DATA_CHANGED = 'UNIT_DATA_CHANGED',
  REMOTE_COMMAND = 'REMOTE_COMMAND',
  HEARTBEAT = 'HEARTBEAT',
  DEVICE_STATE_UPDATED = 'DEVICE_STATE_UPDATED',
  DEVICE_ONLINE_STATUS = 'DEVICE_ONLINE_STATUS'
}

/**
 * 消息封装
 */
export interface MessageWrapper {
  type: MessageType | string;
  data: any;
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
