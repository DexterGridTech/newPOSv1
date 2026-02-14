import { nanoid } from 'nanoid/non-secure';

import {
  IWebSocketClient,
  WebSocketClientConfig,
  ConnectionState,
  ConnectionEventType,
  MessageWrapper,
  SendMessageOptions,
  StateChangeEvent,
  ConnectedEvent,
  ConnectFailedEvent,
  DisconnectedEvent,
  MessageEvent,
  ErrorEvent,
  ConnectionError,
  ConnectionErrorType,
  SYSTEM_MESSAGE_TYPES,
} from '../../types/foundations/masterWS';
import { MasterEventManager } from './EventManager';
import { MasterHeartbeatManager } from './HeartbeatManager';
import { MasterConnectionManager } from './ConnectionManager';
import {logger} from "@impos2/kernel-core-base";
import { LOG_TAGS } from "@impos2/kernel-core-base";
import { moduleName } from '../../moduleName';

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
  /** 最大缓存消息数量 */
  MAX_CACHE_SIZE: 1000,
  /** 消息过期时间 (毫秒) - 5分钟 */
  MESSAGE_TTL: 5 * 60 * 1000,
  /** 清理检查间隔 (毫秒) - 1分钟 */
  CLEANUP_INTERVAL: 60 * 1000,
};

/**
 * WebSocket 客户端
 * 单例模式,支持 Master 和 Slave 设备
 */
export class MasterWebSocketClient implements IWebSocketClient {
  private static instance: MasterWebSocketClient | null = null;

