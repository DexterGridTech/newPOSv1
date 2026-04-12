import {moduleName} from '../../moduleName'

export const tcpControlCommandNames = {
    bootstrapTcpControl: `${moduleName}.bootstrap-tcp-control`,
    bootstrapTcpControlSucceeded: `${moduleName}.bootstrap-tcp-control-succeeded`,
    activateTerminal: `${moduleName}.activate-terminal`,
    activateTerminalSucceeded: `${moduleName}.activate-terminal-succeeded`,
    refreshCredential: `${moduleName}.refresh-credential`,
    credentialRefreshed: `${moduleName}.credential-refreshed`,
    reportTaskResult: `${moduleName}.report-task-result`,
    taskResultReported: `${moduleName}.task-result-reported`,
    resetTcpControl: `${moduleName}.reset-tcp-control`,
} as const
