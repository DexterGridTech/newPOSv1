import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const tdpSyncErrorDefinitions = {
    credentialMissing: {
        key: 'kernel.base.tdp-sync-runtime.credential_missing',
        name: 'TDP Credential Missing',
        defaultTemplate: 'TDP credential or terminal identity is missing',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    handshakeFailed: {
        key: 'kernel.base.tdp-sync-runtime.handshake_failed',
        name: 'TDP Handshake Failed',
        defaultTemplate: 'TDP handshake failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    protocolError: {
        key: 'kernel.base.tdp-sync-runtime.protocol_error',
        name: 'TDP Protocol Error',
        defaultTemplate: 'TDP protocol error: ${error}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    assemblyRequired: {
        key: 'kernel.base.tdp-sync-runtime.assembly_required',
        name: 'TDP Sync Assembly Required',
        defaultTemplate: 'TDP sync assembly is required for command ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const tdpSyncErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    tdpSyncErrorDefinitions,
)
