import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {TcpDeviceInfo, TcpTaskResultReportRuntimePayload} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const tcpControlV2CommandDefinitions = {
    bootstrapTcpControl: defineModuleCommand<{
        deviceInfo?: TcpDeviceInfo
        deviceFingerprint?: string
    }>('bootstrap-tcp-control'),
    bootstrapTcpControlSucceeded: defineModuleCommand<Record<string, never>>(
        'bootstrap-tcp-control-succeeded',
        {
            visibility: 'internal',
        },
    ),
    activateTerminal: defineModuleCommand<{
        sandboxId: string
        activationCode: string
        deviceInfo?: TcpDeviceInfo
        deviceFingerprint?: string
    }>('activate-terminal'),
    activateTerminalSucceeded: defineModuleCommand<{
        terminalId: string
        accessToken: string
    }>('activate-terminal-succeeded', {
        visibility: 'internal',
    }),
    refreshCredential: defineModuleCommand<Record<string, never>>('refresh-credential'),
    credentialRefreshed: defineModuleCommand<{
        accessToken: string
        expiresAt: number
    }>('credential-refreshed', {
        visibility: 'internal',
    }),
    deactivateTerminal: defineModuleCommand<{
        reason?: string
    }>('deactivate-terminal'),
    deactivateTerminalSucceeded: defineModuleCommand<{
        terminalId: string
    }>('deactivate-terminal-succeeded', {
        visibility: 'internal',
    }),
    reportTaskResult: defineModuleCommand<TcpTaskResultReportRuntimePayload>('report-task-result'),
    taskResultReported: defineModuleCommand<{
        instanceId: string
        status: string
    }>('task-result-reported', {
        visibility: 'internal',
    }),
    resetTcpControl: defineModuleCommand<Record<string, never>>('reset-tcp-control'),
} as const

export const tcpControlV2CommandNames = {
    bootstrapTcpControl: tcpControlV2CommandDefinitions.bootstrapTcpControl.commandName,
    bootstrapTcpControlSucceeded: tcpControlV2CommandDefinitions.bootstrapTcpControlSucceeded.commandName,
    activateTerminal: tcpControlV2CommandDefinitions.activateTerminal.commandName,
    activateTerminalSucceeded: tcpControlV2CommandDefinitions.activateTerminalSucceeded.commandName,
    refreshCredential: tcpControlV2CommandDefinitions.refreshCredential.commandName,
    credentialRefreshed: tcpControlV2CommandDefinitions.credentialRefreshed.commandName,
    deactivateTerminal: tcpControlV2CommandDefinitions.deactivateTerminal.commandName,
    deactivateTerminalSucceeded: tcpControlV2CommandDefinitions.deactivateTerminalSucceeded.commandName,
    reportTaskResult: tcpControlV2CommandDefinitions.reportTaskResult.commandName,
    taskResultReported: tcpControlV2CommandDefinitions.taskResultReported.commandName,
    resetTcpControl: tcpControlV2CommandDefinitions.resetTcpControl.commandName,
} as const
