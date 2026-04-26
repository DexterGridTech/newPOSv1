import {useState, type ChangeEvent, type FormEvent} from 'react'
import {api} from '../../api'
import {pageMeta, pageToEntityType} from '../constants'
import type {CollectionState, CustomerEntity, FieldDef, PageKey} from '../types'
import {Modal} from '../components/common'
import {asText, dataOf} from '../domain'
import {formatOptionLines, metadataOptions, optionLabel, parseOptionLines, platformMetadataOptions, type MetadataOption} from '../metadata'

const createInitialValues = (fields: FieldDef[], selected: CustomerEntity | null) => {
  const data = dataOf(selected)
  return Object.fromEntries(fields.map(field => {
    const value = readFieldValue(data, field.name) ?? (field.name === 'title' ? selected?.title : undefined) ?? field.defaultValue ?? ''
    if (field.type === 'option-list') return [field.name, formatOptionLines(value, parseOptionLines(field.defaultValue ?? ''))]
    if (field.type === 'multi-select') return [field.name, Array.isArray(value) ? value.map(String).join(',') : String(value ?? '')]
    if (field.type === 'project-phases') return [field.name, serializeProjectPhases(value, selected?.title)]
    return [field.name, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')]
  }))
}

const readFieldValue = (data: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined
    return (current as Record<string, unknown>)[key]
  }, data)

const writeFieldValue = (data: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.')
  const last = parts.pop()
  if (!last) return
  let target = data
  parts.forEach(part => {
    const current = target[part]
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      target[part] = {}
    }
    target = target[part] as Record<string, unknown>
  })
  target[last] = value
}

const parseFieldValue = (field: FieldDef, value: string) => {
  if (value === '') {
    if (field.type === 'number') return undefined
    return ''
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (field.type === 'number') return Number(value)
  if (field.type === 'option-list') return parseOptionLines(value)
  if (field.type === 'multi-select') return value.split(',').map(item => item.trim()).filter(Boolean)
  if (field.type === 'project-phases') return parseProjectPhases(value).map((phase, index) => ({
    ...phase,
    phase_id: index === 0 ? 'phase-default' : normalizePhaseId(phase.phase_name, index),
  }))
  if (field.type === 'json') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

const defaultProjectPhase = (projectName = '') => ({
  phase_id: 'phase-default',
  phase_name: '一期',
  owner_name: projectName ? `${projectName}业主方` : '项目业主方',
  owner_contact: '',
  owner_phone: '',
})

const asProjectPhaseRows = (value: unknown, projectName = '') => {
  const rows = Array.isArray(value) ? value : []
  const normalized = rows.map((item, index) => {
    const record = typeof item === 'object' && item !== null && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const phaseName = asText(record.phase_name ?? record.phaseName, index === 0 ? '一期' : `第${index + 1}期`)
    return {
      phase_id: asText(record.phase_id ?? record.phaseId, index === 0 ? 'phase-default' : `phase-${index + 1}`),
      phase_name: phaseName,
      owner_name: asText(record.owner_name ?? record.ownerName, projectName ? `${projectName}${phaseName}业主方` : '项目业主方'),
      owner_contact: asText(record.owner_contact ?? record.ownerContact, ''),
      owner_phone: asText(record.owner_phone ?? record.ownerPhone, ''),
    }
  }).filter(item => item.phase_name || item.owner_name)
  return normalized.length ? normalized : [defaultProjectPhase(projectName)]
}

const serializeProjectPhases = (value: unknown, projectName = '') =>
  JSON.stringify(asProjectPhaseRows(value, projectName))

const parseProjectPhases = (value: string) => {
  try {
    return asProjectPhaseRows(JSON.parse(value))
  } catch {
    // fall through to the old line-based draft format so unsaved edits remain recoverable.
  }
  const rows = value.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [phaseName = '', ownerName = '', ownerContact = '', ownerPhone = ''] = line.split('|').map(part => part.trim())
    const cleanPhaseName = phaseName || (index === 0 ? '一期' : `第${index + 1}期`)
    return {
      phase_id: index === 0 ? 'phase-default' : normalizePhaseId(cleanPhaseName, index),
      phase_name: cleanPhaseName,
      owner_name: ownerName || '项目业主方',
      owner_contact: ownerContact || null,
      owner_phone: ownerPhone || null,
    }
  })
  return rows.length ? rows : [defaultProjectPhase()]
}

const parseProjectPhaseState = (value: string) => {
  try {
    return asProjectPhaseRows(JSON.parse(value))
  } catch {
    return asProjectPhaseRows(parseProjectPhases(value))
  }
}

const updateProjectPhaseState = (
  value: string,
  index: number,
  key: 'phase_name' | 'owner_name' | 'owner_contact' | 'owner_phone',
  nextValue: string,
) => {
  const rows = parseProjectPhaseState(value)
  rows[index] = {...rows[index], [key]: nextValue}
  return JSON.stringify(rows)
}

const addProjectPhaseState = (value: string) => {
  const rows = parseProjectPhaseState(value)
  rows.push({
    phase_id: `phase-${rows.length + 1}`,
    phase_name: `第${rows.length + 1}期`,
    owner_name: '项目业主方',
    owner_contact: '',
    owner_phone: '',
  })
  return JSON.stringify(rows)
}

const removeProjectPhaseState = (value: string, index: number) => {
  const rows = parseProjectPhaseState(value).filter((_, rowIndex) => rowIndex !== index)
  return JSON.stringify(rows.length ? rows : [defaultProjectPhase()])
}

const normalizePhaseId = (name: string, index: number) => {
  const ascii = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii ? `phase-${ascii}` : `phase-${index + 1}`
}

const projectPhasesFor = (project?: CustomerEntity | null) =>
  asProjectPhaseRows(dataOf(project).project_phases, project?.title)

const selectedStore = (collections: CollectionState, storeId: string) =>
  collections.stores.find(store => store.entityId === storeId)

const storeProject = (collections: CollectionState, storeId: string, fallbackProjectId: string) => {
  const store = selectedStore(collections, storeId)
  const projectId = asText(dataOf(store).project_id, fallbackProjectId)
  return collections.projects.find(project => project.entityId === projectId)
}

const phaseOptionsForProject = (project?: CustomerEntity | null) =>
  projectPhasesFor(project).map(phase => ({label: `${phase.phase_name} · ${phase.owner_name}`, value: phase.phase_id}))

const defaultPhaseIdForProject = (project?: CustomerEntity | null) =>
  projectPhasesFor(project)[0]?.phase_id ?? 'phase-default'

const isSelectedOption = (value: string, optionValue: string) =>
  value.split(',').map(item => item.trim()).filter(Boolean).includes(optionValue)

const toggleSelectedOption = (value: string, optionValue: string) => {
  const selected = value.split(',').map(item => item.trim()).filter(Boolean)
  const next = selected.includes(optionValue)
    ? selected.filter(item => item !== optionValue)
    : [...selected, optionValue]
  return next.join(',')
}

const splitBusinessHours = (value: string) => {
  const [start = '', end = ''] = value.split('-').map(part => part.trim())
  return {start, end}
}

const mergeBusinessHours = (value: string, patch: Partial<{start: string; end: string}>) => {
  const current = splitBusinessHours(value)
  return `${patch.start ?? current.start}-${patch.end ?? current.end}`
}

const jsonText = (value: unknown) => JSON.stringify(value, null, 2)

const defaultVariantRows = () => jsonText([
  {variant_id: 'default', variant_name: '标准', price_delta: 0, is_default: true},
])

const defaultModifierGroups = () => jsonText([
  {group_id: 'temperature', group_name: '温度', min_selections: 1, max_selections: 1, options: [
    {option_id: 'hot', option_name: '热', price_delta: 0},
    {option_id: 'ice', option_name: '冰', price_delta: 0},
  ]},
])

const defaultProductionProfile = (categoryCodes: string[] = []) => jsonText({
  workstation_type: 'PRODUCTION',
  production_categories: categoryCodes.length ? categoryCodes : ['HOT_DISH'],
  estimated_duration_seconds: 600,
  complexity_level: 'STANDARD',
  route_hint: '按出品品类分配到工作站',
})

const defaultProductionSteps = () => jsonText([
  {step_id: 'prepare', step_name: '备料', workstation_type: 'PRODUCTION', estimated_duration_seconds: 180, sort_order: 10},
  {step_id: 'finish', step_name: '出品', workstation_type: 'PACKING', estimated_duration_seconds: 120, sort_order: 20},
])

const defaultComboGroups = () => jsonText([
  {group_id: 'main', group_name: '主商品', min_selections: 1, max_selections: 1, products: []},
])

const defaultMenuSections = (name = '招牌菜品') => jsonText([
  {section_id: 'section-main', section_name: name, display_order: 10, products: []},
])

const defaultOperatingHours = () => jsonText([
  {weekday: 1, start: '10:00', end: '22:00'},
  {weekday: 2, start: '10:00', end: '22:00'},
  {weekday: 3, start: '10:00', end: '22:00'},
  {weekday: 4, start: '10:00', end: '22:00'},
  {weekday: 5, start: '10:00', end: '22:00'},
  {weekday: 6, start: '10:00', end: '22:30'},
  {weekday: 7, start: '10:00', end: '22:30'},
])

