export interface BenefitRef {
    /**
     * Template identity, e.g. "tmpl-full-200-minus-20".
     * Activities without a user-owned asset only need templateKey.
     */
    templateKey: string
    /**
     * Optional user asset/account line, e.g. one coupon line or one points account.
     * A coupon has both templateKey and lineKey; a store-wide full reduction usually has no lineKey.
     */
    lineKey?: string
}

export interface BenefitContextRef {
    /**
     * cart: mutable shopping cart calculation.
     * order: order confirmation after price is fixed.
     * payment: payment-step calculation with completed settlement facts.
     */
    contextType: 'cart' | 'order' | 'payment'
    /**
     * Business context id. Different suspended carts must use different ids, e.g. cart-A and cart-B.
     */
    contextId: string
    /**
     * Marks the current foreground cart/order/payment context in terminal runtime.
     * Auto-reserved quota should belong to the current context that triggered evaluation.
     */
    isCurrent?: boolean
}

export interface ReservationSubjectRef {
    subjectType:
        | 'entryIdentity'
        | 'identity'
        | 'membership'
        | 'paymentAccount'
        | 'benefitLine'
        | 'custom'
    subjectKey: string
    displayKey?: string
}

export interface BenefitSettlementPayload {
    /**
     * External fields copied onto settlement candidates for payment center write-off/accounting.
     * These fields are payload metadata, not calculation input.
     */
    externalSystemCode?: string
    externalTemplateNo?: string
    externalLineNo?: string
    externalAccountNo?: string
    faceAmount?: number
    metadata?: Record<string, unknown>
}

export interface BenefitTemplatePayload {
    displayName?: string
    description?: string
    faceAmount?: number
    metadata?: Record<string, unknown>
}

export interface BenefitLinePayload {
    displayName?: string
    barcode?: string
    faceAmount?: number
    metadata?: Record<string, unknown>
}
