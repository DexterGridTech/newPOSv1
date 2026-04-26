import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {ORGANIZATION_IAM_MASTER_DATA_STATE_KEY, getOrganizationIamRecordsByTopic} from '../features/slices/masterData'
import {organizationIamTopics} from '../foundations/topics'
import type {
    AuthorizationSessionProfile,
    BrandProfile,
    BusinessEntityProfile,
    ContractProfile,
    FeaturePointProfile,
    GroupMemberProfile,
    GroupRoleBindingProfile,
    HighRiskPermissionPolicyProfile,
    IdentityProviderProfile,
    OrganizationIamDiagnosticsEntry,
    OrganizationIamMasterDataRecord,
    OrganizationIamMasterDataState,
    OrganizationTreeNode,
    PermissionProfile,
    PermissionGroupProfile,
    PlatformProfile,
    PlatformFeatureSwitchProfile,
    PrincipalGroupProfile,
    ProjectProfile,
    RegionProfile,
    ResourceTagProfile,
    RoleProfile,
    RoleTemplateProfile,
    SeparationOfDutyRuleProfile,
    StoreProfile,
    TableProfile,
    TenantProfile,
    UserProfile,
    UserRoleBindingProfile,
    WorkstationProfile,
} from '../types'

export const selectOrganizationIamMasterDataState = (
    state: RootState,
) => state[ORGANIZATION_IAM_MASTER_DATA_STATE_KEY as keyof RootState] as OrganizationIamMasterDataState | undefined

const activeRecordsFromMasterData = <TData extends Record<string, unknown>>(
    masterData: OrganizationIamMasterDataState | undefined,
    topic: Parameters<typeof getOrganizationIamRecordsByTopic>[1],
) => getOrganizationIamRecordsByTopic(masterData, topic)
    .filter(record => !record.tombstone)
    .map(record => record as OrganizationIamMasterDataRecord<TData>)

const findDataById = <TData extends Record<string, unknown>>(
    records: OrganizationIamMasterDataRecord<TData>[],
    field: string,
    id?: string,
) => records.find(record => record.data[field] === id)?.data

const createActiveRecordSelector = <TData extends Record<string, unknown>>(
    topic: Parameters<typeof getOrganizationIamRecordsByTopic>[1],
) => createSelector(
    [selectOrganizationIamMasterDataState],
    masterData => activeRecordsFromMasterData<TData>(masterData, topic),
)

const createActiveDataSelector = <TData extends Record<string, unknown>>(
    topic: Parameters<typeof getOrganizationIamRecordsByTopic>[1],
) => createSelector(
    [createActiveRecordSelector<TData>(topic)],
    records => records.map(record => record.data),
)

