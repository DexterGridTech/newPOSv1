import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createRetailShellRuntimeInitializeActorDefinition} from './runtimeInitializeActor'
import {createRetailShellTcpLifecycleActorDefinition} from './tcpLifecycleActor'

export * from './runtimeInitializeActor'
export * from './tcpLifecycleActor'

export const createRetailShellActorDefinitions = (): ActorDefinition[] => [
    createRetailShellRuntimeInitializeActorDefinition(),
    createRetailShellTcpLifecycleActorDefinition(),
]
