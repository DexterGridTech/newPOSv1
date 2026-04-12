import type {HttpRuntime} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
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

export interface TcpControlRuntimeAssemblyV2 {
    createHttpRuntime(context: RuntimeModuleContextV2): HttpRuntime
}

export interface CreateTcpControlRuntimeModuleV2Input {
    assembly?: TcpControlRuntimeAssemblyV2
}
