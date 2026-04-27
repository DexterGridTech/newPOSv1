import {useEffect, useMemo, useState} from 'react'
import type {CustomerEntity} from '../types'
import {EmptyState, PageHeader} from '../components/common'
import {asText, dataOf} from '../domain'
import {
  businessMetadataOptions,
  defaultPlatformMetadataCatalog,
  metadataOwnerLabels,
  platformMetadataOptions,
  platformMetadataKeys,
  platformMetadataLabels,
  platformMetadataOwnerScopes,
  type MetadataOption,
  type MetadataOwnerScope,
  type PlatformMetadataKey,
} from '../metadata'

type DictionaryScope = MetadataOwnerScope
type DictionaryDraft = Record<DictionaryScope, Record<PlatformMetadataKey, MetadataOption[]>>

const dictionaryScopes: DictionaryScope[] = ['PLATFORM', 'BRAND', 'STORE']

const dictionaryScopeTitles: Record<DictionaryScope, {title: string; helper: string}> = {
  PLATFORM: {title: '集团公共', helper: '项目、租户、品牌目录共用'},
  BRAND: {title: '品牌商品', helper: '商品类型、分类、出品品类'},
  STORE: {title: '门店经营', helper: '经营场景、桌台、工作站、渠道、价格'},
}

const keysForScope = (scope: DictionaryScope) => platformMetadataKeys.filter(key => platformMetadataOwnerScopes[key] === scope)

const cloneOptions = (options: MetadataOption[]) => options.map(option => ({
  label: option.label,
  value: option.value,
  status: option.status ?? 'ACTIVE',
  ownerScope: option.ownerScope,
  ownerId: option.ownerId,
}))

const scopedOptions = (input: {
  scope: DictionaryScope
  key: PlatformMetadataKey
  platform: CustomerEntity | undefined
  brand: CustomerEntity | undefined
  store: CustomerEntity | undefined
}) => {
  if (input.scope === 'PLATFORM') {
    return input.platform ? platformMetadataOptions(input.platform, input.key) : defaultPlatformMetadataCatalog[input.key]
  }
  if (input.scope === 'BRAND' && !input.brand) return []
  if (input.scope === 'STORE' && !input.store) return []
  return businessMetadataOptions({
    platform: input.platform,
    brand: input.brand,
    store: input.store,
    key: input.key,
  })
}

const createDraft = (input: {
  platform: CustomerEntity | undefined
  brand: CustomerEntity | undefined
  store: CustomerEntity | undefined
}) => Object.fromEntries(dictionaryScopes.map(scope => [
  scope,
  Object.fromEntries(keysForScope(scope).map(key => [
    key,
    cloneOptions(scopedOptions({...input, scope, key})),
  ])),
])) as DictionaryDraft

const valueFromLabel = (label: string, fallback: string) => {
  const value = label
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  return value || fallback
}

const newOptionValue = (key: PlatformMetadataKey, options: MetadataOption[]) => {
  const prefixByKey: Record<PlatformMetadataKey, string> = {
    regions: 'REGION',
    project_business_modes: 'PROJECT_TYPE',
    tenant_types: 'TENANT_TYPE',
    tenant_business_models: 'TENANT_MODE',
    store_business_formats: 'STORE_FORMAT',
    store_cooperation_modes: 'STORE_MODE',
    store_business_scenarios: 'STORE_SCENE',
    brand_categories: 'BRAND_CATEGORY',
    table_areas: 'TABLE_AREA',
    table_types: 'TABLE_TYPE',
    workstation_types: 'WORKSTATION_TYPE',
    production_categories: 'PRODUCTION_CATEGORY',
    product_categories: 'PRODUCT_CATEGORY',
    product_types: 'PRODUCT_TYPE',
    price_types: 'PRICE_TYPE',
    channel_types: 'CHANNEL',
    discount_types: 'DISCOUNT',
    member_tiers: 'MEMBER_TIER',
    availability_rule_types: 'AVAILABILITY_RULE',
  }
  let index = options.length + 1
  let value = `${prefixByKey[key]}_${index}`
  const usedValues = new Set(options.map(option => option.value))
  while (usedValues.has(value)) {
    index += 1
    value = `${prefixByKey[key]}_${index}`
  }
  return value
}

