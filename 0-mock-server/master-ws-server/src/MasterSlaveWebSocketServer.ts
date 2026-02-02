import http from 'http';
import url from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import { DeviceConnectionManager } from './DeviceConnectionManager';
import { Logger } from './Logger';
import { ServerConfig, mergeConfig } from './config';
import {
  MessageWrapper,
  DeviceType,
  DeviceRegistration,
  RegistrationResponse,
  SYSTEM_NOTIFICATION
} from './types';

/**
 * Master-Slave WebSocket服务器
 * 结合HTTP注册和WebSocket通信
 */
export class MasterSlaveWebSocketServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private deviceManager: DeviceConnectionManager;
  private logger: Logger;
  private config: ServerConfig;
  private cleanupInterval: NodeJS.Timeout;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(customConfig?: Partial<ServerConfig>) {
    this.config = mergeConfig(customConfig);
    this.logger = new Logger('Server', this.config.logLevel);
    this.deviceManager = new DeviceConnectionManager();

    // 创建HTTP服务器
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res, this.config.basePath);
    });

    // 创建WebSocket服务器
    this.wss = new WebSocketServer({
      noServer: true
    });

    // 处理WebSocket升级请求
    this.httpServer.on('upgrade', (request, socket, head) => {
      this.handleWebSocketUpgrade(request, socket, head, this.config.basePath);
    });

    this.setupWebSocketServer();

    // 定期清理过期的待注册设备
    this.cleanupInterval = setInterval(() => {
      this.deviceManager.cleanExpiredPendingDevices();
    }, this.config.cleanupInterval) as unknown as NodeJS.Timeout;

    // 启动心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkHeartbeatTimeout();
    }, this.config.heartbeatInterval) as unknown as NodeJS.Timeout;

    this.httpServer.listen(this.config.port, () => {
      this.logger.info(`=================================`);
      this.logger.info(`Master-Slave 服务器已启动`);
      this.logger.info(`HTTP注册地址: http://localhost:${this.config.port}${this.config.basePath}/register`);
      this.logger.info(`WebSocket地址: ws://localhost:${this.config.port}${this.config.basePath}/ws?token=<TOKEN>`);
      this.logger.info(`=================================`);
    });
  }

  /**
   * 处理HTTP请求
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse, basePath: string) {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 注册端点
    if (pathname === `${basePath}/register` && req.method === 'POST') {
      this.handleRegistration(req, res);
      return;
    }

    // 健康检查端点
    if (pathname === `${basePath}/health` && req.method === 'GET') {
      this.handleHealthCheck(req, res);
      return;
    }

    // 统计信息端点
    if (pathname === `${basePath}/stats` && req.method === 'GET') {
      this.handleStats(req, res);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * 处理设备注册(HTTP POST)
   */
  private handleRegistration(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const registration: DeviceRegistration = JSON.parse(body);

        // 验证必需字段
        if (!registration.type || !registration.deviceId || !registration.deviceName) {
          const response: RegistrationResponse = {
            success: false,
            error: 'Missing required fields: type, deviceId, deviceName'
          };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        }

        // 验证设备类型
        if (registration.type !== DeviceType.MASTER && registration.type !== DeviceType.SLAVE) {
          const response: RegistrationResponse = {
            success: false,
            error: 'Invalid device type, must be "master" or "slave"'
          };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        }

        // 生成token
        const token = nanoid(32);

        // 预注册设备
        const result = this.deviceManager.preRegisterDevice(registration, token);

        if (result.success) {
          const response: RegistrationResponse = {
            success: true,
            token,
            deviceInfo: {
              deviceType: registration.type,
              deviceId: registration.deviceId,
              deviceName: registration.deviceName
            }
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));

          console.log(`[HTTP注册] ${registration.type === DeviceType.MASTER ? 'Master' : 'Slave'}: ${registration.deviceName}`);
        } else {
          const response: RegistrationResponse = {
            success: false,
            error: result.error
          };

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        }
      } catch (error) {
        const response: RegistrationResponse = {
          success: false,
          error: 'Invalid JSON format'
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      }
    });
  }

  /**
   * 健康检查
   */
  private handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  /**
   * 获取统计信息
   */
  private handleStats(req: http.IncomingMessage, res: http.ServerResponse) {
    const stats = this.deviceManager.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }

  /**
   * 处理WebSocket升级请求
   */
  private handleWebSocketUpgrade(
    request: http.IncomingMessage,
    socket: any,
    head: Buffer,
    basePath: string
  ) {
    const parsedUrl = url.parse(request.url || '', true);
    const pathname = parsedUrl.pathname || '';

    // 验证路径
    if (pathname !== `${basePath}/ws`) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // 获取token
    const token = parsedUrl.query.token as string;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 升级WebSocket连接
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleWebSocketConnection(ws, token);
    });
  }

  /**
   * 处理WebSocket连接
   */
  private handleWebSocketConnection(ws: WebSocket, token: string) {
    const result = this.deviceManager.connectDeviceWithToken(ws, token);

    if (!result.success || !result.deviceInfo) {
      ws.close(1008, result.error || 'Connection failed');
      console.log(`[WebSocket] 连接失败: ${result.error}`);
      return;
    }

    const deviceInfo = result.deviceInfo;
    console.log(`[WebSocket] ${deviceInfo.type === DeviceType.MASTER ? 'Master' : 'Slave'} 设备已连接: ${deviceInfo.deviceName}`);

    // 如果是slave设备,通知master
    if (deviceInfo.type === DeviceType.SLAVE) {
      this.notifyMasterSlaveConnected(deviceInfo);
    }

    this.setupConnectionEventHandlers(ws);
    this.printStats();
  }

  /**
   * 设置WebSocket服务器事件处理
   */
  private setupWebSocketServer() {
    this.wss.on('error', (error) => {
      console.error('WebSocket服务器错误:', error);
    });
  }

  /**
   * 设置连接事件处理
   */
  private setupConnectionEventHandlers(ws: WebSocket) {
    ws.on('message', (data: Buffer) => {
      try {
        const message: MessageWrapper = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('消息解析错误:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket连接错误:', error);
    });
  }

  /**
   * 处理业务消息
   */
  private handleMessage(ws: WebSocket, message: MessageWrapper) {
    const device = this.deviceManager.findDeviceBySocket(ws);
    if (!device) {
      return;
    }

    // 处理心跳响应
    if (message.type === SYSTEM_NOTIFICATION.HEARTBEAT_ACK) {
      this.deviceManager.updateHeartbeat(device.name, device.type);
      this.logger.debug(`收到 ${device.type.toUpperCase()} ${device.name} 的心跳响应`);
      return;
    }
    this.logger.debug("==>",JSON.stringify(message));
    this.logger.info(`[${device.type.toUpperCase()}] ${device.name} 发送消息:`);
    this.logger.debug(`  From: ${message.from}`);
    this.logger.debug(`  Type: ${message.type}`);
    // 安全处理消息内容，支持非字符串类型
    let content: string;
    if (typeof message.data === 'string') {
      content = message.data.substring(0, 100) + (message.data.length > 100 ? '...' : '');
    } else {
      const strData = JSON.stringify(message.data);
      content = strData.substring(0, 100) + (strData.length > 100 ? '...' : '');
    }
    this.logger.debug(`  Content: ${content}`);

    if (device.type === DeviceType.SLAVE) {
      this.handleSlaveMessage(device.info, message);
    } else if (device.type === DeviceType.MASTER) {
      this.handleMasterMessage(device.name, message);
    }
  }

  /**
   * 处理slave设备消息(转发给master)
   */
  private handleSlaveMessage(slaveInfo: any, message: MessageWrapper) {
    const master = this.deviceManager.getMasterBySlaveInfo(slaveInfo);
    if (master) {
      this.sendMessage(master.socket, message);
      console.log(`  -> 已转发给 Master: ${master.info.deviceName}`);
    } else {
      console.log(`  -> Master设备未连接,消息丢弃`);
    }
  }

  /**
   * 处理master设备消息
   * 如果消息包含targetDevice,则发送给指定的slave
   * 否则广播给所有关联的slave
   */
  private handleMasterMessage(masterName: string, message: MessageWrapper) {
    // 检查是否指定了目标设备
    if (message.targetDevice) {
      // 发送给指定的slave设备
      const targetSlave = this.deviceManager.getSlaveByNameAndMaster(message.targetDevice, masterName);

      if (targetSlave) {
        this.sendMessage(targetSlave.socket, message);
        console.log(`  -> 已发送给指定Slave: ${message.targetDevice}`);
      } else {
        console.log(`  -> 指定的Slave设备不存在或不属于该Master: ${message.targetDevice}`);
      }
    } else {
      // 广播给所有关联的slave设备
      const slaves = this.deviceManager.getSlavesByMaster(masterName);

      if (slaves.length > 0) {
        slaves.forEach(slave => {
          this.sendMessage(slave.socket, message);
        });
        console.log(`  -> 已广播给 ${slaves.length} 个Slave设备`);
      } else {
        console.log(`  -> 没有关联的Slave设备`);
      }
    }
  }

  /**
   * 通知master设备有slave连接
   */
  private notifyMasterSlaveConnected(slaveInfo: any) {
    if (!slaveInfo.masterDeviceId) {
      return;
    }

    const master = this.deviceManager.getMasterDeviceById(slaveInfo.masterDeviceId);
    if (master) {
      const notification: MessageWrapper = {
        from: '__system',
        id: nanoid(),
        type: SYSTEM_NOTIFICATION.SLAVE_CONNECTED,
        data: {
          deviceId: slaveInfo.deviceId,
          deviceName: slaveInfo.deviceName,
          connectedAt: new Date().toISOString()
        }
      };

      this.sendMessage(master.socket, notification);
      console.log(`  -> 已通知 Master: ${master.info.deviceName}`);
    }
  }

  /**
   * 通知master设备有slave断开
   */
  private notifyMasterSlaveDisconnected(slaveInfo: any) {
    const master = this.deviceManager.getMasterBySlaveInfo(slaveInfo);
    if (master) {
      const notification: MessageWrapper = {
        from: '__system',
        id: nanoid(),
        type: SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED,
        data: {
          deviceId: slaveInfo.deviceId,
          deviceName: slaveInfo.deviceName,
          disconnectedAt: new Date().toISOString()
        }
      };

      this.sendMessage(master.socket, notification);
      console.log(`  -> 已通知 Master: ${master.info.deviceName} Slave断开`);
    }
  }

  /**
   * 处理设备断开连接
   */
  private handleDisconnection(ws: WebSocket) {
    const device = this.deviceManager.findDeviceBySocket(ws);
    if (!device) {
      console.log('\n未注册的连接断开');
      return;
    }

    console.log(`\n[${device.type.toUpperCase()}] ${device.name} 断开连接`);

    if (device.type === DeviceType.MASTER) {
      this.deviceManager.disconnectMaster(device.name);
    } else if (device.type === DeviceType.SLAVE) {
      this.notifyMasterSlaveDisconnected(device.info);
      this.deviceManager.disconnectSlave(device.name);
    }

    this.printStats();
  }

  /**
   * 发送消息
   */
  private sendMessage(ws: WebSocket, message: MessageWrapper) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 打印统计信息
   */
  private printStats() {
    const stats = this.deviceManager.getStats();
    console.log(`\n--- 当前连接统计 ---`);
    console.log(`Master设备: ${stats.masterCount}`);
    console.log(`Slave设备: ${stats.slaveCount}`);
    console.log(`待连接设备: ${stats.pendingCount}`);
    console.log(`-------------------\n`);
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    return this.deviceManager.getStats();
  }

  /**
   * 关闭服务器
   */
  public close() {
    clearInterval(this.cleanupInterval);
    clearInterval(this.heartbeatInterval);
    this.wss.close();
    this.httpServer.close();
    this.logger.info('服务器已关闭');
  }

  /**
   * 发送心跳消息到所有设备
   */
  private sendHeartbeat() {
    const devices = this.deviceManager.getAllDevices();
    const heartbeatMessage: MessageWrapper = {
      from: '__system',
      id: nanoid(),
      type: SYSTEM_NOTIFICATION.HEARTBEAT,
      data: { timestamp: Date.now() },
    };

    devices.forEach(({ socket }) => {
      this.sendMessage(socket, heartbeatMessage);
    });

    this.logger.debug(`已向 ${devices.length} 个设备发送心跳`);
  }

  /**
   * 检查心跳超时并断开超时设备
   */
  private checkHeartbeatTimeout() {
    const timeoutDevices = this.deviceManager.checkAndDisconnectTimeoutDevices(
      this.config.heartbeatTimeout
    );

    if (timeoutDevices.length > 0) {
      timeoutDevices.forEach(({ type, name }) => {
        this.logger.warn(`[${type.toUpperCase()}] ${name} 心跳超时,已断开连接`);
      });
    }
  }
}
