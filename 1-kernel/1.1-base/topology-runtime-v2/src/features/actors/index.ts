export * from './contextActor'
export * from './connectionActor'
export * from './dispatchActor'
export * from './initializeActor'

import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeV2ContextActor} from './contextActor'
import {createTopologyRuntimeV2ConnectionActor, type TopologyRuntimeV2OrchestratorRef} from './connectionActor'
import {createTopologyRuntimeV2DispatchActor} from './dispatchActor'
import {createTopologyRuntimeV2InitializeActor} from './initializeActor'

export const createTopologyRuntimeV2ActorDefinitions = (
    orchestratorRef: TopologyRuntimeV2OrchestratorRef,
): readonly ActorDefinition[] => ([
    createTopologyRuntimeV2InitializeActor(),
    createTopologyRuntimeV2ContextActor(),
    createTopologyRuntimeV2ConnectionActor(orchestratorRef),
    createTopologyRuntimeV2DispatchActor(orchestratorRef),
])
