import {moduleName} from '../moduleName'
import {packageVersion} from '../generated/packageVersion'
import {createAppError} from '@impos2/kernel-base-contracts'
import {workflowRuntimeCommandNames} from '../features/commands'
import {workflowRuntimeStateSlices} from '../features/slices'
import {
    workflowRuntimeErrorDefinitionList,
    workflowRuntimeErrorDefinitions,
    workflowRuntimeParameterDefinitionList,
} from '../supports'
import {createWorkflowEngine} from './createWorkflowEngine'
import {
    DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC,
    applyRemoteWorkflowDefinitionChanges,
} from './remoteDefinitions'
import type {
    CancelWorkflowRunInput,
    CreateWorkflowRuntimeModuleInput,
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowCommandInput,
    RunWorkflowSummary,
} from '../types'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {
    tdpSyncActorNames,
    type TdpTopicDataChangedPayload,
} from '@impos2/kernel-base-tdp-sync-runtime'
import {selectWorkflowDefinitionsState} from '../selectors'

const toRunSummary = (observation: {
    requestId: string
    workflowRunId: string
    workflowKey: string
    status: string
    output?: unknown
    context?: {
        variables?: Record<string, unknown>
        stepOutputs?: Record<string, unknown>
    }
    error?: unknown
    completedAt?: number
}): RunWorkflowSummary => ({
    requestId: observation.requestId as RunWorkflowSummary['requestId'],
    workflowRunId: observation.workflowRunId,
    workflowKey: observation.workflowKey,
    status: observation.status as RunWorkflowSummary['status'],
    result: {
        output: observation.output,
        variables: observation.context?.variables,
        stepOutputs: observation.context?.stepOutputs,
    },
    error: observation.error as RunWorkflowSummary['error'],
    completedAt: observation.completedAt,
})

export const createWorkflowRuntimeModule = (
    input: CreateWorkflowRuntimeModuleInput = {},
): KernelRuntimeModule => {
    return {
        moduleName,
        packageVersion,
        dependencies: [
            {
                moduleName: 'kernel.base.tdp-sync-runtime',
                optional: true,
            },
        ],
        stateSlices: workflowRuntimeStateSlices,
        commands: [
            {name: workflowRuntimeCommandNames.runWorkflow, visibility: 'public'},
            {name: workflowRuntimeCommandNames.cancelWorkflowRun, visibility: 'public'},
            {name: workflowRuntimeCommandNames.registerWorkflowDefinitions, visibility: 'public'},
            {name: workflowRuntimeCommandNames.removeWorkflowDefinition, visibility: 'public'},
        ],
        errorDefinitions: workflowRuntimeErrorDefinitionList,
        parameterDefinitions: workflowRuntimeParameterDefinitionList,
        install(context) {
            const runtime = createWorkflowEngine(context)

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'workflow-runtime-install',
                message: 'install workflow runtime contents',
                data: {
                    moduleName,
                    stateSlices: workflowRuntimeStateSlices.map(slice => slice.name),
                    commandNames: Object.values(workflowRuntimeCommandNames),
                },
            })

            if (input.initialDefinitions && input.initialDefinitions.length > 0) {
                runtime.registerDefinitions({
                    definitions: input.initialDefinitions,
                    source: 'module',
                })
            }

            const remoteDefinitionTopicKey = input.remoteDefinitionTopicKey
                ?? DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC

            context.registerActor(
                tdpSyncActorNames.topicDataChanged,
                async actorContext => {
                    const payload = actorContext.payload as TdpTopicDataChangedPayload
                    if (payload.topic !== remoteDefinitionTopicKey) {
                        return
                    }

                    applyRemoteWorkflowDefinitionChanges(
                        payload,
                        selectWorkflowDefinitionsState(context.getState() as Record<string, unknown>),
                        action => {
                            context.dispatchAction(action)
                        },
                        action => {
                            context.dispatchAction(action)
                        },
                    )
                },
            )

            input.onRuntimeReady?.(runtime)

            context.registerHandler(
                workflowRuntimeCommandNames.registerWorkflowDefinitions,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as RegisterWorkflowDefinitionsInput
                    runtime.registerDefinitions(payload)
                    return {
                        workflowKeys: payload.definitions.map(definition => definition.workflowKey),
                        count: payload.definitions.length,
                    }
                },
            )

            context.registerHandler(
                workflowRuntimeCommandNames.removeWorkflowDefinition,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as RemoveWorkflowDefinitionInput
                    runtime.removeDefinition(payload)
                    return {
                        workflowKey: payload.workflowKey,
                        definitionId: payload.definitionId,
                    }
                },
            )

            context.registerHandler(
                workflowRuntimeCommandNames.cancelWorkflowRun,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as CancelWorkflowRunInput
                    runtime.cancel(payload)
                    const requestId = payload.requestId ?? handlerContext.command.requestId
                    return {
                        requestId,
                    }
                },
            )

            context.registerHandler(
                workflowRuntimeCommandNames.runWorkflow,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as RunWorkflowCommandInput
                    const observation = await runtime.runFromCommand(
                        {
                            workflowKey: payload.workflowKey,
                            requestId: handlerContext.command.requestId,
                            input: payload.input,
                            context: payload.context,
                            options: payload.options,
                        },
                        handlerContext,
                    )

                    if (observation.status !== 'COMPLETED') {
                        throw createAppError(workflowRuntimeErrorDefinitions.workflowStepFailed, {
                            args: {stepKey: observation.progress.activeStepKey ?? observation.workflowKey},
                            details: {
                                workflowKey: observation.workflowKey,
                                workflowRunId: observation.workflowRunId,
                                status: observation.status,
                                error: observation.error,
                            },
                        })
                    }

                    return toRunSummary(observation)
                },
            )
        },
    }
}
