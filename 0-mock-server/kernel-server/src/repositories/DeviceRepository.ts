/**
 * Device数据访问层
 */

import { getDatabase } from '../database';
import { Device, DeviceInfo, DeviceConnectionInfo, DeviceConnectionStatus } from '../types';
import { generateToken, generateId } from '../utils/idGenerator';

export class DeviceRepository {
  /**
   * 创建设备
   */
  create(deviceInfo: DeviceInfo, terminalId: string): Device {
    const db = getDatabase();
    const now = Date.now();
    const token = generateToken();

    const stmt = db.prepare(`
      INSERT INTO device (
        id, manufacturer, os, os_version, cpu, memory, disk, network,
        terminal_id, token, operating_entity_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      deviceInfo.id,
      deviceInfo.manufacturer,
      deviceInfo.os,
      deviceInfo.osVersion,
      deviceInfo.cpu,
      deviceInfo.memory,
      deviceInfo.disk,
      deviceInfo.network,
      terminalId,
      token,
      null,
      now,
      now
    );

    return this.findById(deviceInfo.id)!;
  }

  /**
   * 根据ID查找设备
   */
  findById(id: string): Device | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToDevice(row) : null;
  }

  /**
   * 根据token查找设备
   */
  findByToken(token: string): Device | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device WHERE token = ?');
    const row = stmt.get(token) as any;

    return row ? this.mapToDevice(row) : null;
  }

  /**
   * 根据terminalId查找设备
   */
  findByTerminalId(terminalId: string): Device | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device WHERE terminal_id = ?');
    const row = stmt.get(terminalId) as any;

    return row ? this.mapToDevice(row) : null;
  }

  /**
   * 查找所有设备
   */
  findAll(): Device[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapToDevice(row));
  }

  /**
   * 根据modelId查找所有设备
   */
  findByModelId(modelId: string): Device[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT d.* FROM device d
      INNER JOIN unit u ON d.terminal_id = u.id
      WHERE u.model_unit_id = ?
    `);
    const rows = stmt.all(modelId) as any[];

    return rows.map(row => this.mapToDevice(row));
  }

  /**
   * 根据entityId查找所有设备(rootPath包含该entity)
   */
  findByEntityInRootPath(entityId: string): Device[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT d.* FROM device d
      INNER JOIN unit e ON d.operating_entity_id = e.id
      WHERE e.root_path LIKE ?
    `);
    const rows = stmt.all(`%"${entityId}"%`) as any[];

    return rows.map(row => this.mapToDevice(row));
  }

  /**
   * 更新设备的操作实体
   */
  updateOperatingEntity(id: string, operatingEntityId: string | null): Device {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE device SET operating_entity_id = ?, updated_at = ? WHERE id = ?');
    stmt.run(operatingEntityId, Date.now(), id);

    return this.findById(id)!;
  }

  /**
   * 删除设备
   */
  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM device WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 记录设备连接
   */
  createConnection(deviceId: string, clientIp?: string, userAgent?: string): DeviceConnectionInfo {
    const db = getDatabase();
    const id = generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO device_connection_info (
        id, device_id, connected_at, disconnected_at, client_ip, user_agent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      deviceId,
      now,
      null,
      clientIp || null,
      userAgent || null,
      DeviceConnectionStatus.CONNECTED
    );

    return this.findConnectionById(id)!;
  }

  /**
   * 更新连接状态为断开
   */
  disconnectConnection(deviceId: string): void {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE device_connection_info
      SET disconnected_at = ?, status = ?
      WHERE device_id = ? AND status = ?
    `);

    stmt.run(now, DeviceConnectionStatus.DISCONNECTED, deviceId, DeviceConnectionStatus.CONNECTED);
  }

  /**
   * 查找设备的连接记录
   */
  findConnectionById(id: string): DeviceConnectionInfo | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device_connection_info WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToConnectionInfo(row) : null;
  }

  /**
   * 查找设备的所有连接记录
   */
  findConnectionsByDeviceId(deviceId: string): DeviceConnectionInfo[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM device_connection_info WHERE device_id = ? ORDER BY connected_at DESC');
    const rows = stmt.all(deviceId) as any[];

    return rows.map(row => this.mapToConnectionInfo(row));
  }

  /**
   * 查找设备的当前连接状态
   */
  findCurrentConnection(deviceId: string): DeviceConnectionInfo | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM device_connection_info
      WHERE device_id = ? AND status = ?
      ORDER BY connected_at DESC
      LIMIT 1
    `);
    const row = stmt.get(deviceId, DeviceConnectionStatus.CONNECTED) as any;

    return row ? this.mapToConnectionInfo(row) : null;
  }

  /**
   * 检查设备是否在线
   */
  isDeviceOnline(deviceId: string): boolean {
    const connection = this.findCurrentConnection(deviceId);
    return connection !== null;
  }

  /**
   * 将数据库行映射为Device对象
   */
  private mapToDevice(row: any): Device {
    return {
      id: row.id,
      manufacturer: row.manufacturer,
      os: row.os,
      osVersion: row.os_version,
      cpu: row.cpu,
      memory: row.memory,
      disk: row.disk,
      network: row.network,
      terminalId: row.terminal_id,
      token: row.token,
      operatingEntityId: row.operating_entity_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 将数据库行映射为DeviceConnectionInfo对象
   */
  private mapToConnectionInfo(row: any): DeviceConnectionInfo {
    return {
      id: row.id,
      deviceId: row.device_id,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      clientIp: row.client_ip,
      userAgent: row.user_agent,
      status: row.status as DeviceConnectionStatus
    };
  }
}
