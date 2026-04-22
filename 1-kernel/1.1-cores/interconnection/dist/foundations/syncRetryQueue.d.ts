export declare class SyncRetryQueue {
    private queue;
    private retrying;
    private readonly maxRetries;
    private readonly retryInterval;
    private readonly maxQueueSize;
    private retryTimer;
    constructor(maxRetries?: number, retryInterval?: number, maxQueueSize?: number);
    enqueue(stateKey: string, changes: Record<string, any>): void;
    private scheduleRetry;
    private processQueue;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=syncRetryQueue.d.ts.map