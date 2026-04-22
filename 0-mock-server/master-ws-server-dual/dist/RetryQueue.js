import WebSocket from 'ws';
export class RetryQueue {
    queue = [];
    timer = null;
    logger;
    timeoutMs;
    onTimeout;
    constructor(timeoutMs, logger, onTimeout) {
        this.timeoutMs = timeoutMs;
        this.logger = logger;
        this.onTimeout = onTimeout;
    }
    enqueue(message) {
        this.queue.push({ message, queuedAt: Date.now() });
        this.startTimer();
    }
    flush(socket) {
        if (this.queue.length === 0)
            return true;
        const pending = this.queue;
        this.queue = [];
        for (let i = 0; i < pending.length; i++) {
            if (socket.readyState !== WebSocket.OPEN) {
                this.queue = pending.slice(i);
                return false;
            }
            socket.send(JSON.stringify(pending[i].message));
        }
        this.stopTimer();
        this.logger.debug(`已刷新 ${pending.length} 条缓存消息`);
        return true;
    }
    clear() {
        this.queue = [];
        this.stopTimer();
    }
    get size() {
        return this.queue.length;
    }
    startTimer() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            if (this.queue.length === 0) {
                this.stopTimer();
                return;
            }
            const oldest = this.queue[0];
            if (Date.now() - oldest.queuedAt > this.timeoutMs) {
                this.logger.warn(`消息缓存超时 (${this.timeoutMs}ms)，触发断开`);
                this.clear();
                this.onTimeout();
            }
        }, 1000);
    }
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
//# sourceMappingURL=RetryQueue.js.map