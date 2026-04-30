import {benefitCenterFixtures} from './fixtures.js'
import {createDynamicBenefitCodeActivation} from './dynamicCodeFactory.js'
import {benefitCenterStore} from './store.js'
import type {
  ActivatedBenefitCodeRecord,
  BenefitReservationRecord,
  BenefitCodeActivationInput,
  CompletedSettlementRecord,
  CompletedSettlementStatus,
  OrderFactQueryInput,
  PersonalBenefitQueryInput,
  ReservationCreateInput,
} from './types.js'

const nowIso = () => new Date().toISOString()
const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`

export const queryPersonalBenefits = (input: PersonalBenefitQueryInput) => {
  if (!input.terminalNo?.trim()) {
    throw new Error('TERMINAL_NO_REQUIRED')
  }
  if (!input.entryIdentity?.identityType || !input.entryIdentity?.identityValue) {
    throw new Error('ENTRY_IDENTITY_REQUIRED')
  }

  return {
    identitySnapshot: {
      ...benefitCenterFixtures.identitySnapshot,
      entryIdentity: input.entryIdentity,
      fetchedAt: nowIso(),
    },
    benefitSnapshot: {
      ...benefitCenterFixtures.benefitSnapshot,
      reservations: Array.from(benefitCenterStore.reservationsById.values()),
      completedSettlements: Array.from(benefitCenterStore.completedSettlementsById.values()),
      quotaFacts: [
        ...(benefitCenterFixtures.benefitSnapshot.quotaFacts ?? []),
        ...benefitCenterStore.orderQuotaFacts,
      ],
    },
  }
}

export const queryOrderFacts = (input: OrderFactQueryInput) => {
  return benefitCenterStore.orderQuotaFacts.filter((fact) => {
    if (input.bucketKey && fact.bucketKey !== input.bucketKey) {
      return false
    }
    if (input.subjectType && fact.subjectRef.subjectType !== input.subjectType) {
      return false
    }
    if (input.subjectKey && fact.subjectRef.subjectKey !== input.subjectKey) {
      return false
    }
    return true
  })
}

export const createReservation = (input: ReservationCreateInput) => {
  if (!input.idempotencyKey?.trim()) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED')
  }
  const existingId = benefitCenterStore.reservationIdByIdempotencyKey.get(input.idempotencyKey)
  if (existingId) {
    return benefitCenterStore.reservationsById.get(existingId)
  }

  const timestamp = nowIso()
  const reservation: BenefitReservationRecord = {
    reservationId: createId('reservation'),
    benefitRef: input.benefitRef,
    subjectRef: input.subjectRef,
    contextRef: input.contextRef,
    quantity: input.quantity,
    amount: input.amount,
    state: input.contextRef.contextType === 'payment' ? 'held_by_payment' : 'held_by_cart',
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000).toISOString() : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  benefitCenterStore.reservationsById.set(reservation.reservationId, reservation)
  benefitCenterStore.reservationIdByIdempotencyKey.set(input.idempotencyKey, reservation.reservationId)
  return reservation
}

export const promoteReservation = (reservationId: string) => {
  const reservation = benefitCenterStore.reservationsById.get(reservationId)
  if (!reservation) {
    throw new Error('RESERVATION_NOT_FOUND')
  }
  reservation.state = 'promoted_to_order'
  reservation.updatedAt = nowIso()
  return reservation
}

export const releaseReservation = (reservationId: string) => {
  const reservation = benefitCenterStore.reservationsById.get(reservationId)
  if (!reservation) {
    throw new Error('RESERVATION_NOT_FOUND')
  }
  reservation.state = 'released'
  reservation.updatedAt = nowIso()
  return reservation
}

export const completeSettlement = (input: Omit<CompletedSettlementRecord, 'status'> & {status?: CompletedSettlementStatus}) => {
  const record: CompletedSettlementRecord = {
    ...input,
    completedAt: input.completedAt ?? nowIso(),
    status: input.status ?? 'completed',
  }
  benefitCenterStore.completedSettlementsById.set(record.settlementLineId, record)
  return record
}

export const markSettlement = (settlementLineId: string, status: CompletedSettlementStatus) => {
  const record = benefitCenterStore.completedSettlementsById.get(settlementLineId)
  if (!record) {
    throw new Error('SETTLEMENT_FACT_NOT_FOUND')
  }
  record.status = status
  return record
}

export const activateBenefitCode = (input: BenefitCodeActivationInput) => {
  if (!input.contextRef?.contextId || !input.contextRef.contextType) {
    throw new Error('CONTEXT_REF_REQUIRED')
  }
  if (!input.code?.trim()) {
    throw new Error('BENEFIT_CODE_REQUIRED')
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED')
  }

  const existing = benefitCenterStore.codeActivationByIdempotencyKey.get(input.idempotencyKey)
  if (existing) {
    return existing
  }

  const activation = createDynamicBenefitCodeActivation(input) satisfies ActivatedBenefitCodeRecord
  benefitCenterStore.codeActivationByIdempotencyKey.set(input.idempotencyKey, activation)
  return activation
}
