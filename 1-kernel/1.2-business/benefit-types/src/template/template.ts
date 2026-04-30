import type {BenefitSettlementPayload, BenefitTemplatePayload} from '../foundations/references'
import type {AllocationPolicy} from './allocation'
import type {BasisPolicy} from './basis'
import type {EffectPolicy} from './effects'
import type {EligibilityPolicy} from './eligibility'
import type {FulfillmentPolicy} from './fulfillment'
import type {LifecyclePolicy} from './lifecycle'
import type {ReservationPolicy} from './reservation'
import type {SelectionPolicy} from './selection'
import type {SettlementPolicy} from './settlement'
import type {StackingPolicy, TransactionStackingPolicy} from './stacking'

export interface BenefitTemplate {
    templateKey: string
    templateCode: string
    version: number
    status: 'active' | 'inactive' | 'expired'
    calculationSchemaVersion: 1
    eligibilityPolicy: EligibilityPolicy
    /**
     * Defines what the benefit does: price adjustment, settlement deduction, payment method discount,
     * gift pool, exchange line, or service entitlement.
     */
    effectPolicy: EffectPolicy
    /**
     * Defines the monetary basis. This is critical for cart vs order vs payment:
     * cart full reduction may use current amount, while payment-stage benefits should use remaining payable.
     */
    basisPolicy: BasisPolicy
    selectionPolicy: SelectionPolicy
    reservationPolicy: ReservationPolicy
    stackingPolicy: StackingPolicy
    transactionStackingPolicy?: TransactionStackingPolicy
    allocationPolicy: AllocationPolicy
    settlementPolicy: SettlementPolicy
    fulfillmentPolicy?: FulfillmentPolicy
    lifecyclePolicy: LifecyclePolicy
    /**
     * Display/write-off metadata copied from template to settlement candidates.
     * Example: faceAmount=10000 for a 100.00 coupon is metadata, not the computed deduction amount.
     */
    templatePayloadSnapshot?: BenefitTemplatePayload
    settlementPayload?: BenefitSettlementPayload
    externalSnapshot?: unknown
}
