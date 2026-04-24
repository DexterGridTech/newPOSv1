import type {Dispatch, ReactNode, SetStateAction} from 'react'
import {JsonPanel, SelectField, TextField, TreeNode} from '../shared'
import {formatTime} from '../utils'
import type {
  ContractLifecycleDraft,
  EntityItem,
  LastContractLifecycleResult,
  LastOrganizationResult,
  OrganizationDraft,
  OrgTreeNode,
  StoreContractMonitor,
} from '../types'

type Props = {
  stores: EntityItem[]
  orgDraft: OrganizationDraft
  setOrgDraft: Dispatch<SetStateAction<OrganizationDraft>>
  orgActionLoading: boolean
  runOrganizationFlow: () => Promise<void>
  suspendTenant: () => Promise<void>
  contractLifecycleDraft: ContractLifecycleDraft
  setContractLifecycleDraft: Dispatch<SetStateAction<ContractLifecycleDraft>>
  amendLatestContract: () => Promise<void>
  renewLatestContract: () => Promise<void>
  terminateLatestContract: () => Promise<void>
  lastOrganizationResult: LastOrganizationResult | null
  orgTree: OrgTreeNode[]
  platforms: EntityItem[]
  projects: EntityItem[]
  tenants: EntityItem[]
  brands: EntityItem[]
  contracts: EntityItem[]
  businessEntities: EntityItem[]
  selectedTenantId: string
  selectTenantContext: (tenantId: string) => void
  selectedStoreId: string
  selectStoreContext: (storeId: string) => void
  selectedTenant: EntityItem | null
  selectedStore: EntityItem | null
  tenantStores: EntityItem[]
  storeContractMonitor: StoreContractMonitor | null
  lastContractLifecycleResult: LastContractLifecycleResult | null
  storeSnapshots: Array<{
    entityId: string
    storeName: string
    activeContractId: unknown
    tenantId: unknown
    brandId: unknown
    entitySnapshotId: unknown
    status: string
  }>
}

const readEntityData = (item?: EntityItem | null) =>
  (item?.payload.data ?? {}) as Record<string, unknown>

const readText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : '--'

const readNullableText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const formatPercent = (value: unknown) =>
  typeof value === 'number'
    ? `${value}%`
    : typeof value === 'string' && value.trim().length > 0
      ? `${value}%`
      : '--'

const buildContractPeriod = (data: Record<string, unknown>) =>
  `${readText(data.start_date)} -> ${readText(data.end_date)}`

const buildContractCommission = (data: Record<string, unknown>) => {
  const commissionType = readText(data.commission_type)
  const commissionRate = formatPercent(data.commission_rate)
  return commissionRate === '--'
    ? commissionType
    : `${commissionType} · ${commissionRate}`
}

type SummaryFactProps = {
  label: string
  value: string | number
}

