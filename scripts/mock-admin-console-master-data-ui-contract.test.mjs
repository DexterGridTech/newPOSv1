import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')
const webSrc = path.join(repoRoot, '0-mock-server/mock-admin-mall-tenant-console/web/src')

const read = relativePath => fs.readFileSync(path.join(webSrc, relativePath), 'utf8')

const files = {
  api: read('api.ts'),
  app: read('customer/CustomerAdminApp.tsx'),
  collectionPage: read('customer/pages/CollectionPage.tsx'),
  collectionModel: read('customer/pages/collectionModel.tsx'),
  constants: read('customer/constants.ts'),
  domain: read('customer/domain.ts'),
  metadata: read('customer/metadata.ts'),
  types: read('customer/types.ts'),
  forms: read('customer/modals/EntityFormModal.tsx'),
  dictionaries: read('customer/pages/BusinessDictionariesPage.tsx'),
}

const masterDataPages = [
  ['businessEntities', '签约主体', 'business_entity'],
  ['productInheritances', '商品继承', 'product_inheritance'],
  ['bundlePriceRules', '组合优惠', 'bundle_price_rule'],
  ['channelProductMappings', '渠道映射', 'channel_product_mapping'],
]

const businessEntityFields = [
  'entityCode',
  'entityName',
  'tenantId',
  'unifiedSocialCreditCode',
  'legalRepresentative',
  'taxpayerType',
  'taxRate',
  'bankAccountNo',
  'settlementCycle',
  'settlementDay',
]

test('platform management belongs to environment management with sandboxes', () => {
  assert.match(
    files.constants,
    /title: '环境管理'[\s\S]*key: 'environment', label: '沙箱'[\s\S]*key: 'platforms', label: '平台'/,
    'platforms should sit with sandbox environment management',
  )
  assert.match(
    files.constants,
    /title: '组织管理'[\s\S]*key: 'businessDictionaries', label: '业务字典'/,
    'organization management should start from business dictionaries after platform is moved out',
  )
  assert.doesNotMatch(
    files.constants,
    /title: '组织管理'[\s\S]*key: 'platforms', label: '平台'[\s\S]*key: 'businessDictionaries', label: '业务字典'/,
    'platforms should not remain in organization management',
  )
})

