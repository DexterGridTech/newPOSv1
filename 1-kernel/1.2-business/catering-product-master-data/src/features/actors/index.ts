import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import {createCateringProductMasterDataActorDefinition} from './masterDataActor'

export * from './masterDataActor'

export const createCateringProductMasterDataActorDefinitions = (): ActorDefinition[] => [
    createCateringProductMasterDataActorDefinition(),
]
