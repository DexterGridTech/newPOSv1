import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isPositiveFiniteNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0

export const workflowRuntimeParameterDefinitions = {
    defaultWorkflowTimeoutMs: {
        key: 'kernel.base.workflow-runtime.default-workflow-timeout-ms',
        name: 'Workflow default timeout in milliseconds',
        defaultValue: 60_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    defaultStepTimeoutMs: {
        key: 'kernel.base.workflow-runtime.default-step-timeout-ms',
        name: 'Workflow default step timeout in milliseconds',
        defaultValue: 15_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    progressHistoryLimit: {
        key: 'kernel.base.workflow-runtime.progress-history-limit',
        name: 'Workflow progress history limit',
        defaultValue: 50,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    maxQueuedRuns: {
        key: 'kernel.base.workflow-runtime.max-queued-runs',
        name: 'Workflow max queued runs',
        defaultValue: 100,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
} as const

export const workflowRuntimeParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    workflowRuntimeParameterDefinitions,
)
