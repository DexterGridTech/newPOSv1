import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')
const webSrc = path.join(repoRoot, '0-mock-server/mock-admin-mall-tenant-console/web/src')

const read = relativePath => fs.readFileSync(path.join(webSrc, relativePath), 'utf8')

const files = {
  api: read('api.ts'),
  state: read('app/useAdminConsoleState.ts'),
  workspace: read('app/workspaces/IamWorkspace.tsx'),
  app: read('customer/CustomerAdminApp.tsx'),
  collectionPage: read('customer/pages/CollectionPage.tsx'),
  collectionModel: read('customer/pages/collectionModel.tsx'),
  constants: read('customer/constants.ts'),
  detail: read('customer/modals/DetailModal.tsx'),
  domain: read('customer/domain.ts'),
  metadata: read('customer/metadata.ts'),
  types: read('customer/types.ts'),
  forms: read('customer/modals/EntityFormModal.tsx'),
}

const iamPages = [
  ['identityProviderConfigs', '身份源'],
  ['permissionGroups', '权限分组'],
  ['roleTemplates', '角色模板'],
  ['featurePoints', '功能点'],
  ['platformFeatureSwitches', '功能开关'],
  ['resourceTags', '资源标签'],
  ['principalGroups', '用户组'],
  ['groupMembers', '组成员'],
  ['groupRoleBindings', '组授权'],
  ['authorizationSessions', '授权会话'],
  ['sodRules', 'SoD'],
  ['highRiskPolicies', '高风险策略'],
  ['authAuditLogs', '鉴权审计'],
]

const apiMethods = [
  'getIdentityProviderConfigs',
  'createIdentityProviderConfig',
  'getPermissionGroups',
  'createPermissionGroup',
  'getRoleTemplates',
  'createRoleTemplate',
  'getFeaturePoints',
  'createFeaturePoint',
  'getPlatformFeatureSwitches',
  'upsertPlatformFeatureSwitch',
  'getResourceTags',
  'createResourceTag',
  'getPrincipalGroups',
  'createPrincipalGroup',
  'getGroupMembers',
  'addGroupMember',
  'getGroupRoleBindings',
  'createGroupRoleBinding',
  'getAuthorizationSessions',
  'deprecateRole',
  'getSeparationOfDutyRules',
  'createSeparationOfDutyRule',
  'getHighRiskPermissionPolicies',
  'createHighRiskPermissionPolicy',
  'getAuthAuditLogs',
]

test('customer IAM navigation and state expose design-v3 governance entities', () => {
  for (const [page, label] of iamPages) {
    assert.match(files.types, new RegExp(`\\| '${page}'`), `${page} must be a PageKey/CollectionKey`)
    assert.match(files.constants, new RegExp(`${page}: \\[\\]`), `${page} must be initialized in emptyCollections`)
    assert.match(files.constants, new RegExp(`key: '${page}', label: '${label}`), `${page} must be visible in IAM nav`)
    assert.match(files.constants, new RegExp(`${page}: \\{title:`), `${page} must have page metadata`)
  }
})

test('customer API client wraps all backend IAM routes used by the console', () => {
  for (const method of apiMethods) {
    assert.match(files.api, new RegExp(`${method}:`), `${method} must be exposed by api client`)
  }
})

test('core IAM forms expose identity, scope selector, risk, and governance fields', () => {
  const requiredFormFields = [
    'username',
    'email',
    'userType',
    'identitySource',
    'externalUserId',
    'resourceType',
    'action',
    'scopeType',
    'permissionGroupId',
    'featureFlag',
    'highRisk',
    'policyEffect',
    'scopeSelector',
    'effectiveTo',
    'approvalId',
    'groupCode',
    'conflictingPermCodes',
    'requireMfa',
    'bindDn',
    'bindPasswordEncrypted',
    'clientSecretEncrypted',
    'appSecretEncrypted',
  ]

  for (const field of requiredFormFields) {
    assert.match(files.forms, new RegExp(`name: '${field}'`), `${field} must be configurable in IAM forms`)
  }
})

test('IAM status and identity-provider options match design-v3 state machines', () => {
  assert.match(files.metadata, /idpTypes: \['LOCAL', 'LDAP', 'OIDC', 'SAML', 'WECHAT_WORK', 'DINGTALK'\]/, 'IdP type options must include SAML')
  assert.match(files.constants, /LDAP、OIDC、SAML 与企业协同身份接入配置/, 'IdP page scope text should mention SAML')
  assert.match(files.metadata, /idpStatuses: \[option\('ACTIVE'\), option\('DISABLED', '已禁用'\)\]/, 'IdP edit status must use ACTIVE/DISABLED')
  assert.match(files.metadata, /userStatuses: \['ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED'\]/, 'user edit status must expose design-v3 user states')
  assert.match(files.metadata, /roleStatuses: \['ACTIVE', 'DEPRECATED'\]/, 'role edit status must expose design-v3 role states')
  assert.match(files.metadata, /filterStatuses:[^\n]*'LOCKED'[^\n]*'DELETED'[^\n]*'DEPRECATED'[^\n]*'DISABLED'[^\n]*'REVOKED'/, 'status filter must include IAM lifecycle states')
  assert.match(files.forms, /DELETED 是软删除终态/, 'user DELETED terminal semantics should be visible in edit form')
  assert.match(files.metadata, /LOCKED: '已锁定'/, 'LOCKED must be translated')
  assert.match(files.metadata, /DELETED: '已删除'/, 'DELETED must be translated')
  assert.match(files.metadata, /DEPRECATED: '已废弃'/, 'DEPRECATED must be translated')
  assert.match(files.state, /changeIamRoleStatus = async \(nextStatus: 'ACTIVE' \| 'DEPRECATED'\)/, 'workbench role lifecycle should use deprecated state')
  assert.match(files.state, /api\.deprecateRole/, 'workbench should call the deprecate role API')
  assert.match(files.workspace, /changeIamRoleStatus: \(nextStatus: 'ACTIVE' \| 'DEPRECATED'\)/, 'workbench prop type should use deprecated state')
  assert.match(files.workspace, /废弃角色/, 'workbench role lifecycle button should say deprecated')
  assert.doesNotMatch(files.workspace, /暂停角色/, 'workbench should not present role suspend terminology')
})