const selectPlatformRecords = createActiveRecordSelector<PlatformProfile>(organizationIamTopics.platform)
const selectRegionRecords = createActiveRecordSelector<RegionProfile>(organizationIamTopics.region)
const selectProjectRecords = createActiveRecordSelector<ProjectProfile>(organizationIamTopics.project)
const selectTenantRecords = createActiveRecordSelector<TenantProfile>(organizationIamTopics.tenant)
const selectBrandRecords = createActiveRecordSelector<BrandProfile>(organizationIamTopics.brand)
const selectStoreRecords = createActiveRecordSelector<StoreProfile>(organizationIamTopics.store)
const selectContractRecords = createActiveRecordSelector<ContractProfile>(organizationIamTopics.contract)
const selectBusinessEntityRecords = createActiveRecordSelector<BusinessEntityProfile>(organizationIamTopics.businessEntity)
const selectTableRecords = createActiveRecordSelector<TableProfile>(organizationIamTopics.table)
const selectWorkstationRecords = createActiveRecordSelector<WorkstationProfile>(organizationIamTopics.workstation)
const selectPlatformProfiles = createActiveDataSelector<PlatformProfile>(organizationIamTopics.platform)
const selectRegionProfiles = createActiveDataSelector<RegionProfile>(organizationIamTopics.region)
const selectProjectProfiles = createActiveDataSelector<ProjectProfile>(organizationIamTopics.project)
const selectTenantProfiles = createActiveDataSelector<TenantProfile>(organizationIamTopics.tenant)
const selectBrandProfiles = createActiveDataSelector<BrandProfile>(organizationIamTopics.brand)
const selectStoreProfiles = createActiveDataSelector<StoreProfile>(organizationIamTopics.store)
const selectBusinessEntityProfiles = createActiveDataSelector<BusinessEntityProfile>(organizationIamTopics.businessEntity)
const selectTableProfiles = createActiveDataSelector<TableProfile>(organizationIamTopics.table)
const selectWorkstationProfiles = createActiveDataSelector<WorkstationProfile>(organizationIamTopics.workstation)
const selectIdentityProviderProfiles = createActiveDataSelector<IdentityProviderProfile>(organizationIamTopics.identityProvider)
const selectRoleProfiles = createActiveDataSelector<RoleProfile>(organizationIamTopics.role)
const selectPermissionProfiles = createActiveDataSelector<PermissionProfile>(organizationIamTopics.permission)
const selectPermissionGroupProfiles = createActiveDataSelector<PermissionGroupProfile>(organizationIamTopics.permissionGroup)
const selectRoleTemplateProfiles = createActiveDataSelector<RoleTemplateProfile>(organizationIamTopics.roleTemplate)
const selectFeaturePointProfiles = createActiveDataSelector<FeaturePointProfile>(organizationIamTopics.featurePoint)
const selectPlatformFeatureSwitchProfiles = createActiveDataSelector<PlatformFeatureSwitchProfile>(organizationIamTopics.platformFeatureSwitch)
const selectUserProfiles = createActiveDataSelector<UserProfile>(organizationIamTopics.user)
const selectUserRoleBindingProfiles = createActiveDataSelector<UserRoleBindingProfile>(organizationIamTopics.userRoleBinding)
const selectResourceTagProfiles = createActiveDataSelector<ResourceTagProfile>(organizationIamTopics.resourceTag)
const selectPrincipalGroupProfiles = createActiveDataSelector<PrincipalGroupProfile>(organizationIamTopics.principalGroup)
const selectGroupMemberProfiles = createActiveDataSelector<GroupMemberProfile>(organizationIamTopics.groupMember)
const selectGroupRoleBindingProfiles = createActiveDataSelector<GroupRoleBindingProfile>(organizationIamTopics.groupRoleBinding)
const selectAuthorizationSessionProfiles = createActiveDataSelector<AuthorizationSessionProfile>(organizationIamTopics.authorizationSession)
const selectSeparationOfDutyRuleProfiles = createActiveDataSelector<SeparationOfDutyRuleProfile>(organizationIamTopics.separationOfDutyRule)
const selectHighRiskPermissionPolicyProfiles = createActiveDataSelector<HighRiskPermissionPolicyProfile>(organizationIamTopics.highRiskPermissionPolicy)

export const selectOrganizationIamDiagnostics: (state: RootState) => OrganizationIamDiagnosticsEntry[] = createSelector(
    [selectOrganizationIamMasterDataState],
    masterData => masterData?.diagnostics ?? [],
)

export const selectOrganizationIamAllRecords: (
    state: RootState,
) => OrganizationIamMasterDataRecord[] = createSelector(
    [selectOrganizationIamMasterDataState],
    masterData => Object.values(masterData?.byTopic ?? {})
        .flatMap(records => Object.values(records ?? {}))
)

