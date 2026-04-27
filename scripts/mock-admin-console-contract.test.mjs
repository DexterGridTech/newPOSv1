import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const isolatedDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-admin-console-contract-'))
process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE = path.join(isolatedDbDir, 'mock-admin-mall-tenant-console.sqlite')

const [
  {createApp},
  {initializeDatabase, sqlite},
  {initializeAlignedMasterData},
] = await Promise.all([
  import('../0-mock-server/mock-admin-mall-tenant-console/server/src/app/createApp.js'),
  import('../0-mock-server/mock-admin-mall-tenant-console/server/src/database/index.js'),
  import('../0-mock-server/mock-admin-mall-tenant-console/server/src/modules/aligned-master-data/service.js'),
])

const server = await (async () => {
  initializeDatabase()
  initializeAlignedMasterData()

  const app = createApp()
  return await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    instance.once('error', reject)
  })
})()

const address = server.address()
const baseUrl = typeof address === 'object' && address
  ? `http://127.0.0.1:${address.port}`
  : null

if (!baseUrl) {
  throw new Error('failed to resolve mock-admin-mall-tenant-console test server address')
}

const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const ids = {
  tenantId: `tenant-phase3-${runId}`,
  tenantCode: `TENANT_PHASE3_${runId.toUpperCase()}`,
  brandId: `brand-phase3-${runId}`,
  brandCode: `BRAND_PHASE3_${runId.toUpperCase()}`,
  entityId: `entity-phase3-${runId}`,
  entityCode: `ENTITY_PHASE3_${runId.toUpperCase()}`,
  primaryStoreId: `store-phase3-${runId}`,
  primaryStoreCode: `STORE_PHASE3_${runId.toUpperCase()}`,
  primaryContractId: `contract-phase3-${runId}`,
  replacementContractId: `contract-phase3-replacement-${runId}`,
  suspendStoreId: `store-phase3-suspend-${runId}`,
  suspendStoreCode: `STORE_PHASE3_SUSPEND_${runId.toUpperCase()}`,
  suspendContractId: `contract-phase3-suspend-${runId}`,
  permissionId: `perm-phase4-${runId}`,
  permissionCode: `phase4:manage_${runId}`,
  roleId: `role-phase4-${runId}`,
  roleCode: `ROLE_PHASE4_${runId.toUpperCase()}`,
  userId: `user-phase4-${runId}`,
  userCode: `user.phase4.${runId}`,
  bindingId: `binding-phase4-${runId}`,
  denyBindingId: `binding-phase4-deny-${runId}`,
  groupId: `group-phase4-${runId}`,
  groupMemberId: `group-member-phase4-${runId}`,
  groupBindingId: `group-binding-phase4-${runId}`,
  projectBindingId: `binding-phase4-project-${runId}`,
  tagBindingId: `binding-phase4-tag-${runId}`,
  resourceBindingId: `binding-phase4-resource-${runId}`,
  compositeBindingId: `binding-phase4-composite-${runId}`,
  compositeDuplicateBindingId: `binding-phase4-composite-dup-${runId}`,
  orgNodeGroupBindingId: `group-binding-phase4-org-node-${runId}`,
  sodPermissionId: `perm-phase4-sod-${runId}`,
  sodPermissionCode: `phase4:sod_${runId}`,
  sodRoleId: `role-phase4-sod-${runId}`,
  sodRoleCode: `ROLE_PHASE4_SOD_${runId.toUpperCase()}`,
  highRiskPermissionId: `perm-phase4-risk-${runId}`,
  highRiskPermissionCode: `phase4:risk_${runId}`,
  highRiskRoleId: `role-phase4-risk-${runId}`,
  highRiskRoleCode: `ROLE_PHASE4_RISK_${runId.toUpperCase()}`,
  iamFeaturePointId: `feature-phase4-${runId}`,
  iamFeatureCode: `FEATURE_PHASE4_${runId.toUpperCase()}`,
  iamPermissionGroupId: `permission-group-phase4-${runId}`,
  iamRoleTemplateId: `role-template-phase4-${runId}`,
  iamAuthorizationSessionId: `auth-session-phase4-${runId}`,
  productId: `product-phase5-${runId}`,
  brandMenuId: `brand-menu-phase6-${runId}`,
  storeMenuId: `menu-phase6-${runId}`,
  stockId: `stock-phase7-${runId}`,
  priceRuleIdHint: `PRICE_PHASE7_${runId.toUpperCase()}`,
  availabilityRuleIdHint: `AVAILABILITY_PHASE7_${runId.toUpperCase()}`,
  bundleRuleId: `bundle-phase7-${runId}`,
}

const request = async (path, init = {}) => {
  const {headers, ...restInit} = init
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {}),
    },
    ...restInit,
  })
  const payload = await response.json()
  return {response, payload}
}

const post = (path, body, options = {}) => request(path, {
  method: 'POST',
  body: JSON.stringify(body ?? {}),
  ...options,
})

const patchEntity = (entityType, entityId, data, options = {}) => request(`/api/v1/customer/entities/${entityType}/${entityId}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
  ...options,
})

const get = async path => {
  const {response, payload} = await request(path)
  assert.equal(response.status, 200)
  return payload
}

const assertProjectionPlatform = ({sourceEventId, topicKey, platformId}) => {
  const businessEvent = sqlite.prepare(`
    SELECT platform_id
    FROM business_events
    WHERE event_id = ?
    LIMIT 1
  `).get(sourceEventId)
  assert.equal(businessEvent.platform_id, platformId)

  const outbox = sqlite.prepare(`
    SELECT payload_json
    FROM projection_outbox
    WHERE source_event_id = ? AND topic_key = ?
    LIMIT 1
  `).get(sourceEventId, topicKey)
  assert.ok(outbox, `${topicKey} projection outbox should exist`)
  const outboxPayload = JSON.parse(outbox.payload_json)
  assert.equal(outboxPayload.platform_id, platformId)
  assert.equal(outboxPayload.data.platform_id, platformId)
}

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve(undefined)))
  fs.rmSync(isolatedDbDir, {recursive: true, force: true})
})

test('aligned overview returns design-v3 compatible envelope while keeping legacy compatibility fields', async () => {
  const {response, payload} = await request('/api/v1/overview')

  assert.equal(response.status, 200)
  assert.equal(payload.success, true)
  assert.equal(payload.code, 0)
  assert.equal(payload.message, 'Success')
  assert.equal(typeof payload.timestamp, 'string')
  assert.equal(typeof payload.trace_id, 'string')
  assert.equal(typeof payload.traceId, 'string')
  assert.ok(payload.data)
  assert.ok(Array.isArray(payload.data.alignedEntities))
})

test('legacy compatibility route still serves smoke-script entrypoint shape', async () => {
  const {response, payload} = await post('/api/v1/master-data/demo-change', {})

  assert.equal(response.status, 201)
  assert.equal(payload.success, true)
  assert.equal(payload.code, 0)
  assert.equal(payload.message, 'Success')
  assert.ok(payload.data?.document)
  assert.ok(payload.data?.projection)
  assert.equal(typeof payload.data.projection.sourceEventId, 'string')
})

test('environment workflow routes expose aligned sandbox/platform/project setup and mask ISV secrets from admin responses', async () => {
  const sandboxId = `sandbox-phase2-${runId}`
  const sandboxCreate = await post('/api/v1/org/sandboxes', {
    sandboxId,
    sandboxCode: `SANDBOX_PHASE2_${runId.toUpperCase()}`,
    sandboxName: `Phase2 Sandbox ${runId}`,
    sandboxType: 'DEBUG',
    owner: 'contract-test',
    description: 'phase2 aligned environment workflow',
  }, {
    headers: {
      'idempotency-key': `test-create-sandbox-${runId}`,
    },
  })
  assert.equal(sandboxCreate.response.status, 201)
  assert.equal(sandboxCreate.payload.data.entityId, sandboxId)
  assert.equal(sandboxCreate.payload.data.payload.data.sandbox_type, 'DEBUG')

  const sandboxActivate = await post(`/api/v1/org/sandboxes/${sandboxId}/activate`, {})
  assert.equal(sandboxActivate.response.status, 200)
  assert.equal(sandboxActivate.payload.data.status, 'ACTIVE')

  const platformId = `platform-phase2-${runId}`
  const platformCreate = await post('/api/v1/org/platforms', {
    platformId,
    platformCode: `PLATFORM_PHASE2_${runId.toUpperCase()}`,
    platformName: `Phase2 Platform ${runId}`,
    description: 'phase2 aligned platform',
    contactName: 'Phase2 Platform Ops',
    contactPhone: '400-000-2200',
    externalPlatformId: `ext-platform-${runId}`,
    syncedAt: '2026-04-25T09:00:00.000Z',
    version: 7,
    isvConfig: {
      providerType: 'LOCAL_MOCK_ISV',
      appKey: `app-key-${runId}`,
      appSecret: `app-secret-${runId}`,
      isvToken: `token-${runId}`,
      tokenExpireAt: '2026-12-31T23:59:59.000Z',
      channelStatus: 'ACTIVE',
    },
  }, {
    headers: {
      'idempotency-key': `test-create-platform-${runId}`,
    },
  })
  assert.equal(platformCreate.response.status, 201)
  assert.match(platformCreate.payload.data.entityId, new RegExp(`${platformId}$`))
  const createdPlatformId = platformCreate.payload.data.entityId
  assert.equal(platformCreate.payload.data.payload.data.contact_name, 'Phase2 Platform Ops')
  assert.equal(platformCreate.payload.data.payload.data.external_platform_id, `ext-platform-${runId}`)
  assert.equal(platformCreate.payload.data.payload.data.synced_at, '2026-04-25T09:00:00.000Z')
  assert.equal(platformCreate.payload.data.payload.data.version, 7)
  assert.ok(platformCreate.payload.data.payload.data.isv_config.app_key_masked.includes('*'))
  assert.equal(platformCreate.payload.data.payload.data.isv_config.app_key, undefined)
  assert.equal(platformCreate.payload.data.payload.data.isv_config.app_secret, undefined)
  assert.equal(platformCreate.payload.data.payload.data.isv_config.isv_token, undefined)

  const regionId = `region-phase2-${runId}`
  const regionCreate = await post('/api/v1/org/regions', {
    regionId,
    platformId: createdPlatformId,
    regionCode: `REGION_PHASE2_${runId.toUpperCase()}`,
    regionName: `Phase2 Region ${runId}`,
    regionLevel: 1,
  }, {
    headers: {
      'idempotency-key': `test-create-region-${runId}`,
    },
  })
  assert.equal(regionCreate.response.status, 201)
  assert.equal(regionCreate.payload.data.payload.data.platform_id, createdPlatformId)

  const projectId = `project-phase2-${runId}`
  const projectWithSecretCredential = await post('/api/v1/org/projects', {
    projectId: `${projectId}-secret`,
    projectCode: `PROJECT_PHASE2_SECRET_${runId.toUpperCase()}`,
    projectName: `Phase2 Secret Project ${runId}`,
    platformId: createdPlatformId,
    regionId,
    channelShopConfig: {
      isvToken: `wrong-place-${runId}`,
    },
  })
  assert.equal(projectWithSecretCredential.response.status, 400)
  assert.equal(projectWithSecretCredential.payload.code, 'PROJECT_CHANNEL_CONFIG_SECRET_FORBIDDEN')

  const projectCreate = await post('/api/v1/org/projects', {
    projectId,
    projectCode: `PROJECT_PHASE2_${runId.toUpperCase()}`,
    projectName: `Phase2 Project ${runId}`,
    platformId: createdPlatformId,
    timezone: 'Asia/Shanghai',
    address: 'Shenzhen Nanshan District',
    businessMode: 'SHOPPING_MALL',
    externalProjectId: `ext-project-${runId}`,
    syncedAt: '2026-04-25T10:00:00.000Z',
    version: 3,
    regionId,
  }, {
    headers: {
      'idempotency-key': `test-create-project-${runId}`,
    },
  })
  assert.equal(projectCreate.response.status, 201)
  assert.match(projectCreate.payload.data.entityId, new RegExp(`${projectId}$`))
  assert.equal(projectCreate.payload.data.status, 'ACTIVE')
  assert.equal(projectCreate.payload.data.payload.data.project_status, 'OPERATING')
  assert.equal(projectCreate.payload.data.payload.data.platform_id, createdPlatformId)
  assert.equal(projectCreate.payload.data.payload.data.region_id, regionId)
  assert.equal(projectCreate.payload.data.payload.data.region.region_code, `REGION_PHASE2_${runId.toUpperCase()}`)
  assert.equal(projectCreate.payload.data.payload.data.external_project_id, `ext-project-${runId}`)
  assert.equal(projectCreate.payload.data.payload.data.synced_at, '2026-04-25T10:00:00.000Z')
  assert.equal(projectCreate.payload.data.payload.data.version, 3)
  const projectSourceEventId = projectCreate.payload.data.payload.source_event_id
  assertProjectionPlatform({
    sourceEventId: projectSourceEventId,
    topicKey: 'org.project.profile',
    platformId: createdPlatformId,
  })

  const platformCredentialUpdate = await request(`/api/v1/org/platforms/${createdPlatformId}/isv-credential`, {
    method: 'PUT',
    body: JSON.stringify({
      providerType: 'LOCAL_MOCK_ISV',
      appKey: `app-key-updated-${runId}`,
      appSecret: `app-secret-updated-${runId}`,
      isvToken: `token-updated-${runId}`,
      tokenExpireAt: '2027-01-31T23:59:59.000Z',
      channelStatus: 'ACTIVE',
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-platform-credential-${runId}`,
    },
  })
  assert.equal(platformCredentialUpdate.response.status, 200)
  assert.ok(platformCredentialUpdate.payload.data.payload.data.isv_config.app_secret_masked.includes('*'))
  assert.equal(platformCredentialUpdate.payload.data.payload.data.isv_config.token_expire_at, '2027-01-31T23:59:59.000Z')
  assert.equal(platformCredentialUpdate.payload.data.payload.data.isv_config.app_secret, undefined)
  assert.equal(platformCredentialUpdate.payload.data.payload.data.isv_config.isv_token, undefined)

  const sandboxesPage = await get('/api/v1/org/sandboxes?page=1&size=100')
  const platformsPage = await get('/api/v1/org/platforms?page=1&size=100')
  const projectsPage = await get('/api/v1/org/projects?page=1&size=100')

  assert.ok(sandboxesPage.data.some(item => item.entityId === sandboxId && item.status === 'ACTIVE'))
  assert.ok(platformsPage.data.some(item => item.entityId === createdPlatformId && item.payload.data.isv_config.app_key_masked))
  assert.ok(projectsPage.data.some(item => item.payload.data.project_code === `PROJECT_PHASE2_${runId.toUpperCase()}` && item.payload.data.address === 'Shenzhen Nanshan District'))
})

