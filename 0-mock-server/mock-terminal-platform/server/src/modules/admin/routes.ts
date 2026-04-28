import fs from 'node:fs'
import { Router, type RequestHandler } from 'express'
import { ok, created, fail } from '../../shared/http.js'
import { parsePagination } from '../../shared/pagination.js'
import {
  createSandbox,
  getRuntimeContext,
  listAuditLogs,
  listSandboxes,
  getPlatformOverview,
  prepareKernelBaseTestSandbox,
  switchCurrentSandbox,
  updateSandbox,
} from '../sandbox/service.js'
import {
  activateTerminal,
  batchCreateTerminals,
  createActivationCodes,
  createTaskInstancesForRelease,
  createTaskRelease,
  deactivateTerminal,
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
  pruneTdpChangeLogs,
  sendEdgeDegradedToSession,
  sendProtocolErrorToSession,
  sendSessionRehomeRequired,
  upsertProjection,
  upsertProjectionBatch,
} from '../tdp/service.js'
import {
  createSelectorGroup,
  deleteSelectorGroup,
  getSelectorGroupMemberships,
  getTerminalGroupMemberships,
  listSelectorGroups,
  recomputeTerminalMemberships,
  resolveTerminalIdsByScope,
  updateSelectorGroup,
  upsertTerminalRuntimeFacts,
} from '../tdp/groupService.js'
import {
  createProjectionPolicy,
  getProjectionPolicy,
  deleteProjectionPolicy,
  listProjectionPolicies,
  updateProjectionPolicy,
} from '../tdp/policyService.js'
import {
  getPolicyCenterOverview,
  getSelectorGroupStats,
  listSelectorGroupPolicies,
  previewSelectorGroup,
  validateProjectionPolicyDraft,
} from '../tdp/policyCenterService.js'
import {
  getTerminalDecisionTrace,
  getTerminalResolvedTopics,
  getTerminalTopicDecision,
  previewPolicyImpact,
} from '../tdp/decisionService.js'
import {
  normalizeSubscription,
  readTerminalTopicPolicy,
  TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1,
} from '../tdp/subscriptionPolicy.js'
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
import {
  activateHotUpdateRelease,
  cancelHotUpdateRelease,
  createHotUpdateRelease,
  getHotUpdatePackage,
  getHotUpdateRelease,
  listHotUpdatePackages,
  listHotUpdateReleases,
  pauseHotUpdateRelease,
  previewHotUpdateReleaseImpact,
  resolveHotUpdateDownload,
  updateHotUpdatePackageStatus,
  uploadHotUpdatePackage,
} from './hotUpdateService.js'
import {
  listHotUpdateVersionDrift,
  listTerminalVersionHistory,
  reportTerminalVersion,
} from './hotUpdateVersionReportService.js'
import {
  listTerminalLogFiles,
  receiveTerminalLogUpload,
  requestTerminalLogUpload,
} from '../terminal-log/service.js'
import { TDP_ADMIN_TOKEN } from '../../shared/constants.js'

const resolveHttpTdpSubscription = (
  sandboxId: string,
  terminalId: string,
  query: Record<string, unknown>,
) => {
  if (typeof query.subscribedTopics !== 'string') {
    return undefined
  }
  const topicPolicy = readTerminalTopicPolicy(sandboxId, terminalId)
  const subscription = normalizeSubscription({
    capabilities: [TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1],
    subscribedTopics: query.subscribedTopics.split(',').map(topic => topic.trim()).filter(Boolean),
    allowedTopics: topicPolicy.allowedTopics,
  })
  const subscriptionHash = typeof query.subscriptionHash === 'string'
    ? query.subscriptionHash.trim()
    : ''
  if (!subscriptionHash) {
    throw new Error('HTTP TDP fallback with subscribedTopics requires subscriptionHash')
  }
  if (subscription.hash !== subscriptionHash) {
    throw new Error('HTTP TDP fallback subscriptionHash does not match server accepted subscription')
  }
  return {
    mode: subscription.mode,
    acceptedTopics: subscription.acceptedTopics,
  } as const
}

