import {useMemo, useState, type ChangeEvent} from 'react'
import {api} from '../../api'
import type {CollectionState, CustomerEntity} from '../types'
import {Modal} from '../components/common'
import {asArray, asText, dataOf, enumLabel, isHighRiskPermission, money, permissionCodeFor, relationName, scopeSelectorLabel} from '../domain'
import {metadataOptions} from '../metadata'

export function RolePermissionModal({role, permissions, highRiskPolicies, onClose, onSave}: {role: CustomerEntity; permissions: CustomerEntity[]; highRiskPolicies: CustomerEntity[]; onClose: () => void; onSave: (permissionIds: string[]) => Promise<void>}) {
  const [selected, setSelected] = useState<string[]>(() => asArray(dataOf(role).permission_ids).map(String))
  const [search, setSearch] = useState('')
  const rolePlatformId = asText(dataOf(role).platform_id, '')
  const candidatePermissions = rolePlatformId
    ? permissions.filter(permission => dataOf(permission).platform_id === rolePlatformId)
    : permissions
  const normalizedSearch = search.trim().toLowerCase()
  const visiblePermissions = normalizedSearch
    ? candidatePermissions.filter(permission => `${permission.title} ${asText(dataOf(permission).permission_code)} ${asText(dataOf(permission).resource_type)} ${asText(dataOf(permission).action)}`.toLowerCase().includes(normalizedSearch))
    : candidatePermissions
  const groupedPermissions = groupPermissions(visiblePermissions)
  const selectedPermissions = selected.map(id => permissions.find(permission => permission.entityId === id)).filter(Boolean) as CustomerEntity[]
  const highRiskPermissions = selectedPermissions.filter(permission => isHighRiskPermission(permission, highRiskPolicies))
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  return (
    <Modal title="编辑角色权限" subtitle={`${role.title} · 已选 ${selected.length} 个`} onClose={onClose} wide>
      <div className="customer-v3-dual-selector">
        <section>
          <h3>候选权限</h3>
          <input className="customer-v3-selector-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索权限名称、编码、资源或动作" />
          {groupedPermissions.map(group => (
            <div className="customer-v3-permission-group" key={group.key}>
              <h4>{group.label} <small>{group.items.filter(permission => selected.includes(permission.entityId)).length}/{group.items.length}</small></h4>
              {group.items.map(permission => (
                <label key={permission.entityId}>
                  <input type="checkbox" checked={selected.includes(permission.entityId)} onChange={() => toggle(permission.entityId)} />
                  <span>
                    <strong>{permission.title}</strong>
                    <small>{permissionCodeFor(permission)}</small>
                  </span>
                  {isHighRiskPermission(permission, highRiskPolicies) ? <em>高风险</em> : null}
                </label>
              ))}
            </div>
          ))}
        </section>
        <section>
          <h3>已选权限</h3>
          <div className={`customer-v3-risk-summary ${highRiskPermissions.length ? 'warn' : ''}`}>
            <strong>{highRiskPermissions.length ? `包含 ${highRiskPermissions.length} 个高风险权限` : '未包含高风险权限'}</strong>
            <span>{highRiskPermissions.length ? highRiskPermissions.map(permission => permissionCodeFor(permission)).join('、') : '保存后将立即影响该角色的后续授权。'}</span>
          </div>
          {selected.map(id => {
            const permission = permissions.find(item => item.entityId === id)
            return (
              <button type="button" key={id} onClick={() => toggle(id)}>
                {relationName(permissions, id)}
                {permission ? <small>{permissionCodeFor(permission)}</small> : null}
                <span>×</span>
              </button>
            )
          })}
        </section>
      </div>
      <footer className="customer-v3-modal-footer">
        <button type="button" onClick={onClose}>取消</button>
        <button type="button" onClick={() => void onSave(selected)}>保存权限</button>
      </footer>
    </Modal>
  )
}

