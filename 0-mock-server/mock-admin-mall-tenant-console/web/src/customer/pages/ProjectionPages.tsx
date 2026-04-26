import {useEffect, useState} from 'react'
import {DEFAULT_TABLE_PAGE_SIZE} from '../constants'
import type {CustomerEntity, OutboxItem, PublishLogItem} from '../types'
import {PageHeader, PaginationControls, SkeletonTable, StatusBadge} from '../components/common'
import {asArray, asText, enumLabel, formatDateTime, topicLabel} from '../domain'

export function ProjectionOutboxPage({outbox, loading, onPublish, setSelectedRecord}: {outbox: OutboxItem[]; loading: boolean; onPublish: () => Promise<void>; setSelectedRecord: (item: CustomerEntity) => void}) {
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  useEffect(() => {
    setTablePage(1)
  }, [outbox.length])
  const totalPages = Math.max(1, Math.ceil(outbox.length / pageSize))
  const safePage = Math.min(tablePage, totalPages)
  const pagedOutbox = outbox.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <section>
      <PageHeader title="投影队列" scope="展示写操作进入终端同步前后的处理状态" action={<button type="button" onClick={() => void onPublish()}>发布待处理投影</button>} />
      {loading ? <SkeletonTable /> : (
        <>
          <div className="customer-v3-table-wrap">
            <table className="customer-v3-table">
              <thead><tr><th>事件</th><th>投影内容</th><th>业务对象</th><th>范围</th><th>状态</th><th>重试</th><th>最后更新</th><th>操作</th></tr></thead>
              <tbody>
                {pagedOutbox.map(item => (
                  <tr key={item.outboxId} onClick={() => setSelectedRecord(projectionDetailRecord(item))}>
                    <td>{compactId(item.sourceEventId)}</td>
                    <td><span title={item.topicKey}>{topicLabel(item.topicKey)}</span></td>
                    <td>{projectionSubjectLabel(item)}</td>
                    <td>{projectionScopeLabel(item)}</td>
                    <td><StatusBadge value={item.status} /></td>
                    <td>{item.attemptCount}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
                    <td><button type="button" title="查看 payload、topic、scope 等技术数据" onClick={event => {
                      event.stopPropagation()
                      setSelectedRecord(projectionDetailRecord(item))
                    }}>技术数据</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            total={outbox.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setTablePage}
            onPageSizeChange={nextSize => {
              setPageSize(nextSize)
              setTablePage(1)
            }}
          />
        </>
      )}
    </section>
  )
}

export function PublishLogPage({logs, setSelectedRecord}: {logs: PublishLogItem[]; setSelectedRecord: (item: CustomerEntity) => void}) {
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  useEffect(() => {
    setTablePage(1)
  }, [logs.length])
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const safePage = Math.min(tablePage, totalPages)
  const pagedLogs = logs.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <section>
      <PageHeader title="发布日志" scope="投影发布到终端平台的请求和响应" />
      <div className="customer-v3-table-wrap">
        <table className="customer-v3-table">
          <thead><tr><th>日志</th><th>发布批次</th><th>投影数量</th><th>目标终端</th><th>发布结果</th><th>发布时间</th><th>操作</th></tr></thead>
          <tbody>{pagedLogs.map(log => {
            const summary = publishLogSummary(log)
            return (
              <tr key={log.publishId} onClick={() => setSelectedRecord(publishLogDetailRecord(log))}>
                <td>{compactId(log.publishId)}</td>
                <td>{summary.batchLabel}</td>
                <td>{summary.projectionCount}</td>
                <td>{summary.targetLabel}</td>
                <td><StatusBadge value={summary.status} /></td>
                <td>{formatDateTime(log.createdAt)}</td>
                <td><button type="button" title="查看请求和响应明细" onClick={event => {
                  event.stopPropagation()
                  setSelectedRecord(publishLogDetailRecord(log))
                }}>技术数据</button></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
      <PaginationControls
        total={logs.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setTablePage}
        onPageSizeChange={nextSize => {
          setPageSize(nextSize)
          setTablePage(1)
        }}
      />
    </section>
  )
}

function compactId(value: unknown) {
  const raw = asText(value)
  return raw.length > 22 ? `${raw.slice(0, 10)}...${raw.slice(-6)}` : raw
}

function projectionPayloadData(item: OutboxItem) {
  const data = item.payload?.data
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
}

function projectionSubjectLabel(item: OutboxItem) {
  const data = projectionPayloadData(item)
  const candidateKeys = [
    'store_name',
    'menu_name',
    'product_name',
    'role_name',
    'permission_name',
    'display_name',
    'contract_code',
    'tenant_name',
    'brand_name',
    'project_name',
    'platform_name',
    'table_no',
    'workstation_name',
    'rule_name',
  ]
  const value = candidateKeys.map(key => asText(data[key], '')).find(Boolean)
  return value || compactId(item.itemKey)
}

function projectionScopeLabel(item: OutboxItem) {
  const scope = enumLabel(item.scopeType)
  return scope === '--' ? '业务范围' : scope
}

function projectionDetailRecord(item: OutboxItem): CustomerEntity {
  return {
    aggregateId: item.outboxId,
    entityId: item.outboxId,
    title: topicLabel(item.topicKey),
    status: item.status,
    entityType: 'projection_outbox',
    sourceRevision: item.sourceRevision,
    updatedAt: item.updatedAt,
    payload: {
      data: {
        event_label: topicLabel(item.topicKey),
        business_object: projectionSubjectLabel(item),
        business_scope: projectionScopeLabel(item),
        publish_status: item.status,
        retry_count: item.attemptCount,
        last_error: item.lastError,
      },
      topic_key: item.topicKey,
      scope_type: item.scopeType,
      scope_key: item.scopeKey,
      item_key: item.itemKey,
      payload: item.payload,
      target_terminal_ids: item.targetTerminalIds,
    },
  }
}

function publishLogSummary(log: PublishLogItem) {
  const request = log.request ?? {}
  const response = log.response ?? {}
  const projections = asArray(request.projections)
  const outboxIds = asText(log.outboxId, '').split(',').map(item => item.trim()).filter(Boolean)
  const projectionCount = projections.length || outboxIds.length || 1
  const targetIds = projections.flatMap(item => asArray((item as Record<string, unknown>).targetTerminalIds)).filter(Boolean)
  const targetLabel = targetIds.length > 0 ? `${new Set(targetIds.map(String)).size} 台终端` : '全部适用终端'
  const failed = response.success === false || response.ok === false || Boolean(response.error)
  return {
    batchLabel: projectionCount > 1 ? `${projectionCount} 个事件` : compactId(log.outboxId),
    projectionCount,
    targetLabel,
    status: failed ? 'FAILED' : 'PUBLISHED',
  }
}

function publishLogDetailRecord(log: PublishLogItem): CustomerEntity {
  const summary = publishLogSummary(log)
  return {
    aggregateId: log.publishId,
    entityId: log.publishId,
    title: '发布日志详情',
    status: summary.status,
    entityType: 'projection_publish_log',
    updatedAt: log.createdAt,
    payload: {
      data: {
        publish_id: compactId(log.publishId),
        outbox_batch: summary.batchLabel,
        projection_count: summary.projectionCount,
        target_terminal: summary.targetLabel,
        publish_status: summary.status,
        published_at: formatDateTime(log.createdAt),
      },
      request: log.request,
      response: log.response,
    },
  }
}
