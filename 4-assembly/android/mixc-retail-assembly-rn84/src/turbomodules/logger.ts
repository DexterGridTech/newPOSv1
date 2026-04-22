import NativeLoggerTurboModule from './specs/NativeLoggerTurboModule'

export const nativeLogger = {
    debug(tag: string, message: string): void {
        NativeLoggerTurboModule.debug(tag, message)
    },
    log(tag: string, message: string): void {
        NativeLoggerTurboModule.log(tag, message)
    },
    warn(tag: string, message: string): void {
        NativeLoggerTurboModule.warn(tag, message)
    },
    error(tag: string, message: string): void {
        NativeLoggerTurboModule.error(tag, message)
    },
    async getLogFiles(): Promise<ReadonlyArray<Record<string, unknown>>> {
        return JSON.parse(await NativeLoggerTurboModule.getLogFiles()) as ReadonlyArray<Record<string, unknown>>
    },
    async uploadLogsForDate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeLoggerTurboModule.uploadLogsForDate(JSON.stringify(input))) as Record<string, unknown>
    },
    async getLogContent(fileName: string, maxBytes: number): Promise<string> {
        return await NativeLoggerTurboModule.getLogContent(fileName, maxBytes)
    },
    async deleteLogFile(fileName: string): Promise<boolean> {
        return await NativeLoggerTurboModule.deleteLogFile(fileName)
    },
    async clearAllLogs(): Promise<boolean> {
        return await NativeLoggerTurboModule.clearAllLogs()
    },
    async getLogDirPath(): Promise<string> {
        return await NativeLoggerTurboModule.getLogDirPath()
    },
}
