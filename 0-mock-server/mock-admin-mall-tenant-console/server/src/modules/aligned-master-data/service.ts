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
  | 'project'
  | 'tenant'
  | 'brand'
  | 'store'
  | 'contract'
  | 'business_entity'
  | 'table'
  | 'workstation'
  | 'permission'
  | 'role'
  | 'user'
  | 'user_role_binding'
  | 'product_category'
  | 'product'
  | 'brand_menu'
  | 'menu_catalog'
  | 'price_rule'
  | 'bundle_price_rule'
  | 'store_config'
  | 'menu_availability'
  | 'availability_rule'
  | 'saleable_stock'
  | 'stock_reservation'

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

type MutationInput = {
  sandboxId?: string
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

const identity = {
  platformId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PLATFORM_ID?.trim() || 'platform-kernel-base-test',
  projectId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PROJECT_ID?.trim() || 'project-kernel-base-test',
  tenantId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_TENANT_ID?.trim() || 'tenant-kernel-base-test',
  brandId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_BRAND_ID?.trim() || 'brand-kernel-base-test',
  storeId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_STORE_ID?.trim() || 'store-kernel-base-test',
  contractId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_CONTRACT_ID?.trim() || 'contract-kernel-base-test',
} as const

const topicByEntityType: Record<DomainEntity, TopicDefinition | undefined> = {
  sandbox: undefined,
  platform: {topicKey: 'org.platform.profile', projectionKind: 'organization', scopeType: 'PLATFORM', itemKeyField: 'platform_id'},
  project: {topicKey: 'org.project.profile', projectionKind: 'organization', scopeType: 'PROJECT', itemKeyField: 'project_id'},
  tenant: {topicKey: 'org.tenant.profile', projectionKind: 'organization', scopeType: 'TENANT', itemKeyField: 'tenant_id'},
  brand: {topicKey: 'org.brand.profile', projectionKind: 'organization', scopeType: 'BRAND', itemKeyField: 'brand_id'},
  store: {topicKey: 'org.store.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'store_id'},
  contract: {topicKey: 'org.contract.active', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'contract_id'},
  business_entity: {topicKey: 'org.business-entity.profile', projectionKind: 'organization', scopeType: 'TENANT', itemKeyField: 'entity_id'},
  table: {topicKey: 'org.table.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'table_id'},
  workstation: {topicKey: 'org.workstation.profile', projectionKind: 'organization', scopeType: 'STORE', itemKeyField: 'workstation_id'},
  permission: {topicKey: 'iam.permission.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'permission_id'},
  role: {topicKey: 'iam.role.catalog', projectionKind: 'iam', scopeType: 'PLATFORM', itemKeyField: 'role_id'},
  user: {topicKey: 'iam.user.store-effective', projectionKind: 'iam', scopeType: 'STORE', itemKeyField: 'user_id'},
  user_role_binding: {topicKey: 'iam.user-role-binding.store-effective', projectionKind: 'iam', scopeType: 'STORE', itemKeyField: 'binding_id'},
  product_category: undefined,
  product: {topicKey: 'catering.product.profile', projectionKind: 'catering_product', scopeType: 'BRAND', itemKeyField: 'product_id'},
  brand_menu: {topicKey: 'catering.brand-menu.profile', projectionKind: 'catering_product', scopeType: 'BRAND', itemKeyField: 'brand_menu_id'},
  menu_catalog: {topicKey: 'menu.catalog', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'menu_id'},
  price_rule: {topicKey: 'catering.price-rule.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'rule_id'},
  bundle_price_rule: {topicKey: 'catering.bundle-price-rule.profile', projectionKind: 'catering_product', scopeType: 'STORE', itemKeyField: 'rule_id'},
  store_config: {topicKey: 'store.config', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'config_id'},
  menu_availability: {topicKey: 'menu.availability', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'product_id'},
  availability_rule: {topicKey: 'catering.availability-rule.profile', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'rule_id'},
  saleable_stock: {topicKey: 'catering.saleable-stock.profile', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'stock_id'},
  stock_reservation: {topicKey: 'catering.stock-reservation.active', projectionKind: 'catering_store_operation', scopeType: 'STORE', itemKeyField: 'reservation_id'},
}

const entityDomainGroup: Record<DomainEntity, string> = {
  sandbox: 'organization',
  platform: 'organization',
  project: 'organization',
  tenant: 'organization',
  brand: 'organization',
  store: 'organization',
  contract: 'organization',
  business_entity: 'organization',
  table: 'organization',
  workstation: 'organization',
  permission: 'iam',
  role: 'iam',
  user: 'iam',
  user_role_binding: 'iam',
  product_category: 'catering-product',
  product: 'catering-product',
  brand_menu: 'catering-product',
  menu_catalog: 'catering-product',
  price_rule: 'catering-product',
  bundle_price_rule: 'catering-product',
  store_config: 'catering-store-operating',
  menu_availability: 'catering-store-operating',
  availability_rule: 'catering-store-operating',
  saleable_stock: 'catering-store-operating',
  stock_reservation: 'catering-store-operating',
}

const allowedStatuses = new Set([
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'DISABLED',
  'OPEN',
  'PAUSED',
  'SOLD_OUT',
  'REVOKED',
])

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
}) => ({
  schema_version: 1,
  projection_kind: input.projectionKind,
  sandbox_id: input.sandboxId,
  platform_id: identity.platformId,
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
        identity.platformId,
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

  if (typeof input.mutation.expectedRevision === 'number' && currentAggregate && currentAggregate.sourceRevision !== input.mutation.expectedRevision) {
    throw new HttpError(409, 'STALE_REVISION', `${input.entityType} revision mismatch`, {
      expectedRevision: input.mutation.expectedRevision,
      actualRevision: currentAggregate.sourceRevision,
    })
  }

  const nextRevision = (currentAggregate?.sourceRevision ?? 0) + 1
  const aggregateId = currentAggregate?.aggregateId ?? createId('agg')
  const eventId = createId('evt')
  const payload = createEnvelope({
    projectionKind: resolveTopic(input.entityType)?.projectionKind ?? 'organization',
    sourceEventId: eventId,
    sourceRevision: nextRevision,
    data: input.data,
    sandboxId,
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
    input.status,
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
    platformId: identity.platformId,
    occurredAt: timestamp,
    actorType: input.mutation.actorType ?? 'ADMIN_API',
    actorId: input.mutation.actorId ?? 'mock-admin-operator',
    payload,
    sourceRevision: nextRevision,
  })

  const topic = resolveTopic(input.entityType)
  if (topic) {
    enqueueProjectionOutbox({
      topicKey: topic.topicKey,
      scopeType: input.naturalScopeType,
      scopeKey: input.naturalScopeKey,
      itemKey: asString(input.data[topic.itemKeyField], input.entityId),
      payload,
      targetTerminalIds: input.mutation.targetTerminalIds,
    })
    appendDeliveryDiagnostic({
      sandboxId,
      topicKey: topic.topicKey,
      scopeType: input.naturalScopeType,
      scopeKey: input.naturalScopeKey,
      itemKey: asString(input.data[topic.itemKeyField], input.entityId),
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

const listEntity = (entityType: DomainEntity, pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  paginateItems(listRowsByEntityType(entityType, sandboxId).map(toAggregateRow), pagination)

const listEntityByScope = (
  entityType: DomainEntity,
  scopeType: string,
  scopeKey: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) =>
  paginateItems(
    listRowsByEntityType(entityType, sandboxId)
      .map(toAggregateRow)
      .filter(item => item.naturalScopeType === scopeType && item.naturalScopeKey === scopeKey),
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

const resolveEntityId = (prefix: string, requestedId: unknown, fallbackSeed: string) => {
  const explicitId = asOptionalString(requestedId)
  return explicitId ?? normalizeId(`${prefix}-${fallbackSeed}`)
}

const readEntityData = (entityType: DomainEntity, entityId: string, sandboxId = DEFAULT_SANDBOX_ID) =>
  cloneJson(asRecord(requireEntityRow(entityType, entityId, sandboxId).payload.data))

const createProjectRegion = (value: unknown) => {
  const region = asRecord(value)
  return {
    region_code: asString(region.region_code, 'CN-SZ'),
    region_name: asString(region.region_name, 'Shenzhen'),
    parent_region_code: asOptionalString(region.parent_region_code) ?? 'CN-GD',
    region_level: asNumber(region.region_level, 2),
  }
}

export const initializeAlignedMasterData = () => {
  ensureSchema()
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM aligned_master_data_entities').get() as {count: number}
  if (row.count > 0) {
    repairKnownSeedInconsistencies()
    return
  }

  if (seedAlignedStateFromMasterDocuments()) {
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
  createProject({
    projectCode: 'PROJECT_KERNEL_BASE_TEST',
    projectName: 'Kernel Base Test Project',
    region: {
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
    tenantId: identity.tenantId,
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
    permissionCode: 'PRODUCT_MANAGE',
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
      {section_id: 'section-signature', section_name: 'Signature Bowls', display_order: 10},
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
    saleableQuantity: 26,
    safetyStock: 4,
    mutation: seedMutation,
  })
  upsertStockReservation({
    reservationId: 'reservation-salmon-bowl-001',
    storeId: identity.storeId,
    productId: 'product-salmon-bowl',
    reservedQuantity: 2,
    reservationStatus: 'ACTIVE',
    expiresAt: '2026-04-23T19:00:00.000Z',
    mutation: seedMutation,
  })
}

const repairKnownSeedInconsistencies = () => {
  const binding = getEntityRow('user_role_binding', 'binding-linmei-manager')
  if (!binding) {
    return
  }
  const aggregate = toAggregateRow(binding)
  const data = cloneJson(asRecord(aggregate.payload.data))
  if (asString(data.user_id) !== 'user-lin-mei') {
    return
  }
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

export const listSandboxes = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('sandbox', pagination, sandboxId)

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
  listEntity('store', pagination, sandboxId)

export const listContracts = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('contract', pagination, sandboxId)

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

export const listRoles = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('role', pagination, sandboxId)

export const listUserRoleBindings = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
  listEntity('user_role_binding', pagination, sandboxId)

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

const bindingMatchesStore = (binding: AggregateRow, storeId: string) => {
  const data = readAggregateData(binding)
  const scopeSelector = asRecord(data.scope_selector)
  return asOptionalString(data.store_id) === storeId
    || (asOptionalString(scopeSelector.scope_type) === 'ORG_NODE' && asOptionalString(scopeSelector.scope_key) === storeId)
    || (asOptionalString(scopeSelector.org_node_id) === storeId)
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
    ? listRowsByEntityType('user_role_binding', sandboxId)
      .map(toAggregateRow)
      .filter(binding => {
        const data = readAggregateData(binding)
        return binding.status === 'ACTIVE'
          && asOptionalString(data.user_id) === input.userId
          && bindingMatchesStore(binding, input.storeId)
      })
    : []

  const roleMap = new Map<string, NonNullable<ReturnType<typeof toRoleSummary>>>()
  const permissionMap = new Map<string, NonNullable<ReturnType<typeof toPermissionSummary>>>()
  const bindingSummaries = bindings.map(binding => {
    const data = readAggregateData(binding)
    const role = findAggregateRow('role', asOptionalString(data.role_id), sandboxId)
    const roleSummary = role?.status === 'ACTIVE' ? toRoleSummary(role) : null
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
      userId: input.userId,
      roleId: asOptionalString(data.role_id) ?? null,
      storeId: asOptionalString(data.store_id) ?? input.storeId,
      scopeSelector: asRecord(data.scope_selector),
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
  const storeBindings = listRowsByEntityType('user_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(binding => {
      if (binding.status !== 'ACTIVE' || !bindingMatchesStore(binding, input.storeId)) {
        return false
      }
      const user = findAggregateRow('user', asOptionalString(readAggregateData(binding).user_id), sandboxId)
      return user?.status === 'ACTIVE'
    })
  const userIds = Array.from(new Set(storeBindings
    .map(binding => asOptionalString(readAggregateData(binding).user_id))
    .filter((userId): userId is string => Boolean(userId))))

  return {
    storeId: input.storeId,
    users: userIds.map(userId => getUserEffectivePermissions({userId, storeId: input.storeId, sandboxId})),
    bindingIds: storeBindings.map(binding => binding.entityId),
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

export const listMenuAvailabilityByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('menu_availability', 'STORE', storeId, pagination, sandboxId)

export const listPriceRulesByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('price_rule', 'STORE', storeId, pagination, sandboxId)

export const listStockReservationsByStore = (
  storeId: string,
  pagination: PaginationQuery,
  sandboxId = DEFAULT_SANDBOX_ID,
) => listEntityByScope('stock_reservation', 'STORE', storeId, pagination, sandboxId)

export const listAuditEvents = (pagination: PaginationQuery, sandboxId = DEFAULT_SANDBOX_ID) =>
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
}) => {
  const sandboxId = input.sandboxId ?? DEFAULT_SANDBOX_ID
  const userId = asOptionalString(input.userId) ?? null
  const storeId = asOptionalString(input.storeId) ?? null
  const permissionId = asOptionalString(input.permissionId)
  const permissionCode = asOptionalString(input.permissionCode)

  if (!userId || !storeId) {
    return {
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
    }
  }

  const permissions = listRowsByEntityType('permission', sandboxId).map(toAggregateRow)
  const resolvedPermission = permissionId
    ? permissions.find(item => item.entityId === permissionId)
    : permissions.find(item => asString(asRecord(item.payload.data).permission_code) === permissionCode)

  if (!resolvedPermission) {
    return {
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
    }
  }

  const resolvedPermissionId = asString(asRecord(resolvedPermission.payload.data).permission_id, resolvedPermission.entityId)
  const resolvedPermissionCode = asOptionalString(asRecord(resolvedPermission.payload.data).permission_code) ?? null
  const resolvedPermissionName = asOptionalString(asRecord(resolvedPermission.payload.data).permission_name) ?? null

  const user = findAggregateRow('user', userId, sandboxId)
  if (!user || user.status !== 'ACTIVE') {
    return {
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
    }
  }

  const bindings = listRowsByEntityType('user_role_binding', sandboxId)
    .map(toAggregateRow)
    .filter(item => item.status === 'ACTIVE')
    .filter(item => asString(asRecord(item.payload.data).user_id) === userId)
    .filter(item => asString(asRecord(item.payload.data).store_id) === storeId)

  const bindingIdsConsidered = bindings.map(item => item.entityId)
  const roleIdsConsidered = bindings.map(item => asString(asRecord(item.payload.data).role_id)).filter(Boolean)

  const rolesById = new Map(
    listRowsByEntityType('role', sandboxId)
      .map(toAggregateRow)
      .map(item => [item.entityId, item]),
  )

  const matchedBindingIds: string[] = []
  const matchedRoleIds: string[] = []

  bindings.forEach(binding => {
    const bindingData = asRecord(binding.payload.data)
    const roleId = asString(bindingData.role_id, '')
    const role = rolesById.get(roleId)
    if (!role || role.status !== 'ACTIVE') {
      return
    }
    const roleData = asRecord(role.payload.data)
    const permissionIds = Array.isArray(roleData.permission_ids)
      ? roleData.permission_ids.map(item => asString(item, '')).filter(Boolean)
      : []
    if (permissionIds.includes(resolvedPermissionId)) {
      matchedBindingIds.push(binding.entityId)
      matchedRoleIds.push(role.entityId)
    }
  })

  return {
    allowed: matchedBindingIds.length > 0,
    userId,
    storeId,
    permissionId: resolvedPermissionId,
    permissionCode: resolvedPermissionCode,
    permissionName: resolvedPermissionName,
    matchedBindingIds,
    matchedRoleIds,
    bindingIdsConsidered,
    roleIdsConsidered,
    reason: matchedBindingIds.length > 0 ? 'ROLE_PERMISSION_MATCH' : 'NO_MATCHING_ROLE_PERMISSION',
    decisionSource: 'mock-admin-mall-tenant-console',
  }
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
        children: tenants
          .map(tenant => {
            const tenantBrands = brands
              .filter(brand => asString(asRecord(brand.payload.data).tenant_id) === tenant.entityId)
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
                  children: brandStores.map(store => ({
                    id: store.entityId,
                    type: 'store',
                    title: store.title,
                    status: store.status,
                    children: [],
                  })),
                }
              })
              .filter(Boolean)

            if (tenantBrands.length === 0) {
              return null
            }

            return {
              id: tenant.entityId,
              type: 'tenant',
              title: tenant.title,
              status: tenant.status,
              children: tenantBrands,
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
        description: input.description ?? null,
        owner: input.owner ?? 'mock-admin-operator',
        status: 'ACTIVE',
      },
    })
  },
)

export const createPlatform = (input: {
  platformId?: string
  platformCode: string
  platformName: string
  description?: string
  contactName?: string
  contactPhone?: string
  isvConfig?: {
    providerType?: string
    appKey?: string | null
    appSecret?: string | null
    isvToken?: string | null
    tokenExpireAt?: string | null
    channelStatus?: string | null
  }
  mutation?: MutationInput
}) => getMutationResponse(
  `create-platform:${input.platformCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const platformId = resolveEntityId('platform', input.platformId, input.platformCode)
    return upsertEntity({
      entityType: 'platform',
      entityId: platformId,
      title: input.platformName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PlatformUpserted',
      data: {
        platform_id: platformId,
        platform_code: input.platformCode,
        platform_name: input.platformName,
        description: input.description ?? null,
        contact_name: input.contactName ?? 'Local Mall Operator',
        contact_phone: input.contactPhone ?? '400-800-0000',
        isv_config: buildMaskedIsvCredential(input.isvConfig ?? {}),
        status: 'ACTIVE',
      },
    })
  },
)

export const createProject = (input: {
  projectId?: string
  projectCode: string
  projectName: string
  platformId?: string
  timezone?: string
  region?: Record<string, unknown>
  address?: string
  businessMode?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-project:${input.projectCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const projectId = resolveEntityId('project', input.projectId, input.projectCode)
    const platformId = asString(input.platformId, identity.platformId)
    return upsertEntity({
      entityType: 'project',
      entityId: projectId,
      title: input.projectName,
      status: 'ACTIVE',
      naturalScopeType: 'PROJECT',
      naturalScopeKey: projectId,
      mutation: defaultMutation(input.mutation),
      eventType: 'ProjectUpserted',
      data: {
        project_id: projectId,
        project_code: input.projectCode,
        project_name: input.projectName,
        platform_id: platformId,
        timezone: input.timezone ?? 'Asia/Shanghai',
        region: createProjectRegion(input.region),
        address: input.address ?? 'Shenzhen Nanshan District',
        business_mode: input.businessMode ?? 'SHOPPING_MALL',
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
  mutation?: MutationInput
}) => getMutationResponse(
  `create-tenant:${input.tenantCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const tenantId = resolveEntityId('tenant', input.tenantId, input.tenantCode)
    return upsertEntity({
      entityType: 'tenant',
      entityId: tenantId,
      title: input.tenantName,
      status: 'ACTIVE',
      naturalScopeType: 'TENANT',
      naturalScopeKey: tenantId,
      mutation: defaultMutation(input.mutation),
      eventType: 'TenantUpserted',
      data: {
        tenant_id: tenantId,
        tenant_code: input.tenantCode,
        tenant_name: input.tenantName,
        platform_id: asString(input.platformId, identity.platformId),
        status: 'ACTIVE',
      },
    })
  },
)

export const createBrand = (input: {
  brandId?: string
  brandCode: string
  brandName: string
  tenantId: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-brand:${input.tenantId}:${input.brandCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const brandId = resolveEntityId('brand', input.brandId, `${input.tenantId}-${input.brandCode}`)
    return upsertEntity({
      entityType: 'brand',
      entityId: brandId,
      title: input.brandName,
      status: 'ACTIVE',
      naturalScopeType: 'BRAND',
      naturalScopeKey: brandId,
      mutation: defaultMutation(input.mutation),
      eventType: 'BrandUpserted',
      data: {
        brand_id: brandId,
        brand_code: input.brandCode,
        brand_name: input.brandName,
        tenant_id: input.tenantId,
        platform_id: identity.platformId,
        status: 'ACTIVE',
      },
    })
  },
)

export const createBusinessEntity = (input: {
  entityId?: string
  entityCode: string
  entityName: string
  tenantId: string
  mutation?: MutationInput
}) => getMutationResponse(
  'create-business-entity',
  input.mutation?.idempotencyKey,
  () => {
    const entityId = input.entityId ?? normalizeId(`entity-${input.entityCode}`)
    return upsertEntity({
      entityType: 'business_entity',
      entityId,
      title: input.entityName,
      status: 'ACTIVE',
      naturalScopeType: 'TENANT',
      naturalScopeKey: input.tenantId,
      mutation: defaultMutation(input.mutation),
      eventType: 'BusinessEntityUpserted',
      data: {
        entity_id: entityId,
        entity_code: input.entityCode,
        entity_name: input.entityName,
        tenant_id: input.tenantId,
        platform_id: identity.platformId,
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
  projectId: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-store:${input.projectId}:${input.storeCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const storeId = resolveEntityId('store', input.storeId, `${input.projectId}-${input.storeCode}`)
    return upsertEntity({
      entityType: 'store',
      entityId: storeId,
      title: input.storeName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'StoreUpserted',
      data: {
        store_id: storeId,
        store_code: input.storeCode,
        store_name: input.storeName,
        unit_code: input.unitCode,
        platform_id: identity.platformId,
        project_id: input.projectId,
        active_contract_id: null,
        tenant_id: null,
        brand_id: null,
        entity_id: null,
        status: 'ACTIVE',
      },
    })
  },
)

export const createContract = (input: {
  contractId?: string
  contractCode: string
  storeId: string
  tenantId: string
  brandId: string
  entityId: string
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
    const contractId = resolveEntityId('contract', input.contractId, `${input.storeId}-${input.contractCode}`)
    return upsertEntity({
      entityType: 'contract',
      entityId: contractId,
      title: input.contractCode,
      status: 'DRAFT',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'ContractDraftCreated',
      data: {
        contract_id: contractId,
        contract_code: input.contractCode,
        platform_id: identity.platformId,
        project_id: asString(readEntityData('store', input.storeId).project_id, identity.projectId),
        tenant_id: input.tenantId,
        brand_id: input.brandId,
        store_id: input.storeId,
        entity_id: input.entityId,
        unit_code: asString(readEntityData('store', input.storeId).unit_code, 'KB001'),
        start_date: input.startDate,
        end_date: input.endDate,
        commission_type: input.commissionType ?? 'FIXED_RATE',
        commission_rate: asNumber(input.commissionRate, 0),
        deposit_amount: asNumber(input.depositAmount, 0),
        attachment_url: input.attachmentUrl ?? null,
        status: 'DRAFT',
      },
    })
  },
)

export const createTableEntity = (input: {
  tableId?: string
  storeId: string
  tableNo: string
  capacity?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-table:${input.storeId}:${input.tableNo}`,
  input.mutation?.idempotencyKey,
  () => {
    const tableId = input.tableId ?? normalizeId(`table-${input.storeId}-${input.tableNo}`)
    return upsertEntity({
      entityType: 'table',
      entityId: tableId,
      title: `Table ${input.tableNo}`,
      status: 'AVAILABLE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'TableUpserted',
      data: {
        table_id: tableId,
        store_id: input.storeId,
        table_no: input.tableNo,
        capacity: asNumber(input.capacity, 4),
        table_status: 'AVAILABLE',
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
  mutation?: MutationInput
}) => getMutationResponse(
  `create-workstation:${input.storeId}:${input.workstationCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const workstationId = input.workstationId ?? normalizeId(`workstation-${input.storeId}-${input.workstationCode}`)
    return upsertEntity({
      entityType: 'workstation',
      entityId: workstationId,
      title: input.workstationName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'WorkstationUpserted',
      data: {
        workstation_id: workstationId,
        store_id: input.storeId,
        workstation_code: input.workstationCode,
        workstation_name: input.workstationName,
        category_codes: input.categoryCodes ?? [],
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
  mutation?: MutationInput
}) => getMutationResponse(
  `create-permission:${input.permissionCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const permissionId = input.permissionId ?? normalizeId(`perm-${input.permissionCode}`)
    return upsertEntity({
      entityType: 'permission',
      entityId: permissionId,
      title: input.permissionName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: identity.platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PermissionUpserted',
      data: {
        permission_id: permissionId,
        permission_code: input.permissionCode,
        permission_name: input.permissionName,
        permission_type: input.permissionType ?? 'SYSTEM',
        status: 'ACTIVE',
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
  mutation?: MutationInput
}) => getMutationResponse(
  `create-role:${input.roleCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const roleId = input.roleId ?? normalizeId(`role-${input.roleCode}`)
    return upsertEntity({
      entityType: 'role',
      entityId: roleId,
      title: input.roleName,
      status: 'ACTIVE',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: identity.platformId,
      mutation: defaultMutation(input.mutation),
      eventType: 'RoleUpserted',
      data: {
        role_id: roleId,
        role_code: input.roleCode,
        role_name: input.roleName,
        scope_type: input.scopeType,
        permission_ids: input.permissionIds ?? [],
        status: 'ACTIVE',
      },
    })
  },
)

export const createUser = (input: {
  userId?: string
  userCode: string
  displayName: string
  mobile?: string
  storeId: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-user:${input.userCode}:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const userId = input.userId ?? normalizeId(`user-${input.userCode}`)
    return upsertEntity({
      entityType: 'user',
      entityId: userId,
      title: input.displayName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'UserUpserted',
      data: {
        user_id: userId,
        user_code: input.userCode,
        display_name: input.displayName,
        mobile: input.mobile ?? null,
        store_id: input.storeId,
        status: 'ACTIVE',
      },
    })
  },
)

export const createUserRoleBinding = (input: {
  bindingId?: string
  userId: string
  roleId: string
  storeId: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-user-role-binding:${input.userId}:${input.roleId}:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const bindingId = input.bindingId ?? normalizeId(`binding-${input.userId}-${input.roleId}`)
    return upsertEntity({
      entityType: 'user_role_binding',
      entityId: bindingId,
      title: `${input.userId}:${input.roleId}`,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'UserRoleBindingGranted',
      data: {
        binding_id: bindingId,
        user_id: input.userId,
        role_id: input.roleId,
        store_id: input.storeId,
        scope_selector: {
          scope_type: 'ORG_NODE',
          scope_key: input.storeId,
          org_node_id: input.storeId,
        },
        policy_effect: 'ALLOW',
        effective_from: new Date(now()).toISOString(),
        effective_to: null,
        status: 'ACTIVE',
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
    const current = requireEntityRow('user_role_binding', input.bindingId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    return upsertEntity({
      entityType: 'user_role_binding',
      entityId: input.bindingId,
      title: current.title,
      status: 'REVOKED',
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'UserRoleBindingRevoked',
      data: {
        ...currentData,
        status: 'REVOKED',
        effective_to: new Date(now()).toISOString(),
        revoke_reason: input.reason ?? null,
      },
    })
  },
)

export const createProduct = (input: {
  productId?: string
  productName: string
  ownershipScope: 'BRAND' | 'STORE'
  brandId?: string
  storeId?: string
  productType?: string
  basePrice?: number
  productionSteps?: Array<Record<string, unknown>>
  modifierGroups?: Array<Record<string, unknown>>
  variants?: Array<Record<string, unknown>>
  comboItemGroups?: Array<Record<string, unknown>>
  mutation?: MutationInput
}) => getMutationResponse(
  `create-product:${input.productName}:${input.ownershipScope}:${input.brandId ?? input.storeId ?? ''}`,
  input.mutation?.idempotencyKey,
  () => {
    const productId = input.productId ?? normalizeId(`product-${input.productName}`)
    const scopeType = input.ownershipScope === 'STORE' ? 'STORE' : 'BRAND'
    const scopeKey = input.ownershipScope === 'STORE'
      ? asString(input.storeId, identity.storeId)
      : asString(input.brandId, identity.brandId)
    return upsertEntity({
      entityType: 'product',
      entityId: productId,
      title: input.productName,
      status: 'ACTIVE',
      naturalScopeType: scopeType,
      naturalScopeKey: scopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'ProductUpserted',
      data: {
        product_id: productId,
        brand_id: input.brandId ?? null,
        store_id: input.storeId ?? null,
        product_name: input.productName,
        ownership_scope: input.ownershipScope,
        product_type: input.productType ?? 'STANDARD',
        base_price: asNumber(input.basePrice, 0),
        production_steps: input.productionSteps ?? [],
        modifier_groups: input.modifierGroups ?? [],
        variants: input.variants ?? [],
        combo_item_groups: input.comboItemGroups ?? [],
        status: 'ACTIVE',
      },
    })
  },
)

export const createBrandMenu = (input: {
  brandMenuId?: string
  brandId: string
  menuName: string
  sections?: Array<Record<string, unknown>>
  reviewStatus?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-brand-menu:${input.brandId}:${input.menuName}`,
  input.mutation?.idempotencyKey,
  () => {
    const brandMenuId = input.brandMenuId ?? normalizeId(`brand-menu-${input.menuName}`)
    return upsertEntity({
      entityType: 'brand_menu',
      entityId: brandMenuId,
      title: input.menuName,
      status: 'ACTIVE',
      naturalScopeType: 'BRAND',
      naturalScopeKey: input.brandId,
      mutation: defaultMutation(input.mutation),
      eventType: 'BrandMenuUpserted',
      data: {
        brand_menu_id: brandMenuId,
        brand_id: input.brandId,
        menu_name: input.menuName,
        review_status: input.reviewStatus ?? 'NONE',
        status: 'ACTIVE',
        sections: input.sections ?? [],
      },
    })
  },
)

export const createStoreMenu = (input: {
  menuId?: string
  storeId: string
  menuName: string
  sections?: Array<Record<string, unknown>>
  versionHash?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `create-store-menu:${input.storeId}:${input.menuName}`,
  input.mutation?.idempotencyKey,
  () => {
    const menuId = input.menuId ?? normalizeId(`menu-${input.storeId}-${input.menuName}`)
    return upsertEntity({
      entityType: 'menu_catalog',
      entityId: menuId,
      title: input.menuName,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'StoreMenuPublished',
      data: {
        menu_id: menuId,
        store_id: input.storeId,
        menu_name: input.menuName,
        sections: input.sections ?? [],
        version_hash: input.versionHash ?? createId('menu-hash'),
      },
    })
  },
)

export const createPriceRule = (input: {
  ruleId?: string
  ruleCode: string
  productId: string
  storeId: string
  priceType?: string
  channelType?: string
  priceDelta?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `create-price-rule:${input.ruleCode}:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const ruleId = input.ruleId ?? normalizeId(`price-rule-${input.ruleCode}`)
    return upsertEntity({
      entityType: 'price_rule',
      entityId: ruleId,
      title: input.ruleCode,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'PriceRuleUpserted',
      data: {
        rule_id: ruleId,
        rule_code: input.ruleCode,
        product_id: input.productId,
        store_id: input.storeId,
        price_type: input.priceType ?? 'STANDARD',
        channel_type: input.channelType ?? 'POS',
        price_delta: asNumber(input.priceDelta, 0),
      },
    })
  },
)

export const createStoreConfig = (input: {
  configId?: string
  storeId: string
  businessStatus?: string
  acceptOrder?: boolean
  operatingHours?: Array<Record<string, unknown>>
  extraChargeRules?: Array<Record<string, unknown>>
  mutation?: MutationInput
}) => getMutationResponse(
  `upsert-store-config:${input.storeId}`,
  input.mutation?.idempotencyKey,
  () => {
    const configId = input.configId ?? normalizeId(`store-config-${input.storeId}`)
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
        accept_order: asBoolean(input.acceptOrder, true),
        operating_hours: input.operatingHours ?? [],
        extra_charge_rules: input.extraChargeRules ?? [],
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
    const contractData = cloneJson(asRecord(contract.payload.data))
    const storeId = asString(contractData.store_id)
    const store = requireEntityRow('store', storeId, mutation.sandboxId)
    const storeData = cloneJson(asRecord(store.payload.data))
    const previousContractId = asOptionalString(storeData.active_contract_id)

    if (previousContractId && previousContractId !== input.contractId) {
      const previousContract = requireEntityRow('contract', previousContractId, mutation.sandboxId)
      const previousData = cloneJson(asRecord(previousContract.payload.data))
      if (previousContract.status === 'ACTIVE') {
        upsertEntity({
          entityType: 'contract',
          entityId: previousContractId,
          title: previousContract.title,
          status: 'INACTIVE',
          naturalScopeType: previousContract.naturalScopeType,
          naturalScopeKey: previousContract.naturalScopeKey,
          mutation,
          eventType: 'ContractTerminated',
          data: {
            ...previousData,
            status: 'INACTIVE',
            terminated_at: new Date(now()).toISOString(),
            termination_reason: 'REPLACED_BY_NEW_ACTIVE_CONTRACT',
          },
        })
      }
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
    storeData.tenant_id = asString(contractData.tenant_id, null as unknown as string)
    storeData.brand_id = asString(contractData.brand_id, null as unknown as string)
    storeData.entity_id = asString(contractData.entity_id, null as unknown as string)
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
    if (contract.status === 'INACTIVE') {
      return contract
    }
    const contractData = cloneJson(asRecord(contract.payload.data))
    const nextContract = upsertEntity({
      entityType: 'contract',
      entityId: input.contractId,
      title: contract.title,
      status: 'INACTIVE',
      naturalScopeType: contract.naturalScopeType,
      naturalScopeKey: contract.naturalScopeKey,
      mutation,
      eventType: 'ContractTerminated',
      data: {
        ...contractData,
        status: 'INACTIVE',
        terminated_at: new Date(now()).toISOString(),
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
    const current = requireEntityRow('contract', input.contractId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const currentData = cloneJson(asRecord(current.payload.data))
    const newContract = createContract({
      contractCode: `${asString(currentData.contract_code, current.title)}-renew`,
      storeId: asString(currentData.store_id),
      tenantId: asString(currentData.tenant_id),
      brandId: asString(currentData.brand_id),
      entityId: asString(currentData.entity_id),
      startDate: asString(currentData.end_date, input.newEndDate),
      endDate: input.newEndDate,
      commissionType: asString(currentData.commission_type, 'FIXED_RATE'),
      commissionRate: asNumber(input.commissionRate, asNumber(currentData.commission_rate, 0)),
      depositAmount: asNumber(currentData.deposit_amount, 0),
      attachmentUrl: asOptionalString(currentData.attachment_url) ?? null,
      mutation: input.mutation,
    })
    const activated = activateContract({
      contractId: newContract.entityId,
      remark: input.remark ?? 'contract renewed',
      mutation: input.mutation,
    })
    return {
      newContractId: activated.entityId,
      originalContractId: input.contractId,
      newEndDate: input.newEndDate,
      status: activated.status,
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
  `${input.entityType}:${input.entityId}:${sanitizeStatus(input.status)}`,
  input.mutation?.idempotencyKey,
  () => {
    const current = requireEntityRow(input.entityType, input.entityId, input.mutation?.sandboxId ?? DEFAULT_SANDBOX_ID)
    const nextStatus = sanitizeStatus(input.status)
    if (current.status === nextStatus) {
      return current
    }
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
    return upsertEntity({
      entityType: 'brand_menu',
      entityId: input.menuId,
      title: current.title,
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: `BrandMenu${input.reviewStatus}`,
      data: {
        ...cloneJson(asRecord(current.payload.data)),
        review_status: input.reviewStatus,
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
      status: current.status,
      naturalScopeType: current.naturalScopeType,
      naturalScopeKey: current.naturalScopeKey,
      mutation: defaultMutation(input.mutation),
      eventType: 'StoreMenuRolledBack',
      data: {
        ...cloneJson(asRecord(current.payload.data)),
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
  storeId: string
  productId?: string
  channelType?: string
  available?: boolean
  mutation?: MutationInput
}) => getMutationResponse(
  `availability-rule:${input.storeId}:${input.ruleCode}`,
  input.mutation?.idempotencyKey,
  () => {
    const ruleId = input.ruleId ?? normalizeId(`availability-rule-${input.ruleCode}`)
    return upsertEntity({
      entityType: 'availability_rule',
      entityId: ruleId,
      title: input.ruleCode,
      status: 'ACTIVE',
      naturalScopeType: 'STORE',
      naturalScopeKey: input.storeId,
      mutation: defaultMutation(input.mutation),
      eventType: 'AvailabilityRuleUpserted',
      data: {
        rule_id: ruleId,
        rule_code: input.ruleCode,
        store_id: input.storeId,
        product_id: input.productId ?? null,
        channel_type: input.channelType ?? null,
        available: asBoolean(input.available, true),
      },
    })
  },
)

export const upsertSaleableStock = (input: {
  stockId: string
  storeId: string
  productId: string
  saleableQuantity: number
  safetyStock?: number
  mutation?: MutationInput
}) => getMutationResponse(
  `saleable-stock:${input.storeId}:${input.productId}`,
  input.mutation?.idempotencyKey,
  () => upsertEntity({
    entityType: 'saleable_stock',
    entityId: input.stockId,
    title: input.stockId,
    status: 'ACTIVE',
    naturalScopeType: 'STORE',
    naturalScopeKey: input.storeId,
    mutation: defaultMutation(input.mutation),
    eventType: 'SaleableStockUpserted',
    data: {
      stock_id: input.stockId,
      store_id: input.storeId,
      product_id: input.productId,
      saleable_quantity: asNumber(input.saleableQuantity, 0),
      safety_stock: asNumber(input.safetyStock, 0),
      status: 'ACTIVE',
    },
  }),
)

export const upsertStockReservation = (input: {
  reservationId: string
  storeId: string
  productId: string
  reservedQuantity: number
  reservationStatus?: string
  expiresAt?: string
  mutation?: MutationInput
}) => getMutationResponse(
  `stock-reservation:${input.reservationId}`,
  input.mutation?.idempotencyKey,
  () => upsertEntity({
    entityType: 'stock_reservation',
    entityId: input.reservationId,
    title: input.reservationId,
    status: sanitizeStatus(input.reservationStatus, 'ACTIVE'),
    naturalScopeType: 'STORE',
    naturalScopeKey: input.storeId,
    mutation: defaultMutation(input.mutation),
    eventType: 'StockReservationUpserted',
    data: {
      reservation_id: input.reservationId,
      store_id: input.storeId,
      product_id: input.productId,
      reserved_quantity: asNumber(input.reservedQuantity, 0),
      reservation_status: sanitizeStatus(input.reservationStatus, 'ACTIVE'),
      expires_at: input.expiresAt ?? null,
    },
  }),
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
