import { nanoid } from 'nanoid/non-secure';
import {now} from 'lodash';

import { MessageWrapper, SYSTEM_MESSAGE_TYPES } from '../../types/foundations/masterWS';

/**
 * 心跳管理器
 * 负责心跳检测、心跳响应和超时处理
 */
export class MasterHeartbeatManager {
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatTime: number = 0;
  private heartbeatTimeout: number;
  private autoResponse: boolean;
  private isRunning: boolean = false;
  /** 心跳检查间隔，使用较短的间隔进行周期性检查 */
  private readonly CHECK_INTERVAL: number;
  /** 是否已收到首次心跳 */
  private hasReceivedFirstHeartbeat: boolean = false;
  /** 首次心跳宽限期（等待服务器发送第一个心跳的额外时间） */
  private readonly FIRST_HEARTBEAT_GRACE_PERIOD: number;

  private sendMessageCallback: (message: MessageWrapper) => void;
  private onTimeoutCallback: () => void;
  private deviceName: string;

  constructor(
    deviceName: string,
    heartbeatInterval: number,
    heartbeatTimeout: number,
    autoResponse: boolean,
    sendMessageCallback: (message: MessageWrapper) => void,
    onTimeoutCallback: () => void
  ) {
    this.deviceName = deviceName;
    this.heartbeatTimeout = heartbeatTimeout;
    this.autoResponse = autoResponse;
    this.sendMessageCallback = sendMessageCallback;
    this.onTimeoutCallback = onTimeoutCallback;
    // 检查间隔设为心跳间隔的一半，确保能及时检测超时
    this.CHECK_INTERVAL = Math.max(heartbeatInterval / 2, 5000);
    // 首次心跳宽限期 = 心跳间隔 + 超时时间，确保有足够时间等待服务器的第一个心跳
    this.FIRST_HEARTBEAT_GRACE_PERIOD = heartbeatInterval + heartbeatTimeout;
  }

  /**
   * 启动心跳检测
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.hasReceivedFirstHeartbeat = false;
    this.lastHeartbeatTime = now();
    this.startHeartbeatTimeoutCheck();
  }

  /**
   * 停止心跳检测
   */
  stop(): void {
    this.isRunning = false;
    this.clearTimers();
  }

  /**
   * 处理收到的心跳消息
   */
  handleHeartbeat(message: MessageWrapper): void {
    if (message.type === SYSTEM_MESSAGE_TYPES.HEARTBEAT) {
      // 标记已收到首次心跳
      this.hasReceivedFirstHeartbeat = true;
      // 收到服务器心跳,更新时间
      this.updateHeartbeatTime();

      // 如果启用自动响应,发送心跳响应
      if (this.autoResponse) {
        this.sendHeartbeatResponse(message);
      }
    }
  }

  /**
   * 手动发送心跳响应
   */
  sendHeartbeatResponse(heartbeatMessage: MessageWrapper): void {
    const response: MessageWrapper = {
      from: this.deviceName,
      id: nanoid(),
      type: SYSTEM_MESSAGE_TYPES.HEARTBEAT_ACK,
      data: heartbeatMessage.data,
      targetDevice:null
    };

    this.sendMessageCallback(response);
  }

  /**
   * 更新最后心跳时间
   */
  updateHeartbeatTime(): void {
    this.lastHeartbeatTime = now();

    // 重置超时检查定时器
    this.startHeartbeatTimeoutCheck();
  }

  /**
   * 启动心跳超时检查
   * 使用周期性检查而非一次性超时，避免定时器漂移问题
   */
  private startHeartbeatTimeoutCheck(): void {
    this.clearTimers();

    if (!this.isRunning) {
      return;
    }

    this.heartbeatTimeoutTimer = setTimeout(() => {
      if (!this.isRunning) {
        return;
      }

      const currentTime = now();
      const elapsed = currentTime - this.lastHeartbeatTime;
      // 首次心跳前使用宽限期，之后使用正常超时时间
      const timeout = this.hasReceivedFirstHeartbeat
        ? this.heartbeatTimeout
        : this.FIRST_HEARTBEAT_GRACE_PERIOD;

      if (elapsed >= timeout) {
        this.onTimeoutCallback();
      } else {
        this.startHeartbeatTimeoutCheck();
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * 清理定时器
   */
  private clearTimers(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 获取是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取最后心跳时间
   */
  getLastHeartbeatTime(): number {
    return this.lastHeartbeatTime;
  }

  /**
   * 销毁心跳管理器
   */
  destroy(): void {
    this.stop();
    this.clearTimers();
  }
}
