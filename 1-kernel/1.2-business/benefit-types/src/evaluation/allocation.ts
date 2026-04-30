import type {Money} from '../foundations/money'
import type {BenefitRef} from '../foundations/references'

export interface BenefitAllocation {
    allocationId: string
    benefitRef: BenefitRef
    applicationId?: string
    targetLineId: string
    allocatedAmount: Money
    allocatedQuantity?: number
    allocationRatio?: number
}
