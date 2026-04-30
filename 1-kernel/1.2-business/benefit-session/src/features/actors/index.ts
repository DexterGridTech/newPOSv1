import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import {createBenefitSessionActorDefinition} from './sessionActor'
import type {BenefitCenterPortRef, CreateBenefitSessionModuleInput} from '../../types'

export * from './sessionActor'

export const createBenefitSessionActorDefinitions = (
    benefitCenterPortRef: BenefitCenterPortRef,
    calculator: NonNullable<CreateBenefitSessionModuleInput['calculator']>,
): ActorDefinition[] => [
    createBenefitSessionActorDefinition(benefitCenterPortRef, calculator),
]
