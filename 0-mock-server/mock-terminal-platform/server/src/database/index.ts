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

const RUNTIME_CONTEXT_KEY = 'global'

export const initializeDatabase = (): void => {
  sqlite.pragma('journal_mode = WAL')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sandboxes (
      sandbox_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      is_system_default INTEGER NOT NULL DEFAULT 0,
      creation_mode TEXT NOT NULL DEFAULT 'EMPTY',
      source_sandbox_id TEXT,
      seed INTEGER,
      owner_user_id TEXT NOT NULL,
      owner_team_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      resource_limits_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS platform_runtime_context (
      context_key TEXT PRIMARY KEY,
      current_sandbox_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      tenant_code TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS brands (
      brand_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      brand_code TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenant_brand_authorizations (
      authorization_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      project_code TEXT NOT NULL,
      project_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      region TEXT,
      timezone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stores (
      store_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      store_code TEXT NOT NULL,
      store_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_profiles (
      profile_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      profile_code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_templates (
      template_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      template_code TEXT NOT NULL,
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
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
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
      project_id TEXT NOT NULL,
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

  ensureColumn('sandboxes', 'is_system_default', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('sandboxes', 'creation_mode', "TEXT NOT NULL DEFAULT 'EMPTY'")
  ensureColumn('sandboxes', 'source_sandbox_id', 'TEXT')
  ensureColumn('terminal_profiles', 'sandbox_id', `TEXT NOT NULL DEFAULT '${DEFAULT_SANDBOX_ID}'`)
  ensureColumn('terminal_profiles', 'profile_code', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('terminal_templates', 'sandbox_id', `TEXT NOT NULL DEFAULT '${DEFAULT_SANDBOX_ID}'`)
  ensureColumn('terminal_templates', 'template_code', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('activation_codes', 'project_id', `TEXT NOT NULL DEFAULT 'project-mixc-bay'`)
  migrateMasterDataToIndependentModel()
  migrateTerminalMasterData()

  seedDefaultData()
  ensureRuntimeContext()
}

const ensureColumn = (tableName: string, columnName: string, definition: string) => {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  if (!rows.some((row) => row.name === columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

const migrateMasterDataToIndependentModel = () => {
  const brandColumns = sqlite.prepare('PRAGMA table_info(brands)').all() as Array<{ name: string }>
  if (brandColumns.some((column) => column.name === 'tenant_id')) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS brands_v2 (
        brand_id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        brand_code TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO brands_v2 (brand_id, sandbox_id, brand_code, brand_name, status, description, created_at, updated_at)
      SELECT brand_id, sandbox_id, brand_code, brand_name, status, description, created_at, updated_at FROM brands;
      DROP TABLE brands;
      ALTER TABLE brands_v2 RENAME TO brands;
    `)
  }

  const projectColumns = sqlite.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
  if (projectColumns.some((column) => column.name === 'tenant_id') || projectColumns.some((column) => column.name === 'brand_id')) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects_v2 (
        project_id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        project_code TEXT NOT NULL,
        project_name TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        region TEXT,
        timezone TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO projects_v2 (project_id, sandbox_id, project_code, project_name, status, description, region, timezone, created_at, updated_at)
      SELECT project_id, sandbox_id, project_code, project_name, status, description, region, timezone, created_at, updated_at FROM projects;
      DROP TABLE projects;
      ALTER TABLE projects_v2 RENAME TO projects;
    `)
  }
}

const migrateTerminalMasterData = () => {
  sqlite.exec(`
    UPDATE terminal_profiles
    SET profile_code = CASE
      WHEN profile_code IS NULL OR TRIM(profile_code) = '' THEN UPPER(REPLACE(REPLACE(name, ' ', '_'), '-', '_'))
      ELSE profile_code
    END;

    UPDATE terminal_templates
    SET template_code = CASE
      WHEN template_code IS NULL OR TRIM(template_code) = '' THEN UPPER(REPLACE(REPLACE(name, ' ', '_'), '-', '_'))
      ELSE template_code
    END;
  `)
}

const ensureRuntimeContext = (): void => {
  const timestamp = now()
  const current = sqlite.prepare('SELECT current_sandbox_id FROM platform_runtime_context WHERE context_key = ?').get(RUNTIME_CONTEXT_KEY) as { current_sandbox_id: string } | undefined
  if (!current) {
    sqlite.prepare('INSERT INTO platform_runtime_context (context_key, current_sandbox_id, updated_at) VALUES (?, ?, ?)').run(RUNTIME_CONTEXT_KEY, DEFAULT_SANDBOX_ID, timestamp)
    return
  }

  const sandbox = sqlite.prepare('SELECT sandbox_id, status FROM sandboxes WHERE sandbox_id = ?').get(current.current_sandbox_id) as { sandbox_id: string; status: string } | undefined
  if (!sandbox || sandbox.status !== 'ACTIVE') {
    sqlite.prepare('UPDATE platform_runtime_context SET current_sandbox_id = ?, updated_at = ? WHERE context_key = ?').run(DEFAULT_SANDBOX_ID, timestamp, RUNTIME_CONTEXT_KEY)
  }
}

const seedDefaultData = (): void => {
  const count = sqlite.prepare('SELECT COUNT(*) as count FROM sandboxes').get() as { count: number }
  if (count.count > 0) return

  const timestamp = now()

  sqlite.prepare(`
    INSERT INTO sandboxes (
      sandbox_id, name, description, status, is_system_default, creation_mode, source_sandbox_id,
      seed, owner_user_id, owner_team_id, purpose, resource_limits_json, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_SANDBOX_ID,
    '默认联调沙箱',
    '面向 TDP/TCP 联调的默认沙箱',
    'ACTIVE',
    1,
    'EMPTY',
    null,
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
    INSERT INTO tenants (tenant_id, sandbox_id, tenant_code, tenant_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'tenant-mixc',
    DEFAULT_SANDBOX_ID,
    'TENANT_MIXC',
    '万象城租户',
    'ACTIVE',
    '默认联调租户',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO brands (brand_id, sandbox_id, brand_code, brand_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'brand-mixc',
    DEFAULT_SANDBOX_ID,
    'BRAND_MIXC',
    '万象城品牌',
    'ACTIVE',
    '默认联调品牌',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tenant_brand_authorizations (authorization_id, sandbox_id, tenant_id, brand_id, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'auth-tenant-mixc-brand-mixc',
    DEFAULT_SANDBOX_ID,
    'tenant-mixc',
    'brand-mixc',
    'ACTIVE',
    '默认品牌授权',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO projects (project_id, sandbox_id, project_code, project_name, status, description, region, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'project-mixc-bay',
    DEFAULT_SANDBOX_ID,
    'PROJECT_MIXC_BAY',
    '深圳湾万象城项目',
    'ACTIVE',
    '默认联调项目',
    'SZ',
    'Asia/Shanghai',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO stores (store_id, sandbox_id, tenant_id, brand_id, project_id, store_code, store_name, status, description, address, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store-sz-bay',
    DEFAULT_SANDBOX_ID,
    'tenant-mixc',
    'brand-mixc',
    'project-mixc-bay',
    'STORE_SZ_BAY',
    '深圳湾旗舰店',
    'ACTIVE',
    '默认联调门店',
    '深圳市南山区',
    '张三',
    '13800000000',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO stores (store_id, sandbox_id, tenant_id, brand_id, project_id, store_code, store_name, status, description, address, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store-gz-tower',
    DEFAULT_SANDBOX_ID,
    'tenant-mixc',
    'brand-mixc',
    'project-mixc-bay',
    'STORE_GZ_TOWER',
    '广州塔体验店',
    'ACTIVE',
    '第二个默认联调门店',
    '广州市海珠区',
    '李四',
    '13900000000',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_profiles (profile_id, sandbox_id, profile_code, name, description, capabilities_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'profile-android-pos',
    DEFAULT_SANDBOX_ID,
    'ANDROID_POS',
    '安卓收银机',
    '适用于前台收银，支持扫码、打印、小票外设',
    JSON.stringify({ supportsDualScreen: true, supportsCamera: true, supportsPrinter: true, supportsScanner: true }),
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO terminal_templates (template_id, sandbox_id, template_code, name, description, profile_id, preset_config_json, preset_tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'terminal-template-android-pos-standard',
    DEFAULT_SANDBOX_ID,
    'ANDROID_POS_STANDARD',
    '安卓收银机标准模板',
    '收银场景标准配置，适合商场零售门店',
    'profile-android-pos',
    JSON.stringify({ app: { theme: 'dark', locale: 'zh-CN' }, hardware: { printer: true, scanner: true } }),
    JSON.stringify(['android-pos', 'cashier', 'standard']),
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
      'project-mixc-bay',
      'tenant-mixc',
      'brand-mixc',
      `store-${index <= 3 ? 'sz-bay' : 'gz-tower'}`,
      'profile-android-pos',
      'terminal-template-android-pos-standard',
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
    INSERT INTO activation_codes (code, sandbox_id, tenant_id, brand_id, project_id, store_id, profile_id, template_id, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      `10000000000${index}`,
      DEFAULT_SANDBOX_ID,
      'tenant-mixc',
      'brand-mixc',
      'project-mixc-bay',
      index <= 4 ? 'store-sz-bay' : 'store-gz-tower',
      'profile-android-pos',
      'terminal-template-android-pos-standard',
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
    4,
    JSON.stringify({ configVersion: 'config-2026.04.01', featureFlags: { mockMode: true, grayUpgrade: true } }),
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_change_logs (change_id, sandbox_id, topic_key, scope_type, scope_key, revision, payload_json, source_release_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('change'),
    DEFAULT_SANDBOX_ID,
    'terminal.config.state',
    'TERMINAL',
    'T-1001',
    4,
    JSON.stringify({ configVersion: 'config-2026.04.01', source: 'release_bootstrap' }),
    'release_bootstrap',
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO task_releases (release_id, sandbox_id, task_type, source_type, source_id, title, target_selector_json, payload_json, priority, status, approval_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'release_bootstrap',
    DEFAULT_SANDBOX_ID,
    'CONFIG_PUBLISH',
    'CONFIG',
    'config-2026.04.01',
    '默认配置下发',
    JSON.stringify({ type: 'STORE', ids: ['store-sz-bay'] }),
    JSON.stringify({ configVersion: 'config-2026.04.01' }),
    60,
    'COMPLETED',
    'APPROVED',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO task_instances (instance_id, release_id, terminal_id, task_type, status, delivery_status, payload_json, result_json, created_at, updated_at, delivered_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'instance_bootstrap',
    'release_bootstrap',
    'T-1001',
    'CONFIG_PUBLISH',
    'COMPLETED',
    'ACKED',
    JSON.stringify({ configVersion: 'config-2026.04.01' }),
    JSON.stringify({ success: true }),
    timestamp,
    timestamp,
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_sessions (session_id, terminal_id, sandbox_id, client_version, protocol_version, status, connected_at, last_heartbeat_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'session_bootstrap',
    'T-1001',
    DEFAULT_SANDBOX_ID,
    '2.3.18',
    'tdp/1.0',
    'CONNECTED',
    timestamp - 3_600_000,
    timestamp - 60_000,
  )

  sqlite.prepare(`
    INSERT INTO fault_rules (fault_rule_id, sandbox_id, name, target_type, matcher_json, action_json, enabled, hit_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'fault_bootstrap_delay',
    DEFAULT_SANDBOX_ID,
    '配置下发延迟 3 秒',
    'TDP_DELIVERY',
    JSON.stringify({ taskType: 'CONFIG_PUBLISH' }),
    JSON.stringify({ type: 'DELAY', durationMs: 3000 }),
    1,
    2,
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO audit_logs (audit_id, sandbox_id, domain, action, operator, target_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('audit'),
    DEFAULT_SANDBOX_ID,
    'sandbox',
    'bootstrap',
    'system',
    DEFAULT_SANDBOX_ID,
    JSON.stringify({ message: '默认联调沙箱已初始化' }),
    timestamp,
  )
}

export const resetDatabase = (): void => {
  for (const tableName of ['audit_logs', 'fault_rules', 'tdp_change_logs', 'tdp_projections', 'tdp_topics', 'tdp_sessions', 'task_instances', 'task_releases', 'terminal_credentials', 'activation_codes', 'terminal_instances', 'terminal_templates', 'terminal_profiles', 'stores', 'projects', 'brands', 'tenants', 'platform_runtime_context', 'sandboxes']) {
    sqlite.exec(`DELETE FROM ${tableName};`)
  }
  seedDefaultData()
  ensureRuntimeContext()
}

void sql
