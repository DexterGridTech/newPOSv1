import {JsonPanel} from '../shared'
import {formatTime} from '../utils'
import type {AuditEvent, OutboxItem, ProjectionDiagnostic} from '../types'

type Props = {
  auditEvents: AuditEvent[]
  outbox: OutboxItem[]
  diagnostics: ProjectionDiagnostic[]
  preview: unknown
  previewPublish: () => Promise<void>
  publish: () => Promise<void>
  retry: () => Promise<void>
  pendingCount: number
  failedCount: number
}

export function ProjectionWorkspace(props: Props) {
  const {
    auditEvents,
    outbox,
    diagnostics,
    preview,
    previewPublish,
    publish,
    retry,
    pendingCount,
    failedCount,
  } = props

  return (
    <>
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>业务事件时间线</h3>
            <p className="panel-subtitle">按 aggregate -&gt; event -&gt; outbox -&gt; terminal 的顺序排查一条业务动作是否完整下发。</p>
          </div>
          <span>{auditEvents.length}</span>
        </div>
        <div className="outbox-table">
          {auditEvents.map(item => (
            <div key={item.eventId} className="outbox-row">
              <div>
                <strong>{item.eventType}</strong>
                <span>{item.aggregateType}:{item.aggregateId}</span>
              </div>
              <span>rev {item.sourceRevision}</span>
              <span>{formatTime(item.occurredAt)}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel outbox-panel">
        <div className="panel-title">
          <div>
            <h3>Projection Outbox</h3>
            <p className="panel-subtitle">当前保留 diagnostics 路径驱动发布、重建与预览，同时兼容旧 smoke 入口。</p>
          </div>
          <span>{outbox.length}</span>
        </div>
        <div className="hero-actions panel-actions">
          <button onClick={() => void previewPublish()}>预览发布</button>
          <button className="primary" onClick={() => void publish()} disabled={pendingCount === 0}>发布 pending</button>
          <button onClick={() => void retry()} disabled={failedCount === 0}>失败重试</button>
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
          <div>
            <h3>投影诊断与发布预览</h3>
            <p className="panel-subtitle">用来比对 retained projection、失败诊断与即将发送的 batch-upsert payload。</p>
          </div>
          <span>{diagnostics.length}</span>
        </div>
        <div className="outbox-table">
          {diagnostics.map(item => (
            <div key={item.diagnosticId} className="outbox-row">
              <div>
                <strong>{item.topicKey}</strong>
                <span>{item.scopeType}:{item.scopeKey} · {item.itemKey}</span>
              </div>
              <span className="pill neutral">{item.status}</span>
              <span>{formatTime(item.createdAt)}</span>
            </div>
          ))}
        </div>
        {preview ? <JsonPanel value={preview} /> : <p className="empty">点击“预览发布”查看即将发送到 TDP 的 batch-upsert payload。</p>}
      </article>
    </>
  )
}
