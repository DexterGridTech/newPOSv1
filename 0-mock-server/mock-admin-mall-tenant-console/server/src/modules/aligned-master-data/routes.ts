import {Router} from 'express'
import {TARGET_TDP_BASE_URL} from '../../shared/constants.js'
import {created, ok, okPage, wrapRoute} from '../../shared/http.js'
import {parsePagination} from '../../shared/pagination.js'
import {asString} from '../../shared/utils.js'
import {
  activateContract,
  applyDemoMasterDataChange,
  amendContract,
  captureTerminalObservationSnapshot,
  checkPermissionDecision,
  changeEntityStatus,
  createSandbox,
  createAvailabilityRule,
  createBrand,
  createBrandMenu,
  createBusinessEntity,
  createContract,
  createPermission,
  createPlatform,
  createPriceRule,
  createProduct,
  createProject,
  createRole,
  createStore,
  createStoreConfig,
  createStoreMenu,
  createTableEntity,
  createTenant,
  createUser,
  createUserRoleBinding,
  createWorkstation,
  getAlignedOverview,
  getLegacyDocumentsView,
  getOrgTree,
  getStoreEffectiveIam,
  getStoreContractMonitor,
  getTerminalAuthCapabilities,
  getUserEffectivePermissions,
  listAuditEvents,
  listBrands,
  listBusinessEntities,
  listContracts,
  listSandboxes,
  listAvailabilityRulesByStore,
  listInventories,
  listInventoriesByStore,
  listMenuAvailabilityByStore,
  listMenus,
  listPermissions,
  listPlatforms,
  listPriceRulesByStore,
  listProducts,
  listProjectionDiagnostics,
  listProjects,
  listRoles,
  listStoreConfigs,
  listStoreConfigsByStore,
  listStoreMenus,
  listStores,
  listTables,
  listTablesByStore,
  listTenants,
  listTenantStores,
  listUserRoleBindings,
  listUsers,
  listWorkstations,
  listWorkstationsByStore,
  listStockReservationsByStore,
  rebuildProjectionOutboxFromAlignedState,
  renewContract,
  revokeUserRoleBinding,
  rollbackStoreMenu,
  suspendTenantWithCascade,
  terminateContract,
  upsertMenuAvailability,
  upsertSaleableStock,
  upsertStockReservation,
  updatePlatformIsvCredential,
  updateBrandMenuReviewStatus,
} from './service.js'
import {
  listProjectionOutbox,
  previewProjectionBatch,
  publishProjectionBatch,
  retryProjectionOutbox,
} from '../projection/service.js'

