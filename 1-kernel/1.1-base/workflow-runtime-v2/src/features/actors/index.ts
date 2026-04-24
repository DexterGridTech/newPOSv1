import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import type {WorkflowRuntimeRegistryRecord} from '../../foundations/runtime'
import {createWorkflowDefinitionMutationActorDefinitionV2} from './workflowDefinitionMutationActor'
import {createWorkflowControlActorDefinitionV2} from './workflowControlActor'
import {createWorkflowRunActorDefinitionV2} from './workflowRunActor'
import {createWorkflowRemoteDefinitionActorDefinitionV2} from './workflowRemoteDefinitionActor'

export * from './workflowDefinitionMutationActor'
export * from './workflowControlActor'
export * from './workflowRunActor'
export * from './workflowRemoteDefinitionActor'

export const createWorkflowActorDefinitionsV2 = (
    registry: WorkflowRuntimeRegistryRecord,
    remoteDefinitionTopicKey: string,
): ActorDefinition[] => [
    createWorkflowDefinitionMutationActorDefinitionV2(registry),
    createWorkflowControlActorDefinitionV2(registry),
    createWorkflowRunActorDefinitionV2(registry),
    createWorkflowRemoteDefinitionActorDefinitionV2(registry, remoteDefinitionTopicKey),
]
