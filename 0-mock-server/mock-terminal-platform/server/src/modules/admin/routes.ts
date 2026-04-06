import { Router } from 'express'
import { ok, created, fail } from '../../shared/http.js'
import { parsePagination } from '../../shared/pagination.js'
import { listAuditLogs, listSandboxes, getPlatformOverview } from '../sandbox/service.js'
import {
  activateTerminal,
  batchCreateTerminals,
  createActivationCodes,
  createTaskInstancesForRelease,
  createTaskRelease,
  forceTerminalStatus,
  getTaskTrace,
  listActivationCodes,
  listProfiles,
  listTaskInstances,
  listTaskReleases,
  listTemplates,
  listTerminals,
  refreshTerminalToken,
  reportTaskResult,
  updateDeliveryStatus,
} from '../tcp/service.js'
import {
  connectSession,
  createTopic,
  disconnectSession,
  dispatchTaskReleaseToDataPlane,
  getTerminalChanges,
  getTerminalSnapshot,
  heartbeatSession,
  listChangeLogs,
  listProjections,
  listScopes,
  listSessions,
  listTopics,
  upsertProjection,
} from '../tdp/service.js'
import { createFaultRule, applyMockResult, listFaultRules, simulateFaultHit, updateFaultRule } from '../fault/service.js'
import { listSceneTemplates, runSceneTemplate } from '../scene/service.js'
import { appendAuditLog } from './audit.js'
import { exportMockData, exportMockDataText } from '../export/service.js'
import { importMockTemplates, validateImportPayload } from '../export/importService.js'
import { faultTemplates, topicTemplates } from '../export/templateLibrary.js'

