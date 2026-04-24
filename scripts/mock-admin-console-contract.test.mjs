import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const isolatedDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-admin-console-contract-'))
process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE = path.join(isolatedDbDir, 'mock-admin-mall-tenant-console.sqlite')

import {createApp} from '../0-mock-server/mock-admin-mall-tenant-console/server/src/app/createApp.js'
import {initializeDatabase} from '../0-mock-server/mock-admin-mall-tenant-console/server/src/database/index.js'
import {initializeAlignedMasterData} from '../0-mock-server/mock-admin-mall-tenant-console/server/src/modules/aligned-master-data/service.js'

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
  permissionCode: `PERMISSION_PHASE4_${runId.toUpperCase()}`,
  roleId: `role-phase4-${runId}`,
  roleCode: `ROLE_PHASE4_${runId.toUpperCase()}`,
  userId: `user-phase4-${runId}`,
  userCode: `user.phase4.${runId}`,
  bindingId: `binding-phase4-${runId}`,
  productId: `product-phase5-${runId}`,
  brandMenuId: `brand-menu-phase6-${runId}`,
  storeMenuId: `menu-phase6-${runId}`,
  stockId: `stock-phase7-${runId}`,
  reservationId: `reservation-phase7-${runId}`,
  priceRuleIdHint: `PRICE_PHASE7_${runId.toUpperCase()}`,
  availabilityRuleIdHint: `AVAILABILITY_PHASE7_${runId.toUpperCase()}`,
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