export function GrantRoleModal({user, collections, onClose, onSave}: {user: CustomerEntity; collections: CollectionState; onClose: () => void; onSave: (values: Parameters<typeof api.createUserRoleBinding>[0]) => Promise<void>}) {
  const userPlatformId = asText(dataOf(user).platform_id, '')
  const userStoreId = asText(dataOf(user).store_id, '')
  const platformStores = userPlatformId
    ? collections.stores.filter(store => {
      const project = collections.projects.find(project => project.entityId === dataOf(store).project_id)
      return dataOf(project).platform_id === userPlatformId
    })
    : collections.stores
  const platformProjects = userPlatformId ? collections.projects.filter(project => dataOf(project).platform_id === userPlatformId) : collections.projects
  const platformRoles = userPlatformId ? collections.roles.filter(role => dataOf(role).platform_id === userPlatformId || role.naturalScopeKey === userPlatformId) : collections.roles
  const platformTags = userPlatformId ? collections.resourceTags.filter(tag => dataOf(tag).platform_id === userPlatformId || tag.naturalScopeKey === userPlatformId) : collections.resourceTags
  const [roleId, setRoleId] = useState(platformRoles[0]?.entityId ?? '')
  const [scopeType, setScopeType] = useState(userStoreId ? 'STORE' : 'PLATFORM')
  const [scopeId, setScopeId] = useState(userStoreId || platformStores[0]?.entityId || userPlatformId)
  const [orgNodeType, setOrgNodeType] = useState('store')
  const [orgNodeIds, setOrgNodeIds] = useState(userStoreId || platformStores[0]?.entityId || '')
  const [tagValues, setTagValues] = useState(platformTags[0] ? `${asText(dataOf(platformTags[0]).tag_key)}:${asText(dataOf(platformTags[0]).tag_value)}` : '')
  const [resourceType, setResourceType] = useState('STORE')
  const [resourceIds, setResourceIds] = useState(userStoreId || platformStores[0]?.entityId || '')
  const [policyEffect, setPolicyEffect] = useState<'ALLOW' | 'DENY'>('ALLOW')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [approvalId, setApprovalId] = useState('')
  const selectedRole = platformRoles.find(role => role.entityId === roleId)
  const selectedRolePermissionIds = asArray(dataOf(selectedRole).permission_ids).map(String)
  const highRiskPermissions = collections.permissions.filter(permission => selectedRolePermissionIds.includes(permission.entityId) && isHighRiskPermission(permission, collections.highRiskPolicies))
  const scopeSelector = useMemo<Record<string, unknown>>(() => buildScopeSelector({
    scopeType,
    scopeId,
    platformId: userPlatformId,
    orgNodeType,
    orgNodeIds,
    tagValues,
    resourceType,
    resourceIds,
  }), [orgNodeIds, orgNodeType, resourceIds, resourceType, scopeId, scopeType, tagValues, userPlatformId])
  const orgNodeOptions = orgNodeType === 'project' ? platformProjects : orgNodeType === 'store' ? platformStores : collections.brands
  const resourceOptions = resourceType === 'PROJECT' ? platformProjects : resourceType === 'STORE' ? platformStores : resourceType === 'BRAND' ? collections.brands : resourceType === 'PRODUCT' ? collections.products : []
  return (
    <Modal title="授予角色" subtitle={`${user.title} · ${asText(dataOf(user).user_code)}`} onClose={onClose}>
      <form className="customer-v3-form" onSubmit={event => {
        event.preventDefault()
        void onSave({
          userId: user.entityId,
          roleId,
          scopeType: asText(scopeSelector.scope_type, 'STORE'),
          scopeId: asText(scopeSelector.scope_key, ''),
          storeId: scopeSelector.scope_type === 'STORE' ? asText(scopeSelector.scope_key, '') : undefined,
          resourceScope: scopeSelector,
          scopeSelector,
          policyEffect,
          effectiveTo: effectiveTo || null,
          approvalId: approvalId || null,
          grantedBy: 'mock-admin-operator',
        })
      }}>
        <div className="customer-v3-user-grant-card wide">
          <strong>{user.title}</strong>
          <span>{asText(dataOf(user).username)} · {asText(dataOf(user).user_type)} · {userStoreId ? relationName(collections.stores, userStoreId) : '平台用户'}</span>
        </div>
        <label><span>角色 *</span><select value={roleId} onChange={event => setRoleId(event.target.value)}>{platformRoles.map(role => <option key={role.entityId} value={role.entityId}>{role.title}</option>)}</select></label>
        <label><span>授权范围 *</span><select value={scopeType} onChange={event => setScopeType(event.target.value)}>{metadataOptions.scopeTypes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
        {scopeType === 'PROJECT' ? <label><span>项目 *</span><select value={scopeId} onChange={event => setScopeId(event.target.value)}>{platformProjects.map(project => <option key={project.entityId} value={project.entityId}>{project.title}</option>)}</select></label> : null}
        {scopeType === 'STORE' ? <label><span>门店 *</span><select value={scopeId} onChange={event => setScopeId(event.target.value)}>{platformStores.map(store => <option key={store.entityId} value={store.entityId}>{store.title}</option>)}</select></label> : null}
        {scopeType === 'TAG' ? (
          <label className="wide"><span>资源标签 *</span><input value={tagValues} onChange={event => setTagValues(event.target.value)} placeholder="region:south, store-type:flagship" /></label>
        ) : null}
        {scopeType === 'ORG_NODE' ? (
          <>
            <label><span>组织节点类型 *</span><select value={orgNodeType} onChange={event => setOrgNodeType(event.target.value)}><option value="project">项目</option><option value="store">门店</option><option value="brand">品牌</option></select></label>
            <label><span>组织节点 *</span><select value={orgNodeIds.split(',')[0] ?? ''} onChange={event => setOrgNodeIds(event.target.value)}>{orgNodeOptions.map(item => <option key={item.entityId} value={item.entityId}>{item.title}</option>)}</select></label>
          </>
        ) : null}
        {scopeType === 'RESOURCE_IDS' ? (
          <>
            <label><span>资源类型 *</span><select value={resourceType} onChange={event => setResourceType(event.target.value)}>{metadataOptions.resourceTypes.map(resource => <option key={resource.value} value={resource.value}>{resource.label}</option>)}</select></label>
            {resourceOptions.length ? <label><span>资源对象 *</span><select value={resourceIds.split(',')[0] ?? ''} onChange={event => setResourceIds(event.target.value)}>{resourceOptions.map(item => <option key={item.entityId} value={item.entityId}>{item.title}</option>)}</select></label> : <label><span>资源 ID *</span><input value={resourceIds} onChange={event => setResourceIds(event.target.value)} placeholder="多个 ID 用逗号分隔" /></label>}
          </>
        ) : null}
        {scopeType === 'COMPOSITE' ? (
          <>
            <label><span>项目 *</span><select value={scopeId} onChange={event => setScopeId(event.target.value)}>{platformProjects.map(project => <option key={project.entityId} value={project.entityId}>{project.title}</option>)}</select></label>
            <label><span>标签 *</span><input value={tagValues} onChange={event => setTagValues(event.target.value)} placeholder="region:south" /></label>
          </>
        ) : null}
        <div className="customer-v3-scope-preview wide">
          <strong>生效范围</strong>
          <span>{scopeSelectorLabel(scopeSelector, collections)}</span>
        </div>
        {highRiskPermissions.length ? (
          <div className="customer-v3-risk-summary warn wide">
            <strong>该角色包含 {highRiskPermissions.length} 个高风险权限</strong>
            <span>{highRiskPermissions.map(permission => permissionCodeFor(permission)).join('、')}。mock 环境不执行 MFA，但授权记录会保留审批单号和策略。</span>
          </div>
        ) : null}
        <label><span>策略效果 *</span><select value={policyEffect} onChange={event => setPolicyEffect(event.target.value as 'ALLOW' | 'DENY')}>{metadataOptions.policyEffects.map(effect => <option key={effect.value} value={effect.value}>{effect.label}</option>)}</select></label>
        <label><span>失效时间</span><input value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} /></label>
        <label><span>审批单号</span><input value={approvalId} onChange={event => setApprovalId(event.target.value)} /></label>
        <footer><button type="button" onClick={onClose}>取消</button><button type="submit">确认授予</button></footer>
      </form>
    </Modal>
  )
}

