import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const topologyRuntimeErrorDefinitions = {
    requestAlreadyRegistered: {
        key: 'kernel.base.topology-runtime.request_already_registered',
        name: 'Request Already Registered',
        defaultTemplate: 'Request already registered: ${requestId}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    requestNotFound: {
        key: 'kernel.base.topology-runtime.request_not_found',
        name: 'Request Not Found',
        defaultTemplate: 'Request not found: ${requestId}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    commandNotFound: {
        key: 'kernel.base.topology-runtime.command_not_found',
        name: 'Owner Command Node Not Found',
        defaultTemplate: 'Command node not found: ${commandId}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    commandParentNotFound: {
        key: 'kernel.base.topology-runtime.command_parent_not_found',
        name: 'Owner Parent Command Node Not Found',
        defaultTemplate: 'Parent command node not found: ${parentCommandId}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    remoteCommandFailed: {
        key: 'kernel.base.topology-runtime.remote_command_failed',
        name: 'Remote Command Failed',
        defaultTemplate: '${message}',
        category: 'SYSTEM',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const topologyRuntimeErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    topologyRuntimeErrorDefinitions,
)
