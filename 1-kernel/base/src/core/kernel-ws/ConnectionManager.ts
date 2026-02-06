/**
 * Kernel WebSocket 连接管理器
 * 负责 WebSocket 连接和消息收发
 */

import {
    KernelMessageWrapper,
    KernelConnectionError,
    KernelConnectionErrorType,
} from '../../types';
import {logger} from '../nativeAdapter';
import {ApiManager} from '../http';
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../module';

export class KernelConnectionManager {
    private ws: WebSocket | null = null;
    private currentServerUrl: string | null = null;
    private isConnected: boolean = false;
    private messageQueue: KernelMessageWrapper[] = [];
    private maxQueueSize: number;

    private onOpenCallback: () => void;
    private onCloseCallback: (event: any) => void;
    private onErrorCallback: (event: Event) => void;
    private onMessageCallback: (message: KernelMessageWrapper) => void;

    // 保存事件监听器引用,用于清理
    private wsEventHandlers: {
        onOpen?: () => void;
        onError?: (event: Event) => void;
        onClose?: (event: any) => void;
        onMessage?: (event: any) => void;
    } = {};

    constructor(
        maxQueueSize: number,
        onOpenCallback: () => void,
        onCloseCallback: (event: any) => void,
        onErrorCallback: (event: Event) => void,
        onMessageCallback: (message: KernelMessageWrapper) => void
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
        api: any,
        deviceId: string,
        token: string,
        connectionTimeout: number
    ): Promise<void> {
        // 从 ApiManager 获取服务器配置
        const serverConfig = ApiManager.getInstance().getServerConfig(api.serverName());
        if (!serverConfig || !serverConfig.addresses || serverConfig.addresses.length === 0) {
            throw {
                type: KernelConnectionErrorType.ALL_SERVERS_FAILED,
                message: `未找到服务器配置: ${api.serverName()}`,
            } as KernelConnectionError;
        }

        const addresses = serverConfig.addresses;
        let lastError: KernelConnectionError | null = null;

        // 顺序遍历地址列表
        for (const addressConfig of addresses) {
            try {
                await this.connectToServer(addressConfig.baseURL, api.path(), deviceId, token, connectionTimeout);
                return; // 连接成功,立即返回
            } catch (error: any) {
                lastError = error as KernelConnectionError;
                logger.warn([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], `[KernelWS] 连接服务器失败: ${addressConfig.baseURL}`);

                // 清理失败的连接
                this.cleanupFailedConnection();
            }
        }

        // 所有服务器都连接失败
        throw {
            type: KernelConnectionErrorType.ALL_SERVERS_FAILED,
            message: `所有服务器都连接失败`,
            originalError: lastError?.originalError,
        } as KernelConnectionError;
    }

    /**
     * 连接到单个服务器
     */
    private async connectToServer(
        address: string,
        path: string,
        deviceId: string,
        token: string,
        connectionTimeout: number
    ): Promise<void> {
        // 将 http/https 替换为 ws/wss
        const wsAddress = address.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
        const wsUrl = `${wsAddress}${path}?deviceId=${deviceId}&token=${token}`;
        logger.log([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], "准备连接WS服务:", wsUrl)
        await this.connectWebSocket(wsUrl, connectionTimeout);
        this.currentServerUrl = wsAddress;
    }

    /**
     * 建立 WebSocket 连接
     */
    private connectWebSocket(wsUrl: string, timeout: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let resolved = false;
            let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

            const clearConnectionTimeout = () => {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }
            };

