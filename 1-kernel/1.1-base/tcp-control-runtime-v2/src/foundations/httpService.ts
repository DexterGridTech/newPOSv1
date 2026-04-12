import {
    callHttpEnvelope,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {moduleName} from '../moduleName'
import {tcpControlV2ErrorDefinitions} from '../supports'
import type {
    ActivateTerminalApiRequest,
    ActivateTerminalApiResponse,
    RefreshTerminalCredentialApiRequest,
    RefreshTerminalCredentialApiResponse,
    ReportTaskResultApiRequest,
    ReportTaskResultApiResponse,
    TcpControlHttpService,
    TcpPlatformEnvelope,
} from '../types'

const MOCK_TERMINAL_PLATFORM_SERVER = 'mock-terminal-platform'

const defineEndpoint = createModuleHttpEndpointFactory(moduleName, MOCK_TERMINAL_PLATFORM_SERVER)

const activateTerminalEndpoint = defineEndpoint<
    void,
    void,
    ActivateTerminalApiRequest,
    TcpPlatformEnvelope<ActivateTerminalApiResponse>
>('activate-terminal', {
    method: 'POST',
    pathTemplate: '/api/v1/terminals/activate',
    request: {
        body: true,
    },
})

const refreshCredentialEndpoint = defineEndpoint<
    void,
    void,
    RefreshTerminalCredentialApiRequest,
    TcpPlatformEnvelope<RefreshTerminalCredentialApiResponse>
>('refresh-credential', {
    method: 'POST',
    pathTemplate: '/api/v1/terminals/token/refresh',
    request: {
        body: true,
    },
})

const reportTaskResultEndpoint = defineEndpoint<
    {terminalId: string; instanceId: string},
    void,
    ReportTaskResultApiRequest,
    TcpPlatformEnvelope<ReportTaskResultApiResponse>
>('report-task-result', {
    method: 'POST',
    pathTemplate: '/api/v1/terminals/{terminalId}/tasks/{instanceId}/result',
    request: {
        path: true,
        body: true,
    },
})

export const createTcpControlHttpServiceV2 = (
    runtime: HttpRuntime,
): TcpControlHttpService => {
    return {
        async activateTerminal(request) {
            return callHttpEnvelope(runtime, activateTerminalEndpoint, {
                body: request,
            }, {
                errorDefinition: tcpControlV2ErrorDefinitions.activationFailed,
                fallbackMessage: 'mock-terminal-platform request failed',
            })
        },
        async refreshCredential(request) {
            return callHttpEnvelope(runtime, refreshCredentialEndpoint, {
                body: request,
            }, {
                errorDefinition: tcpControlV2ErrorDefinitions.refreshFailed,
                fallbackMessage: 'mock-terminal-platform request failed',
            })
        },
        async reportTaskResult(terminalId, instanceId, request) {
            return callHttpEnvelope(runtime, reportTaskResultEndpoint, {
                path: {terminalId, instanceId},
                body: request,
            }, {
                errorDefinition: tcpControlV2ErrorDefinitions.taskResultReportFailed,
                fallbackMessage: 'mock-terminal-platform request failed',
            })
        },
    }
}
