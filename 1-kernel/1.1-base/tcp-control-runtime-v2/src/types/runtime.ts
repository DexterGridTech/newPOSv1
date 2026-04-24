import type {HttpRuntime} from '@next/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import type {
    ActivateTerminalApiRequest,
    ActivateTerminalApiResponse,
    DeactivateTerminalApiRequest,
    DeactivateTerminalApiResponse,
    RefreshTerminalCredentialApiRequest,
    RefreshTerminalCredentialApiResponse,
    ReportTaskResultApiRequest,
    ReportTaskResultApiResponse,
} from './api'

export interface TcpControlHttpService {
    activateTerminal(request: ActivateTerminalApiRequest): Promise<ActivateTerminalApiResponse>
    refreshCredential(request: RefreshTerminalCredentialApiRequest): Promise<RefreshTerminalCredentialApiResponse>
    deactivateTerminal(terminalId: string, request: DeactivateTerminalApiRequest): Promise<DeactivateTerminalApiResponse>
    reportTaskResult(
        terminalId: string,
        instanceId: string,
        request: ReportTaskResultApiRequest,
    ): Promise<ReportTaskResultApiResponse>
}

export interface TcpControlRuntimeAssemblyV2 {
    createHttpRuntime(context: RuntimeModuleContextV2): HttpRuntime
}

export interface CreateTcpControlRuntimeModuleV2Input {
    assembly?: TcpControlRuntimeAssemblyV2
}
