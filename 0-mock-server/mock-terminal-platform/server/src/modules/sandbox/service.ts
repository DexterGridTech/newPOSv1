import { db, sqlite } from '../../database/index.js'
import { sandboxesTable } from '../../database/schema.js'
import { desc } from 'drizzle-orm'
import { parseJson } from '../../shared/utils.js'
import { paginateItems, type PaginationQuery } from '../../shared/pagination.js'

export const listSandboxes = () =>
  db.select().from(sandboxesTable).orderBy(desc(sandboxesTable.updatedAt)).all().map((item) => ({
    ...item,
    resourceLimits: parseJson(item.resourceLimitsJson, {}),
  }))

export const getPlatformOverview = () => {
  const terminalStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN presence_status = 'ONLINE' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN health_status = 'WARNING' THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN health_status = 'ERROR' THEN 1 ELSE 0 END) as error
    FROM terminal_instances
  `).get() as Record<string, number>

  const taskStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('DISPATCHING', 'IN_PROGRESS') THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM task_releases
  `).get() as Record<string, number>

  const sessionStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'CONNECTED' THEN 1 ELSE 0 END) as connected
    FROM tdp_sessions
  `).get() as Record<string, number>

  const topicStats = sqlite.prepare('SELECT COUNT(*) as total FROM tdp_topics').get() as Record<string, number>
  const faultStats = sqlite.prepare('SELECT COUNT(*) as total, SUM(hit_count) as hits FROM fault_rules').get() as Record<string, number>

  return {
    terminalStats,
    taskStats,
    sessionStats,
    topicStats,
    faultStats,
  }
}

export const listAuditLogs = (pagination?: PaginationQuery) => {
  const rows = sqlite.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500').all() as Array<Record<string, unknown>>
  const mapped = rows.map((item) => ({
    ...item,
    detail: parseJson(String(item.detail_json ?? ''), {}),
  }))

  return pagination ? paginateItems(mapped, pagination) : mapped
}
