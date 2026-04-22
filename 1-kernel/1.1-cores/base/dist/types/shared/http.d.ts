/**
 * HTTP API 客户端类型定义
 */
import { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
/**
 * HTTP 请求方法
 */
export declare enum HttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    WS = "WS"
}
/**
 * 错误代码
 */
export declare enum APIResponseCode {
    SUCCESS = "SUCCESS",
    SERVER_NOT_FOUND = "SERVER_NOT_FOUND",
    AXIOS_INSTANCE_NOT_FOUND = "AXIOS_INSTANCE_NOT_FOUND",
    NETWORK_ERROR = "NETWORK_ERROR",
    ALL_SERVERS_FAILED = "ALL_SERVERS_FAILED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
    REQUEST_CANCELLED = "REQUEST_CANCELLED"
}
/**
 * 网络错误码集合
 */
export declare const NETWORK_ERROR_CODES: Set<string>;
/**
 * 默认配置常量
 */
export declare const DEFAULT_CONFIG: {
    readonly TIMEOUT: 5000;
    readonly RETRY_COUNT: 3;
    readonly RETRY_INTERVAL: 1000;
    readonly MAX_CONCURRENT_REQUESTS: 10;
    readonly RATE_LIMIT_WINDOW: 1000;
    readonly RATE_LIMIT_MAX_REQUESTS: 100;
};
/**
 * 性能优化常量
 */
export declare const PERFORMANCE_CONFIG: {
    readonly CLEANUP_INTERVAL: 100;
    readonly MAX_TIMESTAMPS: 1000;
    readonly MAX_METRICS_ENTRIES: 1000;
};
/**
 * 错误消息常量
 */
export declare const ERROR_MESSAGES: {
    readonly DUPLICATE_INSTANCE: "禁止重复创建单例实例!请通过 getInstance() 获取";
    readonly INTERCEPTOR_REMOVAL_WARNING: "移除拦截器需要重新初始化服务器配置才能完全生效";
    readonly SERVER_NOT_INITIALIZED: (serverName: string) => string;
    readonly EMPTY_ADDRESSES: (serverName: string) => string;
    readonly INSTANCE_NOT_FOUND: (instanceKey: string) => string;
    readonly ALL_SERVERS_FAILED: (serverName: string) => string;
    readonly HEADERS_FETCH_FAILED: "headers 获取失败";
    readonly CALLBACK_FAILED: (callbackName: string) => string;
};
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
    addressName: string;
    addressIndex: number;
    attemptNumber: number;
    startTime: number;
    endTime: number;
    responseTime: number;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    status?: number;
    statusText?: string;
}
/**
 * 响应额外信息类型
 */
export interface ResponseExtra {
    serverName?: string;
    addressName?: string;
    status?: number;
    statusText?: string;
    totalAttempts?: number;
    totalResponseTime?: number;
    path?: string;
    method?: string;
    attemptRecords?: ServerAttemptRecord[];
    requestExtra?: RequestExtra;
    [key: string]: any;
}
/**
 * 响应封装类型
 */
export interface ResponseWrapper<T> {
    code: APIResponseCode | string;
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
    retryCount: number;
    retryInterval: number;
    addresses: AddressConfig[];
}
/**
 * 服务器配置(内部使用)
 */
export interface ServerConfig {
    addresses: AddressConfig[];
    retryCount: number;
    retryInterval: number;
    lastSuccessfulAddressIndex: number;
}
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
/**
 * 重试策略接口
 */
export interface RetryStrategy {
    shouldRetry: (error: any, attemptCount: number) => boolean;
    getRetryDelay: (attemptCount: number) => number;
}
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
//# sourceMappingURL=http.d.ts.map