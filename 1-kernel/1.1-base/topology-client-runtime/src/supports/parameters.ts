import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isNonNegativeFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isPositiveFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
const isReconnectAttemptCount = (value: unknown) =>
    Number.isInteger(value) && typeof value === 'number' && value >= -1

export const topologyClientParameterDefinitions = {
    masterServerBootstrapDelayMs: {
        key: 'kernel.base.topology-client-runtime.master-server.bootstrap-delay-ms',
        name: 'Master server bootstrap delay in milliseconds',
        defaultValue: 2_000,
        valueType: 'number',
        moduleName,
        validate: isNonNegativeFiniteNumber,
    } satisfies ParameterDefinition<number>,
    slaveConnectDelayMs: {
        key: 'kernel.base.topology-client-runtime.slave.connect-delay-ms',
        name: 'Slave connection startup delay in milliseconds',
        defaultValue: 4_000,
        valueType: 'number',
        moduleName,
        validate: isNonNegativeFiniteNumber,
    } satisfies ParameterDefinition<number>,
    serverReconnectIntervalMs: {
        key: 'kernel.base.topology-client-runtime.server.reconnect-interval-ms',
        name: 'Topology server reconnect interval in milliseconds',
        defaultValue: 20_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    serverReconnectAttempts: {
        key: 'kernel.base.topology-client-runtime.server.reconnect-attempts',
        name: 'Topology server reconnect attempts',
        defaultValue: -1,
        valueType: 'number',
        moduleName,
        validate: isReconnectAttemptCount,
    } satisfies ParameterDefinition<number>,
    serverConnectionTimeoutMs: {
        key: 'kernel.base.topology-client-runtime.server.connection-timeout-ms',
        name: 'Topology server connection timeout in milliseconds',
        defaultValue: 10_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    serverHeartbeatTimeoutMs: {
        key: 'kernel.base.topology-client-runtime.server.heartbeat-timeout-ms',
        name: 'Topology server heartbeat timeout in milliseconds',
        defaultValue: 60_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    remoteCommandResponseTimeoutMs: {
        key: 'kernel.base.topology-client-runtime.remote-command.response-timeout-ms',
        name: 'Remote command response timeout in milliseconds',
        defaultValue: 6_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
    remoteCommandResponsePollIntervalMs: {
        key: 'kernel.base.topology-client-runtime.remote-command.response-poll-interval-ms',
        name: 'Remote command response poll interval in milliseconds',
        defaultValue: 10,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
} as const

export const topologyClientParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    topologyClientParameterDefinitions,
)