const sanitizeDraft = (draft: DictionaryDraft, scope: DictionaryScope, ownerId: string | undefined, keys = keysForScope(scope)) => Object.fromEntries(keys.map(key => [
  key,
  draft[scope][key]
    .map((option, index) => {
      const label = option.label.trim()
      const value = valueFromLabel(option.value, `${key.toUpperCase()}_${index + 1}`)
      return label ? {
        label,
        value,
        status: 'ACTIVE',
        owner_scope: scope,
        owner_id: ownerId,
      } : null
    })
    .filter(Boolean),
])) as Record<string, unknown>

const ownerForScope = (
  scope: DictionaryScope,
  ownerContext: {platform: CustomerEntity | undefined; brand: CustomerEntity | undefined; store: CustomerEntity | undefined},
) => {
  if (scope === 'BRAND') return ownerContext.brand
  if (scope === 'STORE') return ownerContext.store
  return ownerContext.platform
}

type BusinessDictionariesPageProps = {
  platform: CustomerEntity | undefined
  brand: CustomerEntity | undefined
  store: CustomerEntity | undefined
  brands: CustomerEntity[]
  stores: CustomerEntity[]
  selectedBrandId: string
  selectedStoreId: string
  loading: boolean
  onSelectBrand: (brandId: string) => void
  onSelectStore: (storeId: string) => void
  onSave: (scope: DictionaryScope, owner: CustomerEntity, catalog: Record<string, unknown>) => Promise<void>
}

