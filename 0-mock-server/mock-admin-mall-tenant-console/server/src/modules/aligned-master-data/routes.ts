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
  addGroupMember,
  createSandbox,
  createAuthorizationSession,
  createAvailabilityRule,
  createBrand,
  createBrandMenu,
  createBrandMetadata,
  createBundlePriceRule,
  createBusinessEntity,
  createChannelProductMapping,
  createContract,
  createFeaturePoint,
  createGroupRoleBinding,
  createHighRiskPermissionPolicy,
  createIdentityProviderConfig,
  createPermission,
  createPermissionGroup,
  createPlatform,
  createPrincipalGroup,
  createProductCategory,
  createProductInheritance,
  createPriceRule,
  createProduct,
  createProject,
  createRegion,
  createResourceTag,
  createRole,
  createRoleTemplate,
  createSeparationOfDutyRule,
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
  listAvailabilityRules,
  listAuthorizationSessions,
  listBrands,
  listBrandMetadata,
  listBusinessEventDiagnostics,
  listBundlePriceRules,
  listBusinessEntities,
  listChannelProductMappings,
  listContracts,
  listSandboxes,
  listAvailabilityRulesByStore,
  listFeaturePoints,
  listGroupMembers,
  listGroupRoleBindings,
  listHighRiskPermissionPolicies,
  listIdentityProviderConfigs,
  listInventories,
  listInventoriesByStore,
  listMenuAvailability,
  listMenuAvailabilityByStore,
  listMenus,
  listPermissionGroups,
  listPermissions,
  listPlatformFeatureSwitches,
  listPlatforms,
  listPriceRules,
  listPriceRulesByStore,
  listPrincipalGroups,
  listProductCategories,
  listProductInheritances,
  listProducts,
  listProjectionDiagnostics,
  listProjects,
  listRegions,
  listResourceTags,
  listRoles,
  listRoleTemplates,
  listSeparationOfDutyRules,
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
  rebuildProjectionOutboxFromAlignedState,
  renewContract,
  revokeUserRoleBinding,
  rollbackStoreMenu,
  suspendTenantWithCascade,
  terminateContract,
  updatePriceRule,
  upsertMenuAvailability,
  upsertPlatformFeatureSwitch,
  upsertSaleableStock,
  updatePlatformIsvCredential,
  updateCustomerEntity,
  updateBrandMenuReviewStatus,
  updateRolePermissions,
  disablePriceRule,
} from './service.js'
import {
  listProjectionOutbox,
  listProjectionOutboxPage,
  listProjectionPublishLogPage,
  listProjectionPublishLog,
  previewProjectionBatch,
  publishProjectionBatch,
  retryProjectionOutbox,
} from '../projection/service.js'

