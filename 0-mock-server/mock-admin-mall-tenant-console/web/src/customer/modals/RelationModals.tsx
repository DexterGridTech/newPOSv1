import {useState, type ChangeEvent} from 'react'
import {api} from '../../api'
import type {CustomerEntity} from '../types'
import {Modal} from '../components/common'
import {asArray, asText, dataOf, enumLabel, money, relationName} from '../domain'
import {metadataOptions} from '../metadata'

export function RolePermissionModal({role, permissions, onClose, onSave}: {role: CustomerEntity; permissions: CustomerEntity[]; onClose: () => void; onSave: (permissionIds: string[]) => Promise<void>}) {
  const [selected, setSelected] = useState<string[]>(() => asArray(dataOf(role).permission_ids).map(String))
  const rolePlatformId = asText(dataOf(role).platform_id, '')
  const candidatePermissions = rolePlatformId
    ? permissions.filter(permission => dataOf(permission).platform_id === rolePlatformId)
    : permissions
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  return (
    <Modal title="编辑角色权限" subtitle={`${role.title} · 已选 ${selected.length} 个`} onClose={onClose} wide>
      <div className="customer-v3-dual-selector">
        <section>
          <h3>候选权限</h3>
          {candidatePermissions.map(permission => (
            <label key={permission.entityId}>
              <input type="checkbox" checked={selected.includes(permission.entityId)} onChange={() => toggle(permission.entityId)} />
              <span>{permission.title}</span>
              <small>{enumLabel(dataOf(permission).permission_type)}</small>
            </label>
          ))}
        </section>
        <section>
          <h3>已选权限</h3>
          {selected.map(id => <button type="button" key={id} onClick={() => toggle(id)}>{relationName(permissions, id)} ×</button>)}
        </section>
      </div>
      <footer className="customer-v3-modal-footer">
        <button type="button" onClick={onClose}>取消</button>
        <button type="button" onClick={() => void onSave(selected)}>保存权限</button>
      </footer>
    </Modal>
  )
}

export function GrantRoleModal({user, roles, projects, stores, onClose, onSave}: {user: CustomerEntity; roles: CustomerEntity[]; projects: CustomerEntity[]; stores: CustomerEntity[]; onClose: () => void; onSave: (values: Parameters<typeof api.createUserRoleBinding>[0]) => Promise<void>}) {
  const [roleId, setRoleId] = useState(roles[0]?.entityId ?? '')
  const [scopeType, setScopeType] = useState('STORE')
  const [scopeId, setScopeId] = useState(stores[0]?.entityId ?? '')
  const scopeOptions = scopeType === 'PROJECT' ? projects : scopeType === 'STORE' ? stores : []
  return (
    <Modal title="授予角色" subtitle={`${user.title} · ${asText(dataOf(user).user_code)}`} onClose={onClose}>
      <form className="customer-v3-form" onSubmit={event => {
        event.preventDefault()
        void onSave({
          userId: user.entityId,
          roleId,
          scopeType,
          scopeId: scopeType === 'PLATFORM' ? undefined : scopeId,
          storeId: scopeType === 'STORE' ? scopeId : undefined,
        })
      }}>
        <label><span>角色 *</span><select value={roleId} onChange={event => setRoleId(event.target.value)}>{roles.map(role => <option key={role.entityId} value={role.entityId}>{role.title}</option>)}</select></label>
        <label><span>授权范围 *</span><select value={scopeType} onChange={event => setScopeType(event.target.value)}>{metadataOptions.scopeTypes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
        {scopeType !== 'PLATFORM' ? <label><span>授权对象 *</span><select value={scopeId} onChange={event => setScopeId(event.target.value)}>{scopeOptions.map(item => <option key={item.entityId} value={item.entityId}>{item.title}</option>)}</select></label> : null}
        <footer><button type="button" onClick={onClose}>取消</button><button type="submit">确认授予</button></footer>
      </form>
    </Modal>
  )
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
