import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import {createTerminalLogUploadActorDefinitionV2} from './uploadActor'

export * from './uploadActor'

export const createTerminalLogUploadActorDefinitionsV2 = (): ActorDefinition[] => [
    createTerminalLogUploadActorDefinitionV2(),
]
