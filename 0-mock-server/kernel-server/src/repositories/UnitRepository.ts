/**
 * Unit数据访问层
 */

import { getDatabase } from '../database';
import { Unit, Terminal, UnitType, CreateUnitRequest, UpdateUnitRequest } from '../types';
import { generateId } from '../utils/idGenerator';

export class UnitRepository {
  /**
   * 创建单元
   */
  create(data: CreateUnitRequest): Unit {
    const db = getDatabase();
    const now = Date.now();
    const id = generateId();

    // 计算rootPath
    let rootPath: string[] = [id];
    if (data.parentId) {
      const parent = this.findById(data.parentId);
      if (parent) {
        rootPath = [...parent.rootPath, id];
      }
    }

    const stmt = db.prepare(`
      INSERT INTO unit (
        id, name, key, type, parent_id, root_path,
        entity_unit_id, model_unit_id, active_code, deactive_code,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.key,
      data.type,
      data.parentId || null,
      JSON.stringify(rootPath),
      data.entityUnitId || null,
      data.modelUnitId || null,
      data.activeCode || null,
      data.deactiveCode || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * 根据ID查找单元
   */
  findById(id: string): Unit | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.mapToUnit(row) : null;
  }

  /**
   * 根据key查找单元
   */
  findByKey(key: string): Unit | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit WHERE key = ?');
    const row = stmt.get(key) as any;

    return row ? this.mapToUnit(row) : null;
  }

  /**
   * 根据激活码查找终端
   */
  findByActiveCode(activeCode: string): Terminal | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit WHERE active_code = ? AND type = ?');
    const row = stmt.get(activeCode, UnitType.TERMINAL) as any;

    return row ? this.mapToUnit(row) as Terminal : null;
  }

  /**
   * 查找所有单元
   */
  findAll(type?: UnitType): Unit[] {
    const db = getDatabase();
    let stmt;

    if (type) {
      stmt = db.prepare('SELECT * FROM unit WHERE type = ? ORDER BY created_at DESC');
      const rows = stmt.all(type) as any[];
      return rows.map(row => this.mapToUnit(row));
    } else {
      stmt = db.prepare('SELECT * FROM unit ORDER BY created_at DESC');
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapToUnit(row));
    }
  }

  /**
   * 查找根单元
   */
  findRoots(type?: UnitType): Unit[] {
    const db = getDatabase();
    let stmt;

    if (type) {
      stmt = db.prepare('SELECT * FROM unit WHERE parent_id IS NULL AND type = ? ORDER BY created_at DESC');
      const rows = stmt.all(type) as any[];
      return rows.map(row => this.mapToUnit(row));
    } else {
      stmt = db.prepare('SELECT * FROM unit WHERE parent_id IS NULL ORDER BY created_at DESC');
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapToUnit(row));
    }
  }

  /**
   * 查找子单元
   */
  findChildren(parentId: string): Unit[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM unit WHERE parent_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(parentId) as any[];

    return rows.map(row => this.mapToUnit(row));
  }

  /**
   * 递归查找树形结构
   */
  findTree(rootId: string): Unit & { children?: Unit[] } {
    const root = this.findById(rootId);
    if (!root) {
      throw new Error(`Unit ${rootId} not found`);
    }

    const children = this.findChildren(rootId);
    const result: any = { ...root };

    if (children.length > 0) {
      result.children = children.map(child => this.findTree(child.id));
    }

    return result;
  }

  /**
   * 更新单元
   */
  update(id: string, data: UpdateUnitRequest): Unit {
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

    if (data.activeCode !== undefined) {
      fields.push('active_code = ?');
      values.push(data.activeCode);
    }

    if (data.deactiveCode !== undefined) {
      fields.push('deactive_code = ?');
      values.push(data.deactiveCode);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const stmt = db.prepare(`
      UPDATE unit SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id)!;
  }

  /**
   * 删除单元(级联删除子单元)
   */
  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM unit WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 检查key是否已存在
   */
  existsByKey(key: string, excludeId?: string): boolean {
    const db = getDatabase();
    let stmt;

    if (excludeId) {
      stmt = db.prepare('SELECT COUNT(*) as count FROM unit WHERE key = ? AND id != ?');
      const row = stmt.get(key, excludeId) as any;
      return row.count > 0;
    } else {
      stmt = db.prepare('SELECT COUNT(*) as count FROM unit WHERE key = ?');
      const row = stmt.get(key) as any;
      return row.count > 0;
    }
  }

  /**
   * 将数据库行映射为Unit对象
   */
  private mapToUnit(row: any): Unit {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      type: row.type as UnitType,
      parentId: row.parent_id,
      rootPath: row.root_path ? JSON.parse(row.root_path) : [],
      entityUnitId: row.entity_unit_id,
      modelUnitId: row.model_unit_id,
      activeCode: row.active_code,
      deactiveCode: row.deactive_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 更新rootPath(当parent变更时使用)
   */
  updateRootPath(id: string, newRootPath: string[]): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE unit SET root_path = ?, updated_at = ? WHERE id = ?');
    stmt.run(JSON.stringify(newRootPath), Date.now(), id);

    // 递归更新所有子单元的rootPath
    const children = this.findChildren(id);
    children.forEach(child => {
      const childRootPath = [...newRootPath, child.id];
      this.updateRootPath(child.id, childRootPath);
    });
  }
}
