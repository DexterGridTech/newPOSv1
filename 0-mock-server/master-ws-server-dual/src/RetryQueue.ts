import WebSocket from 'ws';
import {MessageWrapper} from './types';
import {Logger} from './Logger';

interface QueuedMessage {
  message: MessageWrapper;
  queuedAt: number;
}

export class RetryQueue {
  private queue: QueuedMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private logger: Logger;
  private timeoutMs: number;
  private onTimeout: () => void;

  constructor(timeoutMs: number, logger: Logger, onTimeout: () => void) {
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.onTimeout = onTimeout;
  }

  enqueue(message: MessageWrapper) {
    this.queue.push({message, queuedAt: Date.now()});
    this.startTimer();
  }

  flush(socket: WebSocket): boolean {
    if (this.queue.length === 0) return true;

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

  private startTimer() {
    if (this.timer) return;
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
    }, 1000) as unknown as NodeJS.Timeout;
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
