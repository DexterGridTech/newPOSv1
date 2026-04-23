import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createOrganizationIamMasterDataActorDefinition} from './masterDataActor'

export * from './masterDataActor'

export const createOrganizationIamMasterDataActorDefinitions = (): ActorDefinition[] => [
    createOrganizationIamMasterDataActorDefinition(),
]