export const selectOrganizationIamSummary: (state: RootState) => {
    platforms: number
    regions: number
    projects: number
    tenants: number
    brands: number
    stores: number
    businessEntities: number
    tables: number
    workstations: number
    users: number
    roles: number
    permissions: number
    permissionGroups: number
    roleTemplates: number
    featurePoints: number
    featureSwitches: number
    resourceTags: number
    principalGroups: number
    groupMembers: number
    groupRoleBindings: number
    highRiskPolicies: number
    sodRules: number
    diagnostics: number
    lastChangedAt?: number
} = createSelector(
    [selectOrganizationIamMasterDataState],
    masterData => ({
        platforms: Object.keys(masterData?.byTopic[organizationIamTopics.platform] ?? {}).length,
        regions: Object.keys(masterData?.byTopic[organizationIamTopics.region] ?? {}).length,
        projects: Object.keys(masterData?.byTopic[organizationIamTopics.project] ?? {}).length,
        tenants: Object.keys(masterData?.byTopic[organizationIamTopics.tenant] ?? {}).length,
        brands: Object.keys(masterData?.byTopic[organizationIamTopics.brand] ?? {}).length,
        stores: Object.keys(masterData?.byTopic[organizationIamTopics.store] ?? {}).length,
        businessEntities: Object.keys(masterData?.byTopic[organizationIamTopics.businessEntity] ?? {}).length,
        tables: Object.keys(masterData?.byTopic[organizationIamTopics.table] ?? {}).length,
        workstations: Object.keys(masterData?.byTopic[organizationIamTopics.workstation] ?? {}).length,
        users: Object.keys(masterData?.byTopic[organizationIamTopics.user] ?? {}).length,
        roles: Object.keys(masterData?.byTopic[organizationIamTopics.role] ?? {}).length,
        permissions: Object.keys(masterData?.byTopic[organizationIamTopics.permission] ?? {}).length,
        permissionGroups: Object.keys(masterData?.byTopic[organizationIamTopics.permissionGroup] ?? {}).length,
        roleTemplates: Object.keys(masterData?.byTopic[organizationIamTopics.roleTemplate] ?? {}).length,
        featurePoints: Object.keys(masterData?.byTopic[organizationIamTopics.featurePoint] ?? {}).length,
        featureSwitches: Object.keys(masterData?.byTopic[organizationIamTopics.platformFeatureSwitch] ?? {}).length,
        resourceTags: Object.keys(masterData?.byTopic[organizationIamTopics.resourceTag] ?? {}).length,
        principalGroups: Object.keys(masterData?.byTopic[organizationIamTopics.principalGroup] ?? {}).length,
        groupMembers: Object.keys(masterData?.byTopic[organizationIamTopics.groupMember] ?? {}).length,
        groupRoleBindings: Object.keys(masterData?.byTopic[organizationIamTopics.groupRoleBinding] ?? {}).length,
        highRiskPolicies: Object.keys(masterData?.byTopic[organizationIamTopics.highRiskPermissionPolicy] ?? {}).length,
        sodRules: Object.keys(masterData?.byTopic[organizationIamTopics.separationOfDutyRule] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }),
)

export const selectIdentityProviders: (state: RootState) => IdentityProviderProfile[] = createSelector(
    [selectIdentityProviderProfiles],
    profiles => profiles,
)

export const selectCurrentPlatformProfile: (state: RootState) => PlatformProfile | undefined = createSelector(
    [selectPlatformRecords, selectTcpBindingSnapshot],
    (records, binding): PlatformProfile | undefined => findDataById<PlatformProfile>(
        records,
        'platform_id',
        binding.platformId,
    ) ?? records[0]?.data,
)

export const selectCurrentProjectProfile: (state: RootState) => ProjectProfile | undefined = createSelector(
    [selectProjectRecords, selectTcpBindingSnapshot],
    (records, binding): ProjectProfile | undefined => findDataById<ProjectProfile>(
        records,
        'project_id',
        binding.projectId,
    ) ?? records[0]?.data,
)

export const selectCurrentRegionProfile: (state: RootState) => RegionProfile | undefined = createSelector(
    [selectRegionRecords, selectCurrentProjectProfile, selectCurrentPlatformProfile],
    (records, project, platform): RegionProfile | undefined => {
        const regionId = project?.region_id
        const regionCode = project?.region?.region_code
        return records.find(record => record.data.region_id === regionId)?.data
            ?? records.find(record => record.data.region_code === regionCode)?.data
            ?? records.find(record => !platform?.platform_id || record.data.platform_id === platform.platform_id)?.data
    },
)

export const selectCurrentTenantProfile: (state: RootState) => TenantProfile | undefined = createSelector(
    [selectTenantRecords, selectTcpBindingSnapshot],
    (records, binding): TenantProfile | undefined => findDataById<TenantProfile>(
        records,
        'tenant_id',
        binding.tenantId,
    ) ?? records[0]?.data,
)

export const selectCurrentBrandProfile: (state: RootState) => BrandProfile | undefined = createSelector(
    [selectBrandRecords, selectTcpBindingSnapshot],
    (records, binding): BrandProfile | undefined => findDataById<BrandProfile>(
        records,
        'brand_id',
        binding.brandId,
    ) ?? records[0]?.data,
)

export const selectCurrentStoreProfile: (state: RootState) => StoreProfile | undefined = createSelector(
    [selectStoreRecords, selectTcpBindingSnapshot],
    (records, binding): StoreProfile | undefined => findDataById<StoreProfile>(
        records,
        'store_id',
        binding.storeId,
    ) ?? records[0]?.data,
)

export const selectCurrentActiveContract: (state: RootState) => ContractProfile | undefined = createSelector(
    [selectContractRecords, selectCurrentStoreProfile],
    (records, store): ContractProfile | undefined => records
        .map(record => record.data)
        .find(contract => contract.store_id === store?.store_id && contract.status !== 'INACTIVE')
        ?? records[0]?.data,
)

export const selectStoreEffectiveUsers: (state: RootState) => UserProfile[] = createSelector(
    [selectUserProfiles, selectCurrentStoreProfile],
    (users, store): UserProfile[] => users
        .filter(user => !store?.store_id || user.store_id === store.store_id)
)

export const selectCurrentStoreTables: (state: RootState) => TableProfile[] = createSelector(
    [selectTableProfiles, selectCurrentStoreProfile],
    (tables, store) => tables.filter(table => !store?.store_id || table.store_id === store.store_id),
)

export const selectCurrentStoreWorkstations: (state: RootState) => WorkstationProfile[] = createSelector(
    [selectWorkstationProfiles, selectCurrentStoreProfile],
    (workstations, store) => workstations.filter(workstation => !store?.store_id || workstation.store_id === store.store_id),
)

export const selectCurrentTenantBusinessEntities: (state: RootState) => BusinessEntityProfile[] = createSelector(
    [selectBusinessEntityProfiles, selectCurrentTenantProfile],
    (entities, tenant) => entities.filter(entity => !tenant?.tenant_id || entity.tenant_id === tenant.tenant_id),
)

export const selectStoreEffectiveRoles: (state: RootState) => RoleProfile[] = createSelector(
    [selectRoleProfiles],
    roles => roles,
)

export const selectStoreEffectivePermissions: (state: RootState) => PermissionProfile[] = createSelector(
    [selectPermissionProfiles],
    permissions => permissions,
)

export const selectStoreEffectiveUserRoleBindings: (state: RootState) => UserRoleBindingProfile[] = createSelector(
    [selectUserRoleBindingProfiles, selectCurrentStoreProfile],
    (bindings, store): UserRoleBindingProfile[] => bindings
        .filter(binding => !store?.store_id || binding.store_id === store.store_id)
)

export const selectAllPrincipalGroups: (state: RootState) => PrincipalGroupProfile[] = createSelector(
    [selectPrincipalGroupProfiles],
    groups => groups,
)

export const selectAllGroupMembers: (state: RootState) => GroupMemberProfile[] = createSelector(
    [selectGroupMemberProfiles],
    members => members,
)

export const selectAllGroupRoleBindings: (state: RootState) => GroupRoleBindingProfile[] = createSelector(
    [selectGroupRoleBindingProfiles],
    bindings => bindings,
)

export const selectAllResourceTags: (state: RootState) => ResourceTagProfile[] = createSelector(
    [selectResourceTagProfiles],
    tags => tags,
)

export const selectIamPolicyCatalog: (state: RootState) => {
    permissionGroups: PermissionGroupProfile[]
    roleTemplates: RoleTemplateProfile[]
    featurePoints: FeaturePointProfile[]
    featureSwitches: PlatformFeatureSwitchProfile[]
    authorizationSessions: AuthorizationSessionProfile[]
    separationOfDutyRules: SeparationOfDutyRuleProfile[]
    highRiskPolicies: HighRiskPermissionPolicyProfile[]
} = createSelector(
    [
        selectPermissionGroupProfiles,
        selectRoleTemplateProfiles,
        selectFeaturePointProfiles,
        selectPlatformFeatureSwitchProfiles,
        selectAuthorizationSessionProfiles,
        selectSeparationOfDutyRuleProfiles,
        selectHighRiskPermissionPolicyProfiles,
    ],
    (permissionGroups, roleTemplates, featurePoints, featureSwitches, authorizationSessions, separationOfDutyRules, highRiskPolicies) => ({
        permissionGroups,
        roleTemplates,
        featurePoints,
        featureSwitches,
        authorizationSessions,
        separationOfDutyRules,
        highRiskPolicies,
    }),
)

export const selectIamReadinessSummary: (state: RootState) => {
    readyForFutureLogin: boolean
    users: number
    roles: number
    permissions: number
    bindings: number
    groups: number
    groupBindings: number
    highRiskPolicies: number
} = createSelector(
    [
        selectStoreEffectiveUsers,
        selectStoreEffectiveRoles,
        selectStoreEffectivePermissions,
        selectStoreEffectiveUserRoleBindings,
        selectPrincipalGroupProfiles,
        selectGroupRoleBindingProfiles,
        selectHighRiskPermissionPolicyProfiles,
    ],
    (users, roles, permissions, bindings, groups, groupBindings, highRiskPolicies) => ({
        readyForFutureLogin: users.length > 0 && roles.length > 0 && permissions.length > 0 && bindings.length > 0,
        users: users.length,
        roles: roles.length,
        permissions: permissions.length,
        bindings: bindings.length,
        groups: groups.length,
        groupBindings: groupBindings.length,
        highRiskPolicies: highRiskPolicies.length,
    }),
)

const nodeTitle = (value: Record<string, unknown>, fallback: string) =>
    String(value.platform_name ?? value.project_name ?? value.tenant_name ?? value.brand_name ?? value.store_name ?? fallback)

const createTreeNode = (
    node: OrganizationTreeNode,
): OrganizationTreeNode => node

export const selectOrganizationTree: (state: RootState) => OrganizationTreeNode[] = createSelector(
    [
        selectPlatformProfiles,
        selectRegionProfiles,
        selectProjectProfiles,
        selectTenantProfiles,
        selectBrandProfiles,
        selectStoreProfiles,
        selectBusinessEntityProfiles,
        selectTableProfiles,
        selectWorkstationProfiles,
    ],
    (platforms, regions, projects, tenants, brands, stores, entities, tables, workstations): OrganizationTreeNode[] => platforms.map(platform => {
        const platformProjects = projects.filter(project => !project.platform_id || project.platform_id === platform.platform_id)
        const platformRegions = regions.filter(region => !region.platform_id || region.platform_id === platform.platform_id)
        const platformTenants = tenants.filter(tenant => !tenant.platform_id || tenant.platform_id === platform.platform_id)
        const platformBrands = brands.filter(brand => !brand.platform_id || brand.platform_id === platform.platform_id)
        const storesForProject = (projectId: string) => stores.filter(store => store.project_id === projectId)
        const storeChildren = (store: StoreProfile): OrganizationTreeNode[] => [
            ...tables
                .filter(table => table.store_id === store.store_id)
                .map(table => createTreeNode({
                    id: table.table_id,
                    type: 'table',
                    title: String(table.table_name ?? table.table_no ?? table.table_id),
                    status: table.table_status,
                    children: [],
                })),
            ...workstations
                .filter(workstation => workstation.store_id === store.store_id)
                .map(workstation => createTreeNode({
                    id: workstation.workstation_id,
                    type: 'workstation',
                    title: String(workstation.workstation_name ?? workstation.workstation_code ?? workstation.workstation_id),
                    status: workstation.status,
                    children: [],
                })),
        ]

        const projectNodes = platformProjects.map(project => createTreeNode({
            id: project.project_id,
            type: 'project',
            title: nodeTitle(project, project.project_id),
            status: project.status,
            children: storesForProject(project.project_id)
                .map(store => createTreeNode({
                    id: store.store_id,
                    type: 'store',
                    title: nodeTitle(store, store.store_id),
                    status: store.status,
                    children: storeChildren(store),
                })),
        }))

        const tenantNodes = platformTenants.map(tenant => createTreeNode({
            id: tenant.tenant_id,
            type: 'tenant',
            title: nodeTitle(tenant, tenant.tenant_id),
            status: tenant.status,
            children: [
                ...stores
                    .filter(store => store.tenant_id === tenant.tenant_id)
                    .map(store => createTreeNode({
                        id: store.store_id,
                        type: 'store',
                        title: nodeTitle(store, store.store_id),
                        status: store.status,
                        children: [],
                    })),
                ...entities
                    .filter(entity => entity.tenant_id === tenant.tenant_id)
                    .map(entity => createTreeNode({
                        id: entity.entity_id,
                        type: 'business-entity',
                        title: String(entity.entity_name ?? entity.entity_code ?? entity.entity_id),
                        status: entity.status,
                        children: [],
                    })),
            ],
        }))

        const brandNodes = platformBrands.map(brand => createTreeNode({
            id: brand.brand_id,
            type: 'brand',
            title: nodeTitle(brand, brand.brand_id),
            status: brand.status,
            children: stores
                .filter(store => store.brand_id === brand.brand_id)
                .map(store => createTreeNode({
                    id: store.store_id,
                    type: 'store',
                    title: nodeTitle(store, store.store_id),
                    status: store.status,
                    children: [],
                })),
        }))

        return createTreeNode({
        id: platform.platform_id,
        type: 'platform',
        title: nodeTitle(platform, platform.platform_id),
        status: platform.status,
        children: [
            ...platformRegions.map(region => createTreeNode({
                id: region.region_id,
                type: 'region',
                title: String(region.region_name ?? region.region_code ?? region.region_id),
                status: region.status,
                children: projectNodes.filter(project => {
                    const source = platformProjects.find(item => item.project_id === project.id)
                    return source?.region_id === region.region_id || source?.region?.region_code === region.region_code
                }),
            })),
            ...projectNodes.filter(project => {
                const source = platformProjects.find(item => item.project_id === project.id)
                return !source?.region_id && !source?.region?.region_code
            }),
            ...tenantNodes,
            ...brandNodes,
        ],
    })
    }),
)
