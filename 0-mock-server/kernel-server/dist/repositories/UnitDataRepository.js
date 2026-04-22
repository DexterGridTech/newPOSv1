/**
 * UnitData数据访问层
 */
import { getDatabase } from '../database';
import { generateId } from '../utils/idGenerator';
export class UnitDataRepository {
    /**
     * 创建单元数据
     */
    createData(data) {
        const db = getDatabase();
        const now = Date.now();
        const id = generateId();
        const stmt = db.prepare(`
      INSERT INTO unit_data (id, name, path, value, "group", unit_id, unit_type, extra, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.name, data.path, data.value || null, data.group, data.unitId, data.unitType, data.extra || null, now, now);
        return this.findDataById(id);
    }
    /**
     * 根据ID查找单元数据
     */
    findDataById(id) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM unit_data WHERE id = ?');
        const row = stmt.get(id);
        return row ? this.mapToData(row) : null;
    }
    /**
     * 根据unitId查找单元数据
     */
    findDataByUnitId(unitId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM unit_data WHERE unit_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(unitId);
        return rows.map(row => this.mapToData(row));
    }
    /**
     * 根据group和unitId查找单元数据
     */
    findDataByGroupAndUnitId(group, unitId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM unit_data WHERE "group" = ? AND unit_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(group, unitId);
        return rows.map(row => this.mapToData(row));
    }
    /**
     * 根据多个unitId和group查找单元数据
     */
    findDataByUnitIds(unitIds, group) {
        if (unitIds.length === 0)
            return [];
        const db = getDatabase();
        const placeholders = unitIds.map(() => '?').join(',');
        const sql = group
            ? `SELECT * FROM unit_data WHERE unit_id IN (${placeholders}) AND "group" = ? ORDER BY created_at DESC`
            : `SELECT * FROM unit_data WHERE unit_id IN (${placeholders}) ORDER BY created_at DESC`;
        const params = group ? [...unitIds, group] : unitIds;
        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map(row => this.mapToData(row));
    }
    /**
     * 更新单元数据
     */
    updateData(id, data) {
        const db = getDatabase();
        const now = Date.now();
        const fields = [];
        const values = [];
        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
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
        return this.findDataById(id);
    }
    /**
     * 删除单元数据
     */
    deleteData(id) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM unit_data WHERE id = ?');
        stmt.run(id);
    }
    /**
     * 映射数据库行到UnitData对象
     */
    mapToData(row) {
        return {
            id: row.id,
            name: row.name,
            path: row.path,
            value: row.value,
            group: row.group,
            unitId: row.unit_id,
            unitType: row.unit_type,
            extra: row.extra,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
//# sourceMappingURL=UnitDataRepository.js.map