const defaultExtraChargeRules = () => jsonText([
  {rule_id: 'service-fee', rule_name: '堂食服务费', channel_type: 'DINE_IN', fee_type: 'PERCENTAGE', fee_value: 0},
])

const defaultTimeSlot = () => jsonText({start: '10:00', end: '22:00'})

const defaultRuleConfig = (ruleType = 'MANUAL') => jsonText({
  rule_type: ruleType,
  description: '后台维护的可售主数据规则',
})

const defaultIngredientConsumption = () => jsonText([])

export function EntityFormModal(props: {
  mode: 'create' | 'edit'
  page: PageKey
  item: CustomerEntity | null
  collections: CollectionState
  selectedPlatformId: string
  selectedStoreId: string
  selectedProjectId: string
  selectedBrandId: string
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
}) {
  const fields = formFieldsFor(props.page, props.collections, props.selectedPlatformId, props.selectedStoreId, props.selectedProjectId, props.selectedBrandId, props.mode, props.item)
  const [values, setValues] = useState<Record<string, string>>(() => createInitialValues(fields, props.mode === 'edit' ? props.item : null))
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const visibleFields = fields.map(field => {
    if (props.page !== 'contracts' || props.mode !== 'create') return field
    const store = selectedStore(props.collections, values.storeId) ?? selectedStore(props.collections, props.selectedStoreId)
    const project = storeProject(props.collections, store?.entityId ?? values.storeId, props.selectedProjectId)
    if (field.name === 'lessorProjectId') {
      return {
        ...field,
        readonly: true,
        defaultValue: project?.entityId ?? props.selectedProjectId,
        options: project ? [{label: project.title, value: project.entityId}] : field.options,
      }
    }
    if (field.name === 'lessorPhaseId') {
      return {
        ...field,
        options: phaseOptionsForProject(project),
        defaultValue: defaultPhaseIdForProject(project),
      }
    }
    if (field.name === 'entityId') {
      const tenantId = values.tenantId ?? field.defaultValue ?? ''
      const entityOptions = props.collections.businessEntities
        .filter(entity => dataOf(entity).tenant_id === tenantId)
        .map(entity => ({label: entity.title, value: entity.entityId}))
      return {
        ...field,
        options: entityOptions.length ? entityOptions : field.options,
        defaultValue: entityOptions[0]?.value ?? tenantId,
      }
    }
    return field
  })
  const visibleValues = props.page === 'contracts' && props.mode === 'create'
    ? Object.fromEntries(visibleFields.map(field => [field.name, values[field.name] ?? field.defaultValue ?? '']))
    : values
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedValues = {...values}
    visibleFields.forEach(field => {
      if (normalizedValues[field.name] === undefined && field.defaultValue !== undefined) {
        normalizedValues[field.name] = field.defaultValue
      }
    })
    void props.onSubmit(normalizedValues)
  }
  const uploadAsset = async (field: FieldDef, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingField(field.name)
    try {
      const asset = await api.uploadCustomerAsset({
        kind: field.assetKind ?? 'product-image',
        file,
      })
      setValues(prev => ({...prev, [field.name]: asset.url}))
    } finally {
      setUploadingField(null)
      event.target.value = ''
    }
  }
  const updateFieldValue = (field: FieldDef, value: string) => {
    if (props.page === 'contracts' && props.mode === 'create' && field.name === 'storeId') {
      const project = storeProject(props.collections, value, props.selectedProjectId)
      setValues(prev => ({
        ...prev,
        storeId: value,
        lessorProjectId: project?.entityId ?? prev.lessorProjectId ?? props.selectedProjectId,
        lessorPhaseId: defaultPhaseIdForProject(project),
      }))
      return
    }
    if (props.page === 'contracts' && props.mode === 'create' && field.name === 'tenantId') {
      const entity = props.collections.businessEntities.find(item => dataOf(item).tenant_id === value)
      setValues(prev => ({
        ...prev,
        tenantId: value,
        entityId: entity?.entityId ?? value,
      }))
      return
    }
    setValues(prev => ({...prev, [field.name]: value}))
  }
  return (
    <Modal title={props.mode === 'create' ? pageMeta[props.page].createLabel ?? '新建记录' : `编辑${pageMeta[props.page].title}`} subtitle={props.mode === 'create' ? pageMeta[props.page].scope : `记录编号：${props.item?.entityId ?? '--'}`} onClose={props.onClose} wide>
      <form className="customer-v3-form" onSubmit={submit}>
        {visibleFields.map(field => {
          const currentValue = visibleValues[field.name] ?? ''
          const fieldLabel = (
            <span className="customer-v3-field-label">
              <span>{field.label}{field.required ? ' *' : ''}</span>
              {field.helper ? <small>{field.helper}</small> : null}
            </span>
          )
          if (field.type === 'asset') {
            const hasAsset = Boolean(currentValue.trim())
            return (
              <div key={field.name} className="customer-v3-field wide">
                {fieldLabel}
                <div className="customer-v3-asset-field">
                  <div className="customer-v3-asset-preview">
                    {hasAsset ? <img src={currentValue} alt={field.label} /> : <span>未上传</span>}
                  </div>
                  <div className="customer-v3-asset-copy">
                    <strong>{hasAsset ? '已上传图片' : '暂未上传图片'}</strong>
                    <small>{hasAsset ? '保存后将在列表、详情和菜单中展示。' : '建议上传清晰的正方形或横版图片。'}</small>
                  </div>
                  <div className="customer-v3-asset-actions">
                    <label className="customer-v3-upload-button">
                      <input type="file" accept="image/*" disabled={field.readonly || uploadingField === field.name} onChange={event => void uploadAsset(field, event)} />
                      {uploadingField === field.name ? '上传中' : hasAsset ? '更换图片' : '上传图片'}
                    </label>
                    {hasAsset && !field.readonly ? (
                      <button type="button" onClick={() => setValues(prev => ({...prev, [field.name]: ''}))}>清除</button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          }
          if (field.type === 'multi-select') {
            return (
              <fieldset key={field.name} className="customer-v3-field customer-v3-checkbox-field wide">
                {fieldLabel}
                <div className="customer-v3-checkbox-grid">
                  {field.options?.map(option => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        checked={isSelectedOption(currentValue, option.value)}
                        disabled={field.readonly}
                        onChange={() => setValues(prev => ({...prev, [field.name]: toggleSelectedOption(prev[field.name] ?? '', option.value)}))}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          }
          if (field.type === 'time') {
            const parts = splitBusinessHours(currentValue)
            return (
              <div key={field.name} className="customer-v3-field customer-v3-time-range-field">
                {fieldLabel}
                <div className="customer-v3-time-range">
                  <input type="time" value={parts.start} disabled={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: mergeBusinessHours(prev[field.name] ?? '', {start: event.target.value})}))} />
                  <span>至</span>
                  <input type="time" value={parts.end} disabled={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: mergeBusinessHours(prev[field.name] ?? '', {end: event.target.value})}))} />
                </div>
              </div>
            )
          }
          if (field.type === 'project-phases') {
            const phaseRows = parseProjectPhaseState(currentValue)
            return (
              <div key={field.name} className="customer-v3-field customer-v3-project-phases-field wide">
                {fieldLabel}
                <div className="customer-v3-project-phase-list">
                  {phaseRows.map((phase, index) => (
                    <div key={`${phase.phase_id}-${index}`} className="customer-v3-project-phase-row">
                      <label>
                        <span>分期</span>
                        <input value={phase.phase_name} readOnly={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: updateProjectPhaseState(prev[field.name] ?? '', index, 'phase_name', event.target.value)}))} />
                      </label>
                      <label>
                        <span>业主方</span>
                        <input value={phase.owner_name} readOnly={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: updateProjectPhaseState(prev[field.name] ?? '', index, 'owner_name', event.target.value)}))} />
                      </label>
                      <label>
                        <span>联系人</span>
                        <input value={phase.owner_contact ?? ''} readOnly={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: updateProjectPhaseState(prev[field.name] ?? '', index, 'owner_contact', event.target.value)}))} />
                      </label>
                      <label>
                        <span>联系电话</span>
                        <input value={phase.owner_phone ?? ''} readOnly={field.readonly} onChange={event => setValues(prev => ({...prev, [field.name]: updateProjectPhaseState(prev[field.name] ?? '', index, 'owner_phone', event.target.value)}))} />
                      </label>
                      {!field.readonly && phaseRows.length > 1 ? (
                        <button type="button" onClick={() => setValues(prev => ({...prev, [field.name]: removeProjectPhaseState(prev[field.name] ?? '', index)}))}>删除</button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {!field.readonly ? <button className="customer-v3-inline-add" type="button" onClick={() => setValues(prev => ({...prev, [field.name]: addProjectPhaseState(prev[field.name] ?? '')}))}>添加分期</button> : null}
                <small>合同会从这里选择甲方项目分期和对应业主方。</small>
              </div>
            )
          }
          return (
            <label key={field.name} className={field.type === 'textarea' || field.type === 'json' || field.type === 'option-list' ? 'wide' : ''}>
              {fieldLabel}
              {field.type === 'select' ? (
              <select value={currentValue} disabled={field.readonly} onChange={event => updateFieldValue(field, event.target.value)}>
                {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : field.type === 'textarea' || field.type === 'json' || field.type === 'option-list' ? (
              <textarea value={currentValue} readOnly={field.readonly} rows={field.type === 'json' || field.type === 'option-list' ? 8 : 3} onChange={event => updateFieldValue(field, event.target.value)} />
            ) : (
              <input type={field.type ?? 'text'} value={currentValue} readOnly={field.readonly} onChange={event => updateFieldValue(field, event.target.value)} />
            )}
            </label>
          )
        })}
        <footer>
          <button type="button" onClick={props.onClose}>取消</button>
          <button type="submit">{props.mode === 'create' ? '创建' : '保存'}</button>
        </footer>
      </form>
    </Modal>
  )
}

