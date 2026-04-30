export interface LifecycleStatusRule {
    from: string
    to: string
    on: string
}

export type LifecycleVoidEvent = 'orderCanceled' | 'paymentVoided' | 'manualVoid' | 'expired'

export interface LifecyclePolicy {
    validFrom?: string
    validTo?: string
    statusRules?: LifecycleStatusRule[]
    voidOn?: LifecycleVoidEvent[]
    refundBehavior: 'returnBenefit' | 'doNotReturnBenefit' | 'returnRemainingQuantity' | 'manualReview'
    partialRefundBehavior: 'proportional' | 'byOriginalAllocation' | 'notSupported'
}
