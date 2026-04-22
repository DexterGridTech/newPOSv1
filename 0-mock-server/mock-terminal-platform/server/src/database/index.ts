import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { DEFAULT_OWNER_TEAM_ID, DEFAULT_OWNER_USER_ID, DEFAULT_SANDBOX_ID } from '../shared/constants.js'
import { createId, now, parseJson } from '../shared/utils.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultDataFile = path.resolve(currentDir, '../../data/mock-terminal-platform.sqlite')
const defaultDataRoot = path.dirname(defaultDataFile)
const resolveDataFile = (override?: string) => override?.trim()
  ? path.resolve(override.trim())
  : (process.env.MOCK_TERMINAL_PLATFORM_DB_FILE?.trim()
      ? path.resolve(process.env.MOCK_TERMINAL_PLATFORM_DB_FILE.trim())
      : defaultDataFile)
const resolveDataRoot = (dataFile?: string) => path.dirname(resolveDataFile(dataFile))

export let sqlite = new Database(resolveDataFile())
export let db = drizzle(sqlite)
export let dataRoot = resolveDataRoot()

export const resetDatabaseConnection = (input?: { dataFile?: string }) => {
  sqlite.close()
  const nextDataFile = resolveDataFile(input?.dataFile)
  sqlite = new Database(nextDataFile)
  db = drizzle(sqlite)
  dataRoot = resolveDataRoot(nextDataFile)
}

