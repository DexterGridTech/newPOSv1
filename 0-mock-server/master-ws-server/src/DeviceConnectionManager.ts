import WebSocket from 'ws';
import { DeviceType, DeviceInfo, DeviceRegistration } from './types';

/**
 * 设备连接管理器
 * 管理设备注册token和连接状态
 */
export class DeviceConnectionManager {
  /** 待连接设备映射: token -> DeviceInfo */
  private pendingDevices = new Map<string, DeviceInfo>();

  /** Master设备映射: deviceName -> {socket, info, lastHeartbeat} */
  private masterDevices = new Map<string, { socket: WebSocket; info: DeviceInfo; lastHeartbeat: number }>();

  /** Slave设备映射: deviceName -> {socket, info, lastHeartbeat} */
  private slaveDevices = new Map<string, { socket: WebSocket; info: DeviceInfo; lastHeartbeat: number }>();

  /** Master设备ID到设备名称的映射 */
  private masterIdToName = new Map<string, string>();

  /** Master设备名称到关联的slave设备名称列表的映射 */
  private masterToSlaves = new Map<string, Set<string>>();

  /**
   * 预注册设备(HTTP注册阶段)
   * 返回token用于后续WebSocket连接
   */
  preRegisterDevice(registration: DeviceRegistration, token: string): { success: boolean; error?: string } {
    const { type, deviceId, deviceName, masterDeviceId } = registration;

    // 检查设备名称是否已存在
    if (this.masterDevices.has(deviceName) || this.slaveDevices.has(deviceName)) {
      return { success: false, error: 'Device name already exists' };
    }

    // 检查是否已经有相同名称的待注册设备
    for (const pendingInfo of this.pendingDevices.values()) {
      if (pendingInfo.deviceName === deviceName) {
        return { success: false, error: 'Device name already in pending registration' };
      }
    }

    // 如果是slave设备,检查master是否已连接
    if (type === DeviceType.SLAVE) {
      if (!masterDeviceId) {
        return { success: false, error: 'masterDeviceId is required for slave device' };
      }

      const masterName = this.masterIdToName.get(masterDeviceId);
      if (!masterName) {
        return { success: false, error: 'Master device not connected' };
      }
    }

    const deviceInfo: DeviceInfo = {
      ...registration,
      connectedAt: new Date(),
      token
    };

    this.pendingDevices.set(token, deviceInfo);

    console.log(`[预注册] ${type === DeviceType.MASTER ? 'Master' : 'Slave'}: ${deviceName} (Token: ${token.substring(0, 8)}...)`);

    return { success: true };
  }

  /**
   * 通过token连接设备(WebSocket连接阶段)
   */
  connectDeviceWithToken(socket: WebSocket, token: string): { success: boolean; error?: string; deviceInfo?: DeviceInfo } {
    const deviceInfo = this.pendingDevices.get(token);

    if (!deviceInfo) {
      return { success: false, error: 'Invalid or expired token' };
    }

    const { type, deviceName, deviceId, masterDeviceId } = deviceInfo;

    // 再次检查设备名称是否已被占用
    if (this.masterDevices.has(deviceName) || this.slaveDevices.has(deviceName)) {
      this.pendingDevices.delete(token);
      return { success: false, error: 'Device name already connected' };
    }

    // 如果是slave设备,再次检查master是否还在线
    if (type === DeviceType.SLAVE && masterDeviceId) {
      const masterName = this.masterIdToName.get(masterDeviceId);
      if (!masterName || !this.masterDevices.has(masterName)) {
        this.pendingDevices.delete(token);
        return { success: false, error: 'Master device disconnected' };
      }
    }

    // 移除待注册状态
    this.pendingDevices.delete(token);

    // 更新连接时间
    deviceInfo.connectedAt = new Date();

    // 添加到已连接设备
    if (type === DeviceType.MASTER) {
      this.masterDevices.set(deviceName, { socket, info: deviceInfo, lastHeartbeat: Date.now() });
      this.masterIdToName.set(deviceId, deviceName);
      this.masterToSlaves.set(deviceName, new Set());
      console.log(`[Master] 连接成功: ${deviceName} (ID: ${deviceId})`);
    } else {
      this.slaveDevices.set(deviceName, { socket, info: deviceInfo, lastHeartbeat: Date.now() });
      const masterName = this.masterIdToName.get(masterDeviceId!);
      if (masterName) {
        this.masterToSlaves.get(masterName)?.add(deviceName);
        console.log(`[Slave] 连接成功: ${deviceName} (ID: ${deviceId}) -> Master: ${masterName}`);
      }
    }

    return { success: true, deviceInfo };
  }

