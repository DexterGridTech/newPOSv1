import type {BenefitRef} from '../foundations/references'
import type {BenefitEffectPreview} from './opportunity'

export interface BenefitPrompt {
    promptId: string
    benefitRef: BenefitRef
    triggerAction: 'selectPaymentInstrument' | 'enterCode' | 'linkIdentity' | 'chooseGift'
    previewTextKey?: string
    effectPreview?: BenefitEffectPreview
}
