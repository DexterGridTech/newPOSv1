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

const DEFAULT_SCOPE_IDS = {
  platformId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PLATFORM_ID?.trim() || 'platform-kernel-base-test',
  projectId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PROJECT_ID?.trim() || 'project-kernel-base-test',
  tenantId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_TENANT_ID?.trim() || 'tenant-kernel-base-test',
  brandId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_BRAND_ID?.trim() || 'brand-kernel-base-test',
  storeId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_STORE_ID?.trim() || 'store-kernel-base-test',
  contractId: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_CONTRACT_ID?.trim() || 'contract-kernel-base-test',
  unitCode: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_UNIT_CODE?.trim() || 'KB001',
} as const

const createOrganizationEnvelope = (input: {
  sourceEventId: string
  sourceRevision: number
  data: Record<string, unknown>
}) => ({
  schema_version: 1,
  projection_kind: 'organization',
  sandbox_id: DEFAULT_SANDBOX_ID,
  platform_id: DEFAULT_SCOPE_IDS.platformId,
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
  platform_id: DEFAULT_SCOPE_IDS.platformId,
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
  platform_id: DEFAULT_SCOPE_IDS.platformId,
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
  platform_id: DEFAULT_SCOPE_IDS.platformId,
  source_service: 'mock-admin-mall-tenant-console',
  source_event_id: input.sourceEventId,
  source_revision: input.sourceRevision,
  generated_at: new Date(now()).toISOString(),
  data: input.data,
})

export interface ProjectionOutboxSeedInput {
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  operation?: 'upsert' | 'delete'
  payload: Record<string, unknown>
  targetTerminalIds?: string[]
}

