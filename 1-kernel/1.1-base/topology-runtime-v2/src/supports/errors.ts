import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {createModuleErrorFactory, listDefinitions} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const topologyRuntimeV2ErrorDefinitions = {
    sessionUnavailable: defineError('session_unavailable', {
        name: 'Topology Runtime V2 Session Unavailable',
        defaultTemplate: 'Topology runtime v2 session is not available for remote command ${commandName}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
    assemblyRequired: defineError('assembly_required', {
        name: 'Topology Runtime V2 Assembly Required',
        defaultTemplate: 'Topology runtime v2 assembly is required for command ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    socketBindingUnavailable: defineError('socket_binding_unavailable', {
        name: 'Topology Runtime V2 Socket Binding Unavailable',
        defaultTemplate: 'Topology runtime v2 socket binding is not available for ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    remoteNotConnected: defineError('remote_not_connected', {
        name: 'Topology Runtime V2 Remote Not Connected',
        defaultTemplate: 'Remote node is not connected',
        category: 'VALIDATION',
        severity: 'HIGH',
    }),
    remoteCommandResponseTimeout: defineError('remote_command_response_timeout', {
        name: 'Topology Runtime V2 Remote Command Response Timeout',
        defaultTemplate: 'Remote command response timeout: ${commandName}, ${timeoutMs}ms',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
} as const

export const topologyRuntimeV2ErrorDefinitionList: readonly ErrorDefinition[] = listDefinitions(
    topologyRuntimeV2ErrorDefinitions,
)
