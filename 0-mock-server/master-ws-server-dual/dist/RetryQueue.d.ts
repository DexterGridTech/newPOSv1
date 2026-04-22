import WebSocket from 'ws';
import { MessageWrapper } from './types';
import { Logger } from './Logger';
export declare class RetryQueue {
    private queue;
    private timer;
    private logger;
    private timeoutMs;
    private onTimeout;
    constructor(timeoutMs: number, logger: Logger, onTimeout: () => void);
    enqueue(message: MessageWrapper): void;
    flush(socket: WebSocket): boolean;
    clear(): void;
    get size(): number;
    private startTimer;
    private stopTimer;
}
//# sourceMappingURL=RetryQueue.d.ts.map