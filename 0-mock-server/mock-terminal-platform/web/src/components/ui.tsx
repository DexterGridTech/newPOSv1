import type { ChangeEvent, FormEvent, ReactNode } from 'react'

export function AppShell(props: {
  title: string
  subtitle: string
  sections: ReadonlyArray<{ key: string; label: string; badge?: string; children?: ReadonlyArray<{ key: string; label: string; badge?: string }> }>
  activeKey: string
  onChange: (key: string) => void
  topbarExtra?: ReactNode
  children: ReactNode
}) {
  const { title, subtitle, sections, activeKey, onChange, topbarExtra, children } = props
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">MT</div>
          <div>
            <div className="brand-title">Mock Terminal</div>
            <div className="brand-subtitle">Platform Console</div>
          </div>
        </div>
        <nav className="nav-list">
          {sections.map((section) => {
            const sectionActive = activeKey === section.key || section.children?.some((child) => child.key === activeKey)
            return (
            <div key={section.key} className="nav-group">
              <button
                type="button"
                className={`nav-item ${sectionActive ? 'active' : ''}`}
                onClick={() => onChange(section.key)}
              >
                <span>{section.label}</span>
                {section.badge ? <span className="nav-badge">{section.badge}</span> : null}
              </button>
              {section.children?.length ? (
                <div className="subnav-list">
                  {section.children.map((child) => (
                    <button
                      type="button"
                      key={child.key}
                      className={`subnav-item ${activeKey === child.key ? 'active' : ''}`}
                      onClick={() => onChange(child.key)}
                    >
                      <span>{child.label}</span>
                      {child.badge ? <span className="nav-badge">{child.badge}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )})}
        </nav>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-right">
            {topbarExtra}
            <div className="topbar-meta">
              <span className="chip">真实控制台风格</span>
              <span className="chip emphasis">高自由度联调</span>
            </div>
          </div>
        </header>
        <section className="content-grid">{children}</section>
      </main>
    </div>
  )
}

export function Panel(props: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; dense?: boolean }) {
  return (
    <section className={`panel ${props.dense ? 'dense' : ''}`}>
      <div className="panel-header">
        <div>
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>
        {props.actions ? <div className="panel-actions">{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  )
}

export function StatCard(props: { label: string; value: string | number; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className={`stat-card ${props.tone ?? 'default'}`}>
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}</div>
    </div>
  )
}

export function DataTable(props: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function KeyValueList(props: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="kv-list">
      {props.items.map((item) => (
        <div className="kv-item" key={item.label}>
          <div className="kv-label">{item.label}</div>
          <div className="kv-value">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

export function JsonBlock(props: { value: unknown }) {
  return <pre className="json-block">{JSON.stringify(props.value, null, 2)}</pre>
}

export function ActionButton(props: { label: string; onClick: () => void | Promise<void>; tone?: 'default' | 'primary' | 'danger' }) {
  return (
    <button type="button" className={`action-button ${props.tone ?? 'default'}`} onClick={() => void props.onClick()}>
      {props.label}
    </button>
  )
}

export function TextInput(props: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  multiline?: boolean
  minRows?: number
  readOnly?: boolean
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.multiline ? (
        <textarea
          value={props.value}
          placeholder={props.placeholder}
          rows={props.minRows ?? 4}
          readOnly={props.readOnly}
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <input
          value={props.value}
          placeholder={props.placeholder}
          readOnly={props.readOnly}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </label>
  )
}

export function SelectInput(props: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string; disabled?: boolean }>
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FormGrid(props: { onSubmit?: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode; columns?: 2 | 3 }) {
  return (
    <form
      className={`form-grid columns-${props.columns ?? 2}`}
      onSubmit={(event) => {
        event.preventDefault()
        props.onSubmit?.(event)
      }}
    >
      {props.children}
    </form>
  )
}

export function Pager(props: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="button-group inline-actions">
      <ActionButton label="上一页" onClick={props.onPrev} />
      <span className="pager-text">第 {props.page} / {props.totalPages} 页</span>
      <ActionButton label="下一页" onClick={props.onNext} />
    </div>
  )
}

export function InlineBadge(props: { tone?: 'default' | 'primary' | 'success' | 'warning'; children: ReactNode }) {
  return <span className={`inline-badge ${props.tone ?? 'default'}`}>{props.children}</span>
}
