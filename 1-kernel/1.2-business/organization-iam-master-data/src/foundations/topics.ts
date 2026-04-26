import type {OrganizationIamProjectionKind, OrganizationIamTopic} from '../types'

export const organizationIamTopics = {
    platform: 'org.platform.profile',
    region: 'org.region.profile',
    project: 'org.project.profile',
    tenant: 'org.tenant.profile',
    brand: 'org.brand.profile',
    store: 'org.store.profile',
    contract: 'org.contract.active',
    businessEntity: 'org.business-entity.profile',
    table: 'org.table.profile',
    workstation: 'org.workstation.profile',
    identityProvider: 'iam.identity-provider.catalog',
    role: 'iam.role.catalog',
    permission: 'iam.permission.catalog',
    permissionGroup: 'iam.permission-group.catalog',
    roleTemplate: 'iam.role-template.catalog',
    featurePoint: 'iam.feature-point.catalog',
    platformFeatureSwitch: 'iam.platform-feature-switch.catalog',
    user: 'iam.user.store-effective',
    userRoleBinding: 'iam.user-role-binding.store-effective',
    resourceTag: 'iam.resource-tag.catalog',
    principalGroup: 'iam.principal-group.catalog',
    groupMember: 'iam.group-member.catalog',
    groupRoleBinding: 'iam.group-role-binding.store-effective',
    authorizationSession: 'iam.authorization-session.active',
    separationOfDutyRule: 'iam.sod-rule.catalog',
    highRiskPermissionPolicy: 'iam.high-risk-policy.catalog',
} as const satisfies Record<string, OrganizationIamTopic>

export const organizationIamTopicList = Object.values(organizationIamTopics)

export const organizationIamTopicSet = new Set<string>(organizationIamTopicList)

export const organizationIamProjectionKindByTopic: Record<OrganizationIamTopic, OrganizationIamProjectionKind> = {
    'org.platform.profile': 'organization',
    'org.region.profile': 'organization',
    'org.project.profile': 'organization',
    'org.tenant.profile': 'organization',
    'org.brand.profile': 'organization',
    'org.store.profile': 'organization',
    'org.contract.active': 'organization',
    'org.business-entity.profile': 'organization',
    'org.table.profile': 'organization',
    'org.workstation.profile': 'organization',
    'iam.identity-provider.catalog': 'iam',
    'iam.role.catalog': 'iam',
    'iam.permission.catalog': 'iam',
    'iam.permission-group.catalog': 'iam',
    'iam.role-template.catalog': 'iam',
    'iam.feature-point.catalog': 'iam',
    'iam.platform-feature-switch.catalog': 'iam',
    'iam.user.store-effective': 'iam',
    'iam.user-role-binding.store-effective': 'iam',
    'iam.resource-tag.catalog': 'iam',
    'iam.principal-group.catalog': 'iam',
    'iam.group-member.catalog': 'iam',
    'iam.group-role-binding.store-effective': 'iam',
    'iam.authorization-session.active': 'iam',
    'iam.sod-rule.catalog': 'iam',
    'iam.high-risk-policy.catalog': 'iam',
}

export const isOrganizationIamTopic = (topic: string): topic is OrganizationIamTopic =>
    organizationIamTopicSet.has(topic)
