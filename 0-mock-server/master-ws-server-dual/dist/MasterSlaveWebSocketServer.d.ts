import { ServerConfig } from './config';
export declare class MasterSlaveWebSocketServer {
    private httpServer;
    private wss;
    private deviceManager;
    private logger;
    private config;
    private cleanupInterval;
    private heartbeatInterval;
    /** masterDeviceId -> RetryQueue（每对设备一个队列） */
    private retryQueues;
    constructor(customConfig?: Partial<ServerConfig>);
    private handleHttpRequest;
    private handleRegistration;
    private handleHealthCheck;
    private handleStats;
    private sendJson;
    private handleWebSocketUpgrade;
    private handleWebSocketConnection;
    private setupConnectionHandlers;
    private handleMessage;
    private trySend;
    private enqueueRetry;
    private flushRetryQueue;
    private notifyMaster;
    private handleDisconnection;
    private sendHeartbeat;
    private checkHeartbeatTimeout;
    private printStats;
    getStats(): {
        masterCount: number;
        slaveCount: number;
        pendingCount: number;
        pairs: {
            masterDeviceId: string;
            slaveDeviceId?: string;
        }[];
    };
    close(): void;
}
//# sourceMappingURL=MasterSlaveWebSocketServer.d.ts.map