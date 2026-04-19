import {useEffect, useMemo, useState} from 'react'
import {api} from '../../api'
import type {TerminalDecisionTrace, TerminalItem} from '../../types'
import {ActionButton, DataTable, InlineBadge, JsonBlock, Panel, SelectInput, StatCard, TextInput} from '../ui'
import {useTdpPolicyCenter} from './useTdpPolicyCenter'

function formatTime(value?: number | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', {hour12: false})
}

export function TdpPolicyCenter(props: {
  terminals: TerminalItem[]
  onMutated?: () => Promise<void> | void
}) {
  const {terminals, onMutated} = props
  const {
    loading,
    error,
    message,
    groups,
    policies,
    memberships,
    overview,
    groupPreview,
    setGroupPreview,
    selectedGroupId,
    setSelectedGroupId,
    groupStats,
    policyValidation,
    setPolicyValidation,
    previewImpact,
    setPreviewImpact,
    topicDecision,
    setTopicDecision,
    selectedTerminalId,
    setSelectedTerminalId,
    runAction,
    reloadAll,
    reloadGroupStats,
  } = useTdpPolicyCenter({terminals, onMutated})

  const [groupCode, setGroupCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupPriority, setGroupPriority] = useState('100')
  const [groupSelectorDsl, setGroupSelectorDsl] = useState('{"match":{"templateId":["template-kernel-base-android-pos-standard"]}}')

  const [policyTopicKey, setPolicyTopicKey] = useState('config.delta')
  const [policyItemKey, setPolicyItemKey] = useState('config.gray.release')
  const [policyGroupId, setPolicyGroupId] = useState('')
  const [policyPayload, setPolicyPayload] = useState('{"configVersion":"gray-001","restartPolicy":"idle"}')
  const [policyDescription, setPolicyDescription] = useState('动态灰度配置')
  const [decisionTrace, setDecisionTrace] = useState<TerminalDecisionTrace | null>(null)
  const [policyKeyword, setPolicyKeyword] = useState('')
  const [groupKeyword, setGroupKeyword] = useState('')
  const [decisionTopicKey, setDecisionTopicKey] = useState('config.delta')

  useEffect(() => {
    if (!policyGroupId && groups[0]?.groupId) {
      setPolicyGroupId(groups[0].groupId)
    }
  }, [groups, policyGroupId])

  const groupCodeById = useMemo(
    () => Object.fromEntries(groups.map(item => [item.groupId, item.groupCode])),
    [groups],
  )

  const filteredGroups = useMemo(() => {
    const keyword = groupKeyword.trim().toLowerCase()
    if (!keyword) return groups
    return groups.filter(item =>
      item.groupCode.toLowerCase().includes(keyword)
      || item.name.toLowerCase().includes(keyword)
      || JSON.stringify(item.selectorDslJson).toLowerCase().includes(keyword),
    )
  }, [groupKeyword, groups])

  const filteredPolicies = useMemo(() => {
    const keyword = policyKeyword.trim().toLowerCase()
    if (!keyword) return policies
    return policies.filter(item =>
      item.topicKey.toLowerCase().includes(keyword)
      || item.itemKey.toLowerCase().includes(keyword)
      || item.scopeType.toLowerCase().includes(keyword)
      || item.scopeKey.toLowerCase().includes(keyword)
      || item.description.toLowerCase().includes(keyword),
    )
  }, [policies, policyKeyword])

  return (
    <>
      <Panel
        title="TDP 策略中心"
        subtitle="动态 group、group policy、终端 membership 的最小运维闭环"
        actions={(
          <div className="button-group">
            <ActionButton label="刷新" onClick={() => void reloadAll()} />
            <ActionButton
              label="全量重算"
              tone="primary"
              onClick={() => void runAction(() => api.recomputeAllTdpGroups(), '已完成全量 membership 重算', selectedTerminalId)}
            />
          </div>
        )}
      >
        {loading ? <div className="empty-state">正在加载 TDP 策略中心…</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}
        {message ? <div className="feedback success">{message}</div> : null}
        <div className="stats-grid">
          <StatCard label="Enabled Groups" value={overview?.stats.groups.enabled ?? 0} />
          <StatCard label="Enabled Policies" value={overview?.stats.policies.enabled ?? 0} />
          <StatCard label="No Members" value={overview?.stats.groups.withoutMembers ?? 0} tone={(overview?.stats.groups.withoutMembers ?? 0) > 0 ? 'warning' : 'default'} />
          <StatCard label="Missing Runtime Facts" value={overview?.stats.terminals.missingRuntimeFacts ?? 0} tone={(overview?.stats.terminals.missingRuntimeFacts ?? 0) > 0 ? 'warning' : 'default'} />
        </div>
        <div className="button-group inline-actions">
          {(overview?.risks.groupsWithoutMembers ?? []).slice(0, 5).map(item => (
            <InlineBadge key={item.groupId} tone="warning">{`no-members:${item.groupCode}`}</InlineBadge>
          ))}
          {(overview?.stats.terminals.missingRuntimeFacts ?? 0) > 0 ? (
            <InlineBadge tone="warning">missing-runtime-facts</InlineBadge>
          ) : null}
        </div>
        <div className="two-column">
          <div>
            <TextInput label="筛选 Group" value={groupKeyword} onChange={setGroupKeyword} placeholder="按 code / 名称 / selector 过滤" />
            <DataTable
              columns={['Group', '名称', '优先级', 'Enabled', 'MembershipVersion', 'Selector', '更新时间', '操作']}
              rows={filteredGroups.map(item => [
                item.groupCode,
                item.name,
                item.priority,
                item.enabled ? <InlineBadge key={`${item.groupId}-enabled`} tone="success">enabled</InlineBadge> : <InlineBadge key={`${item.groupId}-disabled`}>disabled</InlineBadge>,
                item.membershipVersion,
                <code key={`${item.groupId}-selector`} className="code-chip">{JSON.stringify(item.selectorDslJson)}</code>,
                formatTime(item.updatedAt),
                <div key={`${item.groupId}-actions`} className="button-group">
                  <ActionButton
                    label="查看详情"
                    onClick={() => {
                      setSelectedGroupId(item.groupId)
                      void reloadGroupStats(item.groupId)
                    }}
                  />
                  <ActionButton
                    label="删除"
                    tone="danger"
                    onClick={() => void runAction(() => api.deleteTdpGroup(item.groupId), `已删除 group ${item.groupCode}`, selectedTerminalId)}
                  />
                </div>,
              ])}
            />
          </div>
          <div>
            <Panel title="新增 Dynamic Group" subtitle="第一版直接输入 selector DSL JSON">
              <div className="form-grid columns-2">
                <TextInput label="Group Code" value={groupCode} onChange={setGroupCode} placeholder="如 project-gray" />
                <TextInput label="名称" value={groupName} onChange={setGroupName} placeholder="如 项目灰度组" />
                <TextInput label="优先级" value={groupPriority} onChange={setGroupPriority} placeholder="100" />
                <TextInput label="Selector DSL(JSON)" value={groupSelectorDsl} onChange={setGroupSelectorDsl} multiline minRows={6} />
              </div>
              <div className="button-group inline-actions">
                <ActionButton
                  label="预览命中"
                  onClick={() => void api.previewTdpGroup({
                    selectorDslJson: JSON.parse(groupSelectorDsl),
                  }).then(setGroupPreview)}
                />
                <ActionButton
                  label="创建 Group"
                  tone="primary"
                  onClick={() => void runAction(async () => {
                    if (!groupCode.trim() || !groupName.trim()) throw new Error('groupCode 和名称不能为空')
                    await api.createTdpGroup({
                      groupCode,
                      name: groupName,
                      description: groupName,
                      enabled: true,
                      priority: Number(groupPriority || 100),
                      selectorDslJson: JSON.parse(groupSelectorDsl),
                    })
                    setGroupCode('')
                    setGroupName('')
                  }, '已创建 selector group', selectedTerminalId)}
                />
              </div>
              <JsonBlock value={groupPreview ?? {hint: '点击“预览命中”查看 selector 命中的终端与分布'}} />
            </Panel>
          </div>
        </div>
      </Panel>

      <Panel title="Group 运维视图" subtitle="查看 group 成员、关联策略与命中分布">
        <div className="three-column">
          <div>
            <SelectInput
              label="Group"
              value={selectedGroupId}
              onChange={(value) => {
                setSelectedGroupId(value)
                void reloadGroupStats(value)
              }}
              options={groups.length > 0
                ? groups.map(item => ({label: `${item.groupCode} / ${item.name}`, value: item.groupId}))
                : [{label: '暂无 group', value: '', disabled: true}]}
            />
            <JsonBlock value={groupStats?.group ?? {hint: '请选择 group 查看详情'}} />
            <JsonBlock value={{selectorExplain: groupStats?.group?.selectorExplain ?? '暂无 selector explain'}} />
          </div>
          <div>
            <DataTable
              columns={['Terminal', 'Project', 'Store', 'Template', 'Runtime', 'Rank']}
              rows={(groupStats?.members ?? []).map(item => [
                item.terminalId,
                item.projectId,
                item.storeId,
                item.templateId,
                item.runtimeVersion || '--',
                item.rank,
              ])}
            />
          </div>
          <div>
            <JsonBlock value={groupStats?.distributions ?? {hint: '这里展示 group 成员分布'}} />
            <DataTable
              columns={['Topic', 'Item', 'Enabled', '更新时间']}
              rows={(groupStats?.policies ?? []).map(item => [
                item.topicKey,
                item.itemKey,
                item.enabled ? 'YES' : 'NO',
                formatTime(item.updatedAt),
              ])}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Policy / Membership" subtitle="发布 group-scope policy，并查看终端当前 membership">
        <div className="three-column">
          <div>
            <TextInput label="筛选 Policy" value={policyKeyword} onChange={setPolicyKeyword} placeholder="按 topic / item / scope / 描述过滤" />
            <DataTable
              columns={['Topic', 'ItemKey', 'Scope', 'Bucket', 'Enabled', '描述', 'Payload', '操作']}
              rows={filteredPolicies.map(item => [
                item.topicKey,
                item.itemKey,
                item.scopeType,
                item.scopeType === 'GROUP' ? (groupCodeById[item.scopeKey] ?? item.scopeKey) : item.scopeKey,
                item.enabled ? <InlineBadge key={`${item.policyId}-enabled`} tone="success">enabled</InlineBadge> : <InlineBadge key={`${item.policyId}-disabled`}>disabled</InlineBadge>,
                item.description || '--',
                <code key={`${item.policyId}-payload`} className="code-chip">{JSON.stringify(item.payloadJson)}</code>,
                <div key={`${item.policyId}-actions`} className="button-group">
                  <ActionButton
                    label={item.enabled ? '禁用' : '启用'}
                    onClick={() => void runAction(
                      () => api.updateTdpPolicy(item.policyId, {enabled: !item.enabled}),
                      item.enabled ? `已禁用 policy ${item.itemKey}` : `已启用 policy ${item.itemKey}`,
                      selectedTerminalId,
                    )}
                  />
                  <ActionButton
                    label="删除"
                    tone="danger"
                    onClick={() => void runAction(
                      () => api.deleteTdpPolicy(item.policyId),
                      `已删除 policy ${item.itemKey}`,
                      selectedTerminalId,
                    )}
                  />
                </div>,
              ])}
            />
          </div>
          <div>
            <Panel title="创建 Group Policy" subtitle="当前只支持 GROUP scope policy">
              <div className="form-grid columns-2">
                <TextInput label="Topic Key" value={policyTopicKey} onChange={setPolicyTopicKey} placeholder="如 config.delta" />
                <TextInput label="Item Key" value={policyItemKey} onChange={setPolicyItemKey} placeholder="如 config.gray.release" />
                <SelectInput
                  label="目标 Group"
                  value={policyGroupId}
                  onChange={setPolicyGroupId}
                  options={groups.length > 0
                    ? groups.map(item => ({label: `${item.groupCode} / ${item.name}`, value: item.groupId}))
                    : [{label: '请先创建 group', value: '', disabled: true}]}
                />
                <TextInput label="描述" value={policyDescription} onChange={setPolicyDescription} placeholder="策略描述" />
                <TextInput label="Payload(JSON)" value={policyPayload} onChange={setPolicyPayload} multiline minRows={6} />
              </div>
              <div className="button-group inline-actions">
                <ActionButton
                  label="冲突校验"
                  onClick={() => void api.validateTdpPolicy({
                    topicKey: policyTopicKey,
                    itemKey: policyItemKey,
                    scopeType: 'GROUP',
                    scopeKey: policyGroupId,
                    enabled: true,
                  }).then(setPolicyValidation)}
                />
                <ActionButton
                  label="创建 Policy"
                  tone="primary"
                  onClick={() => void runAction(async () => {
                    if (!policyGroupId.trim()) throw new Error('请选择目标 group')
                    if (!policyTopicKey.trim() || !policyItemKey.trim()) throw new Error('topicKey 和 itemKey 不能为空')
                    await api.createTdpPolicy({
                      topicKey: policyTopicKey,
                      itemKey: policyItemKey,
                      scopeType: 'GROUP',
                      scopeKey: policyGroupId,
                      enabled: true,
                      payloadJson: JSON.parse(policyPayload),
                      description: policyDescription,
                    })
                  }, '已创建 group policy', selectedTerminalId)}
                />
                <ActionButton
                  label="预览影响"
                  onClick={() => void api.previewTdpPolicyImpact({
                    topicKey: policyTopicKey,
                    itemKey: policyItemKey,
                    scopeType: 'GROUP',
                    scopeKey: policyGroupId,
                    enabled: true,
                    payloadJson: JSON.parse(policyPayload),
                  }).then(setPreviewImpact)}
                />
              </div>
              <JsonBlock value={policyValidation ?? {hint: '点击“冲突校验”查看同 bucket 是否已有 enabled policy'}} />
              <JsonBlock value={previewImpact ?? {hint: '点击“预览影响”查看命中终端与 winner 变化'}} />
              {(previewImpact?.warnings?.length ?? 0) > 0 ? (
                <div className="button-group inline-actions">
                  {previewImpact?.warnings.map(item => (
                    <InlineBadge key={item} tone={item === 'IMPACT_LARGE' ? 'warning' : 'primary'}>{item}</InlineBadge>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>
          <div>
            <Panel title="终端 Membership" subtitle="查询终端当前 group 命中结果，并支持按终端重算">
              <div className="form-grid columns-2">
                <SelectInput
                  label="终端"
                  value={selectedTerminalId}
                  onChange={setSelectedTerminalId}
                  options={terminals.length > 0
                    ? terminals.map(item => ({label: `${item.terminalId} / ${item.storeId}`, value: item.terminalId}))
                    : [{label: '暂无终端', value: '', disabled: true}]}
                />
              </div>
              <div className="button-group inline-actions">
                <ActionButton
                  label="重算当前终端"
                  tone="primary"
                  onClick={() => void runAction(async () => {
                    if (!selectedTerminalId.trim()) throw new Error('请选择终端')
                    await api.recomputeTdpGroupsByScope({
                      scopeType: 'TERMINAL',
                      scopeKeys: [selectedTerminalId],
                    })
                  }, '已完成终端 membership 重算', selectedTerminalId)}
                />
                <ActionButton label="查看原始 JSON" onClick={() => void reloadAll(selectedTerminalId)} />
                <ActionButton
                  label="加载 Decision Trace"
                  onClick={() => void api.getTerminalDecisionTrace(selectedTerminalId).then(setDecisionTrace)}
                />
                <ActionButton
                  label="按 Topic Explain"
                  onClick={() => void api.getTerminalTopicDecision(selectedTerminalId, decisionTopicKey).then(setTopicDecision)}
                />
              </div>
              <TextInput label="Decision TopicKey" value={decisionTopicKey} onChange={setDecisionTopicKey} placeholder="如 config.delta" />
              <JsonBlock value={memberships ?? {hint: '请选择终端查看 membership'}} />
              <DataTable
                columns={['Rank', 'Group', '名称', '优先级', 'MatchedBy']}
                rows={(memberships?.groups ?? []).map(item => [
                  item.rank,
                  item.groupCode,
                  item.name,
                  item.priority,
                  <code key={`${item.groupId}-matchedBy`} className="code-chip">{JSON.stringify(item.matchedBy)}</code>,
                ])}
              />
              <JsonBlock value={decisionTrace ?? {hint: '点击“加载 Decision Trace”查看最终真相与 candidate 链'}} />
              <JsonBlock value={topicDecision ?? {hint: '点击“按 Topic Explain”查看单 topic winner chain'}} />
            </Panel>
          </div>
        </div>
      </Panel>
    </>
  )
}
