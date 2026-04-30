import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    ActivateBenefitCodePayload,
    ChooseBenefitGiftPayload,
    DeselectBenefitApplicationPayload,
    EvaluateBenefitContextPayload,
    LinkBenefitIdentityPayload,
    ReleaseBenefitContextPayload,
    SelectBenefitOpportunityPayload,
} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const benefitSessionCommandDefinitions = {
    evaluateBenefitContext: defineModuleCommand<EvaluateBenefitContextPayload>('evaluate-benefit-context'),
    releaseBenefitContext: defineModuleCommand<ReleaseBenefitContextPayload>('release-benefit-context'),
    selectBenefitOpportunity: defineModuleCommand<SelectBenefitOpportunityPayload>('select-benefit-opportunity'),
    deselectBenefitApplication: defineModuleCommand<DeselectBenefitApplicationPayload>('deselect-benefit-application'),
    chooseBenefitGift: defineModuleCommand<ChooseBenefitGiftPayload>('choose-benefit-gift'),
    activateBenefitCode: defineModuleCommand<ActivateBenefitCodePayload>('activate-benefit-code'),
    linkBenefitIdentity: defineModuleCommand<LinkBenefitIdentityPayload>('link-benefit-identity'),
    benefitContextEvaluated: defineModuleCommand<{
        contextKey: string
        resultApplicationCount: number
        reservationCount: number
        evaluatedAt: number
    }>('benefit-context-evaluated', {
        allowNoActor: true,
    }),
} as const
