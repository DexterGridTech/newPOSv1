/**
 * WebSocket连接管理服务
 */
import { MessageWrapper } from '../types';
export declare class WebSocketService {
    private wss;
    private connections;
    private webClients;
    private heartbeatIntervals;
    private deviceRepository;
    constructor();
    /**
     * 初始化WebSocket服务器
     */
    initialize(server: any): void;
    /**
     * 处理WebSocket连接
     */
    private handleConnection;
    /**
     * 处理Web管理后台连接
     */
    private handleWebClientConnection;
    /**
     * 处理客户端消息
     */
    private handleMessage;
    /**
     * 断开连接
     */
    disconnect(deviceId: string): void;
    /**
     * 发送消息到设备
     */
    sendMessage(deviceId: string, message: MessageWrapper): Promise<boolean>;
    /**
     * 推送单元数据变更
     */
    pushUnitDataChange(deviceId: string, group: string, updated: any[], deleted: string[]): Promise<boolean>;
    /**
     * 推送远程指令
     */
    pushRemoteCommand(deviceId: string, command: any): Promise<boolean>;
    /**
     * 广播设备状态到所有Web客户端
     */
    broadcastDeviceState(deviceId: string, state: any): void;
    /**
     * 广播设备在线状态到所有Web客户端
     */
    broadcastDeviceOnlineStatus(deviceId: string, online: boolean): void;
    /**
     * 检查设备是否在线
     */
    isConnected(deviceId: string): boolean;
    /**
     * 获取所有在线设备
     */
    getOnlineDevices(): string[];
    /**
     * 启动心跳
     */
    private startHeartbeat;
    /**
     * 清理所有连接
     */
    cleanup(): void;
}
export declare function getWebSocketService(): WebSocketService;
//# sourceMappingURL=WebSocketService.d.ts.map