export const getDataRoot = () => dataRoot || defaultDataRoot

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
    CREATE TABLE IF NOT EXISTS platforms (
      platform_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      platform_code TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
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
      platform_id TEXT NOT NULL,
      brand_code TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
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
      platform_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      unit_code TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS contracts (
      contract_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      contract_code TEXT NOT NULL,
      unit_code TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
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
      platform_id TEXT NOT NULL,
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
      platform_id TEXT NOT NULL,
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
      local_node_id TEXT,
      display_index INTEGER,
      display_count INTEGER,
      instance_mode TEXT,
      display_mode TEXT,
      status TEXT NOT NULL,
      connected_at INTEGER NOT NULL,
      disconnected_at INTEGER,
      last_heartbeat_at INTEGER,
      last_delivered_revision INTEGER,
      last_acked_revision INTEGER,
      last_applied_revision INTEGER
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
      item_key TEXT NOT NULL DEFAULT '',
      revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tdp_change_logs (
      change_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      cursor INTEGER NOT NULL DEFAULT 0,
      topic_key TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT 'upsert',
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      item_key TEXT NOT NULL DEFAULT '',
      target_terminal_id TEXT NOT NULL DEFAULT '',
      revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      source_release_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS selector_groups (
      group_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      group_code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      priority INTEGER NOT NULL,
      selector_dsl_json TEXT NOT NULL,
      membership_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_selector_groups_sandbox_code
      ON selector_groups (sandbox_id, group_code);
    CREATE TABLE IF NOT EXISTS selector_group_memberships (
      membership_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      matched_by_json TEXT NOT NULL,
      membership_version INTEGER NOT NULL,
      computed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_selector_group_memberships_terminal_group
      ON selector_group_memberships (sandbox_id, terminal_id, group_id);
    CREATE TABLE IF NOT EXISTS projection_policies (
      policy_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projection_policies_bucket
      ON projection_policies (sandbox_id, topic_key, item_key, scope_type, scope_key);
    CREATE TABLE IF NOT EXISTS hot_update_packages (
      package_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      product TEXT NOT NULL,
      channel TEXT NOT NULL,
      bundle_version TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      assembly_version TEXT NOT NULL,
      build_number INTEGER NOT NULL,
      manifest_json TEXT NOT NULL,
      manifest_sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_update_packages_identity
      ON hot_update_packages (sandbox_id, app_id, bundle_version, runtime_version, sha256);
    CREATE TABLE IF NOT EXISTS hot_update_releases (
      release_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      desired_payload_json TEXT NOT NULL,
      policy_id TEXT,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hot_update_releases_sandbox
      ON hot_update_releases (sandbox_id, status, updated_at);
    CREATE TABLE IF NOT EXISTS terminal_version_reports (
      report_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      display_index INTEGER NOT NULL,
      display_role TEXT NOT NULL,
      app_id TEXT NOT NULL,
      assembly_version TEXT NOT NULL,
      build_number INTEGER NOT NULL,
      runtime_version TEXT NOT NULL,
      bundle_version TEXT NOT NULL,
      source TEXT NOT NULL,
      package_id TEXT,
      release_id TEXT,
      state TEXT NOT NULL,
      reason TEXT,
      reported_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_terminal_version_reports_terminal
      ON terminal_version_reports (sandbox_id, terminal_id, reported_at);
    CREATE TABLE IF NOT EXISTS terminal_log_files (
      log_file_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      display_index INTEGER NOT NULL,
      display_role TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      command_id TEXT,
      instance_id TEXT,
      release_id TEXT,
      metadata_json TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    DROP INDEX IF EXISTS idx_terminal_log_files_identity;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_terminal_log_files_identity_v2
      ON terminal_log_files (sandbox_id, terminal_id, log_date, display_index, display_role, file_name);
    CREATE INDEX IF NOT EXISTS idx_terminal_log_files_terminal_date
      ON terminal_log_files (sandbox_id, terminal_id, log_date, updated_at);
    CREATE TABLE IF NOT EXISTS tdp_command_outbox (
      command_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      source_release_id TEXT,
      delivered_at INTEGER,
      acked_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
  ensureColumn('tenants', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('brands', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('projects', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('stores', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('stores', 'unit_code', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('activation_codes', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('activation_codes', 'project_id', `TEXT NOT NULL DEFAULT 'project-mixc-bay'`)
  ensureColumn('terminal_instances', 'platform_id', `TEXT NOT NULL DEFAULT 'platform-default'`)
  ensureColumn('tdp_change_logs', 'cursor', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('tdp_change_logs', 'operation', `TEXT NOT NULL DEFAULT 'upsert'`)
  ensureColumn('tdp_projections', 'item_key', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('tdp_change_logs', 'item_key', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('tdp_change_logs', 'target_terminal_id', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('tdp_sessions', 'last_delivered_revision', 'INTEGER')
  ensureColumn('tdp_sessions', 'last_acked_revision', 'INTEGER')
  ensureColumn('tdp_sessions', 'last_applied_revision', 'INTEGER')
  ensureColumn('tdp_sessions', 'local_node_id', 'TEXT')
  ensureColumn('tdp_sessions', 'display_index', 'INTEGER')
  ensureColumn('tdp_sessions', 'display_count', 'INTEGER')
  ensureColumn('tdp_sessions', 'instance_mode', 'TEXT')
  ensureColumn('tdp_sessions', 'display_mode', 'TEXT')
  migrateTdpProjectionIdentity()
  migrateTdpChangeLogIdentity()
  migrateTdpChangeLogCursor()
  migratePlatformScopedMasterData()
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

const migrateTdpChangeLogCursor = () => {
  const rows = sqlite.prepare(`
    SELECT change_id
    FROM tdp_change_logs
    ORDER BY created_at ASC, rowid ASC
  `).all() as Array<{ change_id: string }>

  const update = sqlite.prepare('UPDATE tdp_change_logs SET cursor = ? WHERE change_id = ?')
  const transaction = sqlite.transaction((items: Array<{ change_id: string }>) => {
    items.forEach((item, index) => {
      update.run(index + 1, item.change_id)
    })
  })

  transaction(rows)
}

const buildLegacyProjectionItemKey = (input: {
  topicKey: string
  scopeKey: string
  payloadJson: string
  sourceReleaseId?: string | null
}) => {
  const payload = parseJson<Record<string, unknown>>(input.payloadJson, {})
  if (input.topicKey === 'tcp.task.release' && typeof payload.instanceId === 'string' && payload.instanceId.trim()) {
    return payload.instanceId.trim()
  }
  if (typeof payload.itemKey === 'string' && payload.itemKey.trim()) {
    return payload.itemKey.trim()
  }
  return input.sourceReleaseId ?? `${input.topicKey}:${input.scopeKey}`
}

const migrateTdpProjectionIdentity = () => {
  const rows = sqlite.prepare(`
    SELECT projection_id, topic_key, scope_key, payload_json
    FROM tdp_projections
    WHERE item_key = ''
  `).all() as Array<{
    projection_id: string
    topic_key: string
    scope_key: string
    payload_json: string
  }>
  const update = sqlite.prepare('UPDATE tdp_projections SET item_key = ? WHERE projection_id = ?')
  const transaction = sqlite.transaction((items: typeof rows) => {
    items.forEach(item => {
      update.run(
        buildLegacyProjectionItemKey({
          topicKey: item.topic_key,
          scopeKey: item.scope_key,
          payloadJson: item.payload_json,
        }),
        item.projection_id,
      )
    })
  })
  transaction(rows)
}

const migrateTdpChangeLogIdentity = () => {
  const rows = sqlite.prepare(`
    SELECT change_id, topic_key, scope_type, scope_key, payload_json, source_release_id, target_terminal_id, item_key
    FROM tdp_change_logs
  `).all() as Array<{
    change_id: string
    topic_key: string
    scope_type: string
    scope_key: string
    payload_json: string
    source_release_id: string | null
    target_terminal_id: string
    item_key: string
  }>
  const update = sqlite.prepare('UPDATE tdp_change_logs SET item_key = ?, target_terminal_id = ? WHERE change_id = ?')
  const transaction = sqlite.transaction((items: typeof rows) => {
    items.forEach(item => {
      const itemKey = item.item_key.trim()
        ? item.item_key
        : buildLegacyProjectionItemKey({
            topicKey: item.topic_key,
            scopeKey: item.scope_key,
            payloadJson: item.payload_json,
            sourceReleaseId: item.source_release_id,
          })
      const targetTerminalId = item.target_terminal_id.trim()
        ? item.target_terminal_id
        : item.scope_type === 'TERMINAL'
          ? item.scope_key
          : ''
      update.run(itemKey, targetTerminalId, item.change_id)
    })
  })
  transaction(rows)
}

const migratePlatformScopedMasterData = () => {
  const timestamp = now()

  const sandboxRows = sqlite.prepare('SELECT sandbox_id FROM sandboxes').all() as Array<{ sandbox_id: string }>
  for (const row of sandboxRows) {
    const existing = sqlite.prepare('SELECT platform_id FROM platforms WHERE sandbox_id = ? LIMIT 1').get(row.sandbox_id) as { platform_id: string } | undefined
    if (!existing) {
      const platformId = row.sandbox_id === DEFAULT_SANDBOX_ID ? 'platform-default' : createId('platform')
      sqlite.prepare(`
        INSERT INTO platforms (platform_id, sandbox_id, platform_code, platform_name, status, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        platformId,
        row.sandbox_id,
        row.sandbox_id === DEFAULT_SANDBOX_ID ? 'PLATFORM_DEFAULT' : `PLATFORM_${platformId.replace(/-/g, '_').toUpperCase()}`,
        row.sandbox_id === DEFAULT_SANDBOX_ID ? '默认集团平台' : `平台 ${platformId}`,
        'ACTIVE',
        '由系统迁移生成的平台主数据',
        timestamp,
        timestamp,
      )
    }
  }

  sqlite.exec(`
    UPDATE tenants
    SET platform_id = COALESCE(
      (SELECT p.platform_id FROM platforms p WHERE p.platform_id = tenants.platform_id AND p.sandbox_id = tenants.sandbox_id LIMIT 1),
      (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = tenants.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
    );

    UPDATE brands
    SET platform_id = COALESCE(
      (SELECT p.platform_id FROM platforms p WHERE p.platform_id = brands.platform_id AND p.sandbox_id = brands.sandbox_id LIMIT 1),
      (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = brands.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
    );

    UPDATE projects
    SET platform_id = COALESCE(
      (SELECT p.platform_id FROM platforms p WHERE p.platform_id = projects.platform_id AND p.sandbox_id = projects.sandbox_id LIMIT 1),
      (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = projects.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
    );

    UPDATE stores
    SET
      platform_id = COALESCE(
        (SELECT p.platform_id FROM platforms p WHERE p.platform_id = stores.platform_id AND p.sandbox_id = stores.sandbox_id LIMIT 1),
        (SELECT projects.platform_id FROM projects WHERE projects.project_id = stores.project_id AND projects.sandbox_id = stores.sandbox_id LIMIT 1),
        (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = stores.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
      ),
      unit_code = CASE
        WHEN unit_code IS NULL OR TRIM(unit_code) = '' THEN store_code
        ELSE unit_code
      END;

    UPDATE contracts
    SET
      platform_id = COALESCE(
        (SELECT p.platform_id FROM platforms p WHERE p.platform_id = contracts.platform_id AND p.sandbox_id = contracts.sandbox_id LIMIT 1),
        (SELECT stores.platform_id FROM stores WHERE stores.store_id = contracts.store_id AND stores.sandbox_id = contracts.sandbox_id LIMIT 1),
        (SELECT projects.platform_id FROM projects WHERE projects.project_id = contracts.project_id AND projects.sandbox_id = contracts.sandbox_id LIMIT 1),
        (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = contracts.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
      ),
      unit_code = CASE
        WHEN unit_code IS NULL OR TRIM(unit_code) = '' THEN COALESCE(
          (SELECT stores.unit_code FROM stores WHERE stores.store_id = contracts.store_id AND stores.sandbox_id = contracts.sandbox_id LIMIT 1),
          contract_code
        )
        ELSE unit_code
      END;

    UPDATE activation_codes
    SET platform_id = COALESCE(
      (SELECT p.platform_id FROM platforms p WHERE p.platform_id = activation_codes.platform_id AND p.sandbox_id = activation_codes.sandbox_id LIMIT 1),
      (SELECT stores.platform_id FROM stores WHERE stores.store_id = activation_codes.store_id AND stores.sandbox_id = activation_codes.sandbox_id LIMIT 1),
      (SELECT projects.platform_id FROM projects WHERE projects.project_id = activation_codes.project_id AND projects.sandbox_id = activation_codes.sandbox_id LIMIT 1),
      (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = activation_codes.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
    );

    UPDATE terminal_instances
    SET platform_id = COALESCE(
      (SELECT p.platform_id FROM platforms p WHERE p.platform_id = terminal_instances.platform_id AND p.sandbox_id = terminal_instances.sandbox_id LIMIT 1),
      (SELECT stores.platform_id FROM stores WHERE stores.store_id = terminal_instances.store_id AND stores.sandbox_id = terminal_instances.sandbox_id LIMIT 1),
      (SELECT projects.platform_id FROM projects WHERE projects.project_id = terminal_instances.project_id AND projects.sandbox_id = terminal_instances.sandbox_id LIMIT 1),
      (SELECT p.platform_id FROM platforms p WHERE p.sandbox_id = terminal_instances.sandbox_id ORDER BY p.created_at ASC LIMIT 1)
    );
  `)

  const contractsCount = sqlite.prepare('SELECT COUNT(*) as count FROM contracts').get() as { count: number }
  if (contractsCount.count === 0) {
    const stores = sqlite.prepare('SELECT * FROM stores ORDER BY created_at ASC').all() as Array<{
      store_id: string
      sandbox_id: string
      platform_id: string
      project_id: string
      tenant_id: string
      brand_id: string
      unit_code: string
      store_code: string
      store_name: string
      created_at: number
      updated_at: number
    }>
    for (const store of stores) {
      const contractId = createId('contract')
      sqlite.prepare(`
        INSERT INTO contracts (
          contract_id, sandbox_id, platform_id, project_id, tenant_id, brand_id, store_id,
          contract_code, unit_code, start_date, end_date, status, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contractId,
        store.sandbox_id,
        store.platform_id,
        store.project_id,
        store.tenant_id,
        store.brand_id,
        store.store_id,
        `CONTRACT_${store.store_code}`,
        store.unit_code || store.store_code,
        '2026-01-01',
        '2026-12-31',
        'ACTIVE',
        `门店 ${store.store_name} 的默认迁移合同`,
        store.created_at ?? timestamp,
        store.updated_at ?? timestamp,
      )
    }
  }
}

const migrateMasterDataToIndependentModel = () => {
  const brandColumns = sqlite.prepare('PRAGMA table_info(brands)').all() as Array<{ name: string }>
  if (brandColumns.some((column) => column.name === 'tenant_id')) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS brands_v2 (
        brand_id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        platform_id TEXT NOT NULL,
        brand_code TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO brands_v2 (brand_id, sandbox_id, platform_id, brand_code, brand_name, status, description, created_at, updated_at)
      SELECT brand_id, sandbox_id, COALESCE(platform_id, 'platform-default'), brand_code, brand_name, status, description, created_at, updated_at FROM brands;
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
        platform_id TEXT NOT NULL,
        project_code TEXT NOT NULL,
        project_name TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        region TEXT,
        timezone TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO projects_v2 (project_id, sandbox_id, platform_id, project_code, project_name, status, description, region, timezone, created_at, updated_at)
      SELECT project_id, sandbox_id, COALESCE(platform_id, 'platform-default'), project_code, project_name, status, description, region, timezone, created_at, updated_at FROM projects;
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
    INSERT INTO platforms (platform_id, sandbox_id, platform_code, platform_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'platform-default',
    DEFAULT_SANDBOX_ID,
    'PLATFORM_DEFAULT',
    '默认购物中心集团',
    'ACTIVE',
    '默认联调平台',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tenants (tenant_id, sandbox_id, platform_id, tenant_code, tenant_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'tenant-mixc',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'TENANT_MIXC',
    '万象城租户',
    'ACTIVE',
    '默认联调租户',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO brands (brand_id, sandbox_id, platform_id, brand_code, brand_name, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'brand-mixc',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'BRAND_MIXC',
    '万象城品牌',
    'ACTIVE',
    '默认联调品牌',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO projects (project_id, sandbox_id, platform_id, project_code, project_name, status, description, region, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'project-mixc-bay',
    DEFAULT_SANDBOX_ID,
    'platform-default',
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
    INSERT INTO stores (store_id, sandbox_id, platform_id, tenant_id, brand_id, project_id, unit_code, store_code, store_name, status, description, address, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store-sz-bay',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'tenant-mixc',
    'brand-mixc',
    'project-mixc-bay',
    'L0102',
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
    INSERT INTO stores (store_id, sandbox_id, platform_id, tenant_id, brand_id, project_id, unit_code, store_code, store_name, status, description, address, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store-gz-tower',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'tenant-mixc',
    'brand-mixc',
    'project-mixc-bay',
    'L0203',
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
    INSERT INTO contracts (
      contract_id, sandbox_id, platform_id, project_id, tenant_id, brand_id, store_id,
      contract_code, unit_code, start_date, end_date, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'contract-sz-bay-main',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'project-mixc-bay',
    'tenant-mixc',
    'brand-mixc',
    'store-sz-bay',
    'CONTRACT_SZ_BAY_MAIN',
    'L0102',
    '2026-01-01',
    '2026-12-31',
    'ACTIVE',
    '深圳湾旗舰店默认合同',
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO contracts (
      contract_id, sandbox_id, platform_id, project_id, tenant_id, brand_id, store_id,
      contract_code, unit_code, start_date, end_date, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'contract-gz-tower-main',
    DEFAULT_SANDBOX_ID,
    'platform-default',
    'project-mixc-bay',
    'tenant-mixc',
    'brand-mixc',
    'store-gz-tower',
    'CONTRACT_GZ_TOWER_MAIN',
    'L0203',
    '2026-01-01',
    '2026-12-31',
    'ACTIVE',
    '广州塔体验店默认合同',
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
        terminal_id, sandbox_id, platform_id, project_id, tenant_id, brand_id, store_id, profile_id, template_id,
        lifecycle_status, presence_status, health_status, current_app_version, current_bundle_version,
        current_config_version, device_fingerprint, device_info_json, source_mode, activated_at, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      terminalId,
      DEFAULT_SANDBOX_ID,
      'platform-default',
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
    INSERT INTO activation_codes (code, sandbox_id, platform_id, tenant_id, brand_id, project_id, store_id, profile_id, template_id, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      `10000000000${index}`,
      DEFAULT_SANDBOX_ID,
      'platform-default',
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
    'remote.control',
    '远程控制命令主题',
    'EPHEMERAL_COMMAND',
    JSON.stringify({ type: 'object', required: ['commandType'] }),
    'TERMINAL',
    1,
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
    INSERT INTO tdp_topics (topic_id, sandbox_id, key, name, payload_mode, schema_json, scope_type, retention_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('topic'),
    DEFAULT_SANDBOX_ID,
    'terminal.group.membership',
    'Terminal Group Membership',
    'FLEXIBLE_JSON',
    JSON.stringify({ type: 'object', required: ['membershipVersion', 'groups'] }),
    'TERMINAL',
    168,
    timestamp,
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_projections (projection_id, sandbox_id, topic_key, scope_type, scope_key, item_key, revision, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('projection'),
    DEFAULT_SANDBOX_ID,
    'terminal.config.state',
    'TERMINAL',
    'T-1001',
    'terminal.config.state:T-1001',
    4,
    JSON.stringify({ configVersion: 'config-2026.04.01', featureFlags: { mockMode: true, grayUpgrade: true } }),
    timestamp,
  )

  sqlite.prepare(`
    INSERT INTO tdp_change_logs (change_id, sandbox_id, cursor, topic_key, operation, scope_type, scope_key, item_key, target_terminal_id, revision, payload_json, source_release_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('change'),
    DEFAULT_SANDBOX_ID,
    1,
    'terminal.config.state',
    'upsert',
    'TERMINAL',
    'T-1001',
    'terminal.config.state:T-1001',
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
