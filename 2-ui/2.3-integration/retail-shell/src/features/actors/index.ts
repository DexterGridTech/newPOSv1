import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createRetailShellHotUpdateRestartPreparationActorDefinition} from './hotUpdateRestartPreparationActor'
import {createRetailShellRuntimeInitializeActorDefinition} from './runtimeInitializeActor'
import {createRetailShellTcpLifecycleActorDefinition} from './tcpLifecycleActor'

export * from './hotUpdateRestartPreparationActor'
export * from './runtimeInitializeActor'
export * from './tcpLifecycleActor'

export const createRetailShellActorDefinitions = (): ActorDefinition[] => [
    createRetailShellRuntimeInitializeActorDefinition(),
    createRetailShellTcpLifecycleActorDefinition(),
    createRetailShellHotUpdateRestartPreparationActorDefinition(),
]
