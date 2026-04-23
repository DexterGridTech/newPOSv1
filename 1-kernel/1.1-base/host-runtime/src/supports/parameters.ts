import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isPositiveFiniteNumber = (value: unknown) => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const isPositiveInteger = (value: unknown) => {
    return Number.isInteger(value) && isPositiveFiniteNumber(value)
}

export const hostRuntimeParameterDefinitions = {
    heartbeatTimeoutMs: {
        key: 'kernel.base.host-runtime.heartbeat-timeout-ms',
        name: 'Host runtime heartbeat timeout in milliseconds',
        defaultValue: 15_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    maxObservationEvents: {
        key: 'kernel.base.host-runtime.max-observation-events',
        name: 'Host runtime maximum retained observation event count',
        defaultValue: 200,
        valueType: 'number',
        moduleName,
        validate: isPositiveInteger,
    } satisfies ParameterDefinition<number>,
} as const

export const hostRuntimeParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    hostRuntimeParameterDefinitions,
)
