/**
 * 断路器管理器
 * 负责断路器的创建、状态管理和执行控制
 */

import { CircuitState, DEFAULT_CONFIG } from '../../types';

/**
 * 断路器类
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number = 0;
    private executing: boolean = false; // 添加执行标志位

    constructor(
        private threshold: number = DEFAULT_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
        private timeout: number = DEFAULT_CONFIG.CIRCUIT_BREAKER_TIMEOUT
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // 检查状态
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.timeout) {
                // 只允许第一个请求转换状态
                if (!this.executing) {
                    this.state = CircuitState.HALF_OPEN;
                    this.successCount = 0;
                } else {
                    throw new Error('Circuit breaker is OPEN');
                }
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        // HALF_OPEN状态只允许一个请求
        if (this.state === CircuitState.HALF_OPEN && this.executing) {
            throw new Error('Circuit breaker is HALF_OPEN, only one request allowed');
        }

        this.executing = true;
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        } finally {
            this.executing = false;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.threshold) {
                this.state = CircuitState.CLOSED;
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.threshold) {
            this.state = CircuitState.OPEN;
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
    }
}
