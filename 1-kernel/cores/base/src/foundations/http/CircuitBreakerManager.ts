/**
 * 断路器管理器
 * 负责断路器的创建、状态管理和执行控制
 */

import { CircuitState, DEFAULT_CONFIG } from '../../types/shared/http';


/**
 * 断路器类
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number = 0;
    private executingPromise: Promise<any> | null = null; // 使用 Promise 实现原子操作

    constructor(
        private threshold: number = DEFAULT_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
        private timeout: number = DEFAULT_CONFIG.CIRCUIT_BREAKER_TIMEOUT
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // 检查状态
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.timeout) {
                // 转换到 HALF_OPEN 状态
                this.state = CircuitState.HALF_OPEN;
                this.successCount = 0;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        // HALF_OPEN 状态只允许一个请求（原子操作）
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.executingPromise) {
                throw new Error('Circuit breaker is HALF_OPEN, only one request allowed');
            }
        }

        // 创建执行 Promise（原子操作）
        const executePromise = (async () => {
            try {
                const result = await fn();
                this.onSuccess();
                return result;
            } catch (error) {
                this.onFailure();
                throw error;
            }
        })();

        // 保存当前执行的 Promise
        this.executingPromise = executePromise;

        // 执行完成后清除标志
        executePromise.finally(() => {
            if (this.executingPromise === executePromise) {
                this.executingPromise = null;
            }
        });

        return executePromise;
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
