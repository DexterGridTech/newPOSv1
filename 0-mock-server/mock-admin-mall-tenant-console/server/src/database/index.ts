import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DEFAULT_SANDBOX_ID} from '../shared/constants.js'
import {createId, now, serializeJson} from '../shared/utils.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataFile = path.resolve(currentDir, '../../data/mock-admin-mall-tenant-console.sqlite')
fs.mkdirSync(path.dirname(dataFile), {recursive: true})

export const sqlite = new Database(dataFile)

const createOrganizationEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'organization',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: 'platform-mixc',
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createIamEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'iam',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: 'platform-mixc',
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createCateringProductEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'catering_product',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: 'platform-mixc',
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const createCateringStoreOperationEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'catering_store_operation',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: 'platform-mixc',
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

const seedOutboxForRows = (input: {
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  operation?: 'upsert' | 'delete'
  payload: Record<string, unknown>
  targetTerminalIds?: string[]
}) => {
  const timestamp = now()
  const sourceEventId = typeof input.payload.source_event_id === 'string' && input.payload.source_event_id.trim()
    ? input.payload.source_event_id.trim()
    : createId('evt')
  const sourceRevision = typeof input.payload.source_revision === 'number'
    ? input.payload.source_revision
    : 1
  sqlite.prepare(`
    INSERT INTO projection_outbox (
      outbox_id, sandbox_id, source_service, source_event_id, source_revision, topic_key, scope_type, scope_key,
      item_key, operation, payload_json, target_terminal_ids_json, status, attempt_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('outbox'),
    DEFAULT_SANDBOX_ID,
    'mock-admin-mall-tenant-console',
    sourceEventId,
    sourceRevision,
    input.topicKey,
    input.scopeType,
    input.scopeKey,
    input.itemKey,
    input.operation ?? 'upsert',
    serializeJson(input.payload),
    serializeJson(input.targetTerminalIds ?? []),
    'PENDING',
    0,
    timestamp,
    timestamp,
  )
}

export const initializeDatabase = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS master_data_documents (
      doc_id TEXT PRIMARY KEY,
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_master_data_documents_unique
      ON master_data_documents (sandbox_id, domain, entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS projection_outbox (
      outbox_id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      source_service TEXT NOT NULL,
      source_event_id TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      topic_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      target_terminal_ids_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      last_error TEXT,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projection_publish_log (
      publish_id TEXT PRIMARY KEY,
      outbox_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  const row = sqlite.prepare('SELECT COUNT(*) as count FROM master_data_documents').get() as {count: number}
  if (row.count > 0) {
    return
  }

  const timestamp = now()
  const docs = [
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'platform',
      entityId: 'platform-mixc',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: 'platform-mixc',
      title: 'MixC Mall Platform',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-platform-001',
        sourceRevision: 1,
        data: {
          platform_id: 'platform-mixc',
          platform_code: 'MIXC',
          platform_name: 'MixC Mall Platform',
          status: 'ACTIVE',
          description: 'Production-shaped mock mall platform',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'project',
      entityId: 'project-baycity',
      naturalScopeType: 'PROJECT',
      naturalScopeKey: 'project-baycity',
      title: 'Bay City',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-project-001',
        sourceRevision: 1,
        data: {
          project_id: 'project-baycity',
          project_code: 'BAYCITY',
          project_name: 'Bay City Project',
          platform_id: 'platform-mixc',
          region: {
            region_code: 'CN-SZ-NS',
            region_name: 'Shenzhen Nanshan',
            parent_region_code: 'CN-SZ',
            region_level: 3,
          },
          timezone: 'Asia/Shanghai',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'tenant',
      entityId: 'tenant-blueharbor',
      naturalScopeType: 'TENANT',
      naturalScopeKey: 'tenant-blueharbor',
      title: 'Blue Harbor Tenant',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-tenant-001',
        sourceRevision: 1,
        data: {
          tenant_id: 'tenant-blueharbor',
          tenant_code: 'BLUE_HARBOR',
          tenant_name: 'Blue Harbor Catering Tenant',
          platform_id: 'platform-mixc',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'brand',
      entityId: 'brand-seaflame',
      naturalScopeType: 'BRAND',
      naturalScopeKey: 'brand-seaflame',
      title: 'Sea Flame',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-brand-001',
        sourceRevision: 1,
        data: {
          brand_id: 'brand-seaflame',
          brand_code: 'SEA_FLAME',
          brand_name: 'Sea Flame',
          tenant_id: 'tenant-blueharbor',
          platform_id: 'platform-mixc',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'store',
      entityId: 'store-seaflame-001',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Sea Flame Bay Store',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-store-001',
        sourceRevision: 1,
        data: {
          store_id: 'store-seaflame-001',
          store_code: 'SF001',
          store_name: 'Sea Flame Bay Store',
          unit_code: 'B1-018',
          platform_id: 'platform-mixc',
          project_id: 'project-baycity',
          tenant_id: 'tenant-blueharbor',
          brand_id: 'brand-seaflame',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'contract',
      entityId: 'contract-seaflame-001',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Sea Flame 2026 Contract',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-contract-001',
        sourceRevision: 1,
        data: {
          contract_id: 'contract-seaflame-001',
          contract_code: 'CT-SF-2026',
          platform_id: 'platform-mixc',
          project_id: 'project-baycity',
          tenant_id: 'tenant-blueharbor',
          brand_id: 'brand-seaflame',
          store_id: 'store-seaflame-001',
          unit_code: 'B1-018',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'iam',
      entityType: 'role',
      entityId: 'role-store-manager',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: 'platform-mixc',
      title: 'Store Manager Role',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createIamEnvelope({
        sourceEventId: 'evt-iam-role-001',
        sourceRevision: 1,
        data: {
          role_id: 'role-store-manager',
          role_code: 'STORE_MANAGER',
          role_name: 'Store Manager',
          scope_type: 'STORE',
          permission_ids: ['perm-product-manage', 'perm-shift-open'],
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'iam',
      entityType: 'permission',
      entityId: 'perm-product-manage',
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: 'platform-mixc',
      title: 'Manage Product Permission',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createIamEnvelope({
        sourceEventId: 'evt-iam-permission-001',
        sourceRevision: 1,
        data: {
          permission_id: 'perm-product-manage',
          permission_code: 'PRODUCT_MANAGE',
          permission_name: 'Manage Product',
          permission_type: 'SYSTEM',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'iam',
      entityType: 'user',
      entityId: 'user-linmei',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Lin Mei',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createIamEnvelope({
        sourceEventId: 'evt-iam-user-001',
        sourceRevision: 1,
        data: {
          user_id: 'user-linmei',
          user_code: 'lin.mei',
          display_name: 'Lin Mei',
          mobile: '13800000001',
          store_id: 'store-seaflame-001',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'iam',
      entityType: 'user_role_binding',
      entityId: 'binding-linmei-manager',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Lin Mei Store Manager Binding',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createIamEnvelope({
        sourceEventId: 'evt-iam-binding-001',
        sourceRevision: 1,
        data: {
          binding_id: 'binding-linmei-manager',
          user_id: 'user-linmei',
          role_id: 'role-store-manager',
          store_id: 'store-seaflame-001',
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-product',
      entityType: 'product',
      entityId: 'product-salmon-bowl',
      naturalScopeType: 'BRAND',
      naturalScopeKey: 'brand-seaflame',
      title: 'Salmon Bowl',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-product-001',
        sourceRevision: 1,
        data: {
          product_id: 'product-salmon-bowl',
          brand_id: 'brand-seaflame',
          product_name: 'Salmon Bowl',
          ownership_scope: 'BRAND',
          product_type: 'STANDARD',
          base_price: 58,
          production_steps: [
            {step_code: 'ASSEMBLE', step_name: 'Assemble Bowl', workstation_code: 'COLD_KITCHEN'},
          ],
          modifier_groups: [
            {modifier_group_id: 'modifier-protein', group_name: 'Protein Option', selection_type: 'SINGLE'},
          ],
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-product',
      entityType: 'brand_menu',
      entityId: 'brand-menu-seaflame-main',
      naturalScopeType: 'BRAND',
      naturalScopeKey: 'brand-seaflame',
      title: 'Sea Flame Main Menu',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-brand-menu-001',
        sourceRevision: 1,
        data: {
          brand_menu_id: 'brand-menu-seaflame-main',
          brand_id: 'brand-seaflame',
          menu_name: 'Sea Flame Main Menu',
          status: 'APPROVED',
          sections: [
            {section_id: 'section-signature', section_name: 'Signature Bowls', display_order: 10},
          ],
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-product',
      entityType: 'menu_catalog',
      entityId: 'menu-seaflame-store-001',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Store Effective Menu',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-menu-catalog-001',
        sourceRevision: 1,
        data: {
          menu_id: 'menu-seaflame-store-001',
          store_id: 'store-seaflame-001',
          menu_name: 'Sea Flame Store Effective Menu',
          sections: [
            {
              section_id: 'section-signature',
              section_name: 'Signature Bowls',
              display_order: 10,
              products: [
                {product_id: 'product-salmon-bowl', display_order: 10},
              ],
            },
          ],
          version_hash: 'menu-hash-001',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-store-operating',
      entityType: 'menu_availability',
      entityId: 'product-salmon-bowl',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Salmon Bowl Availability',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-availability-001',
        sourceRevision: 1,
        data: {
          product_id: 'product-salmon-bowl',
          store_id: 'store-seaflame-001',
          available: true,
          sold_out_reason: null,
          effective_from: '2026-04-23T00:00:00.000Z',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-store-operating',
      entityType: 'saleable_stock',
      entityId: 'stock-product-salmon-bowl',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Salmon Bowl Stock',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-stock-001',
        sourceRevision: 1,
        data: {
          stock_id: 'stock-product-salmon-bowl',
          store_id: 'store-seaflame-001',
          product_id: 'product-salmon-bowl',
          saleable_quantity: 26,
          safety_stock: 4,
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'catering-store-operating',
      entityType: 'stock_reservation',
      entityId: 'reservation-salmon-bowl-001',
      naturalScopeType: 'STORE',
      naturalScopeKey: 'store-seaflame-001',
      title: 'Salmon Bowl Active Reservation',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-stock-reservation-001',
        sourceRevision: 1,
        data: {
          reservation_id: 'reservation-salmon-bowl-001',
          store_id: 'store-seaflame-001',
          product_id: 'product-salmon-bowl',
          reserved_quantity: 2,
          reservation_status: 'ACTIVE',
          expires_at: '2026-04-23T19:00:00.000Z',
        },
      }),
    },
  ]

  const insertDoc = sqlite.prepare(`
    INSERT INTO master_data_documents (
      doc_id, sandbox_id, domain, entity_type, entity_id, natural_scope_type, natural_scope_key, title, status,
      source_revision, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = sqlite.transaction(() => {
    docs.forEach(doc => {
      insertDoc.run(
        doc.docId,
        DEFAULT_SANDBOX_ID,
        doc.domain,
        doc.entityType,
        doc.entityId,
        doc.naturalScopeType,
        doc.naturalScopeKey,
        doc.title,
        doc.status,
        doc.sourceRevision,
        serializeJson(doc.payload),
        timestamp,
        timestamp,
      )
    })

    seedOutboxForRows({
      topicKey: 'org.platform.profile',
      scopeType: 'PLATFORM',
      scopeKey: 'platform-mixc',
      itemKey: 'platform-mixc',
      payload: docs[0].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'org.project.profile',
      scopeType: 'PROJECT',
      scopeKey: 'project-baycity',
      itemKey: 'project-baycity',
      payload: docs[1].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'org.tenant.profile',
      scopeType: 'TENANT',
      scopeKey: 'tenant-blueharbor',
      itemKey: 'tenant-blueharbor',
      payload: docs[2].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'org.brand.profile',
      scopeType: 'BRAND',
      scopeKey: 'brand-seaflame',
      itemKey: 'brand-seaflame',
      payload: docs[3].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'org.store.profile',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'store-seaflame-001',
      payload: docs[4].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'org.contract.active',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'contract-seaflame-001',
      payload: docs[5].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'iam.role.catalog',
      scopeType: 'PLATFORM',
      scopeKey: 'platform-mixc',
      itemKey: 'role-store-manager',
      payload: docs[6].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'iam.permission.catalog',
      scopeType: 'PLATFORM',
      scopeKey: 'platform-mixc',
      itemKey: 'perm-product-manage',
      payload: docs[7].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'iam.user.store-effective',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'user-linmei',
      payload: docs[8].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'iam.user-role-binding.store-effective',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'binding-linmei-manager',
      payload: docs[9].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'catering.product.profile',
      scopeType: 'BRAND',
      scopeKey: 'brand-seaflame',
      itemKey: 'product-salmon-bowl',
      payload: docs[10].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'catering.brand-menu.profile',
      scopeType: 'BRAND',
      scopeKey: 'brand-seaflame',
      itemKey: 'brand-menu-seaflame-main',
      payload: docs[11].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'menu.catalog',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'menu-seaflame-store-001',
      payload: docs[12].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'menu.availability',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'product-salmon-bowl',
      payload: docs[13].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'catering.saleable-stock.profile',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'stock-product-salmon-bowl',
      payload: docs[14].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
    seedOutboxForRows({
      topicKey: 'catering.stock-reservation.active',
      scopeType: 'STORE',
      scopeKey: 'store-seaflame-001',
      itemKey: 'reservation-salmon-bowl-001',
      payload: docs[15].payload,
      targetTerminalIds: ['terminal-test-001'],
    })
  })

  transaction()
}
