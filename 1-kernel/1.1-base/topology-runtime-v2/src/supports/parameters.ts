import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {
    createModuleParameterFactory,
    integerAtLeast,
    listDefinitions,
    nonNegativeFiniteNumber,
    positiveFiniteNumber,
} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineParameter = createModuleParameterFactory(moduleName)

export const topologyRuntimeV2ParameterDefinitions = {
    masterServerBootstrapDelayMs: defineParameter.number('master-server.bootstrap-delay-ms', {
        name: 'Master server bootstrap delay in milliseconds',
        defaultValue: 2_000,
        validate: nonNegativeFiniteNumber,
    }),
    slaveConnectDelayMs: defineParameter.number('slave.connect-delay-ms', {
        name: 'Slave connection startup delay in milliseconds',
        defaultValue: 4_000,
        validate: nonNegativeFiniteNumber,
    }),
    serverReconnectIntervalMs: defineParameter.number('server.reconnect-interval-ms', {
        name: 'Topology server reconnect interval in milliseconds',
        defaultValue: 20_000,
        validate: positiveFiniteNumber,
    }),
    serverReconnectAttempts: defineParameter.number('server.reconnect-attempts', {
        name: 'Topology server reconnect attempts',
        defaultValue: -1,
        validate: integerAtLeast(-1),
    }),
    serverConnectionTimeoutMs: defineParameter.number('server.connection-timeout-ms', {
        name: 'Topology server connection timeout in milliseconds',
        defaultValue: 10_000,
        validate: positiveFiniteNumber,
    }),
    serverHeartbeatTimeoutMs: defineParameter.number('server.heartbeat-timeout-ms', {
        name: 'Topology server heartbeat timeout in milliseconds',
        defaultValue: 60_000,
        validate: positiveFiniteNumber,
    }),
    remoteCommandResponseTimeoutMs: defineParameter.number('remote-command.response-timeout-ms', {
        name: 'Remote command response timeout in milliseconds',
        defaultValue: 6_000,
        validate: positiveFiniteNumber,
    }),
    remoteCommandResponsePollIntervalMs: defineParameter.number('remote-command.response-poll-interval-ms', {
        name: 'Remote command response poll interval in milliseconds',
        defaultValue: 10,
        validate: positiveFiniteNumber,
    }),
} as const

export const topologyRuntimeV2ParameterDefinitionList = listDefinitions(
    topologyRuntimeV2ParameterDefinitions,
) as readonly ParameterDefinition<any>[]
