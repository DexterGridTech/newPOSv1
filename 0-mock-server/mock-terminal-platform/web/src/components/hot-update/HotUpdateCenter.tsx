import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import type { HotUpdateImpactPreview, HotUpdatePackageItem, HotUpdateReleaseItem, SelectorGroupItem, TerminalItem, TerminalVersionReportItem } from '../../types'
import { ActionButton, DataTable, InlineBadge, JsonBlock, Panel, SelectInput, StatCard, TextInput } from '../ui'

function formatTime(value?: number | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function HotUpdateCenter(props: {
  terminals: TerminalItem[]
  onMutated?: () => Promise<void> | void
}) {
  const { terminals, onMutated } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [packages, setPackages] = useState<HotUpdatePackageItem[]>([])
  const [releases, setReleases] = useState<HotUpdateReleaseItem[]>([])
  const [groups, setGroups] = useState<SelectorGroupItem[]>([])
  const [versionDrift, setVersionDrift] = useState<TerminalVersionReportItem[]>([])
  const [versionHistory, setVersionHistory] = useState<TerminalVersionReportItem[]>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState('')
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadBase64, setUploadBase64] = useState('')
  const [releasePackageId, setReleasePackageId] = useState('')
  const [releaseScopeType, setReleaseScopeType] = useState<'GROUP' | 'TERMINAL'>('GROUP')
  const [releaseScopeKey, setReleaseScopeKey] = useState('')
  const [impactPreview, setImpactPreview] = useState<HotUpdateImpactPreview | null>(null)
  const [packageKeyword, setPackageKeyword] = useState('')
  const [releaseKeyword, setReleaseKeyword] = useState('')
  const [driftKeyword, setDriftKeyword] = useState('')

  const reloadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextPackages, nextReleases, nextGroups, nextVersionDrift] = await Promise.all([
        api.getHotUpdatePackages(),
        api.getHotUpdateReleases(),
        api.getTdpGroups(),
        api.getHotUpdateVersionDrift(),
      ])
      setPackages(nextPackages)
      setReleases(nextReleases)
      setGroups(nextGroups)
      setVersionDrift(nextVersionDrift)
      if (!releasePackageId && nextPackages[0]?.packageId) {
        setReleasePackageId(nextPackages[0].packageId)
      }
      if (!selectedTerminalId && terminals[0]?.terminalId) {
        setSelectedTerminalId(terminals[0].terminalId)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '热更新数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadAll()
  }, [])

  useEffect(() => {
    if (releaseScopeType === 'GROUP' && !releaseScopeKey && groups[0]?.groupId) {
      setReleaseScopeKey(groups[0].groupId)
    }
    if (releaseScopeType === 'TERMINAL' && !releaseScopeKey && terminals[0]?.terminalId) {
      setReleaseScopeKey(terminals[0].terminalId)
    }
  }, [groups, terminals, releaseScopeType, releaseScopeKey])

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      setError('')
      setMessage('')
      await action()
      setMessage(successMessage)
      await reloadAll()
      await onMutated?.()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '热更新操作失败')
    }
  }

  const selectedPackage = useMemo(
    () => packages.find(item => item.packageId === releasePackageId) ?? packages[0] ?? null,
    [packages, releasePackageId],
  )

  const totalActiveReleases = releases.filter(item => item.status === 'ACTIVE').length
  const blockedPackages = packages.filter(item => item.status === 'BLOCKED').length

  const filteredPackages = useMemo(() => {
    const keyword = packageKeyword.trim().toLowerCase()
    if (!keyword) return packages
    return packages.filter(item =>
      item.packageId.toLowerCase().includes(keyword)
      || item.appId.toLowerCase().includes(keyword)
      || item.bundleVersion.toLowerCase().includes(keyword)
      || item.runtimeVersion.toLowerCase().includes(keyword)
      || item.status.toLowerCase().includes(keyword),
    )
  }, [packageKeyword, packages])

  const filteredReleases = useMemo(() => {
    const keyword = releaseKeyword.trim().toLowerCase()
    if (!keyword) return releases
    return releases.filter(item =>
      item.releaseId.toLowerCase().includes(keyword)
      || item.packageId.toLowerCase().includes(keyword)
      || item.scopeType.toLowerCase().includes(keyword)
      || item.scopeKey.toLowerCase().includes(keyword)
      || item.status.toLowerCase().includes(keyword)
      || (item.packageSummary?.bundleVersion ?? '').toLowerCase().includes(keyword),
    )
  }, [releaseKeyword, releases])

  const filteredVersionDrift = useMemo(() => {
    const keyword = driftKeyword.trim().toLowerCase()
    if (!keyword) return versionDrift
    return versionDrift.filter(item =>
      item.terminalId.toLowerCase().includes(keyword)
      || item.bundleVersion.toLowerCase().includes(keyword)
      || item.source.toLowerCase().includes(keyword)
      || item.state.toLowerCase().includes(keyword),
    )
  }, [driftKeyword, versionDrift])

  const scopeOptions = releaseScopeType === 'GROUP'
    ? groups.map(item => ({ value: item.groupId, label: `${item.groupCode} / ${item.name}` }))
    : terminals.map(item => ({ value: item.terminalId, label: `${item.terminalId} / ${item.storeId}` }))

  useEffect(() => {
    if (!selectedTerminalId) return
    void api.getTerminalVersionHistory(selectedTerminalId)
      .then(setVersionHistory)
      .catch(() => setVersionHistory([]))
  }, [selectedTerminalId])

  return (
    <>
      <Panel
        title="热更新中心"
        subtitle="上传 TS 更新包、创建 release、激活到动态 group"
        actions={<ActionButton label="刷新" onClick={() => void reloadAll()} />}
      >
        {loading ? <div className="empty-state">正在加载热更新数据…</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}
        {message ? <div className="feedback success">{message}</div> : null}
        <div className="stats-grid">
          <StatCard label="已上传包" value={packages.length} />
          <StatCard label="激活发布" value={totalActiveReleases} tone={totalActiveReleases > 0 ? 'success' : 'default'} />
          <StatCard label="阻断包" value={blockedPackages} tone={blockedPackages > 0 ? 'warning' : 'default'} />
        </div>
      </Panel>

      <Panel title="包上传" subtitle="第一版直接粘贴 JSON/base64，避免新增 multipart 依赖">
        <div className="form-grid columns-2">
          <TextInput label="文件名" value={uploadFileName} onChange={setUploadFileName} placeholder="hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.1.zip" />
          <TextInput label="Zip Base64" value={uploadBase64} onChange={setUploadBase64} multiline minRows={8} />
        </div>
        <div className="button-group inline-actions">
          <ActionButton
            label="上传热更新包"
            tone="primary"
            onClick={() => void runAction(async () => {
              if (!uploadFileName.trim() || !uploadBase64.trim()) throw new Error('文件名和 Base64 内容不能为空')
              await api.uploadHotUpdatePackage({
                fileName: uploadFileName,
                contentBase64: uploadBase64,
              })
              setUploadFileName('')
              setUploadBase64('')
            }, '热更新包已上传')}
          />
        </div>
      </Panel>

      <Panel title="包管理" subtitle="查看 manifest 摘要、下载地址和状态控制">
        <div className="form-grid columns-3">
          <TextInput label="筛选包" value={packageKeyword} onChange={setPackageKeyword} placeholder="package / app / bundle / runtime / status" />
        </div>
        <DataTable
          columns={['Package', 'App', 'Bundle', 'Runtime', '状态', 'Payload', '下载', '更新时间', '操作']}
          rows={filteredPackages.map(item => [
            item.packageId,
            item.appId,
            item.bundleVersion,
            item.runtimeVersion,
            item.status === 'BLOCKED'
              ? <InlineBadge key={`${item.packageId}-status`} tone="warning">BLOCKED</InlineBadge>
              : <InlineBadge key={`${item.packageId}-status`} tone="success">{item.status}</InlineBadge>,
            `${item.manifest.package.type} / ${item.manifest.package.files?.length ?? 1} files`,
            <code key={`${item.packageId}-download`} className="code-chip">{item.downloadUrl}</code>,
            formatTime(item.updatedAt),
            <div key={`${item.packageId}-actions`} className="button-group">
              <ActionButton label="阻断" tone="danger" onClick={() => void runAction(() => api.updateHotUpdatePackageStatus(item.packageId, 'BLOCKED'), `已阻断包 ${item.packageId}`)} />
              <ActionButton label="恢复" onClick={() => void runAction(() => api.updateHotUpdatePackageStatus(item.packageId, 'VALIDATED'), `已恢复包 ${item.packageId}`)} />
            </div>,
          ])}
        />
        <JsonBlock value={selectedPackage?.manifest ?? { hint: '选择包后在这里查看 manifest 摘要' }} />
      </Panel>

      <Panel title="发布管理" subtitle="创建 release，并通过 Dynamic Group 持续命中新增终端">
        <div className="form-grid columns-3">
          <SelectInput
            label="Package"
            value={releasePackageId}
            onChange={setReleasePackageId}
            options={packages.length > 0
              ? packages.map(item => ({ value: item.packageId, label: `${item.bundleVersion} / ${item.packageId}` }))
              : [{ value: '', label: '暂无已上传包', disabled: true }]}
          />
          <SelectInput
            label="Scope Type"
            value={releaseScopeType}
            onChange={(value) => {
              const next = value as 'GROUP' | 'TERMINAL'
              setReleaseScopeType(next)
              setReleaseScopeKey(next === 'GROUP' ? (groups[0]?.groupId ?? '') : (terminals[0]?.terminalId ?? ''))
            }}
            options={[
              { value: 'GROUP', label: 'GROUP' },
              { value: 'TERMINAL', label: 'TERMINAL' },
            ]}
          />
          <SelectInput
            label="Scope"
            value={releaseScopeKey}
            onChange={setReleaseScopeKey}
            options={scopeOptions.length > 0 ? scopeOptions : [{ value: '', label: '暂无可用目标', disabled: true }]}
          />
        </div>
        <div className="button-group inline-actions">
          <ActionButton
            label="创建 Release"
            tone="primary"
            onClick={() => void runAction(async () => {
              if (!releasePackageId || !releaseScopeKey) throw new Error('请先选择 package 和目标范围')
              await api.createHotUpdateRelease({
                packageId: releasePackageId,
                scopeType: releaseScopeType,
                scopeKey: releaseScopeKey,
                createdBy: 'mock-terminal-platform-web',
                restart: { mode: 'manual', operatorInstruction: 'cashier idle restart' },
              })
            }, '已创建热更新 release')}
          />
        </div>
        <div className="form-grid columns-3">
          <TextInput label="筛选 Release" value={releaseKeyword} onChange={setReleaseKeyword} placeholder="release / package / scope / status / bundle" />
        </div>
        <DataTable
          columns={['Release', 'Package', 'Bundle', 'Scope', '状态', 'Policy', '更新时间', '操作']}
          rows={filteredReleases.map(item => [
            item.releaseId,
            item.packageId,
            item.packageSummary?.bundleVersion ?? '--',
            `${item.scopeType}:${item.scopeKey}`,
            item.status === 'ACTIVE'
              ? <InlineBadge key={`${item.releaseId}-status`} tone="success">ACTIVE</InlineBadge>
              : item.status === 'CANCELLED'
                ? <InlineBadge key={`${item.releaseId}-status`} tone="warning">CANCELLED</InlineBadge>
                : <InlineBadge key={`${item.releaseId}-status`}>{item.status}</InlineBadge>,
            item.policyId ?? '--',
            formatTime(item.updatedAt),
            <div key={`${item.releaseId}-actions`} className="button-group">
              <ActionButton label="预览影响" onClick={() => void api.previewHotUpdateReleaseImpact(item.releaseId).then(setImpactPreview).catch(err => setError(err instanceof Error ? err.message : '预览失败'))} />
              <ActionButton label="激活" tone="primary" onClick={() => void runAction(() => api.activateHotUpdateRelease(item.releaseId), `已激活 release ${item.releaseId}`)} />
              <ActionButton label="暂停" onClick={() => void runAction(() => api.pauseHotUpdateRelease(item.releaseId), `已暂停 release ${item.releaseId}`)} />
              <ActionButton label="取消" tone="danger" onClick={() => void runAction(() => api.cancelHotUpdateRelease(item.releaseId), `已取消 release ${item.releaseId}`)} />
            </div>,
          ])}
        />
        {impactPreview ? (
          <div className="inline-actions">
            <InlineBadge tone={impactPreview.total > 0 ? 'success' : 'warning'}>命中 {impactPreview.total} 台</InlineBadge>
            {impactPreview.reason ? <span className="muted">{impactPreview.reason}</span> : null}
            {(impactPreview.warnings ?? []).map(item => (
              <InlineBadge key={item} tone="warning">{item}</InlineBadge>
            ))}
          </div>
        ) : null}
        <JsonBlock value={impactPreview ?? { hint: '点击“预览影响”查看目标终端集合' }} />
      </Panel>

      <Panel title="版本观测" subtitle="查看当前 drift 与终端版本历史">
        <div className="form-grid columns-3">
          <SelectInput
            label="终端"
            value={selectedTerminalId}
            onChange={setSelectedTerminalId}
            options={terminals.length > 0 ? terminals.map(item => ({ value: item.terminalId, label: `${item.terminalId} / ${item.storeId}` })) : [{ value: '', label: '暂无终端', disabled: true }]}
          />
          <TextInput label="筛选 Drift" value={driftKeyword} onChange={setDriftKeyword} placeholder="terminal / bundle / source / state" />
        </div>
        <div className="two-column">
          <DataTable
            columns={['Terminal', 'Bundle', 'Source', 'State', 'ReportedAt']}
            rows={filteredVersionDrift.map(item => [
              item.terminalId,
              item.bundleVersion,
              item.source,
              item.state,
              formatTime(item.reportedAt),
            ])}
          />
          <DataTable
            columns={['Bundle', 'Source', 'State', 'Package', '时间']}
            rows={versionHistory.map(item => [
              item.bundleVersion,
              item.source,
              item.state,
              item.packageId ?? '--',
              formatTime(item.reportedAt),
            ])}
          />
        </div>
      </Panel>
    </>
  )
}
