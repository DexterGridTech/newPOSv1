import type {Dispatch, SetStateAction} from 'react'
import {JsonPanel, ResourceCard, TextField} from '../shared'
import type {EntityItem, LastOperationResult, OperationDraft} from '../types'

type Props = {
  storeConfigs: EntityItem[]
  inventories: EntityItem[]
  priceRules: EntityItem[]
  availabilityRules: EntityItem[]
  menuAvailability: EntityItem[]
  operationDraft: OperationDraft
  setOperationDraft: Dispatch<SetStateAction<OperationDraft>>
  operationActionLoading: boolean
  runOperationsWorkflow: () => Promise<void>
  restoreProductAvailability: () => Promise<void>
  lastOperationResult: LastOperationResult | null
}

export function OperationsWorkspace(props: Props) {
  const {
    storeConfigs,
    inventories,
    priceRules,
    availabilityRules,
    menuAvailability,
    operationDraft,
    setOperationDraft,
    operationActionLoading,
    runOperationsWorkflow,
    restoreProductAvailability,
    lastOperationResult,
  } = props

  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>门店经营主链路操作台</h3>
            <p className="panel-subtitle">只维护交易前主数据：营业配置、库存汇总、价格规则和可售规则；不在这里处理订单、预订或履约流程。</p>
          </div>
          <span>{storeConfigs.length + inventories.length} operating facts</span>
        </div>
        <div className="org-form-grid compact">
          <TextField label="Store Id" name="operationStoreId" value={operationDraft.storeId} onChange={value => setOperationDraft(current => ({...current, storeId: value}))} />
          <TextField label="Product Id" name="operationProductId" value={operationDraft.productId} onChange={value => setOperationDraft(current => ({...current, productId: value}))} />
          <TextField label="Business Status" name="businessStatus" value={operationDraft.businessStatus} onChange={value => setOperationDraft(current => ({...current, businessStatus: value}))} />
          <TextField label="Accept Order" name="acceptOrder" value={String(operationDraft.acceptOrder)} onChange={value => setOperationDraft(current => ({...current, acceptOrder: value !== 'false'}))} />
          <TextField label="Weekday" name="weekday" value={operationDraft.weekday} onChange={value => setOperationDraft(current => ({...current, weekday: value}))} />
          <TextField label="营业开始" name="startTime" value={operationDraft.startTime} onChange={value => setOperationDraft(current => ({...current, startTime: value}))} />
          <TextField label="营业结束" name="endTime" value={operationDraft.endTime} onChange={value => setOperationDraft(current => ({...current, endTime: value}))} />
          <TextField label="附加费名称" name="extraChargeName" value={operationDraft.extraChargeName} onChange={value => setOperationDraft(current => ({...current, extraChargeName: value}))} />
          <TextField label="附加费金额" name="extraChargeAmount" value={operationDraft.extraChargeAmount} onChange={value => setOperationDraft(current => ({...current, extraChargeAmount: value}))} />
          <TextField label="库存 ID" name="stockId" value={operationDraft.stockId} onChange={value => setOperationDraft(current => ({...current, stockId: value}))} />
          <TextField label="可售库存" name="saleableQuantity" value={operationDraft.saleableQuantity} onChange={value => setOperationDraft(current => ({...current, saleableQuantity: value}))} />
          <TextField label="安全库存" name="safetyStock" value={operationDraft.safetyStock} onChange={value => setOperationDraft(current => ({...current, safetyStock: value}))} />
          <TextField label="沽清原因" name="soldOutReason" value={operationDraft.soldOutReason} onChange={value => setOperationDraft(current => ({...current, soldOutReason: value}))} />
          <TextField label="价格规则码" name="priceRuleCode" value={operationDraft.priceRuleCode} onChange={value => setOperationDraft(current => ({...current, priceRuleCode: value}))} />
          <TextField label="价格增量" name="priceDelta" value={operationDraft.priceDelta} onChange={value => setOperationDraft(current => ({...current, priceDelta: value}))} />
          <TextField label="价格类型" name="priceType" value={operationDraft.priceType} onChange={value => setOperationDraft(current => ({...current, priceType: value}))} />
          <TextField label="价格渠道" name="channelType" value={operationDraft.channelType} onChange={value => setOperationDraft(current => ({...current, channelType: value}))} />
          <TextField label="可售规则码" name="availabilityRuleCode" value={operationDraft.availabilityRuleCode} onChange={value => setOperationDraft(current => ({...current, availabilityRuleCode: value}))} />
          <TextField label="可售规则渠道" name="availabilityChannelType" value={operationDraft.availabilityChannelType} onChange={value => setOperationDraft(current => ({...current, availabilityChannelType: value}))} />
          <TextField label="允许可售" name="availabilityAllowed" value={String(operationDraft.availabilityAllowed)} onChange={value => setOperationDraft(current => ({...current, availabilityAllowed: value === 'true'}))} />
          <TextField label="已占用数量" name="reservedQuantity" value={operationDraft.reservedQuantity} onChange={value => setOperationDraft(current => ({...current, reservedQuantity: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void runOperationsWorkflow()} disabled={operationActionLoading}>更新经营主数据</button>
          <button onClick={() => void restoreProductAvailability()} disabled={operationActionLoading}>恢复商品可售</button>
        </div>
      </article>
      <ResourceCard title="门店经营配置" count={storeConfigs.length} items={storeConfigs} />
      <ResourceCard title="库存 / 可售库存" count={inventories.length} items={inventories} />
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>经营规则与库存快照</h3>
            <p className="panel-subtitle">把 store config、库存汇总、价格规则、可售规则与人工沽清放在同一个视图里追踪主数据影响链。</p>
          </div>
          <span>{storeConfigs.length + inventories.length + priceRules.length + availabilityRules.length}</span>
        </div>
        <JsonPanel value={{storeConfigs, inventories, priceRules, availabilityRules, menuAvailability}} />
      </article>
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>最近一次经营工作流结果</h3>
            <p className="panel-subtitle">这里保留营业配置、库存、价格和可售规则的最新回包，确认 UI 完全跟着 state 收敛。</p>
          </div>
          <span>{lastOperationResult ? 'ready' : 'empty'}</span>
        </div>
        <JsonPanel value={lastOperationResult} />
      </article>
    </>
  )
}
