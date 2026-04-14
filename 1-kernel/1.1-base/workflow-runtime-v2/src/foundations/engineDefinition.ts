import {isAppError, type AppError} from '@impos2/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {WorkflowDefinition, WorkflowDefinitionsBySource} from '../types'
import {
    selectWorkflowDefinitionsBySource,
} from '../selectors'
import {
    createDefinitionDisabledError,
    createDefinitionNotFoundError,
    createExecutionFailedError,
} from './defaults'
import {
    hasOnlyDisabledDefinitionsBySource,
    resolveWorkflowDefinitionFromSources,
} from './definitionResolver'

export const createWorkflowDefinitionResolver = (input: {
    context: RuntimeModuleContextV2
    runtimePlatform?: WorkflowDefinition['platform']
}) => {
    const resolveDefinition = (workflowKey: string) => {
        const bySource = selectWorkflowDefinitionsBySource(input.context.getState()) as WorkflowDefinitionsBySource | undefined
        const resolved = resolveWorkflowDefinitionFromSources(bySource, workflowKey, input.runtimePlatform)
        if (resolved) {
            if (!resolved.enabled) {
                throw createDefinitionDisabledError(workflowKey)
            }
            return resolved
        }
        if (hasOnlyDisabledDefinitionsBySource(bySource, workflowKey)) {
            throw createDefinitionDisabledError(workflowKey)
        }
        throw createDefinitionNotFoundError(workflowKey)
    }

    const toDefinitionError = (
        workflowKey: string,
        error: unknown,
    ): AppError => {
        if (isAppError(error)) {
            return error
        }
        return createExecutionFailedError(workflowKey, error)
    }

    return {
        resolveDefinition,
        toDefinitionError,
    }
}
