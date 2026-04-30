export interface BasisPolicy {
    thresholdBase: 'originalAmount' | 'currentRemainingAmount' | 'afterSelectedPricingAdjustments'
    discountBase: 'originalAmount' | 'currentRemainingAmount' | 'lineUnitPrice' | 'membershipPrice'
    includePriorAdjustments: boolean
    includeGiftLines: boolean
    includeExchangeLines: boolean
    thresholdConsumptionMode?: 'none' | 'consumeByApplication' | 'consumeByGroup'
}
