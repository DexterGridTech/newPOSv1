import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {workflowRuntimeV2CommandDefinitions} from '../commands'
import type {WorkflowRuntimeRegistryRecord} from '../../foundations/runtime'

export const createWorkflowRunActorDefinitionV2 = (
    registry: WorkflowRuntimeRegistryRecord,
): ActorDefinition => ({
    moduleName,
    actorName: 'WorkflowRunActor',
    handlers: [
        onCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, async context => {
                const runFromCommand = registry.runFromCommand
                if (!runFromCommand) {
                    throw new Error('workflow engine not installed')
                }
                const payload = context.command.payload
                return await runFromCommand({
                    workflowKey: payload.workflowKey,
                    requestId: context.command.requestId,
                    input: payload.input,
                    context: payload.context,
                    options: payload.options,
                }, context) as unknown as Record<string, unknown>
            },
        ),
    ],
})
