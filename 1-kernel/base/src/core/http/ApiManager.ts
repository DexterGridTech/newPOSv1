/**
 * API 管理器
 * 负责服务器配置管理、拦截器管理、请求执行和指标统计
 */

import {axios} from './axiosConfig';
import {AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource} from 'axios';
import {logger} from '../nativeAdapter';
import {CircuitBreaker} from './CircuitBreakerManager';
import {RequestQueue} from './RequestQueueManager';
import {
    APIErrorCode,
    ApiServerAddress,
    CircuitState,
    ERROR_MESSAGES,
    ErrorHandlingStrategy,
    HttpMethod,
    NETWORK_ERROR_CODES,
    PERFORMANCE_CONFIG,
    RequestInterceptor,
    RequestMetrics,
    RequestWrapper,
    ResponseInterceptor,
    ResponseWrapper,
    ServerAttemptRecord,
    ServerConfig
} from '../../types';

/**
 * API 管理器类
 */
export class ApiManager {
    private static instance: ApiManager | null = null;
    private static creating = false;
    private serverMap: Map<string, ServerConfig> = new Map();
    private axiosInstances: Map<string, AxiosInstance> = new Map();
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private requestQueue: RequestQueue = new RequestQueue();
    private requestInterceptors: RequestInterceptor[] = [];
    private responseInterceptors: ResponseInterceptor[] = [];

    public getServerConfig = (serverName: string) => this.serverMap.get(serverName)

