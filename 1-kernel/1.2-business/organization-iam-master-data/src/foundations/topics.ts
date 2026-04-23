import type {OrganizationIamProjectionKind, OrganizationIamTopic} from '../types'

export const organizationIamTopics = {
    platform: 'org.platform.profile',
    project: 'org.project.profile',
    tenant: 'org.tenant.profile',
    brand: 'org.brand.profile',
    store: 'org.store.profile',
    contract: 'org.contract.active',
    role: 'iam.role.catalog',
    permission: 'iam.permission.catalog',
    user: 'iam.user.store-effective',
    userRoleBinding: 'iam.user-role-binding.store-effective',
} as const satisfies Record<string, OrganizationIamTopic>

export const organizationIamTopicList = Object.values(organizationIamTopics)

export const organizationIamTopicSet = new Set<string>(organizationIamTopicList)

export const organizationIamProjectionKindByTopic: Record<OrganizationIamTopic, OrganizationIamProjectionKind> = {
    'org.platform.profile': 'organization',
    'org.project.profile': 'organization',
    'org.tenant.profile': 'organization',
    'org.brand.profile': 'organization',
    'org.store.profile': 'organization',
    'org.contract.active': 'organization',
    'iam.role.catalog': 'iam',
    'iam.permission.catalog': 'iam',
    'iam.user.store-effective': 'iam',
    'iam.user-role-binding.store-effective': 'iam',
}

export const isOrganizationIamTopic = (topic: string): topic is OrganizationIamTopic =>
    organizationIamTopicSet.has(topic)
