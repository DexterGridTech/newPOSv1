import type {Money} from '../foundations/money'
import type {BenefitContextRef, BenefitRef, ReservationSubjectRef} from '../foundations/references'

export interface BenefitReservation {
    reservationId: string
    benefitRef: BenefitRef
    subjectRef: ReservationSubjectRef
    contextRef: BenefitContextRef
    quantity: number
    amount?: Money
    state:
        | 'held_by_cart'
        | 'promoted_to_order'
        | 'held_by_payment'
        | 'consumed'
        | 'released'
        | 'expired'
    idempotencyKey: string
    expiresAt?: string
    createdAt: string
    updatedAt: string
}
