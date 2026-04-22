export interface TerminalLogUploadCommandPayload {
    commandId?: string
    instanceId?: string
    releaseId?: string | null
    sourceReleaseId?: string | null
    logDate: string
    uploadUrl: string
    overwrite?: boolean
    headers?: Record<string, string>
    metadata?: Record<string, unknown>
}

export interface TerminalLogUploadPeerPayload extends TerminalLogUploadCommandPayload {
    initiatedBy: 'master'
}
