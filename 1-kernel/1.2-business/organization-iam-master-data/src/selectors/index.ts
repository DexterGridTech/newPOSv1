import type {RootState} from '@impos2/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {ORGANIZATION_IAM_MASTER_DATA_STATE_KEY, getOrganizationIamRecordsByTopic} from '../features/slices/masterData'
import {organizationIamTopics} from '../foundations/topics'
import type {
    BrandProfile,
    ContractProfile,
    OrganizationIamMasterDataRecord,
    OrganizationIamMasterDataState,
    OrganizationTreeNode,
    PermissionProfile,
    PlatformProfile,
    ProjectProfile,
    RoleProfile,
    StoreProfile,
    TenantProfile,
    UserProfile,
    UserRoleBindingProfile,
} from '../types'

export const selectOrganizationIamMasterDataState = (
    state: RootState,
) => state[ORGANIZATION_IAM_MASTER_DATA_STATE_KEY as keyof RootState] as OrganizationIamMasterDataState | undefined

const activeRecords = <TData extends Record<string, unknown>>(
    state: RootState,
    topic: Parameters<typeof getOrganizationIamRecordsByTopic>[1],
) => getOrganizationIamRecordsByTopic(selectOrganizationIamMasterDataState(state), topic)
    .filter(record => !record.tombstone)
    .map(record => record as OrganizationIamMasterDataRecord<TData>)

const findDataById = <TData extends Record<string, unknown>>(
    records: OrganizationIamMasterDataRecord<TData>[],
    field: string,
    id?: string,
) => records.find(record => record.data[field] === id)?.data

export const selectOrganizationIamDiagnostics = (state: RootState) =>
    selectOrganizationIamMasterDataState(state)?.diagnostics ?? []

export const selectOrganizationIamAllRecords = (state: RootState) =>
    Object.values(selectOrganizationIamMasterDataState(state)?.byTopic ?? {})
        .flatMap(records => Object.values(records ?? {}))

export const selectOrganizationIamSummary = (state: RootState) => {
    const masterData = selectOrganizationIamMasterDataState(state)
    return {
        platforms: Object.keys(masterData?.byTopic[organizationIamTopics.platform] ?? {}).length,
        projects: Object.keys(masterData?.byTopic[organizationIamTopics.project] ?? {}).length,
        tenants: Object.keys(masterData?.byTopic[organizationIamTopics.tenant] ?? {}).length,
        brands: Object.keys(masterData?.byTopic[organizationIamTopics.brand] ?? {}).length,
        stores: Object.keys(masterData?.byTopic[organizationIamTopics.store] ?? {}).length,
        users: Object.keys(masterData?.byTopic[organizationIamTopics.user] ?? {}).length,
        roles: Object.keys(masterData?.byTopic[organizationIamTopics.role] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }
}

export const selectCurrentPlatformProfile = (state: RootState): PlatformProfile | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    return findDataById<PlatformProfile>(
        activeRecords(state, organizationIamTopics.platform),
        'platform_id',
        binding.platformId,
    ) ?? activeRecords<PlatformProfile>(state, organizationIamTopics.platform)[0]?.data
}

export const selectCurrentProjectProfile = (state: RootState): ProjectProfile | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    return findDataById<ProjectProfile>(
        activeRecords(state, organizationIamTopics.project),
        'project_id',
        binding.projectId,
    ) ?? activeRecords<ProjectProfile>(state, organizationIamTopics.project)[0]?.data
}

export const selectCurrentTenantProfile = (state: RootState): TenantProfile | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    return findDataById<TenantProfile>(
        activeRecords(state, organizationIamTopics.tenant),
        'tenant_id',
        binding.tenantId,
    ) ?? activeRecords<TenantProfile>(state, organizationIamTopics.tenant)[0]?.data
}

export const selectCurrentBrandProfile = (state: RootState): BrandProfile | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    return findDataById<BrandProfile>(
        activeRecords(state, organizationIamTopics.brand),
        'brand_id',
        binding.brandId,
    ) ?? activeRecords<BrandProfile>(state, organizationIamTopics.brand)[0]?.data
}

export const selectCurrentStoreProfile = (state: RootState): StoreProfile | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    return findDataById<StoreProfile>(
        activeRecords(state, organizationIamTopics.store),
        'store_id',
        binding.storeId,
    ) ?? activeRecords<StoreProfile>(state, organizationIamTopics.store)[0]?.data
}

