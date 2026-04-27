import {canEditPage, pageMeta} from '../constants'
import type {CollectionState, CustomerEntity, PageKey} from '../types'
import {Modal} from '../components/common'
import {asArray, asText, businessEntries, businessLabel, dataOf, formatDate, formatDateTime, isHighRiskPermission, money, permissionCodeFor, relationName, renderBusinessValue, scopeSelectorLabel} from '../domain'

const projectPhaseRows = (value: unknown) =>
  asArray(value).map((item, index) => {
    const record = typeof item === 'object' && item !== null && !Array.isArray(item) ? item as Record<string, unknown> : {}
    return {
      phaseId: asText(record.phase_id ?? record.phaseId, index === 0 ? 'phase-default' : `phase-${index + 1}`),
      phaseName: asText(record.phase_name ?? record.phaseName, index === 0 ? '一期' : `第${index + 1}期`),
      ownerName: asText(record.owner_name ?? record.ownerName, '项目业主方'),
      ownerContact: asText(record.owner_contact ?? record.ownerContact, '--'),
      ownerPhone: asText(record.owner_phone ?? record.ownerPhone, '--'),
    }
  })

export function DetailModal(props: {
  page: PageKey
  item: CustomerEntity
  collections: CollectionState
  onClose: () => void
  onEdit: () => void
  onPermissions: () => void
  onGrantRole: () => void
  onMenuProducts: () => void
  performAction: (action: string, item: CustomerEntity) => Promise<void>
}) {
  const data = dataOf(props.item)
  const assetPreview = detailAssetPreview(props.page, data)
  const readonlyReason = readonlyActionReason(props.page, props.item)
  const canEdit = canEditPage(props.page) && !readonlyReason
  const canEditRolePermissions = props.page === 'roles' && !readonlyReason
  return (
    <Modal title={props.item.title} subtitle={`${pageMeta[props.page].title} · 记录编号：${props.item.entityId}`} onClose={props.onClose} wide>
      <div className="customer-v3-detail-actions">
        {canEditPage(props.page) ? <button type="button" disabled={!canEdit} title={readonlyReason || undefined} onClick={props.onEdit}>编辑</button> : null}
        {props.page === 'roles' ? <button type="button" disabled={!canEditRolePermissions} title={readonlyReason || undefined} onClick={props.onPermissions}>编辑权限</button> : null}
        {props.page === 'users' ? <button type="button" onClick={props.onGrantRole}>授予角色</button> : null}
        {props.page === 'brandMenus' || props.page === 'storeMenus' ? <button type="button" onClick={props.onMenuProducts}>配置商品</button> : null}
      </div>
      {readonlyReason ? <div className="customer-v3-note">{readonlyReason}。</div> : null}
      {assetPreview ? (
        <section className="customer-v3-detail-section">
          <h3>{assetPreview.title}</h3>
          <div className="customer-v3-detail-asset-card">
            <img src={assetPreview.url} alt={assetPreview.title} />
            <div>
              <strong>{props.item.title}</strong>
              <span>{assetPreview.description}</span>
            </div>
          </div>
        </section>
      ) : null}
      <section className="customer-v3-detail-section">
        <h3>概览</h3>
        <div className="customer-v3-detail-grid">
          {businessEntries(data).map(([key, value]) => (
            <div key={key}>
              <dt>{businessLabel(key)}</dt>
              <dd>{renderBusinessValue(key, value, props.collections, props.item)}</dd>
            </div>
          ))}
        </div>
      </section>
      <EntityRelationSections page={props.page} item={props.item} collections={props.collections} />
      <details className="customer-v3-tech">
        <summary>技术信息</summary>
        <dl>
          <div><dt>实体 ID</dt><dd>{props.item.entityId}</dd></div>
          <div><dt>沙箱</dt><dd>{props.item.sandboxId ?? asText(props.item.payload.sandbox_id)}</dd></div>
          <div><dt>平台</dt><dd>{asText(props.item.payload.platform_id)}</dd></div>
          <div><dt>版本</dt><dd>{props.item.sourceRevision ?? asText(props.item.payload.source_revision)}</dd></div>
          <div><dt>更新时间</dt><dd>{formatDateTime(props.item.updatedAt)}</dd></div>
        </dl>
        <pre>{JSON.stringify(props.item.payload, null, 2)}</pre>
      </details>
    </Modal>
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

function detailAssetPreview(page: PageKey, data: Record<string, unknown>) {
  if (page === 'brands') {
    const url = asText(data.brand_logo_url, '')
    return url ? {title: '品牌图标', description: '用于品牌列表、门店关联和菜单识别。', url} : null
  }
  if (page === 'products') {
    const url = asText(data.image_url, '')
    return url ? {title: '商品图片', description: '用于商品列表和菜单商品展示。', url} : null
  }
  return null
}

function EntityRelationSections({page, item, collections}: {page: PageKey; item: CustomerEntity; collections: CollectionState}) {
  const data = dataOf(item)
  if (page === 'roles') {
    const permissionIds = asArray(data.permission_ids).map(String)
    const users = collections.roleBindings.filter(binding => dataOf(binding).role_id === item.entityId && binding.status === 'ACTIVE')
    const groups = collections.groupRoleBindings.filter(binding => dataOf(binding).role_id === item.entityId && binding.status === 'ACTIVE')
    const permissions = permissionIds
      .map(id => collections.permissions.find(permission => permission.entityId === id))
      .filter(Boolean) as CustomerEntity[]
    const highRiskPermissions = permissions.filter(permission => isHighRiskPermission(permission, collections.highRiskPolicies))
    return (
      <>
        <RelationList title={`权限列表（${permissionIds.length} 个，含 ${highRiskPermissions.length} 个高风险）`} items={permissions.map(permission => `${permission.title} · ${permissionCodeFor(permission)}${isHighRiskPermission(permission, collections.highRiskPolicies) ? ' · 高风险' : ''}`)} />
        <RelationList title={`用户列表（${users.length} 个）`} items={users.map(binding => `${relationName(collections.users, dataOf(binding).user_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)} · ${formatDate(dataOf(binding).effective_from)} 起`)} />
        <RelationList title={`用户组授权（${groups.length} 个）`} items={groups.map(binding => `${relationName(collections.principalGroups, dataOf(binding).group_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)}`)} />
      </>
    )
  }
  if (page === 'users') {
    const bindings = collections.roleBindings.filter(binding => dataOf(binding).user_id === item.entityId)
    const memberships = collections.groupMembers.filter(member => dataOf(member).user_id === item.entityId)
    const groupBindings = memberships.flatMap(member => collections.groupRoleBindings.filter(binding => dataOf(binding).group_id === dataOf(member).group_id))
    const sessions = collections.authorizationSessions.filter(session => dataOf(session).user_id === item.entityId)
    const audits = collections.authAuditLogs.filter(log => dataOf(log).user_id === item.entityId).slice(0, 10)
    return (
      <>
        <RelationList title={`直接角色绑定（${bindings.length} 个）`} items={bindings.map(binding => `${relationName(collections.roles, dataOf(binding).role_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)}`)} />
        <RelationList title={`用户组（${memberships.length} 个）`} items={memberships.map(member => `${relationName(collections.principalGroups, dataOf(member).group_id)} · ${asText(dataOf(member).source)}`)} />
        <RelationList title={`继承自用户组的角色（${groupBindings.length} 个）`} items={groupBindings.map(binding => `${relationName(collections.roles, dataOf(binding).role_id)} · ${relationName(collections.principalGroups, dataOf(binding).group_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)}`)} />
        <RelationList title={`授权会话（${sessions.length} 个）`} items={sessions.map(session => `${scopeSelectorLabel(dataOf(session).working_scope, collections)} · ${dataOf(session).mfa_verified_at ? 'MFA 已验证' : 'MFA 未验证'} · ${formatDateTime(dataOf(session).last_active_at)}`)} />
        <RelationList title={`最近鉴权审计（${audits.length} 条）`} items={audits.map(log => `${asText(dataOf(log).permission_code)} · ${asText(dataOf(log).result, log.status)} · ${formatDateTime(dataOf(log).occurred_at)}`)} />
      </>
    )
  }
  if (page === 'principalGroups') {
    const members = collections.groupMembers.filter(member => dataOf(member).group_id === item.entityId)
    const bindings = collections.groupRoleBindings.filter(binding => dataOf(binding).group_id === item.entityId)
    return (
      <>
        <RelationList title={`成员（${members.length} 个）`} items={members.map(member => relationName(collections.users, dataOf(member).user_id))} />
        <RelationList title={`组授权（${bindings.length} 个）`} items={bindings.map(binding => `${relationName(collections.roles, dataOf(binding).role_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)}`)} />
      </>
    )
  }
  if (page === 'groupRoleBindings' || page === 'roleBindings') {
    return (
      <RelationList
        title="授权范围"
        items={[
          `${scopeSelectorLabel(data.scope_selector, collections)} · ${asText(data.policy_effect, 'ALLOW')} · ${formatDate(data.effective_from)} - ${formatDate(data.effective_to)}`,
        ]}
      />
    )
  }
  if (page === 'authorizationSessions') {
    return (
      <>
        <RelationList title="工作范围" items={[scopeSelectorLabel(data.working_scope, collections)]} />
        <RelationList title={`激活授权（${asArray(data.activated_binding_ids).length} 个）`} items={asArray(data.activated_binding_ids).map(id => asText(id))} />
      </>
    )
  }
  if (page === 'permissions') {
    const permissionCode = asText(data.permission_code, item.entityId)
    const policies = collections.highRiskPolicies.filter(policy => asText(dataOf(policy).permission_code, '') === permissionCode)
    const roles = collections.roles.filter(role => asArray(dataOf(role).permission_ids).map(String).includes(item.entityId))
    return (
      <>
        <RelationList title={`引用角色（${roles.length} 个）`} items={roles.map(role => role.title)} />
        <RelationList title={`高风险策略（${policies.length} 条）`} items={policies.map(policy => `${policy.title} · MFA ${dataOf(policy).require_mfa ? '需要' : '不需要'}`)} />
      </>
    )
  }
  if (page === 'tenants') {
    const entities = collections.businessEntities.filter(entity => dataOf(entity).tenant_id === item.entityId)
    const contracts = collections.contracts.filter(contract => dataOf(contract).tenant_id === item.entityId)
    const brands = new Set(contracts.map(contract => asText(dataOf(contract).brand_id, '')).filter(Boolean))
    return (
      <>
        <section className="customer-v3-detail-section">
          <h3>签约/结算主体（{entities.length} 个）</h3>
          {entities.length === 0 ? <p className="customer-v3-muted">暂无主体资料。创建合同时需要选择乙方签约主体。</p> : (
            <table className="customer-v3-mini-table">
              <thead>
                <tr>
                  <th>主体名称</th>
                  <th>统一社会信用代码</th>
                  <th>纳税人类型</th>
                  <th>结算周期</th>
                  <th>银行账号</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(entity => {
                  const entityData = dataOf(entity)
                  return (
                    <tr key={entity.entityId}>
                      <td>{entity.title}</td>
                      <td>{asText(entityData.unified_social_credit_code, '--')}</td>
                      <td>{asText(entityData.taxpayer_type, '--')}</td>
                      <td>{asText(entityData.settlement_cycle, '--')}</td>
                      <td>{asText(entityData.bank_account_no_masked, '--')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
        <RelationList title={`合同与品牌关系（${contracts.length} 份合同 / ${brands.size} 个品牌）`} items={contracts.map(contract => `${contract.title} · ${relationName(collections.brands, dataOf(contract).brand_id)} · ${contract.status}`)} />
      </>
    )
  }
  if (page === 'stores') {
    const contracts = collections.contracts.filter(contract => dataOf(contract).store_id === item.entityId)
    return (
      <>
        <section className="customer-v3-detail-section">
          <h3>经营关系（合同驱动，只读）</h3>
          <div className="customer-v3-note">当前租户和品牌由生效合同写入。如需变更，请新建或调整经营合同。</div>
          <div className="customer-v3-detail-grid">
            <div><dt>当前租户</dt><dd>{relationName(collections.tenants, data.tenant_id, '空置')}</dd></div>
            <div><dt>当前品牌</dt><dd>{relationName(collections.brands, data.brand_id)}</dd></div>
            <div><dt>当前合同</dt><dd>{relationName(collections.contracts, data.active_contract_id)}</dd></div>
          </div>
        </section>
        <RelationList title={`合同历史（${contracts.length} 份）`} items={contracts.map(contract => `${contract.title} · ${contract.status} · ${formatDate(dataOf(contract).end_date)}`)} />
      </>
    )
  }
  if (page === 'projects') {
    const phases = projectPhaseRows(data.project_phases)
    return <ProjectPhasesTable phases={phases.length ? phases : projectPhaseRows([{phase_name: '一期', owner_name: `${item.title}业主方`}])} />
  }
  if (page === 'contracts') {
    return (
      <>
        <section className="customer-v3-detail-section">
          <h3>甲方信息</h3>
          <div className="customer-v3-note">以下为合同创建时的签署快照，不会随项目分期或业主方资料的后续调整自动变化。</div>
          <div className="customer-v3-detail-grid">
            <div><dt>项目</dt><dd>{relationName(collections.projects, data.lessor_project_id ?? data.project_id, asText(data.lessor_project_name))}</dd></div>
            <div><dt>分期</dt><dd>{asText(data.lessor_phase_name)}</dd></div>
            <div><dt>业主方</dt><dd>{asText(data.lessor_owner_name)}</dd></div>
            <div><dt>联系人</dt><dd>{asText(data.lessor_owner_contact)}</dd></div>
            <div><dt>联系电话</dt><dd>{asText(data.lessor_owner_phone)}</dd></div>
          </div>
        </section>
        <section className="customer-v3-detail-section">
          <h3>乙方信息</h3>
          <div className="customer-v3-note">以下为合同创建时的门店、租户和品牌快照。门店当前经营关系由生效合同写入。</div>
          <div className="customer-v3-detail-grid">
            <div><dt>门店</dt><dd>{relationName(collections.stores, data.lessee_store_id ?? data.store_id, asText(data.lessee_store_name))}</dd></div>
            <div><dt>租户</dt><dd>{relationName(collections.tenants, data.lessee_tenant_id ?? data.tenant_id, asText(data.lessee_tenant_name))}</dd></div>
            <div><dt>品牌</dt><dd>{relationName(collections.brands, data.lessee_brand_id ?? data.brand_id, asText(data.lessee_brand_name))}</dd></div>
            <div><dt>乙方签约主体</dt><dd>{relationName(collections.businessEntities, data.entity_id, asText(data.entity_name))}</dd></div>
            <div><dt>铺位</dt><dd>{asText(data.unit_code)}</dd></div>
          </div>
        </section>
      </>
    )
  }
  if (page === 'brandMenus' || page === 'storeMenus') {
    return <MenuSections sections={asArray(data.sections)} products={collections.products} />
  }
  if (page === 'products') {
    const menus = [...collections.brandMenus, ...collections.storeMenus].filter(menu => JSON.stringify(dataOf(menu).sections ?? []).includes(item.entityId))
    return <RelationList title={`在用菜单（${menus.length} 份）`} items={menus.map(menu => menu.title)} />
  }
  return null
}

function ProjectPhasesTable({phases}: {phases: Array<{phaseId: string; phaseName: string; ownerName: string; ownerContact: string; ownerPhone: string}>}) {
  return (
    <section className="customer-v3-detail-section">
      <h3>分期与业主方</h3>
      <table className="customer-v3-mini-table">
        <thead>
          <tr>
            <th>分期</th>
            <th>业主方</th>
            <th>联系人</th>
            <th>联系电话</th>
          </tr>
        </thead>
        <tbody>
          {phases.map(phase => (
            <tr key={phase.phaseId}>
              <td>{phase.phaseName}</td>
              <td>{phase.ownerName}</td>
              <td>{phase.ownerContact}</td>
              <td>{phase.ownerPhone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function RelationList({title, items}: {title: string; items: string[]}) {
  return (
    <section className="customer-v3-detail-section">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="customer-v3-muted">暂无关联记录</p> : (
        <ul className="customer-v3-relation-list">
          {items.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  )
}

function MenuSections({sections, products}: {sections: unknown[]; products: CustomerEntity[]}) {
  return (
    <section className="customer-v3-detail-section">
      <h3>分区与商品</h3>
      {sections.length === 0 ? <p className="customer-v3-muted">暂无分区商品</p> : sections.map((section, index) => {
        const record = section as Record<string, unknown>
        const productRows = asArray(record.products)
        return (
          <details key={`${asText(record.section_id, 'section')}-${index}`} open>
            <summary>{asText(record.section_name, '默认分区')} · {productRows.length} 个商品</summary>
            <table className="customer-v3-mini-table">
              <tbody>
                {productRows.map((row, rowIndex) => {
                  const productRow = row as Record<string, unknown>
                  const product = products.find(item => item.entityId === productRow.product_id)
                  const imageUrl = asText(productRow.image_url, asText(dataOf(product).image_url, ''))
                  return (
                    <tr key={`${asText(productRow.product_id)}-${rowIndex}`}>
                      <td>
                        <span className="customer-v3-mini-product">
                          {imageUrl ? <img src={imageUrl} alt={product?.title ?? asText(productRow.product_id)} /> : <span>无图</span>}
                          <strong>{product?.title ?? asText(productRow.product_id)}</strong>
                        </span>
                      </td>
                      <td>{money(productRow.display_price ?? dataOf(product).base_price)}</td>
                      <td>{asText(productRow.display_name, product?.title ?? '--')}</td>
                      <td>排序 {asText(productRow.display_order)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </details>
        )
      })}
    </section>
  )
}
