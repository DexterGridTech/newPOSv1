import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const sandboxesTable = sqliteTable('sandboxes', {
  sandboxId: text('sandbox_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  seed: integer('seed'),
  ownerUserId: text('owner_user_id').notNull(),
  ownerTeamId: text('owner_team_id').notNull(),
  purpose: text('purpose').notNull(),
  resourceLimitsJson: text('resource_limits_json').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const terminalProfilesTable = sqliteTable('terminal_profiles', {
  profileId: text('profile_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  capabilitiesJson: text('capabilities_json').notNull(),
  defaultConfigTemplateId: text('default_config_template_id'),
  defaultAppVersion: text('default_app_version'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const terminalTemplatesTable = sqliteTable('terminal_templates', {
  templateId: text('template_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  profileId: text('profile_id').notNull(),
  presetConfigJson: text('preset_config_json').notNull(),
  presetTagsJson: text('preset_tags_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const terminalsTable = sqliteTable('terminal_instances', {
  terminalId: text('terminal_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  projectId: text('project_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  brandId: text('brand_id').notNull(),
  storeId: text('store_id').notNull(),
  profileId: text('profile_id').notNull(),
  templateId: text('template_id').notNull(),
  lifecycleStatus: text('lifecycle_status').notNull(),
  presenceStatus: text('presence_status').notNull(),
  healthStatus: text('health_status').notNull(),
  currentAppVersion: text('current_app_version'),
  currentBundleVersion: text('current_bundle_version'),
  currentConfigVersion: text('current_config_version'),
  deviceFingerprint: text('device_fingerprint'),
  deviceInfoJson: text('device_info_json').notNull(),
  sourceMode: text('source_mode').notNull(),
  activatedAt: integer('activated_at'),
  lastSeenAt: integer('last_seen_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const activationCodesTable = sqliteTable('activation_codes', {
  code: text('code').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  brandId: text('brand_id').notNull(),
  storeId: text('store_id').notNull(),
  profileId: text('profile_id').notNull(),
  templateId: text('template_id'),
  status: text('status').notNull(),
  usedBy: text('used_by'),
  usedAt: integer('used_at'),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull()
})

export const credentialsTable = sqliteTable('terminal_credentials', {
  credentialId: text('credential_id').primaryKey(),
  terminalId: text('terminal_id').notNull(),
  token: text('token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  issuedAt: integer('issued_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  refreshExpiresAt: integer('refresh_expires_at').notNull(),
  revokedAt: integer('revoked_at')
})

export const taskReleasesTable = sqliteTable('task_releases', {
  releaseId: text('release_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  taskType: text('task_type').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  targetSelectorJson: text('target_selector_json').notNull(),
  payloadJson: text('payload_json').notNull(),
  priority: integer('priority').notNull(),
  status: text('status').notNull(),
  approvalStatus: text('approval_status').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const taskInstancesTable = sqliteTable('task_instances', {
  instanceId: text('instance_id').primaryKey(),
  releaseId: text('release_id').notNull(),
  terminalId: text('terminal_id').notNull(),
  taskType: text('task_type').notNull(),
  status: text('status').notNull(),
  deliveryStatus: text('delivery_status').notNull(),
  payloadJson: text('payload_json').notNull(),
  resultJson: text('result_json'),
  errorJson: text('error_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deliveredAt: integer('delivered_at'),
  finishedAt: integer('finished_at')
})

export const sessionsTable = sqliteTable('tdp_sessions', {
  sessionId: text('session_id').primaryKey(),
  terminalId: text('terminal_id').notNull(),
  sandboxId: text('sandbox_id').notNull(),
  clientVersion: text('client_version').notNull(),
  protocolVersion: text('protocol_version').notNull(),
  status: text('status').notNull(),
  connectedAt: integer('connected_at').notNull(),
  disconnectedAt: integer('disconnected_at'),
  lastHeartbeatAt: integer('last_heartbeat_at')
})

export const topicsTable = sqliteTable('tdp_topics', {
  topicId: text('topic_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  payloadMode: text('payload_mode').notNull(),
  schemaJson: text('schema_json').notNull(),
  scopeType: text('scope_type').notNull(),
  retentionHours: integer('retention_hours').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const projectionsTable = sqliteTable('tdp_projections', {
  projectionId: text('projection_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  topicKey: text('topic_key').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeKey: text('scope_key').notNull(),
  revision: integer('revision').notNull(),
  payloadJson: text('payload_json').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const changeLogsTable = sqliteTable('tdp_change_logs', {
  changeId: text('change_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  topicKey: text('topic_key').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeKey: text('scope_key').notNull(),
  revision: integer('revision').notNull(),
  payloadJson: text('payload_json').notNull(),
  sourceReleaseId: text('source_release_id'),
  createdAt: integer('created_at').notNull()
})

export const faultRulesTable = sqliteTable('fault_rules', {
  faultRuleId: text('fault_rule_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  name: text('name').notNull(),
  targetType: text('target_type').notNull(),
  matcherJson: text('matcher_json').notNull(),
  actionJson: text('action_json').notNull(),
  enabled: integer('enabled').notNull(),
  hitCount: integer('hit_count').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const auditLogsTable = sqliteTable('audit_logs', {
  auditId: text('audit_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  domain: text('domain').notNull(),
  action: text('action').notNull(),
  operator: text('operator').notNull(),
  targetId: text('target_id').notNull(),
  detailJson: text('detail_json').notNull(),
  createdAt: integer('created_at').notNull()
})
