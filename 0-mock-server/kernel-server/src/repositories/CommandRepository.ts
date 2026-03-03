/**
 * Command数据访问层
 */

import { getDatabase } from '../database';
import {
  CommandItem, Command, CommandRecord,
  CreateCommandItemRequest, UpdateCommandItemRequest,
  SendCommandRequest
} from '../types';
import { generateId } from '../utils/idGenerator';

export class CommandRepository {
  // ==================== CommandItem ====================

  /**
   * 创建指令项
   */
  createItem(data: CreateCommandItemRequest): CommandItem {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO command_item (
        id, name, type, valid, default_payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.type,
      data.valid !== undefined ? (data.valid ? 1 : 0) : 1,
      data.defaultPayload || null,
      now,
      now
    );

    return this.findItemById(id)!;
  }

  /**
   * 根据ID查找指令项
   */
  findItemById(id: string): CommandItem | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command_item WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToItem(row) : null;
  }

  /**
   * 查找所有指令项
   */
  findAllItems(): CommandItem[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command_item ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapToItem(row));
  }

  /**
   * 更新指令项
   */
  updateItem(id: string, data: UpdateCommandItemRequest): CommandItem {
    const db = getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.type !== undefined) {
      fields.push('type = ?');
      values.push(data.type);
    }

    if (data.valid !== undefined) {
      fields.push('valid = ?');
      values.push(data.valid ? 1 : 0);
    }

    if (data.defaultPayload !== undefined) {
      fields.push('default_payload = ?');
      values.push(data.defaultPayload);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const stmt = db.prepare(`UPDATE command_item SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findItemById(id)!;
  }

  /**
   * 删除指令项
   */
  deleteItem(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM command_item WHERE id = ?');
    stmt.run(id);
  }

  // ==================== Command ====================

  /**
   * 创建指令
   */
  createCommand(itemId: string, data: SendCommandRequest): Command {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    // 获取指令项
    const item = this.findItemById(itemId);
    if (!item) {
      throw new Error(`CommandItem ${itemId} not found`);
    }

    const stmt = db.prepare(`
      INSERT INTO command (id, type, payload, request_id, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      item.type,
      data.payload || item.defaultPayload || null,
      data.requestId || null,
      data.sessionId || null,
      now
    );

    return this.findCommandById(id)!;
  }

  /**
   * 根据ID查找指令
   */
  findCommandById(id: string): Command | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToCommand(row) : null;
  }

  // ==================== CommandRecord ====================

  /**
   * 创建指令记录
   */
  createRecord(commandId: string, deviceId: string, sendResult: boolean): CommandRecord {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    const command = this.findCommandById(commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found`);
    }

    const stmt = db.prepare(`
      INSERT INTO command_record (
        id, command_id, device_id, type, request_id, session_id,
        send_at, send_result, receive_at, receive_result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      commandId,
      deviceId,
      command.type,
      command.requestId,
      command.sessionId,
      now,
      sendResult ? 1 : 0,
      null,
      null
    );

    return this.findRecordById(id)!;
  }

  /**
   * 根据ID查找指令记录
   */
  findRecordById(id: string): CommandRecord | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command_record WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToRecord(row) : null;
  }

  /**
   * 根据commandId查找指令记录
   */
  findRecordByCommandId(commandId: string): CommandRecord | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command_record WHERE command_id = ? ORDER BY send_at DESC LIMIT 1');
    const row = stmt.get(commandId) as any;

    return row ? this.mapToRecord(row) : null;
  }

  /**
   * 根据deviceId查找指令记录
   */
  findRecordsByDeviceId(deviceId: string): CommandRecord[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM command_record WHERE device_id = ? ORDER BY send_at DESC');
    const rows = stmt.all(deviceId) as any[];

    return rows.map(row => this.mapToRecord(row));
  }

  /**
   * 更新指令接收结果
   */
  updateRecordReceiveResult(commandId: string, receiveResult: boolean): CommandRecord {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE command_record
      SET receive_at = ?, receive_result = ?
      WHERE command_id = ?
    `);

    stmt.run(now, receiveResult ? 1 : 0, commandId);

    const record = this.findRecordByCommandId(commandId);
    if (!record) {
      throw new Error(`CommandRecord for command ${commandId} not found`);
    }

    return record;
  }

  /**
   * 删除指令记录
   */
  deleteRecord(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM command_record WHERE id = ?');
    stmt.run(id);
  }

  // ==================== 映射函数 ====================

  private mapToItem(row: any): CommandItem {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      valid: row.valid === 1,
      defaultPayload: row.default_payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToCommand(row: any): Command {
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      requestId: row.request_id,
      sessionId: row.session_id,
      createdAt: row.created_at
    };
  }

  private mapToRecord(row: any): CommandRecord {
    return {
      id: row.id,
      commandId: row.command_id,
      deviceId: row.device_id,
      type: row.type,
      requestId: row.request_id,
      sessionId: row.session_id,
      sendAt: row.send_at,
      sendResult: row.send_result === 1,
      receiveAt: row.receive_at,
      receiveResult: row.receive_result !== null ? row.receive_result === 1 : null
    };
  }
}
