/**
 * WebSocket连接管理服务
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { MessageWrapper, MessageType } from '../types';
import { CONFIG } from '../config';

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocket> = new Map(); // 设备连接
  private webClients: Set<WebSocket> = new Set(); // Web管理后台连接
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private deviceRepository: DeviceRepository;

  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  /**
   * 初始化WebSocket服务器
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: `${CONFIG.ROUTES.WS}/connect`
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    console.log(`[WebSocket] Server initialized on path: ${CONFIG.ROUTES.WS}/connect`);
  }

  /**
   * 处理WebSocket连接
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    try {
      // 从URL参数中获取deviceId和token
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const deviceId = url.searchParams.get('deviceId');
      const token = url.searchParams.get('token');

      // 如果没有deviceId和token，则认为是Web管理后台连接
      if (!deviceId && !token) {
        this.handleWebClientConnection(ws, req);
        return;
      }

      console.log('[WebSocket] Device connection request:', { deviceId, ip: req.socket.remoteAddress });

      if (!deviceId || !token) {
        console.warn('[WebSocket] Missing deviceId or token');
        ws.close(1008, 'Missing deviceId or token');
        return;
      }

      // 验证token
      const device = this.deviceRepository.findByToken(token);
      if (!device || device.id !== deviceId) {
        console.warn(`[WebSocket] Invalid token for device ${deviceId}, IP: ${req.socket.remoteAddress}`);
        ws.close(1008, 'Invalid token');
        return;
      }

      // 如果已有连接,先断开
      if (this.connections.has(deviceId)) {
        console.log(`[WebSocket] Replacing existing connection for device ${deviceId}`);
        this.disconnect(deviceId);
      }

      // 存储连接
      this.connections.set(deviceId, ws);

      // 记录连接状态
      const clientIp = req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      this.deviceRepository.createConnection(deviceId, clientIp, userAgent);

      // 发送连接成功消息
      this.sendMessage(deviceId, {
        type: 'CONNECTED',
        data: { message: 'WebSocket connection established', timestamp: Date.now() }
      });

      // 启动心跳
      this.startHeartbeat(deviceId);

      // 广播设备上线状态
      this.broadcastDeviceOnlineStatus(deviceId, true);

      // 监听消息
      ws.on('message', (data: Buffer) => {
        this.handleMessage(deviceId, data);
      });

      // 监听断开
      ws.on('close', () => {
        this.disconnect(deviceId);
      });

      ws.on('error', (err) => {
        console.error(`[WebSocket] Connection error for device ${deviceId}:`, err);
        this.disconnect(deviceId);
      });

      console.log(`[WebSocket] Connected: device ${deviceId}, IP: ${clientIp}, UA: ${userAgent}`);
    } catch (error) {
      console.error('[WebSocket] Failed to establish connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * 处理Web管理后台连接
   */
  private handleWebClientConnection(ws: WebSocket, req: IncomingMessage): void {
    try {
      const clientIp = req.socket.remoteAddress;
      console.log('[WebSocket] Web client connected:', { ip: clientIp });

      // 存储Web客户端连接
      this.webClients.add(ws);

      // 发送连接成功消息
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        data: { message: 'Web client connected', timestamp: Date.now() }
      }));

      // 监听断开
      ws.on('close', () => {
        this.webClients.delete(ws);
        console.log('[WebSocket] Web client disconnected:', { ip: clientIp });
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Web client error:', err);
        this.webClients.delete(ws);
      });

    } catch (error) {
      console.error('[WebSocket] Failed to establish web client connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(deviceId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Message received from device ${deviceId}:`, message);

      // 处理心跳响应
      if (message.type === 'HEARTBEAT_RESPONSE') {
        // 心跳响应,不需要特殊处理
        return;
      }

      // 其他消息类型可以在这里扩展处理
    } catch (error) {
      console.error(`[WebSocket] Failed to parse message from device ${deviceId}:`, error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(deviceId: string): void {
    try {
      // 停止心跳
      const interval = this.heartbeatIntervals.get(deviceId);
      if (interval) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(deviceId);
      }

      // 关闭连接
      const ws = this.connections.get(deviceId);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Normal closure');
        }
        this.connections.delete(deviceId);
      }

      // 更新连接状态
      this.deviceRepository.disconnectConnection(deviceId);

      // 广播设备下线状态
      this.broadcastDeviceOnlineStatus(deviceId, false);

      console.log(`[WebSocket] Disconnected: device ${deviceId}`);
    } catch (error) {
      console.error(`[WebSocket] Error during disconnect for device ${deviceId}:`, error);
    }
  }

  /**
   * 发送消息到设备
   */
  sendMessage(deviceId: string, message: MessageWrapper): boolean {
    const ws = this.connections.get(deviceId);
    if (!ws) {
      console.warn(`[WebSocket] No connection found for device ${deviceId}`);
      return false;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Connection not open for device ${deviceId}`);
      return false;
    }

    try {
      const data = JSON.stringify(message);
      ws.send(data);

      // 非心跳消息记录日志
      if (message.type !== MessageType.HEARTBEAT) {
        console.log(`[WebSocket] Message sent to device ${deviceId}, type: ${message.type}`);
      }

      return true;
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to device ${deviceId}:`, error);
      this.disconnect(deviceId);
      return false;
    }
  }

  /**
   * 推送单元数据变更
   */
  pushUnitDataChange(deviceId: string, group: string, updated: any[], deleted: string[]): boolean {
    console.log(`[WebSocket] Pushing unit data change to device ${deviceId}, group: ${group}: ${updated.length} updated, ${deleted.length} deleted`);
    return this.sendMessage(deviceId, {
      type: MessageType.UNIT_DATA_CHANGED,
      data: { group, updated, deleted }
    });
  }

  /**
   * 推送远程指令
   */
  pushRemoteCommand(deviceId: string, command: any): boolean {
    console.log(`[WebSocket] Pushing remote command to device ${deviceId}:`, command);
    return this.sendMessage(deviceId, {
      type: MessageType.REMOTE_COMMAND,
      data: command
    });
  }

  /**
   * 广播设备状态到所有Web客户端
   */
  broadcastDeviceState(deviceId: string, state: any): void {
    console.log(`[WebSocket] Broadcasting device state for device ${deviceId} to ${this.webClients.size} web clients`);

    // 只向Web管理后台客户端广播设备状态，不向设备广播
    this.webClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: MessageType.DEVICE_STATE_UPDATED,
            data: { deviceId, state, timestamp: Date.now() }
          }));
        } catch (error) {
          console.error('[WebSocket] Failed to broadcast device state:', error);
        }
      }
    });
  }

  /**
   * 广播设备在线状态到所有Web客户端
   */
  broadcastDeviceOnlineStatus(deviceId: string, online: boolean): void {
    console.log(`[WebSocket] Broadcasting device ${online ? 'online' : 'offline'} status for device ${deviceId} to ${this.webClients.size} web clients`);

    // 只向Web管理后台客户端广播设备在线状态
    this.webClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: MessageType.DEVICE_ONLINE_STATUS,
            data: { deviceId, online, timestamp: Date.now() }
          }));
        } catch (error) {
          console.error('[WebSocket] Failed to broadcast device online status:', error);
        }
      }
    });
  }

  /**
   * 检查设备是否在线
   */
  isConnected(deviceId: string): boolean {
    const ws = this.connections.get(deviceId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取所有在线设备
   */
  getOnlineDevices(): string[] {
    return Array.from(this.connections.keys()).filter(deviceId => {
      const ws = this.connections.get(deviceId);
      return ws && ws.readyState === WebSocket.OPEN;
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(deviceId: string): void {
    try {
      const interval = setInterval(() => {
        const success = this.sendMessage(deviceId, {
          type: MessageType.HEARTBEAT,
          data: { timestamp: Date.now() }
        });

        if (!success) {
          console.warn(`[WebSocket] Heartbeat failed for device ${deviceId}, disconnecting...`);
          this.disconnect(deviceId);
        }
      }, CONFIG.HEARTBEAT_INTERVAL);

      this.heartbeatIntervals.set(deviceId, interval);
      console.log(`[WebSocket] Heartbeat started for device ${deviceId}, interval: ${CONFIG.HEARTBEAT_INTERVAL}ms`);
    } catch (error) {
      console.error(`[WebSocket] Failed to start heartbeat for device ${deviceId}:`, error);
    }
  }

  /**
   * 清理所有连接
   */
  cleanup(): void {
    console.log(`[WebSocket] Cleaning up ${this.connections.size} connections...`);
    const deviceIds = Array.from(this.connections.keys());
    deviceIds.forEach(deviceId => this.disconnect(deviceId));

    if (this.wss) {
      this.wss.close(() => {
        console.log('[WebSocket] Server closed');
      });
    }

    console.log('[WebSocket] All connections cleaned up');
  }
}

// 单例模式
let wsServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService();
  }
  return wsServiceInstance;
}
