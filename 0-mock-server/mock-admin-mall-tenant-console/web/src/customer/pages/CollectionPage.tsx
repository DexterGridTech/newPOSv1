import {useEffect, useState, type MouseEvent} from 'react'
import {DEFAULT_TABLE_PAGE_SIZE, canEditPage, emptyFilter, pageMeta} from '../constants'
import type {CollectionState, CustomerEntity, FilterState, PageKey} from '../types'
import {EmptyState, PageHeader, PaginationControls, SkeletonTable, StatusBadge} from '../components/common'
import {asArray, asText, dataOf, enumLabel} from '../domain'
import {metadataOptions, platformMetadataOptions, type MetadataOption} from '../metadata'
import {columnsFor} from './collectionModel'

export function CollectionPage(props: {
  page: PageKey
  loading: boolean
  items: CustomerEntity[]
  filter: FilterState
  collections: CollectionState
  selectedPlatformId: string
  selectedStoreId: string
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
  return (
    <section>
      <PageHeader
        title={meta.title}
        scope={meta.scope}
        action={meta.createLabel ? <button type="button" onClick={props.openCreate}>{meta.createLabel}</button> : undefined}
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
      />
      {props.loading ? <SkeletonTable /> : props.items.length === 0 ? <EmptyState title="没有符合条件的结果" detail="可以调整筛选条件或创建新记录。" /> : (
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

type FilterOption = {label: string; value: string}

function FilterBar({page, value, setValue, collections, selectedPlatformId}: {page: PageKey; value: FilterState; setValue: (value: FilterState) => void; collections: CollectionState; selectedPlatformId: string}) {
  const update = (patch: Partial<FilterState>) => setValue({...value, ...patch})
  const selectedPlatform = collections.platforms.find(platform => platform.entityId === selectedPlatformId)
  const platformProjects = selectedPlatformId ? collections.projects.filter(project => dataOf(project).platform_id === selectedPlatformId) : collections.projects
  const platformProjectIds = new Set(platformProjects.map(project => project.entityId))
  const platformStores = selectedPlatformId ? collections.stores.filter(store => platformProjectIds.has(asText(dataOf(store).project_id, ''))) : collections.stores
  const platformStoreIds = new Set(platformStores.map(store => store.entityId))
  const platformBrands = selectedPlatformId ? collections.brands.filter(brand => dataOf(brand).platform_id === selectedPlatformId || brand.naturalScopeKey === selectedPlatformId) : collections.brands
  const platformBrandIds = new Set(platformBrands.map(brand => brand.entityId))
  const platformTenants = selectedPlatformId ? collections.tenants.filter(tenant => dataOf(tenant).platform_id === selectedPlatformId || tenant.naturalScopeKey === selectedPlatformId) : collections.tenants
  const platformRoles = selectedPlatformId ? collections.roles.filter(role => dataOf(role).platform_id === selectedPlatformId || role.naturalScopeKey === selectedPlatformId) : collections.roles
  const platformPermissions = selectedPlatformId ? collections.permissions.filter(permission => dataOf(permission).platform_id === selectedPlatformId || permission.naturalScopeKey === selectedPlatformId) : collections.permissions
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
  const tableAreaOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'table_areas'),
    uniqueOptions(collections.tables.filter(table => !selectedPlatformId || platformStoreIds.has(asText(dataOf(table).store_id, ''))), table => asText(dataOf(table).area, ''), value => enumLabel(value)),
  )
  const tableTypeOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'table_types'),
    uniqueOptions(collections.tables.filter(table => !selectedPlatformId || platformStoreIds.has(asText(dataOf(table).store_id, ''))), table => asText(dataOf(table).table_type, ''), value => enumLabel(value)),
  )
  const workstationTypeOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'workstation_types'),
    uniqueOptions(collections.workstations.filter(workstation => !selectedPlatformId || platformStoreIds.has(asText(dataOf(workstation).store_id, ''))), workstation => asText(dataOf(workstation).workstation_type, ''), value => enumLabel(value)),
  )
  const workstationCategoryOptions = mergeOptions(
    platformMetadataOptions(selectedPlatform, 'production_categories'),
    uniqueArrayOptions(collections.workstations.flatMap(workstation => asArray(dataOf(workstation).responsible_categories ?? dataOf(workstation).category_codes).map(value => asText(value, ''))), value => enumLabel(value)),
  )
  const productTypeOptions = mergeOptions(platformMetadataOptions(selectedPlatform, 'product_types'), uniqueOptions(platformProducts, product => asText(dataOf(product).product_type, ''), value => enumLabel(value)))
  const productCategoryOptions = collections.productCategories
    .filter(category => !selectedPlatformId || platformBrandIds.has(asText(dataOf(category).brand_id ?? dataOf(category).owner_id, '')) || platformStoreIds.has(asText(dataOf(category).store_id ?? dataOf(category).owner_id, '')))
    .map(category => ({label: category.title, value: category.entityId}))
  const priceTypeOptions = platformMetadataOptions(selectedPlatform, 'price_types')
  const channelOptions = platformMetadataOptions(selectedPlatform, 'channel_types')
  const discountOptions = platformMetadataOptions(selectedPlatform, 'discount_types')
  const availabilityRuleTypeOptions = platformMetadataOptions(selectedPlatform, 'availability_rule_types')
  const settlementCycleOptions = uniqueOptions(platformTenants, tenant => asText(dataOf(tenant).settlement_cycle, ''), settlementCycleLabel)
  return (
    <div className="customer-v3-filter">
      <label>
        <span>搜索</span>
        <input value={value.search} onChange={event => update({search: event.target.value})} placeholder={searchPlaceholderFor(page)} />
      </label>
      <label>
        <span>状态</span>
        <select value={value.status} onChange={event => update({status: event.target.value})}>
          {metadataOptions.filterStatuses.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
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
      {['contracts', 'stores', 'tables', 'workstations', 'users', 'roleBindings', 'storeMenus', 'storeConfig', 'stock', 'availability', 'priceRules'].includes(page) ? (
        <label>
          <span>项目</span>
          <select value={value.projectId} onChange={event => update({projectId: event.target.value})}>
            <option value="ALL">全部项目</option>
            {platformProjects.map(project => <option key={project.entityId} value={project.entityId}>{project.title}</option>)}
          </select>
        </label>
      ) : null}
      {['users', 'roleBindings'].includes(page) ? (
        <label>
          <span>角色</span>
          <select value={value.roleId} onChange={event => update({roleId: event.target.value})}>
            <option value="ALL">全部角色</option>
            {platformRoles.map(role => <option key={role.entityId} value={role.entityId}>{role.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'roleBindings' ? (
        <label>
          <span>用户</span>
          <select value={value.userId} onChange={event => update({userId: event.target.value})}>
            <option value="ALL">全部用户</option>
            {platformUsers.map(user => <option key={user.entityId} value={user.entityId}>{user.title}</option>)}
          </select>
        </label>
      ) : null}
      {page === 'stores' && floorOptions.length > 0 ? (
        <SelectFilter label="楼层" value={value.floor} onChange={floor => update({floor})} allLabel="全部楼层" options={floorOptions} />
      ) : null}
      {['contracts', 'tables', 'workstations', 'users', 'roleBindings', 'storeConfig', 'stock', 'availability', 'priceRules', 'storeMenus'].includes(page) ? (
        <label>
          <span>门店</span>
          <select value={value.storeId} onChange={event => update({storeId: event.target.value})}>
            <option value="ALL">全部门店</option>
            {platformStores.map(store => <option key={store.entityId} value={store.entityId}>{store.title}</option>)}
          </select>
        </label>
      ) : null}
      {['products', 'brandMenus', 'contracts', 'stores', 'storeMenus'].includes(page) ? (
        <label>
          <span>品牌</span>
          <select value={value.brandId} onChange={event => update({brandId: event.target.value})}>
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
          <SelectFilter label="桌台区域" value={value.tableArea} onChange={tableArea => update({tableArea})} allLabel="全部区域" options={tableAreaOptions} />
          <SelectFilter label="桌台类型" value={value.tableType} onChange={tableType => update({tableType})} allLabel="全部类型" options={tableTypeOptions} />
          <SelectFilter label="桌台状态" value={value.tableStatus} onChange={tableStatus => update({tableStatus})} allLabel="全部桌台状态" options={metadataOptions.tableStatuses} />
          <SelectFilter label="座位数" value={value.capacity} onChange={capacity => update({capacity})} allLabel="全部座位数" options={capacityOptions} />
          <SelectFilter label="可预订配置" value={value.reservable} onChange={reservable => update({reservable})} allLabel="全部" options={[{value: 'true', label: '支持'}, {value: 'false', label: '不支持'}]} />
        </>
      ) : null}
      {page === 'workstations' ? (
        <>
          <SelectFilter label="工作站类型" value={value.workstationType} onChange={workstationType => update({workstationType})} allLabel="全部类型" options={workstationTypeOptions} />
          {workstationCategoryOptions.length > 0 ? (
            <SelectFilter label="出品品类" value={value.workstationCategory} onChange={workstationCategory => update({workstationCategory})} allLabel="全部品类" options={workstationCategoryOptions} />
          ) : null}
        </>
      ) : null}
      {page === 'permissions' ? (
        <SelectFilter label="权限类型" value={value.permissionType} onChange={permissionType => update({permissionType})} allLabel="全部类型" options={metadataOptions.permissionTypes} />
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
      {page === 'roleBindings' ? (
        <>
          <SelectFilter label="授权范围" value={value.scopeType} onChange={scopeType => update({scopeType})} allLabel="全部范围" options={metadataOptions.scopeTypes} />
          <SelectFilter label="策略结果" value={value.policyEffect} onChange={policyEffect => update({policyEffect})} allLabel="全部结果" options={[{value: 'ALLOW', label: '允许'}, {value: 'DENY', label: '拒绝'}]} />
        </>
      ) : null}
      {page === 'products' ? (
        <>
          <SelectFilter label="归属范围" value={value.ownershipScope} onChange={ownershipScope => update({ownershipScope})} allLabel="全部归属" options={metadataOptions.ownershipScopes} />
          <SelectFilter label="商品类型" value={value.productType} onChange={productType => update({productType})} allLabel="全部类型" options={productTypeOptions} />
          {productCategoryOptions.length > 0 ? (
            <SelectFilter label="商品分类" value={value.productCategoryId} onChange={productCategoryId => update({productCategoryId})} allLabel="全部分类" options={productCategoryOptions} />
          ) : null}
        </>
      ) : null}
      {['brandMenus', 'storeMenus', 'stock', 'availability', 'priceRules'].includes(page) ? (
        <label>
          <span>{page === 'brandMenus' || page === 'storeMenus' ? '包含商品' : '商品'}</span>
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
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} />
          <SelectFilter label="可售状态" value={value.availabilityState} onChange={availabilityState => update({availabilityState})} allLabel="全部可售状态" options={metadataOptions.availability} />
        </>
      ) : null}
      {page === 'availabilityRules' ? (
        <>
          <SelectFilter label="规则类型" value={value.availabilityRuleType} onChange={availabilityRuleType => update({availabilityRuleType})} allLabel="全部规则" options={availabilityRuleTypeOptions} />
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} />
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
          <SelectFilter label="价格类型" value={value.priceType} onChange={priceType => update({priceType})} allLabel="全部价格类型" options={priceTypeOptions} />
          <SelectFilter label="售卖渠道" value={value.channelType} onChange={channelType => update({channelType})} allLabel="全部渠道" options={channelOptions} />
          <SelectFilter label="优惠方式" value={value.discountType} onChange={discountType => update({discountType})} allLabel="全部优惠方式" options={discountOptions} />
        </>
      ) : null}
      <button type="button" onClick={() => setValue(emptyFilter)}>清除筛选</button>
    </div>
  )
}

function SelectFilter({label, value, onChange, allLabel, options}: {label: string; value: string; onChange: (value: string) => void; allLabel: string; options: FilterOption[]}) {
  const selectableOptions = options.filter(option => option.value !== 'ALL')
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="ALL">{allLabel}</option>
        {selectableOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
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
    permissions: '权限名称、编码',
    products: '商品名称、品牌、规格',
    brandMenus: '菜单名称、品牌、商品',
    storeMenus: '菜单名称、门店、商品',
    users: '姓名、手机号、门店',
    roles: '角色名称、编码、权限',
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
  return (
    <div className="customer-v3-row-actions" onClick={stop}>
      <button type="button" onClick={() => props.openDetail(props.item)}>查看</button>
      {canEditPage(props.page) ? <button type="button" onClick={() => props.openEdit(props.item)}>编辑</button> : null}
      {props.page === 'contracts' && props.item.status === 'PENDING' ? <button type="button" onClick={() => props.performAction('activateContract', props.item)}>生效</button> : null}
      {props.page === 'contracts' && props.item.status === 'ACTIVE' ? <button type="button" onClick={() => props.performAction('terminateContract', props.item)}>终止</button> : null}
      {props.page === 'roles' ? <button type="button" onClick={() => props.openPermissions(props.item)}>权限</button> : null}
      {props.page === 'users' ? <button type="button" onClick={() => props.openGrantRole(props.item)}>授予角色</button> : null}
      {props.page === 'brandMenus' || props.page === 'storeMenus' ? <button type="button" onClick={() => props.openMenuProducts(props.item)}>商品</button> : null}
      {props.page === 'roleBindings' ? <button type="button" onClick={() => props.performAction('revokeBinding', props.item)}>撤销</button> : null}
      {props.page === 'priceRules' ? <button type="button" onClick={() => props.performAction('disablePriceRule', props.item)}>停用</button> : null}
    </div>
  )
}
