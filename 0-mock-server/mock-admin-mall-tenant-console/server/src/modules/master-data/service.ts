import {enqueueProjectionOutbox, sqlite} from '../../database/index.js'
import {DEFAULT_SOURCE_SERVICE} from '../../shared/constants.js'
import {createId, now, parseJson, serializeJson} from '../../shared/utils.js'

export interface MasterDataDocument {
  docId: string
  sandboxId: string
  domain: string
  entityType: string
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

export interface UpdateMasterDataDocumentInput {
  title?: string
  status?: string
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
  targetTerminalIds?: string[]
}

const toDocument = (row: {
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
}): MasterDataDocument => ({
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const listMasterDataDocuments = (input: {
  domain?: string
  entityType?: string
}) => {
  const rows = sqlite.prepare(`
    SELECT *
    FROM master_data_documents
    WHERE (? IS NULL OR domain = ?)
      AND (? IS NULL OR entity_type = ?)
    ORDER BY domain ASC, entity_type ASC, natural_scope_type ASC, title ASC
  `).all(
    input.domain ?? null,
    input.domain ?? null,
    input.entityType ?? null,
    input.entityType ?? null,
  ) as Parameters<typeof toDocument>[0][]

  return rows.map(toDocument)
}

const getDocumentRow = (docId: string) => sqlite.prepare(`
  SELECT *
  FROM master_data_documents
  WHERE doc_id = ?
  LIMIT 1
`).get(docId) as Parameters<typeof toDocument>[0] | undefined

const requireDocument = (docId: string) => {
  const row = getDocumentRow(docId)
  if (!row) {
    throw new Error(`master data document not found: ${docId}`)
  }
  return toDocument(row)
}

const topicKeyByDomainEntityType: Record<string, string> = {
  'organization:platform': 'org.platform.profile',
  'organization:project': 'org.project.profile',
  'organization:tenant': 'org.tenant.profile',
  'organization:brand': 'org.brand.profile',
  'organization:store': 'org.store.profile',
  'organization:contract': 'org.contract.active',
  'iam:role': 'iam.role.catalog',
  'iam:permission': 'iam.permission.catalog',
  'iam:user': 'iam.user.store-effective',
  'iam:user_role_binding': 'iam.user-role-binding.store-effective',
  'catering-product:product': 'catering.product.profile',
  'catering-product:brand_menu': 'catering.brand-menu.profile',
  'catering-product:menu_catalog': 'menu.catalog',
  'catering-store-operating:menu_availability': 'menu.availability',
  'catering-store-operating:saleable_stock': 'catering.saleable-stock.profile',
}

const resolveTopicKey = (document: Pick<MasterDataDocument, 'domain' | 'entityType'>) => {
  const topicKey = topicKeyByDomainEntityType[`${document.domain}:${document.entityType}`]
  if (!topicKey) {
    throw new Error(`unsupported master data document topic mapping: ${document.domain}:${document.entityType}`)
  }
  return topicKey
}

const patchEnvelope = (input: {
  currentPayload: Record<string, unknown>
  sourceRevision: number
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
}) => {
  const sourceEventId = createId('evt')
  const sourceRevision = input.sourceRevision
  const currentData = typeof input.currentPayload.data === 'object' && input.currentPayload.data !== null
    ? input.currentPayload.data as Record<string, unknown>
    : {}
  const patchPayload = input.payload ?? {}
  const patchData = input.data ?? {}

  return {
    ...input.currentPayload,
    ...patchPayload,
    source_service: DEFAULT_SOURCE_SERVICE,
    source_event_id: sourceEventId,
    source_revision: sourceRevision,
    generated_at: new Date(now()).toISOString(),
    data: {
      ...currentData,
      ...patchData,
    },
  }
}

const createProjectionReplayEnvelope = (input: {
  currentPayload: Record<string, unknown>
  sourceRevision: number
}) => ({
  ...input.currentPayload,
  source_service: DEFAULT_SOURCE_SERVICE,
  source_event_id: createId('evt'),
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
})

export const updateMasterDataDocument = (
  docId: string,
  input: UpdateMasterDataDocumentInput,
) => {
  const current = requireDocument(docId)
  const timestamp = now()
  const nextRevision = current.sourceRevision + 1
  const nextPayload = patchEnvelope({
    currentPayload: current.payload,
    sourceRevision: nextRevision,
    data: input.data,
    payload: input.payload,
  })
  const nextTitle = input.title?.trim() || current.title
  const nextStatus = input.status?.trim() || current.status
  const topicKey = resolveTopicKey(current)

  sqlite.transaction(() => {
    sqlite.prepare(`
      UPDATE master_data_documents
      SET title = ?, status = ?, source_revision = ?, payload_json = ?, updated_at = ?
      WHERE doc_id = ?
    `).run(
      nextTitle,
      nextStatus,
      nextRevision,
      serializeJson(nextPayload),
      timestamp,
      docId,
    )

    enqueueProjectionOutbox({
      sandboxId: current.sandboxId,
      topicKey,
      scopeType: current.naturalScopeType,
      scopeKey: current.naturalScopeKey,
      itemKey: current.entityId,
      payload: nextPayload,
      targetTerminalIds: input.targetTerminalIds,
    })
  })()

  return {
    document: requireDocument(docId),
    projection: {
      topicKey,
      scopeType: current.naturalScopeType,
      scopeKey: current.naturalScopeKey,
      itemKey: current.entityId,
      sourceRevision: nextRevision,
      sourceEventId: typeof nextPayload.source_event_id === 'string'
        ? nextPayload.source_event_id
        : null,
      targetTerminalIds: input.targetTerminalIds ?? [],
    },
  }
}

export const applyDemoMasterDataChange = () => {
  const product = listMasterDataDocuments({
    domain: 'catering-product',
    entityType: 'product',
  }).find(item => item.entityId === 'product-salmon-bowl')

  if (!product) {
    throw new Error('demo product document not found: product-salmon-bowl')
  }

  const basePrice = typeof product.payload.data === 'object' && product.payload.data !== null
    ? Number((product.payload.data as Record<string, unknown>).base_price ?? 58)
    : 58
  const nextPrice = Number.isFinite(basePrice) ? basePrice + 1 : 59

  return updateMasterDataDocument(product.docId, {
    title: `Salmon Bowl ${nextPrice}`,
    data: {
      product_name: `Salmon Bowl ${nextPrice}`,
      base_price: nextPrice,
      status: 'ACTIVE',
    },
  })
}

export const rebuildProjectionOutboxFromCurrentDocuments = (input: {
  domain?: string
  entityType?: string
  targetTerminalIds?: string[]
} = {}) => {
  const documents = listMasterDataDocuments({
    domain: input.domain,
    entityType: input.entityType,
  })
  const timestamp = now()

  sqlite.transaction(() => {
    documents.forEach(document => {
      const payload = createProjectionReplayEnvelope({
        currentPayload: document.payload,
        sourceRevision: document.sourceRevision,
      })
      enqueueProjectionOutbox({
        sandboxId: document.sandboxId,
        topicKey: resolveTopicKey(document),
        scopeType: document.naturalScopeType,
        scopeKey: document.naturalScopeKey,
        itemKey: document.entityId,
        payload,
        targetTerminalIds: input.targetTerminalIds,
      })
    })
  })()

  return {
    total: documents.length,
    rebuiltAt: timestamp,
    targetTerminalIds: input.targetTerminalIds ?? [],
    documents: documents.map(document => ({
      docId: document.docId,
      title: document.title,
      topicKey: resolveTopicKey(document),
      scopeType: document.naturalScopeType,
      scopeKey: document.naturalScopeKey,
      itemKey: document.entityId,
      sourceRevision: document.sourceRevision,
    })),
  }
}

export const getMasterDataOverview = () => {
  const rows = sqlite.prepare(`
    SELECT domain, entity_type, COUNT(*) as count
    FROM master_data_documents
    GROUP BY domain, entity_type
    ORDER BY domain ASC, entity_type ASC
  `).all() as Array<{domain: string; entity_type: string; count: number}>
  const outbox = sqlite.prepare(`
    SELECT status, COUNT(*) as count
    FROM projection_outbox
    GROUP BY status
  `).all() as Array<{status: string; count: number}>

  return {
    documents: rows,
    outbox,
  }
}
