import {DOMAINS} from './app/config'
import {WorkspaceRouter} from './app/WorkspaceRouter'
import {useAdminConsoleState} from './app/useAdminConsoleState'

function App() {
  const state = useAdminConsoleState()
  const {
    loading,
    error,
    message,
    activeDomain,
    setActiveDomain,
    overview,
    documents,
    metrics,
    pendingCount,
    failedCount,
    load,
    applyDemoChange,
    previewPublish,
    publish,
  } = state

  const activeDomainDefinition = DOMAINS.find(item => item.key === activeDomain) ?? DOMAINS[0]
  const showGlobalMetrics = activeDomain === 'projection'

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <span className="brand-mark">AM</span>
          <div>
            <h1>Admin Mall Tenant</h1>
            <p>UC/API aligned master-data console</p>
          </div>
        </div>

        <nav className="domain-nav" aria-label="domain navigation">
          {metrics.map(item => (
            <button
              key={item.key}
              className={item.key === activeDomain ? 'active' : ''}
              onClick={() => setActiveDomain(item.key)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </nav>

        <section className="status-stack">
          <div>
            <span className="label">Outbox</span>
            <strong>{pendingCount} pending</strong>
          </div>
          <div>
            <span className="label">Failed</span>
            <strong className={failedCount > 0 ? 'danger' : ''}>{failedCount}</strong>
          </div>
          <div>
            <span className="label">Legacy docs</span>
            <strong>{documents.length}</strong>
          </div>
        </section>
      </aside>

      <section className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">{activeDomainDefinition.eyebrow}</p>
            <h2>{activeDomainDefinition.title}</h2>
            <p>{activeDomainDefinition.description}</p>
          </div>
          <div className="hero-actions">
            <button onClick={() => void load()} disabled={loading}>刷新</button>
            <button onClick={() => void applyDemoChange()}>生成演示变更</button>
            <button onClick={() => void previewPublish()}>预览发布</button>
            <button className="primary" onClick={() => void publish()} disabled={pendingCount === 0}>发布 pending</button>
          </div>
        </header>

        {error ? <div className="notice error">{error}</div> : null}
        {message ? <div className="notice success">{message}</div> : null}

        {showGlobalMetrics ? (
          <section className="metric-grid">
            {(overview?.alignedEntities ?? []).map(item => (
              <article key={`${item.domain}:${item.entity_type}`} className="metric-card">
                <span>{item.domain}</span>
                <strong>{item.count}</strong>
                <em>{item.entity_type}</em>
              </article>
            ))}
          </section>
        ) : null}

        <section className="workspace-grid domain-workspace">
          <WorkspaceRouter activeDomain={activeDomain} state={state} />
        </section>
      </section>
    </main>
  )
}

export default App