function groupPermissions(permissions: CustomerEntity[]) {
  const groups = new Map<string, {key: string; label: string; items: CustomerEntity[]}>()
  permissions.forEach(permission => {
    const data = dataOf(permission)
    const key = asText(data.permission_group_id, asText(data.resource_type, 'ungrouped'))
    const label = asText(data.permission_group_name, enumLabel(data.resource_type) || '未分组权限')
    const group = groups.get(key) ?? {key, label, items: []}
    group.items.push(permission)
    groups.set(key, group)
  })
  return [...groups.values()]
}

function splitList(value: string) {
  return value.split(/[,\n，、]/).map(item => item.trim()).filter(Boolean)
}

function buildScopeSelector(input: {
  scopeType: string
  scopeId: string
  platformId: string
  orgNodeType: string
  orgNodeIds: string
  tagValues: string
  resourceType: string
  resourceIds: string
}): Record<string, unknown> {
  if (input.scopeType === 'PLATFORM') {
    return {scope_type: 'PLATFORM', scope_key: input.platformId}
  }
  if (input.scopeType === 'PROJECT' || input.scopeType === 'STORE') {
    return {scope_type: input.scopeType, scope_key: input.scopeId}
  }
  if (input.scopeType === 'TAG') {
    return {scope_type: 'TAG', tags: splitList(input.tagValues)}
  }
  if (input.scopeType === 'ORG_NODE') {
    return {scope_type: 'ORG_NODE', org_node_type: input.orgNodeType, org_node_ids: splitList(input.orgNodeIds)}
  }
  if (input.scopeType === 'RESOURCE_IDS') {
    return {scope_type: 'RESOURCE_IDS', resource_type: input.resourceType.toLowerCase(), resource_ids: splitList(input.resourceIds)}
  }
  if (input.scopeType === 'COMPOSITE') {
    return {
      scope_type: 'COMPOSITE',
      selectors: [
        {scope_type: 'ORG_NODE', org_node_type: 'project', org_node_ids: splitList(input.scopeId)},
        {scope_type: 'TAG', tags: splitList(input.tagValues)},
      ],
    }
  }
  return {scope_type: input.scopeType, scope_key: input.scopeId}
}