export const createRouter = () => {
  const router = Router()

  router.get('/api/v1/admin/overview', (_req, res) => ok(res, getPlatformOverview()))
  router.get('/api/v1/admin/sandboxes', (_req, res) => ok(res, listSandboxes()))
  router.get('/api/v1/admin/audit-logs', (req, res) => ok(res, listAuditLogs(parsePagination(req.query))))
  router.get('/api/v1/admin/export', (_req, res) => ok(res, exportMockData()))
  router.get('/api/v1/admin/templates/topic-library', (_req, res) => ok(res, topicTemplates))
  router.get('/api/v1/admin/templates/fault-library', (_req, res) => ok(res, faultTemplates))
  router.post('/api/v1/admin/import/templates/validate', (req, res) => {
    try {
      return ok(res, validateImportPayload(req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '导入预检失败', 400)
    }
  })
  router.post('/api/v1/admin/import/templates', (req, res) => {
    try {
      const result = importMockTemplates(req.body)
      appendAuditLog({ domain: 'IMPORT', action: 'IMPORT_TEMPLATES', targetId: 'templates', detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '导入模板失败', 400)
    }
  })
  router.get('/api/v1/admin/export/download', (_req, res) => {
    const content = exportMockDataText()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="mock-terminal-platform-export.json"')
    res.status(200).send(content)
  })

  router.get('/api/v1/admin/terminals', (_req, res) => ok(res, listTerminals()))
  router.get('/api/v1/admin/profiles', (_req, res) => ok(res, listProfiles()))
  router.get('/api/v1/admin/templates', (_req, res) => ok(res, listTemplates()))
  router.get('/api/v1/admin/activation-codes', (_req, res) => ok(res, listActivationCodes()))
  router.post('/api/v1/admin/activation-codes/batch', (req, res) => {
    const result = createActivationCodes(req.body)
    appendAuditLog({ domain: 'TCP', action: 'CREATE_ACTIVATION_CODES', targetId: 'activation-codes', detail: result })
    return created(res, result)
  })

  router.post('/api/v1/terminals/activate', (req, res) => {
    try {
      const result = activateTerminal(req.body)
      appendAuditLog({ domain: 'TCP', action: 'ACTIVATE_TERMINAL', targetId: result.terminalId, detail: req.body, operator: 'terminal-client' })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '激活失败')
    }
  })

  router.post('/api/v1/terminals/token/refresh', (req, res) => {
    try {
      return ok(res, refreshTerminalToken(req.body.refreshToken))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '刷新失败')
    }
  })

  router.get('/api/v1/admin/tasks/releases', (_req, res) => ok(res, listTaskReleases()))
  router.get('/api/v1/admin/tasks/instances', (_req, res) => ok(res, listTaskInstances()))
  router.get('/api/v1/admin/tasks/instances/:instanceId/trace', (req, res) => {
    try {
      return ok(res, getTaskTrace(req.params.instanceId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '任务链路查询失败', 404)
    }
  })

  router.post('/api/v1/admin/tasks/releases', (req, res) => {
    try {
      const release = createTaskRelease(req.body)
      const dispatch = createTaskInstancesForRelease(release.releaseId)
      const tdp = dispatchTaskReleaseToDataPlane(release.releaseId)
      appendAuditLog({ domain: 'TCP', action: 'CREATE_TASK_RELEASE', targetId: release.releaseId, detail: { request: req.body, dispatch, tdp } })
      return created(res, { release, dispatch, tdp })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建任务失败')
    }
  })

  router.post('/api/v1/terminals/:terminalId/tasks/:instanceId/result', (req, res) => ok(res, reportTaskResult(req.params.instanceId, req.body)))
  router.post('/internal/data-plane/tasks/delivery-status', (req, res) => ok(res, updateDeliveryStatus(req.body.instanceId, req.body.deliveryStatus, req.body.error)))
  router.post('/internal/control-plane/tasks/dispatch', (req, res) => {
    try {
      const dispatch = createTaskInstancesForRelease(req.body.releaseId)
      const tdp = dispatchTaskReleaseToDataPlane(req.body.releaseId)
      appendAuditLog({ domain: 'TCP', action: 'DISPATCH_TASK_RELEASE', targetId: req.body.releaseId, detail: { dispatch, tdp } })
      return ok(res, { ...dispatch, ...tdp })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '投递失败')
    }
  })

  router.get('/api/v1/admin/tdp/sessions', (_req, res) => ok(res, listSessions()))
  router.post('/api/v1/tdp/sessions/connect', (req, res) => {
    const result = connectSession(req.body)
    appendAuditLog({ domain: 'TDP', action: 'CONNECT_SESSION', targetId: result.sessionId, detail: req.body, operator: 'terminal-client' })
    return created(res, result)
  })
  router.post('/api/v1/tdp/sessions/:sessionId/heartbeat', (req, res) => ok(res, heartbeatSession(req.params.sessionId)))
  router.post('/api/v1/tdp/sessions/:sessionId/disconnect', (req, res) => {
    const result = disconnectSession(req.params.sessionId)
    appendAuditLog({ domain: 'TDP', action: 'DISCONNECT_SESSION', targetId: req.params.sessionId, detail: result, operator: 'terminal-client' })
    return ok(res, result)
  })

  router.get('/api/v1/admin/tdp/topics', (_req, res) => ok(res, listTopics()))
  router.post('/api/v1/admin/tdp/topics', (req, res) => {
    const result = createTopic(req.body)
    appendAuditLog({ domain: 'TDP', action: 'CREATE_TOPIC', targetId: result.topicId, detail: req.body })
    return created(res, result)
  })
  router.get('/api/v1/admin/tdp/scopes', (_req, res) => ok(res, listScopes()))
  router.post('/api/v1/admin/tdp/projections/upsert', (req, res) => {
    const result = upsertProjection(req.body)
    appendAuditLog({ domain: 'TDP', action: 'UPSERT_PROJECTION', targetId: `${result.topicKey}:${result.scopeKey}`, detail: req.body })
    return ok(res, result)
  })
  router.get('/api/v1/admin/tdp/projections', (_req, res) => ok(res, listProjections()))
  router.get('/api/v1/admin/tdp/change-logs', (_req, res) => ok(res, listChangeLogs()))
  router.get('/api/v1/tdp/terminals/:terminalId/snapshot', (req, res) => ok(res, getTerminalSnapshot(req.params.terminalId)))
  router.get('/api/v1/tdp/terminals/:terminalId/changes', (req, res) => ok(res, getTerminalChanges(req.params.terminalId)))

  router.get('/mock-admin/scenes/templates', (_req, res) => ok(res, listSceneTemplates()))
  router.post('/mock-admin/scenes/:sceneTemplateId/run', (req, res) => {
    const result = runSceneTemplate(req.params.sceneTemplateId)
    appendAuditLog({ domain: 'SCENE', action: 'RUN_SCENE_TEMPLATE', targetId: req.params.sceneTemplateId, detail: result })
    return ok(res, result)
  })
  router.post('/mock-admin/terminals/batch-create', (req, res) => {
    const result = batchCreateTerminals(Number(req.body.count ?? 10))
    appendAuditLog({ domain: 'TCP', action: 'BATCH_CREATE_TERMINALS', targetId: 'terminals', detail: result })
    return ok(res, result)
  })
  router.post('/mock-admin/terminals/:terminalId/force-status', (req, res) => {
    const result = forceTerminalStatus(req.params.terminalId, req.body)
    appendAuditLog({ domain: 'TCP', action: 'FORCE_TERMINAL_STATUS', targetId: req.params.terminalId, detail: req.body })
    return ok(res, result)
  })

  router.get('/mock-admin/fault-rules', (_req, res) => ok(res, listFaultRules()))
  router.post('/mock-admin/fault-rules', (req, res) => {
    const result = createFaultRule(req.body)
    appendAuditLog({ domain: 'FAULT', action: 'CREATE_FAULT_RULE', targetId: result.faultRuleId, detail: req.body })
    return created(res, result)
  })
  router.put('/mock-admin/fault-rules/:faultRuleId', (req, res) => {
    try {
      const result = updateFaultRule(req.params.faultRuleId, req.body)
      appendAuditLog({ domain: 'FAULT', action: 'UPDATE_FAULT_RULE', targetId: req.params.faultRuleId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新故障规则失败', 404)
    }
  })
  router.post('/mock-admin/fault-rules/:faultRuleId/hit', (req, res) => {
    const result = simulateFaultHit(req.params.faultRuleId)
    appendAuditLog({ domain: 'FAULT', action: 'SIMULATE_FAULT_HIT', targetId: req.params.faultRuleId, detail: result })
    return ok(res, result)
  })
  router.post('/mock-debug/tasks/:instanceId/mock-result', (req, res) => {
    const result = applyMockResult(req.params.instanceId, req.body)
    appendAuditLog({ domain: 'DEBUG', action: 'MOCK_TASK_RESULT', targetId: req.params.instanceId, detail: req.body })
    return ok(res, result)
  })

  return router
}
