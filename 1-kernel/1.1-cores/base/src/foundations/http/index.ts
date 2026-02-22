/**
 * HTTP API 客户端模块
 * 提供基于 axios 的 HTTP 请求功能
 */

export {Api} from './Api';
export {ApiManager} from './ApiManager';

// 枚举需要作为值导出(不能用 export type)
export {HttpMethod, APIResponseCode} from '../../types/shared/http';

export type {
    // 基础类型
    ErrorHandlingStrategy,
    RequestExtra,
    RequestWrapper,
    ResponseExtra,
    ResponseWrapper,
    ServerAttemptRecord,

    // 配置类型
    AddressConfig,
    ApiServerAddress,
    ServerConfig,

    // 拦截器类型
    RequestInterceptor,
    ResponseInterceptor,

    // 策略类型
    RetryStrategy,

    // 指标类型
    RequestMetrics,
} from '../../types/shared/http';

// 导出常量
export {
    NETWORK_ERROR_CODES,
    DEFAULT_CONFIG,
    PERFORMANCE_CONFIG,
    ERROR_MESSAGES
} from '../../types/shared/http';