test('IAM lists expose design-v3 operational filters and readonly affordances', () => {
  const requiredFilters = [
    '关联功能点',
    '风险控制',
    '身份来源',
    '身份源类型',
    '定时同步',
    '推荐范围',
    '模板状态',
    '功能点',
    '用户组类型',
    '成员来源',
    'MFA 状态',
    '管控要求',
    '策略状态',
  ]
  for (const label of requiredFilters) {
    assert.match(files.collectionPage, new RegExp(label), `${label} filter must be rendered`)
  }
  for (const stateKey of ['identitySource', 'idpType', 'featureCode', 'enabledState', 'groupType', 'groupMemberSource', 'riskControl', 'mfaState']) {
    assert.match(files.types, new RegExp(`${stateKey}: string`), `${stateKey} must be in FilterState`)
    assert.match(files.constants, new RegExp(`${stateKey}: 'ALL'`), `${stateKey} must reset with emptyFilter`)
    assert.match(files.collectionModel, new RegExp(`filter\\.${stateKey} !== 'ALL'`), `${stateKey} must affect list filtering`)
  }
  assert.match(files.types, /groupId: string/, 'groupId must be in FilterState')
  assert.match(files.constants, /groupId: 'ALL'/, 'groupId must reset with emptyFilter')
  assert.match(files.collectionModel, /filter\.groupId !== 'ALL'/, 'groupId must affect group member and group binding filters')
  assert.match(files.collectionPage, /value=\{value\.groupId\}/, 'group filters must not reuse the user filter state')
  assert.match(files.collectionPage, /系统权限由平台内置维护/, 'system permissions should be explained as readonly')
  assert.match(files.collectionPage, /系统角色由平台内置维护/, 'system roles should be explained as readonly')
  assert.match(files.collectionPage, /授权会话由鉴权流程产生，只能查看/, 'authorization sessions should be explained as readonly')
  assert.match(files.collectionPage, /授权会话由鉴权流程产生，可以调整筛选条件查看历史会话。/, 'authorization session empty state should not imply manual creation')
  assert.match(files.collectionPage, /鉴权审计由系统写入，可以调整筛选条件查看历史决策。/, 'audit log empty state should not imply manual creation')
  assert.match(files.detail, /鉴权审计由系统写入，只能查看/, 'audit logs should be readonly in detail modal')
  assert.match(files.detail, /授权会话由鉴权流程产生，只能查看/, 'authorization sessions should be readonly in detail modal')
})

test('IAM create forms use business controls instead of JSON for common permission choices', () => {
  assert.match(files.forms, /name: 'permissionIds', label: '初始权限', type: 'multi-select'/, 'role create should use permission checkboxes')
  assert.match(files.forms, /name: 'basePermissionIds', label: '基础权限', type: 'multi-select'/, 'role template create should use permission checkboxes')
  assert.match(files.forms, /name: 'conflictingRoleCodes', label: '冲突角色编码', type: 'multi-select'/, 'SoD role conflicts should use selectable role codes')
  assert.match(files.forms, /name: 'conflictingPermCodes', label: '冲突权限编码', type: 'multi-select'/, 'SoD permission conflicts should use selectable permission codes')
  assert.match(files.forms, /系统权限由平台内置维护/, 'custom permission create should not offer system permission creation')
  assert.match(files.forms, /系统角色由平台内置维护/, 'custom role create should not offer system role creation')
  assert.match(files.forms, /name: 'permission_type'[\s\S]*readonly: true[\s\S]*系统权限由平台内置维护/, 'permission type/source should be readonly after creation')
  assert.match(files.forms, /name: 'role_type'[\s\S]*readonly: true[\s\S]*系统角色由平台内置维护/, 'role source should be readonly after creation')
  assert.match(files.constants, /const editablePages[\s\S]*'roleBindings'/, 'user role bindings must expose the header create flow')
  assert.doesNotMatch(files.constants, /authorizationSessions:[^\n]*createLabel/, 'authorization sessions should not expose a create button')
  assert.doesNotMatch(files.constants, /'authorizationSessions',\n\s*'sodRules'/, 'authorization sessions should not be editable from the console')
  assert.doesNotMatch(files.api, /createAuthorizationSession:/, 'browser console should not expose manual authorization session creation')
  assert.doesNotMatch(files.forms, /authorizationSessions: \[\{name: 'userId'/, 'authorization session create form should not exist')
})

test('IAM details use business labels and row relation modals close without stale detail resurfacing', () => {
  const requiredLabels = [
    '权限来源',
    '关联功能点',
    '高风险权限',
    '身份来源',
    '外部用户 ID',
    '身份源类型',
    '用户组类型',
    '组授权记录',
    'MFA 验证时间',
    '审批角色',
    '鉴权结果',
  ]
  for (const label of requiredLabels) {
    assert.match(files.domain, new RegExp(label), `${label} must be translated in IAM details`)
  }
  assert.match(files.app, /relationModalOrigin/, 'relation modal origin must be tracked')
  assert.match(files.app, /relationModalOrigin === 'row'/, 'row-opened relation modals should clear selected record on close')
  assert.match(files.app, /setRelationModalOrigin\('detail'\)/, 'detail-opened relation modals should return to detail after close')
})
