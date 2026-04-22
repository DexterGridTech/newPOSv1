/**
 * API 管理器
 * 负责服务器配置管理、拦截器管理、请求执行和指标统计
 */
import { CancelTokenSource } from 'axios';
import { ApiServerAddress, HttpMethod, RequestInterceptor, RequestMetrics, RequestWrapper, ResponseInterceptor, ResponseWrapper, ServerConfig } from '../../types/shared/http';
/**
 * API 管理器类
 */
export declare class ApiManager {
    private static instance;
    private static creating;
    private serverMap;
    private axiosInstances;
    private requestQueue;
    private requestInterceptors;
    private responseInterceptors;
    getServerConfig: (serverName: string) => ServerConfig | undefined;
    private metrics;
    private metricsWindowSize;
    private lastMetricsCleanup;
    private constructor();
    static getInstance(): ApiManager;
    /**
     * 生成实例键名
     */
    private getInstanceKey;
    /**
     * 错误处理工具函数
     */
    private handleError;
    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor: RequestInterceptor): void;
    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor: ResponseInterceptor): void;
    /**
     * 移除请求拦截器
     */
    removeRequestInterceptor(interceptor: RequestInterceptor): void;
    /**
     * 移除响应拦截器
     */
    removeResponseInterceptor(interceptor: ResponseInterceptor): void;
    /**
     * 将拦截器应用到所有已存在的实例
     */
    private applyInterceptorToExistingInstances;
    /**
     * 初始化服务器地址配置
     */
    initApiServerAddress(apiServerAddress: ApiServerAddress): void;
    /**
     * 更新服务器配置(热更新)
     */
    updateServerConfig(serverName: string, updates: Partial<Omit<ApiServerAddress, 'serverName'>>): void;
    /**
     * 创建 axios 实例并应用拦截器
     */
    private createAxiosInstance;
    /**
     * 发送HTTP请求(单次请求,不含重试逻辑)
     * @returns 包含响应数据和请求记录的结果
     */
    private sendOnce;
    /**
     * 运行API请求(主入口)
     */
    runApi<T, R>(serverName: string, path: string, method: HttpMethod, requestWrapper: RequestWrapper<T>, cancelTokenSource?: CancelTokenSource): Promise<ResponseWrapper<R>>;
    /**
     * 执行请求(支持轮询重试)
     */
    private executeWithRetry;
    /**
     * 判断是否为网络错误
     */
    private isNetworkError;
    /**
     * 延迟函数
     */
    private delay;
    /**
     * 获取队列统计信息
     */
    getQueueStats(): {
        activeCount: number;
        queueLength: number;
        recentRequestCount: number;
    };
    /**
     * 获取请求指标
     */
    getMetrics(): RequestMetrics;
    /**
     * 清理metrics以防止内存泄漏（使用滑动窗口算法）
     */
    private pruneMetricsIfNeeded;
    /**
     * 重置指标
     */
    resetMetrics(): void;
    /**
     * 清理请求队列(用于释放内存)
     */
    cleanupRequestQueue(): void;
    /**
     * 获取请求队列大小
     */
    getRequestQueueSize(): number;
}
//# sourceMappingURL=ApiManager.d.ts.map