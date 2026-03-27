import http from 'http';
import url from 'url';
import WebSocket, {WebSocketServer} from 'ws';
import shortUUID from 'short-uuid';
import {format} from 'date-fns';
import {DeviceConnectionManager} from './DeviceConnectionManager';
import {RetryQueue} from './RetryQueue';
import {Logger} from './Logger';
import {ServerConfig, mergeServerConfig, DEFAULT_RUNTIME_CONFIG} from './config';
import {
  MessageWrapper, DeviceType, DeviceRegistration,
  RegistrationResponse, SYSTEM_NOTIFICATION
} from './types';

export class MasterSlaveWebSocketServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private deviceManager: DeviceConnectionManager;
  private logger: Logger;
  private config: ServerConfig;
  private cleanupInterval: NodeJS.Timeout;
  private heartbeatInterval: NodeJS.Timeout;
  /** masterDeviceId -> RetryQueue（每对设备一个队列） */
  private retryQueues = new Map<string, RetryQueue>();

  constructor(customConfig?: Partial<ServerConfig>) {
    this.config = mergeServerConfig(customConfig);
    this.logger = new Logger('Server', this.config.logLevel);
    this.deviceManager = new DeviceConnectionManager();

    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({noServer: true});

    this.httpServer.on('upgrade', (request, socket, head) => {
      this.handleWebSocketUpgrade(request, socket, head);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket服务器错误:', error);
    });

    this.cleanupInterval = setInterval(() => {
      this.deviceManager.cleanExpiredPendingDevices(DEFAULT_RUNTIME_CONFIG.tokenExpireTime);
    }, 60 * 1000) as unknown as NodeJS.Timeout;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkHeartbeatTimeout();
    }, DEFAULT_RUNTIME_CONFIG.heartbeatInterval) as unknown as NodeJS.Timeout;

    this.httpServer.listen(this.config.port, () => {
      this.logger.info('=================================');
      this.logger.info('Master-Slave Dual 服务器已启动');
      this.logger.info(`HTTP注册: http://localhost:${this.config.port}${this.config.basePath}/register`);
      this.logger.info(`WebSocket: ws://localhost:${this.config.port}${this.config.basePath}/ws?token=<TOKEN>`);
      this.logger.info('=================================');
    });
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const bp = this.config.basePath;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    if (pathname === `${bp}/register` && req.method === 'POST') { this.handleRegistration(req, res); return; }
    if (pathname === `${bp}/health` && req.method === 'GET') { this.handleHealthCheck(res); return; }
    if (pathname === `${bp}/stats` && req.method === 'GET') { this.handleStats(res); return; }

    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'Not found'}));
  }

  private handleRegistration(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const reg: DeviceRegistration = JSON.parse(body);

        if (!reg.type || !reg.deviceId) {
          this.sendJson(res, 400, {success: false, error: 'Missing required fields: type, deviceId'});
          return;
        }
        if (reg.type !== DeviceType.MASTER && reg.type !== DeviceType.SLAVE) {
          this.sendJson(res, 400, {success: false, error: 'Invalid device type'});
          return;
        }

        const token = shortUUID.generate();
        const result = this.deviceManager.preRegisterDevice(reg, token);

        if (result.success) {
          const response: RegistrationResponse = {
            success: true, token,
            deviceInfo: {deviceType: reg.type, deviceId: reg.deviceId}
          };
          this.sendJson(res, 200, response);
          this.logger.info(`[注册] ${reg.type}: ${reg.deviceId}`);
        } else {
          this.sendJson(res, 400, {success: false, error: result.error});
        }
      } catch {
        this.sendJson(res, 400, {success: false, error: 'Invalid JSON format'});
      }
    });
  }

  private handleHealthCheck(res: http.ServerResponse) {
    this.sendJson(res, 200, {status: 'ok', timestamp: format(new Date(), 'yyyy-M-d HH:mm:ss SSS')});
  }

  private handleStats(res: http.ServerResponse) {
    this.sendJson(res, 200, this.deviceManager.getStats());
  }

  private sendJson(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
  }

  private handleWebSocketUpgrade(request: http.IncomingMessage, socket: any, head: Buffer) {
    const parsedUrl = url.parse(request.url || '', true);
    if (parsedUrl.pathname !== `${this.config.basePath}/ws`) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return;
    }
    const token = parsedUrl.query.token as string;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleWebSocketConnection(ws, token);
    });
  }

  private handleWebSocketConnection(ws: WebSocket, token: string) {
    const result = this.deviceManager.connectDeviceWithToken(ws, token);
    if (!result.success || !result.deviceInfo) {
      ws.close(1008, result.error || 'Connection failed');
      this.logger.warn(`[WS] 连接失败: ${result.error}`);
      return;
    }

    const info = result.deviceInfo;
    this.logger.info(`[WS] ${info.type} 已连接: ${info.deviceId}`);

    // slave 连接后通知 master
    if (info.type === DeviceType.SLAVE && info.masterDeviceId) {
      this.notifyMaster(info.masterDeviceId, SYSTEM_NOTIFICATION.SLAVE_CONNECTED, {
        deviceId: info.deviceId,
        connectedAt: format(new Date(), 'yyyy-M-d HH:mm:ss SSS')
      });
      // 尝试刷新该 pair 的重试队列
      this.flushRetryQueue(info.masterDeviceId);
    }

    this.setupConnectionHandlers(ws);
    this.printStats();
  }

  private setupConnectionHandlers(ws: WebSocket) {
    ws.on('message', (data: Buffer) => {
      try {
        this.handleMessage(ws, JSON.parse(data.toString()));
      } catch (e) {
        this.logger.error('消息解析错误:', e);
      }
    });
    ws.on('close', () => this.handleDisconnection(ws));
    ws.on('error', (e) => this.logger.error('WS连接错误:', e));
  }

  private handleMessage(ws: WebSocket, message: MessageWrapper) {
    const device = this.deviceManager.findDeviceBySocket(ws);
    if (!device) return;

    if (message.type === SYSTEM_NOTIFICATION.HEARTBEAT_ACK) {
      this.deviceManager.updateHeartbeat(ws);
      return;
    }

    this.logger.debug(`[${device.type}] ${device.deviceId} =>`, JSON.stringify(message).substring(0, 200));

    // 双向转发：找到对端发送
    const peer = this.deviceManager.getPeer(device.masterDeviceId, device.type);
    if (peer) {
      if (!this.trySend(peer.socket, message)) {
        // 发送失败，入重试队列
        this.enqueueRetry(device.masterDeviceId, message);
      }
    } else {
      // 对端不在线，入重试队列
      this.enqueueRetry(device.masterDeviceId, message);
      this.logger.debug(`对端不在线，消息已缓存 (pair: ${device.masterDeviceId})`);
    }
  }

  private trySend(socket: WebSocket, message: MessageWrapper): boolean {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private enqueueRetry(masterDeviceId: string, message: MessageWrapper) {
    let queue = this.retryQueues.get(masterDeviceId);
    if (!queue) {
      const config = this.deviceManager.getRuntimeConfig(masterDeviceId);
      queue = new RetryQueue(config.retryCacheTimeout, this.logger, () => {
        // 超时回调：断开 slave
        this.logger.warn(`[RetryQueue] pair ${masterDeviceId} 缓存超时，断开 slave`);
        this.deviceManager.disconnectSlave(masterDeviceId);
        this.retryQueues.delete(masterDeviceId);
        // 通知 master
        this.notifyMaster(masterDeviceId, SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED, {
          reason: 'retry_cache_timeout'
        });
      });
      this.retryQueues.set(masterDeviceId, queue);
    }
    queue.enqueue(message);
  }

  private flushRetryQueue(masterDeviceId: string) {
    const queue = this.retryQueues.get(masterDeviceId);
    if (!queue || queue.size === 0) return;

    const slave = this.deviceManager.getSlave(masterDeviceId);
    if (slave && queue.flush(slave.socket)) {
      this.retryQueues.delete(masterDeviceId);
    }
  }

  private notifyMaster(masterDeviceId: string, type: string, data: any) {
    const master = this.deviceManager.getMaster(masterDeviceId);
    if (master) {
      this.trySend(master.socket, {from: '__system', id: shortUUID.generate(), type, data});
    }
  }

  private handleDisconnection(ws: WebSocket) {
    const device = this.deviceManager.findDeviceBySocket(ws);
    if (!device) return;

    this.logger.info(`[${device.type}] ${device.deviceId} 断开连接`);

    if (device.type === DeviceType.MASTER) {
      // master 断开：清理重试队列，断开整个 pair
      this.retryQueues.get(device.masterDeviceId)?.clear();
      this.retryQueues.delete(device.masterDeviceId);
      this.deviceManager.disconnectMaster(device.masterDeviceId);
    } else {
      // slave 断开：清理重试队列，通知 master
      this.retryQueues.get(device.masterDeviceId)?.clear();
      this.retryQueues.delete(device.masterDeviceId);
      this.notifyMaster(device.masterDeviceId, SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED, {
        deviceId: device.deviceId,
        disconnectedAt: format(new Date(), 'yyyy-M-d HH:mm:ss SSS')
      });
      this.deviceManager.disconnectSlave(device.masterDeviceId);
    }

    this.printStats();
  }

  private sendHeartbeat() {
    const msg: MessageWrapper = {
      from: '__system', id: shortUUID.generate(),
      type: SYSTEM_NOTIFICATION.HEARTBEAT,
      data: {timestamp: Date.now()}
    };
    const devices = this.deviceManager.getAllSockets();
    devices.forEach(({socket}) => this.trySend(socket, msg));
    this.logger.debug(`已向 ${devices.length} 个设备发送心跳`);
  }

  private checkHeartbeatTimeout() {
    const timeouts = this.deviceManager.checkAndDisconnectTimeoutDevices();
    timeouts.forEach(d => {
      this.logger.warn(`[${d.type}] ${d.deviceId} 心跳超时，已断开`);
    });
  }

  private printStats() {
    const s = this.deviceManager.getStats();
    this.logger.info(`--- Master: ${s.masterCount}, Slave: ${s.slaveCount}, Pending: ${s.pendingCount} ---`);
  }

  public getStats() { return this.deviceManager.getStats(); }

  public close() {
    clearInterval(this.cleanupInterval);
    clearInterval(this.heartbeatInterval);
    this.retryQueues.forEach(q => q.clear());
    this.retryQueues.clear();
    this.wss.close();
    this.httpServer.close();
    this.logger.info('服务器已关闭');
  }
}