const get = async path => {
  const {response, payload} = await request(path)
  assert.equal(response.status, 200)
  return payload
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
  assert.ok(platformCreate.payload.data.payload.data.isv_config.app_key_masked.includes('*'))
  assert.equal(platformCreate.payload.data.payload.data.isv_config.app_key, undefined)
  assert.equal(platformCreate.payload.data.payload.data.isv_config.app_secret, undefined)
  assert.equal(platformCreate.payload.data.payload.data.isv_config.isv_token, undefined)

  const projectId = `project-phase2-${runId}`
  const projectCreate = await post('/api/v1/org/projects', {
    projectId,
    projectCode: `PROJECT_PHASE2_${runId.toUpperCase()}`,
    projectName: `Phase2 Project ${runId}`,
    platformId: createdPlatformId,
    timezone: 'Asia/Shanghai',
    address: 'Shenzhen Nanshan District',
    businessMode: 'SHOPPING_MALL',
    region: {
      region_code: 'CN-SZ',
      region_name: 'Shenzhen',
      parent_region_code: 'CN-GD',
      region_level: 2,
    },
  }, {
    headers: {
      'idempotency-key': `test-create-project-${runId}`,
    },
  })
  assert.equal(projectCreate.response.status, 201)
  assert.match(projectCreate.payload.data.entityId, new RegExp(`${projectId}$`))
  assert.equal(projectCreate.payload.data.payload.data.platform_id, createdPlatformId)
  assert.equal(projectCreate.payload.data.payload.data.region.region_code, 'CN-SZ')

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
  const tenantCreate = await post('/api/v1/org/tenants', {
    tenantId: ids.tenantId,
    tenantCode: ids.tenantCode,
    tenantName: `Phase3 Tenant ${runId}`,
  }, {
    headers: {
      'idempotency-key': `test-create-tenant-${runId}`,
    },
  })
  assert.equal(tenantCreate.response.status, 201)
  assert.equal(tenantCreate.payload.data.entityId, ids.tenantId)

  const brandCreate = await post('/api/v1/org/brands', {
    brandId: ids.brandId,
    brandCode: ids.brandCode,
    brandName: `Phase3 Brand ${runId}`,
    tenantId: ids.tenantId,
  }, {
    headers: {
      'idempotency-key': `test-create-brand-${runId}`,
    },
  })
  assert.equal(brandCreate.response.status, 201)
  assert.equal(brandCreate.payload.data.entityId, ids.brandId)

  const entityCreate = await post('/api/v1/org/legal-entities', {
    entityId: ids.entityId,
    entityCode: ids.entityCode,
    entityName: `Phase3 Entity ${runId}`,
    tenantId: ids.tenantId,
  }, {
    headers: {
      'idempotency-key': `test-create-entity-${runId}`,
    },
  })
  assert.equal(entityCreate.response.status, 201)
  assert.equal(entityCreate.payload.data.entityId, ids.entityId)

  const primaryStoreCreate = await post('/api/v1/org/stores', {
    storeId: ids.primaryStoreId,
    storeCode: ids.primaryStoreCode,
    storeName: `Phase3 Primary Store ${runId}`,
    unitCode: 'P3-001',
    projectId: 'project-kernel-base-test',
  }, {
    headers: {
      'idempotency-key': `test-create-primary-store-${runId}`,
    },
  })
  assert.equal(primaryStoreCreate.response.status, 201)
  assert.equal(primaryStoreCreate.payload.data.payload.data.active_contract_id, null)

  const primaryContractCreate = await post('/api/v1/org/contracts', {
    contractId: ids.primaryContractId,
    contractNo: `CTR-PHASE3-${runId}`,
    storeId: ids.primaryStoreId,
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2026-05-01',
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
  assert.equal(primaryContractCreate.payload.data.status, 'DRAFT')

  const primaryActivate = await post(`/api/v1/org/contracts/${ids.primaryContractId}/activate`, {
    remark: 'phase3 primary activation',
  })
  assert.equal(primaryActivate.response.status, 200)
  assert.equal(primaryActivate.payload.data.status, 'ACTIVE')

  const replacementCreate = await post('/api/v1/org/contracts', {
    contractId: ids.replacementContractId,
    contractNo: `CTR-PHASE3-REPLACEMENT-${runId}`,
    storeId: ids.primaryStoreId,
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2027-05-01',
    endDate: '2028-04-30',
    commissionType: 'FIXED_RATE',
    commissionRate: 9.0,
    depositAmount: 6000000,
  }, {
    headers: {
      'idempotency-key': `test-create-replacement-contract-${runId}`,
    },
  })
  assert.equal(replacementCreate.response.status, 201)
  assert.equal(replacementCreate.payload.data.status, 'DRAFT')

  const replacementActivate = await post(`/api/v1/org/contracts/${ids.replacementContractId}/activate`, {
    remark: 'phase3 replacement activation',
  })
  assert.equal(replacementActivate.response.status, 200)
  assert.equal(replacementActivate.payload.data.entityId, ids.replacementContractId)
  assert.equal(replacementActivate.payload.data.status, 'ACTIVE')

  const contractsAfterReplacement = await get('/api/v1/org/contracts?page=1&size=100')
  const primaryContractAfterReplacement = contractsAfterReplacement.data.find(item => item.entityId === ids.primaryContractId)
  const replacementContractAfterActivation = contractsAfterReplacement.data.find(item => item.entityId === ids.replacementContractId)
  assert.equal(primaryContractAfterReplacement.status, 'INACTIVE')
  assert.equal(replacementContractAfterActivation.status, 'ACTIVE')

  const amendResponse = await post(`/api/v1/org/contracts/${ids.replacementContractId}/amend`, {
    endDate: '2028-12-31',
    commissionRate: 9.5,
    remark: 'phase3 amend contract',
  }, {
    headers: {
      'idempotency-key': `test-amend-contract-${runId}`,
    },
  })
  assert.equal(amendResponse.response.status, 200)
  assert.equal(amendResponse.payload.data.entityId, ids.replacementContractId)
  assert.equal(amendResponse.payload.data.payload.data.end_date, '2028-12-31')
  assert.equal(amendResponse.payload.data.payload.data.commission_rate, 9.5)

  const renewResponse = await post(`/api/v1/org/contracts/${ids.replacementContractId}/renew`, {
    newEndDate: '2029-12-31',
    commissionRate: 10.2,
    remark: 'phase3 renew contract',
  }, {
    headers: {
      'idempotency-key': `test-renew-contract-${runId}`,
    },
  })
  assert.equal(renewResponse.response.status, 200)
  assert.equal(renewResponse.payload.data.originalContractId, ids.replacementContractId)
  assert.equal(renewResponse.payload.data.status, 'ACTIVE')
  assert.equal(typeof renewResponse.payload.data.newContractId, 'string')

  const renewedContractId = renewResponse.payload.data.newContractId
  const contractsAfterRenew = await get('/api/v1/org/contracts?page=1&size=100')
  const replacementAfterRenew = contractsAfterRenew.data.find(item => item.entityId === ids.replacementContractId)
  const renewedContract = contractsAfterRenew.data.find(item => item.entityId === renewedContractId)
  assert.equal(replacementAfterRenew.status, 'INACTIVE')
  assert.equal(renewedContract.status, 'ACTIVE')
  assert.equal(renewedContract.payload.data.end_date, '2029-12-31')
  assert.equal(renewedContract.payload.data.commission_rate, 10.2)

  const storesAfterRenew = await get('/api/v1/org/stores?page=1&size=100')
  const primaryStoreAfterRenew = storesAfterRenew.data.find(item => item.entityId === ids.primaryStoreId)
  assert.equal(primaryStoreAfterRenew.payload.data.active_contract_id, renewedContractId)
  assert.equal(primaryStoreAfterRenew.payload.data.tenant_id, ids.tenantId)
  assert.equal(primaryStoreAfterRenew.payload.data.brand_id, ids.brandId)
  assert.equal(primaryStoreAfterRenew.payload.data.entity_id, ids.entityId)

  const terminateResponse = await post(`/api/v1/org/contracts/${renewedContractId}/terminate`, {
    reason: 'phase3 terminate renewed contract',
  })
  assert.equal(terminateResponse.response.status, 200)
  assert.equal(terminateResponse.payload.data.status, 'INACTIVE')
  assert.equal(terminateResponse.payload.data.payload.data.termination_reason, 'phase3 terminate renewed contract')

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
    projectId: 'project-kernel-base-test',
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
    tenantId: ids.tenantId,
    brandId: ids.brandId,
    entityId: ids.entityId,
    startDate: '2026-06-01',
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
  assert.equal(suspendContractCreate.payload.data.status, 'DRAFT')

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
  assert.deepEqual(suspendTenantResponse.payload.data.affectedStoreIds, [ids.suspendStoreId])

  const storesAfterSuspend = await get('/api/v1/org/stores?page=1&size=100')
  const suspendStoreAfterCascade = storesAfterSuspend.data.find(item => item.entityId === ids.suspendStoreId)
  const primaryStoreAfterCascade = storesAfterSuspend.data.find(item => item.entityId === ids.primaryStoreId)
  assert.equal(suspendStoreAfterCascade.status, 'SUSPENDED')
  assert.equal(primaryStoreAfterCascade.status, 'ACTIVE')

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

  const projectCreate = await post('/api/v1/org/projects', {
    projectId: isolatedProjectId,
    projectCode: `PROJECT_TREE_${runId.toUpperCase()}`,
    projectName: `Tree Project ${runId}`,
    platformId: resolvedPlatformId,
    timezone: 'Asia/Shanghai',
    address: 'Tree branch project',
    businessMode: 'SHOPPING_MALL',
    region: {
      region_code: 'CN-SZ',
      region_name: 'Shenzhen',
      parent_region_code: 'CN-GD',
      region_level: 2,
    },
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
    tenantId: isolatedTenantId,
  }, {
    headers: {
      'idempotency-key': `test-tree-brand-${runId}`,
    },
  })
  assert.equal(brandCreate.response.status, 201)

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
    tenantId: isolatedTenantId,
    brandId: isolatedBrandId,
    entityId: isolatedEntityId,
    startDate: '2026-06-01',
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
  assert.deepEqual(isolatedProjectNode.children.map(item => item.id), [isolatedTenantId])

  const isolatedTenantNode = isolatedProjectNode.children[0]
  assert.deepEqual(isolatedTenantNode.children.map(item => item.id), [isolatedBrandId])

  const isolatedBrandNode = isolatedTenantNode.children[0]
  assert.deepEqual(isolatedBrandNode.children.map(item => item.id), [isolatedStoreId])
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
    scopeType: 'ORG_NODE',
    permissionIds: [ids.permissionId],
  }, {
    headers: {
      'idempotency-key': `test-create-role-${runId}`,
    },
  })
  assert.equal(roleCreate.response.status, 201)
  assert.equal(roleCreate.payload.data.entityId, ids.roleId)

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

  const denyBeforeBinding = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
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

  const allowById = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
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

  const roleSuspend = await post(`/api/v1/roles/${ids.roleId}/suspend`, {}, {
    headers: {'idempotency-key': `test-suspend-role-${runId}`},
  })
  assert.equal(roleSuspend.response.status, 200)
  assert.equal(roleSuspend.payload.data.status, 'SUSPENDED')

  const roleActivate = await post(`/api/v1/roles/${ids.roleId}/activate`, {}, {
    headers: {'idempotency-key': `test-activate-role-${runId}`},
  })
  assert.equal(roleActivate.response.status, 200)
  assert.equal(roleActivate.payload.data.status, 'ACTIVE')

  const bindingRevoke = await post(`/api/v1/user-role-bindings/${ids.bindingId}/revoke`, {
    reason: 'contract regression revoke',
  }, {
    headers: {'idempotency-key': `test-revoke-binding-${runId}`},
  })
  assert.equal(bindingRevoke.response.status, 200)
  assert.equal(bindingRevoke.payload.data.status, 'REVOKED')
  assert.equal(bindingRevoke.payload.data.payload.data.status, 'REVOKED')
  assert.equal(bindingRevoke.payload.data.payload.data.revoke_reason, 'contract regression revoke')

  const denyAfterRevoke = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-kernel-base-test',
    permissionId: ids.permissionId,
  })
  assert.equal(denyAfterRevoke.response.status, 200)
  assert.equal(denyAfterRevoke.payload.data.allowed, false)
  assert.equal(denyAfterRevoke.payload.data.reason, 'NO_MATCHING_ROLE_PERMISSION')

  const denyWrongStore = await post('/internal/auth/check-permission', {
    userId: ids.userId,
    storeId: 'store-phase3-test',
    permissionId: ids.permissionId,
  })
  assert.equal(denyWrongStore.response.status, 200)
  assert.equal(denyWrongStore.payload.data.allowed, false)
  assert.equal(denyWrongStore.payload.data.reason, 'NO_MATCHING_ROLE_PERMISSION')
})

