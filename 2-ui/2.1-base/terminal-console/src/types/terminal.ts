export interface TerminalActivationModel {
    activationCode: string
    isSubmitting: boolean
    canSubmit: boolean
    errorMessage?: string
    setActivationCode(value: string): void
    submit(): Promise<void>
}

export interface TerminalConnectionSummary {
    status: string
    terminalId?: string
    activatedAt?: number
    credentialStatus?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    updatedAt?: number
    deviceId?: string
    deviceModel?: string
}
