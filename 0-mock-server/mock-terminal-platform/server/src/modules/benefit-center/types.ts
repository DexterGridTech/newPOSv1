export type BenefitReservationState = 'held_by_cart' | 'promoted_to_order' | 'held_by_payment' | 'released' | 'expired'
export type CompletedSettlementStatus = 'completed' | 'refunded' | 'partiallyRefunded' | 'voided'

export interface BenefitReservationRecord {
  reservationId: string
  benefitRef: {
    templateKey: string
    lineKey?: string
  }
  subjectRef: {
    subjectType: string
    subjectKey: string
    displayKey?: string
  }
  contextRef: {
    contextType: 'cart' | 'order' | 'payment'
    contextId: string
    isCurrent?: boolean
  }
  quantity: number
  amount?: {
    amount: number
    currency: string
  }
  state: BenefitReservationState
  idempotencyKey: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface CompletedSettlementRecord {
  settlementGroupId?: string
  settlementLineId: string
  lineType: string
  benefitRef?: {
    templateKey: string
    lineKey?: string
  }
  coverageAmount: {
    amount: number
    currency: string
  }
  payableImpactAmount: {
    amount: number
    currency: string
  }
  quantity?: number
  quantityUnit?: string
  settlementPayloadSnapshot?: unknown
  completedAt: string
  status: CompletedSettlementStatus
}

export interface BenefitQuotaFactRecord {
  bucketKey: string
  subjectRef: {
    subjectType: string
    subjectKey: string
    displayKey?: string
  }
  usedQuantity: number
  source: 'reservationLedger' | 'orderFact' | 'externalQuery'
  factRef?: string
  occurredAt?: string
  amount?: {
    amount: number
    currency: string
  }
}

export interface ActivatedBenefitCodeRecord {
  activationId: string
  contextRef: {
    contextType: 'cart' | 'order' | 'payment'
    contextId: string
    isCurrent?: boolean
  }
  code: string
  activatedTemplates: unknown[]
  activatedLines: unknown[]
  expiresAt?: string
  diagnostics: unknown[]
}

export interface PersonalBenefitQueryInput {
  terminalNo: string
  entryIdentity: {
    identityType: string
    identityValue: string
  }
}

export interface OrderFactQueryInput {
  bucketKey?: string
  subjectType?: string
  subjectKey?: string
}

export interface ReservationCreateInput {
  contextRef: BenefitReservationRecord['contextRef']
  benefitRef: BenefitReservationRecord['benefitRef']
  subjectRef: BenefitReservationRecord['subjectRef']
  quantity: number
  amount?: BenefitReservationRecord['amount']
  idempotencyKey: string
  ttlSeconds?: number
}

export interface BenefitCodeActivationInput {
  contextRef: ActivatedBenefitCodeRecord['contextRef']
  code: string
  codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
  idempotencyKey: string
}

