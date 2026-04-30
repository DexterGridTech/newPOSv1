import type {
  ActivatedBenefitCodeRecord,
  BenefitQuotaFactRecord,
  BenefitReservationRecord,
  CompletedSettlementRecord,
} from './types.js'

export const benefitCenterStore = {
  reservationsById: new Map<string, BenefitReservationRecord>(),
  reservationIdByIdempotencyKey: new Map<string, string>(),
  completedSettlementsById: new Map<string, CompletedSettlementRecord>(),
  codeActivationByIdempotencyKey: new Map<string, ActivatedBenefitCodeRecord>(),
  orderQuotaFacts: [
    {
      bucketKey: 'black-card-daily-8-off',
      subjectRef: {
        subjectType: 'membership',
        subjectKey: 'membership-black-001',
        displayKey: 'BLACK',
      },
      usedQuantity: 1,
      source: 'orderFact',
      factRef: 'mock-order-fact-black-card-001',
      occurredAt: '2026-04-30T01:00:00.000Z',
    },
  ] satisfies BenefitQuotaFactRecord[],
}

export const resetBenefitCenterStore = () => {
  benefitCenterStore.reservationsById.clear()
  benefitCenterStore.reservationIdByIdempotencyKey.clear()
  benefitCenterStore.completedSettlementsById.clear()
  benefitCenterStore.codeActivationByIdempotencyKey.clear()
}

