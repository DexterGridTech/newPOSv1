import type {BenefitRef} from '../foundations/references'

export interface PolicyExecutionTrace {
    policyName: string
    policyKind: string
    result: 'matched' | 'notMatched' | 'applied' | 'skipped'
    reasonCode?: string
    inputs?: Record<string, unknown>
    outputs?: Record<string, unknown>
}

export interface BenefitEvaluationDiagnostic {
    diagnosticId: string
    level: 'info' | 'warn' | 'error'
    code: string
    benefitRef?: BenefitRef
    message?: string
    trace?: PolicyExecutionTrace[]
}