type MenuProductDraft = {
  productId: string
  displayName: string
  displayPrice: string
  imageUrl: string
  recommended: boolean
}

const productImageUrl = (product?: CustomerEntity | null) => asText(dataOf(product).image_url, '')

function ProductThumb({product, imageUrl}: {product?: CustomerEntity | null; imageUrl?: string}) {
  const url = asText(imageUrl, productImageUrl(product))
  const label = product?.title ?? '商品图片'
  return url
    ? <img className="customer-v3-product-thumb" src={url} alt={label} />
    : <span className="customer-v3-product-thumb placeholder">无图</span>
}

export function MenuProductsModal({menu, products, onClose, onSave}: {menu: CustomerEntity; products: CustomerEntity[]; onClose: () => void; onSave: (sections: Array<Record<string, unknown>>) => Promise<void>}) {
  const data = dataOf(menu)
  const menuBrandId = asText(data.brand_id, '')
  const menuStoreId = asText(data.store_id, '')
  const candidateProducts = products.filter(product => {
    const productData = dataOf(product)
    if (menuBrandId) return productData.brand_id === menuBrandId
    if (menuStoreId) return productData.store_id === menuStoreId || !productData.store_id
    return true
  })
  const currentSections = asArray(data.sections) as Array<Record<string, unknown>>
  const sectionsSource = currentSections.length > 0
    ? currentSections
    : [{section_id: 'section-main', section_name: '默认分区', display_order: 10, products: []}]
  const createDrafts = (section: Record<string, unknown>) => asArray(section.products).map(row => {
    const record = row as Record<string, unknown>
    const productId = asText(record.product_id, '')
    const product = candidateProducts.find(item => item.entityId === productId) ?? products.find(item => item.entityId === productId)
    return {
      productId,
      displayName: asText(record.display_name, product?.title ?? ''),
      displayPrice: asText(record.display_price, asText(dataOf(product).base_price, '0')),
      imageUrl: asText(record.image_url, asText(dataOf(product).image_url, '')),
      recommended: record.recommended === true,
    }
  }).filter(row => row.productId)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [sectionDrafts, setSectionDrafts] = useState<MenuProductDraft[][]>(() => sectionsSource.map(createDrafts))
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null)
  const currentSection = sectionsSource[sectionIndex] ?? sectionsSource[0]
  const drafts = sectionDrafts[sectionIndex] ?? []
  const selectedIds = drafts.map(row => row.productId)
  const toggle = (id: string) => setDrafts(prev => {
    if (prev.some(item => item.productId === id)) return prev.filter(item => item.productId !== id)
    const product = candidateProducts.find(item => item.entityId === id) ?? products.find(item => item.entityId === id)
    return [...prev, {
      productId: id,
      displayName: product?.title ?? '',
      displayPrice: asText(dataOf(product).base_price, '0'),
      imageUrl: asText(dataOf(product).image_url, ''),
      recommended: prev.length === 0,
    }]
  })
  const updateDraft = (productId: string, patch: Partial<MenuProductDraft>) => {
    setSectionDrafts(prev => prev.map((rows, index) => index === sectionIndex
      ? rows.map(row => row.productId === productId ? {...row, ...patch} : row)
      : rows))
  }
  const setDrafts = (updater: (rows: MenuProductDraft[]) => MenuProductDraft[]) => {
    setSectionDrafts(prev => prev.map((rows, index) => index === sectionIndex ? updater(rows) : rows))
  }
  const uploadDisplayImage = async (productId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingProductId(productId)
    try {
      const asset = await api.uploadCustomerAsset({kind: 'menu-product-image', file})
      updateDraft(productId, {imageUrl: asset.url})
    } finally {
      setUploadingProductId(null)
      event.target.value = ''
    }
  }
  const save = () => {
    const sections = sectionsSource.map((section, mappedSectionIndex) => ({
      ...section,
      products: (sectionDrafts[mappedSectionIndex] ?? []).map((draft, index) => ({
        product_id: draft.productId,
        display_order: (index + 1) * 10,
        display_name: draft.displayName || relationName(candidateProducts, draft.productId, relationName(products, draft.productId)),
        display_price: Number(draft.displayPrice),
        image_url: draft.imageUrl || null,
        recommended: draft.recommended,
      })),
    }))
    void onSave(sections)
  }
  const totalSelected = sectionDrafts.reduce((sum, rows) => sum + rows.length, 0)
  return (
    <Modal title="配置菜单商品" subtitle={`${menu.title} · 共 ${sectionsSource.length} 个分区、${totalSelected} 个商品，可编辑展示名、展示价、推荐和排序`} onClose={onClose} wide>
      <div className="customer-v3-section-switcher">
        <label>
          <span>当前分区</span>
          <select value={String(sectionIndex)} onChange={event => setSectionIndex(Number(event.target.value))}>
            {sectionsSource.map((section, index) => (
              <option key={`${asText(section.section_id, 'section')}-${index}`} value={String(index)}>
                {asText(section.section_name, `分区 ${index + 1}`)} · {(sectionDrafts[index] ?? []).length} 个商品
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="customer-v3-dual-selector">
        <section>
          <h3>商品库</h3>
          {candidateProducts.map(product => (
            <label className="customer-v3-product-option" key={product.entityId}>
              <input type="checkbox" checked={selectedIds.includes(product.entityId)} onChange={() => toggle(product.entityId)} />
              <ProductThumb product={product} />
              <span>{product.title}</span>
              <small>{money(dataOf(product).base_price)}</small>
            </label>
          ))}
        </section>
        <section>
          <h3>{asText(currentSection.section_name, '菜单展示')}</h3>
          {drafts.length === 0 ? <p className="customer-v3-muted">从左侧商品库选择菜品。</p> : drafts.map((draft, index) => (
            <div className="customer-v3-selected-product" key={draft.productId}>
              <div className="customer-v3-selected-product-title">
                <ProductThumb product={products.find(product => product.entityId === draft.productId)} imageUrl={draft.imageUrl} />
                <strong>{relationName(candidateProducts, draft.productId, relationName(products, draft.productId))}</strong>
              </div>
              <label><span>展示名</span><input value={draft.displayName} onChange={event => updateDraft(draft.productId, {displayName: event.target.value})} /></label>
              <label><span>展示价</span><input type="number" value={draft.displayPrice} onChange={event => updateDraft(draft.productId, {displayPrice: event.target.value})} /></label>
              <label className="wide"><span>展示图</span>
                <div className="customer-v3-asset-field">
                  <div className="customer-v3-asset-preview">
                    {draft.imageUrl ? <img src={draft.imageUrl} alt={draft.displayName} /> : <span>未上传</span>}
                  </div>
                  <div className="customer-v3-asset-copy">
                    <strong>{draft.imageUrl ? '已设置展示图' : '默认继承商品图片'}</strong>
                    <small>用于终端菜单和后台菜单预览。</small>
                  </div>
                  <div className="customer-v3-asset-actions">
                    <label className="customer-v3-upload-button">
                      <input type="file" accept="image/*" disabled={uploadingProductId === draft.productId} onChange={event => void uploadDisplayImage(draft.productId, event)} />
                      {uploadingProductId === draft.productId ? '上传中' : draft.imageUrl ? '更换图片' : '上传图片'}
                    </label>
                    {draft.imageUrl ? <button type="button" onClick={() => updateDraft(draft.productId, {imageUrl: ''})}>清除</button> : null}
                  </div>
                </div>
              </label>
              <label className="customer-v3-inline-check"><input type="checkbox" checked={draft.recommended} onChange={event => updateDraft(draft.productId, {recommended: event.target.checked})} />推荐</label>
              <span>排序 {(index + 1) * 10}</span>
            </div>
          ))}
        </section>
      </div>
      <footer className="customer-v3-modal-footer"><button type="button" onClick={onClose}>取消</button><button type="button" onClick={save}>保存商品</button></footer>
    </Modal>
  )
}
