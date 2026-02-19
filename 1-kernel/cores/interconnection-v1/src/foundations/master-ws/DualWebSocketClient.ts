import {nanoid} from 'nanoid/non-secure';
import axios from 'axios';
import {logger} from "@impos2/kernel-core-base-v1";
import {moduleName} from '../../moduleName';
import {
    MessageWrapper, DeviceRegistration, RegistrationResponse,
    DualClientConfig, ConnectionState, ConnectionEventType,
    ConnectionErrorType, ConnectionError, SYSTEM_NOTIFICATION,
    StateChangeEvent, ConnectedEvent, ConnectFailedEvent,
    DisconnectedEvent, WSMessageEvent, WSErrorEvent,
} from './types';

const LOG_TAG = 'DualWSClient';

const DEFAULT_CONFIG = {
    connectionTimeout: 10000,
    heartbeatTimeout: 60000,
    maxQueueSize: 100,
};

/** 消息去重配置 */
const DEDUP = {
    MAX_SIZE: 1000,
    TTL: 5 * 60 * 1000,
    CLEANUP_INTERVAL: 60 * 1000,
};

/**
 * Dual WebSocket 客户端
 * 对接 master-ws-server-dual 的 1:1 配对、双向转发协议
 */
export class DualWebSocketClient {
    private static instance: DualWebSocketClient | null = null;

    private listeners = new Map<ConnectionEventType, Set<Function>>();
    private state: ConnectionState = ConnectionState.DISCONNECTED;
    private config: DualClientConfig & typeof DEFAULT_CONFIG | null = null;
    private ws: WebSocket | null = null;
    private currentServerUrl: string | null = null;
    private messageQueue: MessageWrapper[] = [];
    private wsCleanups: Array<() => void> = [];

    // 心跳
    private heartbeatCheckTimer: ReturnType<typeof setTimeout> | null = null;
    private lastHeartbeatTime = 0;
    private hasReceivedFirstHeartbeat = false;

    // 去重
    private dedupCache = new Map<string, number>();
    private dedupTimer: ReturnType<typeof setInterval> | null = null;

    // 状态保护
    private isConnecting = false;
    private isCleaningUp = false;
    private isDestroyed = false;

    private constructor() {}

    static getInstance(): DualWebSocketClient {
        if (!DualWebSocketClient.instance) {
            DualWebSocketClient.instance = new DualWebSocketClient();
            const inst = DualWebSocketClient.instance;
            inst.on(ConnectionEventType.CONNECT_FAILED, (e: ConnectFailedEvent) => {
                logger.error([moduleName, LOG_TAG], e.error.message);
                inst.disconnect('连接失败');
            });
            inst.on(ConnectionEventType.ERROR, (e: WSErrorEvent) => {
                logger.error([moduleName, LOG_TAG], e.error.message);
                inst.disconnect('连接ERROR');
            });
            inst.on(ConnectionEventType.HEARTBEAT_TIMEOUT, () => {
                logger.error([moduleName, LOG_TAG], '心跳超时');
                inst.disconnect('心跳超时');
            });
        }
        return DualWebSocketClient.instance;
    }

    // ==================== 事件管理 ====================

    on(eventType: ConnectionEventType, callback: Function): void {
        if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
        this.listeners.get(eventType)!.add(callback);
    }

    off(eventType: ConnectionEventType, callback: Function): void {
        const set = this.listeners.get(eventType);
        if (set) {
            set.delete(callback);
            if (set.size === 0) this.listeners.delete(eventType);
        }
    }

    private emit(eventType: ConnectionEventType, ...args: any[]): void {
        this.listeners.get(eventType)?.forEach(cb => {
            try { cb(...args); } catch (e) {
                logger.error([moduleName, LOG_TAG], `事件回调错误 [${eventType}]:`, e);
            }
        });
    }

    // ==================== 连接 ====================

    async connect(config: DualClientConfig): Promise<void> {
        if (this.isDestroyed) throw new Error('客户端已销毁');
        if (this.isConnecting) throw new Error('连接操作进行中');
        if (this.state !== ConnectionState.DISCONNECTED) throw new Error(`当前状态不允许连接: ${this.state}`);

        this.isConnecting = true;
        this.config = {...DEFAULT_CONFIG, ...config};

        try {
            this.setState(ConnectionState.REGISTERING);
            let lastError: ConnectionError | null = null;

            for (const serverUrl of this.config.serverUrls) {
                try {
                    const token = await this.registerDevice(serverUrl);
                    this.currentServerUrl = serverUrl;
                    this.setState(ConnectionState.CONNECTING);
                    await this.connectWebSocket(serverUrl, token);
                    return;
                } catch (e) {
                    lastError = e as ConnectionError;
                    // 清理本次失败的 ws 资源，避免下次循环泄漏
                    this.cleanupWs();
                }
            }

            throw lastError ?? {type: ConnectionErrorType.ALL_SERVERS_FAILED, message: '所有服务器连接失败'};
        } catch (error) {
            this.isConnecting = false;
            this.cleanup();
            this.setState(ConnectionState.DISCONNECTED);
            const ce = error as ConnectionError;
            this.emit(ConnectionEventType.CONNECT_FAILED, {error: ce, timestamp: Date.now()} as ConnectFailedEvent);
            throw ce;
        }
    }

