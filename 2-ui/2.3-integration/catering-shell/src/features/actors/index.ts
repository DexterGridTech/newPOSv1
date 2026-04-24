import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createCateringShellHotUpdateRestartPreparationActorDefinition} from './hotUpdateRestartPreparationActor'
import {createCateringShellRuntimeInitializeActorDefinition} from './runtimeInitializeActor'
import {createCateringShellTcpLifecycleActorDefinition} from './tcpLifecycleActor'

export * from './hotUpdateRestartPreparationActor'
export * from './runtimeInitializeActor'
export * from './tcpLifecycleActor'

export const createCateringShellActorDefinitions = (): ActorDefinition[] => [
    createCateringShellRuntimeInitializeActorDefinition(),
    createCateringShellTcpLifecycleActorDefinition(),
    createCateringShellHotUpdateRestartPreparationActorDefinition(),
]
