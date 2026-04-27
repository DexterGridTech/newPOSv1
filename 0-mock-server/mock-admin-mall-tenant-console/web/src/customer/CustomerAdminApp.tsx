import {useEffect, useMemo, useState} from 'react'
import {api} from '../api'
import {TopContextBar} from './components/TopContextBar'
import {canEditPage, DEFAULT_BRAND_ID, DEFAULT_PLATFORM_ID, DEFAULT_PROJECT_ID, DEFAULT_STORE_ID, emptyCollections, emptyFilter, navGroups, pageMeta, pageToEntityType, REAL_RETAIL_SANDBOX_ID} from './constants'
import {dataOf, asText} from './domain'
import {Dashboard} from './pages/Dashboard'
import {DataStatisticsPage} from './pages/DataStatisticsPage'
import {BusinessDictionariesPage} from './pages/BusinessDictionariesPage'
import {CollectionPage} from './pages/CollectionPage'
import {applyContextScope, applyFilters} from './pages/collectionModel'
import {ProjectionOutboxPage, PublishLogPage} from './pages/ProjectionPages'
import {DetailModal} from './modals/DetailModal'
import {EntityFormModal, createEntity, updateEntity} from './modals/EntityFormModal'
import {GrantRoleModal, MenuProductsModal, RolePermissionModal} from './modals/RelationModals'
import type {CollectionState, CustomerEntity, FilterState, OutboxItem, PageKey, PublishLogItem} from './types'

