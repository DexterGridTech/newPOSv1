import {listSandboxes} from '../sandbox/service.js'
import {appendAuditLog} from '../admin/audit.js'
import {pruneTdpChangeLogs} from './service.js'

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000

const resolveIntervalMs = () => {
  const value = Number(process.env.TDP_CHANGE_LOG_PRUNE_INTERVAL_MS)
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_INTERVAL_MS
}

const resolveRetainRecentCursors = () => {
  const value = Number(process.env.TDP_CHANGE_LOG_RETAIN_RECENT_CURSORS)
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined
}

export const runTdpChangeLogPruneOnce = () => {
  const retainRecentCursors = resolveRetainRecentCursors()
  const sandboxes = listSandboxes().filter(item => item.status === 'ACTIVE')
  return sandboxes.map((sandbox) => {
    const result = pruneTdpChangeLogs(sandbox.sandboxId, retainRecentCursors)
    appendAuditLog({
      domain: 'TDP',
      action: 'PRUNE_CHANGE_LOGS_SCHEDULED',
      targetId: sandbox.sandboxId,
      detail: result,
      operator: 'system',
    })
    return result
  })
}

export const startTdpChangeLogRetentionScheduler = () => {
  const timer = setInterval(() => {
    try {
      runTdpChangeLogPruneOnce()
    } catch (error) {
      console.error('[tdp-change-log-retention-prune-failed]', error)
    }
  }, resolveIntervalMs())

  timer.unref?.()

  return () => clearInterval(timer)
}
