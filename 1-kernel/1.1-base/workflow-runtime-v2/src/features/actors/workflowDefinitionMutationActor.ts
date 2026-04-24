import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {workflowRuntimeV2CommandDefinitions} from '../commands'
import type {WorkflowRuntimeRegistryRecord} from '../../foundations/runtime'

const defineActor = createModuleActorFactory(moduleName)

export const createWorkflowDefinitionMutationActorDefinitionV2 = (
    registry: WorkflowRuntimeRegistryRecord,
): ActorDefinition => defineActor('WorkflowDefinitionMutationActor', [
    onCommand(workflowRuntimeV2CommandDefinitions.registerWorkflowDefinitions, context => {
        registry.registerDefinitions?.(context.command.payload)
        return {
            count: context.command.payload.definitions.length,
        }
    }),
    onCommand(workflowRuntimeV2CommandDefinitions.removeWorkflowDefinition, context => {
        registry.removeDefinition?.(context.command.payload)
        return {
            workflowKey: context.command.payload.workflowKey,
        }
    }),
])