export const createAlignedRouter = () => {
  const router = Router()
  const param = (value: string | string[] | undefined, fallback = '') => Array.isArray(value)
    ? value[0] ?? fallback
    : value ?? fallback
  const parseListQuery = (query: Record<string, unknown>) => {
    const excludedKeys = new Set(['page', 'size', 'pageSize', 'search', 'status', 'sandboxId'])
    const filters: Record<string, string> = {}
    Object.entries(query).forEach(([key, value]) => {
      if (excludedKeys.has(key)) {
        return
      }
      const rawValue = Array.isArray(value) ? value[0] : value
      if (typeof rawValue === 'string' && rawValue.trim()) {
        filters[key] = rawValue.trim()
      }
    })
    const search = typeof query.search === 'string' ? query.search : undefined
    const status = typeof query.status === 'string' ? query.status : undefined
    return {
      ...parsePagination(query),
      search,
      status,
      filters,
    }
  }

  router.get('/health', wrapRoute((_req, res) => {
    ok(res, {status: 'ok', service: 'mock-admin-mall-tenant-console'})
  }))

  router.get('/api/v1/overview', wrapRoute((req, res) => {
    ok(res, getAlignedOverview(res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/org/sandboxes', wrapRoute((req, res) => {
    okPage(res, listSandboxes(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/sandboxes', wrapRoute((req, res) => {
    created(res, createSandbox({
      sandboxId: req.body.sandboxId,
      sandboxCode: req.body.sandboxCode,
      sandboxName: req.body.sandboxName,
      sandboxType: req.body.sandboxType,
      deploymentId: req.body.deploymentId,
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

  router.patch('/api/v1/customer/entities/:entityType/:entityId', wrapRoute((req, res) => {
    ok(res, updateCustomerEntity({
      entityType: param(req.params.entityType),
      entityId: param(req.params.entityId),
      title: req.body.title,
      status: req.body.status,
      data: req.body.data,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/platforms', wrapRoute((req, res) => {
    okPage(res, listPlatforms(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/platforms', wrapRoute((req, res) => {
    created(res, createPlatform({
      platformId: req.body.platformId,
      platformCode: req.body.platformCode,
      platformName: req.body.platformName,
      platformShortName: req.body.platformShortName,
      description: req.body.description,
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      address: req.body.address,
      isvConfig: req.body.isvConfig,
      metadataCatalog: req.body.metadataCatalog,
      externalPlatformId: req.body.externalPlatformId,
      syncedAt: req.body.syncedAt,
      version: req.body.version,
      createAdminUser: req.body.createAdminUser,
      adminEmail: req.body.adminEmail,
      adminPasswordHash: req.body.adminPasswordHash,
      adminDisplayName: req.body.adminDisplayName,
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

  router.get('/api/v1/org/regions', wrapRoute((req, res) => {
    okPage(res, listRegions(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/regions', wrapRoute((req, res) => {
    created(res, createRegion({
      regionId: req.body.regionId,
      platformId: req.body.platformId,
      parentRegionId: req.body.parentRegionId,
      regionCode: req.body.regionCode,
      regionName: req.body.regionName,
      regionLevel: req.body.regionLevel,
      regionStatus: req.body.regionStatus,
      externalRegionId: req.body.externalRegionId,
      syncedAt: req.body.syncedAt,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/projects', wrapRoute((req, res) => {
    okPage(res, listProjects(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/projects', wrapRoute((req, res) => {
    created(res, createProject({
      projectId: req.body.projectId,
      projectCode: req.body.projectCode,
      projectName: req.body.projectName,
      projectShortName: req.body.projectShortName,
      platformId: req.body.platformId,
      timezone: req.body.timezone,
      region: req.body.region,
      regionId: req.body.regionId,
      province: req.body.province,
      city: req.body.city,
      address: req.body.address,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      businessHours: req.body.businessHours,
      channelShopConfig: req.body.channelShopConfig,
      businessMode: req.body.businessMode,
      projectPhases: req.body.projectPhases,
      externalProjectId: req.body.externalProjectId,
      syncedAt: req.body.syncedAt,
      version: req.body.version,
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
    okPage(res, listTenants(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/tenants/:tenantId/stores', wrapRoute((req, res) => {
    okPage(
      res,
      listTenantStores(
        param(req.params.tenantId),
        parseListQuery(req.query),
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
      companyName: req.body.companyName,
      socialCreditCode: req.body.socialCreditCode,
      unifiedSocialCreditCode: req.body.unifiedSocialCreditCode,
      legalRepresentative: req.body.legalRepresentative,
      contactName: req.body.contactName,
      contactPerson: req.body.contactPerson,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      tenantType: req.body.tenantType,
      businessModel: req.body.businessModel,
      invoiceTitle: req.body.invoiceTitle,
      settlementCycle: req.body.settlementCycle,
      billingEmail: req.body.billingEmail,
      externalTenantId: req.body.externalTenantId,
      syncedAt: req.body.syncedAt,
      version: req.body.version,
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
    okPage(res, listBrands(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/brands/:brandId/metadata', wrapRoute((req, res) => {
    okPage(
      res,
      listBrandMetadata(
        param(req.params.brandId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/brands', wrapRoute((req, res) => {
    created(res, createBrand({
      brandId: req.body.brandId,
      brandCode: req.body.brandCode,
      brandName: req.body.brandName,
      platformId: req.body.platformId,
      brandCategory: req.body.brandCategory,
      brandDescription: req.body.brandDescription,
      brandLogoUrl: req.body.brandLogoUrl,
      brandNameEn: req.body.brandNameEn,
      standardMenuEnabled: req.body.standardMenuEnabled,
      standardPricingLocked: req.body.standardPricingLocked,
      erpIntegrationEnabled: req.body.erpIntegrationEnabled,
      erpApiEndpoint: req.body.erpApiEndpoint,
      erpAuthConfig: req.body.erpAuthConfig,
      metadataCatalog: req.body.metadataCatalog,
      externalBrandId: req.body.externalBrandId,
      syncedAt: req.body.syncedAt,
      version: req.body.version,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/org/brands/:brandId/metadata', wrapRoute((req, res) => {
    created(res, createBrandMetadata({
      metadataId: req.body.metadataId,
      brandId: param(req.params.brandId),
      metadataType: req.body.metadataType,
      metadataName: req.body.metadataName,
      options: req.body.options,
      selectionType: req.body.selectionType,
      required: req.body.required,
      minSelections: req.body.minSelections,
      maxSelections: req.body.maxSelections,
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
    okPage(res, listStores(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/stores', wrapRoute((req, res) => {
    created(res, createStore({
      storeId: req.body.storeId,
      storeCode: req.body.storeCode,
      storeName: req.body.storeName,
      unitCode: req.body.unitCode,
      storeType: req.body.storeType,
      storeFormats: req.body.storeFormats,
      businessFormat: req.body.businessFormat,
      cooperationMode: req.body.cooperationMode,
      businessScenarios: req.body.businessScenarios,
      floor: req.body.floor,
      addressDetail: req.body.addressDetail,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      areaSqm: req.body.areaSqm,
      floorArea: req.body.floorArea,
      storePhone: req.body.storePhone,
      storeManager: req.body.storeManager,
      managerPhone: req.body.managerPhone,
      hasDineIn: req.body.hasDineIn,
      hasTakeaway: req.body.hasTakeaway,
      hasSelfPickup: req.body.hasSelfPickup,
      seatCount: req.body.seatCount,
      businessHours: req.body.businessHours,
      projectId: req.body.projectId,
      externalStoreId: req.body.externalStoreId,
      syncedAt: req.body.syncedAt,
      version: req.body.version,
      metadataCatalog: req.body.metadataCatalog,
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
    okPage(res, listContracts(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/stores/:storeId/contract-monitor', wrapRoute((req, res) => {
    ok(res, getStoreContractMonitor(param(req.params.storeId), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/contracts', wrapRoute((req, res) => {
    created(res, createContract({
      contractId: req.body.contractId,
      contractCode: req.body.contractNo ?? req.body.contractCode,
      storeId: req.body.storeId,
      lessorProjectId: req.body.lessorProjectId,
      lessorPhaseId: req.body.lessorPhaseId,
      lessorProjectName: req.body.lessorProjectName,
      lessorPhaseName: req.body.lessorPhaseName,
      lessorOwnerName: req.body.lessorOwnerName,
      lessorOwnerContact: req.body.lessorOwnerContact,
      lessorOwnerPhone: req.body.lessorOwnerPhone,
      tenantId: req.body.tenantId,
      brandId: req.body.brandId,
      entityId: req.body.entityId,
      contractNo: req.body.contractNo,
      contractType: req.body.contractType,
      externalContractNo: req.body.externalContractNo,
      syncedAt: req.body.syncedAt,
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
    okPage(res, listBusinessEntities(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/org/legal-entities', wrapRoute((req, res) => {
    created(res, createBusinessEntity({
      entityId: req.body.entityId,
      entityCode: req.body.entityCode,
      entityName: req.body.entityName,
      tenantId: req.body.tenantId,
      companyName: req.body.companyName,
      unifiedSocialCreditCode: req.body.unifiedSocialCreditCode,
      legalRepresentative: req.body.legalRepresentative,
      entityType: req.body.entityType,
      bankName: req.body.bankName,
      bankAccountName: req.body.bankAccountName,
      bankAccountNo: req.body.bankAccountNo,
      bankBranch: req.body.bankBranch,
      taxRegistrationNo: req.body.taxRegistrationNo,
      taxpayerType: req.body.taxpayerType,
      taxRate: req.body.taxRate,
      settlementCycle: req.body.settlementCycle,
      settlementDay: req.body.settlementDay,
      autoSettlementEnabled: req.body.autoSettlementEnabled,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/tables', wrapRoute((req, res) => {
    okPage(res, listTables(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/stores/:storeId/tables', wrapRoute((req, res) => {
    okPage(
      res,
      listTablesByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/stores/:storeId/tables', wrapRoute((req, res) => {
    created(res, createTableEntity({
      tableId: req.body.tableId,
      storeId: param(req.params.storeId),
      tableNo: req.body.tableNo,
      tableName: req.body.tableName,
      area: req.body.area,
      capacity: req.body.capacity,
      tableType: req.body.tableType,
      qrCodeUrl: req.body.qrCodeUrl,
      qrCodeContent: req.body.qrCodeContent,
      estimatedDuration: req.body.estimatedDuration,
      sortOrder: req.body.sortOrder,
      reservable: req.body.reservable,
      consumerDescription: req.body.consumerDescription,
      minimumSpend: req.body.minimumSpend,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/org/workstations', wrapRoute((req, res) => {
    okPage(res, listWorkstations(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/org/stores/:storeId/workstations', wrapRoute((req, res) => {
    okPage(
      res,
      listWorkstationsByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.post('/api/v1/org/stores/:storeId/workstations', wrapRoute((req, res) => {
    created(res, createWorkstation({
      workstationId: req.body.workstationId,
      storeId: param(req.params.storeId),
      workstationCode: req.body.workstationCode,
      workstationName: req.body.workstationName,
      categoryCodes: req.body.categoryCodes,
      workstationType: req.body.workstationType,
      responsibleCategories: req.body.responsibleCategories,
      description: req.body.description,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/users', wrapRoute((req, res) => {
    okPage(res, listUsers(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
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
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      mobile: req.body.mobile,
      userType: req.body.userType,
      identitySource: req.body.identitySource,
      externalUserId: req.body.externalUserId,
      passwordHash: req.body.passwordHash,
      storeId: req.body.storeId,
      platformId: req.body.platformId,
      createdBy: req.body.createdBy,
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
    okPage(res, listPermissions(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/permissions', wrapRoute((req, res) => {
    created(res, createPermission({
      permissionId: req.body.permissionId,
      permissionCode: req.body.permissionCode,
      permissionName: req.body.permissionName,
      permissionType: req.body.permissionType,
      permissionSource: req.body.permissionSource,
      platformId: req.body.platformId,
      permissionDescription: req.body.permissionDescription,
      scopeType: req.body.scopeType,
      module: req.body.module,
      resource: req.body.resource,
      resourceType: req.body.resourceType,
      action: req.body.action,
      isSystem: req.body.isSystem,
      parentPermissionId: req.body.parentPermissionId,
      permissionGroupId: req.body.permissionGroupId,
      featureFlag: req.body.featureFlag,
      highRisk: req.body.highRisk,
      requireApproval: req.body.requireApproval,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/idp-configs', wrapRoute((req, res) => {
    okPage(res, listIdentityProviderConfigs(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/idp-configs', wrapRoute((req, res) => {
    created(res, createIdentityProviderConfig({
      idpId: req.body.idpId,
      platformId: req.body.platformId,
      idpName: req.body.idpName,
      idpType: req.body.idpType,
      applicableUserTypes: Array.isArray(req.body.applicableUserTypes) ? req.body.applicableUserTypes : [],
      priority: req.body.priority,
      ldapUrl: req.body.ldapUrl,
      baseDn: req.body.baseDn,
      bindDn: req.body.bindDn,
      bindPasswordEncrypted: req.body.bindPasswordEncrypted,
      bindPassword: req.body.bindPassword,
      userSearchFilter: req.body.userSearchFilter,
      usernameAttr: req.body.usernameAttr,
      emailAttr: req.body.emailAttr,
      displayNameAttr: req.body.displayNameAttr,
      syncEnabled: req.body.syncEnabled,
      syncCron: req.body.syncCron,
      issuerUrl: req.body.issuerUrl,
      clientId: req.body.clientId,
      clientSecretEncrypted: req.body.clientSecretEncrypted,
      clientSecret: req.body.clientSecret,
      scopes: req.body.scopes,
      userInfoEndpoint: req.body.userInfoEndpoint,
      redirectUri: req.body.redirectUri,
      corpId: req.body.corpId,
      agentId: req.body.agentId,
      appSecretEncrypted: req.body.appSecretEncrypted,
      appSecret: req.body.appSecret,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/permission-groups', wrapRoute((req, res) => {
    okPage(res, listPermissionGroups(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/permission-groups', wrapRoute((req, res) => {
    created(res, createPermissionGroup({
      permissionGroupId: req.body.permissionGroupId,
      platformId: req.body.platformId,
      groupCode: req.body.groupCode,
      groupName: req.body.groupName,
      groupIcon: req.body.groupIcon,
      sortOrder: req.body.sortOrder,
      parentGroupId: req.body.parentGroupId,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/role-templates', wrapRoute((req, res) => {
    okPage(res, listRoleTemplates(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/role-templates', wrapRoute((req, res) => {
    created(res, createRoleTemplate({
      templateId: req.body.templateId,
      platformId: req.body.platformId,
      templateCode: req.body.templateCode,
      templateName: req.body.templateName,
      templateDescription: req.body.templateDescription,
      basePermissionIds: Array.isArray(req.body.basePermissionIds) ? req.body.basePermissionIds : [],
      recommendedScopeType: req.body.recommendedScopeType,
      industryTags: req.body.industryTags,
      isActive: req.body.isActive,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/feature-points', wrapRoute((req, res) => {
    okPage(res, listFeaturePoints(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/feature-points', wrapRoute((req, res) => {
    created(res, createFeaturePoint({
      featurePointId: req.body.featurePointId,
      platformId: req.body.platformId,
      featureCode: req.body.featureCode,
      featureName: req.body.featureName,
      featureDescription: req.body.featureDescription,
      isEnabledGlobally: req.body.isEnabledGlobally,
      defaultEnabled: req.body.defaultEnabled,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/platform-feature-switches', wrapRoute((req, res) => {
    okPage(res, listPlatformFeatureSwitches(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.put('/api/v1/iam/platform-feature-switches', wrapRoute((req, res) => {
    ok(res, upsertPlatformFeatureSwitch({
      switchId: req.body.switchId,
      platformId: req.body.platformId,
      featureCode: req.body.featureCode,
      isEnabled: req.body.isEnabled,
      enabledBy: req.body.enabledBy,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/resource-tags', wrapRoute((req, res) => {
    okPage(res, listResourceTags(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/resource-tags', wrapRoute((req, res) => {
    created(res, createResourceTag({
      tagId: req.body.tagId,
      platformId: req.body.platformId,
      tagKey: req.body.tagKey,
      tagValue: req.body.tagValue,
      tagLabel: req.body.tagLabel,
      resourceType: req.body.resourceType,
      resourceId: req.body.resourceId,
      createdBy: req.body.createdBy,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/roles', wrapRoute((req, res) => {
    okPage(res, listRoles(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/roles', wrapRoute((req, res) => {
    created(res, createRole({
      roleId: req.body.roleId,
      roleCode: req.body.roleCode,
      roleName: req.body.roleName,
      scopeType: req.body.scopeType,
      permissionIds: req.body.permissionIds,
      platformId: req.body.platformId,
      roleType: req.body.roleType,
      roleDescription: req.body.roleDescription,
      applicableUserTypes: req.body.applicableUserTypes,
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
  router.post('/api/v1/roles/:roleId/deprecate', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'role',
      entityId: param(req.params.roleId),
      status: 'DEPRECATED',
      eventType: 'RoleDeprecated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/roles/:roleId/suspend', wrapRoute((req, res) => {
    ok(res, changeEntityStatus({
      entityType: 'role',
      entityId: param(req.params.roleId),
      status: 'DEPRECATED',
      eventType: 'RoleDeprecated',
      mutation: res.locals.requestContext,
    }))
  }))
  router.put('/api/v1/roles/:roleId/permissions', wrapRoute((req, res) => {
    ok(res, updateRolePermissions({
      roleId: param(req.params.roleId),
      permissionIds: Array.isArray(req.body.permissionIds) ? req.body.permissionIds : [],
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/user-role-bindings', wrapRoute((req, res) => {
    okPage(res, listUserRoleBindings(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
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
      scopeType: req.body.scopeType,
      scopeId: req.body.scopeId,
      resourceScope: req.body.resourceScope,
      scopeSelector: req.body.scopeSelector,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      reason: req.body.reason,
      policyEffect: req.body.policyEffect,
      policyConditions: req.body.policyConditions,
      approvalId: req.body.approvalId,
      grantedBy: req.body.grantedBy,
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

  router.get('/api/v1/iam/principal-groups', wrapRoute((req, res) => {
    okPage(res, listPrincipalGroups(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/principal-groups', wrapRoute((req, res) => {
    created(res, createPrincipalGroup({
      groupId: req.body.groupId,
      platformId: req.body.platformId,
      groupCode: req.body.groupCode,
      groupName: req.body.groupName,
      groupType: req.body.groupType,
      ldapGroupDn: req.body.ldapGroupDn,
      oidcClaimKey: req.body.oidcClaimKey,
      oidcClaimValue: req.body.oidcClaimValue,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/group-members', wrapRoute((req, res) => {
    okPage(res, listGroupMembers(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/group-members', wrapRoute((req, res) => {
    created(res, addGroupMember({
      memberId: req.body.memberId,
      groupId: req.body.groupId,
      userId: req.body.userId,
      joinedBy: req.body.joinedBy,
      source: req.body.source,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/group-role-bindings', wrapRoute((req, res) => {
    okPage(res, listGroupRoleBindings(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/group-role-bindings', wrapRoute((req, res) => {
    created(res, createGroupRoleBinding({
      groupBindingId: req.body.groupBindingId,
      groupId: req.body.groupId,
      roleId: req.body.roleId,
      scopeType: req.body.scopeType,
      scopeId: req.body.scopeId,
      resourceScope: req.body.resourceScope,
      scopeSelector: req.body.scopeSelector,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      policyEffect: req.body.policyEffect,
      policyConditions: req.body.policyConditions,
      approvalId: req.body.approvalId,
      grantedBy: req.body.grantedBy,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/authorization-sessions', wrapRoute((req, res) => {
    okPage(res, listAuthorizationSessions(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/authorization-sessions', wrapRoute((req, res) => {
    created(res, createAuthorizationSession({
      sessionId: req.body.sessionId,
      userId: req.body.userId,
      platformId: req.body.platformId,
      activatedBindingIds: req.body.activatedBindingIds,
      workingScope: req.body.workingScope,
      sessionToken: req.body.sessionToken,
      expiresAt: req.body.expiresAt,
      lastActiveAt: req.body.lastActiveAt,
      mfaVerifiedAt: req.body.mfaVerifiedAt,
      mfaExpiresAt: req.body.mfaExpiresAt,
      mfaMethod: req.body.mfaMethod,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/sod-rules', wrapRoute((req, res) => {
    okPage(res, listSeparationOfDutyRules(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/sod-rules', wrapRoute((req, res) => {
    created(res, createSeparationOfDutyRule({
      sodRuleId: req.body.sodRuleId,
      platformId: req.body.platformId,
      ruleName: req.body.ruleName,
      ruleDescription: req.body.ruleDescription,
      conflictingRoleCodes: req.body.conflictingRoleCodes,
      conflictingPermCodes: req.body.conflictingPermCodes,
      scopeType: req.body.scopeType,
      isActive: req.body.isActive,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/iam/high-risk-policies', wrapRoute((req, res) => {
    okPage(res, listHighRiskPermissionPolicies(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/iam/high-risk-policies', wrapRoute((req, res) => {
    created(res, createHighRiskPermissionPolicy({
      policyId: req.body.policyId,
      platformId: req.body.platformId,
      permissionCode: req.body.permissionCode,
      requireApproval: req.body.requireApproval,
      approverRoleCode: req.body.approverRoleCode,
      maxDurationDays: req.body.maxDurationDays,
      requireMfa: req.body.requireMfa,
      mfaValidityMinutes: req.body.mfaValidityMinutes,
      isActive: req.body.isActive,
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
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/audit-logs', wrapRoute((req, res) => {
    okPage(res, listAuditEvents(parsePagination(req.query), res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/products', wrapRoute((req, res) => {
    okPage(res, listProducts(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/product-categories', wrapRoute((req, res) => {
    okPage(res, listProductCategories(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/product-categories', wrapRoute((req, res) => {
    created(res, createProductCategory({
      categoryId: req.body.categoryId,
      categoryCode: req.body.categoryCode,
      categoryName: req.body.categoryName,
      parentCategoryId: req.body.parentCategoryId,
      ownershipScope: req.body.ownershipScope,
      brandId: req.body.brandId,
      storeId: req.body.storeId,
      sortOrder: req.body.sortOrder,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/products', wrapRoute((req, res) => {
    created(res, createProduct({
      productId: req.body.productId,
      productCode: req.body.productCode,
      productName: req.body.productName,
      productNameEn: req.body.productNameEn,
      ownershipScope: req.body.ownershipScope,
      brandId: req.body.brandId,
      storeId: req.body.storeId,
      productType: req.body.productType,
      categoryId: req.body.categoryId,
      imageUrl: req.body.imageUrl,
      productImages: req.body.productImages,
      productDescription: req.body.productDescription,
      description: req.body.description,
      allergenInfo: req.body.allergenInfo,
      nutritionInfo: req.body.nutritionInfo,
      tags: req.body.tags,
      sortOrder: req.body.sortOrder,
      priceUnit: req.body.priceUnit,
      basePrice: req.body.basePrice,
      comboPricingStrategy: req.body.comboPricingStrategy,
      comboStockPolicy: req.body.comboStockPolicy,
      comboAvailabilityPolicy: req.body.comboAvailabilityPolicy,
      comboItems: req.body.comboItems,
      productionProfile: req.body.productionProfile,
      productionSteps: req.body.productionSteps,
      modifierGroups: req.body.modifierGroups,
      variants: req.body.variants,
      comboItemGroups: req.body.comboItemGroups,
      createdBy: req.body.createdBy,
      updatedBy: req.body.updatedBy,
      version: req.body.version,
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
    okPage(res, listMenus(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/menus', wrapRoute((req, res) => {
    created(res, createBrandMenu({
      brandMenuId: req.body.brandMenuId,
      brandId: req.body.brandId,
      menuName: req.body.menuName,
      channelType: req.body.channelType,
      menuType: req.body.menuType,
      effectiveDate: req.body.effectiveDate,
      expireDate: req.body.expireDate,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      parentMenuId: req.body.parentMenuId,
      changeSummary: req.body.changeSummary,
      createdFromVersion: req.body.createdFromVersion,
      version: req.body.version,
      allowStoreOverride: req.body.allowStoreOverride,
      overrideScope: req.body.overrideScope,
      sections: req.body.sections,
      reviewStatus: req.body.reviewStatus,
      publishedAt: req.body.publishedAt,
      publishedBy: req.body.publishedBy,
      reviewComment: req.body.reviewComment,
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
    okPage(res, listStoreMenus(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/store-menus', wrapRoute((req, res) => {
    created(res, createStoreMenu({
      menuId: req.body.menuId,
      storeId: req.body.storeId,
      menuName: req.body.menuName,
      brandMenuId: req.body.brandMenuId,
      channelType: req.body.channelType,
      menuType: req.body.menuType,
      inheritMode: req.body.inheritMode,
      effectiveDate: req.body.effectiveDate,
      expireDate: req.body.expireDate,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      parentMenuId: req.body.parentMenuId,
      changeSummary: req.body.changeSummary,
      createdFromVersion: req.body.createdFromVersion,
      version: req.body.version,
      sections: req.body.sections,
      versionHash: req.body.versionHash,
      reviewStatus: req.body.reviewStatus,
      publishedAt: req.body.publishedAt,
      publishedBy: req.body.publishedBy,
      reviewComment: req.body.reviewComment,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/store-menus/:id/rollback', wrapRoute((req, res) => {
    ok(res, rollbackStoreMenu({
      menuId: param(req.params.id),
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/store-configs', wrapRoute((req, res) => {
    okPage(res, listStoreConfigs(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/config', wrapRoute((req, res) => {
    okPage(
      res,
      listStoreConfigsByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.put('/api/v1/stores/:storeId/config', wrapRoute((req, res) => {
    ok(res, createStoreConfig({
      storeId: param(req.params.storeId),
      businessStatus: req.body.businessStatus,
      acceptOrder: req.body.acceptOrder,
      operatingStatus: req.body.operatingStatus,
      autoAcceptEnabled: req.body.autoAcceptEnabled,
      acceptTimeoutSeconds: req.body.acceptTimeoutSeconds,
      preparationBufferMinutes: req.body.preparationBufferMinutes,
      maxConcurrentOrders: req.body.maxConcurrentOrders,
      pauseReason: req.body.pauseReason,
      pausedAt: req.body.pausedAt,
      pausedBy: req.body.pausedBy,
      resumeScheduledAt: req.body.resumeScheduledAt,
      operatingHours: req.body.operatingHours,
      specialOperatingDays: req.body.specialOperatingDays,
      channelOperatingHours: req.body.channelOperatingHours,
      autoOpenCloseEnabled: req.body.autoOpenCloseEnabled,
      extraChargeRules: req.body.extraChargeRules,
      refundStockPolicy: req.body.refundStockPolicy,
      version: req.body.version,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/inventories', wrapRoute((req, res) => {
    okPage(res, listInventories(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/inventories', wrapRoute((req, res) => {
    okPage(
      res,
      listInventoriesByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
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
      skuId: req.body.skuId,
      stockGranularity: req.body.stockGranularity,
      stockType: req.body.stockType,
      stockDate: req.body.stockDate,
      periodId: req.body.periodId,
      totalQuantity: req.body.totalQuantity,
      soldQuantity: req.body.soldQuantity,
      reservedQuantity: req.body.reservedQuantity,
      safetyStock: req.body.safetyStock,
      soldOutThreshold: req.body.soldOutThreshold,
      reservationTtlSeconds: req.body.reservationTtlSeconds,
      resetPolicy: req.body.resetPolicy,
      lastResetAt: req.body.lastResetAt,
      ingredientConsumption: req.body.ingredientConsumption,
      version: req.body.version,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/product-inheritances', wrapRoute((req, res) => {
    okPage(res, listProductInheritances(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/product-inheritances', wrapRoute((req, res) => {
    created(res, createProductInheritance({
      inheritanceId: req.body.inheritanceId,
      brandProductId: req.body.brandProductId,
      storeProductId: req.body.storeProductId,
      storeId: req.body.storeId,
      overrideFields: req.body.overrideFields,
      lockedFields: req.body.lockedFields,
      syncStatus: req.body.syncStatus,
      lastSyncAt: req.body.lastSyncAt,
      mutation: res.locals.requestContext,
    }))
  }))

  router.post('/api/v1/product-price-rules', wrapRoute((req, res) => {
    created(res, createPriceRule({
      ruleCode: req.body.ruleCode,
      ruleName: req.body.ruleName,
      productId: req.body.productId,
      storeId: req.body.storeId,
      priceType: req.body.priceType,
      channelType: req.body.channelType,
      priceDelta: req.body.priceDelta,
      price: req.body.price,
      priceValue: req.body.priceValue,
      timeSlotStart: req.body.timeSlotStart,
      timeSlotEnd: req.body.timeSlotEnd,
      timeSlot: req.body.timeSlot,
      daysOfWeek: req.body.daysOfWeek,
      memberTier: req.body.memberTier,
      priority: req.body.priority,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      enabled: req.body.enabled,
      applicableProductIds: req.body.applicableProductIds,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/price-rules', wrapRoute((req, res) => {
    okPage(res, listPriceRules(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/price-rules', wrapRoute((req, res) => {
    okPage(
      res,
      listPriceRulesByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.patch('/api/v1/price-rules/:ruleId', wrapRoute((req, res) => {
    ok(res, updatePriceRule({
      ruleId: param(req.params.ruleId),
      ruleName: req.body.ruleName,
      channelType: req.body.channelType,
      timeSlotStart: req.body.timeSlotStart,
      timeSlotEnd: req.body.timeSlotEnd,
      timeSlot: req.body.timeSlot,
      daysOfWeek: req.body.daysOfWeek,
      memberTier: req.body.memberTier,
      priority: req.body.priority,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      price: req.body.price,
      priceValue: req.body.priceValue,
      enabled: req.body.enabled,
      applicableProductIds: req.body.applicableProductIds,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/price-rules/:ruleId/disable', wrapRoute((req, res) => {
    ok(res, disablePriceRule({
      ruleId: param(req.params.ruleId),
      reason: req.body.reason,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/bundle-price-rules', wrapRoute((req, res) => {
    okPage(res, listBundlePriceRules(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/bundle-price-rules', wrapRoute((req, res) => {
    created(res, createBundlePriceRule({
      ruleId: req.body.ruleId,
      storeId: req.body.storeId,
      ruleName: req.body.ruleName,
      triggerProducts: Array.isArray(req.body.triggerProducts) ? req.body.triggerProducts : [],
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      maxApplications: req.body.maxApplications,
      priority: req.body.priority,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      isActive: req.body.isActive,
      mutation: res.locals.requestContext,
    }))
  }))

  router.get('/api/v1/channel-product-mappings', wrapRoute((req, res) => {
    okPage(res, listChannelProductMappings(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.post('/api/v1/channel-product-mappings', wrapRoute((req, res) => {
    created(res, createChannelProductMapping({
      mappingId: req.body.mappingId,
      storeId: req.body.storeId,
      productId: req.body.productId,
      channelType: req.body.channelType,
      externalProductId: req.body.externalProductId,
      externalSkuId: req.body.externalSkuId,
      mappingStatus: req.body.mappingStatus,
      syncStatus: req.body.syncStatus,
      lastSyncAt: req.body.lastSyncAt,
      syncErrorMessage: req.body.syncErrorMessage,
      fieldMappingConfig: req.body.fieldMappingConfig,
      mutation: res.locals.requestContext,
    }))
  }))
  router.post('/api/v1/stores/:storeId/availability-rules', wrapRoute((req, res) => {
    created(res, createAvailabilityRule({
      ruleCode: req.body.ruleCode,
      storeId: param(req.params.storeId),
      productId: req.body.productId,
      ruleType: req.body.ruleType,
      ruleConfig: req.body.ruleConfig,
      channelType: req.body.channelType,
      timeSlot: req.body.timeSlot,
      dailyQuota: req.body.dailyQuota,
      priority: req.body.priority,
      enabled: req.body.enabled,
      available: req.body.available,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
      updatedBy: req.body.updatedBy,
      mutation: res.locals.requestContext,
    }))
  }))
  router.get('/api/v1/availability-rules', wrapRoute((req, res) => {
    okPage(res, listAvailabilityRules(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/availability-rules', wrapRoute((req, res) => {
    okPage(
      res,
      listAvailabilityRulesByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.get('/api/v1/menu-availability', wrapRoute((req, res) => {
    okPage(res, listMenuAvailability(parseListQuery(req.query), res.locals.requestContext?.sandboxId))
  }))
  router.get('/api/v1/stores/:storeId/menu-availability', wrapRoute((req, res) => {
    okPage(
      res,
      listMenuAvailabilityByStore(
        param(req.params.storeId),
        parseListQuery(req.query),
        res.locals.requestContext?.sandboxId,
      ),
    )
  }))
  router.put('/api/v1/stores/:storeId/menu-availability/:productId', wrapRoute((req, res) => {
    ok(res, upsertMenuAvailability({
      storeId: param(req.params.storeId),
      productId: param(req.params.productId),
      available: Boolean(req.body.available),
      soldOutReason: req.body.soldOutReason,
      effectiveFrom: req.body.effectiveFrom,
      mutation: res.locals.requestContext,
    }))
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
    okPage(res, listProjectionOutboxPage({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      pagination: parsePagination(req.query),
    }))
  }))
  router.get('/api/v1/diagnostics/projections/publish-log', wrapRoute((req, res) => {
    okPage(res, listProjectionPublishLogPage({pagination: parsePagination(req.query)}))
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
    okPage(res, listBusinessEventDiagnostics(parsePagination(req.query), res.locals.requestContext?.sandboxId))
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
