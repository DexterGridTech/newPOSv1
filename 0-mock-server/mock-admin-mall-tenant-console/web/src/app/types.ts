import {api} from '../api'
import type {PermissionDecision, StoreEffectiveIam, UserEffectivePermissions} from '../api'

export type LegacyDocument = Awaited<ReturnType<typeof api.getDocuments>>[number]
export type OutboxItem = Awaited<ReturnType<typeof api.getProjectionOutbox>>['data'][number]
export type AuditEvent = Awaited<ReturnType<typeof api.getAlignedAuditEvents>>['data'][number]
export type ProjectionDiagnostic = Awaited<ReturnType<typeof api.getProjectionDiagnostics>>['data'][number]
export type Overview = Awaited<ReturnType<typeof api.getOverview>>
export type AuthCapabilities = Awaited<ReturnType<typeof api.getTerminalAuthCapabilities>>
export type OrgTreeNode = Awaited<ReturnType<typeof api.getOrgTree>>[number]
export type StoreContractMonitor = Awaited<ReturnType<typeof api.getStoreContractMonitor>>

export type EntityItem = {
  aggregateId: string
  entityId: string
  title: string
  status: string
  payload: Record<string, unknown>
}

export type DomainKey =
  | 'environment'
  | 'organization'
  | 'facilities'
  | 'iam'
  | 'products'
  | 'menus'
  | 'operations'
  | 'projection'

export type DomainDefinition = {
  key: DomainKey
  label: string
  eyebrow: string
  title: string
  description: string
}

export type EnvironmentDraft = {
  sandboxCode: string
  sandboxName: string
  sandboxType: string
  sandboxOwner: string
  sandboxDescription: string
  platformCode: string
  platformName: string
  platformDescription: string
  platformContactName: string
  platformContactPhone: string
  projectCode: string
  projectName: string
  projectTimezone: string
  projectAddress: string
  projectBusinessMode: string
  projectRegionCode: string
  projectRegionName: string
  projectParentRegionCode: string
  projectRegionLevel: string
  isvProviderType: string
  isvAppKey: string
  isvAppSecret: string
  isvToken: string
  isvTokenExpireAt: string
  isvChannelStatus: string
}

export type LastEnvironmentResult = {
  sandboxId?: string
  platformId?: string
  projectId?: string
  action: string
  payload: unknown
}

export type OrganizationDraft = {
  tenantCode: string
  tenantName: string
  brandCode: string
  brandName: string
  entityCode: string
  entityName: string
  storeCode: string
  storeName: string
  unitCode: string
  contractNo: string
  startDate: string
  endDate: string
  commissionType: string
  commissionRate: string
  depositAmount: string
}

export type ContractLifecycleDraft = {
  newEndDate: string
  amendedEndDate: string
  amendedCommissionRate: string
}

export type LastContractLifecycleResult = {
  action: 'renew' | 'amend' | 'terminate' | 'suspend-tenant'
  contractId?: string
  renewedContractId?: string
  tenantId?: string
  payload: unknown
}

export type LastOrganizationResult = {
  tenantId: string
  brandId: string
  entityId: string
  storeId: string
  contractId: string
}

export type IamDraft = {
  storeId: string
  userCode: string
  displayName: string
  mobile: string
  roleCode: string
  roleName: string
  scopeType: string
  permissionId: string
  permissionCode: string
}

export type LastIamResult = {
  userId: string
  roleId: string
  bindingId: string
  permissionDecision: PermissionDecision
}

export type {StoreEffectiveIam, UserEffectivePermissions}

export type ProductDraft = {
  productName: string
  ownershipScope: 'BRAND' | 'STORE'
  brandId: string
  storeId: string
  productType: string
  basePrice: string
  productionStepName: string
  workstationCode: string
  modifierGroupName: string
  variantName: string
  comboGroupName: string
}

export type LastProductResult = {
  productId: string
  action: string
  payload: unknown
}

export type MenuDraft = {
  brandId: string
  storeId: string
  menuName: string
  sectionName: string
  storeMenuName: string
}

export type LastMenuResult = {
  brandMenuId?: string
  storeMenuId?: string
  action: string
  payload: unknown
}

export type OperationDraft = {
  storeId: string
  productId: string
  businessStatus: string
  acceptOrder: boolean
  weekday: string
  startTime: string
  endTime: string
  extraChargeName: string
  extraChargeAmount: string
  stockId: string
  saleableQuantity: string
  safetyStock: string
  soldOutReason: string
  priceRuleCode: string
  priceDelta: string
  priceType: string
  channelType: string
  availabilityRuleCode: string
  availabilityChannelType: string
  availabilityAllowed: boolean
  reservedQuantity: string
}

export type LastOperationResult = {
  action: string
  payload: unknown
}
