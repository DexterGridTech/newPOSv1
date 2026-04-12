export * from './contextActor'
export * from './connectionActor'
export * from './dispatchActor'

import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeV2ContextActor} from './contextActor'
import {createTopologyRuntimeV2ConnectionActor, type TopologyRuntimeV2OrchestratorRef} from './connectionActor'
import {createTopologyRuntimeV2DispatchActor} from './dispatchActor'

export const createTopologyRuntimeV2ActorDefinitions = (
    orchestratorRef: TopologyRuntimeV2OrchestratorRef,
): readonly ActorDefinition[] => ([
    createTopologyRuntimeV2ContextActor(),
    createTopologyRuntimeV2ConnectionActor(orchestratorRef),
    createTopologyRuntimeV2DispatchActor(orchestratorRef),
])
