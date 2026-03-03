/**
 * Kernel WebSocket 客户端
 * 用于连接 Kernel 服务器的 WebSocket 客户端
 * 单例模式,与 MasterWebSocketClient 完全隔离
 */

import {now} from 'lodash';
import {
  IKernelWebSocketClient,
  KernelWebSocketClientConfig,
  KernelConnectionState,
  KernelConnectionEventType,
  KernelMessageWrapper,
  KernelMessageType,
  KernelSendMessageOptions,
  KernelStateChangeEvent,
  KernelConnectedEvent,
  KernelConnectFailedEvent,
  KernelDisconnectedEvent,
  KernelMessageEvent,
  KernelErrorEvent,
  KernelConnectionError,
  KernelConnectionErrorType,
} from '../../types';
import { moduleName } from '../../moduleName';
import {KernelEventManager} from "./EventManager";
import {KernelHeartbeatManager} from "./HeartbeatManager";
import {KernelConnectionManager} from "./ConnectionManager";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  connectionTimeout: 10000, // 10秒
  heartbeatInterval: 30000, // 30秒
  heartbeatTimeout: 60000, // 60秒
  autoHeartbeatResponse: true,
  maxQueueSize: 100,
};

/**
 * 消息去重缓存配置
 */
const MESSAGE_DEDUP_CONFIG = {
  MAX_CACHE_SIZE: 1000,
  MESSAGE_TTL: 5 * 60 * 1000, // 5分钟
  CLEANUP_INTERVAL: 60 * 1000, // 1分钟
};

/**
 * Kernel WebSocket 客户端
 */
export class KernelWebSocketClient implements IKernelWebSocketClient {
  private static instance: KernelWebSocketClient | null = null;

  private config: KernelWebSocketClientConfig | null = null;
  private state: KernelConnectionState = KernelConnectionState.DISCONNECTED;
  private isDestroyed: boolean = false;

  private eventManager: KernelEventManager;
  private heartbeatManager: KernelHeartbeatManager | null = null;
  private connectionManager: KernelConnectionManager | null = null;

  // 消息去重缓存
  private processedMessageCache = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // 保存全局错误处理器引用,用于清理
  private globalErrorHandlers = new Map<KernelConnectionEventType, Function>();

  // 防重入标志
  private isDisconnecting: boolean = false;

  private constructor() {
    this.eventManager = new KernelEventManager();
    this.startMessageCacheCleanup();
    this.registerGlobalErrorHandlers();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): KernelWebSocketClient {
    if (!KernelWebSocketClient.instance) {
      KernelWebSocketClient.instance = new KernelWebSocketClient();
    }
    return KernelWebSocketClient.instance;
  }

