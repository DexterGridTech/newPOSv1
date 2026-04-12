import {defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {TcpDeviceInfo, TcpTaskResultReportRuntimePayload} from '../../types'

export const tcpControlV2CommandDefinitions = {
    bootstrapTcpControl: defineCommand<{
        deviceInfo?: TcpDeviceInfo
        deviceFingerprint?: string
    }>({
        moduleName,
        commandName: 'bootstrap-tcp-control',
    }),
    bootstrapTcpControlSucceeded: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'bootstrap-tcp-control-succeeded',
        visibility: 'internal',
    }),
    activateTerminal: defineCommand<{
        activationCode: string
        deviceInfo?: TcpDeviceInfo
        deviceFingerprint?: string
    }>({
        moduleName,
        commandName: 'activate-terminal',
    }),
    activateTerminalSucceeded: defineCommand<{
        terminalId: string
        accessToken: string
    }>({
        moduleName,
        commandName: 'activate-terminal-succeeded',
        visibility: 'internal',
    }),
    refreshCredential: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'refresh-credential',
    }),
    credentialRefreshed: defineCommand<{
        accessToken: string
        expiresAt: number
    }>({
        moduleName,
        commandName: 'credential-refreshed',
        visibility: 'internal',
    }),
    reportTaskResult: defineCommand<TcpTaskResultReportRuntimePayload>({
        moduleName,
        commandName: 'report-task-result',
    }),
    taskResultReported: defineCommand<{
        instanceId: string
        status: string
    }>({
        moduleName,
        commandName: 'task-result-reported',
        visibility: 'internal',
    }),
    resetTcpControl: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'reset-tcp-control',
    }),
} as const

export const tcpControlV2CommandNames = {
    bootstrapTcpControl: tcpControlV2CommandDefinitions.bootstrapTcpControl.commandName,
    bootstrapTcpControlSucceeded: tcpControlV2CommandDefinitions.bootstrapTcpControlSucceeded.commandName,
    activateTerminal: tcpControlV2CommandDefinitions.activateTerminal.commandName,
    activateTerminalSucceeded: tcpControlV2CommandDefinitions.activateTerminalSucceeded.commandName,
    refreshCredential: tcpControlV2CommandDefinitions.refreshCredential.commandName,
    credentialRefreshed: tcpControlV2CommandDefinitions.credentialRefreshed.commandName,
    reportTaskResult: tcpControlV2CommandDefinitions.reportTaskResult.commandName,
    taskResultReported: tcpControlV2CommandDefinitions.taskResultReported.commandName,
    resetTcpControl: tcpControlV2CommandDefinitions.resetTcpControl.commandName,
} as const
