import type {
    ActivatedBenefitCodeResult,
    BenefitApplicationInput,
    BenefitContextRef,
    BenefitEvaluationRequest,
    BenefitEvaluationResult,
    BenefitEvaluationStage,
    BenefitQuotaFact,
    BenefitLine,
    BenefitLinePayload,
    BenefitRef,
    BenefitReservation,
    BenefitSelectionInput,
    BenefitSnapshot,
    BenefitTemplate,
    CommerceSubjectSnapshot,
    CompletedSettlementSnapshot,
    CustomerIdentitySnapshot,
    EntryIdentityCredential,
    Money,
    ReservationSubjectRef,
    SettlementLineCandidate,
} from '@next/kernel-business-benefit-types'
import type {HttpRuntime} from '@next/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'

export interface BenefitProjectionRecord {
    topic: string
    itemKey: string
    scopeType: string
    scopeId: string
    revision: number
    sourceReleaseId?: string | null
    occurredAt?: string
    updatedAt: number
    data?: Record<string, unknown>
    tombstone?: boolean
}

export interface BenefitSessionDiagnosticEntry {
    diagnosticId: string
    level: 'info' | 'warn' | 'error'
    code: string
    message?: string
    contextRef?: BenefitContextRef
    occurredAt: number
}

export interface BenefitIdentityState extends Record<string, unknown> {
    snapshotsByEntryKey: Record<string, CustomerIdentitySnapshot>
    contextEntryKeyByContextKey: Record<string, string>
    lastChangedAt?: number
}

export interface BenefitSnapshotState extends Record<string, unknown> {
    tdpTemplatesByKey: Record<string, BenefitTemplate>
    tdpLinesByKey: Record<string, BenefitLine>
    personalSnapshotsByEntryKey: Record<string, BenefitSnapshot>
    activatedCodesByContextKey: Record<string, ActivatedBenefitCodeResult[]>
    diagnostics: BenefitSessionDiagnosticEntry[]
    lastChangedAt?: number
}

export interface BenefitReservationState extends Record<string, unknown> {
    byId: Record<string, BenefitReservation>
    idsByContextKey: Record<string, string[]>
    lastChangedAt?: number
}

export interface BenefitContextEvaluationState {
    contextRef: BenefitContextRef
    stage: BenefitEvaluationStage
    result: BenefitEvaluationResult
    selectedApplications: BenefitApplicationInput[]
    evaluatedAt: number
    stale?: boolean
    inputFingerprint: string
}

export interface BenefitEvaluationState extends Record<string, unknown> {
    byContextKey: Record<string, BenefitContextEvaluationState>
    lastChangedAt?: number
}

export interface BenefitCenterPortPersonalQueryInput {
    terminalNo: string
    entryIdentity: EntryIdentityCredential
    contextRef?: BenefitContextRef
}

export interface BenefitCenterPortReservationInput {
    contextRef: BenefitContextRef
    benefitRef: BenefitRef
    subjectRef: ReservationSubjectRef
    quantity: number
    amount?: Money
    idempotencyKey: string
    ttlSeconds?: number
}

export interface BenefitCenterPortCodeActivationInput {
    contextRef: BenefitContextRef
    code: string
    codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
    subject?: CommerceSubjectSnapshot
    entryIdentity?: EntryIdentityCredential
    idempotencyKey: string
}

export interface BenefitCenterPortOrderFactQueryInput {
    bucketKey?: string
    subjectType?: ReservationSubjectRef['subjectType']
    subjectKey?: string
}

export interface BenefitCenterPortCompleteSettlementInput
    extends Omit<CompletedSettlementSnapshot, 'status'> {
    status?: CompletedSettlementSnapshot['status']
}

export interface BenefitCenterPort {
    queryPersonalBenefits(input: BenefitCenterPortPersonalQueryInput): Promise<{
        identitySnapshot: CustomerIdentitySnapshot
        benefitSnapshot: BenefitSnapshot
    }>
    reserveBenefit(input: BenefitCenterPortReservationInput): Promise<BenefitReservation>
    releaseBenefitReservation(reservation: BenefitReservation): Promise<BenefitReservation>
    promoteBenefitReservation?(reservation: BenefitReservation): Promise<BenefitReservation>
    activateBenefitCode(input: BenefitCenterPortCodeActivationInput): Promise<ActivatedBenefitCodeResult>
    queryOrderFacts?(input: BenefitCenterPortOrderFactQueryInput): Promise<BenefitQuotaFact[]>
    completeSettlementFact?(
        input: BenefitCenterPortCompleteSettlementInput | SettlementLineCandidate,
    ): Promise<CompletedSettlementSnapshot>
    markSettlementFact?(
        settlementLineId: string,
        status: Extract<CompletedSettlementSnapshot['status'], 'refunded' | 'voided'>,
    ): Promise<CompletedSettlementSnapshot>
}

export interface BenefitCenterPortRef {
    current?: BenefitCenterPort
}

export interface BenefitSessionRuntimeAssembly {
    createHttpRuntime(context: RuntimeModuleContextV2): HttpRuntime
}

export interface CreateBenefitSessionModuleInput {
    benefitCenterPort?: BenefitCenterPort
    assembly?: BenefitSessionRuntimeAssembly
    calculator?: {
        evaluateBenefitRequest(request: BenefitEvaluationRequest): BenefitEvaluationResult
    }
}

export interface EvaluateBenefitContextPayload {
    contextRef: BenefitContextRef
    stage: BenefitEvaluationStage
    subject: CommerceSubjectSnapshot
    identitySnapshot?: CustomerIdentitySnapshot
    benefitSnapshot?: Partial<BenefitSnapshot>
    selectedApplications?: BenefitApplicationInput[]
}

export interface ReleaseBenefitContextPayload {
    contextRef: BenefitContextRef
    reason:
        | 'cartCanceled'
        | 'cartCleared'
        | 'orderCanceled'
        | 'paymentTimeout'
        | 'benefitRemoved'
        | 'codeRemoved'
        | 'identityChanged'
}

export interface SelectBenefitOpportunityPayload {
    contextRef: BenefitContextRef
    opportunityId: string
    selectedQuantity?: number
    input?: BenefitSelectionInput
}

export interface DeselectBenefitApplicationPayload {
    contextRef: BenefitContextRef
    applicationId: string
    reason: 'clerkRemoved' | 'customerRemoved' | 'businessRecalculation'
}

export interface ChooseBenefitGiftPayload {
    contextRef: BenefitContextRef
    opportunityId: string
    giftLineIds: string[]
}

export interface ActivateBenefitCodePayload {
    contextRef: BenefitContextRef
    code: string
    codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
    subject?: CommerceSubjectSnapshot
    entryIdentity?: EntryIdentityCredential
    idempotencyKey: string
}

export interface LinkBenefitIdentityPayload {
    contextRef: BenefitContextRef
    terminalNo: string
    entryIdentity: EntryIdentityCredential
}

export interface BenefitContextView {
    contextRef: BenefitContextRef
    identitySnapshot?: CustomerIdentitySnapshot
    benefitSnapshot: BenefitSnapshot
    result?: BenefitEvaluationResult
    selectedApplications: BenefitApplicationInput[]
    activatedCodes: ActivatedBenefitCodeResult[]
    reservations: BenefitReservation[]
    stale: boolean
}

export type BenefitLineWithOptionalPayload = BenefitLine & {
    linePayloadSnapshot?: BenefitLinePayload
}
