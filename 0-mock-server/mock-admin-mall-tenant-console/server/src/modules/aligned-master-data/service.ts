import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DEFAULT_SANDBOX_ID, DEFAULT_SOURCE_SERVICE} from '../../shared/constants.js'
import {HttpError} from '../../shared/http.js'
import {paginateItems, type PaginationQuery} from '../../shared/pagination.js'
import {
  asBoolean,
  asNumber,
  asOptionalString,
  asRecord,
  asString,
  cloneJson,
  createId,
  normalizeId,
  now,
  parseJson,
  serializeJson,
} from '../../shared/utils.js'
import {enqueueProjectionOutbox, sqlite} from '../../database/index.js'

type TopicProjectionKind = 'organization' | 'iam' | 'catering_product' | 'catering_store_operation'

type TopicDefinition = {
  topicKey: string
  projectionKind: TopicProjectionKind
  scopeType: string
  itemKeyField: string
}

type EntityRow = {
  aggregate_id: string
  sandbox_id: string
  domain: string
  entity_type: string
  entity_id: string
  natural_scope_type: string
  natural_scope_key: string
  title: string
  status: string
  source_revision: number
  payload_json: string
  created_at: number
  updated_at: number
}

type DomainEntity =
  | 'sandbox'
  | 'platform'
  | 'region'
  | 'project'
  | 'tenant'
  | 'brand'
  | 'store'
  | 'contract'
  | 'business_entity'
  | 'table'
  | 'workstation'
  | 'identity_provider_config'
  | 'permission'
  | 'permission_group'
  | 'role_template'
  | 'feature_point'
  | 'platform_feature_switch'
  | 'role'
  | 'user'
  | 'user_role_binding'
  | 'resource_tag'
  | 'principal_group'
  | 'group_member'
  | 'group_role_binding'
  | 'authorization_session'
  | 'separation_of_duty_rule'
  | 'high_risk_permission_policy'
  | 'product_category'
  | 'brand_metadata'
  | 'product'
  | 'product_inheritance'
  | 'brand_menu'
  | 'menu_catalog'
  | 'price_rule'
  | 'bundle_price_rule'
  | 'channel_product_mapping'
  | 'store_config'
  | 'menu_availability'
  | 'availability_rule'
  | 'saleable_stock'

const isDomainEntity = (value: string): value is DomainEntity =>
  value in entityDomainGroup

type AggregateRow = {
  aggregateId: string
  sandboxId: string
  domain: string
  entityType: DomainEntity
  entityId: string
  naturalScopeType: string
  naturalScopeKey: string
  title: string
  status: string
  sourceRevision: number
  payload: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

type EntityListQuery = PaginationQuery & {
  search?: string
  status?: string
  filters?: Record<string, string>
}

type MutationInput = {
  sandboxId?: string
  traceId?: string
  clientIp?: string
  userAgent?: string
  actorType?: string
  actorId?: string
  idempotencyKey?: string
  expectedRevision?: number
  targetTerminalIds?: string[]
}

type BusinessEvent = {
  eventId: string
  aggregateType: string
  aggregateId: string
  eventType: string
  sandboxId: string
  platformId: string
  occurredAt: number
  actorType: string
  actorId: string
  payload: Record<string, unknown>
  sourceRevision: number
}

type AuthAuditLog = {
  logId: string
  sandboxId: string
  platformId: string
  userId: string
  userType: string
  eventType: string
  resourceType: string
  resourceId: string | null
  action: string
  permissionCode: string
  result: 'ALLOWED' | 'DENIED'
  denyReason: string | null
  isCrossSandbox: boolean
  clientIp: string | null
  userAgent: string | null
  requestId: string | null
  occurredAt: string
  detail: Record<string, unknown>
}

type ScopeSelector = {
  scope_type: string
  scope_key: string
  tags?: string[]
  org_node_type?: string | null
  org_node_id?: string | null
  org_node_ids?: string[]
  resource_type?: string | null
  resource_id?: string | null
  resource_ids?: string[]
  selectors?: ScopeSelector[]
}

const identity = {
  platformId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PLATFORM_ID?.trim() || 'platform-kernel-base-test',
  projectId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PROJECT_ID?.trim() || 'project-kernel-base-test',
  tenantId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_TENANT_ID?.trim() || 'tenant-kernel-base-test',
  brandId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_BRAND_ID?.trim() || 'brand-kernel-base-test',
  storeId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_STORE_ID?.trim() || 'store-kernel-base-test',
  contractId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_CONTRACT_ID?.trim() || 'contract-kernel-base-test',
} as const

const customerDemoIdentity = {
  sandboxId: 'sandbox-customer-real-retail-20260425',
  platformId: 'platform-longfor-paradise-walk',
  primaryProjectId: 'project-chengdu-binjiang-paradise-walk',
  secondaryProjectId: 'project-beijing-changying-paradise-walk',
  primaryStoreId: 'store-cd-binjiang-butterful',
  primaryBrandId: 'brand-longfor-butterful',
} as const

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const customerDemoAssetRoot = path.resolve(currentDir, '../../../data/uploads/customer-assets')
const customerDemoAssetBaseUrl = process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PUBLIC_BASE_URL?.trim() || 'http://127.0.0.1:5830'

const topicByEntityType: Record<DomainEntity, TopicDefinition | undefined> = {
  sandbox: undefined,
  platform: {topicKey: 'org.platform.profile', projectionKind: 'organization', scopeType: 'PLATFORM', itemKeyField: 'platform_id'},
  region: {topicKey: 'org.region.profile', projectionKind: 'organization', scopeType: 'PLATFORM', itemKeyField: 'region_id'},
  project: {topicKey: 'org.project.profile', projectionKind: 'organization', scopeType: 'PROJECT', itemKeyField: 'project_id'},
  tenant: {topicKey: 'org.tenant.profile', projectionKind: 'organization', scopeType: 'TENANT', itemKeyField: 'tenant_id'},
  brand: {topicKey: 'org.brand.profile', projectionKind: 'organization', scopeType: 'BRAND', itemKeyField: 'brand_id'},
  store: {topicKey: 'org.store.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'store_id'},
  contract: {topicKey: 'org.contract.active', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'contract_id'},
  business_entity: {topicKey: 'org.business-entity.profile', projectionKind: 'organization', scopeType: 'TENANT', itemKeyField: 'entity_id'},
  table: {topicKey: 'org.table.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'table_id'},
  workstation: {topicKey: 'org.workstation.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'workstation_id'},
  identity_provider_config: {topicKey: 'iam.identity-provider.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'idp_id'},
  permission: {topicKey: 'iam.permission.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'permission_id'},
  permission_group: {topicKey: 'iam.permission-group.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'permission_group_id'},
  role_template: {topicKey: 'iam.role-template.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'template_id'},
  feature_point: {topicKey: 'iam.feature-point.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'feature_point_id'},
  platform_feature_switch: {topicKey: 'iam.platform-feature-switch.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'switch_id'},
  role: {topicKey: 'iam.role.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'role_id'},
  user: {topicKey: 'iam.user.store-effective', projectionKind: 'iam', scopeType: 'STORE', itemKeyField: 'user_id'},
  user_role_binding: {topicKey: 'iam.user-role-binding.store-effective', projectionKind: 'iam', scopeType: 'STORE', itemKeyField: 'binding_id'},
  resource_tag: {topicKey: 'iam.resource-tag.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'tag_id'},
  principal_group: {topicKey: 'iam.principal-group.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'group_id'},
  group_member: {topicKey: 'iam.group-member.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'member_id'},
  group_role_binding: {topicKey: 'iam.group-role-binding.store-effective', projectionKind: 'iam', scopeType: 'STORE', itemKeyField: 'group_binding_id'},
  authorization_session: {topicKey: 'iam.authorization-session.active', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'session_id'},
  separation_of_duty_rule: {topicKey: 'iam.sod-rule.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'sod_rule_id'},
  high_risk_permission_policy: {topicKey: 'iam.high-risk-policy.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'policy_id'},
  product_category: {topicKey: 'catering.product-category.profile', projectionKind: 'catering_product', scopeType: 'BRAND', itemKeyField: 'category_id'},
  brand_metadata: undefined,
  product: {topicKey: 'catering.product.profile', projectionKind: 'catering_product', scopeType: 'BRAND', itemKeyField: 'product_id'},
  product_inheritance: {topicKey: 'catering.product-inheritance.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'inheritance_id'},
  brand_menu: {topicKey: 'catering.brand-menu.profile', projectionKind: 'catering_product', scopeType: 'BRAND', itemKeyField: 'brand_menu_id'},
  menu_catalog: {topicKey: 'menu.catalog', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'menu_id'},
  price_rule: {topicKey: 'catering.price-rule.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'rule_id'},
  bundle_price_rule: {topicKey: 'catering.bundle-price-rule.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'rule_id'},
  channel_product_mapping: {topicKey: 'catering.channel-product-mapping.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'mapping_id'},
  store_config: {topicKey: 'store.config', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'config_id'},
  menu_availability: {topicKey: 'menu.availability', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'product_id'},
  availability_rule: {topicKey: 'catering.availability-rule.profile', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'rule_id'},
  saleable_stock: {topicKey: 'catering.saleable-stock.profile', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'stock_id'},
}

const entityDomainGroup: Record<DomainEntity, string> = {
  sandbox: 'organization',
  platform: 'organization',
  region: 'organization',
  project: 'organization',
  tenant: 'organization',
  brand: 'organization',
  store: 'organization',
  contract: 'organization',
  business_entity: 'organization',
  table: 'organization',
  workstation: 'organization',
  identity_provider_config: 'iam',
  permission: 'iam',
  permission_group: 'iam',
  role_template: 'iam',
  feature_point: 'iam',
  platform_feature_switch: 'iam',
  role: 'iam',
  user: 'iam',
  user_role_binding: 'iam',
  resource_tag: 'iam',
  principal_group: 'iam',
  group_member: 'iam',
  group_role_binding: 'iam',
  authorization_session: 'iam',
  separation_of_duty_rule: 'iam',
  high_risk_permission_policy: 'iam',
  product_category: 'catering-product',
  brand_metadata: 'catering-product',
  product: 'catering-product',
  product_inheritance: 'catering-product',
  brand_menu: 'catering-product',
  menu_catalog: 'catering-product',
  price_rule: 'catering-product',
  bundle_price_rule: 'catering-product',
  channel_product_mapping: 'catering-product',
  store_config: 'catering-store-operating',
  menu_availability: 'catering-store-operating',
  availability_rule: 'catering-store-operating',
  saleable_stock: 'catering-store-operating',
}

const allowedStatuses = new Set([
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
  'DRAFT',
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'RETRYING',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'LOCKED',
  'DELETED',
  'DEPRECATED',
  'CLOSED',
  'AVAILABLE',
  'LOW_STOCK',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'DISABLED',
  'RELEASED',
  'CONFIRMED',
  'OPEN',
  'PREPARING',
  'OPERATING',
  'PAUSED',
  'EXPIRED',
  'INVALID',
  'SOLD_OUT',
  'OFF_SHELF',
  'REVOKED',
  'TERMINATED',
  'ROLLED_BACK',
  'SYNCED',
  'OUT_OF_SYNC',
  'UNMAPPED',
  'NOT_SYNCED',
  'SYNCING',
  'SYNC_FAILED',
])

const statusSet = (...statuses: string[]) => new Set(statuses)

const defaultEntityStatuses = statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED', 'DRAFT')
const entityStatusByType: Partial<Record<DomainEntity, Set<string>>> = {
  sandbox: statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED'),
  platform: statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'),
  region: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  project: statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'),
  tenant: statusSet('ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'),
  brand: statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'),
  store: statusSet('ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'),
  contract: statusSet('PENDING', 'ACTIVE', 'TERMINATED', 'EXPIRED', 'ARCHIVED'),
  business_entity: statusSet('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'),
  table: statusSet('AVAILABLE', 'DISABLED'),
  workstation: statusSet('ACTIVE', 'INACTIVE', 'DISABLED', 'ARCHIVED'),
  identity_provider_config: statusSet('ACTIVE', 'DISABLED'),
  permission: statusSet('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED'),
  permission_group: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  role_template: statusSet('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED'),
  feature_point: statusSet('ACTIVE', 'INACTIVE', 'DEPRECATED'),
  platform_feature_switch: statusSet('ACTIVE', 'INACTIVE'),
  role: statusSet('ACTIVE', 'DEPRECATED'),
  user: statusSet('ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED'),
  user_role_binding: statusSet('ACTIVE', 'REVOKED', 'EXPIRED', 'INACTIVE'),
  resource_tag: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  principal_group: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  group_member: statusSet('ACTIVE', 'REVOKED', 'INACTIVE'),
  group_role_binding: statusSet('ACTIVE', 'REVOKED', 'EXPIRED', 'INACTIVE'),
  authorization_session: statusSet('ACTIVE', 'EXPIRED', 'REVOKED', 'INACTIVE'),
  separation_of_duty_rule: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  high_risk_permission_policy: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  product_category: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  brand_metadata: statusSet('ACTIVE', 'INACTIVE', 'ARCHIVED'),
  product: statusSet('ACTIVE', 'DRAFT', 'SUSPENDED', 'INACTIVE', 'OFF_SHELF', 'ARCHIVED'),
  product_inheritance: statusSet('ACTIVE', 'INACTIVE', 'OUT_OF_SYNC', 'SYNCED', 'ARCHIVED'),
  brand_menu: statusSet('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'ARCHIVED'),
  menu_catalog: statusSet('DRAFT', 'ACTIVE', 'INACTIVE', 'INVALID', 'ROLLED_BACK', 'ARCHIVED'),
  price_rule: statusSet('ACTIVE', 'INACTIVE', 'DISABLED', 'ARCHIVED'),
  bundle_price_rule: statusSet('ACTIVE', 'INACTIVE', 'DISABLED', 'ARCHIVED'),
  channel_product_mapping: statusSet('PENDING', 'SYNCED', 'UNMAPPED', 'NOT_SYNCED', 'SYNCING', 'SYNC_FAILED', 'ACTIVE', 'INACTIVE'),
  store_config: statusSet('OPEN', 'PAUSED', 'CLOSED', 'PREPARING', 'ACTIVE', 'INACTIVE'),
  menu_availability: statusSet('ACTIVE', 'SOLD_OUT', 'INACTIVE'),
  availability_rule: statusSet('ACTIVE', 'INACTIVE', 'DISABLED', 'ARCHIVED'),
  saleable_stock: statusSet('AVAILABLE', 'LOW_STOCK', 'SOLD_OUT', 'INACTIVE', 'ARCHIVED'),
}

const toAggregateRow = (row: EntityRow): AggregateRow => ({
  aggregateId: row.aggregate_id,
  sandboxId: row.sandbox_id,
  domain: row.domain,
  entityType: row.entity_type as DomainEntity,
  entityId: row.entity_id,
  naturalScopeType: row.natural_scope_type,
  naturalScopeKey: row.natural_scope_key,
  title: row.title,
  status: row.status,
  sourceRevision: row.source_revision,
  payload: parseJson(row.payload_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const resolveTopic = (entityType: DomainEntity) => topicByEntityType[entityType]

const createEnvelope = (input: {
  projectionKind: TopicProjectionKind
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
  sandboxId: string
  platformId?: string
}) => ({
  schema_version: 1,
  projection_kind: input.projectionKind,
  sandbox_id: input.sandboxId,
  platform_id: input.platformId ?? resolveEventPlatformId(input.data),
  source_service: DEFAULT_SOURCE_SERVICE,
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const ensureSchema = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS aligned_master_data_entities (
      aggregate_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      natural_scope_type TEXT NOT NULL,
      natural_scope_key TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_aligned_master_data_entities_unique
      ON aligned_master_data_entities (sandbox_id, entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS business_events (
      event_id TEXT PRIMARY KEY,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      sandbox_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      source_revision INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_audit_logs (
      log_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      action TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      result TEXT NOT NULL,
      deny_reason TEXT,
      is_cross_sandbox INTEGER NOT NULL,
      client_ip TEXT,
      user_agent TEXT,
      request_id TEXT,
      occurred_at INTEGER NOT NULL,
      detail_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_sandbox_occurred
      ON auth_audit_logs (sandbox_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user
      ON auth_audit_logs (sandbox_id, user_id, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS mutation_idempotency (
      idempotency_key TEXT PRIMARY KEY,
      mutation_scope TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projection_delivery_diagnostics (
      diagnostic_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      outbox_id TEXT,
      topic_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      status TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terminal_observation_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      source TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
}

const listRowsByEntityType = (entityType: DomainEntity, sandboxId = DEFAULT_SANDBOX_ID) =>
  sqlite.prepare(`
    SELECT *
    FROM aligned_master_data_entities
    WHERE sandbox_id = ? AND entity_type = ?
    ORDER BY updated_at DESC, entity_id ASC
  `).all(sandboxId, entityType) as EntityRow[]

const listRowsByEntityTypeAcrossSandboxes = (entityType: DomainEntity) =>
  sqlite.prepare(`
    SELECT *
    FROM aligned_master_data_entities
    WHERE entity_type = ?
    ORDER BY updated_at DESC, sandbox_id ASC, entity_id ASC
  `).all(entityType) as EntityRow[]

const getEntityRow = (entityType: DomainEntity, entityId: string, sandboxId = DEFAULT_SANDBOX_ID) =>
  sqlite.prepare(`
    SELECT *
    FROM aligned_master_data_entities
    WHERE sandbox_id = ? AND entity_type = ? AND entity_id = ?
    LIMIT 1
  `).get(sandboxId, entityType, entityId) as EntityRow | undefined

const requireEntityRow = (entityType: DomainEntity, entityId: string, sandboxId = DEFAULT_SANDBOX_ID) => {
  const row = getEntityRow(entityType, entityId, sandboxId)
  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', `${entityType} not found`, {entityType, entityId, sandboxId})
  }
  return toAggregateRow(row)
}

const findAggregateRow = (entityType: DomainEntity, entityId: string | null | undefined, sandboxId = DEFAULT_SANDBOX_ID) => {
  if (!entityId) {
    return null
  }
  const row = getEntityRow(entityType, entityId, sandboxId)
  return row ? toAggregateRow(row) : null
}

const createScopedIdempotencyKey = (key: string, mutationScope: string) => `${key}::${mutationScope}`

const readIdempotency = (key: string, mutationScope: string) => {
  const row = sqlite.prepare(`
    SELECT response_json
    FROM mutation_idempotency
    WHERE idempotency_key = ?
    LIMIT 1
  `).get(createScopedIdempotencyKey(key, mutationScope)) as {response_json: string} | undefined
  return row ? parseJson(row.response_json, null as unknown as Record<string, unknown>) : null
}

const writeIdempotency = (key: string, mutationScope: string, response: unknown) => {
  sqlite.prepare(`
    INSERT OR REPLACE INTO mutation_idempotency (idempotency_key, mutation_scope, response_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(createScopedIdempotencyKey(key, mutationScope), mutationScope, serializeJson(response), now())
}

const appendBusinessEvent = (event: BusinessEvent) => {
  sqlite.prepare(`
    INSERT INTO business_events (
      event_id, aggregate_type, aggregate_id, event_type, sandbox_id, platform_id,
      occurred_at, actor_type, actor_id, payload_json, source_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.eventId,
    event.aggregateType,
    event.aggregateId,
    event.eventType,
    event.sandboxId,
    event.platformId,
    event.occurredAt,
    event.actorType,
    event.actorId,
    serializeJson(event.payload),
    event.sourceRevision,
  )
}

const appendAuthAuditLog = (log: AuthAuditLog) => {
  ensureSchema()
  sqlite.prepare(`
    INSERT INTO auth_audit_logs (
      log_id, sandbox_id, platform_id, user_id, user_type, event_type, resource_type,
      resource_id, action, permission_code, result, deny_reason, is_cross_sandbox,
      client_ip, user_agent, request_id, occurred_at, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.logId,
    log.sandboxId,
    log.platformId,
    log.userId,
    log.userType,
    log.eventType,
    log.resourceType,
    log.resourceId,
    log.action,
    log.permissionCode,
    log.result,
    log.denyReason,
    log.isCrossSandbox ? 1 : 0,
    log.clientIp,
    log.userAgent,
    log.requestId,
    Date.parse(log.occurredAt),
    serializeJson(log.detail),
  )
}

const appendDeliveryDiagnostic = (input: {
  outboxId?: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  status: string
  detail: Record<string, unknown>
  sandboxId: string
}) => {
  sqlite.prepare(`
    INSERT INTO projection_delivery_diagnostics (
      diagnostic_id, sandbox_id, outbox_id, topic_key, scope_type, scope_key, item_key,
      status, detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('diag'),
    input.sandboxId,
    input.outboxId ?? null,
    input.topicKey,
    input.scopeType,
    input.scopeKey,
    input.itemKey,
    input.status,
    serializeJson(input.detail),
    now(),
  )
}

const resolveEventPlatformId = (data: Record<string, unknown>, fallback = identity.platformId) =>
  asOptionalString(data.platform_id)
    ?? asOptionalString(data.platformId)
    ?? fallback

const resolveOwnerPlatformId = (input: {
  sandboxId: string
  data: Record<string, unknown>
  ownershipScope?: unknown
  brandId?: unknown
  storeId?: unknown
  fallback?: string
}) => {
  const explicit = asOptionalString(input.data.platform_id ?? input.data.platformId)
  if (explicit) {
    return explicit
  }

  const ownershipScope = asString(input.ownershipScope ?? input.data.ownership_scope, '').toUpperCase()
  const storeId = asOptionalString(input.storeId ?? input.data.store_id)
  const brandId = asOptionalString(input.brandId ?? input.data.brand_id)
  if (ownershipScope === 'STORE' || storeId) {
    const store = storeId ? findAggregateRow('store', storeId, input.sandboxId) : null
    const storeData = asRecord(store?.payload.data)
    const storePlatformId = asOptionalString(storeData.platform_id)
    if (storePlatformId) {
      return storePlatformId
    }
  }

  if (ownershipScope === 'BRAND' || brandId) {
    const brand = brandId ? findAggregateRow('brand', brandId, input.sandboxId) : null
    const brandData = asRecord(brand?.payload.data)
    const brandPlatformId = asOptionalString(brandData.platform_id)
    if (brandPlatformId) {
      return brandPlatformId
    }
  }

  return input.fallback ?? identity.platformId
}

const seedAlignedStateFromMasterDocuments = (sandboxId = DEFAULT_SANDBOX_ID) => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM master_data_documents
    WHERE sandbox_id = ?
    ORDER BY created_at ASC, entity_type ASC, entity_id ASC
  `).all(sandboxId) as Array<{
    doc_id: string
    sandbox_id: string
    domain: string
    entity_type: string
    entity_id: string
    natural_scope_type: string
    natural_scope_key: string
    title: string
    status: string
    source_revision: number
    payload_json: string
    created_at: number
    updated_at: number
  }>

  if (rows.length === 0) {
    return false
  }

  const insertEntity = sqlite.prepare(`
    INSERT INTO aligned_master_data_entities (
      aggregate_id, sandbox_id, domain, entity_type, entity_id, natural_scope_type, natural_scope_key,
      title, status, source_revision, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sandbox_id, entity_type, entity_id) DO NOTHING
  `)
  const insertEvent = sqlite.prepare(`
    INSERT INTO business_events (
      event_id, aggregate_type, aggregate_id, event_type, sandbox_id, platform_id,
      occurred_at, actor_type, actor_id, payload_json, source_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = sqlite.transaction(() => {
    rows.forEach(row => {
      if (!(row.entity_type in entityDomainGroup)) {
        return
      }
      const payload = parseJson(row.payload_json, {} as Record<string, unknown>)
      const payloadData = asRecord((payload as Record<string, unknown>).data)
      const sourceEventId = asOptionalString(payload.source_event_id) ?? createId('evt')
      const aggregateId = createId('agg')
      insertEntity.run(
        aggregateId,
        row.sandbox_id,
        entityDomainGroup[row.entity_type as DomainEntity],
        row.entity_type,
        row.entity_id,
        row.natural_scope_type,
        row.natural_scope_key,
        row.title,
        row.status,
        row.source_revision,
        row.payload_json,
        row.created_at,
        row.updated_at,
      )
      insertEvent.run(
        sourceEventId,
        row.entity_type,
        aggregateId,
        'SeedImportedFromMasterDocument',
        row.sandbox_id,
        resolveEventPlatformId(payloadData),
        row.created_at,
        'SEED',
        'mock-admin-chinese-scenario',
        row.payload_json,
        row.source_revision,
      )
    })
  })

  transaction()
  return true
}

const upsertEntity = (input: {
  entityType: DomainEntity
  entityId: string
  title: string
  status: string
  naturalScopeType: string
  naturalScopeKey: string
  data: Record<string, unknown>
  mutation: MutationInput
  eventType: string
}) => {
  ensureSchema()
  const sandboxId = input.mutation.sandboxId ?? DEFAULT_SANDBOX_ID
  const current = getEntityRow(input.entityType, input.entityId, sandboxId)
  const currentAggregate = current ? toAggregateRow(current) : undefined
  const completedData = completeEntityData({
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    status: input.status,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    data: input.data,
    sandboxId,
  })
  const completedStatus = sanitizeEntityStatus(input.entityType, completedData.status, input.status)
  assertEntityConstraints({
    entityType: input.entityType,
    entityId: input.entityId,
    data: completedData,
    naturalScopeType: input.naturalScopeType,
    naturalScopeKey: input.naturalScopeKey,
    sandboxId,
  })

  if (typeof input.mutation.expectedRevision === 'number' && currentAggregate && currentAggregate.sourceRevision !== input.mutation.expectedRevision) {
    throw new HttpError(409, 'STALE_REVISION', `${input.entityType} revision mismatch`, {
      expectedRevision: input.mutation.expectedRevision,
      actualRevision: currentAggregate.sourceRevision,
    })
  }

  const nextRevision = (currentAggregate?.sourceRevision ?? 0) + 1
  const aggregateId = currentAggregate?.aggregateId ?? createId('agg')
  const eventId = createId('evt')
  const platformId = resolveEventPlatformId(completedData)
  const payload = createEnvelope({
    projectionKind: resolveTopic(input.entityType)?.projectionKind ?? 'organization',
    sourceEventId: eventId,
    sourceRevision: nextRevision,
    data: completedData,
    sandboxId,
    platformId,
  })
  const timestamp = now()

  sqlite.prepare(`
    INSERT INTO aligned_master_data_entities (
      aggregate_id, sandbox_id, domain, entity_type, entity_id, natural_scope_type, natural_scope_key,
      title, status, source_revision, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sandbox_id, entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      status = excluded.status,
      source_revision = excluded.source_revision,
      natural_scope_type = excluded.natural_scope_type,
      natural_scope_key = excluded.natural_scope_key,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run(
    aggregateId,
    sandboxId,
    entityDomainGroup[input.entityType],
    input.entityType,
    input.entityId,
    input.naturalScopeType,
    input.naturalScopeKey,
    input.title,
    completedStatus,
    nextRevision,
    serializeJson(payload),
    currentAggregate?.createdAt ?? timestamp,
    timestamp,
  )

  appendBusinessEvent({
    eventId,
    aggregateType: input.entityType,
    aggregateId,
    eventType: input.eventType,
    sandboxId,
    platformId,
    occurredAt: timestamp,
    actorType: input.mutation.actorType ?? 'ADMIN_API',
    actorId: input.mutation.actorId ?? 'mock-admin-operator',
    payload,
    sourceRevision: nextRevision,
  })

  const topic = resolveTopic(input.entityType)
  if (topic) {
    enqueueProjectionOutbox({
      sandboxId,
      topicKey: topic.topicKey,
      scopeType: input.naturalScopeType,
      scopeKey: input.naturalScopeKey,
      itemKey: asString(completedData[topic.itemKeyField], input.entityId),
      payload,
      targetTerminalIds: input.mutation.targetTerminalIds,
    })
    appendDeliveryDiagnostic({
      sandboxId,
      topicKey: topic.topicKey,
      scopeType: input.naturalScopeType,
      scopeKey: input.naturalScopeKey,
      itemKey: asString(completedData[topic.itemKeyField], input.entityId),
      status: 'OUTBOX_ENQUEUED',
      detail: {
        entityType: input.entityType,
        eventType: input.eventType,
        revision: nextRevision,
      },
    })
  }

  return requireEntityRow(input.entityType, input.entityId, sandboxId)
}

const normalizeFilterValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const entityMatchesListQuery = (item: AggregateRow, query: EntityListQuery) => {
  const status = normalizeFilterValue(query.status)
  if (status && status !== 'ALL' && item.status !== status) {
    return false
  }

  const data = asRecord(item.payload.data)
  const filters = query.filters ?? {}
  for (const [key, expectedValue] of Object.entries(filters)) {
    const normalizedExpected = normalizeFilterValue(expectedValue)
    if (!normalizedExpected || normalizedExpected === 'ALL') {
      continue
    }

    const actualValue = key === 'natural_scope_type'
      ? item.naturalScopeType
      : key === 'natural_scope_key'
      ? item.naturalScopeKey
      : key === 'entity_type'
      ? item.entityType
      : data[key]

    if (Array.isArray(actualValue)) {
      if (!actualValue.map(value => String(value)).includes(normalizedExpected)) {
        return false
      }
      continue
    }

    if (String(actualValue ?? '') !== normalizedExpected) {
      return false
    }
  }

  const search = normalizeFilterValue(query.search).toLowerCase()
  if (!search) {
    return true
  }

  const searchableText = [
    item.title,
    item.entityId,
    item.status,
    item.naturalScopeKey,
    ...Object.values(data)
      .filter(value => ['string', 'number', 'boolean'].includes(typeof value))
      .map(value => String(value)),
  ].join(' ').toLowerCase()

  return searchableText.includes(search)
}

const filterEntities = (items: AggregateRow[], query: EntityListQuery) =>
  items.filter(item => entityMatchesListQuery(item, query))

const isPastDate = (value: unknown) => {
  const rawValue = asOptionalString(value)
  if (!rawValue) {
    return false
  }
  const parsed = Date.parse(`${rawValue}T23:59:59.999+08:00`)
  return Number.isFinite(parsed) && parsed < now()
}

const isFutureStartDate = (value: unknown) => {
  const rawValue = asOptionalString(value)
  if (!rawValue) {
    return false
  }
  const parsed = rawValue.includes('T')
    ? Date.parse(rawValue)
    : Date.parse(`${rawValue}T00:00:00.000+08:00`)
  return Number.isFinite(parsed) && parsed > now()
}

const withDerivedContractStatus = (item: AggregateRow): AggregateRow => {
  if (item.entityType !== 'contract') {
    return item
  }
  const data = cloneJson(asRecord(item.payload.data))
  const rawStatus = asString(data.status, item.status)
  const derivedStatus = rawStatus === 'ACTIVE' && isPastDate(data.end_date) ? 'EXPIRED' : rawStatus
  if (derivedStatus === item.status && asString(data.status, item.status) === item.status) {
    return item
  }
  return {
    ...item,
    status: derivedStatus,
    payload: {
      ...item.payload,
      data: {
        ...data,
        status: derivedStatus,
      },
    },
  }
}

const findDerivedContract = (contractId: string | null | undefined, sandboxId = DEFAULT_SANDBOX_ID) => {
  const contract = findAggregateRow('contract', contractId, sandboxId)
  return contract ? withDerivedContractStatus(contract) : null
}

const withDerivedStoreContractSnapshot = (item: AggregateRow, sandboxId = DEFAULT_SANDBOX_ID): AggregateRow => {
  if (item.entityType !== 'store') {
    return item
  }
  const data = cloneJson(asRecord(item.payload.data))
  const activeContract = findDerivedContract(asNullableString(data.active_contract_id), sandboxId)
  if (!activeContract || activeContract.status !== 'EXPIRED') {
    return item
  }
  return {
    ...item,
    payload: {
      ...item.payload,
      data: {
        ...data,
        contract_status: 'EXPIRED',
        active_contract_status: 'EXPIRED',
        active_contract_expired_at: asNullableString(asRecord(activeContract.payload.data).end_date),
      },
    },
  }
}

const listEntity = (entityType: DomainEntity, pagination: EntityListQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  paginateItems(filterEntities(listRowsByEntityType(entityType, sandboxId).map(toAggregateRow), pagination), pagination)

const listEntityByScope = (
  entityType: DomainEntity,
  scopeType: string,
  scopeKey: string,
  pagination: EntityListQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) =>
  paginateItems(
    filterEntities(listRowsByEntityType(entityType, sandboxId)
      .map(toAggregateRow)
      .filter(item => item.naturalScopeType === scopeType && item.naturalScopeKey === scopeKey), pagination),
    pagination,
  )

const listBusinessEvents = (sandboxId = DEFAULT_SANDBOX_ID) => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM business_events
    WHERE sandbox_id = ?
    ORDER BY occurred_at DESC
  `).all(sandboxId) as Array<{
    event_id: string
    aggregate_type: string
    aggregate_id: string
    event_type: string
    sandbox_id: string
    platform_id: string
    occurred_at: number
    actor_type: string
    actor_id: string
    payload_json: string
    source_revision: number
  }>
  return rows.map(row => ({
    eventId: row.event_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    sandboxId: row.sandbox_id,
    platformId: row.platform_id,
    occurredAt: row.occurred_at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    payload: parseJson(row.payload_json, {}),
    sourceRevision: row.source_revision,
  }))
}

const getLatestEventPage = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  paginateItems(listBusinessEvents(sandboxId), pagination)

const toAuthAuditLog = (row: {
  log_id: string
  sandbox_id: string
  platform_id: string
  user_id: string
  user_type: string
  event_type: string
  resource_type: string
  resource_id: string | null
  action: string
  permission_code: string
  result: 'ALLOWED' | 'DENIED'
  deny_reason: string | null
  is_cross_sandbox: number
  client_ip: string | null
  user_agent: string | null
  request_id: string | null
  occurred_at: number
  detail_json: string
}): AuthAuditLog => ({
  logId: row.log_id,
  sandboxId: row.sandbox_id,
  platformId: row.platform_id,
  userId: row.user_id,
  userType: row.user_type,
  eventType: row.event_type,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  action: row.action,
  permissionCode: row.permission_code,
  result: row.result,
  denyReason: row.deny_reason,
  isCrossSandbox: row.is_cross_sandbox === 1,
  clientIp: row.client_ip,
  userAgent: row.user_agent,
  requestId: row.request_id,
  occurredAt: new Date(row.occurred_at).toISOString(),
  detail: parseJson(row.detail_json, {}),
})

const getAuthAuditLogPage = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) => {
  ensureSchema()
  const rows = sqlite.prepare(`
    SELECT *
    FROM auth_audit_logs
    WHERE sandbox_id = ?
    ORDER BY occurred_at DESC, log_id DESC
  `).all(sandboxId) as Array<{
    log_id: string
    sandbox_id: string
    platform_id: string
    user_id: string
    user_type: string
    event_type: string
    resource_type: string
    resource_id: string | null
    action: string
    permission_code: string
    result: 'ALLOWED' | 'DENIED'
    deny_reason: string | null
    is_cross_sandbox: number
    client_ip: string | null
    user_agent: string | null
    request_id: string | null
    occurred_at: number
    detail_json: string
  }>
  return paginateItems(rows.map(toAuthAuditLog), pagination)
}

const recordAuthAuditLog = (input: {
  mutation?: MutationInput
  sandboxId?: string
  platformId?: string
  userId?: string | null
  userType?: string | null
  eventType: string
  resourceType: string
  resourceId?: string | null
  action: string
  permissionCode?: string | null
  result: 'ALLOWED' | 'DENIED'
  denyReason?: string | null
  detail?: Record<string, unknown>
}) => {
  const mutation = defaultMutation(input.mutation)
  const sandboxId = input.sandboxId ?? mutation.sandboxId ?? DEFAULT_SANDBOX_ID
  const userId = input.userId ?? mutation.actorId ?? 'UNKNOWN'
  const user = findAggregateRow('user', userId, sandboxId)
  const userData = asRecord(user?.payload.data)
  const userType = input.userType
    ?? asOptionalString(userData.user_type)
    ?? asOptionalString(mutation.actorType)
    ?? 'UNKNOWN'
  appendAuthAuditLog({
    logId: createId('auth-audit'),
    sandboxId,
    platformId: input.platformId ?? asOptionalString(userData.platform_id) ?? identity.platformId,
    userId,
    userType,
    eventType: input.eventType,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    action: input.action,
    permissionCode: input.permissionCode ?? '',
    result: input.result,
    denyReason: input.denyReason ?? null,
    isCrossSandbox: sandboxId !== DEFAULT_SANDBOX_ID,
    clientIp: mutation.clientIp ?? null,
    userAgent: mutation.userAgent ?? null,
    requestId: mutation.traceId ?? null,
    occurredAt: new Date(now()).toISOString(),
    detail: cloneJson(input.detail ?? {}),
  })
}

const ensureCustomerDemoAuthAuditLog = (input: {
  logId: string
  userId: string
  resourceId: string | null
  action: string
  permissionCode: string
  result: 'ALLOWED' | 'DENIED'
  denyReason?: string | null
  detail: Record<string, unknown>
}) => {
  ensureSchema()
  const existing = sqlite.prepare(`
    SELECT log_id
    FROM auth_audit_logs
    WHERE sandbox_id = ? AND log_id = ?
  `).get(customerDemoIdentity.sandboxId, input.logId) as {log_id: string} | undefined
  if (existing) return
  appendAuthAuditLog({
    logId: input.logId,
    sandboxId: customerDemoIdentity.sandboxId,
    platformId: customerDemoIdentity.platformId,
    userId: input.userId,
    userType: input.userId === 'user-butterful-store-manager' ? 'STORE_STAFF' : 'TENANT_STAFF',
    eventType: 'PermissionDecisionChecked',
    resourceType: 'STORE',
    resourceId: input.resourceId,
    action: input.action,
    permissionCode: input.permissionCode,
    result: input.result,
    denyReason: input.denyReason ?? null,
    isCrossSandbox: true,
    clientIp: null,
    userAgent: 'customer-demo-seed',
    requestId: input.logId,
    occurredAt: '2026-04-25T09:00:00.000Z',
    detail: input.detail,
  })
}

const buildContractTimeline = (storeId: string, sandboxId = DEFAULT_SANDBOX_ID) =>
  listBusinessEvents(sandboxId)
    .filter(event => {
      const data = asRecord(asRecord(event.payload).data)
      return event.aggregateId === storeId || asString(data.store_id, '') === storeId
    })
    .map(event => {
      const data = asRecord(asRecord(event.payload).data)
      const contractId = asOptionalString(data.contract_id) ?? (event.aggregateType === 'contract' ? event.aggregateId : null)
      return {
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        actorType: event.actorType,
        actorId: event.actorId,
        sourceRevision: event.sourceRevision,
        storeId: asOptionalString(data.store_id) ?? (event.aggregateType === 'store' ? event.aggregateId : null),
        contractId,
        tenantId: asOptionalString(data.tenant_id),
        brandId: asOptionalString(data.brand_id),
        entityId: asOptionalString(data.entity_id),
        status: asOptionalString(data.status)
          ?? asOptionalString(data.contract_status)
          ?? asOptionalString(data.business_status),
        summary: asOptionalString(data.remark)
          ?? asOptionalString(data.termination_reason)
          ?? asOptionalString(data.contract_code)
          ?? asOptionalString(data.store_name)
          ?? null,
      }
    })

const getDiagnosticPage = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM projection_delivery_diagnostics
    WHERE sandbox_id = ?
    ORDER BY created_at DESC
  `).all(sandboxId) as Array<{
    diagnostic_id: string
    outbox_id: string | null
    topic_key: string
    scope_type: string
    scope_key: string
    item_key: string
    status: string
    detail_json: string
    created_at: number
  }>
  return paginateItems(rows.map(row => ({
    diagnosticId: row.diagnostic_id,
    outboxId: row.outbox_id,
    topicKey: row.topic_key,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    itemKey: row.item_key,
    status: row.status,
    detail: parseJson(row.detail_json, {}),
    createdAt: row.created_at,
  })), pagination)
}

const recordTerminalObservationSnapshot = (input: {
  terminalId: string
  source: string
  snapshot: Record<string, unknown>
  sandboxId?: string
}) => {
  sqlite.prepare(`
    INSERT INTO terminal_observation_snapshots (
      snapshot_id, sandbox_id, terminal_id, source, snapshot_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    createId('terminal-observation'),
    input.sandboxId ?? DEFAULT_SANDBOX_ID,
    input.terminalId,
    input.source,
    serializeJson(input.snapshot),
    now(),
  )
}

const getMutationResponse = <T>(mutationScope: string, key: string | undefined, createResult: () => T): T => {
  if (!key) {
    return createResult()
  }
  const cached = readIdempotency(key, mutationScope)
  if (cached) {
    return cached as T
  }
  const result = createResult()
  writeIdempotency(key, mutationScope, result)
  return result
}

const defaultMutation = (input: MutationInput | undefined): MutationInput => ({
  sandboxId: input?.sandboxId ?? DEFAULT_SANDBOX_ID,
  traceId: input?.traceId,
  clientIp: input?.clientIp,
  userAgent: input?.userAgent,
  actorType: input?.actorType ?? 'ADMIN_API',
  actorId: input?.actorId ?? 'mock-admin-operator',
  idempotencyKey: input?.idempotencyKey,
  expectedRevision: input?.expectedRevision,
  targetTerminalIds: input?.targetTerminalIds ?? [],
})

const sanitizeStatus = (value: unknown, fallback = 'ACTIVE') => {
  const normalized = asString(value, fallback).trim().toUpperCase()
  return allowedStatuses.has(normalized) ? normalized : fallback
}

const sanitizeEntityStatus = (entityType: DomainEntity, value: unknown, fallback = 'ACTIVE') => {
  const normalized = sanitizeStatus(value, fallback)
  const allowed = entityStatusByType[entityType] ?? defaultEntityStatuses
  if (!allowed.has(normalized)) {
    if (entityType === 'table') {
      throw new HttpError(400, 'INVALID_TABLE_STATUS', '桌台主数据只能维护启用或停用状态', {
        tableStatus: normalized,
        allowedStatuses: Array.from(allowed),
      })
    }
    throw new HttpError(400, 'INVALID_ENTITY_STATUS', '该实体不支持此状态；请使用主数据管理态，不要写入交易或履约运行态', {
      entityType,
      status: normalized,
      allowedStatuses: Array.from(allowed),
    })
  }
  return normalized
}

const assertAllowedStatusTransition = (input: {
  entityType: DomainEntity
  entityId: string
  currentStatus: string
  nextStatus: string
}) => {
  if (input.entityType === 'user' && input.currentStatus === 'DELETED' && input.nextStatus !== 'DELETED') {
    throw new HttpError(409, 'USER_DELETED_TERMINAL', '已删除用户是软删除终态，不能恢复或改为其他状态', {
      userId: input.entityId,
      currentStatus: input.currentStatus,
      nextStatus: input.nextStatus,
    })
  }
  if (input.entityType === 'role' && input.currentStatus === 'DEPRECATED' && input.nextStatus !== 'DEPRECATED') {
    throw new HttpError(409, 'ROLE_DEPRECATED_TERMINAL', '已废弃角色是终态，不能恢复或改为其他状态', {
      roleId: input.entityId,
      currentStatus: input.currentStatus,
      nextStatus: input.nextStatus,
    })
  }
}

const resolveEntityId = (prefix: string, requestedId: unknown, fallbackSeed: string) => {
  const explicitId = asOptionalString(requestedId)
  return explicitId ?? normalizeId(`${prefix}-${fallbackSeed}`)
}

const findFieldDuplicate = (input: {
  entityType: DomainEntity
  sandboxId: string
  entityId: string
  field: string
  value: unknown
  scope?: {field: string; value: unknown}
}) => {
  const value = asOptionalString(input.value)
  if (!value) return undefined
  const scopeValue = input.scope ? asOptionalString(input.scope.value) : undefined
  return listRowsByEntityType(input.entityType, input.sandboxId)
    .map(toAggregateRow)
    .find(item => {
      const data = asRecord(item.payload.data)
      if (item.entityId === input.entityId || asString(data[input.field]) !== value) {
        return false
      }
      if (!input.scope) {
        return true
      }
      return asString(data[input.scope.field]) === scopeValue
    })
}

const knownTagResourceTypes: Record<string, DomainEntity> = {
  platform: 'platform',
  project: 'project',
  tenant: 'tenant',
  brand: 'brand',
  store: 'store',
  contract: 'contract',
  user: 'user',
  role: 'role',
  permission: 'permission',
  product: 'product',
  menu: 'menu_catalog',
  table: 'table',
  workstation: 'workstation',
}

const getRolePermissionIds = (role: AggregateRow | null | undefined) => {
  if (!role || role.status !== 'ACTIVE') {
    return []
  }
  const data = asRecord(role.payload.data)
  return asStringList(data.permission_ids)
}

const getRolePermissionCodes = (role: AggregateRow | null | undefined, sandboxId: string) => {
  const permissionsById = new Map(
    listRowsByEntityType('permission', sandboxId)
      .map(toAggregateRow)
      .map(permission => [permission.entityId, permission]),
  )
  return getRolePermissionIds(role)
    .map(permissionId => asOptionalString(asRecord(permissionsById.get(permissionId)?.payload.data).permission_code))
    .filter((permissionCode): permissionCode is string => Boolean(permissionCode))
}

const resourceScopesEqual = (left: Record<string, unknown>, right: Record<string, unknown>) =>
  normalizeScopeSelector(left).comparisonKey === normalizeScopeSelector(right).comparisonKey

const normalizeScopeType = (value: unknown, fallback = 'PLATFORM') => asString(value, fallback).trim().toUpperCase()

const normalizeOrgNodeType = (value: unknown) => asString(value, '').trim().toLowerCase()

const normalizeScopeSelector = (
  value: unknown,
  fallbackScopeType = 'PLATFORM',
  fallbackScopeKey = identity.platformId,
): ScopeSelector & {comparisonKey: string} => {
  const raw = asRecord(value)
  const rawScopeType = normalizeScopeType(raw.scope_type ?? raw.scopeType, fallbackScopeType)
  const scopeType = ['TAG', 'ORG_NODE', 'RESOURCE_IDS', 'COMPOSITE'].includes(rawScopeType)
    ? rawScopeType
    : normalizeScopeType(rawScopeType, fallbackScopeType)

  if (scopeType === 'TAG') {
    const tags = asStringList(raw.tags).sort()
    const scopeKey = tags.length ? tags.join('|') : asString(raw.scope_key ?? raw.scopeId, fallbackScopeKey)
    const normalized = {scope_type: 'TAG', scope_key: scopeKey, tags}
    return {...normalized, comparisonKey: normalizeComparable(normalized)}
  }

  if (scopeType === 'ORG_NODE') {
    const orgNodeType = normalizeOrgNodeType(raw.org_node_type ?? raw.orgNodeType)
    const orgNodeIds = asStringList(raw.org_node_ids ?? raw.orgNodeIds ?? raw.org_node_id ?? raw.orgNodeId ?? raw.scope_key ?? raw.scopeId)
    const scopeKey = orgNodeIds.length ? `${orgNodeType || 'node'}:${orgNodeIds.slice().sort().join('|')}` : asString(raw.scope_key ?? raw.scopeId, fallbackScopeKey)
    const normalized = {
      scope_type: 'ORG_NODE',
      scope_key: scopeKey,
      org_node_type: orgNodeType || null,
      org_node_id: orgNodeIds[0] ?? null,
      org_node_ids: orgNodeIds.slice().sort(),
    }
    return {...normalized, comparisonKey: normalizeComparable(normalized)}
  }

  if (scopeType === 'RESOURCE_IDS') {
    const resourceType = asString(raw.resource_type ?? raw.resourceType, '').trim().toLowerCase()
    const resourceIds = asStringList(raw.resource_ids ?? raw.resourceIds ?? raw.resource_id ?? raw.resourceId ?? raw.scope_key ?? raw.scopeId)
    const scopeKey = resourceIds.length ? `${resourceType || 'resource'}:${resourceIds.slice().sort().join('|')}` : asString(raw.scope_key ?? raw.scopeId, fallbackScopeKey)
    const normalized = {
      scope_type: 'RESOURCE_IDS',
      scope_key: scopeKey,
      resource_type: resourceType || null,
      resource_id: resourceIds[0] ?? null,
      resource_ids: resourceIds.slice().sort(),
    }
    return {...normalized, comparisonKey: normalizeComparable(normalized)}
  }

  if (scopeType === 'COMPOSITE') {
    const selectors = asRecordList(raw.selectors)
      .map(selector => normalizeScopeSelector(selector))
      .sort((left, right) => left.comparisonKey.localeCompare(right.comparisonKey))
      .map(({comparisonKey: _comparisonKey, ...selector}) => selector)
    const scopeKey = selectors.length
      ? selectors.map(selector => normalizeScopeSelector(selector).comparisonKey).sort().join('&')
      : asString(raw.scope_key ?? raw.scopeId, fallbackScopeKey)
    const normalized = {scope_type: 'COMPOSITE', scope_key: scopeKey, selectors}
    return {...normalized, comparisonKey: normalizeComparable(normalized)}
  }

  const scopeKey = asString(raw.scope_key ?? raw.scopeId ?? raw.scope_id, fallbackScopeKey)
  const normalized = {scope_type: scopeType, scope_key: scopeKey}
  return {...normalized, comparisonKey: normalizeComparable(normalized)}
}

const bindingScopeForData = (data: Record<string, unknown>, fallbackScopeType: string, fallbackScopeKey: string) => {
  const resourceScope = asRecord(data.resource_scope ?? data.scope_selector)
  const fallbackKey = asString(data.scope_id ?? data.store_id, fallbackScopeKey)
  const scope = normalizeScopeSelector(
    Object.keys(resourceScope).length > 0 ? resourceScope : {scope_type: data.scope_type, scope_key: data.scope_id ?? data.store_id},
    fallbackScopeType,
    fallbackKey,
  )
  const {comparisonKey: _comparisonKey, ...normalizedScope} = scope
  return normalizedScope
}

const storeTargetForScope = (storeId: string, sandboxId: string) => {
  const store = findAggregateRow('store', storeId, sandboxId)
  const storeData = readAggregateData(store)
  return {
    storeId,
    projectId: asOptionalString(storeData.project_id),
    platformId: asOptionalString(storeData.platform_id),
    tenantId: asOptionalString(storeData.tenant_id),
    brandId: asOptionalString(storeData.brand_id),
    regionId: asOptionalString(readAggregateData(findAggregateRow('project', asOptionalString(storeData.project_id), sandboxId)).region_id),
  }
}

const resourceHasTags = (input: {
  resourceType: string
  resourceId: string
  tags: string[]
  sandboxId: string
}) => {
  if (input.tags.length === 0) {
    return false
  }
  const resourceTags = new Set(listRowsByEntityType('resource_tag', input.sandboxId)
    .map(toAggregateRow)
    .filter(tag => tag.status === 'ACTIVE')
    .map(tag => asRecord(tag.payload.data))
    .filter(tag => asString(tag.resource_type).toLowerCase() === input.resourceType.toLowerCase())
    .filter(tag => asString(tag.resource_id) === input.resourceId)
    .map(tag => `${asString(tag.tag_key)}:${asString(tag.tag_value)}`))
  return input.tags.every(tag => resourceTags.has(tag))
}

const orgNodeScopeMatchesTarget = (
  scope: ScopeSelector,
  target: {storeId?: string | null; projectId?: string | null; platformId?: string | null; tenantId?: string | null; brandId?: string | null; regionId?: string | null},
) => {
  const nodeType = normalizeOrgNodeType(scope.org_node_type)
  const nodeIds = new Set(asStringList(scope.org_node_ids ?? scope.org_node_id ?? scope.scope_key))
  if (nodeIds.size === 0) {
    return false
  }
  if (nodeType === 'platform') return Boolean(target.platformId && nodeIds.has(target.platformId))
  if (nodeType === 'region') return Boolean(target.regionId && nodeIds.has(target.regionId))
  if (nodeType === 'project') return Boolean(target.projectId && nodeIds.has(target.projectId))
  if (nodeType === 'store') return Boolean(target.storeId && nodeIds.has(target.storeId))
  if (nodeType === 'tenant') return Boolean(target.tenantId && nodeIds.has(target.tenantId))
  if (nodeType === 'brand') return Boolean(target.brandId && nodeIds.has(target.brandId))
  return Boolean(
    (target.storeId && nodeIds.has(target.storeId))
    || (target.projectId && nodeIds.has(target.projectId))
    || (target.platformId && nodeIds.has(target.platformId))
    || (target.tenantId && nodeIds.has(target.tenantId))
    || (target.brandId && nodeIds.has(target.brandId))
    || (target.regionId && nodeIds.has(target.regionId)),
  )
}

const bindingScopeMatches = (
  scope: ScopeSelector,
  target: {storeId?: string | null; projectId?: string | null; platformId?: string | null; tenantId?: string | null; brandId?: string | null; regionId?: string | null; sandboxId?: string | null},
): boolean => {
  if (scope.scope_type === 'PLATFORM') {
    return !target.platformId || scope.scope_key === target.platformId
  }
  if (scope.scope_type === 'PROJECT') {
    return Boolean(target.projectId && scope.scope_key === target.projectId)
  }
  if (scope.scope_type === 'STORE') {
    return Boolean(target.storeId && scope.scope_key === target.storeId)
  }
  if (scope.scope_type === 'TENANT') {
    return Boolean(target.tenantId && scope.scope_key === target.tenantId)
  }
  if (scope.scope_type === 'BRAND') {
    return Boolean(target.brandId && scope.scope_key === target.brandId)
  }
  if (scope.scope_type === 'REGION') {
    return Boolean(target.regionId && scope.scope_key === target.regionId)
  }
  if (scope.scope_type === 'ORG_NODE') {
    return orgNodeScopeMatchesTarget(scope, target)
  }
  if (scope.scope_type === 'RESOURCE_IDS') {
    const resourceType = asString(scope.resource_type, '').toLowerCase()
    const resourceIds = new Set(asStringList(scope.resource_ids ?? scope.resource_id ?? scope.scope_key))
    if (resourceType === 'store') return Boolean(target.storeId && resourceIds.has(target.storeId))
    if (resourceType === 'project') return Boolean(target.projectId && resourceIds.has(target.projectId))
    if (resourceType === 'platform') return Boolean(target.platformId && resourceIds.has(target.platformId))
    if (resourceType === 'tenant') return Boolean(target.tenantId && resourceIds.has(target.tenantId))
    if (resourceType === 'brand') return Boolean(target.brandId && resourceIds.has(target.brandId))
    if (resourceType === 'region') return Boolean(target.regionId && resourceIds.has(target.regionId))
    return false
  }
  if (scope.scope_type === 'TAG') {
    if (!target.storeId || !target.sandboxId) return false
    return resourceHasTags({
      resourceType: 'store',
      resourceId: target.storeId,
      tags: asStringList(scope.tags),
      sandboxId: target.sandboxId,
    })
  }
  if (scope.scope_type === 'COMPOSITE') {
    const selectors = Array.isArray(scope.selectors) ? scope.selectors : []
    return selectors.length > 0 && selectors.every(selector => bindingScopeMatches(selector, target))
  }
  return scope.scope_key !== ''
}

const bindingIsEffective = (binding: AggregateRow) => {
  if (binding.status !== 'ACTIVE') return false
  const data = asRecord(binding.payload.data)
  const nowTime = now()
  const effectiveFrom = asOptionalString(data.effective_from)
  const effectiveTo = asOptionalString(data.effective_to)
  if (effectiveFrom && Date.parse(effectiveFrom) > nowTime) return false
  if (effectiveTo && Date.parse(effectiveTo) <= nowTime) return false
  return true
}

const getActiveDirectRoleBindingsForUser = (userId: string, sandboxId: string) =>
  listRowsByEntityType('user_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(binding => bindingIsEffective(binding))
    .filter(binding => asString(asRecord(binding.payload.data).user_id) === userId)

const getActiveGroupRoleBindingsForUser = (userId: string, sandboxId: string) => {
  const activeGroupIds = new Set(listRowsByEntityType('group_member', sandboxId)
    .map(toAggregateRow)
    .filter(member => member.status === 'ACTIVE')
    .filter(member => asString(asRecord(member.payload.data).user_id) === userId)
    .map(member => asString(asRecord(member.payload.data).group_id))
    .filter(Boolean))

  return listRowsByEntityType('group_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(binding => bindingIsEffective(binding))
    .filter(binding => activeGroupIds.has(asString(asRecord(binding.payload.data).group_id)))
}

const assertPermissionIdsExist = (permissionIds: string[], sandboxId: string) => {
  const normalizedPermissionIds = Array.from(new Set(permissionIds.map(item => asString(item, '').trim()).filter(Boolean)))
  if (normalizedPermissionIds.length === 0) {
    throw new HttpError(400, 'ROLE_PERMISSION_REQUIRED', '请至少选择一个权限')
  }
  const missingPermissionIds = normalizedPermissionIds.filter(permissionId => !findAggregateRow('permission', permissionId, sandboxId))
  if (missingPermissionIds.length) {
    throw new HttpError(404, 'ROLE_PERMISSION_NOT_FOUND', '角色包含不存在的权限', {permissionIds: missingPermissionIds})
  }
  return normalizedPermissionIds
}

const rolePermissionIdsGrantPermission = (
  rolePermissionIds: string[],
  requestedPermission: AggregateRow,
  permissionsById: Map<string, AggregateRow>,
) => {
  if (rolePermissionIds.includes(requestedPermission.entityId)) {
    return true
  }
  let parentPermissionId = asOptionalString(asRecord(requestedPermission.payload.data).parent_permission_id)
  while (parentPermissionId) {
    if (rolePermissionIds.includes(parentPermissionId)) {
      return true
    }
    parentPermissionId = asOptionalString(asRecord(permissionsById.get(parentPermissionId)?.payload.data).parent_permission_id)
  }
  return false
}

const permissionFeatureEnabled = (permission: AggregateRow, sandboxId: string) => {
  const data = asRecord(permission.payload.data)
  const featureCode = asOptionalString(data.feature_flag)
  if (!featureCode) {
    return true
  }
  const platformId = asOptionalString(data.platform_id)
  const feature = listRowsByEntityType('feature_point', sandboxId)
    .map(toAggregateRow)
    .find(item => asString(asRecord(item.payload.data).feature_code) === featureCode)
  if (!feature || feature.status !== 'ACTIVE' || !asBoolean(asRecord(feature.payload.data).is_enabled_globally, true)) {
    return false
  }
  if (!platformId) {
    return true
  }
  const switchRow = listRowsByEntityType('platform_feature_switch', sandboxId)
    .map(toAggregateRow)
    .find(item => {
      const switchData = asRecord(item.payload.data)
      return asString(switchData.platform_id) === platformId
        && asString(switchData.feature_code) === featureCode
    })
  return switchRow ? switchRow.status === 'ACTIVE' && asBoolean(asRecord(switchRow.payload.data).is_enabled, true) : asBoolean(asRecord(feature.payload.data).default_enabled, false)
}

const assertRequiredFields = (record: Record<string, unknown>, fields: string[], code: string, message: string) => {
  const missing = fields.filter(field => !asOptionalString(record[field]))
  if (missing.length) {
    throw new HttpError(400, code, message, {missing})
  }
}

const assertPlatformExists = (platformId: string, sandboxId: string) => {
  if (!findAggregateRow('platform', platformId, sandboxId)) {
    throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
  }
}

const findActiveByField = (
  entityType: DomainEntity,
  sandboxId: string,
  field: string,
  value: unknown,
  platformId?: string,
) => {
  const normalizedValue = asOptionalString(value)
  if (!normalizedValue) return null
  return listRowsByEntityType(entityType, sandboxId)
    .map(toAggregateRow)
    .find(item => {
      const itemData = asRecord(item.payload.data)
      const itemPlatformId = asOptionalString(itemData.platform_id) ?? item.naturalScopeKey
      return item.status === 'ACTIVE'
        && asString(itemData[field]) === normalizedValue
        && (!platformId || itemPlatformId === platformId)
    }) ?? null
}

const assertEntityBelongsToPlatform = (
  entity: AggregateRow,
  platformId: string,
  code: string,
  message: string,
  sandboxId = DEFAULT_SANDBOX_ID,
) => {
  const entityData = asRecord(entity.payload.data)
  const storeId = entity.entityType === 'user' || entity.entityType === 'user_role_binding'
    ? asOptionalString(entityData.store_id) ?? (entity.naturalScopeType === 'STORE' ? entity.naturalScopeKey : undefined)
    : undefined
  const storePlatformId = storeId
    ? asOptionalString(readAggregateData(findAggregateRow('store', storeId, sandboxId)).platform_id)
    : undefined
  const entityPlatformId = asOptionalString(entityData.platform_id)
    ?? storePlatformId
    ?? (entity.naturalScopeType === 'PLATFORM' ? entity.naturalScopeKey : undefined)
  if (entityPlatformId && entityPlatformId !== platformId) {
    throw new HttpError(409, code, message, {
      entityId: entity.entityId,
      platformId,
      entityPlatformId,
    })
  }
}

const assertDateRange = (startDate: unknown, endDate: unknown) => {
  const start = asOptionalString(startDate)
  const end = asOptionalString(endDate)
  if (!start || !end) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', '必须填写生效日期和到期日期')
  }
  if (Date.parse(start) >= Date.parse(end)) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', '生效日期必须早于到期日期')
  }
}

const dateRangesOverlap = (leftStart: unknown, leftEnd: unknown, rightStart: unknown, rightEnd: unknown) => {
  const leftStartTime = Date.parse(asString(leftStart, ''))
  const leftEndTime = Date.parse(asString(leftEnd, ''))
  const rightStartTime = Date.parse(asString(rightStart, ''))
  const rightEndTime = Date.parse(asString(rightEnd, ''))
  if (![leftStartTime, leftEndTime, rightStartTime, rightEndTime].every(Number.isFinite)) {
    return false
  }
  return leftStartTime < rightEndTime && rightStartTime < leftEndTime
}

const optionalDateRangeOverlaps = (
  leftStart: unknown,
  leftEnd: unknown,
  rightStart: unknown,
  rightEnd: unknown,
) => dateRangesOverlap(
  leftStart ?? '1970-01-01T00:00:00.000Z',
  leftEnd ?? '2999-12-31T23:59:59.999Z',
  rightStart ?? '1970-01-01T00:00:00.000Z',
  rightEnd ?? '2999-12-31T23:59:59.999Z',
)

const normalizedWeekDays = (value: unknown) => Array.from(new Set(asStringList(value)
  .map(day => Number(day))
  .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
  .sort((left, right) => left - right)))

const weekDaysOverlap = (left: unknown, right: unknown) => {
  const leftDays = normalizedWeekDays(left)
  const rightDays = normalizedWeekDays(right)
  if (leftDays.length === 0 || rightDays.length === 0) {
    return true
  }
  const rightSet = new Set(rightDays)
  return leftDays.some(day => rightSet.has(day))
}

const parseTimeToMinutes = (value: unknown) => {
  const text = asString(value, '').trim()
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text)
  if (!match) {
    return null
  }
  return Number(match[1]) * 60 + Number(match[2])
}

const timeRangesOverlap = (leftStart: unknown, leftEnd: unknown, rightStart: unknown, rightEnd: unknown) => {
  const leftStartMinutes = parseTimeToMinutes(leftStart)
  const leftEndMinutes = parseTimeToMinutes(leftEnd)
  const rightStartMinutes = parseTimeToMinutes(rightStart)
  const rightEndMinutes = parseTimeToMinutes(rightEnd)
  if (
    leftStartMinutes === null
    || leftEndMinutes === null
    || rightStartMinutes === null
    || rightEndMinutes === null
  ) {
    return false
  }
  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes
}

const walkPotentialSecretKeys = (value: unknown, path: string[] = []): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => walkPotentialSecretKeys(item, [...path, String(index)]))
  }
  if (!value || typeof value !== 'object') {
    return []
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const nextPath = [...path, key]
    const keyLooksSecret = /(secret|token|password|credential|private[_-]?key|app[_-]?key|access[_-]?key)/i.test(key)
    return [
      ...(keyLooksSecret ? [nextPath.join('.')] : []),
      ...walkPotentialSecretKeys(child, nextPath),
    ]
  })
}

const assertProjectChannelConfigHasNoSecrets = (channelShopConfig: unknown) => {
  const secretPaths = walkPotentialSecretKeys(channelShopConfig)
  if (secretPaths.length) {
    throw new HttpError(400, 'PROJECT_CHANNEL_CONFIG_SECRET_FORBIDDEN', '项目渠道配置不能保存密钥、令牌或密码，请在集团 ISV 凭据中统一维护', {
      secretPaths,
    })
  }
}

const assertRegionParentDoesNotCycle = (input: {
  regionId: string
  parentRegionId: string | null
  sandboxId: string
}) => {
  if (!input.parentRegionId) {
    return
  }
  const visited = new Set<string>([input.regionId])
  let cursor: string | null = input.parentRegionId
  while (cursor) {
    if (visited.has(cursor)) {
      throw new HttpError(409, 'REGION_PARENT_CYCLE', '大区父子关系不能形成循环', {
        regionId: input.regionId,
        parentRegionId: input.parentRegionId,
      })
    }
    visited.add(cursor)
    const parent = findAggregateRow('region', cursor, input.sandboxId)
    cursor = parent ? asNullableString(asRecord(parent.payload.data).parent_region_id) : null
  }
}

const assertStoreSnapshotConsistency = (input: {
  storeId: string
  data: Record<string, unknown>
}) => {
  const storeStatus = asString(input.data.store_status, asString(input.data.status)).toUpperCase()
  const activeContractId = asNullableString(input.data.active_contract_id)
  if (storeStatus === 'VACANT') {
    const occupiedFields = ['tenant_id', 'brand_id', 'entity_id']
      .filter(field => asNullableString(input.data[field]) !== null)
    if (activeContractId || occupiedFields.length) {
      throw new HttpError(409, 'VACANT_STORE_CANNOT_KEEP_CONTRACT_SNAPSHOT', '空置门店不能保留合同、租户、品牌或乙方快照', {
        storeId: input.storeId,
        activeContractId,
        occupiedFields,
      })
    }
  }
  if (storeStatus === 'OPERATING' && !activeContractId) {
    throw new HttpError(409, 'OPERATING_STORE_REQUIRES_ACTIVE_CONTRACT', '营业中的门店必须有关联的生效合同', {
      storeId: input.storeId,
    })
  }
}

const tableMasterStatuses = new Set(['AVAILABLE', 'DISABLED'])
const tableRuntimeOnlyFields = [
  'current_session_id',
  'current_booking_id',
  'current_customer_count',
  'occupied_at',
]
const storeRuntimeOnlyFields = [
  'current_order_id',
  'current_order_count',
  'pending_order_count',
  'serving_order_count',
  'last_order_at',
  'opened_at',
  'closed_at',
]
const workstationRuntimeOnlyFields = [
  'current_work_order_id',
  'current_task_id',
  'queue_length',
  'in_progress_count',
  'last_work_order_at',
]

const readonlyFieldsByEntityType: Partial<Record<DomainEntity, string[]>> = {
  sandbox: ['sandbox_id', 'sandbox_code'],
  platform: ['platform_id', 'platform_code'],
  region: ['region_id', 'region_code', 'platform_id'],
  project: ['project_id', 'project_code', 'platform_id'],
  tenant: ['tenant_id', 'tenant_code', 'platform_id', 'unified_social_credit_code', 'social_credit_code'],
  brand: ['brand_id', 'brand_code', 'platform_id', 'tenant_id'],
  store: ['store_id', 'store_code', 'platform_id', 'project_id', 'active_contract_id', 'tenant_id', 'brand_id', 'entity_id', 'contract_status'],
  contract: [
    'contract_id',
    'contract_code',
    'contract_no',
    'platform_id',
    'project_id',
    'lessor_project_id',
    'lessor_project_name',
    'lessor_phase_id',
    'lessor_phase_name',
    'lessor_owner_name',
    'lessor_owner_contact',
    'lessor_owner_phone',
    'store_id',
    'lessee_store_id',
    'lessee_store_name',
    'tenant_id',
    'lessee_tenant_id',
    'lessee_tenant_name',
    'brand_id',
    'lessee_brand_id',
    'lessee_brand_name',
    'entity_id',
    'unit_code',
  ],
  business_entity: ['entity_id', 'entity_code', 'tenant_id', 'platform_id'],
  table: ['table_id', 'store_id', 'project_id', 'platform_id', 'table_no', ...tableRuntimeOnlyFields],
  workstation: ['workstation_id', 'store_id', 'project_id', 'platform_id', 'workstation_code'],
  identity_provider_config: ['idp_id', 'platform_id', 'idp_type'],
  permission: ['permission_id', 'permission_code', 'permission_source', 'platform_id'],
  permission_group: ['permission_group_id', 'group_code'],
  role_template: ['template_id', 'template_code'],
  feature_point: ['feature_point_id', 'feature_code'],
  platform_feature_switch: ['switch_id', 'platform_id', 'feature_code'],
  role: ['role_id', 'role_code', 'role_type', 'platform_id'],
  user: ['user_id', 'user_code', 'username', 'platform_id', 'identity_source', 'external_user_id'],
  user_role_binding: ['binding_id', 'user_id', 'role_id', 'platform_id'],
  resource_tag: ['tag_id', 'platform_id', 'resource_type', 'resource_id', 'tag_key'],
  principal_group: ['group_id', 'platform_id', 'group_code', 'group_type'],
  group_member: ['member_id', 'group_id', 'user_id'],
  group_role_binding: ['group_binding_id', 'group_id', 'role_id', 'platform_id'],
  authorization_session: ['session_id', 'user_id', 'platform_id'],
  separation_of_duty_rule: ['sod_rule_id', 'platform_id'],
  high_risk_permission_policy: ['policy_id', 'permission_code', 'platform_id'],
  product_category: ['category_id', 'platform_id', 'category_code', 'ownership_scope', 'owner_id'],
  brand_metadata: ['metadata_id', 'platform_id', 'brand_id', 'metadata_type'],
  product: ['product_id', 'platform_id', 'product_code', 'ownership_scope', 'owner_id', 'brand_id', 'store_id'],
  product_inheritance: ['inheritance_id', 'platform_id', 'brand_product_id', 'store_product_id', 'store_id'],
  brand_menu: ['brand_menu_id', 'platform_id', 'menu_id', 'brand_id'],
  menu_catalog: ['menu_id', 'platform_id', 'store_id', 'brand_menu_id'],
  price_rule: ['rule_id', 'platform_id', 'rule_code', 'store_id'],
  bundle_price_rule: ['rule_id', 'platform_id', 'store_id'],
  channel_product_mapping: ['mapping_id', 'platform_id', 'store_id', 'product_id', 'channel_type'],
  store_config: ['config_id', 'platform_id', 'store_id'],
  menu_availability: ['product_id', 'platform_id', 'store_id'],
  availability_rule: ['rule_id', 'platform_id', 'rule_code', 'store_id'],
  saleable_stock: ['stock_id', 'platform_id', 'store_id', 'product_id', 'sku_id'],
}

const normalizeComparable = (value: unknown) => JSON.stringify(value ?? null)

const assertUpdateDoesNotChangeReadonlyFields = (input: {
  entityType: DomainEntity
  entityId: string
  currentData: Record<string, unknown>
  inputData: Record<string, unknown>
}) => {
  if (input.entityType === 'tenant' && Object.prototype.hasOwnProperty.call(input.inputData, 'tenant_category')) {
    throw new HttpError(400, 'TENANT_CATEGORY_FORBIDDEN', '租户是法人主体，不维护品类；品牌品类请在集团全局字典中维护')
  }
  if (input.entityType === 'brand' && Object.prototype.hasOwnProperty.call(input.inputData, 'tenant_id')) {
    throw new HttpError(400, 'BRAND_TENANT_FORBIDDEN', '品牌直属集团，不归属租户；门店通过合同关联租户与品牌')
  }
  if (input.entityType === 'table') {
    const blockedRuntimeFields = tableRuntimeOnlyFields.filter(field => Object.prototype.hasOwnProperty.call(input.inputData, field))
    if (blockedRuntimeFields.length) {
      throw new HttpError(400, 'TABLE_RUNTIME_FIELD_FORBIDDEN', '本后台只维护桌台主数据，不维护开台、预订或占用运行态', {
        tableId: input.entityId,
        fields: blockedRuntimeFields,
      })
    }
  }
  if (input.entityType === 'store') {
    const blockedRuntimeFields = storeRuntimeOnlyFields.filter(field => Object.prototype.hasOwnProperty.call(input.inputData, field))
    if (blockedRuntimeFields.length) {
      throw new HttpError(400, 'STORE_RUNTIME_FIELD_FORBIDDEN', '本后台只维护门店主数据与经营配置，不维护订单、接单或开闭店运行态', {
        storeId: input.entityId,
        fields: blockedRuntimeFields,
      })
    }
  }
  if (input.entityType === 'workstation') {
    const blockedRuntimeFields = workstationRuntimeOnlyFields.filter(field => Object.prototype.hasOwnProperty.call(input.inputData, field))
    if (blockedRuntimeFields.length) {
      throw new HttpError(400, 'WORKSTATION_RUNTIME_FIELD_FORBIDDEN', '本后台只维护工作站主数据，不维护生产工单或队列运行态', {
        workstationId: input.entityId,
        fields: blockedRuntimeFields,
      })
    }
  }
  const readonlyFields = readonlyFieldsByEntityType[input.entityType] ?? []
  readonlyFields.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(input.inputData, field)) {
      return
    }
    if (normalizeComparable(input.inputData[field]) !== normalizeComparable(input.currentData[field])) {
      throw new HttpError(400, 'READONLY_FIELD_CHANGED', '该字段创建后不可修改，或由合同/系统快照维护', {
        entityType: input.entityType,
        entityId: input.entityId,
        field,
      })
    }
    delete input.inputData[field]
  })
}

const computeStockStatus = (data: Record<string, unknown>) => {
  const totalQuantity = asNullableNumber(data.total_quantity)
  const availableQuantity = totalQuantity === null
    ? null
    : Math.max(0, asNumber(totalQuantity, 0) - asNumber(data.sold_quantity, 0) - asNumber(data.reserved_quantity, 0))
  const soldOutThreshold = asNumber(data.sold_out_threshold, 0)
  if (totalQuantity !== null && availableQuantity !== null && availableQuantity <= 0) {
    return 'SOLD_OUT'
  }
  if (totalQuantity !== null && availableQuantity !== null && availableQuantity <= soldOutThreshold) {
    return 'LOW_STOCK'
  }
  return 'AVAILABLE'
}

const isLegacyRegionReference = (regionId: string) => /^CN-[A-Z0-9_-]+$/i.test(regionId)

const menuSectionProductIds = (sections: unknown) =>
  asRecordList(sections).flatMap(section =>
    asRecordList(section.products).map(product => asString(product.product_id, '')).filter(Boolean),
  )

const menuProductsById = (sections: unknown) => {
  const products = new Map<string, Record<string, unknown>>()
  asRecordList(sections).forEach(section => {
    asRecordList(section.products).forEach(product => {
      const productId = asOptionalString(product.product_id)
      if (productId) {
        products.set(productId, product)
      }
    })
  })
  return products
}

const menuMandatoryProductIds = (sections: unknown) =>
  Array.from(menuProductsById(sections).entries())
    .filter(([, product]) => asBoolean(product.is_mandatory, false))
    .map(([productId]) => productId)

const assertMenuHasPublishableProducts = (input: {
  sections: unknown
  sandboxId: string
  label: string
  platformId?: string
}) => {
  const productIds = menuSectionProductIds(input.sections)
  if (productIds.length === 0) {
    throw new HttpError(400, 'MENU_PRODUCTS_REQUIRED', `${input.label}至少需要包含一个菜品`)
  }
  const missingOrInactiveProductIds = productIds.filter(productId => {
    const product = findAggregateRow('product', productId, input.sandboxId)
    return !product || product.status !== 'ACTIVE'
  })
  if (missingOrInactiveProductIds.length) {
    throw new HttpError(409, 'MENU_PRODUCT_NOT_ACTIVE', `${input.label}包含不存在或未上架的菜品`, {
      productIds: missingOrInactiveProductIds,
    })
  }
  if (input.platformId) {
    const mismatchedProductIds = productIds.filter(productId => {
      const product = findAggregateRow('product', productId, input.sandboxId)
      return product && asString(asRecord(product.payload.data).platform_id) !== input.platformId
    })
    if (mismatchedProductIds.length) {
      throw new HttpError(409, 'MENU_PRODUCT_PLATFORM_MISMATCH', `${input.label}包含不属于当前集团的菜品`, {
        productIds: mismatchedProductIds,
        platformId: input.platformId,
      })
    }
  }
}

const assertActiveBrandMenuWindowUnique = (input: {
  menuId: string
  data: Record<string, unknown>
  sandboxId: string
}) => {
  const entityStatus = asString(input.data.status, 'DRAFT').toUpperCase()
  const reviewStatus = asString(input.data.review_status, 'NONE').toUpperCase()
  if (!['APPROVED', 'ACTIVE'].includes(entityStatus) && reviewStatus !== 'APPROVED') {
    return
  }
  const conflict = listRowsByEntityType('brand_menu', input.sandboxId)
    .map(toAggregateRow)
    .find(item => {
      const itemData = asRecord(item.payload.data)
      const itemBusinessIds = [
        item.entityId,
        asString(itemData.brand_menu_id, ''),
        asString(itemData.menu_id, ''),
      ].filter(Boolean)
      const currentBusinessIds = [
        input.menuId,
        asString(input.data.brand_menu_id, ''),
        asString(input.data.menu_id, ''),
      ].filter(Boolean)
      const itemReviewStatus = asString(itemData.review_status, 'NONE').toUpperCase()
      const itemStatus = asString(item.status).toUpperCase()
      if (itemBusinessIds.some(id => currentBusinessIds.includes(id)) || (!['APPROVED', 'ACTIVE'].includes(itemStatus) && itemReviewStatus !== 'APPROVED')) {
        return false
      }
      return asString(itemData.brand_id) === asString(input.data.brand_id)
        && asString(itemData.channel_type, 'ALL') === asString(input.data.channel_type, 'ALL')
        && asString(itemData.menu_type, 'FULL_DAY') === asString(input.data.menu_type, 'FULL_DAY')
        && optionalDateRangeOverlaps(
          itemData.effective_from ?? itemData.effective_date,
          itemData.effective_to ?? itemData.expire_date,
          input.data.effective_from ?? input.data.effective_date,
          input.data.effective_to ?? input.data.expire_date,
        )
        && menuTimeSlotOverlaps(itemData, input.data)
    })
  if (conflict) {
    throw new HttpError(409, 'ACTIVE_BRAND_MENU_CONFLICT', '同一品牌、渠道、菜单类型和生效时间内只能有一份已批准菜单；请创建新版本或调整时间窗', {
      conflictMenuId: conflict.entityId,
    })
  }
}

const assertStoreMenuOverrideScope = (input: {
  data: Record<string, unknown>
  brandMenu: AggregateRow | null
}) => {
  if (!input.brandMenu) {
    return
  }
  const brandMenuData = asRecord(input.brandMenu.payload.data)
  const allowStoreOverride = asBoolean(brandMenuData.allow_store_override, true)
  const overrideScope = asRecord(brandMenuData.override_scope)
  const brandProducts = menuProductsById(brandMenuData.sections)
  const storeProducts = menuProductsById(input.data.sections)
  const missingMandatoryProductIds = menuMandatoryProductIds(brandMenuData.sections)
    .filter(productId => !storeProducts.has(productId))
  if (missingMandatoryProductIds.length) {
    throw new HttpError(409, 'STORE_MENU_MANDATORY_PRODUCT_MISSING', '门店菜单不能移除品牌菜单的必选商品', {
      brandMenuId: input.brandMenu.entityId,
      productIds: missingMandatoryProductIds,
    })
  }
  if (!allowStoreOverride) {
    const overriddenProductIds = Array.from(storeProducts.entries())
      .filter(([productId, product]) => {
        const inherited = brandProducts.get(productId)
        if (!inherited) {
          return false
        }
        return asNullableNumber(product.override_price) !== null
          || asNullableString(product.override_name) !== null
          || asNullableString(product.override_image) !== null
          || asRecordList(product.availability_rules).length > 0
      })
      .map(([productId]) => productId)
    if (overriddenProductIds.length) {
      throw new HttpError(409, 'STORE_MENU_OVERRIDE_FORBIDDEN', '该品牌菜单不允许门店覆盖商品名称、图片、价格或可售规则', {
        brandMenuId: input.brandMenu.entityId,
        productIds: overriddenProductIds,
      })
    }
  }
  const forbidden: Array<{productId: string; field: string}> = []
  storeProducts.forEach((product, productId) => {
    if (!brandProducts.has(productId)) {
      return
    }
    if (!asBoolean(overrideScope.price_overridable, true) && asNullableNumber(product.override_price) !== null) {
      forbidden.push({productId, field: 'override_price'})
    }
    if (!asBoolean(overrideScope.name_overridable, true) && asNullableString(product.override_name) !== null) {
      forbidden.push({productId, field: 'override_name'})
    }
    if (!asBoolean(overrideScope.image_overridable, true) && asNullableString(product.override_image) !== null) {
      forbidden.push({productId, field: 'override_image'})
    }
    if (!asBoolean(overrideScope.availability_overridable, true) && asRecordList(product.availability_rules).length > 0) {
      forbidden.push({productId, field: 'availability_rules'})
    }
  })
  if (forbidden.length) {
    throw new HttpError(409, 'STORE_MENU_OVERRIDE_SCOPE_VIOLATION', '门店菜单覆盖字段超出品牌菜单允许范围', {
      brandMenuId: input.brandMenu.entityId,
      fields: forbidden,
    })
  }
}

const menuVersionControlledFields = new Set([
  'sections',
  'menu_name',
  'channel_type',
  'menu_type',
  'effective_date',
  'expire_date',
  'effective_from',
  'effective_to',
  'allow_store_override',
  'override_scope',
  'brand_menu_id',
  'inherit_mode',
])

const assertMenuVersionControlledUpdate = (input: {
  entityType: DomainEntity
  entityId: string
  current: AggregateRow
  inputData: Record<string, unknown>
}) => {
  if (input.entityType !== 'brand_menu' && input.entityType !== 'menu_catalog') {
    return
  }
  const lockedStatuses = input.entityType === 'brand_menu'
    ? new Set(['APPROVED', 'ACTIVE'])
    : new Set(['ACTIVE', 'INVALID', 'ROLLED_BACK'])
  if (!lockedStatuses.has(input.current.status)) {
    return
  }
  const changedFields = Object.keys(input.inputData)
    .filter(field => menuVersionControlledFields.has(field))
    .filter(field => normalizeComparable(input.inputData[field]) !== normalizeComparable(asRecord(input.current.payload.data)[field]))
  if (changedFields.length === 0) {
    return
  }
  throw new HttpError(409, 'MENU_VERSION_IMMUTABLE', '已批准或已发布的菜单是签署/投射快照，不能原地修改；请基于 parent_menu_id 创建新版本', {
    entityType: input.entityType,
    entityId: input.entityId,
    fields: changedFields,
  })
}

const normalizedMenuConflictKey = (data: Record<string, unknown>) =>
  [
    asString(data.store_id, ''),
    asString(data.menu_type, 'FULL_DAY').toUpperCase(),
    asString(data.channel_type, 'ALL').toUpperCase(),
  ].join('::')

const menuTimeSlotOverlaps = (left: Record<string, unknown>, right: Record<string, unknown>) => {
  const leftType = asString(left.menu_type, 'FULL_DAY').toUpperCase()
  const rightType = asString(right.menu_type, 'FULL_DAY').toUpperCase()
  if (leftType !== 'TIME_SLOT' || rightType !== 'TIME_SLOT') {
    return true
  }
  return timeRangesOverlap(left.time_slot_start ?? asRecord(left.time_slot).start, left.time_slot_end ?? asRecord(left.time_slot).end, right.time_slot_start ?? asRecord(right.time_slot).start, right.time_slot_end ?? asRecord(right.time_slot).end)
}

const assertPriceRuleSemantics = (data: Record<string, unknown>) => {
  const priceType = asString(data.price_type, 'FIXED').toUpperCase()
  const priceValue = asNumber(data.price_value ?? data.price ?? data.discount_value ?? data.price_delta, 0)
  if (priceType === 'FIXED' && priceValue <= 0) {
    throw new HttpError(400, 'INVALID_PRICE_RULE_VALUE', '固定价格必须大于 0')
  }
  if (priceValue < 0) {
    throw new HttpError(400, 'INVALID_PRICE_RULE_VALUE', '价格规则金额或折扣值不能为负数')
  }
  if (priceType === 'DISCOUNT_RATE' && (priceValue <= 0 || priceValue > 1)) {
    throw new HttpError(400, 'INVALID_PRICE_RULE_VALUE', '折扣率必须大于 0 且不超过 1')
  }
  const start = asOptionalString(data.effective_from)
  const end = asOptionalString(data.effective_to)
  if (start && end && Date.parse(start) >= Date.parse(end)) {
    throw new HttpError(400, 'INVALID_PRICE_RULE_DATE_RANGE', '价格规则生效时间必须早于失效时间')
  }
  const slotStart = asOptionalString(data.time_slot_start ?? asRecord(data.time_slot).start)
  const slotEnd = asOptionalString(data.time_slot_end ?? asRecord(data.time_slot).end)
  const slotStartMinutes = parseTimeToMinutes(slotStart)
  const slotEndMinutes = parseTimeToMinutes(slotEnd)
  if ((slotStart || slotEnd) && (slotStartMinutes === null || slotEndMinutes === null || slotStartMinutes >= slotEndMinutes)) {
    throw new HttpError(400, 'INVALID_PRICE_RULE_TIME_SLOT', '价格规则时段格式错误或开始时间不早于结束时间')
  }
  asStringList(data.days_of_week).forEach(day => {
    const dayNumber = asNumber(day, 0)
    if (dayNumber < 1 || dayNumber > 7) {
      throw new HttpError(400, 'INVALID_PRICE_RULE_DAY_OF_WEEK', '价格规则生效星期必须在 1-7 之间')
    }
  })
}

const assertAvailabilityRuleSemantics = (data: Record<string, unknown>) => {
  const start = asOptionalString(data.effective_from)
  const end = asOptionalString(data.effective_to)
  if (start && Number.isNaN(Date.parse(start))) {
    throw new HttpError(400, 'INVALID_AVAILABILITY_RULE_DATE_RANGE', '可售规则生效时间格式错误')
  }
  if (end && Number.isNaN(Date.parse(end))) {
    throw new HttpError(400, 'INVALID_AVAILABILITY_RULE_DATE_RANGE', '可售规则失效时间格式错误')
  }
  if (start && end && Date.parse(start) >= Date.parse(end)) {
    throw new HttpError(400, 'INVALID_AVAILABILITY_RULE_DATE_RANGE', '可售规则生效时间必须早于失效时间')
  }

  const ruleType = asString(data.rule_type, 'MANUAL').toUpperCase()
  const ruleConfig = asRecord(data.rule_config)
  if (ruleType === 'TIME_SLOT') {
    const timeSlots = asRecordList(ruleConfig.allowed_time_slots ?? ruleConfig.time_slots)
    const slots = timeSlots.length
      ? timeSlots
      : [ruleConfig].filter(slot => asOptionalString(slot.start_time ?? slot.start) || asOptionalString(slot.end_time ?? slot.end))
    if (slots.length === 0) {
      throw new HttpError(400, 'AVAILABILITY_TIME_SLOT_REQUIRED', '时段可售规则必须维护至少一个时段')
    }
    slots.forEach((slot, index) => {
      const slotStart = slot.start_time ?? slot.start
      const slotEnd = slot.end_time ?? slot.end
      const startMinutes = parseTimeToMinutes(slotStart)
      const endMinutes = parseTimeToMinutes(slotEnd)
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        throw new HttpError(400, 'INVALID_AVAILABILITY_TIME_SLOT', '可售规则时段格式错误或开始时间不早于结束时间', {slotIndex: index})
      }
      asStringList(slot.days_of_week).forEach(day => {
        const dayNumber = asNumber(day, 0)
        if (dayNumber < 1 || dayNumber > 7) {
          throw new HttpError(400, 'INVALID_AVAILABILITY_DAY_OF_WEEK', '可售规则星期必须在 1-7 之间', {slotIndex: index})
        }
      })
    })
  }
  if (ruleType === 'QUOTA') {
    const quota = asNullableNumber(ruleConfig.daily_quota ?? ruleConfig.quota_limit)
    if (quota !== null && quota <= 0) {
      throw new HttpError(400, 'INVALID_AVAILABILITY_QUOTA', '限量规则的数量必须大于 0')
    }
  }
}

const assertStoreOperatingConfigSemantics = (data: Record<string, unknown>) => {
  if (asNumber(data.max_concurrent_orders, 0) < 0) {
    throw new HttpError(400, 'INVALID_MAX_CONCURRENT_ORDERS', '渠道入口容量上限不能为负数')
  }
  if (asNumber(data.accept_timeout_seconds, 0) <= 0) {
    throw new HttpError(400, 'INVALID_ACCEPT_TIMEOUT', '渠道入口确认等待时间必须大于 0')
  }
  if (asNumber(data.preparation_buffer_minutes, 0) < 0) {
    throw new HttpError(400, 'INVALID_PREPARATION_BUFFER', '备餐缓冲时间不能为负数')
  }
  asRecordList(data.operating_hours).forEach(day => {
    const slots = asRecordList(day.time_slots)
    slots.forEach((slot, index) => {
      const start = parseTimeToMinutes(slot.start_time)
      const end = parseTimeToMinutes(slot.end_time)
      if (start === null || end === null || start >= end) {
        throw new HttpError(400, 'INVALID_OPERATING_HOURS', '营业时段格式错误或开始时间不早于结束时间', {dayOfWeek: day.day_of_week, slotIndex: index})
      }
      slots.slice(index + 1).forEach((other, otherIndex) => {
        if (timeRangesOverlap(slot.start_time, slot.end_time, other.start_time, other.end_time)) {
          throw new HttpError(409, 'OPERATING_HOURS_OVERLAP', '同一天的营业时段不能重叠', {
            dayOfWeek: day.day_of_week,
            slotIndex: index,
            otherSlotIndex: index + otherIndex + 1,
          })
        }
      })
    })
  })
  asRecordList(data.extra_charge_rules).forEach((rule, index) => {
    if (asNumber(rule.calc_amount, 0) < 0) {
      throw new HttpError(400, 'INVALID_EXTRA_CHARGE_AMOUNT', '附加费金额不能为负数', {index})
    }
  })
}

const normalizeProductType = (value: unknown) => {
  const productType = asString(value, 'SINGLE').toUpperCase()
  return productType === 'STANDARD' ? 'SINGLE' : productType
}

const normalizePriceType = (value: unknown) => {
  const priceType = asString(value, 'FIXED').toUpperCase()
  if (priceType === 'STANDARD') return 'FIXED'
  if (priceType === 'MEMBER') return 'MEMBER_PRICE'
  return priceType
}

const findBrandCodeDuplicate = (input: {
  sandboxId: string
  brandId: string
  platformId: string
  brandCode: string
}) => listRowsByEntityType('brand', input.sandboxId)
  .map(toAggregateRow)
  .find(item => {
    const data = asRecord(item.payload.data)
    return item.entityId !== input.brandId
      && asString(data.platform_id, item.naturalScopeKey) === input.platformId
      && asString(data.brand_code) === input.brandCode
  })

const assertBrandConstraints = (data: Record<string, unknown>) => {
  const standardMenuEnabled = asBoolean(data.standard_menu_enabled, false)
  const standardPricingLocked = asBoolean(data.standard_pricing_locked, false)
  const erpIntegrationEnabled = asBoolean(data.erp_integration_enabled, false)
  if (standardPricingLocked && !standardMenuEnabled) {
    throw new HttpError(400, 'BRAND_PRICING_LOCK_REQUIRES_STANDARD_MENU', '锁定定价需要先启用标准菜单')
  }
  if (erpIntegrationEnabled && !asOptionalString(data.erp_api_endpoint)) {
    throw new HttpError(400, 'BRAND_ERP_ENDPOINT_REQUIRED', '启用 ERP 集成时必须填写 API 地址')
  }
}

const normalizeContractStatus = (value: unknown, fallback = 'PENDING') => {
  const status = asString(value, fallback).toUpperCase()
  if (status === 'ACTIVE') return 'ACTIVE'
  if (status === 'EXPIRED') return 'EXPIRED'
  if (status === 'TERMINATED') return 'TERMINATED'
  return 'PENDING'
}

type EffectiveGrant = {
  sourceType: 'USER_ROLE_BINDING' | 'GROUP_ROLE_BINDING'
  sourceId: string
  roleId: string
  roleCode: string
  permissionIds: string[]
  permissionCodes: string[]
  scopeType: string
  scopeKey: string
  policyEffect: string
}

const buildEffectiveGrant = (
  binding: AggregateRow,
  sandboxId: string,
  sourceType: EffectiveGrant['sourceType'],
): EffectiveGrant | null => {
  const data = asRecord(binding.payload.data)
  const role = findAggregateRow('role', asString(data.role_id), sandboxId)
  if (!role || role.status !== 'ACTIVE') {
    return null
  }
  const roleData = asRecord(role.payload.data)
  const scope = bindingScopeForData(data, binding.naturalScopeType, binding.naturalScopeKey)
  return {
    sourceType,
    sourceId: binding.entityId,
    roleId: role.entityId,
    roleCode: asString(roleData.role_code, role.entityId),
    permissionIds: getRolePermissionIds(role),
    permissionCodes: getRolePermissionCodes(role, sandboxId),
    scopeType: asString(scope.scope_type, binding.naturalScopeType),
    scopeKey: asString(scope.scope_key, binding.naturalScopeKey),
    policyEffect: asString(data.policy_effect, 'ALLOW'),
  }
}

const getUserEffectiveGrants = (userId: string, sandboxId: string): EffectiveGrant[] => [
  ...getActiveDirectRoleBindingsForUser(userId, sandboxId)
    .map(binding => buildEffectiveGrant(binding, sandboxId, 'USER_ROLE_BINDING')),
  ...getActiveGroupRoleBindingsForUser(userId, sandboxId)
    .map(binding => buildEffectiveGrant(binding, sandboxId, 'GROUP_ROLE_BINDING')),
].filter((grant): grant is EffectiveGrant => Boolean(grant))

const assertNoSodViolations = (input: {
  userId: string
  sandboxId: string
  candidateGrants: EffectiveGrant[]
}) => {
  const grants = [
    ...getUserEffectiveGrants(input.userId, input.sandboxId),
    ...input.candidateGrants,
  ].filter(grant => grant.policyEffect !== 'DENY')

  if (grants.length < 2) {
    return
  }

  listRowsByEntityType('separation_of_duty_rule', input.sandboxId)
    .map(toAggregateRow)
    .filter(rule => rule.status === 'ACTIVE')
    .filter(rule => asBoolean(asRecord(rule.payload.data).is_active, true))
    .forEach(rule => {
      const ruleData = asRecord(rule.payload.data)
      const conflictingRoleCodes = asStringList(ruleData.conflicting_role_codes)
      const conflictingPermissionCodes = asStringList(ruleData.conflicting_perm_codes)
      if (conflictingRoleCodes.length < 2 && conflictingPermissionCodes.length < 2) {
        return
      }
      const scopeType = asString(ruleData.scope_type, 'PLATFORM')
      const relevantGrants = scopeType === 'STORE'
        ? grants.filter(grant => grant.scopeType === 'STORE')
        : grants
      const scopeGroups = new Map<string, EffectiveGrant[]>()
      relevantGrants.forEach(grant => {
        const scopeKey = scopeType === 'STORE' ? grant.scopeKey : 'PLATFORM'
        scopeGroups.set(scopeKey, [...(scopeGroups.get(scopeKey) ?? []), grant])
      })
      scopeGroups.forEach(scopeGrants => {
        const roleCodes = new Set(scopeGrants.map(grant => grant.roleCode))
        const permissionCodes = new Set(scopeGrants.flatMap(grant => grant.permissionCodes))
        const matchedRoles = conflictingRoleCodes.filter(roleCode => roleCodes.has(roleCode))
        const matchedPermissions = conflictingPermissionCodes.filter(permissionCode => permissionCodes.has(permissionCode))
        if (matchedRoles.length >= 2 || matchedPermissions.length >= 2) {
          throw new HttpError(409, 'SOD_RULE_VIOLATION', '授权会触发职责分离规则冲突', {
            userId: input.userId,
            ruleId: rule.entityId,
            ruleName: asOptionalString(ruleData.rule_name) ?? rule.title,
            matchedRoles,
            matchedPermissions,
          })
        }
      })
    })
}

const buildCandidateGrantFromData = (input: {
  data: Record<string, unknown>
  entityId: string
  naturalScopeType: string
  naturalScopeKey: string
  sandboxId: string
  sourceType: EffectiveGrant['sourceType']
}) => {
  const role = findAggregateRow('role', asString(input.data.role_id), input.sandboxId)
  if (!role || role.status !== 'ACTIVE') {
    return null
  }
  const roleData = asRecord(role.payload.data)
  const scope = bindingScopeForData(input.data, input.naturalScopeType, input.naturalScopeKey)
  return {
    sourceType: input.sourceType,
    sourceId: input.entityId,
    roleId: role.entityId,
    roleCode: asString(roleData.role_code, role.entityId),
    permissionIds: getRolePermissionIds(role),
    permissionCodes: getRolePermissionCodes(role, input.sandboxId),
    scopeType: asString(scope.scope_type, input.naturalScopeType),
    scopeKey: asString(scope.scope_key, input.naturalScopeKey),
    policyEffect: asString(input.data.policy_effect, 'ALLOW'),
  } satisfies EffectiveGrant
}

const assertEntityConstraints = (input: {
  entityType: DomainEntity
  entityId: string
  data: Record<string, unknown>
  naturalScopeType: string
  naturalScopeKey: string
  sandboxId: string
}) => {
  const data = input.data
  if (input.entityType === 'identity_provider_config') {
    const platformId = asString(data.platform_id, input.naturalScopeKey)
    assertPlatformExists(platformId, input.sandboxId)
    const idpType = asString(data.idp_type, 'LOCAL')
    const applicableUserTypes = asStringList(data.applicable_user_types)
    if (applicableUserTypes.length === 0) {
      throw new HttpError(400, 'IDP_USER_TYPES_REQUIRED', '身份提供者必须至少选择一个适用用户类型')
    }
    if (asBoolean(data.sync_enabled, false) && !asOptionalString(data.sync_cron)) {
      throw new HttpError(400, 'IDP_SYNC_CRON_REQUIRED', '启用同步时必须配置同步周期')
    }
    if (idpType === 'LDAP') {
      assertRequiredFields(data, ['ldap_url', 'base_dn', 'bind_dn', 'bind_password_encrypted'], 'LDAP_CONFIG_REQUIRED', 'LDAP 身份源配置不完整')
    }
    if (idpType === 'OIDC') {
      assertRequiredFields(data, ['issuer_url', 'client_id', 'client_secret_encrypted'], 'OIDC_CONFIG_REQUIRED', 'OIDC 身份源配置不完整')
    }
    if (idpType === 'SAML') {
      assertRequiredFields(data, ['issuer_url', 'client_id', 'client_secret_encrypted'], 'SAML_CONFIG_REQUIRED', 'SAML 身份源配置不完整')
    }
    if (idpType === 'WECHAT_WORK' || idpType === 'DINGTALK') {
      assertRequiredFields(data, ['corp_id', 'agent_id', 'app_secret_encrypted'], 'ENTERPRISE_IDP_CONFIG_REQUIRED', '企业身份源配置不完整')
    }
    const overlappingIdp = listRowsByEntityType('identity_provider_config', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        if (item.entityId === input.entityId || item.status !== 'ACTIVE') return false
        if (asString(itemData.platform_id) !== platformId || asString(itemData.idp_type) !== idpType) return false
        const otherUserTypes = new Set(asStringList(itemData.applicable_user_types))
        return applicableUserTypes.some(userType => otherUserTypes.has(userType))
      })
    if (overlappingIdp) {
      throw new HttpError(409, 'IDP_ROUTE_OVERLAP', '同一集团、同一身份源类型下，适用用户类型不能重叠', {
        overlappingIdpId: overlappingIdp.entityId,
        applicableUserTypes,
      })
    }
  }

  if (input.entityType === 'permission') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const permissionCode = asString(data.permission_code)
    if (!/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(permissionCode)) {
      throw new HttpError(400, 'INVALID_PERMISSION_CODE', '权限编码格式错误，应为 resource:action 格式')
    }
    const duplicate = listRowsByEntityType('permission', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        return item.entityId !== input.entityId
          && asString(itemData.permission_code) === permissionCode
          && asOptionalString(itemData.platform_id) === asOptionalString(data.platform_id)
      })
    if (duplicate) {
      throw new HttpError(409, 'PERMISSION_CODE_ALREADY_EXISTS', '权限编码已存在')
    }
    if (asString(data.permission_source ?? data.permission_type, 'SYSTEM') === 'PLATFORM_CUSTOM') {
      assertRequiredFields(data, ['platform_id', 'feature_flag'], 'CUSTOM_PERMISSION_FEATURE_REQUIRED', '自定义权限必须属于集团并关联功能点')
      const featureCode = asString(data.feature_flag)
      const feature = listRowsByEntityType('feature_point', input.sandboxId)
        .map(toAggregateRow)
        .find(item => asString(asRecord(item.payload.data).feature_code) === featureCode)
      if (!feature || feature.status !== 'ACTIVE') {
        throw new HttpError(409, 'FEATURE_POINT_NOT_ACTIVE', '功能点未启用，不能创建自定义权限', {featureCode})
      }
      if (!permissionFeatureEnabled({
        aggregateId: input.entityId,
        sandboxId: input.sandboxId,
        domain: 'iam',
        entityType: 'permission',
        entityId: input.entityId,
        naturalScopeType: input.naturalScopeType,
        naturalScopeKey: input.naturalScopeKey,
        title: asString(data.permission_name, input.entityId),
        status: 'ACTIVE',
        sourceRevision: 1,
        payload: {data},
        createdAt: now(),
        updatedAt: now(),
      }, input.sandboxId)) {
        throw new HttpError(409, 'FEATURE_SWITCH_DISABLED', '当前集团未开启该功能点，不能创建自定义权限', {featureCode})
      }
    }
    const parentPermissionId = asOptionalString(data.parent_permission_id)
    if (parentPermissionId && !findAggregateRow('permission', parentPermissionId, input.sandboxId)) {
      throw new HttpError(404, 'PARENT_PERMISSION_NOT_FOUND', '父权限不存在', {parentPermissionId})
    }
    const permissionGroupId = asOptionalString(data.permission_group_id)
    if (permissionGroupId) {
      const permissionGroup = findAggregateRow('permission_group', permissionGroupId, input.sandboxId)
      if (!permissionGroup) {
      throw new HttpError(404, 'PERMISSION_GROUP_NOT_FOUND', '权限分组不存在', {permissionGroupId})
      }
      assertEntityBelongsToPlatform(permissionGroup, platformId, 'PERMISSION_GROUP_PLATFORM_MISMATCH', '权限分组必须属于当前集团', input.sandboxId)
    }
  }

  if (input.entityType === 'permission_group') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const duplicate = findFieldDuplicate({
      entityType: 'permission_group',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'group_code',
      value: data.group_code,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'PERMISSION_GROUP_CODE_ALREADY_EXISTS', '权限分组编码已存在')
    }
    const parentGroupId = asOptionalString(data.parent_group_id)
    if (parentGroupId && !findAggregateRow('permission_group', parentGroupId, input.sandboxId)) {
      throw new HttpError(404, 'PARENT_PERMISSION_GROUP_NOT_FOUND', '父权限分组不存在', {parentGroupId})
    }
  }

  if (input.entityType === 'role_template') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const duplicate = findFieldDuplicate({
      entityType: 'role_template',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'template_code',
      value: data.template_code,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'ROLE_TEMPLATE_CODE_ALREADY_EXISTS', '角色模板编码已存在')
    }
    const templatePermissions = asStringList(data.base_permission_ids).map(permissionId => {
      const permission = findAggregateRow('permission', permissionId, input.sandboxId)
      if (!permission) return {permissionId, permission: null}
      assertEntityBelongsToPlatform(permission, platformId, 'ROLE_TEMPLATE_PERMISSION_PLATFORM_MISMATCH', '角色模板基础权限必须属于当前集团', input.sandboxId)
      return {permissionId, permission}
    })
    const missingPermissionIds = templatePermissions.filter(item => !item.permission).map(item => item.permissionId)
    if (missingPermissionIds.length) throw new HttpError(404, 'ROLE_TEMPLATE_PERMISSION_NOT_FOUND', '角色模板包含不存在的权限', {permissionIds: missingPermissionIds})
  }

  if (input.entityType === 'feature_point') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const duplicate = findFieldDuplicate({
      entityType: 'feature_point',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'feature_code',
      value: data.feature_code,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'FEATURE_CODE_ALREADY_EXISTS', '功能点编码已存在')
    }
  }

  if (input.entityType === 'platform_feature_switch') {
    const platformId = asString(data.platform_id)
    const featureCode = asString(data.feature_code)
    if (!findAggregateRow('platform', platformId, input.sandboxId)) {
      throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
    }
    const feature = listRowsByEntityType('feature_point', input.sandboxId)
      .map(toAggregateRow)
      .find(item => asString(asRecord(item.payload.data).feature_code) === featureCode)
    if (!feature) {
      throw new HttpError(404, 'FEATURE_POINT_NOT_FOUND', '功能点不存在', {featureCode})
    }
    const duplicate = listRowsByEntityType('platform_feature_switch', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        return item.entityId !== input.entityId
          && asString(itemData.platform_id) === platformId
          && asString(itemData.feature_code) === featureCode
      })
    if (duplicate) {
      throw new HttpError(409, 'PLATFORM_FEATURE_SWITCH_ALREADY_EXISTS', '该集团的功能点开关已存在')
    }
  }

  if (input.entityType === 'region') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    if (!findAggregateRow('platform', platformId, input.sandboxId)) {
      throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
    }
    const duplicate = findFieldDuplicate({
      entityType: 'region',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'region_code',
      value: data.region_code,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'REGION_CODE_ALREADY_EXISTS', '大区编码在当前集团内已存在')
    }
    const parentRegionId = asOptionalString(data.parent_region_id)
    if (parentRegionId) {
      const parent = findAggregateRow('region', parentRegionId, input.sandboxId)
      if (!parent || parent.status !== 'ACTIVE') {
        throw new HttpError(404, 'PARENT_REGION_NOT_FOUND', '父级大区不存在或未启用', {parentRegionId})
      }
      if (asString(asRecord(parent.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'PARENT_REGION_PLATFORM_MISMATCH', '父级大区不属于当前集团', {parentRegionId, platformId})
      }
      assertRegionParentDoesNotCycle({
        regionId: input.entityId,
        parentRegionId,
        sandboxId: input.sandboxId,
      })
    }
  }

  if (input.entityType === 'project') {
    const platformId = asString(data.platform_id, identity.platformId)
    if (!findAggregateRow('platform', platformId, input.sandboxId)) {
      throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
    }
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'project_business_modes',
      value: data.business_mode,
      field: 'business_mode',
    })
    const regionId = asNullableString(data.region_id)
    if (regionId) {
      const region = findAggregateRow('region', regionId, input.sandboxId)
      if (!region || region.status !== 'ACTIVE') {
        if (isLegacyRegionReference(regionId)) {
          assertProjectChannelConfigHasNoSecrets(data.channel_shop_config)
          return
        }
        assertPlatformCatalogValue({
          sandboxId: input.sandboxId,
          platformId,
          catalogKey: 'regions',
          value: regionId,
          field: 'region_id',
        })
      } else {
        if (asString(asRecord(region.payload.data).platform_id) !== platformId) {
          throw new HttpError(409, 'PROJECT_REGION_PLATFORM_MISMATCH', '项目所属大区必须属于当前集团', {regionId, platformId})
        }
      }
    }
    assertProjectChannelConfigHasNoSecrets(data.channel_shop_config)
  }

  if (input.entityType === 'tenant') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    if (!findAggregateRow('platform', platformId, input.sandboxId)) {
      throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
    }
    const tenantType = asString(data.tenant_type, 'CHAIN_BRAND').toUpperCase()
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'tenant_types',
      value: tenantType,
      field: 'tenant_type',
    })
    const businessModel = asString(data.business_model, 'MIXED').toUpperCase()
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'tenant_business_models',
      value: businessModel,
      field: 'business_model',
    })
  }

  if (input.entityType === 'brand') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    if (!findAggregateRow('platform', platformId, input.sandboxId)) {
      throw new HttpError(404, 'PLATFORM_NOT_FOUND', '集团不存在', {platformId})
    }
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'brand_categories',
      value: data.brand_category,
      field: 'brand_category',
    })
    if (Object.prototype.hasOwnProperty.call(data, 'tenant_id')) {
      throw new HttpError(400, 'BRAND_TENANT_FORBIDDEN', '品牌直属集团，不归属租户；门店通过合同关联租户与品牌')
    }
    assertBrandConstraints(data)
  }

  if (input.entityType === 'user') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const userType = asString(data.user_type, 'STORE_STAFF')
    const identitySource = asString(data.identity_source, 'LOCAL').toUpperCase()
    const hasPasswordHash = Boolean(asOptionalString(data.password_hash))
    const hasExternalUserId = Boolean(asOptionalString(data.external_user_id))
    if (userType !== 'API_CLIENT' && !asOptionalString(data.email) && !asOptionalString(data.phone ?? data.mobile)) {
      throw new HttpError(400, 'USER_CONTACT_REQUIRED', '邮箱和手机号至少填写一个')
    }
    if (identitySource === 'LOCAL' && !hasPasswordHash) {
      throw new HttpError(400, 'LOCAL_USER_PASSWORD_REQUIRED', '本地用户必须保存密码哈希')
    }
    if (identitySource !== 'LOCAL') {
      if (hasPasswordHash) {
        throw new HttpError(400, 'EXTERNAL_USER_PASSWORD_FORBIDDEN', '外部身份源用户不能保存本地密码哈希')
      }
      if (!hasExternalUserId) {
        throw new HttpError(400, 'EXTERNAL_USER_ID_REQUIRED', '外部身份源用户必须保存外部用户 ID')
      }
    }
    if (asOptionalString(data.locked_until) && asString(data.status, 'ACTIVE') !== 'LOCKED') {
      throw new HttpError(400, 'LOCKED_UNTIL_REQUIRES_LOCKED_STATUS', '存在锁定截止时间时用户状态必须为 LOCKED')
    }
  }

  if (input.entityType === 'business_entity') {
    const tenantId = asString(data.tenant_id)
    const tenant = findAggregateRow('tenant', tenantId, input.sandboxId)
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new HttpError(409, 'TENANT_NOT_ACTIVE', '经营主体必须归属有效租户', {tenantId})
    }
    const platformId = asString(data.platform_id, asString(asRecord(tenant.payload.data).platform_id, identity.platformId))
    const creditCode = firstString(data.unified_social_credit_code, data.social_credit_code)
    const duplicateCreditCode = creditCode
      ? listRowsByEntityType('business_entity', input.sandboxId)
        .map(toAggregateRow)
        .find(item => {
          const itemData = asRecord(item.payload.data)
          return item.entityId !== input.entityId
            && asString(itemData.platform_id, platformId) === platformId
            && firstString(itemData.unified_social_credit_code, itemData.social_credit_code) === creditCode
        })
      : null
    if (duplicateCreditCode) {
      throw new HttpError(409, 'BUSINESS_ENTITY_CREDIT_CODE_ALREADY_EXISTS', '签约/结算主体统一社会信用代码在当前集团内已存在', {creditCode})
    }
    const taxRate = asNullableNumber(data.tax_rate)
    if (taxRate !== null && (taxRate < 0 || taxRate > 1)) {
      throw new HttpError(400, 'INVALID_BUSINESS_ENTITY_TAX_RATE', '税率必须在 0 到 1 之间')
    }
    const settlementDay = asNullableNumber(data.settlement_day)
    if (settlementDay !== null && (!Number.isInteger(settlementDay) || settlementDay < 1 || settlementDay > 31)) {
      throw new HttpError(400, 'INVALID_BUSINESS_ENTITY_SETTLEMENT_DAY', '结算日必须是 1 到 31 之间的整数')
    }
    if (asOptionalString(data.bank_account_no)) {
      throw new HttpError(400, 'BANK_ACCOUNT_NO_PLAINTEXT_FORBIDDEN', '不能保存银行账号明文，请只保存脱敏后的账号信息')
    }
  }

  if (input.entityType === 'store') {
    const projectId = asString(data.project_id)
    const project = findAggregateRow('project', projectId, input.sandboxId)
    if (!project || project.status !== 'ACTIVE') {
      throw new HttpError(409, 'PROJECT_NOT_OPERATING', '门店必须归属有效经营项目', {projectId})
    }
    const platformId = asString(data.platform_id, asString(asRecord(project.payload.data).platform_id, identity.platformId))
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'store_business_formats',
      value: data.business_format,
      field: 'business_format',
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'store_cooperation_modes',
      value: data.cooperation_mode,
      field: 'cooperation_mode',
    })
    assertPlatformCatalogValues({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'store_business_scenarios',
      values: data.business_scenarios ?? data.store_formats,
      field: 'business_scenarios',
      ownerEntityType: 'store',
      ownerId: input.entityId,
      ownerCatalog: data.metadata_catalog,
    })
    assertStoreSnapshotConsistency({storeId: input.entityId, data})
  }

  if (input.entityType === 'contract') {
    const platformId = asString(data.platform_id, identity.platformId)
    const contractNo = asString(data.contract_no ?? data.contract_code, input.entityId)
    const duplicate = findFieldDuplicate({
      entityType: 'contract',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'contract_no',
      value: contractNo,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'CONTRACT_NO_ALREADY_EXISTS', '合同编号在当前集团内已存在', {contractNo})
    }
    const storeId = asString(data.store_id)
    const tenantId = asString(data.tenant_id)
    const brandId = asString(data.brand_id)
    const entityId = asNullableString(data.entity_id)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    const tenant = findAggregateRow('tenant', tenantId, input.sandboxId)
    const brand = findAggregateRow('brand', brandId, input.sandboxId)
    const businessEntity = entityId ? findAggregateRow('business_entity', entityId, input.sandboxId) : null
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'STORE_NOT_AVAILABLE_FOR_CONTRACT', '合同必须关联有效门店', {storeId})
    }
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new HttpError(409, 'TENANT_NOT_ACTIVE', '合同乙方租户必须有效', {tenantId})
    }
    if (!brand || brand.status !== 'ACTIVE') {
      throw new HttpError(409, 'BRAND_NOT_ACTIVE', '合同乙方品牌必须有效', {brandId})
    }
    if (businessEntity && asString(asRecord(businessEntity.payload.data).tenant_id) !== tenantId) {
      throw new HttpError(409, 'BUSINESS_ENTITY_TENANT_MISMATCH', '合同乙方经营主体必须属于乙方租户', {entityId, tenantId})
    }
    assertDateRange(data.start_date, data.end_date)
  }

  if (input.entityType === 'table') {
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store) {
      throw new HttpError(404, 'STORE_NOT_FOUND', '桌台所属门店不存在', {storeId})
    }
    const storeData = asRecord(store.payload.data)
    const platformId = asString(data.platform_id, asString(storeData.platform_id, identity.platformId))
    const tableStatus = asString(data.table_status ?? data.status, 'AVAILABLE').toUpperCase()
    if (!tableMasterStatuses.has(tableStatus)) {
      throw new HttpError(400, 'INVALID_TABLE_STATUS', '桌台主数据只能维护启用或停用状态', {tableStatus})
    }
    const tableType = asString(data.table_type, 'HALL').toUpperCase()
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'table_types',
      value: tableType,
      field: 'table_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'table_areas',
      value: data.area,
      field: 'area',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    if (asNumber(data.capacity, 0) <= 0) {
      throw new HttpError(400, 'INVALID_TABLE_CAPACITY', '桌台容量必须大于 0')
    }
    if (asNullableNumber(data.minimum_spend) !== null && asNumber(data.minimum_spend, 0) < 0) {
      throw new HttpError(400, 'INVALID_TABLE_MINIMUM_SPEND', '桌台最低消费不能为负数')
    }
  }

  if (input.entityType === 'workstation') {
    const storeId = asString(data.store_id)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store) {
      throw new HttpError(404, 'STORE_NOT_FOUND', '工作站所属门店不存在', {storeId})
    }
    const storeData = asRecord(store.payload.data)
    const platformId = asString(data.platform_id, asString(storeData.platform_id, identity.platformId))
    const workstationType = asString(data.workstation_type, 'PRODUCTION').toUpperCase()
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'workstation_types',
      value: workstationType,
      field: 'workstation_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValues({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'production_categories',
      values: data.responsible_categories ?? data.category_codes,
      field: 'responsible_categories',
      ownerEntityType: 'brand',
      ownerId: asNullableString(storeData.brand_id),
    })
  }

  if (input.entityType === 'resource_tag') {
    const resourceType = asString(data.resource_type).toLowerCase()
    const resourceEntityType = knownTagResourceTypes[resourceType]
    const resourceId = asString(data.resource_id)
    if (resourceEntityType && !findAggregateRow(resourceEntityType, resourceId, input.sandboxId)) {
      throw new HttpError(404, 'TAG_RESOURCE_NOT_FOUND', '被打标资源不存在', {resourceType, resourceId})
    }
    const duplicate = listRowsByEntityType('resource_tag', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        return item.entityId !== input.entityId
          && asString(itemData.resource_type).toLowerCase() === resourceType
          && asString(itemData.resource_id) === resourceId
          && asString(itemData.tag_key) === asString(data.tag_key)
          && asString(itemData.tag_value) === asString(data.tag_value)
      })
    if (duplicate) {
      throw new HttpError(409, 'RESOURCE_TAG_ALREADY_EXISTS', '同一资源不能重复设置相同标签')
    }
  }

  if (input.entityType === 'principal_group') {
    const platformId = asString(data.platform_id, input.naturalScopeKey)
    assertPlatformExists(platformId, input.sandboxId)
    const duplicate = findFieldDuplicate({
      entityType: 'principal_group',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'group_code',
      value: data.group_code,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'PRINCIPAL_GROUP_CODE_ALREADY_EXISTS', '用户组编码在当前集团内已存在')
    }
    if (asString(data.group_type) === 'LDAP_SYNC' && !asOptionalString(data.ldap_group_dn)) {
      throw new HttpError(400, 'LDAP_GROUP_DN_REQUIRED', 'LDAP 同步组必须填写 LDAP 组 DN')
    }
    if (asString(data.group_type) === 'OIDC_CLAIM' && (!asOptionalString(data.oidc_claim_key) || !asOptionalString(data.oidc_claim_value))) {
      throw new HttpError(400, 'OIDC_CLAIM_REQUIRED', 'OIDC 声明组必须填写 claim 键和值')
    }
  }

  if (input.entityType === 'group_member') {
    const groupId = asString(data.group_id)
    const userId = asString(data.user_id)
    const group = findAggregateRow('principal_group', groupId, input.sandboxId)
    const user = findAggregateRow('user', userId, input.sandboxId)
    if (!group || group.status !== 'ACTIVE') {
      throw new HttpError(409, 'GROUP_NOT_ACTIVE', '用户组不存在或未启用', {groupId})
    }
    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(409, 'USER_NOT_ACTIVE', '用户不存在或未启用', {userId})
    }
    const groupPlatformId = asString(asRecord(group.payload.data).platform_id, group.naturalScopeKey)
    assertEntityBelongsToPlatform(user, groupPlatformId, 'GROUP_MEMBER_PLATFORM_MISMATCH', '用户组成员必须属于同一集团', input.sandboxId)
    const duplicate = listRowsByEntityType('group_member', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        return item.entityId !== input.entityId
          && item.status === 'ACTIVE'
          && asString(itemData.group_id) === groupId
          && asString(itemData.user_id) === userId
      })
    if (duplicate) {
      throw new HttpError(409, 'GROUP_MEMBER_ALREADY_EXISTS', '用户已经在该用户组中')
    }
    const groupGrants = listRowsByEntityType('group_role_binding', input.sandboxId)
      .map(toAggregateRow)
      .filter(binding => bindingIsEffective(binding))
      .filter(binding => asString(asRecord(binding.payload.data).group_id) === groupId)
      .map(binding => buildEffectiveGrant(binding, input.sandboxId, 'GROUP_ROLE_BINDING'))
      .filter((grant): grant is EffectiveGrant => Boolean(grant))
    assertNoSodViolations({
      userId,
      sandboxId: input.sandboxId,
      candidateGrants: groupGrants,
    })
  }

  if (input.entityType === 'user_role_binding' || input.entityType === 'group_role_binding') {
    const roleId = asString(data.role_id)
    const role = findAggregateRow('role', roleId, input.sandboxId)
    if (!role || role.status !== 'ACTIVE') {
      throw new HttpError(409, 'ROLE_NOT_ACTIVE', '角色不存在或已停用，无法授权', {roleId})
    }
    const bindingPlatformId = asString(data.platform_id, asOptionalString(asRecord(role.payload.data).platform_id) ?? role.naturalScopeKey)
    assertEntityBelongsToPlatform(role, bindingPlatformId, 'ROLE_BINDING_PLATFORM_MISMATCH', '授权角色必须属于当前集团', input.sandboxId)
    const rolePermissionCodes = getRolePermissionCodes(role, input.sandboxId)
    const highRiskPolicies = listRowsByEntityType('high_risk_permission_policy', input.sandboxId)
      .map(toAggregateRow)
      .filter(policy => policy.status === 'ACTIVE')
      .map(policy => asRecord(policy.payload.data))
      .filter(policy => rolePermissionCodes.includes(asString(policy.permission_code)))
    const effectiveTo = asOptionalString(data.effective_to)
    highRiskPolicies.forEach(policy => {
      if (asBoolean(policy.require_approval, false) && !asOptionalString(asRecord(data.policy_conditions).approval_id)) {
        throw new HttpError(409, 'HIGH_RISK_APPROVAL_REQUIRED', '高风险权限授权需要审批', {permissionCode: asString(policy.permission_code)})
      }
      const maxDurationDays = asNullableNumber(policy.max_duration_days)
      if (maxDurationDays !== null) {
        if (!effectiveTo) {
          throw new HttpError(409, 'HIGH_RISK_DURATION_REQUIRED', '高风险权限必须设置授权截止时间', {permissionCode: asString(policy.permission_code)})
        }
        const fromTime = Date.parse(asString(data.effective_from, new Date(now()).toISOString()))
        const toTime = Date.parse(effectiveTo)
        const maxMs = maxDurationDays * 24 * 60 * 60 * 1000
        if (Number.isFinite(fromTime) && Number.isFinite(toTime) && toTime - fromTime > maxMs) {
          throw new HttpError(409, 'HIGH_RISK_DURATION_EXCEEDED', '高风险权限授权时长超过策略限制', {
            permissionCode: asString(policy.permission_code),
            maxDurationDays,
          })
        }
      }
    })
  }

  if (input.entityType === 'group_role_binding') {
    const groupId = asString(data.group_id)
    const group = findAggregateRow('principal_group', groupId, input.sandboxId)
    if (!group || group.status !== 'ACTIVE') {
      throw new HttpError(409, 'GROUP_NOT_ACTIVE', '用户组不存在或未启用，无法授权', {groupId})
    }
    const groupPlatformId = asString(asRecord(group.payload.data).platform_id, group.naturalScopeKey)
    assertEntityBelongsToPlatform(findAggregateRow('role', asString(data.role_id), input.sandboxId)!, groupPlatformId, 'GROUP_ROLE_BINDING_PLATFORM_MISMATCH', '用户组授权角色必须属于同一集团', input.sandboxId)
    const scope = bindingScopeForData(data, input.naturalScopeType, input.naturalScopeKey)
    const duplicate = listRowsByEntityType('group_role_binding', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        const itemScope = bindingScopeForData(itemData, item.naturalScopeType, item.naturalScopeKey)
        return item.entityId !== input.entityId
          && item.status === 'ACTIVE'
          && asString(itemData.group_id) === groupId
          && asString(itemData.role_id) === asString(data.role_id)
          && asString(itemData.policy_effect, 'ALLOW') === asString(data.policy_effect, 'ALLOW')
          && resourceScopesEqual(itemScope, scope)
      })
    if (duplicate) {
      throw new HttpError(409, 'GROUP_ROLE_BINDING_ALREADY_EXISTS', '该用户组在相同范围内已有该角色')
    }
    const candidateGrant = buildCandidateGrantFromData({
      data,
      entityId: input.entityId,
      naturalScopeType: input.naturalScopeType,
      naturalScopeKey: input.naturalScopeKey,
      sandboxId: input.sandboxId,
      sourceType: 'GROUP_ROLE_BINDING',
    })
    if (candidateGrant) {
      listRowsByEntityType('group_member', input.sandboxId)
        .map(toAggregateRow)
        .filter(member => member.status === 'ACTIVE')
        .filter(member => asString(asRecord(member.payload.data).group_id) === groupId)
        .forEach(member => {
          assertNoSodViolations({
            userId: asString(asRecord(member.payload.data).user_id),
            sandboxId: input.sandboxId,
            candidateGrants: [candidateGrant],
          })
        })
    }
  }

  if (input.entityType === 'user_role_binding') {
    const userId = asString(data.user_id)
    const user = findAggregateRow('user', userId, input.sandboxId)
    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(409, 'USER_NOT_ACTIVE', '用户不存在或未启用，无法授权', {userId})
    }
    const userData = asRecord(user.payload.data)
    const userStoreId = asOptionalString(userData.store_id) ?? (user.naturalScopeType === 'STORE' ? user.naturalScopeKey : undefined)
    const userStorePlatformId = userStoreId
      ? asOptionalString(readAggregateData(findAggregateRow('store', userStoreId, input.sandboxId)).platform_id)
      : undefined
    const userPlatformId = asString(
      userData.platform_id,
      userStorePlatformId ?? (user.naturalScopeType === 'PLATFORM' ? user.naturalScopeKey : identity.platformId),
    )
    assertEntityBelongsToPlatform(findAggregateRow('role', asString(data.role_id), input.sandboxId)!, userPlatformId, 'USER_ROLE_BINDING_PLATFORM_MISMATCH', '用户授权角色必须属于同一集团', input.sandboxId)
    const scope = bindingScopeForData(data, input.naturalScopeType, input.naturalScopeKey)
    const duplicate = listRowsByEntityType('user_role_binding', input.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        const itemScope = bindingScopeForData(itemData, item.naturalScopeType, item.naturalScopeKey)
        return item.entityId !== input.entityId
          && item.status === 'ACTIVE'
          && asString(itemData.user_id) === userId
          && asString(itemData.role_id) === asString(data.role_id)
          && asString(itemData.policy_effect, 'ALLOW') === asString(data.policy_effect, 'ALLOW')
          && resourceScopesEqual(itemScope, scope)
      })
    if (duplicate) {
      throw new HttpError(409, 'USER_ROLE_BINDING_ALREADY_EXISTS', '该用户在相同范围内已有该角色')
    }
    const candidateGrant = buildCandidateGrantFromData({
      data,
      entityId: input.entityId,
      naturalScopeType: input.naturalScopeType,
      naturalScopeKey: input.naturalScopeKey,
      sandboxId: input.sandboxId,
      sourceType: 'USER_ROLE_BINDING',
    })
    if (candidateGrant) {
      assertNoSodViolations({
        userId,
        sandboxId: input.sandboxId,
        candidateGrants: [candidateGrant],
      })
    }
  }

  if (input.entityType === 'authorization_session') {
    const userId = asString(data.user_id)
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const user = findAggregateRow('user', userId, input.sandboxId)
    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(409, 'AUTH_SESSION_USER_NOT_ACTIVE', '授权会话用户不存在或未启用', {userId})
    }
    assertEntityBelongsToPlatform(user, platformId, 'AUTH_SESSION_USER_PLATFORM_MISMATCH', '授权会话用户必须属于当前集团', input.sandboxId)
  const activeUserGroupIds = new Set(listRowsByEntityType('group_member', input.sandboxId)
      .map(toAggregateRow)
      .filter(member => member.status === 'ACTIVE')
      .filter(member => asString(asRecord(member.payload.data).user_id) === userId)
      .map(member => asString(asRecord(member.payload.data).group_id))
      .filter(Boolean))
    const invalidBindingIds = asStringList(data.activated_binding_ids).filter(bindingId => {
      const userBinding = findAggregateRow('user_role_binding', bindingId, input.sandboxId)
      if (userBinding && userBinding.status === 'ACTIVE') {
        const bindingData = asRecord(userBinding.payload.data)
        const bindingPlatformId = asOptionalString(bindingData.platform_id) ?? userBinding.naturalScopeKey
        return asString(bindingData.user_id) !== userId || bindingPlatformId !== platformId
      }
      const groupBinding = findAggregateRow('group_role_binding', bindingId, input.sandboxId)
      if (groupBinding && groupBinding.status === 'ACTIVE') {
        const bindingData = asRecord(groupBinding.payload.data)
        const bindingPlatformId = asOptionalString(bindingData.platform_id) ?? groupBinding.naturalScopeKey
        return bindingPlatformId !== platformId || !activeUserGroupIds.has(asString(bindingData.group_id))
      }
      return true
    })
    if (invalidBindingIds.length) {
      throw new HttpError(404, 'AUTH_SESSION_BINDING_NOT_FOUND', '授权会话激活授权不存在、未启用或不属于该用户', {bindingIds: invalidBindingIds})
    }
  }

  if (input.entityType === 'separation_of_duty_rule') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const conflictCodes = [
      ...asStringList(data.conflicting_role_codes),
      ...asStringList(data.conflicting_perm_codes),
    ]
    if (asBoolean(data.is_active, true) && conflictCodes.length < 2) {
      throw new HttpError(400, 'SOD_RULE_CONFLICTS_REQUIRED', '职责分离规则至少需要两个冲突角色或权限')
    }
    const missingRoleCodes = asStringList(data.conflicting_role_codes)
      .filter(roleCode => !findActiveByField('role', input.sandboxId, 'role_code', roleCode, platformId))
    if (missingRoleCodes.length) {
      throw new HttpError(404, 'SOD_RULE_ROLE_NOT_FOUND', '职责分离规则包含不存在的角色编码', {roleCodes: missingRoleCodes})
    }
    const missingPermissionCodes = asStringList(data.conflicting_perm_codes)
      .filter(permissionCode => !findActiveByField('permission', input.sandboxId, 'permission_code', permissionCode, platformId))
    if (missingPermissionCodes.length) {
      throw new HttpError(404, 'SOD_RULE_PERMISSION_NOT_FOUND', '职责分离规则包含不存在的权限编码', {permissionCodes: missingPermissionCodes})
    }
  }

  if (input.entityType === 'high_risk_permission_policy') {
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    assertPlatformExists(platformId, input.sandboxId)
    const permissionCode = asString(data.permission_code)
    if (!findActiveByField('permission', input.sandboxId, 'permission_code', permissionCode, platformId)) {
      throw new HttpError(404, 'HIGH_RISK_PERMISSION_NOT_FOUND', '高风险策略关联的权限不存在或未启用', {permissionCode})
    }
    const approverRoleCode = asOptionalString(data.approver_role_code)
    if (approverRoleCode && !findActiveByField('role', input.sandboxId, 'role_code', approverRoleCode, platformId)) {
      throw new HttpError(404, 'HIGH_RISK_APPROVER_ROLE_NOT_FOUND', '高风险策略审批角色不存在或未启用', {approverRoleCode})
    }
    const maxDurationDays = asNullableNumber(data.max_duration_days)
    if (maxDurationDays !== null && (!Number.isInteger(maxDurationDays) || maxDurationDays <= 0)) {
      throw new HttpError(400, 'INVALID_HIGH_RISK_DURATION', '高风险授权最长天数必须为正整数', {maxDurationDays})
    }
    const mfaValidityMinutes = asNumber(data.mfa_validity_minutes, 30)
    if (asBoolean(data.require_mfa, false) && (!Number.isInteger(mfaValidityMinutes) || mfaValidityMinutes <= 0)) {
      throw new HttpError(400, 'INVALID_HIGH_RISK_MFA_VALIDITY', 'MFA 有效分钟必须为正整数', {mfaValidityMinutes})
    }
  }

  if (input.entityType === 'bundle_price_rule') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'BUNDLE_PRICE_RULE_STORE_NOT_ACTIVE', '组合优惠必须归属有效门店', {storeId})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'BUNDLE_PRICE_RULE_STORE_PLATFORM_MISMATCH', '组合优惠门店必须属于当前集团', {storeId, platformId})
    }
    const triggerProducts = asRecordList(data.trigger_products)
    if (triggerProducts.length < 2) {
      throw new HttpError(400, 'BUNDLE_TRIGGER_PRODUCTS_REQUIRED', '组合优惠至少需要两个触发商品')
    }
    const missingProducts: string[] = []
    const mismatchedProducts: string[] = []
    triggerProducts
      .map(item => asString(item.product_id, ''))
      .forEach(productId => {
        const product = productId ? findAggregateRow('product', productId, input.sandboxId) : null
        if (!product) {
          missingProducts.push(productId)
          return
        }
        if (asString(asRecord(product.payload.data).platform_id) !== platformId) {
          mismatchedProducts.push(productId)
        }
      })
    if (missingProducts.length) {
      throw new HttpError(404, 'BUNDLE_TRIGGER_PRODUCT_NOT_FOUND', '组合优惠包含不存在的触发商品', {productIds: missingProducts})
    }
    if (mismatchedProducts.length) {
      throw new HttpError(409, 'BUNDLE_TRIGGER_PRODUCT_PLATFORM_MISMATCH', '组合优惠触发商品必须属于当前集团', {productIds: mismatchedProducts, platformId})
    }
    const invalidQuantities = triggerProducts.filter(item => asNumber(item.min_quantity ?? item.quantity, 0) <= 0)
    if (invalidQuantities.length) {
      throw new HttpError(400, 'INVALID_BUNDLE_TRIGGER_QUANTITY', '组合优惠触发数量必须大于 0')
    }
    if (asNumber(data.max_applications, 0) < 0) {
      throw new HttpError(400, 'INVALID_MAX_APPLICATIONS', '组合优惠最大触发次数不能为负数')
    }
  }

  if (input.entityType === 'brand_metadata') {
    const platformId = asString(data.platform_id, identity.platformId)
    const brandId = asString(data.brand_id, input.naturalScopeKey)
    const brand = findAggregateRow('brand', brandId, input.sandboxId)
    if (!brand || brand.status !== 'ACTIVE') {
      throw new HttpError(409, 'BRAND_METADATA_BRAND_NOT_ACTIVE', '品牌规格/加料字典必须归属有效品牌', {brandId})
    }
    if (asString(asRecord(brand.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'BRAND_METADATA_PLATFORM_MISMATCH', '品牌规格/加料字典必须归属当前集团下的品牌', {brandId, platformId})
    }
  }

  if (input.entityType === 'product_inheritance') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'PRODUCT_INHERITANCE_STORE_NOT_ACTIVE', '商品继承必须归属有效门店', {storeId})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'PRODUCT_INHERITANCE_STORE_PLATFORM_MISMATCH', '商品继承门店必须属于当前集团', {storeId, platformId})
    }
    const brandProductId = asString(data.brand_product_id, '')
    const storeProductId = asString(data.store_product_id, '')
    const brandProduct = brandProductId ? findAggregateRow('product', brandProductId, input.sandboxId) : null
    const storeProduct = storeProductId ? findAggregateRow('product', storeProductId, input.sandboxId) : null
    if (!brandProduct || !storeProduct) {
      throw new HttpError(404, 'PRODUCT_INHERITANCE_PRODUCT_NOT_FOUND', '商品继承关联的品牌商品或门店商品不存在', {brandProductId, storeProductId})
    }
    if (
      asString(asRecord(brandProduct.payload.data).platform_id) !== platformId
      || asString(asRecord(storeProduct.payload.data).platform_id) !== platformId
    ) {
      throw new HttpError(409, 'PRODUCT_INHERITANCE_PRODUCT_PLATFORM_MISMATCH', '商品继承两端商品必须属于当前集团', {brandProductId, storeProductId, platformId})
    }
  }

  if (input.entityType === 'channel_product_mapping') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const productId = asString(data.product_id, '')
    const store = findAggregateRow('store', storeId, input.sandboxId)
    const product = productId ? findAggregateRow('product', productId, input.sandboxId) : null
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'CHANNEL_MAPPING_STORE_NOT_ACTIVE', '渠道商品映射必须归属有效门店', {storeId})
    }
    if (!product) {
      throw new HttpError(404, 'CHANNEL_MAPPING_PRODUCT_NOT_FOUND', '渠道商品映射关联的商品不存在', {productId})
    }
    if (
      asString(asRecord(store.payload.data).platform_id) !== platformId
      || asString(asRecord(product.payload.data).platform_id) !== platformId
    ) {
      throw new HttpError(409, 'CHANNEL_MAPPING_PLATFORM_MISMATCH', '渠道商品映射的门店与商品必须属于当前集团', {storeId, productId, platformId})
    }
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'channel_types',
      value: data.channel_type,
      field: 'channel_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
  }

  if (input.entityType === 'product_category') {
    const ownershipScope = asString(data.ownership_scope, input.naturalScopeType === 'STORE' ? 'STORE' : 'BRAND').toUpperCase()
    const platformId = asString(data.platform_id, identity.platformId)
    if (!['BRAND', 'STORE'].includes(ownershipScope)) {
      throw new HttpError(400, 'INVALID_CATEGORY_OWNERSHIP_SCOPE', '商品分类归属范围只能是品牌或门店', {ownershipScope})
    }
    const ownerEntityType: DomainEntity = ownershipScope === 'STORE' ? 'store' : 'brand'
    const ownerId = asString(data.owner_id, input.naturalScopeKey)
    const owner = findAggregateRow(ownerEntityType, ownerId, input.sandboxId)
    if (!owner) {
      throw new HttpError(404, 'PRODUCT_CATEGORY_OWNER_NOT_FOUND', '商品分类归属对象不存在', {ownershipScope, ownerId})
    }
    if (asString(asRecord(owner.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'PRODUCT_CATEGORY_OWNER_PLATFORM_MISMATCH', '商品分类归属对象必须属于当前集团', {ownershipScope, ownerId, platformId})
    }
    const duplicate = findFieldDuplicate({
      entityType: 'product_category',
      sandboxId: input.sandboxId,
      entityId: input.entityId,
      field: 'category_code',
      value: data.category_code,
      scope: {field: 'owner_id', value: ownerId},
    })
    if (duplicate) {
      throw new HttpError(409, 'PRODUCT_CATEGORY_CODE_ALREADY_EXISTS', '商品分类编码在当前归属范围内已存在')
    }
  }

  if (input.entityType === 'product') {
    const ownershipScope = asString(data.ownership_scope, 'BRAND').toUpperCase()
    const productType = normalizeProductType(data.product_type)
    const basePrice = asNumber(data.base_price, 0)
    const platformId = asString(data.platform_id, identity.platformId)
    if (!['BRAND', 'STORE'].includes(ownershipScope)) {
      throw new HttpError(400, 'INVALID_PRODUCT_OWNERSHIP_SCOPE', '商品归属范围只能是品牌或门店', {ownershipScope})
    }
    if (basePrice <= 0) {
      throw new HttpError(400, 'INVALID_PRODUCT_PRICE', '商品基础价格必须大于 0')
    }
    if (ownershipScope === 'BRAND') {
      const brandId = asNullableString(data.brand_id)
      const brand = brandId ? findAggregateRow('brand', brandId, input.sandboxId) : null
      if (!brand) {
        throw new HttpError(404, 'PRODUCT_BRAND_NOT_FOUND', '品牌商品必须归属有效品牌', {brandId})
      }
      if (asString(asRecord(brand.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'PRODUCT_BRAND_PLATFORM_MISMATCH', '品牌商品必须归属当前集团下的品牌', {brandId, platformId})
      }
      if (asNullableString(data.store_id)) {
        throw new HttpError(400, 'PRODUCT_STORE_FORBIDDEN_FOR_BRAND_SCOPE', '品牌级商品不能同时归属门店')
      }
      assertPlatformCatalogValue({
        sandboxId: input.sandboxId,
        platformId,
        catalogKey: 'product_types',
        value: productType,
        field: 'product_type',
        ownerEntityType: 'brand',
        ownerId: brandId,
        ownerCatalog: asRecord(brand.payload.data).metadata_catalog,
      })
    }
    if (ownershipScope === 'STORE') {
      const storeId = asNullableString(data.store_id)
      const store = storeId ? findAggregateRow('store', storeId, input.sandboxId) : null
      if (!store) {
        throw new HttpError(404, 'PRODUCT_STORE_NOT_FOUND', '门店商品必须归属有效门店', {storeId})
      }
      if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'PRODUCT_STORE_PLATFORM_MISMATCH', '门店商品必须归属当前集团下的门店', {storeId, platformId})
      }
      if (asNullableString(data.brand_id)) {
        throw new HttpError(400, 'PRODUCT_BRAND_FORBIDDEN_FOR_STORE_SCOPE', '门店级商品不能同时归属品牌')
      }
      const brandId = asNullableString(asRecord(store.payload.data).brand_id)
      assertPlatformCatalogValue({
        sandboxId: input.sandboxId,
        platformId,
        catalogKey: 'product_types',
        value: productType,
        field: 'product_type',
        ownerEntityType: 'brand',
        ownerId: brandId,
      })
    }
    const categoryId = asNullableString(data.category_id)
    if (categoryId) {
      const category = findAggregateRow('product_category', categoryId, input.sandboxId)
      if (!category) {
        throw new HttpError(404, 'PRODUCT_CATEGORY_NOT_FOUND', '商品分类不存在', {categoryId})
      }
      if (asString(asRecord(category.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'PRODUCT_CATEGORY_PLATFORM_MISMATCH', '商品分类必须属于当前集团', {categoryId, platformId})
      }
    }
    validateProductVariants(asRecordList(data.variants), basePrice)
    validateModifierGroups(asRecordList(data.modifier_groups))
    if (productType === 'COMBO') {
      assertComboProductReferences({data, productId: input.entityId, sandboxId: input.sandboxId})
      assertComboPricingSemantics(data, basePrice)
    }
  }

  if (input.entityType === 'brand_menu') {
    const platformId = asString(data.platform_id, identity.platformId)
    const brandId = asNullableString(data.brand_id)
    const brand = brandId ? findAggregateRow('brand', brandId, input.sandboxId) : null
    if (!brand || brand.status !== 'ACTIVE') {
      throw new HttpError(409, 'BRAND_MENU_BRAND_NOT_ACTIVE', '品牌菜单必须归属有效品牌', {brandId})
    }
    if (asString(asRecord(brand.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'BRAND_MENU_PLATFORM_MISMATCH', '品牌菜单必须归属当前集团下的品牌', {brandId, platformId})
    }
    const reviewStatus = asString(data.review_status, 'NONE').toUpperCase()
    const entityStatus = asString(data.status, 'DRAFT').toUpperCase()
    if (['PENDING_REVIEW', 'APPROVED', 'ACTIVE'].includes(entityStatus) || ['PENDING_REVIEW', 'APPROVED'].includes(reviewStatus)) {
      assertMenuHasPublishableProducts({sections: data.sections, sandboxId: input.sandboxId, label: '品牌菜单', platformId})
    }
    assertActiveBrandMenuWindowUnique({
      menuId: input.entityId,
      data,
      sandboxId: input.sandboxId,
    })
  }

  if (input.entityType === 'menu_catalog') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asNullableString(data.store_id)
    const store = storeId ? findAggregateRow('store', storeId, input.sandboxId) : null
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'STORE_MENU_STORE_NOT_ACTIVE', '门店菜单必须归属有效门店', {storeId})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'STORE_MENU_PLATFORM_MISMATCH', '门店菜单必须归属当前集团下的门店', {storeId, platformId})
    }
    const brandMenuId = asNullableString(data.brand_menu_id)
    if (brandMenuId) {
      const brandMenu = findAggregateRow('brand_menu', brandMenuId, input.sandboxId)
      if (!brandMenu) {
        throw new HttpError(404, 'BRAND_MENU_NOT_FOUND', '继承的品牌菜单不存在', {brandMenuId})
      }
      if (brandMenu.status !== 'APPROVED' && brandMenu.status !== 'ACTIVE') {
        throw new HttpError(409, 'BRAND_MENU_NOT_APPROVED', '继承的品牌菜单必须已批准', {brandMenuId})
      }
      if (asString(asRecord(brandMenu.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'STORE_MENU_BRAND_MENU_PLATFORM_MISMATCH', '门店菜单继承的品牌菜单必须属于同一集团', {brandMenuId, platformId})
      }
      assertStoreMenuOverrideScope({
        data,
        brandMenu,
      })
    }
    const entityStatus = asString(data.status, 'DRAFT').toUpperCase()
    if (['ACTIVE', 'APPROVED'].includes(entityStatus)) {
      assertMenuHasPublishableProducts({sections: data.sections, sandboxId: input.sandboxId, label: '门店菜单', platformId})
      const conflict = listRowsByEntityType('menu_catalog', input.sandboxId)
        .map(toAggregateRow)
        .find(item => {
          if (item.entityId === input.entityId || item.status !== 'ACTIVE') {
            return false
          }
          const itemData = asRecord(item.payload.data)
          return normalizedMenuConflictKey(itemData) === normalizedMenuConflictKey(data)
            && menuTimeSlotOverlaps(itemData, data)
        })
      if (conflict) {
        throw new HttpError(409, 'ACTIVE_STORE_MENU_CONFLICT', '同一门店、渠道与菜单类型下不能存在冲突的生效菜单', {conflictMenuId: conflict.entityId})
      }
    }
  }

  if (input.entityType === 'price_rule') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'PRICE_RULE_STORE_NOT_ACTIVE', '价格规则必须归属有效门店', {storeId})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'PRICE_RULE_STORE_PLATFORM_MISMATCH', '价格规则门店必须属于当前集团', {storeId, platformId})
    }
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'price_types',
      value: data.price_type,
      field: 'price_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'channel_types',
      value: data.channel_type,
      field: 'channel_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'discount_types',
      value: data.discount_type,
      field: 'discount_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'member_tiers',
      value: data.member_tier,
      field: 'member_tier',
      allowEmpty: true,
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    const targetProductIds = asStringList(data.applicable_product_ids ?? data.product_id)
    const mismatchedProductIds = targetProductIds.filter(productId => {
      const product = findAggregateRow('product', productId, input.sandboxId)
      return !product || asString(asRecord(product.payload.data).platform_id) !== platformId
    })
    if (mismatchedProductIds.length) {
      throw new HttpError(409, 'PRICE_RULE_PRODUCT_PLATFORM_MISMATCH', '价格规则适用商品必须属于当前集团', {productIds: mismatchedProductIds, platformId})
    }
    assertPriceRuleSemantics(data)
    const enabled = asBoolean(data.enabled ?? data.is_active, true)
    const entityStatus = asString(data.status, 'ACTIVE').toUpperCase()
    if (enabled && ['ACTIVE', 'OPEN'].includes(entityStatus)) {
      const targetProductIds = asStringList(data.applicable_product_ids ?? data.product_id).sort()
      const conflict = listRowsByEntityType('price_rule', input.sandboxId)
        .map(toAggregateRow)
        .find(item => {
          if (item.entityId === input.entityId || !['ACTIVE', 'OPEN'].includes(asString(item.status).toUpperCase())) {
            return false
          }
          const itemData = asRecord(item.payload.data)
          const itemEnabled = asBoolean(itemData.enabled ?? itemData.is_active, true)
          const itemProductIds = asStringList(itemData.applicable_product_ids ?? itemData.product_id).sort()
          return itemEnabled
            && asString(itemData.store_id) === asString(data.store_id)
            && JSON.stringify(itemProductIds) === JSON.stringify(targetProductIds)
            && asString(itemData.channel_type, 'ALL') === asString(data.channel_type, 'ALL')
            && asString(itemData.member_tier, '') === asString(data.member_tier, '')
            && asNumber(itemData.priority, 10) === asNumber(data.priority, 10)
            && weekDaysOverlap(itemData.days_of_week, data.days_of_week)
            && optionalDateRangeOverlaps(itemData.effective_from, itemData.effective_to, data.effective_from, data.effective_to)
            && timeRangesOverlap(itemData.time_slot_start ?? asRecord(itemData.time_slot).start ?? '00:00', itemData.time_slot_end ?? asRecord(itemData.time_slot).end ?? '23:59', data.time_slot_start ?? asRecord(data.time_slot).start ?? '00:00', data.time_slot_end ?? asRecord(data.time_slot).end ?? '23:59')
        })
      if (conflict) {
        throw new HttpError(409, 'PRICE_RULE_CONFLICT', '同一门店、商品、渠道、会员等级、优先级和时间范围下已有生效价格规则', {conflictRuleId: conflict.entityId})
      }
    }
  }

  if (input.entityType === 'menu_availability') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const productId = asString(data.product_id, input.entityId)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    const product = findAggregateRow('product', productId, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'MENU_AVAILABILITY_STORE_NOT_ACTIVE', '菜品可售状态必须归属有效门店', {storeId})
    }
    if (!product) {
      throw new HttpError(404, 'MENU_AVAILABILITY_PRODUCT_NOT_FOUND', '菜品可售状态关联的商品不存在', {productId})
    }
    if (
      asString(asRecord(store.payload.data).platform_id) !== platformId
      || asString(asRecord(product.payload.data).platform_id) !== platformId
    ) {
      throw new HttpError(409, 'MENU_AVAILABILITY_PLATFORM_MISMATCH', '菜品可售状态的门店与商品必须属于当前集团', {storeId, productId, platformId})
    }
  }

  if (input.entityType === 'availability_rule') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asNullableString(data.store_id)
    if (storeId) {
      const store = findAggregateRow('store', storeId, input.sandboxId)
      if (!store || store.status !== 'ACTIVE') {
        throw new HttpError(409, 'AVAILABILITY_RULE_STORE_NOT_ACTIVE', '可售规则必须归属有效门店', {storeId})
      }
      if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'AVAILABILITY_RULE_STORE_PLATFORM_MISMATCH', '可售规则门店必须属于当前集团', {storeId, platformId})
      }
    }
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'availability_rule_types',
      value: data.rule_type,
      field: 'rule_type',
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    assertPlatformCatalogValue({
      sandboxId: input.sandboxId,
      platformId,
      catalogKey: 'channel_types',
      value: data.channel_type ?? 'ALL',
      field: 'channel_type',
      allowEmpty: true,
      ownerEntityType: 'store',
      ownerId: storeId,
    })
    const productId = asNullableString(data.product_id)
    if (productId) {
      const product = findAggregateRow('product', productId, input.sandboxId)
      if (!product) {
        throw new HttpError(404, 'AVAILABILITY_RULE_PRODUCT_NOT_FOUND', '可售规则关联的商品不存在', {productId})
      }
      if (asString(asRecord(product.payload.data).platform_id) !== platformId) {
        throw new HttpError(409, 'AVAILABILITY_RULE_PRODUCT_PLATFORM_MISMATCH', '可售规则商品必须属于当前集团', {productId, platformId})
      }
    }
    assertAvailabilityRuleSemantics(data)
    const ruleType = asString(data.rule_type, 'MANUAL').toUpperCase()
    if (ruleType === 'MANUAL' && asBoolean(data.enabled ?? data.is_active, true)) {
      const duplicateManual = listRowsByEntityType('availability_rule', input.sandboxId)
        .map(toAggregateRow)
        .find(item => {
          const itemData = asRecord(item.payload.data)
          return item.entityId !== input.entityId
            && item.status === 'ACTIVE'
            && asString(itemData.rule_type, 'MANUAL').toUpperCase() === 'MANUAL'
            && asBoolean(itemData.enabled ?? itemData.is_active, true)
            && asString(itemData.store_id, '') === asString(data.store_id, '')
            && asString(itemData.product_id, '') === asString(data.product_id, '')
            && asString(itemData.channel_type, '') === asString(data.channel_type, '')
            && optionalDateRangeOverlaps(itemData.effective_from, itemData.effective_to, data.effective_from, data.effective_to)
        })
      if (duplicateManual) {
        throw new HttpError(409, 'MANUAL_AVAILABILITY_RULE_ALREADY_EXISTS', '同一门店、商品和渠道只能有一条启用的人工可售规则', {conflictRuleId: duplicateManual.entityId})
      }
    }
  }

  if (input.entityType === 'store_config') {
    const platformId = asString(data.platform_id, identity.platformId)
    const store = findAggregateRow('store', input.naturalScopeKey, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'STORE_CONFIG_STORE_NOT_ACTIVE', '门店经营配置必须归属有效门店', {storeId: input.naturalScopeKey})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'STORE_CONFIG_PLATFORM_MISMATCH', '门店经营配置必须归属当前集团下的门店', {storeId: input.naturalScopeKey, platformId})
    }
    const duplicate = listRowsByEntityType('store_config', input.sandboxId)
      .map(toAggregateRow)
      .find(item => item.entityId !== input.entityId && item.naturalScopeType === 'STORE' && item.naturalScopeKey === input.naturalScopeKey)
    if (duplicate) {
      throw new HttpError(409, 'STORE_CONFIG_ALREADY_EXISTS', '一个门店只能有一份经营配置', {storeId: input.naturalScopeKey})
    }
    assertStoreOperatingConfigSemantics(data)
  }

  if (input.entityType === 'saleable_stock') {
    const platformId = asString(data.platform_id, identity.platformId)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const store = findAggregateRow('store', storeId, input.sandboxId)
    if (!store || store.status !== 'ACTIVE') {
      throw new HttpError(409, 'SALEABLE_STOCK_STORE_NOT_ACTIVE', '可售库存必须归属有效门店', {storeId})
    }
    if (asString(asRecord(store.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'SALEABLE_STOCK_STORE_PLATFORM_MISMATCH', '可售库存门店必须属于当前集团', {storeId, platformId})
    }
    const productId = asString(data.product_id, '')
    const product = productId ? findAggregateRow('product', productId, input.sandboxId) : null
    if (!product) {
      throw new HttpError(404, 'SALEABLE_STOCK_PRODUCT_NOT_FOUND', '可售库存关联的商品不存在', {productId})
    }
    if (asString(asRecord(product.payload.data).platform_id) !== platformId) {
      throw new HttpError(409, 'SALEABLE_STOCK_PRODUCT_PLATFORM_MISMATCH', '可售库存商品必须属于当前集团', {productId, platformId})
    }
    const totalQuantity = asNullableNumber(data.total_quantity)
    const soldQuantity = asNumber(data.sold_quantity, 0)
    const reservedQuantity = asNumber(data.reserved_quantity, 0)
    const soldOutThreshold = asNumber(data.sold_out_threshold, 0)
    if (totalQuantity !== null && totalQuantity < soldQuantity + reservedQuantity) {
      throw new HttpError(400, 'INVALID_STOCK_QUANTITY', '库存不能小于已售数量和预留数量之和')
    }
    if (totalQuantity !== null && soldOutThreshold > totalQuantity) {
      throw new HttpError(400, 'INVALID_SOLD_OUT_THRESHOLD', '沽清阈值不能大于总库存')
    }
  }

}

const readEntityData = (entityType: DomainEntity, entityId: string, sandboxId = DEFAULT_SANDBOX_ID) =>
  cloneJson(asRecord(requireEntityRow(entityType, entityId, sandboxId).payload.data))

const createProjectRegion = (value: unknown) => {
  const region = asRecord(value)
  return {
    region_id: asNullableString(region.region_id),
    region_code: asString(region.region_code, 'CN-SZ'),
    region_name: asString(region.region_name, 'Shenzhen'),
    parent_region_id: asNullableString(region.parent_region_id),
    parent_region_code: asOptionalString(region.parent_region_code) ?? 'CN-GD',
    region_level: asNumber(region.region_level, 2),
  }
}

type ProjectPhase = {
  phase_id: string
  phase_name: string
  owner_name: string
  owner_contact: string | null
  owner_phone: string | null
}

const projectPhaseId = (phaseName: string, index: number) => {
  if (index === 0) return 'phase-default'
  const normalized = normalizeId(phaseName)
  return normalized ? `phase-${normalized}` : `phase-${index + 1}`
}

const defaultProjectOwnerName = (projectName: string, phaseName = '一期') =>
  `${projectName}${phaseName === '一期' ? '' : phaseName}业主方`

const normalizeProjectPhases = (value: unknown, projectName: string): ProjectPhase[] => {
  const rawItems = Array.isArray(value) ? value : []
  const phases = rawItems.map((entry, index) => {
    const record = asRecord(entry)
    const phaseName = asOptionalString(record.phase_name ?? record.phaseName)
      ?? (index === 0 ? '一期' : `第${index + 1}期`)
    const ownerName = asOptionalString(record.owner_name ?? record.ownerName)
      ?? defaultProjectOwnerName(projectName, phaseName)
    return {
      phase_id: asOptionalString(record.phase_id ?? record.phaseId) ?? projectPhaseId(phaseName, index),
      phase_name: phaseName,
      owner_name: ownerName,
      owner_contact: asOptionalString(record.owner_contact ?? record.ownerContact) ?? null,
      owner_phone: asOptionalString(record.owner_phone ?? record.ownerPhone) ?? null,
    }
  }).filter(item => item.phase_name && item.owner_name)

  return phases.length ? phases : [{
    phase_id: 'phase-default',
    phase_name: '一期',
    owner_name: defaultProjectOwnerName(projectName),
    owner_contact: null,
    owner_phone: null,
  }]
}

const resolveProjectPhase = (projectData: Record<string, unknown>, requestedPhaseId?: string | null) => {
  const phases = normalizeProjectPhases(projectData.project_phases, asString(projectData.project_name, '项目'))
  return phases.find(phase => phase.phase_id === requestedPhaseId)
    ?? phases[0]
}

const platformMetadataOption = (value: string, label: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...extra,
  value,
  label,
  status: 'ACTIVE',
})

const metadataCatalogOwnerScopeByKey = {
  regions: 'PLATFORM',
  project_business_modes: 'PLATFORM',
  tenant_types: 'PLATFORM',
  tenant_business_models: 'PLATFORM',
  store_business_formats: 'PLATFORM',
  store_cooperation_modes: 'PLATFORM',
  brand_categories: 'PLATFORM',
  product_types: 'BRAND',
  product_categories: 'BRAND',
  production_categories: 'BRAND',
  store_business_scenarios: 'STORE',
  table_areas: 'STORE',
  table_types: 'STORE',
  workstation_types: 'STORE',
  channel_types: 'STORE',
  price_types: 'STORE',
  discount_types: 'STORE',
  member_tiers: 'STORE',
  availability_rule_types: 'STORE',
} as const

const defaultPlatformMetadataCatalog = {
  regions: [
    platformMetadataOption('NORTH_CHINA', '华北大区', {
      region_id: 'region-north-china',
      region_code: 'NORTH_CHINA',
      region_name: '华北大区',
      parent_region_id: null,
      region_level: 1,
      region_status: 'ACTIVE',
    }),
    platformMetadataOption('EAST_CHINA', '华东大区', {
      region_id: 'region-east-china',
      region_code: 'EAST_CHINA',
      region_name: '华东大区',
      parent_region_id: null,
      region_level: 1,
      region_status: 'ACTIVE',
    }),
    platformMetadataOption('SOUTH_CHINA', '华南大区', {
      region_id: 'region-south-china',
      region_code: 'SOUTH_CHINA',
      region_name: '华南大区',
      parent_region_id: null,
      region_level: 1,
      region_status: 'ACTIVE',
    }),
    platformMetadataOption('CENTRAL_CHINA', '华中大区', {
      region_id: 'region-central-china',
      region_code: 'CENTRAL_CHINA',
      region_name: '华中大区',
      parent_region_id: null,
      region_level: 1,
      region_status: 'ACTIVE',
    }),
    platformMetadataOption('WEST_CHINA', '西南大区', {
      region_id: 'region-west-china',
      region_code: 'WEST_CHINA',
      region_name: '西南大区',
      parent_region_id: null,
      region_level: 1,
      region_status: 'ACTIVE',
    }),
  ],
  project_business_modes: [
    platformMetadataOption('SHOPPING_MALL', '购物中心'),
    platformMetadataOption('OUTLET_MALL', '奥莱'),
    platformMetadataOption('DEPARTMENT_STORE', '百货'),
    platformMetadataOption('MIXED_USE', '商业综合体'),
  ],
  tenant_types: [
    platformMetadataOption('SINGLE_STORE', '单店租户'),
    platformMetadataOption('CHAIN_BRAND', '连锁品牌租户'),
  ],
  tenant_business_models: [
    platformMetadataOption('SELF_OPERATED', '自营'),
    platformMetadataOption('FRANCHISED', '加盟'),
    platformMetadataOption('MIXED', '混合经营'),
  ],
  store_business_formats: [
    platformMetadataOption('RESTAURANT', '餐饮'),
    platformMetadataOption('RETAIL', '零售'),
    platformMetadataOption('SERVICE', '服务'),
    platformMetadataOption('EXPERIENCE', '体验业态'),
  ],
  store_cooperation_modes: [
    platformMetadataOption('DIRECT_OPERATION', '自营'),
    platformMetadataOption('JOINT_OPERATION', '联营'),
    platformMetadataOption('LEASE', '租赁'),
    platformMetadataOption('POPUP', '快闪'),
  ],
  store_business_scenarios: [
    platformMetadataOption('DINE_IN', '堂食'),
    platformMetadataOption('TAKEAWAY', '外卖'),
    platformMetadataOption('DELIVERY', '配送'),
    platformMetadataOption('PICKUP', '自提'),
    platformMetadataOption('RESERVATION', '预约'),
  ],
  brand_categories: [
    platformMetadataOption('BAKERY', '烘焙'),
    platformMetadataOption('CHINESE_CUISINE', '中餐'),
    platformMetadataOption('WESTERN_CUISINE', '西餐'),
    platformMetadataOption('COFFEE', '咖啡'),
    platformMetadataOption('TEA_DRINK', '茶饮'),
    platformMetadataOption('LIGHT_MEAL', '轻食'),
    platformMetadataOption('RETAIL', '零售'),
  ],
  table_areas: [
    platformMetadataOption('HALL', '大厅'),
    platformMetadataOption('PRIVATE_ROOM', '包房'),
    platformMetadataOption('TERRACE', '露台'),
    platformMetadataOption('BAR', '吧台'),
  ],
  table_types: [
    platformMetadataOption('HALL', '大厅桌'),
    platformMetadataOption('PRIVATE_ROOM', '包房桌'),
    platformMetadataOption('BOOTH', '卡座'),
    platformMetadataOption('BAR', '吧台位'),
    platformMetadataOption('REGULAR', '普通桌'),
    platformMetadataOption('VIP', '贵宾桌'),
    platformMetadataOption('OUTDOOR', '户外桌'),
  ],
  workstation_types: [
    platformMetadataOption('PRODUCTION', '制作站'),
    platformMetadataOption('PACKING', '打包站'),
    platformMetadataOption('DELIVERY_HANDOFF', '配送交接站'),
    platformMetadataOption('POS', '收银工作站'),
    platformMetadataOption('KDS', '厨房屏'),
    platformMetadataOption('KIOSK', '自助点餐机'),
    platformMetadataOption('PRINTER', '打印工作站'),
    platformMetadataOption('BAR', '吧台工作站'),
    platformMetadataOption('KITCHEN', '后厨工作站'),
  ],
  production_categories: [
    platformMetadataOption('HOT_DISH', '热厨'),
    platformMetadataOption('COLD_DISH', '冷厨'),
    platformMetadataOption('BAKERY', '烘焙'),
    platformMetadataOption('DRINK', '饮品'),
    platformMetadataOption('PACKING', '打包'),
    platformMetadataOption('SIGNATURE_BOWL', '招牌碗'),
  ],
  product_categories: [
    platformMetadataOption('SIGNATURE', '招牌'),
    platformMetadataOption('MAIN_DISH', '主餐'),
    platformMetadataOption('DRINK', '饮品'),
    platformMetadataOption('DESSERT', '甜品'),
    platformMetadataOption('RETAIL_PACK', '零售包装'),
  ],
  product_types: [
    platformMetadataOption('SINGLE', '单品'),
    platformMetadataOption('COMBO', '套餐'),
    platformMetadataOption('MODIFIER', '加料/配料'),
  ],
  price_types: [
    platformMetadataOption('FIXED', '固定价'),
    platformMetadataOption('DISCOUNT_RATE', '折扣率'),
    platformMetadataOption('DISCOUNT_AMOUNT', '立减金额'),
    platformMetadataOption('OVERRIDE_PRICE', '覆盖价'),
    platformMetadataOption('MEMBER_PRICE', '会员价'),
  ],
  channel_types: [
    platformMetadataOption('ALL', '全部渠道'),
    platformMetadataOption('POS', 'POS'),
    platformMetadataOption('POS_DIRECT', 'POS直录'),
    platformMetadataOption('MINI_PROGRAM', '小程序'),
    platformMetadataOption('MEITUAN', '美团'),
    platformMetadataOption('ELEME', '饿了么'),
    platformMetadataOption('DOUYIN', '抖音'),
    platformMetadataOption('DINE_IN', '堂食'),
    platformMetadataOption('TAKEAWAY', '外卖'),
    platformMetadataOption('DELIVERY', '配送'),
  ],
  discount_types: [
    platformMetadataOption('PERCENTAGE', '按比例'),
    platformMetadataOption('AMOUNT', '固定金额'),
    platformMetadataOption('FIXED_PRICE', '固定价'),
    platformMetadataOption('AMOUNT_OFF', '立减'),
  ],
  member_tiers: [
    platformMetadataOption('NONE', '不限定会员'),
    platformMetadataOption('REGULAR', '普通会员'),
    platformMetadataOption('SILVER', '银卡会员'),
    platformMetadataOption('GOLD', '金卡会员'),
    platformMetadataOption('VIP', 'VIP会员'),
    platformMetadataOption('BLACK', '黑卡会员'),
  ],
  availability_rule_types: [
    platformMetadataOption('TIME_SLOT', '时段规则'),
    platformMetadataOption('CHANNEL', '渠道规则'),
    platformMetadataOption('STOCK', '库存规则'),
    platformMetadataOption('QUOTA', '限量规则'),
    platformMetadataOption('MANUAL', '手动控制'),
  ],
}

const normalizeMetadataOptions = (
  value: unknown,
  fallback: Array<Record<string, unknown>>,
  options: {mergeDefaults?: boolean} = {},
): Array<Record<string, unknown>> => {
  const rawItems = Array.isArray(value) ? value : fallback
  const normalizedItems: Array<Record<string, unknown>> = rawItems.map((entry, index) => {
    const record = typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? entry as Record<string, unknown> : {}
    const label = asString(record.label ?? record.option_name ?? record.name ?? entry, `选项${index + 1}`)
    const generatedCode = normalizeId(label).replace(/-/g, '_').toUpperCase()
    const explicitCode = asOptionalString(record.value ?? record.option_code ?? record.code)
    const code = explicitCode ?? (generatedCode || `OPTION_${index + 1}`)
    return {
      ...record,
      value: code,
      label,
      status: sanitizeStatus(record.status, 'ACTIVE'),
    }
  })
  if (!options.mergeDefaults || !Array.isArray(value)) {
    return normalizedItems
  }

  const seen = new Set(normalizedItems.map(item => asString(item.value, '').trim().toUpperCase()).filter(Boolean))
  const normalizedDefaults = normalizeMetadataOptions(fallback, fallback)
  normalizedDefaults.forEach(item => {
    const code = asString(item.value, '').trim().toUpperCase()
    if (code && !seen.has(code)) {
      normalizedItems.push(item)
      seen.add(code)
    }
  })
  return normalizedItems
}

const normalizeScopedMetadataOptions = (
  value: unknown,
  key: keyof typeof metadataCatalogOwnerScopeByKey,
  ownerId: string,
  options: {mergeDefaults?: boolean} = {},
) => normalizeMetadataOptions(value, defaultPlatformMetadataCatalog[key], options).map(entry => ({
  ...entry,
  owner_scope: metadataCatalogOwnerScopeByKey[key],
  owner_id: asNullableString(entry.owner_id) ?? ownerId,
}))

const normalizePlatformRegions = (value: unknown, options: {mergeDefaults?: boolean} = {}) =>
  normalizeMetadataOptions(value, defaultPlatformMetadataCatalog.regions, options).map((entry, index) => {
    const code = asString(entry.value ?? entry.region_code, `REGION_${index + 1}`)
    const name = asString(entry.label ?? entry.region_name, `大区${index + 1}`)
    return {
      ...entry,
      value: code,
      label: name,
      region_id: asNullableString(entry.region_id) ?? normalizeId(`region-${code}`),
      platform_id: asNullableString(entry.platform_id),
      parent_region_id: asNullableString(entry.parent_region_id),
      region_code: code,
      region_name: name,
      region_level: asNumber(entry.region_level, entry.parent_region_id ? 2 : 1),
      region_status: sanitizeStatus(entry.region_status ?? entry.status, 'ACTIVE'),
      status: sanitizeStatus(entry.status, 'ACTIVE'),
    }
  })

const normalizePlatformMetadataCatalog = (value: unknown, options: {mergeDefaults?: boolean} = {}) => {
  const catalog = asRecord(value)
  return Object.fromEntries(Object.entries(defaultPlatformMetadataCatalog).map(([key, fallback]) => [
    key,
    key === 'regions'
      ? normalizePlatformRegions(catalog[key], options)
      : normalizeMetadataOptions(catalog[key], fallback, options),
  ]))
}

const normalizeEntityMetadataCatalog = (
  value: unknown,
  ownerScope: 'PLATFORM' | 'BRAND' | 'STORE',
  ownerId: string,
  options: {mergeDefaults?: boolean} = {},
) => {
  const keys = Object.entries(metadataCatalogOwnerScopeByKey)
    .filter(([, scope]) => scope === ownerScope)
    .map(([key]) => key as keyof typeof metadataCatalogOwnerScopeByKey)
  const catalog = asRecord(value)
  return Object.fromEntries(keys.map(key => [
    key,
    ownerScope === 'PLATFORM' && key === 'regions'
      ? normalizePlatformRegions(catalog[key], options).map(entry => ({...entry, owner_scope: ownerScope, owner_id: ownerId}))
      : normalizeScopedMetadataOptions(catalog[key], key, ownerId, options),
  ]))
}

const getPlatformCatalog = (platformId: string | null | undefined, sandboxId: string) => {
  const platform = platformId ? findAggregateRow('platform', platformId, sandboxId) : null
  return normalizePlatformMetadataCatalog(asRecord(platform?.payload.data).metadata_catalog)
}

const getBusinessCatalogOptions = (input: {
  sandboxId: string
  platformId: string
  catalogKey: keyof typeof defaultPlatformMetadataCatalog
  ownerEntityType?: DomainEntity
  ownerId?: string | null
  ownerCatalog?: unknown
}) => {
  const platformCatalog = getPlatformCatalog(input.platformId, input.sandboxId)
  const platformOptions = asRecordList(platformCatalog[input.catalogKey])
  if (!input.ownerEntityType || !input.ownerId) return platformOptions
  const inlineOwnerCatalog = asRecord(input.ownerCatalog)
  if (Array.isArray(inlineOwnerCatalog[input.catalogKey])) {
    return normalizeMetadataOptions(inlineOwnerCatalog[input.catalogKey], platformOptions)
  }
  const owner = findAggregateRow(input.ownerEntityType, input.ownerId, input.sandboxId)
  const ownerCatalog = asRecord(asRecord(owner?.payload.data).metadata_catalog)
  if (!Array.isArray(ownerCatalog[input.catalogKey])) return platformOptions
  return normalizeMetadataOptions(ownerCatalog[input.catalogKey], platformOptions)
}

const catalogOptionMatches = (option: Record<string, unknown>, value: string) => {
  const normalizedValue = value.trim().toUpperCase()
  return [
    option.value,
    option.option_code,
    option.code,
    option.label,
    option.option_name,
    option.name,
    option.region_id,
    option.region_code,
    option.region_name,
  ].some(candidate => asString(candidate, '').trim().toUpperCase() === normalizedValue)
}

const normalizeLegacyBrandCategory = (value: unknown) => {
  const raw = asString(value, '').trim()
  const legacyMap: Record<string, string> = {
    西北中餐: 'CHINESE_CUISINE',
    江南中餐: 'CHINESE_CUISINE',
    新式茶饮: 'TEA_DRINK',
    原叶鲜奶茶: 'TEA_DRINK',
  }
  return legacyMap[raw] ?? value
}

const assertPlatformCatalogValue = (input: {
  sandboxId: string
  platformId: string
  catalogKey: keyof typeof defaultPlatformMetadataCatalog
  value: unknown
  field: string
  allowEmpty?: boolean
  ownerEntityType?: DomainEntity
  ownerId?: string | null
  ownerCatalog?: unknown
}) => {
  const value = asOptionalString(input.value)
  if (!value) {
    if (input.allowEmpty) return
    throw new HttpError(400, 'CATALOG_VALUE_REQUIRED', '必须选择集团业务字典中的有效值', {
      field: input.field,
      catalogKey: input.catalogKey,
    })
  }
  const options = getBusinessCatalogOptions(input).filter(option => sanitizeStatus(option.status, 'ACTIVE') === 'ACTIVE')
  if (!options.some(option => catalogOptionMatches(option, value))) {
    throw new HttpError(400, 'CATALOG_VALUE_NOT_DEFINED', '该字段必须来自对应归属的业务字典，请先在集团全局、品牌或门店字典中维护', {
      field: input.field,
      value,
      catalogKey: input.catalogKey,
      platformId: input.platformId,
      ownerEntityType: input.ownerEntityType,
      ownerId: input.ownerId,
    })
  }
}

const assertPlatformCatalogValues = (input: {
  sandboxId: string
  platformId: string
  catalogKey: keyof typeof defaultPlatformMetadataCatalog
  values: unknown
  field: string
  allowEmpty?: boolean
  ownerEntityType?: DomainEntity
  ownerId?: string | null
  ownerCatalog?: unknown
}) => {
  const values = asStringList(input.values)
  if (values.length === 0) {
    if (input.allowEmpty) return
    throw new HttpError(400, 'CATALOG_VALUE_REQUIRED', '必须至少选择一个对应归属业务字典中的有效值', {
      field: input.field,
      catalogKey: input.catalogKey,
    })
  }
  values.forEach(value => assertPlatformCatalogValue({...input, value, allowEmpty: false}))
}

const asStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => asString(item, '').trim()).filter(Boolean)))
  }
  const text = asOptionalString(value)
  return text
    ? Array.from(new Set(text.split(/[,\n，、]/).map(item => item.trim()).filter(Boolean)))
    : []
}

const asUpperStringList = (value: unknown) =>
  asStringList(value).map(item => item.toUpperCase())

const asRecordList = (value: unknown) =>
  Array.isArray(value) ? value.map(item => asRecord(item)).filter(item => Object.keys(item).length > 0) : []

const asNullableString = (value: unknown, fallback: string | null = null) =>
  asOptionalString(value) ?? fallback

const asNullableNumber = (value: unknown, fallback: number | null = null) => {
  if (value === null || value === undefined || value === '') return fallback
  return asNumber(value, fallback ?? 0)
}

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = asOptionalString(value)
    if (text) return text
  }
  return null
}

const defaultWeeklyOperatingHours = () => [1, 2, 3, 4, 5, 6, 7].map(day => ({
  day_of_week: day,
  channel_type: 'ALL',
  open_time: '10:00',
  close_time: '22:00',
  is_closed: false,
}))

const normalizeOperatingHours = (value: unknown) => {
  const items = asRecordList(value)
  if (items.length === 0) {
    return defaultWeeklyOperatingHours()
  }
  return items.map((item, index) => ({
    hours_id: asNullableString(item.hours_id) ?? `hours-${index + 1}`,
    day_of_week: asNumber(item.day_of_week ?? item.weekday, index + 1),
    channel_type: asString(item.channel_type, 'ALL'),
    open_time: asString(item.open_time ?? item.start, '10:00'),
    close_time: asString(item.close_time ?? item.end, '22:00'),
    is_closed: asBoolean(item.is_closed, false),
  }))
}

const normalizeSpecialOperatingDays = (value: unknown) =>
  asRecordList(value).map((item, index) => ({
    special_day_id: asNullableString(item.special_day_id) ?? `special-day-${index + 1}`,
    date: asNullableString(item.date),
    is_closed: asBoolean(item.is_closed, false),
    open_time: asNullableString(item.open_time),
    close_time: asNullableString(item.close_time),
    note: asNullableString(item.note),
  })).filter(item => item.date)

const normalizeOperatingTimeSlots = (value: unknown) =>
  asRecordList(value).map((item, index) => ({
    slot_id: asNullableString(item.slot_id) ?? `slot-${index + 1}`,
    slot_name: asString(item.slot_name ?? item.name, `时段${index + 1}`),
    start_time: asString(item.start_time ?? item.open_time ?? item.start, '10:00'),
    end_time: asString(item.end_time ?? item.close_time ?? item.end, '22:00'),
    menu_id: asNullableString(item.menu_id),
    accept_order_before_minutes: asNumber(item.accept_order_before_minutes, 0),
    stop_order_before_minutes: asNumber(item.stop_order_before_minutes, 0),
  }))

const normalizeStoreOperatingHours = (value: unknown) => {
  const items = asRecordList(value)
  if (items.length === 0) {
    return defaultWeeklyOperatingHours().map(item => ({
      day_of_week: item.day_of_week,
      time_slots: [{
        slot_id: `default-${item.day_of_week}`,
        slot_name: '全天营业',
        start_time: item.open_time,
        end_time: item.close_time,
        menu_id: null,
        accept_order_before_minutes: 0,
        stop_order_before_minutes: 0,
      }],
      is_closed: false,
    }))
  }
  return items.map((item, index) => {
    const timeSlots = normalizeOperatingTimeSlots(item.time_slots)
    return {
      day_of_week: asNumber(item.day_of_week ?? item.weekday, index + 1),
      time_slots: timeSlots.length
        ? timeSlots
        : normalizeOperatingTimeSlots([{
          slot_name: asOptionalString(item.slot_name) ?? '全天营业',
          start_time: item.open_time ?? item.start,
          end_time: item.close_time ?? item.end,
          menu_id: item.menu_id,
        }]),
      is_closed: asBoolean(item.is_closed, false),
    }
  })
}

const normalizeExtraChargeRules = (value: unknown) =>
  asRecordList(value).map((item, index) => ({
    extra_charge_id: asNullableString(item.extra_charge_id ?? item.rule_id) ?? `extra-charge-${index + 1}`,
    charge_name: asString(item.charge_name ?? item.rule_name ?? item.name, `附加费${index + 1}`),
    charge_type: asString(item.charge_type, 'SERVICE_FEE'),
    calc_way: asString(item.calc_way ?? item.calc_type, 'FIXED'),
    calc_amount: asNumber(item.calc_amount ?? item.amount, 0),
    apply_scenes: asUpperStringList(item.apply_scenes ?? item.scenes),
    auto_add_to_order: asBoolean(item.auto_add_to_order, true),
    calc_after_discount: asBoolean(item.calc_after_discount, true),
    allow_discount: asBoolean(item.allow_discount, false),
    enabled: asBoolean(item.enabled, true),
  }))

const customerDemoAssetUrl = (kind: 'brand-logo' | 'product-image' | 'menu-product-image', fileName: string) => {
  const sandboxId = customerDemoIdentity.sandboxId
  const filePath = path.join(customerDemoAssetRoot, sandboxId, kind, fileName)
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    const label = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 28)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#dbe4ee"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#bg)"/>
  <rect x="60" y="60" width="840" height="520" rx="26" fill="#ffffff" stroke="#b7c3d0" stroke-width="2"/>
  <circle cx="185" cy="190" r="74" fill="#1f6f78" opacity="0.88"/>
  <rect x="300" y="150" width="480" height="34" rx="17" fill="#27323f" opacity="0.9"/>
  <rect x="300" y="220" width="380" height="24" rx="12" fill="#5b6775" opacity="0.65"/>
  <rect x="300" y="270" width="430" height="24" rx="12" fill="#5b6775" opacity="0.42"/>
  <text x="90" y="500" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="#27323f">${label}</text>
</svg>`
    fs.writeFileSync(filePath, svg)
  }
  return `${customerDemoAssetBaseUrl}/uploads/customer-assets/${sandboxId}/${kind}/${fileName}`
}

const customerDemoMutation = (idempotencyKey: string): MutationInput => ({
  sandboxId: customerDemoIdentity.sandboxId,
  actorType: 'SEED',
  actorId: 'customer-demo-seed',
  idempotencyKey,
})

const ensureCustomerDemoIamMasterData = () => {
  const sandboxId = customerDemoIdentity.sandboxId
  const platformId = customerDemoIdentity.platformId
  if (!getEntityRow('platform', platformId, sandboxId)) {
    return
  }

  const primaryStoreId = customerDemoIdentity.primaryStoreId
  const permissions = [
    ['perm-longfor-platform-view', 'platform:view', '查看集团主数据', 'platform', 'view'],
    ['perm-longfor-project-manage', 'project:manage', '维护项目与分期', 'project', 'manage'],
    ['perm-longfor-contract-manage', 'contract:manage', '维护经营合同', 'contract', 'manage'],
    ['perm-longfor-menu-manage', 'menu:manage', '维护菜单', 'menu', 'manage'],
    ['perm-longfor-store-config-manage', 'store-config:manage', '维护门店经营参数', 'store-config', 'manage'],
    ['perm-longfor-iam-manage', 'iam:manage', '维护角色与授权', 'iam', 'manage'],
  ] as const

  createPermissionGroup({
    permissionGroupId: 'permission-group-longfor-master-data',
    platformId,
    groupCode: 'MASTER_DATA',
    groupName: '主数据管理',
    sortOrder: 10,
    mutation: customerDemoMutation('customer-demo-permission-group'),
  })
  permissions.forEach(([permissionId, permissionCode, permissionName, resource, action]) => createPermission({
    permissionId,
    permissionCode,
    permissionName,
    platformId,
    permissionType: 'SYSTEM',
    module: 'customer-master-data',
    resource,
    resourceType: resource,
    action,
    permissionGroupId: 'permission-group-longfor-master-data',
    mutation: customerDemoMutation(`customer-demo-permission-${permissionId}`),
  }))
  createRole({
    roleId: 'role-longfor-platform-master-admin',
    roleCode: 'PLATFORM_MASTER_ADMIN',
    roleName: '集团主数据管理员',
    platformId,
    scopeType: 'PLATFORM',
    roleType: 'SYSTEM',
    permissionIds: permissions.map(([permissionId]) => permissionId),
    mutation: customerDemoMutation('customer-demo-role-platform-admin'),
  })
  createRole({
    roleId: 'role-longfor-store-operator',
    roleCode: 'STORE_OPERATOR',
    roleName: '门店资料维护员',
    platformId,
    scopeType: 'STORE',
    roleType: 'CUSTOM',
    permissionIds: ['perm-longfor-platform-view', 'perm-longfor-menu-manage', 'perm-longfor-store-config-manage'],
    mutation: customerDemoMutation('customer-demo-role-store-operator'),
  })
  createRoleTemplate({
    templateId: 'role-template-longfor-store-operator',
    platformId,
    templateCode: 'STORE_OPERATOR_TEMPLATE',
    templateName: '门店资料维护模板',
    basePermissionIds: ['perm-longfor-platform-view', 'perm-longfor-menu-manage', 'perm-longfor-store-config-manage'],
    recommendedScopeType: 'STORE',
    industryTags: ['餐饮', '零售'],
    mutation: customerDemoMutation('customer-demo-role-template'),
  })
  createUser({
    userId: 'user-longfor-admin',
    userCode: 'longfor.admin',
    username: 'longfor.admin',
    displayName: '顾一鸣',
    mobile: '13900003001',
    email: 'admin@longfor.example',
    userType: 'TENANT_STAFF',
    platformId,
    mutation: customerDemoMutation('customer-demo-user-admin'),
  })
  createUser({
    userId: 'user-butterful-store-manager',
    userCode: 'butterful.manager',
    username: 'butterful.manager',
    displayName: '周店长',
    mobile: '13900003002',
    email: 'manager@butterful.example',
    userType: 'STORE_STAFF',
    storeId: primaryStoreId,
    mutation: customerDemoMutation('customer-demo-user-store-manager'),
  })
  createUserRoleBinding({
    bindingId: 'binding-longfor-admin-platform',
    userId: 'user-longfor-admin',
    roleId: 'role-longfor-platform-master-admin',
    resourceScope: {scope_type: 'ORG_NODE', org_node_type: 'platform', org_node_ids: [platformId]},
    policyEffect: 'ALLOW',
    mutation: customerDemoMutation('customer-demo-binding-platform-admin'),
  })
  createUserRoleBinding({
    bindingId: 'binding-butterful-manager-store',
    userId: 'user-butterful-store-manager',
    roleId: 'role-longfor-store-operator',
    storeId: primaryStoreId,
    resourceScope: {scope_type: 'RESOURCE_IDS', resource_type: 'store', resource_ids: [primaryStoreId]},
    policyEffect: 'ALLOW',
    mutation: customerDemoMutation('customer-demo-binding-store-manager'),
  })
  createPrincipalGroup({
    groupId: 'principal-group-longfor-project-ops',
    platformId,
    groupCode: 'PROJECT_OPS',
    groupName: '项目运营组',
    groupType: 'MANUAL',
    mutation: customerDemoMutation('customer-demo-principal-group'),
  })
  addGroupMember({
    memberId: 'group-member-longfor-admin-project-ops',
    groupId: 'principal-group-longfor-project-ops',
    userId: 'user-longfor-admin',
    joinedBy: 'customer-demo-seed',
    mutation: customerDemoMutation('customer-demo-group-member'),
  })
  createGroupRoleBinding({
    groupBindingId: 'group-binding-project-ops-platform-view',
    groupId: 'principal-group-longfor-project-ops',
    roleId: 'role-longfor-store-operator',
    resourceScope: {scope_type: 'ORG_NODE', org_node_type: 'project', org_node_ids: [customerDemoIdentity.primaryProjectId]},
    mutation: customerDemoMutation('customer-demo-group-binding'),
  })
  createResourceTag({
    tagId: 'tag-store-butterful-key-account',
    platformId,
    tagKey: 'store_segment',
    tagValue: 'KEY_ACCOUNT',
    tagLabel: '重点门店',
    resourceType: 'store',
    resourceId: primaryStoreId,
    mutation: customerDemoMutation('customer-demo-resource-tag'),
  })
  createIdentityProviderConfig({
    idpId: 'idp-longfor-local',
    platformId,
    idpName: '龙湖本地账号',
    idpType: 'LOCAL',
    applicableUserTypes: ['TENANT_STAFF', 'STORE_STAFF'],
    priority: 10,
    mutation: customerDemoMutation('customer-demo-idp'),
  })
  createFeaturePoint({
    featurePointId: 'feature-longfor-customer-master-data',
    platformId,
    featureCode: 'CUSTOMER_MASTER_DATA',
    featureName: '主数据后台',
    defaultEnabled: true,
    mutation: customerDemoMutation('customer-demo-feature-point'),
  })
  upsertPlatformFeatureSwitch({
    switchId: 'switch-longfor-customer-master-data',
    platformId,
    featureCode: 'CUSTOMER_MASTER_DATA',
    isEnabled: true,
    enabledBy: 'customer-demo-seed',
    mutation: customerDemoMutation('customer-demo-feature-switch'),
  })
  createAuthorizationSession({
    sessionId: 'auth-session-longfor-admin-platform',
    userId: 'user-longfor-admin',
    platformId,
    activatedBindingIds: ['binding-longfor-admin-platform', 'group-binding-project-ops-platform-view'],
    workingScope: {scope_type: 'ORG_NODE', org_node_type: 'platform', org_node_ids: [platformId]},
    sessionToken: 'longfor-admin-demo-session-token',
    expiresAt: '2026-12-31T23:59:59.000Z',
    mfaVerifiedAt: '2026-04-25T09:00:00.000Z',
    mfaExpiresAt: '2026-04-25T09:30:00.000Z',
    mfaMethod: 'TOTP',
    mutation: customerDemoMutation('customer-demo-auth-session-admin'),
  })
  createAuthorizationSession({
    sessionId: 'auth-session-butterful-manager-store',
    userId: 'user-butterful-store-manager',
    platformId,
    activatedBindingIds: ['binding-butterful-manager-store'],
    workingScope: {scope_type: 'RESOURCE_IDS', resource_type: 'store', resource_ids: [primaryStoreId]},
    sessionToken: 'butterful-manager-demo-session-token',
    expiresAt: '2026-12-31T23:59:59.000Z',
    mfaMethod: 'SMS',
    mutation: customerDemoMutation('customer-demo-auth-session-store-manager'),
  })
  createSeparationOfDutyRule({
    sodRuleId: 'sod-longfor-contract-iam',
    platformId,
    ruleName: '合同与权限维护职责分离',
    ruleDescription: '同一用户不建议同时拥有合同维护和 IAM 管理权限。',
    conflictingPermCodes: ['contract:manage', 'iam:manage'],
    mutation: customerDemoMutation('customer-demo-sod'),
  })
  createHighRiskPermissionPolicy({
    policyId: 'risk-longfor-iam-manage',
    platformId,
    permissionCode: 'iam:manage',
    requireApproval: true,
    approverRoleCode: 'PLATFORM_MASTER_ADMIN',
    maxDurationDays: 30,
    requireMfa: true,
    mutation: customerDemoMutation('customer-demo-high-risk-policy'),
  })
  ensureCustomerDemoAuthAuditLog({
    logId: 'auth-audit-longfor-store-manager-menu-manage-allow',
    userId: 'user-butterful-store-manager',
    resourceId: primaryStoreId,
    action: 'CHECK_PERMISSION',
    permissionCode: 'menu:manage',
    result: 'ALLOWED',
    detail: {
      allowed: true,
      userId: 'user-butterful-store-manager',
      storeId: primaryStoreId,
      permissionCode: 'menu:manage',
      matchedBindingIds: ['binding-butterful-manager-store'],
      matchedRoleIds: ['role-longfor-store-operator'],
      reason: 'ROLE_PERMISSION_MATCH',
      decisionSource: 'customer-demo-seed',
    },
  })
  ensureCustomerDemoAuthAuditLog({
    logId: 'auth-audit-longfor-store-manager-iam-manage-deny',
    userId: 'user-butterful-store-manager',
    resourceId: primaryStoreId,
    action: 'CHECK_PERMISSION',
    permissionCode: 'iam:manage',
    result: 'DENIED',
    denyReason: 'NO_MATCHING_ROLE_PERMISSION',
    detail: {
      allowed: false,
      userId: 'user-butterful-store-manager',
      storeId: primaryStoreId,
      permissionCode: 'iam:manage',
      matchedBindingIds: [],
      matchedRoleIds: [],
      reason: 'NO_MATCHING_ROLE_PERMISSION',
      decisionSource: 'customer-demo-seed',
    },
  })
}

const ensureCustomerDemoMasterData = () => {
  const sandboxId = customerDemoIdentity.sandboxId
  const platformId = customerDemoIdentity.platformId
  if (getEntityRow('platform', platformId, sandboxId)) {
    ensureCustomerDemoIamMasterData()
    return
  }

  createSandbox({
    sandboxId,
    sandboxCode: 'CUSTOMER_REAL_RETAIL_20260425',
    sandboxName: '真实商业综合体联调沙箱',
    sandboxType: 'DEMO',
    description: '用于 /customer 管理后台与终端主数据投射联调的非生产主数据沙箱。',
    owner: '主数据联调团队',
    mutation: customerDemoMutation('customer-demo-create-sandbox'),
  })

  createPlatform({
    platformId,
    platformCode: 'LONGFOR_PARADISE_WALK',
    platformName: '龙湖商业集团',
    platformShortName: '龙湖商业',
    description: '覆盖购物中心、租户、品牌、门店、菜单、经营配置与权限的主数据联调集团。',
    contactName: '集团主数据运营部',
    contactPhone: '400-600-2026',
    contactEmail: 'masterdata@longfor.example',
    address: '北京市朝阳区商业运营中心',
    isvConfig: {
      providerType: 'LOCAL_MOCK_ISV',
      appKey: 'longfor-demo-app-key',
      appSecret: 'longfor-demo-app-secret',
      isvToken: 'longfor-demo-token',
      tokenExpireAt: '2027-12-31T23:59:59.000Z',
      channelStatus: 'ACTIVE',
    },
    metadataCatalog: {
      ...defaultPlatformMetadataCatalog,
      regions: [
        platformMetadataOption('SOUTHWEST', '西南大区', {region_id: 'region-longfor-southwest', region_code: 'SOUTHWEST', region_name: '西南大区', region_level: 1}),
        platformMetadataOption('NORTH_CHINA', '华北大区', {region_id: 'region-longfor-north-china', region_code: 'NORTH_CHINA', region_name: '华北大区', region_level: 1}),
        platformMetadataOption('EAST_CHINA', '华东大区', {region_id: 'region-longfor-east-china', region_code: 'EAST_CHINA', region_name: '华东大区', region_level: 1}),
      ],
      project_business_modes: [
        platformMetadataOption('SHOPPING_MALL', '购物中心'),
        platformMetadataOption('OUTLET_MALL', '奥莱'),
        platformMetadataOption('DEPARTMENT_STORE', '百货'),
        platformMetadataOption('MIXED_USE', '商业综合体'),
      ],
      brand_categories: [
        platformMetadataOption('BAKERY', '烘焙甜品'),
        platformMetadataOption('CHINESE_CUISINE', '中式正餐'),
        platformMetadataOption('COFFEE', '咖啡轻食'),
        platformMetadataOption('TEA_DRINK', '茶饮'),
        platformMetadataOption('RETAIL', '零售'),
      ],
      store_business_scenarios: [
        platformMetadataOption('DINE_IN', '堂食'),
        platformMetadataOption('TAKEAWAY', '外带'),
        platformMetadataOption('DELIVERY', '外卖配送'),
        platformMetadataOption('PICKUP', '自提'),
        platformMetadataOption('RESERVATION', '预约到店'),
      ],
      table_areas: [
        platformMetadataOption('HALL', '大厅'),
        platformMetadataOption('PRIVATE_ROOM', '包房'),
        platformMetadataOption('TERRACE', '露台'),
      ],
      table_types: [
        platformMetadataOption('HALL', '大厅桌'),
        platformMetadataOption('PRIVATE_ROOM', '包房桌'),
        platformMetadataOption('BOOTH', '卡座'),
        platformMetadataOption('BAR', '吧台位'),
      ],
      workstation_types: [
        platformMetadataOption('PRODUCTION', '制作站'),
        platformMetadataOption('PACKING', '打包站'),
        platformMetadataOption('DELIVERY_HANDOFF', '配送交接站'),
        platformMetadataOption('POS', '收银工作站'),
        platformMetadataOption('KDS', '厨房屏'),
      ],
      production_categories: [
        platformMetadataOption('BAKERY', '烘焙'),
        platformMetadataOption('DRINK', '饮品'),
        platformMetadataOption('HOT_DISH', '热厨'),
        platformMetadataOption('COLD_DISH', '冷厨'),
        platformMetadataOption('PACKING', '打包'),
      ],
    },
    externalPlatformId: 'longfor-paradise-walk-demo',
    syncedAt: '2026-04-25T09:00:00.000Z',
    version: 1,
    mutation: customerDemoMutation('customer-demo-create-platform'),
  })

  createRegion({
    regionId: 'region-longfor-southwest',
    platformId,
    regionCode: 'SOUTHWEST',
    regionName: '西南大区',
    regionLevel: 1,
    mutation: customerDemoMutation('customer-demo-region-southwest'),
  })
  createRegion({
    regionId: 'region-longfor-north-china',
    platformId,
    regionCode: 'NORTH_CHINA',
    regionName: '华北大区',
    regionLevel: 1,
    mutation: customerDemoMutation('customer-demo-region-north'),
  })

  createProject({
    projectId: customerDemoIdentity.primaryProjectId,
    projectCode: 'CD_BINJIANG_TJ',
    projectName: '成都滨江天街',
    projectShortName: '滨江天街',
    platformId,
    regionId: 'region-longfor-southwest',
    region: {region_id: 'region-longfor-southwest', region_code: 'SOUTHWEST', region_name: '西南大区', region_level: 1},
    province: '四川省',
    city: '成都市',
    address: '成都市锦江区东大街滨江商业区',
    businessMode: 'SHOPPING_MALL',
    projectPhases: [
      {phase_id: 'phase-1', phase_name: '一期', owner_name: '成都滨江天街商业管理有限公司', owner_contact: '唐经理', owner_phone: '028-6000-1001'},
      {phase_id: 'phase-2', phase_name: '二期', owner_name: '成都滨江天街置业有限公司', owner_contact: '陈经理', owner_phone: '028-6000-1002'},
    ],
    mutation: customerDemoMutation('customer-demo-project-cd-binjiang'),
  })
  createProject({
    projectId: customerDemoIdentity.secondaryProjectId,
    projectCode: 'BJ_CHANGYING_TJ',
    projectName: '北京长楹天街',
    projectShortName: '长楹天街',
    platformId,
    regionId: 'region-longfor-north-china',
    region: {region_id: 'region-longfor-north-china', region_code: 'NORTH_CHINA', region_name: '华北大区', region_level: 1},
    province: '北京市',
    city: '北京市',
    address: '北京市朝阳区常营商业区',
    businessMode: 'MIXED_USE',
    projectPhases: [
      {phase_id: 'phase-1', phase_name: '一期', owner_name: '北京长楹天街商业管理有限公司', owner_contact: '李经理', owner_phone: '010-6000-2001'},
    ],
    mutation: customerDemoMutation('customer-demo-project-bj-changying'),
  })

  const tenants = [
    {
      id: 'tenant-longfor-butterful',
      code: 'LONGFOR_BUTTERFUL_TENANT',
      name: 'Butterful & Creamorous 零售运营公司',
      company: '成都黄油满满餐饮管理有限公司',
      credit: '91510100MABUTTER01',
      representative: '林若溪',
      contact: '王琳',
      phone: '13800001001',
      entityId: 'entity-longfor-butterful-settlement',
      entityCode: 'ENTITY_BUTTERFUL_SETTLEMENT',
      bank: '招商银行成都分行',
    },
    {
      id: 'tenant-longfor-xibei',
      code: 'LONGFOR_XIBEI_TENANT',
      name: '西贝莜面村商业服务公司',
      company: '成都西贝餐饮管理有限公司',
      credit: '91510100MAXIBEI002',
      representative: '贾立国',
      contact: '赵敏',
      phone: '13800001002',
      entityId: 'entity-longfor-xibei-settlement',
      entityCode: 'ENTITY_XIBEI_SETTLEMENT',
      bank: '中国银行成都分行',
    },
    {
      id: 'tenant-longfor-manner',
      code: 'LONGFOR_MANNER_TENANT',
      name: 'Manner Coffee 城市发展公司',
      company: '上海茵赫实业有限公司成都分公司',
      credit: '91510100MAMANNER03',
      representative: '韩川',
      contact: '周宁',
      phone: '13800001003',
      entityId: 'entity-longfor-manner-settlement',
      entityCode: 'ENTITY_MANNER_SETTLEMENT',
      bank: '浦发银行成都分行',
    },
  ]
  tenants.forEach(tenant => {
    createTenant({
      tenantId: tenant.id,
      tenantCode: tenant.code,
      tenantName: tenant.name,
      platformId,
      companyName: tenant.company,
      unifiedSocialCreditCode: tenant.credit,
      legalRepresentative: tenant.representative,
      contactName: tenant.contact,
      contactPhone: tenant.phone,
      contactEmail: `${tenant.code.toLowerCase()}@tenant.example`,
      tenantType: 'CHAIN_BRAND',
      businessModel: 'MIXED',
      invoiceTitle: tenant.company,
      settlementCycle: 'MONTHLY',
      billingEmail: `billing-${tenant.code.toLowerCase()}@tenant.example`,
      mutation: customerDemoMutation(`customer-demo-tenant-${tenant.id}`),
    })
    createBusinessEntity({
      entityId: tenant.entityId,
      entityCode: tenant.entityCode,
      entityName: `${tenant.company}结算主体`,
      tenantId: tenant.id,
      companyName: tenant.company,
      unifiedSocialCreditCode: tenant.credit,
      legalRepresentative: tenant.representative,
      bankName: tenant.bank,
      bankAccountName: tenant.company,
      bankAccountNo: `6222026000${tenant.id.length}8888`,
      taxpayerType: 'GENERAL_TAXPAYER',
      taxRate: 0.06,
      settlementCycle: 'MONTHLY',
      settlementDay: 5,
      autoSettlementEnabled: true,
      mutation: customerDemoMutation(`customer-demo-entity-${tenant.entityId}`),
    })
  })

  const brands = [
    {id: customerDemoIdentity.primaryBrandId, code: 'BUTTERFUL', name: 'Butterful & Creamorous', category: 'BAKERY', logo: 'brand-butterful.svg'},
    {id: 'brand-longfor-xibei', code: 'XIBEI', name: '西贝莜面村', category: 'CHINESE_CUISINE', logo: 'brand-xibei.svg'},
    {id: 'brand-longfor-manner', code: 'MANNER', name: 'Manner Coffee', category: 'COFFEE', logo: 'brand-manner.svg'},
    {id: 'brand-longfor-heytea', code: 'HEYTEA', name: '喜茶', category: 'TEA_DRINK', logo: 'brand-heytea.svg'},
  ]
  brands.forEach(brand => createBrand({
    brandId: brand.id,
    brandCode: brand.code,
    brandName: brand.name,
    platformId,
    brandCategory: brand.category,
    brandLogoUrl: customerDemoAssetUrl('brand-logo', brand.logo),
    brandDescription: `${brand.name} 在龙湖商业集团下统一维护品牌、菜单和经营主数据。`,
    standardMenuEnabled: true,
    standardPricingLocked: false,
    erpIntegrationEnabled: brand.code !== 'HEYTEA',
    erpApiEndpoint: brand.code !== 'HEYTEA' ? `https://erp.example/${brand.code.toLowerCase()}` : undefined,
    mutation: customerDemoMutation(`customer-demo-brand-${brand.id}`),
  }))

  const stores = [
    {
      id: customerDemoIdentity.primaryStoreId,
      code: 'CD_BJ_BUTTERFUL_B101',
      name: 'Butterful 成都滨江天街店',
      projectId: customerDemoIdentity.primaryProjectId,
      unit: 'B1-101',
      floor: 'B1',
      area: 138,
      type: 'LEASE',
      format: 'RESTAURANT',
      scenarios: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PICKUP'],
      tenantId: 'tenant-longfor-butterful',
      brandId: customerDemoIdentity.primaryBrandId,
      entityId: 'entity-longfor-butterful-settlement',
      phaseId: 'phase-1',
      contractId: 'contract-cd-bj-butterful-2026',
      contractNo: 'BJ-TJ-2026-BUTTERFUL-B101',
    },
    {
      id: 'store-cd-binjiang-xibei',
      code: 'CD_BJ_XIBEI_L401',
      name: '西贝莜面村成都滨江天街店',
      projectId: customerDemoIdentity.primaryProjectId,
      unit: 'L4-401',
      floor: 'L4',
      area: 420,
      type: 'LEASE',
      format: 'RESTAURANT',
      scenarios: ['DINE_IN', 'TAKEAWAY', 'RESERVATION'],
      tenantId: 'tenant-longfor-xibei',
      brandId: 'brand-longfor-xibei',
      entityId: 'entity-longfor-xibei-settlement',
      phaseId: 'phase-2',
      contractId: 'contract-cd-bj-xibei-2026',
      contractNo: 'BJ-TJ-2026-XIBEI-L401',
    },
    {
      id: 'store-cd-binjiang-manner',
      code: 'CD_BJ_MANNER_L118',
      name: 'Manner Coffee 成都滨江天街店',
      projectId: customerDemoIdentity.primaryProjectId,
      unit: 'L1-118',
      floor: 'L1',
      area: 86,
      type: 'LEASE',
      format: 'RESTAURANT',
      scenarios: ['DINE_IN', 'TAKEAWAY', 'PICKUP'],
      tenantId: 'tenant-longfor-manner',
      brandId: 'brand-longfor-manner',
      entityId: 'entity-longfor-manner-settlement',
      phaseId: 'phase-1',
      contractId: 'contract-cd-bj-manner-2026',
      contractNo: 'BJ-TJ-2026-MANNER-L118',
    },
    {
      id: 'store-bj-changying-butterful',
      code: 'BJ_CY_BUTTERFUL_L215',
      name: 'Butterful 北京长楹天街店',
      projectId: customerDemoIdentity.secondaryProjectId,
      unit: 'L2-215',
      floor: 'L2',
      area: 122,
      type: 'LEASE',
      format: 'RESTAURANT',
      scenarios: ['DINE_IN', 'TAKEAWAY', 'PICKUP'],
      tenantId: 'tenant-longfor-butterful',
      brandId: customerDemoIdentity.primaryBrandId,
      entityId: 'entity-longfor-butterful-settlement',
      phaseId: 'phase-1',
      contractId: 'contract-bj-cy-butterful-2026',
      contractNo: 'CY-TJ-2026-BUTTERFUL-L215',
    },
    {
      id: 'store-cd-binjiang-vacant',
      code: 'CD_BJ_VACANT_L305',
      name: '成都滨江天街 L3-305 空置铺位',
      projectId: customerDemoIdentity.primaryProjectId,
      unit: 'L3-305',
      floor: 'L3',
      area: 96,
      type: 'LEASE',
      format: 'SERVICE',
      scenarios: [],
      tenantId: null,
      brandId: null,
      entityId: null,
      phaseId: 'phase-1',
      contractId: null,
      contractNo: null,
    },
  ]
  stores.forEach(store => {
    createStore({
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      unitCode: store.unit,
      storeType: store.type,
      businessFormat: store.format,
      cooperationMode: store.type,
      businessScenarios: store.scenarios,
      floor: store.floor,
      areaSqm: store.area,
      floorArea: store.area,
      addressDetail: `${store.floor} ${store.unit}`,
      storeManager: '门店主数据负责人',
      managerPhone: '13800002000',
      projectId: store.projectId,
      mutation: customerDemoMutation(`customer-demo-store-${store.id}`),
    })
    if (store.contractId && store.tenantId && store.brandId && store.entityId && store.contractNo) {
      createContract({
        contractId: store.contractId,
        contractCode: store.contractNo,
        contractNo: store.contractNo,
        storeId: store.id,
        lessorProjectId: store.projectId,
        lessorPhaseId: store.phaseId,
        tenantId: store.tenantId,
        brandId: store.brandId,
        entityId: store.entityId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        commissionType: 'FIXED_RATE',
        commissionRate: 8,
        depositAmount: 100000,
        mutation: customerDemoMutation(`customer-demo-contract-${store.contractId}`),
      })
      activateContract({
        contractId: store.contractId,
        remark: '演示主数据初始化生效合同',
        mutation: customerDemoMutation(`customer-demo-activate-${store.contractId}`),
      })
    }
  })

  const primaryStore = stores[0]
  const primaryStoreId = primaryStore.id
  const products = [
    {
      id: 'product-butterful-croissant',
      code: 'BF_CROISSANT',
      name: '经典黄油可颂',
      type: 'SINGLE',
      category: 'category-butterful-bakery',
      image: 'product-croissant.svg',
      price: 28,
      steps: [{step_code: 'BAKE', step_name: '复烤', workstation_type: 'PRODUCTION', estimated_duration: 180}],
    },
    {
      id: 'product-butterful-latte',
      code: 'BF_LATTE',
      name: '燕麦拿铁',
      type: 'SINGLE',
      category: 'category-butterful-drink',
      image: 'product-latte.svg',
      price: 32,
      steps: [{step_code: 'DRINK', step_name: '饮品制作', workstation_type: 'PRODUCTION', estimated_duration: 150}],
    },
    {
      id: 'product-butterful-cheesecake',
      code: 'BF_CHEESECAKE',
      name: '巴斯克芝士蛋糕',
      type: 'SINGLE',
      category: 'category-butterful-dessert',
      image: 'product-cheesecake.svg',
      price: 36,
      steps: [{step_code: 'PLATE', step_name: '切配装盘', workstation_type: 'PRODUCTION', estimated_duration: 120}],
    },
  ]
  createProductCategory({
    categoryId: 'category-butterful-bakery',
    categoryCode: 'BAKERY',
    categoryName: '烘焙',
    ownershipScope: 'BRAND',
    brandId: customerDemoIdentity.primaryBrandId,
    sortOrder: 10,
    mutation: customerDemoMutation('customer-demo-category-bakery'),
  })
  createProductCategory({
    categoryId: 'category-butterful-drink',
    categoryCode: 'DRINK',
    categoryName: '饮品',
    ownershipScope: 'BRAND',
    brandId: customerDemoIdentity.primaryBrandId,
    sortOrder: 20,
    mutation: customerDemoMutation('customer-demo-category-drink'),
  })
  createProductCategory({
    categoryId: 'category-butterful-dessert',
    categoryCode: 'DESSERT',
    categoryName: '甜品',
    ownershipScope: 'BRAND',
    brandId: customerDemoIdentity.primaryBrandId,
    sortOrder: 30,
    mutation: customerDemoMutation('customer-demo-category-dessert'),
  })
  products.forEach(product => {
    createProduct({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      ownershipScope: 'BRAND',
      brandId: customerDemoIdentity.primaryBrandId,
      categoryId: product.category,
      productType: product.type,
      imageUrl: customerDemoAssetUrl('product-image', product.image),
      productDescription: `${product.name}，用于品牌标准菜单与门店菜单联调。`,
      allergenInfo: product.id.includes('latte') ? '含乳制品' : '含麸质、乳制品',
      tags: ['推荐', '门店热销'],
      basePrice: product.price,
      variants: [{variant_id: `${product.id}-default`, variant_name: '标准', price_delta: 0, is_default: true}],
      modifierGroups: product.id.includes('latte') ? [{modifier_group_id: 'modifier-milk', group_name: '奶基选择', selection_type: 'SINGLE', min_selections: 1, max_selections: 1, options: [{option_id: 'oat', option_name: '燕麦奶', price_delta: 0}]}] : [],
      productionProfile: {complexity_level: 'STANDARD', production_steps: product.steps},
      productionSteps: product.steps,
      mutation: customerDemoMutation(`customer-demo-product-${product.id}`),
    })
    changeEntityStatus({
      entityType: 'product',
      entityId: product.id,
      status: 'ACTIVE',
      eventType: 'ProductActivated',
      mutation: customerDemoMutation(`customer-demo-product-active-${product.id}`),
    })
  })

  createBrandMenu({
    brandMenuId: 'brand-menu-butterful-standard-2026',
    brandId: customerDemoIdentity.primaryBrandId,
    menuName: 'Butterful 标准菜单 2026',
    channelType: 'ALL',
    menuType: 'FULL_DAY',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    allowStoreOverride: true,
    overrideScope: {price_overridable: true, image_overridable: true, availability_overridable: true},
    reviewStatus: 'NONE',
    sections: [
      {
        section_id: 'section-butterful-signature',
        section_name: '招牌烘焙',
        section_type: 'CATEGORY',
        display_style: 'GRID',
        products: [
          {product_id: 'product-butterful-croissant', standard_price: 28, is_featured: true, is_mandatory: true, display_order: 10},
          {product_id: 'product-butterful-cheesecake', standard_price: 36, is_featured: true, display_order: 20},
        ],
      },
      {
        section_id: 'section-butterful-drinks',
        section_name: '咖啡饮品',
        section_type: 'CATEGORY',
        display_style: 'LIST',
        products: [
          {product_id: 'product-butterful-latte', standard_price: 32, is_featured: true, display_order: 10},
        ],
      },
    ],
    publishedBy: '集团菜单运营',
    reviewComment: '演示标准菜单',
    mutation: customerDemoMutation('customer-demo-brand-menu-butterful'),
  })
  updateBrandMenuReviewStatus({
    menuId: 'brand-menu-butterful-standard-2026',
    reviewStatus: 'PENDING_REVIEW',
    mutation: customerDemoMutation('customer-demo-brand-menu-submit'),
  })
  updateBrandMenuReviewStatus({
    menuId: 'brand-menu-butterful-standard-2026',
    reviewStatus: 'APPROVED',
    mutation: customerDemoMutation('customer-demo-brand-menu-approve'),
  })
  createStoreMenu({
    menuId: 'store-menu-cd-bj-butterful-2026',
    storeId: primaryStoreId,
    brandMenuId: 'brand-menu-butterful-standard-2026',
    menuName: 'Butterful 成都滨江天街店生效菜单',
    channelType: 'ALL',
    menuType: 'FULL_DAY',
    inheritMode: 'PARTIAL',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    version: 1,
    sections: [
      {
        section_id: 'section-butterful-store-signature',
        section_name: '门店推荐',
        section_type: 'CATEGORY',
        display_style: 'GRID',
        is_inherited: true,
        products: [
          {product_id: 'product-butterful-croissant', standard_price: 28, override_price: 30, is_featured: true, is_mandatory: true, is_inherited: true, display_order: 10},
          {product_id: 'product-butterful-latte', standard_price: 32, is_featured: true, is_inherited: true, daily_quota: 80, display_order: 20},
          {product_id: 'product-butterful-cheesecake', standard_price: 36, is_inherited: true, daily_quota: 32, display_order: 30},
        ],
      },
    ],
    mutation: customerDemoMutation('customer-demo-store-menu-butterful'),
  })

  createStoreConfig({
    configId: 'store-config-cd-bj-butterful',
    storeId: primaryStoreId,
    businessStatus: 'OPEN',
    operatingStatus: 'OPERATING',
    acceptOrder: true,
    autoAcceptEnabled: true,
    acceptTimeoutSeconds: 90,
    preparationBufferMinutes: 12,
    maxConcurrentOrders: 60,
    operatingHours: [1, 2, 3, 4, 5, 6, 7].map(day => ({day_of_week: day, time_slots: [{slot_name: '全天营业', start_time: '10:00', end_time: '22:00'}]})),
    specialOperatingDays: [{date: '2026-05-01', open_time: '10:00', close_time: '23:00', note: '五一延长营业'}],
    channelOperatingHours: [{channel_type: 'DELIVERY', day_of_week: 1, open_time: '10:30', close_time: '21:30'}],
    extraChargeRules: [{extra_charge_id: 'packaging-fee', charge_name: '打包服务费', charge_type: 'PACKAGING_FEE', calc_way: 'FIXED', calc_amount: 2, apply_scenes: ['TAKEAWAY', 'DELIVERY']}],
    refundStockPolicy: 'NO_RESTORE_AFTER_REFUND',
    mutation: customerDemoMutation('customer-demo-store-config-butterful'),
  })
  products.forEach((product, index) => {
    upsertSaleableStock({
      stockId: `stock-${primaryStoreId}-${product.id}`,
      storeId: primaryStoreId,
      productId: product.id,
      saleableQuantity: 100 - index * 18,
      totalQuantity: 120 - index * 18,
      soldQuantity: 12 + index * 6,
      reservedQuantity: 3 + index,
      safetyStock: 12,
      soldOutThreshold: 6,
      resetPolicy: 'DAILY',
      mutation: customerDemoMutation(`customer-demo-stock-${product.id}`),
    })
    upsertMenuAvailability({
      storeId: primaryStoreId,
      productId: product.id,
      available: true,
      effectiveFrom: '2026-04-25T00:00:00.000Z',
      mutation: customerDemoMutation(`customer-demo-availability-${product.id}`),
    })
  })
  createAvailabilityRule({
    ruleId: 'availability-rule-butterful-lunch-delivery',
    ruleCode: 'BUTTERFUL_LUNCH_DELIVERY',
    storeId: primaryStoreId,
    productId: 'product-butterful-croissant',
    ruleType: 'TIME_SLOT',
    channelType: 'DELIVERY',
    timeSlot: {start: '11:00', end: '14:00'},
    priority: 20,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.999Z',
    mutation: customerDemoMutation('customer-demo-availability-rule-butterful'),
  })
  createPriceRule({
    ruleId: 'price-rule-butterful-member-lunch',
    ruleCode: 'BUTTERFUL_MEMBER_LUNCH',
    ruleName: '会员午市立减',
    storeId: primaryStoreId,
    productId: 'product-butterful-latte',
    priceType: 'MEMBER',
    channelType: 'MINI_PROGRAM',
    discountType: 'AMOUNT_OFF',
    discountValue: 3,
    priceValue: 3,
    priceDelta: 0,
    timeSlot: {start: '11:00', end: '14:00'},
    daysOfWeek: ['1', '2', '3', '4', '5'],
    memberTier: 'REGULAR',
    priority: 30,
    applicableProductIds: ['product-butterful-latte'],
    mutation: customerDemoMutation('customer-demo-price-rule-butterful'),
  })

  ;[
    {id: 'table-butterful-a01', no: 'A01', name: 'A01 双人桌', area: 'HALL', type: 'HALL', capacity: 2, reservable: false, minimumSpend: null},
    {id: 'table-butterful-a02', no: 'A02', name: 'A02 四人桌', area: 'HALL', type: 'HALL', capacity: 4, reservable: true, minimumSpend: null},
    {id: 'table-butterful-p01', no: 'P01', name: 'P01 包房', area: 'PRIVATE_ROOM', type: 'PRIVATE_ROOM', capacity: 8, reservable: true, minimumSpend: 800},
  ].forEach(table => createTableEntity({
    tableId: table.id,
    storeId: primaryStoreId,
    tableNo: table.no,
    tableName: table.name,
    area: table.area,
    tableType: table.type,
    capacity: table.capacity,
    reservable: table.reservable,
    minimumSpend: table.minimumSpend,
    consumerDescription: table.minimumSpend ? '包房适合多人聚会，最低消费以门店公示为准。' : '适合日常堂食。',
    sortOrder: table.no === 'P01' ? 30 : Number(table.no.slice(1)) * 10,
    mutation: customerDemoMutation(`customer-demo-table-${table.id}`),
  }))
  ;[
    {id: 'workstation-butterful-bake', code: 'BAKE_STATION', name: '烘焙复烤工作站', type: 'PRODUCTION', categories: ['BAKERY']},
    {id: 'workstation-butterful-drink', code: 'DRINK_STATION', name: '咖啡饮品工作站', type: 'PRODUCTION', categories: ['DRINK']},
    {id: 'workstation-butterful-pack', code: 'PACK_STATION', name: '打包交付工作站', type: 'PACKING', categories: ['PACKING', 'BAKERY', 'DRINK']},
  ].forEach(workstation => createWorkstation({
    workstationId: workstation.id,
    storeId: primaryStoreId,
    workstationCode: workstation.code,
    workstationName: workstation.name,
    workstationType: workstation.type,
    responsibleCategories: workstation.categories,
    description: '仅维护工作站主数据和可处理品类，不承载出品任务队列。',
    mutation: customerDemoMutation(`customer-demo-workstation-${workstation.id}`),
  }))

  ensureCustomerDemoIamMasterData()
}

const normalizeProductVariants = (value: unknown, basePrice: number) =>
  asRecordList(value).map((item, index) => ({
    variant_id: asNullableString(item.variant_id) ?? `variant-${index + 1}`,
    variant_name: asString(item.variant_name ?? item.name, `规格${index + 1}`),
    price_delta: asNumber(item.price_delta, 0),
    sku_code: asNullableString(item.sku_code),
    is_default: asBoolean(item.is_default, index === 0),
    status: sanitizeStatus(item.status, 'ACTIVE'),
    sort_order: asNumber(item.sort_order, (index + 1) * 10),
    final_price: Math.max(1, basePrice + asNumber(item.price_delta, 0)),
  }))

const validateProductVariants = (variants: Array<Record<string, unknown>>, basePrice: number) => {
  const activeVariants = variants.filter(variant => asString(variant.status, 'ACTIVE') === 'ACTIVE')
  const defaultVariants = activeVariants.filter(variant => asBoolean(variant.is_default, false))
  if (variants.length > 0 && activeVariants.length === 0) {
    throw new HttpError(400, 'PRODUCT_ACTIVE_VARIANT_REQUIRED', '商品至少需要一个启用的规格')
  }
  if (defaultVariants.length > 1) {
    throw new HttpError(400, 'PRODUCT_DEFAULT_VARIANT_NOT_UNIQUE', '商品规格只能有一个默认规格')
  }
  const invalidVariant = variants.find(variant => basePrice + asNumber(variant.price_delta, 0) <= 0)
  if (invalidVariant) {
    throw new HttpError(400, 'INVALID_PRODUCT_VARIANT_PRICE', '商品规格最终价格必须大于 0', {
      variantId: asOptionalString(invalidVariant.variant_id),
    })
  }
}

const normalizeModifierGroups = (value: unknown) =>
  asRecordList(value).map((group, groupIndex) => {
    const groupName = asString(group.group_name ?? group.name, `加料组${groupIndex + 1}`)
    const groupId = asNullableString(group.group_id ?? group.modifier_group_id) ?? normalizeId(`modifier-group-${groupName}`)
    const selectionType = asString(group.selection_type, 'SINGLE')
    const modifiers = asRecordList(group.modifiers ?? group.options).map((item, itemIndex) => ({
      modifier_id: asNullableString(item.modifier_id ?? item.option_id) ?? normalizeId(`${groupId}-${asString(item.modifier_name ?? item.option_name ?? item.name, `option-${itemIndex + 1}`)}`),
      modifier_name: asString(item.modifier_name ?? item.option_name ?? item.name, `加料项${itemIndex + 1}`),
      price_delta: asNumber(item.price_delta, 0),
      is_default: asBoolean(item.is_default, false),
      is_active: asBoolean(item.is_active ?? item.enabled, true),
      sort_order: asNumber(item.sort_order, (itemIndex + 1) * 10),
      stock_sku_id: asNullableString(item.stock_sku_id),
      stock_deduction: asNumber(item.stock_deduction, 1),
      production_impact: asRecord(item.production_impact),
      visibility_conditions: asRecordList(item.visibility_conditions),
    }))
    return {
      group_id: groupId,
      modifier_group_id: groupId,
      group_name: groupName,
      selection_type: selectionType,
      is_required: asBoolean(group.is_required ?? group.required, false),
      min_selections: asNumber(group.min_selections, selectionType === 'SINGLE' ? 0 : 0),
      max_selections: asNumber(group.max_selections, selectionType === 'SINGLE' ? 1 : 0),
      sort_order: asNumber(group.sort_order, (groupIndex + 1) * 10),
      modifiers,
    }
  })

const validateModifierGroups = (groups: Array<Record<string, unknown>>) => {
  groups.forEach(group => {
    const groupId = asOptionalString(group.group_id) ?? asOptionalString(group.modifier_group_id)
    const selectionType = asString(group.selection_type, 'SINGLE').toUpperCase()
    const minSelections = asNumber(group.min_selections, 0)
    const maxSelections = asNumber(group.max_selections, selectionType === 'SINGLE' ? 1 : 0)
    const modifiers = asRecordList(group.modifiers)
    const activeModifiers = modifiers.filter(modifier => asBoolean(modifier.is_active, true))
    const defaultCount = activeModifiers.filter(modifier => asBoolean(modifier.is_default, false)).length
    if (selectionType === 'SINGLE' && maxSelections !== 1) {
      throw new HttpError(400, 'INVALID_MODIFIER_GROUP_SELECTION', '单选加料组最多只能选择一个加料项', {groupId})
    }
    if (maxSelections > 0 && minSelections > maxSelections) {
      throw new HttpError(400, 'INVALID_MODIFIER_GROUP_SELECTION', '加料组最少选择数不能大于最多选择数', {groupId})
    }
    if (asBoolean(group.is_required, false) && activeModifiers.length === 0) {
      throw new HttpError(400, 'MODIFIER_REQUIRED_OPTIONS_MISSING', '必选加料组必须至少包含一个启用加料项', {groupId})
    }
    if (maxSelections > 0 && defaultCount > maxSelections) {
      throw new HttpError(400, 'MODIFIER_DEFAULT_OPTIONS_EXCEEDED', '默认加料项数量不能超过最多选择数', {groupId})
    }
  })
}

const normalizeComboPricingStrategy = (value: unknown) => {
  const record = typeof value === 'string' ? {pricing_type: value} : asRecord(value)
  if (Object.keys(record).length === 0) {
    return null
  }
  return {
    pricing_type: asString(record.pricing_type, 'FIXED_TOTAL'),
    fixed_total_price: asNullableNumber(record.fixed_total_price),
    discount_type: asNullableString(record.discount_type),
    discount_value: asNullableNumber(record.discount_value),
    tiers: asRecordList(record.tiers),
  }
}

const normalizeComboItemGroups = (value: unknown) =>
  asRecordList(value).map((group, groupIndex) => {
    const groupName = asString(group.group_name ?? group.name, `套餐分组${groupIndex + 1}`)
    const groupId = asNullableString(group.group_id) ?? normalizeId(`combo-group-${groupName}`)
    const selectionType = asString(group.selection_type, 'SINGLE')
    return {
      group_id: groupId,
      group_name: groupName,
      selection_type: selectionType,
      min_selections: asNumber(group.min_selections, selectionType === 'SINGLE' ? 1 : 0),
      max_selections: asNumber(group.max_selections, selectionType === 'SINGLE' ? 1 : 1),
      is_required: asBoolean(group.is_required, true),
      sort_order: asNumber(group.sort_order, (groupIndex + 1) * 10),
      items: asRecordList(group.items).map((item, itemIndex) => ({
        product_id: asString(item.product_id, ''),
        quantity: asNumber(item.quantity, 1),
        is_default: asBoolean(item.is_default, itemIndex === 0),
        extra_price: asNumber(item.extra_price, 0),
      })).filter(item => item.product_id),
    }
  })

const normalizeComboItems = (value: unknown) =>
  asRecordList(value).map((item, index) => ({
    combo_item_id: asNullableString(item.combo_item_id) ?? `combo-item-${index + 1}`,
    item_product_id: asString(item.item_product_id ?? item.product_id, ''),
    quantity: asNumber(item.quantity, 1),
    item_category: asString(item.item_category, 'INCLUDED'),
    addon_price: asNumber(item.addon_price, 0),
    upsell_price: asNumber(item.upsell_price, 0),
    is_post_order_addable: asBoolean(item.is_post_order_addable, false),
    pricing_contribution: asString(item.pricing_contribution, 'INCLUDED'),
    replace_options: asRecordList(item.replace_options),
    sort_order: asNumber(item.sort_order, (index + 1) * 10),
  })).filter(item => item.item_product_id)

const collectComboProductIds = (data: Record<string, unknown>) => Array.from(new Set([
  ...asRecordList(data.combo_item_groups)
    .flatMap(group => asRecordList(group.items).map(item => asString(item.product_id, '')).filter(Boolean)),
  ...asRecordList(data.combo_items)
    .map(item => asString(item.item_product_id ?? item.product_id, '')).filter(Boolean),
]))

const assertComboProductReferences = (input: {data: Record<string, unknown>; productId: string; sandboxId: string}) => {
  const comboProductIds = collectComboProductIds(input.data)
  if (comboProductIds.length < 2) {
    throw new HttpError(400, 'COMBO_ITEMS_REQUIRED', '套餐商品必须维护至少两个子商品')
  }
  comboProductIds.forEach(productId => {
    if (productId === input.productId) {
      throw new HttpError(400, 'COMBO_ITEM_SELF_REFERENCE', '套餐商品不能引用自身')
    }
    const product = findAggregateRow('product', productId, input.sandboxId)
    if (!product) {
      throw new HttpError(404, 'COMBO_ITEM_PRODUCT_NOT_FOUND', '套餐明细包含不存在的商品', {productId})
    }
    const productData = asRecord(product.payload.data)
    if (normalizeProductType(productData.product_type) === 'COMBO') {
      throw new HttpError(400, 'COMBO_ITEM_CANNOT_BE_COMBO', '套餐子商品不能是另一个套餐', {productId})
    }
  })
  asRecordList(input.data.combo_item_groups).forEach(group => {
    const items = asRecordList(group.items)
    const minSelections = asNumber(group.min_selections, 0)
    if (minSelections > items.length) {
      throw new HttpError(400, 'COMBO_GROUP_MIN_SELECTION_EXCEEDED', '套餐分组最少选择数不能大于商品数量', {
        groupId: asOptionalString(group.group_id),
      })
    }
  })
}

const assertComboPricingSemantics = (data: Record<string, unknown>, basePrice: number) => {
  const strategy = asRecord(data.combo_pricing_strategy)
  if (Object.keys(strategy).length === 0) {
    return
  }
  const pricingType = asString(strategy.pricing_type, 'FIXED_TOTAL').toUpperCase()
  if (pricingType === 'FIXED_TOTAL' && asNullableNumber(strategy.fixed_total_price, basePrice) !== null && asNumber(strategy.fixed_total_price, basePrice) <= 0) {
    throw new HttpError(400, 'INVALID_COMBO_PRICE', '套餐固定价格必须大于 0')
  }
  if (pricingType === 'SUM_WITH_DISCOUNT') {
    const discountValue = asNumber(strategy.discount_value, 0)
    if (discountValue < 0 || discountValue >= basePrice) {
      throw new HttpError(400, 'INVALID_COMBO_DISCOUNT', '套餐折扣不能为负数，也不能使套餐价格小于等于 0')
    }
  }
}

const normalizeProductionProfile = (value: unknown, productionSteps: unknown) => {
  const profile = asRecord(value)
  const steps = asRecordList(profile.production_steps ?? productionSteps).map((step, index) => ({
    step_order: asNumber(step.step_order, index + 1),
    station_type: asString(step.station_type ?? step.workstation_type ?? step.workstation_code, 'PREP'),
    estimated_duration: asNumber(step.estimated_duration ?? step.duration_seconds, 60),
    is_parallel: asBoolean(step.is_parallel, false),
    dependency_step: asNullableNumber(step.dependency_step),
    step_code: asNullableString(step.step_code),
    step_name: asNullableString(step.step_name),
  }))
  const totalDuration = steps.reduce((total, step) => total + Math.max(0, asNumber(step.estimated_duration, 0)), 0)
  return {
    complexity_level: asString(profile.complexity_level, steps.length > 1 ? 'MEDIUM' : 'SIMPLE'),
    equipment_required: asStringList(profile.equipment_required),
    prep_notes: asNullableString(profile.prep_notes),
    total_estimated_duration: asNumber(profile.total_estimated_duration, totalDuration),
    production_steps: steps,
    batch_duration_rules: asRecordList(profile.batch_duration_rules),
  }
}

const defaultRuleConfig = (input: {ruleType: string; channelType?: unknown; timeSlot?: unknown; quota?: unknown}) => {
  if (input.ruleType === 'CHANNEL') {
    return {channel_type: asString(input.channelType, 'ALL')}
  }
  if (input.ruleType === 'TIME_SLOT') {
    return asRecord(input.timeSlot)
  }
  if (input.ruleType === 'QUOTA') {
    return {daily_quota: asNullableNumber(input.quota)}
  }
  return {}
}

const normalizeMenuSections = (value: unknown) =>
  asRecordList(value).map((section, sectionIndex) => {
    const sectionName = asString(section.section_name ?? section.name, `分区${sectionIndex + 1}`)
    const sectionId = asNullableString(section.section_id) ?? normalizeId(`section-${sectionName}`)
    const products = asRecordList(section.products).map((product, productIndex) => ({
      menu_product_id: asNullableString(product.menu_product_id ?? product.brand_menu_product_id) ?? normalizeId(`${sectionId}-${asString(product.product_id ?? product.productId ?? product.id, `product-${productIndex + 1}`)}`),
      brand_menu_product_id: asNullableString(product.brand_menu_product_id ?? product.menu_product_id) ?? normalizeId(`${sectionId}-${asString(product.product_id ?? product.productId ?? product.id, `product-${productIndex + 1}`)}`),
      section_id: sectionId,
      product_id: asString(product.product_id ?? product.productId ?? product.id, ''),
      standard_price: asNullableNumber(product.standard_price),
      override_price: asNullableNumber(product.override_price),
      override_name: asNullableString(product.override_name),
      override_image: asNullableString(product.override_image ?? product.override_image_url),
      sort_order: asNumber(product.sort_order ?? product.display_order, (productIndex + 1) * 10),
      is_featured: asBoolean(product.is_featured, false),
      is_mandatory: asBoolean(product.is_mandatory, false),
      daily_quota: asNullableNumber(product.daily_quota),
      is_inherited: asBoolean(product.is_inherited, false),
      availability_rules: asRecordList(product.availability_rules),
    })).filter(product => product.product_id)
    return {
      section_id: sectionId,
      section_name: sectionName,
      section_type: asString(section.section_type, 'CUSTOM'),
      sort_order: asNumber(section.sort_order ?? section.display_order, (sectionIndex + 1) * 10),
      display_style: asString(section.display_style, 'LIST'),
      is_required: asBoolean(section.is_required, false),
      is_inherited: asBoolean(section.is_inherited, false),
      products,
    }
  })

const resolveRelatedData = (entityType: DomainEntity, entityId: unknown, sandboxId: string) => {
  const id = asNullableString(entityId)
  const row = id ? findAggregateRow(entityType, id, sandboxId) : null
  return {
    row,
    data: cloneJson(asRecord(row?.payload.data)),
  }
}

const completeEntityData = (input: {
  entityType: DomainEntity
  entityId: string
  title: string
  status: string
  naturalScopeType: string
  naturalScopeKey: string
  data: Record<string, unknown>
  sandboxId: string
}): Record<string, unknown> => {
  const data = cloneJson(input.data)
  const status = sanitizeEntityStatus(input.entityType, data.status ?? input.status, input.status)

  if (input.entityType === 'sandbox') {
    const sandboxId = asString(data.sandbox_id, input.entityId)
    return {
      ...data,
      sandbox_id: sandboxId,
      sandbox_code: asString(data.sandbox_code, sandboxId),
      sandbox_name: asString(data.sandbox_name, input.title),
      sandbox_type: asString(data.sandbox_type, 'DEBUG'),
      owner: asString(data.owner, 'mock-admin-operator'),
      created_by: asString(data.created_by ?? data.owner, 'mock-admin-operator'),
      deployment_id: asNullableString(data.deployment_id) ?? 'local-mock-deployment',
      status,
    }
  }

  if (input.entityType === 'platform') {
    const platformId = asString(data.platform_id, input.entityId)
    const platformName = asString(data.platform_name, input.title)
    return {
      ...data,
      platform_id: platformId,
      platform_code: asString(data.platform_code, platformId),
      platform_name: platformName,
      platform_short_name: asNullableString(data.platform_short_name) ?? platformName,
      platform_status: asString(data.platform_status, status),
      contact_person: asNullableString(data.contact_person ?? data.contact_name),
      contact_name: asNullableString(data.contact_name ?? data.contact_person),
      contact_phone: asNullableString(data.contact_phone),
      contact_email: asNullableString(data.contact_email),
      address: asNullableString(data.address),
      isv_config: asRecord(data.isv_config),
      metadata_catalog: normalizeEntityMetadataCatalog(data.metadata_catalog, 'PLATFORM', platformId),
      external_platform_id: asNullableString(data.external_platform_id),
      synced_at: asNullableString(data.synced_at),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'region') {
    const regionId = asString(data.region_id, input.entityId)
    const platformId = asString(data.platform_id, input.naturalScopeKey || identity.platformId)
    return {
      ...data,
      region_id: regionId,
      platform_id: platformId,
      parent_region_id: asNullableString(data.parent_region_id),
      region_code: asString(data.region_code, regionId),
      region_name: asString(data.region_name, input.title),
      region_level: asNumber(data.region_level, data.parent_region_id ? 2 : 1),
      region_status: asString(data.region_status, status),
      external_region_id: asNullableString(data.external_region_id),
      synced_at: asNullableString(data.synced_at),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'project') {
    const projectId = asString(data.project_id, input.entityId)
    const projectName = asString(data.project_name, input.title)
    const region = createProjectRegion(data.region)
    const platformId = asString(data.platform_id, identity.platformId)
    const regionId = asNullableString(data.region_id) ?? asString(region.region_id ?? region.region_code, '')
    const regionEntity = regionId ? findAggregateRow('region', regionId, input.sandboxId) : null
    const regionData = asRecord(regionEntity?.payload.data)
    const regionSnapshot = regionEntity
      ? {
        region_id: asString(regionData.region_id, regionEntity.entityId),
        region_code: asString(regionData.region_code, regionEntity.entityId),
        region_name: asString(regionData.region_name, regionEntity.title),
        parent_region_id: asNullableString(regionData.parent_region_id),
        region_level: asNumber(regionData.region_level, 1),
      }
      : region
    return {
      ...data,
      project_id: projectId,
      platform_id: platformId,
      region: regionSnapshot,
      region_id: regionId,
      project_code: asString(data.project_code, projectId),
      project_name: projectName,
      project_short_name: asNullableString(data.project_short_name) ?? projectName,
      project_status: asString(data.project_status, data.business_status ? asString(data.business_status) : 'OPERATING'),
      province: asNullableString(data.province) ?? asNullableString(region.parent_region_code),
      city: asNullableString(data.city) ?? asNullableString(region.region_name),
      address: asNullableString(data.address, 'Shenzhen Nanshan District'),
      latitude: asNullableNumber(data.latitude),
      longitude: asNullableNumber(data.longitude),
      timezone: asString(data.timezone, 'Asia/Shanghai'),
      business_hours: normalizeOperatingHours(data.business_hours),
      channel_shop_config: {
        default_delivery_radius_km: 5,
        default_prepare_minutes: 20,
        ...asRecord(data.channel_shop_config),
      },
      business_mode: asString(data.business_mode, 'SHOPPING_MALL'),
      project_phases: normalizeProjectPhases(data.project_phases, projectName),
      external_project_id: asNullableString(data.external_project_id),
      synced_at: asNullableString(data.synced_at),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'tenant') {
    delete data.tenant_category
    const tenantId = asString(data.tenant_id, input.entityId)
    const tenantName = asString(data.tenant_name, input.title)
    const socialCreditCode = firstString(data.unified_social_credit_code, data.social_credit_code)
    return {
      ...data,
      tenant_id: tenantId,
      platform_id: asString(data.platform_id, identity.platformId),
      tenant_code: asString(data.tenant_code, tenantId),
      tenant_name: tenantName,
      company_name: asString(data.company_name, tenantName),
      unified_social_credit_code: socialCreditCode,
      social_credit_code: socialCreditCode,
      legal_representative: asNullableString(data.legal_representative),
      contact_person: asNullableString(data.contact_person ?? data.contact_name),
      contact_name: asNullableString(data.contact_name ?? data.contact_person),
      contact_phone: asNullableString(data.contact_phone),
      contact_email: asNullableString(data.contact_email ?? data.billing_email),
      tenant_type: asString(data.tenant_type, 'CHAIN_BRAND'),
      business_model: asString(data.business_model, 'MIXED'),
      account_status: asString(data.account_status, status),
      suspension_reason: asNullableString(data.suspension_reason),
      suspended_at: asNullableString(data.suspended_at),
      suspended_by: asNullableString(data.suspended_by),
      external_tenant_id: asNullableString(data.external_tenant_id),
      synced_at: asNullableString(data.synced_at),
      invoice_title: asNullableString(data.invoice_title) ?? tenantName,
      settlement_cycle: asNullableString(data.settlement_cycle),
      billing_email: asNullableString(data.billing_email ?? data.contact_email),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'brand') {
    delete data.tenant_id
    const brandId = asString(data.brand_id, input.entityId)
    const brandName = asString(data.brand_name, input.title)
    return {
      ...data,
      brand_id: brandId,
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      brand_code: asString(data.brand_code, brandId),
      brand_name: brandName,
      brand_name_en: asNullableString(data.brand_name_en),
      brand_logo_url: asNullableString(data.brand_logo_url),
      brand_category: asString(data.brand_category, 'BAKERY'),
      brand_description: asNullableString(data.brand_description),
      standard_menu_enabled: asBoolean(data.standard_menu_enabled, false),
      standard_pricing_locked: asBoolean(data.standard_pricing_locked, false),
      erp_integration_enabled: asBoolean(data.erp_integration_enabled, false),
      erp_api_endpoint: asNullableString(data.erp_api_endpoint),
      erp_auth_config: asRecord(data.erp_auth_config),
      brand_status: asString(data.brand_status, status),
      external_brand_id: asNullableString(data.external_brand_id),
      metadata_catalog: normalizeEntityMetadataCatalog(data.metadata_catalog, 'BRAND', brandId),
      synced_at: asNullableString(data.synced_at),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'business_entity') {
    const entityId = asString(data.entity_id, input.entityId)
    const entityName = asString(data.entity_name, input.title)
    const bankAccountNoMasked = asNullableString(data.bank_account_no_masked)
      ?? maskSecret(asNullableString(data.bank_account_no) ?? null)
    return {
      ...data,
      bank_account_no: undefined,
      entity_id: entityId,
      tenant_id: asString(data.tenant_id, input.naturalScopeKey),
      platform_id: asString(data.platform_id, identity.platformId),
      entity_code: asString(data.entity_code, entityId),
      entity_name: entityName,
      entity_type: asString(data.entity_type, 'COMPANY'),
      company_name: asString(data.company_name, entityName),
      unified_social_credit_code: firstString(data.unified_social_credit_code, data.social_credit_code),
      legal_representative: asNullableString(data.legal_representative),
      bank_name: asNullableString(data.bank_name),
      bank_account_name: asNullableString(data.bank_account_name),
      bank_account_no_masked: bankAccountNoMasked,
      bank_branch: asNullableString(data.bank_branch),
      tax_registration_no: asNullableString(data.tax_registration_no),
      taxpayer_type: asString(data.taxpayer_type, 'GENERAL_TAXPAYER'),
      tax_rate: asNullableNumber(data.tax_rate, 0.06),
      settlement_cycle: asNullableString(data.settlement_cycle),
      settlement_day: asNullableNumber(data.settlement_day),
      auto_settlement_enabled: asBoolean(data.auto_settlement_enabled, false),
      entity_status: asString(data.entity_status, status),
      status,
    }
  }

  if (input.entityType === 'store') {
    const storeId = asString(data.store_id, input.entityId)
    const project = resolveRelatedData('project', data.project_id, input.sandboxId)
    const projectData = project.data
    const platformId = asString(data.platform_id, asString(projectData.platform_id, identity.platformId))
    const scenarios = asStringList(data.business_scenarios ?? data.store_formats)
    const hasDineIn = asBoolean(data.has_dine_in, scenarios.includes('DINE_IN'))
    const hasTakeaway = asBoolean(data.has_takeaway, scenarios.includes('TAKEAWAY') || scenarios.includes('DELIVERY'))
    const hasSelfPickup = asBoolean(data.has_self_pickup, scenarios.includes('PICKUP'))
    return {
      ...data,
      store_id: storeId,
      platform_id: platformId,
      project_id: asString(data.project_id, identity.projectId),
      store_code: asString(data.store_code, storeId),
      store_name: asString(data.store_name, input.title),
      unit_no: asString(data.unit_no ?? data.unit_code, ''),
      unit_code: asString(data.unit_code ?? data.unit_no, ''),
      store_type: asString(data.store_type, 'LEASE'),
      business_format: asString(data.business_format ?? data.store_type, 'RESTAURANT'),
      cooperation_mode: asString(data.cooperation_mode, 'LEASE'),
      business_scenarios: scenarios.length ? scenarios : ['DINE_IN', 'TAKEAWAY', 'PICKUP'],
      store_formats: scenarios.length ? scenarios : ['DINE_IN', 'TAKEAWAY', 'PICKUP'],
      address_detail: asNullableString(data.address_detail ?? data.location),
      floor: asNullableString(data.floor),
      latitude: asNullableNumber(data.latitude),
      longitude: asNullableNumber(data.longitude),
      store_phone: asNullableString(data.store_phone),
      store_manager: asNullableString(data.store_manager ?? data.manager_name),
      manager_phone: asNullableString(data.manager_phone),
      has_dine_in: hasDineIn,
      has_takeaway: hasTakeaway,
      has_self_pickup: hasSelfPickup,
      seat_count: hasDineIn ? asNullableNumber(data.seat_count, 0) : 0,
      floor_area: asNullableNumber(data.floor_area ?? data.area_sqm),
      area_sqm: asNullableNumber(data.area_sqm ?? data.floor_area),
      business_hours: asNullableString(data.business_hours),
      active_contract_id: asNullableString(data.active_contract_id),
      tenant_id: asNullableString(data.tenant_id),
      brand_id: asNullableString(data.brand_id),
      entity_id: asNullableString(data.entity_id),
      store_status: asString(data.store_status, data.active_contract_id ? 'OPERATING' : 'VACANT'),
      operating_status: asString(data.operating_status, 'PREPARING'),
      contract_status: asString(data.contract_status, data.active_contract_id ? 'ACTIVE' : 'NO_CONTRACT'),
      external_store_id: asNullableString(data.external_store_id),
      metadata_catalog: normalizeEntityMetadataCatalog(data.metadata_catalog, 'STORE', storeId),
      synced_at: asNullableString(data.synced_at),
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'contract') {
    const store = resolveRelatedData('store', data.store_id ?? data.lessee_store_id, input.sandboxId)
    const storeData = store.data
    const projectId = firstString(data.lessor_project_id, data.project_id, storeData.project_id) ?? identity.projectId
    const project = resolveRelatedData('project', projectId, input.sandboxId)
    const projectData = project.data
    const phase = resolveProjectPhase(projectData, asNullableString(data.lessor_phase_id))
    const tenant = resolveRelatedData('tenant', data.tenant_id ?? data.lessee_tenant_id, input.sandboxId)
    const brand = resolveRelatedData('brand', data.brand_id ?? data.lessee_brand_id, input.sandboxId)
    const contractId = asString(data.contract_id, input.entityId)
    const contractStatus = normalizeContractStatus(status, status)
    return {
      ...data,
      contract_id: contractId,
      contract_code: asString(data.contract_code, input.title),
      contract_no: asString(data.contract_no ?? data.contract_code, input.title),
      contract_type: asString(data.contract_type, 'OPERATING'),
      platform_id: asString(data.platform_id, asString(projectData.platform_id, asString(storeData.platform_id, identity.platformId))),
      project_id: projectId,
      lessor_project_id: projectId,
      lessor_project_name: asString(data.lessor_project_name, asString(projectData.project_name, project.row?.title ?? '')),
      lessor_phase_id: asString(data.lessor_phase_id, phase.phase_id),
      lessor_phase_name: asString(data.lessor_phase_name, phase.phase_name),
      lessor_owner_name: asString(data.lessor_owner_name, phase.owner_name),
      lessor_owner_contact: asNullableString(data.lessor_owner_contact ?? phase.owner_contact),
      lessor_owner_phone: asNullableString(data.lessor_owner_phone ?? phase.owner_phone),
      store_id: asString(data.store_id ?? data.lessee_store_id, asString(storeData.store_id, '')),
      lessee_store_id: asString(data.lessee_store_id ?? data.store_id, asString(storeData.store_id, '')),
      lessee_store_name: asString(data.lessee_store_name, asString(storeData.store_name, store.row?.title ?? '')),
      tenant_id: asString(data.tenant_id ?? data.lessee_tenant_id, ''),
      lessee_tenant_id: asString(data.lessee_tenant_id ?? data.tenant_id, ''),
      lessee_tenant_name: asString(data.lessee_tenant_name, asString(tenant.data.tenant_name, tenant.row?.title ?? '')),
      brand_id: asString(data.brand_id ?? data.lessee_brand_id, ''),
      lessee_brand_id: asString(data.lessee_brand_id ?? data.brand_id, ''),
      lessee_brand_name: asString(data.lessee_brand_name, asString(brand.data.brand_name, brand.row?.title ?? '')),
      entity_id: asNullableString(data.entity_id) ?? asNullableString(data.tenant_id),
      unit_code: asString(data.unit_code, asString(storeData.unit_code, '')),
      start_date: asNullableString(data.start_date),
      end_date: asNullableString(data.end_date),
      commission_type: asString(data.commission_type, 'FIXED_RATE'),
      commission_rate: asNumber(data.commission_rate, 0),
      deposit_amount: asNumber(data.deposit_amount, 0),
      attachment_url: asNullableString(data.attachment_url),
      activated_at: asNullableString(data.activated_at),
      expired_at: asNullableString(data.expired_at),
      termination_reason: asNullableString(data.termination_reason),
      terminated_at: asNullableString(data.terminated_at),
      terminated_by: asNullableString(data.terminated_by),
      external_contract_no: asNullableString(data.external_contract_no),
      synced_at: asNullableString(data.synced_at),
      active_contract_id: contractStatus === 'ACTIVE' ? contractId : null,
      contract_status: contractStatus,
      status: contractStatus,
    }
  }

  if (input.entityType === 'table') {
    const store = resolveRelatedData('store', data.store_id, input.sandboxId)
    const storeData = store.data
    const project = resolveRelatedData('project', storeData.project_id, input.sandboxId)
    const tableNo = asString(data.table_no, input.entityId)
    const tableId = asString(data.table_id, input.entityId)
    return {
      ...data,
      table_id: tableId,
      platform_id: asString(data.platform_id, asString(storeData.platform_id, identity.platformId)),
      project_id: asString(data.project_id, asString(storeData.project_id, '')),
      project_name: asString(data.project_name, asString(project.data.project_name, project.row?.title ?? '')),
      store_id: asString(data.store_id, input.naturalScopeKey),
      store_name: asString(data.store_name, asString(storeData.store_name, store.row?.title ?? '')),
      table_no: tableNo,
      table_name: asString(data.table_name, `桌台 ${tableNo}`),
      area: asString(data.area, '大厅'),
      capacity: Math.max(1, asNumber(data.capacity, 4)),
      table_type: asString(data.table_type, 'HALL'),
      qr_code_url: asNullableString(data.qr_code_url) ?? `/customer/qr/${tableId}`,
      qr_code_content: asNullableString(data.qr_code_content) ?? JSON.stringify({store_id: asString(data.store_id, input.naturalScopeKey), table_id: tableId}),
      table_status: tableMasterStatuses.has(asString(data.table_status ?? status, 'AVAILABLE').toUpperCase())
        ? asString(data.table_status ?? status, 'AVAILABLE').toUpperCase()
        : 'AVAILABLE',
      estimated_duration: asNullableNumber(data.estimated_duration),
      sort_order: asNumber(data.sort_order, 100),
      reservable: asBoolean(data.reservable, false),
      consumer_description: asNullableString(data.consumer_description),
      minimum_spend: asNullableNumber(data.minimum_spend),
      status,
    }
  }

  if (input.entityType === 'workstation') {
    const store = resolveRelatedData('store', data.store_id, input.sandboxId)
    const storeData = store.data
    const project = resolveRelatedData('project', storeData.project_id, input.sandboxId)
    const categories = asStringList(data.responsible_categories ?? data.category_codes)
    return {
      ...data,
      workstation_id: asString(data.workstation_id, input.entityId),
      platform_id: asString(data.platform_id, asString(storeData.platform_id, identity.platformId)),
      project_id: asString(data.project_id, asString(storeData.project_id, '')),
      project_name: asString(data.project_name, asString(project.data.project_name, project.row?.title ?? '')),
      store_id: asString(data.store_id, input.naturalScopeKey),
      store_name: asString(data.store_name, asString(storeData.store_name, store.row?.title ?? '')),
      workstation_code: asString(data.workstation_code, input.entityId),
      workstation_name: asString(data.workstation_name, input.title),
      workstation_type: asString(data.workstation_type, 'PRODUCTION'),
      responsible_categories: categories,
      category_codes: categories,
      description: asNullableString(data.description),
      status,
    }
  }

  if (input.entityType === 'permission') {
    const permissionCode = asString(data.permission_code, input.entityId)
    const [first, second] = permissionCode.includes(':') ? permissionCode.split(':', 2) : [asString(data.resource_type ?? data.resource, ''), asString(data.action, '')]
    const resourceType = asString(data.resource_type ?? data.resource, first)
    const action = asString(data.action, second)
    return {
      ...data,
      permission_id: asString(data.permission_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      permission_code: permissionCode,
      permission_name: asString(data.permission_name, input.title),
      permission_description: asNullableString(data.permission_description ?? data.description),
      description: asNullableString(data.description ?? data.permission_description),
      module: asString(data.module, resourceType || 'CUSTOM'),
      resource: resourceType,
      resource_type: resourceType,
      action,
      scope_type: asString(data.scope_type, input.naturalScopeType || 'PLATFORM'),
      permission_type: asString(data.permission_type ?? data.permission_source, 'SYSTEM'),
      permission_source: asString(data.permission_source ?? data.permission_type, 'SYSTEM'),
      is_system: asBoolean(data.is_system, asString(data.permission_type ?? data.permission_source, 'SYSTEM') === 'SYSTEM'),
      parent_permission_id: asNullableString(data.parent_permission_id),
      permission_group_id: asNullableString(data.permission_group_id),
      feature_flag: asNullableString(data.feature_flag),
      high_risk: asBoolean(data.high_risk, false),
      require_approval: asBoolean(data.require_approval, false),
      status,
    }
  }

  if (input.entityType === 'identity_provider_config') {
    const idpType = asString(data.idp_type, 'LOCAL').toUpperCase()
    return {
      ...data,
      idp_id: asString(data.idp_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      idp_name: asString(data.idp_name, input.title),
      idp_type: idpType,
      applicable_user_types: asUpperStringList(data.applicable_user_types),
      priority: asNumber(data.priority, 100),
      created_by: asNullableString(data.created_by) ?? 'mock-admin-operator',
      version: asNumber(data.version, 1),
      ldap_url: asNullableString(data.ldap_url),
      base_dn: asNullableString(data.base_dn),
      bind_dn: asNullableString(data.bind_dn),
      bind_password_encrypted: asNullableString(data.bind_password_encrypted ?? data.bind_password),
      user_search_filter: asNullableString(data.user_search_filter),
      username_attr: asNullableString(data.username_attr) ?? 'uid',
      email_attr: asNullableString(data.email_attr) ?? 'mail',
      display_name_attr: asNullableString(data.display_name_attr) ?? 'cn',
      sync_enabled: asBoolean(data.sync_enabled, false),
      sync_cron: asNullableString(data.sync_cron),
      last_sync_at: asNullableString(data.last_sync_at),
      last_sync_result: asNullableString(data.last_sync_result),
      last_sync_error: asNullableString(data.last_sync_error),
      issuer_url: asNullableString(data.issuer_url),
      client_id: asNullableString(data.client_id),
      client_secret_encrypted: asNullableString(data.client_secret_encrypted ?? data.client_secret),
      scopes: asStringList(data.scopes),
      user_info_endpoint: asNullableString(data.user_info_endpoint),
      redirect_uri: asNullableString(data.redirect_uri),
      corp_id: asNullableString(data.corp_id),
      agent_id: asNullableString(data.agent_id),
      app_secret_encrypted: asNullableString(data.app_secret_encrypted ?? data.app_secret),
      status,
    }
  }

  if (input.entityType === 'permission_group') {
    return {
      ...data,
      permission_group_id: asString(data.permission_group_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      group_code: asString(data.group_code, input.entityId),
      group_name: asString(data.group_name, input.title),
      group_icon: asNullableString(data.group_icon),
      sort_order: asNumber(data.sort_order, 100),
      parent_group_id: asNullableString(data.parent_group_id),
      status,
    }
  }

  if (input.entityType === 'role_template') {
    return {
      ...data,
      template_id: asString(data.template_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      template_code: asString(data.template_code, input.entityId),
      template_name: asString(data.template_name, input.title),
      template_description: asNullableString(data.template_description),
      base_permission_ids: asStringList(data.base_permission_ids),
      recommended_scope_type: asString(data.recommended_scope_type, 'ORG_NODE'),
      industry_tags: asStringList(data.industry_tags),
      is_active: asBoolean(data.is_active, status === 'ACTIVE'),
      status,
    }
  }

  if (input.entityType === 'feature_point') {
    return {
      ...data,
      feature_point_id: asString(data.feature_point_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      feature_code: asString(data.feature_code, input.entityId),
      feature_name: asString(data.feature_name, input.title),
      feature_description: asNullableString(data.feature_description),
      is_enabled_globally: asBoolean(data.is_enabled_globally, true),
      default_enabled: asBoolean(data.default_enabled, false),
      status,
    }
  }

  if (input.entityType === 'platform_feature_switch') {
    return {
      ...data,
      switch_id: asString(data.switch_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      feature_code: asString(data.feature_code, ''),
      is_enabled: asBoolean(data.is_enabled, true),
      enabled_at: asNullableString(data.enabled_at),
      enabled_by: asNullableString(data.enabled_by),
      status,
    }
  }

  if (input.entityType === 'role') {
    return {
      ...data,
      role_id: asString(data.role_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      role_code: asString(data.role_code, input.entityId),
      role_name: asString(data.role_name, input.title),
      role_description: asNullableString(data.role_description),
      role_type: asString(data.role_type ?? data.role_source, 'CUSTOM'),
      source_template_id: asNullableString(data.source_template_id),
      template_sync_status: asString(data.template_sync_status, data.source_template_id ? 'IN_SYNC' : 'NO_TEMPLATE'),
      applicable_user_types: asStringList(data.applicable_user_types),
      scope_type: asString(data.scope_type, input.naturalScopeType),
      permission_ids: asStringList(data.permission_ids),
      status,
      version: asNumber(data.version, 1),
    }
  }

  if (input.entityType === 'user') {
    const store = resolveRelatedData('store', data.store_id, input.sandboxId)
    const platformId = asString(data.platform_id, asString(store.data.platform_id, identity.platformId))
    const identitySource = asString(data.identity_source, 'LOCAL').toUpperCase()
    return {
      ...data,
      user_id: asString(data.user_id, input.entityId),
      platform_id: platformId,
      username: asString(data.username ?? data.user_code, input.entityId),
      user_code: asString(data.user_code ?? data.username, input.entityId),
      display_name: asString(data.display_name, input.title),
      email: asNullableString(data.email),
      phone: asNullableString(data.phone ?? data.mobile),
      mobile: asNullableString(data.mobile ?? data.phone),
      user_type: asString(data.user_type, 'STORE_STAFF'),
      identity_source: identitySource,
      external_user_id: asNullableString(data.external_user_id),
      store_id: asNullableString(data.store_id),
      password_hash: identitySource === 'LOCAL'
        ? asNullableString(data.password_hash) ?? 'mock-password-hash-redacted'
        : null,
      failed_login_count: asNumber(data.failed_login_count, 0),
      locked_until: asNullableString(data.locked_until),
      last_login_at: asNullableString(data.last_login_at),
      last_login_ip: asNullableString(data.last_login_ip),
      created_by: asNullableString(data.created_by) ?? 'mock-admin-operator',
      version: asNumber(data.version, 1),
      status,
    }
  }

  if (input.entityType === 'resource_tag') {
    return {
      ...data,
      tag_id: asString(data.tag_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      tag_key: asString(data.tag_key, ''),
      tag_value: asString(data.tag_value, ''),
      tag_label: asNullableString(data.tag_label),
      resource_type: asString(data.resource_type, ''),
      resource_id: asString(data.resource_id, ''),
      created_by: asNullableString(data.created_by) ?? 'mock-admin-operator',
      status,
    }
  }

  if (input.entityType === 'principal_group') {
    return {
      ...data,
      group_id: asString(data.group_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      group_code: asString(data.group_code, input.entityId),
      group_name: asString(data.group_name, input.title),
      group_type: asString(data.group_type, 'MANUAL'),
      ldap_group_dn: asNullableString(data.ldap_group_dn),
      oidc_claim_key: asNullableString(data.oidc_claim_key),
      oidc_claim_value: asNullableString(data.oidc_claim_value),
      status,
    }
  }

  if (input.entityType === 'group_member') {
    return {
      ...data,
      member_id: asString(data.member_id, input.entityId),
      platform_id: asString(data.platform_id, identity.platformId),
      group_id: asString(data.group_id, input.naturalScopeKey),
      user_id: asString(data.user_id, ''),
      joined_at: asNullableString(data.joined_at) ?? new Date(now()).toISOString(),
      joined_by: asNullableString(data.joined_by),
      source: asString(data.source, 'MANUAL'),
      status,
    }
  }

  if (input.entityType === 'group_role_binding') {
    const {comparisonKey: _comparisonKey, ...scopeSelector} = normalizeScopeSelector(
      data.scope_selector ?? data.resource_scope ?? {scope_type: data.scope_type, scope_key: data.scope_id},
      input.naturalScopeType,
      input.naturalScopeKey,
    )
    return {
      ...data,
      group_binding_id: asString(data.group_binding_id, input.entityId),
      platform_id: asString(data.platform_id, identity.platformId),
      group_id: asString(data.group_id, ''),
      role_id: asString(data.role_id, ''),
      resource_scope: scopeSelector,
      scope_selector: scopeSelector,
      granted_by: asNullableString(data.granted_by) ?? 'mock-admin-operator',
      effective_from: asNullableString(data.effective_from) ?? new Date(now()).toISOString(),
      effective_to: asNullableString(data.effective_to),
      policy_effect: asString(data.policy_effect, 'ALLOW'),
      policy_conditions: asRecord(data.policy_conditions),
      status,
    }
  }

  if (input.entityType === 'authorization_session') {
    const {session_token: sessionToken, ...safeData} = data
    return {
      ...safeData,
      session_id: asString(data.session_id, input.entityId),
      user_id: asString(data.user_id, ''),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      activated_binding_ids: asStringList(data.activated_binding_ids),
      working_scope: asRecord(data.working_scope),
      session_token_masked: maskSecret(asNullableString(sessionToken) ?? null),
      expires_at: asNullableString(data.expires_at),
      last_active_at: asNullableString(data.last_active_at),
      mfa_verified_at: asNullableString(data.mfa_verified_at),
      mfa_expires_at: asNullableString(data.mfa_expires_at),
      mfa_method: asNullableString(data.mfa_method),
      status,
    }
  }

  if (input.entityType === 'separation_of_duty_rule') {
    return {
      ...data,
      sod_rule_id: asString(data.sod_rule_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      rule_name: asString(data.rule_name, input.title),
      rule_description: asNullableString(data.rule_description),
      conflicting_role_codes: asStringList(data.conflicting_role_codes),
      conflicting_perm_codes: asStringList(data.conflicting_perm_codes),
      scope_type: asString(data.scope_type, 'PLATFORM'),
      is_active: asBoolean(data.is_active, status === 'ACTIVE'),
      status,
    }
  }

  if (input.entityType === 'high_risk_permission_policy') {
    return {
      ...data,
      policy_id: asString(data.policy_id, input.entityId),
      platform_id: asString(data.platform_id, input.naturalScopeKey || identity.platformId),
      permission_code: asString(data.permission_code, ''),
      require_approval: asBoolean(data.require_approval, true),
      approver_role_code: asNullableString(data.approver_role_code),
      max_duration_days: asNullableNumber(data.max_duration_days),
      require_mfa: asBoolean(data.require_mfa, false),
      mfa_validity_minutes: asNumber(data.mfa_validity_minutes, 30),
      is_active: asBoolean(data.is_active, status === 'ACTIVE'),
      status,
    }
  }

  if (input.entityType === 'user_role_binding') {
    const role = resolveRelatedData('role', data.role_id, input.sandboxId)
    const {comparisonKey: _comparisonKey, ...scopeSelector} = normalizeScopeSelector(
      data.scope_selector ?? data.resource_scope ?? {scope_type: data.scope_type, scope_key: data.scope_id ?? data.store_id},
      input.naturalScopeType,
      input.naturalScopeKey,
    )
    return {
      ...data,
      binding_id: asString(data.binding_id, input.entityId),
      platform_id: asString(data.platform_id, asString(role.data.platform_id, identity.platformId)),
      user_id: asString(data.user_id, ''),
      role_id: asString(data.role_id, ''),
      store_id: asNullableString(data.store_id),
      resource_scope: scopeSelector,
      scope_selector: scopeSelector,
      granted_by: asNullableString(data.granted_by) ?? 'mock-admin-operator',
      policy_effect: asString(data.policy_effect, 'ALLOW'),
      policy_conditions: asRecord(data.policy_conditions),
      effective_from: asNullableString(data.effective_from) ?? new Date(now()).toISOString(),
      effective_to: asNullableString(data.effective_to),
      grant_reason: asNullableString(data.grant_reason),
      revoked_by: asNullableString(data.revoked_by),
      revoked_at: asNullableString(data.revoked_at),
      revoke_reason: asNullableString(data.revoke_reason),
      status,
    }
  }

  if (input.entityType === 'product') {
    const ownershipScope = asString(data.ownership_scope, 'BRAND') === 'STORE' ? 'STORE' : 'BRAND'
    const ownerId = asString(data.owner_id, ownershipScope === 'STORE' ? asString(data.store_id, identity.storeId) : asString(data.brand_id, identity.brandId))
    const basePrice = Math.max(0, asNumber(data.base_price, 0))
    const productType = normalizeProductType(data.product_type)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope,
      brandId: ownershipScope === 'BRAND' ? ownerId : data.brand_id,
      storeId: ownershipScope === 'STORE' ? ownerId : data.store_id,
    })
    return {
      ...data,
      product_id: asString(data.product_id, input.entityId),
      platform_id: platformId,
      product_code: asString(data.product_code, input.entityId),
      product_name: asString(data.product_name, input.title),
      product_name_en: asNullableString(data.product_name_en),
      product_type: productType,
      category_id: asNullableString(data.category_id ?? data.product_category),
      base_price: basePrice,
      price_unit: asString(data.price_unit, 'ITEM'),
      ownership_scope: ownershipScope,
      owner_id: ownerId,
      brand_id: ownershipScope === 'BRAND' ? ownerId : asNullableString(data.brand_id),
      store_id: ownershipScope === 'STORE' ? ownerId : asNullableString(data.store_id),
      image_url: asNullableString(data.image_url ?? data.product_image_url),
      product_image_url: asNullableString(data.product_image_url ?? data.image_url),
      product_images: asStringList(data.product_images),
      product_description: asNullableString(data.product_description ?? data.description),
      description: asNullableString(data.description ?? data.product_description),
      allergen_info: asNullableString(data.allergen_info),
      nutrition_info: asRecord(data.nutrition_info),
      tags: asStringList(data.tags),
      sort_order: asNumber(data.sort_order, 100),
      created_by: asNullableString(data.created_by) ?? 'mock-admin-operator',
      updated_by: asNullableString(data.updated_by),
      version: asNumber(data.version, 1),
      combo_pricing_strategy: normalizeComboPricingStrategy(data.combo_pricing_strategy),
      combo_stock_policy: asRecord(data.combo_stock_policy),
      combo_availability_policy: asRecord(data.combo_availability_policy),
      production_profile: normalizeProductionProfile(data.production_profile, data.production_steps),
      production_steps: asRecordList(data.production_steps),
      modifier_groups: normalizeModifierGroups(data.modifier_groups),
      variants: normalizeProductVariants(data.variants, basePrice),
      combo_item_groups: normalizeComboItemGroups(data.combo_item_groups),
      combo_items: normalizeComboItems(data.combo_items),
      status,
    }
  }

  if (input.entityType === 'brand_menu' || input.entityType === 'menu_catalog') {
    const menuIdField = input.entityType === 'brand_menu' ? 'brand_menu_id' : 'menu_id'
    const menuId = asString(data[menuIdField] ?? data.menu_id, input.entityId)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: input.entityType === 'brand_menu' ? 'BRAND' : 'STORE',
      brandId: data.brand_id,
      storeId: data.store_id,
    })
    return {
      ...data,
      [menuIdField]: menuId,
      platform_id: platformId,
      menu_id: asString(data.menu_id, menuId),
      brand_id: asNullableString(data.brand_id),
      store_id: asNullableString(data.store_id),
      menu_name: asString(data.menu_name, input.title),
      channel_type: asString(data.channel_type, 'ALL'),
      menu_type: asString(data.menu_type, 'FULL_DAY'),
      inherit_mode: asString(data.inherit_mode, input.entityType === 'menu_catalog' ? 'PARTIAL' : 'NONE'),
      effective_date: asNullableString(data.effective_date ?? data.effective_from),
      expire_date: asNullableString(data.expire_date ?? data.effective_to),
      effective_from: asNullableString(data.effective_from ?? data.effective_date),
      effective_to: asNullableString(data.effective_to ?? data.expire_date),
      parent_menu_id: asNullableString(data.parent_menu_id),
      version: asNumber(data.version, 1),
      allow_store_override: asBoolean(data.allow_store_override, input.entityType === 'brand_menu'),
      override_scope: {
        price_overridable: true,
        image_overridable: true,
        availability_overridable: true,
        ...asRecord(data.override_scope),
      },
      review_status: asString(data.review_status, input.entityType === 'brand_menu' ? 'NONE' : 'APPROVED'),
      submitted_at: asNullableString(data.submitted_at),
      reviewed_at: asNullableString(data.reviewed_at),
      reviewed_by: asNullableString(data.reviewed_by),
      review_comment: asNullableString(data.review_comment),
      published_at: asNullableString(data.published_at),
      published_by: asNullableString(data.published_by),
      sections: normalizeMenuSections(data.sections),
      version_hash: asNullableString(data.version_hash) ?? createId('menu-hash'),
      status,
    }
  }

  if (input.entityType === 'price_rule') {
    const priceType = normalizePriceType(data.price_type)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: 'STORE',
      storeId,
    })
    return {
      ...data,
      rule_id: asString(data.rule_id, input.entityId),
      platform_id: platformId,
      rule_code: asString(data.rule_code, input.entityId),
      rule_name: asString(data.rule_name, input.title),
      product_id: asNullableString(data.product_id),
      store_id: storeId,
      price_type: priceType,
      channel_type: asString(data.channel_type, 'ALL'),
      time_slot_start: asNullableString(data.time_slot_start ?? asRecord(data.time_slot).start),
      time_slot_end: asNullableString(data.time_slot_end ?? asRecord(data.time_slot).end),
      days_of_week: asStringList(data.days_of_week),
      price_delta: asNumber(data.price_delta, 0),
      price: asNumber(data.price ?? data.price_value ?? data.discount_value ?? data.price_delta, 0),
      price_value: asNumber(data.price_value ?? data.price ?? data.discount_value ?? data.price_delta, 0),
      time_slot: asRecord(data.time_slot),
      member_tier: asNullableString(data.member_tier),
      priority: asNumber(data.priority, 10),
      discount_type: asString(data.discount_type, priceType === 'DISCOUNT_RATE' ? 'PERCENTAGE' : 'AMOUNT_OFF'),
      discount_value: asNumber(data.discount_value, asNumber(data.price_delta, 0)),
      is_active: asBoolean(data.is_active ?? data.enabled, true),
      enabled: asBoolean(data.enabled ?? data.is_active, true),
      applicable_product_ids: asStringList(data.applicable_product_ids ?? data.product_id),
      effective_from: asNullableString(data.effective_from),
      effective_to: asNullableString(data.effective_to),
      status,
    }
  }

  if (input.entityType === 'store_config') {
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: 'STORE',
      storeId,
    })
    return {
      ...data,
      config_id: asString(data.config_id, input.entityId),
      platform_id: platformId,
      store_id: storeId,
      operating_status: asString(data.operating_status ?? data.business_status, status === 'OPEN' ? 'OPERATING' : status),
      business_status: asString(data.business_status, status),
      auto_accept_enabled: asBoolean(data.auto_accept_enabled ?? data.accept_order, true),
      accept_order: asBoolean(data.accept_order ?? data.auto_accept_enabled, true),
      accept_timeout_seconds: asNumber(data.accept_timeout_seconds, 60),
      preparation_buffer_minutes: asNumber(data.preparation_buffer_minutes, 10),
      max_concurrent_orders: Math.max(0, asNumber(data.max_concurrent_orders, 0)),
      pause_reason: asNullableString(data.pause_reason),
      paused_at: asNullableString(data.paused_at),
      paused_by: asNullableString(data.paused_by),
      resume_scheduled_at: asNullableString(data.resume_scheduled_at),
      operating_hours: normalizeStoreOperatingHours(data.operating_hours),
      special_operating_days: normalizeSpecialOperatingDays(data.special_operating_days),
      hours_id: asNullableString(data.hours_id),
      day_of_week: asNullableNumber(data.day_of_week),
      open_time: asNullableString(data.open_time),
      close_time: asNullableString(data.close_time),
      is_closed: asBoolean(data.is_closed, false),
      special_day_id: asNullableString(data.special_day_id),
      note: asNullableString(data.note),
      channel_operating_hours: asRecordList(data.channel_operating_hours),
      auto_open_close_enabled: asBoolean(data.auto_open_close_enabled, true),
      extra_charge_rules: normalizeExtraChargeRules(data.extra_charge_rules),
      refund_stock_policy: asString(data.refund_stock_policy, 'NO_RESTORE_AFTER_REFUND'),
      status,
    }
  }

  if (input.entityType === 'menu_availability') {
    const available = asBoolean(data.available, status !== 'SOLD_OUT')
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const productId = asString(data.product_id, input.entityId)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: 'STORE',
      storeId,
    })
    return {
      ...data,
      product_id: productId,
      platform_id: platformId,
      store_id: storeId,
      available,
      sold_out_reason: asNullableString(data.sold_out_reason),
      effective_from: asNullableString(data.effective_from) ?? new Date(now()).toISOString(),
      status: available ? 'ACTIVE' : 'SOLD_OUT',
    }
  }

  if (input.entityType === 'availability_rule') {
    const ruleType = asString(data.rule_type, 'MANUAL')
    const storeId = asNullableString(data.store_id)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: storeId ? 'STORE' : undefined,
      storeId,
      brandId: data.brand_id,
    })
    return {
      ...data,
      rule_id: asString(data.rule_id, input.entityId),
      platform_id: platformId,
      rule_code: asString(data.rule_code, input.entityId),
      rule_name: asString(data.rule_name, input.title),
      product_id: asNullableString(data.product_id),
      store_id: storeId,
      rule_type: ruleType,
      rule_config: {
        ...defaultRuleConfig({ruleType, channelType: data.channel_type, timeSlot: data.time_slot, quota: data.daily_quota}),
        ...asRecord(data.rule_config),
      },
      channel_type: asNullableString(data.channel_type),
      available: asBoolean(data.available, true),
      priority: asNumber(data.priority, ruleType === 'MANUAL' ? 100 : 10),
      is_active: asBoolean(data.is_active ?? data.enabled, true),
      enabled: asBoolean(data.enabled ?? data.is_active, true),
      effective_from: asNullableString(data.effective_from),
      effective_to: asNullableString(data.effective_to),
      updated_by: asNullableString(data.updated_by),
      status,
    }
  }

  if (input.entityType === 'saleable_stock') {
    const totalQuantity = data.total_quantity === null ? null : asNullableNumber(data.total_quantity ?? data.saleable_quantity)
    const soldQuantity = asNumber(data.sold_quantity, 0)
    const reservedQuantity = asNumber(data.reserved_quantity, 0)
    const availableQuantity = totalQuantity === null ? null : Math.max(0, asNumber(totalQuantity, 0) - soldQuantity - reservedQuantity)
    const remainingQuantity = totalQuantity === null ? null : Math.max(0, asNumber(totalQuantity, 0) - soldQuantity)
    const storeId = asString(data.store_id, input.naturalScopeKey)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope: 'STORE',
      storeId,
    })
    return {
      ...data,
      stock_id: asString(data.stock_id, input.entityId),
      platform_id: platformId,
      product_id: asString(data.product_id, ''),
      store_id: storeId,
      sku_id: asNullableString(data.sku_id),
      stock_granularity: asString(data.stock_granularity, data.sku_id ? 'SKU' : 'PRODUCT'),
      stock_type: asString(data.stock_type, 'TOTAL'),
      period_id: asNullableString(data.period_id),
      stock_date: asNullableString(data.stock_date) ?? new Date(now()).toISOString().slice(0, 10),
      total_quantity: totalQuantity,
      sold_quantity: soldQuantity,
      reserved_quantity: reservedQuantity,
      available_quantity: availableQuantity,
      remaining_quantity: remainingQuantity,
      saleable_quantity: availableQuantity ?? totalQuantity,
      safety_stock: asNumber(data.safety_stock, 0),
      sold_out_threshold: asNumber(data.sold_out_threshold, 0),
      reservation_ttl_seconds: asNumber(data.reservation_ttl_seconds, 300),
      reset_policy: asString(data.reset_policy, 'MANUAL'),
      last_reset_at: asNullableString(data.last_reset_at),
      ingredient_consumption: asRecordList(data.ingredient_consumption),
      status: computeStockStatus({
        ...data,
        total_quantity: totalQuantity,
        sold_quantity: soldQuantity,
        reserved_quantity: reservedQuantity,
      }),
    }
  }

  if (input.entityType === 'product_category') {
    const ownershipScope = asString(data.ownership_scope, input.naturalScopeType === 'STORE' ? 'STORE' : 'BRAND')
    const ownerId = asString(data.owner_id, input.naturalScopeKey)
    const platformId = resolveOwnerPlatformId({
      sandboxId: input.sandboxId,
      data,
      ownershipScope,
      brandId: ownershipScope === 'BRAND' ? ownerId : data.brand_id,
      storeId: ownershipScope === 'STORE' ? ownerId : data.store_id,
    })
    return {
      ...data,
      category_id: asString(data.category_id, input.entityId),
      platform_id: platformId,
      category_code: asString(data.category_code, input.entityId),
      category_name: asString(data.category_name, input.title),
      parent_category_id: asNullableString(data.parent_category_id),
      ownership_scope: ownershipScope,
      owner_id: ownerId,
      sort_order: asNumber(data.sort_order, 100),
      status,
    }
  }

  if (input.entityType === 'brand_metadata') {
    const brandId = asString(data.brand_id, input.naturalScopeKey)
    return {
      ...data,
      metadata_id: asString(data.metadata_id, input.entityId),
      platform_id: resolveOwnerPlatformId({
        sandboxId: input.sandboxId,
        data,
        ownershipScope: 'BRAND',
        brandId,
      }),
      brand_id: brandId,
      metadata_type: asString(data.metadata_type, 'MODIFIER_GROUP'),
      metadata_name: asString(data.metadata_name, input.title),
      status,
    }
  }

  if (input.entityType === 'product_inheritance') {
    const storeId = asString(data.store_id, input.naturalScopeKey)
    return {
      ...data,
      inheritance_id: asString(data.inheritance_id, input.entityId),
      platform_id: resolveOwnerPlatformId({
        sandboxId: input.sandboxId,
        data,
        ownershipScope: 'STORE',
        storeId,
      }),
      brand_product_id: asString(data.brand_product_id, ''),
      store_product_id: asString(data.store_product_id, ''),
      store_id: storeId,
      override_fields: asRecordList(data.override_fields),
      locked_fields: asStringList(data.locked_fields),
      sync_status: asString(data.sync_status, 'SYNCED'),
      last_sync_at: asNullableString(data.last_sync_at),
      status,
    }
  }

  if (input.entityType === 'bundle_price_rule') {
    const storeId = asString(data.store_id, input.naturalScopeKey)
    return {
      ...data,
      rule_id: asString(data.rule_id, input.entityId),
      platform_id: resolveOwnerPlatformId({
        sandboxId: input.sandboxId,
        data,
        ownershipScope: 'STORE',
        storeId,
      }),
      store_id: storeId,
      rule_name: asString(data.rule_name, input.title),
      trigger_products: asRecordList(data.trigger_products),
      discount_type: asString(data.discount_type, 'TOTAL_DISCOUNT'),
      discount_value: asNumber(data.discount_value, 0),
      max_applications: Math.max(0, asNumber(data.max_applications, 0)),
      priority: asNumber(data.priority, 10),
      is_active: asBoolean(data.is_active, status === 'ACTIVE'),
      effective_from: asNullableString(data.effective_from),
      effective_to: asNullableString(data.effective_to),
      status,
    }
  }

  if (input.entityType === 'channel_product_mapping') {
    const storeId = asString(data.store_id, input.naturalScopeKey)
    return {
      ...data,
      mapping_id: asString(data.mapping_id, input.entityId),
      platform_id: resolveOwnerPlatformId({
        sandboxId: input.sandboxId,
        data,
        ownershipScope: 'STORE',
        storeId,
      }),
      store_id: storeId,
      product_id: asString(data.product_id, ''),
      channel_type: asString(data.channel_type, 'MINI_PROGRAM'),
      external_product_id: asNullableString(data.external_product_id),
      external_sku_id: asNullableString(data.external_sku_id),
      mapping_status: asString(data.mapping_status, 'PENDING'),
      sync_status: asString(data.sync_status, 'NOT_SYNCED'),
      last_sync_at: asNullableString(data.last_sync_at),
      sync_error_message: asNullableString(data.sync_error_message),
      field_mapping_config: asRecord(data.field_mapping_config),
      status,
    }
  }

  return {
    ...data,
    status,
  }
}

export const initializeAlignedMasterData = () => {
  ensureSchema()
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM aligned_master_data_entities').get() as {count: number}
  if (row.count > 0) {
    ensureCustomerDemoMasterData()
    repairKnownSeedInconsistencies()
    return
  }

  if (seedAlignedStateFromMasterDocuments()) {
    ensureCustomerDemoMasterData()
    repairKnownSeedInconsistencies()
    return
  }

  const seedMutation = defaultMutation({actorType: 'SEED', actorId: 'seed'})

  createPlatform({
    platformCode: 'PLATFORM_KERNEL_BASE_TEST',
    platformName: 'Kernel Base Test Platform',
    description: 'Production-shaped kernel-base test mall platform',
    mutation: seedMutation,
  })
  createRegion({
    regionId: 'region-kernel-base-south-china',
    platformId: identity.platformId,
    regionCode: 'SOUTH_CHINA',
    regionName: '华南大区',
    regionLevel: 1,
    mutation: seedMutation,
  })
  createProject({
    projectCode: 'PROJECT_KERNEL_BASE_TEST',
    projectName: 'Kernel Base Test Project',
    regionId: 'region-kernel-base-south-china',
    region: {
      region_id: 'region-kernel-base-south-china',
      region_code: 'SZ',
      region_name: 'Shenzhen',
      parent_region_code: 'CN-GD',
      region_level: 2,
    },
    timezone: 'Asia/Shanghai',
    mutation: seedMutation,
  })
  createTenant({
    tenantId: identity.tenantId,
    tenantCode: 'TENANT_KERNEL_BASE_TEST',
    tenantName: 'Kernel Base Test Tenant',
    mutation: seedMutation,
  })
  createBrand({
    brandId: identity.brandId,
    brandCode: 'BRAND_KERNEL_BASE_TEST',
    brandName: 'Kernel Base Test Brand',
    platformId: identity.platformId,
    mutation: seedMutation,
  })
  createBusinessEntity({
    entityId: 'entity-kernel-base-test',
    entityCode: 'ENTITY_KERNEL_BASE_TEST',
    entityName: 'Kernel Base Test Legal Entity',
    tenantId: identity.tenantId,
    mutation: seedMutation,
  })
  createStore({
    storeId: identity.storeId,
    storeCode: 'STORE_KERNEL_BASE_TEST',
    storeName: 'Kernel Base Test Store',
    unitCode: 'KB001',
    projectId: identity.projectId,
    mutation: seedMutation,
  })
  createContract({
    contractId: identity.contractId,
    contractCode: 'CONTRACT_KERNEL_BASE_TEST',
    storeId: identity.storeId,
    tenantId: identity.tenantId,
    brandId: identity.brandId,
    entityId: 'entity-kernel-base-test',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    mutation: seedMutation,
  })
  createTableEntity({
    tableId: 'table-store-kernel-base-test-a01',
    storeId: identity.storeId,
    tableNo: 'A01',
    capacity: 4,
    mutation: seedMutation,
  })
  createWorkstation({
    workstationId: 'workstation-cold-kitchen',
    storeId: identity.storeId,
    workstationCode: 'COLD_KITCHEN',
    workstationName: 'Cold Kitchen',
    categoryCodes: ['SIGNATURE_BOWL'],
    mutation: seedMutation,
  })
  createPermission({
    permissionId: 'perm-product-manage',
    permissionCode: 'product:manage',
    permissionName: 'Manage Product',
    permissionType: 'SYSTEM',
    mutation: seedMutation,
  })
  createRole({
    roleId: 'role-store-manager',
    roleCode: 'STORE_MANAGER',
    roleName: 'Store Manager',
    scopeType: 'STORE',
    permissionIds: ['perm-product-manage'],
    mutation: seedMutation,
  })
  createUser({
    userId: 'user-linmei',
    userCode: 'lin.mei',
    displayName: 'Lin Mei',
    mobile: '13800000001',
    storeId: identity.storeId,
    mutation: seedMutation,
  })
  createUserRoleBinding({
    bindingId: 'binding-linmei-manager',
    userId: 'user-linmei',
    roleId: 'role-store-manager',
    storeId: identity.storeId,
    mutation: seedMutation,
  })
  createProduct({
    productId: 'product-salmon-bowl',
    productName: 'Salmon Bowl',
    ownershipScope: 'BRAND',
    brandId: identity.brandId,
    productType: 'STANDARD',
    basePrice: 58,
    productionSteps: [
      {step_code: 'ASSEMBLE', step_name: 'Assemble Bowl', workstation_code: 'COLD_KITCHEN'},
    ],
    modifierGroups: [
      {modifier_group_id: 'modifier-protein', group_name: 'Protein Option', selection_type: 'SINGLE'},
    ],
    mutation: seedMutation,
  })
  createBrandMenu({
    brandMenuId: 'brand-menu-seaflame-main',
    brandId: identity.brandId,
    menuName: 'Kernel Base Test Main Menu',
    sections: [
      {
        section_id: 'section-signature',
        section_name: 'Signature Bowls',
        display_order: 10,
        products: [{product_id: 'product-salmon-bowl', display_order: 10}],
      },
    ],
    reviewStatus: 'APPROVED',
    mutation: seedMutation,
  })
  createStoreMenu({
    menuId: 'menu-seaflame-store-001',
    storeId: identity.storeId,
    menuName: 'Kernel Base Test Store Effective Menu',
    sections: [
      {
        section_id: 'section-signature',
        section_name: 'Signature Bowls',
        display_order: 10,
        products: [{product_id: 'product-salmon-bowl', display_order: 10}],
      },
    ],
    versionHash: 'menu-hash-001',
    mutation: seedMutation,
  })
  createPriceRule({
    ruleId: 'price-rule-lunch-member',
    ruleCode: 'PRICE_LUNCH_MEMBER',
    productId: 'product-salmon-bowl',
    storeId: identity.storeId,
    priceType: 'MEMBER',
    channelType: 'POS',
    priceDelta: -3,
    mutation: seedMutation,
  })
  createStoreConfig({
    configId: 'store-config-kernel-base-test',
    storeId: identity.storeId,
    businessStatus: 'OPEN',
    acceptOrder: true,
    operatingHours: [
      {weekday: 1, start: '09:00', end: '22:00'},
      {weekday: 2, start: '09:00', end: '22:00'},
    ],
    extraChargeRules: [
      {rule_id: 'charge-night', rule_name: 'Night Packaging Fee', amount: 2},
    ],
    mutation: seedMutation,
  })
  upsertMenuAvailability({
    productId: 'product-salmon-bowl',
    storeId: identity.storeId,
    available: true,
    soldOutReason: null,
    effectiveFrom: '2026-04-23T00:00:00.000Z',
    mutation: seedMutation,
  })
  createAvailabilityRule({
    ruleId: 'availability-rule-dine-in',
    ruleCode: 'AVAILABILITY_DINE_IN',
    storeId: identity.storeId,
    productId: 'product-salmon-bowl',
    channelType: 'DINE_IN',
    available: true,
    mutation: seedMutation,
  })
  upsertSaleableStock({
    stockId: 'stock-product-salmon-bowl',
    storeId: identity.storeId,
    productId: 'product-salmon-bowl',
    saleableQuantity: 28,
    totalQuantity: 28,
    reservedQuantity: 2,
    safetyStock: 4,
    mutation: seedMutation,
  })
  ensureCustomerDemoMasterData()
  repairKnownSeedInconsistencies()
}

const ensurePlatformScopedIamSeeds = () => {
  const platforms = listRowsByEntityTypeAcrossSandboxes('platform').map(toAggregateRow)
  const sandboxIds = Array.from(new Set(platforms.map(platform => platform.sandboxId)))

  sandboxIds.forEach(sandboxId => {
    const permissionTemplatesByCode = new Map<string, AggregateRow>()
    listRowsByEntityType('permission', sandboxId).map(toAggregateRow).forEach(permission => {
      const data = asRecord(permission.payload.data)
      const permissionCode = asOptionalString(data.permission_code)
      const platformId = asOptionalString(data.platform_id)
      if (permissionCode && !platformId && !permissionTemplatesByCode.has(permissionCode)) {
        permissionTemplatesByCode.set(permissionCode, permission)
      }
    })

    const roleTemplatesByCode = new Map<string, AggregateRow>()
    listRowsByEntityType('role', sandboxId).map(toAggregateRow).forEach(role => {
      const data = asRecord(role.payload.data)
      const roleCode = asOptionalString(data.role_code)
      const platformId = asOptionalString(data.platform_id)
      if (roleCode && !platformId && !roleTemplatesByCode.has(roleCode)) {
        roleTemplatesByCode.set(roleCode, role)
      }
    })

    platforms
      .filter(platform => platform.sandboxId === sandboxId)
      .forEach(platform => {
        const platformId = platform.entityId
        const migrationMutation: MutationInput = {
          sandboxId,
          actorType: 'SEED_MIGRATION',
          actorId: 'platform-scoped-iam',
        }
        const permissionIdByLegacyId = new Map<string, string>()

        permissionTemplatesByCode.forEach(permission => {
          const data = cloneJson(asRecord(permission.payload.data))
          const permissionCode = asString(data.permission_code, permission.entityId)
          const permissionId = normalizeId(`perm-${platformId}-${permissionCode}`)
          permissionIdByLegacyId.set(permission.entityId, permissionId)
          if (!getEntityRow('permission', permissionId, sandboxId)) {
            upsertEntity({
              entityType: 'permission',
              entityId: permissionId,
              title: permission.title,
              status: permission.status,
              naturalScopeType: 'PLATFORM',
              naturalScopeKey: platformId,
              mutation: migrationMutation,
              eventType: 'PermissionPlatformScopedSeeded',
              data: {
                ...data,
                permission_id: permissionId,
                platform_id: platformId,
              },
            })
          }
        })

        const roleIdByLegacyId = new Map<string, string>()
        roleTemplatesByCode.forEach(role => {
          const data = cloneJson(asRecord(role.payload.data))
          const roleCode = asString(data.role_code, role.entityId)
          const roleId = normalizeId(`role-${platformId}-${roleCode}`)
          roleIdByLegacyId.set(role.entityId, roleId)
          const permissionIds = Array.isArray(data.permission_ids)
            ? data.permission_ids.map(permissionId => permissionIdByLegacyId.get(asString(permissionId)) ?? asString(permissionId)).filter(Boolean)
            : []
          if (!getEntityRow('role', roleId, sandboxId)) {
            upsertEntity({
              entityType: 'role',
              entityId: roleId,
              title: role.title,
              status: role.status,
              naturalScopeType: 'PLATFORM',
              naturalScopeKey: platformId,
              mutation: migrationMutation,
              eventType: 'RolePlatformScopedSeeded',
              data: {
                ...data,
                role_id: roleId,
                platform_id: platformId,
                role_type: asOptionalString(data.role_type) ?? 'SYSTEM',
                permission_ids: permissionIds,
              },
            })
          }
        })

        listRowsByEntityType('user_role_binding', sandboxId).map(toAggregateRow).forEach(binding => {
          const data = cloneJson(asRecord(binding.payload.data))
          const storeId = asOptionalString(data.store_id)
          const store = storeId ? findAggregateRow('store', storeId, sandboxId) : null
          if (!store || asOptionalString(asRecord(store.payload.data).platform_id) !== platformId) {
            return
          }
          const legacyRoleId = asOptionalString(data.role_id)
          const scopedRoleId = legacyRoleId ? roleIdByLegacyId.get(legacyRoleId) : undefined
          if (!scopedRoleId || scopedRoleId === legacyRoleId) {
            return
          }
          upsertEntity({
            entityType: 'user_role_binding',
            entityId: binding.entityId,
            title: `${asString(data.user_id, '')}:${scopedRoleId}`,
            status: binding.status,
            naturalScopeType: binding.naturalScopeType,
            naturalScopeKey: binding.naturalScopeKey,
            mutation: migrationMutation,
            eventType: 'UserRoleBindingPlatformRoleMigrated',
            data: {
              ...data,
              platform_id: platformId,
              role_id: scopedRoleId,
            },
          })
        })
      })
  })
}

const migrateLegacyPermissionCode = (permissionCode: string) => {
  if (permissionCode === 'PRODUCT_MANAGE') {
    return 'product:manage'
  }
  if (permissionCode.includes(':')) {
    return permissionCode
  }
  const normalized = permissionCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, ':').replace(/^:+|:+$/g, '')
  const [resource, action] = normalized.split(':').filter(Boolean)
  return resource && action ? `${resource}:${action}` : permissionCode
}

const repairKnownSeedInconsistencies = () => {
  listRowsByEntityTypeAcrossSandboxes('permission').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    const permissionCode = asOptionalString(data.permission_code)
    if (!permissionCode || permissionCode.includes(':')) return
    const migratedPermissionCode = migrateLegacyPermissionCode(permissionCode)
    if (migratedPermissionCode === permissionCode || !migratedPermissionCode.includes(':')) return
    const [resourceType, action] = migratedPermissionCode.split(':', 2)
    const migratedPlatformId = asOptionalString(data.platform_id) ?? aggregate.naturalScopeKey ?? identity.platformId
    const existingMigratedPermission = listRowsByEntityType('permission', aggregate.sandboxId)
      .map(toAggregateRow)
      .find(item => {
        const itemData = asRecord(item.payload.data)
        const itemPlatformId = asOptionalString(itemData.platform_id) ?? item.naturalScopeKey ?? identity.platformId
        return item.entityId !== aggregate.entityId
          && asOptionalString(itemData.permission_code) === migratedPermissionCode
          && itemPlatformId === migratedPlatformId
      })
    if (existingMigratedPermission) {
      const migrationMutation = {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      }
      listRowsByEntityType('role', aggregate.sandboxId)
        .map(toAggregateRow)
        .forEach(role => {
          const latestRole = findAggregateRow('role', role.entityId, aggregate.sandboxId) ?? role
          const roleData = cloneJson(asRecord(latestRole.payload.data))
          const permissionIds = asStringList(roleData.permission_ids)
          if (!permissionIds.includes(aggregate.entityId)) {
            return
          }
          upsertEntity({
            entityType: 'role',
            entityId: latestRole.entityId,
            title: latestRole.title,
            status: latestRole.status,
            naturalScopeType: latestRole.naturalScopeType,
            naturalScopeKey: latestRole.naturalScopeKey,
            mutation: {
              ...migrationMutation,
              expectedRevision: latestRole.sourceRevision,
            },
            eventType: 'RolePermissionLegacyReferenceMigrated',
            data: {
              ...roleData,
              permission_ids: Array.from(new Set(permissionIds.map(permissionId => permissionId === aggregate.entityId ? existingMigratedPermission.entityId : permissionId))),
            },
          })
        })
      upsertEntity({
        entityType: 'permission',
        entityId: aggregate.entityId,
        title: aggregate.title,
        status: 'INACTIVE',
        naturalScopeType: aggregate.naturalScopeType,
        naturalScopeKey: aggregate.naturalScopeKey,
        mutation: migrationMutation,
        eventType: 'PermissionCodeFormatDeprecated',
        data: {
          ...data,
          permission_code: `legacy:${normalizeId(aggregate.entityId)}`,
          resource: 'legacy',
          resource_type: 'legacy',
          action: normalizeId(aggregate.entityId),
          migrated_to_permission_id: existingMigratedPermission.entityId,
          migrated_to_permission_code: migratedPermissionCode,
          status: 'INACTIVE',
        },
      })
      return
    }
    upsertEntity({
      entityType: 'permission',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'PermissionCodeFormatMigrated',
      data: {
        ...data,
        permission_code: migratedPermissionCode,
        resource: resourceType,
        resource_type: resourceType,
        action,
      },
    })
  })

  const binding = getEntityRow('user_role_binding', 'binding-linmei-manager')
  if (binding) {
    const aggregate = toAggregateRow(binding)
    const data = cloneJson(asRecord(aggregate.payload.data))
    if (asString(data.user_id) === 'user-lin-mei') {
      upsertEntity({
        entityType: 'user_role_binding',
        entityId: 'binding-linmei-manager',
        title: aggregate.title,
        status: aggregate.status,
        naturalScopeType: aggregate.naturalScopeType,
        naturalScopeKey: aggregate.naturalScopeKey,
        mutation: {
          sandboxId: aggregate.sandboxId,
          actorType: 'SEED_MIGRATION',
          actorId: 'aligned-master-data',
          expectedRevision: aggregate.sourceRevision,
        },
        eventType: 'UserRoleBindingMigrated',
        data: {
          ...data,
          user_id: 'user-linmei',
        },
      })
    }
  }

  listRowsByEntityTypeAcrossSandboxes('brand').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    if (!('tenant_id' in data) && aggregate.naturalScopeKey === asString(data.platform_id, aggregate.naturalScopeKey)) {
      return
    }

    delete data.tenant_id
    const platformId = asString(data.platform_id, identity.platformId)
    upsertEntity({
      entityType: 'brand',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: 'BRAND',
      naturalScopeKey: platformId,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'BrandPlatformScopeMigrated',
      data,
    })
  })

  listRowsByEntityTypeAcrossSandboxes('tenant').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    if (!('tenant_category' in data)) return
    delete data.tenant_category
    upsertEntity({
      entityType: 'tenant',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'TenantCategoryRemoved',
      data,
    })
  })

  listRowsByEntityTypeAcrossSandboxes('platform').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    const catalog = asRecord(data.metadata_catalog)
    const normalizedCatalog = normalizePlatformMetadataCatalog(catalog, {mergeDefaults: true})
    if (normalizeComparable(catalog) === normalizeComparable(normalizedCatalog)) return
    data.metadata_catalog = normalizedCatalog
    upsertEntity({
      entityType: 'platform',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'PlatformMetadataCatalogMigrated',
      data,
    })
  })

  listRowsByEntityTypeAcrossSandboxes('brand').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    const normalizedBrandCategory = normalizeLegacyBrandCategory(data.brand_category)
    const catalog = asRecord(data.metadata_catalog)
    const normalizedCatalog = normalizeEntityMetadataCatalog(catalog, 'BRAND', aggregate.entityId, {mergeDefaults: true})
    if (normalizeComparable(catalog) === normalizeComparable(normalizedCatalog) && data.brand_category === normalizedBrandCategory) return
    data.brand_category = normalizedBrandCategory
    data.metadata_catalog = normalizedCatalog
    upsertEntity({
      entityType: 'brand',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'BrandMetadataCatalogMigrated',
      data,
    })
  })

  listRowsByEntityTypeAcrossSandboxes('store').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    const activeContractId = asNullableString(data.active_contract_id)
    if (!activeContractId) {
      data.active_contract_id = null
      data.tenant_id = null
      data.brand_id = null
      data.entity_id = null
      data.store_status = 'VACANT'
      data.operating_status = 'PREPARING'
      data.contract_status = 'NO_CONTRACT'
    }
    const catalog = asRecord(data.metadata_catalog)
    const normalizedCatalog = normalizeEntityMetadataCatalog(catalog, 'STORE', aggregate.entityId, {mergeDefaults: true})
    if (
      normalizeComparable(catalog) === normalizeComparable(normalizedCatalog)
      && activeContractId === asNullableString(data.active_contract_id)
      && asNullableString(asRecord(aggregate.payload.data).tenant_id) === asNullableString(data.tenant_id)
      && asNullableString(asRecord(aggregate.payload.data).brand_id) === asNullableString(data.brand_id)
      && asNullableString(asRecord(aggregate.payload.data).entity_id) === asNullableString(data.entity_id)
      && asString(asRecord(aggregate.payload.data).store_status, '') === asString(data.store_status, '')
      && asString(asRecord(aggregate.payload.data).contract_status, '') === asString(data.contract_status, '')
    ) return
    data.metadata_catalog = normalizedCatalog
    upsertEntity({
      entityType: 'store',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'StoreMetadataCatalogMigrated',
      data,
    })
  })

  listRowsByEntityTypeAcrossSandboxes('project').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    if (Array.isArray(data.project_phases) && data.project_phases.length > 0) return
    upsertEntity({
      entityType: 'project',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'ProjectPhasesInitialized',
      data: {
        ...data,
        project_phases: normalizeProjectPhases(data.project_phases, asString(data.project_name, aggregate.title)),
      },
    })
  })

  listRowsByEntityTypeAcrossSandboxes('contract').forEach(row => {
    const aggregate = toAggregateRow(row)
    const data = cloneJson(asRecord(aggregate.payload.data))
    if (data.lessor_project_id && data.lessor_phase_id && data.lessor_owner_name && data.lessee_store_id) return
    const storeId = asString(data.store_id, '')
    const store = storeId ? findAggregateRow('store', storeId, aggregate.sandboxId) : null
    const storeData = cloneJson(asRecord(store?.payload.data))
    const projectId = asOptionalString(data.lessor_project_id)
      ?? asOptionalString(data.project_id)
      ?? asOptionalString(storeData.project_id)
      ?? identity.projectId
    const project = findAggregateRow('project', projectId, aggregate.sandboxId)
    const projectData = cloneJson(asRecord(project?.payload.data))
    const phase = resolveProjectPhase(projectData, asOptionalString(data.lessor_phase_id))
    const tenant = findAggregateRow('tenant', asOptionalString(data.tenant_id), aggregate.sandboxId)
    const brand = findAggregateRow('brand', asOptionalString(data.brand_id), aggregate.sandboxId)
    upsertEntity({
      entityType: 'contract',
      entityId: aggregate.entityId,
      title: aggregate.title,
      status: aggregate.status,
      naturalScopeType: aggregate.naturalScopeType,
      naturalScopeKey: aggregate.naturalScopeKey,
      mutation: {
        sandboxId: aggregate.sandboxId,
        actorType: 'SEED_MIGRATION',
        actorId: 'aligned-master-data',
        expectedRevision: aggregate.sourceRevision,
      },
      eventType: 'ContractPartyModelMigrated',
      data: {
        ...data,
        project_id: projectId,
        lessor_project_id: projectId,
        lessor_project_name: asString(projectData.project_name, project?.title ?? ''),
        lessor_phase_id: phase.phase_id,
        lessor_phase_name: phase.phase_name,
        lessor_owner_name: phase.owner_name,
        lessor_owner_contact: phase.owner_contact,
        lessor_owner_phone: phase.owner_phone,
        lessee_store_id: storeId,
        lessee_store_name: asString(storeData.store_name, store?.title ?? ''),
        lessee_tenant_id: asString(data.tenant_id, ''),
        lessee_tenant_name: tenant?.title ?? '',
        lessee_brand_id: asString(data.brand_id, ''),
        lessee_brand_name: brand?.title ?? '',
        entity_id: asOptionalString(data.entity_id) ?? asString(data.tenant_id, ''),
      },
    })
  })

  ensurePlatformScopedIamSeeds()
}

export const getAlignedOverview = (sandboxId = DEFAULT_SANDBOX_ID) => {
  ensureSchema()
  const entityRows = sqlite.prepare(`
    SELECT domain, entity_type, COUNT(*) as count
    FROM aligned_master_data_entities
    WHERE sandbox_id = ?
    GROUP BY domain, entity_type
    ORDER BY domain ASC, entity_type ASC
  `).all(sandboxId) as Array<{domain: string; entity_type: string; count: number}>

  const legacyRows = sqlite.prepare(`
    SELECT domain, entity_type, COUNT(*) as count
    FROM master_data_documents
    GROUP BY domain, entity_type
    ORDER BY domain ASC, entity_type ASC
  `).all() as Array<{domain: string; entity_type: string; count: number}>

  const outboxRows = sqlite.prepare(`
    SELECT status, COUNT(*) as count
    FROM projection_outbox
    GROUP BY status
  `).all() as Array<{status: string; count: number}>

  return {
    alignedEntities: entityRows,
    legacyDocuments: legacyRows,
    outbox: outboxRows,
  }
}

export const listPlatforms = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('platform', pagination, sandboxId)

export const listRegions = (pagination: EntityListQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('region', pagination, sandboxId)

export const listSandboxes = (pagination: EntityListQuery, _sandboxId = DEFAULT_SANDBOX_ID) => {
  const explicitSandboxes = listRowsByEntityTypeAcrossSandboxes('sandbox').map(toAggregateRow)
  const explicitById = new Map(explicitSandboxes.map(item => [item.entityId, item]))
  const sandboxRows = sqlite.prepare(`
    SELECT sandbox_id, COUNT(*) as entity_count, MAX(updated_at) as updated_at
    FROM aligned_master_data_entities
    GROUP BY sandbox_id
    ORDER BY updated_at DESC, sandbox_id ASC
  `).all() as Array<{sandbox_id: string; entity_count: number; updated_at: number}>
  const itemById = new Map<string, AggregateRow | {
    aggregateId: string
    sandboxId: string
    domain: string
    entityType: 'sandbox'
    entityId: string
    naturalScopeType: string
    naturalScopeKey: string
    title: string
    status: string
    sourceRevision: number
    payload: Record<string, unknown>
    createdAt: number
    updatedAt: number
  }>()
  sandboxRows.forEach(row => {
    itemById.set(row.sandbox_id, explicitById.get(row.sandbox_id) ?? {
    aggregateId: `synthetic-${row.sandbox_id}`,
    sandboxId: row.sandbox_id,
    domain: 'organization',
    entityType: 'sandbox' as const,
    entityId: row.sandbox_id,
    naturalScopeType: 'SANDBOX',
    naturalScopeKey: row.sandbox_id,
    title: row.sandbox_id === 'sandbox-customer-real-retail-20260425'
      ? '真实商业综合体联调沙箱'
      : row.sandbox_id,
    status: 'ACTIVE',
    sourceRevision: 1,
    payload: {
      schema_version: 1,
      projection_kind: 'organization',
      sandbox_id: row.sandbox_id,
      data: {
        sandbox_id: row.sandbox_id,
        sandbox_code: row.sandbox_id,
        sandbox_name: row.sandbox_id === 'sandbox-customer-real-retail-20260425'
          ? '真实商业综合体联调沙箱'
          : row.sandbox_id,
        sandbox_type: row.sandbox_id.includes('real-retail') ? 'INTEGRATION' : 'DEBUG',
        entity_count: row.entity_count,
        status: 'ACTIVE',
      },
    },
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
    })
  })
  explicitSandboxes.forEach(sandbox => {
    if (!itemById.has(sandbox.entityId)) {
      itemById.set(sandbox.entityId, sandbox)
    }
  })
  const items = Array.from(itemById.values())
  return paginateItems(filterEntities(items, pagination), pagination)
}

export const listProjects = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('project', pagination, sandboxId)

export const listTenants = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('tenant', pagination, sandboxId)

export const listTenantStores = (
  tenantId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) =>
  paginateItems(
    listRowsByEntityType('store', sandboxId)
      .map(toAggregateRow)
      .filter(item => asString(asRecord(item.payload.data).tenant_id, '') === tenantId),
    pagination,
  )

export const listBrands = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('brand', pagination, sandboxId)

export const listStores = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  paginateItems(
    filterEntities(listRowsByEntityType('store', sandboxId).map(toAggregateRow).map(store => withDerivedStoreContractSnapshot(store, sandboxId)), pagination),
    pagination,
  )

export const listContracts = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  paginateItems(
    filterEntities(listRowsByEntityType('contract', sandboxId).map(toAggregateRow).map(withDerivedContractStatus), pagination),
    pagination,
  )

export const listBusinessEntities = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('business_entity', pagination, sandboxId)

export const listTables = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('table', pagination, sandboxId)

export const listWorkstations = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('workstation', pagination, sandboxId)

export const listTablesByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('table', 'STORE', storeId, pagination, sandboxId)

export const listWorkstationsByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('workstation', 'STORE', storeId, pagination, sandboxId)

export const listUsers = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('user', pagination, sandboxId)

export const listPermissions = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('permission', pagination, sandboxId)

export const listIdentityProviderConfigs = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('identity_provider_config', pagination, sandboxId)

export const listPermissionGroups = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('permission_group', pagination, sandboxId)

export const listRoleTemplates = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('role_template', pagination, sandboxId)

export const listFeaturePoints = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('feature_point', pagination, sandboxId)

export const listPlatformFeatureSwitches = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('platform_feature_switch', pagination, sandboxId)

export const listRoles = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('role', pagination, sandboxId)

export const listUserRoleBindings = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('user_role_binding', pagination, sandboxId)

export const listResourceTags = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('resource_tag', pagination, sandboxId)

export const listPrincipalGroups = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('principal_group', pagination, sandboxId)

export const listGroupMembers = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('group_member', pagination, sandboxId)

export const listGroupRoleBindings = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('group_role_binding', pagination, sandboxId)

export const listAuthorizationSessions = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('authorization_session', pagination, sandboxId)

export const listSeparationOfDutyRules = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('separation_of_duty_rule', pagination, sandboxId)

export const listHighRiskPermissionPolicies = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('high_risk_permission_policy', pagination, sandboxId)

export const listBrandMetadata = (
  brandId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('brand_metadata', 'BRAND', brandId, pagination, sandboxId)

const readAggregateData = (item: AggregateRow | null | undefined) =>
  asRecord(item?.payload.data)

const toSafeUser = (user: AggregateRow) => {
  const data = readAggregateData(user)
  return {
    userId: user.entityId,
    userCode: asOptionalString(data.user_code) ?? user.entityId,
    displayName: user.title,
    mobile: asOptionalString(data.mobile) ?? null,
    storeId: asOptionalString(data.store_id) ?? user.naturalScopeKey,
    status: user.status,
    sourceRevision: user.sourceRevision,
    naturalScopeType: user.naturalScopeType,
    naturalScopeKey: user.naturalScopeKey,
  }
}

const toRoleSummary = (role: AggregateRow | null) => {
  if (!role) {
    return null
  }
  const data = readAggregateData(role)
  return {
    roleId: role.entityId,
    roleCode: asOptionalString(data.role_code) ?? role.entityId,
    roleName: role.title,
    roleSource: asOptionalString(data.role_source) ?? asOptionalString(data.role_type) ?? asOptionalString(data.permission_type) ?? 'CUSTOM',
    scopeType: asOptionalString(data.scope_type) ?? role.naturalScopeType,
    permissionIds: Array.isArray(data.permission_ids)
      ? data.permission_ids.map(item => asString(item, '')).filter(Boolean)
      : [],
    status: role.status,
  }
}

const toPermissionSummary = (permission: AggregateRow | null) => {
  if (!permission) {
    return null
  }
  const data = readAggregateData(permission)
  return {
    permissionId: permission.entityId,
    permissionCode: asOptionalString(data.permission_code) ?? permission.entityId,
    permissionName: permission.title,
    permissionType: asOptionalString(data.permission_type) ?? 'SYSTEM',
    status: permission.status,
  }
}

const bindingMatchesStore = (binding: AggregateRow, storeId: string, sandboxId = DEFAULT_SANDBOX_ID) => {
  const data = readAggregateData(binding)
  if (asOptionalString(data.store_id) === storeId) {
    return true
  }
  const scope = bindingScopeForData(data, binding.naturalScopeType, binding.naturalScopeKey)
  return bindingScopeMatches(scope, {
    ...storeTargetForScope(storeId, sandboxId),
    sandboxId,
  })
}

export const getUserEffectivePermissions = (input: {
  userId: string
  storeId: string
  sandboxId?: string
}) => {
  const sandboxId = input.sandboxId ?? DEFAULT_SANDBOX_ID
  const user = requireEntityRow('user', input.userId, sandboxId)
  const userIsActive = user.status === 'ACTIVE'
  const bindings = userIsActive
    ? [
      ...getActiveDirectRoleBindingsForUser(input.userId, sandboxId),
      ...getActiveGroupRoleBindingsForUser(input.userId, sandboxId),
    ].filter(binding => bindingMatchesStore(binding, input.storeId, sandboxId))
    : []

  const roleMap = new Map<string, NonNullable<ReturnType<typeof toRoleSummary>>>()
  const permissionMap = new Map<string, NonNullable<ReturnType<typeof toPermissionSummary>>>()
  const bindingSummaries = bindings.map(binding => {
    const data = readAggregateData(binding)
    const role = findAggregateRow('role', asOptionalString(data.role_id), sandboxId)
    const roleSummary = role?.status === 'ACTIVE' ? toRoleSummary(role) : null
    const scope = bindingScopeForData(data, binding.naturalScopeType, binding.naturalScopeKey)
    if (roleSummary) {
      roleMap.set(roleSummary.roleId, roleSummary)
      roleSummary.permissionIds.forEach(permissionId => {
        const permissionSummary = toPermissionSummary(findAggregateRow('permission', permissionId, sandboxId))
        if (permissionSummary) {
          permissionMap.set(permissionSummary.permissionId, permissionSummary)
        }
      })
    }
    return {
      bindingId: binding.entityId,
      bindingType: binding.entityType,
      userId: input.userId,
      groupId: asOptionalString(data.group_id) ?? null,
      roleId: asOptionalString(data.role_id) ?? null,
      storeId: asOptionalString(data.store_id) ?? (scope.scope_type === 'STORE' ? scope.scope_key : input.storeId),
      scopeSelector: asRecord(data.scope_selector ?? data.resource_scope),
      scopeType: scope.scope_type,
      scopeKey: scope.scope_key,
      policyEffect: asOptionalString(data.policy_effect) ?? 'ALLOW',
      effectiveFrom: asOptionalString(data.effective_from) ?? null,
      effectiveTo: asOptionalString(data.effective_to) ?? null,
      status: binding.status,
      role: roleSummary,
    }
  })

  return {
    user: toSafeUser(user),
    storeId: input.storeId,
    roles: Array.from(roleMap.values()),
    bindings: bindingSummaries,
    permissions: Array.from(permissionMap.values()).sort((left, right) => left.permissionCode.localeCompare(right.permissionCode)),
    projection: {
      userTopic: 'iam.user.store-effective',
      bindingTopic: 'iam.user-role-binding.store-effective',
      scopeType: 'STORE',
      scopeKey: input.storeId,
      userItemKey: input.userId,
      bindingItemKeys: bindingSummaries.map(binding => binding.bindingId),
    },
    security: {
      secretsIncluded: false,
      redactedFields: ['password_hash', 'mfa_secret', 'refresh_token'],
    },
  }
}

export const getStoreEffectiveIam = (input: {storeId: string; sandboxId?: string}) => {
  const sandboxId = input.sandboxId ?? DEFAULT_SANDBOX_ID
  const directBindings = listRowsByEntityType('user_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(binding => {
      if (!bindingIsEffective(binding) || !bindingMatchesStore(binding, input.storeId, sandboxId)) {
        return false
      }
      const user = findAggregateRow('user', asOptionalString(readAggregateData(binding).user_id), sandboxId)
      return user?.status === 'ACTIVE'
    })
  const groupBindings = listRowsByEntityType('group_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(binding => bindingIsEffective(binding) && bindingMatchesStore(binding, input.storeId, sandboxId))
  const groupIds = new Set(groupBindings.map(binding => asOptionalString(readAggregateData(binding).group_id)).filter((groupId): groupId is string => Boolean(groupId)))
  const groupMemberUserIds = listRowsByEntityType('group_member', sandboxId)
    .map(toAggregateRow)
    .filter(member => member.status === 'ACTIVE' && groupIds.has(asString(readAggregateData(member).group_id)))
    .map(member => asOptionalString(readAggregateData(member).user_id))
    .filter((userId): userId is string => Boolean(userId))
    .filter(userId => findAggregateRow('user', userId, sandboxId)?.status === 'ACTIVE')
  const userIds = Array.from(new Set([
    ...directBindings
    .map(binding => asOptionalString(readAggregateData(binding).user_id))
    .filter((userId): userId is string => Boolean(userId)),
    ...groupMemberUserIds,
  ]))

  return {
    storeId: input.storeId,
    users: userIds.map(userId => getUserEffectivePermissions({userId, storeId: input.storeId, sandboxId})),
    bindingIds: [...directBindings, ...groupBindings].map(binding => binding.entityId),
    projection: {
      userTopic: 'iam.user.store-effective',
      bindingTopic: 'iam.user-role-binding.store-effective',
      scopeType: 'STORE',
      scopeKey: input.storeId,
    },
  }
}

export const listProducts = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('product', pagination, sandboxId)

export const listProductCategories = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('product_category', pagination, sandboxId)

export const listProductInheritances = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('product_inheritance', pagination, sandboxId)

export const listMenus = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('brand_menu', pagination, sandboxId)

export const listStoreMenus = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('menu_catalog', pagination, sandboxId)

export const listStoreConfigs = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('store_config', pagination, sandboxId)

export const listInventories = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('saleable_stock', pagination, sandboxId)

export const listStoreConfigsByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('store_config', 'STORE', storeId, pagination, sandboxId)

export const listInventoriesByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('saleable_stock', 'STORE', storeId, pagination, sandboxId)

export const listAvailabilityRulesByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('availability_rule', 'STORE', storeId, pagination, sandboxId)

export const listAvailabilityRules = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('availability_rule', pagination, sandboxId)

export const listMenuAvailabilityByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('menu_availability', 'STORE', storeId, pagination, sandboxId)

export const listMenuAvailability = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('menu_availability', pagination, sandboxId)

export const listPriceRulesByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('price_rule', 'STORE', storeId, pagination, sandboxId)

export const listPriceRules = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('price_rule', pagination, sandboxId)

export const listBundlePriceRules = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('bundle_price_rule', pagination, sandboxId)

export const listChannelProductMappings = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('channel_product_mapping', pagination, sandboxId)

export const listAuditEvents = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  getAuthAuditLogPage(pagination, sandboxId)

export const listBusinessEventDiagnostics = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  getLatestEventPage(pagination, sandboxId)

export const listProjectionDiagnostics = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  getDiagnosticPage(pagination, sandboxId)

export const getStoreContractMonitor = (storeId: string, sandboxId = DEFAULT_SANDBOX_ID) => {
  const store = requireEntityRow('store', storeId, sandboxId)
  const storeData = readEntityData('store', storeId, sandboxId)
  const tenantId = asOptionalString(storeData.tenant_id)
  const brandId = asOptionalString(storeData.brand_id)
  const entityId = asOptionalString(storeData.entity_id)
  const projectId = asOptionalString(storeData.project_id)
  const activeContractId = asOptionalString(storeData.active_contract_id)
  const contracts = listRowsByEntityType('contract', sandboxId)
    .map(toAggregateRow)
    .filter(item => asString(asRecord(item.payload.data).store_id, '') === storeId)
    .sort((left, right) => right.updatedAt - left.updatedAt || left.entityId.localeCompare(right.entityId))

  return {
    store,
    snapshot: {
      activeContractId,
      tenantId,
      brandId,
      entityId,
      projectId,
      unitCode: asOptionalString(storeData.unit_code),
      storeStatus: store.status,
    },
    project: findAggregateRow('project', projectId, sandboxId),
    tenant: findAggregateRow('tenant', tenantId, sandboxId),
    brand: findAggregateRow('brand', brandId, sandboxId),
    businessEntity: findAggregateRow('business_entity', entityId, sandboxId),
    activeContract: findAggregateRow('contract', activeContractId, sandboxId),
    contracts,
    timeline: buildContractTimeline(storeId, sandboxId),
  }
}

export const checkPermissionDecision = (input: {
  userId?: string
  storeId?: string
  permissionId?: string
  permissionCode?: string
  sandboxId?: string
  mutation?: MutationInput
}) => {
  const sandboxId = input.sandboxId ?? DEFAULT_SANDBOX_ID
  const finishDecision = <T extends Record<string, unknown>>(decision: T): T => {
    recordAuthAuditLog({
      mutation: input.mutation,
      sandboxId,
      userId: asOptionalString(decision.userId) ?? input.userId ?? null,
      eventType: 'PermissionDecisionChecked',
      resourceType: 'STORE',
      resourceId: asOptionalString(decision.storeId) ?? input.storeId ?? null,
      action: 'CHECK_PERMISSION',
      permissionCode: asOptionalString(decision.permissionCode) ?? input.permissionCode ?? input.permissionId ?? null,
      result: decision.allowed === true ? 'ALLOWED' : 'DENIED',
      denyReason: decision.allowed === true ? null : asOptionalString(decision.denyReason) ?? asOptionalString(decision.reason),
      detail: cloneJson(decision),
    })
    return decision
  }
  const userId = asOptionalString(input.userId) ?? null
  const storeId = asOptionalString(input.storeId) ?? null
  const permissionId = asOptionalString(input.permissionId)
  const permissionCode = asOptionalString(input.permissionCode)

  if (!userId || !storeId) {
    return finishDecision({
      allowed: false,
      userId,
      storeId,
      permissionId: permissionId ?? null,
      permissionCode: permissionCode ?? null,
      permissionName: null,
      matchedBindingIds: [] as string[],
      matchedRoleIds: [] as string[],
      bindingIdsConsidered: [] as string[],
      roleIdsConsidered: [] as string[],
      reason: 'MISSING_USER_OR_STORE',
      decisionSource: 'mock-admin-mall-tenant-console',
    })
  }

  const permissions = listRowsByEntityType('permission', sandboxId).map(toAggregateRow)
  const resolvedPermission = permissionId
    ? permissions.find(item => item.entityId === permissionId)
    : permissions.find(item => asString(asRecord(item.payload.data).permission_code) === permissionCode)

  if (!resolvedPermission) {
    return finishDecision({
      allowed: false,
      userId,
      storeId,
      permissionId: permissionId ?? null,
      permissionCode: permissionCode ?? null,
      permissionName: null,
      matchedBindingIds: [] as string[],
      matchedRoleIds: [] as string[],
      bindingIdsConsidered: [] as string[],
      roleIdsConsidered: [] as string[],
      reason: 'PERMISSION_NOT_FOUND',
      decisionSource: 'mock-admin-mall-tenant-console',
    })
  }

  const resolvedPermissionId = asString(asRecord(resolvedPermission.payload.data).permission_id, resolvedPermission.entityId)
  const resolvedPermissionCode = asOptionalString(asRecord(resolvedPermission.payload.data).permission_code) ?? null
  const resolvedPermissionName = asOptionalString(asRecord(resolvedPermission.payload.data).permission_name) ?? null

  const user = findAggregateRow('user', userId, sandboxId)
  if (!user || user.status !== 'ACTIVE') {
    return finishDecision({
      allowed: false,
      userId,
      storeId,
      permissionId: resolvedPermissionId,
      permissionCode: resolvedPermissionCode,
      permissionName: resolvedPermissionName,
      matchedBindingIds: [] as string[],
      matchedRoleIds: [] as string[],
      bindingIdsConsidered: [] as string[],
      roleIdsConsidered: [] as string[],
      reason: user ? 'USER_NOT_ACTIVE' : 'USER_NOT_FOUND',
      decisionSource: 'mock-admin-mall-tenant-console',
    })
  }

  if (!permissionFeatureEnabled(resolvedPermission, sandboxId)) {
    return finishDecision({
      allowed: false,
      userId,
      storeId,
      permissionId: resolvedPermissionId,
      permissionCode: resolvedPermissionCode,
      permissionName: resolvedPermissionName,
      matchedBindingIds: [] as string[],
      matchedRoleIds: [] as string[],
      denyBindingIds: [] as string[],
      bindingIdsConsidered: [] as string[],
      roleIdsConsidered: [] as string[],
      reason: 'FEATURE_SWITCH_DISABLED',
      denyReason: 'FEATURE_SWITCH_DISABLED',
      policyEffects: [] as string[],
      decisionSource: 'mock-admin-mall-tenant-console',
    })
  }

  const permissionsById = new Map(permissions.map(permission => [permission.entityId, permission]))
  const bindings = [
    ...getActiveDirectRoleBindingsForUser(userId, sandboxId),
    ...getActiveGroupRoleBindingsForUser(userId, sandboxId),
  ].filter(item => bindingMatchesStore(item, storeId, sandboxId))

  const bindingIdsConsidered = bindings.map(item => item.entityId)
  const roleIdsConsidered = bindings.map(item => asString(asRecord(item.payload.data).role_id)).filter(Boolean)

  const rolesById = new Map(
    listRowsByEntityType('role', sandboxId)
      .map(toAggregateRow)
      .map(item => [item.entityId, item]),
  )

  const matchedBindingIds: string[] = []
  const matchedRoleIds: string[] = []
  const denyBindingIds: string[] = []
  const policyEffects = new Set<string>()

  bindings.forEach(binding => {
    const bindingData = asRecord(binding.payload.data)
    const roleId = asString(bindingData.role_id, '')
    const role = rolesById.get(roleId)
    if (!role || role.status !== 'ACTIVE') {
      return
    }
    if (rolePermissionIdsGrantPermission(getRolePermissionIds(role), resolvedPermission, permissionsById)) {
      const policyEffect = asString(bindingData.policy_effect, 'ALLOW').toUpperCase()
      policyEffects.add(policyEffect)
      if (policyEffect === 'DENY') {
        denyBindingIds.push(binding.entityId)
      }
      matchedBindingIds.push(binding.entityId)
      matchedRoleIds.push(role.entityId)
    }
  })

  const uniqueMatchedBindingIds = Array.from(new Set(matchedBindingIds))
  const uniqueMatchedRoleIds = Array.from(new Set(matchedRoleIds))
  const uniqueDenyBindingIds = Array.from(new Set(denyBindingIds))
  const allowed = uniqueMatchedBindingIds.length > 0 && uniqueDenyBindingIds.length === 0

  return finishDecision({
    allowed,
    userId,
    storeId,
    permissionId: resolvedPermissionId,
    permissionCode: resolvedPermissionCode,
    permissionName: resolvedPermissionName,
    matchedBindingIds: uniqueMatchedBindingIds,
    matchedRoleIds: uniqueMatchedRoleIds,
    denyBindingIds: uniqueDenyBindingIds,
    bindingIdsConsidered,
    roleIdsConsidered,
    reason: uniqueDenyBindingIds.length > 0
      ? 'DENY_RULE_HIT'
      : uniqueMatchedBindingIds.length > 0
      ? 'ROLE_PERMISSION_MATCH'
      : 'NO_MATCHING_ROLE_PERMISSION',
    denyReason: uniqueDenyBindingIds.length > 0 ? 'DENY_RULE_HIT' : null,
    policyEffects: Array.from(policyEffects),
    decisionSource: 'mock-admin-mall-tenant-console',
  })
}

export const getOrgTree = (sandboxId = DEFAULT_SANDBOX_ID) => {
  const platforms = listRowsByEntityType('platform', sandboxId).map(toAggregateRow)
  const projects = listRowsByEntityType('project', sandboxId).map(toAggregateRow)
  const tenants = listRowsByEntityType('tenant', sandboxId).map(toAggregateRow)
  const brands = listRowsByEntityType('brand', sandboxId).map(toAggregateRow)
  const stores = listRowsByEntityType('store', sandboxId).map(toAggregateRow)

  const resolveStoresForBrandProject = (brandId: string, projectId: string) =>
    stores.filter(store =>
      asString(asRecord(store.payload.data).project_id) === projectId
      && asString(asRecord(store.payload.data).brand_id) === brandId,
    )

  return platforms.map(platform => ({
    id: platform.entityId,
    type: 'platform',
    title: platform.title,
    status: platform.status,
    children: projects
      .filter(project => asString(asRecord(project.payload.data).platform_id, identity.platformId) === platform.entityId)
      .map(project => ({
        id: project.entityId,
        type: 'project',
        title: project.title,
        status: project.status,
        children: brands
          .filter(brand => asString(asRecord(brand.payload.data).platform_id, identity.platformId) === platform.entityId)
          .map(brand => {
            const brandStores = resolveStoresForBrandProject(brand.entityId, project.entityId)
            if (brandStores.length === 0) {
              return null
            }

            return {
              id: brand.entityId,
              type: 'brand',
              title: brand.title,
              status: brand.status,
              children: brandStores.map(store => {
                const tenant = tenants.find(item => asString(asRecord(store.payload.data).tenant_id) === item.entityId)
                return {
                  id: store.entityId,
                  type: 'store',
                  title: tenant ? `${store.title} / ${tenant.title}` : store.title,
                  status: store.status,
                  children: [],
                }
              }),
            }
          })
          .filter(Boolean),
      })),
  }))
}

export const getTerminalAuthCapabilities = () => ({
  status: 'RESERVED',
  implemented: false,
  routes: [
    '/api/v1/auth/login',
    '/api/v1/auth/logout',
    '/api/v1/auth/refresh',
    '/api/v1/terminal-auth/login',
    '/api/v1/terminal-auth/logout',
    '/api/v1/terminal-auth/user-info-changed',
  ],
  tdpPublishPath: 'terminal.user.session and terminal.user.session.event remain reserved for future implementation',
})

const maskSecret = (value: string | null | undefined, visible = 4) => {
  if (!value) {
    return null
  }
  if (value.length <= visible) {
    return '*'.repeat(value.length)
  }
  return `${'*'.repeat(Math.max(4, value.length - visible))}${value.slice(-visible)}`
}

const buildMaskedIsvCredential = (input: {
  providerType?: string
  appKey?: string | null
  appSecret?: string | null
  isvToken?: string | null
  tokenExpireAt?: string | null
  channelStatus?: string | null
}) => ({
  provider_type: input.providerType ?? 'LOCAL_MOCK_ISV',
  app_key_masked: maskSecret(input.appKey ?? null),
  app_secret_masked: maskSecret(input.appSecret ?? null),
  isv_token_masked: maskSecret(input.isvToken ?? null),
  token_expire_at: input.tokenExpireAt ?? null,
  channel_status: input.channelStatus ?? 'ACTIVE',
})

export const createSandbox = (input: {
  sandboxId?: string
  sandboxCode: string
  sandboxName: string
  sandboxType?: string
  deploymentId?: string | null
  description?: string
  owner?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-sandbox:${input.sandboxCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const sandboxId = resolveEntityId('sandbox', input.sandboxId, input.sandboxCode)
    const sandboxType = asString(input.sandboxType, 'DEBUG').toUpperCase()
    return upsertEntity({
      entityType: 'sandbox',
      entityId: sandboxId,
      title: input.sandboxName,
      status: 'ACTIVE',
      naturalScopeType: 'SANDBOX',
      naturalScopeKey: sandboxId,
      mutation: defaultMutation(input.mutation),
      eventType: 'SandboxUpserted',
      data: {
        sandbox_id: sandboxId,
        sandbox_code: input.sandboxCode,
        sandbox_name: input.sandboxName,
        sandbox_type: sandboxType,
        deployment_id: input.deploymentId ?? 'local-mock-deployment',
        description: input.description ?? null,
        owner: input.owner ?? 'mock-admin-operator',
        status: 'ACTIVE',
      },
    })
  },
)

export const updateCustomerEntity = (input: {
  entityType: string
  entityId: string
  title?: string
  status?: string
  data?: Record<string, unknown>
  mutation?: MutationInput
}) => {
  if (!isDomainEntity(input.entityType)) {
    throw new HttpError(400, 'INVALID_ENTITY_TYPE', 'unsupported entity type', {
      entityType: input.entityType,
    })
  }
  const entityType = input.entityType

  return getMutationResponse(
    `customer-update:${entityType}:${input.entityId}`,
    input.mutation?.idempotencyKey,
    () => {
      const current = requireEntityRow(entityType, input.entityId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
      const currentData = cloneJson(asRecord(current.payload.data))
      const nextStatus = input.status ? sanitizeEntityStatus(entityType, input.status, current.status) : current.status
      assertAllowedStatusTransition({
        entityType,
        entityId: input.entityId,
        currentStatus: current.status,
        nextStatus,
      })
      if (entityType === 'table' && !tableMasterStatuses.has(nextStatus)) {
        throw new HttpError(400, 'INVALID_TABLE_STATUS', '桌台主数据只能维护启用或停用状态', {
          tableId: input.entityId,
          status: nextStatus,
        })
      }
      const inputData = cloneJson(asRecord(input.data))
      assertUpdateDoesNotChangeReadonlyFields({
        entityType,
        entityId: input.entityId,
        currentData,
        inputData,
      })
      assertMenuVersionControlledUpdate({
        entityType,
        entityId: input.entityId,
        current,
        inputData,
      })
      if (entityType === 'tenant') {
        delete inputData.tenant_category
      }
      if (entityType === 'brand') {
        delete inputData.tenant_id
      }
      if (entityType === 'platform' && 'metadata_catalog' in inputData) {
        inputData.metadata_catalog = normalizeEntityMetadataCatalog(inputData.metadata_catalog, 'PLATFORM', input.entityId)
      }
      if (entityType === 'brand' && 'metadata_catalog' in inputData) {
        inputData.metadata_catalog = normalizeEntityMetadataCatalog(inputData.metadata_catalog, 'BRAND', input.entityId)
      }
      if (entityType === 'store' && 'metadata_catalog' in inputData) {
        inputData.metadata_catalog = normalizeEntityMetadataCatalog(inputData.metadata_catalog, 'STORE', input.entityId)
      }
      const nextData: Record<string, unknown> = {
        ...currentData,
        ...inputData,
        status: nextStatus,
      }
      if (entityType === 'brand') {
        delete nextData.tenant_id
        const platformId = asString(nextData.platform_id, current.naturalScopeKey)
        const brandCode = asString(nextData.brand_code)
        const duplicate = findBrandCodeDuplicate({
          sandboxId: current.sandboxId,
          brandId: input.entityId,
          platformId,
          brandCode,
        })
        if (duplicate) {
          throw new HttpError(409, 'BRAND_CODE_ALREADY_EXISTS', '品牌编码在当前集团内已被使用')
        }
        assertBrandConstraints(nextData)
      }
      if (entityType === 'tenant') {
        delete nextData.tenant_category
      }
      return upsertEntity({
        entityType,
        entityId: input.entityId,
        title: input.title?.trim() || current.title,
        status: nextStatus,
        naturalScopeType: current.naturalScopeType,
        naturalScopeKey: entityType === 'brand'
          ? asString(nextData.platform_id, current.naturalScopeKey)
          : current.naturalScopeKey,
        mutation: defaultMutation(input.mutation),
        eventType: 'CustomerEntityMaintained',
        data: nextData,
      })
    },
  )
}

export const createPlatform = (input: {
  platformId?: string
  platformCode: string
  platformName: string
  platformShortName?: string
  description?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  isvConfig?: {
    providerType?: string
    appKey?: string | null
    appSecret?: string | null
    isvToken?: string | null
    tokenExpireAt?: string | null
    channelStatus?: string | null
  }
  metadataCatalog?: Record<string, unknown>
  externalPlatformId?: string | null
  syncedAt?: string | null
  version?: number
  createAdminUser?: boolean
  adminEmail?: string | null
  adminPasswordHash?: string | null
  adminDisplayName?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-platform:${input.platformCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const platformId = resolveEntityId('platform', input.platformId, input.platformCode)
    const duplicate = findFieldDuplicate({
      entityType: 'platform',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: platformId,
      field: 'platform_code',
      value: input.platformCode,
    })
    if (duplicate) {
      throw new HttpError(409, 'PLATFORM_CODE_ALREADY_EXISTS', '集团编码在当前沙箱内已被使用')
    }
    const platform = upsertEntity({
      entityType: 'platform',
      entityId: platformId,
      title: input.platformName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation,
      eventType: 'PlatformUpserted',
      data: {
        platform_id: platformId,
        platform_code: input.platformCode,
        platform_name: input.platformName,
        platform_short_name: input.platformShortName ?? input.platformName,
        description: input.description ?? null,
        contact_name: input.contactName ?? 'Local Mall Operator',
        contact_person: input.contactName ?? 'Local Mall Operator',
        contact_phone: input.contactPhone ?? '400-800-0000',
        contact_email: input.contactEmail ?? null,
        address: input.address ?? null,
        isv_config: buildMaskedIsvCredential(input.isvConfig ?? {}),
        metadata_catalog: normalizeEntityMetadataCatalog(input.metadataCatalog, 'PLATFORM', platformId),
        external_platform_id: input.externalPlatformId ?? null,
        synced_at: input.syncedAt ?? null,
        version: asNumber(input.version, 1),
        status: 'ACTIVE',
      },
    })
    if (!input.createAdminUser) {
      return platform
    }
    const adminUser = createUser({
      userCode: normalizeId(`admin-${input.platformCode}`),
      username: input.adminEmail ?? `${input.platformCode}.admin`,
      displayName: input.adminDisplayName ?? `${input.platformName} 管理员`,
      email: input.adminEmail ?? input.contactEmail ?? null,
      phone: input.contactPhone ?? null,
      userType: 'TENANT_STAFF',
      identitySource: 'LOCAL',
      passwordHash: input.adminPasswordHash ?? 'mock-password-hash-redacted',
      platformId,
      createdBy: input.mutation?.actorId ?? 'mock-admin-operator',
      mutation: input.mutation,
    })
    return {platform, adminUser}
  },
)

export const createRegion = (input: {
  regionId?: string
  platformId?: string
  parentRegionId?: string | null
  regionCode: string
  regionName: string
  regionLevel?: number
  regionStatus?: string
  externalRegionId?: string | null
  syncedAt?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-region:${input.platformId ?? identity.platformId}:${input.regionCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const platformId = asString(input.platformId, identity.platformId)
    const regionId = input.regionId ?? normalizeId(`region-${platformId}-${input.regionCode}`)
    return upsertEntity({
      entityType: 'region',
      entityId: regionId,
      title: input.regionName,
      status: sanitizeStatus(input.regionStatus, 'ACTIVE'),
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation,
      eventType: 'RegionUpserted',
      data: {
        region_id: regionId,
        platform_id: platformId,
        parent_region_id: input.parentRegionId ?? null,
        region_code: input.regionCode,
        region_name: input.regionName,
        region_level: asNumber(input.regionLevel, input.parentRegionId ? 2 : 1),
        region_status: sanitizeStatus(input.regionStatus, 'ACTIVE'),
        external_region_id: input.externalRegionId ?? null,
        synced_at: input.syncedAt ?? null,
        version: 1,
        status: sanitizeStatus(input.regionStatus, 'ACTIVE'),
      },
    })
  },
)

export const createProject = (input: {
  projectId?: string
  projectCode: string
  projectName: string
  projectShortName?: string
  platformId?: string
  timezone?: string
  region?: Record<string, unknown>
  regionId?: string | null
  province?: string | null
  city?: string | null
  address?: string
  latitude?: number | null
  longitude?: number | null
  businessHours?: unknown
  channelShopConfig?: Record<string, unknown>
  businessMode?: string
  projectPhases?: unknown
  externalProjectId?: string | null
  syncedAt?: string | null
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-project:${input.projectCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const projectId = resolveEntityId('project', input.projectId, input.projectCode)
    const platformId = asString(input.platformId, identity.platformId)
    const duplicate = findFieldDuplicate({
      entityType: 'project',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: projectId,
      field: 'project_code',
      value: input.projectCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'PROJECT_CODE_ALREADY_EXISTS', '购物中心编码在当前集团内已被使用')
    }
    const region = createProjectRegion(input.region)
    return upsertEntity({
      entityType: 'project',
      entityId: projectId,
      title: input.projectName,
      status: 'ACTIVE',
      naturalScopeType: 'PROJECT',
      naturalScopeKey: projectId,
      mutation,
      eventType: 'ProjectUpserted',
      data: {
        project_id: projectId,
        project_code: input.projectCode,
        project_name: input.projectName,
        project_short_name: input.projectShortName ?? input.projectName,
        platform_id: platformId,
        timezone: input.timezone ?? 'Asia/Shanghai',
        region,
        region_id: input.regionId ?? region.region_code,
        province: input.province ?? region.parent_region_code,
        city: input.city ?? region.region_name,
        address: input.address ?? 'Shenzhen Nanshan District',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        business_hours: input.businessHours ?? defaultWeeklyOperatingHours(),
        channel_shop_config: input.channelShopConfig ?? {
          default_delivery_radius_km: 5,
          default_prepare_minutes: 20,
        },
        business_mode: input.businessMode ?? 'SHOPPING_MALL',
        project_phases: normalizeProjectPhases(input.projectPhases, input.projectName),
        external_project_id: input.externalProjectId ?? null,
        synced_at: input.syncedAt ?? null,
        version: asNumber(input.version, 1),
        project_status: 'OPERATING',
        status: 'ACTIVE',
      },
    })
  },
)

export const updatePlatformIsvCredential = (input: {
  platformId: string
  providerType?: string
  appKey?: string | null
  appSecret?: string | null
  isvToken?: string | null
  tokenExpireAt?: string | null
  channelStatus?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `update-platform-isv-credential:${input.platformId}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('platform', input.platformId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    return upsertEntity({
      entityType: 'platform',
      entityId: input.platformId,
      title: current.title,
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'PlatformIsvCredentialUpdated',
      data: {
        ...currentData,
        isv_config: buildMaskedIsvCredential({
          providerType: input.providerType ?? asOptionalString(asRecord(currentData.isv_config).provider_type) ?? 'LOCAL_MOCK_ISV',
          appKey: input.appKey ?? null,
          appSecret: input.appSecret ?? null,
          isvToken: input.isvToken ?? null,
          tokenExpireAt: input.tokenExpireAt ?? null,
          channelStatus: input.channelStatus ?? asOptionalString(asRecord(currentData.isv_config).channel_status) ?? 'ACTIVE',
        }),
      },
    })
  },
)

export const createTenant = (input: {
  tenantId?: string
  tenantCode: string
  tenantName: string
  platformId?: string
  companyName?: string
  socialCreditCode?: string
  unifiedSocialCreditCode?: string
  legalRepresentative?: string
  contactName?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  tenantType?: string
  businessModel?: string
  invoiceTitle?: string
  settlementCycle?: string
  billingEmail?: string
  externalTenantId?: string | null
  syncedAt?: string | null
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-tenant:${input.tenantCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const tenantId = resolveEntityId('tenant', input.tenantId, input.tenantCode)
    const platformId = asString(input.platformId, identity.platformId)
    const duplicateCode = findFieldDuplicate({
      entityType: 'tenant',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: tenantId,
      field: 'tenant_code',
      value: input.tenantCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicateCode) {
      throw new HttpError(409, 'TENANT_CODE_ALREADY_EXISTS', '租户编码在当前集团内已被使用')
    }
    const creditCode = input.unifiedSocialCreditCode ?? input.socialCreditCode
    const duplicateCreditCode = findFieldDuplicate({
      entityType: 'tenant',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: tenantId,
      field: 'unified_social_credit_code',
      value: creditCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicateCreditCode) {
      throw new HttpError(409, 'TENANT_CREDIT_CODE_ALREADY_EXISTS', '该企业已入驻，统一社会信用代码重复')
    }
    return upsertEntity({
      entityType: 'tenant',
      entityId: tenantId,
      title: input.tenantName,
      status: 'ACTIVE',
      naturalScopeType: 'TENANT',
      naturalScopeKey: tenantId,
      mutation,
      eventType: 'TenantUpserted',
      data: {
        tenant_id: tenantId,
        tenant_code: input.tenantCode,
        tenant_name: input.tenantName,
        platform_id: platformId,
        company_name: input.companyName ?? input.tenantName,
        social_credit_code: creditCode ?? null,
        unified_social_credit_code: creditCode ?? null,
        legal_representative: input.legalRepresentative ?? null,
        contact_name: input.contactName ?? input.contactPerson ?? null,
        contact_person: input.contactPerson ?? input.contactName ?? null,
        contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? input.billingEmail ?? null,
        tenant_type: input.tenantType ?? 'CHAIN_BRAND',
        business_model: input.businessModel ?? 'MIXED',
        account_status: 'ACTIVE',
        invoice_title: input.invoiceTitle ?? input.companyName ?? input.tenantName,
        settlement_cycle: input.settlementCycle ?? null,
        billing_email: input.billingEmail ?? input.contactEmail ?? null,
        external_tenant_id: input.externalTenantId ?? null,
        synced_at: input.syncedAt ?? null,
        version: asNumber(input.version, 1),
        status: 'ACTIVE',
      },
    })
  },
)

export const createBrand = (input: {
  brandId?: string
  brandCode: string
  brandName: string
  platformId?: string
  brandCategory?: string
  brandDescription?: string
  brandLogoUrl?: string
  brandNameEn?: string
  standardMenuEnabled?: boolean
  standardPricingLocked?: boolean
  erpIntegrationEnabled?: boolean
  erpApiEndpoint?: string
  erpAuthConfig?: Record<string, unknown>
  metadataCatalog?: Record<string, unknown>
  externalBrandId?: string | null
  syncedAt?: string | null
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-brand:${input.platformId ?? identity.platformId}:${input.brandCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const sandboxId = mutation.sandboxId ?? DEFAULT_SANDBOX_ID
    const platformId = asString(input.platformId, identity.platformId)
    const brandId = resolveEntityId('brand', input.brandId, `${platformId}-${input.brandCode}`)
    if (getEntityRow('brand', brandId, sandboxId)) {
      throw new HttpError(409, 'BRAND_CODE_ALREADY_EXISTS', '品牌编码在当前集团内已被使用')
    }
    const duplicate = findBrandCodeDuplicate({
      sandboxId,
      brandId,
      platformId,
      brandCode: input.brandCode,
    })
    if (duplicate) {
      throw new HttpError(409, 'BRAND_CODE_ALREADY_EXISTS', '品牌编码在当前集团内已被使用')
    }
    const standardMenuEnabled = asBoolean(input.standardMenuEnabled, false)
    const standardPricingLocked = asBoolean(input.standardPricingLocked, false)
    const erpIntegrationEnabled = asBoolean(input.erpIntegrationEnabled, false)
    const data = {
      brand_id: brandId,
      brand_code: input.brandCode,
      brand_name: input.brandName,
      brand_name_en: input.brandNameEn ?? null,
      brand_category: input.brandCategory ?? 'BAKERY',
      brand_logo_url: input.brandLogoUrl ?? null,
      brand_description: input.brandDescription ?? null,
      platform_id: platformId,
      standard_menu_enabled: standardMenuEnabled,
      standard_pricing_locked: standardPricingLocked,
      erp_integration_enabled: erpIntegrationEnabled,
      erp_api_endpoint: erpIntegrationEnabled ? asOptionalString(input.erpApiEndpoint) ?? null : null,
      erp_auth_config: input.erpAuthConfig ?? {},
      metadata_catalog: normalizeEntityMetadataCatalog(input.metadataCatalog, 'BRAND', brandId),
      external_brand_id: input.externalBrandId ?? null,
      synced_at: input.syncedAt ?? null,
      version: asNumber(input.version, 1),
      brand_status: 'ACTIVE',
      status: 'ACTIVE',
    }
    assertBrandConstraints(data)
    return upsertEntity({
      entityType: 'brand',
      entityId: brandId,
      title: input.brandName,
      status: 'ACTIVE',
      naturalScopeType: 'BRAND',
      naturalScopeKey: platformId,
      mutation,
      eventType: 'BrandUpserted',
      data,
    })
  },
)

export const createBusinessEntity = (input: {
  entityId?: string
  entityCode: string
  entityName: string
  tenantId: string
  companyName?: string
  unifiedSocialCreditCode?: string
  legalRepresentative?: string
  entityType?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNo?: string
  bankBranch?: string
  taxRegistrationNo?: string
  taxpayerType?: string
  taxRate?: number
  settlementCycle?: string
  settlementDay?: number | null
  autoSettlementEnabled?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  'create-business-entity',
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const tenantData = readEntityData('tenant', input.tenantId, mutation.sandboxId)
    const entityId = input.entityId ?? normalizeId(`entity-${input.entityCode}`)
    const duplicate = findFieldDuplicate({
      entityType: 'business_entity',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId,
      field: 'unified_social_credit_code',
      value: input.unifiedSocialCreditCode,
      scope: {field: 'tenant_id', value: input.tenantId},
    })
    if (duplicate) {
      throw new HttpError(409, 'BUSINESS_ENTITY_CREDIT_CODE_ALREADY_EXISTS', '该经营主体已存在')
    }
    return upsertEntity({
      entityType: 'business_entity',
      entityId,
      title: input.entityName,
      status: 'ACTIVE',
      naturalScopeType: 'TENANT',
      naturalScopeKey: input.tenantId,
      mutation,
      eventType: 'BusinessEntityUpserted',
      data: {
        entity_id: entityId,
        entity_code: input.entityCode,
        entity_name: input.entityName,
        tenant_id: input.tenantId,
        platform_id: asString(tenantData.platform_id, identity.platformId),
        company_name: input.companyName ?? input.entityName,
        entity_type: input.entityType ?? 'COMPANY',
        unified_social_credit_code: input.unifiedSocialCreditCode ?? null,
        legal_representative: input.legalRepresentative ?? null,
        bank_name: input.bankName ?? null,
        bank_account_name: input.bankAccountName ?? null,
        bank_account_no_masked: maskSecret(input.bankAccountNo ?? null),
        bank_branch: input.bankBranch ?? null,
        tax_registration_no: input.taxRegistrationNo ?? null,
        taxpayer_type: input.taxpayerType ?? 'GENERAL_TAXPAYER',
        tax_rate: asNumber(input.taxRate, 0.06),
        settlement_cycle: input.settlementCycle ?? null,
        settlement_day: input.settlementDay ?? null,
        auto_settlement_enabled: asBoolean(input.autoSettlementEnabled, false),
        entity_status: 'ACTIVE',
        status: 'ACTIVE',
      },
    })
  },
)

export const createStore = (input: {
  storeId?: string
  storeCode: string
  storeName: string
  unitCode: string
  storeType?: string
  storeFormats?: unknown
  businessFormat?: string
  cooperationMode?: string
  businessScenarios?: unknown
  floor?: string
  addressDetail?: string
  latitude?: number | null
  longitude?: number | null
  areaSqm?: number
  floorArea?: number
  storePhone?: string
  storeManager?: string
  managerPhone?: string
  hasDineIn?: boolean
  hasTakeaway?: boolean
  hasSelfPickup?: boolean
  seatCount?: number | null
  businessHours?: string
  projectId: string
  externalStoreId?: string | null
  syncedAt?: string | null
  version?: number
  metadataCatalog?: Record<string, unknown>
  mutation?: MutationInput
}) => getMutationResponse(
  `create-store:${input.projectId}:${input.storeCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const projectData = readEntityData('project', input.projectId, mutation.sandboxId)
    const storeId = resolveEntityId('store', input.storeId, `${input.projectId}-${input.storeCode}`)
    const platformId = asString(projectData.platform_id, identity.platformId)
    const duplicateStoreCode = findFieldDuplicate({
      entityType: 'store',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: storeId,
      field: 'store_code',
      value: input.storeCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicateStoreCode) {
      throw new HttpError(409, 'STORE_CODE_ALREADY_EXISTS', '门店编码在当前集团内已被使用')
    }
    const duplicateUnit = findFieldDuplicate({
      entityType: 'store',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: storeId,
      field: 'unit_no',
      value: input.unitCode,
      scope: {field: 'project_id', value: input.projectId},
    })
    if (duplicateUnit) {
      throw new HttpError(409, 'STORE_UNIT_ALREADY_EXISTS', '铺位号在当前购物中心内已被使用')
    }
    const storeFormats = Array.isArray(input.storeFormats)
      ? input.storeFormats.map(item => asString(item, '')).filter(Boolean)
      : []
    const businessScenarios = asStringList(input.businessScenarios)
    const scenarios = businessScenarios.length ? businessScenarios : storeFormats
    return upsertEntity({
      entityType: 'store',
      entityId: storeId,
      title: input.storeName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: storeId,
      mutation,
      eventType: 'StoreUpserted',
      data: {
        store_id: storeId,
        store_code: input.storeCode,
        store_name: input.storeName,
        unit_code: input.unitCode,
        unit_no: input.unitCode,
        floor: input.floor ?? null,
        area_sqm: input.areaSqm === undefined ? null : asNumber(input.areaSqm, 0),
        store_type: asOptionalString(input.storeType) ?? null,
        business_format: input.businessFormat ?? null,
        cooperation_mode: input.cooperationMode ?? input.storeType ?? null,
        store_formats: scenarios,
        business_scenarios: scenarios,
        address_detail: input.addressDetail ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        store_phone: input.storePhone ?? null,
        store_manager: input.storeManager ?? null,
        manager_phone: input.managerPhone ?? null,
        has_dine_in: asBoolean(input.hasDineIn, scenarios.includes('DINE_IN')),
        has_takeaway: asBoolean(input.hasTakeaway, scenarios.includes('TAKEAWAY') || scenarios.includes('DELIVERY')),
        has_self_pickup: asBoolean(input.hasSelfPickup, scenarios.includes('PICKUP')),
        seat_count: input.seatCount ?? null,
        floor_area: input.floorArea ?? input.areaSqm ?? null,
        business_hours: input.businessHours ?? null,
        platform_id: platformId,
        project_id: input.projectId,
        active_contract_id: null,
        tenant_id: null,
        brand_id: null,
        entity_id: null,
        store_status: 'VACANT',
        operating_status: 'PREPARING',
        contract_status: 'NO_CONTRACT',
        external_store_id: input.externalStoreId ?? null,
        synced_at: input.syncedAt ?? null,
        version: asNumber(input.version, 1),
        metadata_catalog: normalizeEntityMetadataCatalog(input.metadataCatalog, 'STORE', storeId),
        status: 'ACTIVE',
      },
    })
  },
)

export const createContract = (input: {
  contractId?: string
  contractCode: string
  storeId: string
  lessorProjectId?: string
  lessorPhaseId?: string
  lessorProjectName?: string
  lessorPhaseName?: string
  lessorOwnerName?: string
  lessorOwnerContact?: string | null
  lessorOwnerPhone?: string | null
  tenantId: string
  brandId: string
  entityId?: string
  contractNo?: string
  contractType?: string
  externalContractNo?: string | null
  syncedAt?: string | null
  startDate: string
  endDate: string
  commissionType?: string
  commissionRate?: number
  depositAmount?: number
  attachmentUrl?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-contract:${input.storeId}:${input.contractCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    assertDateRange(input.startDate, input.endDate)
    const storeData = readEntityData('store', input.storeId, mutation.sandboxId)
    const lessorProjectId = asOptionalString(input.lessorProjectId)
      ?? asString(storeData.project_id, identity.projectId)
    const projectData = readEntityData('project', lessorProjectId, mutation.sandboxId)
    const phase = resolveProjectPhase(projectData, input.lessorPhaseId)
    const platformId = asString(projectData.platform_id, asString(storeData.platform_id, identity.platformId))
    const tenantData = readEntityData('tenant', input.tenantId, mutation.sandboxId)
    const brandData = readEntityData('brand', input.brandId, mutation.sandboxId)
    const contractId = resolveEntityId('contract', input.contractId, `${input.storeId}-${input.contractCode}`)
    const duplicateContractNo = findFieldDuplicate({
      entityType: 'contract',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: contractId,
      field: 'contract_no',
      value: input.contractNo ?? input.contractCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicateContractNo) {
      throw new HttpError(409, 'CONTRACT_NO_ALREADY_EXISTS', '合同编号在当前集团内已存在', {
        contractNo: input.contractNo ?? input.contractCode,
      })
    }
    if (asString(tenantData.account_status ?? tenantData.status, 'ACTIVE') !== 'ACTIVE') {
      throw new HttpError(409, 'TENANT_NOT_ACTIVE', '合同乙方租户必须有效', {tenantId: input.tenantId})
    }
    if (asString(brandData.brand_status ?? brandData.status, 'ACTIVE') !== 'ACTIVE') {
      throw new HttpError(409, 'BRAND_NOT_ACTIVE', '合同乙方品牌必须有效', {brandId: input.brandId})
    }
    const overlappingContract = listRowsByEntityType('contract', mutation.sandboxId ?? DEFAULT_SANDBOX_ID)
      .map(toAggregateRow)
      .map(withDerivedContractStatus)
      .find(contract => {
        const data = asRecord(contract.payload.data)
        return contract.entityId !== contractId
          && asString(data.store_id) === input.storeId
          && ['ACTIVE', 'PENDING'].includes(contract.status)
          && dateRangesOverlap(data.start_date, data.end_date, input.startDate, input.endDate)
      })
    if (overlappingContract) {
      throw new HttpError(409, 'CONTRACT_PERIOD_OVERLAPS', '该门店在所选时间段内已有经营合同')
    }
    const legacyEntityId = asOptionalString(input.entityId) ?? input.tenantId
    return upsertEntity({
      entityType: 'contract',
      entityId: contractId,
      title: input.contractCode,
      status: 'PENDING',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation,
      eventType: 'ContractPendingCreated',
      data: {
        contract_id: contractId,
        contract_code: input.contractCode,
        contract_no: input.contractNo ?? input.contractCode,
        contract_type: input.contractType ?? 'OPERATING',
        platform_id: platformId,
        project_id: lessorProjectId,
        lessor_project_id: lessorProjectId,
        lessor_project_name: input.lessorProjectName ?? asString(projectData.project_name, ''),
        lessor_phase_id: phase.phase_id,
        lessor_phase_name: input.lessorPhaseName ?? phase.phase_name,
        lessor_owner_name: input.lessorOwnerName ?? phase.owner_name,
        lessor_owner_contact: input.lessorOwnerContact === undefined ? phase.owner_contact : input.lessorOwnerContact,
        lessor_owner_phone: input.lessorOwnerPhone === undefined ? phase.owner_phone : input.lessorOwnerPhone,
        tenant_id: input.tenantId,
        lessee_tenant_id: input.tenantId,
        lessee_tenant_name: asString(tenantData.tenant_name, ''),
        brand_id: input.brandId,
        lessee_brand_id: input.brandId,
        lessee_brand_name: asString(brandData.brand_name, ''),
        store_id: input.storeId,
        lessee_store_id: input.storeId,
        lessee_store_name: asString(storeData.store_name, ''),
        entity_id: legacyEntityId,
        unit_code: asString(storeData.unit_code, 'KB001'),
        start_date: input.startDate,
        end_date: input.endDate,
        commission_type: input.commissionType ?? 'FIXED_RATE',
        commission_rate: asNumber(input.commissionRate, 0),
        deposit_amount: asNumber(input.depositAmount, 0),
        attachment_url: input.attachmentUrl ?? null,
        external_contract_no: input.externalContractNo ?? null,
        synced_at: input.syncedAt ?? null,
        status: 'PENDING',
      },
    })
  },
)

export const createTableEntity = (input: {
  tableId?: string
  storeId: string
  tableNo: string
  tableName?: string
  area?: string
  capacity?: number
  tableType?: string
  qrCodeUrl?: string | null
  qrCodeContent?: string | null
  estimatedDuration?: number | null
  sortOrder?: number
  reservable?: boolean
  consumerDescription?: string | null
  minimumSpend?: number | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-table:${input.storeId}:${input.tableNo}`,
  input.mutation?.idempotencyKey,
  () => {
    const tableId = input.tableId ?? normalizeId(`table-${input.storeId}-${input.tableNo}`)
    const mutation = defaultMutation(input.mutation)
    const duplicate = findFieldDuplicate({
      entityType: 'table',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: tableId,
      field: 'table_no',
      value: input.tableNo,
      scope: {field: 'store_id', value: input.storeId},
    })
    if (duplicate) {
      throw new HttpError(409, 'TABLE_NO_ALREADY_EXISTS', '桌台编号已被使用')
    }
    return upsertEntity({
      entityType: 'table',
      entityId: tableId,
      title: input.tableName ?? `桌台 ${input.tableNo}`,
      status: 'AVAILABLE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation,
      eventType: 'TableUpserted',
      data: {
        table_id: tableId,
        store_id: input.storeId,
        table_no: input.tableNo,
        table_name: input.tableName ?? `桌台 ${input.tableNo}`,
        area: input.area ?? '大厅',
        capacity: asNumber(input.capacity, 4),
        table_type: input.tableType ?? 'HALL',
        qr_code_url: input.qrCodeUrl ?? null,
        qr_code_content: input.qrCodeContent ?? null,
        estimated_duration: input.estimatedDuration ?? null,
        sort_order: asNumber(input.sortOrder, 100),
        reservable: asBoolean(input.reservable, false),
        consumer_description: input.consumerDescription ?? null,
        minimum_spend: input.minimumSpend ?? null,
        table_status: 'AVAILABLE',
        status: 'AVAILABLE',
      },
    })
  },
)

export const createWorkstation = (input: {
  workstationId?: string
  storeId: string
  workstationCode: string
  workstationName: string
  categoryCodes?: string[]
  workstationType?: string
  responsibleCategories?: string[]
  description?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-workstation:${input.storeId}:${input.workstationCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const workstationId = input.workstationId ?? normalizeId(`workstation-${input.storeId}-${input.workstationCode}`)
    const mutation = defaultMutation(input.mutation)
    const duplicate = findFieldDuplicate({
      entityType: 'workstation',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: workstationId,
      field: 'workstation_code',
      value: input.workstationCode,
      scope: {field: 'store_id', value: input.storeId},
    })
    if (duplicate) {
      throw new HttpError(409, 'WORKSTATION_CODE_ALREADY_EXISTS', '工作站编码已被使用')
    }
    const responsibleCategories = input.responsibleCategories ?? input.categoryCodes ?? []
    return upsertEntity({
      entityType: 'workstation',
      entityId: workstationId,
      title: input.workstationName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation,
      eventType: 'WorkstationUpserted',
      data: {
        workstation_id: workstationId,
        store_id: input.storeId,
        workstation_code: input.workstationCode,
        workstation_name: input.workstationName,
        workstation_type: input.workstationType ?? 'PRODUCTION',
        responsible_categories: responsibleCategories,
        category_codes: responsibleCategories,
        description: input.description ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createPermission = (input: {
  permissionId?: string
  permissionCode: string
  permissionName: string
  permissionType?: string
  permissionSource?: string
  platformId?: string
  permissionDescription?: string | null
  scopeType?: string | null
  module?: string | null
  resource?: string | null
  resourceType?: string | null
  action?: string | null
  isSystem?: boolean
  parentPermissionId?: string | null
  permissionGroupId?: string | null
  featureFlag?: string | null
  highRisk?: boolean
  requireApproval?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `create-permission:${input.platformId ?? identity.platformId}:${input.permissionCode}`,
  input.mutation?.idempotencyKey,
  () => {
    if (!/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(input.permissionCode)) {
      throw new HttpError(400, 'INVALID_PERMISSION_CODE', '权限编码格式错误，应为 resource:action 格式')
    }
    const platformId = asString(input.platformId, identity.platformId)
    const permissionId = input.permissionId ?? normalizeId(`perm-${platformId}-${input.permissionCode}`)
    const [resourceFromCode, actionFromCode] = input.permissionCode.split(':', 2)
    const permissionSource = input.permissionSource ?? input.permissionType ?? 'SYSTEM'
    return upsertEntity({
      entityType: 'permission',
      entityId: permissionId,
      title: input.permissionName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PermissionUpserted',
      data: {
        permission_id: permissionId,
        permission_code: input.permissionCode,
        permission_name: input.permissionName,
        permission_description: input.permissionDescription ?? null,
        module: input.module ?? null,
        resource: input.resource ?? input.resourceType ?? resourceFromCode,
        resource_type: input.resourceType ?? input.resource ?? resourceFromCode,
        action: input.action ?? actionFromCode,
        scope_type: input.scopeType ?? 'PLATFORM',
        permission_type: permissionSource,
        permission_source: permissionSource,
        is_system: input.isSystem ?? permissionSource === 'SYSTEM',
        parent_permission_id: input.parentPermissionId ?? null,
        permission_group_id: input.permissionGroupId ?? null,
        feature_flag: input.featureFlag ?? null,
        high_risk: asBoolean(input.highRisk, false),
        require_approval: asBoolean(input.requireApproval, false),
        platform_id: platformId,
        status: 'ACTIVE',
      },
    })
  },
)

export const createIdentityProviderConfig = (input: {
  idpId?: string
  platformId?: string
  idpName: string
  idpType: string
  applicableUserTypes: string[]
  priority?: number
  ldapUrl?: string | null
  baseDn?: string | null
  bindDn?: string | null
  bindPasswordEncrypted?: string | null
  bindPassword?: string | null
  userSearchFilter?: string | null
  usernameAttr?: string | null
  emailAttr?: string | null
  displayNameAttr?: string | null
  syncEnabled?: boolean
  syncCron?: string | null
  issuerUrl?: string | null
  clientId?: string | null
  clientSecretEncrypted?: string | null
  clientSecret?: string | null
  scopes?: string[]
  userInfoEndpoint?: string | null
  redirectUri?: string | null
  corpId?: string | null
  agentId?: string | null
  appSecretEncrypted?: string | null
  appSecret?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-idp:${input.platformId ?? identity.platformId}:${input.idpType}:${input.idpName}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const idpType = asString(input.idpType, 'LOCAL').toUpperCase()
    const idpId = input.idpId ?? normalizeId(`idp-${platformId}-${idpType}-${input.idpName}`)
    return upsertEntity({
      entityType: 'identity_provider_config',
      entityId: idpId,
      title: input.idpName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'IdentityProviderConfigUpserted',
      data: {
        idp_id: idpId,
        platform_id: platformId,
        idp_name: input.idpName,
        idp_type: idpType,
        applicable_user_types: input.applicableUserTypes,
        priority: asNumber(input.priority, 100),
        ldap_url: input.ldapUrl ?? null,
        base_dn: input.baseDn ?? null,
        bind_dn: input.bindDn ?? null,
        bind_password_encrypted: input.bindPasswordEncrypted ?? input.bindPassword ?? null,
        user_search_filter: input.userSearchFilter ?? null,
        username_attr: input.usernameAttr ?? 'uid',
        email_attr: input.emailAttr ?? 'mail',
        display_name_attr: input.displayNameAttr ?? 'cn',
        sync_enabled: asBoolean(input.syncEnabled, false),
        sync_cron: input.syncCron ?? null,
        issuer_url: input.issuerUrl ?? null,
        client_id: input.clientId ?? null,
        client_secret_encrypted: input.clientSecretEncrypted ?? input.clientSecret ?? null,
        scopes: input.scopes ?? [],
        user_info_endpoint: input.userInfoEndpoint ?? null,
        redirect_uri: input.redirectUri ?? null,
        corp_id: input.corpId ?? null,
        agent_id: input.agentId ?? null,
        app_secret_encrypted: input.appSecretEncrypted ?? input.appSecret ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createPermissionGroup = (input: {
  permissionGroupId?: string
  platformId?: string
  groupCode: string
  groupName: string
  groupIcon?: string | null
  sortOrder?: number
  parentGroupId?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-permission-group:${input.platformId ?? identity.platformId}:${input.groupCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const groupId = input.permissionGroupId ?? normalizeId(`permission-group-${platformId}-${input.groupCode}`)
    return upsertEntity({
      entityType: 'permission_group',
      entityId: groupId,
      title: input.groupName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PermissionGroupUpserted',
      data: {
        permission_group_id: groupId,
        platform_id: platformId,
        group_code: input.groupCode,
        group_name: input.groupName,
        group_icon: input.groupIcon ?? null,
        sort_order: asNumber(input.sortOrder, 100),
        parent_group_id: input.parentGroupId ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createRoleTemplate = (input: {
  templateId?: string
  platformId?: string
  templateCode: string
  templateName: string
  templateDescription?: string | null
  basePermissionIds: string[]
  recommendedScopeType?: string
  industryTags?: string[]
  isActive?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `create-role-template:${input.platformId ?? identity.platformId}:${input.templateCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const templateId = input.templateId ?? normalizeId(`role-template-${platformId}-${input.templateCode}`)
    const active = asBoolean(input.isActive, true)
    return upsertEntity({
      entityType: 'role_template',
      entityId: templateId,
      title: input.templateName,
      status: active ? 'ACTIVE' : 'INACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'RoleTemplateUpserted',
      data: {
        template_id: templateId,
        platform_id: platformId,
        template_code: input.templateCode,
        template_name: input.templateName,
        template_description: input.templateDescription ?? null,
        base_permission_ids: input.basePermissionIds,
        recommended_scope_type: input.recommendedScopeType ?? 'ORG_NODE',
        industry_tags: input.industryTags ?? [],
        is_active: active,
        status: active ? 'ACTIVE' : 'INACTIVE',
      },
    })
  },
)

export const createFeaturePoint = (input: {
  featurePointId?: string
  platformId?: string
  featureCode: string
  featureName: string
  featureDescription?: string | null
  isEnabledGlobally?: boolean
  defaultEnabled?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `create-feature-point:${input.platformId ?? identity.platformId}:${input.featureCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const featurePointId = input.featurePointId ?? normalizeId(`feature-point-${platformId}-${input.featureCode}`)
    const enabled = asBoolean(input.isEnabledGlobally, true)
    return upsertEntity({
      entityType: 'feature_point',
      entityId: featurePointId,
      title: input.featureName,
      status: enabled ? 'ACTIVE' : 'DISABLED',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'FeaturePointUpserted',
      data: {
        feature_point_id: featurePointId,
        platform_id: platformId,
        feature_code: input.featureCode,
        feature_name: input.featureName,
        feature_description: input.featureDescription ?? null,
        is_enabled_globally: enabled,
        default_enabled: asBoolean(input.defaultEnabled, false),
        status: enabled ? 'ACTIVE' : 'DISABLED',
      },
    })
  },
)

export const upsertPlatformFeatureSwitch = (input: {
  switchId?: string
  platformId?: string
  featureCode: string
  isEnabled?: boolean
  enabledBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `platform-feature-switch:${input.platformId ?? identity.platformId}:${input.featureCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const switchId = input.switchId ?? normalizeId(`feature-switch-${platformId}-${input.featureCode}`)
    const isEnabled = asBoolean(input.isEnabled, true)
    return upsertEntity({
      entityType: 'platform_feature_switch',
      entityId: switchId,
      title: `${platformId}:${input.featureCode}`,
      status: isEnabled ? 'ACTIVE' : 'DISABLED',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PlatformFeatureSwitchUpserted',
      data: {
        switch_id: switchId,
        platform_id: platformId,
        feature_code: input.featureCode,
        is_enabled: isEnabled,
        enabled_at: isEnabled ? new Date(now()).toISOString() : null,
        enabled_by: input.enabledBy ?? null,
        status: isEnabled ? 'ACTIVE' : 'DISABLED',
      },
    })
  },
)

export const createRole = (input: {
  roleId?: string
  roleCode: string
  roleName: string
  scopeType: string
  permissionIds?: string[]
  platformId?: string
  roleType?: string
  roleDescription?: string | null
  applicableUserTypes?: string[]
  mutation?: MutationInput
}) => getMutationResponse(
  `create-role:${input.platformId ?? identity.platformId}:${input.roleCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const roleId = input.roleId ?? normalizeId(`role-${platformId}-${input.roleCode}`)
    const duplicate = findFieldDuplicate({
      entityType: 'role',
      sandboxId: input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: roleId,
      field: 'role_code',
      value: input.roleCode,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'ROLE_CODE_ALREADY_EXISTS', '角色编码已存在，请更换')
    }
    if ((input.permissionIds ?? []).length === 0) {
      throw new HttpError(400, 'ROLE_PERMISSION_REQUIRED', '请至少选择一个权限')
    }
    const permissionIds = assertPermissionIdsExist(input.permissionIds ?? [], input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    return upsertEntity({
      entityType: 'role',
      entityId: roleId,
      title: input.roleName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'RoleUpserted',
      data: {
        role_id: roleId,
        role_code: input.roleCode,
        role_name: input.roleName,
        role_description: input.roleDescription ?? null,
        platform_id: platformId,
        role_type: input.roleType ?? 'CUSTOM',
        scope_type: input.scopeType,
        applicable_user_types: input.applicableUserTypes ?? [],
        permission_ids: permissionIds,
        version: 1,
        status: 'ACTIVE',
      },
    })
  },
)

export const updateRolePermissions = (input: {
  roleId: string
  permissionIds: string[]
  mutation?: MutationInput
}) => getMutationResponse(
  `update-role-permissions:${input.roleId}:${input.permissionIds.join(',')}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('role', input.roleId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    const permissionIds = assertPermissionIdsExist(input.permissionIds, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    return upsertEntity({
      entityType: 'role',
      entityId: input.roleId,
      title: current.title,
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'RolePermissionsUpdated',
      data: {
        ...currentData,
        permission_ids: permissionIds,
      },
    })
  },
)

export const createUser = (input: {
  userId?: string
  userCode: string
  displayName: string
  mobile?: string
  username?: string
  email?: string | null
  phone?: string | null
  userType?: string
  identitySource?: string
  externalUserId?: string | null
  passwordHash?: string | null
  storeId?: string | null
  platformId?: string
  createdBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-user:${input.userCode}:${input.platformId ?? input.storeId ?? identity.platformId}`,
  input.mutation?.idempotencyKey,
  () => {
    const userId = input.userId ?? normalizeId(`user-${input.userCode}`)
    const userType = input.userType ?? 'STORE_STAFF'
    const identitySource = asString(input.identitySource, 'LOCAL').toUpperCase()
    const storePlatformId = input.storeId
      ? asOptionalString(readAggregateData(findAggregateRow('store', input.storeId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)).platform_id)
      : null
    const platformId = asString(input.platformId, storePlatformId ?? identity.platformId)
    const username = input.username ?? input.userCode
    const duplicate = findFieldDuplicate({
      entityType: 'user',
      sandboxId: input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: userId,
      field: 'username',
      value: username,
      scope: {field: 'platform_id', value: platformId},
    })
    if (duplicate) {
      throw new HttpError(409, 'USERNAME_ALREADY_EXISTS', '用户名已被使用，请更换')
    }
    if (userType !== 'API_CLIENT' && !asOptionalString(input.email) && !asOptionalString(input.phone ?? input.mobile)) {
      throw new HttpError(400, 'USER_CONTACT_REQUIRED', '邮箱和手机号至少填写一个')
    }
    const passwordHash = identitySource === 'LOCAL'
      ? asString(input.passwordHash, 'mock-password-hash-redacted')
      : null
    if (identitySource !== 'LOCAL' && !asOptionalString(input.externalUserId)) {
      throw new HttpError(400, 'EXTERNAL_USER_ID_REQUIRED', '外部身份源用户必须保存外部用户 ID')
    }
    const naturalScopeType = userType === 'PLATFORM_OPS' ? 'PLATFORM' : (input.storeId ? 'STORE' : 'PLATFORM')
    const naturalScopeKey = naturalScopeType === 'STORE'
      ? asString(input.storeId, identity.storeId)
      : asString(input.platformId, identity.platformId)
    return upsertEntity({
      entityType: 'user',
      entityId: userId,
      title: input.displayName,
      status: 'ACTIVE',
      naturalScopeType,
      naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'UserUpserted',
      data: {
        user_id: userId,
        username,
        user_code: input.userCode,
        display_name: input.displayName,
        email: input.email ?? null,
        phone: input.phone ?? input.mobile ?? null,
        mobile: input.mobile ?? input.phone ?? null,
        user_type: userType,
        identity_source: identitySource,
        external_user_id: input.externalUserId ?? null,
        platform_id: platformId,
        store_id: input.storeId ?? null,
        password_hash: passwordHash,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        last_login_ip: null,
        created_by: input.createdBy ?? 'mock-admin-operator',
        version: 1,
        status: 'ACTIVE',
      },
    })
  },
)

export const createUserRoleBinding = (input: {
  bindingId?: string
  userId: string
  roleId: string
  storeId?: string
  scopeType?: string
  scopeId?: string
  resourceScope?: Record<string, unknown>
  scopeSelector?: Record<string, unknown>
  effectiveFrom?: string
  effectiveTo?: string | null
  reason?: string | null
  policyEffect?: 'ALLOW' | 'DENY'
  policyConditions?: Record<string, unknown> | null
  approvalId?: string | null
  grantedBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-user-role-binding:${input.userId}:${input.roleId}:${normalizeScopeSelector(
    input.resourceScope ?? input.scopeSelector ?? {
      scope_type: input.scopeType ?? (input.storeId ? 'STORE' : 'PLATFORM'),
      scope_key: input.scopeId ?? input.storeId,
    },
    input.storeId ? 'STORE' : 'PLATFORM',
    input.storeId ?? identity.platformId,
  ).comparisonKey}`,
  input.mutation?.idempotencyKey,
  () => {
    const sandboxId = input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID
    const user = requireEntityRow('user', input.userId, sandboxId)
    const role = requireEntityRow('role', input.roleId, sandboxId)
    const userData = readAggregateData(user)
    const roleData = readAggregateData(role)
    const storePlatformId = input.storeId
      ? asOptionalString(readAggregateData(findAggregateRow('store', input.storeId, sandboxId)).platform_id)
      : null
    const platformId = asOptionalString(userData.platform_id)
      ?? asOptionalString(roleData.platform_id)
      ?? storePlatformId
      ?? identity.platformId
    const normalizedScope = normalizeScopeSelector(
      input.resourceScope ?? input.scopeSelector ?? {
        scope_type: input.scopeType ?? (input.storeId ? 'STORE' : 'PLATFORM'),
        scope_key: input.scopeId ?? input.storeId ?? platformId,
      },
      input.storeId ? 'STORE' : 'PLATFORM',
      input.storeId ?? platformId,
    )
    const {comparisonKey: _comparisonKey, ...resourceScope} = normalizedScope
    const scopeType = resourceScope.scope_type
    const scopeKey = resourceScope.scope_key
    const storeId = scopeType === 'STORE' ? scopeKey : input.storeId ?? null
    const bindingId = input.bindingId ?? normalizeId(`binding-${input.userId}-${input.roleId}-${scopeType}-${scopeKey}`)
    if (user.status !== 'ACTIVE') {
      throw new HttpError(409, 'USER_NOT_ACTIVE', '用户已停用，无法授权')
    }
    if (role.status !== 'ACTIVE') {
      throw new HttpError(409, 'ROLE_NOT_ACTIVE', '角色已废弃，无法授权')
    }
    const duplicate = listRowsByEntityType('user_role_binding', sandboxId)
      .map(toAggregateRow)
      .find(binding => {
        const data = asRecord(binding.payload.data)
        const existingScope = bindingScopeForData(data, binding.naturalScopeType, binding.naturalScopeKey)
        return binding.entityId !== bindingId
          && binding.status === 'ACTIVE'
          && asString(data.user_id) === input.userId
          && asString(data.role_id) === input.roleId
          && asString(data.policy_effect, 'ALLOW') === (input.policyEffect ?? 'ALLOW')
          && resourceScopesEqual(existingScope, resourceScope)
      })
    if (duplicate) {
      throw new HttpError(409, 'USER_ROLE_BINDING_ALREADY_EXISTS', '该用户在相同范围内已有该角色')
    }
    return upsertEntity({
      entityType: 'user_role_binding',
      entityId: bindingId,
      title: `${input.userId}:${input.roleId}`,
      status: 'ACTIVE',
      naturalScopeType: scopeType,
      naturalScopeKey: scopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'UserRoleBindingGranted',
      data: {
        binding_id: bindingId,
        platform_id: platformId,
        user_id: input.userId,
        role_id: input.roleId,
        store_id: storeId,
        resource_scope: resourceScope,
        scope_selector: resourceScope,
        granted_by: input.grantedBy ?? 'mock-admin-operator',
        policy_effect: input.policyEffect ?? 'ALLOW',
        policy_conditions: {
          ...asRecord(input.policyConditions),
          ...(input.approvalId ? {approval_id: input.approvalId} : {}),
        },
        effective_from: input.effectiveFrom ?? new Date(now()).toISOString(),
        effective_to: input.effectiveTo ?? null,
        grant_reason: input.reason ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createResourceTag = (input: {
  tagId?: string
  platformId?: string
  tagKey: string
  tagValue: string
  tagLabel?: string | null
  resourceType: string
  resourceId: string
  createdBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `resource-tag:${input.resourceType}:${input.resourceId}:${input.tagKey}:${input.tagValue}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const tagId = input.tagId ?? normalizeId(`tag-${input.resourceType}-${input.resourceId}-${input.tagKey}-${input.tagValue}`)
    return upsertEntity({
      entityType: 'resource_tag',
      entityId: tagId,
      title: input.tagLabel ?? `${input.tagKey}:${input.tagValue}`,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'ResourceTagUpserted',
      data: {
        tag_id: tagId,
        platform_id: platformId,
        tag_key: input.tagKey,
        tag_value: input.tagValue,
        tag_label: input.tagLabel ?? null,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        created_by: input.createdBy ?? 'mock-admin-operator',
        status: 'ACTIVE',
      },
    })
  },
)

export const createPrincipalGroup = (input: {
  groupId?: string
  platformId?: string
  groupCode: string
  groupName: string
  groupType?: string
  ldapGroupDn?: string | null
  oidcClaimKey?: string | null
  oidcClaimValue?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `principal-group:${input.platformId ?? identity.platformId}:${input.groupCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const groupId = input.groupId ?? normalizeId(`principal-group-${platformId}-${input.groupCode}`)
    return upsertEntity({
      entityType: 'principal_group',
      entityId: groupId,
      title: input.groupName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PrincipalGroupUpserted',
      data: {
        group_id: groupId,
        platform_id: platformId,
        group_code: input.groupCode,
        group_name: input.groupName,
        group_type: input.groupType ?? 'MANUAL',
        ldap_group_dn: input.ldapGroupDn ?? null,
        oidc_claim_key: input.oidcClaimKey ?? null,
        oidc_claim_value: input.oidcClaimValue ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const addGroupMember = (input: {
  memberId?: string
  groupId: string
  userId: string
  joinedBy?: string | null
  source?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `group-member:${input.groupId}:${input.userId}`,
  input.mutation?.idempotencyKey,
  () => {
    const group = requireEntityRow('principal_group', input.groupId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const platformId = asString(asRecord(group.payload.data).platform_id, identity.platformId)
    const memberId = input.memberId ?? normalizeId(`group-member-${input.groupId}-${input.userId}`)
    return upsertEntity({
      entityType: 'group_member',
      entityId: memberId,
      title: `${input.groupId}:${input.userId}`,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'GroupMemberAdded',
      data: {
        member_id: memberId,
        platform_id: platformId,
        group_id: input.groupId,
        user_id: input.userId,
        joined_at: new Date(now()).toISOString(),
        joined_by: input.joinedBy ?? null,
        source: input.source ?? 'MANUAL',
        status: 'ACTIVE',
      },
    })
  },
)

export const createGroupRoleBinding = (input: {
  groupBindingId?: string
  groupId: string
  roleId: string
  scopeType?: string
  scopeId?: string
  resourceScope?: Record<string, unknown>
  scopeSelector?: Record<string, unknown>
  effectiveFrom?: string
  effectiveTo?: string | null
  policyEffect?: 'ALLOW' | 'DENY'
  policyConditions?: Record<string, unknown> | null
  approvalId?: string | null
  grantedBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `group-role-binding:${input.groupId}:${input.roleId}:${normalizeScopeSelector(
    input.resourceScope ?? input.scopeSelector ?? {
      scope_type: input.scopeType ?? 'PLATFORM',
      scope_key: input.scopeId,
    },
    'PLATFORM',
    input.scopeId ?? identity.platformId,
  ).comparisonKey}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const group = requireEntityRow('principal_group', input.groupId, mutation.sandboxId)
    const platformId = asString(asRecord(group.payload.data).platform_id, identity.platformId)
    const normalizedScope = normalizeScopeSelector(
      input.resourceScope ?? input.scopeSelector ?? {
        scope_type: input.scopeType ?? 'PLATFORM',
        scope_key: input.scopeId ?? platformId,
      },
      'PLATFORM',
      input.scopeId ?? platformId,
    )
    const {comparisonKey: _comparisonKey, ...resourceScope} = normalizedScope
    const scopeType = resourceScope.scope_type
    const scopeKey = resourceScope.scope_key
    const groupBindingId = input.groupBindingId ?? normalizeId(`group-binding-${input.groupId}-${input.roleId}-${scopeType}-${scopeKey}`)
    return upsertEntity({
      entityType: 'group_role_binding',
      entityId: groupBindingId,
      title: `${input.groupId}:${input.roleId}`,
      status: 'ACTIVE',
      naturalScopeType: scopeType,
      naturalScopeKey: scopeKey,
      mutation,
      eventType: 'GroupRoleBindingGranted',
      data: {
        group_binding_id: groupBindingId,
        platform_id: platformId,
        group_id: input.groupId,
        role_id: input.roleId,
        resource_scope: resourceScope,
        scope_selector: resourceScope,
        granted_by: input.grantedBy ?? 'mock-admin-operator',
        effective_from: input.effectiveFrom ?? new Date(now()).toISOString(),
        effective_to: input.effectiveTo ?? null,
        policy_effect: input.policyEffect ?? 'ALLOW',
        policy_conditions: {
          ...asRecord(input.policyConditions),
          ...(input.approvalId ? {approval_id: input.approvalId} : {}),
        },
        status: 'ACTIVE',
      },
    })
  },
)

export const createAuthorizationSession = (input: {
  sessionId?: string
  userId: string
  platformId?: string
  activatedBindingIds?: string[]
  workingScope?: Record<string, unknown>
  sessionToken?: string | null
  expiresAt?: string | null
  lastActiveAt?: string | null
  mfaVerifiedAt?: string | null
  mfaExpiresAt?: string | null
  mfaMethod?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `authorization-session:${input.userId}:${input.sessionId ?? ''}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const sessionId = input.sessionId ?? createId('auth-session')
    return upsertEntity({
      entityType: 'authorization_session',
      entityId: sessionId,
      title: `${input.userId}:session`,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'AuthorizationSessionActivated',
      data: {
        session_id: sessionId,
        user_id: input.userId,
        platform_id: platformId,
        activated_binding_ids: input.activatedBindingIds ?? [],
        working_scope: input.workingScope ?? {},
        session_token: input.sessionToken ?? null,
        expires_at: input.expiresAt ?? null,
        last_active_at: input.lastActiveAt ?? new Date(now()).toISOString(),
        mfa_verified_at: input.mfaVerifiedAt ?? null,
        mfa_expires_at: input.mfaExpiresAt ?? null,
        mfa_method: input.mfaMethod ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createSeparationOfDutyRule = (input: {
  sodRuleId?: string
  platformId?: string
  ruleName: string
  ruleDescription?: string | null
  conflictingRoleCodes?: string[]
  conflictingPermCodes?: string[]
  scopeType?: string
  isActive?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `sod-rule:${input.platformId ?? identity.platformId}:${input.ruleName}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const active = asBoolean(input.isActive, true)
    const sodRuleId = input.sodRuleId ?? normalizeId(`sod-${platformId}-${input.ruleName}`)
    return upsertEntity({
      entityType: 'separation_of_duty_rule',
      entityId: sodRuleId,
      title: input.ruleName,
      status: active ? 'ACTIVE' : 'INACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'SeparationOfDutyRuleUpserted',
      data: {
        sod_rule_id: sodRuleId,
        platform_id: platformId,
        rule_name: input.ruleName,
        rule_description: input.ruleDescription ?? null,
        conflicting_role_codes: input.conflictingRoleCodes ?? [],
        conflicting_perm_codes: input.conflictingPermCodes ?? [],
        scope_type: input.scopeType ?? 'PLATFORM',
        is_active: active,
        status: active ? 'ACTIVE' : 'INACTIVE',
      },
    })
  },
)

export const createHighRiskPermissionPolicy = (input: {
  policyId?: string
  platformId?: string
  permissionCode: string
  requireApproval?: boolean
  approverRoleCode?: string | null
  maxDurationDays?: number | null
  requireMfa?: boolean
  mfaValidityMinutes?: number
  isActive?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `high-risk-policy:${input.platformId ?? identity.platformId}:${input.permissionCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = asString(input.platformId, identity.platformId)
    const active = asBoolean(input.isActive, true)
    const policyId = input.policyId ?? normalizeId(`high-risk-${platformId}-${input.permissionCode}`)
    return upsertEntity({
      entityType: 'high_risk_permission_policy',
      entityId: policyId,
      title: input.permissionCode,
      status: active ? 'ACTIVE' : 'INACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'HighRiskPermissionPolicyUpserted',
      data: {
        policy_id: policyId,
        platform_id: platformId,
        permission_code: input.permissionCode,
        require_approval: asBoolean(input.requireApproval, true),
        approver_role_code: input.approverRoleCode ?? null,
        max_duration_days: input.maxDurationDays ?? null,
        require_mfa: asBoolean(input.requireMfa, false),
        mfa_validity_minutes: asNumber(input.mfaValidityMinutes, 30),
        is_active: active,
        status: active ? 'ACTIVE' : 'INACTIVE',
      },
    })
  },
)

export const revokeUserRoleBinding = (input: {
  bindingId: string
  reason?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `revoke-user-role-binding:${input.bindingId}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const current = requireEntityRow('user_role_binding', input.bindingId, mutation.sandboxId)
    const currentData = cloneJson(asRecord(current.payload.data))
    const result = upsertEntity({
      entityType: 'user_role_binding',
      entityId: input.bindingId,
      title: current.title,
      status: 'REVOKED',
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation,
      eventType: 'UserRoleBindingRevoked',
      data: {
        ...currentData,
        status: 'REVOKED',
        effective_to: new Date(now()).toISOString(),
        revoked_by: mutation.actorId ?? 'mock-admin-operator',
        revoked_at: new Date(now()).toISOString(),
        revoke_reason: input.reason ?? null,
      },
    })
    recordAuthAuditLog({
      mutation,
      sandboxId: mutation.sandboxId,
      userId: mutation.actorId,
      eventType: 'UserRoleBindingRevoked',
      resourceType: 'USER_ROLE_BINDING',
      resourceId: input.bindingId,
      action: 'REVOKE_USER_ROLE_BINDING',
      permissionCode: 'iam.user-role-binding.revoke',
      result: 'ALLOWED',
      detail: {
        binding_id: input.bindingId,
        target_user_id: asOptionalString(currentData.user_id) ?? null,
        role_id: asOptionalString(currentData.role_id) ?? null,
        scope: asRecord(currentData.resource_scope),
        reason: input.reason ?? null,
      },
    })
    return result
  },
)

export const createBrandMetadata = (input: {
  metadataId?: string
  brandId: string
  metadataType: string
  metadataName: string
  options?: Array<Record<string, unknown> | string>
  selectionType?: string
  required?: boolean
  minSelections?: number
  maxSelections?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-brand-metadata:${input.brandId}:${input.metadataType}:${input.metadataName}`,
  input.mutation?.idempotencyKey,
  () => {
    const metadataType = asString(input.metadataType, 'FLAVOR').trim().toUpperCase()
    const metadataId = input.metadataId ?? normalizeId(`brand-meta-${input.brandId}-${metadataType}-${input.metadataName}`)
    const options = Array.isArray(input.options)
      ? input.options.map((option, index) => {
        if (typeof option === 'string') {
          return {
            option_id: normalizeId(`${metadataId}-${option}`),
            option_name: option,
            price_delta: 0,
            is_default: index === 0,
            status: 'ACTIVE',
          }
        }
        const optionRecord = asRecord(option)
        const optionName = asString(optionRecord.option_name ?? optionRecord.name, `选项${index + 1}`)
        return {
          option_id: asOptionalString(optionRecord.option_id) ?? normalizeId(`${metadataId}-${optionName}`),
          option_name: optionName,
          price_delta: asNumber(optionRecord.price_delta, 0),
          is_default: asBoolean(optionRecord.is_default, index === 0),
          status: sanitizeStatus(optionRecord.status, 'ACTIVE'),
        }
      })
      : []
    return upsertEntity({
      entityType: 'brand_metadata',
      entityId: metadataId,
      title: input.metadataName,
      status: 'ACTIVE',
      naturalScopeType: 'BRAND',
      naturalScopeKey: input.brandId,
      mutation: defaultMutation(input.mutation),
      eventType: 'BrandMetadataUpserted',
      data: {
        metadata_id: metadataId,
        brand_id: input.brandId,
        metadata_type: metadataType,
        metadata_name: input.metadataName,
        selection_type: asString(input.selectionType, metadataType === 'MODIFIER_GROUP' ? 'MULTIPLE' : 'SINGLE'),
        required: asBoolean(input.required, false),
        min_selections: asNumber(input.minSelections, 0),
        max_selections: asNumber(input.maxSelections, metadataType === 'MODIFIER_GROUP' ? 2 : 1),
        options,
        status: 'ACTIVE',
      },
    })
  },
)

export const createProductCategory = (input: {
  categoryId?: string
  categoryCode: string
  categoryName: string
  parentCategoryId?: string | null
  ownershipScope?: 'BRAND' | 'STORE'
  brandId?: string | null
  storeId?: string | null
  sortOrder?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-product-category:${input.ownershipScope ?? 'BRAND'}:${input.brandId ?? input.storeId ?? ''}:${input.categoryCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const ownershipScope = input.ownershipScope === 'STORE' ? 'STORE' : 'BRAND'
    const ownerId = ownershipScope === 'STORE'
      ? asString(input.storeId, identity.storeId)
      : asString(input.brandId, identity.brandId)
    const categoryId = input.categoryId ?? normalizeId(`category-${ownerId}-${input.categoryCode}`)
    const duplicate = findFieldDuplicate({
      entityType: 'product_category',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: categoryId,
      field: 'category_code',
      value: input.categoryCode,
      scope: {field: 'owner_id', value: ownerId},
    })
    if (duplicate) {
      throw new HttpError(409, 'PRODUCT_CATEGORY_CODE_ALREADY_EXISTS', '商品分类编码在当前归属范围内已被使用')
    }
    return upsertEntity({
      entityType: 'product_category',
      entityId: categoryId,
      title: input.categoryName,
      status: 'ACTIVE',
      naturalScopeType: ownershipScope,
      naturalScopeKey: ownerId,
      mutation,
      eventType: 'ProductCategoryUpserted',
      data: {
        category_id: categoryId,
        category_code: input.categoryCode,
        category_name: input.categoryName,
        parent_category_id: input.parentCategoryId ?? null,
        ownership_scope: ownershipScope,
        owner_id: ownerId,
        sort_order: asNumber(input.sortOrder, 100),
        status: 'ACTIVE',
      },
    })
  },
)

export const createProduct = (input: {
  productId?: string
  productCode?: string
  productName: string
  productNameEn?: string | null
  ownershipScope: 'BRAND' | 'STORE'
  brandId?: string
  storeId?: string
  productType?: string
  categoryId?: string | null
  imageUrl?: string
  productImages?: string[]
  productDescription?: string | null
  description?: string | null
  allergenInfo?: string | null
  nutritionInfo?: Record<string, unknown>
  tags?: string[]
  sortOrder?: number
  priceUnit?: string
  basePrice?: number
  comboPricingStrategy?: string | Record<string, unknown> | null
  comboStockPolicy?: Record<string, unknown>
  comboAvailabilityPolicy?: Record<string, unknown>
  comboItems?: Array<Record<string, unknown>>
  productionProfile?: Record<string, unknown>
  productionSteps?: Array<Record<string, unknown>>
  modifierGroups?: Array<Record<string, unknown>>
  variants?: Array<Record<string, unknown>>
  comboItemGroups?: Array<Record<string, unknown>>
  createdBy?: string | null
  updatedBy?: string | null
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-product:${input.productName}:${input.ownershipScope}:${input.brandId ?? input.storeId ?? ''}`,
  input.mutation?.idempotencyKey,
  () => {
    const productId = input.productId ?? normalizeId(`product-${input.productName}`)
    const mutation = defaultMutation(input.mutation)
    const productCode = input.productCode ?? productId
    const basePrice = asNumber(input.basePrice, 0)
    const productType = normalizeProductType(input.productType)
    if (basePrice < 0) {
      throw new HttpError(400, 'INVALID_PRODUCT_PRICE', '商品基础价格不能为负数')
    }
    const duplicate = findFieldDuplicate({
      entityType: 'product',
      sandboxId: mutation.sandboxId ?? DEFAULT_SANDBOX_ID,
      entityId: productId,
      field: 'product_code',
      value: productCode,
    })
    if (duplicate) {
      throw new HttpError(409, 'PRODUCT_CODE_ALREADY_EXISTS', '商品编码已存在')
    }
    const scopeType = input.ownershipScope === 'STORE' ? 'STORE' : 'BRAND'
    const scopeKey = input.ownershipScope === 'STORE'
      ? asString(input.storeId, identity.storeId)
      : asString(input.brandId, identity.brandId)
    const ownerId = scopeKey
    return upsertEntity({
      entityType: 'product',
      entityId: productId,
      title: input.productName,
      status: 'DRAFT',
      naturalScopeType: scopeType,
      naturalScopeKey: scopeKey,
      mutation,
      eventType: 'ProductUpserted',
      data: {
        product_id: productId,
        product_code: productCode,
        brand_id: input.brandId ?? null,
        store_id: input.storeId ?? null,
        product_name: input.productName,
        product_name_en: input.productNameEn ?? null,
        ownership_scope: input.ownershipScope,
        owner_id: ownerId,
        product_type: productType,
        category_id: input.categoryId ?? null,
        image_url: input.imageUrl ?? null,
        product_image_url: input.imageUrl ?? null,
        product_images: input.productImages ?? [],
        product_description: input.productDescription ?? input.description ?? null,
        description: input.description ?? input.productDescription ?? null,
        allergen_info: input.allergenInfo ?? null,
        nutrition_info: input.nutritionInfo ?? {},
        tags: input.tags ?? [],
        sort_order: asNumber(input.sortOrder, 100),
        price_unit: input.priceUnit ?? 'ITEM',
        base_price: basePrice,
        combo_pricing_strategy: input.comboPricingStrategy ?? null,
        combo_stock_policy: input.comboStockPolicy ?? {},
        combo_availability_policy: input.comboAvailabilityPolicy ?? {},
        production_profile: input.productionProfile ?? {},
        production_steps: input.productionSteps ?? [],
        modifier_groups: input.modifierGroups ?? [],
        variants: input.variants ?? [],
        combo_item_groups: input.comboItemGroups ?? [],
        combo_items: input.comboItems ?? [],
        created_by: input.createdBy ?? mutation.actorId ?? 'mock-admin-operator',
        updated_by: input.updatedBy ?? null,
        version: asNumber(input.version, 1),
        status: 'DRAFT',
      },
    })
  },
)

export const createBrandMenu = (input: {
  brandMenuId?: string
  brandId: string
  menuName: string
  channelType?: string
  menuType?: string
  effectiveDate?: string | null
  expireDate?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  parentMenuId?: string | null
  changeSummary?: string | null
  createdFromVersion?: number | null
  version?: number
  allowStoreOverride?: boolean
  overrideScope?: Record<string, unknown>
  sections?: Array<Record<string, unknown>>
  reviewStatus?: string
  publishedAt?: string | null
  publishedBy?: string | null
  reviewComment?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-brand-menu:${input.brandId}:${input.menuName}`,
  input.mutation?.idempotencyKey,
  () => {
    const brandMenuId = input.brandMenuId ?? normalizeId(`brand-menu-${input.menuName}`)
    const mutation = defaultMutation(input.mutation)
    if (input.parentMenuId) {
      const parentMenu = requireEntityRow('brand_menu', input.parentMenuId, mutation.sandboxId)
      if (!['APPROVED', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(parentMenu.status)) {
        throw new HttpError(409, 'PARENT_MENU_NOT_VERSIONABLE', '只有已批准、已停用或已归档的品牌菜单可以作为新版本来源', {
          parentMenuId: input.parentMenuId,
          status: parentMenu.status,
        })
      }
    }
    return upsertEntity({
      entityType: 'brand_menu',
      entityId: brandMenuId,
      title: input.menuName,
      status: 'DRAFT',
      naturalScopeType: 'BRAND',
      naturalScopeKey: input.brandId,
      mutation,
      eventType: 'BrandMenuUpserted',
      data: {
        brand_menu_id: brandMenuId,
        menu_id: brandMenuId,
        brand_id: input.brandId,
        menu_name: input.menuName,
        channel_type: input.channelType ?? 'ALL',
        menu_type: input.menuType ?? 'FULL_DAY',
        effective_date: input.effectiveDate ?? input.effectiveFrom ?? null,
        expire_date: input.expireDate ?? input.effectiveTo ?? null,
        effective_from: input.effectiveFrom ?? input.effectiveDate ?? null,
        effective_to: input.effectiveTo ?? input.expireDate ?? null,
        parent_menu_id: input.parentMenuId ?? null,
        change_summary: input.changeSummary ?? null,
        created_from_version: input.createdFromVersion ?? null,
        version: asNumber(input.version, 1),
        allow_store_override: asBoolean(input.allowStoreOverride, true),
        override_scope: {
          price_overridable: true,
          image_overridable: true,
          availability_overridable: true,
          ...asRecord(input.overrideScope),
        },
        review_status: input.reviewStatus ?? 'NONE',
        published_at: input.publishedAt ?? null,
        published_by: input.publishedBy ?? null,
        review_comment: input.reviewComment ?? null,
        status: 'DRAFT',
        sections: normalizeMenuSections(input.sections),
      },
    })
  },
)

export const createStoreMenu = (input: {
  menuId?: string
  storeId: string
  menuName: string
  brandMenuId?: string | null
  channelType?: string
  menuType?: string
  inheritMode?: string
  effectiveDate?: string | null
  expireDate?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  parentMenuId?: string | null
  changeSummary?: string | null
  createdFromVersion?: number | null
  version?: number
  sections?: Array<Record<string, unknown>>
  versionHash?: string
  reviewStatus?: string
  publishedAt?: string | null
  publishedBy?: string | null
  reviewComment?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-store-menu:${input.storeId}:${input.menuName}`,
  input.mutation?.idempotencyKey,
  () => {
    const menuId = input.menuId ?? normalizeId(`menu-${input.storeId}-${input.menuName}`)
    const mutation = defaultMutation(input.mutation)
    if (input.brandMenuId) {
      const brandMenu = requireEntityRow('brand_menu', input.brandMenuId, mutation.sandboxId)
      const brandMenuData = asRecord(brandMenu.payload.data)
      if (asString(brandMenuData.review_status, 'NONE') !== 'APPROVED') {
        throw new HttpError(409, 'BRAND_MENU_NOT_APPROVED', '品牌菜单未审核通过，不能发布到门店')
      }
    }
    listRowsByEntityType('menu_catalog', mutation.sandboxId)
      .map(toAggregateRow)
      .filter(menu => menu.entityId !== menuId && menu.naturalScopeType === 'STORE' && menu.naturalScopeKey === input.storeId && menu.status === 'ACTIVE')
      .forEach(menu => {
        const menuData = cloneJson(asRecord(menu.payload.data))
        upsertEntity({
          entityType: 'menu_catalog',
          entityId: menu.entityId,
          title: menu.title,
          status: 'INACTIVE',
          naturalScopeType: menu.naturalScopeType,
          naturalScopeKey: menu.naturalScopeKey,
          mutation,
          eventType: 'StoreMenuSuperseded',
          data: {
            ...menuData,
            status: 'INACTIVE',
            superseded_by_menu_id: menuId,
          },
        })
      })
    return upsertEntity({
      entityType: 'menu_catalog',
      entityId: menuId,
      title: input.menuName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation,
      eventType: 'StoreMenuPublished',
      data: {
        menu_id: menuId,
        store_id: input.storeId,
        brand_menu_id: input.brandMenuId ?? null,
        menu_name: input.menuName,
        channel_type: input.channelType ?? 'ALL',
        menu_type: input.menuType ?? 'FULL_DAY',
        inherit_mode: input.inheritMode ?? (input.brandMenuId ? 'PARTIAL' : 'NONE'),
        effective_date: input.effectiveDate ?? input.effectiveFrom ?? null,
        expire_date: input.expireDate ?? input.effectiveTo ?? null,
        effective_from: input.effectiveFrom ?? input.effectiveDate ?? null,
        effective_to: input.effectiveTo ?? input.expireDate ?? null,
        parent_menu_id: input.parentMenuId ?? null,
        change_summary: input.changeSummary ?? null,
        created_from_version: input.createdFromVersion ?? null,
        version: asNumber(input.version, 1),
        review_status: input.reviewStatus ?? 'APPROVED',
        published_at: input.publishedAt ?? new Date(now()).toISOString(),
        published_by: input.publishedBy ?? mutation.actorId ?? 'mock-admin-operator',
        review_comment: input.reviewComment ?? null,
        status: 'ACTIVE',
        sections: normalizeMenuSections(input.sections),
        version_hash: input.versionHash ?? createId('menu-hash'),
      },
    })
  },
)

export const createPriceRule = (input: {
  ruleId?: string
  ruleCode: string
  ruleName?: string
  productId?: string
  storeId: string
  priceType?: string
  channelType?: string
  priceDelta?: number
  price?: number
  priceValue?: number
  timeSlotStart?: string | null
  timeSlotEnd?: string | null
  timeSlot?: {start?: string; end?: string} | null
  daysOfWeek?: string[]
  memberTier?: string | null
  priority?: number
  discountType?: string
  discountValue?: number
  enabled?: boolean
  applicableProductIds?: string[]
  effectiveFrom?: string | null
  effectiveTo?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `create-price-rule:${input.ruleCode}:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const ruleId = input.ruleId ?? normalizeId(`price-rule-${input.ruleCode}`)
    const priceType = normalizePriceType(input.priceType)
    return upsertEntity({
      entityType: 'price_rule',
      entityId: ruleId,
      title: input.ruleName ?? input.ruleCode,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PriceRuleUpserted',
      data: {
        rule_id: ruleId,
        rule_code: input.ruleCode,
        rule_name: input.ruleName ?? input.ruleCode,
        product_id: input.productId ?? null,
        store_id: input.storeId,
        price_type: priceType,
        channel_type: input.channelType ?? 'ALL',
        price_delta: asNumber(input.priceDelta, 0),
        price: asNumber(input.price ?? input.priceValue, asNumber(input.discountValue, asNumber(input.priceDelta, 0))),
        price_value: asNumber(input.priceValue ?? input.price, asNumber(input.discountValue, asNumber(input.priceDelta, 0))),
        time_slot_start: input.timeSlotStart ?? input.timeSlot?.start ?? null,
        time_slot_end: input.timeSlotEnd ?? input.timeSlot?.end ?? null,
        time_slot: input.timeSlot ?? (
          input.timeSlotStart || input.timeSlotEnd
            ? {start: input.timeSlotStart ?? null, end: input.timeSlotEnd ?? null}
            : null
        ),
        days_of_week: input.daysOfWeek ?? [],
        member_tier: input.memberTier ?? null,
        priority: asNumber(input.priority, 10),
        discount_type: input.discountType ?? 'AMOUNT_OFF',
        discount_value: asNumber(input.discountValue, asNumber(input.priceDelta, 0)),
        enabled: asBoolean(input.enabled, true),
        applicable_product_ids: input.applicableProductIds ?? (input.productId ? [input.productId] : []),
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createProductInheritance = (input: {
  inheritanceId?: string
  brandProductId: string
  storeProductId: string
  storeId: string
  overrideFields?: Array<Record<string, unknown>>
  lockedFields?: string[]
  syncStatus?: string
  lastSyncAt?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `product-inheritance:${input.brandProductId}:${input.storeId}:${input.storeProductId}`,
  input.mutation?.idempotencyKey,
  () => {
    const inheritanceId = input.inheritanceId ?? normalizeId(`inheritance-${input.storeId}-${input.brandProductId}`)
    return upsertEntity({
      entityType: 'product_inheritance',
      entityId: inheritanceId,
      title: `${input.brandProductId} -> ${input.storeProductId}`,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'ProductInheritanceUpserted',
      data: {
        inheritance_id: inheritanceId,
        brand_product_id: input.brandProductId,
        store_product_id: input.storeProductId,
        store_id: input.storeId,
        override_fields: input.overrideFields ?? [],
        locked_fields: input.lockedFields ?? [],
        sync_status: input.syncStatus ?? 'SYNCED',
        last_sync_at: input.lastSyncAt ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createBundlePriceRule = (input: {
  ruleId?: string
  storeId: string
  ruleName: string
  triggerProducts: Array<Record<string, unknown>>
  discountType?: string
  discountValue?: number
  maxApplications?: number
  priority?: number
  effectiveFrom?: string | null
  effectiveTo?: string | null
  isActive?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `bundle-price-rule:${input.storeId}:${input.ruleName}`,
  input.mutation?.idempotencyKey,
  () => {
    const ruleId = input.ruleId ?? normalizeId(`bundle-rule-${input.storeId}-${input.ruleName}`)
    const active = asBoolean(input.isActive, true)
    return upsertEntity({
      entityType: 'bundle_price_rule',
      entityId: ruleId,
      title: input.ruleName,
      status: active ? 'ACTIVE' : 'INACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'BundlePriceRuleUpserted',
      data: {
        rule_id: ruleId,
        store_id: input.storeId,
        rule_name: input.ruleName,
        trigger_products: input.triggerProducts,
        discount_type: input.discountType ?? 'TOTAL_DISCOUNT',
        discount_value: asNumber(input.discountValue, 0),
        max_applications: asNumber(input.maxApplications, 0),
        priority: asNumber(input.priority, 10),
        is_active: active,
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        status: active ? 'ACTIVE' : 'INACTIVE',
      },
    })
  },
)

export const createChannelProductMapping = (input: {
  mappingId?: string
  storeId: string
  productId: string
  channelType: string
  externalProductId?: string | null
  externalSkuId?: string | null
  mappingStatus?: string
  syncStatus?: string
  lastSyncAt?: string | null
  syncErrorMessage?: string | null
  fieldMappingConfig?: Record<string, unknown>
  mutation?: MutationInput
}) => getMutationResponse(
  `channel-product-mapping:${input.storeId}:${input.channelType}:${input.productId}`,
  input.mutation?.idempotencyKey,
  () => {
    const mappingId = input.mappingId ?? normalizeId(`channel-map-${input.storeId}-${input.channelType}-${input.productId}`)
    return upsertEntity({
      entityType: 'channel_product_mapping',
      entityId: mappingId,
      title: `${input.channelType}:${input.productId}`,
      status: sanitizeStatus(input.mappingStatus, 'PENDING'),
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'ChannelProductMappingUpserted',
      data: {
        mapping_id: mappingId,
        store_id: input.storeId,
        product_id: input.productId,
        channel_type: input.channelType,
        external_product_id: input.externalProductId ?? null,
        external_sku_id: input.externalSkuId ?? null,
        mapping_status: input.mappingStatus ?? 'PENDING',
        sync_status: input.syncStatus ?? 'NOT_SYNCED',
        last_sync_at: input.lastSyncAt ?? null,
        sync_error_message: input.syncErrorMessage ?? null,
        field_mapping_config: input.fieldMappingConfig ?? {},
        status: input.mappingStatus ?? 'PENDING',
      },
    })
  },
)

export const updatePriceRule = (input: {
  ruleId: string
  ruleName?: string
  channelType?: string
  timeSlotStart?: string | null
  timeSlotEnd?: string | null
  timeSlot?: {start?: string; end?: string} | null
  daysOfWeek?: string[]
  memberTier?: string | null
  priority?: number
  discountType?: string
  discountValue?: number
  price?: number
  priceValue?: number
  enabled?: boolean
  applicableProductIds?: string[]
  effectiveFrom?: string | null
  effectiveTo?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `update-price-rule:${input.ruleId}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('price_rule', input.ruleId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    const nextData = {
      ...currentData,
      rule_name: input.ruleName ?? currentData.rule_name,
      channel_type: input.channelType ?? currentData.channel_type,
      time_slot_start: input.timeSlotStart === undefined ? currentData.time_slot_start : input.timeSlotStart,
      time_slot_end: input.timeSlotEnd === undefined ? currentData.time_slot_end : input.timeSlotEnd,
      time_slot: input.timeSlot === undefined
        ? (
          input.timeSlotStart !== undefined || input.timeSlotEnd !== undefined
            ? {start: input.timeSlotStart ?? null, end: input.timeSlotEnd ?? null}
            : currentData.time_slot
        )
        : input.timeSlot,
      days_of_week: input.daysOfWeek ?? currentData.days_of_week,
      member_tier: input.memberTier === undefined ? currentData.member_tier : input.memberTier,
      priority: input.priority === undefined ? currentData.priority : asNumber(input.priority, 10),
      discount_type: input.discountType ?? currentData.discount_type,
      discount_value: input.discountValue === undefined ? currentData.discount_value : asNumber(input.discountValue, 0),
      price: input.price === undefined ? currentData.price : asNumber(input.price, 0),
      price_value: input.priceValue === undefined ? currentData.price_value : asNumber(input.priceValue, 0),
      enabled: input.enabled === undefined ? currentData.enabled : asBoolean(input.enabled, true),
      applicable_product_ids: input.applicableProductIds ?? currentData.applicable_product_ids,
      effective_from: input.effectiveFrom === undefined ? currentData.effective_from : input.effectiveFrom,
      effective_to: input.effectiveTo === undefined ? currentData.effective_to : input.effectiveTo,
    }
    return upsertEntity({
      entityType: 'price_rule',
      entityId: input.ruleId,
      title: asString(nextData.rule_name, current.title),
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'PriceRuleUpdated',
      data: nextData,
    })
  },
)

export const disablePriceRule = (input: {
  ruleId: string
  reason?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `disable-price-rule:${input.ruleId}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('price_rule', input.ruleId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    return upsertEntity({
      entityType: 'price_rule',
      entityId: input.ruleId,
      title: current.title,
      status: 'INACTIVE',
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'PriceRuleDisabled',
      data: {
        ...currentData,
        status: 'INACTIVE',
        disabled_reason: input.reason ?? null,
        disabled_at: new Date(now()).toISOString(),
      },
    })
  },
)

export const createStoreConfig = (input: {
  configId?: string
  storeId: string
  businessStatus?: string
  acceptOrder?: boolean
  operatingStatus?: string
  autoAcceptEnabled?: boolean
  acceptTimeoutSeconds?: number
  preparationBufferMinutes?: number
  maxConcurrentOrders?: number
  pauseReason?: string | null
  pausedAt?: string | null
  pausedBy?: string | null
  resumeScheduledAt?: string | null
  operatingHours?: Array<Record<string, unknown>>
  specialOperatingDays?: Array<Record<string, unknown>>
  channelOperatingHours?: Array<Record<string, unknown>>
  autoOpenCloseEnabled?: boolean
  extraChargeRules?: Array<Record<string, unknown>>
  refundStockPolicy?: string
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `upsert-store-config:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const sandboxId = input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID
    const existingConfig = listRowsByEntityType('store_config', sandboxId)
      .map(toAggregateRow)
      .find(item => item.naturalScopeType === 'STORE' && item.naturalScopeKey === input.storeId)
    const configId = input.configId ?? existingConfig?.entityId ?? normalizeId(`store-config-${input.storeId}`)
    return upsertEntity({
      entityType: 'store_config',
      entityId: configId,
      title: `${input.storeId}-config`,
      status: sanitizeStatus(input.businessStatus, 'OPEN'),
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'StoreConfigUpserted',
      data: {
        config_id: configId,
        store_id: input.storeId,
        business_status: sanitizeStatus(input.businessStatus, 'OPEN'),
        operating_status: asString(input.operatingStatus, sanitizeStatus(input.businessStatus, 'OPEN') === 'OPEN' ? 'OPERATING' : sanitizeStatus(input.businessStatus, 'OPEN')),
        accept_order: asBoolean(input.acceptOrder ?? input.autoAcceptEnabled, true),
        auto_accept_enabled: asBoolean(input.autoAcceptEnabled ?? input.acceptOrder, true),
        accept_timeout_seconds: asNumber(input.acceptTimeoutSeconds, 60),
        preparation_buffer_minutes: asNumber(input.preparationBufferMinutes, 10),
        max_concurrent_orders: Math.max(0, asNumber(input.maxConcurrentOrders, 0)),
        pause_reason: input.pauseReason ?? null,
        paused_at: input.pausedAt ?? null,
        paused_by: input.pausedBy ?? null,
        resume_scheduled_at: input.resumeScheduledAt ?? null,
        operating_hours: input.operatingHours ?? [],
        special_operating_days: input.specialOperatingDays ?? [],
        channel_operating_hours: input.channelOperatingHours ?? [],
        auto_open_close_enabled: asBoolean(input.autoOpenCloseEnabled, true),
        extra_charge_rules: input.extraChargeRules ?? [],
        refund_stock_policy: input.refundStockPolicy ?? 'NO_RESTORE_AFTER_REFUND',
        version: asNumber(input.version, 1),
      },
    })
  },
)

export const activateContract = (input: {
  contractId: string
  remark?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `activate-contract:${input.contractId}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const contract = requireEntityRow('contract', input.contractId, mutation.sandboxId)
    if (contract.status === 'ACTIVE') {
      return contract
    }
    if (contract.status !== 'PENDING') {
      throw new HttpError(409, 'CONTRACT_NOT_PENDING', '只有待生效合同可以执行生效操作', {
        contractId: input.contractId,
        status: contract.status,
      })
    }
    const contractData = cloneJson(asRecord(contract.payload.data))
    if (isFutureStartDate(contractData.start_date)) {
      throw new HttpError(409, 'CONTRACT_NOT_STARTED', '合同尚未到生效日期，不能提前生效', {
        contractId: input.contractId,
        startDate: asOptionalString(contractData.start_date),
      })
    }
    const storeId = asString(contractData.store_id)
    const store = requireEntityRow('store', storeId, mutation.sandboxId)
    const storeData = cloneJson(asRecord(store.payload.data))
    const previousContractId = asOptionalString(storeData.active_contract_id)
    const blockingContract = listRowsByEntityType('contract', mutation.sandboxId)
      .map(toAggregateRow)
      .map(withDerivedContractStatus)
      .find(item => {
        const data = asRecord(item.payload.data)
        return item.entityId !== input.contractId
          && item.status === 'ACTIVE'
          && asString(data.store_id, '') === storeId
      })

    if (blockingContract || (previousContractId && previousContractId !== input.contractId)) {
      throw new HttpError(409, 'STORE_ALREADY_HAS_ACTIVE_CONTRACT', '门店已有生效合同，请先终止现有合同', {
        storeId,
        activeContractId: blockingContract?.entityId ?? previousContractId,
      })
    }

    const nextContract = upsertEntity({
      entityType: 'contract',
      entityId: input.contractId,
      title: contract.title,
      status: 'ACTIVE',
      naturalScopeType: contract.naturalScopeType,
      naturalScopeKey: contract.naturalScopeKey,
      mutation,
      eventType: 'ContractActivated',
      data: {
        ...contractData,
        status: 'ACTIVE',
        activated_at: new Date(now()).toISOString(),
        activation_remark: input.remark ?? null,
      },
    })

    storeData.active_contract_id = input.contractId
    storeData.platform_id = asString(contractData.platform_id, asString(storeData.platform_id, identity.platformId))
    storeData.tenant_id = asString(contractData.tenant_id, null as unknown as string)
    storeData.brand_id = asString(contractData.brand_id, null as unknown as string)
    storeData.entity_id = asString(contractData.entity_id, null as unknown as string)
    storeData.contract_status = 'ACTIVE'
    storeData.store_status = 'OPERATING'
    storeData.status = 'ACTIVE'
    upsertEntity({
      entityType: 'store',
      entityId: storeId,
      title: store.title,
      status: store.status,
      naturalScopeType: 'STORE',
      naturalScopeKey: storeId,
      mutation,
      eventType: 'StoreContractSnapshotUpdated',
      data: storeData,
    })

    return nextContract
  },
)

export const terminateContract = (input: {
  contractId: string
  reason?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `terminate-contract:${input.contractId}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const contract = requireEntityRow('contract', input.contractId, mutation.sandboxId)
    if (contract.status === 'TERMINATED') {
      return contract
    }
    if (!['ACTIVE', 'PENDING'].includes(contract.status)) {
      throw new HttpError(409, 'CONTRACT_CANNOT_TERMINATE', '只有待生效或生效合同可以执行终止操作', {
        contractId: input.contractId,
        status: contract.status,
      })
    }
    const contractData = cloneJson(asRecord(contract.payload.data))
    const nextContract = upsertEntity({
      entityType: 'contract',
      entityId: input.contractId,
      title: contract.title,
      status: 'TERMINATED',
      naturalScopeType: contract.naturalScopeType,
      naturalScopeKey: contract.naturalScopeKey,
      mutation,
      eventType: 'ContractTerminated',
      data: {
        ...contractData,
        status: 'TERMINATED',
        terminated_at: new Date(now()).toISOString(),
        terminated_by: mutation.actorId ?? 'mock-admin-operator',
        termination_reason: input.reason ?? null,
      },
    })

    const storeId = asString(contractData.store_id)
    const store = requireEntityRow('store', storeId, mutation.sandboxId)
    const storeData = cloneJson(asRecord(store.payload.data))
    if (asString(storeData.active_contract_id) === input.contractId) {
      storeData.active_contract_id = null
      storeData.tenant_id = null
      storeData.brand_id = null
      storeData.entity_id = null
      storeData.contract_status = 'NO_CONTRACT'
      storeData.store_status = 'VACANT'
      upsertEntity({
        entityType: 'store',
        entityId: storeId,
        title: store.title,
        status: store.status,
        naturalScopeType: 'STORE',
        naturalScopeKey: storeId,
        mutation,
        eventType: 'StoreContractSnapshotUpdated',
        data: storeData,
      })
      listRowsByEntityType('menu_catalog', mutation.sandboxId)
        .map(toAggregateRow)
        .filter(menu => menu.naturalScopeType === 'STORE' && menu.naturalScopeKey === storeId && menu.status === 'ACTIVE')
        .forEach(menu => {
          const menuData = cloneJson(asRecord(menu.payload.data))
          upsertEntity({
            entityType: 'menu_catalog',
            entityId: menu.entityId,
            title: menu.title,
            status: 'INVALID',
            naturalScopeType: menu.naturalScopeType,
            naturalScopeKey: menu.naturalScopeKey,
            mutation,
            eventType: 'StoreMenuInvalidatedByContractTermination',
            data: {
              ...menuData,
              status: 'INVALID',
              invalid_reason: '关联合同已终止，请重新配置门店菜单',
              invalidated_at: new Date(now()).toISOString(),
            },
          })
        })
    }

    return nextContract
  },
)

export const renewContract = (input: {
  contractId: string
  newEndDate: string
  commissionRate?: number
  remark?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `renew-contract:${input.contractId}:${input.newEndDate}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const current = requireEntityRow('contract', input.contractId, mutation.sandboxId)
    if (!['ACTIVE', 'EXPIRED'].includes(current.status)) {
      throw new HttpError(409, 'CONTRACT_CANNOT_RENEW', '只有生效或已到期合同可以续签', {
        contractId: input.contractId,
        status: current.status,
      })
    }
    const currentData = cloneJson(asRecord(current.payload.data))
    const originalStoreId = asString(currentData.store_id)
    const store = requireEntityRow('store', originalStoreId, mutation.sandboxId)
    const storeData = cloneJson(asRecord(store.payload.data))
    const retiredContract = upsertEntity({
      entityType: 'contract',
      entityId: input.contractId,
      title: current.title,
      status: 'EXPIRED',
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation,
      eventType: 'ContractRenewedOriginalExpired',
      data: {
        ...currentData,
        status: 'EXPIRED',
        renewed_at: new Date(now()).toISOString(),
        renewed_to_end_date: input.newEndDate,
      },
    })
    if (asString(storeData.active_contract_id) === input.contractId) {
      storeData.active_contract_id = null
      storeData.contract_status = 'NO_CONTRACT'
      storeData.tenant_id = null
      storeData.brand_id = null
      storeData.entity_id = null
      storeData.store_status = 'VACANT'
      upsertEntity({
        entityType: 'store',
        entityId: originalStoreId,
        title: store.title,
        status: store.status,
        naturalScopeType: 'STORE',
        naturalScopeKey: originalStoreId,
        mutation,
        eventType: 'StoreContractSnapshotPreparedForRenewal',
        data: storeData,
      })
    }
    const newContract = createContract({
      contractCode: `${asString(currentData.contract_code, current.title)}-renew`,
      storeId: originalStoreId,
      lessorProjectId: asOptionalString(currentData.lessor_project_id) ?? asOptionalString(currentData.project_id),
      lessorPhaseId: asOptionalString(currentData.lessor_phase_id),
      lessorProjectName: asOptionalString(currentData.lessor_project_name) ?? undefined,
      lessorPhaseName: asOptionalString(currentData.lessor_phase_name) ?? undefined,
      lessorOwnerName: asOptionalString(currentData.lessor_owner_name) ?? undefined,
      lessorOwnerContact: asOptionalString(currentData.lessor_owner_contact) ?? null,
      lessorOwnerPhone: asOptionalString(currentData.lessor_owner_phone) ?? null,
      tenantId: asString(currentData.tenant_id),
      brandId: asString(currentData.brand_id),
      entityId: asOptionalString(currentData.entity_id),
      startDate: asString(currentData.end_date, input.newEndDate),
      endDate: input.newEndDate,
      commissionType: asString(currentData.commission_type, 'FIXED_RATE'),
      commissionRate: asNumber(input.commissionRate, asNumber(currentData.commission_rate, 0)),
      depositAmount: asNumber(currentData.deposit_amount, 0),
      attachmentUrl: asOptionalString(currentData.attachment_url) ?? null,
      mutation,
    })
    return {
      newContractId: newContract.entityId,
      originalContractId: input.contractId,
      newEndDate: input.newEndDate,
      status: newContract.status,
      originalStatus: retiredContract.status,
    }
  },
)

export const amendContract = (input: {
  contractId: string
  endDate?: string
  commissionRate?: number
  remark?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `amend-contract:${input.contractId}:${input.endDate ?? ''}:${input.commissionRate ?? ''}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('contract', input.contractId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    return upsertEntity({
      entityType: 'contract',
      entityId: input.contractId,
      title: current.title,
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'ContractAmended',
      data: {
        ...currentData,
        end_date: input.endDate ?? currentData.end_date,
        commission_rate: typeof input.commissionRate === 'number'
          ? input.commissionRate
          : asNumber(currentData.commission_rate, 0),
        amend_remark: input.remark ?? null,
      },
    })
  },
)

export const changeEntityStatus = (input: {
  entityType: DomainEntity
  entityId: string
  status: string
  eventType: string
  mutation?: MutationInput
}) => getMutationResponse(
  `${input.entityType}:${input.entityId}:${sanitizeEntityStatus(input.entityType, input.status)}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow(input.entityType, input.entityId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const nextStatus = sanitizeEntityStatus(input.entityType, input.status, current.status)
    if (input.entityType === 'table' && !tableMasterStatuses.has(nextStatus)) {
      throw new HttpError(400, 'INVALID_TABLE_STATUS', '桌台主数据只能维护启用或停用状态', {
        tableId: input.entityId,
        status: nextStatus,
      })
    }
    if (current.status === nextStatus) {
      return current
    }
    assertAllowedStatusTransition({
      entityType: input.entityType,
      entityId: input.entityId,
      currentStatus: current.status,
      nextStatus,
    })
    const nextData: Record<string, unknown> = {
      ...cloneJson(asRecord(current.payload.data)),
      status: nextStatus,
    }
    if (input.entityType === 'table') {
      nextData.table_status = nextStatus
    }
    return upsertEntity({
      entityType: input.entityType,
      entityId: input.entityId,
      title: current.title,
      status: nextStatus,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: input.eventType,
      data: nextData,
    })
  },
)

export const suspendTenantWithCascade = (input: {
  tenantId: string
  reason?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `suspend-tenant:${input.tenantId}`,
  input.mutation?.idempotencyKey,
  () => {
    const mutation = defaultMutation(input.mutation)
    const tenant = changeEntityStatus({
      entityType: 'tenant',
      entityId: input.tenantId,
      status: 'SUSPENDED',
      eventType: 'TenantSuspended',
      mutation,
    })
    const stores = listRowsByEntityType('store', mutation.sandboxId ?? DEFAULT_SANDBOX_ID).map(toAggregateRow)
      .filter(store => asString(asRecord(store.payload.data).tenant_id) === input.tenantId)

    const cascadedStores = stores.map(store => changeEntityStatus({
      entityType: 'store',
      entityId: store.entityId,
      status: 'SUSPENDED',
      eventType: 'StoreSuspended',
      mutation,
    }))

    return {
      tenant,
      affectedStoreIds: cascadedStores.map(item => item.entityId),
      reason: input.reason ?? null,
    }
  },
)

export const updateBrandMenuReviewStatus = (input: {
  menuId: string
  reviewStatus: 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
  mutation?: MutationInput
}) => getMutationResponse(
  `brand-menu-review:${input.menuId}:${input.reviewStatus}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('brand_menu', input.menuId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    const timestamp = new Date(now()).toISOString()
    return upsertEntity({
      entityType: 'brand_menu',
      entityId: input.menuId,
      title: current.title,
      status: input.reviewStatus === 'PENDING_REVIEW'
        ? 'PENDING_REVIEW'
        : input.reviewStatus === 'APPROVED'
        ? 'APPROVED'
        : input.reviewStatus === 'REJECTED'
        ? 'DRAFT'
        : current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: `BrandMenu${input.reviewStatus}`,
      data: {
        ...currentData,
        review_status: input.reviewStatus,
        status: input.reviewStatus === 'PENDING_REVIEW'
          ? 'PENDING_REVIEW'
          : input.reviewStatus === 'APPROVED'
          ? 'APPROVED'
          : input.reviewStatus === 'REJECTED'
          ? 'DRAFT'
          : asString(currentData.status, current.status),
        submitted_at: input.reviewStatus === 'PENDING_REVIEW' ? timestamp : currentData.submitted_at,
        reviewed_at: input.reviewStatus === 'APPROVED' || input.reviewStatus === 'REJECTED' ? timestamp : currentData.reviewed_at,
        reviewed_by: input.reviewStatus === 'APPROVED' || input.reviewStatus === 'REJECTED' ? input.mutation?.actorId ?? 'mock-admin-operator' : currentData.reviewed_by,
      },
    })
  },
)

export const rollbackStoreMenu = (input: {
  menuId: string
  mutation?: MutationInput
}) => getMutationResponse(
  `rollback-store-menu:${input.menuId}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow('menu_catalog', input.menuId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    return upsertEntity({
      entityType: 'menu_catalog',
      entityId: input.menuId,
      title: current.title,
      status: 'ROLLED_BACK',
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'StoreMenuRolledBack',
      data: {
        ...cloneJson(asRecord(current.payload.data)),
        status: 'ROLLED_BACK',
        rolled_back_at: new Date(now()).toISOString(),
        version_hash: `${asString(asRecord(current.payload.data).version_hash, 'menu-hash')}-rollback-${Date.now()}`,
      },
    })
  },
)

export const upsertMenuAvailability = (input: {
  productId: string
  storeId: string
  available: boolean
  soldOutReason?: string | null
  effectiveFrom?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `menu-availability:${input.storeId}:${input.productId}`,
  input.mutation?.idempotencyKey,
  () => upsertEntity({
    entityType: 'menu_availability',
    entityId: normalizeId(`availability-${input.storeId}-${input.productId}`),
    title: input.productId,
    status: input.available ? 'ACTIVE' : 'SOLD_OUT',
    naturalScopeType: 'STORE',
    naturalScopeKey: input.storeId,
    mutation: defaultMutation(input.mutation),
    eventType: input.available ? 'ProductAvailabilityRestored' : 'ProductSoldOut',
    data: {
      product_id: input.productId,
      store_id: input.storeId,
      available: input.available,
      sold_out_reason: input.soldOutReason ?? null,
      effective_from: input.effectiveFrom ?? new Date(now()).toISOString(),
    },
  }),
)

export const createAvailabilityRule = (input: {
  ruleId?: string
  ruleCode: string
  storeId?: string | null
  productId?: string
  ruleType?: string
  ruleConfig?: Record<string, unknown>
  channelType?: string
  timeSlot?: Record<string, unknown> | null
  dailyQuota?: number | null
  priority?: number
  enabled?: boolean
  available?: boolean
  effectiveFrom?: string | null
  effectiveTo?: string | null
  updatedBy?: string | null
  mutation?: MutationInput
}) => getMutationResponse(
  `availability-rule:${input.storeId ?? 'brand'}:${input.ruleCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const ruleId = input.ruleId ?? normalizeId(`availability-rule-${input.ruleCode}`)
    const ruleType = input.ruleType ?? 'MANUAL'
    const storeId = input.storeId ?? null
    return upsertEntity({
      entityType: 'availability_rule',
      entityId: ruleId,
      title: input.ruleCode,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: storeId ?? 'BRAND',
      mutation: defaultMutation(input.mutation),
      eventType: 'AvailabilityRuleUpserted',
      data: {
        rule_id: ruleId,
        rule_code: input.ruleCode,
        store_id: storeId,
        product_id: input.productId ?? null,
        rule_type: ruleType,
        rule_config: input.ruleConfig ?? defaultRuleConfig({
          ruleType,
          channelType: input.channelType,
          timeSlot: input.timeSlot,
          quota: input.dailyQuota,
        }),
        channel_type: input.channelType ?? null,
        available: asBoolean(input.available, true),
        priority: asNumber(input.priority, ruleType === 'MANUAL' ? 100 : 10),
        enabled: asBoolean(input.enabled, true),
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        updated_by: input.updatedBy ?? null,
        status: 'ACTIVE',
      },
    })
  },
)

export const upsertSaleableStock = (input: {
  stockId: string
  storeId: string
  productId: string
  saleableQuantity: number
  skuId?: string | null
  stockGranularity?: string
  stockType?: string
  stockDate?: string
  periodId?: string | null
  totalQuantity?: number | null
  soldQuantity?: number
  reservedQuantity?: number
  safetyStock?: number
  soldOutThreshold?: number
  reservationTtlSeconds?: number
  resetPolicy?: string
  lastResetAt?: string | null
  ingredientConsumption?: Array<Record<string, unknown>>
  version?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `saleable-stock:${input.storeId}:${input.productId}`,
  input.mutation?.idempotencyKey,
  () => {
    const totalQuantity = input.totalQuantity === undefined ? asNumber(input.saleableQuantity, 0) : input.totalQuantity
    const soldQuantity = asNumber(input.soldQuantity, 0)
    const reservedQuantity = asNumber(input.reservedQuantity, 0)
    const soldOutThreshold = asNumber(input.soldOutThreshold, 0)
    if (totalQuantity !== null && asNumber(totalQuantity, 0) < soldQuantity + reservedQuantity) {
      throw new HttpError(400, 'INVALID_STOCK_QUANTITY', '库存不能小于已售数量和预留数量之和')
    }
    if (totalQuantity !== null && soldOutThreshold > asNumber(totalQuantity, 0)) {
      throw new HttpError(400, 'INVALID_SOLD_OUT_THRESHOLD', '沽清阈值不能大于总库存')
    }
    const availableQuantity = totalQuantity === null ? null : Math.max(0, asNumber(totalQuantity, 0) - soldQuantity - reservedQuantity)
    const stockStatus = totalQuantity !== null && availableQuantity !== null && availableQuantity <= 0
      ? 'SOLD_OUT'
      : totalQuantity !== null && availableQuantity !== null && availableQuantity <= soldOutThreshold
      ? 'LOW_STOCK'
      : 'AVAILABLE'
    return upsertEntity({
      entityType: 'saleable_stock',
      entityId: input.stockId,
      title: input.stockId,
      status: stockStatus,
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'SaleableStockUpserted',
      data: {
        stock_id: input.stockId,
        store_id: input.storeId,
        product_id: input.productId,
        sku_id: input.skuId ?? null,
        stock_granularity: input.stockGranularity ?? (input.skuId ? 'SKU' : 'PRODUCT'),
        stock_type: input.stockType ?? 'TOTAL',
        period_id: input.periodId ?? null,
        stock_date: input.stockDate ?? new Date(now()).toISOString().slice(0, 10),
        total_quantity: totalQuantity,
        sold_quantity: soldQuantity,
        reserved_quantity: reservedQuantity,
        available_quantity: availableQuantity,
        saleable_quantity: availableQuantity ?? totalQuantity,
        safety_stock: asNumber(input.safetyStock, 0),
        sold_out_threshold: soldOutThreshold,
        reservation_ttl_seconds: asNumber(input.reservationTtlSeconds, 300),
        reset_policy: input.resetPolicy ?? 'MANUAL',
        last_reset_at: input.lastResetAt ?? null,
        ingredient_consumption: input.ingredientConsumption ?? [],
        version: asNumber(input.version, 1),
        status: stockStatus,
      },
    })
  },
)

export const applyDemoMasterDataChange = () => {
  const product = requireEntityRow('product', 'product-salmon-bowl')
  const currentData = cloneJson(asRecord(product.payload.data))
  const nextPrice = asNumber(currentData.base_price, 58) + 1
  return upsertEntity({
    entityType: 'product',
    entityId: product.entityId,
    title: `Salmon Bowl ${nextPrice}`,
    status: 'ACTIVE',
    naturalScopeType: product.naturalScopeType,
    naturalScopeKey: product.naturalScopeKey,
    mutation: defaultMutation({}),
    eventType: 'ProductUpserted',
    data: {
      ...currentData,
      product_name: `Salmon Bowl ${nextPrice}`,
      base_price: nextPrice,
      status: 'ACTIVE',
    },
  })
}

export const getLegacyDocumentsView = () => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM master_data_documents
    ORDER BY domain ASC, entity_type ASC, title ASC
  `).all() as Array<{
    doc_id: string
    sandbox_id: string
    domain: string
    entity_type: string
    entity_id: string
    natural_scope_type: string
    natural_scope_key: string
    title: string
    status: string
    source_revision: number
    payload_json: string
    updated_at: number
  }>
  return rows.map(row => ({
    docId: row.doc_id,
    sandboxId: row.sandbox_id,
    domain: row.domain,
    entityType: row.entity_type,
    entityId: row.entity_id,
    naturalScopeType: row.natural_scope_type,
    naturalScopeKey: row.natural_scope_key,
    title: row.title,
    status: row.status,
    sourceRevision: row.source_revision,
    payload: parseJson(row.payload_json, {}),
    updatedAt: row.updated_at,
  }))
}

export const rebuildProjectionOutboxFromAlignedState = (sandboxId = DEFAULT_SANDBOX_ID) => {
  sqlite.prepare(`
    DELETE FROM projection_outbox
    WHERE sandbox_id = ?
  `).run(sandboxId)
  sqlite.prepare(`
    DELETE FROM projection_publish_log
  `).run()

  const entities = sqlite.prepare(`
    SELECT *
    FROM aligned_master_data_entities
    WHERE sandbox_id = ?
    ORDER BY domain ASC, entity_type ASC, entity_id ASC
  `).all(sandboxId) as EntityRow[]

  const queued = entities.flatMap(row => {
    const aggregate = toAggregateRow(row)
    const topic = resolveTopic(aggregate.entityType)
    if (!topic) {
      return []
    }
    enqueueProjectionOutbox({
      sandboxId,
      topicKey: topic.topicKey,
      scopeType: aggregate.naturalScopeType,
      scopeKey: aggregate.naturalScopeKey,
      itemKey: asString(asRecord(aggregate.payload.data)[topic.itemKeyField], aggregate.entityId),
      payload: cloneJson(aggregate.payload),
    })
    appendDeliveryDiagnostic({
      sandboxId,
      topicKey: topic.topicKey,
      scopeType: aggregate.naturalScopeType,
      scopeKey: aggregate.naturalScopeKey,
      itemKey: asString(asRecord(aggregate.payload.data)[topic.itemKeyField], aggregate.entityId),
      status: 'REBUILT_TO_OUTBOX',
      detail: {
        sourceRevision: aggregate.sourceRevision,
      },
    })
    return [{
      entityType: aggregate.entityType,
      entityId: aggregate.entityId,
      topicKey: topic.topicKey,
    }]
  })

  return {
    total: queued.length,
    rebuiltAt: now(),
    items: queued,
  }
}

export const captureTerminalObservationSnapshot = (input: {
  terminalId: string
  source: string
  snapshot: Record<string, unknown>
  sandboxId?: string
}) => {
  recordTerminalObservationSnapshot(input)
  return {
    terminalId: input.terminalId,
    source: input.source,
    capturedAt: now(),
  }
}
