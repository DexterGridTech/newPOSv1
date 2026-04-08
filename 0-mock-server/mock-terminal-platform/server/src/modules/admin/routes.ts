import { Router } from 'express'
import { ok, created, fail } from '../../shared/http.js'
import { parsePagination } from '../../shared/pagination.js'
import { createSandbox, getRuntimeContext, listAuditLogs, listSandboxes, getPlatformOverview, switchCurrentSandbox, updateSandbox } from '../sandbox/service.js'
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
  forceCloseSession,
  getHighWatermarkForTerminal,
  getTerminalChangesSince,
  getTerminalSnapshot,
  heartbeatSession,
  listChangeLogs,
  listCommandOutbox,
  listProjections,
  listScopes,
  listSessions,
  listTopics,
  sendEdgeDegradedToSession,
  sendProtocolErrorToSession,
  sendSessionRehomeRequired,
  upsertProjection,
} from '../tdp/service.js'
import { createFaultRule, applyMockResult, listFaultRules, simulateFaultHit, updateFaultRule } from '../fault/service.js'
import { listSceneTemplates, runSceneTemplate } from '../scene/service.js'
import { appendAuditLog } from './audit.js'
import { exportMockData, exportMockDataText } from '../export/service.js'
import { importMockTemplates, validateImportPayload } from '../export/importService.js'
import { faultTemplates, topicTemplates } from '../export/templateLibrary.js'
import {
  createBrand,
  createContract,
  createPlatform,
  createProfile,
  createProject,
  createStore,
  createTemplate,
  createTenant,
  deleteBrand,
  deleteContract,
  deletePlatform,
  deleteProfile,
  deleteProject,
  deleteStore,
  deleteTemplate,
  deleteTenant,
  listBrands,
  listContracts,
  listPlatforms,
  listProfiles as listMasterProfiles,
  listProjects,
  listStores,
  listTemplates as listMasterTemplates,
  listTenants,
  updateBrand,
  updateContract,
  updatePlatform,
  updateProfile,
  updateProject,
  updateStore,
  updateTemplate,
  updateTenant,
} from '../master-data/service.js'

