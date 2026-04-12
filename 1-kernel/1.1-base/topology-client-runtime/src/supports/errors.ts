import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const topologyClientErrorDefinitions = {
    sessionUnavailable: {
        key: 'kernel.base.topology-client-runtime.session_unavailable',
        name: 'Topology Client Session Unavailable',
        defaultTemplate: 'Topology client session is not available for remote command ${commandName}',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    assemblyRequired: {
        key: 'kernel.base.topology-client-runtime.assembly_required',
        name: 'Topology Client Assembly Required',
        defaultTemplate: 'Topology client assembly is required for command ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    connectionPrecheckFailed: {
        key: 'kernel.base.topology-client-runtime.connection_precheck_failed',
        name: 'Topology Client Connection Precheck Failed',
        defaultTemplate: 'Topology connection precheck failed: ${reasons}',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    connectionFailed: {
        key: 'kernel.base.topology-client-runtime.connection_failed',
        name: 'Topology Client Connection Failed',
        defaultTemplate: 'Topology connection failed: ${message}',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    socketBindingUnavailable: {
        key: 'kernel.base.topology-client-runtime.socket_binding_unavailable',
        name: 'Topology Client Socket Binding Unavailable',
        defaultTemplate: 'Topology client socket binding is not available for ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    remoteNotConnected: {
        key: 'kernel.base.topology-client-runtime.remote_not_connected',
        name: 'Topology Remote Not Connected',
        defaultTemplate: 'Remote node is not connected',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    remoteCommandResponseTimeout: {
        key: 'kernel.base.topology-client-runtime.remote_command_response_timeout',
        name: 'Topology Remote Command Response Timeout',
        defaultTemplate: 'Remote command response timeout: ${commandName}, ${timeoutMs}ms',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const topologyClientErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    topologyClientErrorDefinitions,
)
