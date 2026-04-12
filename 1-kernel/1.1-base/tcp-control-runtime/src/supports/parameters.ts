import type {ParameterDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const isPositiveFiniteNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0

export const tcpControlParameterDefinitions = {
    credentialRefreshLeadTimeMs: {
        key: 'kernel.base.tcp-control-runtime.credential-refresh-lead-time-ms',
        name: 'Credential refresh lead time in milliseconds',
        defaultValue: 60_000,
        valueType: 'number',
        moduleName,
        validate: isPositiveFiniteNumber,
    } satisfies ParameterDefinition<number>,
} as const

export const tcpControlParameterDefinitionList: readonly ParameterDefinition[] = Object.values(
    tcpControlParameterDefinitions,
)
