import type {FulfillmentEffect} from '../fulfillment'
import type {BenefitContextRef} from '../foundations/references'
import type {PricingAdjustment, SettlementGroupCandidate, SettlementLineCandidate} from '../settlement'
import type {CommerceLinePriceLayer} from '../snapshot'
import type {BenefitAllocation} from './allocation'
import type {BenefitApplication} from './application'
import type {BenefitEvaluationDiagnostic} from './diagnostic'
import type {BenefitOpportunity, BenefitEvaluationStage} from './opportunity'
import type {BenefitPrompt} from './prompt'

export interface BenefitEvaluationResult {
    contextRef: BenefitContextRef
    stage: BenefitEvaluationStage
    opportunities: BenefitOpportunity[]
    prompts: BenefitPrompt[]
    applications: BenefitApplication[]
    pricingAdjustments: PricingAdjustment[]
    priceLayers: CommerceLinePriceLayer[]
    fulfillmentEffects: FulfillmentEffect[]
    settlementGroups: SettlementGroupCandidate[]
    settlementLines: SettlementLineCandidate[]
    allocations: BenefitAllocation[]
    diagnostics: BenefitEvaluationDiagnostic[]
}