function formFieldsFor(page: PageKey, collections: CollectionState, platformId: string, storeId: string, projectId: string, brandId: string, mode: 'create' | 'edit', item?: CustomerEntity | null): FieldDef[] {
  const option = (items: CustomerEntity[]) => items.map(item => ({label: item.title, value: item.entityId}))
  const platformMatches = (item: CustomerEntity) => !platformId || dataOf(item).platform_id === platformId || item.naturalScopeKey === platformId
  const selectedPlatform = collections.platforms.find(platform => platform.entityId === platformId)
  const platformProjects = collections.projects.filter(platformMatches)
  const platformBrands = collections.brands.filter(platformMatches)
  const platformTenants = collections.tenants.filter(platformMatches)
  const projectStores = collections.stores.filter(store => !projectId || dataOf(store).project_id === projectId)
  const storeOptions = option(projectStores.length ? projectStores : collections.stores)
  const brandOptions = option(platformBrands.length ? platformBrands : collections.brands)
  const projectOptions = option(platformProjects.length ? platformProjects : collections.projects)
  const tenantOptions = option(platformTenants.length ? platformTenants : collections.tenants)
  const productOptions = option(collections.products)
  const itemData = dataOf(item)
  const contractStoreId = page === 'contracts'
    ? asText(itemData.store_id, storeId)
    : storeId
  const contractStore = selectedStore(collections, contractStoreId) ?? projectStores[0] ?? collections.stores[0]
  const contractProject = page === 'contracts' && asText(itemData.lessor_project_id ?? itemData.project_id, '')
    ? collections.projects.find(project => project.entityId === asText(itemData.lessor_project_id ?? itemData.project_id, ''))
    : storeProject(collections, contractStore?.entityId ?? storeId, projectId)
  const contractPhaseOptions = phaseOptionsForProject(contractProject)
  const defaultContractTenantId = asText(dataOf(contractStore).tenant_id, tenantOptions[0]?.value ?? '')
  const defaultContractBrandId = asText(dataOf(contractStore).brand_id, brandOptions[0]?.value ?? '')
  const commonStatus: FieldDef = {name: 'status', label: '状态', type: 'select', options: metadataOptions.commonStatuses}
  const projectTypeOptions = platformMetadataOptions(selectedPlatform, 'project_business_modes')
  const regionOptions = mergeExistingProjectRegions(platformMetadataOptions(selectedPlatform, 'regions'), platformProjects)
  const storeTypeOptions = platformMetadataOptions(selectedPlatform, 'store_cooperation_modes')
  const storeScenarioOptions = platformMetadataOptions(selectedPlatform, 'store_business_scenarios')
  const brandCategoryOptions = platformMetadataOptions(selectedPlatform, 'brand_categories')
  const productTypeOptions = platformMetadataOptions(selectedPlatform, 'product_types')
  const productCategoryTemplateOptions = platformMetadataOptions(selectedPlatform, 'product_categories')
  const tableAreaOptions = platformMetadataOptions(selectedPlatform, 'table_areas')
  const tableTypeOptions = platformMetadataOptions(selectedPlatform, 'table_types')
  const workstationTypeOptions = platformMetadataOptions(selectedPlatform, 'workstation_types')
  const productionCategoryOptions = platformMetadataOptions(selectedPlatform, 'production_categories')
  const priceTypeOptions = platformMetadataOptions(selectedPlatform, 'price_types')
  const channelOptions = platformMetadataOptions(selectedPlatform, 'channel_types')
  const discountOptions = platformMetadataOptions(selectedPlatform, 'discount_types')
  const memberTierOptions = platformMetadataOptions(selectedPlatform, 'member_tiers')
  const availabilityRuleTypeOptions = platformMetadataOptions(selectedPlatform, 'availability_rule_types')
  const productCategoryOptions = collections.productCategories
    .filter(category => {
      const data = dataOf(category)
      const scope = asText(data.ownership_scope, 'BRAND')
      if (scope === 'STORE') return !storeId || data.store_id === storeId || data.owner_id === storeId
      return !brandId || data.brand_id === brandId || data.owner_id === brandId
    })
    .map(category => ({label: category.title, value: category.entityId}))
  const platformBusinessEntities = collections.businessEntities.filter(entity => platformTenants.some(tenant => tenant.entityId === dataOf(entity).tenant_id))
  const businessEntityOptions = option(platformBusinessEntities.length ? platformBusinessEntities : collections.businessEntities)
  const yesNoOptions = metadataOptions.yesNo
  const scopeOptions = metadataOptions.scopeTypes
  const reviewOptions = metadataOptions.reviewStatuses
  const isvStatusOptions = metadataOptions.isvStatuses
  const settlementCycleOptions = [
    {label: '月结', value: 'MONTHLY'},
    {label: '季度结', value: 'QUARTERLY'},
    {label: '半月结', value: 'BI_MONTHLY'},
    {label: '现结', value: 'ON_DEMAND'},
  ]
  if (mode === 'edit') {
    const editFields: Partial<Record<PageKey, FieldDef[]>> = {
      platforms: [{name: 'platform_code', label: '平台编码', readonly: true, helper: '创建后不可修改'}, {name: 'platform_name', label: '平台名称', required: true}, {name: 'description', label: '描述', type: 'textarea'}, {name: 'contact_name', label: '联系人'}, {name: 'contact_phone', label: '联系电话'}, {name: 'isv_config.provider_type', label: 'ISV 接入方'}, {name: 'isv_config.channel_status', label: 'ISV 状态', type: 'select', options: isvStatusOptions}, {name: 'isv_config.token_expire_at', label: 'Token 到期时间'}, {name: 'isv_config.app_key_masked', label: 'App Key', readonly: true, helper: '仅展示掩码'}, {name: 'isv_config.isv_token_masked', label: 'ISV Token', readonly: true, helper: '仅展示掩码'}, commonStatus],
      projects: [{name: 'project_code', label: '项目编码', readonly: true, helper: '创建后不可修改'}, {name: 'project_name', label: '项目名称', required: true}, {name: 'region.region_code', label: '所属大区', type: 'select', options: regionOptions}, {name: 'address', label: '项目地址'}, {name: 'business_mode', label: '项目业态', type: 'select', options: projectTypeOptions}, {name: 'project_phases', label: '分期与业主方', type: 'project-phases'}, commonStatus],
      tenants: [{name: 'tenant_code', label: '租户编码', readonly: true, helper: '创建后不可修改'}, {name: 'tenant_name', label: '租户名称', required: true}, {name: 'company_name', label: '公司名称'}, {name: 'tenant_type', label: '租户类型', type: 'select', options: platformMetadataOptions(selectedPlatform, 'tenant_types')}, {name: 'business_model', label: '经营模式', type: 'select', options: platformMetadataOptions(selectedPlatform, 'tenant_business_models')}, {name: 'social_credit_code', label: '统一社会信用代码', readonly: true, helper: '如需变更请走审批'}, {name: 'legal_representative', label: '法定代表人'}, {name: 'contact_name', label: '联系人'}, {name: 'contact_phone', label: '联系电话'}, {name: 'contact_email', label: '联系邮箱'}, {name: 'invoice_title', label: '发票抬头'}, {name: 'settlement_cycle', label: '结算周期', type: 'select', options: settlementCycleOptions}, {name: 'billing_email', label: '账单邮箱'}, commonStatus],
      brands: [{name: 'brand_code', label: '品牌编码', readonly: true, helper: '创建后不可修改'}, {name: 'brand_name', label: '品牌名称', required: true}, {name: 'brand_name_en', label: '英文名称'}, {name: 'brand_category', label: '品牌品类', type: 'select', options: brandCategoryOptions}, {name: 'brand_logo_url', label: '品牌图标', type: 'asset', assetKind: 'brand-logo', helper: '用于品牌列表和门店识别'}, {name: 'brand_description', label: '品牌说明', type: 'textarea'}, {name: 'standard_menu_enabled', label: '启用标准菜单', type: 'select', options: yesNoOptions}, {name: 'standard_pricing_locked', label: '锁定标准价格', type: 'select', options: yesNoOptions}, {name: 'erp_integration_enabled', label: 'ERP 对接', type: 'select', options: yesNoOptions}, {name: 'erp_api_endpoint', label: 'ERP 接口地址'}, commonStatus],
      contracts: [{name: 'contract_code', label: '合同编号', readonly: true, helper: '创建后不可修改'}, {name: 'lessor_project_name', label: '甲方项目', readonly: true, helper: '合同创建时快照'}, {name: 'lessor_phase_name', label: '甲方分期', readonly: true, helper: '合同创建时快照'}, {name: 'lessor_owner_name', label: '甲方业主方', readonly: true, helper: '合同创建时快照'}, {name: 'lessee_store_name', label: '乙方门店', readonly: true}, {name: 'lessee_tenant_name', label: '乙方租户', readonly: true}, {name: 'lessee_brand_name', label: '乙方品牌', readonly: true}, {name: 'start_date', label: '开始日期', type: 'date'}, {name: 'end_date', label: '到期日期', type: 'date'}, {name: 'commission_type', label: '计费模式'}, {name: 'commission_rate', label: '扣点/费率', type: 'number'}, {name: 'deposit_amount', label: '保证金', type: 'number'}, commonStatus],
      stores: [{name: 'store_code', label: '门店编码', readonly: true, helper: '创建后不可修改'}, {name: 'store_name', label: '门店名称', required: true}, {name: 'project_id', label: '所属项目', type: 'select', options: projectOptions, readonly: true}, {name: 'unit_code', label: '铺位编码'}, {name: 'floor', label: '楼层'}, {name: 'area_sqm', label: '面积', type: 'number'}, {name: 'store_type', label: '合作模式', type: 'select', options: storeTypeOptions}, {name: 'store_formats', label: '经营场景配置', type: 'multi-select', options: storeScenarioOptions, helper: '来自集团业务字典，可多选'}, {name: 'business_hours', label: '营业时间', type: 'time'}, {name: 'operating_status', label: '营业状态', type: 'select', options: metadataOptions.storeOperatingStatuses}, {name: 'tenant_id', label: '当前租户', type: 'select', options: tenantOptions, readonly: true, helper: '由合同生效写入'}, {name: 'brand_id', label: '当前品牌', type: 'select', options: brandOptions, readonly: true, helper: '由合同生效写入'}, commonStatus],
      businessEntities: [{name: 'entity_code', label: '主体编码', readonly: true, helper: '创建后不可修改'}, {name: 'entity_name', label: '主体名称', required: true}, {name: 'tenant_id', label: '所属租户', type: 'select', options: tenantOptions, readonly: true}, {name: 'company_name', label: '公司名称'}, {name: 'entity_type', label: '主体类型', type: 'select', options: metadataOptions.entityTypes}, {name: 'unified_social_credit_code', label: '统一社会信用代码', readonly: true, helper: '如需变更请走审批'}, {name: 'legal_representative', label: '法定代表人'}, {name: 'taxpayer_type', label: '纳税人类型', type: 'select', options: metadataOptions.taxpayerTypes}, {name: 'tax_rate', label: '税率', type: 'number'}, {name: 'bank_name', label: '开户银行'}, {name: 'bank_account_name', label: '银行户名'}, {name: 'bank_account_no_masked', label: '银行账号', readonly: true, helper: '仅展示掩码'}, {name: 'bank_branch', label: '开户支行'}, {name: 'settlement_cycle', label: '结算周期', type: 'select', options: settlementCycleOptions}, {name: 'settlement_day', label: '结算日', type: 'number'}, {name: 'auto_settlement_enabled', label: '自动结算', type: 'select', options: yesNoOptions}, commonStatus],
      tables: [{name: 'store_id', label: '所属门店', type: 'select', options: storeOptions, readonly: true}, {name: 'table_no', label: '桌台号', readonly: true}, {name: 'table_name', label: '桌台名称'}, {name: 'area', label: '桌台区域', type: 'select', options: tableAreaOptions}, {name: 'table_type', label: '桌台类型', type: 'select', options: tableTypeOptions}, {name: 'capacity', label: '座位数', type: 'number'}, {name: 'reservable', label: '可预订配置', type: 'select', options: yesNoOptions, helper: '仅维护是否支持预订，不维护预订流程'}, {name: 'consumer_description', label: '消费者展示说明', type: 'textarea'}, {name: 'minimum_spend', label: '最低消费', type: 'number'}, {name: 'sort_order', label: '展示排序', type: 'number'}, {name: 'table_status', label: '主数据状态', type: 'select', options: metadataOptions.tableStatuses}],
      workstations: [{name: 'store_id', label: '所属门店', type: 'select', options: storeOptions, readonly: true}, {name: 'workstation_code', label: '工作站编码', readonly: true}, {name: 'workstation_name', label: '工作站名称'}, {name: 'workstation_type', label: '工作站类型', type: 'select', options: workstationTypeOptions}, {name: 'responsible_categories', label: '负责出品品类', type: 'multi-select', options: productionCategoryOptions, helper: '来自集团业务字典，可多选；仅定义路由能力，不承载出品任务队列'}, {name: 'description', label: '说明', type: 'textarea'}, commonStatus],
      permissions: [{name: 'permission_code', label: '权限编码', readonly: true, helper: '创建后不可修改'}, {name: 'permission_name', label: '权限名称'}, {name: 'permission_type', label: '权限类型', type: 'select', options: metadataOptions.permissionTypes}, commonStatus],
      roles: [{name: 'role_code', label: '角色编码', readonly: true, helper: '创建后不可修改'}, {name: 'role_name', label: '角色名称'}, {name: 'role_type', label: '角色来源', type: 'select', options: metadataOptions.roleTypes}, {name: 'scope_type', label: '授权范围', type: 'select', options: scopeOptions}, {name: 'permission_ids', label: '权限集合', type: 'json', helper: '也可用“权限”按钮维护'}, commonStatus],
      users: [{name: 'user_code', label: '用户编码', readonly: true, helper: '创建后不可修改'}, {name: 'display_name', label: '姓名'}, {name: 'mobile', label: '手机号'}, {name: 'store_id', label: '所属门店', type: 'select', options: storeOptions}, commonStatus],
      productCategories: [{name: 'category_code', label: '分类编码', readonly: true, helper: '创建后不可修改'}, {name: 'category_name', label: '分类名称'}, {name: 'ownership_scope', label: '归属范围', type: 'select', options: metadataOptions.ownershipScopes, readonly: true}, {name: 'brand_id', label: '归属品牌', type: 'select', options: brandOptions, readonly: true}, {name: 'store_id', label: '归属门店', type: 'select', options: storeOptions, readonly: true}, {name: 'parent_category_id', label: '上级分类', type: 'select', options: [{label: '无上级分类', value: ''}, ...option(collections.productCategories)]}, {name: 'sort_order', label: '排序', type: 'number'}, commonStatus],
      products: [{name: 'product_code', label: '商品编码', readonly: true, helper: '创建后不可修改'}, {name: 'product_name', label: '商品名称'}, {name: 'ownership_scope', label: '归属范围', type: 'select', options: metadataOptions.ownershipScopes, readonly: true}, {name: 'brand_id', label: '品牌', type: 'select', options: brandOptions, readonly: true}, {name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'category_id', label: '商品分类', type: 'select', options: [{label: '未分类', value: ''}, ...productCategoryOptions]}, {name: 'product_type', label: '商品类型', type: 'select', options: productTypeOptions}, {name: 'image_url', label: '商品图片', type: 'asset', assetKind: 'product-image', helper: '用于商品列表和菜单展示'}, {name: 'product_description', label: '商品说明', type: 'textarea'}, {name: 'base_price', label: '基础价格', type: 'number'}, {name: 'variants', label: '规格变体', type: 'json'}, {name: 'modifier_groups', label: '加料组', type: 'json'}, {name: 'production_profile', label: '出品路由画像', type: 'json', helper: '主数据：供履约域读取，不在此执行生产'}, {name: 'production_steps', label: '出品步骤配置', type: 'json'}, {name: 'combo_item_groups', label: '套餐组成', type: 'json'}, {name: 'combo_items', label: '套餐固定商品', type: 'json'}, commonStatus],
      brandMenus: [{name: 'brand_id', label: '品牌', type: 'select', options: brandOptions, readonly: true}, {name: 'menu_name', label: '菜单名称'}, {name: 'channel_type', label: '售卖渠道', type: 'select', options: channelOptions}, {name: 'effective_from', label: '生效日期', type: 'date'}, {name: 'effective_to', label: '失效日期', type: 'date'}, {name: 'review_status', label: '审核状态', type: 'select', options: reviewOptions}, {name: 'sections', label: '分区与商品', type: 'json'}, commonStatus],
      storeMenus: [{name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'menu_name', label: '菜单名称'}, {name: 'brand_menu_id', label: '来源品牌菜单', type: 'select', options: [{label: '不继承品牌菜单', value: ''}, ...option(collections.brandMenus)]}, {name: 'channel_type', label: '售卖渠道', type: 'select', options: channelOptions}, {name: 'menu_type', label: '菜单类型', type: 'select', options: metadataOptions.menuTypes}, {name: 'inherit_mode', label: '继承方式', type: 'select', options: metadataOptions.inheritModes}, {name: 'effective_from', label: '生效日期', type: 'date'}, {name: 'effective_to', label: '失效日期', type: 'date'}, {name: 'sections', label: '分区与商品', type: 'json'}, {name: 'version_hash', label: '版本哈希', readonly: true, helper: '系统生成'}, commonStatus],
      storeConfig: [{name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'business_status', label: '营业状态配置', type: 'select', options: metadataOptions.storeBusinessStatuses}, {name: 'accept_order', label: '渠道入口策略', type: 'select', options: yesNoOptions, helper: '交易前置配置，不在此处理订单'}, {name: 'auto_accept_enabled', label: '入口自动确认策略', type: 'select', options: yesNoOptions}, {name: 'accept_timeout_seconds', label: '入口确认等待（秒）', type: 'number'}, {name: 'preparation_buffer_minutes', label: '备餐缓冲配置（分钟）', type: 'number'}, {name: 'max_concurrent_orders', label: '渠道入口容量上限', type: 'number'}, {name: 'operating_hours', label: '营业时间', type: 'json'}, {name: 'special_operating_days', label: '特殊营业日', type: 'json'}, {name: 'channel_operating_hours', label: '渠道营业时间', type: 'json'}, {name: 'auto_open_close_enabled', label: '自动营业状态策略', type: 'select', options: yesNoOptions}, {name: 'extra_charge_rules', label: '附加费用规则', type: 'json'}, {name: 'refund_stock_policy', label: '退款返库存配置'}],
      stock: [{name: 'stock_id', label: '库存记录', readonly: true}, {name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'product_id', label: '商品', type: 'select', options: productOptions, readonly: true}, {name: 'stock_type', label: '库存类型', type: 'select', options: metadataOptions.stockTypes}, {name: 'stock_granularity', label: '库存口径', type: 'select', options: metadataOptions.stockGranularities}, {name: 'stock_date', label: '库存日期', type: 'date'}, {name: 'period_id', label: '时段编号'}, {name: 'total_quantity', label: '总量', type: 'number'}, {name: 'sold_quantity', label: '已售汇总', type: 'number'}, {name: 'reserved_quantity', label: '下游占用汇总', type: 'number', helper: '主数据汇总计数，不维护库存占用流程'}, {name: 'saleable_quantity', label: '可售数量', type: 'number'}, {name: 'safety_stock', label: '安全库存', type: 'number'}, {name: 'sold_out_threshold', label: '售罄阈值', type: 'number'}, {name: 'reservation_ttl_seconds', label: '占用汇总保留口径（秒）', type: 'number'}, {name: 'reset_policy', label: '重置策略', type: 'select', options: metadataOptions.resetPolicies}, {name: 'ingredient_consumption', label: '原料消耗规则', type: 'json'}, commonStatus],
      availabilityRules: [{name: 'rule_code', label: '规则编码', readonly: true, helper: '创建后不可修改'}, {name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'product_id', label: '适用商品', type: 'select', options: [{label: '全部商品', value: ''}, ...productOptions]}, {name: 'rule_type', label: '规则类型', type: 'select', options: availabilityRuleTypeOptions}, {name: 'channel_type', label: '售卖渠道', type: 'select', options: channelOptions}, {name: 'time_slot', label: '适用时段', type: 'json'}, {name: 'daily_quota', label: '每日限量', type: 'number'}, {name: 'priority', label: '优先级', type: 'number'}, {name: 'enabled', label: '是否启用', type: 'select', options: yesNoOptions}, {name: 'available', label: '是否可售', type: 'select', options: yesNoOptions}, {name: 'rule_config', label: '规则配置', type: 'json'}, commonStatus],
      availability: [{name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'product_id', label: '商品', type: 'select', options: productOptions, readonly: true}, {name: 'available', label: '可售状态', type: 'select', options: metadataOptions.availability}, {name: 'sold_out_reason', label: '不可售原因'}, {name: 'effective_from', label: '生效时间'}],
      priceRules: [{name: 'rule_code', label: '规则编码', readonly: true, helper: '创建后不可修改'}, {name: 'rule_name', label: '规则名称'}, {name: 'product_id', label: '指定商品', type: 'select', options: [{label: '全部适用商品', value: ''}, ...productOptions]}, {name: 'store_id', label: '门店', type: 'select', options: storeOptions, readonly: true}, {name: 'price_type', label: '价格类型', type: 'select', options: priceTypeOptions}, {name: 'channel_type', label: '渠道类型', type: 'select', options: channelOptions}, {name: 'price_value', label: '价格值', type: 'number'}, {name: 'price_delta', label: '调价金额', type: 'number'}, {name: 'time_slot', label: '时间段', type: 'json'}, {name: 'member_tier', label: '会员等级', type: 'select', options: memberTierOptions}, {name: 'priority', label: '优先级', type: 'number'}, {name: 'discount_type', label: '优惠类型', type: 'select', options: discountOptions}, {name: 'discount_value', label: '优惠值', type: 'number'}, {name: 'applicable_product_ids', label: '适用商品', type: 'json'}, {name: 'effective_from', label: '生效时间'}, {name: 'effective_to', label: '失效时间'}, commonStatus],
    }
    return editFields[page] ?? [{name: 'title', label: '名称'}, commonStatus, {name: 'description', label: '描述', type: 'textarea'}]
  }
  const fields: Partial<Record<PageKey, FieldDef[]>> = {
    environment: [{name: 'sandboxCode', label: '沙箱编码', required: true, helper: '创建后不可修改，建议使用大写字母和下划线'}, {name: 'sandboxName', label: '沙箱名称', required: true}, {name: 'sandboxType', label: '环境类型', type: 'select', options: metadataOptions.sandboxTypes, defaultValue: 'DEBUG'}, {name: 'owner', label: '负责人'}, {name: 'description', label: '说明', type: 'textarea'}],
    platforms: [{name: 'platformCode', label: '平台编码', required: true, helper: '创建后不可修改'}, {name: 'platformName', label: '平台名称', required: true}, {name: 'description', label: '描述', type: 'textarea'}, {name: 'contactName', label: '联系人'}, {name: 'contactPhone', label: '联系电话'}, {name: 'isvProviderType', label: 'ISV 接入方', defaultValue: 'LOCAL_MOCK_ISV'}, {name: 'isvAppKey', label: 'ISV App Key'}, {name: 'isvAppSecret', label: 'ISV App Secret'}, {name: 'isvToken', label: 'ISV Token'}, {name: 'isvTokenExpireAt', label: 'Token 到期时间'}, {name: 'isvChannelStatus', label: 'ISV 状态', type: 'select', options: isvStatusOptions, defaultValue: 'ACTIVE'}],
    projects: [{name: 'projectCode', label: '项目编码', required: true, helper: '创建后不可修改'}, {name: 'projectName', label: '项目名称', required: true}, {name: 'regionCode', label: '所属大区', type: 'select', options: regionOptions, defaultValue: regionOptions[0]?.value ?? 'WEST_CHINA'}, {name: 'address', label: '项目地址'}, {name: 'businessMode', label: '项目业态', type: 'select', options: projectTypeOptions, defaultValue: projectTypeOptions[0]?.value ?? 'SHOPPING_MALL'}, {name: 'projectPhases', label: '分期与业主方', type: 'project-phases', defaultValue: serializeProjectPhases([defaultProjectPhase('新项目')])}],
    tenants: [{name: 'tenantCode', label: '租户编码', required: true, helper: '创建后不可修改'}, {name: 'tenantName', label: '租户名称', required: true}, {name: 'companyName', label: '公司名称'}, {name: 'tenantType', label: '租户类型', type: 'select', options: platformMetadataOptions(selectedPlatform, 'tenant_types'), defaultValue: platformMetadataOptions(selectedPlatform, 'tenant_types')[0]?.value ?? 'SINGLE_STORE'}, {name: 'businessModel', label: '经营模式', type: 'select', options: platformMetadataOptions(selectedPlatform, 'tenant_business_models'), defaultValue: platformMetadataOptions(selectedPlatform, 'tenant_business_models')[0]?.value ?? 'SELF_OPERATED'}, {name: 'socialCreditCode', label: '统一社会信用代码'}, {name: 'legalRepresentative', label: '法定代表人'}, {name: 'contactName', label: '联系人'}, {name: 'contactPhone', label: '联系电话'}, {name: 'contactEmail', label: '联系邮箱'}, {name: 'invoiceTitle', label: '发票抬头'}, {name: 'settlementCycle', label: '结算周期', type: 'select', options: settlementCycleOptions, defaultValue: 'MONTHLY'}, {name: 'billingEmail', label: '账单邮箱'}],
    brands: [{name: 'brandCode', label: '品牌编码', required: true, helper: '创建后不可修改'}, {name: 'brandName', label: '品牌名称', required: true}, {name: 'brandNameEn', label: '英文名称'}, {name: 'brandCategory', label: '品牌品类', type: 'select', options: brandCategoryOptions, defaultValue: brandCategoryOptions[0]?.value ?? 'OTHER'}, {name: 'brandLogoUrl', label: '品牌图标', type: 'asset', assetKind: 'brand-logo', helper: '用于品牌列表和门店识别'}, {name: 'brandDescription', label: '品牌说明', type: 'textarea'}, {name: 'standardMenuEnabled', label: '启用标准菜单', type: 'select', options: yesNoOptions, defaultValue: 'false'}, {name: 'standardPricingLocked', label: '锁定标准价格', type: 'select', options: yesNoOptions, defaultValue: 'false'}, {name: 'erpIntegrationEnabled', label: 'ERP 对接', type: 'select', options: yesNoOptions, defaultValue: 'false'}, {name: 'erpApiEndpoint', label: 'ERP 接口地址'}],
    contracts: [{name: 'storeId', label: '乙方门店', type: 'select', options: storeOptions, defaultValue: contractStore?.entityId ?? storeId}, {name: 'lessorProjectId', label: '甲方项目', type: 'select', options: projectOptions, defaultValue: contractProject?.entityId ?? projectId}, {name: 'lessorPhaseId', label: '甲方分期 / 业主方', type: 'select', options: contractPhaseOptions, defaultValue: defaultPhaseIdForProject(contractProject), helper: '保存后成为合同快照'}, {name: 'tenantId', label: '乙方租户', type: 'select', options: tenantOptions, defaultValue: defaultContractTenantId}, {name: 'brandId', label: '乙方品牌', type: 'select', options: brandOptions, defaultValue: defaultContractBrandId}, {name: 'entityId', label: '乙方签约主体', type: 'select', options: businessEntityOptions, defaultValue: businessEntityOptions.find(option => dataOf(collections.businessEntities.find(entity => entity.entityId === option.value)).tenant_id === defaultContractTenantId)?.value ?? businessEntityOptions[0]?.value ?? defaultContractTenantId, helper: '保存后成为合同签署快照'}, {name: 'contractCode', label: '合同编号', required: true, helper: '创建后不可修改'}, {name: 'contractType', label: '合同类型', defaultValue: 'OPERATING'}, {name: 'externalContractNo', label: '外部合同号'}, {name: 'startDate', label: '开始日期', type: 'date'}, {name: 'endDate', label: '到期日期', type: 'date'}, {name: 'commissionType', label: '计费模式', defaultValue: 'FIXED_RATE'}, {name: 'commissionRate', label: '扣点/费率', type: 'number'}, {name: 'depositAmount', label: '保证金', type: 'number'}, {name: 'attachmentUrl', label: '合同附件'}],
    businessEntities: [{name: 'tenantId', label: '所属租户', type: 'select', options: tenantOptions}, {name: 'entityCode', label: '主体编码', required: true, helper: '创建后不可修改'}, {name: 'entityName', label: '主体名称', required: true}, {name: 'companyName', label: '公司名称'}, {name: 'entityType', label: '主体类型', type: 'select', options: metadataOptions.entityTypes, defaultValue: 'COMPANY'}, {name: 'unifiedSocialCreditCode', label: '统一社会信用代码'}, {name: 'legalRepresentative', label: '法定代表人'}, {name: 'taxpayerType', label: '纳税人类型', type: 'select', options: metadataOptions.taxpayerTypes, defaultValue: 'GENERAL_TAXPAYER'}, {name: 'taxRate', label: '税率', type: 'number', defaultValue: '0.06'}, {name: 'bankName', label: '开户银行'}, {name: 'bankAccountName', label: '银行户名'}, {name: 'bankAccountNo', label: '银行账号'}, {name: 'bankBranch', label: '开户支行'}, {name: 'taxRegistrationNo', label: '税务登记号'}, {name: 'settlementCycle', label: '结算周期', type: 'select', options: settlementCycleOptions, defaultValue: 'MONTHLY'}, {name: 'settlementDay', label: '结算日', type: 'number', defaultValue: '5'}, {name: 'autoSettlementEnabled', label: '自动结算', type: 'select', options: yesNoOptions, defaultValue: 'false'}],
    stores: [{name: 'projectId', label: '所属项目', type: 'select', options: projectOptions, defaultValue: projectId}, {name: 'storeCode', label: '门店编码', required: true, helper: '创建后不可修改'}, {name: 'storeName', label: '门店名称', required: true}, {name: 'unitCode', label: '铺位编码', required: true}, {name: 'floor', label: '楼层'}, {name: 'areaSqm', label: '面积', type: 'number'}, {name: 'addressDetail', label: '铺位地址'}, {name: 'storeType', label: '合作模式', type: 'select', options: storeTypeOptions}, {name: 'businessFormat', label: '门店业态', type: 'select', options: platformMetadataOptions(selectedPlatform, 'store_business_formats')}, {name: 'businessScenarios', label: '经营场景', type: 'multi-select', options: storeScenarioOptions, defaultValue: 'DINE_IN,TAKEAWAY', helper: '来自集团业务字典，可多选'}, {name: 'storePhone', label: '门店电话'}, {name: 'storeManager', label: '店长'}, {name: 'managerPhone', label: '店长电话'}, {name: 'seatCount', label: '座位数', type: 'number'}, {name: 'businessHours', label: '营业时间', type: 'time', defaultValue: '10:00-22:00'}],
    tables: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'tableNo', label: '桌台号', required: true}, {name: 'tableName', label: '桌台名称'}, {name: 'area', label: '桌台区域', type: 'select', options: tableAreaOptions, defaultValue: tableAreaOptions[0]?.value ?? 'HALL'}, {name: 'tableType', label: '桌台类型', type: 'select', options: tableTypeOptions, defaultValue: tableTypeOptions[0]?.value ?? 'HALL'}, {name: 'capacity', label: '座位数', type: 'number', defaultValue: '4'}, {name: 'reservable', label: '可预订配置', type: 'select', options: yesNoOptions, defaultValue: 'false', helper: '仅维护是否支持预订，不维护预订流程'}, {name: 'consumerDescription', label: '消费者展示说明', type: 'textarea'}, {name: 'minimumSpend', label: '最低消费', type: 'number'}, {name: 'sortOrder', label: '展示排序', type: 'number', defaultValue: '100'}],
    workstations: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'workstationCode', label: '工作站编码', required: true}, {name: 'workstationName', label: '工作站名称', required: true}, {name: 'workstationType', label: '工作站类型', type: 'select', options: workstationTypeOptions, defaultValue: workstationTypeOptions[0]?.value ?? 'PRODUCTION'}, {name: 'responsibleCategories', label: '负责出品品类', type: 'multi-select', options: productionCategoryOptions, defaultValue: productionCategoryOptions[0]?.value ?? 'HOT_DISH', helper: '来自集团业务字典，可多选；仅定义路由能力，不承载出品任务队列'}, {name: 'description', label: '说明', type: 'textarea'}],
    permissions: [{name: 'permissionCode', label: '权限编码', required: true, helper: '创建后不可修改'}, {name: 'permissionName', label: '权限名称', required: true}, {name: 'permissionType', label: '权限类型', type: 'select', options: metadataOptions.permissionTypes}],
    roles: [{name: 'roleCode', label: '角色编码', required: true, helper: '创建后不可修改'}, {name: 'roleName', label: '角色名称', required: true}, {name: 'roleType', label: '角色来源', type: 'select', options: metadataOptions.roleTypes, defaultValue: 'CUSTOM'}, {name: 'scopeType', label: '授权范围', type: 'select', options: scopeOptions}, {name: 'permissionIds', label: '初始权限', type: 'json', defaultValue: '[]'}],
    users: [{name: 'userCode', label: '用户编码', required: true}, {name: 'displayName', label: '姓名', required: true}, {name: 'mobile', label: '手机号'}, {name: 'storeId', label: '所属门店', type: 'select', options: storeOptions, defaultValue: storeId}],
    roleBindings: [{name: 'userId', label: '用户', type: 'select', options: option(collections.users)}, {name: 'roleId', label: '角色', type: 'select', options: option(collections.roles)}, {name: 'scopeType', label: '授权范围', type: 'select', options: scopeOptions}, {name: 'scopeId', label: '授权对象', defaultValue: storeId}, {name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'effectiveFrom', label: '生效时间'}, {name: 'effectiveTo', label: '失效时间'}, {name: 'reason', label: '授权原因'}],
    productCategories: [{name: 'categoryCode', label: '分类编码', required: true, helper: '创建后不可修改'}, {name: 'categoryName', label: '分类名称', required: true}, {name: 'categoryTemplate', label: '分类模板', type: 'select', options: [{label: '不使用模板', value: ''}, ...productCategoryTemplateOptions]}, {name: 'ownershipScope', label: '归属范围', type: 'select', options: metadataOptions.ownershipScopes, defaultValue: 'BRAND'}, {name: 'brandId', label: '归属品牌', type: 'select', options: brandOptions, defaultValue: brandId}, {name: 'storeId', label: '归属门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'parentCategoryId', label: '上级分类', type: 'select', options: [{label: '无上级分类', value: ''}, ...option(collections.productCategories)]}, {name: 'sortOrder', label: '排序', type: 'number', defaultValue: '100'}],
    products: [{name: 'productCode', label: '商品编码', required: true, helper: '创建后不可修改'}, {name: 'productName', label: '商品名称', required: true}, {name: 'ownershipScope', label: '归属范围', type: 'select', options: metadataOptions.ownershipScopes, defaultValue: 'BRAND'}, {name: 'brandId', label: '品牌', type: 'select', options: brandOptions, defaultValue: brandId}, {name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'categoryId', label: '商品分类', type: 'select', options: [{label: '未分类', value: ''}, ...productCategoryOptions]}, {name: 'productType', label: '商品类型', type: 'select', options: productTypeOptions, defaultValue: productTypeOptions[0]?.value ?? 'SINGLE'}, {name: 'imageUrl', label: '商品图片', type: 'asset', assetKind: 'product-image', helper: '用于商品列表和菜单展示'}, {name: 'productDescription', label: '商品说明', type: 'textarea'}, {name: 'basePrice', label: '基础价格', type: 'number', defaultValue: '18'}, {name: 'variants', label: '规格变体', type: 'json', defaultValue: defaultVariantRows()}, {name: 'modifierGroups', label: '加料组', type: 'json', defaultValue: defaultModifierGroups()}, {name: 'productionProfile', label: '出品路由画像', type: 'json', defaultValue: defaultProductionProfile(productionCategoryOptions.map(option => option.value).slice(0, 1)), helper: '主数据：供履约域读取，不在此执行生产'}, {name: 'productionSteps', label: '出品步骤配置', type: 'json', defaultValue: defaultProductionSteps()}, {name: 'comboItemGroups', label: '套餐组成', type: 'json', defaultValue: defaultComboGroups()}, {name: 'comboItems', label: '套餐固定商品', type: 'json', defaultValue: '[]'}],
    brandMenus: [{name: 'brandId', label: '品牌', type: 'select', options: brandOptions, defaultValue: brandId}, {name: 'menuName', label: '菜单名称', required: true}, {name: 'channelType', label: '售卖渠道', type: 'select', options: channelOptions, defaultValue: 'ALL'}, {name: 'effectiveFrom', label: '生效日期', type: 'date'}, {name: 'effectiveTo', label: '失效日期', type: 'date'}, {name: 'reviewStatus', label: '审核状态', type: 'select', options: reviewOptions, defaultValue: 'NONE'}, {name: 'sections', label: '分区与商品', type: 'json', defaultValue: defaultMenuSections('招牌菜品')}],
    storeMenus: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'menuName', label: '菜单名称', required: true}, {name: 'brandMenuId', label: '来源品牌菜单', type: 'select', options: [{label: '不继承品牌菜单', value: ''}, ...option(collections.brandMenus)]}, {name: 'channelType', label: '售卖渠道', type: 'select', options: channelOptions, defaultValue: 'ALL'}, {name: 'menuType', label: '菜单类型', type: 'select', options: metadataOptions.menuTypes, defaultValue: 'FULL_DAY'}, {name: 'inheritMode', label: '继承方式', type: 'select', options: metadataOptions.inheritModes, defaultValue: 'PARTIAL'}, {name: 'effectiveFrom', label: '生效日期', type: 'date'}, {name: 'effectiveTo', label: '失效日期', type: 'date'}, {name: 'versionHash', label: '版本哈希', helper: '不填则系统生成'}, {name: 'sections', label: '分区与商品', type: 'json', defaultValue: defaultMenuSections('热销菜品')}],
    storeConfig: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'businessStatus', label: '营业状态配置', type: 'select', options: metadataOptions.storeBusinessStatuses, defaultValue: 'PREPARING'}, {name: 'acceptOrder', label: '渠道入口策略', type: 'select', options: yesNoOptions, defaultValue: 'true', helper: '交易前置配置，不在此处理订单'}, {name: 'autoAcceptEnabled', label: '入口自动确认策略', type: 'select', options: yesNoOptions, defaultValue: 'false'}, {name: 'acceptTimeoutSeconds', label: '入口确认等待（秒）', type: 'number', defaultValue: '120'}, {name: 'preparationBufferMinutes', label: '备餐缓冲配置（分钟）', type: 'number', defaultValue: '15'}, {name: 'maxConcurrentOrders', label: '渠道入口容量上限', type: 'number', defaultValue: '30'}, {name: 'operatingHours', label: '营业时间', type: 'json', defaultValue: defaultOperatingHours()}, {name: 'specialOperatingDays', label: '特殊营业日', type: 'json', defaultValue: '[]'}, {name: 'channelOperatingHours', label: '渠道营业时间', type: 'json', defaultValue: '[]'}, {name: 'autoOpenCloseEnabled', label: '自动营业状态策略', type: 'select', options: yesNoOptions, defaultValue: 'false'}, {name: 'extraChargeRules', label: '附加费用规则', type: 'json', defaultValue: defaultExtraChargeRules()}, {name: 'refundStockPolicy', label: '退款返库存配置', defaultValue: 'RETURN_TO_STOCK'}],
    stock: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'stockId', label: '库存记录', helper: '不填则按商品生成'}, {name: 'productId', label: '商品', type: 'select', options: productOptions}, {name: 'stockType', label: '库存类型', type: 'select', options: metadataOptions.stockTypes, defaultValue: 'TRACKED'}, {name: 'stockGranularity', label: '库存口径', type: 'select', options: metadataOptions.stockGranularities, defaultValue: 'DAILY'}, {name: 'stockDate', label: '库存日期', type: 'date'}, {name: 'periodId', label: '时段编号'}, {name: 'totalQuantity', label: '总量', type: 'number', defaultValue: '100'}, {name: 'soldQuantity', label: '已售汇总', type: 'number', defaultValue: '0'}, {name: 'reservedQuantity', label: '下游占用汇总', type: 'number', defaultValue: '0', helper: '主数据汇总计数，不维护库存占用流程'}, {name: 'saleableQuantity', label: '可售数量', type: 'number', defaultValue: '100'}, {name: 'safetyStock', label: '安全库存', type: 'number', defaultValue: '10'}, {name: 'soldOutThreshold', label: '售罄阈值', type: 'number', defaultValue: '0'}, {name: 'reservationTtlSeconds', label: '占用汇总保留口径（秒）', type: 'number', defaultValue: '900'}, {name: 'resetPolicy', label: '重置策略', type: 'select', options: metadataOptions.resetPolicies, defaultValue: 'AUTO_RESET_DAILY'}, {name: 'ingredientConsumption', label: '原料消耗规则', type: 'json', defaultValue: defaultIngredientConsumption()}],
    availability: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'productId', label: '商品', type: 'select', options: productOptions}, {name: 'available', label: '可售状态', type: 'select', options: metadataOptions.availability}, {name: 'soldOutReason', label: '不可售原因'}, {name: 'effectiveFrom', label: '生效时间'}],
    availabilityRules: [{name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'ruleCode', label: '规则编码', required: true, helper: '创建后不可修改'}, {name: 'productId', label: '适用商品', type: 'select', options: [{label: '全部商品', value: ''}, ...productOptions]}, {name: 'ruleType', label: '规则类型', type: 'select', options: availabilityRuleTypeOptions, defaultValue: 'MANUAL'}, {name: 'channelType', label: '售卖渠道', type: 'select', options: channelOptions, defaultValue: 'ALL'}, {name: 'timeSlot', label: '适用时段', type: 'json', defaultValue: defaultTimeSlot()}, {name: 'dailyQuota', label: '每日限量', type: 'number'}, {name: 'priority', label: '优先级', type: 'number', defaultValue: '100'}, {name: 'enabled', label: '是否启用', type: 'select', options: yesNoOptions, defaultValue: 'true'}, {name: 'available', label: '是否可售', type: 'select', options: yesNoOptions, defaultValue: 'true'}, {name: 'ruleConfig', label: '规则配置', type: 'json', defaultValue: defaultRuleConfig()}],
    priceRules: [{name: 'ruleCode', label: '规则编码', required: true, helper: '创建后不可修改'}, {name: 'ruleName', label: '规则名称', required: true}, {name: 'storeId', label: '门店', type: 'select', options: storeOptions, defaultValue: storeId}, {name: 'productId', label: '指定商品', type: 'select', options: [{label: '全部适用商品', value: ''}, ...productOptions]}, {name: 'priceType', label: '价格类型', type: 'select', options: priceTypeOptions, defaultValue: priceTypeOptions[0]?.value ?? 'FIXED'}, {name: 'channelType', label: '渠道类型', type: 'select', options: channelOptions, defaultValue: channelOptions[0]?.value ?? 'ALL'}, {name: 'priceValue', label: '价格值', type: 'number', defaultValue: '0'}, {name: 'priceDelta', label: '调价金额', type: 'number', defaultValue: '0'}, {name: 'timeSlot', label: '时间段', type: 'json', defaultValue: defaultTimeSlot()}, {name: 'memberTier', label: '会员等级', type: 'select', options: memberTierOptions, defaultValue: memberTierOptions[0]?.value ?? 'NONE'}, {name: 'priority', label: '优先级', type: 'number', defaultValue: '10'}, {name: 'discountType', label: '优惠类型', type: 'select', options: discountOptions, defaultValue: discountOptions[0]?.value ?? 'AMOUNT_OFF'}, {name: 'discountValue', label: '优惠值', type: 'number', defaultValue: '0'}, {name: 'applicableProductIds', label: '适用商品', type: 'json', defaultValue: '[]'}, {name: 'effectiveFrom', label: '生效时间'}, {name: 'effectiveTo', label: '失效时间'}],
  }
  return fields[page] ?? []
}

