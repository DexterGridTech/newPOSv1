import {Router} from 'express'
import {created, fail, ok} from '../../shared/http.js'
import {
  activateBenefitCode,
  completeSettlement,
  createReservation,
  markSettlement,
  promoteReservation,
  queryOrderFacts,
  queryPersonalBenefits,
  releaseReservation,
} from './service.js'

export const createBenefitCenterRouter = () => {
  const router = Router()

  router.post('/api/commercial-benefit/personal-query', (req, res) => {
    try {
      return ok(res, queryPersonalBenefits(req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询个人权益失败', 400)
    }
  })

  router.post('/api/commercial-benefit/reservations', (req, res) => {
    try {
      return created(res, createReservation(req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建权益占用失败', 400)
    }
  })

  router.post('/api/commercial-benefit/codes/activate', (req, res) => {
    try {
      return created(res, activateBenefitCode(req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '激活权益码失败', 400)
    }
  })

  router.get('/api/commercial-benefit/order-facts', (req, res) => {
    try {
      return ok(res, queryOrderFacts({
        bucketKey: typeof req.query.bucketKey === 'string' ? req.query.bucketKey : undefined,
        subjectType: typeof req.query.subjectType === 'string' ? req.query.subjectType : undefined,
        subjectKey: typeof req.query.subjectKey === 'string' ? req.query.subjectKey : undefined,
      }))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '查询订单事实失败', 400)
    }
  })

  router.post('/api/commercial-benefit/reservations/:reservationId/promote', (req, res) => {
    try {
      return ok(res, promoteReservation(req.params.reservationId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '提升权益占用失败', 400)
    }
  })

  router.post('/api/commercial-benefit/reservations/:reservationId/release', (req, res) => {
    try {
      return ok(res, releaseReservation(req.params.reservationId))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '释放权益占用失败', 400)
    }
  })

  router.post('/api/commercial-benefit/payment-facts/settlements/complete', (req, res) => {
    try {
      return created(res, completeSettlement(req.body))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '记录支付事实失败', 400)
    }
  })

  router.post('/api/commercial-benefit/payment-facts/settlements/:settlementLineId/refund', (req, res) => {
    try {
      return ok(res, markSettlement(req.params.settlementLineId, 'refunded'))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '记录退款事实失败', 400)
    }
  })

  router.post('/api/commercial-benefit/payment-facts/settlements/:settlementLineId/void', (req, res) => {
    try {
      return ok(res, markSettlement(req.params.settlementLineId, 'voided'))
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '记录撤销事实失败', 400)
    }
  })

  return router
}
