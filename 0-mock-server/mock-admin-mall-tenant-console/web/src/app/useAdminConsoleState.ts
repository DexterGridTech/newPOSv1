import {useEffect, useMemo, useState} from 'react'
import {api} from '../api'
import {
  defaultContractLifecycleDraft,
  defaultEnvironmentDraft,
  defaultIamDraft,
  defaultMenuDraft,
  defaultOperationDraft,
  defaultOrganizationDraft,
  defaultProductDraft,
} from './config'
import {buildMetricSummary} from './utils'
import type {
  AuditEvent,
  AuthCapabilities,
  DomainKey,
  EntityItem,
  LastContractLifecycleResult,
  LastEnvironmentResult,
  LastIamResult,
  LastMenuResult,
  LastOperationResult,
  LastOrganizationResult,
  LastProductResult,
  LegacyDocument,
  OrgTreeNode,
  OutboxItem,
  Overview,
  ProjectionDiagnostic,
  StoreEffectiveIam,
  StoreContractMonitor,
  UserEffectivePermissions,
} from './types'

type LoadSnapshot = {
  overview: Overview
  documents: LegacyDocument[]
  outbox: OutboxItem[]
  authCapabilities: AuthCapabilities
  auditEvents: AuditEvent[]
  diagnostics: ProjectionDiagnostic[]
  orgTree: OrgTreeNode[]
  sandboxes: EntityItem[]
  platforms: EntityItem[]
  projects: EntityItem[]
  tenants: EntityItem[]
  brands: EntityItem[]
  stores: EntityItem[]
  contracts: EntityItem[]
  businessEntities: EntityItem[]
  tables: EntityItem[]
  workstations: EntityItem[]
  users: EntityItem[]
  permissions: EntityItem[]
  roles: EntityItem[]
  userRoleBindings: EntityItem[]
  products: EntityItem[]
  menus: EntityItem[]
  storeMenus: EntityItem[]
  storeConfigs: EntityItem[]
  inventories: EntityItem[]
  priceRules: EntityItem[]
  availabilityRules: EntityItem[]
  menuAvailability: EntityItem[]
}

const loadSnapshot = async (): Promise<LoadSnapshot> => {
  const [
    overview,
    documents,
    outboxPage,
    authCapabilities,
    auditEvents,
    diagnostics,
    orgTree,
    sandboxes,
    platforms,
    projects,
    tenants,
    brands,
    stores,
    contracts,
    businessEntities,
    tables,
    workstations,
    users,
    permissions,
    roles,
    userRoleBindings,
    products,
    menus,
    storeMenus,
    storeConfigs,
    inventories,
    priceRules,
    availabilityRules,
    menuAvailability,
  ] = await Promise.all([
    api.getOverview(),
    api.getDocuments(),
    api.getProjectionOutbox(),
    api.getTerminalAuthCapabilities(),
    api.getAlignedAuditEvents(),
    api.getProjectionDiagnostics(),
    api.getOrgTree(),
    api.getSandboxes(),
    api.getPlatforms(),
    api.getProjects(),
    api.getTenants(),
    api.getBrands(),
    api.getStores(),
    api.getContracts(),
    api.getBusinessEntities(),
    api.getTables(),
    api.getWorkstations(),
    api.getUsers(),
    api.getPermissions(),
    api.getRoles(),
    api.getUserRoleBindings(),
    api.getProducts(),
    api.getMenus(),
    api.getStoreMenus(),
    api.getStoreConfigs(),
    api.getInventories(),
    api.getPriceRules(),
    api.getAvailabilityRules(),
    api.getMenuAvailability(),
  ])

  return {
    overview,
    documents,
    outbox: outboxPage.data,
    authCapabilities,
    auditEvents: auditEvents.data,
    diagnostics: diagnostics.data,
    orgTree,
    sandboxes: sandboxes.data,
    platforms: platforms.data,
    projects: projects.data,
    tenants: tenants.data,
    brands: brands.data,
    stores: stores.data,
    contracts: contracts.data,
    businessEntities: businessEntities.data,
    tables: tables.data,
    workstations: workstations.data,
    users: users.data,
    permissions: permissions.data,
    roles: roles.data,
    userRoleBindings: userRoleBindings.data,
    products: products.data,
    menus: menus.data,
    storeMenus: storeMenus.data,
    storeConfigs: storeConfigs.data,
    inventories: inventories.data,
    priceRules: priceRules.data,
    availabilityRules: availabilityRules.data,
    menuAvailability: menuAvailability.data,
  }
}

const resolveErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const readEntityData = (item?: EntityItem | null) =>
  (item?.payload.data ?? {}) as Record<string, unknown>

const readNullableText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