export async function createEntity(page: PageKey, rawValues: Record<string, string>, collections: CollectionState, platformId: string, storeId: string, projectId: string, brandId: string) {
  const fields = formFieldsFor(page, collections, platformId, storeId, projectId, brandId, 'create')
  const selectedPlatform = collections.platforms.find(platform => platform.entityId === platformId)
  const regionOptions = mergeExistingProjectRegions(platformMetadataOptions(selectedPlatform, 'regions'), collections.projects.filter(project => dataOf(project).platform_id === platformId))
  const values: Record<string, unknown> = buildCreatePayload(page, Object.fromEntries(fields.map(field => [field.name, parseFieldValue(field, rawValues[field.name] ?? field.defaultValue ?? '')])), regionOptions)
  if (['projects', 'tenants', 'brands', 'permissions', 'roles'].includes(page) && !values.platformId) {
    values.platformId = platformId
  }
  if (page === 'environment') return api.createSandbox(values as Parameters<typeof api.createSandbox>[0])
  if (page === 'platforms') return api.createPlatform(values as Parameters<typeof api.createPlatform>[0])
  if (page === 'projects') return api.createProject(values as Parameters<typeof api.createProject>[0])
  if (page === 'tenants') return api.createTenant(values as Parameters<typeof api.createTenant>[0])
  if (page === 'brands') return api.createBrand(values as Parameters<typeof api.createBrand>[0])
  if (page === 'contracts') return api.createContract(values as Parameters<typeof api.createContract>[0])
  if (page === 'businessEntities') return api.createBusinessEntity(values as Parameters<typeof api.createBusinessEntity>[0])
  if (page === 'stores') return api.createStore(values as Parameters<typeof api.createStore>[0])
  if (page === 'tables') return api.createTable(asText(values.storeId, storeId), values as Parameters<typeof api.createTable>[1])
  if (page === 'workstations') return api.createWorkstation(asText(values.storeId, storeId), values as Parameters<typeof api.createWorkstation>[1])
  if (page === 'permissions') return api.createPermission(values as Parameters<typeof api.createPermission>[0])
  if (page === 'roles') return api.createRole(values as Parameters<typeof api.createRole>[0])
  if (page === 'users') return api.createUser(values as Parameters<typeof api.createUser>[0])
  if (page === 'roleBindings') return api.createUserRoleBinding(values as Parameters<typeof api.createUserRoleBinding>[0])
  if (page === 'productCategories') return api.createProductCategory(normalizeProductCategoryPayload(values) as Parameters<typeof api.createProductCategory>[0])
  if (page === 'products') return api.createProduct(normalizeProductPayload(values) as Parameters<typeof api.createProduct>[0])
  if (page === 'brandMenus') return api.createBrandMenu(values as Parameters<typeof api.createBrandMenu>[0])
  if (page === 'storeMenus') return api.createStoreMenu(values as Parameters<typeof api.createStoreMenu>[0])
  if (page === 'storeConfig') return api.updateStoreConfig(asText(values.storeId, storeId), values as Parameters<typeof api.updateStoreConfig>[1])
  if (page === 'stock') return api.updateInventory(asText(values.storeId, storeId), asText(values.productId), values as Parameters<typeof api.updateInventory>[2])
  if (page === 'availability') return api.updateMenuAvailability(asText(values.storeId, storeId), asText(values.productId), values as Parameters<typeof api.updateMenuAvailability>[2])
  if (page === 'availabilityRules') return api.createAvailabilityRule(asText(values.storeId, storeId), values as Parameters<typeof api.createAvailabilityRule>[1])
  if (page === 'priceRules') return api.createPriceRule(values as Parameters<typeof api.createPriceRule>[0])
  throw new Error('当前页面不支持创建')
}

