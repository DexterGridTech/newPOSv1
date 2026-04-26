import {useEffect, useMemo, useState} from 'react'
import type {CustomerEntity} from '../types'
import {EmptyState, PageHeader} from '../components/common'
import {
  defaultPlatformMetadataCatalog,
  platformMetadataOptions,
  platformMetadataKeys,
  platformMetadataLabels,
  type MetadataOption,
  type PlatformMetadataKey,
} from '../metadata'

type DictionaryDraft = Record<PlatformMetadataKey, MetadataOption[]>

const cloneOptions = (options: MetadataOption[]) => options.map(option => ({
  label: option.label,
  value: option.value,
  status: option.status ?? 'ACTIVE',
}))

const createDraft = (platform: CustomerEntity | undefined) => Object.fromEntries(platformMetadataKeys.map(key => [
  key,
  cloneOptions(platform ? platformMetadataOptions(platform, key) : defaultPlatformMetadataCatalog[key]),
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

const sanitizeDraft = (draft: DictionaryDraft) => Object.fromEntries(platformMetadataKeys.map(key => [
  key,
  draft[key]
    .map((option, index) => {
      const label = option.label.trim()
      const value = valueFromLabel(option.value, `${key.toUpperCase()}_${index + 1}`)
      return label ? {label, value, status: 'ACTIVE'} : null
    })
    .filter(Boolean),
])) as Record<string, unknown>

export function BusinessDictionariesPage(props: {
  platform: CustomerEntity | undefined
  loading: boolean
  onSave: (catalog: Record<string, unknown>) => Promise<void>
}) {
  const [draft, setDraft] = useState<DictionaryDraft>(() => createDraft(props.platform))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(createDraft(props.platform))
  }, [props.platform?.entityId, props.platform?.sourceRevision])

  const counts = useMemo(() => Object.fromEntries(platformMetadataKeys.map(key => [
    key,
    draft[key].filter(option => option.label.trim()).length,
  ])) as Record<PlatformMetadataKey, number>, [draft])

  if (!props.platform && !props.loading) {
    return <EmptyState title="没有可维护的集团" detail="请先在当前沙箱下创建集团平台。" />
  }

  const submit = async () => {
    if (!props.platform) return
    setSaving(true)
    try {
      await props.onSave(sanitizeDraft(draft))
    } finally {
      setSaving(false)
    }
  }

  const updateOption = (key: PlatformMetadataKey, index: number, field: 'label' | 'value', value: string) => {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].map((option, optionIndex) => optionIndex === index ? {...option, [field]: value} : option),
    }))
  }

  const addOption = (key: PlatformMetadataKey) => {
    setDraft(prev => ({
      ...prev,
      [key]: [...prev[key], {label: '', value: newOptionValue(key, prev[key]), status: 'ACTIVE'}],
    }))
  }

  const removeOption = (key: PlatformMetadataKey, index: number) => {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  return (
    <section>
      <PageHeader
        title="集团业务字典"
        scope={props.platform ? props.platform.title : '当前平台下的业务选项'}
        action={<button type="button" disabled={!props.platform || saving} onClick={() => void submit()}>{saving ? '保存中' : '保存字典'}</button>}
      />
      <div className="customer-v3-dictionary-layout">
        {platformMetadataKeys.map(key => (
          <section key={key} className="customer-v3-dictionary-card">
            <header>
              <div>
                <h2>{platformMetadataLabels[key].title}</h2>
                <p>{platformMetadataLabels[key].helper}</p>
              </div>
              <div>
                <span>{counts[key]} 项</span>
                <button type="button" onClick={() => addOption(key)}>新增选项</button>
              </div>
            </header>
            <div className="customer-v3-dictionary-table-wrap">
              <table className="customer-v3-dictionary-table">
                <thead>
                  <tr>
                    <th>业务名称</th>
                    <th>稳定标识</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {draft[key].map((option, index) => (
                    <tr key={`${option.value}-${index}`}>
                      <td>
                        <input
                          aria-label={`${platformMetadataLabels[key].title}业务名称`}
                          value={option.label}
                          placeholder="例如：华东大区"
                          onChange={event => updateOption(key, index, 'label', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${platformMetadataLabels[key].title}稳定标识`}
                          value={option.value}
                          placeholder="例如：EAST_CHINA"
                          onChange={event => updateOption(key, index, 'value', event.target.value)}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => removeOption(key, index)}>移除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
