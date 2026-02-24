/**
 * 数据库初始化
 */

import Database from 'better-sqlite3';
import { CONFIG } from '../config';
import { SCHEMA } from './schema';
import * as fs from 'fs';
import * as path from 'path';

let db: Database.Database | null = null;

/**
 * 初始化默认数据
 */
function initDefaultData(database: Database.Database): void {
  // 检查是否已存在 sendStateToServer
  const existingCommand = database.prepare(
    'SELECT id FROM command_item WHERE type = ?'
  ).get('kernel.terminal.sendStateToServer');

  if (!existingCommand) {
    // 插入 sendStateToServer
    const now = Date.now();
    database.prepare(`
      INSERT INTO command_item (id, name, type, valid, default_payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'sendStateToServer',
      '获取设备状态',
      'kernel.terminal.sendStateToServer',
      1,
      '{}',
      now,
      now
    );
    console.log('Default CommandItem "sendStateToServer" created');
  }
}

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // 确保数据目录存在
  const dbDir = path.dirname(CONFIG.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 创建数据库连接
  db = new Database(CONFIG.DB_PATH);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 创建表
  Object.values(SCHEMA).forEach(sql => {
    db!.exec(sql);
  });

  // 初始化默认数据
  initDefaultData(db);

  console.log('Database initialized successfully');

  return db;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}
