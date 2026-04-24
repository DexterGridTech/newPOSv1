import type {ErrorDefinition} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const executionRuntimeErrorDefinitions = {
    commandNotFound: {
        key: 'kernel.base.execution-runtime.command_not_found',
        name: 'Execution Command Not Found',
        defaultTemplate: 'Execution handler not found for ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    commandExecutionFailed: {
        key: 'kernel.base.execution-runtime.command_execution_failed',
        name: 'Execution Command Failed',
        defaultTemplate: 'Execution failed for ${commandName}',
        category: 'SYSTEM',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const executionRuntimeErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    executionRuntimeErrorDefinitions,
)
