import {Router} from 'express'
import {created, ok, wrapRoute} from '../../shared/http.js'
import {
  applyDemoMasterDataChange,
  getLegacyDocumentsView,
  rebuildProjectionOutboxFromAlignedState,
  getAlignedOverview,
  getTerminalAuthCapabilities,
} from '../aligned-master-data/service.js'
import {
  previewProjectionBatch,
  listProjectionOutbox,
  publishProjectionBatch,
  retryProjectionOutbox,
} from '../projection/service.js'

export const createRouter = () => {
  const router = Router()

  // Legacy compatibility shim only: keep old smoke/demo entrypoints working
  // while phase-2/3 consumers move to aligned and diagnostics namespaces.
  router.get('/api/v1/master-data/documents', wrapRoute((_req, res) => {
    ok(res, getLegacyDocumentsView())
  }))

  router.post('/api/v1/master-data/demo-change', wrapRoute((_req, res) => {
    const document = applyDemoMasterDataChange()
    const preview = previewProjectionBatch()
    const matchedProjection = preview.projections.find(item =>
      item.sourceEventId === document.payload.source_event_id,
    ) as Record<string, unknown> | undefined
    created(res, {
      document: {
        docId: document.aggregateId,
        domain: document.domain,
        entityType: document.entityType,
        entityId: document.entityId,
        naturalScopeType: document.naturalScopeType,
        naturalScopeKey: document.naturalScopeKey,
        title: document.title,
        status: document.status,
        sourceRevision: document.sourceRevision,
        payload: document.payload,
        updatedAt: document.updatedAt,
      },
      projection: {
        topicKey: matchedProjection?.topicKey ?? 'catering.product.profile',
        scopeType: matchedProjection?.scopeType ?? document.naturalScopeType,
        scopeKey: matchedProjection?.scopeKey ?? document.naturalScopeKey,
        itemKey: matchedProjection?.itemKey ?? document.entityId,
        sourceRevision: document.sourceRevision,
        sourceEventId: document.payload.source_event_id ?? null,
        targetTerminalIds: [],
      },
    })
  }))

  router.post('/api/v1/master-data/rebuild-projection-outbox', wrapRoute((_req, res) => {
    created(res, rebuildProjectionOutboxFromAlignedState(res.locals.requestContext?.sandboxId))
  }))

  router.get('/api/v1/projection-outbox', wrapRoute((req, res) => {
    ok(res, listProjectionOutbox({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    }))
  }))

  router.post('/api/v1/projection-outbox/preview', wrapRoute((_req, res) => {
    ok(res, previewProjectionBatch())
  }))

  router.post('/api/v1/projection-outbox/retry', wrapRoute((_req, res) => {
    ok(res, retryProjectionOutbox())
  }))

  router.post('/api/v1/projection-outbox/publish', wrapRoute(async (_req, res) => {
    created(res, await publishProjectionBatch())
  }))

  router.get('/api/v1/terminal-auth/capabilities', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities())
  }))

  router.post('/api/v1/terminal-auth/login', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))

  router.post('/api/v1/terminal-auth/logout', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))

  router.post('/api/v1/terminal-auth/user-info-changed', wrapRoute((_req, res) => {
    ok(res, getTerminalAuthCapabilities(), 501)
  }))

  router.get('/api/v1/legacy-overview', wrapRoute((_req, res) => {
    ok(res, getAlignedOverview(res.locals.requestContext?.sandboxId))
  }))

  return router
}