export const selectCurrentActiveContract = (state: RootState): ContractProfile | undefined => {
    const store = selectCurrentStoreProfile(state)
    return activeRecords<ContractProfile>(state, organizationIamTopics.contract)
        .map(record => record.data)
        .find(contract => contract.store_id === store?.store_id && contract.status !== 'INACTIVE')
        ?? activeRecords<ContractProfile>(state, organizationIamTopics.contract)[0]?.data
}

export const selectStoreEffectiveUsers = (state: RootState): UserProfile[] => {
    const store = selectCurrentStoreProfile(state)
    return activeRecords<UserProfile>(state, organizationIamTopics.user)
        .map(record => record.data)
        .filter(user => !store?.store_id || user.store_id === store.store_id)
}

export const selectStoreEffectiveRoles = (state: RootState): RoleProfile[] =>
    activeRecords<RoleProfile>(state, organizationIamTopics.role).map(record => record.data)

export const selectStoreEffectivePermissions = (state: RootState): PermissionProfile[] =>
    activeRecords<PermissionProfile>(state, organizationIamTopics.permission).map(record => record.data)

export const selectStoreEffectiveUserRoleBindings = (state: RootState): UserRoleBindingProfile[] => {
    const store = selectCurrentStoreProfile(state)
    return activeRecords<UserRoleBindingProfile>(state, organizationIamTopics.userRoleBinding)
        .map(record => record.data)
        .filter(binding => !store?.store_id || binding.store_id === store.store_id)
}

export const selectIamReadinessSummary = (state: RootState) => {
    const users = selectStoreEffectiveUsers(state)
    const roles = selectStoreEffectiveRoles(state)
    const permissions = selectStoreEffectivePermissions(state)
    const bindings = selectStoreEffectiveUserRoleBindings(state)
    return {
        readyForFutureLogin: users.length > 0 && roles.length > 0 && permissions.length > 0 && bindings.length > 0,
        users: users.length,
        roles: roles.length,
        permissions: permissions.length,
        bindings: bindings.length,
    }
}

const nodeTitle = (value: Record<string, unknown>, fallback: string) =>
    String(value.platform_name ?? value.project_name ?? value.tenant_name ?? value.brand_name ?? value.store_name ?? fallback)

export const selectOrganizationTree = (state: RootState): OrganizationTreeNode[] => {
    const platforms = activeRecords<PlatformProfile>(state, organizationIamTopics.platform).map(record => record.data)
    const projects = activeRecords<ProjectProfile>(state, organizationIamTopics.project).map(record => record.data)
    const tenants = activeRecords<TenantProfile>(state, organizationIamTopics.tenant).map(record => record.data)
    const brands = activeRecords<BrandProfile>(state, organizationIamTopics.brand).map(record => record.data)
    const stores = activeRecords<StoreProfile>(state, organizationIamTopics.store).map(record => record.data)

    return platforms.map(platform => ({
        id: platform.platform_id,
        type: 'platform',
        title: nodeTitle(platform, platform.platform_id),
        status: platform.status,
        children: projects
            .filter(project => !project.platform_id || project.platform_id === platform.platform_id)
            .map(project => ({
                id: project.project_id,
                type: 'project',
                title: nodeTitle(project, project.project_id),
                status: project.status,
                children: tenants
                    .filter(tenant => !tenant.platform_id || tenant.platform_id === platform.platform_id)
                    .map(tenant => ({
                        id: tenant.tenant_id,
                        type: 'tenant',
                        title: nodeTitle(tenant, tenant.tenant_id),
                        status: tenant.status,
                        children: brands
                            .filter(brand => brand.tenant_id === tenant.tenant_id)
                            .map(brand => ({
                                id: brand.brand_id,
                                type: 'brand',
                                title: nodeTitle(brand, brand.brand_id),
                                status: brand.status,
                                children: stores
                                    .filter(store => store.brand_id === brand.brand_id && store.project_id === project.project_id)
                                    .map(store => ({
                                        id: store.store_id,
                                        type: 'store',
                                        title: nodeTitle(store, store.store_id),
                                        status: store.status,
                                        children: [],
                                    })),
                            })),
                    })),
            })),
    }))
}
