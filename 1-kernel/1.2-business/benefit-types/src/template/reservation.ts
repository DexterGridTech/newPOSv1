import type {Money} from '../foundations/money'
import type {ReservationSubjectRef} from '../foundations/references'

export type QuotaFactSource = 'reservationLedger' | 'orderFact' | 'externalQuery'

export interface BenefitQuotaFact {
    bucketKey: string
    subjectRef: ReservationSubjectRef
    usedQuantity: number
    source: QuotaFactSource
    factRef?: string
    occurredAt?: string
    amount?: Money
}

export interface QuotaBucketPolicy {
    /**
     * Business bucket for quota facts, e.g. "black-card-daily-8-off".
     * The same bucket must be used by reservations and order facts.
     */
    bucketKey: string
    window: 'perOrder' | 'perDay' | 'perWeek' | 'perMonth' | 'lifetime' | 'custom'
    limitQuantity: number
    factSources: QuotaFactSource[]
}

export type ReservationReleaseEvent =
    | 'cartCanceled'
    | 'cartCleared'
    | 'orderCanceled'
    | 'paymentTimeout'
    | 'benefitRemoved'
    | 'codeRemoved'
    | 'identityChanged'

export interface ReservationPolicy {
    /**
     * none: no quota hold.
     * autoOnOpportunity: reserve as soon as the current context has an available opportunity.
     * onSelection: reserve when clerk/customer selects the benefit.
     * onOrderSubmit/onPaymentAttempt: reserve later in the transaction flow.
     */
    mode: 'none' | 'autoOnOpportunity' | 'onSelection' | 'onOrderSubmit' | 'onPaymentAttempt'
    /**
     * Subject that consumes quota. For "black card once per day", use membership plus subjectMembershipType.
     */
    subject: 'entryIdentity' | 'identity' | 'membership' | 'paymentAccount' | 'benefitLine' | 'custom'
    subjectIdentityType?: string
    subjectMembershipType?: string
    quotaBucket?: QuotaBucketPolicy
    ttlSeconds?: number
    /**
     * Events that release a held reservation. Suspended cart scenarios depend on this:
     * cart-A cancellation must release the quota before cart-B can use it.
     */
    releaseOn: ReservationReleaseEvent[]
    promoteOn?: 'orderCreated' | 'paymentStarted'
    consumeOn?: 'orderConfirmed' | 'paymentSucceeded' | 'fulfillmentCompleted' | 'manualWriteOff'
}
