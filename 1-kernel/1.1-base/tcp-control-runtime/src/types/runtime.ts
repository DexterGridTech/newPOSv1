import type {HttpRuntime} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeModuleInstallContext} from '@impos2/kernel-base-runtime-shell'
import type {
    ActivateTerminalApiRequest,
    ActivateTerminalApiResponse,
    RefreshTerminalCredentialApiRequest,
    RefreshTerminalCredentialApiResponse,
    ReportTaskResultApiRequest,
    ReportTaskResultApiResponse,
} from './api'

export interface TcpControlHttpService {
    activateTerminal(request: ActivateTerminalApiRequest): Promise<ActivateTerminalApiResponse>
    refreshCredential(request: RefreshTerminalCredentialApiRequest): Promise<RefreshTerminalCredentialApiResponse>
    reportTaskResult(
        terminalId: string,
        instanceId: string,
        request: ReportTaskResultApiRequest,
    ): Promise<ReportTaskResultApiResponse>
}

export interface TcpControlRuntimeAssembly {
    createHttpRuntime(context: RuntimeModuleInstallContext): HttpRuntime
}

export interface CreateTcpControlRuntimeModuleInput {
    assembly?: TcpControlRuntimeAssembly
}