function normalizeProductPayload(values: Record<string, unknown>) {
  const ownershipScope = asText(values.ownershipScope, 'BRAND')
  const next: Record<string, unknown> = {...values, ownershipScope}
  if (ownershipScope === 'STORE') {
    delete next.brandId
  } else {
    delete next.storeId
  }
  return next
}

function normalizeProductCategoryPayload(values: Record<string, unknown>) {
  const ownershipScope = asText(values.ownershipScope, 'BRAND')
  const next: Record<string, unknown> = {...values, ownershipScope}
  delete next.categoryTemplate
  if (ownershipScope === 'STORE') {
    delete next.brandId
  } else {
    delete next.storeId
  }
  return next
}

export async function updateEntity(page: PageKey, item: CustomerEntity, rawValues: Record<string, string>, collections: CollectionState, platformId: string, storeId: string, projectId: string, brandId: string) {
  const fields = formFieldsFor(page, collections, platformId, storeId, projectId, brandId, 'edit', item)
  const data = {...dataOf(item)}
  fields.forEach(field => {
    if (field.name === 'status') return
    writeFieldValue(data, field.name, parseFieldValue(field, rawValues[field.name] ?? ''))
  })
  if (page === 'projects') {
    const selectedPlatform = collections.platforms.find(platform => platform.entityId === platformId)
    const regionOptions = mergeExistingProjectRegions(platformMetadataOptions(selectedPlatform, 'regions'), collections.projects.filter(project => dataOf(project).platform_id === platformId))
    data.region = projectRegionFromCode(asText((data.region as Record<string, unknown> | undefined)?.region_code, ''), regionOptions)
  }
  if (page === 'contracts') {
    fillMissingContractPartySnapshot(data, collections, projectId)
  }
  const entityType = pageToEntityType[page]
  if (!entityType) throw new Error('当前页面不支持编辑')
  return api.updateCustomerEntity(entityType, item.entityId, {
    title: rawValues.title || asText(data[titleFieldFor(page)], item.title),
    status: rawValues.status,
    data,
    expectedRevision: item.sourceRevision,
  })
}

