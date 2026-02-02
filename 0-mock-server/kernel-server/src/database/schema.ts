/**
 * 数据库表结构定义
 */

export const SCHEMA = {
  // 单元表
  UNIT: `
    CREATE TABLE IF NOT EXISTS unit (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      key         TEXT UNIQUE NOT NULL,
      type        TEXT NOT NULL,
      parent_id   TEXT,
      root_path   TEXT,

      entity_unit_id  TEXT,
      model_unit_id   TEXT,
      active_code     TEXT,
      deactive_code   TEXT,

      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,

      FOREIGN KEY (parent_id) REFERENCES unit(id) ON DELETE CASCADE,
      FOREIGN KEY (entity_unit_id) REFERENCES unit(id),
      FOREIGN KEY (model_unit_id) REFERENCES unit(id)
    );

    CREATE INDEX IF NOT EXISTS idx_unit_type ON unit(type);
    CREATE INDEX IF NOT EXISTS idx_unit_parent ON unit(parent_id);
    CREATE INDEX IF NOT EXISTS idx_unit_active_code ON unit(active_code);
  `,

  // 设备表
  DEVICE: `
    CREATE TABLE IF NOT EXISTS device (
      id              TEXT PRIMARY KEY,
      manufacturer    TEXT,
      os              TEXT,
      os_version      TEXT,
      cpu             TEXT,
      memory          TEXT,
      disk            TEXT,
      network         TEXT,
      terminal_id     TEXT UNIQUE NOT NULL,
      token           TEXT NOT NULL,
      operating_entity_id TEXT,

      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,

      FOREIGN KEY (terminal_id) REFERENCES unit(id) ON DELETE CASCADE,
      FOREIGN KEY (operating_entity_id) REFERENCES unit(id)
    );

    CREATE INDEX IF NOT EXISTS idx_device_terminal ON device(terminal_id);
    CREATE INDEX IF NOT EXISTS idx_device_token ON device(token);
  `,

  // 设备连接状态表
  DEVICE_CONNECTION_INFO: `
    CREATE TABLE IF NOT EXISTS device_connection_info (
      id              TEXT PRIMARY KEY,
      device_id       TEXT NOT NULL,
      connected_at    INTEGER NOT NULL,
      disconnected_at INTEGER,
      client_ip       TEXT,
      user_agent      TEXT,
      status          TEXT NOT NULL,

      FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_connection_device ON device_connection_info(device_id);
    CREATE INDEX IF NOT EXISTS idx_connection_status ON device_connection_info(status);
  `,

  // 单元数据组表
  UNIT_DATA_GROUP: `
    CREATE TABLE IF NOT EXISTS unit_data_group (
      key         TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      valid       INTEGER NOT NULL DEFAULT 1,
      updated_at  INTEGER NOT NULL
    );
  `,

  // 单元数据项表
  UNIT_DATA_ITEM: `
    CREATE TABLE IF NOT EXISTS unit_data_item (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      path            TEXT NOT NULL,
      default_value   TEXT,
      valid           INTEGER NOT NULL DEFAULT 1,
      group_key       TEXT NOT NULL,

      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,

      FOREIGN KEY (group_key) REFERENCES unit_data_group(key)
    );

    CREATE INDEX IF NOT EXISTS idx_data_item_group ON unit_data_item(group_key);
  `,

  // 单元数据模板表
  UNIT_DATA_TEMPLATE: `
    CREATE TABLE IF NOT EXISTS unit_data_template (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      unit_id     TEXT NOT NULL,
      unit_type   TEXT NOT NULL,
      valid       INTEGER NOT NULL DEFAULT 1,

      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,

      FOREIGN KEY (unit_id) REFERENCES unit(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_unit ON unit_data_template(unit_id);
  `,

  // 单元数据表
  UNIT_DATA: `
    CREATE TABLE IF NOT EXISTS unit_data (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      path        TEXT NOT NULL,
      key         TEXT,
      value       TEXT,
      template_id TEXT NOT NULL,
      group_key   TEXT NOT NULL,
      unit_id     TEXT NOT NULL,
      unit_type   TEXT NOT NULL,
      extra       TEXT,

      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,

      FOREIGN KEY (template_id) REFERENCES unit_data_template(id) ON DELETE CASCADE,
      FOREIGN KEY (group_key) REFERENCES unit_data_group(key),
      FOREIGN KEY (unit_id) REFERENCES unit(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_unit_data_template ON unit_data(template_id);
    CREATE INDEX IF NOT EXISTS idx_unit_data_group ON unit_data(group_key);
    CREATE INDEX IF NOT EXISTS idx_unit_data_unit ON unit_data(unit_id);
  `,

  // 指令项表
  COMMAND_ITEM: `
    CREATE TABLE IF NOT EXISTS command_item (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL,
      valid           INTEGER NOT NULL DEFAULT 1,
      default_payload TEXT,

      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `,

  // 指令表
  COMMAND: `
    CREATE TABLE IF NOT EXISTS command (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT,
      request_id  TEXT,
      session_id  TEXT,

      created_at  INTEGER NOT NULL
    );
  `,

  // 指令记录表
  COMMAND_RECORD: `
    CREATE TABLE IF NOT EXISTS command_record (
      id              TEXT PRIMARY KEY,
      command_id      TEXT NOT NULL,
      device_id       TEXT NOT NULL,
      type            TEXT NOT NULL,
      request_id      TEXT,
      session_id      TEXT,
      send_at         INTEGER NOT NULL,
      send_result     INTEGER NOT NULL,
      receive_at      INTEGER,
      receive_result  INTEGER,

      FOREIGN KEY (command_id) REFERENCES command(id),
      FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_record_command ON command_record(command_id);
    CREATE INDEX IF NOT EXISTS idx_record_device ON command_record(device_id);
  `
};
