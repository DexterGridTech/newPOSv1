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
  const [filters, setFilters] = useState<Record<PageKey, FilterState>>({} as Record<PageKey, FilterState>)
  const [toast, setToast] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const activeFilter = filters[page] ?? emptyFilter
  const activeStoreId = selectedStoreId || collections.stores[0]?.entityId || 'store-kernel-base-test'
  const activePlatform = collections.platforms.find(platform => platform.entityId === selectedPlatformId)

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
        products,
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
        api.getProducts(),
        api.getMenus(),
        api.getStoreMenus(),
      ])

      const nextPlatformId = selectedPlatformId || platforms.data.find(item => item.entityId === DEFAULT_PLATFORM_ID)?.entityId || platforms.data[0]?.entityId || ''
      const nextProjectId = selectedProjectId || projects.data.find(item => item.entityId === DEFAULT_PROJECT_ID)?.entityId || projects.data.find(item => dataOf(item as CustomerEntity).platform_id === nextPlatformId)?.entityId || projects.data[0]?.entityId || ''
      const nextBrandId = selectedBrandId || brands.data.find(item => item.entityId === DEFAULT_BRAND_ID)?.entityId || brands.data.find(item => dataOf(item as CustomerEntity).platform_id === nextPlatformId)?.entityId || brands.data[0]?.entityId || ''
      const nextStoreId = selectedStoreId || stores.data.find(item => item.entityId === DEFAULT_STORE_ID)?.entityId || stores.data.find(item => dataOf(item as CustomerEntity).project_id === nextProjectId)?.entityId || 'store-kernel-base-test'
      if (!selectedPlatformId && nextPlatformId) setSelectedPlatformId(nextPlatformId)
      if (!selectedProjectId && nextProjectId) setSelectedProjectId(nextProjectId)
      if (!selectedBrandId && nextBrandId) setSelectedBrandId(nextBrandId)
      if (!selectedStoreId && nextStoreId) setSelectedStoreId(nextStoreId)

      const [tables, workstations, storeConfig, stock, priceRules, availabilityRules, availability, projectionItems, logs] = await Promise.all([
        api.getTables(),
        api.getWorkstations(),
        api.getStoreConfigs(),
        api.getInventories(),
        api.getPriceRules(),
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
        productCategories: productCategories.data as CustomerEntity[],
        products: products.data as CustomerEntity[],
        brandMenus: brandMenus.data as CustomerEntity[],
        storeMenus: storeMenus.data as CustomerEntity[],
        storeConfig: storeConfig.data as CustomerEntity[],
        stock: stock.data as CustomerEntity[],
        availability: availability.data as CustomerEntity[],
        priceRules: priceRules.data as CustomerEntity[],
        availabilityRules: availabilityRules.data as CustomerEntity[],
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
                loading={loading}
                onSave={async catalog => {
                  if (!activePlatform) return
                  await api.updateCustomerEntity('platform', activePlatform.entityId, {
                    title: activePlatform.title,
                    status: activePlatform.status,
                    data: {...dataOf(activePlatform), metadata_catalog: catalog},
                    expectedRevision: activePlatform.sourceRevision,
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
                  setModal('permissions')
                }}
                openGrantRole={item => {
                  setSelectedRecord(item)
                  setModal('grantRole')
                }}
                openMenuProducts={item => {
                  setSelectedRecord(item)
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
          onPermissions={() => setModal('permissions')}
          onGrantRole={() => setModal('grantRole')}
          onMenuProducts={() => setModal('menuProducts')}
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
          onClose={() => setModal(null)}
          onSubmit={async values => {
            try {
              if (modal === 'create') {
                await createEntity(page, values, collections, selectedPlatformId, activeStoreId, selectedProjectId, selectedBrandId)
              } else if (selectedRecord) {
                await updateEntity(page, selectedRecord, values, collections, selectedPlatformId, activeStoreId, selectedProjectId, selectedBrandId)
              }
              setModal(null)
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
          onClose={() => setModal(null)}
          onSave={async permissionIds => {
            try {
              await api.updateRolePermissions(selectedRecord.entityId, {
                permissionIds,
                expectedRevision: selectedRecord.sourceRevision,
              })
              setModal(null)
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
          roles={collections.roles}
          projects={collections.projects}
          stores={collections.stores}
          onClose={() => setModal(null)}
          onSave={async values => {
            try {
              await api.createUserRoleBinding(values)
              setModal(null)
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
          onClose={() => setModal(null)}
          onSave={async sections => {
            try {
              await api.updateCustomerEntity(pageToEntityType[page] ?? 'brand_menu', selectedRecord.entityId, {
                data: {...dataOf(selectedRecord), sections},
                expectedRevision: selectedRecord.sourceRevision,
              })
              setModal(null)
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
