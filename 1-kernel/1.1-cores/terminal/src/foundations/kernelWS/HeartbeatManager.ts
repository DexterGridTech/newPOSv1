/**
 * Kernel WebSocket 心跳管理器
 * 服务器主动发送心跳,客户端被动响应模式
 */
import { moduleName } from '../../moduleName';
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";

export class KernelHeartbeatManager {
  private heartbeatTimeout: number;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private onTimeout: () => void;

  constructor(
    heartbeatTimeout: number,
    onTimeout: () => void
  ) {
    this.heartbeatTimeout = heartbeatTimeout;
    this.onTimeout = onTimeout;
  }

  /**
   * 启动心跳超时检查
   */
  start(): void {
    this.stop();
    this.startTimeoutCheck();
    logger.log([moduleName, LOG_TAGS.WebSocket, "HeartbeatManager"], `[KernelHeartbeat] Started, timeout: ${this.heartbeatTimeout}ms`);
  }

  /**
   * 启动超时检查
   */
  private startTimeoutCheck(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
    }

    this.heartbeatTimeoutTimer = setTimeout(() => {
      logger.warn([moduleName, LOG_TAGS.WebSocket, "HeartbeatManager"], '[KernelHeartbeat] Timeout detected');
      this.onTimeout();
    }, this.heartbeatTimeout);
  }

  /**
   * 重置超时定时器(收到服务器心跳时调用)
   */
  resetTimeout(): void {
    this.startTimeoutCheck();
  }

  /**
   * 停止心跳检查
   */
  stop(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }

    logger.log([moduleName, LOG_TAGS.WebSocket, "HeartbeatManager"], '[KernelHeartbeat] Stopped');
  }
}
