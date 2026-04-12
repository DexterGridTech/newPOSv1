import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {workflowRuntimeV2CommandDefinitions} from '../commands'
import type {WorkflowRuntimeRegistryRecord} from '../../foundations/runtime'

export const createWorkflowControlActorDefinitionV2 = (
    registry: WorkflowRuntimeRegistryRecord,
): ActorDefinition => ({
    moduleName,
    actorName: 'WorkflowControlActor',
    handlers: [
        onCommand(workflowRuntimeV2CommandDefinitions.cancelWorkflowRun, context => {
                registry.cancel?.(context.command.payload)
                return {
                    requestId: context.command.payload.requestId ?? context.command.requestId,
                }
            },
        ),
    ],
})
