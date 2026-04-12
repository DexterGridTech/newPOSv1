import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {createWorkflowActorDefinitionsV2} from '../features/actors'
import {workflowRuntimeV2CommandDefinitions} from '../features/commands'
import {workflowRuntimeV2StateSlices} from '../features/slices'
import {
    workflowRuntimeV2ErrorDefinitionList,
    workflowRuntimeV2ParameterDefinitionList,
} from '../supports'
import type {CreateWorkflowRuntimeModuleV2Input} from '../types'
import {createWorkflowEngineV2} from './engine'
import type {WorkflowRuntimeRegistryRecord} from './runtime'

export const DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC_V2 = 'kernel.workflow.definition'

export const createWorkflowRuntimeModuleV2 = (
    input: CreateWorkflowRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const registry: WorkflowRuntimeRegistryRecord = {}
    const remoteDefinitionTopicKey = input.remoteDefinitionTopicKey ?? DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC_V2

    return {
        moduleName,
        packageVersion,
        dependencies: [
            {
                moduleName: 'kernel.base.tdp-sync-runtime-v2',
                optional: true,
            },
        ],
        stateSlices: workflowRuntimeV2StateSlices,
        commandDefinitions: Object.values(workflowRuntimeV2CommandDefinitions),
        actorDefinitions: createWorkflowActorDefinitionsV2(registry, remoteDefinitionTopicKey),
        errorDefinitions: workflowRuntimeV2ErrorDefinitionList,
        parameterDefinitions: workflowRuntimeV2ParameterDefinitionList,
        install(context) {
            const engine = createWorkflowEngineV2({
                context,
                registry,
            })
            registry.runtime = engine.runtime
            registry.runFromCommand = engine.runFromCommand
            registry.registerDefinitions = inputValue => {
                void engine.runtime.registerDefinitions(inputValue)
            }
            registry.removeDefinition = inputValue => {
                void engine.runtime.removeDefinition(inputValue)
            }
            registry.cancel = inputValue => {
                engine.runtime.cancel(inputValue)
            }

            if (input.initialDefinitions && input.initialDefinitions.length > 0) {
                engine.registerDefinitions([...input.initialDefinitions], 'module')
            }

            input.onRuntimeReady?.(engine.runtime)

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'workflow-runtime-v2-install',
                message: 'install workflow runtime v2 contents',
                data: {
                    moduleName,
                    stateSlices: workflowRuntimeV2StateSlices.map(slice => slice.name),
                    commandNames: Object.values(workflowRuntimeV2CommandDefinitions).map(item => item.commandName),
                    remoteDefinitionTopicKey,
                },
            })
        },
    }
}