  /**
   * 消息去重缓存
   * 使用 Map 保证插入顺序,存储消息ID和时间戳
   */
  private processedMessageCache = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 检查消息是否重复
   * 使用 LRU + TTL 策略进行去重
   */
  private isMessageDuplicated(message: MessageWrapper): boolean {
    const currentTime = Date.now();
    const messageId = message.id;

    // 检查是否已处理过该消息
    if (this.processedMessageCache.has(messageId)) {
      const cachedTime = this.processedMessageCache.get(messageId)!;

      // 检查是否过期
      if (currentTime - cachedTime < MESSAGE_DEDUP_CONFIG.MESSAGE_TTL) {
        logger.warn([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '重复消息,跳过:', message.id);
        return true;
      }

      // 已过期,删除旧记录,允许重新处理
      this.processedMessageCache.delete(messageId);
    }

    // 添加新消息到缓存
    this.processedMessageCache.set(messageId, currentTime);

    // 检查缓存大小,超出限制时清理最旧的条目
    if (this.processedMessageCache.size > MESSAGE_DEDUP_CONFIG.MAX_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    return false;
  }

  /**
   * 清理最旧的缓存条目 (LRU 策略)
   */
  private evictOldestEntries(): void {
    const entriesToRemove = Math.floor(MESSAGE_DEDUP_CONFIG.MAX_CACHE_SIZE * 0.2);
    let removed = 0;

    // Map 保证迭代顺序为插入顺序,所以最先插入的是最旧的
    for (const key of this.processedMessageCache.keys()) {
      if (removed >= entriesToRemove) break;
      this.processedMessageCache.delete(key);
      removed++;
    }
  }

  /**
   * 清理过期的缓存条目 (TTL 策略)
   */
  private cleanupExpiredEntries(): void {
    const currentTime = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, timestamp] of this.processedMessageCache.entries()) {
      if (currentTime - timestamp >= MESSAGE_DEDUP_CONFIG.MESSAGE_TTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.processedMessageCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], `清理过期消息缓存: ${expiredKeys.length} 条`);
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, MESSAGE_DEDUP_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * 停止定期清理任务
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private eventManager: MasterEventManager;
  private heartbeatManager: MasterHeartbeatManager | null = null;
  private connectionManager: MasterConnectionManager | null = null;

  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private config: WebSocketClientConfig | null = null;
  private isDestroyed: boolean = false;
  private isCleaningUp: boolean = false;
  private isConnecting: boolean = false; // 添加并发保护标志位

  private constructor() {
    this.eventManager = new MasterEventManager();
  }

  /**
   * 获取单例实例
   * 注意：事件处理器中调用 disconnect() 是安全的，因为 disconnect() 方法
   * 内部有状态检查，重复调用会被忽略
   */
  static getInstance(): MasterWebSocketClient {
    if (!MasterWebSocketClient.instance) {
      MasterWebSocketClient.instance = new MasterWebSocketClient();

      // 使用局部变量引用实例，避免在回调中调用 getInstance() 造成循环引用
      const instance = MasterWebSocketClient.instance;

      // 连接失败时断开（disconnect 内部有状态检查，重复调用安全）
      instance.on(ConnectionEventType.CONNECT_FAILED, (event: ConnectFailedEvent) => {
        logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], event.error.message)
        instance.disconnect("连接失败")
      });
      // 错误时断开（disconnect 内部有状态检查，重复调用安全）
      instance.on(ConnectionEventType.ERROR, (event: ErrorEvent) => {
        logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], event.error.message)
        instance.disconnect("连接ERROR")
      })
      // 心跳超时时断开（disconnect 内部有状态检查，重复调用安全）
      instance.on(ConnectionEventType.HEARTBEAT_TIMEOUT, (event: ErrorEvent) => {
        logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], event.error.message)
        instance.disconnect("心跳超时")
      })
    }
    return MasterWebSocketClient.instance;
  }

  /**
   * 连接到服务器
   */
  async connect(config: WebSocketClientConfig): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('WebSocketClient 已销毁,无法重新连接');
    }

    // 添加并发保护检查
    if (this.isConnecting) {
      throw new Error('连接操作正在进行中,请勿重复调用');
    }

    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`当前状态不允许连接: ${this.state}`);
    }

    // 设置连接标志位
    this.isConnecting = true;

    // 合并配置
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    try {
      // 更新状态: 注册中
      this.setState(ConnectionState.REGISTERING);

      // 创建连接管理器
      this.connectionManager = new MasterConnectionManager(
        this.config.maxQueueSize!,
        this.handleWebSocketOpen.bind(this),
        this.handleWebSocketClose.bind(this),
        this.handleWebSocketError.bind(this),
        this.handleWebSocketMessage.bind(this)
      );

      // 更新状态: 连接中
      this.setState(ConnectionState.CONNECTING);

      // 尝试连接服务器
      await this.connectionManager.connect(
        this.config.serverUrls,
        this.config.deviceRegistration,
        this.config.connectionTimeout!
      );

      // 连接成功在 handleWebSocketOpen 中处理
    } catch (error) {
      // 重置连接标志位
      this.isConnecting = false;

      this.setState(ConnectionState.ERROR);

      const connectionError = error as ConnectionError;
      this.emitConnectFailed(connectionError);

      // 清理资源
      this.cleanup();

      // cleanup 后状态应为 DISCONNECTED，保持状态一致性
      this.setState(ConnectionState.DISCONNECTED);

      throw connectionError;
    }
  }

  /**
   * 断开连接
   */
  disconnect(reason?: string): void {
    if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING) {
      return;
    }

    this.setState(ConnectionState.DISCONNECTING);

    // 停止心跳
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
    }

    // 断开连接
    if (this.connectionManager) {
      this.connectionManager.disconnect(reason);
    }

    // 清理资源
    this.cleanup();

    // 设置最终状态
    this.setState(ConnectionState.DISCONNECTED);

    // 在资源清理和状态设置后触发断开事件
    this.emitDisconnected(true, reason);
  }

  /**
   * 发送消息
   */
  async sendMessage(type: string, data: any, targetDevice:string|null,options?: SendMessageOptions): Promise<void> {
    // 添加 config 检查
    if (!this.config) {
      throw new Error('客户端未配置，请先调用 connect()');
    }

    if (!this.connectionManager) {
      throw new Error('连接管理器未初始化');
    }

    // 添加连接状态检查
    if (this.state !== ConnectionState.CONNECTED && !options?.waitForConnection) {
      throw new Error(`当前状态不允许发送消息: ${this.state}`);
    }

    const message: MessageWrapper = {
      from: this.config.deviceRegistration.deviceName,
      id: nanoid(),
      type,
      data,
      targetDevice
    };

    const waitForConnection = options?.waitForConnection ?? false;

    try {
      logger.log([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], 'sendMessage', message)
      this.connectionManager.sendMessage(message, waitForConnection);
    } catch (error: any) {
      throw new Error(`发送消息失败: ${error.message}`);
    }
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED &&
           this.connectionManager?.getIsConnected() === true;
  }

  /**
   * 注册事件回调
   */
  on(eventType: ConnectionEventType, callback: Function): void {
    this.eventManager.on(eventType, callback);
  }

  /**
   * 注销事件回调
   */
  off(eventType: ConnectionEventType, callback: Function): void {
    this.eventManager.off(eventType, callback);
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.disconnect();
    this.cleanup();

    this.eventManager.destroy();
    this.isDestroyed = true;

    MasterWebSocketClient.instance = null;
  }

  // ==================== 私有方法 ====================

  /**
   * 设置状态
   */
  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;

    const event: StateChangeEvent = {
      oldState,
      newState,
      timestamp: Date.now(),
    };

    this.eventManager.emit(ConnectionEventType.STATE_CHANGE, event);
  }

  /**
   * WebSocket 连接成功处理
   */
  private handleWebSocketOpen(): void {
    // 重置连接标志位
    this.isConnecting = false;

    this.setState(ConnectionState.CONNECTED);

    // 启动消息去重缓存清理定时器
    this.startCleanupTimer();

    // 启动心跳管理器
    this.heartbeatManager = new MasterHeartbeatManager(
      this.config!.deviceRegistration.deviceName,
      this.config!.heartbeatInterval!,
      this.config!.heartbeatTimeout!,
      this.config!.autoHeartbeatResponse!,
      this.sendHeartbeatMessage.bind(this),
      this.handleHeartbeatTimeout.bind(this)
    );

    this.heartbeatManager.start();

    // 触发连接成功事件
    const event: ConnectedEvent = {
      serverUrl: this.connectionManager!.getCurrentServerUrl()!,
      timestamp: Date.now(),
      deviceInfo: {
        deviceType: this.config!.deviceRegistration.type,
        deviceId: this.config!.deviceRegistration.deviceId,
        deviceName: this.config!.deviceRegistration.deviceName,
      },
    };

    this.eventManager.emit(ConnectionEventType.CONNECTED, event);
  }

  /**
   * WebSocket 关闭处理
   * 添加状态检查，防止在已断开状态下重复触发
   */
  private handleWebSocketClose(event: CloseEvent): void {
    // 如果已经是断开状态，不再重复处理
    if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING) {
      return;
    }

    const wasConnected = this.state === ConnectionState.CONNECTED;
    const wasConnecting = this.state === ConnectionState.CONNECTING || this.state === ConnectionState.REGISTERING;

    // 重置连接标志位
    this.isConnecting = false;

    // 停止心跳
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
    }

    // 清理资源
    this.cleanup();

    this.setState(ConnectionState.DISCONNECTED);

    // 根据状态触发不同事件
    if (wasConnected) {
      // 已连接状态下断开，触发断开事件
      this.emitDisconnected(event.wasClean, event.reason);
    } else if (wasConnecting) {
      // 连接过程中断开，触发连接失败事件
      this.emitConnectFailed({
        type: ConnectionErrorType.WEBSOCKET_FAILED,
        message: '连接过程中断开',
        originalError: new Error(`WebSocket closed: ${event.code} ${event.reason}`),
      });
    }
  }

  /**
   * WebSocket 错误处理
   */
  private handleWebSocketError(event: Event): void {
    const error: ConnectionError = {
      type: ConnectionErrorType.NETWORK_ERROR,
      message: 'WebSocket网络错误',
    };

    this.emitError(error);
  }

  /**
   * WebSocket 消息处理
   */
  private handleWebSocketMessage(message: MessageWrapper): void {
    // 如果是心跳消息,交给心跳管理器处理
    if (message.type === SYSTEM_MESSAGE_TYPES.HEARTBEAT) {
      if (this.heartbeatManager) {
        this.heartbeatManager.handleHeartbeat(message);
      }
      return;
    }

    // 触发消息事件
    const event: MessageEvent = {
      message,
      timestamp: Date.now(),
    };

    if (!this.isMessageDuplicated(message)){
      this.eventManager.emit(ConnectionEventType.MESSAGE, event);
    }
  }

  /**
   * 心跳超时处理
   * 注意: 只触发事件，不直接调用 disconnect()
   * disconnect() 由 getInstance() 中注册的 HEARTBEAT_TIMEOUT 事件处理器统一调用
   */
  private handleHeartbeatTimeout(): void {
    console.warn('心跳超时,断开连接');

    const error: ConnectionError = {
      type: ConnectionErrorType.HEARTBEAT_TIMEOUT,
      message: '心跳超时',
    };

    const event: ErrorEvent = {
      error,
      timestamp: Date.now(),
    };

    this.eventManager.emit(ConnectionEventType.HEARTBEAT_TIMEOUT, event);
    // disconnect() 由事件处理器调用，避免重复调用
  }

  /**
   * 发送心跳消息
   */
  private sendHeartbeatMessage(message: MessageWrapper): void {
    if (this.connectionManager) {
      try {
        this.connectionManager.sendMessage(message);
      } catch (error) {
        logger.error([moduleName, LOG_TAGS.WebSocket, "WebSocketClient"], '发送心跳消息失败:', error);
      }
    }
  }

  /**
   * 触发连接失败事件
   */
  private emitConnectFailed(error: ConnectionError): void {
    const event: ConnectFailedEvent = {
      error,
      timestamp: Date.now(),
    };

    this.eventManager.emit(ConnectionEventType.CONNECT_FAILED, event);
  }

  /**
   * 触发断开连接事件
   */
  private emitDisconnected(wasClean: boolean, reason?: string, error?: ConnectionError): void {
    const event: DisconnectedEvent = {
      wasClean,
      reason,
      error,
      timestamp: Date.now(),
    };

    this.eventManager.emit(ConnectionEventType.DISCONNECTED, event);
  }

  /**
   * 触发错误事件
   */
  private emitError(error: ConnectionError): void {
    const event: ErrorEvent = {
      error,
      timestamp: Date.now(),
    };

    this.eventManager.emit(ConnectionEventType.ERROR, event);
  }

  /**
   * 清理资源
   * 使用 isCleaningUp 标志位防止重复调用
   */
  private cleanup(): void {
    if (this.isCleaningUp) {
      return;
    }
    this.isCleaningUp = true;

    try {
      // 停止消息去重缓存清理定时器
      this.stopCleanupTimer();

      // 清理消息去重缓存
      this.processedMessageCache.clear();

      if (this.heartbeatManager) {
        this.heartbeatManager.destroy();
        this.heartbeatManager = null;
      }

      if (this.connectionManager) {
        this.connectionManager.destroy();
        this.connectionManager = null;
      }
    } finally {
      this.isCleaningUp = false;
    }
  }
}