    // 请求指标
    private metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cancelledRequests: 0,
        totalResponseTime: 0,
        addressMetrics: new Map<string, {
            requests: number;
            failures: number;
            totalResponseTime: number;
        }>()
    };

    private constructor() {
        // 移除检查，由 getInstance 控制
    }

    public static getInstance(): ApiManager {
        if (!this.instance) {
            if (this.creating) {
                throw new Error('ApiManager is being created');
            }
            this.creating = true;
            try {
                this.instance = new ApiManager();
            } finally {
                this.creating = false;
            }
        }
        return this.instance;
    }

    /**
     * 生成实例键名
     */
    private getInstanceKey(serverName: string, addressIndex: number): string {
        return `${serverName}-${addressIndex}`;
    }

    /**
     * 错误处理工具函数
     */
    private handleError(
        error: unknown,
        context: string,
        strategy: ErrorHandlingStrategy = 'log'
    ): void {
        const errorMessage = `${context}: ${error instanceof Error ? error.message : String(error)}`;

        if (strategy === 'throw') {
            throw new Error(errorMessage);
        }
        if (strategy === 'log') {
            logger.error(errorMessage, error);
        }
        // silent模式不做任何处理
    }

    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor: RequestInterceptor): void {
        this.requestInterceptors.push(interceptor);
        // 应用到所有已存在的 axios 实例
        this.applyInterceptorToExistingInstances('request', interceptor);
    }

    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor: ResponseInterceptor): void {
        this.responseInterceptors.push(interceptor);
        // 应用到所有已存在的 axios 实例
        this.applyInterceptorToExistingInstances('response', interceptor);
    }

    /**
     * 移除请求拦截器
     */
    removeRequestInterceptor(interceptor: RequestInterceptor): void {
        const index = this.requestInterceptors.indexOf(interceptor);
        if (index > -1) {
            this.requestInterceptors.splice(index, 1);
            // 注意: axios 不支持移除特定拦截器,需要重新创建实例
            logger.warn(ERROR_MESSAGES.INTERCEPTOR_REMOVAL_WARNING);
        }
    }

    /**
     * 移除响应拦截器
     */
    removeResponseInterceptor(interceptor: ResponseInterceptor): void {
        const index = this.responseInterceptors.indexOf(interceptor);
        if (index > -1) {
            this.responseInterceptors.splice(index, 1);
            logger.warn(ERROR_MESSAGES.INTERCEPTOR_REMOVAL_WARNING);
        }
    }

    /**
     * 将拦截器应用到所有已存在的实例
     */
    private applyInterceptorToExistingInstances(
        type: 'request' | 'response',
        interceptor: RequestInterceptor | ResponseInterceptor
    ): void {
        this.axiosInstances.forEach((instance, key) => {
            if (!interceptor.serverName || key.startsWith(`${interceptor.serverName}-`)) {
                if (type === 'request') {
                    const reqInterceptor = interceptor as RequestInterceptor;
                    instance.interceptors.request.use(
                        reqInterceptor.onRequest,
                        reqInterceptor.onRequestError
                    );
                } else {
                    const resInterceptor = interceptor as ResponseInterceptor;
                    instance.interceptors.response.use(
                        resInterceptor.onResponse,
                        resInterceptor.onResponseError
                    );
                }
            }
        });
    }

    /**
     * 初始化服务器地址配置
     */
    initApiServerAddress(apiServerAddress: ApiServerAddress): void {
        const {serverName, addresses, retryCount, retryInterval} = apiServerAddress;

        if (!addresses || addresses.length === 0) {
            throw new Error(ERROR_MESSAGES.EMPTY_ADDRESSES(serverName));
        }

        this.serverMap.set(serverName, {
            addresses,
            retryCount,
            retryInterval,
            lastSuccessfulAddressIndex: 0
        });

        // 为每个地址创建 axios 实例和断路器
        addresses.forEach((_, index) => {
            this.createAxiosInstance(serverName, index);
            this.circuitBreakers.set(this.getInstanceKey(serverName, index), new CircuitBreaker());
        });
    }

    /**
     * 更新服务器配置(热更新)
     */
    updateServerConfig(serverName: string, updates: Partial<Omit<ApiServerAddress, 'serverName'>>): void {
        const config = this.serverMap.get(serverName);
        if (!config) {
            throw new Error(ERROR_MESSAGES.SERVER_NOT_INITIALIZED(serverName));
        }

        // 更新重试配置
        if (updates.retryCount !== undefined) {
            config.retryCount = updates.retryCount;
        }
        if (updates.retryInterval !== undefined) {
            config.retryInterval = updates.retryInterval;
        }

        // 如果更新了地址列表,需要重新创建实例
        if (updates.addresses) {
            // 清理旧的实例和断路器
            this.axiosInstances.forEach((_, key) => {
                if (key.startsWith(`${serverName}-`)) {
                    this.axiosInstances.delete(key);
                }
            });
            this.circuitBreakers.forEach((_, key) => {
                if (key.startsWith(`${serverName}-`)) {
                    this.circuitBreakers.delete(key);
                }
            });

            // 更新地址列表
            config.addresses = updates.addresses;

            // 重新创建实例和断路器
            updates.addresses.forEach((_, index) => {
                this.createAxiosInstance(serverName, index);
                this.circuitBreakers.set(this.getInstanceKey(serverName, index), new CircuitBreaker());
            });
        }
    }

    /**
     * 创建 axios 实例并应用拦截器
     */
    private createAxiosInstance(serverName: string, addressIndex: number): AxiosInstance {
        const config = this.serverMap.get(serverName);
        if (!config) {
            throw new Error(ERROR_MESSAGES.SERVER_NOT_INITIALIZED(serverName));
        }

        const address = config.addresses[addressIndex];
        const instanceKey = this.getInstanceKey(serverName, addressIndex);

        let instance = this.axiosInstances.get(instanceKey);
        if (!instance) {
            instance = axios.create({
                baseURL: address.baseURL,
                timeout: address.timeout
            });

            // 应用请求拦截器
            this.requestInterceptors.forEach(interceptor => {
                if (!interceptor.serverName || interceptor.serverName === serverName) {
                    instance!.interceptors.request.use(
                        interceptor.onRequest,
                        interceptor.onRequestError
                    );
                }
            });

            // 应用响应拦截器
            this.responseInterceptors.forEach(interceptor => {
                if (!interceptor.serverName || interceptor.serverName === serverName) {
                    instance!.interceptors.response.use(
                        interceptor.onResponse,
                        interceptor.onResponseError
                    );
                }
            });

            this.axiosInstances.set(instanceKey, instance);
        }

        return instance;
    }

    /**
     * 发送HTTP请求(单次请求,不含重试逻辑)
     * @returns 包含响应数据和请求记录的结果
     */
    private async sendOnce<T, R>(
        serverName: string,
        addressIndex: number,
        path: string,
        method: HttpMethod,
        request: T,
        attemptNumber: number,
        cancelTokenSource?: CancelTokenSource
    ): Promise<{ response: ResponseWrapper<R>; record: ServerAttemptRecord }> {
        const config = this.serverMap.get(serverName);
        if (!config) {
            const now = Date.now();
            return {
                response: {
                    code: APIErrorCode.SERVER_NOT_FOUND,
                    message: ERROR_MESSAGES.SERVER_NOT_INITIALIZED(serverName)
                },
                record: {
                    addressName: 'unknown',
                    addressIndex,
                    attemptNumber,
                    startTime: now,
                    endTime: now,
                    responseTime: 0,
                    success: false,
                    errorCode: APIErrorCode.SERVER_NOT_FOUND,
                    errorMessage: ERROR_MESSAGES.SERVER_NOT_INITIALIZED(serverName)
                }
            };
        }

        const address = config.addresses[addressIndex];
        const instanceKey = this.getInstanceKey(serverName, addressIndex);
        const axiosInstance = this.axiosInstances.get(instanceKey);

        if (!axiosInstance) {
            const now = Date.now();
            return {
                response: {
                    code: APIErrorCode.AXIOS_INSTANCE_NOT_FOUND,
                    message: ERROR_MESSAGES.INSTANCE_NOT_FOUND(instanceKey)
                },
                record: {
                    addressName: address.addressName,
                    addressIndex,
                    attemptNumber,
                    startTime: now,
                    endTime: now,
                    responseTime: 0,
                    success: false,
                    errorCode: APIErrorCode.AXIOS_INSTANCE_NOT_FOUND,
                    errorMessage: ERROR_MESSAGES.INSTANCE_NOT_FOUND(instanceKey)
                }
            };
        }

        // 记录请求开始时间
        const startTime = Date.now();
        this.metrics.totalRequests++;

        // 初始化地址指标
        if (!this.metrics.addressMetrics.has(address.addressName)) {
            this.metrics.addressMetrics.set(address.addressName, {
                requests: 0,
                failures: 0,
                totalResponseTime: 0
            });
        }
        const addressMetric = this.metrics.addressMetrics.get(address.addressName)!;
        addressMetric.requests++;

        try {
            const axiosConfig: AxiosRequestConfig = {
                url: path,
                method,
                cancelToken: cancelTokenSource?.token,
                ...(method === HttpMethod.GET ? {params: request} : {data: request})
            };

            const response: AxiosResponse<ResponseWrapper<R>> = await axiosInstance.request(axiosConfig);

            // 记录成功指标
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            this.metrics.successfulRequests++;
            this.metrics.totalResponseTime += responseTime;
            addressMetric.totalResponseTime += responseTime;

            return {
                response: response.data,
                record: {
                    addressName: address.addressName,
                    addressIndex,
                    attemptNumber,
                    startTime,
                    endTime,
                    responseTime,
                    success: true,
                    status: response.status,
                    statusText: response.statusText
                }
            };
        } catch (error) {
            // 记录响应时间
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            this.metrics.totalResponseTime += responseTime;
            addressMetric.totalResponseTime += responseTime;

            // 处理取消请求
            if (axios.isCancel(error)) {
                this.metrics.cancelledRequests++;
                return {
                    response: {
                        code: APIErrorCode.REQUEST_CANCELLED,
                        message: error.message || '请求已取消'
                    },
                    record: {
                        addressName: address.addressName,
                        addressIndex,
                        attemptNumber,
                        startTime,
                        endTime,
                        responseTime,
                        success: false,
                        errorCode: APIErrorCode.REQUEST_CANCELLED,
                        errorMessage: error.message || '请求已取消'
                    }
                };
            }

            // 记录失败指标
            this.metrics.failedRequests++;
            addressMetric.failures++;

            // 统一封装网络错误
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                return {
                    response: {
                        code: axiosError.code || APIErrorCode.NETWORK_ERROR,
                        message: axiosError.message || '网络请求失败',
                        extra: {
                            serverName,
                            addressName: address.addressName,
                            status: axiosError.response?.status,
                            statusText: axiosError.response?.statusText
                        }
                    },
                    record: {
                        addressName: address.addressName,
                        addressIndex,
                        attemptNumber,
                        startTime,
                        endTime,
                        responseTime,
                        success: false,
                        errorCode: axiosError.code || APIErrorCode.NETWORK_ERROR,
                        errorMessage: axiosError.message || '网络请求失败',
                        status: axiosError.response?.status,
                        statusText: axiosError.response?.statusText
                    }
                };
            }

            return {
                response: {
                    code: APIErrorCode.UNKNOWN_ERROR,
                    message: error instanceof Error ? error.message : '未知错误'
                },
                record: {
                    addressName: address.addressName,
                    addressIndex,
                    attemptNumber,
                    startTime,
                    endTime,
                    responseTime,
                    success: false,
                    errorCode: APIErrorCode.UNKNOWN_ERROR,
                    errorMessage: error instanceof Error ? error.message : '未知错误'
                }
            };
        }
    }

    /**
     * 运行API请求(主入口)
     */
    async runApi<T, R>(
        serverName: string,
        path: string,
        method: HttpMethod,
        requestWrapper: RequestWrapper<T>,
        cancelTokenSource?: CancelTokenSource
    ): Promise<ResponseWrapper<R>> {
        const config = this.serverMap.get(serverName);
        if (!config) {
            return {
                code: APIErrorCode.SERVER_NOT_FOUND,
                message: ERROR_MESSAGES.SERVER_NOT_INITIALIZED(serverName),
                extra: {
                    serverName,
                    path,
                    method,
                    requestExtra: requestWrapper.extra
                }
            };
        }

        // 请求队列和限流控制
        try {
            return await this.requestQueue.enqueue(async () => {
                return await this.executeWithCircuitBreaker<T, R>(
                    serverName,
                    path,
                    method,
                    requestWrapper,
                    config,
                    cancelTokenSource
                );
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Rate limit exceeded') {
                return {
                    code: APIErrorCode.RATE_LIMIT_EXCEEDED,
                    message: '请求频率超过限制',
                    extra: {
                        serverName,
                        path,
                        method,
                        requestExtra: requestWrapper.extra
                    }
                };
            }
            throw error;
        }
    }

    /**
     * 通过断路器执行请求(支持轮询重试)
     */
    private async executeWithCircuitBreaker<T, R>(
        serverName: string,
        path: string,
        method: HttpMethod,
        requestWrapper: RequestWrapper<T>,
        config: ServerConfig,
        cancelTokenSource?: CancelTokenSource
    ): Promise<ResponseWrapper<R>> {
        const {addresses, retryCount, retryInterval} = config;
        const totalAddresses = addresses.length;
        let attemptCount = 0;
        const maxAttempts = retryCount + 1; // 总尝试次数 = 重试次数 + 1

        // 记录所有尝试
        const attemptRecords: ServerAttemptRecord[] = [];
        const requestStartTime = Date.now();

        // 轮询所有地址,直到成功或达到最大尝试次数
        let skippedCount = 0; // 跳过的断路器数量
        const maxSkipped = totalAddresses * PERFORMANCE_CONFIG.SKIP_MULTIPLIER; // 防止无限循环
        const startAddressIndex = config.lastSuccessfulAddressIndex; // 从上次成功的地址开始

        while (attemptCount < maxAttempts) {
            // 计算当前应该使用的地址索引(从上次成功的地址开始轮询)
            const addressIndex = (startAddressIndex + attemptCount) % totalAddresses;
            const circuitBreakerKey = this.getInstanceKey(serverName, addressIndex);
            const circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);

            if (!circuitBreaker) {
                return {
                    code: APIErrorCode.UNKNOWN_ERROR,
                    message: ERROR_MESSAGES.CIRCUIT_BREAKER_NOT_INITIALIZED,
                    extra: {
                        serverName,
                        path,
                        method,
                        totalAttempts: attemptCount,
                        totalResponseTime: Date.now() - requestStartTime,
                        attemptRecords,
                        requestExtra: requestWrapper.extra
                    }
                };
            }

            const circuitBreakerState = circuitBreaker.getState();

            // 如果断路器打开,跳过此地址(不计入尝试次数)
            if (circuitBreakerState === CircuitState.OPEN) {
                skippedCount++;

                // 记录被跳过的尝试
                const address = addresses[addressIndex];
                attemptRecords.push({
                    addressName: address.addressName,
                    addressIndex,
                    attemptNumber: attemptCount + 1,
                    startTime: Date.now(),
                    endTime: Date.now(),
                    responseTime: 0,
                    success: false,
                    skipped: true,
                    circuitBreakerState: CircuitState.OPEN,
                    errorCode: APIErrorCode.CIRCUIT_BREAKER_OPEN,
                    errorMessage: '断路器已打开,跳过此服务器'
                });

                // 如果所有断路器都打开,避免无限循环
                if (skippedCount >= maxSkipped) {
                    return {
                        code: APIErrorCode.CIRCUIT_BREAKER_OPEN,
                        message: ERROR_MESSAGES.ALL_CIRCUIT_BREAKERS_OPEN(serverName),
                        extra: {
                            serverName,
                            path,
                            method,
                            totalAttempts: attemptCount,
                            totalResponseTime: Date.now() - requestStartTime,
                            attemptRecords,
                            requestExtra: requestWrapper.extra
                        }
                    };
                }
                attemptCount++; // 仅递增索引,不计入实际尝试
                await this.delay(retryInterval);
                continue;
            }

            try {
                // 通过断路器执行请求
                const {response, record} = await circuitBreaker.execute(async () => {
                    return await this.sendOnce<T, R>(
                        serverName,
                        addressIndex,
                        path,
                        method,
                        requestWrapper.request,
                        attemptCount + 1,
                        cancelTokenSource
                    );
                });

                // 添加断路器状态到记录
                record.circuitBreakerState = circuitBreakerState;
                attemptRecords.push(record);

                // 如果是网络错误,继续重试
                if (this.isNetworkError(response.code)) {
                    throw new Error(response.message || 'Network error');
                }

                // 成功,记录当前成功的地址索引
                config.lastSuccessfulAddressIndex = addressIndex;

                // 成功,返回结果并附加所有尝试记录和请求extra
                const totalResponseTime = Date.now() - requestStartTime;
                return {
                    ...response,
                    extra: {
                        ...response.extra,
                        serverName,
                        path,
                        method,
                        totalAttempts: attemptCount + 1,
                        totalResponseTime,
                        attemptRecords,
                        requestExtra: requestWrapper.extra
                    }
                };
            } catch (error) {
                // 重置跳过计数(说明有可用的断路器)
                skippedCount = 0;
                attemptCount++;

                // 断路器打开错误(理论上不应该到这里,因为上面已经检查过)
                if (error instanceof Error && error.message === 'Circuit breaker is OPEN') {
                    continue;
                }

                // 网络错误,如果还有重试机会,等待后继续
                if (attemptCount < maxAttempts) {
                    await this.delay(retryInterval);
                    continue;
                }
            }
        }

        // 所有尝试都失败了
        const totalResponseTime = Date.now() - requestStartTime;
        return {
            code: APIErrorCode.ALL_SERVERS_FAILED,
            message: ERROR_MESSAGES.ALL_SERVERS_FAILED(serverName),
            extra: {
                serverName,
                path,
                method,
                totalAttempts: attemptCount,
                totalResponseTime,
                attemptRecords,
                requestExtra: requestWrapper.extra
            }
        };
    }

    /**
     * 判断是否为网络错误
     */
    private isNetworkError(code: string): boolean {
        return NETWORK_ERROR_CODES.has(code) || code === APIErrorCode.NETWORK_ERROR;
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取队列统计信息
     */
    getQueueStats() {
        return this.requestQueue.getStats();
    }

    /**
     * 获取请求指标
     */
    getMetrics(): RequestMetrics {
        // 自动清理过期的metrics
        this.pruneMetricsIfNeeded();

        const addressMetrics: Record<string, {
            requests: number;
            failures: number;
            avgResponseTime: number;
        }> = {};

        this.metrics.addressMetrics.forEach((metric, addressName) => {
            addressMetrics[addressName] = {
                requests: metric.requests,
                failures: metric.failures,
                avgResponseTime: metric.requests > 0
                    ? metric.totalResponseTime / metric.requests
                    : 0
            };
        });

        return {
            totalRequests: this.metrics.totalRequests,
            successfulRequests: this.metrics.successfulRequests,
            failedRequests: this.metrics.failedRequests,
            cancelledRequests: this.metrics.cancelledRequests,
            avgResponseTime: this.metrics.totalRequests > 0
                ? this.metrics.totalResponseTime / this.metrics.totalRequests
                : 0,
            addressMetrics
        };
    }

    /**
     * 清理metrics以防止内存泄漏
     */
    private pruneMetricsIfNeeded(): void {
        if (this.metrics.addressMetrics.size > PERFORMANCE_CONFIG.MAX_METRICS_ENTRIES) {
            // 转换为数组并按请求次数排序,保留活跃度高的条目
            const entries = Array.from(this.metrics.addressMetrics.entries());
            entries.sort((a, b) => b[1].requests - a[1].requests);

            // 只保留前MAX_METRICS_ENTRIES个条目
            this.metrics.addressMetrics.clear();
            entries.slice(0, PERFORMANCE_CONFIG.MAX_METRICS_ENTRIES).forEach(([key, value]) => {
                this.metrics.addressMetrics.set(key, value);
            });
        }
    }

    /**
     * 重置指标
     */
    resetMetrics(): void {
        this.metrics.totalRequests = 0;
        this.metrics.successfulRequests = 0;
        this.metrics.failedRequests = 0;
        this.metrics.cancelledRequests = 0;
        this.metrics.totalResponseTime = 0;
        this.metrics.addressMetrics.clear();
    }

    /**
     * 获取断路器状态
     */
    getCircuitBreakerStates(): Record<string, CircuitState> {
        const states: Record<string, CircuitState> = {};
        this.circuitBreakers.forEach((breaker, key) => {
            states[key] = breaker.getState();
        });
        return states;
    }

    /**
     * 重置指定服务器的断路器
     */
    resetCircuitBreaker(serverName: string): void {
        this.circuitBreakers.forEach((breaker, key) => {
            if (key.startsWith(serverName)) {
                breaker.reset();
            }
        });
    }

    /**
     * 清理请求队列(用于释放内存)
     */
    cleanupRequestQueue(): void {
        this.requestQueue.cleanup();
    }

    /**
     * 获取请求队列大小
     */
    getRequestQueueSize(): number {
        return this.requestQueue.getQueueSize();
    }
}
