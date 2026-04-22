import type {TerminalLogUploadPort} from '@impos2/kernel-base-platform-ports'
import {nativeLogger} from '../turbomodules/logger'

export const createAssemblyTerminalLogUploadPort = (): TerminalLogUploadPort => ({
    async uploadLogsForDate(input) {
        const result = await nativeLogger.uploadLogsForDate({
            uploadUrl: input.uploadUrl,
            logDate: input.logDate,
            terminalId: input.terminalId,
            sandboxId: input.sandboxId,
            commandId: input.commandId,
            instanceId: input.instanceId,
            releaseId: input.releaseId,
            displayIndex: input.displayIndex,
            displayRole: input.displayRole,
            overwrite: input.overwrite !== false,
            headers: input.headers ?? {},
            metadata: input.metadata ?? {},
        })
        return {
            terminalId: typeof result?.terminalId === 'string' ? result.terminalId : input.terminalId,
            displayIndex: typeof result?.displayIndex === 'number' ? result.displayIndex : input.displayIndex,
            displayRole: typeof result?.displayRole === 'string' ? result.displayRole : input.displayRole,
            logDate: typeof result?.logDate === 'string' ? result.logDate : input.logDate,
            uploadedFiles: Array.isArray(result?.uploadedFiles)
                ? result.uploadedFiles.map(file => ({
                    fileName: String(file?.fileName ?? ''),
                    fileSize: Number(file?.fileSize ?? 0),
                    uploadedAt: typeof file?.uploadedAt === 'number' ? file.uploadedAt : undefined,
                    checksum: typeof file?.checksum === 'string' ? file.checksum : undefined,
                    storageKey: typeof file?.storageKey === 'string' ? file.storageKey : undefined,
                    url: typeof file?.url === 'string' ? file.url : undefined,
                    metadata: file?.metadata && typeof file.metadata === 'object' && !Array.isArray(file.metadata)
                        ? file.metadata as Record<string, unknown>
                        : undefined,
                }))
                : [],
            skippedFiles: Array.isArray(result?.skippedFiles)
                ? result.skippedFiles.map(item => String(item))
                : undefined,
            metadata: result?.metadata && typeof result.metadata === 'object' && !Array.isArray(result.metadata)
                ? result.metadata as Record<string, unknown>
                : undefined,
        }
    },
})
