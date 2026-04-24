import {createModuleErrorFactory, listDefinitions} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const tdpSyncV2ErrorDefinitions = {
    credentialMissing: defineError('credential_missing', {
        name: 'TDP Credential Missing',
        defaultTemplate: 'TDP credential or terminal identity is missing',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
    }),
    handshakeFailed: defineError('handshake_failed', {
        name: 'TDP Handshake Failed',
        defaultTemplate: 'TDP handshake failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
    protocolError: defineError('protocol_error', {
        name: 'TDP Protocol Error',
        defaultTemplate: 'TDP protocol error: ${error}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    projectionApplyFailed: defineError('projection_apply_failed', {
        name: 'TDP Projection Apply Failed',
        defaultTemplate: 'TDP projection apply failed: ${error}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    assemblyRequired: defineError('assembly_required', {
        name: 'TDP Sync Assembly Required',
        defaultTemplate: 'TDP sync assembly is required for command ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
} as const

export const tdpSyncV2ErrorDefinitionList = listDefinitions(tdpSyncV2ErrorDefinitions)
