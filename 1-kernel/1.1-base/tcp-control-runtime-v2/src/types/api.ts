import type {
    TcpBindingContext,
    TcpDeviceInfo,
    TcpTaskResultReportRuntimePayload,
    TerminalAssemblyCapabilityManifestV1,
} from './state'

export interface TcpPlatformEnvelope<T> {
    success: boolean
    data: T
    error?: {
        message: string
        details?: unknown
    }
}

export interface ActivateTerminalApiRequest {
    sandboxId: string
    activationCode: string
    deviceFingerprint: string
    deviceInfo: TcpDeviceInfo
    clientRuntime?: TerminalAssemblyCapabilityManifestV1
}

export interface ActivateTerminalApiResponse {
    terminalId: string
    token: string
    refreshToken: string
    expiresIn: number
    refreshExpiresIn?: number
    binding?: TcpBindingContext
    activationCompatibility?: {
        assemblyId?: string
        acceptedProfileCode: string
        acceptedTemplateCode?: string
        acceptedCapabilities?: string[]
        warnings?: string[]
    }
}

export interface RefreshTerminalCredentialApiRequest {
    sandboxId: string
    refreshToken: string
}

export interface RefreshTerminalCredentialApiResponse {
    token: string
    expiresIn: number
}

export interface DeactivateTerminalApiRequest {
    sandboxId: string
    reason?: string
}

export interface DeactivateTerminalApiResponse {
    terminalId: string
    status: string
    deactivatedAt?: number
    reason?: string
}

export interface ReportTaskResultApiRequest
    extends Omit<TcpTaskResultReportRuntimePayload, 'terminalId' | 'instanceId'> {
    sandboxId: string
}

export interface ReportTaskResultApiResponse {
    instanceId: string
    status: string
    finishedAt?: number
}
