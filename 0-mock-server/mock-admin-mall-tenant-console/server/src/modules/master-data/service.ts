import {sqlite} from '../../database/index.js'
import {parseJson} from '../../shared/utils.js'

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