export const enqueueProjectionOutbox = (input: ProjectionOutboxSeedInput) => {
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

const seedOutboxForRows = (input: ProjectionOutboxSeedInput) => {
  enqueueProjectionOutbox(input)
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
      entityId: DEFAULT_SCOPE_IDS.platformId,
      naturalScopeType: 'PLATFORM',
      naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
      title: 'Kernel Base Test Platform',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-platform-001',
        sourceRevision: 1,
        data: {
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          platform_code: 'PLATFORM_KERNEL_BASE_TEST',
          platform_name: 'Kernel Base Test Platform',
          status: 'ACTIVE',
          description: 'Production-shaped kernel-base test mall platform',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'project',
      entityId: DEFAULT_SCOPE_IDS.projectId,
      naturalScopeType: 'PROJECT',
      naturalScopeKey: DEFAULT_SCOPE_IDS.projectId,
      title: 'Kernel Base Test Project',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-project-001',
        sourceRevision: 1,
        data: {
          project_id: DEFAULT_SCOPE_IDS.projectId,
          project_code: 'PROJECT_KERNEL_BASE_TEST',
          project_name: 'Kernel Base Test Project',
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          region: {
            region_code: 'SZ',
            region_name: 'Shenzhen',
            parent_region_code: 'CN-GD',
            region_level: 2,
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
      entityId: DEFAULT_SCOPE_IDS.tenantId,
      naturalScopeType: 'TENANT',
      naturalScopeKey: DEFAULT_SCOPE_IDS.tenantId,
      title: 'Kernel Base Test Tenant',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-tenant-001',
        sourceRevision: 1,
        data: {
          tenant_id: DEFAULT_SCOPE_IDS.tenantId,
          tenant_code: 'TENANT_KERNEL_BASE_TEST',
          tenant_name: 'Kernel Base Test Tenant',
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'brand',
      entityId: DEFAULT_SCOPE_IDS.brandId,
      naturalScopeType: 'BRAND',
      naturalScopeKey: DEFAULT_SCOPE_IDS.brandId,
      title: 'Kernel Base Test Brand',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-brand-001',
        sourceRevision: 1,
        data: {
          brand_id: DEFAULT_SCOPE_IDS.brandId,
          brand_code: 'BRAND_KERNEL_BASE_TEST',
          brand_name: 'Kernel Base Test Brand',
          tenant_id: DEFAULT_SCOPE_IDS.tenantId,
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'store',
      entityId: DEFAULT_SCOPE_IDS.storeId,
      naturalScopeType: 'STORE',
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Kernel Base Test Store',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-store-001',
        sourceRevision: 1,
        data: {
          store_id: DEFAULT_SCOPE_IDS.storeId,
          store_code: 'STORE_KERNEL_BASE_TEST',
          store_name: 'Kernel Base Test Store',
          unit_code: DEFAULT_SCOPE_IDS.unitCode,
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          project_id: DEFAULT_SCOPE_IDS.projectId,
          tenant_id: DEFAULT_SCOPE_IDS.tenantId,
          brand_id: DEFAULT_SCOPE_IDS.brandId,
          status: 'ACTIVE',
        },
      }),
    },
    {
      docId: createId('doc'),
      domain: 'organization',
      entityType: 'contract',
      entityId: DEFAULT_SCOPE_IDS.contractId,
      naturalScopeType: 'STORE',
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Kernel Base Test 2026 Contract',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createOrganizationEnvelope({
        sourceEventId: 'evt-org-contract-001',
        sourceRevision: 1,
        data: {
          contract_id: DEFAULT_SCOPE_IDS.contractId,
          contract_code: 'CONTRACT_KERNEL_BASE_TEST',
          platform_id: DEFAULT_SCOPE_IDS.platformId,
          project_id: DEFAULT_SCOPE_IDS.projectId,
          tenant_id: DEFAULT_SCOPE_IDS.tenantId,
          brand_id: DEFAULT_SCOPE_IDS.brandId,
          store_id: DEFAULT_SCOPE_IDS.storeId,
          unit_code: DEFAULT_SCOPE_IDS.unitCode,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.platformId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
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
          store_id: DEFAULT_SCOPE_IDS.storeId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
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
          store_id: DEFAULT_SCOPE_IDS.storeId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.brandId,
      title: 'Salmon Bowl',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-product-001',
        sourceRevision: 1,
        data: {
          product_id: 'product-salmon-bowl',
          brand_id: DEFAULT_SCOPE_IDS.brandId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.brandId,
      title: 'Kernel Base Test Main Menu',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-brand-menu-001',
        sourceRevision: 1,
        data: {
          brand_menu_id: 'brand-menu-seaflame-main',
          brand_id: DEFAULT_SCOPE_IDS.brandId,
          menu_name: 'Kernel Base Test Main Menu',
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Store Effective Menu',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringProductEnvelope({
        sourceEventId: 'evt-menu-catalog-001',
        sourceRevision: 1,
        data: {
          menu_id: 'menu-seaflame-store-001',
          store_id: DEFAULT_SCOPE_IDS.storeId,
          menu_name: 'Kernel Base Test Store Effective Menu',
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Salmon Bowl Availability',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-availability-001',
        sourceRevision: 1,
        data: {
          product_id: 'product-salmon-bowl',
          store_id: DEFAULT_SCOPE_IDS.storeId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Salmon Bowl Stock',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-stock-001',
        sourceRevision: 1,
        data: {
          stock_id: 'stock-product-salmon-bowl',
          store_id: DEFAULT_SCOPE_IDS.storeId,
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
      naturalScopeKey: DEFAULT_SCOPE_IDS.storeId,
      title: 'Salmon Bowl Active Reservation',
      status: 'ACTIVE',
      sourceRevision: 1,
      payload: createCateringStoreOperationEnvelope({
        sourceEventId: 'evt-stock-reservation-001',
        sourceRevision: 1,
        data: {
          reservation_id: 'reservation-salmon-bowl-001',
          store_id: DEFAULT_SCOPE_IDS.storeId,
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
      scopeKey: DEFAULT_SCOPE_IDS.platformId,
      itemKey: DEFAULT_SCOPE_IDS.platformId,
      payload: docs[0].payload,
    })
    seedOutboxForRows({
      topicKey: 'org.project.profile',
      scopeType: 'PROJECT',
      scopeKey: DEFAULT_SCOPE_IDS.projectId,
      itemKey: DEFAULT_SCOPE_IDS.projectId,
      payload: docs[1].payload,
    })
    seedOutboxForRows({
      topicKey: 'org.tenant.profile',
      scopeType: 'TENANT',
      scopeKey: DEFAULT_SCOPE_IDS.tenantId,
      itemKey: DEFAULT_SCOPE_IDS.tenantId,
      payload: docs[2].payload,
    })
    seedOutboxForRows({
      topicKey: 'org.brand.profile',
      scopeType: 'BRAND',
      scopeKey: DEFAULT_SCOPE_IDS.brandId,
      itemKey: DEFAULT_SCOPE_IDS.brandId,
      payload: docs[3].payload,
    })
    seedOutboxForRows({
      topicKey: 'org.store.profile',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: DEFAULT_SCOPE_IDS.storeId,
      payload: docs[4].payload,
    })
    seedOutboxForRows({
      topicKey: 'org.contract.active',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: DEFAULT_SCOPE_IDS.contractId,
      payload: docs[5].payload,
    })
    seedOutboxForRows({
      topicKey: 'iam.role.catalog',
      scopeType: 'PLATFORM',
      scopeKey: DEFAULT_SCOPE_IDS.platformId,
      itemKey: 'role-store-manager',
      payload: docs[6].payload,
    })
    seedOutboxForRows({
      topicKey: 'iam.permission.catalog',
      scopeType: 'PLATFORM',
      scopeKey: DEFAULT_SCOPE_IDS.platformId,
      itemKey: 'perm-product-manage',
      payload: docs[7].payload,
    })
    seedOutboxForRows({
      topicKey: 'iam.user.store-effective',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'user-linmei',
      payload: docs[8].payload,
    })
    seedOutboxForRows({
      topicKey: 'iam.user-role-binding.store-effective',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'binding-linmei-manager',
      payload: docs[9].payload,
    })
    seedOutboxForRows({
      topicKey: 'catering.product.profile',
      scopeType: 'BRAND',
      scopeKey: DEFAULT_SCOPE_IDS.brandId,
      itemKey: 'product-salmon-bowl',
      payload: docs[10].payload,
    })
    seedOutboxForRows({
      topicKey: 'catering.brand-menu.profile',
      scopeType: 'BRAND',
      scopeKey: DEFAULT_SCOPE_IDS.brandId,
      itemKey: 'brand-menu-seaflame-main',
      payload: docs[11].payload,
    })
    seedOutboxForRows({
      topicKey: 'menu.catalog',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'menu-seaflame-store-001',
      payload: docs[12].payload,
    })
    seedOutboxForRows({
      topicKey: 'menu.availability',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'product-salmon-bowl',
      payload: docs[13].payload,
    })
    seedOutboxForRows({
      topicKey: 'catering.saleable-stock.profile',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'stock-product-salmon-bowl',
      payload: docs[14].payload,
    })
    seedOutboxForRows({
      topicKey: 'catering.stock-reservation.active',
      scopeType: 'STORE',
      scopeKey: DEFAULT_SCOPE_IDS.storeId,
      itemKey: 'reservation-salmon-bowl-001',
      payload: docs[15].payload,
    })
  })

  transaction()
}