    private async registerDevice(serverUrl: string): Promise<string> {
        try {
            const {data} = await axios.post<RegistrationResponse>(
                `${serverUrl}/register`,
                this.config!.deviceRegistration,
                {timeout: this.config!.connectionTimeout}
            );
            if (!data.success || !data.token) {
                throw {type: ConnectionErrorType.REGISTRATION_FAILED, message: data.error || '注册失败', serverUrl};
            }
            return data.token;
        } catch (error: any) {
            if (error.type === ConnectionErrorType.REGISTRATION_FAILED) throw error;
            throw {type: ConnectionErrorType.REGISTRATION_FAILED, message: error.message || 'HTTP注册失败', originalError: error, serverUrl} as ConnectionError;
        }
    }

    private connectWebSocket(serverUrl: string, token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const url = new URL(serverUrl);
            const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            this.ws = new WebSocket(`${wsProtocol}//${url.host}${url.pathname}/ws?token=${token}`);

            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    this.ws?.close();
                    reject({type: ConnectionErrorType.CONNECTION_TIMEOUT, message: `WebSocket连接超时`, serverUrl} as ConnectionError);
                }
            }, this.config!.connectionTimeout);

            const onOpen = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.isConnecting = false;
                this.setState(ConnectionState.CONNECTED);
                this.startHeartbeatCheck();
                this.startDedupCleanup();
                this.flushQueue();
                const reg = this.config!.deviceRegistration;
                this.emit(ConnectionEventType.CONNECTED, {
                    serverUrl, timestamp: Date.now(),
                    deviceInfo: {deviceType: reg.type, deviceId: reg.deviceId}
                } as ConnectedEvent);
                resolve();
            };

            const onClose = (event: any) => {
                clearTimeout(timer);
                if (!settled) {
                    settled = true;
                    reject({type: ConnectionErrorType.WEBSOCKET_FAILED, message: '连接过程中断开', serverUrl} as ConnectionError);
                    return;
                }
                if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING) return;
                this.isConnecting = false;
                this.cleanup();
                this.setState(ConnectionState.DISCONNECTED);
                this.emit(ConnectionEventType.DISCONNECTED, {wasClean: event.wasClean, reason: event.reason, timestamp: Date.now()} as DisconnectedEvent);
            };

            const onError = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject({type: ConnectionErrorType.WEBSOCKET_FAILED, message: 'WebSocket连接失败', serverUrl} as ConnectionError);
                    return;
                }
                this.emit(ConnectionEventType.ERROR, {
                    error: {type: ConnectionErrorType.NETWORK_ERROR, message: 'WebSocket网络错误'},
                    timestamp: Date.now()
                } as WSErrorEvent);
            };

            const onMessage = (event: any) => {
                try {
                    const msg: MessageWrapper = JSON.parse(event.data);
                    this.handleMessage(msg);
                } catch (e) {
                    logger.error([moduleName, LOG_TAG], '消息解析错误:', e);
                }
            };

            this.ws.addEventListener('open', onOpen);
            this.ws.addEventListener('close', onClose);
            this.ws.addEventListener('error', onError);
            this.ws.addEventListener('message', onMessage);
            this.wsCleanups.push(() => {
                this.ws?.removeEventListener('open', onOpen);
                this.ws?.removeEventListener('close', onClose);
                this.ws?.removeEventListener('error', onError);
                this.ws?.removeEventListener('message', onMessage);
            });
        });
    }

    // ==================== 消息处理 ====================

    private handleMessage(msg: MessageWrapper): void {
        if (msg.type === SYSTEM_NOTIFICATION.HEARTBEAT) {
            this.lastHeartbeatTime = Date.now();
            this.hasReceivedFirstHeartbeat = true;
            this.sendRaw({
                from: this.config!.deviceRegistration.deviceId,
                id: nanoid(), type: SYSTEM_NOTIFICATION.HEARTBEAT_ACK,
                data: msg.data
            });
            return;
        }

        if (this.isDuplicate(msg.id)) return;
        this.emit(ConnectionEventType.MESSAGE, {message: msg, timestamp: Date.now()} as WSMessageEvent);
    }

    /** 发送业务消息（双向转发，无需指定目标） */
    sendMessage(type: string, data: any): void {
        if (!this.config) throw new Error('客户端未配置');
        const msg: MessageWrapper = {
            from: this.config.deviceRegistration.deviceId,
            id: nanoid(), type, data
        };
        if (this.isWsOpen()) {
            this.sendRaw(msg);
        } else if (this.state === ConnectionState.REGISTERING || this.state === ConnectionState.CONNECTING) {
            if (this.messageQueue.length < this.config.maxQueueSize) {
                this.messageQueue.push(msg);
            }
        } else {
            throw new Error(`当前状态不允许发送: ${this.state}`);
        }
    }

    private sendRaw(msg: MessageWrapper): void {
        if (this.isWsOpen()) this.ws!.send(JSON.stringify(msg));
    }

    private flushQueue(): void {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift()!;
            this.sendRaw(msg);
        }
    }

    private isWsOpen(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    // ==================== 心跳检测 ====================

    private startHeartbeatCheck(): void {
        this.lastHeartbeatTime = Date.now();
        this.hasReceivedFirstHeartbeat = false;
        this.scheduleHeartbeatCheck();
    }

    private scheduleHeartbeatCheck(): void {
        this.clearHeartbeatTimer();
        if (this.state !== ConnectionState.CONNECTED) return;

        const checkInterval = Math.max(this.config!.heartbeatTimeout / 2, 5000);
        this.heartbeatCheckTimer = setTimeout(() => {
            if (this.state !== ConnectionState.CONNECTED) return;
            const elapsed = Date.now() - this.lastHeartbeatTime;
            const timeout = this.hasReceivedFirstHeartbeat
                ? this.config!.heartbeatTimeout
                : this.config!.heartbeatTimeout * 2;

            if (elapsed >= timeout) {
                this.emit(ConnectionEventType.HEARTBEAT_TIMEOUT, {
                    error: {type: ConnectionErrorType.HEARTBEAT_TIMEOUT, message: '心跳超时'},
                    timestamp: Date.now()
                } as WSErrorEvent);
            } else {
                this.scheduleHeartbeatCheck();
            }
        }, checkInterval);
    }

    private clearHeartbeatTimer(): void {
        if (this.heartbeatCheckTimer) {
            clearTimeout(this.heartbeatCheckTimer);
            this.heartbeatCheckTimer = null;
        }
    }

    // ==================== 去重 ====================

    private isDuplicate(id: string): boolean {
        const now = Date.now();
        if (this.dedupCache.has(id)) {
            if (now - this.dedupCache.get(id)! < DEDUP.TTL) return true;
            this.dedupCache.delete(id);
        }
        this.dedupCache.set(id, now);
        if (this.dedupCache.size > DEDUP.MAX_SIZE) {
            let toRemove = Math.floor(DEDUP.MAX_SIZE * 0.2);
            for (const key of this.dedupCache.keys()) {
                if (toRemove-- <= 0) break;
                this.dedupCache.delete(key);
            }
        }
        return false;
    }

    private startDedupCleanup(): void {
        if (this.dedupTimer) return;
        this.dedupTimer = setInterval(() => {
            const now = Date.now();
            for (const [k, t] of this.dedupCache) {
                if (now - t >= DEDUP.TTL) this.dedupCache.delete(k);
            }
        }, DEDUP.CLEANUP_INTERVAL);
    }

    // ==================== 断开 / 清理 ====================

    /** 仅清理 ws 相关资源（用于 failover 循环中） */
    private cleanupWs(): void {
        this.wsCleanups.forEach(fn => fn());
        this.wsCleanups = [];
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close(1000);
            }
            this.ws = null;
        }
        this.currentServerUrl = null;
    }

    disconnect(reason?: string): void {
        if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING) return;
        this.setState(ConnectionState.DISCONNECTING);
        this.cleanup();
        this.setState(ConnectionState.DISCONNECTED);
        this.emit(ConnectionEventType.DISCONNECTED, {wasClean: true, reason, timestamp: Date.now()} as DisconnectedEvent);
    }

    private cleanup(): void {
        if (this.isCleaningUp) return;
        this.isCleaningUp = true;
        try {
            this.clearHeartbeatTimer();
            if (this.dedupTimer) { clearInterval(this.dedupTimer); this.dedupTimer = null; }
            this.dedupCache.clear();
            this.wsCleanups.forEach(fn => fn());
            this.wsCleanups = [];
            if (this.ws) {
                if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close(1000);
                }
                this.ws = null;
            }
            this.currentServerUrl = null;
            this.messageQueue = [];
        } finally {
            this.isCleaningUp = false;
        }
    }

    destroy(): void {
        if (this.isDestroyed) return;
        this.disconnect();
        this.listeners.clear();
        this.isDestroyed = true;
        DualWebSocketClient.instance = null;
    }

    // ==================== 状态查询 ====================

    getState(): ConnectionState { return this.state; }
    isConnected(): boolean { return this.state === ConnectionState.CONNECTED && this.isWsOpen(); }
    getCurrentServerUrl(): string | null { return this.currentServerUrl; }

    private setState(newState: ConnectionState): void {
        const oldState = this.state;
        this.state = newState;
        this.emit(ConnectionEventType.STATE_CHANGE, {oldState, newState, timestamp: Date.now()} as StateChangeEvent);
    }
}
