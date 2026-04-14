import {
    createHttpServiceBinder,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@impos2/kernel-server-config-v2'
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

const TCP_CONTROL_V2_HTTP_FALLBACK_MESSAGE = 'mock terminal platform request failed'

const defineEndpoint = createModuleHttpEndpointFactory(moduleName, SERVER_NAME_MOCK_TERMINAL_PLATFORM)

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
    const http = createHttpServiceBinder(runtime)

    return {
        async activateTerminal(request) {
            return http.envelope(
                activateTerminalEndpoint,
                {
                    body: request,
                },
                {
                    errorDefinition: tcpControlV2ErrorDefinitions.activationFailed,
                    fallbackMessage: TCP_CONTROL_V2_HTTP_FALLBACK_MESSAGE,
                },
            )
        },
        async refreshCredential(request) {
            return http.envelope(
                refreshCredentialEndpoint,
                {
                    body: request,
                },
                {
                    errorDefinition: tcpControlV2ErrorDefinitions.refreshFailed,
                    fallbackMessage: TCP_CONTROL_V2_HTTP_FALLBACK_MESSAGE,
                },
            )
        },
        async reportTaskResult(terminalId, instanceId, request) {
            return http.envelope(
                reportTaskResultEndpoint,
                {
                    path: {terminalId, instanceId},
                    body: request,
                },
                {
                    errorDefinition: tcpControlV2ErrorDefinitions.taskResultReportFailed,
                    fallbackMessage: TCP_CONTROL_V2_HTTP_FALLBACK_MESSAGE,
                },
            )
        },
    }
}
