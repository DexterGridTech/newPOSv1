import {useEffect, useState} from 'react'
import {DEFAULT_TABLE_PAGE_SIZE} from '../constants'
import type {CollectionState, OutboxItem, PageKey} from '../types'
import {EmptyState, PageHeader, PaginationControls, StatusBadge} from '../components/common'
import {asNumber, asText, dataOf, expiringContracts, formatDate, topicLabel} from '../domain'

export function Dashboard({collections, outbox, selectPage}: {collections: CollectionState; outbox: OutboxItem[]; selectPage: (page: PageKey) => void}) {
  const [taskPage, setTaskPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const failedOutbox = outbox.filter(item => item.status === 'FAILED')
  const expiring = expiringContracts(collections.contracts)
  const lowStock = collections.stock.filter(item => asNumber(dataOf(item).saleable_quantity) <= asNumber(dataOf(item).safety_stock))
  const invalidMenus = collections.storeMenus.filter(item => item.status === 'INVALID')
  const failedByTopic = Object.values(failedOutbox.reduce<Record<string, {topic: string; count: number; latest?: OutboxItem}>>((acc, item) => {
    const current = acc[item.topicKey] ?? {topic: item.topicKey, count: 0}
    acc[item.topicKey] = {
      topic: item.topicKey,
      count: current.count + 1,
      latest: !current.latest || item.updatedAt > current.latest.updatedAt ? item : current.latest,
    }
    return acc
  }, {})).sort((a, b) => (b.latest?.updatedAt ?? 0) - (a.latest?.updatedAt ?? 0))
  const allTasks = [
    ...failedByTopic.map(item => ({level: '高', title: `${topicLabel(item.topic)}同步失败 ${item.count} 条`, detail: item.latest?.lastError ?? item.latest?.itemKey ?? '请查看投影队列处理失败原因', action: '查看投影', page: 'projectionOutbox' as PageKey})),
    ...expiring.map(item => ({level: item.status === 'EXPIRED' ? '紧急' : '高', title: `合同「${item.title}」即将到期`, detail: `到期日：${formatDate(dataOf(item).end_date)}`, action: '查看合同', page: 'contracts' as PageKey})),
    ...invalidMenus.map(item => ({level: '高', title: `门店菜单「${item.title}」无效`, detail: asText(dataOf(item).invalid_reason, '需要重新配置菜单'), action: '查看菜单', page: 'storeMenus' as PageKey})),
    ...lowStock.map(item => ({level: '低', title: `库存预警：${item.title}`, detail: `可售 ${asText(dataOf(item).saleable_quantity)}，安全库存 ${asText(dataOf(item).safety_stock)}`, action: '查看库存', page: 'stock' as PageKey})),
  ]
  useEffect(() => {
    setTaskPage(1)
  }, [allTasks.length])
  const totalPages = Math.max(1, Math.ceil(allTasks.length / pageSize))
  const safePage = Math.min(taskPage, totalPages)
  const tasks = allTasks.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <section className="customer-v3-dashboard">
      <PageHeader title="工作台" scope="5 秒内看到今天最需要处理的事项" />
      <div className="customer-v3-task-list">
        {tasks.length === 0 ? (
          <EmptyState title="当前没有待处理事项" detail="合同、投影、菜单和库存均处于可处理状态。" />
        ) : tasks.map((task, index) => (
          <article className="customer-v3-task" key={`${task.title}-${index}`}>
            <StatusBadge value={task.level} />
            <div>
              <h3>{task.title}</h3>
              <p>{task.detail}</p>
            </div>
            <button type="button" onClick={() => selectPage(task.page)}>{task.action}</button>
          </article>
        ))}
      </div>
      {allTasks.length > 0 ? (
        <PaginationControls
          total={allTasks.length}
          page={safePage}
          pageSize={pageSize}
          onPageChange={setTaskPage}
          onPageSizeChange={nextSize => {
            setPageSize(nextSize)
            setTaskPage(1)
          }}
        />
      ) : null}
    </section>
  )
}

