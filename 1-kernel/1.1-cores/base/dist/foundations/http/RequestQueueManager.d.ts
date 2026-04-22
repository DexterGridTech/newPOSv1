/**
 * 请求队列管理器
 * 负责请求队列管理、并发控制和限流
 */
/**
 * 请求队列类
 */
export declare class RequestQueue {
    private maxConcurrent;
    private rateLimitWindow;
    private rateLimitMax;
    private queue;
    private activeCount;
    private requestTimestamps;
    constructor(maxConcurrent?: number, rateLimitWindow?: number, rateLimitMax?: number);
    enqueue<T>(fn: () => Promise<T>): Promise<T>;
    private checkRateLimit;
    private recordRequest;
    getStats(): {
        activeCount: number;
        queueLength: number;
        recentRequestCount: number;
    };
    /**
     * 清理队列和时间戳,用于内存管理
     * 注意：这会拒绝所有等待中的请求
     */
    cleanup(): void;
    /**
     * 获取当前队列大小
     */
    getQueueSize(): number;
}
//# sourceMappingURL=RequestQueueManager.d.ts.map