function fillMissingContractPartySnapshot(data: Record<string, unknown>, collections: CollectionState, fallbackProjectId: string) {
  if (
    data.lessor_project_id
    && data.lessor_phase_id
    && data.lessor_owner_name
    && data.lessee_store_id
    && data.lessee_tenant_id
    && data.lessee_brand_id
  ) {
    return
  }
  const store = collections.stores.find(item => item.entityId === asText(data.store_id, ''))
  const projectId = asText(data.lessor_project_id ?? data.project_id, asText(dataOf(store).project_id, fallbackProjectId))
  const project = collections.projects.find(item => item.entityId === projectId)
  const phases = projectPhasesFor(project)
  const selectedPhase = phases.find(phase => phase.phase_id === asText(data.lessor_phase_id, '')) ?? phases[0]
  const tenant = collections.tenants.find(item => item.entityId === asText(data.tenant_id, ''))
  const brand = collections.brands.find(item => item.entityId === asText(data.brand_id, ''))

  data.project_id = data.project_id || projectId
  data.lessor_project_id = data.lessor_project_id || projectId
  data.lessor_project_name = data.lessor_project_name || project?.title || ''
  data.lessor_phase_id = data.lessor_phase_id || selectedPhase.phase_id
  data.lessor_phase_name = data.lessor_phase_name || selectedPhase.phase_name
  data.lessor_owner_name = data.lessor_owner_name || selectedPhase.owner_name
  data.lessor_owner_contact = data.lessor_owner_contact || selectedPhase.owner_contact || null
  data.lessor_owner_phone = data.lessor_owner_phone || selectedPhase.owner_phone || null
  data.lessee_store_id = data.lessee_store_id || asText(data.store_id, '')
  data.lessee_store_name = data.lessee_store_name || store?.title || ''
  data.lessee_tenant_id = data.lessee_tenant_id || asText(data.tenant_id, '')
  data.lessee_tenant_name = data.lessee_tenant_name || tenant?.title || ''
  data.lessee_brand_id = data.lessee_brand_id || asText(data.brand_id, '')
  data.lessee_brand_name = data.lessee_brand_name || brand?.title || ''
  data.entity_id = data.entity_id || asText(data.tenant_id, '')
}

