import type {ParameterDefinition} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isNonNegativeFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const stateRuntimeParameterDefinitions = {
    persistenceDebounceMs: {
        key: 'kernel.base.state-runtime.persistence.debounce-ms',
        name: 'State persistence debounce in milliseconds',
        defaultValue: 16,
        valueType: 'number',
        moduleName,
        validate: isNonNegativeFiniteNumber,
    } satisfies ParameterDefinition<number>,
} as const

export const stateRuntimeParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    stateRuntimeParameterDefinitions,
)
