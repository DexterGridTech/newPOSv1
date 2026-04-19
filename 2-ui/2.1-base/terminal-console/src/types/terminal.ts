export interface TerminalActivationModel {
    sandboxId: string
    activationCode: string
    isSubmitting: boolean
    canSubmit: boolean
    activationStatus: string
    eligibilityAllowed: boolean
    eligibilityReasonCode: string
    eligibilityMessage: string
    inputDisabled: boolean
    submitLabel: string
    errorMessage?: string
    setSandboxId(value: string): void
    setActivationCode(value: string): void
    submit(): Promise<void>
}

export interface TerminalConnectionSummary {
    status: string
    sandboxId?: string
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
