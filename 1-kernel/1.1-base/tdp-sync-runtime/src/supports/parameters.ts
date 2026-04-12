import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isPositiveFiniteNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
const isReconnectAttemptCount = (value: unknown) =>
    Number.isInteger(value) && typeof value === 'number' && value >= -1

export const tdpSyncParameterDefinitions = {
    tdpPingIntervalMs: {
        key: 'kernel.base.tdp-sync-runtime.ping-interval-ms',
        name: 'TDP ping interval in milliseconds',
        defaultValue: 30_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    tdpReconnectIntervalMs: {
        key: 'kernel.base.tdp-sync-runtime.reconnect-interval-ms',
        name: 'TDP reconnect interval in milliseconds',
        defaultValue: 20_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    tdpReconnectAttempts: {
        key: 'kernel.base.tdp-sync-runtime.reconnect-attempts',
        name: 'TDP reconnect attempts',
        defaultValue: -1,
        valueType: 'number',
        moduleName,
        validate: isReconnectAttemptCount,
    } satisfies ParameterDefinition<number>,
} as const

export const tdpSyncParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    tdpSyncParameterDefinitions,
)