export function CustomerAdminApp() {
  const initialPage = (new URLSearchParams(window.location.search).get('page') as PageKey) || 'dashboard'
  const [page, setPage] = useState<PageKey>(pageMeta[initialPage] ? initialPage : 'dashboard')
  const [collections, setCollections] = useState<CollectionState>(emptyCollections)
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [publishLog, setPublishLog] = useState<PublishLogItem[]>([])
  const [selectedSandboxId, setSelectedSandboxId] = useState('')
  const [selectedPlatformId, setSelectedPlatformId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<CustomerEntity | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | 'permissions' | 'grantRole' | 'menuProducts' | null>(null)
  const [relationModalOrigin, setRelationModalOrigin] = useState<'detail' | 'row' | null>(null)
  const [filters, setFilters] = useState<Record<PageKey, FilterState>>({} as Record<PageKey, FilterState>)
  const [toast, setToast] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const activeFilter = filters[page] ?? emptyFilter
  const activeStoreId = selectedStoreId || collections.stores[0]?.entityId || 'store-kernel-base-test'
  const activeStore = collections.stores.find(store => store.entityId === activeStoreId) ?? collections.stores[0]
  const activeBrand = collections.brands.find(brand => brand.entityId === selectedBrandId)
    ?? collections.brands.find(brand => brand.entityId === asText(dataOf(activeStore).brand_id, ''))
    ?? collections.brands[0]
  const activeProject = collections.projects.find(project => project.entityId === selectedProjectId)
    ?? collections.projects.find(project => project.entityId === asText(dataOf(activeStore).project_id, ''))
    ?? collections.projects[0]
  const activePlatform = collections.platforms.find(platform => platform.entityId === selectedPlatformId)
    ?? collections.platforms.find(platform => platform.entityId === asText(dataOf(activeBrand).platform_id, ''))
    ?? collections.platforms.find(platform => platform.entityId === asText(dataOf(activeStore).platform_id, ''))
    ?? collections.platforms.find(platform => platform.entityId === asText(dataOf(activeProject).platform_id, ''))
    ?? collections.platforms.find(platform => platform.entityId === DEFAULT_PLATFORM_ID)
    ?? collections.platforms[0]

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const sandboxPage = await api.getSandboxes()
      const sandboxId = selectedSandboxId || sandboxPage.data.find(item => item.entityId === REAL_RETAIL_SANDBOX_ID)?.entityId || sandboxPage.data[0]?.entityId || REAL_RETAIL_SANDBOX_ID
      api.setActiveSandboxId(sandboxId)
      if (!selectedSandboxId) setSelectedSandboxId(sandboxId)

      const [
        platforms,
        projects,
        tenants,
        brands,
        stores,
        contracts,
        businessEntities,
        productCategories,
        permissions,
        roles,
        users,
        roleBindings,
        identityProviderConfigs,
        permissionGroups,
        roleTemplates,
        featurePoints,
        platformFeatureSwitches,
        resourceTags,
        principalGroups,
        groupMembers,
        groupRoleBindings,
        authorizationSessions,
        sodRules,
        highRiskPolicies,
        authAuditLogs,
        products,
        productInheritances,
        brandMenus,
        storeMenus,
      ] = await Promise.all([
        api.getPlatforms(),
        api.getProjects(),
        api.getTenants(),
        api.getBrands(),
        api.getStores(),
        api.getContracts(),
        api.getBusinessEntities(),
        api.getProductCategories(),
        api.getPermissions(),
        api.getRoles(),
        api.getUsers(),
        api.getUserRoleBindings(),
        api.getIdentityProviderConfigs(),
        api.getPermissionGroups(),
        api.getRoleTemplates(),
        api.getFeaturePoints(),
        api.getPlatformFeatureSwitches(),
        api.getResourceTags(),
        api.getPrincipalGroups(),
        api.getGroupMembers(),
        api.getGroupRoleBindings(),
        api.getAuthorizationSessions(),
        api.getSeparationOfDutyRules(),
        api.getHighRiskPermissionPolicies(),
        api.getAuthAuditLogs(),
        api.getProducts(),
        api.getProductInheritances(),
        api.getMenus(),
        api.getStoreMenus(),
      ])

      const platformItems = platforms.data as CustomerEntity[]
      const projectItems = projects.data as CustomerEntity[]
      const brandItems = brands.data as CustomerEntity[]
      const storeItems = stores.data as CustomerEntity[]
      const nextPlatformId = platformItems.some(item => item.entityId === selectedPlatformId)
        ? selectedPlatformId
        : platformItems.find(item => item.entityId === DEFAULT_PLATFORM_ID)?.entityId || platformItems[0]?.entityId || ''
      const nextProjectId = projectItems.some(item => item.entityId === selectedProjectId)
        ? selectedProjectId
        : projectItems.find(item => item.entityId === DEFAULT_PROJECT_ID)?.entityId || projectItems.find(item => dataOf(item).platform_id === nextPlatformId)?.entityId || projectItems[0]?.entityId || ''
      const nextBrandId = brandItems.some(item => item.entityId === selectedBrandId)
        ? selectedBrandId
        : brandItems.find(item => item.entityId === DEFAULT_BRAND_ID)?.entityId || brandItems.find(item => dataOf(item).platform_id === nextPlatformId)?.entityId || brandItems[0]?.entityId || ''
      const fallbackStoreId = storeItems.find(item => item.entityId === DEFAULT_STORE_ID)?.entityId
        || storeItems.find(item => dataOf(item).brand_id === nextBrandId)?.entityId
        || storeItems.find(item => dataOf(item).project_id === nextProjectId)?.entityId
        || 'store-kernel-base-test'
      const nextStoreId = storeItems.some(item => item.entityId === selectedStoreId)
        ? selectedStoreId
        : fallbackStoreId
      if (selectedPlatformId !== nextPlatformId && nextPlatformId) setSelectedPlatformId(nextPlatformId)
      if (selectedProjectId !== nextProjectId && nextProjectId) setSelectedProjectId(nextProjectId)
      if (selectedBrandId !== nextBrandId && nextBrandId) setSelectedBrandId(nextBrandId)
      if (selectedStoreId !== nextStoreId && nextStoreId) setSelectedStoreId(nextStoreId)

      const [tables, workstations, storeConfig, stock, priceRules, bundlePriceRules, channelProductMappings, availabilityRules, availability, projectionItems, logs] = await Promise.all([
        api.getTables(),
        api.getWorkstations(),
        api.getStoreConfigs(),
        api.getInventories(),
        api.getPriceRules(),
        api.getBundlePriceRules(),
        api.getChannelProductMappings(),
        api.getAvailabilityRules(),
        api.getMenuAvailability(),
        api.getProjectionOutbox(),
        api.getProjectionPublishLog(),
      ])

      setCollections({
        sandboxes: sandboxPage.data as CustomerEntity[],
        platforms: platforms.data as CustomerEntity[],
        projects: projects.data as CustomerEntity[],
        tenants: tenants.data as CustomerEntity[],
        brands: brands.data as CustomerEntity[],
        contracts: contracts.data as CustomerEntity[],
        businessEntities: businessEntities.data as CustomerEntity[],
        stores: stores.data as CustomerEntity[],
        tables: tables.data as CustomerEntity[],
        workstations: workstations.data as CustomerEntity[],
        permissions: permissions.data as CustomerEntity[],
        roles: roles.data as CustomerEntity[],
        users: users.data as CustomerEntity[],
        roleBindings: roleBindings.data as CustomerEntity[],
        identityProviderConfigs: identityProviderConfigs.data as CustomerEntity[],
        permissionGroups: permissionGroups.data as CustomerEntity[],
        roleTemplates: roleTemplates.data as CustomerEntity[],
        featurePoints: featurePoints.data as CustomerEntity[],
        platformFeatureSwitches: platformFeatureSwitches.data as CustomerEntity[],
        resourceTags: resourceTags.data as CustomerEntity[],
        principalGroups: principalGroups.data as CustomerEntity[],
        groupMembers: groupMembers.data as CustomerEntity[],
        groupRoleBindings: groupRoleBindings.data as CustomerEntity[],
        authorizationSessions: authorizationSessions.data as CustomerEntity[],
        sodRules: sodRules.data as CustomerEntity[],
        highRiskPolicies: highRiskPolicies.data as CustomerEntity[],
        authAuditLogs: authAuditLogs.data as CustomerEntity[],
        productCategories: productCategories.data as CustomerEntity[],
        products: products.data as CustomerEntity[],
        productInheritances: productInheritances.data as CustomerEntity[],
        brandMenus: brandMenus.data as CustomerEntity[],
        storeMenus: storeMenus.data as CustomerEntity[],
        storeConfig: storeConfig.data as CustomerEntity[],
        stock: stock.data as CustomerEntity[],
        availability: availability.data as CustomerEntity[],
        priceRules: priceRules.data as CustomerEntity[],
        availabilityRules: availabilityRules.data as CustomerEntity[],
        bundlePriceRules: bundlePriceRules.data as CustomerEntity[],
        channelProductMappings: channelProductMappings.data as CustomerEntity[],
      })
      setOutbox(projectionItems.data)
      setPublishLog(logs.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [selectedSandboxId])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', page)
    window.history.replaceState(null, '', url)
  }, [page])

  useEffect(() => {
    if (!selectedPlatformId) return
    const platformProjects = collections.projects.filter(project => dataOf(project).platform_id === selectedPlatformId)
    if (platformProjects.length > 0 && !platformProjects.some(project => project.entityId === selectedProjectId)) {
      setSelectedProjectId(platformProjects[0].entityId)
    }
    const platformBrands = collections.brands.filter(brand => dataOf(brand).platform_id === selectedPlatformId || brand.naturalScopeKey === selectedPlatformId)
    if (platformBrands.length > 0 && !platformBrands.some(brand => brand.entityId === selectedBrandId)) {
      setSelectedBrandId(platformBrands[0].entityId)
    }
  }, [collections.brands, collections.projects, selectedBrandId, selectedPlatformId, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) return
    const projectStores = collections.stores.filter(store => dataOf(store).project_id === selectedProjectId)
    if (projectStores.length > 0 && !projectStores.some(store => store.entityId === selectedStoreId)) {
      setSelectedStoreId(projectStores[0].entityId)
    }
  }, [collections.stores, selectedProjectId, selectedStoreId])

  const scopedCollections = useMemo(() => {
    return collections
  }, [collections])

  const currentItems = useMemo(() => {
    const collectionKey = pageMeta[page].collection
    const items = collectionKey ? scopedCollections[collectionKey] : []
    const filter = {...activeFilter, platformId: 'ALL'}
    const contextFiltered = applyContextScope(items, page, collections, {
      platformId: selectedPlatformId,
      projectId: '',
      brandId: '',
      storeId: '',
    })
    return applyFilters(contextFiltered, filter, collections, page)
  }, [activeFilter, collections, page, scopedCollections, selectedPlatformId])

  const selectPage = (nextPage: PageKey) => {
    setPage(nextPage)
    setSelectedRecord(null)
    setModal(null)
    setRelationModalOrigin(null)
  }

  const closeModal = () => {
    if (relationModalOrigin === 'row') {
      setSelectedRecord(null)
    }
    setModal(null)
    setRelationModalOrigin(null)
  }

  const refreshAfterMutation = async (message: string) => {
    setToast(`${message}。已触发投影，可在投影队列查看状态。`)
    await loadAll()
  }

  const refreshAfterLocalMutation = async (message: string) => {
    setToast(message)
    await loadAll()
  }

  const performAction = async (action: string, item: CustomerEntity) => {
    try {
      if (action === 'activateContract') await api.activateContract(item.entityId)
      if (action === 'terminateContract') await api.terminateContract(item.entityId, {reason: '后台终止合同'})
      if (action === 'disablePriceRule') await api.disablePriceRule(item.entityId, {reason: '后台停用价格规则'})
      if (action === 'revokeBinding') await api.revokeUserRoleBinding(item.entityId, {reason: '后台撤销角色'})
      if (action === 'rollbackMenu') await api.rollbackStoreMenu(item.entityId)
      if (action === 'publishOutbox') await api.publishProjectionOutbox()
      await refreshAfterMutation('操作成功')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  return (
    <main className="customer-v3-shell">
      <TopContextBar
        collections={collections}
        selectedSandboxId={selectedSandboxId}
        selectedPlatformId={selectedPlatformId}
        setSelectedSandboxId={setSelectedSandboxId}
        setSelectedPlatformId={setSelectedPlatformId}
      />
      <div className="customer-v3-body">
        <aside className="customer-v3-nav">
          {navGroups.map(group => (
            <section key={group.title} className="customer-v3-nav-group">
              <h2>{group.title}</h2>
              {group.pages.map(entry => {
                const badge = entry.badge?.(collections, outbox) ?? 0
                return (
                  <button
                    key={entry.key}
                    className={entry.key === page ? 'active' : ''}
                    type="button"
                    onClick={() => selectPage(entry.key)}
                  >
                    <span>{entry.label}</span>
                    {badge > 0 ? <strong>{badge}</strong> : null}
                  </button>
                )
              })}
            </section>
          ))}
        </aside>
        <section className="customer-v3-main">
          {toast ? <div className="customer-v3-toast good">{toast}<button type="button" onClick={() => selectPage('projectionOutbox')}>查看投影状态</button></div> : null}
          {error ? <div className="customer-v3-toast bad">{error}<button type="button" onClick={() => setError('')}>关闭</button></div> : null}
          {page === 'dashboard'
            ? <Dashboard collections={collections} outbox={outbox} selectPage={selectPage} />
            : page === 'dataStatistics'
            ? <DataStatisticsPage collections={collections} outbox={outbox} selectedPlatformId={selectedPlatformId} selectPage={selectPage} />
            : page === 'businessDictionaries'
            ? (
              <BusinessDictionariesPage
                platform={activePlatform}
                brand={activeBrand}
                store={activeStore}
                brands={collections.brands}
                stores={collections.stores}
                selectedBrandId={selectedBrandId}
                selectedStoreId={selectedStoreId}
                loading={loading}
                onSelectBrand={setSelectedBrandId}
                onSelectStore={setSelectedStoreId}
                onSave={async (scope, owner, catalog) => {
                  const entityType = scope === 'BRAND' ? 'brand' : scope === 'STORE' ? 'store' : 'platform'
                  const ownerData = dataOf(owner)
                  const existingCatalog = typeof ownerData.metadata_catalog === 'object' && ownerData.metadata_catalog !== null && !Array.isArray(ownerData.metadata_catalog)
                    ? ownerData.metadata_catalog as Record<string, unknown>
                    : {}
                  await api.updateCustomerEntity(entityType, owner.entityId, {
                    title: owner.title,
                    status: owner.status,
                    data: {...ownerData, metadata_catalog: {...existingCatalog, ...catalog}},
                    expectedRevision: owner.sourceRevision,
                  })
                  await refreshAfterMutation('业务字典已保存')
                }}
              />
            )
            : page === 'projectionOutbox'
            ? <ProjectionOutboxPage outbox={outbox} loading={loading} onPublish={() => performAction('publishOutbox', {} as CustomerEntity)} setSelectedRecord={setSelectedRecord} />
            : page === 'publishLog'
            ? <PublishLogPage logs={publishLog} setSelectedRecord={setSelectedRecord} />
            : (
              <CollectionPage
                page={page}
                loading={loading}
                items={currentItems}
                filter={activeFilter}
                collections={collections}
                selectedPlatformId={selectedPlatformId}
                selectedStoreId={activeStoreId}
                selectedBrandId={selectedBrandId}
                setFilter={next => setFilters(prev => ({...prev, [page]: next}))}
                openCreate={() => setModal('create')}
                openDetail={setSelectedRecord}
                openEdit={item => {
                  if (!canEditPage(page)) return
                  setSelectedRecord(item)
                  setModal('edit')
                }}
                openPermissions={item => {
                  setSelectedRecord(item)
                  setRelationModalOrigin('row')
                  setModal('permissions')
                }}
                openGrantRole={item => {
                  setSelectedRecord(item)
                  setRelationModalOrigin('row')
                  setModal('grantRole')
                }}
                openMenuProducts={item => {
                  setSelectedRecord(item)
                  setRelationModalOrigin('row')
                  setModal('menuProducts')
                }}
                performAction={performAction}
              />
            )}
        </section>
      </div>
      {selectedRecord && !modal ? (
        <DetailModal
          page={page}
          item={selectedRecord}
          collections={collections}
          onClose={() => setSelectedRecord(null)}
          onEdit={() => setModal('edit')}
          onPermissions={() => {
            setRelationModalOrigin('detail')
            setModal('permissions')
          }}
          onGrantRole={() => {
            setRelationModalOrigin('detail')
            setModal('grantRole')
          }}
          onMenuProducts={() => {
            setRelationModalOrigin('detail')
            setModal('menuProducts')
          }}
          performAction={performAction}
        />
      ) : null}
      {modal === 'create' || modal === 'edit' ? (
        <EntityFormModal
          mode={modal}
          page={page}
          item={selectedRecord}
          collections={collections}
          selectedPlatformId={selectedPlatformId}
          selectedStoreId={activeStoreId}
          selectedProjectId={selectedProjectId}
          selectedBrandId={selectedBrandId}
          onClose={closeModal}
          onSubmit={async values => {
            try {
              if (modal === 'create') {
                await createEntity(page, values, collections, selectedPlatformId, activeStoreId, selectedProjectId, selectedBrandId)
              } else if (selectedRecord) {
                await updateEntity(page, selectedRecord, values, collections, selectedPlatformId, activeStoreId, selectedProjectId, selectedBrandId)
              }
              setModal(null)
              setRelationModalOrigin(null)
              if (page === 'environment') {
                await refreshAfterLocalMutation(modal === 'create' ? '沙箱已创建，可在顶部沙箱选择器切换。' : '沙箱已保存。')
              } else {
                await refreshAfterMutation(modal === 'create' ? '创建成功' : '保存成功')
              }
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : '保存失败')
            }
          }}
        />
      ) : null}
      {modal === 'permissions' && selectedRecord ? (
        <RolePermissionModal
          role={selectedRecord}
          permissions={collections.permissions}
          highRiskPolicies={collections.highRiskPolicies}
          onClose={closeModal}
          onSave={async permissionIds => {
            try {
              await api.updateRolePermissions(selectedRecord.entityId, {
                permissionIds,
                expectedRevision: selectedRecord.sourceRevision,
              })
              setModal(null)
              setRelationModalOrigin(null)
              await refreshAfterMutation('角色权限已保存')
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : '保存失败')
            }
          }}
        />
      ) : null}
      {modal === 'grantRole' && selectedRecord ? (
        <GrantRoleModal
          user={selectedRecord}
          collections={collections}
          onClose={closeModal}
          onSave={async values => {
            try {
              await api.createUserRoleBinding(values)
              setModal(null)
              setRelationModalOrigin(null)
              await refreshAfterMutation('角色已授予')
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : '授予失败')
            }
          }}
        />
      ) : null}
      {modal === 'menuProducts' && selectedRecord ? (
        <MenuProductsModal
          menu={selectedRecord}
          products={collections.products}
          onClose={closeModal}
          onSave={async sections => {
            try {
              await api.updateCustomerEntity(pageToEntityType[page] ?? 'brand_menu', selectedRecord.entityId, {
                data: {...dataOf(selectedRecord), sections},
                expectedRevision: selectedRecord.sourceRevision,
              })
              setModal(null)
              setRelationModalOrigin(null)
              await refreshAfterMutation('菜单商品已保存')
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : '保存失败')
            }
          }}
        />
      ) : null}
    </main>
  )
}
