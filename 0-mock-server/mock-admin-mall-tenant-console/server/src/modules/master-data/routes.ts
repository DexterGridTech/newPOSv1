import {Router} from 'express'
import {getMasterDataOverview, listMasterDataDocuments} from './service.js'
import {created, fail, ok} from '../../shared/http.js'
import {getTerminalAuthCapabilities} from '../terminal-auth/service.js'
import {listProjectionOutbox, previewProjectionBatch, publishProjectionBatch, retryProjectionOutbox} from '../projection/service.js'

export const createRouter = () => {
  const router = Router()

  router.get('/health', (_req, res) => {
    ok(res, {status: 'ok'})
  })

  router.get('/api/v1/overview', (_req, res) => {
    ok(res, getMasterDataOverview())
  })

  router.get('/api/v1/master-data/documents', (req, res) => {
    ok(res, listMasterDataDocuments({
      domain: typeof req.query.domain === 'string' ? req.query.domain : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
    }))
  })

  router.get('/api/v1/projection-outbox', (req, res) => {
    ok(res, listProjectionOutbox({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    }))
  })

  router.post('/api/v1/projection-outbox/preview', (_req, res) => {
    ok(res, previewProjectionBatch())
  })

  router.post('/api/v1/projection-outbox/retry', (_req, res) => {
    ok(res, retryProjectionOutbox())
  })

  router.post('/api/v1/projection-outbox/publish', async (_req, res) => {
    const result = await publishProjectionBatch()
    if (result.error) {
      return fail(res, result.error, 502, result.response)
    }
    return created(res, result)
  })

  router.get('/api/v1/terminal-auth/capabilities', (_req, res) => {
    ok(res, getTerminalAuthCapabilities())
  })

  router.post('/api/v1/terminal-auth/login', (_req, res) => {
    fail(res, 'terminal-auth login is reserved for future implementation', 501, getTerminalAuthCapabilities())
  })

  router.post('/api/v1/terminal-auth/logout', (_req, res) => {
    fail(res, 'terminal-auth logout is reserved for future implementation', 501, getTerminalAuthCapabilities())
  })

  router.post('/api/v1/terminal-auth/user-info-changed', (_req, res) => {
    fail(res, 'terminal-auth user-info-changed is reserved for future implementation', 501, getTerminalAuthCapabilities())
  })

  return router
}
