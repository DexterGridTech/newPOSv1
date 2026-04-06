import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { DEFAULT_OWNER_TEAM_ID, DEFAULT_OWNER_USER_ID, DEFAULT_SANDBOX_ID } from '../shared/constants.js'
import { createId, now } from '../shared/utils.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataFile = path.resolve(currentDir, '../../data/mock-terminal-platform.sqlite')

export const sqlite = new Database(dataFile)
export const db = drizzle(sqlite)

export const initializeDatabase = (): void => {
  sqlite.pragma('journal_mode = WAL')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sandboxes (
      sandbox_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      seed INTEGER,
      owner_user_id TEXT NOT NULL,
      owner_team_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      resource_limits_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_profiles (
      profile_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      default_config_template_id TEXT,
      default_app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_templates (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      preset_config_json TEXT NOT NULL,
      preset_tags_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_instances (
      terminal_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      lifecycle_status TEXT NOT NULL,
      presence_status TEXT NOT NULL,
      health_status TEXT NOT NULL,
      current_app_version TEXT,
      current_bundle_version TEXT,
      current_config_version TEXT,
      device_fingerprint TEXT,
      device_info_json TEXT NOT NULL,
      source_mode TEXT NOT NULL,
      activated_at INTEGER,
      last_seen_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activation_codes (
      code TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      template_id TEXT,
      status TEXT NOT NULL,
      used_by TEXT,
      used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_credentials (
      credential_id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      refresh_expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS task_releases (
      release_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_selector_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_instances (
      instance_id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      result_json TEXT,
      error_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      delivered_at INTEGER,
      finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS tdp_sessions (
      session_id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      sandbox_id TEXT NOT NULL,
      client_version TEXT NOT NULL,
      protocol_version TEXT NOT NULL,
      status TEXT NOT NULL,
      connected_at INTEGER NOT NULL,
      disconnected_at INTEGER,
      last_heartbeat_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS tdp_topics (
      topic_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      payload_mode TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      retention_hours INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tdp_projections (
      projection_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tdp_change_logs (
      change_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      source_release_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fault_rules (
      fault_rule_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      matcher_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      hit_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      target_id TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  seedDefaultData()
}

const seedDefaultData = (): void => {
  const count = sqlite.prepare('SELECT COUNT(*) as count FROM sandboxes').get() as { count: number }
  if (count.count > 0) return

  const timestamp = now()

  sqlite.prepare(`
    INSERT INTO sandboxes (sandbox_id, name, description, status, seed, owner_user_id, owner_team_id, purpose, resource_limits_json, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_SANDBOX_ID,
    '默认联调沙箱',
    '面向 TDP/TCP 联调的默认沙箱',
    'ACTIVE',
    20260406,
    DEFAULT_OWNER_USER_ID,
    DEFAULT_OWNER_TEAM_ID,
    'integration',
    JSON.stringify({ maxTerminals: 200, maxTasks: 1000, maxFaultRules: 100, maxStorageSize: '2GB' }),
    'system',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_profiles (profile_id, name, description, capabilities_json, default_config_template_id, default_app_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'profile-rn84-retail',
    'RN84 零售终端',
    '支持双屏、扫码、打印的零售终端模板',
    JSON.stringify({ supportsDualScreen: true, supportsCamera: true, supportsPrinter: true, supportsScanner: true }),
    'config-template-default',
    '2.3.18',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_templates (template_id, name, description, profile_id, preset_config_json, preset_tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'terminal-template-retail-default',
    '零售默认模板',
    '默认终端模板',
    'profile-rn84-retail',
    JSON.stringify({ app: { theme: 'dark', locale: 'zh-CN' }, hardware: { printer: true, scanner: true } }),
    JSON.stringify(['mixc-retail', 'rn84', 'default']),
    timestamp,
    timestamp,
  )

  for (let index = 1; index <= 6; index += 1) {
    const terminalId = `T-100${index}`
    sqlite.prepare(`
      INSERT INTO terminal_instances (
        terminal_id, sandbox_id, project_id, tenant_id, brand_id, store_id, profile_id, template_id,
        lifecycle_status, presence_status, health_status, current_app_version, current_bundle_version,
        current_config_version, device_fingerprint, device_info_json, source_mode, activated_at, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      terminalId,
      DEFAULT_SANDBOX_ID,
      'mixc-retail',
      'tenant-mixc',
      'brand-mixc',
      `store-${index <= 3 ? 'sz-bay' : 'gz-tower'}`,
      'profile-rn84-retail',
      'terminal-template-retail-default',
      'ACTIVE',
      index <= 4 ? 'ONLINE' : 'OFFLINE',
      index === 5 ? 'WARNING' : 'HEALTHY',
      '2.3.18',
      'bundle-2026.04.06',
      'config-2026.04.01',
      `fp-${terminalId}`,
      JSON.stringify({ model: 'PDA-X1', osVersion: 'Android 14', manufacturer: 'IMPOS2' }),
      'STANDARD',
      timestamp - index * 3600_000,
      timestamp - index * 60_000,
      timestamp,
      timestamp,
    )
  }

  for (let index = 1; index <= 8; index += 1) {
    sqlite.prepare(`
      INSERT INTO activation_codes (code, sandbox_id, tenant_id, brand_id, store_id, profile_id, template_id, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ACT-${1000 + index}`,
      DEFAULT_SANDBOX_ID,
      'tenant-mixc',
      'brand-mixc',
      index <= 4 ? 'store-sz-bay' : 'store-gz-tower',
      'profile-rn84-retail',
      'terminal-template-retail-default',
      index <= 2 ? 'USED' : 'AVAILABLE',
      timestamp + 7 * 24 * 3600_000,
      timestamp,
    )
  }

  sqlite.prepare(`
    INSERT INTO tdp_topics (topic_id, sandbox_id, key, name, payload_mode, schema_json, scope_type, retention_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('topic'),
    DEFAULT_SANDBOX_ID,
    'tcp.task.release',
    'TCP 任务发布主题',
    'FLEXIBLE_JSON',
    JSON.stringify({ type: 'object', required: ['taskType', 'releaseId', 'payload'] }),
    'TERMINAL',
    72,
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_topics (topic_id, sandbox_id, key, name, payload_mode, schema_json, scope_type, retention_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('topic'),
    DEFAULT_SANDBOX_ID,
    'terminal.config.state',
    '终端配置状态主题',
    'FLEXIBLE_JSON',
    JSON.stringify({ type: 'object', required: ['configVersion'] }),
    'TERMINAL',
    168,
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_projections (projection_id, sandbox_id, topic_key, scope_type, scope_key, revision, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('projection'),
    DEFAULT_SANDBOX_ID,
    'terminal.config.state',
    'TERMINAL',
    'T-1001',
    3,
    JSON.stringify({ configVersion: 'config-2026.04.01', appVersion: '2.3.18', desiredVersion: '2.3.18' }),
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO fault_rules (fault_rule_id, sandbox_id, name, target_type, matcher_json, action_json, enabled, hit_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('fault'),
    DEFAULT_SANDBOX_ID,
    '配置下发延迟 5 秒',
    'TDP_DELIVERY',
    JSON.stringify({ topicKey: 'tcp.task.release', taskType: 'CONFIG_PUBLISH' }),
    JSON.stringify({ type: 'DELAY', durationMs: 5000 }),
    1,
    0,
    timestamp,
    timestamp,
  )
}