export const createAlignedRouter = () => {
  const router = Router()
  const param = (value: string | string[] | undefined, fallback = '') => Array.isArray(value)
    ? value[0] ?? fallback
    : value ?? fallback

  router.get('/health', wrapRoute((_req, res) => {
    ok(res, {status: 'ok', service: 'mock-admin-mall-tenant-console'})
  }))

  router.get('/api/v1/overview', wrapRoute((req, res) => {
    ok(res, getAlignedOverview(res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/org/sandboxes', wrapRoute((req, res) => {
    okPage(res, listSandboxes(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/sandboxes', wrapRoute((req, res) => {
    created(res, createSandbox({
      sandboxId: req.body.sandboxId,
      sandboxCode: req.body.sandboxCode,
      sandboxName: req.body.sandboxName,
      sandboxType: req.body.sandboxType,
      description: req.body.description,
      owner: req.body.owner,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/sandboxes/:sandboxId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'sandbox',
      entityId: param(req.params.sandboxId),
      status: 'ACTIVE',
      eventType: 'SandboxActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/sandboxes/:sandboxId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'sandbox',
      entityId: param(req.params.sandboxId),
      status: 'SUSPENDED',
      eventType: 'SandboxSuspended',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/sandboxes/:sandboxId/close', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'sandbox',
      entityId: param(req.params.sandboxId),
      status: 'INACTIVE',
      eventType: 'SandboxClosed',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/platforms', wrapRoute((req, res) => {
    okPage(res, listPlatforms(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/platforms', wrapRoute((req, res) => {
    created(res, createPlatform({
      platformCode: req.body.platformCode,
      platformName: req.body.platformName,
      description: req.body.description,
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      isvConfig: req.body.isvConfig,
      mutation: res.locals.requestContext,
    }))
  }))
  router.put('/api/v1/org/platforms/:platformId/isv-credential', wrapRoute((req, res) => {
    ok(res, updatePlatformIsvCredential({
      platformId: param(req.params.platformId),
      providerType: req.body.providerType,
      appKey: req.body.appKey,
      appSecret: req.body.appSecret,
      isvToken: req.body.isvToken,
      tokenExpireAt: req.body.tokenExpireAt,
      channelStatus: req.body.channelStatus,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/platforms/:platformId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'platform',
      entityId: param(req.params.platformId),
      status: 'ACTIVE',
      eventType: 'PlatformActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/platforms/:platformId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'platform',
      entityId: param(req.params.platformId),
      status: 'SUSPENDED',
      eventType: 'PlatformSuspended',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/projects', wrapRoute((req, res) => {
    okPage(res, listProjects(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/projects', wrapRoute((req, res) => {
    created(res, createProject({
      projectCode: req.body.projectCode,
      projectName: req.body.projectName,
      platformId: req.body.platformId,
      timezone: req.body.timezone,
      region: req.body.region,
      address: req.body.address,
      businessMode: req.body.businessMode,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/projects/:projectId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'project',
      entityId: param(req.params.projectId),
      status: 'ACTIVE',
      eventType: 'ProjectActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/projects/:projectId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'project',
      entityId: param(req.params.projectId),
      status: 'SUSPENDED',
      eventType: 'ProjectSuspended',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/tenants', wrapRoute((req, res) => {
    okPage(res, listTenants(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/tenants/:tenantId/stores', wrapRoute((req, res) => {
    okPage(
      res,
      listTenantStores(
        param(req.params.tenantId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/tenants', wrapRoute((req, res) => {
    created(res, createTenant({
      tenantId: req.body.tenantId,
      tenantCode: req.body.tenantCode,
      tenantName: req.body.tenantName,
      platformId: req.body.platformId,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/tenants/:tenantId/suspend', wrapRoute((req, res) => {
    ok(res, suspendTenantWithCascade({
      tenantId: param(req.params.tenantId),
      reason: req.body.reason,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/brands', wrapRoute((req, res) => {
    okPage(res, listBrands(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/brands', wrapRoute((req, res) => {
    created(res, createBrand({
      brandId: req.body.brandId,
      brandCode: req.body.brandCode,
      brandName: req.body.brandName,
      tenantId: req.body.tenantId,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/brands/:brandId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'brand',
      entityId: param(req.params.brandId),
      status: 'ACTIVE',
      eventType: 'BrandActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/brands/:brandId/deactivate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'brand',
      entityId: param(req.params.brandId),
      status: 'INACTIVE',
      eventType: 'BrandDeactivated',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/stores', wrapRoute((req, res) => {
    okPage(res, listStores(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/stores', wrapRoute((req, res) => {
    created(res, createStore({
      storeId: req.body.storeId,
      storeCode: req.body.storeCode,
      storeName: req.body.storeName,
      unitCode: req.body.unitCode,
      projectId: req.body.projectId,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/stores/:storeId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'store',
      entityId: param(req.params.storeId),
      status: 'ACTIVE',
      eventType: 'StoreActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/stores/:storeId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'store',
      entityId: param(req.params.storeId),
      status: 'SUSPENDED',
      eventType: 'StoreSuspended',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/contracts', wrapRoute((req, res) => {
    okPage(res, listContracts(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/stores/:storeId/contract-monitor', wrapRoute((req, res) => {
    ok(res, getStoreContractMonitor(param(req.params.storeId), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/contracts', wrapRoute((req, res) => {
    created(res, createContract({
      contractId: req.body.contractId,
      contractCode: req.body.contractNo ?? req.body.contractCode,
      storeId: req.body.storeId,
      tenantId: req.body.tenantId,
      brandId: req.body.brandId,
      entityId: req.body.entityId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      commissionType: req.body.commissionType,
      commissionRate: req.body.commissionRate,
      depositAmount: req.body.depositAmount,
      attachmentUrl: req.body.attachmentUrl,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/contracts/:contractId/activate', wrapRoute((req, res) => {
    ok(res, activateContract({
      contractId: param(req.params.contractId),
      remark: req.body.remark,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/contracts/:contractId/terminate', wrapRoute((req, res) => {
    ok(res, terminateContract({
      contractId: param(req.params.contractId),
      reason: req.body.reason,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/contracts/:contractId/renew', wrapRoute((req, res) => {
    ok(res, renewContract({
      contractId: param(req.params.contractId),
      newEndDate: req.body.newEndDate,
      commissionRate: req.body.commissionRate,
      remark: req.body.remark,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/contracts/:contractId/amend', wrapRoute((req, res) => {
    ok(res, amendContract({
      contractId: param(req.params.contractId),
      endDate: req.body.endDate,
      commissionRate: req.body.commissionRate,
      remark: req.body.remark,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/tree', wrapRoute((req, res) => {
    ok(res, getOrgTree(res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/org/legal-entities', wrapRoute((req, res) => {
    okPage(res, listBusinessEntities(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/legal-entities', wrapRoute((req, res) => {
    created(res, createBusinessEntity({
      entityId: req.body.entityId,
      entityCode: req.body.entityCode,
      entityName: req.body.entityName,
      tenantId: req.body.tenantId,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/stores/:storeId/tables', wrapRoute((req, res) => {
    okPage(
      res,
      listTablesByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/stores/:storeId/tables', wrapRoute((req, res) => {
    created(res, createTableEntity({
      storeId: param(req.params.storeId),
      tableNo: req.body.tableNo,
      capacity: req.body.capacity,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/stores/:storeId/workstations', wrapRoute((req, res) => {
    okPage(
      res,
      listWorkstationsByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/stores/:storeId/workstations', wrapRoute((req, res) => {
    created(res, createWorkstation({
      storeId: param(req.params.storeId),
      workstationCode: req.body.workstationCode,
      workstationName: req.body.workstationName,
      categoryCodes: req.body.categoryCodes,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/users', wrapRoute((req, res) => {
    okPage(res, listUsers(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/users/:userId/effective-permissions', wrapRoute((req, res) => {
    ok(res, getUserEffectivePermissions({
      userId: param(req.params.userId),
      storeId: asString(req.query.storeId, ''),
      sandboxId: res.locals.requestContext?.sandboxId,
    }))
  }))
  router.post('/api/v1/users', wrapRoute((req, res) => {
    created(res, createUser({
      userId: req.body.userId,
      userCode: req.body.userCode,
      displayName: req.body.displayName,
      mobile: req.body.mobile,
      storeId: req.body.storeId,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/users/:userId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'user',
      entityId: param(req.params.userId),
      status: 'ACTIVE',
      eventType: 'UserActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/users/:userId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'user',
      entityId: param(req.params.userId),
      status: 'SUSPENDED',
      eventType: 'UserSuspended',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/permissions', wrapRoute((req, res) => {
    okPage(res, listPermissions(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/permissions', wrapRoute((req, res) => {
    created(res, createPermission({
      permissionId: req.body.permissionId,
      permissionCode: req.body.permissionCode,
      permissionName: req.body.permissionName,
      permissionType: req.body.permissionType,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/roles', wrapRoute((req, res) => {
    okPage(res, listRoles(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/roles', wrapRoute((req, res) => {
    created(res, createRole({
      roleId: req.body.roleId,
      roleCode: req.body.roleCode,
      roleName: req.body.roleName,
      scopeType: req.body.scopeType,
      permissionIds: req.body.permissionIds,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/roles/:roleId/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'role',
      entityId: param(req.params.roleId),
      status: 'ACTIVE',
      eventType: 'RoleActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/roles/:roleId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'role',
      entityId: param(req.params.roleId),
      status: 'SUSPENDED',
      eventType: 'RoleSuspended',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/user-role-bindings', wrapRoute((req, res) => {
    okPage(res, listUserRoleBindings(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/effective-iam', wrapRoute((req, res) => {
    ok(res, getStoreEffectiveIam({
      storeId: param(req.params.storeId),
      sandboxId: res.locals.requestContext?.sandboxId,
    }))
  }))
  router.post('/api/v1/user-role-bindings', wrapRoute((req, res) => {
    created(res, createUserRoleBinding({
      bindingId: req.body.bindingId,
      userId: req.body.userId,
      roleId: req.body.roleId,
      storeId: req.body.storeId,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/user-role-bindings/:bindingId/revoke', wrapRoute((req, res) => {
    ok(res, revokeUserRoleBinding({
      bindingId: param(req.params.bindingId),
      reason: req.body.reason,
      mutation: res.locals.requestContext,
    }))
  }))

  router.post('/internal/auth/check-permission', wrapRoute((req, res) => {
    ok(res, checkPermissionDecision({
      userId: req.body.userId,
      storeId: req.body.storeId,
      permissionId: req.body.permissionId,
      permissionCode: req.body.permissionCode,
      sandboxId: res.locals.requestContext?.sandboxId,
    }))
  }))

  router.get('/api/v1/audit-logs', wrapRoute((req, res) => {
    okPage(res, listAuditEvents(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/products', wrapRoute((req, res) => {
    okPage(res, listProducts(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/products', wrapRoute((req, res) => {
    created(res, createProduct({
      productId: req.body.productId,
      productName: req.body.productName,
      ownershipScope: req.body.ownershipScope,
      brandId: req.body.brandId,
      storeId: req.body.storeId,
      productType: req.body.productType,
      basePrice: req.body.basePrice,
      productionSteps: req.body.productionSteps,
      modifierGroups: req.body.modifierGroups,
      variants: req.body.variants,
      comboItemGroups: req.body.comboItemGroups,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/products/:id/activate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'product',
      entityId: param(req.params.id),
      status: 'ACTIVE',
      eventType: 'ProductActivated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/products/:id/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'product',
      entityId: param(req.params.id),
      status: 'SUSPENDED',
      eventType: 'ProductSuspended',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/products/:id/sold-out', wrapRoute((req, res) => {
    created(res, upsertMenuAvailability({
      productId: param(req.params.id),
      storeId: req.body.storeId,
      available: false,
      soldOutReason: req.body.reason ?? 'MANUAL_SOLD_OUT',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/products/:id/restore', wrapRoute((req, res) => {
    created(res, upsertMenuAvailability({
      productId: param(req.params.id),
      storeId: req.body.storeId,
      available: true,
      soldOutReason: null,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/menus', wrapRoute((req, res) => {
    okPage(res, listMenus(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/menus', wrapRoute((req, res) => {
    created(res, createBrandMenu({
      brandMenuId: req.body.brandMenuId,
      brandId: req.body.brandId,
      menuName: req.body.menuName,
      sections: req.body.sections,
      reviewStatus: req.body.reviewStatus,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/menus/:id/submit-review', wrapRoute((req, res) => {
    ok(res, updateBrandMenuReviewStatus({
      menuId: param(req.params.id),
      reviewStatus: 'PENDING_REVIEW',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/menus/:id/approve', wrapRoute((req, res) => {
    ok(res, updateBrandMenuReviewStatus({
      menuId: param(req.params.id),
      reviewStatus: 'APPROVED',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/menus/:id/reject', wrapRoute((req, res) => {
    ok(res, updateBrandMenuReviewStatus({
      menuId: param(req.params.id),
      reviewStatus: 'REJECTED',
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/store-menus', wrapRoute((req, res) => {
    okPage(res, listStoreMenus(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/store-menus', wrapRoute((req, res) => {
    created(res, createStoreMenu({
      menuId: req.body.menuId,
      storeId: req.body.storeId,
      menuName: req.body.menuName,
      sections: req.body.sections,
      versionHash: req.body.versionHash,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/store-menus/:id/rollback', wrapRoute((req, res) => {
    ok(res, rollbackStoreMenu({
      menuId: param(req.params.id),
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/stores/:storeId/config', wrapRoute((req, res) => {
    okPage(
      res,
      listStoreConfigsByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.put('/api/v1/stores/:storeId/config', wrapRoute((req, res) => {
    ok(res, createStoreConfig({
      storeId: param(req.params.storeId),
      businessStatus: req.body.businessStatus,
      acceptOrder: req.body.acceptOrder,
      operatingHours: req.body.operatingHours,
      extraChargeRules: req.body.extraChargeRules,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/stores/:storeId/open', wrapRoute((req, res) => {
    ok(res, createStoreConfig({
      storeId: param(req.params.storeId),
      businessStatus: 'OPEN',
      acceptOrder: true,
      operatingHours: req.body.operatingHours,
      extraChargeRules: req.body.extraChargeRules,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/stores/:storeId/close', wrapRoute((req, res) => {
    ok(res, createStoreConfig({
      storeId: param(req.params.storeId),
      businessStatus: 'CLOSED',
      acceptOrder: false,
      operatingHours: req.body.operatingHours,
      extraChargeRules: req.body.extraChargeRules,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/stores/:storeId/inventories', wrapRoute((req, res) => {
    okPage(
      res,
      listInventoriesByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.put('/api/v1/stores/:storeId/inventories/:productId', wrapRoute((req, res) => {
    ok(res, upsertSaleableStock({
      stockId: asString(req.body.stockId, `stock-${param(req.params.productId)}`),
      storeId: param(req.params.storeId),
      productId: param(req.params.productId),
      saleableQuantity: req.body.saleableQuantity,
      safetyStock: req.body.safetyStock,
      mutation: res.locals.requestContext,
    }))
  }))

  router.post('/api/v1/product-price-rules', wrapRoute((req, res) => {
    created(res, createPriceRule({
      ruleCode: req.body.ruleCode,
      productId: req.body.productId,
      storeId: req.body.storeId,
      priceType: req.body.priceType,
      channelType: req.body.channelType,
      priceDelta: req.body.priceDelta,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/stores/:storeId/price-rules', wrapRoute((req, res) => {
    okPage(
      res,
      listPriceRulesByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/stores/:storeId/availability-rules', wrapRoute((req, res) => {
    created(res, createAvailabilityRule({
      ruleCode: req.body.ruleCode,
      storeId: param(req.params.storeId),
      productId: req.body.productId,
      channelType: req.body.channelType,
      available: req.body.available,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/stores/:storeId/availability-rules', wrapRoute((req, res) => {
    okPage(
      res,
      listAvailabilityRulesByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.get('/api/v1/stores/:storeId/menu-availability', wrapRoute((req, res) => {
    okPage(
      res,
      listMenuAvailabilityByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/stores/:storeId/stock-reservations', wrapRoute((req, res) => {
    created(res, upsertStockReservation({
      reservationId: req.body.reservationId,
      storeId: param(req.params.storeId),
      productId: req.body.productId,
      reservedQuantity: req.body.reservedQuantity,
      reservationStatus: req.body.reservationStatus,
      expiresAt: req.body.expiresAt,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/stores/:storeId/stock-reservations', wrapRoute((req, res) => {
    okPage(
      res,
      listStockReservationsByStore(
        param(req.params.storeId),
        parsePagination(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))

  router.get('/api/v1/auth/capabilities', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities())
  }))
  router.post('/api/v1/auth/login', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))
  router.post('/api/v1/auth/logout', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))
  router.post('/api/v1/auth/refresh', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))

  router.get('/api/v1/terminal-auth/capabilities', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities())
  }))
  router.post('/api/v1/terminal-auth/login', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))
  router.post('/api/v1/terminal-auth/logout', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))
  router.post('/api/v1/terminal-auth/user-info-changed', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))

  router.get('/api/v1/diagnostics/legacy/master-data/documents', wrapRoute((_req, res) => {
    ok(res, getLegacyDocumentsView())
  }))
  router.post('/api/v1/diagnostics/master-data/demo-change', wrapRoute((_req, res) => {
    created(res, applyDemoMasterDataChange())
  }))
  router.post('/api/v1/diagnostics/projections/rebuild', wrapRoute((_req, res) => {
    created(res, rebuildProjectionOutboxFromAlignedState(res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/diagnostics/projections/outbox', wrapRoute((req, res) => {
    ok(res, listProjectionOutbox({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    }))
  }))
  router.post('/api/v1/diagnostics/projections/outbox/preview', wrapRoute((_req, res) => {
    ok(res, previewProjectionBatch())
  }))
  router.post('/api/v1/diagnostics/projections/outbox/publish', wrapRoute(async (_req, res) => {
    created(res, await publishProjectionBatch())
  }))
  router.post('/api/v1/diagnostics/projections/outbox/retry', wrapRoute((_req, res) => {
    ok(res, retryProjectionOutbox())
  }))
  router.get('/api/v1/diagnostics/projections/delivery', wrapRoute((req, res) => {
    okPage(res, listProjectionDiagnostics(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/diagnostics/events', wrapRoute((req, res) => {
    okPage(res, listAuditEvents(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/diagnostics/tdp/projections', wrapRoute(async (req, res) => {
    const sandboxId = res.locals.requestContext?.sandboxId
    const response = await fetch(`${TARGET_TDP_BASE_URL}/api/v1/admin/tdp/projections?sandboxId=${sandboxId}`)
    ok(res, await response.json())
  }))
  router.get('/api/v1/diagnostics/terminals/:terminalId/snapshot', wrapRoute(async (req, res) => {
    const sandboxId = res.locals.requestContext?.sandboxId
    const terminalId = param(req.params.terminalId)
    const response = await fetch(`${TARGET_TDP_BASE_URL}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`)
    const payload = await response.json() as Record<string, unknown>
    captureTerminalObservationSnapshot({
      terminalId,
      source: 'snapshot',
      snapshot: payload,
      sandboxId,
    })
    ok(res, payload)
  }))
  router.get('/api/v1/diagnostics/terminals/:terminalId/changes', wrapRoute(async (req, res) => {
    const sandboxId = res.locals.requestContext?.sandboxId
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '0'
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50'
    const response = await fetch(`${TARGET_TDP_BASE_URL}/api/v1/tdp/terminals/${param(req.params.terminalId)}/changes?sandboxId=${sandboxId}&cursor=${cursor}&limit=${limit}`)
    ok(res, await response.json())
  }))

  return router
}