  /**
   * 清理过期的待注册设备(超过5分钟)
   */
  cleanExpiredPendingDevices() {
    const now = Date.now();
    const expireTime = 5 * 60 * 1000; // 5分钟

    for (const [token, info] of this.pendingDevices.entries()) {
      if (now - info.connectedAt.getTime() > expireTime) {
        this.pendingDevices.delete(token);
        console.log(`[清理] 过期的待注册设备: ${info.deviceName}`);
      }
    }
  }

  /**
   * 获取master设备连接
   */
  getMasterDevice(deviceName: string) {
    return this.masterDevices.get(deviceName);
  }

  /**
   * 通过master设备ID获取master设备连接
   */
  getMasterDeviceById(deviceId: string) {
    const deviceName = this.masterIdToName.get(deviceId);
    return deviceName ? this.masterDevices.get(deviceName) : undefined;
  }

  /**
   * 获取slave设备连接
   */
  getSlaveDevice(deviceName: string) {
    return this.slaveDevices.get(deviceName);
  }

  /**
   * 获取master设备的所有关联slave设备
   */
  getSlavesByMaster(masterName: string): Array<{ socket: WebSocket; info: DeviceInfo; lastHeartbeat: number }> {
    const slaveNames = this.masterToSlaves.get(masterName);
    if (!slaveNames) {
      return [];
    }

    const slaves: Array<{ socket: WebSocket; info: DeviceInfo; lastHeartbeat: number }> = [];
    slaveNames.forEach(slaveName => {
      const slave = this.slaveDevices.get(slaveName);
      if (slave) {
        slaves.push(slave);
      }
    });

    return slaves;
  }

  /**
   * 获取slave设备关联的master设备
   */
  getMasterBySlaveInfo(slaveInfo: DeviceInfo) {
    if (!slaveInfo.masterDeviceId) {
      return undefined;
    }
    return this.getMasterDeviceById(slaveInfo.masterDeviceId);
  }

  /**
   * 通过设备名称查找指定的slave设备
   * 并验证该slave是否属于指定的master
   */
  getSlaveByNameAndMaster(slaveDeviceName: string, masterName: string) {
    const slave = this.slaveDevices.get(slaveDeviceName);
    if (!slave) {
      return undefined;
    }

    // 验证该slave是否属于该master
    const slaveNames = this.masterToSlaves.get(masterName);
    if (!slaveNames || !slaveNames.has(slaveDeviceName)) {
      return undefined;
    }

    return slave;
  }

  /**
   * 断开master设备连接
   * 会自动断开所有关联的slave设备
   */
  disconnectMaster(deviceName: string) {
    const master = this.masterDevices.get(deviceName);
    if (!master) {
      return;
    }

    const slaveNames = this.masterToSlaves.get(deviceName);
    if (slaveNames) {
      slaveNames.forEach(slaveName => {
        const slave = this.slaveDevices.get(slaveName);
        if (slave) {
          console.log(`[Slave] 因master断开而自动断开: ${slaveName}`);
          slave.socket.close();
          this.slaveDevices.delete(slaveName);
        }
      });
      this.masterToSlaves.delete(deviceName);
    }

    this.masterIdToName.delete(master.info.deviceId);
    this.masterDevices.delete(deviceName);
    console.log(`[Master] 断开连接: ${deviceName}`);
  }

