import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import {createCateringStoreOperatingMasterDataActorDefinition} from './masterDataActor'

export * from './masterDataActor'

export const createCateringStoreOperatingMasterDataActorDefinitions = (): ActorDefinition[] => [
    createCateringStoreOperatingMasterDataActorDefinition(),
]
