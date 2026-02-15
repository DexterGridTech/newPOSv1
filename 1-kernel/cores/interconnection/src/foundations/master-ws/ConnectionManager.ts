import {
  DeviceRegistration,
  RegistrationResponse,
  MessageWrapper,
  ConnectionError,
  ConnectionErrorType,
} from '../../types/foundations/masterWS';
import {logger} from "@impos2/kernel-core-base";
import { LOG_TAGS } from "@impos2/kernel-core-base";
import { moduleName } from '../../moduleName';
import axios from "axios";

/**
 * WebSocket 连接管理器
 * 负责 HTTP 注册、WebSocket 连接和消息收发
 */
export class MasterConnectionManager {
  private ws: WebSocket | null = null;
  private currentServerUrl: string | null = null;
  private isConnected: boolean = false;
  private messageQueue: MessageWrapper[] = [];
  private maxQueueSize: number;
  private cleanupFunctions: Array<() => void> = [];

  private onOpenCallback: () => void;
  private onCloseCallback: (event: any) => void;
  private onErrorCallback: (event: Event) => void;
  private onMessageCallback: (message: MessageWrapper) => void;

  constructor(
    maxQueueSize: number,
    onOpenCallback: () => void,
    onCloseCallback: (event: any) => void,
    onErrorCallback: (event: Event) => void,
    onMessageCallback: (message: MessageWrapper) => void
  ) {
    this.maxQueueSize = maxQueueSize;
    this.onOpenCallback = onOpenCallback;
    this.onCloseCallback = onCloseCallback;
    this.onErrorCallback = onErrorCallback;
    this.onMessageCallback = onMessageCallback;
  }

  /**
   * 尝试连接到服务器列表
   */
  async connect(
    serverUrls: string[],
    deviceRegistration: DeviceRegistration,
    connectionTimeout: number
  ): Promise<void> {
    let lastError: ConnectionError | null = null;

    // 逐个尝试连接服务器
    for (const serverUrl of serverUrls) {
      try {
        await this.connectToServer(serverUrl, deviceRegistration, connectionTimeout);
        return; // 连接成功,返回
      } catch (error:Error|any) {
        lastError = error as ConnectionError;
      }
    }

    // 所有服务器都连接失败
    throw {
      type: ConnectionErrorType.ALL_SERVERS_FAILED,
      message: `所有服务器都连接失败`,
      originalError: lastError?.originalError,
    } as ConnectionError;
  }

  /**
   * 连接到单个服务器
   */
  private async connectToServer(
    serverUrl: string,
    deviceRegistration: DeviceRegistration,
    connectionTimeout: number
  ): Promise<void> {
    // 步骤1: HTTP 注册
    const token = await this.registerDevice(serverUrl, deviceRegistration, connectionTimeout);

    // 保存连接信息（需在 connectWebSocket 之前赋值，因为 onOpenCallback 会读取）
    this.currentServerUrl = serverUrl;

    // 步骤2: WebSocket 连接
    await this.connectWebSocket(serverUrl, token, connectionTimeout);
  }

  /**
   * HTTP 注册设备
   */
  private async registerDevice(
    serverUrl: string,
    deviceRegistration: DeviceRegistration,
    timeout: number
  ): Promise<string> {
    try {
      const registerUrl = `${serverUrl}/register`;

      const { data: response } = await axios.post<RegistrationResponse>(
        registerUrl,
        deviceRegistration,
        { timeout }
      );

      if (!response.success || !response.token) {

        logger.error([moduleName,LOG_TAGS.Http,"WSClient"],`注册失败:${registerUrl}`,deviceRegistration);
        throw {
          type: ConnectionErrorType.REGISTRATION_FAILED,
          message: response.error || '注册失败',
          serverUrl,
        } as ConnectionError;
      }

      return response.token;
    } catch (error: Error|any) {
      logger.error([moduleName,LOG_TAGS.Http,"WSClient"],`HTTP注册失败:${serverUrl}`,error.code);
      throw {
        type: ConnectionErrorType.REGISTRATION_FAILED,
        message: error.message || 'HTTP注册失败',
        originalError: error,
        serverUrl,
      } as ConnectionError;
    }
  }

  /**
   * 建立 WebSocket 连接
   * 使用 addEventListener 替代 onopen/onerror 等赋值方式,防止内存泄漏
   */
  private connectWebSocket(serverUrl: string, token: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      // 清理连接阶段的资源（只清理超时定时器）
      const clearConnectionTimeout = () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      };

