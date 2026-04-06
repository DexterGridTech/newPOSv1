import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { ActionButton, AppShell, DataTable, FormGrid, JsonBlock, KeyValueList, Pager, Panel, StatCard, TextInput } from './components/ui'
import type {
  ActivationCodeItem,
  AuditLogItem,
  ChangeLogItem,
  FaultRuleItem,
  ImportValidationResult,
  OverviewStats,
  ProjectionItem,
  SandboxItem,
  SceneTemplateItem,
  ScopeStats,
  SessionItem,
  TaskInstanceItem,
  TaskReleaseItem,
  TaskTrace,
  TemplateLibraryItem,
  TerminalItem,
  TopicItem,
} from './types'

const sections = [
  { key: 'overview', label: '总览' },
  { key: 'tcp', label: 'TCP 控制面' },
  { key: 'tdp', label: 'TDP 数据面' },
  { key: 'scene', label: '场景引擎' },
  { key: 'fault', label: '故障注入' },
] as const

const STORAGE_KEY = 'mock-terminal-platform:view-preferences'

type SectionKey = (typeof sections)[number]['key']

function formatTime(value?: number | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export default function App() {
  const storedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { activeKey?: SectionKey; terminalKeyword?: string; taskKeyword?: string }
    } catch {
      return {}
    }
  })()

  const [activeKey, setActiveKey] = useState<SectionKey>(storedPrefs.activeKey ?? 'overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [terminalKeyword, setTerminalKeyword] = useState(storedPrefs.terminalKeyword ?? '')
  const [taskKeyword, setTaskKeyword] = useState(storedPrefs.taskKeyword ?? '')
  const [sessionTerminalId, setSessionTerminalId] = useState('T-1001')
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize] = useState(10)
  const [auditTotalPages, setAuditTotalPages] = useState(1)

  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [topicLibrary, setTopicLibrary] = useState<TemplateLibraryItem[]>([])
  const [faultLibrary, setFaultLibrary] = useState<TemplateLibraryItem[]>([])
  const [importValidation, setImportValidation] = useState<ImportValidationResult | null>(null)
  const [terminals, setTerminals] = useState<TerminalItem[]>([])
  const [activationCodes, setActivationCodes] = useState<ActivationCodeItem[]>([])
  const [taskReleases, setTaskReleases] = useState<TaskReleaseItem[]>([])
  const [taskInstances, setTaskInstances] = useState<TaskInstanceItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [scopeStats, setScopeStats] = useState<ScopeStats | null>(null)
  const [projections, setProjections] = useState<ProjectionItem[]>([])
  const [changeLogs, setChangeLogs] = useState<ChangeLogItem[]>([])
  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplateItem[]>([])
  const [faultRules, setFaultRules] = useState<FaultRuleItem[]>([])
  const [taskTrace, setTaskTrace] = useState<TaskTrace | null>(null)
  const [terminalSnapshot, setTerminalSnapshot] = useState<unknown>(null)
  const [terminalChanges, setTerminalChanges] = useState<unknown>(null)
  const [exportPayload, setExportPayload] = useState<unknown>(null)
  const [detailTitle, setDetailTitle] = useState('')
  const [detailPayload, setDetailPayload] = useState<unknown>(null)
  const [sceneDslDraft] = useState({
    version: 'draft-0.1',
    example: {
      name: 'upgrade-gray-scene',
      steps: [
        { type: 'select-terminals', selector: { tags: ['gray-upgrade'] } },
        { type: 'publish-task', taskType: 'APP_UPGRADE', payload: { targetVersion: '2.4.0' } },
        { type: 'observe', metrics: ['delivery', 'result', 'projection'] },
      ],
    },
  })

  const [topicKey, setTopicKey] = useState('terminal.runtime.config')
  const [topicName, setTopicName] = useState('终端运行时配置')
  const [topicScope, setTopicScope] = useState('TERMINAL')
  const [projectionPayload, setProjectionPayload] = useState('{"desiredVersion":"2.4.0","rollout":"gray"}')
  const [activationCodeInput, setActivationCodeInput] = useState('')
  const [faultName, setFaultName] = useState('升级任务超时模拟')
  const [faultMatcher, setFaultMatcher] = useState('{"taskType":"APP_UPGRADE"}')
  const [faultAction, setFaultAction] = useState('{"type":"TIMEOUT","timeoutMs":15000}')
  const [importJson, setImportJson] = useState('{"topics":[{"key":"terminal.debug.flag","name":"终端调试标记"}],"faultRules":[{"name":"配置延迟模板","targetType":"TDP_DELIVERY","matcher":{"taskType":"CONFIG_PUBLISH"},"action":{"type":"DELAY","durationMs":3000}}]}')

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeKey,
        terminalKeyword,
        taskKeyword,
      }),
    )
  }, [activeKey, terminalKeyword, taskKeyword])

  const reloadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [
        nextOverview,
        nextSandboxes,
        nextAuditLogs,
        nextTopicLibrary,
        nextFaultLibrary,
        nextTerminals,
        nextActivationCodes,
        nextTaskReleases,
        nextTaskInstances,
        nextSessions,
        nextTopics,
        nextScopeStats,
        nextProjections,
        nextChangeLogs,
        nextSceneTemplates,
        nextFaultRules,
      ] = await Promise.all([
        api.getOverview(),
        api.getSandboxes(),
        api.getAuditLogs(auditPage, auditPageSize),
        api.getTopicLibrary(),
        api.getFaultLibrary(),
        api.getTerminals(),
        api.getActivationCodes(),
        api.getTaskReleases(),
        api.getTaskInstances(),
        api.getSessions(),
        api.getTopics(),
        api.getScopeStats(),
        api.getProjections(),
        api.getChangeLogs(),
        api.getSceneTemplates(),
        api.getFaultRules(),
      ])

      setOverview(nextOverview)
      setSandboxes(nextSandboxes)
      setAuditLogs(nextAuditLogs.items)
      setAuditTotalPages(nextAuditLogs.totalPages)
      setTopicLibrary(nextTopicLibrary)
      setFaultLibrary(nextFaultLibrary)
      setTerminals(nextTerminals)
      setActivationCodes(nextActivationCodes)
      setTaskReleases(nextTaskReleases)
      setTaskInstances(nextTaskInstances)
      setSessions(nextSessions)
      setTopics(nextTopics)
      setScopeStats(nextScopeStats)
      setProjections(nextProjections)
      setChangeLogs(nextChangeLogs)
      setSceneTemplates(nextSceneTemplates)
      setFaultRules(nextFaultRules)

      if (!activationCodeInput && nextActivationCodes[0]?.code) {
        setActivationCodeInput(nextActivationCodes[0].code)
      }
      if (nextTerminals[0]?.terminalId) {
        setSessionTerminalId(nextTerminals[0].terminalId)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadAll()
  }, [auditPage, auditPageSize])

  const filteredTerminals = useMemo(
    () => terminals.filter((item) => `${item.terminalId} ${item.storeId} ${item.healthStatus} ${item.lifecycleStatus} ${item.presenceStatus}`.toLowerCase().includes(terminalKeyword.toLowerCase())),
    [terminals, terminalKeyword],
  )

  const filteredTaskInstances = useMemo(
    () => taskInstances.filter((item) => `${item.instanceId} ${item.terminalId} ${item.taskType} ${item.status} ${item.deliveryStatus}`.toLowerCase().includes(taskKeyword.toLowerCase())),
    [taskInstances, taskKeyword],
  )

  const onlineTerminals = useMemo(() => terminals.filter((item) => item.presenceStatus === 'ONLINE'), [terminals])
  const selectedInstance = filteredTaskInstances[0] ?? taskInstances[0]
  const selectedProjection = projections[0]
  const selectedChangeLog = changeLogs[0]
  const selectedSession = sessions[0]

  useEffect(() => {
    if (!selectedInstance) return
    void api.getTaskTrace(selectedInstance.instanceId).then(setTaskTrace).catch(() => setTaskTrace(null))
  }, [selectedInstance?.instanceId])

  useEffect(() => {
    const terminalId = filteredTerminals[0]?.terminalId ?? terminals[0]?.terminalId
    if (!terminalId) return
    void Promise.all([api.getTerminalSnapshot(terminalId), api.getTerminalChanges(terminalId)])
      .then(([snapshot, changes]) => {
        setTerminalSnapshot(snapshot)
        setTerminalChanges(changes)
      })
      .catch(() => {
        setTerminalSnapshot(null)
        setTerminalChanges(null)
      })
  }, [filteredTerminals, terminals])

  const downloadExportFile = () => {
    window.open('/api/v1/admin/export/download', '_blank', 'noopener,noreferrer')
  }

  const openDetail = (title: string, payload: unknown) => {
    setDetailTitle(title)
    setDetailPayload(payload)
  }

  const applyTopicTemplate = (template: TemplateLibraryItem) => {
    setTopicKey(template.key ?? '')
    setTopicName(template.name)
    setTopicScope(template.scopeType ?? 'TERMINAL')
    setProjectionPayload(JSON.stringify({ fromTemplate: template.templateId }, null, 2))
    setMessage(`已套用 Topic 模板：${template.name}`)
  }

  const applyFaultTemplate = (template: TemplateLibraryItem) => {
    setFaultName(template.name)
    setFaultMatcher(JSON.stringify(template.matcher ?? {}, null, 2))
    setFaultAction(JSON.stringify(template.action ?? {}, null, 2))
    setMessage(`已套用 Fault 模板：${template.name}`)
  }

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      setMessage('')
      setError('')
      await action()
      setMessage(successText)
      await reloadAll()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  const emptyTerminals = filteredTerminals.length === 0
  const emptyTasks = filteredTaskInstances.length === 0

  return (
    <AppShell
      title="Mock Terminal Platform"
      subtitle="面向 TCP / TDP 联调、场景演练与故障注入的高自由度后台控制台"
      sections={sections.map((section) => ({ ...section, badge: section.key === 'tcp' ? String(taskReleases.length) : undefined }))}
      activeKey={activeKey}
      onChange={(key) => setActiveKey(key as SectionKey)}
    >
      <Panel
        title="运行状态"
        subtitle="核心资源概览、告警和联调态势"
        actions={
          <div className="button-group">
            <ActionButton label="刷新数据" tone="primary" onClick={reloadAll} />
            <ActionButton label="预览导出数据" onClick={() => runAction(async () => setExportPayload(await api.exportAll()), '已加载导出数据')} />
            <ActionButton label="下载导出文件" onClick={downloadExportFile} />
          </div>
        }
      >
        {loading ? <div className="empty-state">正在加载平台数据…</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}
        {message ? <div className="feedback success">{message}</div> : null}
        {overview ? (
          <div className="stat-grid">
            <StatCard label="终端总量" value={overview.terminalStats.total} />
            <StatCard label="在线终端" value={overview.terminalStats.online} tone="success" />
            <StatCard label="运行中任务" value={overview.taskStats.running} tone="warning" />
            <StatCard label="活跃会话" value={overview.sessionStats.connected} />
            <StatCard label="主题数量" value={overview.topicStats.total} />
            <StatCard label="故障命中" value={overview.faultStats.hits} tone="danger" />
          </div>
        ) : null}
      </Panel>

      {activeKey === 'overview' ? (
        <>
          <Panel title="默认沙箱" subtitle="真实控制面边界保持 + Mock 增强调试能力">
            <DataTable columns={['名称', '状态', '用途', '资源上限', '更新时间']} rows={sandboxes.map((item) => [item.name, item.status, item.purpose, JSON.stringify(item.resourceLimits), formatTime(item.updatedAt)])} />
          </Panel>
          <Panel title="联调建议" subtitle="按典型联调路径组织的可操作入口">
            <KeyValueList
              items={[
                { label: '终端联调', value: `当前在线 ${onlineTerminals.length} 台，可直接下发配置 / 升级 / 远控任务` },
                { label: 'TDP 观察', value: `Projection ${projections.length} 条，Change Log ${changeLogs.length} 条` },
                { label: '测试场景', value: `${sceneTemplates.length} 个预制模板，可一键造数与投递` },
                { label: '故障调试', value: `${faultRules.length} 条规则，支持延迟 / 失败 / 伪结果回写` },
              ]}
            />
          </Panel>
          <Panel title="审计日志与导出预览" subtitle="后台操作、终端接入与调试动作的统一审计轨迹">
            <div className="two-column">
              <div>
                <DataTable
                  columns={['时间', '域', '动作', '操作者', '目标', '详情']}
                  rows={auditLogs.map((item) => [formatTime(item.createdAt ?? item.created_at), item.domain, item.action, item.operator, item.targetId ?? item.target_id ?? '--', JSON.stringify(item.detail)])}
                />
                <Pager page={auditPage} totalPages={auditTotalPages} onPrev={() => setAuditPage((value) => Math.max(1, value - 1))} onNext={() => setAuditPage((value) => Math.min(auditTotalPages, value + 1))} />
              </div>
              <JsonBlock value={exportPayload ?? { hint: '点击顶部“预览导出数据”查看结果' }} />
            </div>
          </Panel>
          <Panel title="模板库与导入" subtitle="复用 Topic / Fault 模板，并支持导入预检">
            <div className="three-column">
              <DataTable columns={['Topic 模板', '分类', 'Key', '套用']} rows={topicLibrary.map((item) => [item.name, item.category, item.key ?? '--', <ActionButton key={item.templateId} label="套用" onClick={() => applyTopicTemplate(item)} />])} />
              <DataTable columns={['Fault 模板', '分类', '目标类型', '套用']} rows={faultLibrary.map((item) => [item.name, item.category, item.targetType ?? '--', <ActionButton key={item.templateId} label="套用" onClick={() => applyFaultTemplate(item)} />])} />
              <JsonBlock value={importValidation ?? { hint: '可先执行导入预检' }} />
            </div>
            <FormGrid>
              <TextInput label="导入模板(JSON)" value={importJson} onChange={setImportJson} placeholder='{"topics":[],"faultRules":[]}' multiline minRows={8} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="导入预检" onClick={() => runAction(async () => { if (!importJson.trim()) throw new Error('导入内容不能为空'); setImportValidation(await api.validateImportTemplates(JSON.parse(importJson))) }, '导入预检通过')} />
              <ActionButton label="导入模板" tone="primary" onClick={() => runAction(async () => { if (!importJson.trim()) throw new Error('导入内容不能为空'); await api.importTemplates(JSON.parse(importJson)) }, '模板导入成功')} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'tcp' ? (
        <>
          <Panel
            title="TCP 控制台动作"
            subtitle="批量造终端、生成激活码、发布任务、强制改状态"
            actions={
              <div className="button-group">
                <ActionButton label="批量造 10 台终端" tone="primary" onClick={() => runAction(() => api.batchCreateTerminals(10), '已批量创建终端')} />
                <ActionButton label="生成 5 个激活码" onClick={() => runAction(() => api.batchCreateActivationCodes(5), '已生成激活码')} />
                <ActionButton
                  label="发布配置任务"
                  onClick={() =>
                    runAction(
                      () =>
                        api.createTaskRelease({
                          title: '控制台-配置下发',
                          taskType: 'CONFIG_PUBLISH',
                          sourceType: 'CONFIG',
                          sourceId: 'config-2026.04.06',
                          priority: 70,
                          targetTerminalIds: terminals.slice(0, 3).map((item) => item.terminalId),
                          payload: { configVersion: 'config-2026.04.06', mode: 'delta' },
                        }),
                      '已创建并投递配置任务',
                    )
                  }
                />
                <ActionButton label="首台终端置为告警" tone="danger" onClick={() => (terminals[0] ? runAction(() => api.forceTerminalStatus(terminals[0].terminalId, { healthStatus: 'WARNING', presenceStatus: 'ONLINE' }), '已强制修改终端状态') : Promise.resolve())} />
              </div>
            }
          >
            <KeyValueList items={[{ label: '终端', value: `${terminals.length} 台` }, { label: '激活码', value: `${activationCodes.length} 个` }, { label: '任务发布', value: `${taskReleases.length} 个` }, { label: '任务实例', value: `${taskInstances.length} 个` }]} />
          </Panel>

          <Panel title="激活实操流" subtitle="生成激活码后，直接模拟真实终端激活流程">
            <FormGrid>
              <TextInput label="激活码" value={activationCodeInput} onChange={setActivationCodeInput} placeholder="输入 ACT-xxxx" />
              <TextInput label="设备指纹" value="mock-fingerprint-rn84" readOnly onChange={() => undefined} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="执行终端激活" tone="primary" onClick={() => runAction(async () => { if (!activationCodeInput.trim()) throw new Error('激活码不能为空'); await api.activateTerminal({ activationCode: activationCodeInput, deviceFingerprint: 'mock-fingerprint-rn84', deviceInfo: { model: 'Mock-POS-X1', osVersion: 'Android 14', manufacturer: 'IMPOS2' } }) }, '终端激活成功')} />
            </div>
          </Panel>

          <Panel title="终端总览" subtitle="支持关键字筛选、状态观察、快照与变更对比">
            <FormGrid columns={3}>
              <TextInput label="终端筛选" value={terminalKeyword} onChange={setTerminalKeyword} placeholder="终端 ID / 门店 / 健康 / 生命周期 / 在线状态" />
            </FormGrid>
            {emptyTerminals ? <div className="empty-state inline-actions">当前筛选条件下没有终端，试试清空筛选词。</div> : null}
            <div className="three-column inline-actions">
              <DataTable columns={['终端 ID', '门店', '生命周期', '在线状态', '健康状态', 'App 版本', '详情']} rows={filteredTerminals.slice(0, 12).map((item) => [item.terminalId, item.storeId, item.lifecycleStatus, item.presenceStatus, item.healthStatus, item.currentAppVersion ?? '--', <ActionButton key={item.terminalId} label="查看" onClick={() => openDetail(`终端 ${item.terminalId}`, item)} />])} />
              <JsonBlock value={filteredTerminals[0] ?? { hint: '暂无终端' }} />
              <JsonBlock value={{ snapshot: terminalSnapshot ?? [], changes: terminalChanges ?? [], compareHint: '左侧为终端基础信息，右侧为 TDP 快照与变更链路' }} />
            </div>
          </Panel>

          <Panel title="激活码与任务发布" subtitle="联调常用入口与下发上下文">
            <div className="two-column">
              <DataTable columns={['激活码', '门店', '状态', '已绑定终端', '过期时间']} rows={activationCodes.slice(0, 8).map((item) => [item.code, item.storeId, item.status, item.usedBy ?? '--', formatTime(item.expiresAt)])} />
              <DataTable columns={['发布单', '类型', '状态', '优先级', '目标', '更新时间']} rows={taskReleases.slice(0, 8).map((item) => [item.title, item.taskType, item.status, item.priority, JSON.stringify(item.targetSelector), formatTime(item.updatedAt)])} />
            </div>
          </Panel>

          <Panel title="任务实例调试与链路追踪" subtitle="支持筛选、伪结果回报，并查看 TCP → TDP 的完整链路" actions={selectedInstance ? <ActionButton label="给首个实例写入成功结果" onClick={() => runAction(() => api.mockTaskResult(selectedInstance.instanceId, { status: 'SUCCESS', result: { message: 'mock ack', finishedBy: 'admin' } }), '已写入伪结果')} /> : undefined}>
            <FormGrid columns={3}>
              <TextInput label="任务筛选" value={taskKeyword} onChange={setTaskKeyword} placeholder="实例 ID / 终端 / 类型 / 状态 / 投递状态" />
            </FormGrid>
            {emptyTasks ? <div className="empty-state inline-actions">当前筛选条件下没有任务实例，试试清空筛选词。</div> : null}
            <div className="three-column inline-actions">
              <DataTable columns={['实例 ID', '终端', '任务类型', '状态', '投递状态', '更新时间', '详情']} rows={filteredTaskInstances.slice(0, 8).map((item) => [item.instanceId, item.terminalId, item.taskType, item.status, item.deliveryStatus, formatTime(item.updatedAt), <ActionButton key={item.instanceId} label="查看" onClick={() => openDetail(`任务实例 ${item.instanceId}`, item)} />])} />
              <JsonBlock value={selectedInstance ?? { hint: '暂无实例数据' }} />
              <JsonBlock value={taskTrace ?? { hint: '暂无链路追踪数据' }} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'tdp' ? (
        <>
          <Panel title="TDP Topic / Schema / Scope 治理" subtitle="允许注册 Topic 后自由扩展 Payload，并支持 Projection 注入">
            <FormGrid>
              <TextInput label="Topic Key" value={topicKey} onChange={setTopicKey} placeholder="如 terminal.runtime.config" />
              <TextInput label="Topic 名称" value={topicName} onChange={setTopicName} placeholder="输入主题名称" />
              <TextInput label="Scope 类型" value={topicScope} onChange={setTopicScope} placeholder="TERMINAL / STORE / TENANT" />
              <TextInput label="Projection Payload(JSON)" value={projectionPayload} onChange={setProjectionPayload} placeholder='{"foo":"bar"}' multiline minRows={6} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="注册 Topic" tone="primary" onClick={() => runAction(async () => { if (!topicKey.trim() || !topicName.trim()) throw new Error('Topic Key 和 Topic 名称不能为空'); await api.createTopic({ key: topicKey, name: topicName, payloadMode: 'FLEXIBLE_JSON', scopeType: topicScope, schema: { type: 'object', additionalProperties: true }, retentionHours: 72 }) }, '已创建 Topic')} />
              <ActionButton label="注入 Projection" onClick={() => runAction(() => api.upsertProjection({ topicKey, scopeType: topicScope, scopeKey: filteredTerminals[0]?.terminalId ?? 'T-1001', payload: JSON.parse(projectionPayload) }), '已写入 Projection')} />
            </div>
          </Panel>

          <Panel title="Session 实操" subtitle="手工模拟终端连接、心跳与断开，便于联调 TDP 生命周期">
            <FormGrid columns={3}>
              <TextInput label="终端 ID" value={sessionTerminalId} onChange={setSessionTerminalId} placeholder="如 T-1001" />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="建立 Session" tone="primary" onClick={() => runAction(() => api.connectSession({ terminalId: sessionTerminalId, clientVersion: '2.4.0-dev', protocolVersion: 'tdp-1.0' }), '已建立 Session')} />
              {selectedSession ? <ActionButton label="发送心跳" onClick={() => runAction(() => api.heartbeatSession(selectedSession.sessionId), '已发送心跳')} /> : null}
              {selectedSession ? <ActionButton label="断开首个 Session" tone="danger" onClick={() => runAction(() => api.disconnectSession(selectedSession.sessionId), '已断开 Session')} /> : null}
            </div>
          </Panel>

          <Panel title="TDP 会话与主题" subtitle="连接态、协议版本、Topic 基础治理">
            <div className="two-column">
              <DataTable columns={['Session', '终端', '状态', '客户端版本', '协议版本', '最近心跳', '详情']} rows={sessions.slice(0, 8).map((item) => [item.sessionId, item.terminalId, item.status, item.clientVersion, item.protocolVersion, formatTime(item.lastHeartbeatAt), <ActionButton key={item.sessionId} label="查看" onClick={() => openDetail(`Session ${item.sessionId}`, item)} />])} />
              <DataTable columns={['Topic Key', '名称', 'Payload 模式', 'Scope', '保留时长', '详情']} rows={topics.slice(0, 10).map((item) => [item.key, item.name, item.payloadMode, item.scopeType, `${item.retentionHours}h`, <ActionButton key={item.key} label="查看" onClick={() => openDetail(`Topic ${item.key}`, item)} />])} />
            </div>
          </Panel>

          <Panel title="Scope 统计 / Projection / Change Log" subtitle="Revision、快照和变更链路观察">
            <div className="three-column">
              <DataTable columns={['Topic', 'Scope', 'Topic 数量']} rows={(scopeStats?.topicScopes ?? []).slice(0, 10).map((item) => [item.topic_key, item.scope_type, item.topic_count])} />
              <DataTable columns={['Topic', 'Scope', 'Key', 'Revision', '更新时间', '详情']} rows={projections.slice(0, 10).map((item) => [item.topicKey, item.scopeType, item.scopeKey, item.revision, formatTime(item.updatedAt), <ActionButton key={`${item.topicKey}-${item.scopeKey}-${item.revision}`} label="查看" onClick={() => openDetail(`Projection ${item.topicKey}:${item.scopeKey}`, item)} />])} />
              <DataTable columns={['Change', 'Topic', 'Revision', '来源发布单', '时间', '详情']} rows={changeLogs.slice(0, 10).map((item) => [item.changeId, item.topicKey, item.revision, item.sourceReleaseId ?? '--', formatTime(item.createdAt), <ActionButton key={item.changeId} label="查看" onClick={() => openDetail(`Change ${item.changeId}`, item)} />])} />
            </div>
          </Panel>

          <Panel title="当前选中快照" subtitle="便于核对 TCP 委托后的 TDP 投递上下文">
            <div className="two-column">
              <JsonBlock value={selectedProjection ?? { hint: '暂无 projection' }} />
              <JsonBlock value={selectedChangeLog ?? { hint: '暂无 change log' }} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'scene' ? (
        <>
          <Panel title="场景模板库" subtitle="按类别沉淀可复用联调模板">
            <DataTable columns={['模板', '类别', '描述', '步骤', '操作']} rows={sceneTemplates.map((item) => [item.name, item.category ?? '--', item.description, item.steps.join(' → '), <ActionButton key={item.sceneTemplateId} label="运行" tone="primary" onClick={() => runAction(() => api.runSceneTemplate(item.sceneTemplateId), `已运行场景：${item.name}`)} />])} />
          </Panel>
          <Panel title="Scene DSL 草案" subtitle="为后续脚本化场景编排预留结构设计">
            <JsonBlock value={sceneDslDraft} />
          </Panel>
        </>
      ) : null}

      {activeKey === 'fault' ? (
        <>
          <Panel title="故障注入控制台" subtitle="延迟、失败、伪结果、命中统计与规则编辑" actions={<div className="button-group">{faultRules[0] ? <ActionButton label="模拟首条规则命中" tone="danger" onClick={() => runAction(() => api.simulateFaultHit(faultRules[0].faultRuleId), '已模拟规则命中')} /> : null}</div>}>
            <FormGrid>
              <TextInput label="规则名称" value={faultName} onChange={setFaultName} placeholder="输入规则名称" />
              <TextInput label="Matcher(JSON)" value={faultMatcher} onChange={setFaultMatcher} placeholder='{"taskType":"APP_UPGRADE"}' multiline minRows={6} />
              <TextInput label="Action(JSON)" value={faultAction} onChange={setFaultAction} placeholder='{"type":"TIMEOUT","timeoutMs":15000}' multiline minRows={6} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="新增故障规则" onClick={() => runAction(async () => { if (!faultName.trim()) throw new Error('规则名称不能为空'); await api.createFaultRule({ name: faultName, targetType: 'TDP_DELIVERY', matcher: JSON.parse(faultMatcher), action: JSON.parse(faultAction) }) }, '已新增故障规则')} />
              {faultRules[0] ? <ActionButton label="更新首条规则" tone="primary" onClick={() => runAction(() => api.updateFaultRule(faultRules[0].faultRuleId, { name: faultName, matcher: JSON.parse(faultMatcher), action: JSON.parse(faultAction), enabled: true }), '已更新故障规则')} /> : null}
            </div>
            <DataTable columns={['规则', '目标', 'Matcher', 'Action', '命中次数', '更新时间']} rows={faultRules.map((item) => [item.name, item.targetType, JSON.stringify(item.matcher), JSON.stringify(item.action), item.hitCount, formatTime(item.updatedAt)])} />
          </Panel>
          <Panel title="调试原则" subtitle="Mock-only 能力与真实边界严格隔离">
            <KeyValueList items={[{ label: '边界', value: 'TCP 负责控制治理，TDP 负责投递与投影，不混边界' }, { label: '自由度', value: '后台允许强制改状态、写伪结果、造数据，但都通过 Mock 专用接口' }, { label: '可观测', value: '所有异常都应可通过实例、Projection、Change Log 回看' }, { label: '可演进', value: '后续可补更细粒度 Fault DSL 与 Replay 轨迹' }]} />
          </Panel>
        </>
      ) : null}

      {detailPayload ? (
        <div className="detail-drawer" role="dialog" aria-label={detailTitle}>
          <div className="detail-drawer-panel">
            <div className="panel-header">
              <div>
                <h2>{detailTitle}</h2>
                <p>当前选中对象的完整调试上下文</p>
              </div>
              <ActionButton label="关闭" onClick={() => setDetailPayload(null)} />
            </div>
            <JsonBlock value={detailPayload} />
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
