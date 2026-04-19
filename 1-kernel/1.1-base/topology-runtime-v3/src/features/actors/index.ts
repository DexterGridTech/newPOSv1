export * from './contextActor'
export * from './connectionActor'
export * from './demoSyncActor'

import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeV3ContextActor} from './contextActor'
import {
    createTopologyRuntimeV3ConnectionActor,
    type TopologyRuntimeV3OrchestratorRef,
} from './connectionActor'
import {createTopologyRuntimeV3DemoSyncActor} from './demoSyncActor'

export const createTopologyRuntimeV3ActorDefinitions = (
    orchestratorRef: TopologyRuntimeV3OrchestratorRef = {},
): readonly ActorDefinition[] => ([
    createTopologyRuntimeV3ContextActor(),
    createTopologyRuntimeV3ConnectionActor(orchestratorRef),
    createTopologyRuntimeV3DemoSyncActor(),
])
