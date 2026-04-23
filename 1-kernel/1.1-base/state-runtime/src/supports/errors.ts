import {createAppError} from '@impos2/kernel-base-contracts'
import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const stateRuntimeErrorDefinitions = {
    protectedPersistenceStorageMissing: {
        key: 'kernel.base.state-runtime.protected_persistence_storage_missing',
        name: 'Protected Persistence Storage Missing',
        defaultTemplate: 'Missing secureStateStorage for protected persistence in ${runtimeName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const stateRuntimeErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    stateRuntimeErrorDefinitions,
)

export const createProtectedPersistenceStorageMissingError = (
    runtimeName: string,
    details?: unknown,
) => createAppError(stateRuntimeErrorDefinitions.protectedPersistenceStorageMissing, {
    args: {runtimeName},
    details,
})
