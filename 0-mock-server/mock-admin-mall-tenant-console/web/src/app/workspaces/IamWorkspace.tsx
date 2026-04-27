import type {Dispatch, SetStateAction} from 'react'
import {JsonPanel, ResourceCard, TextField} from '../shared'
import type {
  AuthCapabilities,
  EntityItem,
  IamDraft,
  LastIamResult,
  StoreEffectiveIam,
  UserEffectivePermissions,
} from '../types'

type Props = {
  users: EntityItem[]
  permissions: EntityItem[]
  roles: EntityItem[]
  userRoleBindings: EntityItem[]
  storeEffectiveIam: StoreEffectiveIam | null
  userEffectivePermissions: UserEffectivePermissions | null
  iamDraft: IamDraft
  setIamDraft: Dispatch<SetStateAction<IamDraft>>
  iamActionLoading: boolean
  runIamWorkflow: () => Promise<void>
  runIamPermissionCheck: () => Promise<void>
  changeIamUserStatus: (nextStatus: 'ACTIVE' | 'SUSPENDED') => Promise<void>
  changeIamRoleStatus: (nextStatus: 'ACTIVE' | 'DEPRECATED') => Promise<void>
  revokeLatestIamBinding: () => Promise<void>
  authCapabilities: AuthCapabilities | null
  lastIamResult: LastIamResult | null
}

const readData = (item: EntityItem) => item.payload.data as Record<string, unknown>

const stringifyValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value ?? '—')
}

const Field = ({label, value}: {label: string; value: unknown}) => (
  <div>
    <span>{label}</span>
    <strong>{stringifyValue(value)}</strong>
  </div>
)

const StatusPill = ({value}: {value: string}) => (
  <span className={`pill ${value === 'ACTIVE' || value === 'ALLOWED' ? 'published' : value === 'DENIED' ? 'failed' : 'neutral'}`}>{value}</span>
)

