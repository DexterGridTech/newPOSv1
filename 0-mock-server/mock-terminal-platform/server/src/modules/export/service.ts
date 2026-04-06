import { sqlite } from '../../database/index.js'
import { parseJson } from '../../shared/utils.js'

const normalizeRows = (rows: Array<Record<string, unknown>>) =>
  rows.map((item) => {
    const normalized = { ...item }
    for (const [key, value] of Object.entries(normalized)) {
      if (typeof value === 'string' && key.endsWith('_json')) {
        normalized[key] = parseJson(value, value)
      }
    }
    return normalized
  })

export const exportMockData = () => {
  const topics = normalizeRows(sqlite.prepare('SELECT * FROM tdp_topics ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>)
  const releases = normalizeRows(sqlite.prepare('SELECT * FROM task_releases ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>)
  const instances = normalizeRows(sqlite.prepare('SELECT * FROM task_instances ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>)
  const faults = normalizeRows(sqlite.prepare('SELECT * FROM fault_rules ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>)
  const audits = normalizeRows(sqlite.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500').all() as Array<Record<string, unknown>>)

  return {
    exportedAt: Date.now(),
    topics,
    taskReleases: releases,
    taskInstances: instances,
    faultRules: faults,
    auditLogs: audits,
  }
}

export const exportMockDataText = () => JSON.stringify(exportMockData(), null, 2)