const SummaryFact = ({label, value}: SummaryFactProps) => (
  <div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

type ContextCardProps = {
  title: string
  subtitle: string
  status: string | null
}

const ContextCard = ({title, subtitle, status}: ContextCardProps) => (
  <article className="organization-context-card">
    <strong>{title}</strong>
    <span>{subtitle}</span>
    <em className={`status-tone ${status?.toLowerCase() ?? 'neutral'}`}>{status ?? '--'}</em>
  </article>
)

type InteractiveEntityRowProps = {
  title: string
  subtitle: string
  status: string
  detail: string
  active?: boolean
  onClick?: () => void
}

const InteractiveEntityRow = ({
  title,
  subtitle,
  status,
  detail,
  active = false,
  onClick,
}: InteractiveEntityRowProps) => (
  <button
    type="button"
    className={`entity-list-button${active ? ' active' : ''}`}
    onClick={onClick}
  >
    <div>
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
    <div className="entity-list-side">
      <span>{detail}</span>
      <em className={`status-tone ${status.toLowerCase()}`}>{status}</em>
    </div>
  </button>
)

type SectionCardProps = {
  title: string
  subtitle: string
  aside: string | number
  children: ReactNode
}

const SectionCard = ({title, subtitle, aside, children}: SectionCardProps) => (
  <article className="organization-subpanel">
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        <p className="panel-subtitle">{subtitle}</p>
      </div>
      <span>{aside}</span>
    </div>
    {children}
  </article>
)

type DataReferenceProps = {
  title: string
  count: number
  description: string
  items: EntityItem[]
}

const DataReference = ({title, count, description, items}: DataReferenceProps) => (
  <details className="panel organization-reference-panel">
    <summary className="organization-reference-summary">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <em>{count}</em>
    </summary>
    <div className="document-list">
      {items.map(item => (
        <div key={`${title}:${item.aggregateId}:${item.entityId}`} className="resource-card-row">
          <div>
            <strong>{item.title}</strong>
            <span>{item.entityId}</span>
          </div>
          <span className="pill neutral">{item.status}</span>
        </div>
      ))}
      {items.length === 0 ? <p className="empty">当前参考台账没有记录。</p> : null}
    </div>
  </details>
)

const filterOrgTreeByTenant = (nodes: OrgTreeNode[], tenantId: string) => {
  if (!tenantId) {
    return nodes
  }

  return nodes
    .map(platform => {
      const platformChildren = Array.isArray(platform.children)
        ? (platform.children as OrgTreeNode[])
        : []

      const visibleProjects = platformChildren
        .map(project => {
          const projectChildren = Array.isArray(project.children)
            ? (project.children as OrgTreeNode[])
            : []
          const visibleTenants = projectChildren.filter(tenant => tenant.id === tenantId)
          if (visibleTenants.length === 0) {
            return null
          }

          return {
            ...project,
            children: visibleTenants,
          }
        })
        .filter(Boolean) as OrgTreeNode[]

      if (visibleProjects.length === 0) {
        return null
      }

      return {
        ...platform,
        children: visibleProjects,
      }
    })
    .filter(Boolean) as OrgTreeNode[]
}

export function OrganizationWorkspace(props: Props) {
  const {
    stores,
    orgDraft,
    setOrgDraft,
    orgActionLoading,
    runOrganizationFlow,
    suspendTenant,
    contractLifecycleDraft,
    setContractLifecycleDraft,
    amendLatestContract,
    renewLatestContract,
    terminateLatestContract,
    lastOrganizationResult,
    orgTree,
    platforms,
    projects,
    tenants,
    brands,
    contracts,
    businessEntities,
    selectedTenantId,
    selectTenantContext,
    selectedStoreId,
    selectStoreContext,
    selectedTenant,
    selectedStore,
    tenantStores,
    storeContractMonitor,
    lastContractLifecycleResult,
    storeSnapshots,
  } = props

  const activePlatformCount = platforms.filter(item => item.status === 'ACTIVE').length
  const activeProjectCount = projects.filter(item => item.status === 'ACTIVE').length
  const activeTenantCount = tenants.filter(item => item.status === 'ACTIVE').length
  const activeStoreCount = stores.filter(item => item.status === 'ACTIVE').length
  const activeContractCount = contracts.filter(item => item.status === 'ACTIVE').length

  const selectedTenantStoreCount = selectedTenant ? tenantStores.length : stores.length
  const selectedTenantActiveStores = tenantStores.filter(item => item.status === 'ACTIVE').length

  const selectedStoreMonitor = selectedStoreId
    ? storeContractMonitor
    : null
  const selectedStoreContracts = selectedStoreMonitor?.contracts ?? []
  const selectedStoreTimeline = selectedStoreMonitor?.timeline ?? []
  const selectedStoreSnapshot = selectedStoreMonitor?.snapshot ?? null
  const selectedStoreActiveContractData = readEntityData(selectedStoreMonitor?.activeContract)
  const visibleOrgTree = filterOrgTreeByTenant(orgTree, selectedTenantId)

  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>组织主链路操作台</h3>
            <p className="panel-subtitle">把 tenant / brand / entity / store / contract 串成一个 contract-driven workflow，并立即验证 store snapshot 是否切换。</p>
          </div>
          <span>{stores.length} stores</span>
        </div>
        <div className="org-form-grid">
          <TextField label="Tenant" name="tenantCode" value={orgDraft.tenantCode} onChange={value => setOrgDraft(current => ({...current, tenantCode: value}))} />
          <TextField label="Tenant 名称" name="tenantName" value={orgDraft.tenantName} onChange={value => setOrgDraft(current => ({...current, tenantName: value}))} />
          <TextField label="Brand" name="brandCode" value={orgDraft.brandCode} onChange={value => setOrgDraft(current => ({...current, brandCode: value}))} />
          <TextField label="Brand 名称" name="brandName" value={orgDraft.brandName} onChange={value => setOrgDraft(current => ({...current, brandName: value}))} />
          <TextField label="Business Entity" name="entityCode" value={orgDraft.entityCode} onChange={value => setOrgDraft(current => ({...current, entityCode: value}))} />
          <TextField label="Entity 名称" name="entityName" value={orgDraft.entityName} onChange={value => setOrgDraft(current => ({...current, entityName: value}))} />
          <TextField label="Store" name="storeCode" value={orgDraft.storeCode} onChange={value => setOrgDraft(current => ({...current, storeCode: value}))} />
          <TextField label="Store 名称" name="storeName" value={orgDraft.storeName} onChange={value => setOrgDraft(current => ({...current, storeName: value}))} />
          <TextField label="Unit Code" name="unitCode" value={orgDraft.unitCode} onChange={value => setOrgDraft(current => ({...current, unitCode: value}))} />
          <TextField label="Contract No" name="contractNo" value={orgDraft.contractNo} onChange={value => setOrgDraft(current => ({...current, contractNo: value}))} />
          <TextField label="Start Date" name="contractStartDate" value={orgDraft.startDate} onChange={value => setOrgDraft(current => ({...current, startDate: value}))} />
          <TextField label="End Date" name="contractEndDate" value={orgDraft.endDate} onChange={value => setOrgDraft(current => ({...current, endDate: value}))} />
          <TextField label="Commission Rate" name="commissionRate" value={orgDraft.commissionRate} onChange={value => setOrgDraft(current => ({...current, commissionRate: value}))} />
          <TextField label="Deposit Amount" name="depositAmount" value={orgDraft.depositAmount} onChange={value => setOrgDraft(current => ({...current, depositAmount: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void runOrganizationFlow()} disabled={orgActionLoading}>创建并激活合同</button>
          <button onClick={() => void suspendTenant()} disabled={orgActionLoading}>暂停租户并级联门店</button>
        </div>
      </article>

      <article className="panel organization-dashboard-panel">
        <div className="panel-title">
          <div>
            <h3>组织驾驶舱</h3>
            <p className="panel-subtitle">先收口平台/项目/租户/门店/合同的主状态，再把选中租户与门店拉成真实的上下文监控流。</p>
          </div>
          <span>{selectedTenantStoreCount} in scope</span>
        </div>
        <div className="facts-grid organization-dashboard-grid">
          <SummaryFact label="Active Platform" value={activePlatformCount} />
          <SummaryFact label="Active Project" value={activeProjectCount} />
          <SummaryFact label="Active Tenant" value={activeTenantCount} />
          <SummaryFact label="Active Store" value={activeStoreCount} />
          <SummaryFact label="Active Contract" value={activeContractCount} />
          <SummaryFact label="Tenant Scope Stores" value={selectedTenantStoreCount} />
        </div>
        <div className="organization-context-strip">
          <ContextCard
            title={selectedTenant?.title ?? '未选择 Tenant'}
            subtitle={selectedTenant ? `${selectedTenant.entityId} · ${selectedTenantActiveStores}/${tenantStores.length} active stores` : '选择 tenant 后查看 tenant 视角门店范围'}
            status={selectedTenant?.status ?? null}
          />
          <ContextCard
            title={selectedStore?.title ?? '未选择 Store'}
            subtitle={selectedStore ? `${selectedStore.entityId} · unit ${readText(readEntityData(selectedStore).unit_code)}` : '选择 store 后查看合同快照、事件时间线和关联实体'}
            status={selectedStore?.status ?? null}
          />
          <ContextCard
            title={lastContractLifecycleResult?.action ?? 'idle'}
            subtitle={lastContractLifecycleResult?.contractId ?? lastOrganizationResult?.contractId ?? '尚未执行生命周期动作'}
            status={lastContractLifecycleResult ? 'ACTIVE' : null}
          />
        </div>
      </article>

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>合同生命周期操作</h3>
            <p className="panel-subtitle">围绕选中合同做续签、变更、终止，保证 active contract 与 store snapshot 跟着状态原子切换。</p>
          </div>
          <span>{lastOrganizationResult?.contractId ?? 'empty'}</span>
        </div>
        <div className="org-form-grid compact">
          <TextField label="续签到期日" name="renewEndDate" value={contractLifecycleDraft.newEndDate} onChange={value => setContractLifecycleDraft(current => ({...current, newEndDate: value}))} />
          <TextField label="变更到期日" name="amendedEndDate" value={contractLifecycleDraft.amendedEndDate} onChange={value => setContractLifecycleDraft(current => ({...current, amendedEndDate: value}))} />
          <TextField label="变更佣金点" name="amendedCommissionRate" value={contractLifecycleDraft.amendedCommissionRate} onChange={value => setContractLifecycleDraft(current => ({...current, amendedCommissionRate: value}))} />
        </div>
        <div className="hero-actions">
          <button onClick={() => void amendLatestContract()} disabled={orgActionLoading}>变更当前合同</button>
          <button onClick={() => void renewLatestContract()} disabled={orgActionLoading}>续签并切换新合同</button>
          <button onClick={() => void terminateLatestContract()} disabled={orgActionLoading}>终止当前合同</button>
        </div>
      </article>

      <article className="panel organization-tree-panel">
        <div className="panel-title">
          <div>
            <h3>组织树</h3>
            <p className="panel-subtitle">Project 保留 region 值对象，contract 是 store tenant/brand 归属的唯一真相源。选择 tenant 后，组织树只保留当前管理上下文分支。</p>
          </div>
          <span>{visibleOrgTree.length}</span>
        </div>
        <div className="tree-panel-body">
          {visibleOrgTree.map(node => <TreeNode key={node.id} node={node} />)}
        </div>
      </article>

      <article className="panel organization-monitor-panel">
        <div className="panel-title">
          <div>
            <h3>Tenant / Store 监控上下文</h3>
            <p className="panel-subtitle">用租户筛选和门店详情把组织树之外的真实后台操作流串起来，再把合同切换结果读成人能理解的监控视图。</p>
          </div>
          <span>{selectedStore ? selectedStore.title : 'idle'}</span>
        </div>
        <div className="filter-toolbar">
          <SelectField label="选择 Tenant" name="selectedTenantId" value={selectedTenantId} onChange={selectTenantContext}>
            <option value="">请选择 tenant</option>
            {tenants.map(item => (
              <option key={item.entityId} value={item.entityId}>{item.title}</option>
            ))}
          </SelectField>
          <SelectField label="选择 Store" name="selectedStoreId" value={selectedStoreId} onChange={selectStoreContext}>
            <option value="">请选择 store</option>
            {(selectedTenant ? tenantStores : stores).map(item => (
              <option key={item.entityId} value={item.entityId}>{item.title}</option>
            ))}
          </SelectField>
        </div>
        <div className="facts-grid">
          <SummaryFact label="Tenant Scope Stores" value={selectedTenant ? tenantStores.length : 0} />
          <SummaryFact label="Active Contract" value={selectedStoreSnapshot?.activeContractId ?? '--'} />
          <SummaryFact label="Store Status" value={selectedStoreSnapshot?.storeStatus ?? '--'} />
          <SummaryFact label="Timeline Events" value={selectedStoreTimeline.length} />
        </div>

        {selectedStoreId && !selectedStoreMonitor ? (
          <p className="empty">正在加载该门店的合同监控视图...</p>
        ) : null}

        {!selectedStoreId ? (
          <p className="empty">先选择一个 tenant 或 store，再查看 active contract、关联实体和合同切换时间线。</p>
        ) : null}

        {selectedStoreMonitor ? (
          <>
            <div className="organization-context-grid">
              <ContextCard
                title={selectedStoreMonitor.project?.title ?? '未关联 Project'}
                subtitle={selectedStoreSnapshot?.projectId ?? 'project snapshot missing'}
                status={selectedStoreMonitor.project?.status ?? null}
              />
              <ContextCard
                title={selectedStoreMonitor.tenant?.title ?? '未关联 Tenant'}
                subtitle={selectedStoreSnapshot?.tenantId ?? 'tenant snapshot missing'}
                status={selectedStoreMonitor.tenant?.status ?? null}
              />
              <ContextCard
                title={selectedStoreMonitor.brand?.title ?? '未关联 Brand'}
                subtitle={selectedStoreSnapshot?.brandId ?? 'brand snapshot missing'}
                status={selectedStoreMonitor.brand?.status ?? null}
              />
              <ContextCard
                title={selectedStoreMonitor.businessEntity?.title ?? '未关联 Entity'}
                subtitle={selectedStoreSnapshot?.entityId ?? 'entity snapshot missing'}
                status={selectedStoreMonitor.businessEntity?.status ?? null}
              />
              <ContextCard
                title={selectedStoreMonitor.activeContract?.title ?? '当前无 Active Contract'}
                subtitle={selectedStoreSnapshot?.activeContractId ?? 'active contract missing'}
                status={selectedStoreMonitor.activeContract?.status ?? null}
              />
            </div>

            <SectionCard
              title="合同快照事实"
              subtitle="这组字段应该始终跟着合同激活原子切换，而不是 UI 层自己推断。"
              aside={selectedStoreSnapshot?.unitCode ?? '--'}
            >
              <div className="facts-grid">
                <SummaryFact label="Store Id" value={selectedStoreMonitor.store.entityId} />
                <SummaryFact label="Unit Code" value={selectedStoreSnapshot?.unitCode ?? '--'} />
                <SummaryFact label="Tenant Snapshot" value={selectedStoreSnapshot?.tenantId ?? '--'} />
                <SummaryFact label="Brand Snapshot" value={selectedStoreSnapshot?.brandId ?? '--'} />
              </div>
            </SectionCard>

            <SectionCard
              title="关联合同列表"
              subtitle="同一个 store 下所有合同都在这里，方便对比 active / inactive / terminated 切换结果。"
              aside={selectedStoreContracts.length}
            >
              <div className="entity-list">
                {selectedStoreContracts.map(contract => {
                  const contractData = readEntityData(contract)
                  return (
                    <InteractiveEntityRow
                      key={contract.entityId}
                      title={contract.title}
                      subtitle={buildContractPeriod(contractData)}
                      detail={buildContractCommission(contractData)}
                      status={contract.status}
                    />
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="合同切换时间线"
              subtitle="优先展示人可读事件链，原始回包放到页面最下方作为二级诊断工具。"
              aside={selectedStoreTimeline.length}
            >
              <div className="organization-timeline-list">
                {selectedStoreTimeline.map(event => (
                  <div key={event.eventId} className="organization-timeline-entry">
                    <div>
                      <strong>{event.summary ?? event.eventType}</strong>
                      <span>{event.eventType} · rev {event.sourceRevision}</span>
                    </div>
                    <div className="organization-timeline-side">
                      <span>{event.contractId ?? event.aggregateId}</span>
                      <em>{formatTime(event.occurredAt)}</em>
                    </div>
                  </div>
                ))}
                {selectedStoreTimeline.length === 0 ? (
                  <p className="empty">当前 store 还没有合同切换相关事件。</p>
                ) : null}
              </div>
            </SectionCard>
          </>
        ) : null}
      </article>

      <article className="panel organization-tenant-panel">
        <div className="panel-title">
          <div>
            <h3>Tenant 视角门店范围</h3>
            <p className="panel-subtitle">这是组织树之外的 tenant scope 列表，用来做租户暂停级联和 store effective 归属核对。</p>
          </div>
          <span>{selectedTenant ? tenantStores.length : 'idle'}</span>
        </div>
        {selectedTenant ? (
          <>
            <div className="facts-grid">
              <SummaryFact label="Tenant" value={selectedTenant.title} />
              <SummaryFact label="Status" value={selectedTenant.status} />
              <SummaryFact label="Scoped Stores" value={tenantStores.length} />
              <SummaryFact label="Active Stores" value={selectedTenantActiveStores} />
            </div>
            <div className="entity-list">
              {tenantStores.map(item => {
                const data = readEntityData(item)
                return (
                  <InteractiveEntityRow
                    key={item.entityId}
                  title={item.title}
                  subtitle={item.entityId}
                  detail={`active contract ${readText(data.active_contract_id)}`}
                  status={item.status}
                  active={item.entityId === selectedStoreId}
                  onClick={() => selectStoreContext(item.entityId)}
                />
              )
            })}
            </div>
          </>
        ) : (
          <p className="empty">先选择一个 tenant，这里会展示该 tenant 下所有门店以及当前 active contract 快照。</p>
        )}
      </article>

      <article className="panel organization-store-panel">
        <div className="panel-title">
          <div>
            <h3>门店快照矩阵</h3>
            <p className="panel-subtitle">把 store snapshot 拉成可点击的门店台账，便于快速切换门店并验证 snapshot 与合同是否一致。</p>
          </div>
          <span>{storeSnapshots.length}</span>
        </div>
        <div className="entity-list">
          {storeSnapshots.map(snapshot => (
            <InteractiveEntityRow
              key={snapshot.entityId}
              title={snapshot.storeName}
              subtitle={snapshot.entityId}
              detail={`contract ${readText(snapshot.activeContractId)}`}
              status={snapshot.status}
              active={snapshot.entityId === selectedStoreId}
              onClick={() => selectStoreContext(snapshot.entityId)}
            />
          ))}
        </div>
      </article>

      <article className="panel organization-inspector-panel">
        <div className="panel-title">
          <div>
            <h3>组织调试与原始证据</h3>
            <p className="panel-subtitle">这里保留刚创建实体、最新生命周期动作和当前合同监控回包，作为二级诊断入口，而不是主视图本身。</p>
          </div>
          <span>{selectedStoreMonitor ? 'ready' : 'idle'}</span>
        </div>
        <div className="organization-debug-grid">
          <JsonPanel value={lastOrganizationResult} />
          <JsonPanel value={lastContractLifecycleResult} />
          <JsonPanel value={selectedStoreMonitor ? {
            snapshot: selectedStoreMonitor.snapshot,
            activeContract: {
              title: selectedStoreMonitor.activeContract?.title ?? null,
              status: selectedStoreMonitor.activeContract?.status ?? null,
              period: buildContractPeriod(selectedStoreActiveContractData),
              commission: buildContractCommission(selectedStoreActiveContractData),
            },
          } : {tip: '选择 store 后，这里展示 contract monitor 原始快照。'}} />
        </div>
      </article>

      <div className="organization-reference-stack">
        <DataReference
          title="平台 / 项目参考台账"
          count={platforms.length + projects.length}
          description="二级参考信息，默认折叠，需要时再展开核对平台与项目实体。"
          items={[...platforms, ...projects]}
        />
        <DataReference
          title="租户 / 品牌参考台账"
          count={tenants.length + brands.length}
          description="保留原始实体索引，但不再抢主链路视线。"
          items={[...tenants, ...brands]}
        />
        <DataReference
          title="门店 / 合同参考台账"
          count={stores.length + contracts.length}
          description="用于核对实体总量和状态，不与上面的 workflow 监控混在一起。"
          items={[...stores, ...contracts]}
        />
        <DataReference
          title="法人主体参考台账"
          count={businessEntities.length}
          description="保留 tenant 下法人主体索引，用于对照合同监控中的 entity 快照。"
          items={businessEntities}
        />
      </div>
    </>
  )
}
