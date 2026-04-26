export type OrganizationIamTopic =
    | 'org.platform.profile'
    | 'org.region.profile'
    | 'org.project.profile'
    | 'org.tenant.profile'
    | 'org.brand.profile'
    | 'org.store.profile'
    | 'org.contract.active'
    | 'org.business-entity.profile'
    | 'org.table.profile'
    | 'org.workstation.profile'
    | 'iam.identity-provider.catalog'
    | 'iam.role.catalog'
    | 'iam.permission.catalog'
    | 'iam.permission-group.catalog'
    | 'iam.role-template.catalog'
    | 'iam.feature-point.catalog'
    | 'iam.platform-feature-switch.catalog'
    | 'iam.user.store-effective'
    | 'iam.user-role-binding.store-effective'
    | 'iam.resource-tag.catalog'
    | 'iam.principal-group.catalog'
    | 'iam.group-member.catalog'
    | 'iam.group-role-binding.store-effective'
    | 'iam.authorization-session.active'
    | 'iam.sod-rule.catalog'
    | 'iam.high-risk-policy.catalog'

export type OrganizationIamProjectionKind = 'organization' | 'iam'

export interface ProjectRegionValue {
    region_code: string
    region_name: string
    parent_region_code?: string | null
    region_level?: number | null
}

export interface RegionProfile {
    region_id: string
    region_code?: string
    region_name?: string
    platform_id?: string
    parent_region_id?: string | null
    parent_region_code?: string | null
    region_level?: number | null
    sort_order?: number
    status?: string
    [key: string]: unknown
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
    region_id?: string
    region?: ProjectRegionValue | null
    business_mode?: string
    project_type?: string
    project_phases?: Array<{
        phase_id?: string
        phase_name?: string
        owner_name?: string
        owner_contact?: string
        owner_phone?: string
        [key: string]: unknown
    }>
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
    platform_id?: string
    brand_category?: string
    brand_logo_url?: string | null
    status?: string
    [key: string]: unknown
}

export interface StoreProfile {
    store_id: string
    store_code?: string
    store_name?: string
    platform_id?: string
    project_id?: string
    tenant_id?: string
    brand_id?: string
    active_contract_id?: string | null
    contract_status?: string
    floor?: string
    unit_no?: string
    unit_code?: string
    area_sqm?: number
    store_type?: string
    operating_status?: string
    status?: string
    [key: string]: unknown
}

export interface ContractProfile {
    contract_id: string
    contract_code?: string
    contract_no?: string
    platform_id?: string
    project_id?: string
    lessor_project_id?: string
    lessor_phase_id?: string
    lessor_phase_name?: string
    lessor_owner_name?: string
    lessor_owner_contact?: string
    lessor_owner_phone?: string
    tenant_id?: string
    lessee_tenant_name?: string
    brand_id?: string
    lessee_brand_name?: string
    entity_id?: string
    lessee_entity_name?: string
    store_id?: string
    lessee_store_name?: string
    unit_code?: string
    start_date?: string
    end_date?: string
    status?: string
    [key: string]: unknown
}

export interface BusinessEntityProfile {
    entity_id: string
    entity_code?: string
    entity_name?: string
    tenant_id?: string
    status?: string
    [key: string]: unknown
}

export interface TableProfile {
    table_id: string
    store_id?: string
    table_no?: string
    table_name?: string
    area?: string
    table_type?: string
    capacity?: number
    reservable?: boolean
    consumer_description?: string | null
    minimum_spend?: number | null
    sort_order?: number
    table_status?: string
    [key: string]: unknown
}

export interface WorkstationProfile {
    workstation_id: string
    store_id?: string
    workstation_code?: string
    workstation_name?: string
    workstation_type?: string
    category_codes?: string[]
    responsible_categories?: string[]
    description?: string | null
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

export interface IdentityProviderProfile {
    idp_id: string
    platform_id?: string
    provider_type?: string
    provider_name?: string
    status?: string
    [key: string]: unknown
}

export interface PermissionGroupProfile {
    permission_group_id: string
    platform_id?: string
    group_code?: string
    group_name?: string
    permission_ids?: string[]
    status?: string
    [key: string]: unknown
}

export interface RoleTemplateProfile {
    template_id: string
    platform_id?: string
    template_code?: string
    template_name?: string
    permission_ids?: string[]
    status?: string
    [key: string]: unknown
}

export interface FeaturePointProfile {
    feature_point_id: string
    platform_id?: string
    feature_code?: string
    feature_name?: string
    status?: string
    [key: string]: unknown
}

export interface PlatformFeatureSwitchProfile {
    switch_id: string
    platform_id?: string
    feature_point_id?: string
    feature_code?: string
    enabled?: boolean
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
    resource_scope?: Record<string, unknown>
    scope_selector?: Record<string, unknown>
    policy_effect?: string
    effective_from?: string
    effective_to?: string | null
    status?: string
    [key: string]: unknown
}

export interface ResourceTagProfile {
    tag_id: string
    platform_id?: string
    resource_type?: string
    resource_id?: string
    tag_key?: string
    tag_value?: string
    status?: string
    [key: string]: unknown
}

export interface PrincipalGroupProfile {
    group_id: string
    platform_id?: string
    group_code?: string
    group_name?: string
    group_type?: string
    status?: string
    [key: string]: unknown
}

export interface GroupMemberProfile {
    member_id: string
    group_id?: string
    user_id?: string
    effective_from?: string
    effective_to?: string | null
    status?: string
    [key: string]: unknown
}

export interface GroupRoleBindingProfile {
    group_binding_id: string
    group_id?: string
    role_id?: string
    store_id?: string
    resource_scope?: Record<string, unknown>
    scope_selector?: Record<string, unknown>
    policy_effect?: string
    effective_from?: string
    effective_to?: string | null
    status?: string
    [key: string]: unknown
}

export interface AuthorizationSessionProfile {
    session_id: string
    user_id?: string
    platform_id?: string
    working_scope?: Record<string, unknown>
    activated_binding_ids?: string[]
    expires_at?: string | null
    status?: string
    [key: string]: unknown
}

export interface SeparationOfDutyRuleProfile {
    sod_rule_id: string
    platform_id?: string
    rule_name?: string
    conflicting_role_codes?: string[]
    conflicting_perm_codes?: string[]
    status?: string
    [key: string]: unknown
}

export interface HighRiskPermissionPolicyProfile {
    policy_id: string
    platform_id?: string
    permission_code?: string
    require_approval?: boolean
    require_mfa?: boolean
    max_duration_days?: number | null
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
    type: 'platform' | 'region' | 'project' | 'tenant' | 'brand' | 'store' | 'business-entity' | 'table' | 'workstation'
    title: string
    status?: string
    children: OrganizationTreeNode[]
}
