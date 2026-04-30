import type {CommerceSubjectSnapshot} from '../snapshot'
import type {BenefitContextRef} from '../foundations/references'
import type {EntryIdentityCredential} from '../identity'
import type {BenefitEvaluationRequest, BenefitSelectionInput} from '../evaluation'
export type {ActivatedBenefitCodeResult} from '../snapshot/activatedCode'

export interface EvaluateBenefitContextCommand {
    type: 'benefitSession.evaluateContext'
    payload: BenefitEvaluationRequest
}

export interface ReleaseBenefitContextCommand {
    type: 'benefitSession.releaseContext'
    payload: {
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
}

export interface SelectBenefitOpportunityCommand {
    type: 'benefitSession.selectOpportunity'
    payload: {
        contextRef: BenefitContextRef
        opportunityId: string
        selectedQuantity?: number
        input?: BenefitSelectionInput
    }
}

export interface DeselectBenefitApplicationCommand {
    type: 'benefitSession.deselectApplication'
    payload: {
        contextRef: BenefitContextRef
        applicationId: string
        reason: 'clerkRemoved' | 'customerRemoved' | 'businessRecalculation'
    }
}

export interface ChooseBenefitGiftCommand {
    type: 'benefitSession.chooseGift'
    payload: {
        contextRef: BenefitContextRef
        opportunityId: string
        giftLineIds: string[]
    }
}

export interface ActivateBenefitCodeCommand {
    type: 'benefitSession.activateCode'
    payload: {
        contextRef: BenefitContextRef
        code: string
        codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
        subject?: CommerceSubjectSnapshot
        entryIdentity?: EntryIdentityCredential
        idempotencyKey: string
    }
}
