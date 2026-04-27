import type {ReactNode} from 'react'
import type {EntityItemLike} from '../api'

export type CustomerEntity = EntityItemLike & {
  sandboxId?: string
  domain?: string
  entityType?: string
  naturalScopeType?: string
  naturalScopeKey?: string
  sourceRevision?: number
  createdAt?: number
  updatedAt?: number
}

export type OutboxItem = {
  outboxId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
  sourceEventId: string
  sourceRevision: number
  status: string
  attemptCount: number
  lastError?: string | null
  payload: Record<string, unknown>
  targetTerminalIds: string[]
  updatedAt: number
}

export type PublishLogItem = {
  publishId: string
  outboxId: string
  request: Record<string, unknown>
  response: Record<string, unknown>
  createdAt: number
}

export type PageKey =
  | 'dashboard'
  | 'dataStatistics'
  | 'environment'
  | 'platforms'
  | 'businessDictionaries'
  | 'projects'
  | 'tenants'
  | 'brands'
  | 'contracts'
  | 'stores'
  | 'businessEntities'
  | 'tables'
  | 'workstations'
  | 'permissions'
  | 'roles'
  | 'users'
  | 'roleBindings'
  | 'identityProviderConfigs'
  | 'permissionGroups'
  | 'roleTemplates'
  | 'featurePoints'
  | 'platformFeatureSwitches'
  | 'resourceTags'
  | 'principalGroups'
  | 'groupMembers'
  | 'groupRoleBindings'
  | 'authorizationSessions'
  | 'sodRules'
  | 'highRiskPolicies'
  | 'authAuditLogs'
  | 'products'
  | 'productCategories'
  | 'productInheritances'
  | 'brandMenus'
  | 'storeMenus'
  | 'storeConfig'
  | 'stock'
  | 'availability'
  | 'availabilityRules'
  | 'priceRules'
  | 'bundlePriceRules'
  | 'channelProductMappings'
  | 'projectionOutbox'
  | 'publishLog'

export type CollectionKey =
  | 'sandboxes'
  | 'platforms'
  | 'projects'
  | 'tenants'
  | 'brands'
  | 'contracts'
  | 'businessEntities'
  | 'stores'
  | 'tables'
  | 'workstations'
  | 'permissions'
  | 'roles'
  | 'users'
  | 'roleBindings'
  | 'identityProviderConfigs'
  | 'permissionGroups'
  | 'roleTemplates'
  | 'featurePoints'
  | 'platformFeatureSwitches'
  | 'resourceTags'
  | 'principalGroups'
  | 'groupMembers'
  | 'groupRoleBindings'
  | 'authorizationSessions'
  | 'sodRules'
  | 'highRiskPolicies'
  | 'authAuditLogs'
  | 'products'
  | 'productCategories'
  | 'productInheritances'
  | 'brandMenus'
  | 'storeMenus'
  | 'storeConfig'
  | 'stock'
  | 'availability'
  | 'priceRules'
  | 'availabilityRules'
  | 'bundlePriceRules'
  | 'channelProductMappings'

export type CollectionState = Record<CollectionKey, CustomerEntity[]>

export type FilterState = {
  search: string
  status: string
  platformId: string
  projectId: string
  storeId: string
  brandId: string
  tenantId: string
  roleId: string
  category: string
  floor: string
  contractStatus: string
  operatingStatus: string
  erpStatus: string
  standardMenu: string
  activeContract: string
  storeType: string
  productType: string
  priceType: string
  channelType: string
  region: string
  businessMode: string
  billingMode: string
  permissionType: string
  roleType: string
  resourceType: string
  scopeType: string
  policyEffect: string
  ownershipScope: string
  reviewStatus: string
  tableStatus: string
  capacity: string
  workstationCategory: string
  workstationType: string
  tableArea: string
  tableType: string
  reservable: string
  availabilityState: string
  availabilityRuleType: string
  businessStatus: string
  productId: string
  productCategoryId: string
  stockLevel: string
  discountType: string
  settlementCycle: string
  sandboxType: string
  isvStatus: string
  userId: string
  permissionId: string
  groupId: string
  identitySource: string
  idpType: string
  featureCode: string
  enabledState: string
  groupType: string
  groupMemberSource: string
  riskControl: string
  mfaState: string
  syncStatus: string
}

export type FieldDef = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'json' | 'option-list' | 'asset' | 'multi-select' | 'project-phases' | 'scope-selector'
  required?: boolean
  options?: Array<{label: string; value: string}>
  defaultValue?: string
  readonly?: boolean
  helper?: string
  assetKind?: 'brand-logo' | 'product-image' | 'menu-product-image'
}

export type Column = {
  label: string
  render: (item: CustomerEntity) => ReactNode
}
