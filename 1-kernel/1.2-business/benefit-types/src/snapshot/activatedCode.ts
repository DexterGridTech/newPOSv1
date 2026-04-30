import type {BenefitContextRef} from '../foundations/references'
import type {BenefitEvaluationDiagnostic} from '../evaluation/diagnostic'
import type {BenefitLine} from '../line/line'
import type {BenefitTemplate} from '../template/template'

export interface ActivatedBenefitCodeResult {
    activationId: string
    contextRef: BenefitContextRef
    code: string
    activatedTemplates: BenefitTemplate[]
    activatedLines: BenefitLine[]
    expiresAt?: string
    diagnostics: BenefitEvaluationDiagnostic[]
}
