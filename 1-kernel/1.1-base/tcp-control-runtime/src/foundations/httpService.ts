import {createAppError} from '@impos2/kernel-base-contracts'
import {
    defineHttpEndpoint,
    normalizeTransportError,
    typed,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {tcpControlErrorDefinitions} from '../supports'
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

const activateTerminalEndpoint = defineHttpEndpoint<
    void,
    void,
    ActivateTerminalApiRequest,
    TcpPlatformEnvelope<ActivateTerminalApiResponse>
>({
    name: 'kernel.base.tcp-control-runtime.activate-terminal',
    serverName: MOCK_TERMINAL_PLATFORM_SERVER,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/activate',
    request: {
        body: typed<ActivateTerminalApiRequest>('kernel.base.tcp-control-runtime.activate-terminal.body'),
    },
    response: typed<TcpPlatformEnvelope<ActivateTerminalApiResponse>>('kernel.base.tcp-control-runtime.activate-terminal.response'),
})

const refreshCredentialEndpoint = defineHttpEndpoint<
    void,
    void,
    RefreshTerminalCredentialApiRequest,
    TcpPlatformEnvelope<RefreshTerminalCredentialApiResponse>
>({
    name: 'kernel.base.tcp-control-runtime.refresh-credential',
    serverName: MOCK_TERMINAL_PLATFORM_SERVER,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/token/refresh',
    request: {
        body: typed<RefreshTerminalCredentialApiRequest>('kernel.base.tcp-control-runtime.refresh-credential.body'),
    },
    response: typed<TcpPlatformEnvelope<RefreshTerminalCredentialApiResponse>>('kernel.base.tcp-control-runtime.refresh-credential.response'),
})

const reportTaskResultEndpoint = defineHttpEndpoint<
    {terminalId: string; instanceId: string},
    void,
    ReportTaskResultApiRequest,
    TcpPlatformEnvelope<ReportTaskResultApiResponse>
>({
    name: 'kernel.base.tcp-control-runtime.report-task-result',
    serverName: MOCK_TERMINAL_PLATFORM_SERVER,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/{terminalId}/tasks/{instanceId}/result',
    request: {
        path: typed<{terminalId: string; instanceId: string}>('kernel.base.tcp-control-runtime.report-task-result.path'),
        body: typed<ReportTaskResultApiRequest>('kernel.base.tcp-control-runtime.report-task-result.body'),
    },
    response: typed<TcpPlatformEnvelope<ReportTaskResultApiResponse>>('kernel.base.tcp-control-runtime.report-task-result.response'),
})

const unwrapEnvelope = <T>(
    envelope: TcpPlatformEnvelope<T>,
    errorFactory: (message: string, details?: unknown) => ReturnType<typeof createAppError>,
): T => {
    if (!envelope.success) {
        throw errorFactory(
            envelope.error?.message ?? 'mock-terminal-platform request failed',
            envelope.error?.details,
        )
    }
    return envelope.data
}

export const createTcpControlHttpService = (
    runtime: HttpRuntime,
): TcpControlHttpService => {
    return {
        async activateTerminal(request) {
            try {
                const response = await runtime.call(activateTerminalEndpoint, {
                    body: request,
                })
                return unwrapEnvelope(response.data, (message, details) => createAppError(
                    tcpControlErrorDefinitions.activationFailed,
                    {args: {error: message}, details},
                ))
            } catch (error) {
                const normalized = normalizeTransportError(error)
                throw createAppError(tcpControlErrorDefinitions.activationFailed, {
                    args: {error: normalized.message},
                    details: normalized,
                    cause: normalized,
                })
            }
        },
        async refreshCredential(request) {
            try {
                const response = await runtime.call(refreshCredentialEndpoint, {
                    body: request,
                })
                return unwrapEnvelope(response.data, (message, details) => createAppError(
                    tcpControlErrorDefinitions.refreshFailed,
                    {args: {error: message}, details},
                ))
            } catch (error) {
                const normalized = normalizeTransportError(error)
                throw createAppError(tcpControlErrorDefinitions.refreshFailed, {
                    args: {error: normalized.message},
                    details: normalized,
                    cause: normalized,
                })
            }
        },
        async reportTaskResult(terminalId, instanceId, request) {
            try {
                const response = await runtime.call(reportTaskResultEndpoint, {
                    path: {terminalId, instanceId},
                    body: request,
                })
                return unwrapEnvelope(response.data, (message, details) => createAppError(
                    tcpControlErrorDefinitions.taskResultReportFailed,
                    {args: {error: message}, details},
                ))
            } catch (error) {
                const normalized = normalizeTransportError(error)
                throw createAppError(tcpControlErrorDefinitions.taskResultReportFailed, {
                    args: {error: normalized.message},
                    details: normalized,
                    cause: normalized,
                })
            }
        },
    }
}