      try {
        const wsUrl = this.buildWebSocketUrl(serverUrl, token);
        this.ws = new WebSocket(wsUrl);

        // 连接超时定时器
        timeoutTimer = setTimeout(() => {
          if (!resolved && this.ws && this.ws.readyState !== WebSocket.OPEN) {
            resolved = true;
            this.ws.close();
            reject({
              type: ConnectionErrorType.CONNECTION_TIMEOUT,
              message: `WebSocket连接超时 (${timeout}ms)`,
              serverUrl,
            } as ConnectionError);
          }
        }, timeout);

        // 定义事件处理器
        const onOpen = () => {
          if (resolved) return;
          resolved = true;
          clearConnectionTimeout();
          this.isConnected = true;
          this.onOpenCallback();
          this.flushMessageQueue();
          resolve();
        };

        const onClose = (event: any) => {
          clearConnectionTimeout();
          this.isConnected = false;
          this.onCloseCallback(event);
        };

        const onError = (event: Event) => {
          this.onErrorCallback(event);
          if (!resolved && !this.isConnected) {
            resolved = true;
            clearConnectionTimeout();
            reject({
              type: ConnectionErrorType.WEBSOCKET_FAILED,
              message: 'WebSocket连接失败',
              serverUrl,
            } as ConnectionError);
          }
        };

        const onMessage = (event: any) => {
          try {
            const message: MessageWrapper = JSON.parse(event.data);
            this.onMessageCallback(message);
          } catch (error) {
            logger.error([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '消息解析错误:', error);
          }
        };

        // 使用 addEventListener 注册事件监听器
        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('close', onClose);
        this.ws.addEventListener('error', onError);
        this.ws.addEventListener('message', onMessage);

        // 注册清理函数: 断开连接时移除事件监听器
        this.cleanupFunctions.push(() => {
          if (this.ws) {
            this.ws.removeEventListener('open', onOpen);
            this.ws.removeEventListener('close', onClose);
            this.ws.removeEventListener('error', onError);
            this.ws.removeEventListener('message', onMessage);
          }
        });

      } catch (error: Error|any) {
        logger.error([moduleName,LOG_TAGS.Http,"WSClient"],`WebSocket创建失败:${serverUrl}`,error.code);
        resolved = true;
        clearConnectionTimeout();
        reject({
          type: ConnectionErrorType.WEBSOCKET_FAILED,
          message: error.message || 'WebSocket创建失败',
          originalError: error,
          serverUrl,
        } as ConnectionError);
      }
    });
  }

  /**
   * 构造 WebSocket URL
   */
  private buildWebSocketUrl(httpUrl: string, token: string): string {
    // 将 HTTP URL 转换为 WebSocket URL
    const url = new URL(httpUrl);
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${url.host}${url.pathname}/ws?token=${token}`;
    return wsUrl;
  }

  /**
   * 发送消息
   */
  sendMessage(message: MessageWrapper, waitForConnection: boolean = false): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 已连接,直接发送
      this.ws.send(JSON.stringify(message));
    } else if (waitForConnection) {
      // 等待连接,加入队列
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push(message);
      } else {
        console.warn('消息队列已满,丢弃消息:', message);
      }
    } else {
      throw new Error('WebSocket未连接');
    }
  }

  /**
   * 刷新消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * 断开连接
   * 确保清理所有事件监听器和定时器
   * 注意：先关闭 WebSocket，再清理监听器，避免竞态条件
   */
  disconnect(reason?: string): void {
    // 先清理所有资源（包括事件监听器），再关闭 WebSocket
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];

    if (this.ws) {
      this.isConnected = false;
      this.ws.close(1000, reason);
      this.ws = null;
    }

    this.currentServerUrl = null;
    this.messageQueue = [];
  }

  /**
   * 获取连接状态
   */
  getIsConnected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取当前服务器 URL
   */
  getCurrentServerUrl(): string | null {
    return this.currentServerUrl;
  }

  /**
   * 获取 WebSocket 实例
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  /**
   * 销毁连接管理器
   * 确保释放所有资源
   */
  destroy(): void {
    this.disconnect();
    this.messageQueue = [];
    this.cleanupFunctions = [];
  }
}
