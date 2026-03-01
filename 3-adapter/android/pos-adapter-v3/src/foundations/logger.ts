import type {Logger, LogFile} from '@impos2/kernel-core-base'
import NativeLoggerTurboModule from '../specs/NativeLoggerTurboModule'

class LoggerAdapter implements Logger {
    debug(tags: string[], message: string, data?: any): void {
        NativeLoggerTurboModule.debug(tags.join('.'), this.buildMessage(message, data))
    }

    log(tags: string[], message: string, data?: any): void {
        NativeLoggerTurboModule.log(tags.join('.'), this.buildMessage(message, data))
    }

    warn(tags: string[], message: string, data?: any): void {
        NativeLoggerTurboModule.warn(tags.join('.'), this.buildMessage(message, data))
    }

    error(tags: string[], message: string, data?: any): void {
        NativeLoggerTurboModule.error(tags.join('.'), this.buildMessage(message, data))
    }

    async getLogFiles(): Promise<LogFile[]> {
        return NativeLoggerTurboModule.getLogFiles()
    }

    async getLogContent(fileName: string): Promise<string> {
        return NativeLoggerTurboModule.getLogContent(fileName)
    }

    async deleteLogFile(fileName: string): Promise<boolean> {
        return NativeLoggerTurboModule.deleteLogFile(fileName)
    }

    async clearAllLogs(): Promise<boolean> {
        return NativeLoggerTurboModule.clearAllLogs()
    }

    async getLogDirPath(): Promise<string> {
        return NativeLoggerTurboModule.getLogDirPath()
    }

    async sendLogFileToServer(date: Date, serverURL: string, params: any): Promise<boolean> {
        const dateStr = this.formatDate(date)
        const paramsJson = JSON.stringify(params || {})
        return NativeLoggerTurboModule.sendLogFileToServer(dateStr, serverURL, paramsJson)
    }

    private buildMessage(message: string, data?: any): string {
        if (data == null) return message
        if (data instanceof Error) return `${message}\n${data.stack ?? data.message}`
        if (typeof data === 'object') {
            try {
                return `${message}\n${JSON.stringify(data, null, 2)}`
            } catch {
                return `${message}\n[unserializable]`
            }
        }
        return `${message}\n${String(data)}`
    }

    private formatDate(date: Date): string {
        // 使用本地时区,与Android端SimpleDateFormat保持一致
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }
}

export const loggerAdapter = new LoggerAdapter()
export type {LogFile} from '../specs/NativeLoggerTurboModule'
