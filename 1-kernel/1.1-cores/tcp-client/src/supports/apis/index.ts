import {SERVER_NAME_MOCK_TERMINAL_PLATFORM_API} from '@impos2/kernel-server-config'
import {defineHttpEndpoint, typed} from '@impos2/kernel-core-communication'
import type {
  ActivateTerminalApiRequest,
  ActivateTerminalApiResponse,
  RefreshTerminalCredentialApiRequest,
  RefreshTerminalCredentialApiResponse,
  ReportTaskResultApiRequest,
  ReportTaskResultApiResponse,
  TcpPlatformEnvelope,
} from '../../types'

export const kernelCoreTcpClientApis = {
  activateTerminal: defineHttpEndpoint<void, void, ActivateTerminalApiRequest, TcpPlatformEnvelope<ActivateTerminalApiResponse>>({
    name: 'tcpClient.activateTerminal',
    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/activate',
    request: {
      body: typed<ActivateTerminalApiRequest>('TcpActivateTerminalRequest'),
    },
    response: typed<TcpPlatformEnvelope<ActivateTerminalApiResponse>>('TcpActivateTerminalResponse'),
  }),
  refreshCredential: defineHttpEndpoint<void, void, RefreshTerminalCredentialApiRequest, TcpPlatformEnvelope<RefreshTerminalCredentialApiResponse>>({
    name: 'tcpClient.refreshCredential',
    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/token/refresh',
    request: {
      body: typed<RefreshTerminalCredentialApiRequest>('TcpRefreshCredentialRequest'),
    },
    response: typed<TcpPlatformEnvelope<RefreshTerminalCredentialApiResponse>>('TcpRefreshCredentialResponse'),
  }),
  reportTaskResult: defineHttpEndpoint<{terminalId: string; instanceId: string}, void, ReportTaskResultApiRequest, TcpPlatformEnvelope<ReportTaskResultApiResponse>>({
    name: 'tcpClient.reportTaskResult',
    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
    method: 'POST',
    pathTemplate: '/api/v1/terminals/{terminalId}/tasks/{instanceId}/result',
    request: {
      path: typed<{terminalId: string; instanceId: string}>('TcpReportTaskResultPath'),
      body: typed<ReportTaskResultApiRequest>('TcpReportTaskResultRequest'),
    },
    response: typed<TcpPlatformEnvelope<ReportTaskResultApiResponse>>('TcpReportTaskResultResponse'),
  }),
}
