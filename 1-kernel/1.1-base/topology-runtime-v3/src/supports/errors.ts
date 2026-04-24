import type {ErrorDefinition} from '@next/kernel-base-contracts'
import {createModuleErrorFactory, listDefinitions} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const topologyRuntimeV3ErrorDefinitions = {
    displayContextRequired: defineError('display_context_required', {
        name: 'Topology Runtime V3 Display Context Required',
        defaultTemplate: 'Topology runtime v3 requires displayIndex/displayCount',
        category: 'VALIDATION',
        severity: 'HIGH',
    }),
    orchestratorRequired: defineError('orchestrator_required', {
        name: 'Topology Runtime V3 Orchestrator Required',
        defaultTemplate: 'Topology runtime v3 orchestrator is required for ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    socketBindingRequired: defineError('socket_binding_required', {
        name: 'Topology Runtime V3 Socket Binding Required',
        defaultTemplate: 'Topology runtime v3 socket binding is required',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    helloRuntimeRequired: defineError('hello_runtime_required', {
        name: 'Topology Runtime V3 Hello Runtime Required',
        defaultTemplate: 'Topology runtime v3 hello runtime is required',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    actionNotAllowed: defineError('action_not_allowed', {
        name: 'Topology Runtime V3 Action Not Allowed',
        defaultTemplate: 'Topology runtime v3 action ${commandName} is not allowed: ${reasonCode}',
        category: 'VALIDATION',
        severity: 'MEDIUM',
    }),
} as const

export const topologyRuntimeV3ErrorDefinitionList: readonly ErrorDefinition[] = listDefinitions(
    topologyRuntimeV3ErrorDefinitions,
)
