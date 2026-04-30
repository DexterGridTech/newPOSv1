import type {Money} from '../foundations/money'
import type {ProductScopeRule, ThresholdRequirement} from '../foundations/product'
import type {BenefitEvaluationStage} from '../evaluation/opportunity'

export interface IdentityRequirement {
    identityType?: string
    identityKeys?: string[]
    required?: boolean
}

export interface MembershipRequirement {
    membershipType?: string
    membershipKeys?: string[]
    planCodes?: string[]
    levelCode?: string
    levelCodes?: string[]
    qualificationAttributes?: Record<string, unknown>
}

export interface TimeWindowRule {
    validFrom?: string
    validTo?: string
    weekDays?: number[]
    dayTimeRanges?: Array<{
        start: string
        end: string
    }>
}

export interface TerminalRequirement {
    terminalNos?: string[]
    organizationCodes?: string[]
}

export interface ChannelRequirement {
    channelCodes?: string[]
}

export interface PaymentInstrumentScopeRule {
    instrumentTypes?: string[]
    accountRefs?: string[]
    issuerCodes?: string[]
    productCodes?: string[]
    acquiringTypeCodes?: string[]
    acquiringInstitutionCodes?: string[]
    acquiringProductCodes?: string[]
}

export interface EligibilityPolicy {
    applicableStages?: BenefitEvaluationStage[]
    identityRequirements?: IdentityRequirement[]
    membershipRequirements?: MembershipRequirement[]
    timeWindow?: TimeWindowRule
    terminalRequirements?: TerminalRequirement[]
    channelRequirements?: ChannelRequirement[]
    productScope?: ProductScopeRule
    paymentInstrumentScope?: PaymentInstrumentScopeRule
    thresholdRequirements?: ThresholdRequirement[]
    minimumPayableAmount?: Money
}
