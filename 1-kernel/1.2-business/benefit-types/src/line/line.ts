import type {Money} from '../foundations/money'
import type {BenefitLinePayload, BenefitSettlementPayload} from '../foundations/references'

export interface BenefitLine {
    lineKey: string
    templateKey: string
    lineType: 'asset' | 'account' | 'qualification' | 'activity_instance'
    ownerIdentityKey?: string
    ownerMembershipKey?: string
    quantity?: number
    balanceAmount?: Money
    availableFrom?: string
    availableTo?: string
    status: 'available' | 'reserved' | 'consumed' | 'expired' | 'voided'
    linePayloadSnapshot?: BenefitLinePayload
    settlementPayload?: BenefitSettlementPayload
    externalSnapshot?: unknown
}