test('product/menu/operations workflow routes keep aligned productized master-data chain consistent', async () => {
  const productCreate = await post('/api/v1/products', {
    productName: `Phase5 Product ${runId}`,
    ownershipScope: 'BRAND',
    brandId: 'brand-kernel-base-test',
    productType: 'STANDARD',
    basePrice: 66,
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
    sections: [
      {
        section_id: `section-${runId}`,
        section_name: 'Seasonal Specials',
        display_order: 10,
        products: [{product_id: createdProductId, display_order: 10}],
      },
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-brand-menu-${runId}`,
    },
  })
  assert.equal(brandMenuCreate.response.status, 201)
  assert.equal(brandMenuCreate.payload.data.payload.data.review_status, 'NONE')

  const menuSubmit = await post(`/api/v1/menus/${ids.brandMenuId}/submit-review`, {})
  assert.equal(menuSubmit.response.status, 200)
  assert.equal(menuSubmit.payload.data.payload.data.review_status, 'PENDING_REVIEW')

  const menuApprove = await post(`/api/v1/menus/${ids.brandMenuId}/approve`, {})
  assert.equal(menuApprove.response.status, 200)
  assert.equal(menuApprove.payload.data.payload.data.review_status, 'APPROVED')

  const storeMenuCreate = await post('/api/v1/store-menus', {
    menuId: ids.storeMenuId,
    storeId: 'store-kernel-base-test',
    menuName: `Phase6 Store Menu ${runId}`,
    versionHash: `phase6-hash-${runId}`,
    sections: [
      {
        section_id: `section-${runId}`,
        section_name: 'Seasonal Specials',
        display_order: 10,
        products: [{product_id: createdProductId, display_order: 10}],
      },
    ],
  }, {
    headers: {
      'idempotency-key': `test-create-store-menu-${runId}`,
    },
  })
  assert.equal(storeMenuCreate.response.status, 201)
  assert.equal(storeMenuCreate.payload.data.entityId, ids.storeMenuId)

  const storeMenuRollback = await post(`/api/v1/store-menus/${ids.storeMenuId}/rollback`, {})
  assert.equal(storeMenuRollback.response.status, 200)
  assert.match(storeMenuRollback.payload.data.payload.data.version_hash, /rollback/)

  const storeConfigUpdate = await request(`/api/v1/stores/store-kernel-base-test/config`, {
    method: 'PUT',
    body: JSON.stringify({
      businessStatus: 'PAUSED',
      acceptOrder: false,
      operatingHours: [{weekday: 5, start: '10:00', end: '23:00'}],
      extraChargeRules: [{rule_id: `charge-${runId}`, rule_name: 'Holiday Fee', amount: 5}],
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-store-config-${runId}`,
    },
  })
  assert.equal(storeConfigUpdate.response.status, 200)
  assert.equal(storeConfigUpdate.payload.data.payload.data.business_status, 'PAUSED')
  assert.equal(storeConfigUpdate.payload.data.payload.data.accept_order, false)

  const inventoryUpdate = await request(`/api/v1/stores/store-kernel-base-test/inventories/${ids.productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stockId: ids.stockId,
      saleableQuantity: 18,
      safetyStock: 5,
    }),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `test-update-inventory-${runId}`,
    },
  })
  assert.equal(inventoryUpdate.response.status, 200)
  assert.equal(inventoryUpdate.payload.data.payload.data.saleable_quantity, 18)

  const priceRuleCreate = await post('/api/v1/product-price-rules', {
    ruleCode: ids.priceRuleIdHint,
    productId: createdProductId,
    storeId: 'store-kernel-base-test',
    priceType: 'STANDARD',
    channelType: 'POS',
    priceDelta: 4,
  }, {
    headers: {
      'idempotency-key': `test-create-price-rule-${runId}`,
    },
  })
  assert.equal(priceRuleCreate.response.status, 201)
  assert.equal(priceRuleCreate.payload.data.payload.data.price_delta, 4)

  const availabilityRuleCreate = await post('/api/v1/stores/store-kernel-base-test/availability-rules', {
    ruleCode: ids.availabilityRuleIdHint,
    productId: createdProductId,
    channelType: 'TAKEAWAY',
    available: false,
  }, {
    headers: {
      'idempotency-key': `test-create-availability-rule-${runId}`,
    },
  })
  assert.equal(availabilityRuleCreate.response.status, 201)
  assert.equal(availabilityRuleCreate.payload.data.payload.data.available, false)

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

  const reservationCreate = await post('/api/v1/stores/store-kernel-base-test/stock-reservations', {
    reservationId: ids.reservationId,
    productId: createdProductId,
    reservedQuantity: 3,
    reservationStatus: 'ACTIVE',
    expiresAt: '2026-04-24T23:30:00.000Z',
  }, {
    headers: {
      'idempotency-key': `test-create-stock-reservation-${runId}`,
    },
  })
  assert.equal(reservationCreate.response.status, 201)
  assert.equal(reservationCreate.payload.data.payload.data.reserved_quantity, 3)

  const productsPage = await get('/api/v1/products?page=1&size=100')
  const menusPage = await get('/api/v1/menus?page=1&size=100')
  const storeMenusPage = await get('/api/v1/store-menus?page=1&size=100')
  const configsPage = await get('/api/v1/stores/store-kernel-base-test/config?page=1&size=100')
  const inventoriesPage = await get('/api/v1/stores/store-kernel-base-test/inventories?page=1&size=100')
  const priceRulesPage = await get('/api/v1/stores/store-kernel-base-test/price-rules?page=1&size=100')
  const availabilityRulesPage = await get('/api/v1/stores/store-kernel-base-test/availability-rules?page=1&size=100')
  const menuAvailabilityPage = await get('/api/v1/stores/store-kernel-base-test/menu-availability?page=1&size=100')
  const reservationsPage = await get('/api/v1/stores/store-kernel-base-test/stock-reservations?page=1&size=100')

  assert.ok(productsPage.data.some(item => item.entityId === createdProductId))
  assert.ok(menusPage.data.some(item => item.entityId === ids.brandMenuId && item.payload.data.review_status === 'APPROVED'))
  assert.ok(storeMenusPage.data.some(item => item.entityId === ids.storeMenuId))
  assert.ok(configsPage.data.some(item => item.payload.data.business_status === 'PAUSED'))
  assert.ok(inventoriesPage.data.some(item => item.entityId === ids.stockId))
  assert.ok(priceRulesPage.data.some(item => item.payload.data.rule_code === ids.priceRuleIdHint))
  assert.ok(availabilityRulesPage.data.some(item => item.payload.data.rule_code === ids.availabilityRuleIdHint))
  assert.ok(menuAvailabilityPage.data.some(item => item.payload.data.product_id === createdProductId))
  assert.ok(reservationsPage.data.some(item => item.entityId === ids.reservationId))
})
