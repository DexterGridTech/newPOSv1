export * from './contextActor'
export * from './connectionActor'
export * from './demoSyncActor'
export * from './hostLifecycleActor'
export * from './powerDisplaySwitchActor'

import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeV3ContextActor} from './contextActor'
import {
    createTopologyRuntimeV3ConnectionActor,
    type TopologyRuntimeV3OrchestratorRef,
} from './connectionActor'
import {createTopologyRuntimeV3DemoSyncActor} from './demoSyncActor'
import {createTopologyRuntimeV3HostLifecycleActor} from './hostLifecycleActor'
import {createTopologyRuntimeV3PowerDisplaySwitchActor} from './powerDisplaySwitchActor'

export const createTopologyRuntimeV3ActorDefinitions = (
    orchestratorRef: TopologyRuntimeV3OrchestratorRef = {},
): readonly ActorDefinition[] => ([
    createTopologyRuntimeV3ContextActor(),
    createTopologyRuntimeV3ConnectionActor(orchestratorRef),
    createTopologyRuntimeV3DemoSyncActor(),
    createTopologyRuntimeV3HostLifecycleActor(),
    createTopologyRuntimeV3PowerDisplaySwitchActor(),
])