export function BusinessDictionariesPage(props: BusinessDictionariesPageProps) {
  const [activeScope, setActiveScope] = useState<DictionaryScope>('PLATFORM')
  const [activeKey, setActiveKey] = useState<PlatformMetadataKey>(keysForScope('PLATFORM')[0])
  const brands = props.brands ?? []
  const stores = props.stores ?? []
  const brandOptions = useMemo(() => {
    if (!props.platform) return brands
    return brands.filter(brand => {
      const data = dataOf(brand)
      return asText(data.platform_id, '') === props.platform?.entityId || brand.naturalScopeKey === props.platform?.entityId
    })
  }, [brands, props.platform])
  const selectedBrandValue = brandOptions.some(brand => brand.entityId === props.selectedBrandId)
    ? props.selectedBrandId
    : brandOptions[0]?.entityId ?? ''
  const resolvedBrand = brandOptions.find(brand => brand.entityId === selectedBrandValue)
  const storeOptions = useMemo(() => {
    const brandId = resolvedBrand?.entityId ?? ''
    if (!brandId) return []
    return stores.filter(store => !brandId || asText(dataOf(store).brand_id, '') === brandId)
  }, [stores, resolvedBrand])
  const selectedStoreValue = storeOptions.some(store => store.entityId === props.selectedStoreId)
    ? props.selectedStoreId
    : storeOptions[0]?.entityId ?? ''
  const resolvedStore = storeOptions.find(store => store.entityId === selectedStoreValue)
  const effectiveContext = {platform: props.platform, brand: resolvedBrand, store: resolvedStore}
  const [draft, setDraft] = useState<DictionaryDraft>(() => createDraft(effectiveContext))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(createDraft(effectiveContext))
  }, [props.platform?.entityId, props.platform?.sourceRevision, resolvedBrand?.entityId, resolvedBrand?.sourceRevision, resolvedStore?.entityId, resolvedStore?.sourceRevision])

  const counts = useMemo(() => Object.fromEntries(platformMetadataKeys.map(key => [
    key,
    draft[platformMetadataOwnerScopes[key]][key]?.filter(option => option.label.trim()).length ?? 0,
  ])) as Record<PlatformMetadataKey, number>, [draft])
  const activeKeys = keysForScope(activeScope)
  const visibleKey = activeKeys.includes(activeKey) ? activeKey : activeKeys[0]
  const activeOwner = ownerForScope(activeScope, effectiveContext)
  const activeOptions = draft[activeScope][visibleKey] ?? []
  const activeCount = activeOptions.filter(option => option.label.trim()).length
  const activeLabel = platformMetadataLabels[visibleKey]
  const missingOwnerTitle = activeScope === 'BRAND'
    ? '暂无可维护品牌'
    : activeScope === 'STORE'
    ? resolvedBrand
      ? '当前品牌暂无门店'
      : '先选择品牌'
    : ''
  const missingOwnerDetail = activeScope === 'BRAND'
    ? '请先在当前集团下创建品牌，再维护品牌商品字典。'
    : activeScope === 'STORE'
    ? resolvedBrand
      ? '门店经营字典必须归属具体门店。当前品牌下没有门店，因此不能维护门店经营选项。'
      : '请先选择品牌，再选择该品牌下的门店。'
    : ''

  if (!props.platform && !props.loading) {
    return <EmptyState title="没有可维护的集团" detail="请先在当前沙箱下创建集团平台。" />
  }

  if (!props.platform && props.loading) {
    return (
      <section className="customer-v3-dictionary-page">
        <PageHeader title="业务字典" scope="正在加载当前沙箱下的集团、品牌和门店" />
        <div className="customer-v3-dictionary-loading">
          <strong>加载业务字典维护上下文</strong>
          <span>稍后会按集团公共、品牌商品、门店经营三个维护场景进入编辑。</span>
        </div>
      </section>
    )
  }

  const submit = async () => {
    const owner = ownerForScope(activeScope, effectiveContext)
    if (!owner) return
    setSaving(true)
    try {
      await props.onSave(activeScope, owner, sanitizeDraft(draft, activeScope, owner.entityId, [visibleKey]))
    } finally {
      setSaving(false)
    }
  }

  const updateOption = (key: PlatformMetadataKey, index: number, field: 'label' | 'value', value: string) => {
    setDraft(prev => ({
      ...prev,
      [activeScope]: {
        ...prev[activeScope],
        [key]: prev[activeScope][key].map((option, optionIndex) => optionIndex === index ? {...option, [field]: value} : option),
      },
    }))
  }

  const addOption = (key: PlatformMetadataKey) => {
    setDraft(prev => ({
      ...prev,
      [activeScope]: {
        ...prev[activeScope],
        [key]: [...prev[activeScope][key], {label: '', value: newOptionValue(key, prev[activeScope][key]), status: 'ACTIVE'}],
      },
    }))
  }

  const removeOption = (key: PlatformMetadataKey, index: number) => {
    setDraft(prev => ({
      ...prev,
      [activeScope]: {
        ...prev[activeScope],
        [key]: prev[activeScope][key].filter((_, optionIndex) => optionIndex !== index),
      },
    }))
  }

  const handleBrandChange = (brandId: string) => {
    props.onSelectBrand(brandId)
    const firstStore = stores.find(store => asText(dataOf(store).brand_id, '') === brandId)
    props.onSelectStore(firstStore?.entityId ?? '')
  }

  const handleStoreChange = (storeId: string) => {
    props.onSelectStore(storeId)
    const store = stores.find(item => item.entityId === storeId)
    const brandId = asText(dataOf(store).brand_id, '')
    if (brandId && brandId !== props.selectedBrandId) props.onSelectBrand(brandId)
  }

  const selectScope = (scope: DictionaryScope) => {
    setActiveScope(scope)
    setActiveKey(keysForScope(scope)[0])
  }

  const pageScopeText = activeOwner
    ? activeScope === 'PLATFORM'
      ? `维护集团公共口径 · ${activeOwner.title}`
      : activeScope === 'BRAND'
      ? `维护品牌商品选项 · ${activeOwner.title}`
      : `维护门店经营选项 · ${activeOwner.title}`
    : '先选择需要维护的品牌或门店'

  return (
    <section className="customer-v3-dictionary-page">
      <PageHeader title="业务字典" scope={pageScopeText} />
      <div className="customer-v3-dictionary-lanes" aria-label="字典维护范围">
        {dictionaryScopes.map(scope => {
          const owner = ownerForScope(scope, effectiveContext)
          return (
            <button key={scope} type="button" className={scope === activeScope ? 'active' : ''} onClick={() => selectScope(scope)}>
              <strong>{dictionaryScopeTitles[scope].title}</strong>
              <small>{dictionaryScopeTitles[scope].helper}</small>
              <span>{owner ? owner.title : props.loading ? '加载中' : '未选择'}</span>
            </button>
          )
        })}
      </div>
      {activeScope !== 'PLATFORM' ? (
        <div className={`customer-v3-dictionary-context ${activeScope.toLowerCase()}`} aria-label="字典维护对象">
          <div>
            <span>集团</span>
            <strong>{props.platform?.title ?? (props.loading ? '加载中' : '暂无集团')}</strong>
          </div>
          <label>
            <span>品牌</span>
            <select value={selectedBrandValue} onChange={event => handleBrandChange(event.target.value)} disabled={brandOptions.length === 0}>
              {brandOptions.length === 0 ? <option value="">暂无品牌</option> : null}
              {brandOptions.map(brand => <option key={brand.entityId} value={brand.entityId}>{brand.title}</option>)}
            </select>
          </label>
          {activeScope === 'STORE' ? (
            <label>
              <span>门店</span>
              <select value={selectedStoreValue} onChange={event => handleStoreChange(event.target.value)} disabled={storeOptions.length === 0}>
                {storeOptions.length === 0 ? <option value="">暂无门店</option> : null}
                {storeOptions.map(store => <option key={store.entityId} value={store.entityId}>{store.title}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="customer-v3-dictionary-workbench">
        <aside className="customer-v3-dictionary-key-list" aria-label="字典目录">
          <header>
            <strong>{dictionaryScopeTitles[activeScope].title}</strong>
            <span>{activeKeys.length} 个字典</span>
          </header>
          {activeKeys.map(key => (
            <button key={key} type="button" className={key === visibleKey ? 'active' : ''} onClick={() => setActiveKey(key)}>
              <span>{platformMetadataLabels[key].title}</span>
              <small>{counts[key]} 项</small>
            </button>
          ))}
        </aside>
        {!activeOwner ? (
          <section className="customer-v3-dictionary-card">
            <EmptyState title={missingOwnerTitle || '暂无可维护对象'} detail={missingOwnerDetail || '请先选择需要维护的业务对象。'} />
          </section>
        ) : (
        <section className="customer-v3-dictionary-card">
          <header className="customer-v3-dictionary-editor-header">
            <div>
              <h2>{activeLabel.title}</h2>
              <p>{activeLabel.helper}</p>
            </div>
            <div className="customer-v3-dictionary-editor-actions">
              <span>{activeCount} 项</span>
              <button type="button" onClick={() => addOption(visibleKey)}>新增选项</button>
              <button type="button" disabled={!activeOwner || saving} onClick={() => void submit()}>{saving ? '保存中' : '保存当前字典'}</button>
            </div>
          </header>
          <div className="customer-v3-dictionary-table-wrap">
            <table className="customer-v3-dictionary-table">
              <thead>
                <tr>
                  <th>稳定 Key</th>
                  <th>显示值</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {activeOptions.map((option, index) => (
                  <tr key={`${option.value}-${index}`}>
                    <td>
                      <input
                        aria-label={`${activeLabel.title}稳定 Key`}
                        value={option.value}
                        placeholder="例如：EAST_CHINA"
                        onChange={event => updateOption(visibleKey, index, 'value', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${activeLabel.title}显示值`}
                        value={option.label}
                        placeholder="例如：华东大区"
                        onChange={event => updateOption(visibleKey, index, 'label', event.target.value)}
                      />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeOption(visibleKey, index)}>移除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </section>
  )
}
