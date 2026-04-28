import type {AppError, TimestampMs} from '@next/kernel-base-contracts'

export type TcpActivationStatus =
    | 'UNACTIVATED'
    | 'ACTIVATING'
    | 'ACTIVATED'
    | 'FAILED'

export type TcpCredentialStatus =
    | 'EMPTY'
    | 'READY'
    | 'REFRESHING'
    | 'EXPIRED'

export interface TcpDeviceInfo {
    id?: string
    model?: string
    manufacturer?: string
    osVersion?: string
    [key: string]: unknown
}

export interface TerminalAssemblyCapabilityManifestV1 {
    protocolVersion: 'terminal-activation-capability-v1'
    assemblyId: string
    assemblyVersion?: string
    appId?: string
    appVersion?: string
    bundleVersion?: string
    supportedProfileCodes: string[]
    supportedCapabilities?: string[]
    supportedTemplateCodes?: string[]
}

export interface TcpBindingContext {
    platformId?: string
    tenantId?: string
    brandId?: string
    projectId?: string
    storeId?: string
    profileId?: string
    templateId?: string
}

export interface TcpIdentityState {
    deviceFingerprint?: string
    deviceInfo?: TcpDeviceInfo
    terminalId?: string
    activationStatus: TcpActivationStatus
    activatedAt?: TimestampMs
}

export interface TcpCredentialState {
    accessToken?: string
    refreshToken?: string
    expiresAt?: TimestampMs
    refreshExpiresAt?: TimestampMs
    status: TcpCredentialStatus
    updatedAt?: TimestampMs
}

export interface TcpBindingState extends TcpBindingContext {}

export interface TcpSandboxState {
    sandboxId?: string
    updatedAt?: TimestampMs
}

export interface TcpRuntimeState {
    bootstrapped: boolean
    lastActivationRequestId?: string
    lastRefreshRequestId?: string
    lastTaskReportRequestId?: string
    lastError?: AppError | null
}

export interface TcpIdentitySnapshot extends TcpIdentityState {}
export interface TcpCredentialSnapshot extends TcpCredentialState {}
export interface TcpSandboxSnapshot extends TcpSandboxState {}

export interface TcpTaskResultReportRuntimePayload {
    terminalId?: string
    instanceId: string
    status: string
    result?: unknown
    error?: unknown
}
