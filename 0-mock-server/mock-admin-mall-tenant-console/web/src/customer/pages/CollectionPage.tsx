import {useEffect, useState, type MouseEvent} from 'react'
import {DEFAULT_TABLE_PAGE_SIZE, canEditPage, emptyFilter, pageMeta} from '../constants'
import type {CollectionState, CustomerEntity, FilterState, PageKey} from '../types'
import {EmptyState, PageHeader, PaginationControls, SkeletonTable, StatusBadge} from '../components/common'
import {asArray, asText, dataOf, enumLabel} from '../domain'
import {metadataOptions, platformMetadataOptions, type MetadataOption, type PlatformMetadataKey} from '../metadata'
import {columnsFor} from './collectionModel'

export function CollectionPage(props: {
  page: PageKey
  loading: boolean
  items: CustomerEntity[]
  filter: FilterState
  collections: CollectionState
  selectedPlatformId: string
  selectedStoreId: string
  selectedBrandId: string
  setFilter: (value: FilterState) => void
  openCreate: () => void
  openDetail: (item: CustomerEntity) => void
  openEdit: (item: CustomerEntity) => void
  openPermissions: (item: CustomerEntity) => void
  openGrantRole: (item: CustomerEntity) => void
  openMenuProducts: (item: CustomerEntity) => void
  performAction: (action: string, item: CustomerEntity) => Promise<void>
}) {
  const meta = pageMeta[props.page]
  const columns = columnsFor(props.page, props.collections)
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const resetKey = `${props.page}:${props.items.length}:${Object.values(props.filter).join(':')}`
  useEffect(() => {
    setTablePage(1)
  }, [resetKey])
  const totalPages = Math.max(1, Math.ceil(props.items.length / pageSize))
  const safePage = Math.min(tablePage, totalPages)
  const pagedItems = props.items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const canCreate = Boolean(meta.createLabel && canEditPage(props.page))
  return (
    <section>
      <PageHeader
        title={meta.title}
        scope={meta.scope}
        action={canCreate ? <button type="button" onClick={props.openCreate}>{meta.createLabel}</button> : undefined}
      />
      {props.page === 'stores' ? (
        <div className="customer-v3-note">门店的当前租户和品牌由合同生效写入。如需变更，请前往经营合同。</div>
      ) : null}
      <FilterBar
        page={props.page}
        value={props.filter}
        setValue={props.setFilter}
        collections={props.collections}
        selectedPlatformId={props.selectedPlatformId}
        selectedStoreId={props.selectedStoreId}
        selectedBrandId={props.selectedBrandId}
      />
      {props.loading ? <SkeletonTable /> : props.items.length === 0 ? <EmptyState title="没有符合条件的结果" detail={emptyStateDetail(props.page, canCreate)} /> : (
        <>
          <div className="customer-v3-table-wrap">
            <table className="customer-v3-table">
              <thead>
                <tr>
                  {columns.map(column => <th key={column.label}>{column.label}</th>)}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => (
                  <tr key={item.entityId} onClick={() => props.openDetail(item)}>
                    {columns.map(column => <td key={column.label}>{column.render(item)}</td>)}
                    <td>
                      <RowActions
                        page={props.page}
                        item={item}
                        openEdit={props.openEdit}
                        openDetail={props.openDetail}
                        openPermissions={props.openPermissions}
                        openGrantRole={props.openGrantRole}
                        openMenuProducts={props.openMenuProducts}
                        performAction={props.performAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            total={props.items.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setTablePage}
            onPageSizeChange={nextSize => {
              setPageSize(nextSize)
              setTablePage(1)
            }}
          />
        </>
      )}
    </section>
  )
}

function emptyStateDetail(page: PageKey, canCreate: boolean) {
  if (canCreate) return '可以调整筛选条件或创建新记录。'
  if (page === 'authorizationSessions') return '授权会话由鉴权流程产生，可以调整筛选条件查看历史会话。'
  if (page === 'authAuditLogs') return '鉴权审计由系统写入，可以调整筛选条件查看历史决策。'
  return '可以调整筛选条件查看已有记录。'
}

type FilterOption = {label: string; value: string}

const storeMetadataFilterReset: Partial<FilterState> = {
  tableArea: 'ALL',
  tableType: 'ALL',
  workstationType: 'ALL',
  priceType: 'ALL',
  channelType: 'ALL',
  discountType: 'ALL',
  availabilityRuleType: 'ALL',
}

const brandMetadataFilterReset: Partial<FilterState> = {
  productType: 'ALL',
  workstationCategory: 'ALL',
  productCategoryId: 'ALL',
}

const pageStatusOptions: Partial<Record<PageKey, FilterOption[]>> = {
  environment: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED'), optionFromValue('CLOSED')],
  platforms: metadataOptions.isvStatuses,
  projects: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED'), optionFromValue('PREPARING')],
  tenants: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  brands: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  businessEntities: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  contracts: [optionFromValue('PENDING'), optionFromValue('ACTIVE'), optionFromValue('TERMINATED'), optionFromValue('EXPIRED')],
  stores: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  tables: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  workstations: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED')],
  permissions: metadataOptions.commonStatuses,
  roles: metadataOptions.roleStatuses,
  users: metadataOptions.userStatuses,
  roleBindings: [optionFromValue('ACTIVE'), optionFromValue('REVOKED'), optionFromValue('EXPIRED')],
  groupRoleBindings: [optionFromValue('ACTIVE'), optionFromValue('REVOKED'), optionFromValue('EXPIRED')],
  identityProviderConfigs: metadataOptions.idpStatuses,
  permissionGroups: metadataOptions.commonStatuses,
  roleTemplates: metadataOptions.commonStatuses,
  featurePoints: metadataOptions.commonStatuses,
  platformFeatureSwitches: metadataOptions.commonStatuses,
  resourceTags: metadataOptions.commonStatuses,
  principalGroups: metadataOptions.commonStatuses,
  groupMembers: [optionFromValue('ACTIVE'), optionFromValue('REVOKED')],
  authorizationSessions: [optionFromValue('APPROVED'), optionFromValue('DENIED'), optionFromValue('EXPIRED')],
  sodRules: metadataOptions.commonStatuses,
  highRiskPolicies: metadataOptions.commonStatuses,
  authAuditLogs: metadataOptions.commonStatuses,
  productCategories: metadataOptions.commonStatuses,
  products: [optionFromValue('ACTIVE'), optionFromValue('SUSPENDED'), optionFromValue('SOLD_OUT')],
  productInheritances: metadataOptions.commonStatuses,
  brandMenus: metadataOptions.commonStatuses,
  storeMenus: metadataOptions.commonStatuses,
  storeConfig: metadataOptions.commonStatuses,
  stock: metadataOptions.commonStatuses,
  availabilityRules: metadataOptions.commonStatuses,
  availability: metadataOptions.commonStatuses,
  priceRules: [optionFromValue('ACTIVE'), optionFromValue('DISABLED')],
  bundlePriceRules: [optionFromValue('ACTIVE'), optionFromValue('DISABLED')],
  channelProductMappings: metadataOptions.commonStatuses,
}

function FilterBar({page, value, setValue, collections, selectedPlatformId, selectedStoreId, selectedBrandId}: {
  page: PageKey
  value: FilterState
  setValue: (value: FilterState) => void
  collections: CollectionState
  selectedPlatformId: string
  selectedStoreId: string
  selectedBrandId: string
}) {
  const update = (patch: Partial<FilterState>) => setValue({...value, ...patch})
  const updateProject = (projectId: string) => update({projectId, storeId: 'ALL', ...storeMetadataFilterReset})
  const updateStore = (storeId: string) => update({storeId, ...storeMetadataFilterReset})
  const updateBrand = (brandId: string) => update({brandId, ...brandMetadataFilterReset})
  const selectedPlatform = collections.platforms.find(platform => platform.entityId === selectedPlatformId)
  const platformProjects = selectedPlatformId ? collections.projects.filter(project => dataOf(project).platform_id === selectedPlatformId) : collections.projects
  const platformProjectIds = new Set(platformProjects.map(project => project.entityId))
  const platformStores = selectedPlatformId ? collections.stores.filter(store => platformProjectIds.has(asText(dataOf(store).project_id, ''))) : collections.stores
  const selectedProjectStores = value.projectId === 'ALL'
    ? platformStores
    : platformStores.filter(store => asText(dataOf(store).project_id, '') === value.projectId)
  const platformStoreIds = new Set(platformStores.map(store => store.entityId))
  const platformBrands = selectedPlatformId ? collections.brands.filter(brand => dataOf(brand).platform_id === selectedPlatformId || brand.naturalScopeKey === selectedPlatformId) : collections.brands
  const platformBrandIds = new Set(platformBrands.map(brand => brand.entityId))
  const contextStore = value.storeId === 'ALL'
    ? undefined
    : selectedProjectStores.find(store => store.entityId === value.storeId)
  const selectedStoreBrandId = asText(dataOf(contextStore).brand_id, '')
  const contextBrandId = value.brandId === 'ALL' ? selectedStoreBrandId : value.brandId
  const contextBrand = contextBrandId ? platformBrands.find(brand => brand.entityId === contextBrandId) : undefined
  const platformTenants = selectedPlatformId ? collections.tenants.filter(tenant => dataOf(tenant).platform_id === selectedPlatformId || tenant.naturalScopeKey === selectedPlatformId) : collections.tenants
  const platformTenantIds = new Set(platformTenants.map(tenant => tenant.entityId))
  const platformBusinessEntities = selectedPlatformId
    ? collections.businessEntities.filter(entity => platformTenantIds.has(asText(dataOf(entity).tenant_id, '')))
    : collections.businessEntities
  const platformRoles = selectedPlatformId ? collections.roles.filter(role => dataOf(role).platform_id === selectedPlatformId || role.naturalScopeKey === selectedPlatformId) : collections.roles
  const platformPermissions = selectedPlatformId ? collections.permissions.filter(permission => dataOf(permission).platform_id === selectedPlatformId || permission.naturalScopeKey === selectedPlatformId) : collections.permissions
  const platformGroups = selectedPlatformId ? collections.principalGroups.filter(group => dataOf(group).platform_id === selectedPlatformId || group.naturalScopeKey === selectedPlatformId) : collections.principalGroups
  const platformFeatures = selectedPlatformId ? collections.featurePoints.filter(feature => dataOf(feature).platform_id === selectedPlatformId || feature.naturalScopeKey === selectedPlatformId) : collections.featurePoints
  const platformUsers = selectedPlatformId ? collections.users.filter(user => {
    const storeId = asText(dataOf(user).store_id, '')
    return !storeId || platformStoreIds.has(storeId)
  }) : collections.users
  const platformProducts = collections.products.filter(product => {
    const data = dataOf(product)
    const brandId = asText(data.brand_id, '')
    const storeId = asText(data.store_id, '')
    return (!selectedPlatformId || !brandId || platformBrandIds.has(brandId)) && (!selectedPlatformId || !storeId || platformStoreIds.has(storeId))
  })
  const platformContracts = collections.contracts.filter(contract => !selectedPlatformId || platformStoreIds.has(asText(dataOf(contract).store_id, '')) || platformBrandIds.has(asText(dataOf(contract).brand_id, '')))
  const statusOptions = pageStatusOptions[page] ?? metadataOptions.commonStatuses
  const regionOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'regions'),
    uniqueOptions(platformProjects, projectRegionCode, (_value, project) => projectRegionLabel(project)),
  )
  const businessModeOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'project_business_modes'),
    uniqueOptions(platformProjects, project => asText(dataOf(project).business_mode, ''), value => enumLabel(value)),
  )
  const categoryOptions = categoryOptionsFor(page, selectedPlatform, platformBrands)
  const floorOptions = uniqueOptions(platformStores, store => asText(dataOf(store).floor, ''))
  const storeTypeOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'store_cooperation_modes'),
    uniqueOptions(platformStores, store => asText(dataOf(store).store_type, ''), value => enumLabel(value)),
  )
  const billingModeOptions = mergeOptions(
    [
      {value: 'FIXED_RENT', label: '固定租金'},
      {value: 'REVENUE_SHARE', label: '流水分成'},
      {value: 'FIXED_RATE', label: '固定扣点'},
    ],
    uniqueOptions(platformContracts, contract => asText(dataOf(contract).billing_mode ?? dataOf(contract).commission_type, ''), value => enumLabel(value)),
  )
  const capacityOptions = uniqueOptions(collections.tables.filter(table => !selectedPlatformId || platformStoreIds.has(asText(dataOf(table).store_id, ''))), table => asText(dataOf(table).capacity, ''))
  const tableAreaOptions = contextStore ? ownerMetadataOptions(contextStore, 'table_areas') : []
  const tableTypeOptions = contextStore ? ownerMetadataOptions(contextStore, 'table_types') : []
  const workstationTypeOptions = contextStore ? ownerMetadataOptions(contextStore, 'workstation_types') : []
  const workstationCategoryOptions = contextBrand ? ownerMetadataOptions(contextBrand, 'production_categories') : []
  const productTypeOptions = contextBrand ? ownerMetadataOptions(contextBrand, 'product_types') : []
  const productCategoryOptions = collections.productCategories
    .filter(category => !selectedPlatformId || platformBrandIds.has(asText(dataOf(category).brand_id ?? dataOf(category).owner_id, '')) || platformStoreIds.has(asText(dataOf(category).store_id ?? dataOf(category).owner_id, '')))
    .map(category => ({label: category.title, value: category.entityId}))
  const priceTypeOptions = contextStore ? ownerMetadataOptions(contextStore, 'price_types') : []
  const channelOptions = contextStore ? ownerMetadataOptions(contextStore, 'channel_types') : []
  const discountOptions = contextStore ? ownerMetadataOptions(contextStore, 'discount_types') : []
  const availabilityRuleTypeOptions = contextStore ? ownerMetadataOptions(contextStore, 'availability_rule_types') : []
  const settlementCycleOptions = mergeOptions(
    uniqueOptions(platformTenants, tenant => asText(dataOf(tenant).settlement_cycle, ''), settlementCycleLabel),
    uniqueOptions(platformBusinessEntities, entity => asText(dataOf(entity).settlement_cycle, ''), settlementCycleLabel),
  )
  const featureCodeOptions = uniqueOptions(platformFeatures, feature => asText(dataOf(feature).feature_code, feature.entityId), (_value, feature) => feature.title)
  return (
    <div className="customer-v3-filter">
      <label>
        <span>搜索</span>
        <input value={value.search} onChange={event => update({search: event.target.value})} placeholder={searchPlaceholderFor(page)} />
      </label>
      <label>
        <span>状态</span>
        <select value={value.status} onChange={event => update({status: event.target.value})}>
          <option value="ALL">全部状态</option>
          {statusOptions.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </label>
      {page === 'environment' ? (
        <SelectFilter label="环境类型" value={value.sandboxType} onChange={sandboxType => update({sandboxType})} allLabel="全部类型" options={metadataOptions.sandboxTypes} />
      ) : null}
      {page === 'platforms' ? (
        <SelectFilter label="ISV 状态" value={value.isvStatus} onChange={isvStatus => update({isvStatus})} allLabel="全部 ISV 状态" options={metadataOptions.isvStatuses} />
      ) : null}
      {page === 'projects' ? (
        <>
          <SelectFilter label="大区" value={value.region} onChange={region => update({region})} allLabel="全部大区" options={regionOptions} />
          <SelectFilter label="项目业态" value={value.businessMode} onChange={businessMode => update({businessMode})} allLabel="全部业态" options={businessModeOptions} />
        </>
      ) : null}
      {categoryOptions.length > 0 ? (
        <SelectFilter label="品类" value={value.category} onChange={category => update({category})} allLabel="全部品类" options={categoryOptions} />
      ) : null}
      {page === 'tenants' && settlementCycleOptions.length > 0 ? (
        <SelectFilter label="结算周期" value={value.settlementCycle} onChange={settlementCycle => update({settlementCycle})} allLabel="全部周期" options={settlementCycleOptions} />
      ) : null}
      {['contracts', 'stores'].includes(page) ? (
        <>
          <SelectFilter label="大区" value={value.region} onChange={region => update({region})} allLabel="全部大区" options={regionOptions} />
          <SelectFilter label="项目业态" value={value.businessMode} onChange={businessMode => update({businessMode})} allLabel="全部业态" options={businessModeOptions} />
        </>
      ) : null}
      {page === 'businessEntities' ? (
        <>
          <label>
            <span>所属租户</span>
            <select value={value.tenantId} onChange={event => update({tenantId: event.target.value})}>
              <option value="ALL">全部租户</option>
              {platformTenants.map(tenant => <option key={tenant.entityId} value={tenant.entityId}>{tenant.title}</option>)}
            </select>
          </label>
          {settlementCycleOptions.length > 0 ? (
            <SelectFilter label="结算周期" value={value.settlementCycle} onChange={settlementCycle => update({settlementCycle})} allLabel="全部周期" options={settlementCycleOptions} />
          ) : null}
        </>
      ) : null}
      {['contracts', 'stores', 'tables', 'workstations', 'users', 'roleBindings', 'productInheritances', 'storeMenus', 'storeConfig', 'stock', 'availability', 'priceRules', 'bundlePriceRules', 'channelProductMappings'].includes(page) ? (
        <label>
          <span>项目</span>
          <select value={value.projectId} onChange={event => updateProject(event.target.value)}>
            <option value="ALL">全部项目</option>
            {platformProjects.map(project => <option key={project.entityId} value={project.entityId}>{project.title}</option>)}
          </select>
        </label>
      ) : null}
      {['users', 'roleBindings', 'groupRoleBindings'].includes(page) ? (
        <label>
          <span>角色</span>
          <select value={value.roleId} onChange={event => update({roleId: event.target.value})}>
            <option value="ALL">全部角色</option>
            {platformRoles.map(role => <option key={role.entityId} value={role.entityId}>{role.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'roleBindings' || page === 'authorizationSessions' ? (
        <label>
          <span>用户</span>
          <select value={value.userId} onChange={event => update({userId: event.target.value})}>
            <option value="ALL">全部用户</option>
            {platformUsers.map(user => <option key={user.entityId} value={user.entityId}>{user.title}</option>)}
          </select>
        </label>
      ) : null}
      {['groupMembers', 'groupRoleBindings'].includes(page) ? (
        <label>
          <span>用户组</span>
          <select value={value.groupId} onChange={event => update({groupId: event.target.value})}>
            <option value="ALL">全部用户组</option>
            {platformGroups.map(group => <option key={group.entityId} value={group.entityId}>{group.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'stores' && floorOptions.length > 0 ? (
        <SelectFilter label="楼层" value={value.floor} onChange={floor => update({floor})} allLabel="全部楼层" options={floorOptions} />
      ) : null}
      {['contracts', 'tables', 'workstations', 'users', 'roleBindings', 'productInheritances', 'storeConfig', 'stock', 'availability', 'priceRules', 'bundlePriceRules', 'channelProductMappings', 'storeMenus'].includes(page) ? (
        <label>
          <span>门店</span>
          <select value={value.storeId} onChange={event => updateStore(event.target.value)}>
            <option value="ALL">全部门店</option>
            {selectedProjectStores.map(store => <option key={store.entityId} value={store.entityId}>{store.title}</option>)}
          </select>
        </label>
      ) : null}
      {['products', 'brandMenus', 'contracts', 'stores', 'storeMenus'].includes(page) ? (
        <label>
          <span>品牌</span>
          <select value={value.brandId} onChange={event => updateBrand(event.target.value)}>
            <option value="ALL">全部品牌</option>
            {platformBrands.map(brand => <option key={brand.entityId} value={brand.entityId}>{brand.title}</option>)}
          </select>
        </label>
      ) : null}
      {['contracts', 'stores'].includes(page) ? (
        <label>
          <span>租户</span>
          <select value={value.tenantId} onChange={event => update({tenantId: event.target.value})}>
            <option value="ALL">全部租户</option>
            {platformTenants.map(tenant => <option key={tenant.entityId} value={tenant.entityId}>{tenant.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'tenants' || page === 'brands' ? (
        <label>
          <span>生效合同</span>
          <select value={value.activeContract} onChange={event => update({activeContract: event.target.value})}>
            <option value="ALL">全部</option>
            <option value="true">有生效合同</option>
            <option value="false">无生效合同</option>
          </select>
        </label>
      ) : null}
      {page === 'brands' ? (
        <>
          <label>
            <span>ERP 接入</span>
            <select value={value.erpStatus} onChange={event => update({erpStatus: event.target.value})}>
              <option value="ALL">全部</option>
              <option value="true">已接入</option>
              <option value="false">未接入</option>
            </select>
          </label>
          <label>
            <span>标准菜单</span>
            <select value={value.standardMenu} onChange={event => update({standardMenu: event.target.value})}>
              <option value="ALL">全部</option>
              <option value="true">已启用</option>
              <option value="false">未启用</option>
            </select>
          </label>
        </>
      ) : null}
      {page === 'stores' ? (
        <>
          <SelectFilter label="合作模式" value={value.storeType} onChange={storeType => update({storeType})} allLabel="全部模式" options={storeTypeOptions} />
          <label>
            <span>合同状态</span>
            <select value={value.contractStatus} onChange={event => update({contractStatus: event.target.value})}>
              <option value="ALL">全部合同</option>
              <option value="ACTIVE">生效中</option>
              <option value="PENDING">待生效</option>
              <option value="NO_CONTRACT">无合同</option>
              <option value="TERMINATED">已终止</option>
              <option value="EXPIRED">已到期</option>
            </select>
          </label>
          <label>
            <span>营业状态</span>
            <select value={value.operatingStatus} onChange={event => update({operatingStatus: event.target.value})}>
              <option value="ALL">全部营业状态</option>
              {metadataOptions.storeOperatingStatuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {page === 'contracts' ? (
        <SelectFilter label="计费模式" value={value.billingMode} onChange={billingMode => update({billingMode})} allLabel="全部计费模式" options={billingModeOptions} />
      ) : null}
      {page === 'tables' ? (
        <>
          <SelectFilter label="桌台区域" value={value.tableArea} onChange={tableArea => update({tableArea})} allLabel="全部区域" options={tableAreaOptions} disabled={!contextStore || tableAreaOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="桌台类型" value={value.tableType} onChange={tableType => update({tableType})} allLabel="全部类型" options={tableTypeOptions} disabled={!contextStore || tableTypeOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="桌台状态" value={value.tableStatus} onChange={tableStatus => update({tableStatus})} allLabel="全部桌台状态" options={metadataOptions.tableStatuses} />
          <SelectFilter label="座位数" value={value.capacity} onChange={capacity => update({capacity})} allLabel="全部座位数" options={capacityOptions} />
          <SelectFilter label="可预订配置" value={value.reservable} onChange={reservable => update({reservable})} allLabel="全部" options={[{value: 'true', label: '支持'}, {value: 'false', label: '不支持'}]} />
        </>
      ) : null}
      {page === 'workstations' ? (
        <>
          <SelectFilter label="工作站类型" value={value.workstationType} onChange={workstationType => update({workstationType})} allLabel="全部类型" options={workstationTypeOptions} disabled={!contextStore || workstationTypeOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="出品品类" value={value.workstationCategory} onChange={workstationCategory => update({workstationCategory})} allLabel="全部品类" options={workstationCategoryOptions} disabled={!contextBrand || workstationCategoryOptions.length === 0} disabledLabel={!contextBrand ? '先选择品牌或门店' : '未维护品牌字典'} />
        </>
      ) : null}
      {page === 'permissions' ? (
        <>
          <SelectFilter label="权限类型" value={value.permissionType} onChange={permissionType => update({permissionType})} allLabel="全部类型" options={metadataOptions.permissionTypes} />
          <SelectFilter label="授权范围" value={value.scopeType} onChange={scopeType => update({scopeType})} allLabel="全部范围" options={metadataOptions.scopeTypes} />
          {featureCodeOptions.length > 0 ? (
            <SelectFilter label="关联功能点" value={value.featureCode} onChange={featureCode => update({featureCode})} allLabel="全部功能点" options={featureCodeOptions} />
          ) : null}
          <SelectFilter label="风险控制" value={value.riskControl} onChange={riskControl => update({riskControl})} allLabel="全部风险" options={[{value: 'HIGH_RISK', label: '高风险权限'}, {value: 'APPROVAL', label: '需要审批'}, {value: 'MFA', label: '需要 MFA'}]} />
        </>
      ) : null}
      {page === 'users' ? (
        <SelectFilter label="身份来源" value={value.identitySource} onChange={identitySource => update({identitySource})} allLabel="全部来源" options={metadataOptions.identitySources} />
      ) : null}
      {page === 'roles' ? (
        <>
          <SelectFilter label="角色来源" value={value.roleType} onChange={roleType => update({roleType})} allLabel="全部来源" options={metadataOptions.roleTypes} />
          <SelectFilter label="授权范围" value={value.scopeType} onChange={scopeType => update({scopeType})} allLabel="全部范围" options={metadataOptions.scopeTypes} />
          <label>
            <span>包含权限</span>
            <select value={value.permissionId} onChange={event => update({permissionId: event.target.value})}>
              <option value="ALL">全部权限</option>
              {platformPermissions.map(permission => <option key={permission.entityId} value={permission.entityId}>{permission.title}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {page === 'resourceTags' ? (
        <SelectFilter label="资源类型" value={value.resourceType} onChange={resourceType => update({resourceType})} allLabel="全部资源类型" options={metadataOptions.resourceTypes} />
      ) : null}
      {page === 'identityProviderConfigs' ? (
        <>
          <SelectFilter label="身份源类型" value={value.idpType} onChange={idpType => update({idpType})} allLabel="全部类型" options={metadataOptions.idpTypes} />
          <SelectFilter label="定时同步" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部同步状态" options={metadataOptions.yesNo} />
        </>
      ) : null}
      {page === 'roleTemplates' ? (
        <>
          <SelectFilter label="推荐范围" value={value.scopeType} onChange={scopeType => update({scopeType})} allLabel="全部范围" options={metadataOptions.scopeTypes} />
          <SelectFilter label="模板状态" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部启用状态" options={metadataOptions.yesNo} />
        </>
      ) : null}
      {page === 'featurePoints' ? (
        <SelectFilter label="启用状态" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部启用状态" options={metadataOptions.yesNo} />
      ) : null}
      {page === 'platformFeatureSwitches' ? (
        <>
          {featureCodeOptions.length > 0 ? (
            <SelectFilter label="功能点" value={value.featureCode} onChange={featureCode => update({featureCode})} allLabel="全部功能点" options={featureCodeOptions} />
          ) : null}
          <SelectFilter label="启用状态" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部启用状态" options={metadataOptions.yesNo} />
        </>
      ) : null}
      {page === 'principalGroups' ? (
        <SelectFilter label="用户组类型" value={value.groupType} onChange={groupType => update({groupType})} allLabel="全部类型" options={metadataOptions.principalGroupTypes} />
      ) : null}
      {page === 'groupMembers' ? (
        <SelectFilter label="成员来源" value={value.groupMemberSource} onChange={groupMemberSource => update({groupMemberSource})} allLabel="全部来源" options={metadataOptions.groupMemberSources} />
      ) : null}
      {page === 'roleBindings' || page === 'groupRoleBindings' ? (
        <>
          <SelectFilter label="授权范围" value={value.scopeType} onChange={scopeType => update({scopeType})} allLabel="全部范围" options={metadataOptions.scopeTypes} />
          <SelectFilter label="策略结果" value={value.policyEffect} onChange={policyEffect => update({policyEffect})} allLabel="全部结果" options={[{value: 'ALLOW', label: '允许'}, {value: 'DENY', label: '拒绝'}]} />
        </>
      ) : null}
      {page === 'authorizationSessions' ? (
        <SelectFilter label="MFA 状态" value={value.mfaState} onChange={mfaState => update({mfaState})} allLabel="全部 MFA 状态" options={[{value: 'VERIFIED', label: '已验证'}, {value: 'UNVERIFIED', label: '未验证'}]} />
      ) : null}
      {page === 'sodRules' ? (
        <SelectFilter label="启用状态" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部启用状态" options={metadataOptions.yesNo} />
      ) : null}
      {page === 'highRiskPolicies' ? (
        <>
          <label>
            <span>权限</span>
            <select value={value.permissionId} onChange={event => update({permissionId: event.target.value})}>
              <option value="ALL">全部权限</option>
              {platformPermissions.map(permission => <option key={permission.entityId} value={permission.entityId}>{permission.title}</option>)}
            </select>
          </label>
          <SelectFilter label="管控要求" value={value.riskControl} onChange={riskControl => update({riskControl})} allLabel="全部要求" options={[{value: 'APPROVAL', label: '需要审批'}, {value: 'MFA', label: '需要 MFA'}, {value: 'DURATION_LIMIT', label: '限制授权时长'}]} />
          <SelectFilter label="策略状态" value={value.enabledState} onChange={enabledState => update({enabledState})} allLabel="全部启用状态" options={metadataOptions.yesNo} />
        </>
      ) : null}
      {page === 'productCategories' ? (
        <SelectFilter label="归属范围" value={value.ownershipScope} onChange={ownershipScope => update({ownershipScope})} allLabel="全部归属" options={metadataOptions.ownershipScopes} />
      ) : null}
      {page === 'products' ? (
        <>
          <SelectFilter label="归属范围" value={value.ownershipScope} onChange={ownershipScope => update({ownershipScope})} allLabel="全部归属" options={metadataOptions.ownershipScopes} />
          <SelectFilter label="商品类型" value={value.productType} onChange={productType => update({productType})} allLabel="全部类型" options={productTypeOptions} disabled={!contextBrand || productTypeOptions.length === 0} disabledLabel={!contextBrand ? '先选择品牌' : '未维护品牌字典'} />
          {productCategoryOptions.length > 0 ? (
            <SelectFilter label="商品分类" value={value.productCategoryId} onChange={productCategoryId => update({productCategoryId})} allLabel="全部分类" options={productCategoryOptions} />
          ) : null}
        </>
      ) : null}
      {['brandMenus', 'storeMenus', 'productInheritances', 'stock', 'availability', 'priceRules', 'bundlePriceRules', 'channelProductMappings'].includes(page) ? (
        <label>
          <span>{page === 'brandMenus' || page === 'storeMenus' || page === 'productInheritances' || page === 'bundlePriceRules' ? '关联商品' : '商品'}</span>
          <select value={value.productId} onChange={event => update({productId: event.target.value})}>
            <option value="ALL">全部商品</option>
            {platformProducts.map(product => <option key={product.entityId} value={product.entityId}>{product.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'brandMenus' ? (
        <SelectFilter label="审核状态" value={value.reviewStatus} onChange={reviewStatus => update({reviewStatus})} allLabel="全部审核状态" options={metadataOptions.reviewStatuses} />
      ) : null}
      {page === 'storeConfig' ? (
        <SelectFilter label="营业状态" value={value.businessStatus} onChange={businessStatus => update({businessStatus})} allLabel="全部营业状态" options={metadataOptions.storeBusinessStatuses} />
      ) : null}
      {page === 'stock' ? (
        <SelectFilter label="库存状态" value={value.stockLevel} onChange={stockLevel => update({stockLevel})} allLabel="全部库存" options={[{value: 'LOW', label: '低于安全库存'}, {value: 'NORMAL', label: '库存正常'}]} />
      ) : null}
      {page === 'availability' ? (
        <>
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} disabled={!contextStore || channelOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="可售状态" value={value.availabilityState} onChange={availabilityState => update({availabilityState})} allLabel="全部可售状态" options={metadataOptions.availability} />
        </>
      ) : null}
      {page === 'availabilityRules' ? (
        <>
          <SelectFilter label="规则类型" value={value.availabilityRuleType} onChange={availabilityRuleType => update({availabilityRuleType})} allLabel="全部规则" options={availabilityRuleTypeOptions} disabled={!contextStore || availabilityRuleTypeOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} disabled={!contextStore || channelOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <label>
            <span>商品</span>
            <select value={value.productId} onChange={event => update({productId: event.target.value})}>
              <option value="ALL">全部商品</option>
              {platformProducts.map(product => <option key={product.entityId} value={product.entityId}>{product.title}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {page === 'priceRules' ? (
        <>
          <SelectFilter label="价格类型" value={value.priceType} onChange={priceType => update({priceType})} allLabel="全部价格类型" options={priceTypeOptions} disabled={!contextStore || priceTypeOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} disabled={!contextStore || channelOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="优惠方式" value={value.discountType} onChange={discountType => update({discountType})} allLabel="全部优惠方式" options={discountOptions} disabled={!contextStore || discountOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
        </>
      ) : null}
      {page === 'bundlePriceRules' ? (
        <SelectFilter label="优惠方式" value={value.discountType} onChange={discountType => update({discountType})} allLabel="全部优惠方式" options={discountOptions} disabled={!contextStore || discountOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
      ) : null}
      {page === 'productInheritances' ? (
        <SelectFilter label="同步状态" value={value.syncStatus} onChange={syncStatus => update({syncStatus})} allLabel="全部同步状态" options={metadataOptions.syncStatuses} />
      ) : null}
      {page === 'channelProductMappings' ? (
        <>
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} disabled={!contextStore || channelOptions.length === 0} disabledLabel={!contextStore ? '先选择门店' : '未维护门店字典'} />
          <SelectFilter label="同步状态" value={value.syncStatus} onChange={syncStatus => update({syncStatus})} allLabel="全部同步状态" options={metadataOptions.syncStatuses} />
        </>
      ) : null}
      <button type="button" onClick={() => setValue(emptyFilter)}>清除筛选</button>
    </div>
  )
}

function SelectFilter({label, value, onChange, allLabel, options, disabled = false, disabledLabel}: {label: string; value: string; onChange: (value: string) => void; allLabel: string; options: FilterOption[]; disabled?: boolean; disabledLabel?: string}) {
  const selectableOptions = options.filter(option => option.value !== 'ALL')
  return (
    <label>
      <span>{label}</span>
      <select value={disabled ? 'ALL' : value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="ALL">{disabled ? disabledLabel ?? allLabel : allLabel}</option>
        {disabled ? null : selectableOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function optionFromValue(value: string): FilterOption {
  return {value, label: metadataOptions.filterStatuses.find(status => status.value === value)?.label ?? enumLabel(value)}
}

function ownerMetadataOptions(owner: CustomerEntity | undefined, key: PlatformMetadataKey): MetadataOption[] {
  const catalog = dataOf(owner).metadata_catalog
  if (typeof catalog !== 'object' || catalog === null || Array.isArray(catalog)) return []
  const options = (catalog as Record<string, unknown>)[key]
  if (!Array.isArray(options)) return []
  return mergeOptions(options.map(normalizeOwnerMetadataOption).filter(Boolean) as MetadataOption[], [])
}

function normalizeOwnerMetadataOption(value: unknown): MetadataOption | null {
  if (typeof value === 'string') {
    const label = value.trim()
    return label ? {label, value: label} : null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const label = asText(record.label ?? record.name ?? record.option_name, '').trim()
  const optionValue = asText(record.value ?? record.code ?? record.option_code, '').trim()
  if (!label || !optionValue || asText(record.status, 'ACTIVE') === 'INACTIVE') return null
  return {label, value: optionValue, status: asText(record.status, 'ACTIVE')}
}

function searchPlaceholderFor(page: PageKey) {
  const placeholders: Partial<Record<PageKey, string>> = {
    tenants: '租户名称、编码、联系人、电话',
    brands: '品牌名称、编码、英文名',
    contracts: '合同、门店、租户、品牌',
    stores: '门店、铺位、楼层、租户、品牌',
    projects: '项目名称、编码、大区、地址',
    tables: '桌台号、门店、楼层、容量',
    workstations: '工作站、编码、出品品类',
    permissions: '权限名称、编码、资源、动作',
    products: '商品名称、品牌、规格',
    productInheritances: '品牌商品、门店商品、同步状态',
    brandMenus: '菜单名称、品牌、商品',
    storeMenus: '菜单名称、门店、商品',
    bundlePriceRules: '规则名称、触发商品、优惠方式',
    channelProductMappings: '内部商品、外部商品 ID、渠道',
    users: '姓名、登录名、手机号、身份来源',
    roles: '角色名称、编码、权限',
    identityProviderConfigs: '身份源名称、类型、同步配置',
    permissionGroups: '分组名称、编码',
    roleTemplates: '模板名称、编码、权限',
    featurePoints: '功能点名称、编码',
    platformFeatureSwitches: '功能点、操作人',
    resourceTags: '标签键、标签值、资源 ID',
    principalGroups: '用户组名称、编码',
    groupMembers: '用户组、用户、来源',
    groupRoleBindings: '用户组、角色、授权范围',
    authorizationSessions: '用户、会话、工作范围',
    sodRules: '规则名称、冲突角色、冲突权限',
    highRiskPolicies: '权限编码、审批角色',
    authAuditLogs: '用户、权限、资源、请求 ID',
  }
  return placeholders[page] ?? '名称、编码或关键关系'
}

function uniqueOptions(items: CustomerEntity[], pick: (item: CustomerEntity) => string, labelFor: (value: string, item: CustomerEntity) => string = value => value) {
  const seen = new Set<string>()
  const options: FilterOption[] = []
  items.forEach(item => {
    const value = pick(item)
    if (!value || seen.has(value)) return
    seen.add(value)
    options.push({value, label: labelFor(value, item)})
  })
  return options
}

function uniqueArrayOptions(values: string[], labelFor: (value: string) => string = value => value) {
  const seen = new Set<string>()
  return values
    .filter(Boolean)
    .filter(value => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .map(value => ({value, label: labelFor(value)}))
}

function mergeOptions(base: MetadataOption[], extra: FilterOption[]) {
  const seen = new Set<string>()
  return [...base, ...extra].filter(option => {
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

function categoryOptionsFor(page: PageKey, selectedPlatform: CustomerEntity | undefined, brands: CustomerEntity[]) {
  if (page === 'brands') {
    return mergeOptions(
      platformMetadataOptions(selectedPlatform, 'brand_categories'),
      uniqueOptions(brands, item => asText(dataOf(item).brand_category, ''), value => enumLabel(value)),
    )
  }
  return []
}

function projectRegionCode(project: CustomerEntity) {
  const region = dataOf(project).region
  if (typeof region !== 'object' || region === null || Array.isArray(region)) return ''
  return asText((region as Record<string, unknown>).region_code, '')
}

function projectRegionLabel(project: CustomerEntity) {
  const region = dataOf(project).region
  if (typeof region !== 'object' || region === null || Array.isArray(region)) return projectRegionCode(project)
  return asText((region as Record<string, unknown>).region_name, projectRegionCode(project))
}

function settlementCycleLabel(value: string) {
  const labels: Record<string, string> = {
    MONTHLY: '月结',
    QUARTERLY: '季度结',
    BI_MONTHLY: '半月结',
    ON_DEMAND: '现结',
  }
  return labels[value] ?? value
}

function RowActions(props: {
  page: PageKey
  item: CustomerEntity
  openEdit: (item: CustomerEntity) => void
  openDetail: (item: CustomerEntity) => void
  openPermissions: (item: CustomerEntity) => void
  openGrantRole: (item: CustomerEntity) => void
  openMenuProducts: (item: CustomerEntity) => void
  performAction: (action: string, item: CustomerEntity) => Promise<void>
}) {
  const stop = (event: MouseEvent) => event.stopPropagation()
  const readonlyReason = readonlyActionReason(props.page, props.item)
  const canEdit = canEditPage(props.page) && !readonlyReason
  const canEditRolePermissions = props.page === 'roles' && !readonlyReason
  return (
    <div className="customer-v3-row-actions" onClick={stop}>
      <button type="button" onClick={() => props.openDetail(props.item)}>查看</button>
      {canEditPage(props.page) ? (
        <button type="button" disabled={!canEdit} title={readonlyReason || undefined} onClick={() => props.openEdit(props.item)}>编辑</button>
      ) : null}
      {props.page === 'contracts' && props.item.status === 'PENDING' ? <button type="button" onClick={() => props.performAction('activateContract', props.item)}>生效</button> : null}
      {props.page === 'contracts' && props.item.status === 'ACTIVE' ? <button type="button" onClick={() => props.performAction('terminateContract', props.item)}>终止</button> : null}
      {props.page === 'roles' ? <button type="button" disabled={!canEditRolePermissions} title={readonlyReason || undefined} onClick={() => props.openPermissions(props.item)}>权限</button> : null}
      {props.page === 'users' ? <button type="button" onClick={() => props.openGrantRole(props.item)}>授予角色</button> : null}
      {props.page === 'brandMenus' || props.page === 'storeMenus' ? <button type="button" onClick={() => props.openMenuProducts(props.item)}>商品</button> : null}
      {props.page === 'roleBindings' ? <button type="button" onClick={() => props.performAction('revokeBinding', props.item)}>撤销</button> : null}
      {props.page === 'priceRules' ? <button type="button" onClick={() => props.performAction('disablePriceRule', props.item)}>停用</button> : null}
    </div>
  )
}

function readonlyActionReason(page: PageKey, item: CustomerEntity) {
  const data = dataOf(item)
  if (page === 'authAuditLogs') return '鉴权审计由系统写入，只能查看'
  if (page === 'authorizationSessions') return '授权会话由鉴权流程产生，只能查看'
  if (page === 'permissions' && (data.is_system === true || asText(data.permission_source ?? data.permission_type, '') === 'SYSTEM')) return '系统权限由平台内置维护'
  if (page === 'roles' && (data.is_system === true || asText(data.role_source ?? data.role_type, '') === 'SYSTEM')) return '系统角色由平台内置维护'
  return ''
}