export const createRouter = () => {
  const router = Router()
  const withBadRequest = (handler: RequestHandler): RequestHandler => (req, res, next) => {
    try {
      return handler(req, res, next)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '请求失败', 400)
    }
  }

  const requireBodySandboxId = (body: Record<string, unknown> | undefined) => {
    const sandboxId = typeof body?.sandboxId === 'string' ? body.sandboxId.trim() : ''
    if (!sandboxId) {
      throw new Error('SANDBOX_ID_REQUIRED')
    }
    return sandboxId
  }

  const requireQuerySandboxId = (query: Record<string, unknown>) => {
    const raw = query.sandboxId
    const sandboxId = typeof raw === 'string' ? raw.trim() : ''
    if (!sandboxId) {
      throw new Error('SANDBOX_ID_REQUIRED')
    }
    return sandboxId
  }

  const requireTdpAdminToken = (req: Parameters<RequestHandler>[0]) => {
    const authorization = typeof req.headers.authorization === 'string'
      ? req.headers.authorization.trim()
      : ''
    if (!authorization.startsWith('Bearer ')) {
      throw new Error('TDP_ADMIN_TOKEN_REQUIRED')
    }
    const token = authorization.slice('Bearer '.length).trim()
    if (!token || token !== TDP_ADMIN_TOKEN) {
      throw new Error('TDP_ADMIN_TOKEN_INVALID')
    }
  }

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
  router.post('/mock-debug/kernel-base-test/prepare', (_req, res) => {
    try {
      const result = prepareKernelBaseTestSandbox()
      appendAuditLog({
        domain: 'SANDBOX',
        action: 'PREPARE_KERNEL_BASE_TEST_SANDBOX',
        operator: 'kernel-base-test',
        targetId: result.sandboxId,
        detail: result,
      })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '准备 kernel-base-test 沙箱失败', 400)
    }
  })
  router.get('/api/v1/admin/audit-logs', (req, res) => ok(res, listAuditLogs(parsePagination(req.query))))
  router.get('/api/v1/admin/export', withBadRequest((req, res) => ok(res, exportMockData(requireQuerySandboxId(req.query as Record<string, unknown>)))))
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
      requireBodySandboxId(req.body)
      const result = importMockTemplates(req.body)
      appendAuditLog({ domain: 'IMPORT', action: 'IMPORT_TEMPLATES', targetId: 'templates', detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '导入模板失败', 400)
    }
  })
  router.get('/api/v1/admin/export/download', (req, res) => {
    const content = exportMockDataText(requireQuerySandboxId(req.query as Record<string, unknown>))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="mock-terminal-platform-export.json"')
    res.status(200).send(content)
  })

  router.post('/api/v1/admin/hot-updates/packages/upload', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = uploadHotUpdatePackage(req.body)
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'UPLOAD_PACKAGE', targetId: result.packageId, detail: { sandboxId: req.body.sandboxId, fileName: req.body.fileName } })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '上传热更新包失败', 400)
    }
  })
  router.get('/api/v1/admin/hot-updates/packages', (req, res) => {
    try {
      return ok(res, listHotUpdatePackages(requireQuerySandboxId(req.query as Record<string, unknown>)))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询热更新包失败', 400)
    }
  })
  router.get('/api/v1/admin/hot-updates/packages/:packageId', (req, res) => {
    try {
      return ok(res, getHotUpdatePackage({ sandboxId: requireQuerySandboxId(req.query as Record<string, unknown>), packageId: req.params.packageId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询热更新包详情失败', 400)
    }
  })
  router.put('/api/v1/admin/hot-updates/packages/:packageId/status', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateHotUpdatePackageStatus({ sandboxId, packageId: req.params.packageId, status: req.body.status })
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'UPDATE_PACKAGE_STATUS', targetId: req.params.packageId, detail: { sandboxId, status: req.body.status } })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新热更新包状态失败', 400)
    }
  })
  router.get('/api/v1/hot-updates/packages/:packageId/download', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
      if (!token) {
        throw new Error('TOKEN_REQUIRED')
      }
      const result = resolveHotUpdateDownload({ sandboxId, packageId: req.params.packageId, token })
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Length', String(result.fileSize))
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
      return fs.createReadStream(result.filePath).pipe(res)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '下载热更新包失败', 400)
    }
  })
  router.post('/api/v1/admin/hot-updates/releases', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createHotUpdateRelease(req.body)
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'CREATE_RELEASE', targetId: result.releaseId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建热更新发布失败', 400)
    }
  })
  router.get('/api/v1/admin/hot-updates/releases', (req, res) => {
    try {
      return ok(res, listHotUpdateReleases(requireQuerySandboxId(req.query as Record<string, unknown>)))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询热更新发布失败', 400)
    }
  })
  router.get('/api/v1/admin/hot-updates/releases/:releaseId', (req, res) => {
    try {
      return ok(res, getHotUpdateRelease({ sandboxId: requireQuerySandboxId(req.query as Record<string, unknown>), releaseId: req.params.releaseId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询热更新发布详情失败', 400)
    }
  })
  router.post('/api/v1/admin/hot-updates/releases/:releaseId/activate', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = activateHotUpdateRelease({ sandboxId, releaseId: req.params.releaseId })
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'ACTIVATE_RELEASE', targetId: req.params.releaseId, detail: { sandboxId } })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '激活热更新发布失败', 400)
    }
  })
  router.post('/api/v1/admin/hot-updates/releases/:releaseId/pause', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = pauseHotUpdateRelease({ sandboxId, releaseId: req.params.releaseId })
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'PAUSE_RELEASE', targetId: req.params.releaseId, detail: { sandboxId } })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '暂停热更新发布失败', 400)
    }
  })
  router.post('/api/v1/admin/hot-updates/releases/:releaseId/cancel', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = cancelHotUpdateRelease({ sandboxId, releaseId: req.params.releaseId })
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'CANCEL_RELEASE', targetId: req.params.releaseId, detail: { sandboxId } })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '取消热更新发布失败', 400)
    }
  })
  router.post('/api/v1/admin/hot-updates/releases/:releaseId/preview-impact', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const release = getHotUpdateRelease({ sandboxId, releaseId: req.params.releaseId })
      return ok(res, previewHotUpdateReleaseImpact({
        sandboxId,
        scopeType: release.scopeType as 'GROUP' | 'TERMINAL',
        scopeKey: release.scopeKey,
      }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '预览热更新发布影响失败', 400)
    }
  })
  router.post('/api/v1/terminals/:terminalId/version-reports', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = reportTerminalVersion({ ...req.body, terminalId: req.params.terminalId })
      appendAuditLog({ domain: 'HOT_UPDATE', action: 'REPORT_TERMINAL_VERSION', targetId: req.params.terminalId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '上报终端版本失败', 400)
    }
  })
  router.get('/api/v1/admin/terminals/:terminalId/version-history', (req, res) => {
    try {
      return ok(res, listTerminalVersionHistory({
        sandboxId: requireQuerySandboxId(req.query as Record<string, unknown>),
        terminalId: req.params.terminalId,
      }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询终端版本历史失败', 400)
    }
  })
  router.get('/api/v1/admin/hot-updates/version-drift', (req, res) => {
    try {
      return ok(res, listHotUpdateVersionDrift(requireQuerySandboxId(req.query as Record<string, unknown>)))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询版本漂移失败', 400)
    }
  })

  router.get('/api/v1/admin/terminals', (req, res) => ok(res, listTerminals(requireQuerySandboxId(req.query as Record<string, unknown>))))
  router.get('/api/v1/admin/profiles', (req, res) => ok(res, listProfiles(requireQuerySandboxId(req.query as Record<string, unknown>))))
  router.get('/api/v1/admin/templates', (req, res) => ok(res, listTemplates(requireQuerySandboxId(req.query as Record<string, unknown>))))
  router.get('/api/v1/admin/activation-codes', (req, res) => ok(res, listActivationCodes(requireQuerySandboxId(req.query as Record<string, unknown>))))
  router.get('/api/v1/admin/master-data/platforms', withBadRequest((req, res) => ok(res, listPlatforms(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/platforms', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createPlatform(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PLATFORM', targetId: result.platformId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建平台失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/platforms/:platformId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updatePlatform(sandboxId, req.params.platformId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PLATFORM', targetId: req.params.platformId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新平台失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/platforms/:platformId', (req, res) => {
    try {
      const result = deletePlatform(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.platformId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PLATFORM', targetId: req.params.platformId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除平台失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/tenants', withBadRequest((req, res) => ok(res, listTenants(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/tenants', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createTenant(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_TENANT', targetId: result.tenantId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建租户失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/tenants/:tenantId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateTenant(sandboxId, req.params.tenantId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_TENANT', targetId: req.params.tenantId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新租户失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/tenants/:tenantId', (req, res) => {
    try {
      const result = deleteTenant(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.tenantId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_TENANT', targetId: req.params.tenantId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除租户失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/brands', withBadRequest((req, res) => ok(res, listBrands(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/brands', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createBrand(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_BRAND', targetId: result.brandId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建品牌失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/brands/:brandId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateBrand(sandboxId, req.params.brandId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_BRAND', targetId: req.params.brandId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新品牌失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/brands/:brandId', (req, res) => {
    try {
      const result = deleteBrand(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.brandId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_BRAND', targetId: req.params.brandId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除品牌失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/projects', withBadRequest((req, res) => ok(res, listProjects(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/projects', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createProject(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PROJECT', targetId: result.projectId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建项目失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/projects/:projectId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateProject(sandboxId, req.params.projectId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PROJECT', targetId: req.params.projectId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新项目失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/projects/:projectId', (req, res) => {
    try {
      const result = deleteProject(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.projectId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PROJECT', targetId: req.params.projectId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除项目失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/stores', withBadRequest((req, res) => ok(res, listStores(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/stores', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createStore(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_STORE', targetId: result.storeId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建门店失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/stores/:storeId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateStore(sandboxId, req.params.storeId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_STORE', targetId: req.params.storeId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新门店失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/stores/:storeId', (req, res) => {
    try {
      const result = deleteStore(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.storeId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_STORE', targetId: req.params.storeId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除门店失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/contracts', withBadRequest((req, res) => ok(res, listContracts(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/contracts', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createContract(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_CONTRACT', targetId: result.contractId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建合同失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/contracts/:contractId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateContract(sandboxId, req.params.contractId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_CONTRACT', targetId: req.params.contractId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新合同失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/contracts/:contractId', (req, res) => {
    try {
      const result = deleteContract(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.contractId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_CONTRACT', targetId: req.params.contractId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除合同失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/profiles', withBadRequest((req, res) => ok(res, listMasterProfiles(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/profiles', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createProfile(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_PROFILE', targetId: result.profileId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建终端 Profile 失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/profiles/:profileId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateProfile(sandboxId, req.params.profileId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_PROFILE', targetId: req.params.profileId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新终端 Profile 失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/profiles/:profileId', (req, res) => {
    try {
      const result = deleteProfile(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.profileId)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'DELETE_PROFILE', targetId: req.params.profileId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除终端 Profile 失败', 400)
    }
  })
  router.get('/api/v1/admin/master-data/templates', withBadRequest((req, res) => ok(res, listMasterTemplates(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/master-data/templates', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createTemplate(req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'CREATE_TEMPLATE', targetId: result.templateId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建终端 Template 失败', 400)
    }
  })
  router.put('/api/v1/admin/master-data/templates/:templateId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateTemplate(sandboxId, req.params.templateId, req.body)
      appendAuditLog({ domain: 'MASTER_DATA', action: 'UPDATE_TEMPLATE', targetId: req.params.templateId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新终端 Template 失败', 400)
    }
  })
  router.delete('/api/v1/admin/master-data/templates/:templateId', (req, res) => {
    try {
      const result = deleteTemplate(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.templateId)
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
      requireBodySandboxId(req.body)
      const result = activateTerminal(req.body)
      appendAuditLog({
        domain: 'TCP',
        action: 'ACTIVATE_TERMINAL',
        targetId: result.terminalId,
        detail: {
          request: req.body,
          activationCompatibility: result.activationCompatibility,
        },
        operator: 'terminal-client',
      })
      return created(res, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '激活失败'
      const details = typeof error === 'object' && error !== null && 'details' in error
        ? (error as { details?: unknown }).details
        : undefined
      return fail(res, message, 400, details)
    }
  })

  router.post('/api/v1/terminals/token/refresh', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      return ok(res, refreshTerminalToken({
        sandboxId: req.body.sandboxId,
        refreshToken: req.body.refreshToken,
      }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '刷新失败')
    }
  })

  router.post('/api/v1/terminals/:terminalId/deactivate', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = deactivateTerminal({
        sandboxId: req.body.sandboxId,
        terminalId: req.params.terminalId,
        reason: req.body?.reason,
      })
      appendAuditLog({ domain: 'TCP', action: 'DEACTIVATE_TERMINAL', targetId: result.terminalId, detail: req.body, operator: 'terminal-client' })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '注销激活失败')
    }
  })

  router.get('/api/v1/admin/tasks/releases', withBadRequest((req, res) => ok(res, listTaskReleases(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tasks/instances', withBadRequest((req, res) => ok(res, listTaskInstances(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tasks/instances/:instanceId/trace', (req, res) => {
    try {
      return ok(res, getTaskTrace(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.instanceId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '任务链路查询失败', 404)
    }
  })

  router.post('/api/v1/admin/tasks/releases', (req, res) => {
    try {
      const release = createTaskRelease(req.body)
      const dispatch = createTaskInstancesForRelease({ sandboxId: req.body.sandboxId, releaseId: release.releaseId })
      const tdp = dispatchTaskReleaseToDataPlane({ sandboxId: req.body.sandboxId, releaseId: release.releaseId })
      appendAuditLog({ domain: 'TCP', action: 'CREATE_TASK_RELEASE', targetId: release.releaseId, detail: { request: req.body, dispatch, tdp } })
      return created(res, { release, dispatch, tdp })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建任务失败')
    }
  })

  router.post('/api/v1/terminals/:terminalId/tasks/:instanceId/result', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      return ok(res, reportTaskResult(req.body.sandboxId, req.params.instanceId, req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '任务结果上报失败')
    }
  })
  router.get('/api/v1/admin/terminals/:terminalId/log-files', (req, res) => {
    try {
      return ok(res, listTerminalLogFiles(requireQuerySandboxId(req.query as Record<string, unknown>), req.params.terminalId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '终端日志列表查询失败', 400)
    }
  })
  router.post('/api/v1/admin/terminals/:terminalId/log-fetches', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const origin = `${req.protocol}://${req.get('host')}`
      const uploadUrl = typeof req.body?.uploadUrl === 'string' && req.body.uploadUrl.trim()
        ? req.body.uploadUrl.trim()
        : `${origin}/api/v1/terminals/${req.params.terminalId}/log-files/upload`
      const result = requestTerminalLogUpload({
        sandboxId,
        terminalId: req.params.terminalId,
        logDate: req.body.logDate,
        overwrite: req.body.overwrite !== false,
        operator: 'admin-console',
        uploadUrl,
      })
      appendAuditLog({ domain: 'TERMINAL_LOG', action: 'REQUEST_TERMINAL_LOG_UPLOAD', targetId: req.params.terminalId, detail: { ...req.body, uploadUrl } })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建终端日志获取任务失败', 400)
    }
  })
  router.post('/api/v1/terminals/:terminalId/log-files/upload', (req, res) => {
    try {
      const result = receiveTerminalLogUpload({
        sandboxId: req.body.sandboxId,
        terminalId: req.params.terminalId,
        logDate: req.body.logDate,
        displayIndex: req.body.displayIndex,
        displayRole: req.body.displayRole,
        commandId: req.body.commandId,
        instanceId: req.body.instanceId,
        releaseId: req.body.releaseId,
        fileName: req.body.fileName,
        contentType: req.body.contentType,
        contentBase64: req.body.contentBase64,
        metadata: req.body.metadata,
      })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '终端日志上传失败', 400)
    }
  })
  router.post('/internal/data-plane/tasks/delivery-status', (req, res) => ok(res, updateDeliveryStatus(req.body.instanceId, req.body.deliveryStatus, req.body.error)))
  router.post('/internal/control-plane/tasks/dispatch', (req, res) => {
    try {
      const dispatch = createTaskInstancesForRelease({ sandboxId: req.body.sandboxId, releaseId: req.body.releaseId })
      const tdp = dispatchTaskReleaseToDataPlane({ sandboxId: req.body.sandboxId, releaseId: req.body.releaseId })
      appendAuditLog({ domain: 'TCP', action: 'DISPATCH_TASK_RELEASE', targetId: req.body.releaseId, detail: { dispatch, tdp } })
      return ok(res, { ...dispatch, ...tdp })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '投递失败')
    }
  })

  router.get('/api/v1/admin/tdp/sessions', withBadRequest((req, res) => ok(res, listSessions(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/tdp/sessions/connect', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = connectSession(req.body)
      appendAuditLog({ domain: 'TDP', action: 'CONNECT_SESSION', targetId: result.sessionId, detail: req.body, operator: 'terminal-client' })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '连接 TDP session 失败')
    }
  })
  router.post('/api/v1/tdp/sessions/:sessionId/heartbeat', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      return ok(res, heartbeatSession({ sandboxId: req.body.sandboxId, sessionId: req.params.sessionId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : 'TDP heartbeat 失败')
    }
  })
  router.post('/api/v1/tdp/sessions/:sessionId/disconnect', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = disconnectSession({ sandboxId: req.body.sandboxId, sessionId: req.params.sessionId })
      appendAuditLog({ domain: 'TDP', action: 'DISCONNECT_SESSION', targetId: req.params.sessionId, detail: result, operator: 'terminal-client' })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '断开 TDP session 失败')
    }
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

  router.get('/api/v1/admin/tdp/topics', withBadRequest((req, res) => ok(res, listTopics(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/tdp/topics', (req, res) => {
    requireBodySandboxId(req.body)
    const result = createTopic(req.body)
    appendAuditLog({ domain: 'TDP', action: 'CREATE_TOPIC', targetId: result.topicId, detail: req.body })
    return created(res, result)
  })
  router.get('/api/v1/admin/tdp/scopes', withBadRequest((req, res) => ok(res, listScopes(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tdp/policy-center/overview', withBadRequest((req, res) => ok(res, getPolicyCenterOverview(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tdp/groups', withBadRequest((req, res) => ok(res, listSelectorGroups(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/tdp/groups/preview', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      return ok(res, previewSelectorGroup({ sandboxId, selectorDslJson: req.body?.selectorDslJson, limit: req.body?.limit }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '预览 selector group 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/groups', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createSelectorGroup(req.body)
      appendAuditLog({ domain: 'TDP_GROUP', action: 'CREATE_SELECTOR_GROUP', targetId: result.groupId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建 selector group 失败', 400)
    }
  })
  router.put('/api/v1/admin/tdp/groups/:groupId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateSelectorGroup({ sandboxId, groupId: req.params.groupId, ...req.body })
      appendAuditLog({ domain: 'TDP_GROUP', action: 'UPDATE_SELECTOR_GROUP', targetId: req.params.groupId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新 selector group 失败', 400)
    }
  })
  router.delete('/api/v1/admin/tdp/groups/:groupId', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      const result = deleteSelectorGroup({ sandboxId, groupId: req.params.groupId })
      appendAuditLog({ domain: 'TDP_GROUP', action: 'DELETE_SELECTOR_GROUP', targetId: req.params.groupId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除 selector group 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/groups/recompute-all', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const terminalIds = listTerminals(sandboxId).map(item => item.terminalId)
      const items = terminalIds.map(terminalId => recomputeTerminalMemberships({ sandboxId, terminalId }))
      appendAuditLog({ domain: 'TDP_GROUP', action: 'RECOMPUTE_ALL_TERMINAL_MEMBERSHIPS', targetId: `count:${items.length}`, detail: { sandboxId, terminalIds } })
      return ok(res, { total: items.length, items })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '全量重算 memberships 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/groups/recompute-by-scope', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const scopeType = typeof req.body?.scopeType === 'string' ? req.body.scopeType.trim().toUpperCase() : ''
      const scopeKeys = Array.isArray(req.body?.scopeKeys) ? req.body.scopeKeys.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : []
      if (scopeKeys.length === 0) {
        throw new Error('scopeKeys 不能为空')
      }
      const terminalIds = resolveTerminalIdsByScope({ sandboxId, scopeType, scopeKeys })
      if (terminalIds.length === 0) {
        return ok(res, { total: 0, items: [] })
      }
      const items = terminalIds.map((terminalId: string) => recomputeTerminalMemberships({ sandboxId, terminalId }))
      appendAuditLog({ domain: 'TDP_GROUP', action: 'RECOMPUTE_TERMINAL_MEMBERSHIP', targetId: `count:${items.length}`, detail: req.body })
      return ok(res, { total: items.length, items })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '重算 memberships 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/groups/:groupId/recompute', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const terminalIds = resolveTerminalIdsByScope({ sandboxId, scopeType: 'GROUP', scopeKeys: [req.params.groupId] })
      const items = terminalIds.map(terminalId => recomputeTerminalMemberships({ sandboxId, terminalId }))
      appendAuditLog({ domain: 'TDP_GROUP', action: 'RECOMPUTE_GROUP_MEMBERSHIP', targetId: req.params.groupId, detail: { sandboxId, terminalIds } })
      return ok(res, { total: items.length, items })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '重算 group memberships 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/groups/:groupId/memberships', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getSelectorGroupMemberships({ sandboxId, groupId: req.params.groupId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 group memberships 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/groups/:groupId/stats', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getSelectorGroupStats({ sandboxId, groupId: req.params.groupId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 selector group stats 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/groups/:groupId/policies', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, listSelectorGroupPolicies({ sandboxId, groupId: req.params.groupId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 selector group policies 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/terminals/:terminalId/memberships', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getTerminalGroupMemberships(sandboxId, req.params.terminalId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 terminal memberships 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/terminals/:terminalId/resolved-topics', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getTerminalResolvedTopics({ sandboxId, terminalId: req.params.terminalId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 terminal resolved topics 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/terminals/:terminalId/decision-trace', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getTerminalDecisionTrace({ sandboxId, terminalId: req.params.terminalId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 terminal decision trace 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/terminals/:terminalId/topics/:topicKey/decision', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getTerminalTopicDecision({ sandboxId, terminalId: req.params.terminalId, topicKey: req.params.topicKey }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 terminal topic decision 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/runtime-facts/upsert', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = upsertTerminalRuntimeFacts(req.body)
      appendAuditLog({ domain: 'TDP_GROUP', action: 'UPSERT_TERMINAL_RUNTIME_FACTS', targetId: result.terminalId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新 terminal runtime facts 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/policies', withBadRequest((req, res) => ok(res, listProjectionPolicies(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tdp/policies/:policyId', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      return ok(res, getProjectionPolicy({ sandboxId, policyId: req.params.policyId }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 projection policy 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/policies/validate', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      return ok(res, validateProjectionPolicyDraft({ sandboxId, ...req.body }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '校验 projection policy 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/policies', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = createProjectionPolicy(req.body)
      appendAuditLog({ domain: 'TDP_POLICY', action: 'CREATE_PROJECTION_POLICY', targetId: result.policyId, detail: req.body })
      return created(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建 projection policy 失败', 400)
    }
  })
  router.put('/api/v1/admin/tdp/policies/:policyId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateProjectionPolicy({ sandboxId, policyId: req.params.policyId, ...req.body })
      appendAuditLog({ domain: 'TDP_POLICY', action: 'UPDATE_PROJECTION_POLICY', targetId: req.params.policyId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新 projection policy 失败', 400)
    }
  })
  router.delete('/api/v1/admin/tdp/policies/:policyId', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      const result = deleteProjectionPolicy({ sandboxId, policyId: req.params.policyId })
      appendAuditLog({ domain: 'TDP_POLICY', action: 'DELETE_PROJECTION_POLICY', targetId: req.params.policyId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '删除 projection policy 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/policies/preview-impact', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      return ok(res, previewPolicyImpact({ sandboxId, ...req.body }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '预览 projection policy impact 失败', 400)
    }
  })
  router.post('/api/v1/admin/tdp/projections/upsert', (req, res) => {
    try {
      requireTdpAdminToken(req)
      requireBodySandboxId(req.body)
      const result = upsertProjection(req.body)
      appendAuditLog({ domain: 'TDP', action: 'UPSERT_PROJECTION', targetId: `${result.topicKey}:${result.scopeType}:${result.scopeKey}:${result.itemKey}`, detail: req.body })
      return ok(res, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TDP upsert failed'
      const status = message === 'TDP_ADMIN_TOKEN_REQUIRED' || message === 'TDP_ADMIN_TOKEN_INVALID' ? 401 : 400
      return fail(res, message, status)
    }
  })
  router.post('/api/v1/admin/tdp/projections/batch-upsert', (req, res) => {
    try {
      requireTdpAdminToken(req)
      requireBodySandboxId(req.body)
      const result = upsertProjectionBatch(req.body)
      appendAuditLog({ domain: 'TDP', action: 'BATCH_UPSERT_PROJECTION', targetId: `count:${result.total}`, detail: req.body })
      return ok(res, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TDP batch upsert failed'
      const status = message === 'TDP_ADMIN_TOKEN_REQUIRED' || message === 'TDP_ADMIN_TOKEN_INVALID' ? 401 : 400
      return fail(res, message, status)
    }
  })
  router.get('/api/v1/admin/tdp/projections', withBadRequest((req, res) => ok(res, listProjections(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/admin/tdp/change-logs', withBadRequest((req, res) => ok(res, listChangeLogs(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/api/v1/admin/tdp/change-logs/prune', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const retainRecentCursors = typeof req.body.retainRecentCursors === 'number'
        ? req.body.retainRecentCursors
        : undefined
      const result = pruneTdpChangeLogs(sandboxId, retainRecentCursors)
      appendAuditLog({ domain: 'TDP', action: 'PRUNE_CHANGE_LOGS', targetId: sandboxId, detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '清理 TDP change logs 失败', 400)
    }
  })
  router.get('/api/v1/admin/tdp/commands', withBadRequest((req, res) => ok(res, listCommandOutbox(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.get('/api/v1/tdp/terminals/:terminalId/snapshot', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      const subscription = resolveHttpTdpSubscription(sandboxId, req.params.terminalId, req.query as Record<string, unknown>)
      return ok(res, subscription == null
        ? getTerminalSnapshot(sandboxId, req.params.terminalId)
        : getTerminalSnapshot(sandboxId, req.params.terminalId, subscription))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 TDP snapshot 失败')
    }
  })
  router.get('/api/v1/tdp/terminals/:terminalId/changes', (req, res) => {
    try {
      const sandboxId = requireQuerySandboxId(req.query as Record<string, unknown>)
      const cursor = Math.max(0, Number(req.query.cursor ?? 0))
      const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 100)))
      const subscription = resolveHttpTdpSubscription(sandboxId, req.params.terminalId, req.query as Record<string, unknown>)
      const changesPage = getTerminalChangesSince(sandboxId, req.params.terminalId, cursor, limit, subscription)
      const changes = changesPage.changes
      const nextCursor = changes.length ? changes[changes.length - 1].cursor : cursor
      const highWatermark = getHighWatermarkForTerminal(sandboxId, req.params.terminalId, subscription)
      return ok(res, {
        terminalId: req.params.terminalId,
        changes: changes.map(item => item.change),
        nextCursor,
        hasMore: changesPage.hasMore,
        highWatermark,
      })
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询 TDP changes 失败')
    }
  })

  router.get('/mock-admin/scenes/templates', (_req, res) => ok(res, listSceneTemplates()))
  router.post('/mock-admin/scenes/:sceneTemplateId/run', (req, res) => {
    requireBodySandboxId(req.body ?? {})
    const result = runSceneTemplate(req.params.sceneTemplateId, req.body ?? {})
    appendAuditLog({ domain: 'SCENE', action: 'RUN_SCENE_TEMPLATE', targetId: req.params.sceneTemplateId, detail: result })
    return ok(res, result)
  })
  router.post('/mock-admin/terminals/batch-create', (req, res) => {
    try {
      requireBodySandboxId(req.body)
      const result = batchCreateTerminals(req.body.sandboxId, Number(req.body.count ?? 10))
      appendAuditLog({ domain: 'TCP', action: 'BATCH_CREATE_TERMINALS', targetId: 'terminals', detail: result })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '批量创建终端失败', 400)
    }
  })
  router.post('/mock-admin/terminals/:terminalId/force-status', (req, res) => {
    requireBodySandboxId(req.body)
    const result = forceTerminalStatus(req.body.sandboxId, req.params.terminalId, req.body)
    appendAuditLog({ domain: 'TCP', action: 'FORCE_TERMINAL_STATUS', targetId: req.params.terminalId, detail: req.body })
    return ok(res, result)
  })

  router.get('/mock-admin/fault-rules', withBadRequest((req, res) => ok(res, listFaultRules(requireQuerySandboxId(req.query as Record<string, unknown>)))))
  router.post('/mock-admin/fault-rules', (req, res) => {
    requireBodySandboxId(req.body)
    const result = createFaultRule(req.body)
    appendAuditLog({ domain: 'FAULT', action: 'CREATE_FAULT_RULE', targetId: result.faultRuleId, detail: req.body })
    return created(res, result)
  })
  router.put('/mock-admin/fault-rules/:faultRuleId', (req, res) => {
    try {
      const sandboxId = requireBodySandboxId(req.body)
      const result = updateFaultRule(sandboxId, req.params.faultRuleId, req.body)
      appendAuditLog({ domain: 'FAULT', action: 'UPDATE_FAULT_RULE', targetId: req.params.faultRuleId, detail: req.body })
      return ok(res, result)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '更新故障规则失败', 404)
    }
  })
  router.post('/mock-admin/fault-rules/:faultRuleId/hit', (req, res) => {
    const sandboxId = requireBodySandboxId(req.body)
    const result = simulateFaultHit(sandboxId, req.params.faultRuleId)
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
