import type {
  TcpActivationRequest,
  TcpActivationResponse,
  TcpRefreshCredentialRequest,
  TcpRefreshCredentialResponse,
  TcpTaskResultReportRequest,
  TcpTaskResultReportResponse,
} from '../shared'

export interface TcpPlatformEnvelope<T> {
  success: boolean
  data: T
  error?: {
    message: string
    details?: unknown
  }
}

export interface ActivateTerminalApiRequest extends TcpActivationRequest {}

export interface ActivateTerminalApiResponse extends TcpActivationResponse {}

export interface RefreshTerminalCredentialApiRequest extends TcpRefreshCredentialRequest {}

export interface RefreshTerminalCredentialApiResponse extends TcpRefreshCredentialResponse {}

export interface ReportTaskResultApiRequest extends Omit<TcpTaskResultReportRequest, 'terminalId' | 'instanceId'> {}

export interface ReportTaskResultApiResponse extends TcpTaskResultReportResponse {}
