/**
 * HTTP API 客户端类型定义
 */

import { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// ================================
// 枚举定义
// ================================

/**
 * HTTP 请求方法
 */
export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
    WS = 'WS'
}

/**
 * 错误代码
 */
export enum APIErrorCode {
    SUCCESS = 'SUCCESS',
    SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
    AXIOS_INSTANCE_NOT_FOUND = 'AXIOS_INSTANCE_NOT_FOUND',
    NETWORK_ERROR = 'NETWORK_ERROR',
    ALL_SERVERS_FAILED = 'ALL_SERVERS_FAILED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
    REQUEST_CANCELLED = 'REQUEST_CANCELLED'
}

// ================================
// 常量定义
// ================================

/**
 * 网络错误码集合
 */
export const NETWORK_ERROR_CODES = new Set([
    'NETWORK_ERROR',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ERR_NETWORK'
]);

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
    TIMEOUT: 5000,
    RETRY_COUNT: 3,
    RETRY_INTERVAL: 1000,
    MAX_CONCURRENT_REQUESTS: 10,
    RATE_LIMIT_WINDOW: 1000,
    RATE_LIMIT_MAX_REQUESTS: 100
} as const;

/**
 * 性能优化常量
 */
export const PERFORMANCE_CONFIG = {
    CLEANUP_INTERVAL: 100,              // 清理间隔(每N次请求清理一次)
    MAX_TIMESTAMPS: 1000,                // 时间戳数组最大长度
    MAX_METRICS_ENTRIES: 1000            // metrics最大条目数
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
    DUPLICATE_INSTANCE: '禁止重复创建单例实例!请通过 getInstance() 获取',
    INTERCEPTOR_REMOVAL_WARNING: '移除拦截器需要重新初始化服务器配置才能完全生效',
    SERVER_NOT_INITIALIZED: (serverName: string) => `服务器 ${serverName} 未初始化`,
    EMPTY_ADDRESSES: (serverName: string) => `服务器 ${serverName} 的地址列表不能为空`,
    INSTANCE_NOT_FOUND: (instanceKey: string) => `服务器实例 ${instanceKey} 不存在`,
    ALL_SERVERS_FAILED: (serverName: string) => `服务器 ${serverName} 的所有地址都不可用`,
    HEADERS_FETCH_FAILED: 'headers 获取失败',
    CALLBACK_FAILED: (callbackName: string) => `${callbackName} 回调执行失败`
} as const;

// ================================
// 基础类型定义
// ================================

/**
 * 错误处理策略
 */
export type ErrorHandlingStrategy = 'log' | 'throw' | 'silent';

/**
 * 请求额外信息
 */
export interface RequestExtra {
    traceId?: string;
    requestId?: string;
    sessionId?: string;
    parentTraceId?: string;
    requestTime?: number;
}

/**
 * 请求封装类型
 */
export interface RequestWrapper<T> {
    request: T;
    extra?: RequestExtra;
}

/**
 * 单次服务器请求记录
 */
export interface ServerAttemptRecord {
    addressName: string;           // 服务器地址名称
    addressIndex: number;           // 地址索引
    attemptNumber: number;          // 尝试次数(第几次尝试)
    startTime: number;              // 请求开始时间戳
    endTime: number;                // 请求结束时间戳
    responseTime: number;           // 响应时间(毫秒)
    success: boolean;               // 是否成功
    errorCode?: string;             // 错误代码
    errorMessage?: string;          // 错误信息
    status?: number;                // HTTP状态码
    statusText?: string;            // HTTP状态文本
}

/**
 * 响应额外信息类型
 */
export interface ResponseExtra {
    serverName?: string;            // 服务器名称
    addressName?: string;           // 最终成功的地址名称
    status?: number;                // HTTP状态码
    statusText?: string;            // HTTP状态文本
    totalAttempts?: number;         // 总尝试次数
    totalResponseTime?: number;     // 总响应时间(毫秒)
    path?: string;                  // 请求路径
    method?: string;                // 请求方法
    attemptRecords?: ServerAttemptRecord[];  // 所有服务器尝试记录
    requestExtra?: RequestExtra;    // 请求的额外信息(来自RequestWrapper)
    [key: string]: any;
}

/**
 * 响应封装类型
 */
export interface ResponseWrapper<T> {
    code: APIErrorCode | string;
    message?: string;
    data?: T;
    extra?: ResponseExtra;
}

/**
 * 地址配置
 */
export interface AddressConfig {
    addressName: string;
    baseURL: string;
    timeout: number;
}

/**
 * API 服务器地址配置
 */
export interface ApiServerAddress {
    serverName: string;
    retryCount: number;          // 全局重试次数
    retryInterval: number;       // 重试间隔(毫秒)
    addresses: AddressConfig[];
}

/**
 * 服务器配置(内部使用)
 */
export interface ServerConfig {
    addresses: AddressConfig[];
    retryCount: number;
    retryInterval: number;
    lastSuccessfulAddressIndex: number;  // 上次成功的地址索引
}

// ================================
// 拦截器接口
// ================================

/**
 * 请求拦截器接口
 */
export interface RequestInterceptor {
    serverName?: string;
    onRequest?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
    onRequestError?: (error: any) => any;
}

/**
 * 响应拦截器接口
 */
export interface ResponseInterceptor {
    serverName?: string;
    onResponse?: <T>(response: AxiosResponse<T>) => AxiosResponse<T> | Promise<AxiosResponse<T>>;
    onResponseError?: (error: any) => any;
}

// ================================
// 策略接口
// ================================

/**
 * 重试策略接口
 */
export interface RetryStrategy {
    shouldRetry: (error: any, attemptCount: number) => boolean;
    getRetryDelay: (attemptCount: number) => number;
}

// ================================
// 指标接口
// ================================

/**
 * 请求指标接口
 */
export interface RequestMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cancelledRequests: number;
    avgResponseTime: number;
    addressMetrics: Record<string, {
        requests: number;
        failures: number;
        avgResponseTime: number;
    }>;
}