  /**
   * 断开slave设备连接
   */
  disconnectSlave(deviceName: string) {
    const slave = this.slaveDevices.get(deviceName);
    if (!slave) {
      return;
    }

    const { masterDeviceId } = slave.info;
    if (masterDeviceId) {
      const masterName = this.masterIdToName.get(masterDeviceId);
      if (masterName) {
        this.masterToSlaves.get(masterName)?.delete(deviceName);
      }
    }

    this.slaveDevices.delete(deviceName);
    console.log(`[Slave] 断开连接: ${deviceName}`);
  }

  /**
   * 通过socket查找设备信息
   */
  findDeviceBySocket(socket: WebSocket): { type: DeviceType; name: string; info: DeviceInfo } | undefined {
    for (const [name, device] of this.masterDevices.entries()) {
      if (device.socket === socket) {
        return { type: DeviceType.MASTER, name, info: device.info };
      }
    }

    for (const [name, device] of this.slaveDevices.entries()) {
      if (device.socket === socket) {
        return { type: DeviceType.SLAVE, name, info: device.info };
      }
    }

    return undefined;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      masterCount: this.masterDevices.size,
      slaveCount: this.slaveDevices.size,
      pendingCount: this.pendingDevices.size,
      masters: Array.from(this.masterDevices.entries()).map(([name, device]) => ({
        name,
        deviceId: device.info.deviceId,
        connectedAt: device.info.connectedAt,
        slaveCount: this.masterToSlaves.get(name)?.size || 0
      })),
      slaves: Array.from(this.slaveDevices.entries()).map(([name, device]) => ({
        name,
        deviceId: device.info.deviceId,
        masterDeviceId: device.info.masterDeviceId,
        connectedAt: device.info.connectedAt
      }))
    };
  }

  /**
   * 更新设备心跳时间
   */
  updateHeartbeat(deviceName: string, deviceType: DeviceType) {
    if (deviceType === DeviceType.MASTER) {
      const device = this.masterDevices.get(deviceName);
      if (device) {
        device.lastHeartbeat = Date.now();
      }
    } else {
      const device = this.slaveDevices.get(deviceName);
      if (device) {
        device.lastHeartbeat = Date.now();
      }
    }
  }

  /**
   * 检查并断开超时的设备
   * @returns 被断开的设备列表
   */
  checkAndDisconnectTimeoutDevices(timeoutMs: number): Array<{ type: DeviceType; name: string; info: DeviceInfo }> {
    const now = Date.now();
    const disconnectedDevices: Array<{ type: DeviceType; name: string; info: DeviceInfo }> = [];

    // 检查master设备
    for (const [name, device] of this.masterDevices.entries()) {
      if (now - device.lastHeartbeat > timeoutMs) {
        disconnectedDevices.push({ type: DeviceType.MASTER, name, info: device.info });
        device.socket.close();
      }
    }

    // 检查slave设备
    for (const [name, device] of this.slaveDevices.entries()) {
      if (now - device.lastHeartbeat > timeoutMs) {
        disconnectedDevices.push({ type: DeviceType.SLAVE, name, info: device.info });
        device.socket.close();
      }
    }

    return disconnectedDevices;
  }

  /**
   * 获取所有设备列表(用于发送心跳)
   */
  getAllDevices(): Array<{ type: DeviceType; name: string; socket: WebSocket }> {
    const devices: Array<{ type: DeviceType; name: string; socket: WebSocket }> = [];

    for (const [name, device] of this.masterDevices.entries()) {
      devices.push({ type: DeviceType.MASTER, name, socket: device.socket });
    }

    for (const [name, device] of this.slaveDevices.entries()) {
      devices.push({ type: DeviceType.SLAVE, name, socket: device.socket });
    }

    return devices;
  }
}
