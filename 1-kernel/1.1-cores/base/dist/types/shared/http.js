/**
 * HTTP API 客户端类型定义
 */
// ================================
// 枚举定义
// ================================
/**
 * HTTP 请求方法
 */
export var HttpMethod;
(function (HttpMethod) {
    HttpMethod["GET"] = "GET";
    HttpMethod["POST"] = "POST";
    HttpMethod["PUT"] = "PUT";
    HttpMethod["DELETE"] = "DELETE";
    HttpMethod["PATCH"] = "PATCH";
    HttpMethod["WS"] = "WS";
})(HttpMethod || (HttpMethod = {}));
/**
 * 错误代码
 */
export var APIResponseCode;
(function (APIResponseCode) {
    APIResponseCode["SUCCESS"] = "SUCCESS";
    APIResponseCode["SERVER_NOT_FOUND"] = "SERVER_NOT_FOUND";
    APIResponseCode["AXIOS_INSTANCE_NOT_FOUND"] = "AXIOS_INSTANCE_NOT_FOUND";
    APIResponseCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    APIResponseCode["ALL_SERVERS_FAILED"] = "ALL_SERVERS_FAILED";
    APIResponseCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    APIResponseCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    APIResponseCode["REQUEST_TIMEOUT"] = "REQUEST_TIMEOUT";
    APIResponseCode["REQUEST_CANCELLED"] = "REQUEST_CANCELLED";
})(APIResponseCode || (APIResponseCode = {}));
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
};
/**
 * 性能优化常量
 */
export const PERFORMANCE_CONFIG = {
    CLEANUP_INTERVAL: 100, // 清理间隔(每N次请求清理一次)
    MAX_TIMESTAMPS: 1000, // 时间戳数组最大长度
    MAX_METRICS_ENTRIES: 1000 // metrics最大条目数
};
/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
    DUPLICATE_INSTANCE: '禁止重复创建单例实例!请通过 getInstance() 获取',
    INTERCEPTOR_REMOVAL_WARNING: '移除拦截器需要重新初始化服务器配置才能完全生效',
    SERVER_NOT_INITIALIZED: (serverName) => `服务器 ${serverName} 未初始化`,
    EMPTY_ADDRESSES: (serverName) => `服务器 ${serverName} 的地址列表不能为空`,
    INSTANCE_NOT_FOUND: (instanceKey) => `服务器实例 ${instanceKey} 不存在`,
    ALL_SERVERS_FAILED: (serverName) => `服务器 ${serverName} 的所有地址都不可用`,
    HEADERS_FETCH_FAILED: 'headers 获取失败',
    CALLBACK_FAILED: (callbackName) => `${callbackName} 回调执行失败`
};
