/**
 * UnitData数据访问层
 */

import { getDatabase } from '../database';
import {
  UnitDataGroup, UnitDataItem, UnitDataTemplate, UnitData,
  CreateUnitDataGroupRequest, UpdateUnitDataGroupRequest,
  CreateUnitDataItemRequest, UpdateUnitDataItemRequest,
  CreateUnitDataTemplateRequest, UpdateUnitDataTemplateRequest,
  CreateUnitDataRequest, UpdateUnitDataRequest
} from '../types';
import { generateId } from '../utils/idGenerator';

export class UnitDataRepository {
  // ==================== UnitDataGroup ====================

  /**
   * 创建数据组
   */
  createGroup(data: CreateUnitDataGroupRequest): UnitDataGroup {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO unit_data_group (key, name, description, valid, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.key,
      data.name,
      data.description || null,
      data.valid !== undefined ? (data.valid ? 1 : 0) : 1,
      now
    );

    return this.findGroupByKey(data.key)!;
  }

  /**
   * 根据key查找数据组
   */
  findGroupByKey(key: string): UnitDataGroup | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data_group WHERE key = ?');
    const row = stmt.get(key) as any;

    return row ? this.mapToGroup(row) : null;
  }

  /**
   * 查找所有数据组
   */
  findAllGroups(): UnitDataGroup[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data_group ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapToGroup(row));
  }

  /**
   * 更新数据组
   */
  updateGroup(key: string, data: UpdateUnitDataGroupRequest): UnitDataGroup {
    const db = getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }

    if (data.valid !== undefined) {
      fields.push('valid = ?');
      values.push(data.valid ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(key);

    const stmt = db.prepare(`UPDATE unit_data_group SET ${fields.join(', ')} WHERE key = ?`);
    stmt.run(...values);

    return this.findGroupByKey(key)!;
  }

  /**
   * 删除数据组
   */
  deleteGroup(key: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM unit_data_group WHERE key = ?');
    stmt.run(key);
  }

  // ==================== UnitDataItem ====================

  /**
   * 创建数据项
   */
  createItem(data: CreateUnitDataItemRequest): UnitDataItem {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO unit_data_item (
        id, name, path, default_value, valid, group_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.path,
      data.defaultValue || null,
      data.valid !== undefined ? (data.valid ? 1 : 0) : 1,
      data.groupKey,
      now,
      now
    );

    return this.findItemById(id)!;
  }

  /**
   * 根据ID查找数据项
   */
  findItemById(id: string): UnitDataItem | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data_item WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToItem(row) : null;
  }

  /**
   * 查找所有数据项
   */
  findAllItems(groupKey?: string): UnitDataItem[] {
    const db = getDatabase();
    let stmt;

    if (groupKey) {
      stmt = db.prepare('SELECT * FROM unit_data_item WHERE group_key = ? ORDER BY created_at DESC');
      const rows = stmt.all(groupKey) as any[];
      return rows.map(row => this.mapToItem(row));
    } else {
      stmt = db.prepare('SELECT * FROM unit_data_item ORDER BY created_at DESC');
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapToItem(row));
    }
  }

  /**
   * 更新数据项
   */
  updateItem(id: string, data: UpdateUnitDataItemRequest): UnitDataItem {
    const db = getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.path !== undefined) {
      fields.push('path = ?');
      values.push(data.path);
    }

    if (data.defaultValue !== undefined) {
      fields.push('default_value = ?');
      values.push(data.defaultValue);
    }

    if (data.valid !== undefined) {
      fields.push('valid = ?');
      values.push(data.valid ? 1 : 0);
    }

    if (data.groupKey !== undefined) {
      fields.push('group_key = ?');
      values.push(data.groupKey);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const stmt = db.prepare(`UPDATE unit_data_item SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findItemById(id)!;
  }

  /**
   * 删除数据项
   */
  deleteItem(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM unit_data_item WHERE id = ?');
    stmt.run(id);
  }

  // ==================== UnitDataTemplate ====================

  /**
   * 创建数据模板
   */
  createTemplate(data: CreateUnitDataTemplateRequest): UnitDataTemplate {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO unit_data_template (
        id, name, unit_id, unit_type, valid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.unitId,
      data.unitType,
      data.valid !== undefined ? (data.valid ? 1 : 0) : 1,
      now,
      now
    );

    return this.findTemplateById(id)!;
  }

  /**
   * 根据ID查找数据模板
   */
  findTemplateById(id: string): UnitDataTemplate | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data_template WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToTemplate(row) : null;
  }

  /**
   * 根据unitId查找数据模板
   */
  findTemplatesByUnitId(unitId: string): UnitDataTemplate[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data_template WHERE unit_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(unitId) as any[];

    return rows.map(row => this.mapToTemplate(row));
  }

  /**
   * 更新数据模板
   */
  updateTemplate(id: string, data: UpdateUnitDataTemplateRequest): UnitDataTemplate {
    const db = getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.valid !== undefined) {
      fields.push('valid = ?');
      values.push(data.valid ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const stmt = db.prepare(`UPDATE unit_data_template SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findTemplateById(id)!;
  }

  /**
   * 删除数据模板(级联删除UnitData)
   */
  deleteTemplate(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM unit_data_template WHERE id = ?');
    stmt.run(id);
  }

  // ==================== UnitData ====================

  /**
   * 创建单元数据
   */
  createData(data: CreateUnitDataRequest): UnitData {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO unit_data (
        id, name, path, key, value, template_id, group_key,
        unit_id, unit_type, extra, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.path,
      data.key,
      data.value || null,
      data.templateId,
      data.groupKey,
      data.unitId,
      data.unitType,
      data.extra || null,
      now,
      now
    );

    return this.findDataById(id)!;
  }

  /**
   * 根据ID查找单元数据
   */
  findDataById(id: string): UnitData | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToData(row) : null;
  }

  /**
   * 根据templateId查找单元数据
   */
  findDataByTemplateId(templateId: string): UnitData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data WHERE template_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(templateId) as any[];

    return rows.map(row => this.mapToData(row));
  }

  /**
   * 根据unitId查找单元数据(所有模板)
   */
  findDataByUnitId(unitId: string): UnitData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data WHERE unit_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(unitId) as any[];

    return rows.map(row => this.mapToData(row));
  }

  /**
   * 根据unitId和groupKey查找单元数据
   */
  findDataByUnitIdAndGroup(unitId: string, groupKey: string): UnitData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit_data WHERE unit_id = ? AND group_key = ? ORDER BY created_at DESC');
    const rows = stmt.all(unitId, groupKey) as any[];

    return rows.map(row => this.mapToData(row));
  }

  /**
   * 根据多个unitId查找单元数据
   */
  findDataByUnitIds(unitIds: string[], groupKey?: string): UnitData[] {
    const db = getDatabase();
    const placeholders = unitIds.map(() => '?').join(',');
    let sql = `SELECT * FROM unit_data WHERE unit_id IN (${placeholders})`;
    const params: any[] = [...unitIds];

    if (groupKey) {
      sql += ' AND group_key = ?';
      params.push(groupKey);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapToData(row));
  }

  /**
   * 更新单元数据
   */
  updateData(id: string, data: UpdateUnitDataRequest): UnitData {
    const db = getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.key !== undefined) {
      fields.push('key = ?');
      values.push(data.key);
    }

    if (data.value !== undefined) {
      fields.push('value = ?');
      values.push(data.value);
    }

    if (data.extra !== undefined) {
      fields.push('extra = ?');
      values.push(data.extra);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const stmt = db.prepare(`UPDATE unit_data SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findDataById(id)!;
  }

  /**
   * 删除单元数据
   */
  deleteData(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM unit_data WHERE id = ?');
    stmt.run(id);
  }

  // ==================== 映射函数 ====================

  private mapToGroup(row: any): UnitDataGroup {
    return {
      key: row.key,
      name: row.name,
      description: row.description,
      valid: row.valid === 1,
      updatedAt: row.updated_at
    };
  }

  private mapToItem(row: any): UnitDataItem {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      defaultValue: row.default_value,
      valid: row.valid === 1,
      groupKey: row.group_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToTemplate(row: any): UnitDataTemplate {
    return {
      id: row.id,
      name: row.name,
      unitId: row.unit_id,
      unitType: row.unit_type,
      valid: row.valid === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToData(row: any): UnitData {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      key: row.key,
      value: row.value,
      templateId: row.template_id,
      groupKey: row.group_key,
      unitId: row.unit_id,
      unitType: row.unit_type,
      extra: row.extra,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
