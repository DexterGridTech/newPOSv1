import type {Money} from '../foundations/money'
import type {BenefitContextRef, BenefitRef} from '../foundations/references'

export type BenefitEvaluationStage = 'cart' | 'orderConfirm' | 'payment'

export interface BenefitEffectPreview {
    effectKind: string
    estimatedAmount?: Money
    estimatedQuantity?: number
    descriptionKey?: string
}

export type BenefitUnavailableReason =
    | {code: 'reservedByOtherContext'; contextRef: BenefitContextRef}
    | {code: 'quotaExhausted'; bucketKey: string}
    | {code: 'quotaExceeded'; bucketKey: string}
    | {code: 'eligibilityNotMet'; failedRequirements: string[]}
    | {code: 'lineExpired'}
    | {code: 'lineConsumed'}
    | {code: 'thresholdNotMet'; required: Money; current: Money}
    | {code: 'stackingConflict'; conflictingBenefitRef: BenefitRef}
    | {code: 'stageNotApplicable'; applicableStages: BenefitEvaluationStage[]}
    | {code: 'productExcluded'; lineIds: string[]}
    | {code: 'unsupportedEffectKind'; effectKind: string}

export interface ReservationPreview {
    required: boolean
    subjectKey?: string
    quantity?: number
    expiresAt?: string
}

export interface BenefitOpportunity {
    opportunityId: string
    benefitRef: BenefitRef
    /**
     * available: can be applied or selected now.
     * conditional: useful to display, but requires another action such as selecting a payment instrument.
     * unavailable: show unavailableReason only; do not apply it.
     */
    availability: 'available' | 'unavailable' | 'conditional'
    unavailableReason?: BenefitUnavailableReason
    /**
     * Preview for UI prompts. It is not an applied discount until an application/pricing adjustment/settlement line exists.
     */
    maxEffectPreview?: BenefitEffectPreview
    requiredAction?: 'selectBenefit' | 'selectPaymentInstrument' | 'chooseGift' | 'enterCode' | 'enterPassword'
    reservationPreview?: ReservationPreview
}
