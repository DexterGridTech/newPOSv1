export interface SettlementPolicy {
    createSettlementLineCandidate: boolean
    settlementLineType:
        | 'pricing_adjustment_record'
        | 'coupon_deduction'
        | 'points_deduction'
        | 'stored_value_deduction'
        | 'wallet_deduction'
        | 'payment_method_discount'
        | 'gift_benefit_writeoff'
        | 'exchange_benefit_writeoff'
        | 'service_benefit_writeoff'
    quantityUnit?: 'piece' | 'point' | 'cent' | 'times' | 'item'
    amountRole: 'payableImpact' | 'coverageAmount' | 'benefitValueOnly' | 'externalChargeAmount'
    copySettlementPayload: boolean
}
