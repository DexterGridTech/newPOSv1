import {canEditPage, pageMeta} from '../constants'
import type {CollectionState, CustomerEntity, PageKey} from '../types'
import {Modal} from '../components/common'
import {asArray, asText, businessEntries, businessLabel, dataOf, formatDate, formatDateTime, money, relationName, renderBusinessValue, scopeSelectorLabel} from '../domain'

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
  return (
    <Modal title={props.item.title} subtitle={`${pageMeta[props.page].title} · 记录编号：${props.item.entityId}`} onClose={props.onClose} wide>
      <div className="customer-v3-detail-actions">
        {canEditPage(props.page) ? <button type="button" onClick={props.onEdit}>编辑</button> : null}
        {props.page === 'roles' ? <button type="button" onClick={props.onPermissions}>编辑权限</button> : null}
        {props.page === 'users' ? <button type="button" onClick={props.onGrantRole}>授予角色</button> : null}
        {props.page === 'brandMenus' || props.page === 'storeMenus' ? <button type="button" onClick={props.onMenuProducts}>配置商品</button> : null}
      </div>
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
              <dd>{renderBusinessValue(key, value, props.collections)}</dd>
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
    return (
      <>
        <RelationList title={`权限列表（${permissionIds.length} 个）`} items={permissionIds.map(id => relationName(collections.permissions, id, id))} />
        <RelationList title={`用户列表（${users.length} 个）`} items={users.map(binding => relationName(collections.users, dataOf(binding).user_id))} />
      </>
    )
  }
  if (page === 'users') {
    const bindings = collections.roleBindings.filter(binding => dataOf(binding).user_id === item.entityId)
    return <RelationList title={`角色绑定（${bindings.length} 个）`} items={bindings.map(binding => `${relationName(collections.roles, dataOf(binding).role_id)} · ${scopeSelectorLabel(dataOf(binding).scope_selector, collections)}`)} />
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
