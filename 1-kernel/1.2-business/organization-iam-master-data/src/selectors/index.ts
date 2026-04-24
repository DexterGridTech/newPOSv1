import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {ORGANIZATION_IAM_MASTER_DATA_STATE_KEY, getOrganizationIamRecordsByTopic} from '../features/slices/masterData'
import {organizationIamTopics} from '../foundations/topics'
import type {
    BrandProfile,
    BusinessEntityProfile,
    ContractProfile,
    OrganizationIamDiagnosticsEntry,
    OrganizationIamMasterDataRecord,
    OrganizationIamMasterDataState,
    OrganizationTreeNode,
    PermissionProfile,
    PlatformProfile,
    ProjectProfile,
    RoleProfile,
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
const selectProjectRecords = createActiveRecordSelector<ProjectProfile>(organizationIamTopics.project)
const selectTenantRecords = createActiveRecordSelector<TenantProfile>(organizationIamTopics.tenant)
const selectBrandRecords = createActiveRecordSelector<BrandProfile>(organizationIamTopics.brand)
const selectStoreRecords = createActiveRecordSelector<StoreProfile>(organizationIamTopics.store)
const selectContractRecords = createActiveRecordSelector<ContractProfile>(organizationIamTopics.contract)
const selectBusinessEntityRecords = createActiveRecordSelector<BusinessEntityProfile>(organizationIamTopics.businessEntity)
const selectTableRecords = createActiveRecordSelector<TableProfile>(organizationIamTopics.table)
const selectWorkstationRecords = createActiveRecordSelector<WorkstationProfile>(organizationIamTopics.workstation)
const selectPlatformProfiles = createActiveDataSelector<PlatformProfile>(organizationIamTopics.platform)
const selectProjectProfiles = createActiveDataSelector<ProjectProfile>(organizationIamTopics.project)
const selectTenantProfiles = createActiveDataSelector<TenantProfile>(organizationIamTopics.tenant)
const selectBrandProfiles = createActiveDataSelector<BrandProfile>(organizationIamTopics.brand)
const selectStoreProfiles = createActiveDataSelector<StoreProfile>(organizationIamTopics.store)
const selectBusinessEntityProfiles = createActiveDataSelector<BusinessEntityProfile>(organizationIamTopics.businessEntity)
const selectTableProfiles = createActiveDataSelector<TableProfile>(organizationIamTopics.table)
const selectWorkstationProfiles = createActiveDataSelector<WorkstationProfile>(organizationIamTopics.workstation)
const selectRoleProfiles = createActiveDataSelector<RoleProfile>(organizationIamTopics.role)
const selectPermissionProfiles = createActiveDataSelector<PermissionProfile>(organizationIamTopics.permission)
const selectUserProfiles = createActiveDataSelector<UserProfile>(organizationIamTopics.user)
const selectUserRoleBindingProfiles = createActiveDataSelector<UserRoleBindingProfile>(organizationIamTopics.userRoleBinding)

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
    projects: number
    tenants: number
    brands: number
    stores: number
    users: number
    roles: number
    diagnostics: number
    lastChangedAt?: number
} = createSelector(
    [selectOrganizationIamMasterDataState],
    masterData => ({
        platforms: Object.keys(masterData?.byTopic[organizationIamTopics.platform] ?? {}).length,
        projects: Object.keys(masterData?.byTopic[organizationIamTopics.project] ?? {}).length,
        tenants: Object.keys(masterData?.byTopic[organizationIamTopics.tenant] ?? {}).length,
        brands: Object.keys(masterData?.byTopic[organizationIamTopics.brand] ?? {}).length,
        stores: Object.keys(masterData?.byTopic[organizationIamTopics.store] ?? {}).length,
        businessEntities: Object.keys(masterData?.byTopic[organizationIamTopics.businessEntity] ?? {}).length,
        tables: Object.keys(masterData?.byTopic[organizationIamTopics.table] ?? {}).length,
        workstations: Object.keys(masterData?.byTopic[organizationIamTopics.workstation] ?? {}).length,
        users: Object.keys(masterData?.byTopic[organizationIamTopics.user] ?? {}).length,
        roles: Object.keys(masterData?.byTopic[organizationIamTopics.role] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }),
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

export const selectIamReadinessSummary: (state: RootState) => {
    readyForFutureLogin: boolean
    users: number
    roles: number
    permissions: number
    bindings: number
} = createSelector(
    [
        selectStoreEffectiveUsers,
        selectStoreEffectiveRoles,
        selectStoreEffectivePermissions,
        selectStoreEffectiveUserRoleBindings,
    ],
    (users, roles, permissions, bindings) => ({
        readyForFutureLogin: users.length > 0 && roles.length > 0 && permissions.length > 0 && bindings.length > 0,
        users: users.length,
        roles: roles.length,
        permissions: permissions.length,
        bindings: bindings.length,
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
        selectProjectProfiles,
        selectTenantProfiles,
        selectBrandProfiles,
        selectStoreProfiles,
        selectCurrentTenantBusinessEntities,
        selectCurrentStoreTables,
        selectCurrentStoreWorkstations,
    ],
    (platforms, projects, tenants, brands, stores, entities, tables, workstations): OrganizationTreeNode[] => platforms.map(platform => createTreeNode({
        id: platform.platform_id,
        type: 'platform',
        title: nodeTitle(platform, platform.platform_id),
        status: platform.status,
        children: projects
            .filter(project => !project.platform_id || project.platform_id === platform.platform_id)
            .map(project => createTreeNode({
                id: project.project_id,
                type: 'project',
                title: nodeTitle(project, project.project_id),
                status: project.status,
                children: tenants
                    .filter(tenant => !tenant.platform_id || tenant.platform_id === platform.platform_id)
                    .map(tenant => createTreeNode({
                        id: tenant.tenant_id,
                        type: 'tenant',
                        title: nodeTitle(tenant, tenant.tenant_id),
                        status: tenant.status,
                        children: brands
                            .filter(brand => brand.tenant_id === tenant.tenant_id)
                            .map(brand => createTreeNode({
                                id: brand.brand_id,
                                type: 'brand',
                                title: nodeTitle(brand, brand.brand_id),
                                status: brand.status,
                                children: stores
                                    .filter(store => store.brand_id === brand.brand_id && store.project_id === project.project_id)
                                    .map(store => createTreeNode({
                                        id: store.store_id,
                                        type: 'store',
                                        title: nodeTitle(store, store.store_id),
                                        status: store.status,
                                        children: [
                                            ...tables
                                                .filter(table => table.store_id === store.store_id)
                                                .map(table => createTreeNode({
                                                    id: table.table_id,
                                                    type: 'table',
                                                    title: String(table.table_no ?? table.table_id),
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
                                        ],
                                    })),
                            }))
                            .concat(entities
                                .filter(entity => entity.tenant_id === tenant.tenant_id)
                                .map(entity => createTreeNode({
                                    id: entity.entity_id,
                                    type: 'business-entity',
                                    title: String(entity.entity_name ?? entity.entity_code ?? entity.entity_id),
                                    status: entity.status,
                                    children: [],
                                }))),
                    })),
            })),
    })),
)
