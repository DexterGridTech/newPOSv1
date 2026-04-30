export interface AllocationPolicy {
    target: 'matchedLines' | 'allPayableLines' | 'selectedLines' | 'paymentGroup'
    method: 'byAmountRatio' | 'byQuantityRatio' | 'fixedPerLine' | 'bestBenefitFirst'
    rounding: 'floorToCent' | 'roundToCent' | 'bankersRound'
    remainder: 'largestAmountLine' | 'firstLine' | 'lastLine'
    includeZeroAmountLines: boolean
    refundReversal: 'byOriginalAllocation' | 'recalculateOnRefund'
}
