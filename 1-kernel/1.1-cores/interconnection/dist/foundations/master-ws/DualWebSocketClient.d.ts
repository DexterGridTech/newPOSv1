import { DualClientConfig, ConnectionState, ConnectionEventType } from './types';
/**
 * Dual WebSocket 客户端
 * 对接 master-ws-server-dual 的 1:1 配对、双向转发协议
 */
export declare class DualWebSocketClient {
    private static instance;
    private listeners;
    private state;
    private config;
    private ws;
    private currentServerUrl;
    private messageQueue;
    private wsCleanups;
    private heartbeatCheckTimer;
    private lastHeartbeatTime;
    private hasReceivedFirstHeartbeat;
    private dedupCache;
    private dedupTimer;
    private isConnecting;
    private isCleaningUp;
    private isDestroyed;
    private constructor();
    static getInstance(): DualWebSocketClient;
    on(eventType: ConnectionEventType, callback: Function): void;
    off(eventType: ConnectionEventType, callback: Function): void;
    private emit;
    connect(config: DualClientConfig): Promise<void>;
    private registerDevice;
    private connectWebSocket;
    private handleMessage;
    /** 发送业务消息（双向转发，无需指定目标） */
    sendMessage(type: string, data: any): void;
    private sendRaw;
    private flushQueue;
    private isWsOpen;
    private startHeartbeatCheck;
    private scheduleHeartbeatCheck;
    private clearHeartbeatTimer;
    private isDuplicate;
    private startDedupCleanup;
    /** 仅清理 ws 相关资源（用于 failover 循环中） */
    private cleanupWs;
    disconnect(reason?: string): void;
    private cleanup;
    destroy(): void;
    getState(): ConnectionState;
    isConnected(): boolean;
    getCurrentServerUrl(): string | null;
    private setState;
}
//# sourceMappingURL=DualWebSocketClient.d.ts.map