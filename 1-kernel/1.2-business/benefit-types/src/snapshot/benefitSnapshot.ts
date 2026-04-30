import type {BenefitLine, BenefitReservation} from '../line'
import type {BenefitQuotaFact, BenefitTemplate} from '../template'
import type {ActivatedBenefitCodeResult} from './activatedCode'
import type {CompletedSettlementSnapshot} from './completedSettlement'

export interface BenefitSnapshot {
    templates: BenefitTemplate[]
    lines: BenefitLine[]
    reservations: BenefitReservation[]
    /**
     * Redundant copy for convenience. CommerceSubjectSnapshot.completedSettlements
     * remains the authoritative source when both are provided.
     */
    completedSettlements?: CompletedSettlementSnapshot[]
    quotaFacts?: BenefitQuotaFact[]
    activatedCodes?: ActivatedBenefitCodeResult[]
}