export function IamWorkspace(props: Props) {
  const {
    users,
    permissions,
    roles,
    userRoleBindings,
    storeEffectiveIam,
    userEffectivePermissions,
    iamDraft,
    setIamDraft,
    iamActionLoading,
    runIamWorkflow,
    runIamPermissionCheck,
    changeIamUserStatus,
    changeIamRoleStatus,
    revokeLatestIamBinding,
    authCapabilities,
    lastIamResult,
  } = props

  const permissionDecision = lastIamResult?.permissionDecision ?? null
  const visibleUsers = storeEffectiveIam?.users ?? []
  const effectivePermissionCodes = userEffectivePermissions?.permissions.map(item => item.permissionCode) ?? []

  return (
    <>
      <article className="panel workspace-hero-card iam-hero-panel">
        <div className="panel-title">
          <div>
            <h3>用户与权限主链路</h3>
            <p className="panel-subtitle">对齐 design-v3 IAM：用户、角色、ORG_NODE 店铺范围绑定、有效权限与权限测试都由服务端 state/API 推导，页面只消费结果。</p>
          </div>
          <span>{users.length} users · {userRoleBindings.length} bindings</span>
        </div>
        <div className="facts-grid iam-facts-grid">
          <Field label="store-effective users" value={visibleUsers.length} />
          <Field label="effective binding keys" value={storeEffectiveIam?.bindingIds.length ?? 0} />
          <Field label="permission catalog" value={permissions.length} />
          <Field label="auth boundary" value={authCapabilities?.implemented ? 'implemented' : 'reserved'} />
        </div>
        <div className="org-form-grid compact iam-form-grid">
          <TextField label="Store" name="iamStoreId" value={iamDraft.storeId} onChange={value => setIamDraft(current => ({...current, storeId: value}))} />
          <TextField label="User Code" name="iamUserCode" value={iamDraft.userCode} onChange={value => setIamDraft(current => ({...current, userCode: value}))} />
          <TextField label="Display Name" name="iamDisplayName" value={iamDraft.displayName} onChange={value => setIamDraft(current => ({...current, displayName: value}))} />
          <TextField label="Mobile" name="iamMobile" value={iamDraft.mobile} onChange={value => setIamDraft(current => ({...current, mobile: value}))} />
          <TextField label="Role Code" name="iamRoleCode" value={iamDraft.roleCode} onChange={value => setIamDraft(current => ({...current, roleCode: value}))} />
          <TextField label="Role Name" name="iamRoleName" value={iamDraft.roleName} onChange={value => setIamDraft(current => ({...current, roleName: value}))} />
          <TextField label="Scope Type" name="iamScopeType" value={iamDraft.scopeType} onChange={value => setIamDraft(current => ({...current, scopeType: value}))} />
          <TextField label="Permission Id" name="iamPermissionId" value={iamDraft.permissionId} onChange={value => setIamDraft(current => ({...current, permissionId: value}))} />
          <TextField label="Permission Code" name="iamPermissionCode" value={iamDraft.permissionCode} onChange={value => setIamDraft(current => ({...current, permissionCode: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void runIamWorkflow()} disabled={iamActionLoading}>创建用户并绑定角色</button>
          <button onClick={() => void runIamPermissionCheck()} disabled={iamActionLoading}>重新测试权限</button>
          <button onClick={() => void changeIamUserStatus('SUSPENDED')} disabled={iamActionLoading}>暂停用户</button>
          <button onClick={() => void changeIamUserStatus('ACTIVE')} disabled={iamActionLoading}>恢复用户</button>
          <button onClick={() => void changeIamRoleStatus('DEPRECATED')} disabled={iamActionLoading}>废弃角色</button>
          <button onClick={() => void changeIamRoleStatus('ACTIVE')} disabled={iamActionLoading}>恢复角色</button>
          <button onClick={() => void revokeLatestIamBinding()} disabled={iamActionLoading}>撤销最近绑定</button>
        </div>
      </article>

      <article className="panel detail-panel iam-effective-panel">
        <div className="panel-title">
          <div>
            <h3>用户有效权限页</h3>
            <p className="panel-subtitle">服务端 `/api/v1/users/:userId/effective-permissions` 返回安全详情，密码哈希、MFA secret、refresh token 不进入响应。</p>
          </div>
          <span>{userEffectivePermissions ? userEffectivePermissions.user.userId : 'empty'}</span>
        </div>
        {userEffectivePermissions ? (
          <div className="iam-effective-layout">
            <div className="facts-grid iam-user-facts">
              <Field label="用户" value={userEffectivePermissions.user.displayName} />
              <Field label="用户编码" value={userEffectivePermissions.user.userCode} />
              <Field label="门店" value={userEffectivePermissions.storeId} />
              <Field label="状态" value={userEffectivePermissions.user.status} />
            </div>
            <div className="iam-section-list">
              <h4>角色来源与范围</h4>
              {userEffectivePermissions.bindings.map(binding => (
                <div className="iam-binding-row" key={binding.bindingId}>
                  <div>
                    <strong>{binding.role?.roleName ?? binding.roleId ?? 'Unknown role'}</strong>
                    <span>{binding.bindingId} · {binding.policyEffect} · {stringifyValue(binding.scopeSelector)}</span>
                  </div>
                  <StatusPill value={binding.status} />
                </div>
              ))}
            </div>
            <div className="iam-section-list">
              <h4>有效权限</h4>
              <div className="iam-permission-cloud">
                {effectivePermissionCodes.length > 0
                  ? effectivePermissionCodes.map(code => <span key={code}>{code}</span>)
                  : <em>当前用户在该 store 下暂无有效权限</em>}
              </div>
            </div>
            <div className="auth-card">
              <strong>Store-effective projection</strong>
              <p>{userEffectivePermissions.projection.userTopic} / {userEffectivePermissions.projection.bindingTopic}</p>
              <span>{userEffectivePermissions.projection.scopeType}:{userEffectivePermissions.projection.scopeKey} · item_key=user_id/binding_id · secretsIncluded={String(userEffectivePermissions.security.secretsIncluded)}</span>
            </div>
          </div>
        ) : (
          <p className="panel-subtitle">创建或选择一个用户后，页面会跟随 state 拉取有效权限详情。</p>
        )}
      </article>

      <article className="panel detail-panel iam-decision-panel">
        <div className="panel-title">
          <div>
            <h3>权限测试台</h3>
            <p className="panel-subtitle">展示 `/internal/auth/check-permission` 的人可读判定，不用 ad hoc UI 逻辑拼接结果。</p>
          </div>
          <span>{permissionDecision ? permissionDecision.reason : 'empty'}</span>
        </div>
        {permissionDecision ? (
          <div className="iam-decision-card">
            <StatusPill value={permissionDecision.allowed ? 'ALLOWED' : 'DENIED'} />
            <div className="facts-grid iam-decision-grid">
              <Field label="用户" value={permissionDecision.userId} />
              <Field label="门店" value={permissionDecision.storeId} />
              <Field label="权限" value={permissionDecision.permissionCode ?? permissionDecision.permissionId} />
              <Field label="命中角色" value={permissionDecision.matchedRoleIds.length} />
            </div>
            <p>判定原因：{permissionDecision.reason}；考虑绑定：{permissionDecision.bindingIdsConsidered.join(', ') || 'none'}；命中绑定：{permissionDecision.matchedBindingIds.join(', ') || 'none'}。</p>
          </div>
        ) : (
          <p className="panel-subtitle">点击“重新测试权限”后展示 allow/deny、命中角色和绑定证据。</p>
        )}
      </article>

      <article className="panel detail-panel iam-store-panel">
        <div className="panel-title">
          <div>
            <h3>店铺级范围授权页</h3>
            <p className="panel-subtitle">只开放本轮允许的 STORE_STAFF + ORG_NODE store 级绑定，同时显式保留后续治理字段。</p>
          </div>
          <span>{storeEffectiveIam?.storeId ?? iamDraft.storeId}</span>
        </div>
        <div className="iam-section-list">
          {visibleUsers.map(item => (
            <div className="iam-binding-row" key={item.user.userId}>
              <div>
                <strong>{item.user.displayName}</strong>
                <span>{item.user.userCode} · {item.bindings.length} bindings · {item.permissions.length} permissions</span>
              </div>
              <StatusPill value={item.user.status} />
            </div>
          ))}
          {visibleUsers.length === 0 && <p className="panel-subtitle">当前 store 尚无 store-effective 用户。</p>}
        </div>
      </article>

      <ResourceCard title="用户列表" count={users.length} items={users} />
      <ResourceCard title="系统角色 / 自定义角色目录" count={roles.length} items={roles} />
      <ResourceCard title="权限目录" count={permissions.length} items={permissions} />
      <ResourceCard title="角色绑定" count={userRoleBindings.length} items={userRoleBindings} />

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>登录协议预留页</h3>
            <p className="panel-subtitle">认证接口按 iam-service 边界显式预留；本阶段不实现终端登录 UI 和 session 下发。</p>
          </div>
          <span>{authCapabilities?.implemented ? 'ready' : 'reserved'}</span>
        </div>
        <div className="auth-card">
          <strong>{authCapabilities?.status ?? 'RESERVED'}</strong>
          <p>预留路由：{authCapabilities?.routes.join('、') ?? 'loading'}</p>
          <span>TDP path: {authCapabilities?.tdpPublishPath ?? 'terminal.user.session reserved'}</span>
        </div>
        <JsonPanel value={{storeEffectiveIam, userEffectivePermissions, lastIamResult}} />
      </article>
    </>
  )
}
