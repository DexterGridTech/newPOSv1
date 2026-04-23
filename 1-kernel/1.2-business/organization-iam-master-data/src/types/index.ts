export type OrganizationIamTopic =
    | 'org.platform.profile'
    | 'org.project.profile'
    | 'org.tenant.profile'
    | 'org.brand.profile'
    | 'org.store.profile'
    | 'org.contract.active'
    | 'iam.role.catalog'
    | 'iam.permission.catalog'
    | 'iam.user.store-effective'
    | 'iam.user-role-binding.store-effective'

export type OrganizationIamProjectionKind = 'organization' | 'iam'

export interface ProjectRegionValue {
    region_code: string
    region_name: string
    parent_region_code?: string | null
    region_level?: number | null
}

export interface PlatformProfile {
    platform_id: string
    platform_code?: string
    platform_name?: string
    status?: string
    description?: string | null
    [key: string]: unknown
}

export interface ProjectProfile {
    project_id: string
    project_code?: string
    project_name?: string
    platform_id?: string
    region?: ProjectRegionValue | null
    timezone?: string
    status?: string
    [key: string]: unknown
}

export interface TenantProfile {
    tenant_id: string
    tenant_code?: string
    tenant_name?: string
    platform_id?: string
    status?: string
    [key: string]: unknown
}

export interface BrandProfile {
    brand_id: string
    brand_code?: string
    brand_name?: string
    tenant_id?: string
    platform_id?: string
    status?: string
    [key: string]: unknown
}

export interface StoreProfile {
    store_id: string
    store_code?: string
    store_name?: string
    unit_code?: string
    platform_id?: string
    project_id?: string
    tenant_id?: string
    brand_id?: string
    status?: string
    [key: string]: unknown
}

export interface ContractProfile {
    contract_id: string
    contract_code?: string
    platform_id?: string
    project_id?: string
    tenant_id?: string
    brand_id?: string
    store_id?: string
    unit_code?: string
    start_date?: string
    end_date?: string
    status?: string
    [key: string]: unknown
}

export interface PermissionProfile {
    permission_id: string
    permission_code?: string
    permission_name?: string
    permission_type?: string
    status?: string
    [key: string]: unknown
}

export interface RoleProfile {
    role_id: string
    role_code?: string
    role_name?: string
    scope_type?: string
    permission_ids?: string[]
    status?: string
    [key: string]: unknown
}

export interface UserProfile {
    user_id: string
    user_code?: string
    display_name?: string
    mobile?: string | null
    store_id?: string
    status?: string
    [key: string]: unknown
}

export interface UserRoleBindingProfile {
    binding_id: string
    user_id: string
    role_id: string
    store_id?: string
    status?: string
    [key: string]: unknown
}

export interface OrganizationIamWireEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
    schema_version: 1
    projection_kind: OrganizationIamProjectionKind
    sandbox_id: string
    platform_id: string
    source_service: string
    source_event_id: string
    source_revision: number
    generated_at: string
    data: TData
}

export interface OrganizationIamMasterDataRecord<TData extends Record<string, unknown> = Record<string, unknown>> {
    topic: OrganizationIamTopic
    itemKey: string
    scopeType: string
    scopeId: string
    revision: number
    sourceReleaseId?: string | null
    sourceEventId?: string
    sourceRevision?: number
    occurredAt?: string
    updatedAt: number
    envelope: OrganizationIamWireEnvelope<TData>
    data: TData
    tombstone?: boolean
}

export interface OrganizationIamDiagnosticsEntry {
    topic: string
    itemKey: string
    scopeType?: string
    scopeId?: string
    revision?: number
    reason: string
    occurredAt: number
}

export interface OrganizationIamMasterDataState {
    byTopic: Partial<Record<OrganizationIamTopic, Record<string, OrganizationIamMasterDataRecord>>>
    diagnostics: OrganizationIamDiagnosticsEntry[]
    lastChangedAt?: number
}

export interface OrganizationTreeNode {
    id: string
    type: 'platform' | 'project' | 'tenant' | 'brand' | 'store'
    title: string
    status?: string
    children: OrganizationTreeNode[]
}
