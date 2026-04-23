import {useEffect, useMemo, useState} from 'react'
import {api} from './api'

type DocumentItem = Awaited<ReturnType<typeof api.getDocuments>>[number]
type OutboxItem = Awaited<ReturnType<typeof api.getProjectionOutbox>>[number]

const domainLabels: Record<string, string> = {
  organization: '组织与租户',
  iam: '用户角色权限',
  'catering-product': '餐饮商品',
  'catering-store-operating': '门店经营',
}

const formatTime = (value?: number) => value
  ? new Date(value).toLocaleString('zh-CN', {hour12: false})
  : '--'

const JsonPanel = ({value}: {value: unknown}) => (
  <pre className="json-panel">{JSON.stringify(value, null, 2)}</pre>
)

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.getOverview>> | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [authCapabilities, setAuthCapabilities] = useState<Awaited<ReturnType<typeof api.getTerminalAuthCapabilities>> | null>(null)
  const [activeDomain, setActiveDomain] = useState('organization')
  const [selectedDocId, setSelectedDocId] = useState('')
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewProjectionOutbox>> | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextOverview, nextDocuments, nextOutbox, nextAuth] = await Promise.all([
        api.getOverview(),
        api.getDocuments(),
        api.getProjectionOutbox(),
        api.getTerminalAuthCapabilities(),
      ])
      setOverview(nextOverview)
      setDocuments(nextDocuments)
      setOutbox(nextOutbox)
      setAuthCapabilities(nextAuth)
      setSelectedDocId(current => current || nextDocuments[0]?.docId || '')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const domains = useMemo(() => {
    const keys = [...new Set(documents.map(item => item.domain))]
    return keys.length ? keys : Object.keys(domainLabels)
  }, [documents])

  const visibleDocuments = useMemo(
    () => documents.filter(item => item.domain === activeDomain),
    [documents, activeDomain],
  )
  const selectedDocument = documents.find(item => item.docId === selectedDocId) ?? visibleDocuments[0]
  const pendingCount = outbox.filter(item => item.status === 'PENDING').length
  const failedCount = outbox.filter(item => item.status === 'FAILED').length
  const publishedCount = outbox.filter(item => item.status === 'PUBLISHED').length

  const publish = async () => {
    setMessage('')
    setError('')
    try {
      const result = await api.publishProjectionOutbox()
      setMessage(`已发布 ${result.published}/${result.total} 条 projection 到 mock-terminal-platform`)
      setPreview(null)
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
      await load()
    }
  }

  const retry = async () => {
    const result = await api.retryProjectionOutbox()
    setMessage(`已重新排队 ${result.total} 条失败 outbox`)
    await load()
  }

  const previewPublish = async () => {
    const result = await api.previewProjectionOutbox()
    setPreview(result)
  }

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <span className="brand-mark">AM</span>
          <div>
            <h1>Admin Mall Tenant</h1>
            <p>生产形态主数据 mock 后台</p>
          </div>
        </div>

        <nav className="domain-nav">
          {domains.map(domain => (
            <button
              key={domain}
              className={domain === activeDomain ? 'active' : ''}
              onClick={() => {
                setActiveDomain(domain)
                setSelectedDocId(documents.find(item => item.domain === domain)?.docId ?? '')
              }}
            >
              <span>{domainLabels[domain] ?? domain}</span>
              <strong>{documents.filter(item => item.domain === domain).length}</strong>
            </button>
          ))}
        </nav>

        <section className="status-stack">
          <div>
            <span className="label">Outbox</span>
            <strong>{pendingCount} pending</strong>
          </div>
          <div>
            <span className="label">Published</span>
            <strong>{publishedCount}</strong>
          </div>
          <div>
            <span className="label">Failed</span>
            <strong className={failedCount > 0 ? 'danger' : ''}>{failedCount}</strong>
          </div>
        </section>
      </aside>

      <section className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">TDP Projection Publisher</p>
            <h2>主数据经营台</h2>
            <p>
              使用生产 topic、scope、source_event_id 和 source_revision 语义，把组织、IAM、餐饮商品与门店经营投影推送给终端。
            </p>
          </div>
          <div className="hero-actions">
            <button onClick={() => void load()} disabled={loading}>刷新</button>
            <button onClick={() => void previewPublish()}>预览发布</button>
            <button className="primary" onClick={() => void publish()} disabled={pendingCount === 0}>发布 pending</button>
            <button onClick={() => void retry()} disabled={failedCount === 0}>失败重试</button>
          </div>
        </header>

        {error && <div className="notice error">{error}</div>}
        {message && <div className="notice success">{message}</div>}

        <section className="metric-grid">
          {(overview?.documents ?? []).map(item => (
            <article key={`${item.domain}:${item.entity_type}`} className="metric-card">
              <span>{domainLabels[item.domain] ?? item.domain}</span>
              <strong>{item.count}</strong>
              <em>{item.entity_type}</em>
            </article>
          ))}
        </section>

        <section className="workspace-grid">
          <article className="panel list-panel">
            <div className="panel-title">
              <h3>{domainLabels[activeDomain] ?? activeDomain}</h3>
              <span>{visibleDocuments.length} docs</span>
            </div>
            <div className="document-list">
              {visibleDocuments.map(item => (
                <button
                  key={item.docId}
                  className={item.docId === selectedDocument?.docId ? 'selected' : ''}
                  onClick={() => setSelectedDocId(item.docId)}
                >
                  <span className="doc-title">{item.title}</span>
                  <span className="doc-meta">{item.entityType} · {item.naturalScopeType}:{item.naturalScopeKey}</span>
                  <span className="doc-meta">rev {item.sourceRevision} · {formatTime(item.updatedAt)}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel detail-panel">
            <div className="panel-title">
              <h3>{selectedDocument?.title ?? '未选择数据'}</h3>
              <span>{selectedDocument?.status ?? '--'}</span>
            </div>
            {selectedDocument ? (
              <>
                <div className="facts-grid">
                  <div><span>Entity</span><strong>{selectedDocument.entityType}</strong></div>
                  <div><span>ID</span><strong>{selectedDocument.entityId}</strong></div>
                  <div><span>Scope</span><strong>{selectedDocument.naturalScopeType}:{selectedDocument.naturalScopeKey}</strong></div>
                  <div><span>Revision</span><strong>{selectedDocument.sourceRevision}</strong></div>
                </div>
                <JsonPanel value={selectedDocument.payload} />
              </>
            ) : (
              <p className="empty">暂无主数据</p>
            )}
          </article>

          <article className="panel outbox-panel">
            <div className="panel-title">
              <h3>Projection Outbox</h3>
              <span>{outbox.length} records</span>
            </div>
            <div className="outbox-table">
              {outbox.map(item => (
                <div key={item.outboxId} className="outbox-row">
                  <div>
                    <strong>{item.topicKey}</strong>
                    <span>{item.scopeType}:{item.scopeKey} · {item.itemKey}</span>
                  </div>
                  <span className={`pill ${item.status.toLowerCase()}`}>{item.status}</span>
                  <span>src rev {item.sourceRevision}</span>
                  <span>{item.targetTerminalIds.join(', ') || 'scope fanout'}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel inspector-panel">
            <div className="panel-title">
              <h3>发布预览 / Auth 预留</h3>
              <span>{authCapabilities?.status ?? '--'}</span>
            </div>
            <div className="auth-card">
              <strong>Terminal Auth Boundary</strong>
              <p>{authCapabilities?.tdpPublishPath}</p>
              <span>{authCapabilities?.routes.join(' · ')}</span>
            </div>
            {preview ? <JsonPanel value={preview} /> : <p className="empty">点击“预览发布”查看即将发送到 TDP 的 batch-upsert payload。</p>}
          </article>
        </section>
      </section>
    </main>
  )
}
