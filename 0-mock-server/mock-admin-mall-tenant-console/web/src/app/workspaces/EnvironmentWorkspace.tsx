import type {Dispatch, SetStateAction} from 'react'
import {JsonPanel, ResourceCard, TextField} from '../shared'
import type {
  AuthCapabilities,
  EntityItem,
  LastEnvironmentResult,
  LegacyDocument,
  OutboxItem,
  EnvironmentDraft,
} from '../types'

type Props = {
  sandboxes: EntityItem[]
  platforms: EntityItem[]
  projects: EntityItem[]
  documents: LegacyDocument[]
  outbox: OutboxItem[]
  authCapabilities: AuthCapabilities | null
  environmentDraft: EnvironmentDraft
  setEnvironmentDraft: Dispatch<SetStateAction<EnvironmentDraft>>
  environmentActionLoading: boolean
  lastEnvironmentResult: LastEnvironmentResult | null
  environmentSummary: {
    activeSandboxes: number
    activePlatforms: number
    activeProjects: number
    maskedCredentialPlatforms: number
  }
  pendingCount: number
  runEnvironmentSetup: () => Promise<void>
  cycleEnvironmentLifecycle: (target: 'sandbox' | 'platform' | 'project', nextAction: 'activate' | 'suspend' | 'close') => Promise<void>
  applyDemoChange: () => Promise<void>
  rebuildOutbox: (publishAfterRebuild: boolean) => Promise<void>
}