export const createRouter = () => {
  const router = Router()

  router.get('/api/v1/admin/overview', (_req, res) => ok(res, getPlatformOverview()))
  router.get('/api/v1/admin/runtime-context', (_req, res) => ok(res, getRuntimeContext()))
  router.put('/api/v1/admin/runtime-context/current-sandbox', (req, res) => {
    try {
      const result = switchCurrentSandbox(req.body.sandboxId)
      appendAuditLog({ domain: 'SANDBOX', action: 'SWITCH_CURRENT_SANDBOX', targetId: req.body.sandboxId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '切换沙箱失败', 400)
    }
  })
  router.get('/api/v1/admin/sandboxes', (_req, res) => ok(res, listSandboxes()))
  router.post('/api/v1/admin/sandboxes', (req, res) => {
    try {
      const result = createSandbox(req.body)
      appendAuditLog({ domain: 'SANDBOX', action: 'CREATE_SANDBOX', targetId: result.sandboxId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建沙箱失败', 400)
    }
  })
  router.put('/api/v1/admin/sandboxes/:sandboxId', (req, res) => {
    try {
      const result = updateSandbox(req.params.sandboxId, req.body)
      appendAuditLog({ domain: 'SANDBOX', action: 'UPDATE_SANDBOX', targetId: req.params.sandboxId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新沙箱失败', 400)
    }
  })
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
  router.get('/api/v1/admin/master-data/platforms', (_req, res) => ok(res, listPlatforms()))
  router.post('/api/v1/admin/master-data/platforms', (req, res) => {
    try {
      const result = createPlatform(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PLATFORM', targetId: result.platformId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建平台失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/platforms/:platformId', (req, res) => {
    try {
      const result = updatePlatform(req.params.platformId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PLATFORM', targetId: req.params.platformId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新平台失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/platforms/:platformId', (req, res) => {
    try {
      const result = deletePlatform(req.params.platformId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PLATFORM', targetId: req.params.platformId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除平台失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/tenants', (_req, res) => ok(res, listTenants()))
  router.post('/api/v1/admin/master-data/tenants', (req, res) => {
    try {
      const result = createTenant(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_TENANT', targetId: result.tenantId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建租户失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/tenants/:tenantId', (req, res) => {
    try {
      const result = updateTenant(req.params.tenantId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_TENANT', targetId: req.params.tenantId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新租户失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/tenants/:tenantId', (req, res) => {
    try {
      const result = deleteTenant(req.params.tenantId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_TENANT', targetId: req.params.tenantId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除租户失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/brands', (_req, res) => ok(res, listBrands()))
  router.post('/api/v1/admin/master-data/brands', (req, res) => {
    try {
      const result = createBrand(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_BRAND', targetId: result.brandId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建品牌失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/brands/:brandId', (req, res) => {
    try {
      const result = updateBrand(req.params.brandId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_BRAND', targetId: req.params.brandId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新品牌失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/brands/:brandId', (req, res) => {
    try {
      const result = deleteBrand(req.params.brandId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_BRAND', targetId: req.params.brandId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除品牌失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/projects', (_req, res) => ok(res, listProjects()))
  router.post('/api/v1/admin/master-data/projects', (req, res) => {
    try {
      const result = createProject(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PROJECT', targetId: result.projectId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建项目失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/projects/:projectId', (req, res) => {
    try {
      const result = updateProject(req.params.projectId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PROJECT', targetId: req.params.projectId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新项目失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/projects/:projectId', (req, res) => {
    try {
      const result = deleteProject(req.params.projectId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PROJECT', targetId: req.params.projectId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除项目失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/stores', (_req, res) => ok(res, listStores()))
  router.post('/api/v1/admin/master-data/stores', (req, res) => {
    try {
      const result = createStore(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_STORE', targetId: result.storeId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建门店失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/stores/:storeId', (req, res) => {
    try {
      const result = updateStore(req.params.storeId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_STORE', targetId: req.params.storeId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新门店失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/stores/:storeId', (req, res) => {
    try {
      const result = deleteStore(req.params.storeId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_STORE', targetId: req.params.storeId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除门店失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/contracts', (_req, res) => ok(res, listContracts()))
  router.post('/api/v1/admin/master-data/contracts', (req, res) => {
    try {
      const result = createContract(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_CONTRACT', targetId: result.contractId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建合同失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/contracts/:contractId', (req, res) => {
    try {
      const result = updateContract(req.params.contractId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_CONTRACT', targetId: req.params.contractId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新合同失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/contracts/:contractId', (req, res) => {
    try {
      const result = deleteContract(req.params.contractId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_CONTRACT', targetId: req.params.contractId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除合同失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/profiles', (_req, res) => ok(res, listMasterProfiles()))
  router.post('/api/v1/admin/master-data/profiles', (req, res) => {
    try {
      const result = createProfile(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PROFILE', targetId: result.profileId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建终端 Profile 失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/profiles/:profileId', (req, res) => {
    try {
      const result = updateProfile(req.params.profileId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PROFILE', targetId: req.params.profileId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新终端 Profile 失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/profiles/:profileId', (req, res) => {
    try {
      const result = deleteProfile(req.params.profileId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PROFILE', targetId: req.params.profileId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除终端 Profile 失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/templates', (_req, res) => ok(res, listMasterTemplates()))
  router.post('/api/v1/admin/master-data/templates', (req, res) => {
    try {
      const result = createTemplate(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_TEMPLATE', targetId: result.templateId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建终端 Template 失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/templates/:templateId', (req, res) => {
    try {
      const result = updateTemplate(req.params.templateId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_TEMPLATE', targetId: req.params.templateId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新终端 Template 失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/templates/:templateId', (req, res) => {
    try {
      const result = deleteTemplate(req.params.templateId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_TEMPLATE', targetId: req.params.templateId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除终端 Template 失败', 400)
    }
  })
  router.post('/api/v1/admin/activation-codes/batch', (req, res) => {
    try {
      const result = createActivationCodes(req.body)
      appendAuditLog({ domain: 'TCP', action: 'CREATE_ACTIVATION_CODES', targetId: 'activation-codes', detail: result })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '生成激活码失败', 400)
    }
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
  router.post('/api/v1/admin/tdp/sessions/:sessionId/edge-degraded', (req, res) => {
    try {
      const result = sendEdgeDegradedToSession({
        sessionId: req.params.sessionId,
        reason: req.body.reason,
        nodeState: req.body.nodeState,
        gracePeriodSeconds: req.body.gracePeriodSeconds,
        alternativeEndpoints: req.body.alternativeEndpoints,
      })
      appendAuditLog({ domain: 'TDP', action: 'SEND_EDGE_DEGRADED', targetId: req.params.sessionId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '发送 EDGE_DEGRADED 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/sessions/:sessionId/rehome', (req, res) => {
    try {
      const result = sendSessionRehomeRequired({
        sessionId: req.params.sessionId,
        reason: req.body.reason,
        deadline: req.body.deadline,
        alternativeEndpoints: req.body.alternativeEndpoints,
      })
      appendAuditLog({ domain: 'TDP', action: 'SEND_SESSION_REHOME_REQUIRED', targetId: req.params.sessionId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '发送 SESSION_REHOME_REQUIRED 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/sessions/:sessionId/protocol-error', (req, res) => {
    try {
      const result = sendProtocolErrorToSession({
        sessionId: req.params.sessionId,
        code: req.body.code,
        message: req.body.message,
        details: req.body.details,
        closeAfterSend: req.body.closeAfterSend,
      })
      appendAuditLog({ domain: 'TDP', action: 'SEND_PROTOCOL_ERROR', targetId: req.params.sessionId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '发送协议错误失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/sessions/:sessionId/force-close', (req, res) => {
    try {
      const result = forceCloseSession({
        sessionId: req.params.sessionId,
        code: req.body.code,
        reason: req.body.reason,
      })
      appendAuditLog({ domain: 'TDP', action: 'FORCE_CLOSE_SESSION', targetId: req.params.sessionId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '强制关闭 session 失败', 400)
    }
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
  router.get('/api/v1/admin/tdp/commands', (_req, res) => ok(res, listCommandOutbox()))
  router.get('/api/v1/tdp/terminals/:terminalId/snapshot', (req, res) => ok(res, getTerminalSnapshot(req.params.terminalId)))
  router.get('/api/v1/tdp/terminals/:terminalId/changes', (req, res) => {
    const cursor = Math.max(0, Number(req.query.cursor ?? 0))
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 100)))
    const changes = getTerminalChangesSince(req.params.terminalId, cursor, limit)
    const nextCursor = changes.length ? changes[changes.length - 1].cursor : cursor
    const highWatermark = getHighWatermarkForTerminal(req.params.terminalId)
    return ok(res, {
      terminalId: req.params.terminalId,
      changes: changes.map(item => item.change),
      nextCursor,
      hasMore: nextCursor < highWatermark,
      highWatermark,
    })
  })

  router.get('/mock-admin/scenes/templates', (_req, res) => ok(res, listSceneTemplates()))
  router.post('/mock-admin/scenes/:sceneTemplateId/run', (req, res) => {
    const result = runSceneTemplate(req.params.sceneTemplateId)
    appendAuditLog({ domain: 'SCENE', action: 'RUN_SCENE_TEMPLATE', targetId: req.params.sceneTemplateId, detail: result })
    return ok(res, result)
  })
  router.post('/mock-admin/terminals/batch-create', (req, res) => {
    try {
      const result = batchCreateTerminals(Number(req.body.count ?? 10))
      appendAuditLog({ domain: 'TCP', action: 'BATCH_CREATE_TERMINALS', targetId: 'terminals', detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '批量创建终端失败', 400)
    }
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
