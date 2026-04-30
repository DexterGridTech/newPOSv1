import type {BenefitContextRef} from '../foundations/references'
import type {CustomerIdentitySnapshot} from '../identity'
import type {BenefitSnapshot, CommerceSubjectSnapshot} from '../snapshot'
import type {BenefitApplicationInput} from './application'
import type {BenefitEvaluationStage} from './opportunity'

export interface BenefitEvaluationRequest {
    contextRef: BenefitContextRef
    stage: BenefitEvaluationStage
    subject: CommerceSubjectSnapshot
    identitySnapshot?: CustomerIdentitySnapshot
    benefitSnapshot: BenefitSnapshot
    selectedApplications?: BenefitApplicationInput[]
}
