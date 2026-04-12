import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isNonNegativeInteger = (value: unknown) => {
    return Number.isInteger(value) && typeof value === 'number' && value >= 0
}

const isPositiveFiniteNumber = (value: unknown) => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const isFailoverStrategy = (value: unknown) => {
    return value === 'ordered' || value === 'single-address'
}

const isReconnectAttemptCount = (value: unknown) => {
    return Number.isInteger(value) && typeof value === 'number' && value >= -1
}

export const transportRuntimeParameterDefinitions = {
    httpRetryRounds: {
        key: 'kernel.base.transport-runtime.http.retry-rounds',
        name: 'Transport HTTP retry rounds',
        defaultValue: 0,
        valueType: 'number',
        moduleName,
        validate: isNonNegativeInteger,
    } satisfies ParameterDefinition<number>,
    httpFailoverStrategy: {
        key: 'kernel.base.transport-runtime.http.failover-strategy',
        name: 'Transport HTTP failover strategy',
        defaultValue: 'ordered',
        valueType: 'string',
        moduleName,
        validate: isFailoverStrategy,
    } satisfies ParameterDefinition<'ordered' | 'single-address'>,
    socketReconnectAttempts: {
        key: 'kernel.base.transport-runtime.socket.reconnect-attempts',
        name: 'Transport socket reconnect attempts',
        defaultValue: 0,
        valueType: 'number',
        moduleName,
        validate: isReconnectAttemptCount,
    } satisfies ParameterDefinition<number>,
    socketReconnectDelayMs: {
        key: 'kernel.base.transport-runtime.socket.reconnect-delay-ms',
        name: 'Transport socket reconnect delay in milliseconds',
        defaultValue: 1_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    socketConnectionTimeoutMs: {
        key: 'kernel.base.transport-runtime.socket.connection-timeout-ms',
        name: 'Transport socket connection timeout in milliseconds',
        defaultValue: 10_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    socketHeartbeatIntervalMs: {
        key: 'kernel.base.transport-runtime.socket.heartbeat-interval-ms',
        name: 'Transport socket heartbeat interval in milliseconds',
        defaultValue: 30_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    socketHeartbeatTimeoutMs: {
        key: 'kernel.base.transport-runtime.socket.heartbeat-timeout-ms',
        name: 'Transport socket heartbeat timeout in milliseconds',
        defaultValue: 60_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
} as const

export const transportRuntimeParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    transportRuntimeParameterDefinitions,
)
