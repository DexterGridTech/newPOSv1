import type {ReactNode} from 'react'
import {TABLE_PAGE_SIZE_OPTIONS} from '../constants'
import {badgeTone, statusLabel} from '../domain'

export function StatusBadge({value}: {value: string}) {
  return <span className={`customer-v3-badge ${badgeTone(value)}`} title={statusLabel(value)}>{statusLabel(value)}</span>
}

export function PaginationControls(props: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize))
  const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  const to = Math.min(props.total, props.page * props.pageSize)
  return (
    <nav className="customer-v3-pagination" aria-label="列表分页">
      <span>第 {from}-{to} 条，共 {props.total} 条</span>
      <label>
        <span>每页</span>
        <select value={props.pageSize} onChange={event => props.onPageSizeChange(Number(event.target.value))}>
          {TABLE_PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option} 条</option>)}
        </select>
      </label>
      <div>
        <button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(Math.max(1, props.page - 1))}>上一页</button>
        <strong>{props.page} / {totalPages}</strong>
        <button type="button" disabled={props.page >= totalPages} onClick={() => props.onPageChange(Math.min(totalPages, props.page + 1))}>下一页</button>
      </div>
    </nav>
  )
}

export function PageHeader({title, scope, action}: {title: string; scope: string; action?: ReactNode}) {
  return (
    <div className="customer-v3-page-header">
      <div>
        <h1>{title}</h1>
        <p>{scope}</p>
      </div>
      {action}
    </div>
  )
}

export function Modal({title, subtitle, onClose, children, wide}: {title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean}) {
  return (
    <div className="customer-v3-modal-backdrop" role="presentation">
      <section className={`customer-v3-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="customer-v3-modal-body">{children}</div>
      </section>
    </div>
  )
}

export function EmptyState({title, detail}: {title: string; detail: string}) {
  return <div className="customer-v3-empty"><h3>{title}</h3><p>{detail}</p></div>
}

export function SkeletonTable() {
  return <div className="customer-v3-skeleton"><span /><span /><span /><span /></div>
}