test('business dictionaries are scoped by real business owner instead of one global pile', () => {
  assert.match(files.metadata, /platformMetadataOwnerScopes:[\s\S]*product_types: 'BRAND'[\s\S]*production_categories: 'BRAND'/, 'product and production dictionaries should belong to brand scope')
  assert.match(files.metadata, /platformMetadataOwnerScopes:[\s\S]*store_business_scenarios: 'STORE'[\s\S]*table_areas: 'STORE'[\s\S]*channel_types: 'STORE'/, 'store operation dictionaries should belong to store scope')
  assert.match(files.metadata, /platformMetadataOwnerScopes:[\s\S]*regions: 'PLATFORM'[\s\S]*project_business_modes: 'PLATFORM'/, 'region and project dictionaries should remain platform scope')
  assert.match(files.dictionaries, /dictionaryScopes:[^\n]*'PLATFORM'[^\n]*'BRAND'[^\n]*'STORE'/, 'dictionary UI must expose platform, brand, and store scopes')
  assert.match(files.dictionaries, /keysForScope = \(scope: DictionaryScope\)[\s\S]*platformMetadataOwnerScopes\[key\] === scope/, 'dictionary UI should render only keys for the active business scope')
  assert.match(files.dictionaries, /className="customer-v3-dictionary-lanes"/, 'dictionary UI should start from business maintenance lanes')
  assert.match(files.dictionaries, /aria-label="字典维护对象"/, 'dictionary UI should provide explicit brand and store owner selectors')
  assert.match(files.dictionaries, /activeScope !== 'PLATFORM'/, 'platform-level dictionaries should not show irrelevant brand selectors')
  assert.match(files.dictionaries, /activeScope === 'STORE'/, 'store selector should only appear for store-owned dictionaries')
  assert.match(files.dictionaries, /if \(input\.scope === 'STORE' && !input\.store\) return \[\]/, 'store-scope dictionary drafts should be empty when no store owner is selected')
  assert.match(files.dictionaries, /const resolvedStore = storeOptions\.find\(store => store\.entityId === selectedStoreValue\)/, 'store dictionary owner must resolve only from stores under the selected brand')
  assert.doesNotMatch(files.dictionaries, /const resolvedStore = storeOptions\.find\(store => store\.entityId === selectedStoreValue\) \?\? props\.store/, 'store dictionary page must not fall back to an unrelated active store when selected brand has no stores')
  assert.match(files.dictionaries, /当前品牌暂无门店[\s\S]*门店经营字典必须归属具体门店/, 'store dictionary page should show an explicit no-store empty state')
  assert.match(files.dictionaries, /\{!activeOwner \? \([\s\S]*<EmptyState title=\{missingOwnerTitle/, 'dictionary editor should be replaced by empty state when no owner exists')
  assert.match(files.app, /selectedStoreId=\{selectedStoreId\}/, 'business dictionary page should receive the explicit selected store id, not activeStoreId fallback')
  assert.match(files.dictionaries, /activeScope !== 'PLATFORM' \? \(/, 'platform-level dictionaries should not render a redundant owner strip')
  assert.match(files.dictionaries, /customer-v3-dictionary-loading/, 'dictionary UI should not expose editable fallback tables while owner data is loading')
  assert.match(files.dictionaries, /aria-label="字典目录"/, 'dictionary UI should expose a focused dictionary catalog instead of dumping every dictionary table at once')
  assert.match(files.dictionaries, /customer-v3-dictionary-editor-header/, 'dictionary editor should have a distinct compact header')
  assert.match(files.dictionaries, /customer-v3-dictionary-editor-actions/, 'dictionary editor actions should be grouped separately from the table')
  assert.match(files.dictionaries, /<th>稳定 Key<\/th>[\s\S]*<th>显示值<\/th>/, 'dictionary option editor should put metadata key before display value')
  assert.match(files.dictionaries, /aria-label=\{`\$\{activeLabel\.title\}稳定 Key`\}[\s\S]*value=\{option\.value\}[\s\S]*updateOption\(visibleKey, index, 'value'/, 'dictionary key input should edit the stable value field')
  assert.match(files.dictionaries, /aria-label=\{`\$\{activeLabel\.title\}显示值`\}[\s\S]*value=\{option\.label\}[\s\S]*updateOption\(visibleKey, index, 'label'/, 'dictionary display value input should edit the label field')
  assert.match(files.dictionaries, /sanitizeDraft\(draft, activeScope, owner\.entityId, \[visibleKey\]\)/, 'saving should only patch the currently edited dictionary')
  assert.match(files.app, /onSave=\{async \(scope, owner, catalog\)/, 'dictionary save should receive the selected business owner')
  assert.match(files.app, /onSelectBrand=\{setSelectedBrandId\}/, 'dictionary page should update the shared active brand context')
  assert.match(files.app, /onSelectStore=\{setSelectedStoreId\}/, 'dictionary page should update the shared active store context')
  assert.match(files.app, /scope === 'BRAND' \? 'brand' : scope === 'STORE' \? 'store' : 'platform'/, 'dictionary save should persist to brand/store/platform owner entities')
  assert.match(files.collectionPage, /const channelOptions = contextStore \? ownerMetadataOptions\(contextStore, 'channel_types'\) : \[\]/, 'store-scoped channel options should be consumed from the selected store dictionary by lists')
  assert.doesNotMatch(files.collectionPage, /businessMetadataOptions\(\{platform: selectedPlatform, store: contextStore, key: 'channel_types'\}\)/, 'store-scoped list filters should not fall back to platform defaults when an owner store is missing metadata')
  assert.match(files.forms, /businessMetadataOptions\(\{platform: selectedPlatform, brand: contextBrand, key: 'product_types'\}\)/, 'brand-scoped product type options should be consumed by forms')
  assert.match(files.forms, /businessMetadataOptions\(\{platform: selectedPlatform, store: contextStore, key: 'table_areas'\}\)/, 'store-scoped table area options should be consumed by forms')
  assert.match(files.forms, /helper: '来自门店字典，可多选'/, 'store scenario forms should explain that values are maintained in the store dictionary')
  assert.match(files.forms, /helper: '来自品牌字典，可多选；仅定义路由能力，不承载出品任务队列'/, 'workstation production categories should explain that values are maintained in the brand dictionary')
  assert.match(files.constants, /businessDictionaries: \{title: '业务字典', scope: '按集团全局、品牌和门店归属维护业务选项'\}/, 'business dictionary page metadata should not describe every option as group-global')
})

test('master-data filters use page status semantics and metadata owner cascade', () => {
  assert.match(files.collectionPage, /const pageStatusOptions:[\s\S]*tables: \[optionFromValue\('ACTIVE'\), optionFromValue\('SUSPENDED'\)\]/, 'table page status filter should not expose every global status')
  assert.match(files.collectionPage, /const statusOptions = pageStatusOptions\[page\] \?\? metadataOptions\.commonStatuses/, 'filter bar should resolve status options per page')
  assert.doesNotMatch(files.collectionPage, /metadataOptions\.filterStatuses\.map\(status => \(/, 'filter bar should not dump the global status catalog into every page')
  assert.match(files.collectionPage, /const contextStore = value\.storeId === 'ALL'[\s\S]*\? undefined[\s\S]*selectedProjectStores\.find/, 'store-scoped metadata filters should require an explicit selected store')
  assert.match(files.collectionPage, /const tableTypeOptions = contextStore \? ownerMetadataOptions\(contextStore, 'table_types'\) : \[\]/, 'table type options should come from the selected store dictionary only after a store is selected')
  assert.match(files.collectionPage, /function ownerMetadataOptions\(owner: CustomerEntity \| undefined, key: PlatformMetadataKey\): MetadataOption\[\][\s\S]*if \(!Array\.isArray\(options\)\) return \[\]/, 'owner-scoped metadata filters should not fall back to platform defaults')
  assert.match(files.collectionPage, /<SelectFilter label="桌台类型"[\s\S]*disabled=\{!contextStore \|\| tableTypeOptions\.length === 0\} disabledLabel=\{!contextStore \? '先选择门店' : '未维护门店字典'\}/, 'table type filter should be disabled until the owner store is selected and maintains metadata')
  assert.match(files.collectionPage, /<SelectFilter label="桌台区域"[\s\S]*disabled=\{!contextStore \|\| tableAreaOptions\.length === 0\} disabledLabel=\{!contextStore \? '先选择门店' : '未维护门店字典'\}/, 'table area filter should be disabled until the owner store is selected and maintains metadata')
  assert.match(files.collectionPage, /const updateProject = \(projectId: string\) => update\(\{projectId, storeId: 'ALL', \.\.\.storeMetadataFilterReset\}\)/, 'changing project should reset store-owned metadata filters')
  assert.match(files.collectionPage, /const updateStore = \(storeId: string\) => update\(\{storeId, \.\.\.storeMetadataFilterReset\}\)/, 'changing store should reset store-owned metadata filters')
  assert.match(files.collectionPage, /const updateBrand = \(brandId: string\) => update\(\{brandId, \.\.\.brandMetadataFilterReset\}\)/, 'changing brand should reset brand-owned metadata filters')
})

test('product and operating master-data pages are fully wired into navigation and entity maps', () => {
  for (const [page, label, entityType] of masterDataPages) {
    assert.match(files.types, new RegExp(`\\| '${page}'`), `${page} must be a PageKey/CollectionKey`)
    assert.match(files.constants, new RegExp(`${page}: \\[\\]`), `${page} must be initialized in emptyCollections`)
    assert.match(files.constants, new RegExp(`key: '${page}', label: '${label}'`), `${page} must be visible in nav`)
    assert.match(files.constants, new RegExp(`${page}: \\{title:`), `${page} must have page metadata`)
    assert.match(files.constants, new RegExp(`${page}: '${entityType}'`), `${page} must map to backend entity type`)
    assert.match(files.constants, new RegExp(`'${page}'`), `${page} must be editable`)
  }
})

test('API client and app loader include all backend master-data routes', () => {
  const getMethods = [
    'getProductInheritances',
    'getBundlePriceRules',
    'getChannelProductMappings',
  ]
  const createMethods = [
    'createProductInheritance',
    'createBundlePriceRule',
    'createChannelProductMapping',
  ]
  for (const method of [...getMethods, ...createMethods]) {
    assert.match(files.api, new RegExp(`${method}:`), `${method} must be exposed by api client`)
  }
  for (const method of getMethods) {
    assert.match(files.app, new RegExp(`api\\.${method}`), `${method} must be used by the customer app`)
  }
  for (const method of createMethods) {
    assert.match(files.forms, new RegExp(`api\\.${method}`), `${method} must be used by the create form`)
  }
  for (const [page] of masterDataPages) {
    assert.match(files.app, new RegExp(`${page}: ${page}\\.data as CustomerEntity\\[\\]`), `${page} must be loaded into CollectionState`)
  }
})

test('master-data list filters and table columns expose business relationships', () => {
  const pageFilterExpectations = [
    ['productInheritances', '商品'],
    ['bundlePriceRules', '优惠方式'],
    ['channelProductMappings', '同步状态'],
    ['channelProductMappings', '售卖渠道'],
  ]
  for (const [page, label] of pageFilterExpectations) {
    assert.match(files.collectionPage, new RegExp(`${page}[\\s\\S]*${label}|${label}[\\s\\S]*${page}`), `${page} filter must expose ${label}`)
  }

  const tableLabels = [
    '品牌商品',
    '门店商品',
    '锁定字段',
    '最后同步',
    '触发商品',
    '最大触发',
    '外部商品ID',
    '外部 SKU',
    '映射状态',
    '失败原因',
  ]
  for (const label of tableLabels) {
    assert.match(files.collectionModel, new RegExp(label), `${label} must be visible in list columns`)
  }

  assert.match(files.collectionModel, /filter\.syncStatus !== 'ALL'/, 'sync status filter must affect lists')
  assert.match(files.collectionModel, /brand_product_id/, 'product filter must match product inheritance brand product')
  assert.match(files.collectionModel, /store_product_id/, 'product filter must match product inheritance store product')
  assert.match(files.collectionModel, /trigger_products/, 'product filter must match bundle trigger products')
})

test('master-data create and edit forms expose design-v3 fields with business controls', () => {
  const requiredFields = [
    ...businessEntityFields,
    'brandProductId',
    'storeProductId',
    'overrideFields',
    'lockedFields',
    'syncStatus',
    'lastSyncAt',
    'triggerProductIds',
    'triggerProducts',
    'maxApplications',
    'mappingStatus',
    'externalProductId',
    'externalSkuId',
    'fieldMappingConfig',
  ]
  for (const field of requiredFields) {
    assert.match(files.forms, new RegExp(`name: '${field}'`), `${field} must be available in create/edit forms`)
  }
  assert.match(files.forms, /normalizeBundlePriceRulePayload/, 'bundle trigger product selector must normalize to triggerProducts')
  assert.match(files.forms, /metadataOptions\.syncStatuses/, 'forms must use sync status options')
  assert.match(files.forms, /metadataOptions\.mappingStatuses/, 'forms must use mapping status options')
  assert.match(files.forms, /name: 'entityId', label: '乙方签约主体'/, 'contract create must choose a business entity snapshot')
  assert.match(files.forms, /field\.name === 'lessorProjectId'[\s\S]*readonly: true/, 'contract lessor project should be derived from selected store')
  assert.match(files.forms, /由乙方门店所属项目带出/, 'contract create should explain why lessor project is readonly')
  assert.match(files.domain, /bank_account_no: '银行账号'/, 'business entity detail should translate masked bank account field')
  assert.match(files.domain, /bank_account_no_masked: '银行账号'/, 'business entity detail should show masked bank account')
})

test('master-data labels and enum metadata include sync, mapping, and bundle states', () => {
  const enumKeys = ['SYNCED', 'OUT_OF_SYNC', 'NOT_SYNCED', 'SYNCING', 'SYNC_FAILED', 'MAPPED', 'UNMAPPED', 'TOTAL_DISCOUNT']
  for (const key of enumKeys) {
    assert.match(files.metadata, new RegExp(`${key}:`), `${key} must be translated`)
  }
  assert.match(files.metadata, /syncStatuses:/, 'sync status option set must exist')
  assert.match(files.metadata, /mappingStatuses:/, 'mapping status option set must exist')
  const labels = [
    '继承关系',
    '品牌商品',
    '门店商品',
    '覆盖字段',
    '锁定字段',
    '同步状态',
    '组合优惠规则',
    '触发商品',
    '渠道商品映射',
    '外部商品 ID',
    '外部 SKU ID',
  ]
  for (const label of labels) {
    assert.match(files.domain, new RegExp(label), `${label} must be translated in details`)
  }
})
