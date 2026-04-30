import type {BenefitEvaluationRequest, CompletedSettlementSnapshot} from '@next/kernel-business-benefit-types'

export function resolveCompletedSettlements(request: BenefitEvaluationRequest): CompletedSettlementSnapshot[] {
    if (request.subject.completedSettlements) {
        return request.subject.completedSettlements
    }

    return request.benefitSnapshot.completedSettlements ?? []
}
