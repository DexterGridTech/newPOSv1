import axios from 'axios';
import { LOG_TAGS, logger, shortId } from "@impos2/kernel-core-base";
import { moduleName } from '../../moduleName';
import { ConnectionState, ConnectionEventType, ConnectionErrorType, SYSTEM_NOTIFICATION, } from './types';
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
    static instance = null;
    listeners = new Map();
    state = ConnectionState.DISCONNECTED;
    config = null;
    ws = null;
    currentServerUrl = null;
    messageQueue = [];
    wsCleanups = [];
    // 心跳
    heartbeatCheckTimer = null;
    lastHeartbeatTime = 0;
    hasReceivedFirstHeartbeat = false;
    // 去重
    dedupCache = new Map();
    dedupTimer = null;
    // 状态保护
    isConnecting = false;
    isCleaningUp = false;
    isDestroyed = false;
    constructor() { }
    static getInstance() {
        if (!DualWebSocketClient.instance) {
            DualWebSocketClient.instance = new DualWebSocketClient();
            const inst = DualWebSocketClient.instance;
            inst.on(ConnectionEventType.CONNECT_FAILED, (e) => {
                const url = e.error.serverUrl || inst.currentServerUrl || '未知服务器';
                logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `${url},连接失败:${e.error.message}`);
                inst.disconnect('连接失败');
            });
            inst.on(ConnectionEventType.ERROR, (e) => {
                logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `${inst.currentServerUrl},WS连接错误:${e.error.message}`);
                inst.disconnect('连接ERROR');
            });
            inst.on(ConnectionEventType.HEARTBEAT_TIMEOUT, () => {
                logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `${inst.currentServerUrl},心跳超时`);
                inst.disconnect('心跳超时');
            });
        }
        return DualWebSocketClient.instance;
    }
    // ==================== 事件管理 ====================
    on(eventType, callback) {
        if (!this.listeners.has(eventType))
            this.listeners.set(eventType, new Set());
        this.listeners.get(eventType).add(callback);
    }
    off(eventType, callback) {
        const set = this.listeners.get(eventType);
        if (set) {
            set.delete(callback);
            if (set.size === 0)
                this.listeners.delete(eventType);
        }
    }
    emit(eventType, ...args) {
        this.listeners.get(eventType)?.forEach(cb => {
            try {
                cb(...args);
            }
            catch (e) {
                logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `事件回调错误 [${eventType}]:`, e);
            }
        });
    }
    // ==================== 连接 ====================
    async connect(config) {
        logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `开始连接，服务器列表: ${config.serverUrls.join(', ')}`);
        if (this.isDestroyed)
            throw new Error('客户端已销毁');
        if (this.isConnecting)
            throw new Error('连接操作进行中');
        if (this.state !== ConnectionState.DISCONNECTED)
            throw new Error(`当前状态不允许连接: ${this.state}`);
        this.isConnecting = true;
        this.config = { ...DEFAULT_CONFIG, ...config };
        logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `配置已合并，超时设置: 连接=${this.config.connectionTimeout}ms, 心跳=${this.config.heartbeatTimeout}ms`);
        try {
            this.setState(ConnectionState.REGISTERING);
            let lastError = null;
            for (const serverUrl of this.config.serverUrls) {
                logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `尝试连接服务器: ${serverUrl}`);
                try {
                    const token = await this.registerDevice(serverUrl);
                    this.currentServerUrl = serverUrl;
                    logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `注册成功，token: ${token.substring(0, 10)}...`);
                    this.setState(ConnectionState.CONNECTING);
                    await this.connectWebSocket(serverUrl, token);
                    logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `WebSocket连接成功: ${serverUrl}`);
                    return;
                }
                catch (e) {
                    lastError = e;
                    logger.warn([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `服务器 ${serverUrl} 连接失败: ${lastError.message}`, lastError);
                    // 清理本次失败的 ws 资源，避免下次循环泄漏
                    this.cleanupWs();
                }
            }
            throw lastError ?? { type: ConnectionErrorType.ALL_SERVERS_FAILED, message: '所有服务器连接失败' };
        }
        catch (error) {
            this.isConnecting = false;
            const ce = error;
            logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `连接流程失败: ${ce.message}`, ce);
            // 不在此处 cleanup/setState，由 CONNECT_FAILED 内部 handler 统一处理
            this.emit(ConnectionEventType.CONNECT_FAILED, { error: ce, timestamp: Date.now() });
            throw ce;
        }
    }
    async registerDevice(serverUrl) {
        const url = `${serverUrl}/register`;
        logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `发起注册请求: ${url}`, this.config.deviceRegistration);
        try {
            const { data } = await axios.post(url, this.config.deviceRegistration, { timeout: this.config.connectionTimeout });
            logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `注册响应:`, data);
            if (!data.success || !data.token) {
                throw { type: ConnectionErrorType.REGISTRATION_FAILED, message: data.error || '注册失败', serverUrl };
            }
            return data.token;
        }
        catch (error) {
            logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `注册失败 ${url}:`, {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                status: error.response?.status,
                config: { url: error.config?.url, method: error.config?.method }
            });
            if (error.type === ConnectionErrorType.REGISTRATION_FAILED)
                throw error;
            throw { type: ConnectionErrorType.REGISTRATION_FAILED, message: error.message || 'HTTP注册失败', originalError: error, serverUrl };
        }
    }
    connectWebSocket(serverUrl, token) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const isHttps = serverUrl.startsWith('https://');
            const wsProtocol = isHttps ? 'wss:' : 'ws:';
            const hostAndPath = serverUrl.replace(/^https?:\/\//, '');
            const wsUrl = `${wsProtocol}//${hostAndPath}/ws?token=${token}`;
            logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `创建WebSocket连接: ${wsUrl.replace(/token=.+/, 'token=***')}`);
            this.ws = new WebSocket(wsUrl);
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `WebSocket连接超时 (${this.config.connectionTimeout}ms): ${serverUrl}`);
                    this.ws?.close();
                    reject({ type: ConnectionErrorType.CONNECTION_TIMEOUT, message: `WebSocket连接超时`, serverUrl });
                }
            }, this.config.connectionTimeout);
            const onOpen = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                logger.log([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `WebSocket已打开: ${serverUrl}`);
                this.isConnecting = false;
                this.setState(ConnectionState.CONNECTED);
                this.startHeartbeatCheck();
                this.startDedupCleanup();
                this.flushQueue();
                const reg = this.config.deviceRegistration;
                this.emit(ConnectionEventType.CONNECTED, {
                    serverUrl, timestamp: Date.now(),
                    deviceInfo: { deviceType: reg.type, deviceId: reg.deviceId }
                });
                resolve();
            };
            const onClose = (event) => {
                clearTimeout(timer);
                logger.warn([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `WebSocket关闭: ${serverUrl}, wasClean=${event.wasClean}, code=${event.code}, reason=${event.reason}`);
                if (!settled) {
                    settled = true;
                    reject({ type: ConnectionErrorType.WEBSOCKET_FAILED, message: '连接过程中断开', serverUrl });
                    return;
                }
                if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING)
                    return;
                this.isConnecting = false;
                this.cleanup();
                this.setState(ConnectionState.DISCONNECTED);
                this.emit(ConnectionEventType.DISCONNECTED, { wasClean: event.wasClean, reason: event.reason, timestamp: Date.now() });
            };
            const onError = () => {
                logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], `WebSocket错误事件: ${serverUrl}, readyState=${this.ws?.readyState}`);
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject({ type: ConnectionErrorType.WEBSOCKET_FAILED, message: 'WebSocket连接失败', serverUrl });
                    return;
                }
                this.emit(ConnectionEventType.ERROR, {
                    error: { type: ConnectionErrorType.NETWORK_ERROR, message: 'WebSocket网络错误' },
                    timestamp: Date.now()
                });
            };
            const onMessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleMessage(msg);
                }
                catch (e) {
                    logger.error([moduleName, LOG_TAGS.WebSocket, "DualWSClient"], '消息解析错误:', e);
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
    handleMessage(msg) {
        if (msg.type === SYSTEM_NOTIFICATION.HEARTBEAT) {
            this.lastHeartbeatTime = Date.now();
            this.hasReceivedFirstHeartbeat = true;
            this.sendRaw({
                from: this.config.deviceRegistration.deviceId,
                id: shortId(), type: SYSTEM_NOTIFICATION.HEARTBEAT_ACK,
                data: msg.data
            });
            return;
        }
        if (this.isDuplicate(msg.id))
            return;
        this.emit(ConnectionEventType.MESSAGE, { message: msg, timestamp: Date.now() });
    }
    /** 发送业务消息（双向转发，无需指定目标） */
    sendMessage(type, data) {
        if (!this.config)
            throw new Error('客户端未配置');
        const msg = {
            from: this.config.deviceRegistration.deviceId,
            id: shortId(), type, data
        };
        if (this.isWsOpen()) {
            this.sendRaw(msg);
        }
        else if (this.state === ConnectionState.REGISTERING || this.state === ConnectionState.CONNECTING) {
            if (this.messageQueue.length < this.config.maxQueueSize) {
                this.messageQueue.push(msg);
            }
        }
        else {
            throw new Error(`当前状态不允许发送: ${this.state}`);
        }
    }
    sendRaw(msg) {
        if (this.isWsOpen()) {
            const json = JSON.stringify(msg);
            this.ws.send(json);
        }
    }
    flushQueue() {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.sendRaw(msg);
        }
    }
    isWsOpen() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    // ==================== 心跳检测 ====================
    startHeartbeatCheck() {
        this.lastHeartbeatTime = Date.now();
        this.hasReceivedFirstHeartbeat = false;
        this.scheduleHeartbeatCheck();
    }
    scheduleHeartbeatCheck() {
        this.clearHeartbeatTimer();
        if (this.state !== ConnectionState.CONNECTED)
            return;
        const checkInterval = Math.max(this.config.heartbeatTimeout / 2, 5000);
        this.heartbeatCheckTimer = setTimeout(() => {
            if (this.state !== ConnectionState.CONNECTED)
                return;
            const elapsed = Date.now() - this.lastHeartbeatTime;
            const timeout = this.hasReceivedFirstHeartbeat
                ? this.config.heartbeatTimeout
                : this.config.heartbeatTimeout * 2;
            if (elapsed >= timeout) {
                this.emit(ConnectionEventType.HEARTBEAT_TIMEOUT, {
                    error: { type: ConnectionErrorType.HEARTBEAT_TIMEOUT, message: '心跳超时' },
                    timestamp: Date.now()
                });
            }
            else {
                this.scheduleHeartbeatCheck();
            }
        }, checkInterval);
    }
    clearHeartbeatTimer() {
        if (this.heartbeatCheckTimer) {
            clearTimeout(this.heartbeatCheckTimer);
            this.heartbeatCheckTimer = null;
        }
    }
    // ==================== 去重 ====================
    isDuplicate(id) {
        const now = Date.now();
        if (this.dedupCache.has(id)) {
            if (now - this.dedupCache.get(id) < DEDUP.TTL)
                return true;
            this.dedupCache.delete(id);
        }
        this.dedupCache.set(id, now);
        if (this.dedupCache.size > DEDUP.MAX_SIZE) {
            let toRemove = Math.floor(DEDUP.MAX_SIZE * 0.2);
            for (const key of this.dedupCache.keys()) {
                if (toRemove-- <= 0)
                    break;
                this.dedupCache.delete(key);
            }
        }
        return false;
    }
    startDedupCleanup() {
        if (this.dedupTimer)
            return;
        this.dedupTimer = setInterval(() => {
            const now = Date.now();
            for (const [k, t] of this.dedupCache) {
                if (now - t >= DEDUP.TTL)
                    this.dedupCache.delete(k);
            }
        }, DEDUP.CLEANUP_INTERVAL);
    }
    // ==================== 断开 / 清理 ====================
    /** 仅清理 ws 相关资源（用于 failover 循环中） */
    cleanupWs() {
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
    disconnect(reason) {
        if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.DISCONNECTING)
            return;
        this.setState(ConnectionState.DISCONNECTING);
        this.cleanup();
        this.setState(ConnectionState.DISCONNECTED);
        this.emit(ConnectionEventType.DISCONNECTED, { wasClean: true, reason, timestamp: Date.now() });
    }
    cleanup() {
        if (this.isCleaningUp)
            return;
        this.isCleaningUp = true;
        try {
            this.clearHeartbeatTimer();
            if (this.dedupTimer) {
                clearInterval(this.dedupTimer);
                this.dedupTimer = null;
            }
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
        }
        finally {
            this.isCleaningUp = false;
        }
    }
    destroy() {
        if (this.isDestroyed)
            return;
        this.disconnect();
        this.listeners.clear();
        this.isDestroyed = true;
        DualWebSocketClient.instance = null;
    }
    // ==================== 状态查询 ====================
    getState() { return this.state; }
    isConnected() { return this.state === ConnectionState.CONNECTED && this.isWsOpen(); }
    getCurrentServerUrl() { return this.currentServerUrl; }
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emit(ConnectionEventType.STATE_CHANGE, { oldState, newState, timestamp: Date.now() });
    }
}
