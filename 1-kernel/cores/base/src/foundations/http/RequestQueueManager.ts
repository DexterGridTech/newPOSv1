/**
 * 请求队列管理器
 * 负责请求队列管理、并发控制和限流
 */

import { DEFAULT_CONFIG, PERFORMANCE_CONFIG } from '../../types/shared/http';
import {now} from 'lodash';


/**
 * 请求队列类
 */
export class RequestQueue {
    private queue: Array<{resolve: () => void, reject: (reason?: any) => void}> = [];
    private activeCount: number = 0;
    private requestTimestamps: number[] = [];

    constructor(
        private maxConcurrent: number = DEFAULT_CONFIG.MAX_CONCURRENT_REQUESTS,
        private rateLimitWindow: number = DEFAULT_CONFIG.RATE_LIMIT_WINDOW,
        private rateLimitMax: number = DEFAULT_CONFIG.RATE_LIMIT_MAX_REQUESTS
    ) {}

    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
        // 速率限制检查
        this.checkRateLimit();

        // 并发控制
        if (this.activeCount >= this.maxConcurrent) {
            await new Promise<void>((resolve, reject) => this.queue.push({resolve, reject}));
        }

        this.activeCount++;
        this.recordRequest();

        try {
            return await fn();
        } finally {
            this.activeCount--;
            const next = this.queue.shift();
            if (next) next.resolve();
        }
    }

    private checkRateLimit(): void {
        const currentTime = now();
        this.requestTimestamps = this.requestTimestamps.filter(
            timestamp => currentTime - timestamp < this.rateLimitWindow
        );

        if (this.requestTimestamps.length >= this.rateLimitMax) {
            throw new Error('Rate limit exceeded');
        }
    }

    private recordRequest(): void {
        const currentTime = now();
        this.requestTimestamps.push(currentTime);

        // 使用常量替代魔法数字
        if (this.requestTimestamps.length % PERFORMANCE_CONFIG.CLEANUP_INTERVAL === 0 ||
            this.requestTimestamps.length > PERFORMANCE_CONFIG.MAX_TIMESTAMPS) {
            const cleanupTime = now();
            this.requestTimestamps = this.requestTimestamps.filter(
                timestamp => cleanupTime - timestamp < this.rateLimitWindow
            );
        }
    }

    getStats() {
        return {
            activeCount: this.activeCount,
            queueLength: this.queue.length,
            recentRequestCount: this.requestTimestamps.length
        };
    }

    /**
     * 清理队列和时间戳,用于内存管理
     * 注意：这会拒绝所有等待中的请求
     */
    cleanup(): void {
        // 拒绝所有等待中的请求
        const queuedRequests = this.queue;
        this.queue = [];

        // 明确拒绝所有等待的请求，避免内存泄漏
        queuedRequests.forEach(({reject}) => {
            reject(new Error('Request queue cleanup: all pending requests cancelled'));
        });

        // 清空时间戳
        this.requestTimestamps = [];
    }

    /**
     * 获取当前队列大小
     */
    getQueueSize(): number {
        return this.queue.length;
    }
}