export function EnvironmentWorkspace(props: Props) {
  const {
    sandboxes,
    platforms,
    projects,
    documents,
    outbox,
    authCapabilities,
    environmentDraft,
    setEnvironmentDraft,
    environmentActionLoading,
    lastEnvironmentResult,
    environmentSummary,
    pendingCount,
    runEnvironmentSetup,
    cycleEnvironmentLifecycle,
    applyDemoChange,
    rebuildOutbox,
  } = props

  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>系统初始化向导</h3>
            <p className="panel-subtitle">补齐 sandbox / platform / project 的 aligned 入口，并把 ISV 凭据留在管理端掩码视图，不混入 terminal TDP payload。</p>
          </div>
          <span>{sandboxes.length + platforms.length + projects.length}</span>
        </div>
        <div className="facts-grid">
          <div><span>Active Sandbox</span><strong>{environmentSummary.activeSandboxes}</strong></div>
          <div><span>Active Platform</span><strong>{environmentSummary.activePlatforms}</strong></div>
          <div><span>Active Project</span><strong>{environmentSummary.activeProjects}</strong></div>
          <div><span>Masked ISV</span><strong>{environmentSummary.maskedCredentialPlatforms}</strong></div>
        </div>
        <div className="org-form-grid">
          <TextField label="Sandbox Code" name="sandboxCode" value={environmentDraft.sandboxCode} onChange={value => setEnvironmentDraft(current => ({...current, sandboxCode: value}))} />
          <TextField label="Sandbox 名称" name="sandboxName" value={environmentDraft.sandboxName} onChange={value => setEnvironmentDraft(current => ({...current, sandboxName: value}))} />
          <TextField label="Sandbox Type" name="sandboxType" value={environmentDraft.sandboxType} onChange={value => setEnvironmentDraft(current => ({...current, sandboxType: value}))} />
          <TextField label="Owner" name="sandboxOwner" value={environmentDraft.sandboxOwner} onChange={value => setEnvironmentDraft(current => ({...current, sandboxOwner: value}))} />
          <TextField label="Platform Code" name="platformCode" value={environmentDraft.platformCode} onChange={value => setEnvironmentDraft(current => ({...current, platformCode: value}))} />
          <TextField label="Platform 名称" name="platformName" value={environmentDraft.platformName} onChange={value => setEnvironmentDraft(current => ({...current, platformName: value}))} />
          <TextField label="Project Code" name="projectCode" value={environmentDraft.projectCode} onChange={value => setEnvironmentDraft(current => ({...current, projectCode: value}))} />
          <TextField label="Project 名称" name="projectName" value={environmentDraft.projectName} onChange={value => setEnvironmentDraft(current => ({...current, projectName: value}))} />
          <TextField label="Region Code" name="projectRegionCode" value={environmentDraft.projectRegionCode} onChange={value => setEnvironmentDraft(current => ({...current, projectRegionCode: value}))} />
          <TextField label="Region Name" name="projectRegionName" value={environmentDraft.projectRegionName} onChange={value => setEnvironmentDraft(current => ({...current, projectRegionName: value}))} />
          <TextField label="ISV App Key" name="isvAppKey" value={environmentDraft.isvAppKey} onChange={value => setEnvironmentDraft(current => ({...current, isvAppKey: value}))} />
          <TextField label="ISV Token" name="isvToken" value={environmentDraft.isvToken} onChange={value => setEnvironmentDraft(current => ({...current, isvToken: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void runEnvironmentSetup()} disabled={environmentActionLoading}>执行初始化向导</button>
          <button onClick={() => void cycleEnvironmentLifecycle('sandbox', 'suspend')} disabled={environmentActionLoading}>暂停 Sandbox</button>
          <button onClick={() => void cycleEnvironmentLifecycle('platform', 'suspend')} disabled={environmentActionLoading}>暂停平台</button>
          <button onClick={() => void cycleEnvironmentLifecycle('project', 'suspend')} disabled={environmentActionLoading}>暂停项目</button>
        </div>
      </article>

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>环境就绪度与兼容入口</h3>
            <p className="panel-subtitle">Initialization can run once, legacy routes remain compatibility-only, terminal auth stays explicitly reserved.</p>
          </div>
          <span>{documents.length + outbox.length}</span>
        </div>
        <div className="facts-grid">
          <div><span>Outbox 总量</span><strong>{outbox.length}</strong></div>
          <div><span>待发布</span><strong>{pendingCount}</strong></div>
          <div><span>Legacy 文档</span><strong>{documents.length}</strong></div>
          <div><span>Auth 状态</span><strong>{authCapabilities?.status ?? '--'}</strong></div>
        </div>
        <div className="hero-actions">
          <button onClick={() => void applyDemoChange()}>生成演示变更</button>
          <button onClick={() => void rebuildOutbox(false)}>重建全量 outbox</button>
          <button onClick={() => void rebuildOutbox(true)}>重建并发布全量</button>
        </div>
      </article>

      <ResourceCard
        title="Sandbox 列表"
        count={sandboxes.length}
        description="sandbox 只服务后台隔离和运行准备，不进入 terminal 主数据投影。"
        items={sandboxes}
      />

      <ResourceCard
        title="Platform / Project"
        count={platforms.length + projects.length}
        description="平台承接 ISV 配置与全局运营上下文，项目携带 region 值对象与经营场地语义。"
        items={[...platforms, ...projects]}
      />

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>最近一次环境工作流结果</h3>
            <p className="panel-subtitle">这里直接保留 sandbox/platform/project 初始化链路与掩码凭据写入结果。</p>
          </div>
          <span>{lastEnvironmentResult?.action ?? 'idle'}</span>
        </div>
        <JsonPanel value={lastEnvironmentResult} />
      </article>

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>ISV 掩码视图与安全边界</h3>
            <p className="panel-subtitle">用于验证 `app_key/app_secret/isv_token` 不以明文进入终端侧 projection，只在后台保留掩码字段和过期时间。</p>
          </div>
          <span>{platforms.length}</span>
        </div>
        <JsonPanel value={platforms.map(item => ({
          entityId: item.entityId,
          title: item.title,
          isv_config: (item.payload.data as Record<string, unknown>).isv_config ?? null,
        }))} />
      </article>

      <ResourceCard
        title="Legacy 主数据文档"
        count={documents.length}
        description="旧 `/api/v1/master-data/*` 路由仍保留为兼容层，不再承载新主逻辑。"
        items={documents.map(item => ({
          aggregateId: item.docId,
          entityId: item.entityId,
          title: item.title,
          status: item.status,
          payload: item.payload,
        }))}
      />

      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>Auth 预留边界</h3>
            <p className="panel-subtitle">显式保留 `/api/v1/auth/*` 与 `/api/v1/terminal-auth/*`，避免未来主链路被 mock 形态绑死。</p>
          </div>
          <span>{authCapabilities?.status ?? '--'}</span>
        </div>
        <div className="auth-card">
          <strong>Terminal Auth Boundary</strong>
          <p>{authCapabilities?.tdpPublishPath}</p>
          <span>{authCapabilities?.routes.join(' · ')}</span>
        </div>
        <JsonPanel value={{legacyDocuments: documents.slice(0, 4), authCapabilities}} />
      </article>
    </>
  )
}
