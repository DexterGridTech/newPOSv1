import type {TcpBindingContext, TcpDeviceInfo, TcpTaskResultReportRuntimePayload} from './state'

export interface TcpPlatformEnvelope<T> {
    success: boolean
    data: T
    error?: {
        message: string
        details?: unknown
    }
}

export interface ActivateTerminalApiRequest {
    activationCode: string
    deviceFingerprint: string
    deviceInfo: TcpDeviceInfo
}

export interface ActivateTerminalApiResponse {
    terminalId: string
    token: string
    refreshToken: string
    expiresIn: number
    refreshExpiresIn?: number
    binding?: TcpBindingContext
}

export interface RefreshTerminalCredentialApiRequest {
    refreshToken: string
}

export interface RefreshTerminalCredentialApiResponse {
    token: string
    expiresIn: number
}

export interface ReportTaskResultApiRequest
    extends Omit<TcpTaskResultReportRuntimePayload, 'terminalId' | 'instanceId'> {}

export interface ReportTaskResultApiResponse {
    instanceId: string
    status: string
    finishedAt?: number
}