test('organization lifecycle routes keep contract and store snapshot state consistent across amend/renew/terminate/suspend', async () => {
  const projectId = `project-phase3-${runId}`
  const platformId = 'platform-kernel-base-test'
  const regionId = `region-phase3-${runId}`
  const regionCreate = await post('/api/v1/org/regions', {
    regionId,
    platformId,
    regionCode: `REGION_PHASE3_${runId.toUpperCase()}`,
    regionName: `Phase3 Region ${runId}`,
    regionLevel: 1,
  }, {
    headers: {
      'idempotency-key': `test-create-phase3-region-${runId}`,
    },
  })
  assert.equal(regionCreate.response.status, 201)

  const projectCreate = await post('/api/v1/org/projects', {
    projectId,
    projectCode: `PROJECT_PHASE3_${runId.toUpperCase()}`,
    projectName: `Phase3 Project ${runId}`,
    platformId,
    regionId,
    businessMode: 'SHOPPING_MALL',
    projectPhases: [
      {
        phase_id: 'phase-a',
        phase_name: '一期',
        owner_name: `Phase3 Owner A ${runId}`,
        owner_contact: 'Owner A Contact',
        owner_phone: '13800001001',
      },
      {
        phase_id: 'phase-b',
        phase_name: '二期',
        owner_name: `Phase3 Owner B ${runId}`,
        owner_contact: 'Owner B Contact',
        owner_phone: '13800001002',
      },
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-phase3-project-${runId}`,
    },
  })
  assert.equal(projectCreate.response.status, 201)
  assert.equal(projectCreate.payload.data.payload.data.project_phases.length, 2)

  const tenantCreate = await post('/api/v1/org/tenants', {
    tenantId: ids.tenantId,
    tenantCode: ids.tenantCode,
    tenantName: `Phase3 Tenant ${runId}`,
    platformId,
    unifiedSocialCreditCode: `USCC_PHASE3_${runId.toUpperCase()}`,
    legalRepresentative: 'Phase3 Legal Representative',
    contactName: 'Phase3 Tenant Contact',
    contactPhone: '13800002000',
    externalTenantId: `ext-tenant-${runId}`,
    syncedAt: '2026-04-25T11:00:00.000Z',
    version: 5,
  }, {
    headers: {
      'idempotency-key': `test-create-tenant-${runId}`,
    },
  })
  assert.equal(tenantCreate.response.status, 201)
  assert.equal(tenantCreate.payload.data.entityId, ids.tenantId)
  assert.equal(tenantCreate.payload.data.payload.data.external_tenant_id, `ext-tenant-${runId}`)
  assert.equal(tenantCreate.payload.data.payload.data.synced_at, '2026-04-25T11:00:00.000Z')
  assert.equal(tenantCreate.payload.data.payload.data.version, 5)
  assert.equal(tenantCreate.payload.data.payload.data.tenant_category, undefined)

  const brandCreate = await post('/api/v1/org/brands', {
    brandId: ids.brandId,
    brandCode: ids.brandCode,
    brandName: `Phase3 Brand ${runId}`,
    platformId,
    brandCategory: 'BAKERY',
    standardMenuEnabled: true,
    externalBrandId: `ext-brand-${runId}`,
    syncedAt: '2026-04-25T12:00:00.000Z',
    version: 6,
  }, {
    headers: {
      'idempotency-key': `test-create-brand-${runId}`,
    },
  })
  assert.equal(brandCreate.response.status, 201)
  assert.equal(brandCreate.payload.data.entityId, ids.brandId)
  assert.equal(brandCreate.payload.data.payload.data.platform_id, platformId)
  assert.equal(brandCreate.payload.data.payload.data.tenant_id, undefined)
  assert.equal(brandCreate.payload.data.payload.data.external_brand_id, `ext-brand-${runId}`)
  assert.equal(brandCreate.payload.data.payload.data.synced_at, '2026-04-25T12:00:00.000Z')
  assert.equal(brandCreate.payload.data.payload.data.version, 6)

  const expiredStoreId = `store-phase3-expired-${runId}`
  const expiredContractId = `contract-phase3-expired-${runId}`
  const expiredStoreCreate = await post('/api/v1/org/stores', {
    storeId: expiredStoreId,
    storeCode: `STORE_PHASE3_EXPIRED_${runId.toUpperCase()}`,
    storeName: `Phase3 Expired Store ${runId}`,
    unitCode: 'P3-000',
    projectId,
  }, {
    headers: {
      'idempotency-key': `test-create-expired-store-${runId}`,
    },
  })
  assert.equal(expiredStoreCreate.response.status, 201)
  const expiredContractCreate = await post('/api/v1/org/contracts', {
    contractId: expiredContractId,
    contractNo: `CTR-PHASE3-EXPIRED-${runId}`,
    storeId: expiredStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-a',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  }, {
    headers: {
      'idempotency-key': `test-create-expired-contract-${runId}`,
    },
  })
  assert.equal(expiredContractCreate.response.status, 201)
  const expiredContractActivate = await post(`/api/v1/org/contracts/${expiredContractId}/activate`, {})
  assert.equal(expiredContractActivate.response.status, 200)
  const expiredContractsPage = await get('/api/v1/org/contracts?page=1&size=100')
  const expiredContract = expiredContractsPage.data.find(item => item.entityId === expiredContractId)
  assert.equal(expiredContract.status, 'EXPIRED')
  const expiredStoresPage = await get('/api/v1/org/stores?page=1&size=100')
  const expiredStore = expiredStoresPage.data.find(item => item.entityId === expiredStoreId)
  assert.equal(expiredStore.payload.data.active_contract_id, expiredContractId)
  assert.equal(expiredStore.payload.data.contract_status, 'EXPIRED')
  assert.equal(expiredStore.payload.data.active_contract_status, 'EXPIRED')

  const entityCreate = await post('/api/v1/org/legal-entities', {
    entityId: ids.entityId,
    entityCode: ids.entityCode,
    entityName: `Phase3 Entity ${runId}`,
    tenantId: ids.tenantId,
    unifiedSocialCreditCode: `ENTITY_USCC_PHASE3_${runId.toUpperCase()}`,
    bankAccountNo: `622200000000${runId.slice(-4)}`,
    taxRate: 0.06,
    settlementDay: 15,
  }, {
    headers: {
      'idempotency-key': `test-create-entity-${runId}`,
    },
  })
  assert.equal(entityCreate.response.status, 201)
  assert.equal(entityCreate.payload.data.entityId, ids.entityId)
  assert.equal(entityCreate.payload.data.payload.data.bank_account_no, undefined)
  assert.match(entityCreate.payload.data.payload.data.bank_account_no_masked, /\*+/)

  const duplicateBusinessEntityCreditCode = await post('/api/v1/org/legal-entities', {
    entityId: `entity-duplicate-credit-${runId}`,
    entityCode: `ENTITY_DUPLICATE_CREDIT_${runId.toUpperCase()}`,
    entityName: `Phase3 Duplicate Entity ${runId}`,
    tenantId: ids.tenantId,
    unifiedSocialCreditCode: `ENTITY_USCC_PHASE3_${runId.toUpperCase()}`,
  })
  assert.equal(duplicateBusinessEntityCreditCode.response.status, 409)
  assert.equal(duplicateBusinessEntityCreditCode.payload.code, 'BUSINESS_ENTITY_CREDIT_CODE_ALREADY_EXISTS')

  const invalidBusinessEntityTaxRate = await post('/api/v1/org/legal-entities', {
    entityId: `entity-invalid-tax-${runId}`,
    entityCode: `ENTITY_INVALID_TAX_${runId.toUpperCase()}`,
    entityName: `Phase3 Invalid Tax Entity ${runId}`,
    tenantId: ids.tenantId,
    taxRate: 1.5,
  })
  assert.equal(invalidBusinessEntityTaxRate.response.status, 400)
  assert.equal(invalidBusinessEntityTaxRate.payload.code, 'INVALID_BUSINESS_ENTITY_TAX_RATE')

  const invalidBusinessEntitySettlementDay = await post('/api/v1/org/legal-entities', {
    entityId: `entity-invalid-settlement-${runId}`,
    entityCode: `ENTITY_INVALID_SETTLEMENT_${runId.toUpperCase()}`,
    entityName: `Phase3 Invalid Settlement Entity ${runId}`,
    tenantId: ids.tenantId,
    settlementDay: 40,
  })
  assert.equal(invalidBusinessEntitySettlementDay.response.status, 400)
  assert.equal(invalidBusinessEntitySettlementDay.payload.code, 'INVALID_BUSINESS_ENTITY_SETTLEMENT_DAY')

  const primaryStoreCreate = await post('/api/v1/org/stores', {
    storeId: ids.primaryStoreId,
    storeCode: ids.primaryStoreCode,
    storeName: `Phase3 Primary Store ${runId}`,
    unitCode: 'P3-001',
    projectId,
    externalStoreId: `ext-store-${runId}`,
    syncedAt: '2026-04-25T13:00:00.000Z',
    version: 4,
  }, {
    headers: {
      'idempotency-key': `test-create-primary-store-${runId}`,
    },
  })
  assert.equal(primaryStoreCreate.response.status, 201)
  assert.equal(primaryStoreCreate.payload.data.payload.data.active_contract_id, null)
  assert.equal(primaryStoreCreate.payload.data.payload.data.external_store_id, `ext-store-${runId}`)
  assert.equal(primaryStoreCreate.payload.data.payload.data.synced_at, '2026-04-25T13:00:00.000Z')
  assert.equal(primaryStoreCreate.payload.data.payload.data.version, 4)

  const primaryContractCreate = await post('/api/v1/org/contracts', {
    contractId: ids.primaryContractId,
    contractNo: `CTR-PHASE3-${runId}`,
    contractType: 'LEASE',
    externalContractNo: `EXT-CTR-${runId}`,
    syncedAt: '2026-04-25T14:00:00.000Z',
    storeId: ids.primaryStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-b',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2025-05-01',
    endDate: '2027-04-30',
    commissionType: 'FIXED_RATE',
    commissionRate: 8.5,
    depositAmount: 5000000,
  }, {
    headers: {
      'idempotency-key': `test-create-primary-contract-${runId}`,
    },
  })
  assert.equal(primaryContractCreate.response.status, 201)
  assert.equal(primaryContractCreate.payload.data.entityId, ids.primaryContractId)
  assert.equal(primaryContractCreate.payload.data.status, 'PENDING')
  assert.equal(primaryContractCreate.payload.data.payload.data.lessor_phase_id, 'phase-b')
  assert.equal(primaryContractCreate.payload.data.payload.data.lessor_owner_name, `Phase3 Owner B ${runId}`)
  assert.equal(primaryContractCreate.payload.data.payload.data.lessee_tenant_name, `Phase3 Tenant ${runId}`)
  assert.equal(primaryContractCreate.payload.data.payload.data.lessee_brand_name, `Phase3 Brand ${runId}`)
  assert.equal(primaryContractCreate.payload.data.payload.data.contract_no, `CTR-PHASE3-${runId}`)
  assert.equal(primaryContractCreate.payload.data.payload.data.contract_type, 'LEASE')
  assert.equal(primaryContractCreate.payload.data.payload.data.external_contract_no, `EXT-CTR-${runId}`)
  assert.equal(primaryContractCreate.payload.data.payload.data.synced_at, '2026-04-25T14:00:00.000Z')

  const duplicateContractNo = await post('/api/v1/org/contracts', {
    contractId: `contract-phase3-duplicate-${runId}`,
    contractNo: `CTR-PHASE3-${runId}`,
    storeId: ids.primaryStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-b',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2028-01-01',
    endDate: '2028-12-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 8.5,
    depositAmount: 5000000,
  })
  assert.equal(duplicateContractNo.response.status, 409)
  assert.equal(duplicateContractNo.payload.code, 'CONTRACT_NO_ALREADY_EXISTS')

  const primaryActivate = await post(`/api/v1/org/contracts/${ids.primaryContractId}/activate`, {
    remark: 'phase3 primary activation',
  })
  assert.equal(primaryActivate.response.status, 200)
  assert.equal(primaryActivate.payload.data.status, 'ACTIVE')

  const directStoreSnapshotPatch = await patchEntity('store', ids.primaryStoreId, {
    data: {
      tenant_id: `tenant-forbidden-${runId}`,
    },
  })
  assert.equal(directStoreSnapshotPatch.response.status, 400)
  assert.equal(directStoreSnapshotPatch.payload.code, 'READONLY_FIELD_CHANGED')
  assert.equal(directStoreSnapshotPatch.payload.error.details.field, 'tenant_id')

  const replacementCreate = await post('/api/v1/org/contracts', {
    contractId: ids.replacementContractId,
    contractNo: `CTR-PHASE3-REPLACEMENT-${runId}`,
    storeId: ids.primaryStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-b',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2031-01-01',
    endDate: '2031-12-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 9.0,
    depositAmount: 6000000,
  }, {
    headers: {
      'idempotency-key': `test-create-replacement-contract-${runId}`,
    },
  })
  assert.equal(replacementCreate.response.status, 201)
  assert.equal(replacementCreate.payload.data.status, 'PENDING')

  const replacementActivate = await post(`/api/v1/org/contracts/${ids.replacementContractId}/activate`, {
    remark: 'phase3 replacement activation',
  })
  assert.equal(replacementActivate.response.status, 409)
  assert.equal(replacementActivate.payload.code, 'CONTRACT_NOT_STARTED')

  const contractsAfterReplacement = await get('/api/v1/org/contracts?page=1&size=100')
  const primaryContractAfterReplacement = contractsAfterReplacement.data.find(item => item.entityId === ids.primaryContractId)
  const replacementContractAfterActivation = contractsAfterReplacement.data.find(item => item.entityId === ids.replacementContractId)
  assert.equal(primaryContractAfterReplacement.status, 'ACTIVE')
  assert.equal(replacementContractAfterActivation.status, 'PENDING')

  const projectOwnerMutation = await request(`/api/v1/customer/entities/project/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        ...projectCreate.payload.data.payload.data,
        project_phases: [
          {
            phase_id: 'phase-a',
            phase_name: '一期',
            owner_name: `Phase3 Owner A Updated ${runId}`,
            owner_contact: 'Owner A Changed',
            owner_phone: '13800001011',
          },
          {
            phase_id: 'phase-b',
            phase_name: '二期',
            owner_name: `Phase3 Owner B Updated ${runId}`,
            owner_contact: 'Owner B Changed',
            owner_phone: '13800001012',
          },
        ],
      },
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-phase-owner-${runId}`,
    },
  })
  assert.equal(projectOwnerMutation.response.status, 200)
  const contractsAfterProjectOwnerMutation = await get('/api/v1/org/contracts?page=1&size=100')
  const primaryContractAfterProjectOwnerMutation = contractsAfterProjectOwnerMutation.data.find(item => item.entityId === ids.primaryContractId)
  assert.equal(primaryContractAfterProjectOwnerMutation.payload.data.lessor_owner_name, `Phase3 Owner B ${runId}`)

  const directContractSnapshotPatch = await patchEntity('contract', ids.primaryContractId, {
    data: {
      lessor_owner_name: `Forbidden Owner ${runId}`,
    },
  })
  assert.equal(directContractSnapshotPatch.response.status, 400)
  assert.equal(directContractSnapshotPatch.payload.code, 'READONLY_FIELD_CHANGED')
  assert.equal(directContractSnapshotPatch.payload.error.details.field, 'lessor_owner_name')

  const amendResponse = await post(`/api/v1/org/contracts/${ids.primaryContractId}/amend`, {
    endDate: '2027-12-31',
    commissionRate: 9.5,
    remark: 'phase3 amend contract',
  }, {
    headers: {
      'idempotency-key': `test-amend-contract-${runId}`,
    },
  })
  assert.equal(amendResponse.response.status, 200)
  assert.equal(amendResponse.payload.data.entityId, ids.primaryContractId)
  assert.equal(amendResponse.payload.data.payload.data.end_date, '2027-12-31')
  assert.equal(amendResponse.payload.data.payload.data.commission_rate, 9.5)
  assert.equal(amendResponse.payload.data.payload.data.lessor_owner_name, `Phase3 Owner B ${runId}`)

  const pendingTerminate = await post(`/api/v1/org/contracts/${ids.replacementContractId}/terminate`, {
    reason: 'cancel signed future contract',
  })
  assert.equal(pendingTerminate.response.status, 200)
  assert.equal(pendingTerminate.payload.data.status, 'TERMINATED')

  const renewResponse = await post(`/api/v1/org/contracts/${ids.primaryContractId}/renew`, {
    newEndDate: '2029-12-31',
    commissionRate: 10.2,
    remark: 'phase3 renew contract',
  }, {
    headers: {
      'idempotency-key': `test-renew-contract-${runId}`,
    },
  })
  assert.equal(renewResponse.response.status, 200)
  assert.equal(renewResponse.payload.data.originalContractId, ids.primaryContractId)
  assert.equal(renewResponse.payload.data.status, 'PENDING')
  assert.equal(renewResponse.payload.data.originalStatus, 'EXPIRED')
  assert.equal(typeof renewResponse.payload.data.newContractId, 'string')

  const renewedContractId = renewResponse.payload.data.newContractId
  const contractsAfterRenew = await get('/api/v1/org/contracts?page=1&size=100')
  const primaryAfterRenew = contractsAfterRenew.data.find(item => item.entityId === ids.primaryContractId)
  const renewedContract = contractsAfterRenew.data.find(item => item.entityId === renewedContractId)
  assert.equal(primaryAfterRenew.status, 'EXPIRED')
  assert.equal(renewedContract.status, 'PENDING')
  assert.equal(renewedContract.payload.data.end_date, '2029-12-31')
  assert.equal(renewedContract.payload.data.commission_rate, 10.2)
  assert.equal(renewedContract.payload.data.lessor_owner_name, `Phase3 Owner B ${runId}`)

  const storesAfterRenew = await get('/api/v1/org/stores?page=1&size=100')
  const primaryStoreAfterRenew = storesAfterRenew.data.find(item => item.entityId === ids.primaryStoreId)
  assert.equal(primaryStoreAfterRenew.payload.data.active_contract_id, null)
  assert.equal(primaryStoreAfterRenew.payload.data.tenant_id, null)
  assert.equal(primaryStoreAfterRenew.payload.data.brand_id, null)
  assert.equal(primaryStoreAfterRenew.payload.data.entity_id, null)

  const terminateResponse = await post(`/api/v1/org/contracts/${renewedContractId}/terminate`, {
    reason: 'phase3 terminate renewed contract',
  })
  assert.equal(terminateResponse.response.status, 200)
  assert.equal(terminateResponse.payload.data.status, 'TERMINATED')
  assert.equal(terminateResponse.payload.data.payload.data.termination_reason, 'phase3 terminate renewed contract')
  assert.equal(typeof terminateResponse.payload.data.payload.data.terminated_at, 'string')
  assert.equal(terminateResponse.payload.data.payload.data.terminated_by, 'mock-admin-operator')

  const storesAfterTerminate = await get('/api/v1/org/stores?page=1&size=100')
  const primaryStoreAfterTerminate = storesAfterTerminate.data.find(item => item.entityId === ids.primaryStoreId)
  assert.equal(primaryStoreAfterTerminate.payload.data.active_contract_id, null)
  assert.equal(primaryStoreAfterTerminate.payload.data.tenant_id, null)
  assert.equal(primaryStoreAfterTerminate.payload.data.brand_id, null)
  assert.equal(primaryStoreAfterTerminate.payload.data.entity_id, null)

  const suspendStoreCreate = await post('/api/v1/org/stores', {
    storeId: ids.suspendStoreId,
    storeCode: ids.suspendStoreCode,
    storeName: `Phase3 Suspend Store ${runId}`,
    unitCode: 'P3-002',
    projectId,
  }, {
    headers: {
      'idempotency-key': `test-create-suspend-store-${runId}`,
    },
  })
  assert.equal(suspendStoreCreate.response.status, 201)

  const suspendContractCreate = await post('/api/v1/org/contracts', {
    contractId: ids.suspendContractId,
    contractNo: `CTR-PHASE3-SUSPEND-${runId}`,
    storeId: ids.suspendStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-a',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2025-06-01',
    endDate: '2027-05-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 8.8,
    depositAmount: 3000000,
  }, {
    headers: {
      'idempotency-key': `test-create-suspend-contract-${runId}`,
    },
  })
  assert.equal(suspendContractCreate.response.status, 201)
  assert.equal(suspendContractCreate.payload.data.status, 'PENDING')

  const suspendContractActivate = await post(`/api/v1/org/contracts/${ids.suspendContractId}/activate`, {
    remark: 'phase3 suspend tenant setup',
  })
  assert.equal(suspendContractActivate.response.status, 200)
  assert.equal(suspendContractActivate.payload.data.status, 'ACTIVE')

  const suspendTenantResponse = await post(`/api/v1/org/tenants/${ids.tenantId}/suspend`, {
    reason: 'phase3 tenant suspend',
  }, {
    headers: {
      'idempotency-key': `test-suspend-tenant-${runId}`,
    },
  })
  assert.equal(suspendTenantResponse.response.status, 200)
  assert.equal(suspendTenantResponse.payload.data.tenant.entityId, ids.tenantId)
  assert.equal(suspendTenantResponse.payload.data.tenant.status, 'SUSPENDED')
  assert.deepEqual(new Set(suspendTenantResponse.payload.data.affectedStoreIds), new Set([ids.suspendStoreId, expiredStoreId]))

  const storesAfterSuspend = await get('/api/v1/org/stores?page=1&size=100')
  const suspendStoreAfterCascade = storesAfterSuspend.data.find(item => item.entityId === ids.suspendStoreId)
  const primaryStoreAfterCascade = storesAfterSuspend.data.find(item => item.entityId === ids.primaryStoreId)
  assert.equal(suspendStoreAfterCascade.status, 'SUSPENDED')
  assert.equal(primaryStoreAfterCascade.status, 'ACTIVE')

  const contractForSuspendedTenant = await post('/api/v1/org/contracts', {
    contractId: `contract-phase3-suspended-tenant-${runId}`,
    contractNo: `CTR-PHASE3-SUSPENDED-TENANT-${runId}`,
    storeId: ids.primaryStoreId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-a',
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2032-01-01',
    endDate: '2032-12-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 8.8,
    depositAmount: 3000000,
  })
  assert.equal(contractForSuspendedTenant.response.status, 409)
  assert.equal(contractForSuspendedTenant.payload.code, 'TENANT_NOT_ACTIVE')

  const tenantCategoryPatch = await patchEntity('tenant', ids.tenantId, {
    data: {
      tenant_category: 'COFFEE',
    },
  })
  assert.equal(tenantCategoryPatch.response.status, 400)
  assert.equal(tenantCategoryPatch.payload.code, 'TENANT_CATEGORY_FORBIDDEN')

  const brandTenantPatch = await patchEntity('brand', ids.brandId, {
    data: {
      tenant_id: ids.tenantId,
    },
  })
  assert.equal(brandTenantPatch.response.status, 400)
  assert.equal(brandTenantPatch.payload.code, 'BRAND_TENANT_FORBIDDEN')

  const tenantStoresPage = await get(`/api/v1/org/tenants/${ids.tenantId}/stores?page=1&size=100`)
  assert.ok(tenantStoresPage.data.some(item => item.entityId === ids.suspendStoreId))
  assert.ok(!tenantStoresPage.data.some(item => item.entityId === ids.primaryStoreId))

  const contractMonitor = await get(`/api/v1/org/stores/${ids.suspendStoreId}/contract-monitor`)
  assert.equal(contractMonitor.data.store.entityId, ids.suspendStoreId)
  assert.equal(contractMonitor.data.snapshot.activeContractId, ids.suspendContractId)
  assert.equal(contractMonitor.data.snapshot.tenantId, ids.tenantId)
  assert.equal(contractMonitor.data.snapshot.brandId, ids.brandId)
  assert.equal(contractMonitor.data.tenant.entityId, ids.tenantId)
  assert.equal(contractMonitor.data.brand.entityId, ids.brandId)
  assert.ok(contractMonitor.data.contracts.some(item => item.entityId === ids.suspendContractId))
	  assert.ok(contractMonitor.data.timeline.some(item => item.eventType === 'ContractActivated' && item.contractId === ids.suspendContractId))
	  assert.ok(contractMonitor.data.timeline.some(item => item.eventType === 'StoreContractSnapshotUpdated' && item.storeId === ids.suspendStoreId))
	})

test('table master-data endpoints reject transaction and reservation runtime state', async () => {
  const tableId = `table-boundary-${runId}`
  const tableCreate = await post('/api/v1/org/stores/store-kernel-base-test/tables', {
    tableId,
    tableNo: `BND-${runId}`,
    tableName: `Boundary Table ${runId}`,
    area: 'HALL',
    tableType: 'HALL',
    capacity: 4,
    reservable: true,
    consumerDescription: '靠窗桌，适合家庭聚餐',
    minimumSpend: 0,
  }, {
    headers: {
      'idempotency-key': `test-create-boundary-table-${runId}`,
    },
  })
  assert.equal(tableCreate.response.status, 201)
  assert.equal(tableCreate.payload.data.payload.data.table_status, 'AVAILABLE')
  assert.equal(tableCreate.payload.data.payload.data.current_session_id, undefined)

  const tableRuntimePatch = await patchEntity('table', tableId, {
    data: {
      current_session_id: `session-${runId}`,
    },
  })
  assert.equal(tableRuntimePatch.response.status, 400)
  assert.equal(tableRuntimePatch.payload.code, 'TABLE_RUNTIME_FIELD_FORBIDDEN')
  assert.deepEqual(tableRuntimePatch.payload.error.details.fields, ['current_session_id'])

  const tableOccupiedPatch = await patchEntity('table', tableId, {
    status: 'OCCUPIED',
    data: {
      table_status: 'OCCUPIED',
    },
  })
  assert.equal(tableOccupiedPatch.response.status, 400)
  assert.equal(tableOccupiedPatch.payload.code, 'INVALID_TABLE_STATUS')

  const tableStatusChange = await patchEntity('table', tableId, {
    status: 'RESERVED',
  })
  assert.equal(tableStatusChange.response.status, 400)
  assert.equal(tableStatusChange.payload.code, 'INVALID_TABLE_STATUS')

  const storeRuntimePatch = await patchEntity('store', 'store-kernel-base-test', {
    data: {
      current_order_id: `order-${runId}`,
    },
  })
  assert.equal(storeRuntimePatch.response.status, 400)
  assert.equal(storeRuntimePatch.payload.code, 'STORE_RUNTIME_FIELD_FORBIDDEN')
  assert.deepEqual(storeRuntimePatch.payload.error.details.fields, ['current_order_id'])

  const workstationId = `workstation-boundary-${runId}`
  const workstationCreate = await post('/api/v1/org/stores/store-kernel-base-test/workstations', {
    workstationId,
    workstationCode: `WS_BOUNDARY_${runId.toUpperCase()}`,
    workstationName: `Boundary Workstation ${runId}`,
    workstationType: 'PRODUCTION',
    responsibleCategories: ['HOT_DISH'],
    description: '主数据边界测试工作站',
  }, {
    headers: {
      'idempotency-key': `test-create-boundary-workstation-${runId}`,
    },
  })
  assert.equal(workstationCreate.response.status, 201)
  const workstationRuntimePatch = await patchEntity('workstation', workstationId, {
    data: {
      current_work_order_id: `work-order-${runId}`,
    },
  })
  assert.equal(workstationRuntimePatch.response.status, 400)
  assert.equal(workstationRuntimePatch.payload.code, 'WORKSTATION_RUNTIME_FIELD_FORBIDDEN')
  assert.deepEqual(workstationRuntimePatch.payload.error.details.fields, ['current_work_order_id'])
})

test('platform business dictionaries guard master-data attributes without leaking transaction workflows', async () => {
  const demoStoresResponse = await request('/api/v1/org/stores?page=1&size=200', {
    headers: {
      'x-sandbox-id': 'sandbox-customer-real-retail-20260425',
    },
  })
  assert.equal(demoStoresResponse.response.status, 200)
  const demoStoresPage = demoStoresResponse.payload
  const demoButterfulStore = demoStoresPage.data.find(item => item.entityId === 'store-cd-binjiang-butterful')
  assert.ok(demoButterfulStore, 'Butterful demo store should exist')
  assert.ok(
    demoButterfulStore.payload.data.metadata_catalog.table_areas.some(item => item.value === 'HALL' && item.owner_scope === 'STORE' && item.owner_id === 'store-cd-binjiang-butterful'),
    'demo store should expose table area dictionary as store-owned metadata',
  )
  assert.ok(
    demoButterfulStore.payload.data.metadata_catalog.table_types.some(item => item.value === 'HALL' && item.owner_scope === 'STORE' && item.owner_id === 'store-cd-binjiang-butterful'),
    'demo store should expose table type dictionary as store-owned metadata',
  )

  const invalidBrand = await post('/api/v1/org/brands', {
    brandId: `brand-invalid-dictionary-${runId}`,
    brandCode: `BRAND_INVALID_DICT_${runId.toUpperCase()}`,
    brandName: `Invalid Dictionary Brand ${runId}`,
    platformId: 'platform-kernel-base-test',
    brandCategory: `NOT_IN_BRAND_DICTIONARY_${runId.toUpperCase()}`,
  })
  assert.equal(invalidBrand.response.status, 400)
  assert.equal(invalidBrand.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidBrand.payload.error.details.field, 'brand_category')

  const invalidStoreScenario = await post('/api/v1/org/stores', {
    storeId: `store-invalid-scenario-${runId}`,
    storeCode: `STORE_INVALID_SCENARIO_${runId.toUpperCase()}`,
    storeName: `Invalid Scenario Store ${runId}`,
    unitCode: `DICT-${runId}`,
    projectId: 'project-kernel-base-test',
    businessFormat: 'RESTAURANT',
    cooperationMode: 'LEASE',
    businessScenarios: [`NOT_IN_SCENARIO_DICTIONARY_${runId.toUpperCase()}`],
  })
  assert.equal(invalidStoreScenario.response.status, 400)
  assert.equal(invalidStoreScenario.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidStoreScenario.payload.error.details.field, 'business_scenarios')

  const invalidTableType = await post('/api/v1/org/stores/store-kernel-base-test/tables', {
    tableId: `table-invalid-type-${runId}`,
    tableNo: `BAD-TYPE-${runId}`,
    tableName: `Invalid Type Table ${runId}`,
    area: 'HALL',
    tableType: `NOT_IN_TABLE_TYPE_DICTIONARY_${runId.toUpperCase()}`,
    capacity: 4,
  })
  assert.equal(invalidTableType.response.status, 400)
  assert.equal(invalidTableType.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidTableType.payload.error.details.field, 'table_type')

  const invalidTableArea = await post('/api/v1/org/stores/store-kernel-base-test/tables', {
    tableId: `table-invalid-area-${runId}`,
    tableNo: `BAD-AREA-${runId}`,
    tableName: `Invalid Area Table ${runId}`,
    area: `NOT_IN_TABLE_AREA_DICTIONARY_${runId.toUpperCase()}`,
    tableType: 'HALL',
    capacity: 4,
  })
  assert.equal(invalidTableArea.response.status, 400)
  assert.equal(invalidTableArea.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidTableArea.payload.error.details.field, 'area')

  const invalidWorkstationType = await post('/api/v1/org/stores/store-kernel-base-test/workstations', {
    workstationId: `workstation-invalid-type-${runId}`,
    workstationCode: `WS_BAD_TYPE_${runId.toUpperCase()}`,
    workstationName: `Invalid Type Workstation ${runId}`,
    workstationType: `NOT_IN_WORKSTATION_TYPE_DICTIONARY_${runId.toUpperCase()}`,
    responsibleCategories: ['BAKERY'],
  })
  assert.equal(invalidWorkstationType.response.status, 400)
  assert.equal(invalidWorkstationType.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidWorkstationType.payload.error.details.field, 'workstation_type')

  const invalidWorkstationCategory = await post('/api/v1/org/stores/store-kernel-base-test/workstations', {
    workstationId: `workstation-invalid-category-${runId}`,
    workstationCode: `WS_BAD_CATEGORY_${runId.toUpperCase()}`,
    workstationName: `Invalid Category Workstation ${runId}`,
    workstationType: 'PRODUCTION',
    responsibleCategories: [`NOT_IN_PRODUCTION_CATEGORY_DICTIONARY_${runId.toUpperCase()}`],
  })
  assert.equal(invalidWorkstationCategory.response.status, 400)
  assert.equal(invalidWorkstationCategory.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidWorkstationCategory.payload.error.details.field, 'responsible_categories')

  const missingCategoryOwner = await post('/api/v1/product-categories', {
    categoryId: `category-missing-owner-${runId}`,
    categoryCode: `CAT_MISSING_OWNER_${runId.toUpperCase()}`,
    categoryName: `Missing Owner Category ${runId}`,
    ownershipScope: 'BRAND',
    brandId: `brand-not-found-${runId}`,
  })
  assert.equal(missingCategoryOwner.response.status, 404)
  assert.equal(missingCategoryOwner.payload.code, 'PRODUCT_CATEGORY_OWNER_NOT_FOUND')
})

test('organization tree only includes tenants and brands that actually belong to the project branch', async () => {
  const isolatedPlatformId = `platform-tree-${runId}`
  const isolatedProjectId = `project-tree-${runId}`
  const isolatedTenantId = `tenant-tree-${runId}`
  const isolatedBrandId = `brand-tree-${runId}`
  const isolatedEntityId = `entity-tree-${runId}`
  const isolatedStoreId = `store-tree-${runId}`
  const isolatedContractId = `contract-tree-${runId}`

  const platformCreate = await post('/api/v1/org/platforms', {
    platformId: isolatedPlatformId,
    platformCode: `PLATFORM_TREE_${runId.toUpperCase()}`,
    platformName: `Tree Platform ${runId}`,
    description: 'tree branch isolation platform',
    contactName: 'Tree Platform Ops',
    contactPhone: '400-000-3300',
    isvConfig: {
      providerType: 'LOCAL_MOCK_ISV',
      appKey: `tree-app-key-${runId}`,
      appSecret: `tree-app-secret-${runId}`,
      isvToken: `tree-token-${runId}`,
      tokenExpireAt: '2026-12-31T23:59:59.000Z',
      channelStatus: 'ACTIVE',
    },
  }, {
    headers: {
      'idempotency-key': `test-tree-platform-${runId}`,
    },
  })
  assert.equal(platformCreate.response.status, 201)
  const resolvedPlatformId = platformCreate.payload.data.entityId

  const regionId = `region-tree-${runId}`
  const regionCreate = await post('/api/v1/org/regions', {
    regionId,
    platformId: resolvedPlatformId,
    regionCode: `REGION_TREE_${runId.toUpperCase()}`,
    regionName: `Tree Region ${runId}`,
    regionLevel: 1,
  }, {
    headers: {
      'idempotency-key': `test-tree-region-${runId}`,
    },
  })
  assert.equal(regionCreate.response.status, 201)

  const projectCreate = await post('/api/v1/org/projects', {
    projectId: isolatedProjectId,
    projectCode: `PROJECT_TREE_${runId.toUpperCase()}`,
    projectName: `Tree Project ${runId}`,
    platformId: resolvedPlatformId,
    timezone: 'Asia/Shanghai',
    address: 'Tree branch project',
    businessMode: 'SHOPPING_MALL',
    regionId,
  }, {
    headers: {
      'idempotency-key': `test-tree-project-${runId}`,
    },
  })
  assert.equal(projectCreate.response.status, 201)
  const resolvedProjectId = projectCreate.payload.data.entityId

  const tenantCreate = await post('/api/v1/org/tenants', {
    tenantId: isolatedTenantId,
    tenantCode: `TENANT_TREE_${runId.toUpperCase()}`,
    tenantName: `Tree Tenant ${runId}`,
    platformId: resolvedPlatformId,
  }, {
    headers: {
      'idempotency-key': `test-tree-tenant-${runId}`,
    },
  })
  assert.equal(tenantCreate.response.status, 201)

  const brandCreate = await post('/api/v1/org/brands', {
    brandId: isolatedBrandId,
    brandCode: `BRAND_TREE_${runId.toUpperCase()}`,
    brandName: `Tree Brand ${runId}`,
    platformId: resolvedPlatformId,
  }, {
    headers: {
      'idempotency-key': `test-tree-brand-${runId}`,
    },
  })
  assert.equal(brandCreate.response.status, 201)
  assert.equal(brandCreate.payload.data.payload.data.platform_id, resolvedPlatformId)
  assert.equal(brandCreate.payload.data.payload.data.tenant_id, undefined)

  const entityCreate = await post('/api/v1/org/legal-entities', {
    entityId: isolatedEntityId,
    entityCode: `ENTITY_TREE_${runId.toUpperCase()}`,
    entityName: `Tree Entity ${runId}`,
    tenantId: isolatedTenantId,
  }, {
    headers: {
      'idempotency-key': `test-tree-entity-${runId}`,
    },
  })
  assert.equal(entityCreate.response.status, 201)

  const storeCreate = await post('/api/v1/org/stores', {
    storeId: isolatedStoreId,
    storeCode: `STORE_TREE_${runId.toUpperCase()}`,
    storeName: `Tree Store ${runId}`,
    unitCode: 'TREE-001',
    projectId: resolvedProjectId,
  }, {
    headers: {
      'idempotency-key': `test-tree-store-${runId}`,
    },
  })
  assert.equal(storeCreate.response.status, 201)

  const contractCreate = await post('/api/v1/org/contracts', {
    contractId: isolatedContractId,
    contractNo: `CTR-TREE-${runId}`,
    storeId: isolatedStoreId,
    lessorProjectId: resolvedProjectId,
    tenantId: isolatedTenantId,
    brandId: isolatedBrandId,
    entityId: isolatedEntityId,
    startDate: '2025-06-01',
    endDate: '2027-05-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 8.8,
    depositAmount: 3000000,
  }, {
    headers: {
      'idempotency-key': `test-tree-contract-${runId}`,
    },
  })
  assert.equal(contractCreate.response.status, 201)

  const contractActivate = await post(`/api/v1/org/contracts/${isolatedContractId}/activate`, {
    remark: 'tree branch activation',
  })
  assert.equal(contractActivate.response.status, 200)

  const orgTreeResponse = await get('/api/v1/org/tree')
  const isolatedPlatformNode = orgTreeResponse.data.find(item => item.id === resolvedPlatformId)
  assert.ok(isolatedPlatformNode)

  const isolatedProjectNode = isolatedPlatformNode.children.find(item => item.id === resolvedProjectId)
  assert.ok(isolatedProjectNode)
  assert.deepEqual(isolatedProjectNode.children.map(item => item.id), [isolatedBrandId])

  const isolatedBrandNode = isolatedProjectNode.children[0]
  assert.deepEqual(isolatedBrandNode.children.map(item => item.id), [isolatedStoreId])

  const isolatedStoreNode = isolatedBrandNode.children[0]
  assert.equal(isolatedStoreNode.title, `Tree Store ${runId} / Tree Tenant ${runId}`)
})

test('iam workflow routes resolve permission by user binding instead of any role in the catalog', async () => {
  const permissionCreate = await post('/api/v1/permissions', {
    permissionId: ids.permissionId,
    permissionCode: ids.permissionCode,
    permissionName: `Phase4 Permission ${runId}`,
  }, {
    headers: {
      'idempotency-key': `test-create-permission-${runId}`,
    },
  })
  assert.equal(permissionCreate.response.status, 201)
  assert.equal(permissionCreate.payload.data.entityId, ids.permissionId)

  const roleCreate = await post('/api/v1/roles', {
    roleId: ids.roleId,
    roleCode: ids.roleCode,
    roleName: `Phase4 Role ${runId}`,
    scopeType: 'STORE',
    permissionIds: [ids.permissionId],
  }, {
    headers: {
      'idempotency-key': `test-create-role-${runId}`,
    },
  })
  assert.equal(roleCreate.response.status, 201)
  assert.equal(roleCreate.payload.data.entityId, ids.roleId)

  const roleWithMissingPermission = await post('/api/v1/roles', {
    roleId: `role-phase4-missing-${runId}`,
    roleCode: `ROLE_PHASE4_MISSING_${runId.toUpperCase()}`,
    roleName: `Phase4 Missing Permission Role ${runId}`,
    scopeType: 'STORE',
    permissionIds: [`missing-permission-${runId}`],
  })
  assert.equal(roleWithMissingPermission.response.status, 404)
  assert.equal(roleWithMissingPermission.payload.code, 'ROLE_PERMISSION_NOT_FOUND')

  const featurePointCreate = await post('/api/v1/iam/feature-points', {
    featurePointId: ids.iamFeaturePointId,
    platformId: 'platform-kernel-base-test',
    featureCode: ids.iamFeatureCode,
    featureName: `Phase4 Feature ${runId}`,
    isEnabledGlobally: true,
    defaultEnabled: true,
  }, {
    headers: {'idempotency-key': `test-create-feature-point-${runId}`},
  })
  assert.equal(featurePointCreate.response.status, 201)
  assert.equal(featurePointCreate.payload.data.payload.data.platform_id, 'platform-kernel-base-test')

  const permissionGroupCreate = await post('/api/v1/iam/permission-groups', {
    permissionGroupId: ids.iamPermissionGroupId,
    platformId: 'platform-kernel-base-test',
    groupCode: `GROUP_PHASE4_PERMISSION_${runId.toUpperCase()}`,
    groupName: `Phase4 Permission Group ${runId}`,
  }, {
    headers: {'idempotency-key': `test-create-permission-group-${runId}`},
  })
  assert.equal(permissionGroupCreate.response.status, 201)
  assert.equal(permissionGroupCreate.payload.data.payload.data.platform_id, 'platform-kernel-base-test')

  const permissionWithGroupCreate = await post('/api/v1/permissions', {
    permissionId: `perm-phase4-grouped-${runId}`,
    permissionCode: `phase4_grouped:manage_${runId}`,
    permissionName: `Phase4 Grouped Permission ${runId}`,
    permissionGroupId: ids.iamPermissionGroupId,
    featureFlag: ids.iamFeatureCode,
    platformId: 'platform-kernel-base-test',
  }, {
    headers: {'idempotency-key': `test-create-grouped-permission-${runId}`},
  })
  assert.equal(permissionWithGroupCreate.response.status, 201)
  assert.equal(permissionWithGroupCreate.payload.data.payload.data.permission_group_id, ids.iamPermissionGroupId)

  const roleTemplateCreate = await post('/api/v1/iam/role-templates', {
    templateId: ids.iamRoleTemplateId,
    platformId: 'platform-kernel-base-test',
    templateCode: `ROLE_TEMPLATE_PHASE4_${runId.toUpperCase()}`,
    templateName: `Phase4 Role Template ${runId}`,
    basePermissionIds: [ids.permissionId],
    recommendedScopeType: 'STORE',
    isActive: true,
  }, {
    headers: {'idempotency-key': `test-create-role-template-${runId}`},
  })
  assert.equal(roleTemplateCreate.response.status, 201)
  assert.equal(roleTemplateCreate.payload.data.payload.data.platform_id, 'platform-kernel-base-test')

  const roleTemplateMissingPermission = await post('/api/v1/iam/role-templates', {
    templateId: `role-template-phase4-missing-${runId}`,
    platformId: 'platform-kernel-base-test',
    templateCode: `ROLE_TEMPLATE_PHASE4_MISSING_${runId.toUpperCase()}`,
    templateName: `Phase4 Missing Permission Template ${runId}`,
    basePermissionIds: [`missing-permission-${runId}`],
    recommendedScopeType: 'STORE',
    isActive: true,
  })
  assert.equal(roleTemplateMissingPermission.response.status, 404)
  assert.equal(roleTemplateMissingPermission.payload.code, 'ROLE_TEMPLATE_PERMISSION_NOT_FOUND')

  const userCreate = await post('/api/v1/users', {
    userId: ids.userId,
    userCode: ids.userCode,
    displayName: `Phase4 User ${runId}`,
    mobile: '13800000002',
    storeId: 'store-kernel-base-test',
  }, {
    headers: {
      'idempotency-key': `test-create-user-${runId}`,
    },
  })
  assert.equal(userCreate.response.status, 201)
  assert.equal(userCreate.payload.data.entityId, ids.userId)

  const externalUserMissingId = await post('/api/v1/users', {
    userId: `user-phase4-ldap-missing-${runId}`,
    userCode: `user.phase4.ldap.missing.${runId}`,
    displayName: `Phase4 LDAP Missing ${runId}`,
    mobile: '13800000003',
    storeId: 'store-kernel-base-test',
    identitySource: 'LDAP',
  })
  assert.equal(externalUserMissingId.response.status, 400)
  assert.equal(externalUserMissingId.payload.code, 'EXTERNAL_USER_ID_REQUIRED')

  const externalUserCreate = await post('/api/v1/users', {
    userId: `user-phase4-ldap-${runId}`,
    userCode: `user.phase4.ldap.${runId}`,
    displayName: `Phase4 LDAP User ${runId}`,
    mobile: '13800000004',
    storeId: 'store-kernel-base-test',
    identitySource: 'LDAP',
    externalUserId: `ldap-${runId}`,
  }, {
    headers: {'idempotency-key': `test-create-ldap-user-${runId}`},
  })
  assert.equal(externalUserCreate.response.status, 201)
  assert.equal(externalUserCreate.payload.data.payload.data.identity_source, 'LDAP')
  assert.equal(externalUserCreate.payload.data.payload.data.external_user_id, `ldap-${runId}`)
  assert.equal(externalUserCreate.payload.data.payload.data.password_hash, null)

  const denyBeforeBinding = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
  }, {
    headers: {'x-trace-id': `test-auth-deny-before-${runId}`, 'user-agent': 'contract-test/auth-audit'},
  })
  assert.equal(denyBeforeBinding.response.status, 200)
  assert.equal(denyBeforeBinding.payload.data.allowed, false)
  assert.equal(denyBeforeBinding.payload.data.reason, 'NO_MATCHING_ROLE_PERMISSION')
  assert.deepEqual(denyBeforeBinding.payload.data.matchedBindingIds, [])

  const bindingCreate = await post('/api/v1/user-role-bindings', {
    bindingId: ids.bindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    storeId: 'store-kernel-base-test',
  }, {
    headers: {
      'idempotency-key': `test-create-binding-${runId}`,
    },
  })
  assert.equal(bindingCreate.response.status, 201)
  assert.equal(bindingCreate.payload.data.payload.data.user_id, ids.userId)
  assert.equal(bindingCreate.payload.data.payload.data.role_id, ids.roleId)
  assert.equal(bindingCreate.payload.data.payload.data.resource_scope.scope_type, 'STORE')
  assert.equal(bindingCreate.payload.data.payload.data.resource_scope.scope_key, 'store-kernel-base-test')

  const allowById = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
  }, {
    headers: {'x-trace-id': `test-auth-allow-id-${runId}`, 'user-agent': 'contract-test/auth-audit'},
  })
  assert.equal(allowById.response.status, 200)
  assert.equal(allowById.payload.data.allowed, true)
  assert.equal(allowById.payload.data.reason, 'ROLE_PERMISSION_MATCH')
  assert.deepEqual(allowById.payload.data.matchedRoleIds, [ids.roleId])
  assert.deepEqual(allowById.payload.data.matchedBindingIds, [ids.bindingId])

  const allowByCode = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionCode: ids.permissionCode,
  })
  assert.equal(allowByCode.response.status, 200)
  assert.equal(allowByCode.payload.data.allowed, true)
  assert.equal(allowByCode.payload.data.permissionId, ids.permissionId)
  assert.equal(allowByCode.payload.data.permissionCode, ids.permissionCode)

  const effectivePermissions = await get(`/api/v1/users/${ids.userId}/effective-permissions?storeId=store-kernel-base-test`)
  assert.equal(effectivePermissions.data.user.userId, ids.userId)
  assert.equal(effectivePermissions.data.user.userCode, ids.userCode)
  assert.equal(effectivePermissions.data.projection.userTopic, 'iam.user.store-effective')
  assert.equal(effectivePermissions.data.projection.bindingTopic, 'iam.user-role-binding.store-effective')
  assert.equal(effectivePermissions.data.projection.scopeType, 'STORE')
  assert.equal(effectivePermissions.data.projection.scopeKey, 'store-kernel-base-test')
  assert.equal(effectivePermissions.data.projection.userItemKey, ids.userId)
  assert.deepEqual(effectivePermissions.data.projection.bindingItemKeys, [ids.bindingId])
  assert.deepEqual(effectivePermissions.data.permissions.map(item => item.permissionId), [ids.permissionId])
  assert.equal(effectivePermissions.data.security.secretsIncluded, false)
  assert.equal(JSON.stringify(effectivePermissions.data).includes('password_hash'), true)
  assert.equal(JSON.stringify(effectivePermissions.data.user).includes('password_hash'), false)

  const storeEffectiveIam = await get('/api/v1/stores/store-kernel-base-test/effective-iam')
  assert.equal(storeEffectiveIam.data.storeId, 'store-kernel-base-test')
  assert.equal(storeEffectiveIam.data.projection.scopeKey, 'store-kernel-base-test')
  assert.ok(storeEffectiveIam.data.bindingIds.includes(ids.bindingId))
  assert.ok(storeEffectiveIam.data.users.some(item => item.user.userId === ids.userId && item.projection.userItemKey === ids.userId))

  const projectScopeBinding = await post('/api/v1/user-role-bindings', {
    bindingId: ids.projectBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'ORG_NODE',
      org_node_type: 'project',
      org_node_ids: ['project-kernel-base-test'],
    },
  }, {
    headers: {'idempotency-key': `test-create-project-scope-binding-${runId}`},
  })
  assert.equal(projectScopeBinding.response.status, 201)
  assert.equal(projectScopeBinding.payload.data.naturalScopeType, 'ORG_NODE')
  assert.equal(projectScopeBinding.payload.data.payload.data.resource_scope.scope_key, 'project:project-kernel-base-test')
  assert.deepEqual(projectScopeBinding.payload.data.payload.data.resource_scope.org_node_ids, ['project-kernel-base-test'])

  const storeTag = await post('/api/v1/iam/resource-tags', {
    tagId: `tag-phase4-flagship-${runId}`,
    resourceType: 'store',
    resourceId: 'store-kernel-base-test',
    tagKey: 'store-tier',
    tagValue: `flagship-${runId}`,
    tagLabel: '旗舰门店',
  }, {
    headers: {'idempotency-key': `test-create-store-tag-${runId}`},
  })
  assert.equal(storeTag.response.status, 201)

  const tagScopeBinding = await post('/api/v1/user-role-bindings', {
    bindingId: ids.tagBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'TAG',
      tags: [`store-tier:flagship-${runId}`],
    },
  }, {
    headers: {'idempotency-key': `test-create-tag-scope-binding-${runId}`},
  })
  assert.equal(tagScopeBinding.response.status, 201)
  assert.deepEqual(tagScopeBinding.payload.data.payload.data.resource_scope.tags, [`store-tier:flagship-${runId}`])

  const resourceIdsBinding = await post('/api/v1/user-role-bindings', {
    bindingId: ids.resourceBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'RESOURCE_IDS',
      resource_type: 'store',
      resource_ids: ['store-kernel-base-test'],
    },
  }, {
    headers: {'idempotency-key': `test-create-resource-scope-binding-${runId}`},
  })
  assert.equal(resourceIdsBinding.response.status, 201)
  assert.equal(resourceIdsBinding.payload.data.payload.data.resource_scope.scope_key, 'store:store-kernel-base-test')

  const compositeBinding = await post('/api/v1/user-role-bindings', {
    bindingId: ids.compositeBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'COMPOSITE',
      selectors: [
        {scope_type: 'ORG_NODE', org_node_type: 'project', org_node_ids: ['project-kernel-base-test']},
        {scope_type: 'TAG', tags: [`store-tier:flagship-${runId}`]},
      ],
    },
  }, {
    headers: {'idempotency-key': `test-create-composite-binding-${runId}`},
  })
  assert.equal(compositeBinding.response.status, 201)
  assert.equal(compositeBinding.payload.data.payload.data.resource_scope.scope_type, 'COMPOSITE')
  assert.equal(compositeBinding.payload.data.payload.data.resource_scope.selectors.length, 2)

  const duplicateCompositeBinding = await post('/api/v1/user-role-bindings', {
    bindingId: ids.compositeDuplicateBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'COMPOSITE',
      selectors: [
        {scope_type: 'TAG', tags: [`store-tier:flagship-${runId}`]},
        {scope_type: 'ORG_NODE', org_node_type: 'project', org_node_ids: ['project-kernel-base-test']},
      ],
    },
  })
  assert.equal(duplicateCompositeBinding.response.status, 409)
  assert.equal(duplicateCompositeBinding.payload.code, 'USER_ROLE_BINDING_ALREADY_EXISTS')

  const allowByScopeSelector = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionCode: ids.permissionCode,
  })
  assert.equal(allowByScopeSelector.response.status, 200)
  assert.equal(allowByScopeSelector.payload.data.allowed, true)
  assert.ok(allowByScopeSelector.payload.data.matchedBindingIds.includes(ids.projectBindingId))
  assert.ok(allowByScopeSelector.payload.data.matchedBindingIds.includes(ids.tagBindingId))
  assert.ok(allowByScopeSelector.payload.data.matchedBindingIds.includes(ids.resourceBindingId))
  assert.ok(allowByScopeSelector.payload.data.matchedBindingIds.includes(ids.compositeBindingId))

  const principalGroupCreate = await post('/api/v1/iam/principal-groups', {
    groupId: ids.groupId,
    groupCode: `GROUP_PHASE4_${runId.toUpperCase()}`,
    groupName: `Phase4 Group ${runId}`,
    groupType: 'MANUAL',
  }, {
    headers: {'idempotency-key': `test-create-principal-group-${runId}`},
  })
  assert.equal(principalGroupCreate.response.status, 201)

  const groupMemberCreate = await post('/api/v1/iam/group-members', {
    memberId: ids.groupMemberId,
    groupId: ids.groupId,
    userId: ids.userId,
    joinedBy: 'contract-test',
  }, {
    headers: {'idempotency-key': `test-create-group-member-${runId}`},
  })
  assert.equal(groupMemberCreate.response.status, 201)

  const duplicateGroupMemberCreate = await post('/api/v1/iam/group-members', {
    memberId: `group-member-phase4-duplicate-${runId}`,
    groupId: ids.groupId,
    userId: ids.userId,
    joinedBy: 'contract-test',
  })
  assert.equal(duplicateGroupMemberCreate.response.status, 409)
  assert.equal(duplicateGroupMemberCreate.payload.code, 'GROUP_MEMBER_ALREADY_EXISTS')

  const groupBindingCreate = await post('/api/v1/iam/group-role-bindings', {
    groupBindingId: ids.groupBindingId,
    groupId: ids.groupId,
    roleId: ids.roleId,
    scopeType: 'PROJECT',
    scopeId: 'project-kernel-base-test',
  }, {
    headers: {'idempotency-key': `test-create-group-binding-${runId}`},
  })
  assert.equal(groupBindingCreate.response.status, 201)

  const groupOrgNodeBindingCreate = await post('/api/v1/iam/group-role-bindings', {
    groupBindingId: ids.orgNodeGroupBindingId,
    groupId: ids.groupId,
    roleId: ids.roleId,
    resourceScope: {
      scope_type: 'ORG_NODE',
      org_node_type: 'project',
      org_node_ids: ['project-kernel-base-test'],
    },
  }, {
    headers: {'idempotency-key': `test-create-group-org-node-binding-${runId}`},
  })
  assert.equal(groupOrgNodeBindingCreate.response.status, 201)

  const authorizationSessionMissingBinding = await post('/api/v1/iam/authorization-sessions', {
    sessionId: `auth-session-phase4-missing-${runId}`,
    userId: ids.userId,
    platformId: 'platform-kernel-base-test',
    activatedBindingIds: [`missing-binding-${runId}`],
    workingScope: {scope_type: 'STORE', scope_key: 'store-kernel-base-test'},
  })
  assert.equal(authorizationSessionMissingBinding.response.status, 404)
  assert.equal(authorizationSessionMissingBinding.payload.code, 'AUTH_SESSION_BINDING_NOT_FOUND')

  const authorizationSessionCreate = await post('/api/v1/iam/authorization-sessions', {
    sessionId: ids.iamAuthorizationSessionId,
    userId: ids.userId,
    platformId: 'platform-kernel-base-test',
    activatedBindingIds: [ids.bindingId, ids.groupBindingId],
    workingScope: {scope_type: 'STORE', scope_key: 'store-kernel-base-test'},
    mfaVerifiedAt: '2026-04-25T00:00:00.000Z',
    mfaExpiresAt: '2026-04-25T00:30:00.000Z',
    mfaMethod: 'TOTP',
  }, {
    headers: {'idempotency-key': `test-create-authorization-session-${runId}`},
  })
  assert.equal(authorizationSessionCreate.response.status, 201)
  assert.deepEqual(authorizationSessionCreate.payload.data.payload.data.activated_binding_ids, [ids.bindingId, ids.groupBindingId])
  assert.equal(authorizationSessionCreate.payload.data.payload.data.session_token, undefined)
  assert.equal(authorizationSessionCreate.payload.data.payload.data.session_token_masked, null)

  const allowByGroupProjectScope = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionCode: ids.permissionCode,
  })
  assert.equal(allowByGroupProjectScope.response.status, 200)
  assert.equal(allowByGroupProjectScope.payload.data.allowed, true)
  assert.ok(allowByGroupProjectScope.payload.data.matchedBindingIds.includes(ids.bindingId))
  assert.ok(allowByGroupProjectScope.payload.data.matchedBindingIds.includes(ids.groupBindingId))
  assert.ok(allowByGroupProjectScope.payload.data.matchedBindingIds.includes(ids.orgNodeGroupBindingId))

  const denyBindingCreate = await post('/api/v1/user-role-bindings', {
    bindingId: ids.denyBindingId,
    userId: ids.userId,
    roleId: ids.roleId,
    storeId: 'store-kernel-base-test',
    policyEffect: 'DENY',
    reason: 'contract-test deny override',
  }, {
    headers: {'idempotency-key': `test-create-deny-binding-${runId}`},
  })
  assert.equal(denyBindingCreate.response.status, 201)

  const deniedByExplicitDeny = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionCode: ids.permissionCode,
  })
  assert.equal(deniedByExplicitDeny.response.status, 200)
  assert.equal(deniedByExplicitDeny.payload.data.allowed, false)
  assert.equal(deniedByExplicitDeny.payload.data.reason, 'DENY_RULE_HIT')
  assert.deepEqual(deniedByExplicitDeny.payload.data.denyBindingIds, [ids.denyBindingId])

  const denyBindingRevoke = await post(`/api/v1/user-role-bindings/${ids.denyBindingId}/revoke`, {
    reason: 'remove deny override',
  }, {
    headers: {'idempotency-key': `test-revoke-deny-binding-${runId}`},
  })
  assert.equal(denyBindingRevoke.response.status, 200)

  const sodPermissionCreate = await post('/api/v1/permissions', {
    permissionId: ids.sodPermissionId,
    permissionCode: ids.sodPermissionCode,
    permissionName: `Phase4 SoD Permission ${runId}`,
  }, {
    headers: {'idempotency-key': `test-create-sod-permission-${runId}`},
  })
  assert.equal(sodPermissionCreate.response.status, 201)

  const sodRoleCreate = await post('/api/v1/roles', {
    roleId: ids.sodRoleId,
    roleCode: ids.sodRoleCode,
    roleName: `Phase4 SoD Role ${runId}`,
    scopeType: 'STORE',
    permissionIds: [ids.sodPermissionId],
  }, {
    headers: {'idempotency-key': `test-create-sod-role-${runId}`},
  })
  assert.equal(sodRoleCreate.response.status, 201)

  const sodRuleCreate = await post('/api/v1/iam/sod-rules', {
    sodRuleId: `sod-rule-${runId}`,
    ruleName: `Phase4 SoD Rule ${runId}`,
    conflictingRoleCodes: [ids.roleCode, ids.sodRoleCode],
    scopeType: 'STORE',
    isActive: true,
  }, {
    headers: {'idempotency-key': `test-create-sod-rule-${runId}`},
  })
  assert.equal(sodRuleCreate.response.status, 201)

  const invalidSodRuleCreate = await post('/api/v1/iam/sod-rules', {
    sodRuleId: `sod-rule-invalid-${runId}`,
    ruleName: `Phase4 Invalid SoD Rule ${runId}`,
    conflictingRoleCodes: [`MISSING_ROLE_${runId.toUpperCase()}`],
    scopeType: 'STORE',
    isActive: true,
  })
  assert.equal(invalidSodRuleCreate.response.status, 400)
  assert.equal(invalidSodRuleCreate.payload.code, 'SOD_RULE_CONFLICTS_REQUIRED')

  const sodConflictBinding = await post('/api/v1/user-role-bindings', {
    bindingId: `binding-phase4-sod-${runId}`,
    userId: ids.userId,
    roleId: ids.sodRoleId,
    storeId: 'store-kernel-base-test',
  })
  assert.equal(sodConflictBinding.response.status, 409)
  assert.equal(sodConflictBinding.payload.code, 'SOD_RULE_VIOLATION')

  const highRiskPermissionCreate = await post('/api/v1/permissions', {
    permissionId: ids.highRiskPermissionId,
    permissionCode: ids.highRiskPermissionCode,
    permissionName: `Phase4 High Risk Permission ${runId}`,
    highRisk: true,
    requireApproval: true,
  }, {
    headers: {'idempotency-key': `test-create-high-risk-permission-${runId}`},
  })
  assert.equal(highRiskPermissionCreate.response.status, 201)

  const highRiskRoleCreate = await post('/api/v1/roles', {
    roleId: ids.highRiskRoleId,
    roleCode: ids.highRiskRoleCode,
    roleName: `Phase4 High Risk Role ${runId}`,
    scopeType: 'STORE',
    permissionIds: [ids.highRiskPermissionId],
  }, {
    headers: {'idempotency-key': `test-create-high-risk-role-${runId}`},
  })
  assert.equal(highRiskRoleCreate.response.status, 201)

  const highRiskPolicyCreate = await post('/api/v1/iam/high-risk-policies', {
    policyId: `high-risk-policy-${runId}`,
    permissionCode: ids.highRiskPermissionCode,
    requireApproval: true,
    maxDurationDays: 7,
    requireMfa: true,
    isActive: true,
  }, {
    headers: {'idempotency-key': `test-create-high-risk-policy-${runId}`},
  })
  assert.equal(highRiskPolicyCreate.response.status, 201)

  const missingHighRiskPolicyCreate = await post('/api/v1/iam/high-risk-policies', {
    policyId: `high-risk-policy-missing-${runId}`,
    permissionCode: `missing:risk_${runId}`,
    requireApproval: true,
    isActive: true,
  })
  assert.equal(missingHighRiskPolicyCreate.response.status, 404)
  assert.equal(missingHighRiskPolicyCreate.payload.code, 'HIGH_RISK_PERMISSION_NOT_FOUND')

  const invalidHighRiskDurationCreate = await post('/api/v1/iam/high-risk-policies', {
    policyId: `high-risk-policy-duration-${runId}`,
    permissionCode: ids.highRiskPermissionCode,
    requireApproval: true,
    maxDurationDays: 0,
    isActive: true,
  })
  assert.equal(invalidHighRiskDurationCreate.response.status, 400)
  assert.equal(invalidHighRiskDurationCreate.payload.code, 'INVALID_HIGH_RISK_DURATION')

  const highRiskWithoutApproval = await post('/api/v1/user-role-bindings', {
    bindingId: `binding-phase4-risk-no-approval-${runId}`,
    userId: ids.userId,
    roleId: ids.highRiskRoleId,
    storeId: 'store-kernel-base-test',
    effectiveTo: '2026-04-30T00:00:00.000Z',
  })
  assert.equal(highRiskWithoutApproval.response.status, 409)
  assert.equal(highRiskWithoutApproval.payload.code, 'HIGH_RISK_APPROVAL_REQUIRED')

  const highRiskTooLong = await post('/api/v1/user-role-bindings', {
    bindingId: `binding-phase4-risk-too-long-${runId}`,
    userId: ids.userId,
    roleId: ids.highRiskRoleId,
    storeId: 'store-kernel-base-test',
    approvalId: `approval-${runId}`,
    effectiveFrom: '2026-04-20T00:00:00.000Z',
    effectiveTo: '2026-05-20T00:00:00.000Z',
  })
  assert.equal(highRiskTooLong.response.status, 409)
  assert.equal(highRiskTooLong.payload.code, 'HIGH_RISK_DURATION_EXCEEDED')

  const highRiskApproved = await post('/api/v1/user-role-bindings', {
    bindingId: `binding-phase4-risk-approved-${runId}`,
    userId: ids.userId,
    roleId: ids.highRiskRoleId,
    storeId: 'store-kernel-base-test',
    approvalId: `approval-${runId}`,
    effectiveFrom: '2026-04-20T00:00:00.000Z',
    effectiveTo: '2026-04-25T00:00:00.000Z',
  }, {
    headers: {'idempotency-key': `test-create-high-risk-binding-${runId}`},
  })
  assert.equal(highRiskApproved.response.status, 201)

  const userSuspend = await post(`/api/v1/users/${ids.userId}/suspend`, {}, {
    headers: {'idempotency-key': `test-suspend-user-${runId}`},
  })
  assert.equal(userSuspend.response.status, 200)
  assert.equal(userSuspend.payload.data.status, 'SUSPENDED')
  assert.equal(userSuspend.payload.data.payload.data.status, 'SUSPENDED')

  const userActivate = await post(`/api/v1/users/${ids.userId}/activate`, {}, {
    headers: {'idempotency-key': `test-activate-user-${runId}`},
  })
  assert.equal(userActivate.response.status, 200)
  assert.equal(userActivate.payload.data.status, 'ACTIVE')

  const bindingRevoke = await post(`/api/v1/user-role-bindings/${ids.bindingId}/revoke`, {
    reason: 'contract regression revoke',
  }, {
    headers: {
      'idempotency-key': `test-revoke-binding-${runId}`,
      'x-trace-id': `test-auth-revoke-${runId}`,
      'x-actor-id': ids.userId,
      'user-agent': 'contract-test/auth-audit',
    },
  })
  assert.equal(bindingRevoke.response.status, 200)
  assert.equal(bindingRevoke.payload.data.status, 'REVOKED')
  assert.equal(bindingRevoke.payload.data.payload.data.status, 'REVOKED')
  assert.equal(bindingRevoke.payload.data.payload.data.revoke_reason, 'contract regression revoke')
  assert.equal(bindingRevoke.payload.data.payload.data.revoked_by, ids.userId)
  assert.equal(typeof bindingRevoke.payload.data.payload.data.revoked_at, 'string')

  const allowAfterDirectRevokeByGroup = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
  })
  assert.equal(allowAfterDirectRevokeByGroup.response.status, 200)
  assert.equal(allowAfterDirectRevokeByGroup.payload.data.allowed, true)
  assert.equal(allowAfterDirectRevokeByGroup.payload.data.reason, 'ROLE_PERMISSION_MATCH')
  assert.equal(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.bindingId), false)
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.projectBindingId))
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.tagBindingId))
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.resourceBindingId))
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.compositeBindingId))
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.groupBindingId))
  assert.ok(allowAfterDirectRevokeByGroup.payload.data.matchedBindingIds.includes(ids.orgNodeGroupBindingId))

  const denyWrongStore = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-phase3-test',
    permissionId: ids.permissionId,
  }, {
    headers: {'x-trace-id': `test-auth-deny-store-${runId}`, 'user-agent': 'contract-test/auth-audit'},
  })
  assert.equal(denyWrongStore.response.status, 200)
  assert.equal(denyWrongStore.payload.data.allowed, false)
  assert.equal(denyWrongStore.payload.data.reason, 'NO_MATCHING_ROLE_PERMISSION')

  const authAuditLogs = await get('/api/v1/audit-logs?page=1&size=200')
  assert.ok(authAuditLogs.data.some(item =>
    item.eventType === 'PermissionDecisionChecked'
    && item.userId === ids.userId
    && item.permissionCode === ids.permissionCode
    && item.result === 'ALLOWED'
    && item.requestId === `test-auth-allow-id-${runId}`
  ))
  assert.ok(authAuditLogs.data.some(item =>
    item.eventType === 'PermissionDecisionChecked'
    && item.userId === ids.userId
    && item.permissionCode === ids.permissionCode
    && item.result === 'DENIED'
    && item.denyReason === 'NO_MATCHING_ROLE_PERMISSION'
  ))
  assert.ok(authAuditLogs.data.some(item =>
    item.eventType === 'UserRoleBindingRevoked'
    && item.resourceId === ids.bindingId
    && item.action === 'REVOKE_USER_ROLE_BINDING'
    && item.requestId === `test-auth-revoke-${runId}`
  ))

  const roleDeprecate = await post(`/api/v1/roles/${ids.roleId}/deprecate`, {}, {
    headers: {'idempotency-key': `test-deprecate-role-${runId}`},
  })
  assert.equal(roleDeprecate.response.status, 200)
  assert.equal(roleDeprecate.payload.data.status, 'DEPRECATED')

  const roleActivate = await post(`/api/v1/roles/${ids.roleId}/activate`, {}, {
    headers: {'idempotency-key': `test-activate-role-${runId}`},
  })
  assert.equal(roleActivate.response.status, 409)
  assert.equal(roleActivate.payload.code, 'ROLE_DEPRECATED_TERMINAL')

  const deletedUser = await patchEntity('user', ids.userId, {
    title: `Phase4 User ${runId}`,
    status: 'DELETED',
    data: {
      ...userActivate.payload.data.payload.data,
      status: 'DELETED',
    },
  }, {
    headers: {'idempotency-key': `test-delete-user-${runId}`},
  })
  assert.equal(deletedUser.response.status, 200)
  assert.equal(deletedUser.payload.data.status, 'DELETED')

  const deletedUserReactivate = await post(`/api/v1/users/${ids.userId}/activate`, {}, {
    headers: {'idempotency-key': `test-reactivate-deleted-user-${runId}`},
  })
  assert.equal(deletedUserReactivate.response.status, 409)
  assert.equal(deletedUserReactivate.payload.code, 'USER_DELETED_TERMINAL')

  const businessEvents = await get('/api/v1/diagnostics/events?page=1&size=200')
  assert.ok(businessEvents.data.some(item => item.eventType === 'UserRoleBindingRevoked'))
  assert.ok(!businessEvents.data.some(item => item.eventType === 'PermissionDecisionChecked'))
})

test('product/menu/operations workflow routes keep aligned productized master-data chain consistent', async () => {
  const productCreate = await post('/api/v1/products', {
	    productName: `Phase5 Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'STANDARD',
    productNameEn: `Phase5 Product EN ${runId}`,
    priceUnit: 'ITEM',
    imageUrl: `http://127.0.0.1:5830/uploads/customer-assets/product-${runId}.jpg`,
    productImages: [
      `http://127.0.0.1:5830/uploads/customer-assets/product-${runId}-1.jpg`,
      `http://127.0.0.1:5830/uploads/customer-assets/product-${runId}-2.jpg`,
    ],
    description: 'Detailed product description for admin master-data verification',
    allergenInfo: 'Contains dairy',
    nutritionInfo: {calories: 360, protein_g: 18},
    tags: ['新品', '推荐'],
    sortOrder: 18,
    basePrice: 66,
    createdBy: 'contract-test-product-owner',
    updatedBy: 'contract-test-product-editor',
    version: 8,
    productionSteps: [
      {step_code: 'PREPARE', step_name: 'Prepare Bowl', workstation_code: 'HOT_KITCHEN'},
    ],
    modifierGroups: [
      {modifier_group_id: `modifier-${runId}`, group_name: 'Spice Level', selection_type: 'SINGLE'},
    ],
    variants: [
      {variant_id: `variant-${runId}`, variant_name: 'Large Portion'},
    ],
    comboItemGroups: [
      {combo_group_id: `combo-${runId}`, group_name: 'Drink Pairing'},
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-product-${runId}`,
    },
  })
  assert.equal(productCreate.response.status, 201)
  const createdProductId = productCreate.payload.data.entityId
  assert.match(createdProductId, new RegExp(`product-phase5-product-${runId}$`))
  assert.equal(productCreate.payload.data.payload.data.production_steps[0].workstation_code, 'HOT_KITCHEN')
  assert.equal(productCreate.payload.data.payload.data.created_by, 'contract-test-product-owner')
	  assert.equal(productCreate.payload.data.payload.data.updated_by, 'contract-test-product-editor')
	  assert.equal(productCreate.payload.data.payload.data.version, 8)
  assert.equal(productCreate.payload.data.payload.data.product_name_en, `Phase5 Product EN ${runId}`)
  assert.equal(productCreate.payload.data.payload.data.price_unit, 'ITEM')
  assert.equal(productCreate.payload.data.payload.data.product_image_url, `http://127.0.0.1:5830/uploads/customer-assets/product-${runId}.jpg`)
  assert.equal(productCreate.payload.data.payload.data.product_images.length, 2)
  assert.equal(productCreate.payload.data.payload.data.description, 'Detailed product description for admin master-data verification')
  assert.equal(productCreate.payload.data.payload.data.allergen_info, 'Contains dairy')
  assert.equal(productCreate.payload.data.payload.data.nutrition_info.calories, 360)
  assert.deepEqual(productCreate.payload.data.payload.data.tags, ['新品', '推荐'])
  assert.equal(productCreate.payload.data.payload.data.sort_order, 18)
	
	  const productAddOnCreate = await post('/api/v1/products', {
	    productName: `Phase5 Add On ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: 12,
	  })
	  assert.equal(productAddOnCreate.response.status, 201)
	  const addOnProductId = productAddOnCreate.payload.data.entityId

	  const invalidProductPrice = await post('/api/v1/products', {
	    productName: `Invalid Price Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: 0,
	  })
	  assert.equal(invalidProductPrice.response.status, 400)
	  assert.equal(invalidProductPrice.payload.code, 'INVALID_PRODUCT_PRICE')
	
	  const invalidNegativeProductPrice = await post('/api/v1/products', {
	    productName: `Invalid Negative Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: -1,
	  })
	  assert.equal(invalidNegativeProductPrice.response.status, 400)
	  assert.equal(invalidNegativeProductPrice.payload.code, 'INVALID_PRODUCT_PRICE')

	  const invalidProductOwnership = await post('/api/v1/products', {
	    productName: `Invalid Ownership Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    storeId: 'store-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: 18,
	  })
	  assert.equal(invalidProductOwnership.response.status, 400)
	  assert.equal(invalidProductOwnership.payload.code, 'PRODUCT_STORE_FORBIDDEN_FOR_BRAND_SCOPE')

	  const invalidVariantPrice = await post('/api/v1/products', {
	    productName: `Invalid Variant Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: 10,
	    variants: [{variant_name: 'Free', price_delta: -10}],
	  })
	  assert.equal(invalidVariantPrice.response.status, 400)
	  assert.equal(invalidVariantPrice.payload.code, 'INVALID_PRODUCT_VARIANT_PRICE')

	  const invalidModifierGroup = await post('/api/v1/products', {
	    productName: `Invalid Modifier Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'SINGLE',
	    basePrice: 18,
	    modifierGroups: [{group_name: 'Sauce', selection_type: 'MULTIPLE', min_selections: 2, max_selections: 1}],
	  })
	  assert.equal(invalidModifierGroup.response.status, 400)
	  assert.equal(invalidModifierGroup.payload.code, 'INVALID_MODIFIER_GROUP_SELECTION')

	  const invalidComboWithOneProduct = await post('/api/v1/products', {
	    productName: `Invalid Combo Product ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'COMBO',
	    basePrice: 88,
	    comboItems: [{product_id: createdProductId, quantity: 1}],
	  })
	  assert.equal(invalidComboWithOneProduct.response.status, 400)
	  assert.equal(invalidComboWithOneProduct.payload.code, 'COMBO_ITEMS_REQUIRED')

	  const comboProductCreate = await post('/api/v1/products', {
	    productName: `Phase5 Combo ${runId}`,
	    ownershipScope: 'BRAND',
	    brandId: 'brand-kernel-base-test',
	    productType: 'COMBO',
	    basePrice: 98,
    comboPricingStrategy: {
      pricing_type: 'FIXED_TOTAL',
      fixed_total_price: 98,
    },
    comboStockPolicy: {
      check_strategy: 'ALL_OR_NOTHING',
    },
    comboAvailabilityPolicy: {
      time_slots: [{day_of_week: null, start_time: '10:00', end_time: '22:00'}],
      channel_types: ['POS'],
    },
	    comboItems: [
	      {product_id: createdProductId, quantity: 1},
	      {product_id: addOnProductId, quantity: 1},
	    ],
	  })
	  assert.equal(comboProductCreate.response.status, 201)
	  assert.equal(comboProductCreate.payload.data.payload.data.combo_items.length, 2)
  assert.equal(comboProductCreate.payload.data.payload.data.combo_pricing_strategy.pricing_type, 'FIXED_TOTAL')
  assert.equal(comboProductCreate.payload.data.payload.data.combo_stock_policy.check_strategy, 'ALL_OR_NOTHING')
  assert.equal(comboProductCreate.payload.data.payload.data.combo_availability_policy.channel_types[0], 'POS')

  const productSuspend = await post(`/api/v1/products/${createdProductId}/suspend`, {})
  assert.equal(productSuspend.response.status, 200)
  assert.equal(productSuspend.payload.data.status, 'SUSPENDED')

  const productActivate = await post(`/api/v1/products/${createdProductId}/activate`, {})
  assert.equal(productActivate.response.status, 200)
  assert.equal(productActivate.payload.data.status, 'ACTIVE')

  const brandMenuCreate = await post('/api/v1/menus', {
    brandMenuId: ids.brandMenuId,
    brandId: 'brand-kernel-base-test',
    menuName: `Phase6 Brand Menu ${runId}`,
    channelType: 'MINI_PROGRAM',
    menuType: 'FULL_DAY',
    effectiveDate: '2027-01-01',
    expireDate: '2027-12-31',
    allowStoreOverride: false,
    overrideScope: {
      price_overridable: false,
      image_overridable: true,
      availability_overridable: false,
    },
    publishedAt: '2026-04-26T10:00:00.000Z',
    publishedBy: 'menu-admin',
    reviewComment: 'Ready for platform review',
    sections: [
      {
        section_id: `section-${runId}`,
        section_name: 'Seasonal Specials',
        section_type: 'FEATURED',
        display_style: 'CAROUSEL',
        is_required: true,
        display_order: 10,
        products: [{
          product_id: createdProductId,
          display_order: 10,
          standard_price: 68,
          is_featured: true,
          is_mandatory: true,
          daily_quota: 30,
        }],
      },
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-brand-menu-${runId}`,
    },
  })
  assert.equal(brandMenuCreate.response.status, 201)
  assert.equal(brandMenuCreate.payload.data.payload.data.review_status, 'NONE')
  assert.equal(brandMenuCreate.payload.data.payload.data.channel_type, 'MINI_PROGRAM')
  assert.equal(brandMenuCreate.payload.data.payload.data.menu_type, 'FULL_DAY')
  assert.equal(brandMenuCreate.payload.data.payload.data.effective_date, '2027-01-01')
  assert.equal(brandMenuCreate.payload.data.payload.data.expire_date, '2027-12-31')
  assert.equal(brandMenuCreate.payload.data.payload.data.allow_store_override, false)
  assert.equal(brandMenuCreate.payload.data.payload.data.override_scope.price_overridable, false)
  assert.equal(brandMenuCreate.payload.data.payload.data.published_by, 'menu-admin')
  assert.equal(brandMenuCreate.payload.data.payload.data.review_comment, 'Ready for platform review')
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].section_type, 'FEATURED')
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].display_style, 'CAROUSEL')
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].is_required, true)
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].products[0].standard_price, 68)
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].products[0].is_featured, true)
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].products[0].is_mandatory, true)
  assert.equal(brandMenuCreate.payload.data.payload.data.sections[0].products[0].daily_quota, 30)

  const menuSubmit = await post(`/api/v1/menus/${ids.brandMenuId}/submit-review`, {})
  assert.equal(menuSubmit.response.status, 200)
  assert.equal(menuSubmit.payload.data.payload.data.review_status, 'PENDING_REVIEW')

  const menuApprove = await post(`/api/v1/menus/${ids.brandMenuId}/approve`, {})
  assert.equal(menuApprove.response.status, 200, JSON.stringify(menuApprove.payload))
  assert.equal(menuApprove.payload.data.payload.data.review_status, 'APPROVED')

  const approvedMenuInlinePatch = await patchEntity('brand_menu', ids.brandMenuId, {
    data: {
      sections: [],
    },
  })
  assert.equal(approvedMenuInlinePatch.response.status, 409)
  assert.equal(approvedMenuInlinePatch.payload.code, 'MENU_VERSION_IMMUTABLE')

  const conflictingBrandMenu = await post('/api/v1/menus', {
    brandMenuId: `brand-menu-phase6-conflict-${runId}`,
    brandId: 'brand-kernel-base-test',
    menuName: `Phase6 Conflicting Brand Menu ${runId}`,
    channelType: 'MINI_PROGRAM',
    menuType: 'FULL_DAY',
    effectiveDate: '2027-06-01',
    expireDate: '2027-10-31',
    reviewStatus: 'APPROVED',
    sections: [
      {
        section_id: `section-conflict-${runId}`,
        section_name: 'Conflict',
        products: [{product_id: createdProductId, display_order: 10}],
      },
    ],
  })
  assert.equal(conflictingBrandMenu.response.status, 409)
  assert.equal(conflictingBrandMenu.payload.code, 'ACTIVE_BRAND_MENU_CONFLICT')

  const nextBrandMenuVersion = await post('/api/v1/menus', {
    brandMenuId: `brand-menu-phase6-next-${runId}`,
    brandId: 'brand-kernel-base-test',
    menuName: `Phase6 Brand Menu Next ${runId}`,
    channelType: 'MINI_PROGRAM',
    menuType: 'FULL_DAY',
    effectiveDate: '2028-01-01',
    expireDate: '2028-12-31',
    parentMenuId: ids.brandMenuId,
    version: 2,
    createdFromVersion: 1,
    changeSummary: 'New annual version',
    sections: [
      {
        section_id: `section-next-${runId}`,
        section_name: 'Seasonal Specials',
        products: [{product_id: createdProductId, display_order: 10, is_mandatory: true}],
      },
    ],
  })
  assert.equal(nextBrandMenuVersion.response.status, 201)
  assert.equal(nextBrandMenuVersion.payload.data.payload.data.parent_menu_id, ids.brandMenuId)
  assert.equal(nextBrandMenuVersion.payload.data.payload.data.version, 2)
  assert.equal(nextBrandMenuVersion.payload.data.payload.data.change_summary, 'New annual version')

  const storeMenuMissingMandatory = await post('/api/v1/store-menus', {
    menuId: `menu-phase6-missing-mandatory-${runId}`,
    storeId: 'store-kernel-base-test',
    menuName: `Phase6 Missing Mandatory ${runId}`,
    brandMenuId: ids.brandMenuId,
    sections: [
      {
        section_id: `section-missing-${runId}`,
        section_name: 'Empty Local Section',
        products: [{product_id: addOnProductId, display_order: 20}],
      },
    ],
  })
  assert.equal(storeMenuMissingMandatory.response.status, 409)
  assert.equal(storeMenuMissingMandatory.payload.code, 'STORE_MENU_MANDATORY_PRODUCT_MISSING')

  const storeMenuForbiddenOverride = await post('/api/v1/store-menus', {
    menuId: `menu-phase6-forbidden-override-${runId}`,
    storeId: 'store-kernel-base-test',
    menuName: `Phase6 Forbidden Override ${runId}`,
    brandMenuId: ids.brandMenuId,
    sections: [
      {
        section_id: `section-forbidden-${runId}`,
        section_name: 'Seasonal Specials',
        products: [{
          product_id: createdProductId,
          display_order: 10,
          override_price: 70,
          is_inherited: true,
        }],
      },
    ],
  })
  assert.equal(storeMenuForbiddenOverride.response.status, 409)
  assert.equal(storeMenuForbiddenOverride.payload.code, 'STORE_MENU_OVERRIDE_FORBIDDEN')

  const storeMenuCreate = await post('/api/v1/store-menus', {
    menuId: ids.storeMenuId,
    storeId: 'store-kernel-base-test',
    menuName: `Phase6 Store Menu ${runId}`,
    versionHash: `phase6-hash-${runId}`,
    brandMenuId: ids.brandMenuId,
    menuType: 'TIME_SLOT',
    inheritMode: 'PARTIAL',
    effectiveDate: '2026-04-27',
    expireDate: '2026-11-30',
    publishedAt: '2026-04-27T10:00:00.000Z',
    publishedBy: 'store-menu-admin',
    reviewComment: 'Store local menu published',
    sections: [
      {
        section_id: `section-${runId}`,
        section_name: 'Seasonal Specials',
        section_type: 'CATEGORY',
        display_style: 'GRID',
        is_inherited: true,
        display_order: 10,
        products: [{
          product_id: createdProductId,
          display_order: 10,
          is_featured: true,
          daily_quota: 12,
          is_inherited: true,
        }],
      },
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-store-menu-${runId}`,
    },
  })
  assert.equal(storeMenuCreate.response.status, 201)
  assert.equal(storeMenuCreate.payload.data.entityId, ids.storeMenuId)
  assert.equal(storeMenuCreate.payload.data.payload.data.menu_type, 'TIME_SLOT')
  assert.equal(storeMenuCreate.payload.data.payload.data.inherit_mode, 'PARTIAL')
  assert.equal(storeMenuCreate.payload.data.payload.data.effective_date, '2026-04-27')
  assert.equal(storeMenuCreate.payload.data.payload.data.expire_date, '2026-11-30')
  assert.equal(storeMenuCreate.payload.data.payload.data.published_by, 'store-menu-admin')
  assert.equal(storeMenuCreate.payload.data.payload.data.brand_menu_id, ids.brandMenuId)
  assert.equal(storeMenuCreate.payload.data.payload.data.sections[0].section_type, 'CATEGORY')
  assert.equal(storeMenuCreate.payload.data.payload.data.sections[0].is_inherited, true)
  assert.equal(storeMenuCreate.payload.data.payload.data.sections[0].products[0].daily_quota, 12)

  const storeMenuRollback = await post(`/api/v1/store-menus/${ids.storeMenuId}/rollback`, {})
  assert.equal(storeMenuRollback.response.status, 200)
  assert.match(storeMenuRollback.payload.data.payload.data.version_hash, /rollback/)

  const rolledBackMenuPatch = await patchEntity('menu_catalog', ids.storeMenuId, {
    data: {
      menu_name: `Forbidden Store Menu Rename ${runId}`,
    },
  })
  assert.equal(rolledBackMenuPatch.response.status, 409)
  assert.equal(rolledBackMenuPatch.payload.code, 'MENU_VERSION_IMMUTABLE')

  const storeConfigUpdate = await request(`/api/v1/stores/store-kernel-base-test/config`, {
    method: 'PUT',
    body: JSON.stringify({
      businessStatus: 'PAUSED',
      acceptOrder: false,
      operatingStatus: 'PAUSED',
      autoAcceptEnabled: false,
      acceptTimeoutSeconds: 90,
      preparationBufferMinutes: 12,
      maxConcurrentOrders: 24,
      pauseReason: 'MANUAL',
      pausedAt: '2026-04-26T12:00:00.000Z',
      pausedBy: 'store-manager',
      resumeScheduledAt: '2026-04-26T15:00:00.000Z',
      operatingHours: [{
        weekday: 5,
        time_slots: [{
          slot_id: 'lunch',
          slot_name: 'Lunch',
          start_time: '10:00',
          end_time: '14:00',
          menu_id: ids.storeMenuId,
          accept_order_before_minutes: 30,
          stop_order_before_minutes: 15,
        }],
      }],
      specialOperatingDays: [{
        date: '2026-05-01',
        is_closed: false,
        open_time: '11:00',
        close_time: '20:00',
        note: 'Holiday hours',
      }],
      extraChargeRules: [{
        rule_id: `charge-${runId}`,
        rule_name: 'Holiday Fee',
        charge_type: 'SERVICE_FEE',
        calc_type: 'FIXED',
        amount: 5,
        scenes: ['DINE_IN'],
      }],
      version: 9,
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-store-config-${runId}`,
    },
  })
  assert.equal(storeConfigUpdate.response.status, 200)
  assert.equal(storeConfigUpdate.payload.data.payload.data.business_status, 'PAUSED')
  assert.equal(storeConfigUpdate.payload.data.payload.data.accept_order, false)
  assert.equal(storeConfigUpdate.payload.data.payload.data.operating_status, 'PAUSED')
  assert.equal(storeConfigUpdate.payload.data.payload.data.auto_accept_enabled, false)
  assert.equal(storeConfigUpdate.payload.data.payload.data.accept_timeout_seconds, 90)
  assert.equal(storeConfigUpdate.payload.data.payload.data.preparation_buffer_minutes, 12)
  assert.equal(storeConfigUpdate.payload.data.payload.data.max_concurrent_orders, 24)
  assert.equal(storeConfigUpdate.payload.data.payload.data.pause_reason, 'MANUAL')
  assert.equal(storeConfigUpdate.payload.data.payload.data.paused_by, 'store-manager')
  assert.equal(storeConfigUpdate.payload.data.payload.data.resume_scheduled_at, '2026-04-26T15:00:00.000Z')
  assert.equal(storeConfigUpdate.payload.data.payload.data.operating_hours[0].time_slots[0].menu_id, ids.storeMenuId)
  assert.equal(storeConfigUpdate.payload.data.payload.data.operating_hours[0].time_slots[0].accept_order_before_minutes, 30)
  assert.equal(storeConfigUpdate.payload.data.payload.data.special_operating_days[0].date, '2026-05-01')
  assert.equal(storeConfigUpdate.payload.data.payload.data.extra_charge_rules[0].charge_type, 'SERVICE_FEE')
  assert.equal(storeConfigUpdate.payload.data.payload.data.version, 9)

  const inventoryUpdate = await request(`/api/v1/stores/store-kernel-base-test/inventories/${createdProductId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: ids.stockId,
      productId: createdProductId,
      saleableQuantity: 18,
      skuId: `sku-${runId}`,
      stockGranularity: 'SKU',
      stockType: 'DAILY',
      periodId: `period-${runId}`,
      totalQuantity: 18,
      soldQuantity: 0,
      reservedQuantity: 0,
      safetyStock: 5,
      soldOutThreshold: 4,
      reservationTtlSeconds: 900,
      resetPolicy: 'DAILY_RESET',
      lastResetAt: '2026-04-26T06:00:00.000Z',
      ingredientConsumption: [{ingredient_id: `ingredient-${runId}`, quantity: 1}],
      version: 10,
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-inventory-${runId}`,
    },
  })
  assert.equal(inventoryUpdate.response.status, 200)
  assert.equal(inventoryUpdate.payload.data.payload.data.saleable_quantity, 18)
  assert.equal(inventoryUpdate.payload.data.payload.data.total_quantity, 18)
  assert.equal(inventoryUpdate.payload.data.payload.data.reserved_quantity, 0)
  assert.equal(inventoryUpdate.payload.data.payload.data.sku_id, `sku-${runId}`)
  assert.equal(inventoryUpdate.payload.data.payload.data.stock_granularity, 'SKU')
  assert.equal(inventoryUpdate.payload.data.payload.data.stock_type, 'DAILY')
  assert.equal(inventoryUpdate.payload.data.payload.data.period_id, `period-${runId}`)
  assert.equal(inventoryUpdate.payload.data.payload.data.sold_out_threshold, 4)
  assert.equal(inventoryUpdate.payload.data.payload.data.reservation_ttl_seconds, 900)
  assert.equal(inventoryUpdate.payload.data.payload.data.reset_policy, 'DAILY_RESET')
  assert.equal(inventoryUpdate.payload.data.payload.data.last_reset_at, '2026-04-26T06:00:00.000Z')
  assert.equal(inventoryUpdate.payload.data.payload.data.ingredient_consumption[0].ingredient_id, `ingredient-${runId}`)
  assert.equal(inventoryUpdate.payload.data.payload.data.version, 10)

  const invalidThreshold = await request(`/api/v1/stores/store-kernel-base-test/inventories/${createdProductId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: `stock-invalid-threshold-${runId}`,
      productId: createdProductId,
      saleableQuantity: 3,
      totalQuantity: 3,
      soldOutThreshold: 4,
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(invalidThreshold.response.status, 400)
  assert.equal(invalidThreshold.payload.code, 'INVALID_SOLD_OUT_THRESHOLD')

  const bundleRuleWithOneProduct = await post('/api/v1/bundle-price-rules', {
    ruleId: `${ids.bundleRuleId}-invalid`,
    storeId: 'store-kernel-base-test',
    ruleName: `Invalid Bundle Rule ${runId}`,
    triggerProducts: [{product_id: createdProductId, quantity: 1}],
    discountType: 'TOTAL_DISCOUNT',
    discountValue: 3,
  })
  assert.equal(bundleRuleWithOneProduct.response.status, 400)
  assert.equal(bundleRuleWithOneProduct.payload.code, 'BUNDLE_TRIGGER_PRODUCTS_REQUIRED')

  const bundleRuleCreate = await post('/api/v1/bundle-price-rules', {
    ruleId: ids.bundleRuleId,
    storeId: 'store-kernel-base-test',
    ruleName: `Bundle Rule ${runId}`,
    triggerProducts: [
      {product_id: createdProductId, quantity: 1},
      {product_id: addOnProductId, quantity: 1},
    ],
    discountType: 'TOTAL_DISCOUNT',
    discountValue: 5,
  }, {
    headers: {
      'idempotency-key': `test-create-bundle-rule-${runId}`,
    },
  })
  assert.equal(bundleRuleCreate.response.status, 201, JSON.stringify(bundleRuleCreate.payload))
  assert.equal(bundleRuleCreate.payload.data.payload.data.trigger_products.length, 2)

  const bundleRuleMissingProduct = await post('/api/v1/bundle-price-rules', {
    ruleId: `${ids.bundleRuleId}-missing`,
    storeId: 'store-kernel-base-test',
    ruleName: `Missing Product Bundle Rule ${runId}`,
    triggerProducts: [
      {product_id: createdProductId, quantity: 1},
      {product_id: `missing-product-${runId}`, quantity: 1},
    ],
    discountType: 'TOTAL_DISCOUNT',
    discountValue: 5,
  })
  assert.equal(bundleRuleMissingProduct.response.status, 404)
  assert.equal(bundleRuleMissingProduct.payload.code, 'BUNDLE_TRIGGER_PRODUCT_NOT_FOUND')

  const priceRuleCreate = await post('/api/v1/product-price-rules', {
    ruleCode: ids.priceRuleIdHint,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    ruleName: `Lunch POS Price ${runId}`,
    priceType: 'FIXED',
    channelType: 'POS',
    price: 72,
    priceValue: 72,
    timeSlotStart: '10:00',
    timeSlotEnd: '14:00',
    daysOfWeek: ['1', '2', '3', '4', '5'],
    memberTier: 'REGULAR',
    priority: 3,
    discountType: 'AMOUNT_OFF',
    discountValue: 0,
  }, {
    headers: {
      'idempotency-key': `test-create-price-rule-${runId}`,
    },
  })
  assert.equal(priceRuleCreate.response.status, 201)
  assert.equal(priceRuleCreate.payload.data.payload.data.rule_name, `Lunch POS Price ${runId}`)
  assert.equal(priceRuleCreate.payload.data.payload.data.price_type, 'FIXED')
  assert.equal(priceRuleCreate.payload.data.payload.data.price, 72)
  assert.equal(priceRuleCreate.payload.data.payload.data.time_slot_start, '10:00')
  assert.equal(priceRuleCreate.payload.data.payload.data.time_slot_end, '14:00')
  assert.deepEqual(priceRuleCreate.payload.data.payload.data.days_of_week, ['1', '2', '3', '4', '5'])
  assert.equal(priceRuleCreate.payload.data.payload.data.member_tier, 'REGULAR')
  assert.equal(priceRuleCreate.payload.data.payload.data.priority, 3)

  const duplicatePriceRule = await post('/api/v1/product-price-rules', {
    ruleCode: `${ids.priceRuleIdHint}_DUPLICATE`,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    priceType: 'FIXED',
    channelType: 'POS',
    price: 73,
    priceValue: 73,
    timeSlotStart: '10:00',
    timeSlotEnd: '14:00',
    daysOfWeek: ['1', '2', '3', '4', '5'],
    memberTier: 'REGULAR',
    priority: 3,
  })
  assert.equal(duplicatePriceRule.response.status, 409)
  assert.equal(duplicatePriceRule.payload.code, 'PRICE_RULE_CONFLICT')

  const nonOverlappingWeekdayPriceRule = await post('/api/v1/product-price-rules', {
    ruleCode: `${ids.priceRuleIdHint}_WEEKEND`,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    priceType: 'FIXED',
    channelType: 'POS',
    price: 74,
    priceValue: 74,
    timeSlotStart: '10:00',
    timeSlotEnd: '14:00',
    daysOfWeek: ['6', '7'],
    memberTier: 'REGULAR',
    priority: 3,
  })
  assert.equal(nonOverlappingWeekdayPriceRule.response.status, 201)
  assert.deepEqual(nonOverlappingWeekdayPriceRule.payload.data.payload.data.days_of_week, ['6', '7'])

  const invalidPriceRuleDay = await post('/api/v1/product-price-rules', {
    ruleCode: `${ids.priceRuleIdHint}_INVALID_DAY`,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    priceType: 'FIXED',
    channelType: 'POS',
    price: 75,
    priceValue: 75,
    daysOfWeek: ['8'],
  })
  assert.equal(invalidPriceRuleDay.response.status, 400)
  assert.equal(invalidPriceRuleDay.payload.code, 'INVALID_PRICE_RULE_DAY_OF_WEEK')

  const invalidDiscountRate = await post('/api/v1/product-price-rules', {
    ruleCode: `${ids.priceRuleIdHint}_INVALID_RATE`,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    priceType: 'DISCOUNT_RATE',
    channelType: 'ELEME',
    priceValue: 1.2,
    discountValue: 1.2,
  })
  assert.equal(invalidDiscountRate.response.status, 400)
  assert.equal(invalidDiscountRate.payload.code, 'INVALID_PRICE_RULE_VALUE')

  const invalidStoreHours = await request('/api/v1/stores/store-kernel-base-test/config', {
    method: 'PUT',
    body: JSON.stringify({
      operatingHours: [{
        weekday: 6,
        time_slots: [
          {slot_id: 'lunch', start_time: '10:00', end_time: '14:00'},
          {slot_id: 'overlap', start_time: '13:00', end_time: '16:00'},
        ],
      }],
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(invalidStoreHours.response.status, 409)
  assert.equal(invalidStoreHours.payload.code, 'OPERATING_HOURS_OVERLAP')

  const availabilityRuleCreate = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: ids.availabilityRuleIdHint,
    productId: createdProductId,
    channelType: 'TAKEAWAY',
    ruleType: 'TIME_SLOT',
    ruleConfig: {
      allowed_time_slots: [{start_time: '11:00', end_time: '14:00', days_of_week: [1, 2, 3, 4, 5]}],
    },
    available: false,
    priority: 20,
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.999Z',
    updatedBy: 'availability-admin',
  }, {
    headers: {
      'idempotency-key': `test-create-availability-rule-${runId}`,
    },
  })
  assert.equal(availabilityRuleCreate.response.status, 201)
  assert.equal(availabilityRuleCreate.payload.data.payload.data.available, false)
  assert.equal(availabilityRuleCreate.payload.data.payload.data.rule_type, 'TIME_SLOT')
  assert.equal(availabilityRuleCreate.payload.data.payload.data.rule_config.allowed_time_slots[0].start_time, '11:00')
  assert.equal(availabilityRuleCreate.payload.data.payload.data.effective_from, '2026-04-26T00:00:00.000Z')
  assert.equal(availabilityRuleCreate.payload.data.payload.data.updated_by, 'availability-admin')

  const invalidAvailabilityDateRange = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: `${ids.availabilityRuleIdHint}_INVALID_DATE`,
    productId: createdProductId,
    channelType: 'TAKEAWAY',
    ruleType: 'MANUAL',
    effectiveFrom: '2026-12-31T23:59:59.999Z',
    effectiveTo: '2026-04-26T00:00:00.000Z',
  })
  assert.equal(invalidAvailabilityDateRange.response.status, 400)
  assert.equal(invalidAvailabilityDateRange.payload.code, 'INVALID_AVAILABILITY_RULE_DATE_RANGE')

  const invalidAvailabilityTimeSlot = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: `${ids.availabilityRuleIdHint}_INVALID_SLOT`,
    productId: createdProductId,
    channelType: 'TAKEAWAY',
    ruleType: 'TIME_SLOT',
    ruleConfig: {
      allowed_time_slots: [{start_time: '14:00', end_time: '11:00'}],
    },
  })
  assert.equal(invalidAvailabilityTimeSlot.response.status, 400)
  assert.equal(invalidAvailabilityTimeSlot.payload.code, 'INVALID_AVAILABILITY_TIME_SLOT')

  const manualAvailabilityRule = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: `${ids.availabilityRuleIdHint}_MANUAL`,
    productId: createdProductId,
    ruleType: 'MANUAL',
    channelType: 'TAKEAWAY',
    ruleConfig: {
      status: 'AVAILABLE',
      reason: 'Manual availability override for contract verification',
      operator_id: 'availability-admin',
    },
    available: true,
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.999Z',
  })
  assert.equal(manualAvailabilityRule.response.status, 201)
  assert.equal(manualAvailabilityRule.payload.data.payload.data.rule_type, 'MANUAL')
  assert.equal(manualAvailabilityRule.payload.data.payload.data.effective_to, '2026-12-31T23:59:59.999Z')

  const duplicateManualAvailabilityRule = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: `${ids.availabilityRuleIdHint}_DUPLICATE`,
    productId: createdProductId,
    ruleType: 'MANUAL',
    channelType: 'TAKEAWAY',
    available: true,
  })
  assert.equal(duplicateManualAvailabilityRule.response.status, 409)
  assert.equal(duplicateManualAvailabilityRule.payload.code, 'MANUAL_AVAILABILITY_RULE_ALREADY_EXISTS')

  const futureManualAvailabilityRule = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: `${ids.availabilityRuleIdHint}_MANUAL_FUTURE`,
    productId: createdProductId,
    ruleType: 'MANUAL',
    channelType: 'TAKEAWAY',
    available: false,
    effectiveFrom: '2035-01-01T00:00:00.000Z',
    effectiveTo: '2035-12-31T23:59:59.999Z',
  })
  assert.equal(futureManualAvailabilityRule.response.status, 201)
  assert.equal(futureManualAvailabilityRule.payload.data.payload.data.effective_from, '2035-01-01T00:00:00.000Z')

  const soldOut = await post(`/api/v1/products/${createdProductId}/sold-out`, {
    storeId: 'store-kernel-base-test',
    reason: 'MANUAL_STAFF_PAUSE',
  })
  assert.equal(soldOut.response.status, 201)
  assert.equal(soldOut.payload.data.payload.data.available, false)

  const restored = await post(`/api/v1/products/${createdProductId}/restore`, {
    storeId: 'store-kernel-base-test',
  })
  assert.equal(restored.response.status, 201)
  assert.equal(restored.payload.data.payload.data.available, true)

  const occupiedStockUpdate = await request(`/api/v1/stores/store-kernel-base-test/inventories/${createdProductId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: ids.stockId,
      productId: createdProductId,
      totalQuantity: 18,
      soldQuantity: 3,
      reservedQuantity: 4,
      saleableQuantity: 11,
      safetyStock: 5,
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(occupiedStockUpdate.response.status, 200)
  assert.equal(occupiedStockUpdate.payload.data.payload.data.reserved_quantity, 4)
  assert.equal(occupiedStockUpdate.payload.data.payload.data.sold_quantity, 3)
  assert.equal(occupiedStockUpdate.payload.data.payload.data.available_quantity, 11)

  const invalidOccupiedStock = await request(`/api/v1/stores/store-kernel-base-test/inventories/${createdProductId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: `stock-invalid-occupied-${runId}`,
      productId: createdProductId,
      totalQuantity: 6,
      soldQuantity: 3,
      reservedQuantity: 4,
      saleableQuantity: 0,
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(invalidOccupiedStock.response.status, 400)
  assert.equal(invalidOccupiedStock.payload.code, 'INVALID_STOCK_QUANTITY')

  const productsPage = await get('/api/v1/products?page=1&size=100')
  const menusPage = await get('/api/v1/menus?page=1&size=100')
  const storeMenusPage = await get('/api/v1/store-menus?page=1&size=100')
  const configsPage = await get('/api/v1/stores/store-kernel-base-test/config?page=1&size=100')
  const inventoriesPage = await get('/api/v1/stores/store-kernel-base-test/inventories?page=1&size=100')
  const priceRulesPage = await get('/api/v1/stores/store-kernel-base-test/price-rules?page=1&size=100')
  const availabilityRulesPage = await get('/api/v1/stores/store-kernel-base-test/availability-rules?page=1&size=100')
  const menuAvailabilityPage = await get('/api/v1/stores/store-kernel-base-test/menu-availability?page=1&size=100')

  assert.ok(productsPage.data.some(item => item.entityId === createdProductId))
  assert.ok(menusPage.data.some(item => item.entityId === ids.brandMenuId && item.payload.data.review_status === 'APPROVED'))
  assert.ok(storeMenusPage.data.some(item => item.entityId === ids.storeMenuId))
  assert.ok(configsPage.data.some(item => item.payload.data.business_status === 'PAUSED'))
  assert.ok(inventoriesPage.data.some(item => item.entityId === ids.stockId))
  assert.ok(priceRulesPage.data.some(item => item.payload.data.rule_code === ids.priceRuleIdHint))
  assert.ok((await get('/api/v1/bundle-price-rules?page=1&size=100')).data.some(item => item.entityId === ids.bundleRuleId))
  assert.ok(availabilityRulesPage.data.some(item => item.payload.data.rule_code === ids.availabilityRuleIdHint))
  assert.ok(menuAvailabilityPage.data.some(item => item.payload.data.product_id === createdProductId))
})

test('non-default platform productized master-data keeps platform ownership and rejects cross-platform references', async () => {
  const platformId = `platform-phase8-${runId}`
  const regionId = `region-phase8-${runId}`
  const projectId = `project-phase8-${runId}`
  const tenantId = `tenant-phase8-${runId}`
  const brandId = `brand-phase8-${runId}`
  const entityId = `entity-phase8-${runId}`
  const storeId = `store-phase8-${runId}`
  const contractId = `contract-phase8-${runId}`
  const productId = `product-phase8-${runId}`
  const brandMenuId = `brand-menu-phase8-${runId}`
  const storeMenuId = `store-menu-phase8-${runId}`
  const priceRuleCode = `PRICE_PHASE8_${runId.toUpperCase()}`
  const stockId = `stock-phase8-${runId}`

  const platformCreate = await post('/api/v1/org/platforms', {
    platformId,
    platformCode: `PLATFORM_PHASE8_${runId.toUpperCase()}`,
    platformName: `Phase8 Platform ${runId}`,
    metadataCatalog: {
      brand_categories: [{value: 'LIGHT_MEAL', label: '轻食'}],
    },
  }, {
    headers: {'idempotency-key': `test-phase8-platform-${runId}`},
  })
  assert.equal(platformCreate.response.status, 201)
  assert.ok(platformCreate.payload.data.payload.data.metadata_catalog.regions.every(item => item.owner_scope === 'PLATFORM'))
  assert.ok(platformCreate.payload.data.payload.data.metadata_catalog.project_business_modes.some(item => item.value === 'SHOPPING_MALL'))

  const regionCreate = await post('/api/v1/org/regions', {
    regionId,
    platformId,
    regionCode: `REGION_PHASE8_${runId.toUpperCase()}`,
    regionName: `Phase8 Region ${runId}`,
    regionLevel: 1,
  })
  assert.equal(regionCreate.response.status, 201)

  const projectCreate = await post('/api/v1/org/projects', {
    projectId,
    projectCode: `PROJECT_PHASE8_${runId.toUpperCase()}`,
    projectName: `Phase8 Project ${runId}`,
    platformId,
    regionId,
    businessMode: 'SHOPPING_MALL',
    projectPhases: [{
      phase_id: 'phase-main',
      phase_name: '一期',
      owner_name: `Phase8 Owner ${runId}`,
      owner_contact: 'Phase8 Owner Contact',
      owner_phone: '13800008000',
    }],
  })
  assert.equal(projectCreate.response.status, 201)

  const tenantCreate = await post('/api/v1/org/tenants', {
    tenantId,
    tenantCode: `TENANT_PHASE8_${runId.toUpperCase()}`,
    tenantName: `Phase8 Tenant ${runId}`,
    platformId,
    unifiedSocialCreditCode: `USCC_PHASE8_${runId.toUpperCase()}`,
  })
  assert.equal(tenantCreate.response.status, 201)

  const brandCreate = await post('/api/v1/org/brands', {
    brandId,
    brandCode: `BRAND_PHASE8_${runId.toUpperCase()}`,
    brandName: `Phase8 Brand ${runId}`,
    platformId,
    brandCategory: 'LIGHT_MEAL',
  })
  assert.equal(brandCreate.response.status, 201)

  const brandPatch = await patchEntity('brand', brandId, {
    title: brandCreate.payload.data.title,
    status: brandCreate.payload.data.status,
    expectedRevision: brandCreate.payload.data.sourceRevision,
    data: {
      ...brandCreate.payload.data.payload.data,
      metadata_catalog: {
        product_types: [{value: 'SEASONAL_SET', label: '季节限定套餐'}],
        production_categories: [{value: 'TEA_BAR', label: '茶饮吧台'}],
      },
    },
  })
  assert.equal(brandPatch.response.status, 200)
  assert.equal(brandPatch.payload.data.payload.data.metadata_catalog.product_types[0].owner_scope, 'BRAND')
  assert.equal(brandPatch.payload.data.payload.data.metadata_catalog.product_types[0].owner_id, brandId)

  const invalidBrandScopedProduct = await post('/api/v1/products', {
    productId: `product-phase8-invalid-brand-dict-${runId}`,
    productCode: `PRODUCT_PHASE8_INVALID_BRAND_DICT_${runId.toUpperCase()}`,
    productName: `Phase8 Invalid Brand Dictionary Product ${runId}`,
    ownershipScope: 'BRAND',
    brandId,
    productType: `NOT_IN_BRAND_DICT_${runId.toUpperCase()}`,
    basePrice: 12,
  })
  assert.equal(invalidBrandScopedProduct.response.status, 400)
  assert.equal(invalidBrandScopedProduct.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidBrandScopedProduct.payload.error.details.ownerEntityType, 'brand')
  assert.equal(invalidBrandScopedProduct.payload.error.details.ownerId, brandId)

  const entityCreate = await post('/api/v1/org/legal-entities', {
    entityId,
    entityCode: `ENTITY_PHASE8_${runId.toUpperCase()}`,
    entityName: `Phase8 Entity ${runId}`,
    tenantId,
  })
  assert.equal(entityCreate.response.status, 201)

  const storeCreate = await post('/api/v1/org/stores', {
    storeId,
    storeCode: `STORE_PHASE8_${runId.toUpperCase()}`,
    storeName: `Phase8 Store ${runId}`,
    unitCode: `P8-${runId.slice(-4)}`,
    projectId,
    businessScenarios: ['DINE_IN', 'TAKEAWAY'],
  })
  assert.equal(storeCreate.response.status, 201)
  assert.equal(storeCreate.payload.data.payload.data.platform_id, platformId)

  const storePatch = await patchEntity('store', storeId, {
    title: storeCreate.payload.data.title,
    status: storeCreate.payload.data.status,
    expectedRevision: storeCreate.payload.data.sourceRevision,
    data: {
      ...storeCreate.payload.data.payload.data,
      metadata_catalog: {
        table_areas: [{value: 'ROOFTOP', label: '屋顶花园'}],
        channel_types: [{value: 'COMMUNITY_GROUP', label: '社群团购'}],
        price_types: [{value: 'STORE_MEMBER_PRICE', label: '门店会员价'}],
        discount_types: [{value: 'STORE_ONLY', label: '门店专享'}],
        member_tiers: [{value: 'DIAMOND', label: '钻石会员'}],
        availability_rule_types: [{value: 'WEATHER', label: '天气规则'}],
      },
    },
  })
  assert.equal(storePatch.response.status, 200)
  assert.equal(storePatch.payload.data.payload.data.metadata_catalog.table_areas[0].owner_scope, 'STORE')
  assert.equal(storePatch.payload.data.payload.data.metadata_catalog.table_areas[0].owner_id, storeId)

  const invalidStoreScopedTable = await post(`/api/v1/org/stores/${storeId}/tables`, {
    tableId: `table-phase8-invalid-store-dict-${runId}`,
    tableNo: `P8-BAD-${runId}`,
    tableName: `Phase8 Invalid Store Dictionary Table ${runId}`,
    area: `NOT_IN_STORE_DICT_${runId.toUpperCase()}`,
    tableType: 'HALL',
    capacity: 4,
  })
  assert.equal(invalidStoreScopedTable.response.status, 400)
  assert.equal(invalidStoreScopedTable.payload.code, 'CATALOG_VALUE_NOT_DEFINED')
  assert.equal(invalidStoreScopedTable.payload.error.details.ownerEntityType, 'store')
  assert.equal(invalidStoreScopedTable.payload.error.details.ownerId, storeId)

  const contractCreate = await post('/api/v1/org/contracts', {
    contractId,
    contractNo: `CTR-PHASE8-${runId}`,
    storeId,
    lessorProjectId: projectId,
    lessorPhaseId: 'phase-main',
    tenantId,
    brandId,
    entityId,
    startDate: '2026-01-01',
    endDate: '2029-12-31',
    commissionType: 'FIXED_RATE',
    commissionRate: 8,
    depositAmount: 100000,
  })
  assert.equal(contractCreate.response.status, 201)
  assert.equal(contractCreate.payload.data.payload.data.platform_id, platformId)

  const contractActivate = await post(`/api/v1/org/contracts/${contractId}/activate`, {})
  assert.equal(contractActivate.response.status, 200)

  const inlineDictionaryStoreId = `store-phase8-inline-dict-${runId}`
  const inlineDictionaryStore = await post('/api/v1/org/stores', {
    storeId: inlineDictionaryStoreId,
    storeCode: `STORE_PHASE8_INLINE_DICT_${runId.toUpperCase()}`,
    storeName: `Phase8 Inline Dictionary Store ${runId}`,
    unitCode: `P8-INLINE-${runId.slice(-4)}`,
    projectId,
    businessScenarios: ['LATE_NIGHT'],
    metadataCatalog: {
      store_business_scenarios: [{value: 'LATE_NIGHT', label: '夜间档'}],
    },
  })
  assert.equal(inlineDictionaryStore.response.status, 201)
  assert.equal(inlineDictionaryStore.payload.data.payload.data.metadata_catalog.store_business_scenarios[0].owner_scope, 'STORE')
  assert.equal(inlineDictionaryStore.payload.data.payload.data.metadata_catalog.store_business_scenarios[0].owner_id, inlineDictionaryStoreId)

  const productCreate = await post('/api/v1/products', {
    productId,
    productCode: `PRODUCT_PHASE8_${runId.toUpperCase()}`,
    productName: `Phase8 Product ${runId}`,
    ownershipScope: 'BRAND',
    brandId,
    productType: 'SEASONAL_SET',
    basePrice: 38,
  })
  assert.equal(productCreate.response.status, 201)
  assert.equal(productCreate.payload.data.payload.data.product_type, 'SEASONAL_SET')
  assert.equal(productCreate.payload.data.payload.data.platform_id, platformId)
  assertProjectionPlatform({
    sourceEventId: productCreate.payload.data.payload.source_event_id,
    topicKey: 'catering.product.profile',
    platformId,
  })

  const productActivate = await post(`/api/v1/products/${productId}/activate`, {})
  assert.equal(productActivate.response.status, 200)

  const brandMenuCreate = await post('/api/v1/menus', {
    brandMenuId,
    brandId,
    menuName: `Phase8 Brand Menu ${runId}`,
    sections: [{
      section_id: 'phase8-main',
      section_name: '主推',
      display_order: 10,
      products: [{product_id: productId, display_order: 10}],
    }],
  })
  assert.equal(brandMenuCreate.response.status, 201)
  assert.equal(brandMenuCreate.payload.data.payload.data.platform_id, platformId)
  assertProjectionPlatform({
    sourceEventId: brandMenuCreate.payload.data.payload.source_event_id,
    topicKey: 'catering.brand-menu.profile',
    platformId,
  })

  const crossPlatformBrandMenu = await post('/api/v1/menus', {
    brandMenuId: `brand-menu-phase8-cross-${runId}`,
    brandId,
    menuName: `Phase8 Cross Brand Menu ${runId}`,
    reviewStatus: 'APPROVED',
    sections: [{
      section_id: 'cross',
      section_name: '跨集团',
      display_order: 10,
      products: [{product_id: 'product-salmon-bowl', display_order: 10}],
    }],
  })
  assert.equal(crossPlatformBrandMenu.response.status, 409)
  assert.equal(crossPlatformBrandMenu.payload.code, 'MENU_PRODUCT_PLATFORM_MISMATCH')

  const brandMenuApprove = await post(`/api/v1/menus/${brandMenuId}/approve`, {})
  assert.equal(brandMenuApprove.response.status, 200)

  const storeMenuCreate = await post('/api/v1/store-menus', {
    menuId: storeMenuId,
    storeId,
    menuName: `Phase8 Store Menu ${runId}`,
    brandMenuId,
    sections: [{
      section_id: 'phase8-main',
      section_name: '主推',
      display_order: 10,
      products: [{product_id: productId, display_order: 10}],
    }],
  })
  assert.equal(storeMenuCreate.response.status, 201)
  assert.equal(storeMenuCreate.payload.data.payload.data.platform_id, platformId)
  assertProjectionPlatform({
    sourceEventId: storeMenuCreate.payload.data.payload.source_event_id,
    topicKey: 'menu.catalog',
    platformId,
  })

  const crossPlatformStoreMenu = await post('/api/v1/store-menus', {
    menuId: `store-menu-phase8-cross-${runId}`,
    storeId,
    menuName: `Phase8 Cross Store Menu ${runId}`,
    sections: [{
      section_id: 'cross',
      section_name: '跨集团',
      display_order: 10,
      products: [{product_id: 'product-salmon-bowl', display_order: 10}],
    }],
  })
  assert.equal(crossPlatformStoreMenu.response.status, 409)
  assert.equal(crossPlatformStoreMenu.payload.code, 'MENU_PRODUCT_PLATFORM_MISMATCH')

  const priceRuleCreate = await post('/api/v1/product-price-rules', {
    ruleCode: priceRuleCode,
    productId,
    storeId,
    priceType: 'STORE_MEMBER_PRICE',
    channelType: 'COMMUNITY_GROUP',
    discountType: 'STORE_ONLY',
    priceDelta: 2,
  })
  assert.equal(priceRuleCreate.response.status, 201)
  assert.equal(priceRuleCreate.payload.data.payload.data.price_type, 'STORE_MEMBER_PRICE')
  assert.equal(priceRuleCreate.payload.data.payload.data.channel_type, 'COMMUNITY_GROUP')
  assert.equal(priceRuleCreate.payload.data.payload.data.platform_id, platformId)
  assertProjectionPlatform({
    sourceEventId: priceRuleCreate.payload.data.payload.source_event_id,
    topicKey: 'catering.price-rule.profile',
    platformId,
  })

  const crossPlatformPriceRule = await post('/api/v1/product-price-rules', {
    ruleCode: `PRICE_PHASE8_CROSS_${runId.toUpperCase()}`,
    productId: 'product-salmon-bowl',
    storeId,
    priceType: 'STORE_MEMBER_PRICE',
    channelType: 'COMMUNITY_GROUP',
    discountType: 'STORE_ONLY',
    priceDelta: 1,
  })
  assert.equal(crossPlatformPriceRule.response.status, 409)
  assert.equal(crossPlatformPriceRule.payload.code, 'PRICE_RULE_PRODUCT_PLATFORM_MISMATCH')

  const stockUpdate = await request(`/api/v1/stores/${storeId}/inventories/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId,
      totalQuantity: 20,
      soldQuantity: 1,
      reservedQuantity: 2,
      saleableQuantity: 17,
      safetyStock: 3,
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(stockUpdate.response.status, 200)
  assert.equal(stockUpdate.payload.data.payload.data.platform_id, platformId)
  assert.equal(stockUpdate.payload.data.payload.data.available_quantity, 17)
  assertProjectionPlatform({
    sourceEventId: stockUpdate.payload.data.payload.source_event_id,
    topicKey: 'catering.saleable-stock.profile',
    platformId,
  })

  const crossPlatformStock = await request(`/api/v1/stores/${storeId}/inventories/product-salmon-bowl`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: `stock-phase8-cross-${runId}`,
      totalQuantity: 5,
      saleableQuantity: 5,
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(crossPlatformStock.response.status, 409)
  assert.equal(crossPlatformStock.payload.code, 'SALEABLE_STOCK_PRODUCT_PLATFORM_MISMATCH')

  const menuAvailability = await request(`/api/v1/stores/${storeId}/menu-availability/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      available: true,
      effectiveFrom: '2026-04-25T00:00:00.000Z',
    }),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(menuAvailability.response.status, 200)
  assert.equal(menuAvailability.payload.data.payload.data.platform_id, platformId)
  assertProjectionPlatform({
    sourceEventId: menuAvailability.payload.data.payload.source_event_id,
    topicKey: 'menu.availability',
    platformId,
  })

  const crossPlatformMenuAvailability = await request(`/api/v1/stores/${storeId}/menu-availability/product-salmon-bowl`, {
    method: 'PUT',
    body: JSON.stringify({available: true}),
    headers: {'content-type': 'application/json'},
  })
  assert.equal(crossPlatformMenuAvailability.response.status, 409)
  assert.equal(crossPlatformMenuAvailability.payload.code, 'MENU_AVAILABILITY_PLATFORM_MISMATCH')
})
