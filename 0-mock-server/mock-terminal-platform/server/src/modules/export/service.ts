import { sqlite } from '../../database/index.js'
import { parseJson } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'

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
  const sandboxId = getCurrentSandboxId()
  const platforms = normalizeRows(sqlite.prepare('SELECT * FROM platforms WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const tenants = normalizeRows(sqlite.prepare('SELECT * FROM tenants WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const brands = normalizeRows(sqlite.prepare('SELECT * FROM brands WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const projects = normalizeRows(sqlite.prepare('SELECT * FROM projects WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const stores = normalizeRows(sqlite.prepare('SELECT * FROM stores WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const contracts = normalizeRows(sqlite.prepare('SELECT * FROM contracts WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const topics = normalizeRows(sqlite.prepare('SELECT * FROM tdp_topics WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const releases = normalizeRows(sqlite.prepare('SELECT * FROM task_releases WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const instances = normalizeRows(sqlite.prepare('SELECT ti.* FROM task_instances ti JOIN task_releases tr ON tr.release_id = ti.release_id WHERE tr.sandbox_id = ? ORDER BY ti.updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const faults = normalizeRows(sqlite.prepare('SELECT * FROM fault_rules WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId) as Array<Record<string, unknown>>)
  const audits = normalizeRows(sqlite.prepare('SELECT * FROM audit_logs WHERE sandbox_id = ? ORDER BY created_at DESC LIMIT 500').all(sandboxId) as Array<Record<string, unknown>>)

  return {
    sandboxId,
    exportedAt: Date.now(),
    platforms,
    tenants,
    brands,
    projects,
    stores,
    contracts,
    topics,
    taskReleases: releases,
    taskInstances: instances,
    faultRules: faults,
    auditLogs: audits,
  }
}

export const exportMockDataText = () => JSON.stringify(exportMockData(), null, 2)