export function useAdminConsoleState() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeDomain, setActiveDomain] = useState<DomainKey>('organization')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [documents, setDocuments] = useState<LegacyDocument[]>([])
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewProjectionOutbox>> | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [diagnostics, setDiagnostics] = useState<ProjectionDiagnostic[]>([])
  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([])
  const [sandboxes, setSandboxes] = useState<EntityItem[]>([])
  const [platforms, setPlatforms] = useState<EntityItem[]>([])
  const [projects, setProjects] = useState<EntityItem[]>([])
  const [tenants, setTenants] = useState<EntityItem[]>([])
  const [brands, setBrands] = useState<EntityItem[]>([])
  const [stores, setStores] = useState<EntityItem[]>([])
  const [contracts, setContracts] = useState<EntityItem[]>([])
  const [businessEntities, setBusinessEntities] = useState<EntityItem[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [tenantStores, setTenantStores] = useState<EntityItem[]>([])
  const [storeContractMonitor, setStoreContractMonitor] = useState<StoreContractMonitor | null>(null)
  const [tables, setTables] = useState<EntityItem[]>([])
  const [workstations, setWorkstations] = useState<EntityItem[]>([])
  const [users, setUsers] = useState<EntityItem[]>([])
  const [permissions, setPermissions] = useState<EntityItem[]>([])
  const [roles, setRoles] = useState<EntityItem[]>([])
  const [userRoleBindings, setUserRoleBindings] = useState<EntityItem[]>([])
  const [storeEffectiveIam, setStoreEffectiveIam] = useState<StoreEffectiveIam | null>(null)
  const [userEffectivePermissions, setUserEffectivePermissions] = useState<UserEffectivePermissions | null>(null)
  const [products, setProducts] = useState<EntityItem[]>([])
  const [menus, setMenus] = useState<EntityItem[]>([])
  const [storeMenus, setStoreMenus] = useState<EntityItem[]>([])
  const [storeConfigs, setStoreConfigs] = useState<EntityItem[]>([])
  const [inventories, setInventories] = useState<EntityItem[]>([])
  const [priceRules, setPriceRules] = useState<EntityItem[]>([])
  const [availabilityRules, setAvailabilityRules] = useState<EntityItem[]>([])
  const [menuAvailability, setMenuAvailability] = useState<EntityItem[]>([])
  const [authCapabilities, setAuthCapabilities] = useState<AuthCapabilities | null>(null)
  const [environmentDraft, setEnvironmentDraft] = useState(defaultEnvironmentDraft)
  const [environmentActionLoading, setEnvironmentActionLoading] = useState(false)
  const [lastEnvironmentResult, setLastEnvironmentResult] = useState<LastEnvironmentResult | null>(null)
  const [orgDraft, setOrgDraft] = useState(defaultOrganizationDraft)
  const [orgActionLoading, setOrgActionLoading] = useState(false)
  const [contractLifecycleDraft, setContractLifecycleDraft] = useState(defaultContractLifecycleDraft)
  const [lastContractLifecycleResult, setLastContractLifecycleResult] = useState<LastContractLifecycleResult | null>(null)
  const [lastOrganizationResult, setLastOrganizationResult] = useState<LastOrganizationResult | null>(null)
  const [iamDraft, setIamDraft] = useState(defaultIamDraft)
  const [iamActionLoading, setIamActionLoading] = useState(false)
  const [lastIamResult, setLastIamResult] = useState<LastIamResult | null>(null)
  const [productDraft, setProductDraft] = useState(defaultProductDraft)
  const [productActionLoading, setProductActionLoading] = useState(false)
  const [lastProductResult, setLastProductResult] = useState<LastProductResult | null>(null)
  const [menuDraft, setMenuDraft] = useState(defaultMenuDraft)
  const [menuActionLoading, setMenuActionLoading] = useState(false)
  const [lastMenuResult, setLastMenuResult] = useState<LastMenuResult | null>(null)
  const [operationDraft, setOperationDraft] = useState(defaultOperationDraft)
  const [operationActionLoading, setOperationActionLoading] = useState(false)
  const [lastOperationResult, setLastOperationResult] = useState<LastOperationResult | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const snapshot = await loadSnapshot()
      setOverview(snapshot.overview)
      setDocuments(snapshot.documents)
      setOutbox(snapshot.outbox)
      setAuthCapabilities(snapshot.authCapabilities)
      setAuditEvents(snapshot.auditEvents)
      setDiagnostics(snapshot.diagnostics)
      setOrgTree(snapshot.orgTree)
      setSandboxes(snapshot.sandboxes)
      setPlatforms(snapshot.platforms)
      setProjects(snapshot.projects)
      setTenants(snapshot.tenants)
      setBrands(snapshot.brands)
      setStores(snapshot.stores)
      setContracts(snapshot.contracts)
      setBusinessEntities(snapshot.businessEntities)
      setTables(snapshot.tables)
      setWorkstations(snapshot.workstations)
      setUsers(snapshot.users)
      setPermissions(snapshot.permissions)
      setRoles(snapshot.roles)
      setUserRoleBindings(snapshot.userRoleBindings)
      setProducts(snapshot.products)
      setMenus(snapshot.menus)
      setStoreMenus(snapshot.storeMenus)
      setStoreConfigs(snapshot.storeConfigs)
      setInventories(snapshot.inventories)
      setPriceRules(snapshot.priceRules)
      setAvailabilityRules(snapshot.availabilityRules)
      setMenuAvailability(snapshot.menuAvailability)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!selectedTenantId) {
      setTenantStores([])
      return
    }

    let cancelled = false
    void api.getTenantStores(selectedTenantId).then(result => {
      if (!cancelled) {
        setTenantStores(result.data)
      }
    }).catch(nextError => {
      if (!cancelled) {
        setError(resolveErrorMessage(nextError))
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedTenantId])

  useEffect(() => {
    if (!selectedStoreId) {
      setStoreContractMonitor(null)
      return
    }

    let cancelled = false
    void api.getStoreContractMonitor(selectedStoreId).then(contractMonitor => {
      if (!cancelled) {
        setStoreContractMonitor(contractMonitor)
      }
    }).catch(nextError => {
      if (!cancelled) {
        setError(resolveErrorMessage(nextError))
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedStoreId])

  useEffect(() => {
    const targetStoreId = iamDraft.storeId || selectedStoreId
    if (!targetStoreId) {
      setStoreEffectiveIam(null)
      return
    }

    let cancelled = false
    void api.getStoreEffectiveIam(targetStoreId).then(result => {
      if (!cancelled) {
        setStoreEffectiveIam(result)
      }
    }).catch(nextError => {
      if (!cancelled) {
        setError(resolveErrorMessage(nextError))
      }
    })

    return () => {
      cancelled = true
    }
  }, [iamDraft.storeId, selectedStoreId, userRoleBindings])

  useEffect(() => {
    const targetUserId = lastIamResult?.userId ?? users[0]?.entityId ?? ''
    const targetStoreId = iamDraft.storeId || selectedStoreId
    if (!targetUserId || !targetStoreId) {
      setUserEffectivePermissions(null)
      return
    }

    let cancelled = false
    void api.getUserEffectivePermissions(targetUserId, targetStoreId).then(result => {
      if (!cancelled) {
        setUserEffectivePermissions(result)
      }
    }).catch(nextError => {
      if (!cancelled) {
        setError(resolveErrorMessage(nextError))
      }
    })

    return () => {
      cancelled = true
    }
  }, [lastIamResult?.userId, users, iamDraft.storeId, selectedStoreId])

  const pendingCount = useMemo(
    () => outbox.filter(item => item.status === 'PENDING').length,
    [outbox],
  )
  const failedCount = useMemo(
    () => outbox.filter(item => item.status === 'FAILED').length,
    [outbox],
  )
  const metrics = useMemo(() => buildMetricSummary(overview), [overview])
  const environmentSummary = useMemo(() => ({
    activeSandboxes: sandboxes.filter(item => item.status === 'ACTIVE').length,
    activePlatforms: platforms.filter(item => item.status === 'ACTIVE').length,
    activeProjects: projects.filter(item => item.status === 'ACTIVE').length,
    maskedCredentialPlatforms: platforms.filter(item => {
      const data = item.payload.data as Record<string, unknown>
      const isvConfig = data.isv_config as Record<string, unknown> | undefined
      return Boolean(isvConfig?.isv_token_masked)
    }).length,
  }), [sandboxes, platforms, projects])
  const storeSnapshots = useMemo(
    () => stores.map(item => {
      const data = item.payload.data as Record<string, unknown>
      return {
        entityId: item.entityId,
        storeName: item.title,
        activeContractId: data.active_contract_id ?? null,
        tenantId: data.tenant_id ?? null,
        brandId: data.brand_id ?? null,
        entitySnapshotId: data.entity_id ?? null,
        status: item.status,
      }
    }),
    [stores],
  )
  const selectedTenant = useMemo(
    () => tenants.find(item => item.entityId === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  )
  const selectedStore = useMemo(
    () => stores.find(item => item.entityId === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  )

  const selectTenantContext = (tenantId: string) => {
    setSelectedTenantId(tenantId)
    if (!tenantId) {
      return
    }

    const selectedStoreTenantId = readNullableText(readEntityData(selectedStore).tenant_id)
    if (selectedStoreTenantId !== tenantId) {
      setSelectedStoreId('')
    }
  }

  const selectStoreContext = (storeId: string) => {
    setSelectedStoreId(storeId)
    if (!storeId) {
      return
    }

    const matchedStore = stores.find(item => item.entityId === storeId) ?? null
    const matchedTenantId = readNullableText(readEntityData(matchedStore).tenant_id)
    setSelectedTenantId(matchedTenantId ?? '')
  }

  const publish = async () => {
    setMessage('')
    setError('')
    try {
      const result = await api.publishProjectionOutbox()
      setMessage(`已发布 ${result.published}/${result.total} 条 projection 到 mock-terminal-platform`)
      setPreview(null)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
      await load()
    }
  }

  const retry = async () => {
    setMessage('')
    setError('')
    try {
      const result = await api.retryProjectionOutbox()
      setMessage(`已重新排队 ${result.total} 条失败 outbox`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    }
  }

  const previewPublish = async () => {
    try {
      setPreview(await api.previewProjectionOutbox())
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    }
  }

  const applyDemoChange = async () => {
    setMessage('')
    setError('')
    try {
      const result = await api.applyDemoChange()
      const nextData = typeof result.payload?.data === 'object' && result.payload?.data !== null
        ? result.payload.data as Record<string, unknown>
        : {}
      setMessage(`已生成演示变更：${String(nextData.product_name ?? result.title)}，等待发布到 TDP`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    }
  }

  const rebuildOutbox = async (publishAfterRebuild: boolean) => {
    setMessage('')
    setError('')
    try {
      const result = await api.rebuildProjectionOutbox()
      setMessage(`已按当前 aligned write-model 重建 ${result.total} 条 projection outbox`)
      if (publishAfterRebuild) {
        const publishResult = await api.publishProjectionOutbox()
        setMessage(`已重建并发布 ${publishResult.published}/${publishResult.total} 条 projection`)
        setPreview(null)
      }
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
      await load()
    }
  }

  const runEnvironmentSetup = async () => {
    setEnvironmentActionLoading(true)
    setMessage('')
    setError('')
    try {
      const sandbox = await api.createSandbox({
        sandboxCode: environmentDraft.sandboxCode,
        sandboxName: environmentDraft.sandboxName,
        sandboxType: environmentDraft.sandboxType,
        owner: environmentDraft.sandboxOwner,
        description: environmentDraft.sandboxDescription,
      })
      const activeSandbox = await api.activateSandbox(sandbox.entityId)
      const platform = await api.createPlatform({
        platformCode: environmentDraft.platformCode,
        platformName: environmentDraft.platformName,
        description: environmentDraft.platformDescription,
        contactName: environmentDraft.platformContactName,
        contactPhone: environmentDraft.platformContactPhone,
        isvConfig: {
          providerType: environmentDraft.isvProviderType,
          appKey: environmentDraft.isvAppKey,
          appSecret: environmentDraft.isvAppSecret,
          isvToken: environmentDraft.isvToken,
          tokenExpireAt: environmentDraft.isvTokenExpireAt,
          channelStatus: environmentDraft.isvChannelStatus,
        },
      })
      const project = await api.createProject({
        projectCode: environmentDraft.projectCode,
        projectName: environmentDraft.projectName,
        platformId: platform.entityId,
        timezone: environmentDraft.projectTimezone,
        address: environmentDraft.projectAddress,
        businessMode: environmentDraft.projectBusinessMode,
        region: {
          region_code: environmentDraft.projectRegionCode,
          region_name: environmentDraft.projectRegionName,
          parent_region_code: environmentDraft.projectParentRegionCode,
          region_level: Number(environmentDraft.projectRegionLevel),
        },
      })
      const activeProject = await api.activateProject(project.entityId)
      const maskedCredential = await api.updatePlatformIsvCredential(platform.entityId, {
        providerType: environmentDraft.isvProviderType,
        appKey: environmentDraft.isvAppKey,
        appSecret: environmentDraft.isvAppSecret,
        isvToken: environmentDraft.isvToken,
        tokenExpireAt: environmentDraft.isvTokenExpireAt,
        channelStatus: environmentDraft.isvChannelStatus,
      })
      setLastEnvironmentResult({
        sandboxId: activeSandbox.entityId,
        platformId: platform.entityId,
        projectId: activeProject.entityId,
        action: 'sandbox-platform-project-initialized',
        payload: {
          sandbox: activeSandbox,
          platform: maskedCredential,
          project: activeProject,
        },
      })
      setMessage(`初始化主链路已收口：${activeSandbox.title}、${platform.title}、${project.title} 已建立，ISV 凭据已按掩码写入管理视图`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setEnvironmentActionLoading(false)
    }
  }

  const cycleEnvironmentLifecycle = async (
    target: 'sandbox' | 'platform' | 'project',
    nextAction: 'activate' | 'suspend' | 'close',
  ) => {
    setEnvironmentActionLoading(true)
    setMessage('')
    setError('')
    try {
      if (target === 'sandbox') {
        const sandboxId = lastEnvironmentResult?.sandboxId ?? sandboxes[0]?.entityId
        if (!sandboxId) {
          throw new Error('请先执行一次初始化向导，再操作 sandbox 生命周期')
        }
        const payload = nextAction === 'activate'
          ? await api.activateSandbox(sandboxId)
          : nextAction === 'suspend'
            ? await api.suspendSandbox(sandboxId)
            : await api.closeSandbox(sandboxId)
        setLastEnvironmentResult(current => ({
          sandboxId,
          platformId: current?.platformId,
          projectId: current?.projectId,
          action: `sandbox-${nextAction}`,
          payload,
        }))
        setMessage(`Sandbox ${sandboxId} 已执行 ${nextAction}`)
      }

      if (target === 'platform') {
        const platformId = lastEnvironmentResult?.platformId ?? platforms[0]?.entityId
        if (!platformId) {
          throw new Error('请先执行一次初始化向导，再操作平台生命周期')
        }
        const payload = nextAction === 'activate'
          ? await api.activatePlatform(platformId)
          : await api.suspendPlatform(platformId)
        setLastEnvironmentResult(current => ({
          sandboxId: current?.sandboxId,
          platformId,
          projectId: current?.projectId,
          action: `platform-${nextAction}`,
          payload,
        }))
        setMessage(`平台 ${platformId} 已执行 ${nextAction}`)
      }

      if (target === 'project') {
        const projectId = lastEnvironmentResult?.projectId ?? projects[0]?.entityId
        if (!projectId) {
          throw new Error('请先执行一次初始化向导，再操作项目生命周期')
        }
        const payload = nextAction === 'activate'
          ? await api.activateProject(projectId)
          : await api.suspendProject(projectId)
        setLastEnvironmentResult(current => ({
          sandboxId: current?.sandboxId,
          platformId: current?.platformId,
          projectId,
          action: `project-${nextAction}`,
          payload,
        }))
        setMessage(`项目 ${projectId} 已执行 ${nextAction}`)
      }

      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setEnvironmentActionLoading(false)
    }
  }

  const runOrganizationFlow = async () => {
    setOrgActionLoading(true)
    setMessage('')
    setError('')
    try {
      const tenant = await api.createTenant({
        tenantCode: orgDraft.tenantCode,
        tenantName: orgDraft.tenantName,
      })
      const brand = await api.createBrand({
        brandCode: orgDraft.brandCode,
        brandName: orgDraft.brandName,
        platformId: lastEnvironmentResult?.platformId ?? platforms[0]?.entityId,
      })
      const businessEntity = await api.createBusinessEntity({
        entityCode: orgDraft.entityCode,
        entityName: orgDraft.entityName,
        tenantId: tenant.entityId,
      })
      const store = await api.createStore({
        storeCode: orgDraft.storeCode,
        storeName: orgDraft.storeName,
        unitCode: orgDraft.unitCode,
        projectId: 'project-kernel-base-test',
      })
      const contract = await api.createContract({
        contractNo: orgDraft.contractNo,
        storeId: store.entityId,
        tenantId: tenant.entityId,
        brandId: brand.entityId,
        entityId: businessEntity.entityId,
        startDate: orgDraft.startDate,
        endDate: orgDraft.endDate,
        commissionType: orgDraft.commissionType,
        commissionRate: Number(orgDraft.commissionRate),
        depositAmount: Number(orgDraft.depositAmount),
      })
      await api.activateContract(contract.entityId, {
        remark: 'admin web organization cockpit activation',
      })
      setLastContractLifecycleResult(null)
      setLastOrganizationResult({
        tenantId: tenant.entityId,
        brandId: brand.entityId,
        entityId: businessEntity.entityId,
        storeId: store.entityId,
        contractId: contract.entityId,
      })
      setMessage(`组织主链路已收口：${store.title} 已绑定 ${orgDraft.contractNo} 并更新 store snapshot`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOrgActionLoading(false)
    }
  }

  const suspendTenant = async () => {
    setOrgActionLoading(true)
    setMessage('')
    setError('')
    try {
      const tenantId = lastOrganizationResult?.tenantId
      if (!tenantId) {
        throw new Error('请先执行一次“创建并激活合同”，再执行租户暂停级联验证')
      }
      const result = await api.suspendTenant(tenantId, {
        reason: 'organization cockpit cascade suspend',
      })
      setLastContractLifecycleResult({
        action: 'suspend-tenant',
        contractId: lastOrganizationResult?.contractId,
        tenantId,
        payload: result,
      })
      setMessage(`租户 ${tenantId} 已暂停，级联门店 ${result.affectedStoreIds.join(', ') || 'none'}`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOrgActionLoading(false)
    }
  }

  const renewLatestContract = async () => {
    setOrgActionLoading(true)
    setMessage('')
    setError('')
    try {
      const contractId = lastOrganizationResult?.contractId
      if (!contractId) {
        throw new Error('请先执行一次“创建并激活合同”，再执行续签验证')
      }
      const result = await api.renewContract(contractId, {
        newEndDate: contractLifecycleDraft.newEndDate,
        commissionRate: Number(contractLifecycleDraft.amendedCommissionRate),
        remark: 'organization cockpit renewal',
      })
      setLastOrganizationResult(current => current
        ? {
          ...current,
          contractId: result.newContractId,
        }
        : current)
      setLastContractLifecycleResult({
        action: 'renew',
        contractId,
        renewedContractId: result.newContractId,
        payload: result,
      })
      setMessage(`合同 ${contractId} 已续签为 ${result.newContractId}，并切换为当前 active contract`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOrgActionLoading(false)
    }
  }

  const amendLatestContract = async () => {
    setOrgActionLoading(true)
    setMessage('')
    setError('')
    try {
      const contractId = lastOrganizationResult?.contractId
      if (!contractId) {
        throw new Error('请先执行一次“创建并激活合同”，再执行合同变更验证')
      }
      const result = await api.amendContract(contractId, {
        endDate: contractLifecycleDraft.amendedEndDate,
        commissionRate: Number(contractLifecycleDraft.amendedCommissionRate),
        remark: 'organization cockpit amendment',
      })
      setLastContractLifecycleResult({
        action: 'amend',
        contractId,
        payload: result,
      })
      setMessage(`合同 ${contractId} 已变更：end date -> ${contractLifecycleDraft.amendedEndDate}，commission -> ${contractLifecycleDraft.amendedCommissionRate}`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOrgActionLoading(false)
    }
  }

  const terminateLatestContract = async () => {
    setOrgActionLoading(true)
    setMessage('')
    setError('')
    try {
      const contractId = lastOrganizationResult?.contractId
      if (!contractId) {
        throw new Error('请先执行一次“创建并激活合同”，再执行合同终止验证')
      }
      const result = await api.terminateContract(contractId, {
        reason: 'organization cockpit termination',
      })
      setLastContractLifecycleResult({
        action: 'terminate',
        contractId,
        payload: result,
      })
      setMessage(`合同 ${contractId} 已终止，当前门店 contract snapshot 应回到空状态`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOrgActionLoading(false)
    }
  }

  const runIamWorkflow = async () => {
    setIamActionLoading(true)
    setMessage('')
    setError('')
    try {
      const role = await api.createRole({
        roleCode: iamDraft.roleCode,
        roleName: iamDraft.roleName,
        scopeType: iamDraft.scopeType,
        permissionIds: [iamDraft.permissionId],
      })
      const user = await api.createUser({
        userCode: iamDraft.userCode,
        displayName: iamDraft.displayName,
        mobile: iamDraft.mobile,
        storeId: iamDraft.storeId,
      })
      const binding = await api.createUserRoleBinding({
        userId: user.entityId,
        roleId: role.entityId,
        storeId: iamDraft.storeId,
      })
      const permissionDecision = await api.checkPermission({
        userId: user.entityId,
        storeId: iamDraft.storeId,
        permissionId: iamDraft.permissionId,
      })
      setLastIamResult({
        userId: user.entityId,
        roleId: role.entityId,
        bindingId: binding.entityId,
        permissionDecision,
      })
      setUserEffectivePermissions(await api.getUserEffectivePermissions(user.entityId, iamDraft.storeId))
      setStoreEffectiveIam(await api.getStoreEffectiveIam(iamDraft.storeId))
      setMessage(`IAM 主链路已收口：${user.title} 已绑定 ${role.title}，权限 ${permissionDecision.permissionCode ?? iamDraft.permissionCode} = ${permissionDecision.allowed ? 'ALLOWED' : 'DENIED'}`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIamActionLoading(false)
    }
  }

  const runIamPermissionCheck = async () => {
    setIamActionLoading(true)
    setMessage('')
    setError('')
    try {
      const targetUserId = lastIamResult?.userId ?? users[0]?.entityId
      if (!targetUserId) {
        throw new Error('请先创建 IAM 主链路，或确保当前有可用于权限测试的用户')
      }
      const permissionDecision = await api.checkPermission({
        userId: targetUserId,
        storeId: iamDraft.storeId,
        permissionId: iamDraft.permissionId,
        permissionCode: iamDraft.permissionCode,
      })
      setLastIamResult(current => current
        ? {
          ...current,
          permissionDecision,
        }
        : {
          userId: targetUserId,
          roleId: '',
          bindingId: '',
          permissionDecision,
        })
      setMessage(`权限测试完成：${targetUserId} -> ${permissionDecision.permissionCode ?? iamDraft.permissionCode} = ${permissionDecision.allowed ? 'ALLOWED' : 'DENIED'}`)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIamActionLoading(false)
    }
  }

  const changeIamUserStatus = async (nextStatus: 'ACTIVE' | 'SUSPENDED') => {
    setIamActionLoading(true)
    setMessage('')
    setError('')
    try {
      const targetUserId = lastIamResult?.userId ?? users[0]?.entityId
      if (!targetUserId) {
        throw new Error('请先创建或选择一个 IAM 用户，再执行用户生命周期操作')
      }
      const payload = nextStatus === 'ACTIVE'
        ? await api.activateUser(targetUserId)
        : await api.suspendUser(targetUserId)
      setMessage(`用户生命周期已更新：${payload.title} -> ${nextStatus}`)
      await load()
      setUserEffectivePermissions(await api.getUserEffectivePermissions(targetUserId, iamDraft.storeId))
      setStoreEffectiveIam(await api.getStoreEffectiveIam(iamDraft.storeId))
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIamActionLoading(false)
    }
  }

  const changeIamRoleStatus = async (nextStatus: 'ACTIVE' | 'DEPRECATED') => {
    setIamActionLoading(true)
    setMessage('')
    setError('')
    try {
      const targetRoleId = lastIamResult?.roleId ?? roles[0]?.entityId
      if (!targetRoleId) {
        throw new Error('请先创建或选择一个 IAM 角色，再执行角色生命周期操作')
      }
      const payload = nextStatus === 'ACTIVE'
        ? await api.activateRole(targetRoleId)
        : await api.deprecateRole(targetRoleId)
      setMessage(`角色生命周期已更新：${payload.title} -> ${nextStatus}`)
      await load()
      if (lastIamResult?.userId) {
        setUserEffectivePermissions(await api.getUserEffectivePermissions(lastIamResult.userId, iamDraft.storeId))
      }
      setStoreEffectiveIam(await api.getStoreEffectiveIam(iamDraft.storeId))
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIamActionLoading(false)
    }
  }

  const revokeLatestIamBinding = async () => {
    setIamActionLoading(true)
    setMessage('')
    setError('')
    try {
      const targetBindingId = lastIamResult?.bindingId ?? userRoleBindings.find(item => item.status === 'ACTIVE')?.entityId
      if (!targetBindingId) {
        throw new Error('请先创建或选择一个有效 IAM 绑定，再执行撤销')
      }
      const payload = await api.revokeUserRoleBinding(targetBindingId, {
        reason: 'admin console lifecycle validation',
      })
      const targetUserId = lastIamResult?.userId ?? readNullableText(readEntityData(payload).user_id)
      const permissionDecision = targetUserId
        ? await api.checkPermission({
          userId: targetUserId,
          storeId: iamDraft.storeId,
          permissionId: iamDraft.permissionId,
          permissionCode: iamDraft.permissionCode,
        })
        : null
      if (permissionDecision && targetUserId) {
        setLastIamResult(current => current
          ? {...current, bindingId: targetBindingId, permissionDecision}
          : {userId: targetUserId, roleId: '', bindingId: targetBindingId, permissionDecision})
      }
      setMessage(`角色绑定已撤销：${targetBindingId}${permissionDecision ? `，权限结果=${permissionDecision.allowed ? 'ALLOWED' : 'DENIED'}` : ''}`)
      await load()
      if (targetUserId) {
        setUserEffectivePermissions(await api.getUserEffectivePermissions(targetUserId, iamDraft.storeId))
      }
      setStoreEffectiveIam(await api.getStoreEffectiveIam(iamDraft.storeId))
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIamActionLoading(false)
    }
  }

  const upsertProductFlow = async () => {
    setProductActionLoading(true)
    setMessage('')
    setError('')
    try {
      const result = await api.createProduct({
        productName: productDraft.productName,
        ownershipScope: productDraft.ownershipScope,
        brandId: productDraft.ownershipScope === 'BRAND' ? productDraft.brandId : undefined,
        storeId: productDraft.ownershipScope === 'STORE' ? productDraft.storeId : undefined,
        productType: productDraft.productType,
        basePrice: Number(productDraft.basePrice),
        productionSteps: [
          {
            step_code: 'PREPARE',
            step_name: productDraft.productionStepName,
            workstation_code: productDraft.workstationCode,
          },
        ],
        modifierGroups: [
          {
            modifier_group_id: `modifier-${productDraft.modifierGroupName.toLowerCase().replace(/\s+/g, '-')}`,
            group_name: productDraft.modifierGroupName,
            selection_type: 'SINGLE',
          },
        ],
        variants: [
          {
            variant_id: `variant-${productDraft.variantName.toLowerCase().replace(/\s+/g, '-')}`,
            variant_name: productDraft.variantName,
          },
        ],
        comboItemGroups: [
          {
            combo_group_id: `combo-${productDraft.comboGroupName.toLowerCase().replace(/\s+/g, '-')}`,
            group_name: productDraft.comboGroupName,
          },
        ],
      })
      setLastProductResult({
        productId: result.entityId,
        action: 'product-upserted',
        payload: result,
      })
      setOperationDraft(current => ({
        ...current,
        productId: result.entityId,
      }))
      setMessage(`餐饮商品工作流已收口：${result.title} 已创建，规格/加料/生产画像结构已入写模型`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setProductActionLoading(false)
    }
  }

  const changeLatestProductStatus = async (nextAction: 'activate' | 'suspend') => {
    setProductActionLoading(true)
    setMessage('')
    setError('')
    try {
      const productId = lastProductResult?.productId ?? products[0]?.entityId
      if (!productId) {
        throw new Error('请先创建餐饮商品，再执行商品状态操作')
      }
      const result = nextAction === 'activate'
        ? await api.activateProduct(productId)
        : await api.suspendProduct(productId)
      setLastProductResult({
        productId,
        action: `product-${nextAction}`,
        payload: result,
      })
      setMessage(`商品 ${productId} 已${nextAction === 'activate' ? '激活' : '暂停'}`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setProductActionLoading(false)
    }
  }

  const runMenuWorkflow = async () => {
    setMenuActionLoading(true)
    setMessage('')
    setError('')
    try {
      const targetProductId = lastProductResult?.productId ?? products[0]?.entityId
      if (!targetProductId) {
        throw new Error('请先准备至少一个商品，再执行菜单发布工作流')
      }
      const brandMenu = await api.createBrandMenu({
        brandId: menuDraft.brandId,
        menuName: menuDraft.menuName,
        sections: [
          {
            section_id: `section-${menuDraft.sectionName.toLowerCase().replace(/\s+/g, '-')}`,
            section_name: menuDraft.sectionName,
            display_order: 10,
            products: [{product_id: targetProductId, display_order: 10}],
          },
        ],
      })
      await api.submitMenuReview(brandMenu.entityId)
      const approvedMenu = await api.approveMenu(brandMenu.entityId)
      const storeMenu = await api.createStoreMenu({
        storeId: menuDraft.storeId,
        menuName: menuDraft.storeMenuName,
        versionHash: `menu-hash-${Date.now()}`,
        sections: [
          {
            section_id: `section-${menuDraft.sectionName.toLowerCase().replace(/\s+/g, '-')}`,
            section_name: menuDraft.sectionName,
            display_order: 10,
            products: [{product_id: targetProductId, display_order: 10}],
          },
        ],
      })
      setLastMenuResult({
        brandMenuId: brandMenu.entityId,
        storeMenuId: storeMenu.entityId,
        action: 'brand-menu-approved-store-menu-published',
        payload: {
          brandMenu: approvedMenu,
          storeMenu,
        },
      })
      setMessage(`品牌菜单工作流已收口：${brandMenu.title} 已审核通过，并发布门店有效菜单 ${storeMenu.title}`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setMenuActionLoading(false)
    }
  }

  const rejectLatestMenu = async () => {
    setMenuActionLoading(true)
    setMessage('')
    setError('')
    try {
      const menuId = lastMenuResult?.brandMenuId ?? menus[0]?.entityId
      if (!menuId) {
        throw new Error('请先创建品牌菜单，再执行驳回操作')
      }
      const result = await api.rejectMenu(menuId)
      setLastMenuResult(current => ({
        brandMenuId: menuId,
        storeMenuId: current?.storeMenuId,
        action: 'brand-menu-rejected',
        payload: result,
      }))
      setMessage(`品牌菜单 ${menuId} 已驳回`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setMenuActionLoading(false)
    }
  }

  const rollbackLatestStoreMenu = async () => {
    setMenuActionLoading(true)
    setMessage('')
    setError('')
    try {
      const menuId = lastMenuResult?.storeMenuId ?? storeMenus[0]?.entityId
      if (!menuId) {
        throw new Error('请先发布门店菜单，再执行回滚')
      }
      const result = await api.rollbackStoreMenu(menuId)
      setLastMenuResult(current => ({
        brandMenuId: current?.brandMenuId,
        storeMenuId: menuId,
        action: 'store-menu-rolled-back',
        payload: result,
      }))
      setMessage(`门店菜单 ${menuId} 已生成新版本 hash 并完成回滚重发`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setMenuActionLoading(false)
    }
  }

  const runOperationsWorkflow = async () => {
    setOperationActionLoading(true)
    setMessage('')
    setError('')
    try {
      const storeConfig = await api.updateStoreConfig(operationDraft.storeId, {
        businessStatus: operationDraft.businessStatus,
        acceptOrder: operationDraft.acceptOrder,
        operatingHours: [
          {
            weekday: Number(operationDraft.weekday),
            start: operationDraft.startTime,
            end: operationDraft.endTime,
          },
        ],
        extraChargeRules: [
          {
            rule_id: `charge-${operationDraft.extraChargeName.toLowerCase().replace(/\s+/g, '-')}`,
            rule_name: operationDraft.extraChargeName,
            amount: Number(operationDraft.extraChargeAmount),
          },
        ],
      })
      const inventory = await api.updateInventory(operationDraft.storeId, operationDraft.productId, {
        stockId: operationDraft.stockId,
        saleableQuantity: Number(operationDraft.saleableQuantity),
        safetyStock: Number(operationDraft.safetyStock),
        reservedQuantity: Number(operationDraft.reservedQuantity),
      })
      const priceRule = await api.createPriceRule({
        ruleCode: operationDraft.priceRuleCode,
        productId: operationDraft.productId,
        storeId: operationDraft.storeId,
        priceType: operationDraft.priceType,
        channelType: operationDraft.channelType,
        priceDelta: Number(operationDraft.priceDelta),
      })
      const availabilityRule = await api.createAvailabilityRule(operationDraft.storeId, {
        ruleCode: operationDraft.availabilityRuleCode,
        productId: operationDraft.productId,
        channelType: operationDraft.availabilityChannelType,
        available: operationDraft.availabilityAllowed,
      })
      const soldOutResult = await api.soldOutProduct(operationDraft.productId, {
        storeId: operationDraft.storeId,
        reason: operationDraft.soldOutReason,
      })
      setLastOperationResult({
        action: 'store-operating-master-data-upserted',
        payload: {
          storeConfig,
          inventory,
          priceRule,
          availabilityRule,
          soldOutResult,
        },
      })
      setMessage('门店经营主数据已更新：营业配置、库存汇总、价格规则、可售规则和人工沽清状态已写入')
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOperationActionLoading(false)
    }
  }

  const restoreProductAvailability = async () => {
    setOperationActionLoading(true)
    setMessage('')
    setError('')
    try {
      const result = await api.restoreProduct(operationDraft.productId, {
        storeId: operationDraft.storeId,
      })
      setLastOperationResult({
        action: 'product-availability-restored',
        payload: result,
      })
      setMessage(`商品 ${operationDraft.productId} 已恢复可售`)
      await load()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setOperationActionLoading(false)
    }
  }

  return {
    loading,
    error,
    message,
    activeDomain,
    setActiveDomain,
    overview,
    documents,
    outbox,
    preview,
    auditEvents,
    diagnostics,
    orgTree,
    sandboxes,
    platforms,
    projects,
    tenants,
    brands,
    stores,
    contracts,
    businessEntities,
    selectedTenantId,
    setSelectedTenantId,
    selectTenantContext,
    selectedStoreId,
    setSelectedStoreId,
    selectStoreContext,
    tenantStores,
    storeContractMonitor,
    tables,
    workstations,
    users,
    permissions,
    roles,
    userRoleBindings,
    storeEffectiveIam,
    userEffectivePermissions,
    products,
    menus,
    storeMenus,
    storeConfigs,
    inventories,
    priceRules,
    availabilityRules,
    menuAvailability,
    authCapabilities,
    environmentDraft,
    setEnvironmentDraft,
    environmentActionLoading,
    lastEnvironmentResult,
    orgDraft,
    setOrgDraft,
    orgActionLoading,
    contractLifecycleDraft,
    setContractLifecycleDraft,
    lastContractLifecycleResult,
    lastOrganizationResult,
    iamDraft,
    setIamDraft,
    iamActionLoading,
    lastIamResult,
    productDraft,
    setProductDraft,
    productActionLoading,
    lastProductResult,
    menuDraft,
    setMenuDraft,
    menuActionLoading,
    lastMenuResult,
    operationDraft,
    setOperationDraft,
    operationActionLoading,
    lastOperationResult,
    pendingCount,
    failedCount,
    metrics,
    environmentSummary,
    storeSnapshots,
    selectedTenant,
    selectedStore,
    load,
    publish,
    retry,
    previewPublish,
    applyDemoChange,
    rebuildOutbox,
    runEnvironmentSetup,
    cycleEnvironmentLifecycle,
    runOrganizationFlow,
    suspendTenant,
    renewLatestContract,
    amendLatestContract,
    terminateLatestContract,
    runIamWorkflow,
    runIamPermissionCheck,
    changeIamUserStatus,
    changeIamRoleStatus,
    revokeLatestIamBinding,
    upsertProductFlow,
    changeLatestProductStatus,
    runMenuWorkflow,
    rejectLatestMenu,
    rollbackLatestStoreMenu,
    runOperationsWorkflow,
    restoreProductAvailability,
  }
}
