import {
    createModuleParameterFactory,
    listDefinitions,
    positiveFiniteNumber,
} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineParameter = createModuleParameterFactory(moduleName)

export const tcpControlV2ParameterDefinitions = {
    credentialRefreshLeadTimeMs: defineParameter.number('credential-refresh-lead-time-ms', {
        name: 'Credential refresh lead time in milliseconds',
        defaultValue: 60_000,
        validate: positiveFiniteNumber,
    }),
} as const

export const tcpControlV2ParameterDefinitionList = listDefinitions(tcpControlV2ParameterDefinitions)
