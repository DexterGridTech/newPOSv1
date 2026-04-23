import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createCateringProductMasterDataActorDefinition} from './masterDataActor'

export * from './masterDataActor'

export const createCateringProductMasterDataActorDefinitions = (): ActorDefinition[] => [
    createCateringProductMasterDataActorDefinition(),
]
