import {
    createModuleParameterFactory,
    listDefinitions,
    positiveFiniteNumber,
} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineParameter = createModuleParameterFactory(moduleName)

export const workflowRuntimeV2ParameterDefinitions = {
    defaultWorkflowTimeoutMs: defineParameter.number('default-workflow-timeout-ms', {
        name: 'Default workflow timeout in milliseconds',
        defaultValue: 60_000,
        validate: positiveFiniteNumber,
    }),
    defaultStepTimeoutMs: defineParameter.number('default-step-timeout-ms', {
        name: 'Default step timeout in milliseconds',
        defaultValue: 15_000,
        validate: positiveFiniteNumber,
    }),
    eventHistoryLimit: defineParameter.number('event-history-limit', {
        name: 'Workflow event history limit',
        defaultValue: 100,
        validate: positiveFiniteNumber,
    }),
    queueSizeLimit: defineParameter.number('queue-size-limit', {
        name: 'Workflow queue size limit',
        defaultValue: 100,
        validate: positiveFiniteNumber,
    }),
} as const

export const workflowRuntimeV2ParameterDefinitionList = listDefinitions(workflowRuntimeV2ParameterDefinitions)