function buildCreatePayload(page: PageKey, values: Record<string, unknown>, regionOptions: MetadataOption[] = []) {
  if (page === 'platforms') {
    return {
      platformCode: values.platformCode,
      platformName: values.platformName,
      description: values.description,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      isvConfig: {
        providerType: values.isvProviderType,
        appKey: values.isvAppKey,
        appSecret: values.isvAppSecret,
        isvToken: values.isvToken,
        tokenExpireAt: values.isvTokenExpireAt,
        channelStatus: values.isvChannelStatus,
      },
    }
  }
  if (page === 'projects') {
    return {
      projectCode: values.projectCode,
      projectName: values.projectName,
      platformId: values.platformId,
      timezone: 'Asia/Shanghai',
      address: values.address,
      businessMode: values.businessMode,
      region: projectRegionFromCode(asText(values.regionCode, ''), regionOptions),
      projectPhases: values.projectPhases,
    }
  }
  return values
}

function mergeExistingProjectRegions(baseOptions: MetadataOption[], projects: CustomerEntity[]) {
  const next = [...baseOptions]
  projects.forEach(project => {
    const region = dataOf(project).region
    if (typeof region !== 'object' || region === null || Array.isArray(region)) return
    const regionRecord = region as Record<string, unknown>
    const value = asText(regionRecord.region_code, '')
    if (!value || next.some(option => option.value === value)) return
    next.push({value, label: asText(regionRecord.region_name, value)})
  })
  return next
}

function projectRegionFromCode(regionCode: string, options: MetadataOption[]) {
  const code = regionCode || options[0]?.value || 'WEST_CHINA'
  return {
    region_code: code,
    region_name: optionLabel(options, code, code),
    parent_region_code: 'PLATFORM',
    region_level: 1,
  }
}

function titleFieldFor(page: PageKey) {
  const fieldByPage: Partial<Record<PageKey, string>> = {
    platforms: 'platform_name',
    projects: 'project_name',
    tenants: 'tenant_name',
    brands: 'brand_name',
    stores: 'store_name',
    roles: 'role_name',
    users: 'display_name',
    products: 'product_name',
    brandMenus: 'menu_name',
    storeMenus: 'menu_name',
    priceRules: 'rule_name',
  }
  return fieldByPage[page] ?? 'name'
}