            try {
                this.ws = new WebSocket(wsUrl);

                // 连接超时定时器
                timeoutTimer = setTimeout(() => {
                    if (!resolved && this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        resolved = true;

                        // 保存 ws 引用
                        const wsToClose = this.ws;

                        // 先移除监听器，避免触发 onClose 导致重复回调
                        this.removeEventListeners();

                        // 清空引用，避免资源泄漏
                        this.ws = null;

                        try {
                            wsToClose.close();
                        } catch (error) {
                            // 忽略关闭错误
                        }

                        reject({
                            type: KernelConnectionErrorType.CONNECTION_TIMEOUT,
                            message: `WebSocket连接超时 (${timeout}ms)`,
                            serverUrl: wsUrl,
                        } as KernelConnectionError);
                    }
                }, timeout);

                const onOpen = () => {
                    if (!resolved) {
                        resolved = true;
                        clearConnectionTimeout();
                        this.isConnected = true;
                        this.onOpenCallback();
                        this.flushMessageQueue();
                        resolve();
                    }
                };

                const onError = (event: Event) => {
                    if (!resolved) {
                        // 连接阶段的错误 - 不调用回调，只reject
                        // 避免在连接阶段触发错误回调导致重复清理
                        resolved = true;
                        clearConnectionTimeout();

                        // 移除监听器并清理，避免资源泄漏
                        this.removeEventListeners();
                        this.ws = null;

                        reject({
                            type: KernelConnectionErrorType.CONNECTION_FAILED,
                            message: 'WebSocket连接失败',
                            serverUrl: wsUrl,
                            originalError: event,
                        } as KernelConnectionError);
                    } else {
                        // 连接成功后的运行时错误 - 才调用回调
                        this.onErrorCallback(event);
                    }
                };

                const onClose = (event: any) => {
                    clearConnectionTimeout();
                    this.isConnected = false;
                    this.onCloseCallback(event);
                };

                const onMessage = (event: any) => {
                    try {
                        const message = JSON.parse(event.data) as KernelMessageWrapper;
                        this.onMessageCallback(message);
                    } catch (error) {
                        logger.error([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Failed to parse message:', error);
                    }
                };

                // 保存监听器引用
                this.wsEventHandlers = {onOpen, onError, onClose, onMessage};

                this.ws.addEventListener('open', onOpen);
                this.ws.addEventListener('error', onError);
                this.ws.addEventListener('close', onClose);
                this.ws.addEventListener('message', onMessage);

            } catch (error: any) {
                clearConnectionTimeout();
                reject({
                    type: KernelConnectionErrorType.CONNECTION_FAILED,
                    message: error.message || 'WebSocket连接失败',
                    originalError: error,
                    serverUrl: wsUrl,
                } as KernelConnectionError);
            }
        });
    }

    /**
     * 发送消息
     */
    sendMessage(message: KernelMessageWrapper): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // 连接未建立,加入队列
            if (this.messageQueue.length < this.maxQueueSize) {
                this.messageQueue.push(message);
                logger.log([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Message queued:', message.type);
            } else {
                logger.warn([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Message queue full, dropping message:', message.type);
            }
            return;
        }

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            logger.error([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Failed to send message:', error);
            throw error;
        }
    }

    /**
     * 刷新消息队列
     */
    private flushMessageQueue(): void {
        if (this.messageQueue.length === 0) {
            return;
        }

        // 检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logger.warn([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Cannot flush queue, connection not open');
            return;
        }

        logger.log([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], `[KernelWS] Flushing ${this.messageQueue.length} queued messages`);

        // 复制队列并清空,避免递归
        const messages = [...this.messageQueue];
        this.messageQueue = [];

        // 发送消息
        for (const message of messages) {
            try {
                // 直接发送,不走sendMessage避免递归
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(message));
                } else {
                    // 连接已断开,停止发送
                    logger.warn([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Connection lost during flush, stopping');
                    break;
                }
            } catch (error) {
                logger.error([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Failed to send queued message:', error);
            }
        }
    }

    /**
     * 断开连接
     */
    disconnect(reason?: string): void {
        if (this.ws) {
            // 移除事件监听器
            this.removeEventListeners();

            try {
                this.ws.close(1000, reason);
            } catch (error) {
                logger.error([moduleName, LOG_TAGS.WebSocket, "ConnectionManager"], '[KernelWS] Error closing WebSocket:', error);
            }
            this.ws = null;
        }

        this.wsEventHandlers = {};
        this.isConnected = false;
        this.currentServerUrl = null;
        this.messageQueue = [];
    }

    /**
     * 移除WebSocket事件监听器
     */
    private removeEventListeners(): void {
        if (!this.ws) {
            return;
        }

        if (this.wsEventHandlers.onOpen) {
            this.ws.removeEventListener('open', this.wsEventHandlers.onOpen);
        }
        if (this.wsEventHandlers.onError) {
            this.ws.removeEventListener('error', this.wsEventHandlers.onError);
        }
        if (this.wsEventHandlers.onClose) {
            this.ws.removeEventListener('close', this.wsEventHandlers.onClose);
        }
        if (this.wsEventHandlers.onMessage) {
            this.ws.removeEventListener('message', this.wsEventHandlers.onMessage);
        }
    }

    /**
     * 清理失败的连接
     */
    private cleanupFailedConnection(): void {
        if (this.ws) {
            // 移除所有监听器
            this.removeEventListeners();

            // 关闭连接
            try {
                this.ws.close();
            } catch (error) {
                // 忽略关闭错误
            }

            this.ws = null;
        }

        this.wsEventHandlers = {};
        this.isConnected = false;
        // 清空消息队列，避免旧消息发送到新服务器
        this.messageQueue = [];
    }

    /**
     * 获取当前服务器URL
     */
    getCurrentServerUrl(): string | null {
        return this.currentServerUrl;
    }

    /**
     * 检查是否已连接
     */
    getIsConnected(): boolean {
        return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}
