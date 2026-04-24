import type {Dispatch, SetStateAction} from 'react'
import {JsonPanel, ResourceCard, TextField} from '../shared'
import type {EntityItem, LastProductResult, ProductDraft} from '../types'

type Props = {
  products: EntityItem[]
  productDraft: ProductDraft
  setProductDraft: Dispatch<SetStateAction<ProductDraft>>
  productActionLoading: boolean
  upsertProductFlow: () => Promise<void>
  changeLatestProductStatus: (nextAction: 'activate' | 'suspend') => Promise<void>
  lastProductResult: LastProductResult | null
}

export function ProductsWorkspace(props: Props) {
  const {
    products,
    productDraft,
    setProductDraft,
    productActionLoading,
    upsertProductFlow,
    changeLatestProductStatus,
    lastProductResult,
  } = props

  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>餐饮商品建模工作台</h3>
            <p className="panel-subtitle">从品牌/门店归属开始，把生产步骤、加料组、规格和套餐槽位一起落进 aligned write-model。</p>
          </div>
          <span>{products.length} products</span>
        </div>
        <div className="org-form-grid compact">
          <TextField label="商品名称" name="productName" value={productDraft.productName} onChange={value => setProductDraft(current => ({...current, productName: value}))} />
          <TextField label="归属范围" name="ownershipScope" value={productDraft.ownershipScope} onChange={value => setProductDraft(current => ({...current, ownershipScope: value === 'STORE' ? 'STORE' : 'BRAND'}))} />
          <TextField label="Brand Id" name="productBrandId" value={productDraft.brandId} onChange={value => setProductDraft(current => ({...current, brandId: value}))} />
          <TextField label="Store Id" name="productStoreId" value={productDraft.storeId} onChange={value => setProductDraft(current => ({...current, storeId: value}))} />
          <TextField label="商品类型" name="productType" value={productDraft.productType} onChange={value => setProductDraft(current => ({...current, productType: value}))} />
          <TextField label="基础价格" name="basePrice" value={productDraft.basePrice} onChange={value => setProductDraft(current => ({...current, basePrice: value}))} />
          <TextField label="生产步骤名" name="productionStepName" value={productDraft.productionStepName} onChange={value => setProductDraft(current => ({...current, productionStepName: value}))} />
          <TextField label="Workstation Code" name="workstationCode" value={productDraft.workstationCode} onChange={value => setProductDraft(current => ({...current, workstationCode: value}))} />
          <TextField label="加料组" name="modifierGroupName" value={productDraft.modifierGroupName} onChange={value => setProductDraft(current => ({...current, modifierGroupName: value}))} />
          <TextField label="规格" name="variantName" value={productDraft.variantName} onChange={value => setProductDraft(current => ({...current, variantName: value}))} />
          <TextField label="套餐分组" name="comboGroupName" value={productDraft.comboGroupName} onChange={value => setProductDraft(current => ({...current, comboGroupName: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void upsertProductFlow()} disabled={productActionLoading}>创建餐饮商品</button>
          <button onClick={() => void changeLatestProductStatus('activate')} disabled={productActionLoading}>激活最近商品</button>
          <button onClick={() => void changeLatestProductStatus('suspend')} disabled={productActionLoading}>暂停最近商品</button>
        </div>
      </article>
      <ResourceCard title="餐饮商品" count={products.length} items={products} />
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>最近一次商品工作流结果</h3>
            <p className="panel-subtitle">保留刚刚创建/激活/暂停的商品回包，直接确认写模型里已经带上餐饮结构化字段。</p>
          </div>
          <span>{lastProductResult ? 'ready' : 'empty'}</span>
        </div>
        <JsonPanel value={lastProductResult} />
      </article>
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>餐饮商品结构快照</h3>
            <p className="panel-subtitle">确认生产步骤、加料组、规格和套餐槽位都直接进入 payload，而不是 UI 层临时拼装。</p>
          </div>
          <span>{products.length}</span>
        </div>
        <JsonPanel value={products} />
      </article>
    </>
  )
}
