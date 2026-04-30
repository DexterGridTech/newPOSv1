import type {Money} from '../foundations/money'
import type {BenefitRef} from '../foundations/references'
import type {BenefitAllocation} from './allocation'

export type BenefitEffect =
    | {kind: 'pricingAdjustment'; amount: Money; targetLineIds: string[]}
    | {kind: 'settlementCandidate'; payableImpactAmount: Money; quantity?: number}
    | {kind: 'fulfillment'; effectType: 'giftPool' | 'giftLine' | 'exchangeLine' | 'serviceLine' | 'postOrderCertificate'}
    | {kind: 'promptOnly'}

export interface BenefitApplication {
    applicationId: string
    opportunityId?: string
    benefitRef: BenefitRef
    state: 'selected' | 'autoApplied' | 'reserved' | 'applied'
    selectedQuantity: number
    actualEffect: BenefitEffect
    reservationId?: string
    allocations?: BenefitAllocation[]
}

export interface BenefitSelectionInput {
    code?: string
    password?: string
    giftLineIds?: string[]
    paymentAccountRef?: string
    attributes?: Record<string, unknown>
}

export interface BenefitApplicationInput {
    benefitRef: BenefitRef
    selectedQuantity?: number
    input?: BenefitSelectionInput
}
