import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    TerminalLogUploadCommandPayload,
    TerminalLogUploadPeerPayload,
} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const terminalLogUploadRuntimeV2CommandDefinitions = {
    uploadTerminalLogs: defineModuleCommand<TerminalLogUploadCommandPayload>('upload-terminal-logs'),
    uploadPeerTerminalLogs: defineModuleCommand<TerminalLogUploadPeerPayload>('upload-peer-terminal-logs', {
        defaultTarget: 'peer',
    }),
} as const

export const terminalLogUploadRuntimeV2CommandNames = {
    uploadTerminalLogs: terminalLogUploadRuntimeV2CommandDefinitions.uploadTerminalLogs.commandName,
    uploadPeerTerminalLogs: terminalLogUploadRuntimeV2CommandDefinitions.uploadPeerTerminalLogs.commandName,
} as const
