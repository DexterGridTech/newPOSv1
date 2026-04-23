import {createModuleErrorFactory, listDefinitions} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const terminalLogUploadRuntimeV2ErrorDefinitions = {
        terminalLogPortMissing: defineError('terminal_log_port_missing', {
            name: 'Terminal Log Upload Port Missing',
            defaultTemplate: 'platformPorts.terminalLogs is not available',
            category: 'SYSTEM',
            severity: 'HIGH',
        }),
        terminalNotActivated: defineError('terminal_not_activated', {
            name: 'Terminal Log Upload Terminal Not Activated',
            defaultTemplate: 'terminalId is missing for terminal log upload',
            category: 'BUSINESS',
            severity: 'MEDIUM',
        }),
        invalidRemoteCommandPayload: defineError('invalid_remote_command_payload', {
            name: 'Terminal Log Upload Invalid Remote Command Payload',
            defaultTemplate: 'remote terminal log upload command payload is invalid',
            category: 'BUSINESS',
            severity: 'MEDIUM',
        }),
} as const

export const terminalLogUploadRuntimeV2ErrorDefinitionList = listDefinitions(terminalLogUploadRuntimeV2ErrorDefinitions)