  /**
   * 连接到服务器
   */
  async connect(config: KernelWebSocketClientConfig): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('KernelWebSocketClient 已销毁,无法重新连接');
    }

    if (this.state !== KernelConnectionState.DISCONNECTED) {
      throw new Error(`当前状态不允许连接: ${this.state}`);
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    try {
      this.setState(KernelConnectionState.CONNECTING);

      this.connectionManager = new KernelConnectionManager(
        this.config.maxQueueSize!,
        this.handleWebSocketOpen.bind(this),
        this.handleWebSocketClose.bind(this),
        this.handleWebSocketError.bind(this),
        this.handleWebSocketMessage.bind(this)
      );

      await this.connectionManager.connect(
        this.config.api,
        this.config.deviceId,
        this.config.token,
        this.config.connectionTimeout!
      );

    } catch (error) {
      const connectionError = error as KernelConnectionError;
      this.setState(KernelConnectionState.ERROR);  // 先设置为 ERROR
      this.emitConnectFailed(connectionError);
      this.cleanup();
      this.setState(KernelConnectionState.DISCONNECTED);  // 最后设置为 DISCONNECTED
      throw connectionError;
    }
  }

  /**
   * 断开连接
   */
  disconnect(reason?: string): void {
    // 添加防重入检查
    if (this.isDisconnecting) {
      return;
    }

    if (this.state === KernelConnectionState.DISCONNECTED ||
        this.state === KernelConnectionState.DISCONNECTING) {
      return;
    }

    this.isDisconnecting = true;

    try {
      this.setState(KernelConnectionState.DISCONNECTING);

      if (this.heartbeatManager) {
        this.heartbeatManager.stop();
      }

      if (this.connectionManager) {
        this.connectionManager.disconnect(reason);
      }

      this.cleanup();
      this.setState(KernelConnectionState.DISCONNECTED);
      this.emitDisconnected(true, reason);
    } finally {
      this.isDisconnecting = false;
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(type: string, data: any, options?: KernelSendMessageOptions): Promise<void> {
    if (!this.connectionManager) {
      throw new Error('连接管理器未初始化');
    }

    const message: KernelMessageWrapper = {
      type,
      data,
    };

    try {
      this.connectionManager.sendMessage(message);
    } catch (error) {
      throw {
        type: KernelConnectionErrorType.SEND_MESSAGE_FAILED,
        message: '发送消息失败',
        originalError: error,
      } as KernelConnectionError;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === KernelConnectionState.CONNECTED && 
           this.connectionManager?.getIsConnected() === true;
  }

  /**
   * 获取当前状态
   */
  getState(): KernelConnectionState {
    return this.state;
  }

  /**
   * 注册事件监听器
   */
  on(event: KernelConnectionEventType, callback: Function): void {
    this.eventManager.on(event, callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: KernelConnectionEventType, callback: Function): void {
    this.eventManager.off(event, callback);
  }

  /**
   * 销毁客户端
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.disconnect('客户端销毁');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 移除全局错误处理器
    this.globalErrorHandlers.forEach((handler, event) => {
      this.off(event, handler);
    });
    this.globalErrorHandlers.clear();

    this.processedMessageCache.clear();
    this.eventManager.destroy();
    this.isDestroyed = true;

    KernelWebSocketClient.instance = null;
  }

  // ==================== 私有方法 ====================

  /**
   * 设置状态
   */
  private setState(newState: KernelConnectionState): void {
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }

    this.state = newState;
    logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], `[KernelWS] State: ${oldState} -> ${newState}`);

    this.eventManager.emit(KernelConnectionEventType.STATE_CHANGE, {
      oldState,
      newState,
    } as KernelStateChangeEvent);
  }

  /**
   * WebSocket 打开处理
   */
  private handleWebSocketOpen(): void {
    logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] WebSocket opened');

    this.setState(KernelConnectionState.CONNECTED);

    // 启动心跳超时检查
    this.heartbeatManager = new KernelHeartbeatManager(
      this.config!.heartbeatTimeout!,
      this.handleHeartbeatTimeout.bind(this)
    );
    this.heartbeatManager.start();

    const serverUrl = this.connectionManager?.getCurrentServerUrl() || '';
    this.emitConnected(serverUrl);
  }

  /**
   * WebSocket 关闭处理
   */
  private handleWebSocketClose(event: CloseEvent): void {
    logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], `[KernelWS] WebSocket closed: ${event.code} ${event.reason}`);

    if (this.state !== KernelConnectionState.DISCONNECTING) {
      this.emitDisconnected(false, event.reason);
    }

    this.cleanup();
    this.setState(KernelConnectionState.DISCONNECTED);
  }

  /**
   * WebSocket 错误处理
   */
  private handleWebSocketError(event: Event): void {
    logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] WebSocket error:', event);

    this.emitError({
      type: KernelConnectionErrorType.UNKNOWN_ERROR,
      message: 'WebSocket错误',
      originalError: event,
    });
  }

  /**
   * WebSocket 消息处理
   */
  private handleWebSocketMessage(message: KernelMessageWrapper): void {
    // 处理系统消息
    if (message.type === KernelMessageType.HEARTBEAT) {
      this.handleHeartbeatMessage(message);
      return;
    }

    if (message.type === KernelMessageType.CONNECTED) {
      logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Received CONNECTED message:', message.data);
      return;
    }

    // 消息去重检查
    const messageId = this.generateMessageId(message);
    if (this.processedMessageCache.has(messageId)) {
      logger.warn([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Duplicate message ignored:', messageId);
      return;
    }

    // 加入缓存
    this.processedMessageCache.set(messageId, now());

    // 检查缓存大小,超过限制时触发清理
    if (this.processedMessageCache.size > MESSAGE_DEDUP_CONFIG.MAX_CACHE_SIZE) {
      this.cleanupExpiredMessages();
    }

    // 业务消息触发事件
    this.eventManager.emit(KernelConnectionEventType.MESSAGE, {
      message,
    } as KernelMessageEvent);
  }

  /**
   * 处理心跳消息
   */
  private handleHeartbeatMessage(message: KernelMessageWrapper): void {
    if (this.heartbeatManager) {
      this.heartbeatManager.resetTimeout();
    }

    // 自动响应心跳
    if (this.config?.autoHeartbeatResponse) {
      this.sendHeartbeatResponse();
    }
  }


  /**
   * 发送心跳响应
   */
  private sendHeartbeatResponse(): void {
    if (!this.connectionManager) {
      return;
    }

    try {
      this.connectionManager.sendMessage({
        type: KernelMessageType.HEARTBEAT_RESPONSE,
        data: { timestamp: now() },
      });
    } catch (error) {
      logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Failed to send heartbeat response:', error);
    }
  }

  /**
   * 心跳超时处理
   */
  private handleHeartbeatTimeout(): void {
    logger.warn([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Heartbeat timeout');

    // 只触发 HEARTBEAT_TIMEOUT 事件，不触发 ERROR 事件
    // 避免全局错误处理器重复处理
    this.eventManager.emit(KernelConnectionEventType.HEARTBEAT_TIMEOUT, {
      error: {
        type: KernelConnectionErrorType.HEARTBEAT_TIMEOUT,
        message: '心跳超时',
      },
    } as KernelErrorEvent);

    // 直接断开连接，不依赖外部处理器
    if (!this.isDisconnecting && this.state !== KernelConnectionState.DISCONNECTED) {
      this.disconnect('心跳超时');
    }
  }

  /**
   * 触发连接成功事件
   */
  private emitConnected(serverUrl: string): void {
    this.eventManager.emit(KernelConnectionEventType.CONNECTED, {
      serverUrl,
    } as KernelConnectedEvent);
  }

  /**
   * 触发连接失败事件
   */
  private emitConnectFailed(error: KernelConnectionError): void {
    this.eventManager.emit(KernelConnectionEventType.CONNECT_FAILED, {
      error,
    } as KernelConnectFailedEvent);
  }

  /**
   * 触发断开连接事件
   */
  private emitDisconnected(manual: boolean, reason?: string): void {
    this.eventManager.emit(KernelConnectionEventType.DISCONNECTED, {
      manual,
      reason,
    } as KernelDisconnectedEvent);
  }

  /**
   * 触发错误事件
   */
  private emitError(error: KernelConnectionError): void {
    this.eventManager.emit(KernelConnectionEventType.ERROR, {
      error,
    } as KernelErrorEvent);
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
      this.heartbeatManager = null;
    }

    if (this.connectionManager) {
      this.connectionManager = null;
    }
  }

  /**
   * 生成消息ID用于去重
   */
  private generateMessageId(message: KernelMessageWrapper): string {
    // 根据消息类型和数据生成唯一ID
    // 如果消息数据中有唯一ID字段，优先使用
    if (message.data?.id) {
      return `${message.type}_${message.data.id}`;
    }

    // 否则基于消息内容生成哈希
    const content = JSON.stringify({ type: message.type, data: message.data });
    return this.simpleHash(content);
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 注册全局错误处理器
   */
  private registerGlobalErrorHandlers(): void {
    // 连接失败时断开
    const connectFailedHandler = (event: KernelConnectFailedEvent) => {
      logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS]', event.error.message);
      if (!this.isDisconnecting && this.state !== KernelConnectionState.DISCONNECTED) {
        this.isDisconnecting = true;
        try {
          this.disconnect('连接失败');
        } catch (error) {
          logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Error during disconnect:', error);
        } finally {
          this.isDisconnecting = false;
        }
      }
    };

    // 错误时断开
    const errorHandler = (event: KernelErrorEvent) => {
      logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS]', event.error.message);
      if (!this.isDisconnecting && this.state !== KernelConnectionState.DISCONNECTED) {
        this.isDisconnecting = true;
        try {
          this.disconnect('连接错误');
        } catch (error) {
          logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS] Error during disconnect:', error);
        } finally {
          this.isDisconnecting = false;
        }
      }
    };

    // 心跳超时时断开 - 由于心跳超时已经在handleHeartbeatTimeout中处理，这里不再重复断开
    const heartbeatTimeoutHandler = (event: KernelErrorEvent) => {
      logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '[KernelWS]', event.error.message);
      // 心跳超时已在handleHeartbeatTimeout中直接断开连接，此处仅记录日志
    };

    // 注册并保存引用
    this.on(KernelConnectionEventType.CONNECT_FAILED, connectFailedHandler);
    this.on(KernelConnectionEventType.ERROR, errorHandler);
    this.on(KernelConnectionEventType.HEARTBEAT_TIMEOUT, heartbeatTimeoutHandler);

    this.globalErrorHandlers.set(KernelConnectionEventType.CONNECT_FAILED, connectFailedHandler);
    this.globalErrorHandlers.set(KernelConnectionEventType.ERROR, errorHandler);
    this.globalErrorHandlers.set(KernelConnectionEventType.HEARTBEAT_TIMEOUT, heartbeatTimeoutHandler);
  }

  /**
   * 启动消息缓存清理定时器
   */
  private startMessageCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, MESSAGE_DEDUP_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * 清理过期的消息缓存
   */
  private cleanupExpiredMessages(): void {
    const currentTime = now();
    const expiredKeys: string[] = [];

    // 检查过期消息
    this.processedMessageCache.forEach((timestamp, messageId) => {
      if (currentTime - timestamp > MESSAGE_DEDUP_CONFIG.MESSAGE_TTL) {
        expiredKeys.push(messageId);
      }
    });

    // 删除过期消息
    expiredKeys.forEach(key => this.processedMessageCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], `[KernelWS] Cleaned ${expiredKeys.length} expired message cache entries`);
    }

    // 如果还超过大小限制,删除最旧的消息
    if (this.processedMessageCache.size > MESSAGE_DEDUP_CONFIG.MAX_CACHE_SIZE) {
      const entries = Array.from(this.processedMessageCache.entries());
      entries.sort((a, b) => a[1] - b[1]); // 按时间戳排序

      const deleteCount = this.processedMessageCache.size - MESSAGE_DEDUP_CONFIG.MAX_CACHE_SIZE;
      for (let i = 0; i < deleteCount; i++) {
        this.processedMessageCache.delete(entries[i][0]);
      }

      logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], `[KernelWS] Cleaned ${deleteCount} oldest messages due to size limit`);
    }
  }
}
