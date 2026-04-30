import type {Money} from '../foundations/money'
import type {BenefitRef, BenefitSettlementPayload} from '../foundations/references'
import type {BenefitAllocation} from '../evaluation/allocation'

export interface CompletedSettlementSnapshot {
    settlementGroupId?: string
    settlementLineId: string
    lineType: string
    benefitRef?: BenefitRef
    coverageAmount: Money
    payableImpactAmount: Money
    quantity?: number
    quantityUnit?: string
    allocations?: BenefitAllocation[]
    settlementPayloadSnapshot?: BenefitSettlementPayload
    completedAt: string
    status: 'completed' | 'refunded' | 'partiallyRefunded' | 'voided'
}
