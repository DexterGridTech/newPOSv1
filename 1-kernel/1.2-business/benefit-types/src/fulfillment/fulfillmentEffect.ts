import type {ProductIdentity} from '../foundations/product'
import type {BenefitRef} from '../foundations/references'
import type {Money} from '../foundations/money'

export interface FulfillmentLineCandidate {
    fulfillmentLineId: string
    productIdentities?: ProductIdentity[]
    quantity: number
    unitPrice?: Money
    lineAmount?: Money
    displayName?: string
    attributes?: Record<string, unknown>
}

export interface FulfillmentEffect {
    fulfillmentEffectId: string
    benefitRef: BenefitRef
    effectType: 'giftPool' | 'giftLine' | 'exchangeLine' | 'serviceLine' | 'postOrderCertificate'
    candidateLines?: FulfillmentLineCandidate[]
    selectedLines?: FulfillmentLineCandidate[]
    linkedSettlementLineId?: string
}
