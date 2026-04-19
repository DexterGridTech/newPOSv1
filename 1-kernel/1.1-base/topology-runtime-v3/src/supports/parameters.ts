import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {
    createModuleParameterFactory,
    listDefinitions,
    nonNegativeFiniteNumber,
} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineParameter = createModuleParameterFactory(moduleName)

export const topologyRuntimeV3ParameterDefinitions = {
    reconnectIntervalMs: defineParameter.number('reconnect-interval-ms', {
        name: 'Topology runtime v3 reconnect interval in milliseconds',
        defaultValue: 20_000,
        validate: nonNegativeFiniteNumber,
    }),
} as const

export const topologyRuntimeV3ParameterDefinitionList = listDefinitions(
    topologyRuntimeV3ParameterDefinitions,
) as readonly ParameterDefinition<any>[]
