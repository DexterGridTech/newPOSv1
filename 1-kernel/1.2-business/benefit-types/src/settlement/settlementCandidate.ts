import type {Money} from '../foundations/money'
import type {BenefitContextRef, BenefitRef, BenefitSettlementPayload} from '../foundations/references'

export interface PricingAdjustment {
    adjustmentId: string
    benefitRef: BenefitRef
    amount: Money
    targetLineIds: string[]
    allocationIds: string[]
    priceLayerIds?: string[]
    priceEffect:
        | 'amountOff'
        | 'ratioOff'
        | 'fixedPrice'
        | 'memberPrice'
        | 'bundlePrice'
        | 'buyNFreeM'
        | 'nthItemDiscount'
    affectsOrderPayable: true
}

export interface SettlementGroupCandidate {
    settlementGroupId: string
    contextRef: BenefitContextRef
    /**
     * Order amount covered by this payment group.
     * In prepaid-card 20% off, the group may cover 100.00 even though the external charge is 80.00.
     */
    coverageAmount: Money
    /**
     * Amount selected by refund UI as the anchor for reverse processing.
     */
    refundAnchorAmount: Money
    /**
     * Actual amount sent to an external payment/account system when it differs from coverageAmount.
     */
    externalRequestAmount?: Money
    lineIds: string[]
}

export interface SettlementLineCandidate {
    settlementLineId: string
    settlementGroupId?: string
    benefitRef?: BenefitRef
    lineType: string
    /**
     * Quantity paid/used, separate from money.
     * Example: 5000 points deduct 50.00 CNY => quantity=5000, payableImpactAmount.amount=5000.
     */
    quantity?: number
    quantityUnit?: string
    /**
     * Amount by which this line reduces or covers the payable amount.
     */
    payableImpactAmount: Money
    /**
     * Face or benefit value when it differs from actual payable impact.
     */
    benefitValueAmount?: Money
    /**
     * External request amount for payment instruments.
     * Example: prepaid-card discount line can make a 100.00 coverage group request only 80.00 externally.
     */
    externalRequestAmount?: Money
    settlementPayloadSnapshot?: BenefitSettlementPayload
    externalSnapshot?: unknown
}
