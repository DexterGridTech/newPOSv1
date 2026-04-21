import {
    createModuleParameterFactory,
    integerAtLeast,
    listDefinitions,
    positiveFiniteNumber,
} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const reconnectAttemptCount = integerAtLeast(-1)

const defineParameter = createModuleParameterFactory(moduleName)

export const tdpSyncV2ParameterDefinitions = {
    tdpPingIntervalMs: defineParameter.number('ping-interval-ms', {
        name: 'TDP ping interval in milliseconds',
        defaultValue: 30_000,
        validate: positiveFiniteNumber,
    }),
    tdpReconnectIntervalMs: defineParameter.number('reconnect-interval-ms', {
        name: 'TDP reconnect interval in milliseconds',
        defaultValue: 20_000,
        validate: positiveFiniteNumber,
    }),
    tdpReconnectAttempts: defineParameter.number('reconnect-attempts', {
        name: 'TDP reconnect attempts',
        defaultValue: -1,
        validate: reconnectAttemptCount,
    }),
    tdpConnectionTimeoutMs: defineParameter.number('connection-timeout-ms', {
        name: 'TDP connection timeout in milliseconds',
        defaultValue: 10_000,
        validate: positiveFiniteNumber,
    }),
    tdpHeartbeatTimeoutMs: defineParameter.number('heartbeat-timeout-ms', {
        name: 'TDP heartbeat timeout in milliseconds',
        defaultValue: 45_000,
        validate: positiveFiniteNumber,
    }),
    hotUpdateIdleThresholdMs: defineParameter.number('hot-update-idle-threshold-ms', {
        name: 'Hot update idle threshold in milliseconds',
        defaultValue: 300_000,
        validate: positiveFiniteNumber,
    }),
} as const

export const tdpSyncV2ParameterDefinitionList = listDefinitions(tdpSyncV2ParameterDefinitions)
